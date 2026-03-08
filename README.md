# HelloFresh Recipe Manager

A full-stack web application for storing, searching, and managing HelloFresh recipes. Select recipes and generate consolidated weekly shopping lists with ingredient aggregation.

## Features

- **Recipe Search Engine** - Search by keyword (title, description, ingredients) with server-side pagination
- **Filter Chips** - Filter by meal type (Quick, High Protein, Veggie, etc.) and cuisine (East Asian, Mediterranean, etc.)
- **Bilingual UI** - Full English and French (FR-CA) support with one-click language toggle
- **Recipe Import** - Import from HelloFresh URL, bulk JSON, or file upload
- **Auto-Scraper** - Scrape the entire HelloFresh catalog automatically (handles Elasticsearch's 10K offset limit via smart segmentation)
- **Shopping List** - Select multiple recipes and generate a consolidated ingredient list with per-recipe breakdown
- **Full Recipe View** - Hero images, step-by-step instructions with images, metadata badges
- **CRUD Operations** - Create, edit, and delete recipes with dynamic ingredient/step forms
- **Dockerized** - One-command deployment with Docker Compose

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 19 + Vite 6, React Router 7 |
| Backend    | Express 4 (ES modules)           |
| Database   | PostgreSQL 16                     |
| ORM        | Prisma 6                         |
| Deployment | Docker + Docker Compose           |

## Quick Start

### With Docker (recommended)

```bash
docker compose up --build -d
```

The app will be available at **http://localhost:3001**.

### Local Development

**Prerequisites:** Node.js 18+, PostgreSQL

1. Install dependencies:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. Set up the database:
   ```bash
   # Create a .env file with your DATABASE_URL
   echo 'DATABASE_URL="postgresql://user:pass@localhost:5432/hellofresh?schema=public"' > .env
   npx prisma migrate deploy
   ```

3. Start the dev servers:
   ```bash
   # Terminal 1 - Backend
   node server/index.js

   # Terminal 2 - Frontend (with API proxy)
   cd client && npm run dev
   ```

## Project Structure

```
hellofresh/
├── client/                  # React frontend
│   ├── src/
│   │   ├── App.jsx          # Main app with routing and language state
│   │   ├── api.js           # API client functions
│   │   ├── i18n.js          # EN/FR translations (~70 keys per language)
│   │   ├── index.css        # Full application styles
│   │   └── pages/
│   │       ├── RecipeList.jsx    # Search engine homepage with filters
│   │       ├── RecipeDetail.jsx  # Full recipe view
│   │       ├── RecipeForm.jsx    # Create/edit recipe form
│   │       ├── ImportPage.jsx    # Import & scraper UI
│   │       └── ShoppingList.jsx  # Aggregated shopping list
│   └── vite.config.js
├── server/
│   ├── index.js             # Express server entry point
│   └── routes/
│       ├── recipes.js       # Recipe CRUD + search API
│       ├── import.js        # HelloFresh scraper & import
│       └── shoppingList.js  # Ingredient aggregation
├── prisma/
│   └── schema.prisma        # Database schema
├── Dockerfile               # Multi-stage production build
└── docker-compose.yml       # PostgreSQL + App services
```

## API Endpoints

### Recipes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recipes?search=&tags=&lang=&page=` | Search recipes (empty without query) |
| GET | `/api/recipes/tags?lang=` | Get tag list with counts |
| GET | `/api/recipes/:id` | Get recipe with ingredients & steps |
| POST | `/api/recipes/json` | Create recipe from JSON |
| PUT | `/api/recipes/:id` | Update recipe |
| DELETE | `/api/recipes/:id` | Delete recipe |

### Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/hellofresh` | Import from HelloFresh URL |
| POST | `/api/import/hellofresh/scrape-all` | Start bulk scraper |
| GET | `/api/import/hellofresh/scrape-status` | Get scraper progress |
| POST | `/api/import/hellofresh/scrape-stop` | Stop running scrape |
| POST | `/api/import/bulk` | Import from JSON array |

### Shopping List
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shopping-list` | Generate aggregated list from recipe IDs |

## Scraper Details

The bulk scraper handles HelloFresh's Elasticsearch 10K offset limit by automatically segmenting queries:

1. Queries recipes by **difficulty level** (0-3)
2. For any difficulty with 10K+ results, sub-segments by **calorie ranges** (0-300, 301-500, 501-700, 701-900, 901-1200, 1201-9999)
3. Automatically refreshes API tokens on 401 errors
4. Skips duplicates via `sourceUrl` matching
5. Reports real-time progress with segment info

Supports both English (US) and French (CA) catalogs independently.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `PORT` | `3001` | Server port |

## License

MIT
