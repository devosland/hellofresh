import { Router } from 'express';
import prisma from '../db.js';

const router = Router();

// Generate shopping list from selected recipe IDs
router.post('/', async (req, res) => {
  try {
    const { recipeIds } = req.body;
    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      return res.status(400).json({ error: 'Provide an array of recipe IDs' });
    }

    const recipes = await prisma.recipe.findMany({
      where: { id: { in: recipeIds.map(Number) } },
      include: { ingredients: true },
    });

    // Aggregate ingredients by normalized name
    const aggregated = new Map();
    for (const recipe of recipes) {
      for (const ing of recipe.ingredients) {
        const key = ing.name.toLowerCase().trim();
        if (!aggregated.has(key)) {
          aggregated.set(key, {
            name: ing.name,
            entries: [],
          });
        }
        aggregated.get(key).entries.push({
          amount: ing.amount,
          unit: ing.unit,
          fromRecipe: recipe.title,
        });
      }
    }

    // Build shopping list
    const shoppingList = Array.from(aggregated.values())
      .map((item) => ({
        name: item.name,
        details: item.entries,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ recipeCount: recipes.length, shoppingList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
