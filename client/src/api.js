const BASE = '/api';

async function checkResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchRecipes({ search = '', tags = '', page = 1, limit = 24, lang = 'en' } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (tags) params.set('tags', tags);
  params.set('page', page);
  params.set('limit', limit);
  params.set('lang', lang);
  const res = await fetch(`${BASE}/recipes?${params}`);
  return checkResponse(res);
}

export async function fetchTags(lang = 'en') {
  const res = await fetch(`${BASE}/recipes/tags?lang=${lang}`);
  return checkResponse(res);
}

export async function fetchRecipe(id) {
  const res = await fetch(`${BASE}/recipes/${id}`);
  return checkResponse(res);
}

export async function createRecipe(data) {
  const res = await fetch(`${BASE}/recipes/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return checkResponse(res);
}

export async function updateRecipe(id, data) {
  const formData = new FormData();
  formData.append('data', JSON.stringify(data));
  const res = await fetch(`${BASE}/recipes/${id}`, {
    method: 'PUT',
    body: formData,
  });
  return checkResponse(res);
}

export async function deleteRecipe(id) {
  const res = await fetch(`${BASE}/recipes/${id}`, { method: 'DELETE' });
  return checkResponse(res);
}

export async function importFromHelloFresh(url) {
  const res = await fetch(`${BASE}/import/hellofresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return checkResponse(res);
}

export async function importBulk(recipes, language = 'en') {
  const res = await fetch(`${BASE}/import/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipes, language }),
  });
  return checkResponse(res);
}

export async function startScrapeAll(limit = 0, lang = 'en') {
  const res = await fetch(`${BASE}/import/hellofresh/scrape-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit, lang }),
  });
  return checkResponse(res);
}

export async function getScrapeStatus() {
  const res = await fetch(`${BASE}/import/hellofresh/scrape-status`);
  return checkResponse(res);
}

export async function stopScrape() {
  const res = await fetch(`${BASE}/import/hellofresh/scrape-stop`, { method: 'POST' });
  return checkResponse(res);
}

export async function generateShoppingList(recipeIds) {
  const res = await fetch(`${BASE}/shopping-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeIds }),
  });
  return checkResponse(res);
}
