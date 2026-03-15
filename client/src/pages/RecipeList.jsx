import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchRecipes, fetchTags } from '../api';
import { t as getT } from '../i18n';

const FILTERS = {
  en: {
    meals: ['Quick', 'Easy Prep', 'High Protein', 'Calorie Smart', 'Carb Smart', 'Kid Friendly', 'Veggie', 'pescatarian', 'Classic Plates', 'Oven Ready', 'Easy Cleanup', 'Fiber Powered'],
    cuisines: ['North American', 'Southern European', 'East Asian', 'Southeast Asian', 'Latin American', 'Middle Eastern', 'Western European', 'South Asian', 'Caribbean', 'Mediterranean', 'Korean', 'Indian'],
  },
  fr: {
    meals: [],
    cuisines: [],
  },
};

export default function RecipeList({ lang, selectedIds, onToggleSelect, onClearSelection }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSearch = searchParams.get('search') || '';
  const activeTagsStr = searchParams.get('tags') || '';
  const activeTags = activeTagsStr ? activeTagsStr.split(',') : [];
  const page = parseInt(searchParams.get('page') || '1');

  const [query, setQuery] = useState(activeSearch);
  const [availableTags, setAvailableTags] = useState({ meals: [], cuisines: [] });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const i = getT(lang);

  // Load tags dynamically for the current language
  useEffect(() => {
    const staticFilters = FILTERS[lang];
    if (staticFilters && staticFilters.meals.length > 0) {
      setAvailableTags(staticFilters);
      return;
    }
    // For FR (or any lang without hardcoded filters), fetch top tags from DB
    fetchTags(lang).then((tags) => {
      // Split into meal-type vs cuisine-like tags heuristically
      const cuisineWords = ['america', 'europe', 'asia', 'african', 'caribbean', 'mediterranean', 'middle east', 'indian', 'korean', 'chinese', 'japanese', 'french', 'italian', 'mexican', 'thai', 'fusion'];
      const meals = [];
      const cuisines = [];
      for (const tag of tags.slice(0, 40)) {
        const lower = tag.name.toLowerCase();
        if (cuisineWords.some((w) => lower.includes(w))) {
          cuisines.push(tag.name);
        } else {
          meals.push(tag.name);
        }
      }
      setAvailableTags({ meals: meals.slice(0, 12), cuisines: cuisines.slice(0, 12) });
    });
  }, [lang]);

  // Helper to update URL search params
  const updateParams = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || (value === '1' && key === 'page')) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Reset search when language changes
  const prevLangRef = useRef(lang);
  useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      setQuery('');
      setSearchParams({}, { replace: true });
      setResults(null);
    }
  }, [lang, setSearchParams]);

  const doSearch = useCallback(async (searchTerm, tags, pageNum, language) => {
    if (!searchTerm && tags.length === 0) {
      setResults(null);
      return;
    }
    setLoading(true);
    const data = await fetchRecipes({
      search: searchTerm,
      tags: tags.join(','),
      page: pageNum,
      lang: language,
    });
    setResults(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeSearch || activeTagsStr) {
      doSearch(activeSearch, activeTags, page, lang);
    }
  }, [activeSearch, activeTagsStr, page, lang, doSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateParams({ search: query.trim(), page: '1' });
  };

  const toggleTag = (tag) => {
    const newTags = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    updateParams({ tags: newTags.join(',') || null, page: '1' });
  };

  const hasSearched = activeSearch || activeTags.length > 0;

  return (
    <div>
      <div className={`search-hero ${hasSearched ? 'search-hero--compact' : ''}`}>
        <h2 className="search-hero-title">{i.heroTitle}</h2>
        <form onSubmit={handleSubmit} className="search-form">
          <input
            type="text"
            className="search-input"
            placeholder={i.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary search-btn">
            {i.search}
          </button>
        </form>

        {availableTags.meals.length > 0 && (
          <div className="filter-section">
            <div className="filter-label">{i.mealType}</div>
            <div className="filter-chips">
              {availableTags.meals.map((tag) => (
                <button
                  key={tag}
                  className={`chip ${activeTags.includes(tag) ? 'chip--active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {availableTags.cuisines.length > 0 && (
          <div className="filter-section">
            <div className="filter-label">{i.cuisine}</div>
            <div className="filter-chips">
              {availableTags.cuisines.map((tag) => (
                <button
                  key={tag}
                  className={`chip ${activeTags.includes(tag) ? 'chip--active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-light)' }}>
          {i.searching}
        </p>
      )}

      {!loading && !hasSearched && (
        <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.95rem' }}>
          {i.emptyHint}
        </p>
      )}

      {!loading && hasSearched && results && (
        <>
          <div className="results-header">
            <span className="results-count">{i.found(results.total)}</span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setQuery('');
                setSearchParams({}, { replace: true });
                setResults(null);
              }}
            >
              {i.clearAll}
            </button>
          </div>

          {results.recipes.length === 0 ? (
            <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-light)' }}>
              {i.noResults}
            </p>
          ) : (
            <div className="recipe-grid">
              {results.recipes.map((recipe) => (
                <div key={recipe.id} className="recipe-card">
                  <div
                    className={`select-checkbox ${selectedIds.includes(recipe.id) ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(recipe.id, recipe.title);
                    }}
                  >
                    {selectedIds.includes(recipe.id) ? '\u2713' : ''}
                  </div>
                  <Link to={`/recipe/${recipe.id}`}>
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt={recipe.title} loading="lazy" />
                    ) : (
                      <div className="no-image">{recipe.title.charAt(0)}</div>
                    )}
                    <div className="recipe-card-body">
                      <h3>{recipe.title}</h3>
                      <p>{recipe.description}</p>
                      <div className="recipe-card-meta">
                        {recipe.totalTime && <span>{recipe.totalTime.replace('PT', '').replace('M', ' min')}</span>}
                        {recipe.servings && <span>{i.servings(recipe.servings)}</span>}
                        {recipe.difficulty && <span>{recipe.difficulty}</span>}
                      </div>
                      {recipe.tags?.length > 0 && (
                        <div className="tags-list">
                          {recipe.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {results.totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>
                {i.previous}
              </button>
              <span className="page-info">{i.page(results.page, results.totalPages)}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= results.totalPages} onClick={() => updateParams({ page: String(page + 1) })}>
                {i.next}
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
