import { Router } from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import prisma from '../db.js';
import { bulkImportSchema, validate } from '../validation.js';

const HF_IMAGE_BASE = 'https://img.hellofresh.com/f_auto,fl_lossy,q_auto,w_1200/hellofresh_s3';

const LOCALE_CONFIG = {
  en: { country: 'us', locale: 'en-US', domain: 'www.hellofresh.com', language: 'en' },
  fr: { country: 'ca', locale: 'fr-CA', domain: 'www.hellofresh.ca', language: 'fr' },
};

const router = Router();

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    return data.props?.pageProps?.ssrPayload?.recipe || null;
  } catch {
    return null;
  }
}

function difficultyLabel(level) {
  if (level === 0 || level === 1) return 'Easy';
  if (level === 2) return 'Medium';
  if (level === 3) return 'Hard';
  return level != null ? String(level) : null;
}

function hfRecipeToDbData(hfRecipe, lang, domain) {
  const ingredientMap = new Map();
  for (const ing of hfRecipe.ingredients || []) {
    ingredientMap.set(ing.id, ing);
  }

  const firstYield = (hfRecipe.yields || [])[0];
  const ingredients = (firstYield?.ingredients || []).map((yi) => {
    const info = ingredientMap.get(yi.id);
    return {
      name: info?.name || 'Unknown',
      amount: yi.amount != null ? String(yi.amount) : '',
      unit: yi.unit || '',
    };
  });

  const steps = (hfRecipe.steps || [])
    .sort((a, b) => a.index - b.index)
    .map((step) => ({
      stepNumber: step.index,
      instruction: step.instructions || '',
      imageUrl: step.images?.[0]?.path
        ? `${HF_IMAGE_BASE}${step.images[0].path}`
        : null,
    }));

  const imageUrl = hfRecipe.imagePath
    ? `${HF_IMAGE_BASE}${hfRecipe.imagePath}`
    : null;

  const description = (hfRecipe.description || '').replace(/<[^>]*>/g, '').trim();

  const tags = [
    ...(hfRecipe.tags || []).map((t) => t.name),
    ...(hfRecipe.cuisines || []).map((c) => c.name),
  ].filter(Boolean);

  const websiteUrl = hfRecipe.websiteUrl
    || (hfRecipe.slug ? `https://${domain}/recipes/${hfRecipe.slug}` : null);

  return {
    title: hfRecipe.name,
    description,
    imageUrl,
    servings: firstYield?.yields || 2,
    prepTime: hfRecipe.prepTime || null,
    totalTime: hfRecipe.totalTime || null,
    difficulty: difficultyLabel(hfRecipe.difficulty),
    cuisine: (hfRecipe.cuisines || []).map((c) => c.name).join(', ') || null,
    tags,
    sourceUrl: websiteUrl,
    language: lang,
    ingredients: { create: ingredients },
    steps: { create: steps },
  };
}

async function getHelloFreshToken() {
  const res = await fetch('https://www.hellofresh.com/recipes', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) throw new Error('Could not extract token from HelloFresh');
  const data = JSON.parse(match[1]);
  return data.props.pageProps.ssrPayload.serverAuth.access_token;
}

// Import recipe from HelloFresh URL
router.post('/hellofresh', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Detect language from URL domain
    const lang = url.includes('hellofresh.ca') ? 'fr' : 'en';

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const html = await response.text();
    const hfRecipe = extractNextData(html);

    if (!hfRecipe) {
      return res.status(400).json({
        error: 'Could not find recipe data on the page. Make sure the URL is a valid HelloFresh recipe page.',
      });
    }

    const config = LOCALE_CONFIG[lang];
    const dbData = hfRecipeToDbData(hfRecipe, lang, config.domain);
    dbData.sourceUrl = url;

    const recipe = await prisma.recipe.create({
      data: dbData,
      include: { ingredients: true, steps: true },
    });

    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- HelloFresh bulk scraper via their API ----

const API_MAX_OFFSET = 9980; // Elasticsearch caps at 10000
const PAGE_SIZE = 20;

// Segments to split large result sets under the 10K limit
// Each segment is a set of query params; we try the full set first,
// then split by difficulty, then by difficulty+calorie range
const DIFFICULTY_SEGMENTS = [0, 1, 2, 3];
const CALORIE_SEGMENTS = [
  { min: 0, max: 300 },
  { min: 301, max: 500 },
  { min: 501, max: 700 },
  { min: 701, max: 900 },
  { min: 901, max: 1200 },
  { min: 1201, max: 9999 },
];

let scrapeStatus = {
  running: false, imported: 0, skipped: 0, failed: 0,
  total: 0, errors: [], done: false, lang: '',
  segment: '', segmentsCompleted: 0, segmentsTotal: 0,
};

async function countSegment(token, baseUrl, extraParams = '') {
  const url = `${baseUrl}&offset=0&limit=1${extraParams}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return 0;
  const data = await res.json();
  return data?.total || 0;
}

async function scrapeSegment(token, config, lang, baseUrl, extraParams, existingUrls, maxRecipes) {
  let offset = 0;
  const segTotal = await countSegment(token, baseUrl, extraParams);
  const cap = Math.min(segTotal, API_MAX_OFFSET, maxRecipes > 0 ? maxRecipes : Infinity);

  while (offset < cap && scrapeStatus.running) {
    const batchSize = Math.min(PAGE_SIZE, cap - offset);
    const apiUrl = `${baseUrl}&offset=${offset}&limit=${batchSize}${extraParams}`;

    let apiRes = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });

    if (!apiRes.ok) {
      token = await getHelloFreshToken();
      apiRes = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!apiRes.ok) {
        scrapeStatus.errors.push(`API error at offset ${offset}: ${apiRes.status}`);
        break;
      }
    }

    const batch = await apiRes.json();
    const items = batch?.items || [];
    if (items.length === 0) break;

    for (const hfRecipe of items) {
      try {
        const slug = hfRecipe.slug || '';
        const sourceUrl = `https://${config.domain}/recipes/${slug}`;

        if (existingUrls.has(sourceUrl)) {
          scrapeStatus.skipped++;
          continue;
        }

        const dbData = hfRecipeToDbData(hfRecipe, lang, config.domain);
        await prisma.recipe.create({ data: dbData });
        existingUrls.add(sourceUrl);
        scrapeStatus.imported++;
      } catch (err) {
        scrapeStatus.failed++;
        if (scrapeStatus.errors.length < 50) {
          scrapeStatus.errors.push(`${hfRecipe.name}: ${err.message}`);
        }
      }
    }

    offset += items.length;
    await new Promise((r) => setTimeout(r, 200));
  }

  return token; // may have been refreshed
}

// Start bulk scrape (runs in background)
router.post('/hellofresh/scrape-all', async (req, res) => {
  if (scrapeStatus.running) {
    return res.status(409).json({ error: 'Scrape already in progress', status: scrapeStatus });
  }

  const limit = parseInt(req.body.limit) || 0;
  const lang = req.body.lang || 'en';
  const config = LOCALE_CONFIG[lang];
  if (!config) {
    return res.status(400).json({ error: 'Invalid language. Use "en" or "fr".' });
  }

  scrapeStatus = {
    running: true, imported: 0, skipped: 0, failed: 0,
    total: 0, errors: [], done: false, lang,
    segment: 'initializing', segmentsCompleted: 0, segmentsTotal: 0,
  };

  res.json({ message: `Scrape started (${lang})`, status: scrapeStatus });

  (async () => {
    try {
      let token = await getHelloFreshToken();
      const baseUrl = `https://gw.hellofresh.com/api/recipes/search?country=${config.country}&locale=${config.locale}`;

      // Count total available
      const totalAvailable = await countSegment(token, baseUrl);
      scrapeStatus.total = limit > 0 ? Math.min(limit, totalAvailable) : totalAvailable;

      // Get existing URLs to skip duplicates
      const existing = await prisma.recipe.findMany({
        where: { language: lang },
        select: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map((r) => r.sourceUrl).filter(Boolean));

      // Build segment plan: check which segments need sub-splitting
      const segments = [];

      if (scrapeStatus.total <= API_MAX_OFFSET) {
        // Small enough, no segmentation needed
        segments.push({ params: '', label: 'all' });
      } else {
        // Split by difficulty first
        for (const diff of DIFFICULTY_SEGMENTS) {
          const diffParam = `&difficulty=${diff}`;
          const diffCount = await countSegment(token, baseUrl, diffParam);

          if (diffCount <= API_MAX_OFFSET) {
            segments.push({ params: diffParam, label: `difficulty=${diff} (${diffCount})` });
          } else {
            // Further split by calorie range
            for (const cal of CALORIE_SEGMENTS) {
              const calParam = `${diffParam}&min-calories=${cal.min}&max-calories=${cal.max}`;
              const calCount = await countSegment(token, baseUrl, calParam);
              if (calCount > 0) {
                segments.push({ params: calParam, label: `difficulty=${diff} cal=${cal.min}-${cal.max} (${calCount})` });
              }
            }
          }
        }
      }

      scrapeStatus.segmentsTotal = segments.length;
      scrapeStatus.segment = `0/${segments.length} segments`;

      for (let i = 0; i < segments.length && scrapeStatus.running; i++) {
        const seg = segments[i];
        scrapeStatus.segment = `${i + 1}/${segments.length}: ${seg.label}`;
        scrapeStatus.segmentsCompleted = i;

        token = await scrapeSegment(token, config, lang, baseUrl, seg.params, existingUrls, limit);
      }

      scrapeStatus.segmentsCompleted = segments.length;
    } catch (err) {
      scrapeStatus.errors.push(`Fatal: ${err.message}`);
    } finally {
      scrapeStatus.running = false;
      scrapeStatus.done = true;
      scrapeStatus.segment = 'complete';
    }
  })();
});

// Check scrape progress
router.get('/hellofresh/scrape-status', (req, res) => {
  res.json(scrapeStatus);
});

// Stop scrape
router.post('/hellofresh/scrape-stop', (req, res) => {
  scrapeStatus.running = false;
  res.json({ message: 'Scrape stopping...', status: scrapeStatus });
});

// Bulk import from JSON (e.g., exported from Obsidian)
router.post('/bulk', validate(bulkImportSchema), async (req, res) => {
  try {
    const { recipes, language } = req.body;
    const created = await prisma.$transaction(
      recipes.map((data) =>
        prisma.recipe.create({
          data: {
            title: data.title,
            description: data.description || '',
            imageUrl: data.imageUrl || null,
            servings: data.servings || 2,
            prepTime: data.prepTime || null,
            totalTime: data.totalTime || null,
            difficulty: data.difficulty || null,
            cuisine: data.cuisine || null,
            tags: data.tags || [],
            sourceUrl: data.sourceUrl || null,
            language,
            ingredients: {
              create: (data.ingredients || []).map((ing) => ({
                name: typeof ing === 'string' ? ing : (ing.name || ''),
                amount: typeof ing === 'string' ? '' : (ing.amount || ''),
                unit: typeof ing === 'string' ? '' : (ing.unit || ''),
              })),
            },
            steps: {
              create: (data.steps || []).map((step, i) => ({
                stepNumber: i + 1,
                instruction: typeof step === 'string' ? step : (step.instruction || ''),
                imageUrl: typeof step === 'string' ? null : (step.imageUrl || null),
              })),
            },
          },
          include: { ingredients: true, steps: true },
        })
      )
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
