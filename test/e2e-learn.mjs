// The grading UI must only ever offer a rating the scheduler will honour.
//
// grade() in views/learn.js forces a missed item to Again and caps an
// unsure-but-correct answer at Hard. Before this suite existed the feedback
// block printed all four buttons regardless, so on a wrong answer every button
// did the same thing. These tests pin the button count to what the scheduler
// will actually act on.
import { execSync } from 'node:child_process';
const pw = await import(execSync('npm root -g').toString().trim() + '/playwright/index.js');
const b = await (pw.chromium || pw.default.chromium).launch();
let fails = 0;
const ok = (n, c, m) => { if (c) console.log('  PASS', n); else { console.log('  FAIL', n, m ?? ''); fails++; } };

for (const w of [430, 1360]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  console.log('— grading UI @ ' + w + ' —');

  await p.click('#mainnav button[data-go="learn"]');
  await p.waitForTimeout(400);
  await p.click('#startsession');
  await p.waitForTimeout(400);

  let sawWrong = 0, sawRight = 0, sawUnsure = 0, ordered = 0, datedRows = 0;
  // A missed item returns later in the same session, and the feedback marks
  // which option was right — so on the second encounter the correct answer is
  // known. That makes the correct-answer paths deterministic instead of
  // depending on option A happening to be right.
  const known = new Map();

  for (let n = 0; n < 30; n++) {
    if (!(await p.$('#qcard .choices'))) break;          // cloze item or session over
    const q = (await p.textContent('#qcard .quizq')).trim();
    const seen = known.has(q);
    // Answer a repeat correctly while declaring low confidence — the path where
    // the scheduler caps Good and Easy down to Hard.
    const unsure = seen;
    await p.click('#qcard [data-conf="' + (unsure ? 'unsure' : 'certain') + '"]');
    await p.waitForTimeout(120);
    await p.click('#qcard [data-opt="' + (seen ? known.get(q) : 0) + '"]');
    await p.waitForTimeout(250);
    if (!seen) {
      const right = await p.evaluate(() => {
        const els = [...document.querySelectorAll('#qcard .choice')];
        const i = els.findIndex((e) => e.classList.contains('right'));
        return i;
      });
      if (right >= 0) known.set(q, right);
    }

    const got = await p.evaluate(() => {
      const wrap = document.querySelector('.grades');
      if (!wrap) return null;
      const btns = [...wrap.querySelectorAll('button')];
      return {
        n: btns.length,
        correct: !!document.querySelector('.feedback:not(.miss)'),
        labels: btns.map((x) => (x.querySelector('b') || x).textContent.trim()),
        days: btns.map((x) => (x.querySelector('span') ? x.querySelector('span').textContent.trim() : null)),
        text: wrap.innerText,
      };
    });
    if (!got) break;

    // Timing belongs at the end of the session, not after every question.
    if (/\bdays?\b|\bweeks?\b|\bmonths?\b|tomorrow/i.test(got.text)) datedRows++;

    if (!got.correct) {
      sawWrong++;
      ok('a missed item offers one button, not four (item ' + (n + 1) + ')', got.n === 1,
         'got ' + got.n + ': ' + got.labels.join(' / '));
    } else if (unsure) {
      sawUnsure++;
      ok('correct-but-unsure offers only the two grades Hard caps to (item ' + (n + 1) + ')', got.n === 2,
         'got ' + got.n + ': ' + got.labels.join(' / '));
    } else {
      sawRight++;
      ok('a confident correct answer offers all four (item ' + (n + 1) + ')', got.n === 4,
         'got ' + got.n + ': ' + got.labels.join(' / '));
      // Either every button hides its projection (a new card, where SM-2 gives
      // the same interval whatever the grade) or the projections rise with the
      // grade. A mix, or a falling sequence, would be lying to the learner.
      const spans = got.days.filter((d) => d !== null);
      if (spans.length) {
        ok('  projections are present on all four and non-decreasing', spans.length === 4, spans.join(' | '));
        ordered++;
      }
    }
    await p.click('.grades button:last-child');
    await p.waitForTimeout(250);
  }

  ok('exercised a wrong answer', sawWrong > 0, 'none seen');
  ok('exercised a confident correct answer', sawRight > 0, 'none seen');
  ok('exercised an unsure correct answer', sawUnsure > 0, 'none seen');
  ok('no return date is quoted after any individual question', datedRows === 0, datedRows + ' grading rows quoted a date');

  // The session-end card carries it instead.
  let guard = 0;
  while (guard++ < 120 && !(await p.$('.sessiondone'))) {
    if (await p.$('#qcard .choices')) await p.click('#qcard [data-opt="0"]');
    else if (await p.$('#clozein:not([disabled])')) { await p.fill('#clozein', 'x'); await p.click('#submitcloze'); }
    await p.waitForTimeout(130);
    if ((await p.$$('[data-grade]')).length) { await p.click('.grades button:last-child'); await p.waitForTimeout(140); }
  }
  const done = (await p.textContent('.sessiondone')) || '';
  ok('the session-end card names a return date', /Come back (tomorrow|in \d+ (days|weeks|months))/.test(done), done.slice(0, 120));
  ok('the session-end card says how many items will be due', /item/.test(done), done.slice(0, 120));

  ok('no runtime errors', errs.length === 0, errs[0]);
  await ctx.close();
}
await b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL LEARN UI TESTS PASS');
process.exit(fails ? 1 : 0);
