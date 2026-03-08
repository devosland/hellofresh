const BASE = '/api';

export async function fetchRecipes({ search = '', tags = '', page = 1, limit = 24, lang = 'en' } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (tags) params.set('tags', tags);
  params.set('page', page);
  params.set('limit', limit);
  params.set('lang', lang);
  const res = await fetch(`${BASE}/recipes?${params}`);
  return res.json();
}

export async function fetchTags(lang = 'en') {
  const res = await fetch(`${BASE}/recipes/tags?lang=${lang}`);
  return res.json();
}

export async function fetchRecipe(id) {
  const res = await fetch(`${BASE}/recipes/${id}`);
  return res.json();
}

export async function createRecipe(data) {
  const res = await fetch(`${BASE}/recipes/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateRecipe(id, data) {
  const formData = new FormData();
  formData.append('data', JSON.stringify(data));
  const res = await fetch(`${BASE}/recipes/${id}`, {
    method: 'PUT',
    body: formData,
  });
  return res.json();
}

export async function deleteRecipe(id) {
  const res = await fetch(`${BASE}/recipes/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function importFromHelloFresh(url) {
  const res = await fetch(`${BASE}/import/hellofresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}

export async function importBulk(recipes, language = 'en') {
  const res = await fetch(`${BASE}/import/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipes, language }),
  });
  return res.json();
}

export async function startScrapeAll(limit = 0, lang = 'en') {
  const res = await fetch(`${BASE}/import/hellofresh/scrape-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit, lang }),
  });
  return res.json();
}

export async function getScrapeStatus() {
  const res = await fetch(`${BASE}/import/hellofresh/scrape-status`);
  return res.json();
}

export async function stopScrape() {
  const res = await fetch(`${BASE}/import/hellofresh/scrape-stop`, { method: 'POST' });
  return res.json();
}

export async function generateShoppingList(recipeIds) {
  const res = await fetch(`${BASE}/shopping-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeIds }),
  });
  return res.json();
}
