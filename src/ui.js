/** Shared DOM and formatting helpers. */
export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
export const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const fmt0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export function money(n) {
  if (n == null || !isFinite(n)) return '—';
  const s = n < 0 ? '−' : '', v = Math.abs(n);
  if (v >= 1e6) return s + '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + 'M';
  if (v >= 1e3) return s + '$' + fmt0.format(Math.round(v / 1e3)) + 'k';
  return s + '$' + fmt0.format(Math.round(v));
}
export function dollars(n) {
  if (n == null || !isFinite(n)) return '—';
  return (n < 0 ? '−$' : '$') + fmt0.format(Math.round(Math.abs(n)));
}
export function pct(n, d = 1) { return (n == null || !isFinite(n)) ? '—' : (n * 100).toFixed(d) + '%'; }

/** Minimal, safe markdown: **bold**, *italic*, `code`. Input is escaped first. */
export function md(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br>');
}
