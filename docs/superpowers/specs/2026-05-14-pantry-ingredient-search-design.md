# Pantry Ingredient Search — Design

**Date**: 2026-05-14
**Status**: Approved, ready for implementation
**Scope**: New `/pantry` page that finds recipes containing a user-supplied set of ingredients (AND logic).

## Goal

Answer the question "what can I cook with what I have on hand?". User types ingredients they have (e.g. *ground beef*, *cheddar*), and the app returns only recipes whose ingredient list contains **all** of them.

The existing global search (`GET /api/recipes?search=…`) already searches across title/description/cuisine/ingredients, but it is keyword-style: it doesn't constrain to the ingredient list, and it can't separate ingredients from incidental matches in the description. The pantry view solves a different, narrower problem and gets its own page.

## Non-goals

- Substitution suggestions ("you're missing one ingredient, here's a near-match")
- Dietary filters in this iteration (combining with tags/cuisines is deferred)
- Quantity-aware matching (we only check name presence)
- Pantry persistence per user (no auth in the app, no profile)

## UX

**Route**: `/pantry`

**Layout**:
1. Heading + short description ("Add ingredients you have on hand. Recipes need to contain all of them.")
2. Ingredient input — a single text input with autocomplete (HTML `<datalist>` or a small custom list)
3. Selected ingredients shown as removable chips below the input
4. Primary button "Find recipes" (also triggered on Enter when chips are present)
5. Results grid — same recipe-card style as `RecipeList`, with pagination

**URL sync**: `?ingredients=ground+beef,cheddar&page=2`. Reloading or sharing the URL restores the state.

**Language**: Uses the global `lang` prop already plumbed through `App.jsx`. Pantry matches only recipes in the current language (consistent with the existing search).

**i18n**: New translation keys (`pantry`, `pantryTitle`, `pantryDescription`, `addIngredient`, `findRecipes`, `noPantryResults`, `pantryNoIngredients`) added to both `en` and `fr` blocks.

**Nav**: New top-nav link "Pantry" / "Garde-manger" alongside Home / Import / Shopping List.

## Backend

Two new endpoints, both in `server/routes/recipes.js`:

### `GET /api/recipes/pantry`

Query params:
- `ingredients` (required) — comma-separated list. Each item is trimmed and lowercased server-side. Empty list returns `{ recipes: [], total: 0 }`.
- `lang` (validated via `langSchema`, defaults to `en`)
- `page`, `limit` — same defaults/caps as `GET /api/recipes` (page 1, limit 24, max 60)

Behavior:
- Build a Prisma `where` clause:
  ```js
  where: {
    language: lang,
    AND: ingredients.map((name) => ({
      ingredients: { some: { name: { contains: name, mode: 'insensitive' } } },
    })),
  }
  ```
- Each `some` translates to an `EXISTS` subquery. The AND between them enforces "every ingredient must appear in this recipe".
- Same pagination shape as the existing list endpoint: `{ recipes, total, page, totalPages }`.

### `GET /api/recipes/ingredient-names`

Query params:
- `q` (required, min length 1)
- `lang`
- `limit` (default 10, max 20)

Behavior:
- Returns distinct ingredient names that start with or contain `q` (case-insensitive), scoped to recipes in `lang`. Most-frequent names first.
- Implementation via `prisma.$queryRaw` joining Ingredient → Recipe so we can filter on `Recipe.language` and dedupe + sort by count in one query:
  ```sql
  SELECT i.name, COUNT(*)::int AS count
  FROM "Ingredient" i
  JOIN "Recipe" r ON r.id = i."recipeId"
  WHERE r.language = ${lang}
    AND i.name ILIKE ${'%' + q + '%'}
  GROUP BY i.name
  ORDER BY count DESC
  LIMIT ${limit};
  ```

Performance note: with the current dataset size (< 10k recipes), `ILIKE '%q%'` is acceptable. If the dataset grows materially, a `pg_trgm` GIN index on `Ingredient.name` is the upgrade path. Out of scope for this PR.

## Frontend

### New file: `client/src/pages/PantryPage.jsx`

State:
- `inputValue` (string, current text in the input)
- `suggestions` (array of `{ name, count }` from the autocomplete endpoint, debounced)
- `selected` (array of strings — ingredients chosen, synced to URL)
- `results`, `loading`, `error` (standard pattern from `RecipeList`)

Behavior:
- Debounce input changes (200 ms) → call `fetchIngredientNames`. Render suggestions in a `<datalist>` linked to the input.
- Pressing Enter or clicking "Add" with non-empty input appends to `selected`, clears the input. Adding an already-present chip is a no-op.
- Clicking the × on a chip removes it.
- "Find recipes" → calls `fetchPantryRecipes`, sets `results`, updates URL.
- Empty selection state shows a tip card ("Add an ingredient to start").

### Updates to `client/src/api.js`

Two new functions:
- `fetchPantryRecipes({ ingredients, page, limit, lang })`
- `fetchIngredientNames({ q, lang, limit })`

### Updates to `client/src/App.jsx`

- Add `<Route path="/pantry" element={<PantryPage lang={lang} />} />`
- Add a nav link.

### Updates to `client/src/i18n.js`

- Add the new keys listed in the UX section to both `en` and `fr`.

## Data model

No schema migrations. The existing `Ingredient` model + `Recipe.ingredients` relation is sufficient.

## Failure modes & edge cases

| Case | Behavior |
|------|----------|
| Empty `ingredients` param | Return `{ recipes: [], total: 0, page: 1, totalPages: 0 }` (mirrors `GET /api/recipes` no-query behavior) |
| Single ingredient | Works — one `AND` entry |
| Ingredient with comma (e.g. `"salt, pepper"`) | We split on `,` so this becomes two entries. Acceptable for v1; users typically type one ingredient per chip anyway. |
| Very common term (`salt`) | Will match a lot. AND with another chip narrows it. UI shows total count so the user can refine. |
| Autocomplete `q` shorter than 1 char | Return empty list |
| Language mismatch (FR recipe, EN ingredient name) | Returns no results — expected, matches existing search behavior |

## Test plan (manual)

- [ ] Navigate to `/pantry`, see empty-state message
- [ ] Type `che` → datalist shows `cheddar`, `cheese`, etc., ordered by count
- [ ] Add `ground beef` and `cheddar` → click Find → results only contain recipes with both
- [ ] Remove `cheddar` chip → click Find → broader result set
- [ ] Reload page with `?ingredients=ground+beef,cheddar` → state restored, results shown
- [ ] Switch language → list scopes to current lang
- [ ] Pagination works

## Out-of-PR follow-ups (NOT in this PR)

- Tag/cuisine filter combination
- `pg_trgm` index for autocomplete at scale
- Persistent pantry per user (would need auth)
