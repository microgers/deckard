// One press, one score — with REAL gestures.
//
// Every assertion here is driven by separate mouse.move/down/up, or by
// touchscreen.tap on a touch context. p.click() is deliberately never used: it
// synthesises the whole pointer sequence against one coordinate in a single go,
// which is exactly what hid this bug. The user's report was "I have to click
// twice"; the mechanism is that scoring a Diamond criterion inserts the answer
// quote ABOVE the dots, so the control — and every row below it — slides down
// out from under the finger, and the next press lands on nothing.
//
// So each control is checked for four things per gesture: the store changes,
// the visible state repaints, the control does not move more than 4px, and the
// NEXT control of the same kind can still be hit at the coordinates it occupied
// BEFORE the press. Drifts are printed, not just PASS/FAIL, so a regression
// says how far things moved.
import { execSync } from 'node:child_process';
const pw = await import(execSync('npm root -g').toString().trim() + '/playwright/index.js');
const b = await (pw.chromium || pw.default.chromium).launch();
let fails = 0;
const ok = (n, c, m) => { if (c) console.log('  PASS', n); else { console.log('  FAIL', n, m ?? ''); fails++; } };

for (const V of [{ w: 1360, h: 900, touch: false }, { w: 375, h: 812, touch: true }]) {
  const ctx = await b.newContext({ viewport: { width: V.w, height: V.h }, ...(V.touch ? { hasTouch: true, isMobile: true } : {}) });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  console.log('— one press, one score @ ' + V.w + (V.touch ? ' touch —' : ' mouse —'));

  /** A real gesture: the pointer pair, never p.click(). */
  const press = async (pt) => {
    if (!pt) { ok('a press target existed', false, 'missing element'); return; }
    if (V.touch) await p.touchscreen.tap(pt.x, pt.y);
    else { await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.up(); }
    await p.waitForTimeout(240);
  };
  const at = (sel) => p.evaluate((q) => {
    const e = document.querySelector(q); if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), top: r.top };
  }, sel);
  // A press point buried under the phone's tab bar, or above the header, would
  // land on the wrong thing and make a green run meaningless.
  const hittable = (pt) => !!pt && pt.y > 70 && pt.y < V.h - 90;
  const store = () => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('acqbench.v3')) || {}; } catch { return {}; } });
  const scored = async (k) => { const s = await store(); const c = s.companies && s.companies[s.active]; return c && c.d ? c.d[k] : undefined; };
  const answered = async (q) => ((await store()).assessment || {})[q];
  const act = () => p.evaluate(() => { const a = document.activeElement;
    return a ? a.tagName + (a.id ? '#' + a.id : '') : 'NONE'; });
  const has = (sel) => p.evaluate((q) => !!document.querySelector(q), sel);
  const pressed = (sel) => p.evaluate((q) => { const e = document.querySelector(q); return e && e.getAttribute('aria-pressed'); }, sel);
  const park = (sel, frac) => p.evaluate(([q, f]) => {
    window.scrollBy(0, document.querySelector(q).getBoundingClientRect().top - innerHeight * f);
  }, [sel, frac]).then(() => p.waitForTimeout(200));
  const show = (sel) => p.evaluate((q) => { const e = document.querySelector(q); if (e) e.scrollIntoView({ block: 'center' }); }, sel)
    .then(() => p.waitForTimeout(180));
  // Setup-only: bring a control on screen first, then press it for real. The
  // measured assertions below never scroll between measuring and pressing —
  // that is the whole point of the suite.
  const tap = async (sel) => { await show(sel); await press(await at(sel)); };
  const go = async (panel) => { await tap('#mainnav button[data-go="' + panel + '"]'); await p.waitForTimeout(350); };

  /* ── Diamond dots: the core case ──────────────────────────────────────── */
  await go('dd');
  await tap('#dclear'); await p.waitForTimeout(300);
  const keys = await p.evaluate(() => [...document.querySelectorAll('#ddboard .crit')].map((e) => e.dataset.k));
  let worstDot = 0, missed = [];
  for (let i = 0; i + 1 < keys.length; i += 2) {
    const k1 = keys[i], k2 = keys[i + 1];
    const row1 = '#ddboard [data-k="' + k1 + '"]', row2 = '#ddboard [data-k="' + k2 + '"]';
    await park(row1, 0.22);
    const dot1 = await at(row1 + ' .dots button:nth-child(4)');   // the 3
    const dot2 = await at(row2 + ' .dots button:nth-child(4)');   // pre-press
    const t0 = (await at(row1 + ' .dots')).top;
    if (!hittable(dot1) || !hittable(dot2)) { ok('both dots of ' + k1 + '/' + k2 + ' are on screen', false, JSON.stringify([dot1, dot2])); continue; }

    await press(dot1);
    ok('one gesture scores ' + k1, await scored(k1) === 3, 'stored ' + JSON.stringify(await scored(k1)));
    ok(k1 + ' repaints its pressed state', await pressed(row1 + ' .dots button:nth-child(4)') === 'true');
    const drift = (await at(row1 + ' .dots')).top - t0;
    worstDot = Math.max(worstDot, Math.abs(drift));
    ok(k1 + ' dots stay under the finger', Math.abs(drift) <= 4, 'moved ' + drift.toFixed(1) + 'px');
    ok(k1 + ' does not dump focus on <body>', await act() !== 'BODY', 'focus on ' + await act());

    // The one that proves the user's bug: press the NEXT criterion where it WAS.
    await press(dot2);
    if (await scored(k2) !== 3) missed.push(k1 + '→' + k2);
  }
  ok('the next criterion is hit at its pre-press coordinates', missed.length === 0,
     missed.length + ' of ' + (keys.length / 2) + ' pairs needed a second press: ' + missed.join(', '));
  console.log('    worst Diamond dot drift ' + worstDot.toFixed(1) + 'px');

  /* ── Diamond rubric modal ─────────────────────────────────────────────── */
  await tap('#dclear'); await p.waitForTimeout(300);
  await show('#ddboard [data-k="price"] button.tiny');
  const nextDot = await at('#ddboard [data-k="books"] .dots button:nth-child(4)');
  const rt0 = (await at('#ddboard [data-k="price"] .dots')).top;
  await press(await at('#ddboard [data-k="price"] button.tiny'));
  await p.waitForTimeout(400);
  await tap('#optlist button:nth-child(5)');                        // the 4
  await p.waitForTimeout(400);
  ok('one gesture on a rubric option scores it', await scored('price') === 4, 'stored ' + JSON.stringify(await scored('price')));
  const rd = (await at('#ddboard [data-k="price"] .dots')).top - rt0;
  ok('the rubric leaves the dots where they were', Math.abs(rd) <= 4, 'moved ' + rd.toFixed(1) + 'px');
  ok('the rubric does not dump focus on <body>', await act() !== 'BODY', 'focus on ' + await act());
  if (hittable(nextDot)) { await press(nextDot); ok('the next criterion survives the rubric round trip', await scored('books') === 3, 'stored ' + JSON.stringify(await scored('books'))); }
  console.log('    rubric dot drift ' + rd.toFixed(1) + 'px');

  /* ── Operator likert ──────────────────────────────────────────────────── */
  await go('assess');
  await tap('#aclear'); await p.waitForTimeout(300);
  let worstLk = 0, lkMissed = [];
  for (const q of [0, 2, 4, 6, 8, 10]) {
    const r1 = '#qlist [data-q="' + q + '"]', r2 = '#qlist [data-q="' + (q + 1) + '"]';
    await park(r1, 0.22);
    const b1 = await at(r1 + ' .likert button:nth-child(3)');
    const b2 = await at(r2 + ' .likert button:nth-child(3)');
    const t0 = (await at(r1 + ' .likert')).top;
    if (!hittable(b1) || !hittable(b2)) { ok('likert ' + q + '/' + (q + 1) + ' on screen', false); continue; }
    await press(b1);
    ok('one gesture answers statement ' + (q + 1), await answered(q) === 3, 'stored ' + JSON.stringify(await answered(q)));
    ok('statement ' + (q + 1) + ' repaints its pressed state', await pressed(r1 + ' .likert button:nth-child(3)') === 'true');
    const d = (await at(r1 + ' .likert')).top - t0;
    worstLk = Math.max(worstLk, Math.abs(d));
    ok('statement ' + (q + 1) + ' stays under the finger', Math.abs(d) <= 4, 'moved ' + d.toFixed(1) + 'px');
    ok('statement ' + (q + 1) + ' does not dump focus on <body>', await act() !== 'BODY', 'focus on ' + await act());
    await press(b2);
    if (await answered(q + 1) !== 3) lkMissed.push(q + '→' + (q + 1));
  }
  ok('the next statement is hit at its pre-press coordinates', lkMissed.length === 0, lkMissed.join(', '));
  console.log('    worst likert drift ' + worstLk.toFixed(1) + 'px');

  /* ── Learn confidence chips ───────────────────────────────────────────── */
  await go('learn');
  await tap('#startsession'); await p.waitForTimeout(450);
  await park('#qcard', 0.14);
  const c1 = await at('#qcard [data-conf="unsure"]');
  const c2 = await at('#qcard [data-conf="certain"]');
  const ct0 = (await at('#qcard [data-conf="unsure"]')).top;
  const ch0 = (await at('#qcard .choices, #qcard .clozein')).top;
  await press(c1);
  ok('one gesture sets the confidence chip', await pressed('#qcard [data-conf="unsure"]') === 'true');
  const cd = (await at('#qcard [data-conf="unsure"]')).top - ct0;
  ok('the chip stays under the finger', Math.abs(cd) <= 4, 'moved ' + cd.toFixed(1) + 'px');
  ok('the chip keeps focus off <body>', await act() !== 'BODY', 'focus on ' + await act());
  const chd = (await at('#qcard .choices, #qcard .clozein')).top - ch0;
  ok('the answers below the chips do not move', Math.abs(chd) <= 4, 'moved ' + chd.toFixed(1) + 'px');
  await press(c2);
  ok('the next chip is hit at its pre-press coordinates', await pressed('#qcard [data-conf="certain"]') === 'true');
  console.log('    chip drift ' + cd.toFixed(1) + 'px, answer-block drift ' + chd.toFixed(1) + 'px');

  // Keyboard, same fault seen from the other side: if the redraw leaves focus on
  // <body>, the learner's next Space pages the document instead of acting.
  const sy0 = await p.evaluate(() => scrollY);
  await p.evaluate(() => document.querySelector('#qcard [data-conf="fairly"]').focus());
  await p.keyboard.press('Space'); await p.waitForTimeout(260);
  ok('Space on a chip sets it and keeps the chip focused',
     await pressed('#qcard [data-conf="fairly"]') === 'true' && await act() === 'BUTTON', 'focus on ' + await act());
  await p.keyboard.press('Space'); await p.waitForTimeout(260);
  ok('a second Space does not page the document away', await p.evaluate(() => scrollY) === sy0,
     'scrollY ' + sy0 + ' -> ' + await p.evaluate(() => scrollY));

  /* ── Learn, the cloze exception ───────────────────────────────────────── */
  // Five curriculum items are type-the-answer. drawItem focuses #clozein for
  // those, and the chip handler must NOT take that focus back, or a learner who
  // states their confidence and starts typing loses every keystroke. The default
  // session never serves a cloze item, so reach one deliberately:
  // Learn > Core > 'SDE vs EBITDA' > Test me on this, whose second item is cloze.
  await tap('#endsession'); await p.waitForTimeout(350);
  await tap('#tracklist button:nth-child(1)'); await p.waitForTimeout(320);
  await tap('#lessonlist button:nth-child(1)'); await p.waitForTimeout(320);
  await tap('#quizthis'); await p.waitForTimeout(420);
  await tap('#qcard .choice'); await p.waitForTimeout(360);        // item 1 is multiple choice
  await tap('#qcard .grades button'); await p.waitForTimeout(420); // grading advances to the cloze
  ok('the SDE lesson serves a cloze item second', await has('#clozein'), 'no #clozein');
  ok('a fresh cloze draw focuses its field', await act() === 'INPUT#clozein', 'focus on ' + await act());
  await press(await at('#qcard [data-conf="certain"]'));
  ok('one gesture sets the cloze confidence chip', await pressed('#qcard [data-conf="certain"]') === 'true');
  ok('a chip press leaves focus in the cloze field', await act() === 'INPUT#clozein', 'focus on ' + await act());
  await p.keyboard.type('ial');
  ok('typing after a chip press still reaches the cloze field',
     await p.evaluate(() => { const e = document.querySelector('#clozein'); return e && e.value === 'ial'; }),
     'value ' + JSON.stringify(await p.evaluate(() => { const e = document.querySelector('#clozein'); return e && e.value; })));

  ok('no runtime errors', errs.length === 0, errs[0]);
  await ctx.close();
}
await b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PRESS TESTS PASS');
process.exit(fails ? 1 : 0);
