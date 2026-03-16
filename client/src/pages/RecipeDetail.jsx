import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { fetchRecipe, deleteRecipe } from '../api';
import { t } from '../i18n';

export default function RecipeDetail({ lang, selectedIds = [], onToggleSelect }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.key !== 'default';
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState(null);
  const i = t(lang);
  const isSelected = recipe ? selectedIds.includes(recipe.id) : false;

  useEffect(() => {
    setRecipe(null);
    setError(null);
    fetchRecipe(id)
      .then(setRecipe)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error}</p>
        <button onClick={() => canGoBack ? navigate(-1) : navigate('/')} className="btn btn-outline">
          {i.backToRecipes}
        </button>
      </div>
    );
  }

  if (!recipe) {
    return <p style={{ padding: '40px', textAlign: 'center' }}>{i.loading}</p>;
  }

  const handleDelete = async () => {
    if (window.confirm(i.confirmDelete(recipe.title))) {
      await deleteRecipe(recipe.id);
      navigate('/');
    }
  };

  return (
    <>
      {/* === SCREEN LAYOUT (hidden when printing) === */}
      <div className="recipe-detail no-print">
        {recipe.imageUrl && (
          <img src={recipe.imageUrl} alt={recipe.title} className="hero-image" />
        )}
        <div className="recipe-detail-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <h2>{recipe.title}</h2>
            <div className="btn-group">
              <button
                onClick={() => onToggleSelect(recipe.id, recipe.title)}
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
              >
                {isSelected ? `✓ ${i.selectedLabel}` : i.selectRecipe}
              </button>
              <button onClick={() => window.print()} className="btn btn-outline btn-sm">
                {i.printRecipe}
              </button>
              <Link to={`/edit/${recipe.id}`} className="btn btn-outline btn-sm">
                {i.edit}
              </Link>
              <button onClick={handleDelete} className="btn btn-danger btn-sm">
                {i.delete}
              </button>
            </div>
          </div>

          {recipe.description && <p style={{ color: 'var(--text-light)' }}>{recipe.description}</p>}

          <div className="meta-row">
            {recipe.servings && <span className="meta-badge">{i.servings(recipe.servings)}</span>}
            {recipe.prepTime && <span className="meta-badge">{i.prep}: {recipe.prepTime.replace('PT', '').toLowerCase()}</span>}
            {recipe.totalTime && <span className="meta-badge">{i.total}: {recipe.totalTime.replace('PT', '').toLowerCase()}</span>}
            {recipe.difficulty && <span className="meta-badge">{recipe.difficulty}</span>}
            {recipe.cuisine && <span className="meta-badge">{recipe.cuisine}</span>}
          </div>

          {recipe.tags?.length > 0 && (
            <div className="tags-list" style={{ marginBottom: '12px' }}>
              {recipe.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}

          {recipe.sourceUrl && (
            <p style={{ fontSize: '0.85rem' }}>
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                {i.viewOriginal}
              </a>
            </p>
          )}

          <h3>{i.ingredients}</h3>
          <ul className="ingredients-list">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id}>
                <span className="amount">
                  {ing.amount} {ing.unit}
                </span>{' '}
                {ing.name}
              </li>
            ))}
          </ul>

          <h3>{i.instructions}</h3>
          <ol className="steps-list">
            {recipe.steps.map((step) => (
              <li key={step.id}>
                {step.instruction}
                {step.imageUrl && <img src={step.imageUrl} alt={`${i.steps} ${step.stepNumber}`} loading="lazy" />}
              </li>
            ))}
          </ol>

          <div style={{ marginTop: '32px' }}>
            <button onClick={() => canGoBack ? navigate(-1) : navigate('/')} className="btn btn-outline">
              {i.backToRecipes}
            </button>
          </div>
        </div>
      </div>

      {/* === PRINT LAYOUT (only visible when printing) === */}
      <div className="print-only">
        {/* PAGE 1: Hero image + ingredients */}
        <div className="print-page-1">
          <div className="print-cover">
            {recipe.imageUrl && (
              <img src={recipe.imageUrl} alt={recipe.title} className="print-hero" />
            )}
            <div className="print-sidebar">
              <h1 className="print-title">{recipe.title}</h1>
              <div className="print-meta">
                {recipe.servings && <span>{i.servings(recipe.servings)}</span>}
                {recipe.prepTime && <span>{i.prep}: {recipe.prepTime.replace('PT', '').toLowerCase()}</span>}
                {recipe.totalTime && <span>{i.total}: {recipe.totalTime.replace('PT', '').toLowerCase()}</span>}
                {recipe.difficulty && <span>{recipe.difficulty}</span>}
              </div>
              <h2 className="print-section-title">{i.ingredients}</h2>
              <ul className="print-ingredients">
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id}>
                    <strong>{ing.amount} {ing.unit}</strong> {ing.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* PAGE 2: Steps with thumbnails */}
        <div className="print-page-2">
          <h2 className="print-section-title" style={{ marginBottom: '12px' }}>{i.instructions}</h2>
          <div className="print-steps-grid">
            {recipe.steps.map((step) => (
              <div key={step.id} className="print-step">
                <div className="print-step-header">
                  <span className="print-step-num">{step.stepNumber}</span>
                  {step.imageUrl && (
                    <img src={step.imageUrl} alt="" className="print-step-img" />
                  )}
                </div>
                <p className="print-step-text">{step.instruction}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
