import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchRecipe, createRecipe, updateRecipe } from '../api';
import { t } from '../i18n';

const emptyIngredient = { amount: '', unit: '', name: '' };
const emptyStep = { instruction: '', imageUrl: '' };

export default function RecipeForm({ lang }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const i = t(lang);

  const [form, setForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    servings: 2,
    prepTime: '',
    totalTime: '',
    difficulty: '',
    cuisine: '',
    tags: '',
    sourceUrl: '',
  });
  const [ingredients, setIngredients] = useState([{ ...emptyIngredient }]);
  const [steps, setSteps] = useState([{ ...emptyStep }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEdit) {
      fetchRecipe(id).then((r) => {
        setForm({
          title: r.title || '',
          description: r.description || '',
          imageUrl: r.imageUrl || '',
          servings: r.servings || 2,
          prepTime: r.prepTime || '',
          totalTime: r.totalTime || '',
          difficulty: r.difficulty || '',
          cuisine: r.cuisine || '',
          tags: (r.tags || []).join(', '),
          sourceUrl: r.sourceUrl || '',
        });
        setIngredients(r.ingredients.length > 0 ? r.ingredients : [{ ...emptyIngredient }]);
        setSteps(r.steps.length > 0 ? r.steps.map((s) => ({ instruction: s.instruction, imageUrl: s.imageUrl || '' })) : [{ ...emptyStep }]);
      });
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleIngredientChange = (index, field, value) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const handleStepChange = (index, field, value) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const addIngredient = () => setIngredients([...ingredients, { ...emptyIngredient }]);
  const removeIngredient = (idx) => setIngredients(ingredients.filter((_, j) => j !== idx));
  const addStep = () => setSteps([...steps, { ...emptyStep }]);
  const removeStep = (idx) => setSteps(steps.filter((_, j) => j !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = {
        ...form,
        servings: parseInt(form.servings) || 2,
        language: lang,
        tags: form.tags
          ? form.tags.split(',').map((x) => x.trim()).filter(Boolean)
          : [],
        ingredients: ingredients.filter((ing) => ing.name.trim()),
        steps: steps.filter((s) => s.instruction.trim()).map((s, idx) => ({
          ...s,
          stepNumber: idx + 1,
        })),
      };

      if (isEdit) {
        await updateRecipe(id, data);
        navigate(`/recipe/${id}`);
      } else {
        const created = await createRecipe(data);
        if (created?.id) {
          navigate(`/recipe/${created.id}`);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-page">
      <h2>{isEdit ? i.editRecipe : i.addRecipe}</h2>
      <form onSubmit={handleSubmit}>
        {error && (
          <p style={{ color: 'var(--danger)', marginBottom: '16px', padding: '8px 12px', background: '#fef2f2', borderRadius: '8px' }}>
            {error}
          </p>
        )}
        <div className="form-group">
          <label>{i.titleLabel}</label>
          <input name="title" value={form.title} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>{i.description}</label>
          <textarea name="description" value={form.description} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label>{i.imageUrl}</label>
          <input name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="https://..." />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{i.servingsLabel}</label>
            <input name="servings" type="number" min="1" value={form.servings} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>{i.difficulty}</label>
            <input name="difficulty" value={form.difficulty} onChange={handleChange} placeholder={i.difficultyPlaceholder} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{i.prepTime}</label>
            <input name="prepTime" value={form.prepTime} onChange={handleChange} placeholder={i.prepTimePlaceholder} />
          </div>
          <div className="form-group">
            <label>{i.totalTime}</label>
            <input name="totalTime" value={form.totalTime} onChange={handleChange} placeholder={i.totalTimePlaceholder} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{i.cuisineLabel}</label>
            <input name="cuisine" value={form.cuisine} onChange={handleChange} placeholder={i.cuisinePlaceholder} />
          </div>
          <div className="form-group">
            <label>{i.tagsLabel}</label>
            <input name="tags" value={form.tags} onChange={handleChange} placeholder={i.tagsPlaceholder} />
          </div>
        </div>

        <div className="form-group">
          <label>{i.sourceUrl}</label>
          <input name="sourceUrl" value={form.sourceUrl} onChange={handleChange} />
        </div>

        <h3 style={{ margin: '24px 0 12px', borderBottom: '2px solid var(--primary)', display: 'inline-block', paddingBottom: '4px' }}>
          {i.ingredients}
        </h3>
        {ingredients.map((ing, idx) => (
          <div key={idx} className="dynamic-list-item">
            <input
              style={{ width: '80px' }}
              placeholder={i.qty}
              value={ing.amount || ''}
              onChange={(e) => handleIngredientChange(idx, 'amount', e.target.value)}
            />
            <input
              style={{ width: '80px' }}
              placeholder={i.unit}
              value={ing.unit || ''}
              onChange={(e) => handleIngredientChange(idx, 'unit', e.target.value)}
            />
            <input
              style={{ flex: 1 }}
              placeholder={i.ingredientName}
              value={ing.name || ''}
              onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)}
            />
            {ingredients.length > 1 && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeIngredient(idx)}>
                X
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={addIngredient}>
          {i.addIngredient}
        </button>

        <h3 style={{ margin: '24px 0 12px', borderBottom: '2px solid var(--primary)', display: 'inline-block', paddingBottom: '4px' }}>
          {i.steps}
        </h3>
        {steps.map((step, idx) => (
          <div key={idx} style={{ marginBottom: '12px' }}>
            <div className="dynamic-list-item">
              <span style={{ fontWeight: 600, minWidth: '30px' }}>{idx + 1}.</span>
              <textarea
                style={{ flex: 1, minHeight: '60px', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'inherit', resize: 'vertical' }}
                placeholder={i.stepPlaceholder}
                value={step.instruction || ''}
                onChange={(e) => handleStepChange(idx, 'instruction', e.target.value)}
              />
              {steps.length > 1 && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeStep(idx)}>
                  X
                </button>
              )}
            </div>
            <div style={{ marginLeft: '38px' }}>
              <input
                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.85rem' }}
                placeholder={i.stepImagePlaceholder}
                value={step.imageUrl || ''}
                onChange={(e) => handleStepChange(idx, 'imageUrl', e.target.value)}
              />
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={addStep}>
          {i.addStep}
        </button>

        <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? i.saving : isEdit ? i.updateRecipe : i.saveRecipe}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
            {i.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
