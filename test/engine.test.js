import { irr, pmt, model } from '../src/engine.js';
let fails = 0;
const ok = (n, c, m) => { if (c) console.log('  PASS', n); else { console.log('  FAIL', n, m ?? ''); fails++; } };
const near = (a, b, t = 1e-9) => Math.abs(a - b) < t;

console.log('— IRR test vectors —');
[['T1', [-1000,500,400,300,100], 0.144888442786],
 ['T2', [-1000,0,0,0,0,2000], 0.148698354997],
 ['T3', [-500000,120000,130000,145000,160000,2200000], 0.501629734784],
 ['T6', [-100,50,50], 0],
 ['T8', [-123400,36200,54800,48100], 0.059616378567],
 ['T10',[-1000,1100], 0.1]
].forEach(([n, cf, e]) => { const r = irr(cf); ok(n, r.ok && near(r.irr, e), JSON.stringify(r)); });

const t4 = irr([-100,230,-132]);
ok('T4 two roots 10% and 20%', t4.ok && t4.allRoots?.length === 2 && near(t4.allRoots[0],0.10,1e-7) && near(t4.allRoots[1],0.20,1e-7), JSON.stringify(t4));
ok('T5 all negative -> no sign change', irr([-100,-50,-25]).reason === 'NO_SIGN_CHANGE');
ok('T7 two sign changes, no real root', irr([-1000,3000,-2500]).reason === 'NO_ROOT_IN_RANGE');
ok('T9 all positive -> no sign change', irr([100,50,25]).reason === 'NO_SIGN_CHANGE');
ok('empty', irr([]).reason === 'TOO_FEW');
ok('NaN rejected', irr([-1, NaN]).reason === 'NON_FINITE');

console.log('— amortization —');
ok('SBA payment $46,583.12', Math.abs(pmt(3600000, 0.095, 10) - 46583.12) < 0.01, pmt(3600000,0.095,10));
ok('seller payment $9,279.74', Math.abs(pmt(480000, 0.06, 5) - 9279.74) < 0.01, pmt(480000,0.06,5));

console.log('— worked LBO example —');
const P = { etype:'ebitda', earnings:1200000, ownerComp:0, entryMultiple:4, growth:0.03,
  capexPct:0.08, nwcPct:0.15, da:120000, taxRate:0.25, sbaPct:0.75, sbaRate:0.095, sbaTerm:10,
  sellerPct:0.10, sellerRate:0.06, sellerTerm:5, sellerStandby:0, closingCosts:0, holdYears:5, exitMultiple:4 };
const m = model(P);
[272062.90, 289811.07, 307660.73, 325573.70, 343507].forEach((e, i) =>
  ok('FCFE year ' + (i+1), Math.abs(m.rows[i].fcfe - e) < 2, m.rows[i].fcfe.toFixed(2)));
ok('price $4.8M', m.price === 4800000);
ok('equity $720k', Math.abs(m.equity - 720000) < 1);
ok('remaining debt ~$2,218,047', Math.abs(m.remaining - 2218047) < 5, m.remaining);
ok('exit equity ~$3,346,468', Math.abs(m.exitEquity - 3346468) < 10, m.exitEquity);
ok('IRR 62.582%', Math.abs(m.irr.irr - 0.62582028) < 2e-5, m.irr.irr);
ok('MOIC 6.7848x', Math.abs(m.moic - 6.7848) < 0.002, m.moic);
ok('year-1 DSCR 1.84x on lender basis', Math.abs(m.rows[0].dscr - 1.8437) < 0.01, m.rows[0].dscr);

console.log('— guard rails —');
ok('sources over uses is refused', model({...P, sbaPct:0.9, sellerPct:0.5}).error === 'NO_EQUITY');
ok('salary above earnings is refused', model({...P, etype:'sde', earnings:400000, ownerComp:500000}).error === 'NO_EBITDA');
const sde = model({ ...P, etype:'sde', earnings:600000, ownerComp:150000, entryMultiple:3 });
ok('SDE prices on SDE: $1.8M', sde.price === 1800000, sde.price);
ok('SDE implies 4.0x EBITDA', Math.abs(sde.impliedMult - 4) < 1e-9, sde.impliedMult);
const dead = model({...P, growth:-0.15, exitMultiple:1, capexPct:0.4});
ok('unrecoverable deal reports no IRR rather than a number', !dead.error && !dead.irr.ok, JSON.stringify(dead.irr));
ok('standby accrues instead of paying', model({...P, sellerStandby:2}).rows[0].interest < m.rows[0].interest);

console.log(fails ? '\n' + fails + ' FAILURES' : '\nengine: all pass');
process.exit(fails ? 1 : 0);
