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

/* Creating a company must be deterministic by BOTH routes, at BOTH widths: the
   dialog closes and the app lands on the new company's hub, and exactly one
   company appears. The Enter case is a regression guard. Before the fix, Enter
   fired keydown -> create -> closeModal -> focus restored SYNCHRONOUSLY to
   #newproj, and Blink then delivered the same keystroke's keypress to that
   newly-focused button, activating it and opening a second, empty dialog. One
   company was created, but the user was looking at an identical blank form, so
   "I pressed Enter and it stayed" was a precise report. Reproduced at 375 and
   1360 alike — it was never device-specific. */
for (const w of [375, 1360]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`new@${w} ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`new@${w} ${m.text()}`); });
  await p.goto(U, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600);
  console.log(`— new company @ ${w} —`);
  const count = () => p.$$eval('#plist .pitem', (n) => n.length);
  const modalOn = () => p.evaluate(() => document.getElementById('modal').classList.contains('on'));

  let n = await count();
  await p.click('#newproj'); await p.waitForTimeout(250);
  await p.fill('#newval', 'Clickside Plumbing'); await p.click('#newsave'); await p.waitForTimeout(450);
  ok('click closes the dialog', !(await modalOn()));
  ok('click lands on the hub', await p.isVisible('#p-hub'));
  ok('the hub names the new company', (await p.textContent('#hubroot')).includes('Clickside Plumbing'));
  ok('click created exactly one', (await count()) === n + 1, n + ' -> ' + (await count()));

  n = await count();
  await p.click('#newproj'); await p.waitForTimeout(250);
  await p.fill('#newval', 'Enterprise Roofing'); await p.press('#newval', 'Enter'); await p.waitForTimeout(450);
  ok('Enter closes the dialog and does not reopen it', !(await modalOn()));
  ok('Enter lands on the hub', await p.isVisible('#p-hub'));
  ok('Enter created exactly one', (await count()) === n + 1, n + ' -> ' + (await count()));

  // Rename by Enter closes cleanly and creates nothing — the same guard, latent.
  n = await count();
  await p.click('#renproj'); await p.waitForTimeout(250);
  await p.press('#renval', 'Enter'); await p.waitForTimeout(400);
  ok('rename by Enter closes cleanly', !(await modalOn()));
  ok('rename by Enter creates nothing', (await count()) === n, n + ' -> ' + (await count()));
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
// Only the ratings the scheduler will act on are offered: four on a confident
// correct answer, one on a miss (grade() forces a miss to Again regardless).
// test/e2e-learn.mjs covers that contract across all three paths.
const wasRight = (await p.$$('.feedback.miss')).length === 0;
ok('grade buttons match what the scheduler will honour',
   (await p.$$('[data-grade]')).length === (wasRight ? 4 : 1), 'correct=' + wasRight);
const srsBefore = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('acqbench.v3')).srs).length);
await p.click('.grades button:last-child'); await p.waitForTimeout(350);
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
  // Last button, whichever set is offered — a miss shows only one.
  if ((await p.$$('[data-grade]')).length) { await p.click('.grades button:last-child'); await p.waitForTimeout(140); }
}
ok('session reaches a completion card', await p.isVisible('.sessiondone'), 'after ' + guard + ' steps');
ok('ends with return-date guidance, not a score', (await T('.sessiondone')).includes('Come back'));
ok('completion reports a retention forecast', (await T('.sessiondone')).includes('90 days'));

console.log('— persistence —');
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600);
ok('companies survive reload', (await p.$$('#plist .pitem')).length === 2);
await p.click('#mainnav button[data-go="learn"]'); await p.waitForTimeout(400);
ok('learning progress survives reload', !(await T('#learnroot')).includes('Projected retention\n0'), (await T('#learnroot')).slice(0, 40));

await ctx.close();

/* The end-of-stage bars at the foot of #p-dd and #p-irr.

   The Model's completion is a FACT THE USER CREATED, not a heuristic about
   them: `i` is pre-filled from DEF at birth, so accepting a default is a real
   review that leaves no trace, and any "edited N of 18" threshold would leave
   the stage permanently uncompletable for a buyer who agrees with the defaults.
   So the count beside the button is informational and the button decides.

   The Diamond's is the opposite: the sixteen scores ARE the record, so its Done
   control stores nothing and must leave the company document untouched.

   Both are checked across a RELOAD, because the whole point of the funnel is
   coming back days later. */
for (const w of [375, 1360]) {
  const c2 = await b.newContext({ viewport: { width: w, height: 900 } });
  const q = await c2.newPage();
  q.on('pageerror', (e) => errs.push(`stage@${w} ${e.message}`));
  q.on('console', (m) => { if (m.type() === 'error') errs.push(`stage@${w} ${m.text()}`); });
  await q.goto(U, { waitUntil: 'domcontentloaded' }); await q.waitForTimeout(600);
  console.log(`— end-of-stage bars @ ${w} —`);
  const co = () => q.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('acqbench.v3')); return s.companies[s.active];
  });

  // A NEW company, so nothing is pre-confirmed: the seed is the authored worked
  // example and ships finished.
  await q.click('#newproj'); await q.waitForTimeout(250);
  await q.fill('#newval', 'Stagebar Septic'); await q.press('#newval', 'Enter'); await q.waitForTimeout(450);
  await q.click('#hubirr'); await q.waitForTimeout(300);

  ok('model bar offers a way back to the company', await q.isVisible('#irrback'));
  ok('the way back names the company', (await q.textContent('#irrback')).includes('Stagebar Septic'));
  ok('an untouched model reads 0 of 18', (await q.textContent('#irrconfirm .stagecount')).trim() === '0 of 18 reviewed',
    (await q.textContent('#irrconfirm .stagecount')).trim());

  // The count follows real edits, and counts each field once.
  await q.fill('#in-entryMultiple', '3.8'); await q.dispatchEvent('#in-entryMultiple', 'input');
  await q.fill('#in-taxRate', '27'); await q.dispatchEvent('#in-taxRate', 'input');
  await q.fill('#in-taxRate', '28'); await q.dispatchEvent('#in-taxRate', 'input');
  await q.waitForTimeout(250);
  ok('two edited fields read 2 of 18', (await q.textContent('#irrconfirm .stagecount')).trim() === '2 of 18 reviewed',
    (await q.textContent('#irrconfirm .stagecount')).trim());
  // etype is engagement and is recorded, but it is not one of the 18 inputs.
  await q.click('#etype button[data-t="sde"]'); await q.waitForTimeout(250);
  ok('etype never inflates the denominator to 19', !(await q.textContent('#irrconfirm')).includes('of 19'));
  ok('etype is recorded as engagement all the same', Object.keys((await co()).prog.t).includes('etype'));
  ok('etype is excluded from the count', (await q.textContent('#irrconfirm .stagecount')).trim() === '2 of 18 reviewed');
  await q.click('#etype button[data-t="ebitda"]'); await q.waitForTimeout(200);

  if (w === 375) {
    const hs = await q.$$eval('#irrconfirm .btn', (n) => n.map((x) => x.getBoundingClientRect().height));
    ok('every model-bar control clears the 44px touch floor', hs.every((h) => h >= 44), hs.join(', '));
  }
  ok('no horizontal overflow on the Model', await q.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth));

  await q.click('#irrdone'); await q.waitForTimeout(400);
  ok('confirming returns to the hub', await q.isVisible('#p-hub'));
  ok('the hub Model row reads as done', (await q.textContent('#hubirr')).includes('Reviewed and confirmed'));

  await q.reload({ waitUntil: 'domcontentloaded' }); await q.waitForTimeout(600);
  ok('the confirmation survives a reload', (await co()).prog.modelDone > 0);
  await q.click('#hubirr'); await q.waitForTimeout(300);
  ok('a confirmed model shows the Reviewed pill', await q.isVisible('#irrconfirm .stagepill'));
  ok('a confirmed model no longer offers the confirm', !(await q.isVisible('#irrdone')));

  await q.click('#irrreopen'); await q.waitForTimeout(300);
  ok('re-opening clears the confirmation', (await co()).prog.modelDone === 0);
  ok('re-opening keeps the reviewed fields', Object.keys((await co()).prog.t).length === 3,
    Object.keys((await co()).prog.t).join(','));
  await q.reload({ waitUntil: 'domcontentloaded' }); await q.waitForTimeout(600);
  ok('the re-opening survives a reload too', (await co()).prog.modelDone === 0);
  ok('the confirm button is back after the reload', await q.isVisible('#irrdone'));

  // ── Diamond ──────────────────────────────────────────────────────────────
  await q.click('#irrback'); await q.waitForTimeout(300);
  await q.click('#hubdd'); await q.waitForTimeout(300);
  await q.click('#dclear'); await q.waitForTimeout(300);
  ok('no Done while criteria are unscored', !(await q.isVisible('#dddone')));
  ok('the way back is there regardless', await q.isVisible('#ddback'));
  await q.click('#ddback'); await q.waitForTimeout(300);
  ok('leaving a half-done Diamond lands on the company, not home', await q.isVisible('#p-hub'));

  await q.click('#hubdd'); await q.waitForTimeout(300);
  await q.click('#dfill'); await q.waitForTimeout(400);
  ok('Done appears at 16 of 16', await q.isVisible('#dddone'));
  ok('the Diamond count is 16 of 16', (await q.textContent('#ddconfirm .stagecount')).trim() === '16 of 16 scored',
    (await q.textContent('#ddconfirm .stagecount')).trim());
  if (w === 375) {
    const hs = await q.$$eval('#ddconfirm .btn', (n) => n.map((x) => x.getBoundingClientRect().height));
    ok('every Diamond-bar control clears the 44px touch floor', hs.every((h) => h >= 44), hs.join(', '));
  }
  ok('no horizontal overflow on the Diamond', await q.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth));

  const strip = (o) => { const { updated, ...r } = o; return JSON.stringify(r); };
  const before = strip(await co());
  await q.click('#dddone'); await q.waitForTimeout(400);
  ok('Done returns to the hub', await q.isVisible('#p-hub'));
  ok('Done stores nothing — the sixteen scores are the record', strip(await co()) === before);
  await c2.close();
}

/* The saved-companies rail.

   Two contracts here. First, the rail must not print a deal-model number for a
   company nobody has modelled: `i` is pre-filled from DEF at birth, so
   engine.model() will happily return an IRR for a target created five seconds
   ago — and it did, "63%", before this gate. Second, the row is now a PAIR of
   sibling buttons, the row itself plus a one-tap Resume, and the separator rule
   that used to be `.pitem:last-of-type` had to move with it: each .pitem is now
   the only one of its type inside its own .prow, so the old selector matched
   every row and erased every separator in the list. */
for (const w of [375, 1360]) {
  const c3 = await b.newContext({ viewport: { width: w, height: 900 } });
  const q = await c3.newPage();
  q.on('pageerror', (e) => errs.push(`rail@${w} ${e.message}`));
  q.on('console', (m) => { if (m.type() === 'error') errs.push(`rail@${w} ${m.text()}`); });
  await q.goto(U, { waitUntil: 'domcontentloaded' }); await q.waitForTimeout(600);
  console.log(`— saved-companies rail @ ${w} —`);

  const NM = 'Rail Contract Co';
  const cell = (sel) => q.evaluate(([nm, s]) => {
    const r = [...document.querySelectorAll('#plist .prow')]
      .find((x) => x.querySelector('.pn b').textContent === nm);
    const n = r && r.querySelector(s);
    return n ? n.textContent : null;
  }, [NM, sel]);

  await q.click('#newproj'); await q.waitForTimeout(250);
  await q.fill('#newval', NM); await q.click('#newsave'); await q.waitForTimeout(450);

  ok('a company nobody has modelled shows no IRR', (await cell('.pr b')) === '—', await cell('.pr b'));
  ok('and no sparkline of numbers nobody chose', (await cell('.spark')) === null);
  ok('the row says which stage it is in', (await cell('.pn span')) === 'Diamond · 0 of 16', await cell('.pn span'));

  // Siblings, never nested: a <button> inside a <button> is invalid, Chromium
  // reparents it, and the row's own handler stops being reliable.
  ok('no button is nested inside another button', await q.evaluate(() =>
    ![...document.querySelectorAll('#plist button')].some((x) => x.querySelector('button'))));
  ok('the row button still carries the chevron', await q.isVisible('#plist .pitem .pgo'));

  // Resume jumps past the hub into whichever stage is next — here, the Diamond.
  await q.click('#mainnav button[data-go="learn"]'); await q.waitForTimeout(250);
  await q.evaluate((nm) => [...document.querySelectorAll('#plist .prow')]
    .find((x) => x.querySelector('.pn b').textContent === nm).querySelector('.presume').click(), NM);
  await q.waitForTimeout(350);
  ok('Resume opens the stage the funnel says is next', await q.isVisible('#p-dd'));

  const bd = await q.$$eval('#plist .prow', (rows) =>
    rows.map((x) => parseFloat(getComputedStyle(x.querySelector('.pitem')).borderBottomWidth)));
  ok('every row but the last keeps its separator',
     bd.length >= 2 && bd.slice(0, -1).every((v) => v > 0) && bd[bd.length - 1] === 0, JSON.stringify(bd));

  if (w === 375) {
    const hs = await q.$$eval('#plist .prow', (rows) => rows.flatMap((x) =>
      [x.querySelector('.pitem'), x.querySelector('.presume')].map((n) => n.getBoundingClientRect().height)));
    ok('both halves of a row clear the 44px touch floor', hs.every((h) => h >= 44), hs.join(', '));
    ok('the rail does not scroll the page sideways', await q.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1));
  }
  await c3.close();
}

const real = errs.filter((e) => !/fonts\.googleapis|ERR_TUNNEL|Failed to load resource/.test(e));
ok('no runtime errors', real.length === 0, real.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL E2E PASS');
process.exit(fails ? 1 : 0);
