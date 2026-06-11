import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi, type PublicMenuResponse, type PublicMenuItem } from '../services/api';
import './PublicMenuPanel.css';

const DEFAULT_LABELS: Record<string, string> = {
  starters: 'Starters', mains: 'Mains', desserts: 'Desserts', wine: 'Wine', drinks: 'Drinks',
};

function money(amount: number, code: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

/**
 * Public, customer-facing menu — reached by scanning the restaurant's QR code
 * (which links to /m/:restaurantId). No login, no app chrome. Mobile-first.
 */
export function PublicMenuPanel() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [data, setData] = useState<PublicMenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCat, setActiveCat] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (!restaurantId) { setError('Invalid menu link.'); setLoading(false); return; }
    let alive = true;
    publicApi.menu(restaurantId)
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [restaurantId]);

  const sections = useMemo(() => {
    if (!data) return [] as { slug: string; label: string; items: PublicMenuItem[] }[];
    const byCat = new Map<string, PublicMenuItem[]>();
    for (const it of data.items) {
      const arr = byCat.get(it.category) ?? [];
      arr.push(it);
      byCat.set(it.category, arr);
    }
    const ordered: { slug: string; label: string; items: PublicMenuItem[] }[] = [];
    const seen = new Set<string>();
    for (const c of [...data.categories].sort((a, b) => a.sort_order - b.sort_order)) {
      if (byCat.has(c.slug)) { ordered.push({ slug: c.slug, label: c.label, items: byCat.get(c.slug)! }); seen.add(c.slug); }
    }
    for (const [slug, items] of byCat) {
      if (!seen.has(slug)) ordered.push({ slug, label: DEFAULT_LABELS[slug] ?? slug, items });
    }
    return ordered;
  }, [data]);

  useEffect(() => {
    if (sections.length && !activeCat) setActiveCat(sections[0].slug);
  }, [sections, activeCat]);

  function jumpTo(slug: string) {
    setActiveCat(slug);
    document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) {
    return <div className="pm-root"><div className="pm-state"><div className="pm-spinner" /><p>Loading menu…</p></div></div>;
  }
  if (error || !data) {
    return (
      <div className="pm-root">
        <div className="pm-state">
          <div className="pm-state-glyph">🍽</div>
          <h1>Menu unavailable</h1>
          <p>{error || 'Please ask our staff for assistance.'}</p>
        </div>
      </div>
    );
  }

  const { restaurant } = data;
  const cur = restaurant.currency_code;
  const loc = [restaurant.city, restaurant.country].filter(Boolean).join(', ');

  return (
    <div className="pm-root">
      <header className="pm-hero">
        {restaurant.logo_url
          ? <img className="pm-logo" src={restaurant.logo_url} alt={restaurant.name} />
          : <div className="pm-logo pm-logo-fallback">{restaurant.name.charAt(0).toUpperCase()}</div>}
        <p className="pm-eyebrow">Digital Menu</p>
        <h1 className="pm-title">{restaurant.name}</h1>
        {restaurant.tagline && <p className="pm-tagline">{restaurant.tagline}</p>}
        {loc && <p className="pm-loc">📍 {loc}</p>}
      </header>

      {sections.length > 1 && (
        <nav className="pm-nav" aria-label="Menu categories">
          {sections.map(s => (
            <button
              key={s.slug}
              type="button"
              className={`pm-nav-pill${activeCat === s.slug ? ' active' : ''}`}
              onClick={() => jumpTo(s.slug)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      )}

      <main className="pm-sections">
        {sections.length === 0 && (
          <p className="pm-empty">The menu is being prepared. Please check back soon.</p>
        )}
        {sections.map(s => (
          <section key={s.slug} id={`cat-${s.slug}`} className="pm-section">
            <h2 className="pm-section-title"><span>{s.label}</span></h2>
            <div className="pm-items">
              {s.items.map(it => (
                <article key={it.id} className="pm-item">
                  {it.image_url
                    ? <img className="pm-item-img" src={it.image_url} alt={it.name} loading="lazy" />
                    : <div className="pm-item-img pm-item-img-ph" aria-hidden>🍽</div>}
                  <div className="pm-item-body">
                    <div className="pm-item-head">
                      <h3 className="pm-item-name">
                        {it.name}
                        {it.is_popular ? <span className="pm-pop">★ Popular</span> : null}
                      </h3>
                      <span className="pm-item-price">{money(it.price, cur)}</span>
                    </div>
                    {it.description && <p className="pm-item-desc">{it.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="pm-footer">
        <span>Powered by <strong>Cafyz</strong></span>
      </footer>
    </div>
  );
}
