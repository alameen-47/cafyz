import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getManagerPanelHtml } from '@shared/web/managerPanelHtml';
import type { Screen } from '@shared/types';
import { pathForScreen } from '../routes';
import './ManagerPanel.css';

export function ManagerPanel({ section }: { section: Screen }) {
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const html = getManagerPanelHtml(section);

  useEffect(() => {
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ screen: Screen }>).detail;
      if (detail?.screen) navigate(pathForScreen(detail.screen));
    };
    window.addEventListener('cafyz-navigate', onNavigate);
    return () => window.removeEventListener('cafyz-navigate', onNavigate);
  }, [navigate]);

  useEffect(() => {
    const win = frameRef.current?.contentWindow;
    if (win && 'setManagerSection' in win) {
      (win as Window & { setManagerSection: (s: string) => void }).setManagerSection(section);
    }
  }, [section]);

  return (
    <iframe
      ref={frameRef}
      title={`Cafyz ${section}`}
      className="manager-frame"
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
