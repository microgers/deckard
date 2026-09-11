/**
 * Spaced repetition — hardened SM-2.
 *
 * Why this design (evidence, not taste):
 *  - Practice testing and distributed practice are the only two techniques
 *    Dunlosky et al. (2013) rated HIGH utility out of ten. Everything here
 *    serves those two and nothing else.
 *  - Karpicke & Roediger (2008): items dropped from testing after one correct
 *    recall fell to 33% at one week; items kept in retrieval held ~80%
 *    (d = 4.03). So an item is NEVER retired after a single correct answer.
 *  - Cepeda et al. (2008): the gap/retention-interval ridgeline is asymmetric —
 *    overshooting the optimal gap costs far less than undershooting it. When
 *    uncertain, we round intervals UP.
 *
 * Deviations from textbook SM-2, each fixing a documented failure mode:
 *  - EF floor raised 1.3 -> 1.5, and the q=3 penalty softened -0.14 -> -0.05.
 *    Textbook SM-2 drives ease to the floor after a few lapses ("ease hell"),
 *    where intervals grow 30% per success and the item is reviewed forever.
 *  - +0.15 ease rehabilitation after three consecutive q>=4.
 *  - Lapses use I <- max(1, round(0.5 * I_prev)) instead of resetting to 1 day,
 *    so a 90-day item missed once does not restart from scratch.
 *  - Deterministic +/-5% interval fuzz so items introduced together stop
 *    clumping into review avalanches.
 *  - 180-day interval cap: past that an item effectively leaves a 60-item
 *    module, and the learner returns to a wall.
 *  - Leech suspension at 8 lapses. In a hand-authored bank a leech nearly
 *    always means the ITEM is ambiguous, not that the learner is failing.
 */

export const EF_START = 2.5;
export const EF_FLOOR = 1.5;
export const MAX_INTERVAL = 180;
export const LEECH_LAPSES = 8;

/** Grade scale. q=1 and q=2 are unused: a 6-point self-rating is more load than
 *  adults rate reliably, so the UI exposes four buttons, as Anki does. */
export const GRADE = { AGAIN: 0, HARD: 3, GOOD: 4, EASY: 5 };

export function newCard(id) {
  return { id, n: 0, ef: EF_START, interval: 0, due: 0, lapses: 0,
           streak: 0, reps: 0, suspended: false, lastGrade: null, lastReview: 0 };
}

/** Deterministic per-item fuzz in [-5%, +5%] — stable across sessions. */
function fuzz(id, interval) {
  if (interval < 3) return interval;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const f = ((h >>> 0) % 1001) / 1000; // 0..1
  return Math.max(1, Math.round(interval * (0.95 + f * 0.10)));
}

function efDelta(q) {
  // Textbook: EF += 0.1 - (5-q)*(0.08 + (5-q)*0.02)
  // q=5 -> +0.10, q=4 -> 0.00, q=3 -> -0.14, q=0 -> -0.80
  if (q === 3) return -0.05;           // softened: the main cause of ease hell
  return 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
}

/**
 * Apply one review.
 * @param card  card state (not mutated)
 * @param q     0 | 3 | 4 | 5
 * @param now   epoch ms
 * @param opts  { confidentWrong: boolean } — a high-confidence error is the
 *              hypercorrection case: corrected more reliably, but it partially
 *              returns within a week, so it is scheduled sooner.
 * @returns     new card state
 */
export function review(card, q, now = Date.now(), opts = {}) {
  const c = { ...card };
  c.reps += 1;
  c.lastGrade = q;
  c.lastReview = now;

  if (q >= 3) {
    c.streak += 1;
    if (c.n === 0) c.interval = 1;
    else if (c.n === 1) c.interval = 6;
    else c.interval = Math.round(c.interval * c.ef);
    c.n += 1;
  } else {
    c.lapses += 1;
    c.streak = 0;
    c.n = 0;
    // Halve rather than reset. A long-interval item missed once has not been
    // forgotten the way a brand-new item is unknown.
    c.interval = Math.max(1, Math.round((c.interval || 1) * 0.5));
    if (c.lapses >= LEECH_LAPSES) c.suspended = true;
  }

  c.ef = c.ef + efDelta(q);
  if (c.streak >= 3 && q >= 4) c.ef += 0.15;   // ease rehabilitation
  if (c.ef < EF_FLOOR) c.ef = EF_FLOOR;
  if (c.ef > 3.2) c.ef = 3.2;

  if (opts.confidentWrong) c.interval = Math.max(1, Math.round(c.interval * 0.5));

  c.interval = Math.min(MAX_INTERVAL, fuzz(c.id, c.interval));
  c.due = now + c.interval * 864e5;
  return c;
}

/** Derive a grade when the item was auto-marked, so the learner rates less. */
export function autoGrade(correct, latencyMs, medianMs, confidence) {
  if (!correct) return GRADE.AGAIN;
  if (confidence === 'unsure') return GRADE.HARD;   // fragile correct answers
  if (medianMs && latencyMs < medianMs * 0.5) return GRADE.EASY;
  return GRADE.GOOD;
}

export function isDue(card, now = Date.now()) {
  return !card.suspended && (card.reps === 0 || card.due <= now);
}

/**
 * Build a session: due reviews first (interleaved), then a capped number of new
 * items, then anything relearning. New items never crowd out reviews — that
 * ordering is what stops the review-debt spiral that kills retention apps.
 *
 * Interleaving is enforced only where the evidence supports it. Brunmair &
 * Richter (2019): interleaving helps when between-category similarity is high
 * (g = 0.42 overall, 0.67 for confusable visual categories) and HURTS for
 * paired-associate material (g = -0.39). So criterion-discrimination and
 * formula-application items are interleaved; bare definitions may block.
 */
export function buildSession(items, cards, { now = Date.now(), maxItems = 20, maxNew = 5 } = {}) {
  const card = (id) => cards[id] || newCard(id);
  const seen = (it) => (cards[it.id] && cards[it.id].reps > 0);
  const live = items.filter((it) => !card(it.id).suspended);

  const due = live.filter((it) => seen(it) && isDue(card(it.id), now))
    .sort((a, b) => card(a.id).due - card(b.id).due);
  const fresh = live.filter((it) => !seen(it)).slice(0, maxNew);

  const reviews = interleave(due).slice(0, Math.max(0, maxItems - fresh.length));
  return { reviews, fresh, queue: reviews.concat(fresh) };
}

/** Never two consecutive items from the same node, for item types where
 *  discrimination is the thing being learned. */
export function interleave(list) {
  const INTERLEAVED = new Set(['criterion', 'formula']);
  const out = [];
  const pool = list.slice();
  let lastNode = null;
  while (pool.length) {
    let idx = pool.findIndex((it) => !INTERLEAVED.has(it.type) || it.node !== lastNode);
    if (idx < 0) idx = 0;
    const [pick] = pool.splice(idx, 1);
    out.push(pick);
    lastNode = pick.node;
  }
  return out;
}

/**
 * Projected retention at a horizon. Shown instead of a streak or a percent-
 * complete bar, both of which are fluency signals that reward easy practice.
 * Power-law forgetting: R(t) = (1 + t/S)^-0.5, with stability approximated from
 * the current interval. Deliberately a forecast, not a score.
 */
export function retentionForecast(items, cards, horizonDays = 90) {
  let held = 0;
  for (const it of items) {
    const c = cards[it.id];
    if (!c || c.reps === 0 || c.suspended) continue;
    const S = Math.max(1, c.interval);
    const R = Math.pow(1 + horizonDays / S, -0.5);
    if (R >= 0.5) held += 1;
  }
  return { held, total: items.length, horizonDays };
}
