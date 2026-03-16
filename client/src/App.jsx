import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { t } from './i18n';
import RecipeList from './pages/RecipeList';
import RecipeDetail from './pages/RecipeDetail';
import RecipeForm from './pages/RecipeForm';
import ImportPage from './pages/ImportPage';
import ShoppingList from './pages/ShoppingList';
import Cart from './pages/Cart';

export default function App() {
  const location = useLocation();
  const [selectedRecipes, setSelectedRecipes] = useState([]);
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  const i = t(lang);
  const selectedIds = selectedRecipes.map((r) => r.id);

  const toggleSelect = (id, title) => {
    setSelectedRecipes((prev) =>
      prev.some((r) => r.id === id)
        ? prev.filter((r) => r.id !== id)
        : [...prev, { id, title }]
    );
  };

  const clearSelection = () => setSelectedRecipes([]);

  const switchLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  return (
    <>
      <header className="header">
        <div className="container">
          <h1>Meal Planner</h1>
          <nav className="nav-links">
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              {i.recipes}
            </Link>
            <Link to="/add" className={location.pathname === '/add' ? 'active' : ''}>
              {i.add}
            </Link>
            <Link to="/import" className={location.pathname === '/import' ? 'active' : ''}>
              {i.import}
            </Link>
            <Link to="/cart" className={`cart-icon-link ${location.pathname === '/cart' ? 'active' : ''}`}>
              <svg className="cart-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {selectedIds.length > 0 && (
                <span className="cart-badge">{selectedIds.length}</span>
              )}
            </Link>
            <div className="lang-toggle">
              <button
                className={`lang-btn ${lang === 'en' ? 'lang-btn--active' : ''}`}
                onClick={() => switchLang('en')}
              >
                EN
              </button>
              <button
                className={`lang-btn ${lang === 'fr' ? 'lang-btn--active' : ''}`}
                onClick={() => switchLang('fr')}
              >
                FR
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="container">
        <Routes>
          <Route
            path="/"
            element={
              <RecipeList
                lang={lang}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onClearSelection={clearSelection}
              />
            }
          />
          <Route path="/recipe/:id" element={<RecipeDetail lang={lang} selectedIds={selectedIds} onToggleSelect={toggleSelect} />} />
          <Route path="/add" element={<RecipeForm lang={lang} />} />
          <Route path="/edit/:id" element={<RecipeForm lang={lang} />} />
          <Route path="/import" element={<ImportPage lang={lang} />} />
          <Route
            path="/cart"
            element={
              <Cart
                lang={lang}
                selectedRecipes={selectedRecipes}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onClearSelection={clearSelection}
                onLoadPlan={(recipes) => setSelectedRecipes(recipes)}
              />
            }
          />
          <Route
            path="/shopping-list"
            element={<ShoppingList selectedIds={selectedIds} onClear={clearSelection} lang={lang} />}
          />
        </Routes>
      </main>
    </>
  );
}
