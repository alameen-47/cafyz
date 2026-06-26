export { escHtml } from './security.js';

import { escHtml } from './security.js';

export function requestActionHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escHtml(title)}</title></head>
<body style="font-family:system-ui,sans-serif;background:#06091a;color:#e8eef8;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#0d1326;border:1px solid rgba(30,127,255,0.2);border-radius:16px;padding:28px">
<h1 style="font-size:1.25rem;margin:0 0 12px">${escHtml(title)}</h1>
<div style="color:#a8bdd4;line-height:1.6;font-size:0.95rem">${body}</div>
</div></body></html>`;
}
