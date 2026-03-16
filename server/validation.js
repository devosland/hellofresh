import { z } from 'zod';

const SUPPORTED_LANGS = ['en', 'fr'];

export const langSchema = z.enum(SUPPORTED_LANGS).catch('en');

const ingredientSchema = z.object({
  name: z.string().min(1),
  amount: z.string().optional().default(''),
  unit: z.string().optional().default(''),
});

const stepSchema = z.object({
  stepNumber: z.number().optional(),
  instruction: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
});

export const recipeCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  imageUrl: z.string().optional().nullable(),
  servings: z.number().optional().default(2),
  prepTime: z.string().optional().nullable(),
  totalTime: z.string().optional().nullable(),
  difficulty: z.string().optional().nullable(),
  cuisine: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  sourceUrl: z.string().optional().nullable(),
  language: langSchema.optional().default('en'),
  ingredients: z.array(ingredientSchema).optional().default([]),
  steps: z.array(stepSchema).optional().default([]),
});

export const recipeUpdateSchema = recipeCreateSchema;

export const bulkImportSchema = z.object({
  recipes: z.array(z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional().default(''),
    imageUrl: z.string().optional().nullable(),
    servings: z.number().optional().default(2),
    prepTime: z.string().optional().nullable(),
    totalTime: z.string().optional().nullable(),
    difficulty: z.string().optional().nullable(),
    cuisine: z.string().optional().nullable(),
    tags: z.array(z.string()).optional().default([]),
    sourceUrl: z.string().optional().nullable(),
    ingredients: z.array(z.union([ingredientSchema, z.string()])).optional().default([]),
    steps: z.array(z.union([stepSchema, z.string()])).optional().default([]),
  })).min(1, 'At least one recipe is required'),
  language: langSchema.optional().default('en'),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    req.body = result.data;
    next();
  };
}
