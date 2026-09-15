import { execSync } from 'node:child_process';
const pw = await import(execSync('npm root -g').toString().trim() + '/playwright/index.js');
const chromium = (pw.chromium || pw.default.chromium);
const U = 'http://127.0.0.1:5199/';
let fails = 0; const errs = [];
const ok = (n, c, m) => { if (c) console.log('  PASS', n); else { console.log('  FAIL', n, m ?? ''); fails++; } };
const b = await chromium.launch();

for (const [theme, w] of [['light', 1360], ['dark', 430]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, colorScheme: theme });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${theme}/${w} ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${theme}/${w} ${m.text()}`); });
  await p.goto(U, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600);
  console.log(`— report @ ${theme}/${w} —`);

  // the saved-company row is a real button that goes somewhere
  ok('rail row exists', (await p.$$('#plist .pitem')).length >= 1);
  ok('rail row shows an affordance', await p.isVisible('#plist .pitem .pgo'));
  // CONTRACT CHANGE: a rail row now opens the company HUB, and the report is one
  // stage reached from it. Value from partial work needs somewhere to stand that
  // is not a report — see src/views/hub.js.
  await p.click('#plist .pitem'); await p.waitForTimeout(300);
  ok('click opens the hub', await p.isVisible('#p-hub'));
  ok('home is no longer shown', !(await p.isVisible('#p-home')));
  ok('the hub names the company', (await p.textContent('#hubroot')).includes('Cascade Septic & Drain'));
  await p.click('#hubreport'); await p.waitForTimeout(300);
  ok('the hub opens the report', await p.isVisible('#p-report'));
  ok('the hub is no longer shown', !(await p.isVisible('#p-hub')));

  const t = await p.textContent('#reportroot');
  ok('names the company', t.includes('Cascade Septic & Drain'), t.slice(0, 60));
  ok('shows the IRR', (await p.textContent('#reportroot .bignum')).includes('%'));
  ok('shows both diamond scores', t.includes('diamonds 72 / 77'));
  ok('shows the verdict', t.includes('Pursue'));
  ok('lists every criterion', await p.evaluate(() =>
    document.querySelectorAll('#reportroot .crrow').length >= 16));
  ok('shows sources & uses', t.includes('Total uses'));
  ok('shows year by year', t.includes('Cash to equity') || t.includes('Exit (Y'));
  ok('renders the cash chart', await p.isVisible('#reportroot .chart svg'));
  ok('shows MOIC', t.includes('MOIC'));

  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('no h-overflow on report', ov <= 1, ov);

  await p.click('#rpback'); await p.waitForTimeout(250);
  ok('back returns home', await p.isVisible('#p-home'));

  // Re-sequenced through the hub for the same reason as above.
  await p.click('#plist .pitem'); await p.waitForTimeout(250);
  await p.click('#hubreport'); await p.waitForTimeout(250);
  await p.click('#rpdd'); await p.waitForTimeout(250);
  ok('edit-diamond jumps to the Diamond', await p.isVisible('#p-dd'));

  await ctx.close();
}

// account chip: signed out is words, not a letter-in-a-circle
const ctx = await b.newContext({ viewport: { width: 1360, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push('acct ' + e.message));
await p.goto(U, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(500);
console.log('— account chip —');
ok('signed out reads as words', (await p.textContent('#acct')).trim().length > 0);
ok('signed out hides the avatar circle', !(await p.isVisible('#acctav')));
ok('carries the out class', await p.evaluate(() => document.getElementById('acct').classList.contains('out')));
// simulate a signed-in render
await p.evaluate(() => {
  const a = document.getElementById('acct'), av = document.getElementById('acctav'), lb = document.getElementById('acctlbl');
  a.classList.remove('out'); a.classList.add('avonly');
  av.innerHTML = '<img src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27%3E%3Crect width=%2764%27 height=%2764%27 fill=%27%2300D26A%27/%3E%3C/svg%3E" alt="">M';
  lb.textContent = '';
});
await p.waitForTimeout(150);
ok('signed in shows the picture', await p.isVisible('#acctav img'));
ok('signed in hides the label', !(await p.isVisible('#acctlbl')));
const box = await p.evaluate(() => { const r = document.getElementById('acctav').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
ok('picture is a circle of one size', box[0] === box[1] && box[0] >= 28, box.join('x'));
ok('no border chrome around it', await p.evaluate(() => getComputedStyle(document.getElementById('acct')).borderTopWidth === '0px'));
await ctx.close();

// ── a report for a company whose model has never been run ────────────────────
// Every figure the engine produces comes from p.i, which is pre-filled from DEF
// at birth — so before this gate existed, a company created five seconds ago
// rendered the worked example's 62.6% IRR, MOIC and full sources & uses as if
// they were its own. A partial report must never be mistakable for a real one.
{
  const ctx2 = await b.newContext({ viewport: { width: 1360, height: 900 } });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errs.push(e.message));
  await p2.goto(U, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(700);

  // Create by pressing Enter, which used to close the dialog and immediately
  // reopen an identical empty one: closeModal restored focus to #newproj inside
  // the still-running keydown, and the same keystroke then activated it.
  const before = (await p2.$$('#plist .pitem')).length;
  await p2.click('#newproj'); await p2.waitForTimeout(250);
  await p2.fill('#newval', 'Untouched Co');
  await p2.press('#newval', 'Enter'); await p2.waitForTimeout(500);
  ok('Enter closes the new-company dialog', !(await p2.evaluate(() => document.getElementById('modal').classList.contains('on'))));
  ok('Enter creates exactly one company', (await p2.$$('#plist .pitem')).length === before + 1);
  ok('Enter lands on the new company hub', await p2.isVisible('#p-hub'));

  await p2.click('#hubreport'); await p2.waitForTimeout(400);
  const rt = await p2.textContent('#reportroot');
  ok('unrun model shows no IRR', (await p2.textContent('#reportroot .bignum')).trim() === '\u2014');
  ok('unrun model says so in words', /has not been run/.test(rt));
  ok('unrun model is marked Partial', /Partial/.test(rt));
  ok('unrun model leaks no default IRR', !rt.includes('62.6'), rt.slice(0, 80));
  ok('unrun model leaks no sources & uses', !rt.includes('Total uses'));
  ok('unrun model leaks no MOIC', !rt.includes('MOIC'));
  ok('offers a way to run it', await p2.isVisible('#rprunmodel'));
  await p2.click('#rprunmodel'); await p2.waitForTimeout(350);
  ok('that way reaches the model', await p2.isVisible('#p-irr'));
  await ctx2.close();
}

await b.close();
if (errs.length) { console.log('\nRUNTIME ERRORS:'); errs.forEach((e) => console.log('  ' + e)); fails += errs.length; }
console.log(fails ? `\n${fails} FAILED` : '\nALL REPORT E2E PASS');
process.exit(fails ? 1 : 0);
