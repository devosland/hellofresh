import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { t as getT } from '../i18n';

const PLANS_KEY = 'mealPlans';

function loadSavedPlans() {
  try {
    return JSON.parse(localStorage.getItem(PLANS_KEY)) || [];
  } catch {
    return [];
  }
}

function persistPlans(plans) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export default function Cart({ lang, selectedRecipes, selectedIds, onToggleSelect, onClearSelection, onLoadPlan }) {
  const i = getT(lang);
  const navigate = useNavigate();
  const [savedPlans, setSavedPlans] = useState(loadSavedPlans);
  const [planName, setPlanName] = useState('');

  const savePlan = () => {
    const name = planName.trim();
    if (!name || selectedRecipes.length === 0) return;
    const plan = {
      id: Date.now(),
      name,
      recipes: [...selectedRecipes],
      date: new Date().toLocaleDateString(),
    };
    const updated = [plan, ...savedPlans];
    setSavedPlans(updated);
    persistPlans(updated);
    setPlanName('');
  };

  const loadPlan = (plan) => {
    onLoadPlan(plan.recipes);
  };

  const deletePlan = (plan) => {
    if (!window.confirm(i.confirmDeletePlan(plan.name))) return;
    const updated = savedPlans.filter((p) => p.id !== plan.id);
    setSavedPlans(updated);
    persistPlans(updated);
  };

  return (
    <div className="cart-page">
      <h2>{i.mySelection}</h2>

      {selectedIds.length === 0 && savedPlans.length === 0 && (
        <div className="cart-empty">
          <p>{i.cartEmpty}</p>
          <Link to="/" className="btn btn-primary">{i.browseRecipes}</Link>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="cart-section">
          <div className="cart-section-header">
            <h3>{i.selected(selectedIds.length)}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={onClearSelection}>{i.clearAll}</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/shopping-list')}
              >
                {i.genList}
              </button>
            </div>
          </div>

          <ul className="cart-recipe-list">
            {selectedRecipes.map((r) => (
              <li key={r.id} className="cart-recipe-item">
                <Link to={`/recipe/${r.id}`} className="cart-recipe-title">
                  {r.title}
                </Link>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => onToggleSelect(r.id, r.title)}
                >
                  {i.remove}
                </button>
              </li>
            ))}
          </ul>

          <div className="cart-save-section">
            <h4>{i.savePlan}</h4>
            <div className="cart-save-row">
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder={i.planName}
                onKeyDown={(e) => e.key === 'Enter' && savePlan()}
              />
              <button onClick={savePlan}>{i.savePlan}</button>
            </div>
          </div>
        </div>
      )}

      {savedPlans.length > 0 && (
        <div className="cart-section">
          <h3>{i.savedPlans}</h3>
          <div className="saved-plans-list">
            {savedPlans.map((plan) => (
              <div key={plan.id} className="saved-plan-card">
                <div className="saved-plan-info">
                  <div className="saved-plan-name">{plan.name}</div>
                  <div className="saved-plan-meta">
                    {plan.recipes.length} {i.recipes.toLowerCase()} — {plan.date}
                  </div>
                  <div className="saved-plan-recipes">
                    {plan.recipes.map((r) => r.title).join(', ')}
                  </div>
                </div>
                <div className="saved-plan-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => loadPlan(plan)}>
                    {i.loadPlan}
                  </button>
                  <button className="btn btn-outline btn-sm delete-plan" onClick={() => deletePlan(plan)}>
                    {i.deletePlan}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
