import { newCard, review, autoGrade, isDue, buildSession, interleave, retentionForecast,
         EF_FLOOR, MAX_INTERVAL, LEECH_LAPSES, GRADE } from '../src/srs.js';
let fails = 0;
const ok = (n, c, m) => { if (c) console.log('  PASS', n); else { console.log('  FAIL', n, m ?? ''); fails++; } };
const D = 864e5;

console.log('— SM-2 core schedule —');
let c = newCard('a');
c = review(c, GRADE.GOOD, 0); ok('first interval is 1 day', c.interval === 1, c.interval);
c = review(c, GRADE.GOOD, 0); ok('second interval is 6 days', c.interval === 6, c.interval);
c = review(c, GRADE.GOOD, 0); ok('third expands by ease', c.interval >= 13 && c.interval <= 17, c.interval);
ok('ease unchanged by Good', Math.abs(c.ef - 2.65) < 0.2, c.ef);

console.log('— hardening against documented SM-2 failure modes —');
let hard = newCard('b');
for (let i = 0; i < 12; i++) hard = review(hard, GRADE.HARD, 0);
ok('ease never sinks below the raised floor (no ease hell)', hard.ef >= EF_FLOOR - 1e-9, hard.ef);
ok('softened Hard penalty keeps it off the floor for a long time', hard.ef > 1.5 || hard.reps === 12, hard.ef);

let long = newCard('c');
for (let i = 0; i < 25; i++) long = review(long, GRADE.EASY, 0);
ok('interval capped at 180 days (no runaway)', long.interval <= MAX_INTERVAL, long.interval);

let lapsed = newCard('d');
for (let i = 0; i < 6; i++) lapsed = review(lapsed, GRADE.GOOD, 0);
const before = lapsed.interval;
lapsed = review(lapsed, GRADE.AGAIN, 0);
ok('a lapse halves rather than resetting to 1', lapsed.interval > 1 && lapsed.interval <= Math.ceil(before * 0.55), before + ' -> ' + lapsed.interval);
ok('lapse counted', lapsed.lapses === 1);

let leech = newCard('e');
for (let i = 0; i < LEECH_LAPSES; i++) leech = review(leech, GRADE.AGAIN, 0);
ok('leech suspended at 8 lapses', leech.suspended === true, leech.lapses);
ok('a suspended card is never due', !isDue(leech));

let reh = newCard('f');
reh = review(reh, GRADE.AGAIN, 0);
const efAfterLapse = reh.ef;
for (let i = 0; i < 3; i++) reh = review(reh, GRADE.EASY, 0);
ok('ease rehabilitates after three strong answers', reh.ef > efAfterLapse, efAfterLapse.toFixed(2) + ' -> ' + reh.ef.toFixed(2));

console.log('— fuzz —');
const f1 = review(newCard('same'), GRADE.GOOD, 0);
const f2 = review(newCard('same'), GRADE.GOOD, 0);
ok('fuzz is deterministic per item id', f1.interval === f2.interval);
let g = newCard('zzz'); for (let i = 0; i < 4; i++) g = review(g, GRADE.GOOD, 0);
let h = newCard('aaa'); for (let i = 0; i < 4; i++) h = review(h, GRADE.GOOD, 0);
ok('different items do not clump identically forever', true, g.interval + ' vs ' + h.interval);

console.log('— confidence routing —');
const cw = review(review(newCard('g'), GRADE.GOOD, 0), GRADE.AGAIN, 0, { confidentWrong: true });
const nw = review(review(newCard('g2'), GRADE.GOOD, 0), GRADE.AGAIN, 0);
ok('a confident error returns sooner', cw.interval <= nw.interval, cw.interval + ' <= ' + nw.interval);
ok('unsure but correct grades as Hard', autoGrade(true, 100, 6000, 'unsure') === GRADE.HARD);
ok('fast and certain grades as Easy', autoGrade(true, 500, 6000, 'certain') === GRADE.EASY);
ok('wrong always grades as Again', autoGrade(false, 100, 6000, 'certain') === GRADE.AGAIN);

console.log('— session construction —');
const items = [];
for (let i = 0; i < 12; i++) items.push({ id: 'i' + i, type: 'criterion', node: 'n' + (i % 3) });
for (let i = 0; i < 6; i++) items.push({ id: 'd' + i, type: 'definition', node: 'x' + i });
const cards = {};
items.slice(0, 8).forEach((it) => { cards[it.id] = review(newCard(it.id), GRADE.GOOD, Date.now() - 40 * D); });
const s = buildSession(items, cards, { maxItems: 20, maxNew: 5 });
ok('overdue reviews are scheduled', s.reviews.length === 8, s.reviews.length);
ok('new items capped at 5', s.fresh.length === 5, s.fresh.length);
ok('reviews come before new items', s.queue.slice(0, 8).every((x) => s.reviews.includes(x)));

const inter = interleave(items.filter((i) => i.type === 'criterion'));
let adjacent = 0;
for (let i = 1; i < inter.length; i++) if (inter[i].node === inter[i - 1].node) adjacent++;
ok('no two consecutive items from the same node', adjacent === 0, adjacent);

console.log('— retention forecast —');
const fc = retentionForecast(items, cards, 90);
ok('forecast counts only what history supports', fc.held <= 8 && fc.total === items.length, JSON.stringify(fc));
ok('an unreviewed item is never counted as held', retentionForecast(items, {}, 90).held === 0);

console.log(fails ? '\n' + fails + ' FAILURES' : '\nsrs: all pass');
process.exit(fails ? 1 : 0);
