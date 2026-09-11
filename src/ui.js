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

/**
 * Re-render without yanking the page out from under the reader.
 *
 * Every one of these views recomputes a RESULT block that sits ABOVE the
 * control you are using. When that block changes height — a warning appears, a
 * verdict card replaces a one-line note — everything below it moves. Measured
 * on a phone, dragging the SBA slider into an over-funded stack moved that
 * slider 1,759px up the page: your finger is now on something else entirely,
 * which reads as the app throwing you onto a different screen.
 *
 * So: measure the control before and after the render, then scroll by the
 * difference. `sel` is re-queried after the render because these views rebuild
 * their lists wholesale, which destroys the original element.
 */
export function keepInPlace(sel, render) {
  const find = () => (typeof sel === 'function' ? sel() : document.querySelector(sel));
  const a = find();
  if (!a) { render(); return; }
  const before = a.getBoundingClientRect().top;
  render();
  const b = find();
  if (!b) return;
  const delta = b.getBoundingClientRect().top - before;
  if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
}
