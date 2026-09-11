/**
 * Persistence. Three layers, in order of preference:
 *   1. Firestore under users/{uid}/ — when signed in
 *   2. localStorage — always, as the immediate mirror and offline fallback
 *   3. memory — if storage is blocked (private windows, embedded webviews)
 *
 * The local mirror is authoritative for rendering, so the UI never waits on the
 * network. Cloud writes are debounced and merged newest-wins per record.
 *
 * A remote snapshot NEVER deletes a local record it has not previously
 * confirmed. Treating "absent from this snapshot" as "deleted" wipes everything
 * on a cold start before the server has caught up.
 */
import { DEF } from './data/fields.js';
import { getAuthApi } from './firebase.js';
import { uid } from './ui.js';

const KEY = 'acqbench.v3';
const listeners = new Set();

export const state = {
  assessment: {},          // { questionIndex: 1..5 }
  companies: {},           // { id: {id,name,d,i,created,updated} }
  active: null,
  srs: {},                 // { itemId: card }
  reviewLog: [],           // append-only, kept for a later scheduler upgrade
  prefs: { theme: 'system', panel: 'home' },
  user: null,              // { uid, name, email, photo } when signed in
  sync: 'local'            // 'local' | 'cloud' | 'connecting'
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() { listeners.forEach((f) => { try { f(state); } catch (e) { console.error(e); } }); }

/* ── local ─────────────────────────────────────────────────────────────── */
function readLocal() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
export function saveLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      assessment: state.assessment, companies: state.companies, active: state.active,
      srs: state.srs, reviewLog: state.reviewLog.slice(-500), prefs: state.prefs
    }));
  } catch { /* private mode — memory only */ }
}

/* ── companies ─────────────────────────────────────────────────────────── */
export function newCompany(name = 'Untitled target', extra = {}) {
  const id = uid();
  const c = { id, name, d: {}, i: { ...DEF }, created: Date.now(), updated: Date.now(), ...extra };
  state.companies[id] = c; state.active = id;
  saveLocal(); queuePush([id]);
  return c;
}
export function activeCompany() { return state.companies[state.active] || null; }
export function ensureCompany(seed) {
  if (Object.keys(state.companies).length) {
    if (!state.companies[state.active]) state.active = Object.keys(state.companies)[0];
    return activeCompany();
  }
  return newCompany('Cascade Septic & Drain', seed ? { d: { ...seed } } : {});
}
export function touchCompany(id = state.active) {
  const c = state.companies[id];
  if (c) c.updated = Date.now();
  saveLocal(); queuePush([id]);
}
export function deleteCompany(id) {
  delete state.companies[id];
  if (cloud) cloud.del('companies', id);
  if (state.active === id) state.active = Object.keys(state.companies)[0] || null;
  ensureCompany();
  saveLocal(); queuePush();
}

/* ── cloud ─────────────────────────────────────────────────────────────── */
let cloud = null;
let knownRemote = new Set();
let pushTimer = null;
let pending = new Set();
let inFlight = new Set();

function queuePush(ids = []) {
  if (!cloud) return;
  ids.forEach((i) => pending.add(i));
  if (state.active) pending.add(state.active);
  pending.add('__profile');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, 700);
}
export function queueSrsPush() { if (cloud) { pending.add('__srs'); clearTimeout(pushTimer); pushTimer = setTimeout(flush, 1200); } }

async function flush() {
  if (!cloud) return;
  const ids = Array.from(pending); pending.clear();
  for (const id of ids) {
    inFlight.add(id);
    try {
      if (id === '__profile') {
        await cloud.set('profile', 'main', { assessment: state.assessment, active: state.active, prefs: state.prefs, updated: Date.now() });
      } else if (id === '__srs') {
        await cloud.set('profile', 'srs', { cards: state.srs, updated: Date.now() });
      } else if (state.companies[id]) {
        await cloud.set('companies', id, state.companies[id]);
      }
    } catch (e) { /* offline cache will retry */ }
    inFlight.delete(id);
  }
}
const protectedId = (id) => pending.has(id) || inFlight.has(id);

export async function connectCloud(user) {
  const m = await getAuthApi();
  if (!m || !user) { cloud = null; state.sync = 'local'; emit(); return; }
  state.sync = 'connecting'; emit();
  const { fs, db } = m;
  const base = ['users', user.uid];
  cloud = {
    set: (col, id, data) => fs.setDoc(fs.doc(db, ...base, col, id), data),
    del: (col, id) => fs.deleteDoc(fs.doc(db, ...base, col, id)),
    all: async (col) => (await fs.getDocs(fs.collection(db, ...base, col))).docs.map((d) => d.data()),
    one: async (col, id) => { const s = await fs.getDoc(fs.doc(db, ...base, col, id)); return s.exists() ? s.data() : null; },
    watch: (col, cb, err) => fs.onSnapshot(fs.collection(db, ...base, col), (s) => cb(s.docs.map((d) => d.data())), err)
  };

  try {
    const [remote, profile, srsDoc] = await Promise.all([
      cloud.all('companies'), cloud.one('profile', 'main'), cloud.one('profile', 'srs')
    ]);
    const push = [];
    remote.forEach((r) => { if (r && r.id) knownRemote.add(r.id); });
    Object.keys(state.companies).forEach((id) => {
      const l = state.companies[id], r = remote.find((x) => x && x.id === id);
      if (!r || (l.updated || 0) > (r.updated || 0)) push.push(id);
    });
    remote.forEach((r) => {
      if (!r || !r.id) return;
      const l = state.companies[r.id];
      if (!l || (r.updated || 0) > (l.updated || 0)) state.companies[r.id] = r;
    });
    if (profile) {
      if (!Object.keys(state.assessment).length && profile.assessment) state.assessment = profile.assessment;
      if (profile.active && state.companies[profile.active]) state.active = profile.active;
    }
    if (srsDoc && srsDoc.cards && !Object.keys(state.srs).length) state.srs = srsDoc.cards;
    ensureCompany();
    saveLocal();
    state.sync = 'cloud'; emit();
    queuePush(push);

    cloud.watch('companies', (docs) => {
      const seen = new Set();
      docs.forEach((d) => {
        if (!d || !d.id) return;
        seen.add(d.id); knownRemote.add(d.id);
        const l = state.companies[d.id];
        if (!l || (d.updated || 0) >= (l.updated || 0)) state.companies[d.id] = d;
      });
      // Only honour a deletion the server has actually confirmed before, and
      // never act on an empty snapshot.
      if (docs.length) {
        Object.keys(state.companies).forEach((id) => {
          if (!seen.has(id) && knownRemote.has(id) && !protectedId(id)) {
            delete state.companies[id]; knownRemote.delete(id);
          }
        });
      }
      ensureCompany(); saveLocal(); emit();
    }, () => {});
  } catch (e) {
    console.warn('cloud sync unavailable', e);
    cloud = null; state.sync = 'local'; emit();
  }
}
export function disconnectCloud() {
  cloud = null; knownRemote = new Set(); state.sync = 'local'; state.user = null; emit();
}

/* ── migration from earlier single-file builds ─────────────────────────── */
function migrateOld() {
  // v2 = the Robinhood single-file build, v1 = the desktop/iPhone builds.
  // Without this an existing user opens the new build to an empty rail.
  for (const key of ['acqbench.v2', 'acqbench.v1']) {
    let old = null;
    try { old = JSON.parse(localStorage.getItem(key)); } catch { /* ignore */ }
    if (!old) continue;
    if (old.a && Object.keys(old.a).length) state.assessment = old.a;
    if (old.theme) state.prefs.theme = old.theme;
    if (old.projects && Object.keys(old.projects).length) {
      Object.values(old.projects).forEach((p) => {
        if (!p || !p.id) return;
        state.companies[p.id] = { id: p.id, name: p.name || 'Imported target',
          d: p.d || {}, i: { ...DEF, ...(p.i || {}) },
          created: p.created || Date.now(), updated: p.updated || Date.now() };
      });
      if (old.active && state.companies[old.active]) state.active = old.active;
      return true;
    }
    if ((old.d && Object.keys(old.d).length) || old.i) {
      const id = uid();
      state.companies[id] = { id, name: old.name || 'Imported target',
        d: old.d || {}, i: { ...DEF, ...(old.i || {}) }, created: Date.now(), updated: Date.now() };
      state.active = id;
      return true;
    }
  }
  return false;
}

/* ── boot ──────────────────────────────────────────────────────────────── */
export function loadLocal(seed) {
  const l = readLocal();
  if (!l) migrateOld();
  if (l) Object.assign(state, {
    assessment: l.assessment || {}, companies: l.companies || {}, active: l.active || null,
    srs: l.srs || {}, reviewLog: l.reviewLog || [], prefs: { ...state.prefs, ...(l.prefs || {}) }
  });
  ensureCompany(seed);
  saveLocal();
}
