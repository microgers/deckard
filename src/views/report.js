/**
 * Company report — the read view.
 *
 * The rail is a watchlist; this is the ticker page behind it. Everything a
 * saved company knows, in one scroll: the verdict, the sixteen scores that
 * produced it, the deal model's headline numbers, and the year-by-year cash.
 * It computes from the company's own record, never from the Model panel's
 * working copy, so opening a report never disturbs what you were editing.
 */
import { $, el, esc, money, dollars, pct, markScrollers } from '../ui.js';
import { model } from '../engine.js';
import { state, activeCompany } from '../store.js';
import { CRIT_A, CRIT_B, ALL_CRIT, aggregate, hardStops, PASS_MARK } from '../data/criteria.js';
import { diamondSVG } from './diamond.js';
import { cashChart } from './model.js';

let nav = () => {};
export function initReport(opts = {}) { nav = opts.nav || nav; }

function verdictFor(A, B, stops) {
  if (stops.length) return { v: 'Hard stop', c: 'bad', s: 'A critical criterion scored 0 or 1. Resolve the flag or walk — these do not average away.' };
  if (A >= PASS_MARK && B >= PASS_MARK) return { v: 'Pursue', c: 'ok', s: 'Both diamonds clear. Price it, then get a letter of intent and a quality-of-earnings engagement.' };
  if (A >= PASS_MARK) return { v: 'Restructure the deal', c: 'mid', s: 'The business is worth owning; the terms are not there yet. Push on price, seller financing and transition.' };
  if (B >= PASS_MARK) return { v: 'Don’t be seduced by the terms', c: 'mid', s: 'Good terms on a business with structural problems. Cheap money increases what you lose.' };
  return { v: 'Pass', c: 'bad', s: 'Neither diamond clears. Passing costs you nothing but the hours already spent.' };
}

function critTable(list, scores) {
  var rows = list.map(function (c) {
    var s = scores[c.k];
    var col = s == null ? 'var(--tx3)' : s <= 1 ? 'var(--down)' : s <= 2 ? 'var(--warn)' : 'var(--up)';
    return '<div class="crrow">' +
      '<div class="crmain"><b>' + esc(c.n) + '</b>' +
      (c.crit ? ' <span title="critical" style="color:var(--down)">&#9670;</span>' : '') +
      '<span class="crsaid">' + (s == null ? 'not scored' : '&ldquo;' + esc(c.a[s]) + '&rdquo;') + '</span></div>' +
      '<div class="crw">' + c.w.toFixed(1) + '&times;</div>' +
      '<div class="crs" style="color:' + col + '">' + (s == null ? '&mdash;' : s + '<span>/5</span>') + '</div>' +
      '</div>';
  }).join('');
  return '<div class="crlist">' + rows + '</div>';
}

export function renderReport() {
  var root = $('#reportroot'); if (!root) return;
  var p = activeCompany();
  if (!p) {
    root.innerHTML = '<div class="hero"><h1 class="big">No company selected</h1>' +
      '<p class="lede">Pick one from Saved companies, or add a new target.</p></div>';
    return;
  }

  var scored = Object.keys(p.d).length;
  var complete = scored === ALL_CRIT.length;
  var A = complete ? aggregate(CRIT_A, p.d) : null;
  var B = complete ? aggregate(CRIT_B, p.d) : null;
  var stops = hardStops(p.d);

  var m = null, err = null;
  try { m = model(p.i); if (m.error) { err = m.error; m = null; } } catch (e) { err = 'ERR'; }
  var r = m ? m.irr : null;
  var irrOk = r && r.ok && r.unique;
  var irrTxt = irrOk ? pct(r.irr, 1) : (r && r.ok ? pct(r.allRoots[0], 1) + '*' : '—');
  var irrCls = irrOk ? (r.irr < 0 ? 'down' : r.irr < 0.15 ? 'warn' : 'up') : 'warn';

  var d1 = m && m.rows.length ? m.rows[0] : null;
  var y1coc = (d1 && m.equity > 0) ? d1.fcfe / m.equity : null;
  var y1Dscr = d1 ? d1.dscr : null;
  var dCls = y1Dscr == null ? '' : y1Dscr < 1 ? 'down' : y1Dscr < 1.25 ? 'warn' : 'up';

  var updated = p.updated ? new Date(p.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  var h = '';

  /* ── header ─────────────────────────────────────────────────────────── */
  h += '<div class="hero">' +
    '<div class="btnrow" style="margin:0 0 14px"><button class="btn ghost sm" id="rpback">&larr; All companies</button></div>' +
    '<div class="kicker"><span class="dotb"></span>Company report' + (updated ? ' &middot; updated ' + esc(updated) : '') + '</div>' +
    '<h1 class="big" style="margin-bottom:10px">' + esc(p.name) + '</h1>' +
    '<div class="heroline"><span class="bignum ' + irrCls + '">' + irrTxt + '</span>' +
    '<span class="delta">modelled equity IRR' + (complete ? ' &middot; diamonds ' + Math.round(A) + ' / ' + Math.round(B) : ' &middot; ' + scored + ' of ' + ALL_CRIT.length + ' criteria scored') + '</span></div>' +
    '</div>';

  /* ── headline numbers ───────────────────────────────────────────────── */
  if (m) {
    h += '<div class="card"><div class="statrow">' +
      '<div class="st"><div class="k">MOIC</div><div class="v">' + (m.moic != null && isFinite(m.moic) ? m.moic.toFixed(2) + '&times;' : '—') + '</div><div class="s">' + dollars(m.inflow) + ' back on ' + dollars(m.outflow) + '</div></div>' +
      '<div class="st"><div class="k">Year-1 DSCR</div><div class="v ' + dCls + '">' + (y1Dscr != null ? y1Dscr.toFixed(2) + '&times;' : '—') + '</div><div class="s">' + (y1Dscr == null ? 'no debt' : y1Dscr < 1.25 ? 'Below the 1.25&times; threshold' : 'Clears the 1.25&times; threshold') + '</div></div>' +
      '<div class="st"><div class="k">Yr-1 cash yield</div><div class="v ' + (y1coc != null && y1coc < 0 ? 'down' : '') + '">' + (y1coc != null ? pct(y1coc, 0) : '—') + '</div><div class="s">On equity invested</div></div>' +
      '<div class="st"><div class="k">Purchase price</div><div class="v">' + money(m.price) + '</div><div class="s">' + (p.i.etype === 'sde' ? dollars(p.i.earnings) + ' SDE &times; ' + p.i.entryMultiple.toFixed(1) : dollars(m.ebitda0) + ' EBITDA &times; ' + p.i.entryMultiple.toFixed(1)) + '</div></div>' +
      '<div class="st"><div class="k">Equity in</div><div class="v">' + money(m.equity) + '</div><div class="s">' + pct(m.totalUses > 0 ? m.equity / m.totalUses : 0, 1) + ' of total uses</div></div>' +
      '<div class="st"><div class="k">Exit proceeds</div><div class="v ' + (m.exitEquity < 0 ? 'down' : '') + '">' + money(m.exitEquity) + '</div><div class="s">' + money(m.exitEV) + ' sale less ' + money(m.remaining) + ' debt</div></div>' +
      '</div></div>';
  } else {
    h += '<div class="note bad">' + (err === 'NO_EBITDA'
      ? '<b>No EBITDA left to buy.</b> A market-rate salary exceeds what this business earns. Open the Model and lower the salary, or the price.'
      : '<b>The capital stack does not balance.</b> The loan and seller note fund more than the purchase price, leaving no equity cheque. Open the Model to fix it.') + '</div>';
  }

  /* ── diamond ────────────────────────────────────────────────────────── */
  h += '<div class="sectitle">The Double Diamond</div>';
  if (complete) {
    var vd = verdictFor(A, B, stops);
    h += '<div class="card" style="display:flex;gap:30px;flex-wrap:wrap;align-items:center">' +
      '<div style="flex:1 1 300px;min-width:0">' + diamondSVG(A, B) +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;text-align:center;margin-top:6px">' +
      '<div><div class="bignum" style="font-size:34px;color:var(--brand)">' + Math.round(A) + '</div></div>' +
      '<div><div class="bignum" style="font-size:34px;color:var(--warn)">' + Math.round(B) + '</div></div></div></div>' +
      '<div style="flex:1 1 250px;min-width:0">' +
      '<div class="kicker" style="margin-bottom:5px">Verdict</div>' +
      '<h3 style="font-size:24px;font-weight:800;margin-bottom:9px">' + vd.v + '</h3>' +
      '<p style="color:var(--tx2);font-size:14.5px;line-height:1.55">' + vd.s + '</p>' +
      '<div style="margin-top:12px"><span class="pill ' + vd.c + '">Composite ' + Math.round((A + B) / 2) + ' / 100</span></div></div></div>';
    if (stops.length) {
      h += '<div class="note bad" style="margin-top:16px"><b>Hard stops:</b> ' +
        stops.map(function (s) { return esc(s.n) + ' (' + s.v + '/5)'; }).join(', ') + '.</div>';
    }
  } else {
    h += '<div class="note"><b>' + (ALL_CRIT.length - scored) + ' criteria still unscored.</b> The verdict appears when all sixteen are in.</div>';
  }
  h += '<div class="sectitle">Diamond I &mdash; the business</div>' + critTable(CRIT_A, p.d);
  h += '<div class="sectitle">Diamond II &mdash; the deal</div>' + critTable(CRIT_B, p.d);

  /* ── deal model ─────────────────────────────────────────────────────── */
  if (m) {
    h += '<div class="sectitle">Sources &amp; uses</div>' +
      '<div class="xs"><table><tbody>' +
      '<tr><td>Purchase price</td><td style="text-align:right"><b>' + dollars(m.price) + '</b></td></tr>' +
      '<tr><td>Closing costs</td><td style="text-align:right">' + dollars(p.i.closingCosts) + '</td></tr>' +
      '<tr style="background:var(--surf)"><td><b>Total uses</b></td><td style="text-align:right"><b>' + dollars(m.totalUses) + '</b></td></tr>' +
      '<tr><td>SBA 7(a) loan</td><td style="text-align:right">' + dollars(m.sba) + '</td></tr>' +
      '<tr><td>Seller note</td><td style="text-align:right">' + dollars(m.seller) + '</td></tr>' +
      '<tr style="background:var(--surf)"><td><b>Your equity</b></td><td style="text-align:right"><b>' + dollars(m.equity) + '</b></td></tr>' +
      '</tbody></table></div>';

    h += '<div class="sectitle">Equity cash flows</div><div class="chart">' + cashChart(m) + '</div>';

    var rows = m.rows.map(function (x) {
      return '<tr><td>Year ' + x.y + '</td><td>' + dollars(x.ebitda) + '</td><td>' + dollars(-x.capex) + '</td><td>' + dollars(-x.interest) + '</td><td>' + dollars(-x.principal) + '</td><td>' + dollars(-x.taxes) + '</td>' +
        '<td class="' + (x.fcfe < 0 ? 'neg' : '') + '"><b>' + dollars(x.fcfe) + '</b></td>' +
        '<td class="' + (x.dscr != null && x.dscr < 1.25 ? 'neg' : '') + '">' + (x.dscr != null ? x.dscr.toFixed(2) + '&times;' : '—') + '</td><td>' + dollars(x.debt) + '</td></tr>';
    }).join('');
    h += '<div class="sectitle">Year by year</div><div class="xs"><table><thead><tr><th>Period</th><th>EBITDA</th><th>Capex</th><th>Interest</th><th>Principal</th><th>Tax</th><th>Cash to equity</th><th>DSCR</th><th>Debt left</th></tr></thead><tbody>' + rows +
      '<tr style="background:var(--surf)"><td><b>Exit (Y' + p.i.holdYears + ')</b></td><td>' + dollars(m.exitEbitda) + '</td>' +
      '<td colspan="4" style="text-align:left;color:var(--tx3)">&times; ' + p.i.exitMultiple.toFixed(1) + ' = ' + dollars(m.exitEV) + ' less ' + dollars(m.remaining) + ' debt</td>' +
      '<td><b>' + dollars(m.exitEquity) + '</b></td><td></td><td>&mdash;</td></tr></tbody></table></div>';
  }

  h += '<div class="btnrow" style="margin-top:26px">' +
    '<button class="btn ghost sm" id="rpdd">Edit the Diamond</button>' +
    '<button class="btn ghost sm" id="rpirr">Edit the model</button>' +
    '</div>' +
    '<div class="note" style="margin-top:20px"><b>A saved snapshot, not a valuation.</b> Every number here is recomputed from the assumptions you entered for this company. Change them in the Model and this report moves with them.</div>';

  root.innerHTML = h;
  markScrollers();
  var back = $('#rpback'); if (back) back.onclick = function () { nav('home'); };
  var bdd = $('#rpdd'); if (bdd) bdd.onclick = function () { nav('dd'); };
  var birr = $('#rpirr'); if (birr) birr.onclick = function () { nav('irr'); };
}
