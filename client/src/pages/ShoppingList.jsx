import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { generateShoppingList } from '../api';
import { t } from '../i18n';

export default function ShoppingList({ selectedIds, onClear, lang }) {
  const [data, setData] = useState(null);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);
  const printRef = useRef();
  const i = t(lang);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setLoading(false);
      return;
    }

    generateShoppingList(selectedIds).then((list) => {
      setData(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedIds]);

  const toggleCheck = (name) => {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  if (loading) {
    return <p style={{ padding: '40px', textAlign: 'center' }}>{i.generatingList}</p>;
  }

  if (selectedIds.length === 0) {
    return (
      <div className="shopping-list">
        <h2>{i.shoppingList}</h2>
        <p style={{ color: 'var(--text-light)', margin: '20px 0' }}>
          {i.noRecipesSelected}
        </p>
        <Link to="/" className="btn btn-primary">
          {i.browseRecipes}
        </Link>
      </div>
    );
  }

  return (
    <div className="shopping-list" ref={printRef}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2>{i.shoppingList}</h2>
        <div className="btn-group">
          <button onClick={() => window.print()} className="btn btn-outline btn-sm">
            {i.print}
          </button>
          <Link to="/" className="btn btn-outline btn-sm" onClick={onClear}>
            {i.done}
          </Link>
        </div>
      </div>

      <p className="recipe-names">
        {i.forRecipes(data?.recipeNames?.join(', '), data?.recipeCount)}
      </p>

      <ul>
        {data?.shoppingList.map((item) => (
          <li
            key={item.name}
            onClick={() => toggleCheck(item.name)}
            style={{
              cursor: 'pointer',
              opacity: checked[item.name] ? 0.4 : 1,
              textDecoration: checked[item.name] ? 'line-through' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <span className="item-name">
              <span style={{ marginRight: '8px', display: 'inline-block', width: '20px' }}>
                {checked[item.name] ? '\u2611' : '\u2610'}
              </span>
              {item.name}
            </span>
            <span className="item-details">
              {item.details.map((d, idx) => (
                <div key={idx}>
                  {d.amount} {d.unit} <span style={{ fontSize: '0.8em' }}>({d.fromRecipe})</span>
                </div>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
