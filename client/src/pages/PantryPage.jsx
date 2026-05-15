import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchPantryRecipes, fetchIngredientNames } from '../api';
import { t as getT } from '../i18n';

export default function PantryPage({ lang }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const ingredientsParam = searchParams.get('ingredients') || '';
  const selected = ingredientsParam
    ? ingredientsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const page = parseInt(searchParams.get('page') || '1');

  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const i = getT(lang);
  const debounceRef = useRef(null);
  const datalistId = 'pantry-ingredient-suggestions';

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

  const setSelected = useCallback((list) => {
    updateParams({ ingredients: list.join(',') || null, page: '1' });
  }, [updateParams]);

  const addIngredient = (raw) => {
    const value = raw.trim().toLowerCase();
    if (!value) return;
    if (selected.some((s) => s.toLowerCase() === value)) {
      setInputValue('');
      return;
    }
    setSelected([...selected, value]);
    setInputValue('');
    setSuggestions([]);
  };

  const removeIngredient = (name) => {
    setSelected(selected.filter((s) => s !== name));
  };

  // Debounced autocomplete
  useEffect(() => {
    if (!inputValue.trim()) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchIngredientNames({ q: inputValue.trim(), lang, limit: 10 })
        .then((rows) => setSuggestions(rows))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [inputValue, lang]);

  // Reset when language changes
  const prevLangRef = useRef(lang);
  useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      setSearchParams({}, { replace: true });
      setResults(null);
      setInputValue('');
      setSuggestions([]);
    }
  }, [lang, setSearchParams]);

  // Run search when selected ingredients or page change
  useEffect(() => {
    if (selected.length === 0) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchPantryRecipes({ ingredients: selected, page, lang })
      .then((data) => setResults(data))
      .catch((err) => {
        setError(err.message);
        setResults(null);
      })
      .finally(() => setLoading(false));
  }, [ingredientsParam, page, lang]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) addIngredient(inputValue);
  };

  return (
    <div>
      <div className="search-hero search-hero--compact">
        <h2 className="search-hero-title">{i.pantryTitle}</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '16px' }}>{i.pantryDescription}</p>

        <form onSubmit={handleSubmit} className="search-form">
          <input
            type="text"
            className="search-input"
            placeholder={i.pantryInputPlaceholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            list={datalistId}
            autoFocus
          />
          <datalist id={datalistId}>
            {suggestions.map((s) => (
              <option key={s.name} value={s.name}>{`${s.name} (${s.count})`}</option>
            ))}
          </datalist>
          <button type="submit" className="btn btn-primary search-btn" disabled={!inputValue.trim()}>
            {i.addToPantry}
          </button>
        </form>

        {selected.length > 0 && (
          <div className="filter-section">
            <div className="filter-chips">
              {selected.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="chip chip--active"
                  onClick={() => removeIngredient(name)}
                  title={i.remove}
                >
                  {name} <span aria-hidden="true">×</span>
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

      {error && (
        <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {!loading && selected.length === 0 && (
        <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.95rem' }}>
          {i.pantryNoIngredients}
        </p>
      )}

      {!loading && selected.length > 0 && results && (
        <>
          <div className="results-header">
            <span className="results-count">{i.found(results.total)}</span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearchParams({}, { replace: true });
                setResults(null);
              }}
            >
              {i.clearAll}
            </button>
          </div>

          {results.recipes.length === 0 ? (
            <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-light)' }}>
              {i.noPantryResults}
            </p>
          ) : (
            <div className="recipe-grid">
              {results.recipes.map((recipe) => (
                <div key={recipe.id} className="recipe-card">
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
              <button
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                {i.previous}
              </button>
              <span className="page-info">{i.page(results.page, results.totalPages)}</span>
              <button
                className="btn btn-outline btn-sm"
                disabled={page >= results.totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                {i.next}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
