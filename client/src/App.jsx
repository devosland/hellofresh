import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { t } from './i18n';
import RecipeList from './pages/RecipeList';
import RecipeDetail from './pages/RecipeDetail';
import RecipeForm from './pages/RecipeForm';
import ImportPage from './pages/ImportPage';
import ShoppingList from './pages/ShoppingList';

export default function App() {
  const location = useLocation();
  const [selectedIds, setSelectedIds] = useState([]);
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  const i = t(lang);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedIds([]);

  const switchLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    setSelectedIds([]);
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
          <Route path="/recipe/:id" element={<RecipeDetail lang={lang} />} />
          <Route path="/add" element={<RecipeForm lang={lang} />} />
          <Route path="/edit/:id" element={<RecipeForm lang={lang} />} />
          <Route path="/import" element={<ImportPage lang={lang} />} />
          <Route
            path="/shopping-list"
            element={<ShoppingList selectedIds={selectedIds} onClear={clearSelection} lang={lang} />}
          />
        </Routes>
      </main>
    </>
  );
}
