import { $, $$ } from './ui.js';

let open = false;
// What had focus when the dialog opened, and where the page was scrolled to. Both are
// restored on close: the page scroll because locking <html> drops it, the focus because
// otherwise closing strands the user on <body> with nothing selected.
let trigger = null;
let scrollY = 0;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusable() {
  // Scoped with a root element, not a '#modal ' prefix: the prefix would only apply to
  // the first clause of the comma-separated list.
  return $$(FOCUSABLE, $('#modal')).filter((n) => n.offsetWidth || n.offsetHeight || n.getClientRects().length);
}

// The mask that signals "more below" only makes sense while the body actually overflows.
function markScroll() {
  const b = $('#modalbody');
  b.classList.toggle('scrollable', b.scrollHeight > b.clientHeight + 2);
}

// overflow:hidden on the root stops the wheel and the scrollbar, but the document stays
// programmatically scrollable, so on phones the stylesheet also pins <body> at its current
// offset (see .modal-lock). Pinning keeps what is behind the scrim where the user left it;
// plain overflow:hidden would snap it to the top.
function lock() {
  const d = document.documentElement;
  d.style.setProperty('--lock-top', -scrollY + 'px');
  d.style.overflow = 'hidden';
  d.classList.add('modal-lock');
}
function unlock() {
  const d = document.documentElement;
  d.classList.remove('modal-lock');
  d.style.overflow = '';
  d.style.removeProperty('--lock-top');
}

export function openModal(title, html, foot) {
  // Read this before anything else touches the DOM — callers such as rail.js focus a
  // field in the dialog immediately after openModal returns, which would overwrite it.
  trigger = document.activeElement;
  scrollY = window.scrollY;
  $('#modaltitle').textContent = title;
  $('#modalbody').innerHTML = html;
  $('#modalfoot').innerHTML = foot || '<button class="btn ghost sm" data-close>Close</button>';
  $$('#modalfoot [data-close]').forEach((b) => (b.onclick = closeModal));
  $('#modalbody').scrollTop = 0;
  $('#modal').classList.add('on'); $('#scrim').classList.add('on'); open = true;
  lock();
  markScroll();
  requestAnimationFrame(markScroll);
}
export function closeModal() {
  // A second close must not restore a stale scroll position or steal focus back.
  if (!open) return;
  $('#modal').classList.remove('on'); $('#scrim').classList.remove('on'); open = false;
  unlock();
  window.scrollTo(0, scrollY);
  // Deferred out of the current event, deliberately. Restoring focus synchronously is
  // what made Enter-to-submit reopen the New-company dialog: the close ran inside the
  // keydown, focus landed on the trigger BUTTON, and Blink then delivered the same
  // keystroke's keypress to it and activated it. A keystroke in flight must never find
  // a freshly focused button under it. Take a local copy first so a second close
  // cannot steal focus back, and keep this after the scroll restore above.
  const t = trigger;
  trigger = null;
  requestAnimationFrame(() => {
    // preventScroll, or focusing a trigger near the top of the page would undo the restore.
    if (t && document.contains(t)) t.focus({ preventScroll: true });
  });
}
export function initModal() {
  $('#scrim').addEventListener('click', closeModal);
  $('#modalx').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closeModal(); });
  $('#modalbody').addEventListener('scroll', markScroll);
  // Keep Tab inside the dialog: it is aria-modal, and the page behind it is inert to
  // the eye but not to the keyboard.
  $('#modal').addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = focusable(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !$('#modal').contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
}
