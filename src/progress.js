/**
 * Where a company is in the funnel: Diamond → Model → Report.
 *
 * Two counts, from two different kinds of evidence:
 *
 *   Diamond — purely DERIVED. `c.d` gets a key only where a human pressed a
 *   scoring dot, so its size is already the truth. No stored field, and it
 *   falls back to "not started" by itself when the scores are cleared.
 *
 *   Model — CANNOT be derived. `c.i` is pre-filled from DEF the moment a
 *   company is born, so every input already holds a value and presence proves
 *   nothing about engagement. The count therefore reads `c.prog.t`, the record
 *   of keys the user has actually edited (see store.js markTouched).
 *
 * `etype` is recorded in `t` — choosing SDE vs EBITDA is real engagement — but
 * it is not one of the 18 ALL_FIELDS inputs, so it is excluded from the count.
 * Without the filter a user who touched everything would read "18 of 19".
 *
 * Everything here tolerates a null company and a company with no `prog` at all
 * (an old document arriving from another device mid-render), because the only
 * thing worse than an unknown count is a TypeError in a list row.
 */
import { ALL_CRIT } from './data/criteria.js';
import { ALL_FIELDS } from './data/fields.js';

export const DIAMOND_TOTAL = ALL_CRIT.length;   // 16
export const MODEL_TOTAL = ALL_FIELDS.length;   // 18

const CRIT_KEYS = new Set(ALL_CRIT.map((c) => c.k));
const FIELD_KEYS = new Set(ALL_FIELDS.map((f) => f.k));

/** Criteria actually scored. Filtered so a stale key can never overcount. */
export function scoredCount(c) {
  const d = c && c.d;
  if (!d || typeof d !== 'object') return 0;
  return Object.keys(d).filter((k) => CRIT_KEYS.has(k) && d[k] != null).length;
}

/** Model inputs the user has reviewed — touched, not necessarily changed. */
export function touchedCount(c) {
  const t = c && c.prog && c.prog.t;
  if (!t || typeof t !== 'object') return 0;
  return Object.keys(t).filter((k) => FIELD_KEYS.has(k)).length;
}

/**
 * @returns {{diamond:{n:number,of:number,done:boolean},
 *            model:{n:number,of:number,done:boolean},
 *            next:'dd'|'irr'|'report'}}
 *
 * "Done" is a different kind of claim on each side. The Diamond is done when
 * all 16 are scored — derived, one source of truth. The model is done only
 * when the user has explicitly confirmed it, because accepting a default is a
 * real act of review that leaves no trace: any edit-count threshold would make
 * the stage permanently uncompletable for a careful buyer who agrees with the
 * 0.25 tax rate.
 */
export function stageProgress(c) {
  const dn = scoredCount(c);
  const mn = touchedCount(c);
  const diamond = { n: dn, of: DIAMOND_TOTAL, done: dn >= DIAMOND_TOTAL };
  const model = { n: mn, of: MODEL_TOTAL, done: !!(c && c.prog && c.prog.modelDone > 0) };
  return { diamond, model, next: !diamond.done ? 'dd' : !model.done ? 'irr' : 'report' };
}
