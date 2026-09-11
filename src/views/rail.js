import { $, el, esc, pct } from '../ui.js';
import { state, activeCompany, newCompany, deleteCompany, touchCompany, saveLocal } from '../store.js';
import { projMetrics, sparkFor } from './metrics.js';
import { openModal, closeModal } from '../modal.js';
import { ALL_CRIT } from '../data/criteria.js';

let onChange = () => {};
let onOpen = () => {};
export function initRail(opts = {}) {
  onChange = opts.onChange || onChange;
  onOpen = opts.onOpen || onOpen;
  $('#newproj').addEventListener('click', promptNew);
}

export function renderProjects() {
  const w = $('#plist'); w.innerHTML = '';
  const ids = Object.keys(state.companies)
    .sort((a, b) => (state.companies[b].updated || 0) - (state.companies[a].updated || 0));
  if (!ids.length) {
    w.innerHTML = '<div class="empty">No companies saved yet.<br>Score a target in Diamond or model a deal, then it appears here.</div>';
  } else {
    ids.forEach((id) => {
      const p = state.companies[id], mm = projMetrics(p);
      const b = el('button', 'pitem' + (id === state.active ? ' active' : ''));
      const irrTxt = mm.irr != null ? pct(mm.irr, 0) : '—';
      const irrCls = mm.irr == null ? '' : mm.irr < 0 ? 'color:var(--down)' : 'color:var(--up)';
      b.innerHTML =
        '<span class="pn"><b>' + esc(p.name) + '</b><span>' +
        (mm.a != null ? Math.round(mm.a) + ' / ' + Math.round(mm.b)
                      : Object.keys(p.d).length + '/' + ALL_CRIT.length + ' scored') + '</span></span>' +
        sparkFor(p) +
        '<span class="pr"><b style="' + irrCls + '">' + irrTxt + '</b><span>IRR</span></span>' +
        '<span class="pgo" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg></span>';
      b.setAttribute('aria-label', 'Open the report for ' + p.name);
      b.onclick = () => { state.active = id; saveLocal(); touchCompany(id); onChange(); onOpen(); };
      w.appendChild(b);
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
  const go = () => { newCompany((f.value || '').trim().slice(0, 60) || 'Untitled target'); onChange(); closeModal(); };
  $('#newsave').onclick = go;
  f.onkeydown = (e) => { if (e.key === 'Enter') go(); };
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
  f.onkeydown = (e) => { if (e.key === 'Enter') go(); };
}
function duplicate() {
  const p = activeCompany(); if (!p) return;
  const n = newCompany(p.name + ' (copy)');
  n.d = { ...p.d }; n.i = { ...p.i }; touchCompany(n.id); onChange();
}
function promptDelete() {
  const p = activeCompany(); if (!p) return;
  openModal('Delete company',
    '<p style="color:var(--tx2)">Delete <b style="color:var(--tx)">' + esc(p.name) +
    '</b> and its scores and model? This cannot be undone.</p>',
    '<button class="btn ghost sm" data-close>Cancel</button><button class="btn danger sm" id="delyes">Delete</button>');
  $('#delyes').onclick = () => { deleteCompany(p.id); onChange(); closeModal(); };
}
