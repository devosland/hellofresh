import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import prisma from '../db.js';
import { langSchema, recipeCreateSchema, recipeUpdateSchema, validate } from '../validation.js';

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
    const lang = langSchema.parse(req.query.lang);
    const tags = await prisma.$queryRaw`
      SELECT unnest(tags) AS name, COUNT(*)::int AS count
      FROM "Recipe"
      WHERE language = ${lang}
      GROUP BY name
      ORDER BY count DESC
    `;
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search recipes (returns nothing if no query)
router.get('/', async (req, res) => {
  try {
    const { search, tags, page = '1', limit = '24' } = req.query;
    const lang = langSchema.parse(req.query.lang);

    // No search = no results (search-engine style)
    if (!search && !tags) {
      return res.json({ recipes: [], total: 0, page: 1, totalPages: 0 });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(60, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * pageSize;

    const where = { AND: [{ language: lang }] };

    if (search) {
      const words = search.trim().split(/\s+/).filter(Boolean);
      for (const word of words) {
        where.AND.push({
          OR: [
            { title: { contains: word, mode: 'insensitive' } },
            { description: { contains: word, mode: 'insensitive' } },
            { cuisine: { contains: word, mode: 'insensitive' } },
            { ingredients: { some: { name: { contains: word, mode: 'insensitive' } } } },
          ],
        });
      }
    }

    if (tags) {
      where.AND.push({ tags: { hasSome: tags.split(',') } });
    }

    const finalWhere = where.AND.length > 0 ? where : {};

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where: finalWhere,
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

// Create recipe (multipart upload)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data || '{}');
    const result = recipeCreateSchema.safeParse(data);
    if (!result.success) {
      const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const validated = result.data;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : validated.imageUrl || null;

    const recipe = await prisma.recipe.create({
      data: {
        title: validated.title,
        description: validated.description,
        imageUrl,
        servings: validated.servings,
        prepTime: validated.prepTime,
        totalTime: validated.totalTime,
        difficulty: validated.difficulty,
        cuisine: validated.cuisine,
        tags: validated.tags,
        sourceUrl: validated.sourceUrl,
        language: validated.language,
        ingredients: {
          create: validated.ingredients.map((ing) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
          })),
        },
        steps: {
          create: validated.steps.map((step, i) => ({
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
router.post('/json', validate(recipeCreateSchema), async (req, res) => {
  try {
    const data = req.body;
    const recipe = await prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl || null,
        servings: data.servings,
        prepTime: data.prepTime,
        totalTime: data.totalTime,
        difficulty: data.difficulty,
        cuisine: data.cuisine,
        tags: data.tags,
        sourceUrl: data.sourceUrl,
        language: data.language,
        ingredients: {
          create: data.ingredients.map((ing) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
          })),
        },
        steps: {
          create: data.steps.map((step, i) => ({
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
    const result = recipeUpdateSchema.safeParse(data);
    if (!result.success) {
      const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const validated = result.data;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : validated.imageUrl;

    // Check recipe exists
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Recipe not found' });

    // Atomic delete + recreate
    const recipe = await prisma.$transaction(async (tx) => {
      await tx.ingredient.deleteMany({ where: { recipeId: id } });
      await tx.step.deleteMany({ where: { recipeId: id } });

      return tx.recipe.update({
        where: { id },
        data: {
          title: validated.title,
          description: validated.description,
          ...(imageUrl !== undefined && { imageUrl }),
          servings: validated.servings,
          prepTime: validated.prepTime,
          totalTime: validated.totalTime,
          difficulty: validated.difficulty,
          cuisine: validated.cuisine,
          tags: validated.tags,
          sourceUrl: validated.sourceUrl,
          language: validated.language,
          ingredients: {
            create: validated.ingredients.map((ing) => ({
              name: ing.name,
              amount: ing.amount,
              unit: ing.unit,
            })),
          },
          steps: {
            create: validated.steps.map((step, i) => ({
              stepNumber: step.stepNumber || i + 1,
              instruction: step.instruction,
              imageUrl: step.imageUrl,
            })),
          },
        },
        include: { ingredients: true, steps: true },
      });
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
