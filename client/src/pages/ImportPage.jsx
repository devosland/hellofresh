import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { importFromHelloFresh, importBulk, startScrapeAll, getScrapeStatus, stopScrape } from '../api';
import { t } from '../i18n';

export default function ImportPage({ lang }) {
  const navigate = useNavigate();
  const i = t(lang);
  const [url, setUrl] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [scrapeLimit, setScrapeLimit] = useState('');
  const [scrapeLang, setScrapeLang] = useState(lang || 'en');
  const [scrape, setScrape] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    getScrapeStatus().then((s) => {
      if (s.running || (s.done && s.imported > 0)) setScrape(s);
    });
    return () => clearInterval(pollRef.current);
  }, []);

  const pollStatus = () => {
    pollRef.current = setInterval(async () => {
      const s = await getScrapeStatus();
      setScrape(s);
      if (!s.running) clearInterval(pollRef.current);
    }, 1000);
  };

  const handleStartScrape = async () => {
    const limit = parseInt(scrapeLimit) || 0;
    const result = await startScrapeAll(limit, scrapeLang);
    setScrape(result.status);
    pollStatus();
  };

  const handleStopScrape = async () => {
    const result = await stopScrape();
    setScrape(result.status);
  };

  const handleUrlImport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const recipe = await importFromHelloFresh(url);
      setMessage({ type: 'success', text: `${i.imported}: "${recipe.title}"` });
      setUrl('');
      setTimeout(() => navigate(`/recipe/${recipe.id}`), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  };

  const handleJsonImport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(jsonText);
      const recipes = Array.isArray(parsed) ? parsed : [parsed];
      const created = await importBulk(recipes, lang);
      const count = Array.isArray(created) ? created.length : 1;
      setMessage({ type: 'success', text: `${i.imported}: ${count}` });
      setJsonText('');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText(ev.target.result);
    reader.readAsText(file);
  };

  return (
    <div className="form-page">
      <h2>{i.importRecipes}</h2>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            background: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
          }}
        >
          {message.text}
        </div>
      )}

      <div className="import-section">
        <h3 style={{ margin: '0 0 12px', borderBottom: '2px solid var(--primary)', display: 'inline-block', paddingBottom: '4px' }}>
          {i.fromUrl}
        </h3>
        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '12px' }}>
          {i.fromUrlDesc}
        </p>
        <form onSubmit={handleUrlImport}>
          <div className="form-group">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.hellofresh.com/recipes/..."
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? i.importing : i.importRecipe}
          </button>
        </form>
      </div>

      <div className="import-section">
        <h3 style={{ margin: '0 0 12px', borderBottom: '2px solid var(--primary)', display: 'inline-block', paddingBottom: '4px' }}>
          {i.scrapeAll}
        </h3>
        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '12px' }}>
          {i.scrapeAllDesc}
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div className="lang-toggle">
            <button
              className={`lang-btn ${scrapeLang === 'en' ? 'lang-btn--active' : ''}`}
              onClick={() => setScrapeLang('en')}
              disabled={scrape?.running}
            >
              English (US)
            </button>
            <button
              className={`lang-btn ${scrapeLang === 'fr' ? 'lang-btn--active' : ''}`}
              onClick={() => setScrapeLang('fr')}
              disabled={scrape?.running}
            >
              Francais (CA)
            </button>
          </div>
          <input
            type="number"
            min="0"
            value={scrapeLimit}
            onChange={(e) => setScrapeLimit(e.target.value)}
            placeholder={i.limitPlaceholder}
            style={{ width: '150px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px' }}
          />
          {!scrape?.running ? (
            <button onClick={handleStartScrape} className="btn btn-primary">
              {i.startImport}
            </button>
          ) : (
            <button onClick={handleStopScrape} className="btn btn-danger">
              {i.stop}
            </button>
          )}
        </div>

        {scrape && (
          <div style={{
            padding: '16px',
            background: 'var(--bg)',
            borderRadius: '8px',
            fontSize: '0.9rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <strong>{scrape.running ? i.importing : scrape.done ? i.complete : i.ready}</strong>
              <span>{scrape.imported + scrape.skipped + scrape.failed} / {scrape.total}</span>
            </div>
            {scrape.segment && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '8px' }}>
                {i.segment}: {scrape.segment}
              </div>
            )}
            {scrape.total > 0 && (
              <div style={{
                width: '100%',
                height: '8px',
                background: 'var(--border)',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '8px',
              }}>
                <div style={{
                  width: `${Math.round(((scrape.imported + scrape.skipped + scrape.failed) / scrape.total) * 100)}%`,
                  height: '100%',
                  background: 'var(--primary)',
                  borderRadius: '4px',
                  transition: 'width 0.3s',
                }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '16px', color: 'var(--text-light)' }}>
              <span style={{ color: 'var(--primary-dark)' }}>{i.imported}: {scrape.imported}</span>
              <span>{i.skipped}: {scrape.skipped}</span>
              <span style={{ color: scrape.failed > 0 ? 'var(--danger)' : 'inherit' }}>{i.failed}: {scrape.failed}</span>
            </div>
            {scrape.errors?.length > 0 && (
              <details style={{ marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--danger)' }}>
                  {i.errors(scrape.errors.length)}
                </summary>
                <ul style={{ fontSize: '0.8rem', marginTop: '4px', paddingLeft: '16px' }}>
                  {scrape.errors.slice(0, 20).map((e, idx) => <li key={idx}>{e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="import-section">
        <h3 style={{ margin: '0 0 12px', borderBottom: '2px solid var(--primary)', display: 'inline-block', paddingBottom: '4px' }}>
          {i.fromJson}
        </h3>
        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '12px' }}>
          {i.fromJsonDesc}
        </p>
        <form onSubmit={handleJsonImport}>
          <div className="form-group">
            <label>{i.uploadJson}</label>
            <input type="file" accept=".json" onChange={handleFileUpload} />
          </div>
          <div className="form-group">
            <label>{i.orPasteJson}</label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={8}
              placeholder='[{"title": "...", "ingredients": [...], "steps": [...]}]'
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !jsonText}>
            {loading ? i.importing : i.importJson}
          </button>
        </form>
      </div>
    </div>
  );
}
