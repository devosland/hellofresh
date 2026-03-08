import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import prisma from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

const router = Router();

// Get available tags for filters (scoped by language)
router.get('/tags', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const recipes = await prisma.recipe.findMany({
      where: { language: lang },
      select: { tags: true },
    });
    const counts = {};
    for (const r of recipes) {
      for (const t of r.tags) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    const tags = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search recipes (returns nothing if no query)
router.get('/', async (req, res) => {
  try {
    const { search, tags, page = '1', limit = '24', lang = 'en' } = req.query;

    // No search = no results (search-engine style)
    if (!search && !tags) {
      return res.json({ recipes: [], total: 0, page: 1, totalPages: 0 });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(60, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * pageSize;

    const where = { AND: [{ language: lang }] };

    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { cuisine: { contains: search, mode: 'insensitive' } },
          { ingredients: { some: { name: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }

    if (tags) {
      where.AND.push({ tags: { hasSome: tags.split(',') } });
    }

    const finalWhere = where.AND.length > 0 ? where : {};

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where: finalWhere,
        include: { ingredients: true, steps: { orderBy: { stepNumber: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.recipe.count({ where: finalWhere }),
    ]);

    res.json({
      recipes,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single recipe
router.get('/:id', async (req, res) => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { ingredients: true, steps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create recipe
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data || '{}');
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : data.imageUrl || null;

    const recipe = await prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl,
        servings: data.servings || 2,
        prepTime: data.prepTime,
        totalTime: data.totalTime,
        difficulty: data.difficulty,
        cuisine: data.cuisine,
        tags: data.tags || [],
        sourceUrl: data.sourceUrl,
        ingredients: {
          create: (data.ingredients || []).map((ing) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
          })),
        },
        steps: {
          create: (data.steps || []).map((step, i) => ({
            stepNumber: step.stepNumber || i + 1,
            instruction: step.instruction,
            imageUrl: step.imageUrl,
          })),
        },
      },
      include: { ingredients: true, steps: true },
    });
    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create recipe from JSON (no file upload)
router.post('/json', async (req, res) => {
  try {
    const data = req.body;
    const recipe = await prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl || null,
        servings: data.servings || 2,
        prepTime: data.prepTime,
        totalTime: data.totalTime,
        difficulty: data.difficulty,
        cuisine: data.cuisine,
        tags: data.tags || [],
        sourceUrl: data.sourceUrl,
        ingredients: {
          create: (data.ingredients || []).map((ing) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
          })),
        },
        steps: {
          create: (data.steps || []).map((step, i) => ({
            stepNumber: step.stepNumber || i + 1,
            instruction: step.instruction,
            imageUrl: step.imageUrl,
          })),
        },
      },
      include: { ingredients: true, steps: true },
    });
    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update recipe
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = JSON.parse(req.body.data || '{}');
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : data.imageUrl;

    // Delete existing ingredients and steps
    await prisma.ingredient.deleteMany({ where: { recipeId: id } });
    await prisma.step.deleteMany({ where: { recipeId: id } });

    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        ...(imageUrl !== undefined && { imageUrl }),
        servings: data.servings || 2,
        prepTime: data.prepTime,
        totalTime: data.totalTime,
        difficulty: data.difficulty,
        cuisine: data.cuisine,
        tags: data.tags || [],
        sourceUrl: data.sourceUrl,
        ingredients: {
          create: (data.ingredients || []).map((ing) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
          })),
        },
        steps: {
          create: (data.steps || []).map((step, i) => ({
            stepNumber: step.stepNumber || i + 1,
            instruction: step.instruction,
            imageUrl: step.imageUrl,
          })),
        },
      },
      include: { ingredients: true, steps: true },
    });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete recipe
router.delete('/:id', async (req, res) => {
  try {
    await prisma.recipe.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
