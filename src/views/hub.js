/**
 * Company hub — the per-company home of the audit funnel.
 *
 * The funnel is Diamond → Model → Report, and this page is where you stand
 * between its stages: what is done, what is half done, and one button back
 * into whichever is next. Creating a company lands here, and tapping a saved
 * company in the rail opens here; the report is now something you reach FROM
 * the hub rather than the thing a company IS.
 *
 * The Operator assessment is deliberately NOT a stage. It scores the user, not
 * the company, and one score is shared across every company — asking for it per
 * company would be asking the same question over and over. It appears once, as
 * a prompt, and only while it has never been taken.
 *
 * There is also deliberately NO headline IRR here, unlike the report. The IRR is
 * an output of the deal model, and this page exists precisely for companies
 * whose model has not been touched: a confident 62.6% above a stage row reading
 * "not started" would be the model's own defaults masquerading as a finding.
 *
 * Shaped like report.js: module-level nav, rebuild #hubroot wholesale, rebind by
 * id afterwards. The counts come from progress.js and are never recomputed here.
 */
import { $, esc } from '../ui.js';
import { state, activeCompany } from '../store.js';
import { stageProgress } from '../progress.js';
import { CRIT_A, CRIT_B, aggregate } from '../data/criteria.js';

let nav = () => {};
export function initHub(opts = {}) { nav = opts.nav || nav; }

/* The sketch's [x] / [~] / [ ]. A filled check for done, a half-ring for work in
   progress, an empty ring for untouched — colour alone would not survive a
   greyscale screenshot or a colour-blind reader. */
const MARK = {
  done: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".16" stroke="none"/><path d="M7.5 12.4l3.1 3.1 5.9-6.6"/></svg>',
  part: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/></svg>',
  none: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-dasharray="3 3"><circle cx="12" cy="12" r="9"/></svg>'
};
const CHEV = '<span class="gc"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></span>';

function stageRow(id, mark, title, sub, val, valColor) {
  // .gaterow is reused by class: it is already a ~82px flex row, so the 44px
  // mobile touch floor is met without a new rule. .gv must stay INSIDE it, or it
  // picks up the unrelated 13px gauge .gv.
  return '<button class="gaterow hubstage" id="' + id + '">' +
    '<span class="gi" style="color:' + valColor + '">' + mark + '</span>' +
    '<span class="gt"><b>' + title + '</b><span>' + sub + '</span></span>' +
    '<span class="gv" style="color:' + valColor + '">' + val + '</span>' + CHEV +
    '</button>';
}

export function renderHub() {
  var root = $('#hubroot'); if (!root) return;
  var p = activeCompany();

  // prefs.panel === 'hub' survives a reload and a cross-device profile merge, so
  // this panel can be the first thing rendered on a device with no companies.
  // Guarded exactly as report.js is: an empty state, never a throw.
  if (!p) {
    root.innerHTML = '<div class="hero"><h1 class="big">No company selected</h1>' +
      '<p class="lede">Pick one from Saved companies, or add a new target.</p></div>';
    return;
  }

  var sp = stageProgress(p);
  var updated = p.updated
    ? new Date(p.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  var h = '';
  h += '<div class="hero">' +
    '<div class="btnrow" style="margin:0 0 14px"><button class="btn ghost sm" id="hubback">&larr; All companies</button></div>' +
    '<div class="kicker"><span class="dotb"></span>Company' + (updated ? ' &middot; updated ' + esc(updated) : '') + '</div>' +
    '<h1 class="big hubname">' + esc(p.name) + '</h1>' +
    '<p class="lede">Three stages, in the order that saves you money. Work them at your own pace &mdash; everything here is saved as you go.</p>' +
    '</div>';

  h += '<div class="sectitle">Stages</div><div class="hublist">';

  /* ── Diamond ─────────────────────────────────────────────────────────────
     Purely derived: p.d holds a key only where a human pressed a scoring dot.
     At 16/16 the row stops counting and starts reporting — the two aggregate
     scores are the answer the counting was working towards. */
  var dDone = sp.diamond.done;
  h += stageRow('hubdd', dDone ? MARK.done : sp.diamond.n ? MARK.part : MARK.none,
    'The Double Diamond',
    dDone ? 'All ' + sp.diamond.of + ' scored' : sp.diamond.n + ' of ' + sp.diamond.of + ' scored',
    dDone ? Math.round(aggregate(CRIT_A, p.d)) + ' / ' + Math.round(aggregate(CRIT_B, p.d))
          : sp.diamond.n ? sp.diamond.n + ' / ' + sp.diamond.of : '&mdash;',
    dDone ? 'var(--up)' : sp.diamond.n ? 'var(--warn)' : 'var(--tx3)');

  /* ── Model ───────────────────────────────────────────────────────────────
     "Reviewed", never "changed": the inputs are pre-filled, so a user who drags
     a slider and puts it back has still reviewed that assumption. And the count
     alone can never say "done" — accepting a default leaves no trace, so the
     stage finishes on the user's own confirmation at the foot of the Model. */
  var mDone = sp.model.done;
  h += stageRow('hubirr', mDone ? MARK.done : sp.model.n ? MARK.part : MARK.none,
    'IRR &amp; Deal Model',
    mDone ? 'Reviewed and confirmed'
          : sp.model.n ? sp.model.n + ' of ' + sp.model.of + ' reviewed'
                       : 'not started',
    mDone ? 'Reviewed' : sp.model.n ? sp.model.n + ' / ' + sp.model.of : '&mdash;',
    mDone ? 'var(--up)' : sp.model.n ? 'var(--warn)' : 'var(--tx3)');

  /* ── Report ──────────────────────────────────────────────────────────────
     Never disabled, at any level of progress. The report's whole job is to give
     back value from partial work, and a locked row would be the app deciding the
     user has not earned a look at their own scores. When there is nothing in it
     yet the row says so plainly instead of pretending to be a gate. */
  var anyWork = sp.diamond.n > 0 || sp.model.n > 0 || mDone;
  var rReady = dDone && mDone;
  h += stageRow('hubreport', rReady ? MARK.done : anyWork ? MARK.part : MARK.none,
    'Report',
    rReady ? 'The verdict, the sixteen scores and the full deal model.'
           : anyWork ? 'Partial &mdash; shows what you have so far, marked incomplete.'
                     : 'Nothing to report yet.',
    rReady ? 'Ready' : anyWork ? 'Partial' : '&mdash;',
    rReady ? 'var(--up)' : anyWork ? 'var(--warn)' : 'var(--tx3)');

  h += '</div>';

  /* ── continue ───────────────────────────────────────────────────────────── */
  var contLabel = sp.next === 'report'
    ? 'Open the report'
    : (!sp.diamond.n && !sp.model.n && !mDone) ? 'Start with the Diamond' : 'Continue where I left off';
  h += '<div class="btnrow hubcontinue" id="hubcontinue">' +
    '<button class="btn hubgo" id="hubnext">' + contLabel + '</button></div>';

  /* ── Operator, once ─────────────────────────────────────────────────────── */
  if (Object.keys(state.assessment).length === 0) {
    h += '<div class="note hubop" style="margin-top:26px">' +
      '<b>You have not taken the Operator Assessment.</b> It asks about you, not about ' +
      esc(p.name) + ', and one answer covers every company you look at &mdash; so it is not a ' +
      'stage of this funnel. It is the cheapest of the three gates to fail, though, which is ' +
      'why it is worth twelve minutes before the next one.' +
      '<div class="btnrow" style="margin-top:12px"><button class="btn ghost sm" id="hubassess">Take the Operator Assessment</button></div>' +
      '</div>';
  }

  root.innerHTML = h;

  var back = $('#hubback'); if (back) back.onclick = function () { nav('home'); };
  var dd = $('#hubdd'); if (dd) dd.onclick = function () { nav('dd'); };
  var irr = $('#hubirr'); if (irr) irr.onclick = function () { nav('irr'); };
  var rp = $('#hubreport'); if (rp) rp.onclick = function () { nav('report'); };
  // Read stageProgress again at click time, not from the closure: the rail can
  // make another company active while this panel is still on screen.
  var nx = $('#hubnext'); if (nx) nx.onclick = function () {
    var c = activeCompany(); if (c) nav(stageProgress(c).next);
  };
  var as = $('#hubassess'); if (as) as.onclick = function () { nav('assess'); };
}
