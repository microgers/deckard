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
 * Attributes that identify a control well enough to re-focus it. `id` and the
 * data-* keys are what the views actually use to tell one control from its
 * fifteen siblings; aria-label is the fallback for the ones that carry neither.
 */
const FOCUS_ID_ATTRS = ['id', 'data-v', 'data-q', 'data-k', 'data-conf', 'data-opt', 'data-grade', 'aria-label'];

/** tagName plus whatever identifying attributes the element carries. */
function focusSig(e) {
  return e.tagName + '\u0001' + FOCUS_ID_ATTRS.map((k) => (e.hasAttribute(k) ? e.getAttribute(k) : '\u0000')).join('\u0001');
}

/** Chain of child indices from <body> down to `node`, or null if it isn't under <body>. */
function focusPath(node) {
  const path = [];
  let n = node;
  while (n && n !== document.body) {
    const p = n.parentElement;
    if (!p) return null;
    path.unshift(Array.prototype.indexOf.call(p.children, n));
    n = p;
  }
  return n === document.body ? path : null;
}

/** The element at `path`, or null if the tree no longer goes that deep. */
function focusAt(path) {
  let n = document.body;
  for (let i = 0; i < path.length; i++) {
    n = n.children[path[i]];
    if (!n) return null;
  }
  return n;
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
 *
 * That same wholesale rebuild is why focus is restored here rather than in each
 * view. The element you pressed is destroyed by its own handler, so focus falls
 * to <body>: the next Space does not score the next dot, it pages the document
 * down. Keyboard and switch users therefore lose their place on every single
 * answer. The repair belongs in this function because this is the one place
 * that already knows a render is about to destroy live DOM — and because it
 * must happen with preventScroll, before the measurement below, or the browser
 * would scroll the restored control into view and undo the compensation.
 *
 * The rule is deliberately timid: only restore when the focused element is
 * genuinely gone, and only onto an element at the same position in the tree
 * carrying the same identity. Anything else, leave focus where the browser put
 * it — a wrong guess moves a keyboard user somewhere they never asked to be.
 */
export function keepInPlace(sel, render) {
  const find = () => (typeof sel === 'function' ? sel() : document.querySelector(sel));

  // Capture before the render, while the focused element still exists.
  const act = document.activeElement;
  const keep = (act && act !== document.body && act !== document.documentElement)
    ? { node: act, path: focusPath(act), sig: focusSig(act) }
    : null;
  const restoreFocus = () => {
    // Still connected means nothing destroyed it — and re-focusing a live
    // <input type=number> mid-edit would disturb its caret and selection, so
    // the Model must fall out here as a no-op.
    if (!keep || !keep.path || keep.node.isConnected) return;
    const next = focusAt(keep.path);
    if (!next || focusSig(next) !== keep.sig) return;
    next.focus({ preventScroll: true });
  };

  const a = find();
  if (!a) { render(); restoreFocus(); return; }
  const before = a.getBoundingClientRect().top;
  render();
  restoreFocus();
  const b = find();
  if (!b) return;
  const delta = b.getBoundingClientRect().top - before;
  if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
}

/**
 * Mark the wide containers (.xs tables, .chart) that are actually scrolled out
 * of their box, so the phone stylesheet can draw a scroll rail on them.
 *
 * macOS and iOS draw overlay scrollbars: they reserve no layout space and paint
 * nothing until a drag is already under way, so a nine-column table looks like a
 * table that ends at "Tax". A styled ::-webkit-scrollbar does not bring the space
 * back on those platforms either — the rail has to be part of the element's own
 * box. CSS cannot ask whether a box overflows, so the question is answered here
 * and the answer is carried as a class. Called after the renders that rebuild
 * these nodes, and again on resize, since a rotation changes the answer.
 */
export function markScrollers() {
  $$('.xs,.chart').forEach((e) => e.classList.toggle('scrolls', e.scrollWidth > e.clientWidth + 1));
}
let scrollTick = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(scrollTick);
  scrollTick = requestAnimationFrame(markScrollers);
});
