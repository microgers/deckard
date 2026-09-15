import { $, el, esc, pct } from '../ui.js';
import { state, activeCompany, newCompany, deleteCompany, touchCompany, saveLocal } from '../store.js';
import { projMetrics, sparkFor } from './metrics.js';
import { openModal, closeModal } from '../modal.js';
import { stageProgress } from '../progress.js';

let onChange = () => {};
let onOpen = () => {};
// The row button opens the hub (onOpen); Resume jumps past it into a stage, so it
// needs the router itself. There is no [data-go] button for the report, so the
// rail cannot get there by proxying a nav click.
let nav = () => {};
export function initRail(opts = {}) {
  onChange = opts.onChange || onChange;
  onOpen = opts.onOpen || onOpen;
  nav = opts.nav || nav;
  $('#newproj').addEventListener('click', promptNew);
}

const CHEV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>';

/**
 * Where this company stands, in one line, in the funnel's own order.
 * "Diamond · 6 of 16" → "Model · not started" → "Model · 6 of 18" → "Report ready".
 *
 * Both numbers are true rather than convenient. The Diamond count is derived from
 * `d` — a key exists only where a dot was pressed. The model count is the size of
 * `prog.t`, the record of inputs the user actually touched, because `i` is
 * pre-filled and its values prove nothing. "Reviewed", never "changed": someone
 * who drags a slider and puts it back has still reviewed that assumption.
 */
function stageLine(sp) {
  if (!sp.diamond.done) return 'Diamond &middot; ' + sp.diamond.n + ' of ' + sp.diamond.of;
  if (!sp.model.done) {
    return sp.model.n ? 'Model &middot; ' + sp.model.n + ' of ' + sp.model.of
                      : 'Model &middot; not started';
  }
  return 'Report ready';
}

const STAGE_NAME = { dd: 'the Double Diamond', irr: 'the deal model', report: 'the report' };

/* Both buttons in a row select the company identically, so which one you press
   can never leave the app in two different states. */
function activate(id) {
  state.active = id; saveLocal(); touchCompany(id); onChange();
}

export function renderProjects() {
  const w = $('#plist'); w.innerHTML = '';
  const ids = Object.keys(state.companies)
    .sort((a, b) => (state.companies[b].updated || 0) - (state.companies[a].updated || 0));
  if (!ids.length) {
    w.innerHTML = '<div class="empty">No companies saved yet.<br>Score a target in Diamond or model a deal, then it appears here.</div>';
  } else {
    ids.forEach((id) => {
      const p = state.companies[id], mm = projMetrics(p), sp = stageProgress(p);
      // TWO SIBLING buttons in a wrapper, never one nested inside the other: a
      // <button> inside a <button> is invalid, Chromium reparents it out of the
      // row, and the row's own click handler stops being reliable.
      const row = el('div', 'prow');
      const b = el('button', 'pitem' + (id === state.active ? ' active' : ''));
      const irrTxt = mm.irr != null ? pct(mm.irr, 0) : '—';
      const irrCls = mm.irr == null ? '' : mm.irr < 0 ? 'color:var(--down)' : 'color:var(--up)';
      b.innerHTML =
        '<span class="pn"><b>' + esc(p.name) + '</b><span>' + stageLine(sp) + '</span></span>' +
        sparkFor(p) +
        '<span class="pr"><b style="' + irrCls + '">' + irrTxt + '</b><span>IRR</span></span>' +
        '<span class="pgo" aria-hidden="true">' + CHEV + '</span>';
      // The row opens the hub now, not the report — the report is one stage of the
      // funnel you reach FROM the hub.
      b.setAttribute('aria-label', 'Open ' + p.name);
      b.onclick = () => { activate(id); onOpen(); };

      const done = sp.next === 'report';
      const r = el('button', 'presume');
      r.textContent = done ? 'Report' : 'Resume';
      r.setAttribute('aria-label',
        (done ? 'Open the report for ' : 'Resume ' + STAGE_NAME[sp.next] + ' for ') + p.name);
      // Straight to the stage the funnel says is next — one tap, no hub in between.
      r.onclick = () => { activate(id); nav(sp.next); };

      row.appendChild(b); row.appendChild(r);
      w.appendChild(row);
    });
  }
  const f = $('#railfoot');
  f.innerHTML = ids.length
    ? '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
      '<button class="btn ghost sm" id="renproj">Rename</button>' +
      '<button class="btn ghost sm" id="dupproj">Duplicate</button>' +
      '<button class="btn danger sm" id="delproj">Delete</button></div>' : '';
  if (ids.length) {
    $('#renproj').onclick = promptRename;
    $('#dupproj').onclick = duplicate;
    $('#delproj').onclick = promptDelete;
  }
}

function promptNew() {
  openModal('New company',
    '<label style="font-size:13px;font-weight:600;display:block;margin-bottom:7px">Company name</label>' +
    '<input class="txt" id="newval" placeholder="e.g. Cascade Septic &amp; Drain" maxlength="60">' +
    '<p class="tiny" style="margin-top:12px">A company holds its own Diamond scores and deal model. Your Operator assessment and your learning progress are shared across all of them.</p>',
    '<button class="btn ghost sm" data-close>Cancel</button><button class="btn sm" id="newsave">Create</button>');
  const f = $('#newval'); f.focus();
  // ONE submit path, bound to both the button and the Enter key, so the two can
  // never drift apart: create, refresh, close, then open the new company's hub.
  // onOpen runs AFTER closeModal so the dialog's scroll and focus restore finish
  // before the panel swaps underneath them.
  const submit = () => {
    const c = newCompany((f.value || '').trim().slice(0, 60) || 'Untitled target');
    // newCompany already made it active; pinning it makes the hub we are about to
    // open a property of THIS call rather than of whatever ran in between.
    state.active = c.id;
    onChange();
    closeModal();
    onOpen();
  };
  $('#newsave').onclick = submit;
  f.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    // FIRST, before the dialog closes. Enter fires keydown, then keypress; closing
    // moves focus back to #newproj, and Blink delivers this same keystroke's
    // keypress to whatever holds focus THEN — activating the button and re-opening
    // an identical, empty New-company dialog. The user reads that as "it stayed".
    // Preventing the keydown's default suppresses the keypress that carries it.
    // Reproduced and fixed at both 375x812 and 1360x900; it is not device-specific.
    e.preventDefault();
    submit();
  };
}
function promptRename() {
  const p = activeCompany(); if (!p) return;
  openModal('Rename company',
    '<label style="font-size:13px;font-weight:600;display:block;margin-bottom:7px">Company name</label>' +
    '<input class="txt" id="renval" value="' + esc(p.name) + '" maxlength="60">',
    '<button class="btn ghost sm" data-close>Cancel</button><button class="btn sm" id="rensave">Save</button>');
  const f = $('#renval'); f.focus(); f.select();
  const go = () => { p.name = (f.value || '').trim().slice(0, 60) || 'Untitled target'; touchCompany(); onChange(); closeModal(); };
  $('#rensave').onclick = go;
  f.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    // Same guard as promptNew. Latent here only by accident: renderProjects()
    // rebuilds #railfoot and destroys #renproj, so closeModal's document.contains
    // check fails and focus is never restored to a button that could be activated.
    // One render change away from the same bug.
    e.preventDefault();
    go();
  };
}
function duplicate() {
  const p = activeCompany(); if (!p) return;
  const n = newCompany(p.name + ' (copy)');
  n.d = { ...p.d }; n.i = { ...p.i };
  // Carry the progress too, or a copy of a fully-worked deal reads "Model not
  // started" next to a full set of numbers.
  n.prog = { t: { ...(p.prog && p.prog.t) }, modelDone: (p.prog && p.prog.modelDone) || 0 };
  touchCompany(n.id); onChange();
}
function promptDelete() {
  const p = activeCompany(); if (!p) return;
  openModal('Delete company',
    '<p style="color:var(--tx2)">Delete <b style="color:var(--tx)">' + esc(p.name) +
    '</b> and its scores and model? This cannot be undone.</p>',
    '<button class="btn ghost sm" data-close>Cancel</button><button class="btn danger sm" id="delyes">Delete</button>');
  $('#delyes').onclick = () => { deleteCompany(p.id); onChange(); closeModal(); };
}
