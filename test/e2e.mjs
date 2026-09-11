import { execSync } from 'node:child_process';
const pw = await import(execSync('npm root -g').toString().trim() + '/playwright/index.js');
const chromium = (pw.chromium || pw.default.chromium);
const U = 'http://127.0.0.1:5199/';
let fails = 0; const errs = [];
const ok = (n, c, m) => { if (c) console.log('  PASS', n); else { console.log('  FAIL', n, m ?? ''); fails++; } };

const b = await chromium.launch();
for (const [theme, w] of [['light', 1360], ['dark', 1360], ['dark', 430]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, colorScheme: theme });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${theme}/${w} ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${theme}/${w} ${m.text()}`); });
  await p.goto(U, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600);
  console.log(`— ${theme} @ ${w} —`);
  for (const id of ['home', 'assess', 'dd', 'irr', 'learn', 'notes']) {
    await p.click(`#mainnav button[data-go="${id}"]`); await p.waitForTimeout(180);
    ok('nav ' + id, await p.isVisible('#p-' + id));
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('no h-overflow ' + id, ov <= 1, ov);
  }
  await ctx.close();
}

const ctx = await b.newContext({ viewport: { width: 1360, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push('fn ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('fn ' + m.text()); });
await p.goto(U, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600);
const T = (s) => p.textContent(s).then((x) => x.trim());
const set = async (k, v) => { await p.fill('#in-' + k, String(v)); await p.dispatchEvent('#in-' + k, 'input'); await p.waitForTimeout(160); };

console.log('— model —');
await p.click('#mainnav button[data-go="irr"]'); await p.waitForTimeout(350);
ok('IRR 62.6%', await T('#ires .bignum') === '62.6%', await T('#ires .bignum'));
ok('MOIC 6.78x', (await T('#ires .st:nth-child(1) .v')).replace(/\s/g, '') === '6.78×', await T('#ires .st:nth-child(1) .v'));
await set('sbaPct', 90); await set('sellerPct', 50);
ok('over-funding refused', (await T('#ires')).includes('sources exceed your uses'));
await p.click('#ireset'); await p.waitForTimeout(300);
ok('reset restores', await T('#ires .bignum') === '62.6%');
ok('stat grid has no empty cells at any column count', await p.evaluate(() => {
  const row = document.querySelector('#ires .statrow');
  const n = row.children.length;
  const cols = getComputedStyle(row).gridTemplateColumns.split(' ').length;
  return n % cols === 0;
}));
ok('exit proceeds reported', (await T('#ires .st:nth-child(6) .v')).includes('$'), await T('#ires .st:nth-child(6) .v'));

console.log('— companies —');
ok('one seeded company', (await p.$$('#plist .pitem')).length === 1);
await p.click('#newproj'); await p.waitForTimeout(250);
await p.fill('#newval', 'Ridgeline HVAC'); await p.click('#newsave'); await p.waitForTimeout(400);
ok('two companies', (await p.$$('#plist .pitem')).length === 2);
await p.click('#mainnav button[data-go="dd"]'); await p.waitForTimeout(250);
ok('new company starts unscored', (await T('#dres')).includes('unscored'));
await p.click('#dfill'); await p.waitForTimeout(350);
ok('example scores load', (await T('#dres')).includes('Pursue'), (await T('#dres')).slice(0, 40));

console.log('— sign-in state —');
ok('shows device-only when unconfigured', ['This device', 'Sign in'].includes(await T('#acctlbl')), await T('#acctlbl'));
await p.click('#acct'); await p.waitForTimeout(350);
ok('explains why sign-in is off', (await T('#modalbody')).includes('Firebase'), (await T('#modalbody')).slice(0, 60));
await p.click('#modalx'); await p.waitForTimeout(250);

console.log('— learn: lessons —');
await p.click('#mainnav button[data-go="learn"]'); await p.waitForTimeout(400);
ok('retention forecast shown, not a percent-complete', (await T('#learnroot')).includes('Projected retention'));
ok('progress is a retention forecast, not a completion percentage',
   (await p.$$('#learnroot .bignum')).length >= 1 && !(await T('#learnroot')).match(/\d+% complete|day streak/i));
ok('four tracks', (await p.$$('#tracklist .trackcard')).length === 4);
ok('track cards are not clipped', await p.evaluate(() =>
  [...document.querySelectorAll('#tracklist .trackcard')].every((el) =>
    el.children.length === 4 && el.scrollHeight <= el.clientHeight + 1 &&
    el.lastElementChild.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 1)));
ok('gauge progress bars are not polluted by the card class', await p.evaluate(() => {
  const g = document.querySelector('.gauge .track');
  if (!g) return true;
  const s = getComputedStyle(g);
  return s.paddingTop === '0px' && s.borderTopWidth === '0px' && Math.round(parseFloat(s.height)) <= 8;
}));
await p.click('#tracklist .trackcard:nth-child(3)'); await p.waitForTimeout(300);
const rows = (await p.$$('#lessonlist .lessonrow')).length;
ok('diamond track lists all 16 criteria', rows === 16, rows);
await p.click('#lessonlist .lessonrow:nth-child(1)'); await p.waitForTimeout(300);
ok('lesson renders prose', (await T('.lessonbody')).length > 300);
ok('lesson shows the 0-5 anchors', (await p.$$('.anchorlist div')).length === 6);

console.log('— learn: quiz —');
await p.click('#quizthis'); await p.waitForTimeout(400);
ok('question shown', (await p.$$('.choice')).length === 4 || await p.isVisible('#clozein'));
ok('answer is hidden before committing', (await p.$$('.choice.right')).length === 0);
ok('confidence asked before reveal', await p.isVisible('[data-conf="certain"]'));
await p.click('[data-conf="certain"]'); await p.waitForTimeout(150);
await p.click('.choice:nth-child(1)'); await p.waitForTimeout(300);
ok('correct answer revealed immediately', (await p.$$('.choice.right')).length === 1);
ok('explanation given, not just right/wrong', (await T('.feedback')).length > 80);
ok('grade buttons offered', (await p.$$('[data-grade]')).length === 4);
const srsBefore = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('acqbench.v3')).srs).length);
await p.click('[data-grade="4"]'); await p.waitForTimeout(350);
const srsAfter = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('acqbench.v3')).srs).length);
ok('review is recorded to the schedule', srsAfter === srsBefore + 1, srsBefore + ' -> ' + srsAfter);
const logged = await p.evaluate(() => JSON.parse(localStorage.getItem('acqbench.v3')).reviewLog.length);
ok('review logged for a later scheduler upgrade', logged >= 1, logged);
const due = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('acqbench.v3')).srs; const k = Object.keys(s)[0]; return s[k].due - Date.now(); });
ok('next review scheduled about a day out', due > 20 * 36e5 && due < 30 * 36e5, Math.round(due / 36e5) + 'h');

console.log('— learn: a full session runs to completion —');
await p.click('#mainnav button[data-go="learn"]'); await p.waitForTimeout(300);
await p.click('#startsession'); await p.waitForTimeout(400);
let guard = 0;
while (guard++ < 60) {
  if (await p.isVisible('.sessiondone')) break;
  if (await p.isVisible('#clozein')) {
    await p.fill('#clozein', 'x'); await p.click('#submitcloze');
  } else if ((await p.$$('.choice:not([disabled])')).length) {
    await p.click('.choice:nth-child(2)');
  }
  await p.waitForTimeout(120);
  if ((await p.$$('[data-grade]')).length) { await p.click('[data-grade="4"]'); await p.waitForTimeout(140); }
}
ok('session reaches a completion card', await p.isVisible('.sessiondone'), 'after ' + guard + ' steps');
ok('ends with next-session guidance, not a score', (await T('.sessiondone')).includes('Next session'));
ok('completion reports a retention forecast', (await T('.sessiondone')).includes('90 days'));

console.log('— persistence —');
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600);
ok('companies survive reload', (await p.$$('#plist .pitem')).length === 2);
await p.click('#mainnav button[data-go="learn"]'); await p.waitForTimeout(400);
ok('learning progress survives reload', !(await T('#learnroot')).includes('Projected retention\n0'), (await T('#learnroot')).slice(0, 40));

await ctx.close();
const real = errs.filter((e) => !/fonts\.googleapis|ERR_TUNNEL|Failed to load resource/.test(e));
ok('no runtime errors', real.length === 0, real.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL E2E PASS');
process.exit(fails ? 1 : 0);
