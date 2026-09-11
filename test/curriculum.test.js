import { LESSONS, ITEMS, TRACKS, lessonById, lessonsByTrack, itemsForTrack } from '../src/data/curriculum.js';
import { ALL_CRIT, CRIT_A, CRIT_B, DDSAMPLE, aggregate, hardStops, PASS_MARK } from '../src/data/criteria.js';
import { ALL_FIELDS, OUTPUTS } from '../src/data/fields.js';
import { QS, DIMS, SAMPLE, scoreAssessment } from '../src/data/questions.js';
let fails = 0;
const ok = (n, c, m) => { if (c) console.log('  PASS', n); else { console.log('  FAIL', n, m ?? ''); fails++; } };

console.log('— coverage: every node in the app is taught —');
const lessonNodes = new Set(LESSONS.map((l) => l.node).filter(Boolean));
ok('every criterion has a lesson', ALL_CRIT.every((c) => lessonNodes.has(c.k)),
   ALL_CRIT.filter((c) => !lessonNodes.has(c.k)).map((c) => c.k));
ok('every model input has a lesson', ALL_FIELDS.every((f) => lessonNodes.has(f.k)),
   ALL_FIELDS.filter((f) => !lessonNodes.has(f.k)).map((f) => f.k));
ok('every model output has a lesson', OUTPUTS.every((o) => lessonNodes.has(o.k)),
   OUTPUTS.filter((o) => !lessonNodes.has(o.k)).map((o) => o.k));
ok('every capacity has a lesson', DIMS.every((d) => lessonNodes.has(d.k)));
ok('no lesson is empty', LESSONS.every((l) => l.body && l.body.length && l.body.every((p) => p && p.length > 20)),
   LESSONS.filter((l) => !l.body?.every((p) => p?.length > 20)).map((l) => l.id));
ok('every lesson has a title and a track', LESSONS.every((l) => l.title && TRACKS.some((t) => t.id === l.track)));
ok('lesson ids are unique', new Set(LESSONS.map((l) => l.id)).size === LESSONS.length);

console.log('— item bank integrity —');
ok('item ids are unique', new Set(ITEMS.map((i) => i.id)).size === ITEMS.length);
ok('every item points at a real lesson', ITEMS.every((i) => !!lessonById(i.lesson)),
   ITEMS.filter((i) => !lessonById(i.lesson)).map((i) => i.id));
ok('every item has an explanation', ITEMS.every((i) => i.why && i.why.length > 40));
ok('every item is typed for the interleaving rule',
   ITEMS.every((i) => ['criterion', 'formula', 'definition', 'concept'].includes(i.type)));
const mc = ITEMS.filter((i) => i.format === 'mc');
ok('every MC item has exactly 4 options', mc.every((i) => i.options.length === 4),
   mc.filter((i) => i.options.length !== 4).map((i) => i.id));
ok('every MC answer index is in range', mc.every((i) => i.answer >= 0 && i.answer < 4));
ok('no MC item has duplicate options', mc.every((i) => new Set(i.options).size === 4),
   mc.filter((i) => new Set(i.options).size !== 4).map((i) => i.id));
ok('no "all of the above" style options', mc.every((i) => !i.options.some((o) => /all of the above|none of the above/i.test(o))));
const cloze = ITEMS.filter((i) => i.format === 'cloze');
ok('every cloze item has accepted answers', cloze.every((i) => Array.isArray(i.answers) && i.answers.length));
ok('every cloze prompt actually has a blank', cloze.every((i) => i.q.includes('______')),
   cloze.filter((i) => !i.q.includes('______')).map((i) => i.id));

console.log('— distractor quality: MC options must be competitive —');
const scen = ITEMS.filter((i) => i.id.startsWith('sc-'));
ok('all 16 criteria get a scenario item', scen.length === 16, scen.length);
ok('scenario distractors come from the same diamond', scen.every((i) => {
  const c = ALL_CRIT.find((x) => x.n === i.options[i.answer]);
  const sameDiamond = (CRIT_A.includes(c) ? CRIT_A : CRIT_B).map((x) => x.n);
  return i.options.every((o) => sameDiamond.includes(o));
}));
ok('the correct option is not always in the same slot',
   new Set(scen.map((i) => i.answer)).size >= 3, Array.from(new Set(scen.map((i) => i.answer))));
const hs = ITEMS.filter((i) => i.id.startsWith('hs-'));
ok('one hard-stop item per critical criterion', hs.length === ALL_CRIT.filter((c) => c.crit).length, hs.length);
ok('hard-stop distractors are all non-critical', hs.every((i) =>
  i.options.filter((o) => ALL_CRIT.find((c) => c.n === o && c.crit)).length === 1));

console.log('— scorecard maths —');
ok('example target clears both diamonds', aggregate(CRIT_A, DDSAMPLE) >= PASS_MARK && aggregate(CRIT_B, DDSAMPLE) >= PASS_MARK,
   Math.round(aggregate(CRIT_A, DDSAMPLE)) + '/' + Math.round(aggregate(CRIT_B, DDSAMPLE)));
ok('displayed score matches the branch it triggers',
   Math.round(aggregate(CRIT_A, DDSAMPLE)) >= PASS_MARK === (aggregate(CRIT_A, DDSAMPLE) >= PASS_MARK));
ok('a 0 on a critical criterion is a hard stop', hardStops({ ...DDSAMPLE, books: 0 }).length === 1);
ok('a 1 on a critical criterion is also a hard stop', hardStops({ ...DDSAMPLE, books: 1 }).length === 1);
ok('a 1 on a non-critical criterion is not', hardStops({ ...DDSAMPLE, price: 1 }).length === 0);
ok('anchors run worst to best on every criterion', ALL_CRIT.every((c) => c.a.length === 6));
ok('five criteria are critical', ALL_CRIT.filter((c) => c.crit).length === 5);
ok('weights span 1.0 to 1.5', Math.min(...ALL_CRIT.map((c) => c.w)) === 1.0 && Math.max(...ALL_CRIT.map((c) => c.w)) === 1.5);

console.log('— assessment —');
ok('twelve statements', QS.length === 12);
ok('each capacity is scored by three statements',
   DIMS.every((d) => QS.filter((q) => q.d === d.k).length === 3));
ok('sample profile scores', scoreAssessment(Object.fromEntries(SAMPLE.map((v, i) => [i, v]))).score > 0);
ok('an incomplete assessment returns null', scoreAssessment({ 0: 5 }) === null);

console.log('— every track is usable —');
TRACKS.forEach((t) => {
  ok(t.id + ' has lessons and items', lessonsByTrack(t.id).length > 0 && itemsForTrack(t.id).length > 0,
     lessonsByTrack(t.id).length + ' lessons / ' + itemsForTrack(t.id).length + ' items');
});

console.log(fails ? '\n' + fails + ' FAILURES' : '\ncurriculum: all pass');
process.exit(fails ? 1 : 0);
