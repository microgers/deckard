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
import { DEF, ALL_FIELDS } from './data/fields.js';
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
/**
 * The worked example gets a FIXED id. Every device that seeds it produces the
 * same document, so signing in on a second device merges the two instead of
 * stacking up another "Cascade Septic & Drain" in the rail.
 */
export const SEED_ID = 'seed-cascade';

/* ── progress ──────────────────────────────────────────────────────────────
 * `c.prog = { t: {key: ms}, modelDone: ms|0 }` records what the user has
 * actually engaged with, which the data alone cannot tell us: `i` is pre-filled
 * from DEF at birth, so every model input already holds a value and presence
 * proves nothing.
 *
 * It lives INSIDE the company document, deliberately:
 *   - not in a side collection keyed by company id, because deleteCompany()
 *     calls ensureCompany(), which immediately re-creates the seed under its
 *     FIXED id — a side table would reattach a dead company's progress to the
 *     new one. Inside the document it dies with the tombstone and comes back
 *     with the row.
 *   - not inside `i`, because model.js aliases its module-level P to p.i BY
 *     REFERENCE, the render loops walk Object.keys(FIELDS) over `i`, and
 *     resetModel() replaces `i` wholesale.
 *   - `t` is a plain object, never a Set (JSON.stringify renders a Set as {},
 *     so it would vanish silently through saveLocal) and never an array (not
 *     idempotent under repeated writes).
 * No sync work is needed: saveLocal serializes state.companies wholesale and
 * flush() writes the whole document, so prog rides along exactly as d and i do.
 */
const FIELD_KEYS = ALL_FIELDS.map((f) => f.k);

/**
 * Idempotent. Guarantees c.prog exists and is well-shaped, at EVERY ingress —
 * boot, migration, creation and both cloud merges. Normalizing only at boot is
 * a bug: a document written by an older device arrives through cloud.watch with
 * prog undefined, and one missed guard downstream is a TypeError.
 *
 * For a company that has never had a prog, `t` is DERIVED by diffing i against
 * DEF. The only writers of `i` are the user's own handlers, resetModel (which
 * restores DEF exactly), migrateOld ({...DEF, ...p.i}) and runModel's standby
 * clamp — and the clamp provably cannot move a value off DEF on its own, since
 * DEF.sellerStandby is 0, the clamp fires only when standby >= term, and the
 * sellerTerm field minimum is 1. So a differing value is proof a human put it
 * there. The diff can only under-claim, which beats telling someone who spent
 * an hour on this last week that they have not started.
 *
 * modelDone stays 0 for every pre-existing company: nobody pressed a button
 * that did not exist yet, and inferring "finished" from a diff is exactly the
 * inference the pre-fill makes untrustworthy.
 *
 * MUST NOT write c.updated or persist. Whole-document newest-wins merging means
 * a device that merely opened the app would otherwise win the merge and stomp a
 * real edit made elsewhere. prog reaches the cloud on the first real touch.
 */
export function normalizeCompany(c) {
  if (!c || typeof c !== 'object') return c;
  if (c.prog && typeof c.prog === 'object' && !Array.isArray(c.prog)) {
    if (!c.prog.t || typeof c.prog.t !== 'object' || Array.isArray(c.prog.t)) c.prog.t = {};
    if (typeof c.prog.modelDone !== 'number') c.prog.modelDone = 0;
    return c;
  }
  const stamp = c.updated || c.created || Date.now();
  const t = {};
  let modelDone = 0;
  if (c.id === SEED_ID) {
    // The authored fixture, not an inference about a user. seed-cascade IS the
    // worked example — #ireset reads "Reset to the worked example" — so a fresh
    // install and an upgraded install must present it identically: finished.
    FIELD_KEYS.forEach((k) => { t[k] = stamp; });
    modelDone = stamp;
  } else {
    const i = c.i || {};
    FIELD_KEYS.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(i, k) && i[k] !== DEF[k]) t[k] = stamp;
    });
  }
  c.prog = { t, modelDone };
  return c;
}

/**
 * Record a field the user edited. USER WRITES ONLY — never call this from a
 * machine write. Verified live: planting {sellerStandby:9, sellerTerm:5} into
 * localStorage and merely RELOADING clamps the value and bumps `updated` with
 * zero user interaction, so hanging this off persist() would mark a field
 * "reviewed" on every page load.
 *
 * Deliberately does not save: its callers already persist, and a slider drag
 * fires per frame — the existing touchCompany → queuePush 700ms debounce is
 * what collapses that into one write.
 */
export function markTouched(c, key) {
  if (!c || !key) return;
  normalizeCompany(c);
  c.prog.t[key] = Date.now();
}
/** The model is finished only when the user says so — see progress.js. */
export function confirmModel(c = activeCompany()) {
  if (!c) return;
  normalizeCompany(c);
  c.prog.modelDone = Date.now();
  touchCompany(c.id);
}
/** Wipe progress along with the data that earned it. Caller persists. */
export function clearProgress(c) {
  if (!c) return;
  normalizeCompany(c);
  c.prog.t = {}; c.prog.modelDone = 0;
}

export function newCompany(name = 'Untitled target', extra = {}) {
  const { id: fixedId, ...rest } = extra;
  const id = fixedId || uid();
  const c = { id, name, d: {}, i: { ...DEF }, created: Date.now(), updated: Date.now(), ...rest };
  // After the spread, so an `extra` argument cannot inject a malformed prog.
  normalizeCompany(c);
  state.companies[id] = c; state.active = id;
  saveLocal(); queuePush([id]);
  return c;
}

/**
 * Collapse companies whose content is byte-identical — same name, same scores,
 * same assumptions. These only ever arise from the old non-deterministic seed
 * being created independently on each device; keeping the newest loses nothing
 * because the others say exactly the same thing.
 */
export function dedupeIdentical() {
  const canon = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
  const groups = new Map();
  Object.values(state.companies).forEach((c) => {
    if (!c || !c.id) return;
    const k = c.name + '\u0000' + canon(c.d) + '\u0000' + canon(c.i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  });
  let removed = 0;
  groups.forEach((list) => {
    if (list.length < 2) return;
    // The canon key above stays name + d + i: its whole job is collapsing the
    // old non-deterministic seed, and folding prog into it would weaken that.
    // The SURVIVOR, though, is progress-aware — the copies say the same thing
    // about the company, so keep the one that remembers the most work: the
    // fixed seed id, then a confirmed model, then the most reviewed fields,
    // then the newest.
    const tn = (c) => (c.prog && c.prog.t ? Object.keys(c.prog.t).length : 0);
    list.sort((a, b) =>
      ((b.prog && b.prog.modelDone > 0) ? 1 : 0) - ((a.prog && a.prog.modelDone > 0) ? 1 : 0) ||
      tn(b) - tn(a) ||
      (b.updated || 0) - (a.updated || 0));
    const keep = list.find((c) => c.id === SEED_ID) || list[0];
    list.forEach((c) => {
      if (c.id === keep.id) return;
      delete state.companies[c.id];
      if (cloud) { try { cloud.del('companies', c.id); } catch (e) { /* retried by cache */ } }
      knownRemote.delete(c.id);
      if (state.active === c.id) state.active = keep.id;
      removed++;
    });
  });
  return removed;
}
export function activeCompany() { return state.companies[state.active] || null; }
export function ensureCompany(seed) {
  if (Object.keys(state.companies).length) {
    if (!state.companies[state.active]) state.active = Object.keys(state.companies)[0];
    return normalizeCompany(activeCompany());
  }
  return newCompany('Cascade Septic & Drain', seed ? { id: SEED_ID, d: { ...seed } } : { id: SEED_ID });
}
export function touchCompany(id = state.active) {
  const c = state.companies[id];
  if (c) c.updated = Date.now();
  saveLocal(); queuePush([id]);
}
export function deleteCompany(id) {
  delete state.companies[id];
  // A snapshot already in flight still carries this document. Remember the
  // deletion until the server stops sending it, or the row comes straight back.
  tombstones.add(id);
  pending.delete(id);
  if (cloud) cloud.del('companies', id).catch(() => {});
  if (state.active === id) state.active = Object.keys(state.companies)[0] || null;
  ensureCompany();
  saveLocal(); queuePush();
}

/* ── cloud ─────────────────────────────────────────────────────────────── */
let cloud = null;
let knownRemote = new Set();
const tombstones = new Set();
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
      if (!r || !r.id || tombstones.has(r.id)) return;
      const l = state.companies[r.id];
      if (!l || (r.updated || 0) > (l.updated || 0)) state.companies[r.id] = normalizeCompany(r);
    });
    if (profile) {
      if (!Object.keys(state.assessment).length && profile.assessment) state.assessment = profile.assessment;
      if (profile.active && state.companies[profile.active]) state.active = profile.active;
    }
    if (srsDoc && srsDoc.cards && !Object.keys(state.srs).length) state.srs = srsDoc.cards;
    ensureCompany();
    dedupeIdentical();
    saveLocal();
    state.sync = 'cloud'; emit();
    queuePush(push);

    cloud.watch('companies', (docs) => {
      const seen = new Set();
      docs.forEach((d) => {
        if (!d || !d.id) return;
        if (tombstones.has(d.id)) { seen.add(d.id); return; }
        seen.add(d.id); knownRemote.add(d.id);
        const l = state.companies[d.id];
        if (!l || (d.updated || 0) >= (l.updated || 0)) state.companies[d.id] = normalizeCompany(d);
      });
      // Only honour a deletion the server has actually confirmed before, and
      // never act on an empty snapshot.
      if (docs.length) {
        tombstones.forEach((id) => { if (!docs.some((d) => d && d.id === id)) tombstones.delete(id); });
        Object.keys(state.companies).forEach((id) => {
          if (!seen.has(id) && knownRemote.has(id) && !protectedId(id)) {
            delete state.companies[id]; knownRemote.delete(id);
          }
        });
      }
      ensureCompany(); dedupeIdentical(); saveLocal(); emit();
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
        state.companies[p.id] = normalizeCompany({ id: p.id, name: p.name || 'Imported target',
          d: p.d || {}, i: { ...DEF, ...(p.i || {}) },
          created: p.created || Date.now(), updated: p.updated || Date.now() });
      });
      if (old.active && state.companies[old.active]) state.active = old.active;
      return true;
    }
    if ((old.d && Object.keys(old.d).length) || old.i) {
      const id = uid();
      state.companies[id] = normalizeCompany({ id, name: old.name || 'Imported target',
        d: old.d || {}, i: { ...DEF, ...(old.i || {}) }, created: Date.now(), updated: Date.now() });
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
  // Every company that enters state gets a prog, including ones saved by a
  // build that had never heard of it.
  Object.values(state.companies).forEach((c) => normalizeCompany(c));
  ensureCompany(seed);
  saveLocal();
}
