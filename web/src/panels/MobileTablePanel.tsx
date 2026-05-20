import { Link } from 'react-router-dom';
import { DISHES } from '../data/menu';
import { pathForScreen } from '../routes';
import './MobilePanels.css';

export function MobileTablePanel({ addItemMode }: { addItemMode?: boolean }) {
  return (
    <div className="mobile-root">
      <header className="mobile-header">
        <Link to={pathForScreen('mobileOrders')} className="mobile-back">
          ← Tables
        </Link>
        <p className="eyebrow">Table · T·12</p>
        <h1 className="serif">{addItemMode ? 'Add item' : 'Vasseur · 4 cov'}</h1>
      </header>

      {addItemMode ? (
        <div className="mobile-add-grid">
          {DISHES.slice(0, 6).map(d => (
            <button key={d.id} type="button" className="mobile-add-dish card">
              <span className="serif">{d.sym}</span>
              <p>{d.name}</p>
              <p className="mono">${d.price}</p>
            </button>
          ))}
        </div>
      ) : (
        <ul className="mobile-list compact">
          <li className="mobile-line">
            <span>2× Black Cod Miso</span>
            <span className="mono">$84</span>
          </li>
          <li className="mobile-line">
            <span>1× Côte de Bœuf</span>
            <span className="mono">$64</span>
          </li>
          <li className="mobile-line held">
            <span>1× Riesling</span>
            <span className="mono">$78</span>
          </li>
        </ul>
      )}

      <footer className="mobile-footer">
        {!addItemMode && (
          <Link to={pathForScreen('mobileAddItem')} className="btn-outline mobile-footer-btn">
            + Add item
          </Link>
        )}
        <button type="button" className="btn-gold mobile-footer-btn">
          {addItemMode ? 'Add to check' : 'Send to kitchen'}
        </button>
      </footer>
    </div>
  );
}
