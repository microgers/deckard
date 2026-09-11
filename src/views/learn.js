/**
 * Learn — lessons plus a spaced-retrieval quiz.
 *
 * The design is deliberately not a course. Dunlosky et al. (2013) rated only
 * two of ten study techniques HIGH utility: practice testing and distributed
 * practice. Rereading, highlighting and summarizing were rated LOW — and they
 * are exactly what a conventional "lessons then a final quiz" product delivers.
 * So reading never marks a concept learned here; only recalling it on a later
 * day does, and nothing is retired from the queue after one correct answer.
 */
import { $, $$, el, esc, md, pct } from '../ui.js';
import { TRACKS, LESSONS, ITEMS, lessonsByTrack, lessonById, itemsForLesson, itemsForTrack } from '../data/curriculum.js';
import { newCard, review, autoGrade, isDue, buildSession, retentionForecast, GRADE } from '../srs.js';
import { state, saveLocal, queueSrsPush } from '../store.js';
import { openModal } from '../modal.js';

let view = { mode: 'tracks', track: null, lesson: null };
let session = null;

/** Clicking "Learn" in the top nav returns to the overview rather than dropping
 *  you back into whatever lesson or session you left open. */
export function resetLearnView() { session = null; view = { mode: 'tracks', track: null, lesson: null }; }

export function renderLearn() {
  const root = $('#learnroot');
  if (session) return renderSession(root);
  if (view.mode === 'lesson') return renderLesson(root);
  if (view.mode === 'track') return renderTrack(root);
  return renderTracks(root);
}

const card = (id) => state.srs[id] || newCard(id);
function statusOf(item) {
  const c = state.srs[item.id];
  if (!c || c.reps === 0) return 'new';
  return c.interval >= 21 ? 'known' : 'learning';
}
function lessonStatus(lesson) {
  const its = itemsForLesson(lesson.id);
  if (!its.length) return 'new';
  const s = its.map(statusOf);
  if (s.every((x) => x === 'known')) return 'known';
  if (s.some((x) => x !== 'new')) return 'learning';
  return 'new';
}
const STATUS_LABEL = { new: 'Not started', learning: 'Learning', known: 'Holding' };

/* ── overview ──────────────────────────────────────────────────────────── */
function renderTracks(root) {
  const f = retentionForecast(ITEMS, state.srs, 90);
  const due = ITEMS.filter((i) => { const c = state.srs[i.id]; return c && c.reps > 0 && isDue(c); }).length;
  const unseen = ITEMS.filter((i) => !state.srs[i.id] || state.srs[i.id].reps === 0).length;

  root.innerHTML =
    '<div class="card" style="display:flex;gap:26px;flex-wrap:wrap;align-items:center">' +
      '<div style="flex:0 0 auto"><div class="kicker" style="margin-bottom:4px">Projected retention</div>' +
        '<div class="bignum ' + (f.held > f.total * 0.5 ? 'up' : '') + '" style="font-size:54px">' + f.held + '</div>' +
        '<div class="tiny">of ' + f.total + ' concepts, at 90 days</div></div>' +
      '<div style="flex:1 1 280px;min-width:0">' +
        '<p style="color:var(--tx2);font-size:14.5px;line-height:1.6">This is a forecast, not a score. It counts concepts your review history predicts you will still recall in three months &mdash; which is the only number worth optimizing. Percent-complete and streaks measure the opposite thing: they reward easy practice, and easy practice is what feels like learning without being it.</p>' +
        '<div class="btnrow" style="margin-top:16px">' +
          '<button class="btn" id="startsession">' + (due || unseen ? 'Start a session · ' + Math.min(20, due + Math.min(5, unseen)) + ' items' : 'Nothing due — review anyway') + '</button>' +
          '<button class="btn ghost sm" id="showmethod">How this works</button>' +
        '</div>' +
        '<p class="tiny" style="margin-top:10px">' + due + ' due for review &middot; ' + unseen + ' not yet introduced</p>' +
      '</div></div>' +
    '<div class="sectitle">Tracks</div><div class="trackgrid" id="tracklist"></div>' +
    calibrationPanel();

  $('#startsession').onclick = () => startSession();
  $('#showmethod').onclick = showMethod;

  const tl = $('#tracklist');
  TRACKS.forEach((t) => {
    const its = itemsForTrack(t.id);
    const known = its.filter((i) => statusOf(i) === 'known').length;
    const seen = its.filter((i) => statusOf(i) !== 'new').length;
    const b = el('button', 'trackcard');
    b.innerHTML = '<h4>' + t.name + '</h4><p>' + t.blurb + '</p>' +
      '<div class="meter"><div class="bar"><i style="width:' + (its.length ? (known / its.length) * 100 : 0) + '%"></i></div>' +
      '<span>' + known + '/' + its.length + ' holding</span></div>' +
      '<p class="tiny" style="margin-top:6px">' + lessonsByTrack(t.id).length + ' concepts &middot; ' + seen + ' introduced</p>';
    b.onclick = () => { view = { mode: 'track', track: t.id }; renderLearn(); };
    tl.appendChild(b);
  });
}

function calibrationPanel() {
  const log = state.reviewLog.filter((r) => r.confidence);
  if (log.length < 8) return '';
  const rows = [['certain', 'Certain'], ['fairly', 'Fairly sure'], ['unsure', 'Not sure']].map(([k, label]) => {
    const g = log.filter((r) => r.confidence === k);
    const acc = g.length ? g.filter((r) => r.correct).length / g.length : null;
    return '<div><div class="k">' + label + '</div><div class="v">' + (acc == null ? '—' : pct(acc, 0)) +
      '</div><div class="tiny">' + g.length + ' answers</div></div>';
  }).join('');
  return '<div class="sectitle">Your calibration</div>' +
    '<p class="tiny" style="margin:-6px 0 0;max-width:64ch">How often you were right, grouped by how sure you said you were. People are reliably overconfident — in one study, learners whose actual retention ranged from 33% to 80% all predicted about 50%. If "Certain" is well below 100%, that gap is the thing to fix.</p>' +
    '<div class="calib">' + rows + '</div>';
}

function showMethod() {
  openModal('How this works',
    '<div class="lessonbody">' +
    '<p><b>Reading does not count.</b> A concept is only marked as holding once you have recalled it correctly on a later day. Karpicke &amp; Roediger (2008) found that items dropped from testing after one correct recall fell to 33% at one week, while items kept in retrieval held around 80%.</p>' +
    '<p><b>Questions come back on a schedule.</b> Each item has its own interval, expanding when you recall it easily and shortening when you do not. The first review is a day later, the second about a week, then it stretches out.</p>' +
    '<p><b>Similar things are deliberately mixed together.</b> The sixteen scorecard criteria are confusable, and mixing confusable categories is what forces you to notice what distinguishes them. Definitions are not mixed — for paired-associate material, interleaving actually hurts.</p>' +
    '<p><b>Wrong answers are the mechanism, not failure.</b> Difficulty is what produces durable memory. A session where you get 70% right on mixed items is better learning than 95% on blocked ones, which is why there is no accuracy score anywhere in this module.</p>' +
    '<p><b>The distractors are real mistakes.</b> Every wrong option is something a novice actually believes, usually drawn from an adjacent criterion. Working out why each one is wrong is a second retrieval, and it is where most of the benefit comes from.</p>' +
    '</div>');
}

/* ── track & lesson ────────────────────────────────────────────────────── */
function renderTrack(root) {
  const t = TRACKS.find((x) => x.id === view.track);
  root.innerHTML = '<button class="btn ghost sm" id="back">&larr; All tracks</button>' +
    '<div class="sectitle">' + t.name + '</div>' +
    '<p class="tiny" style="margin:-8px 0 4px;max-width:64ch">' + t.blurb + '</p><div id="lessonlist"></div>' +
    '<div class="btnrow"><button class="btn" id="quiztrack">Quiz me on ' + t.name.toLowerCase() + '</button></div>';
  $('#back').onclick = () => { view = { mode: 'tracks' }; renderLearn(); };
  $('#quiztrack').onclick = () => startSession(itemsForTrack(t.id));
  const list = $('#lessonlist');
  lessonsByTrack(t.id).forEach((l) => {
    const st = lessonStatus(l);
    const b = el('button', 'lessonrow');
    b.innerHTML = '<span class="lt"><b>' + esc(l.title) + '</b><span>' + esc(l.short) + '</span></span>' +
      '<span class="st st-' + st + '">' + STATUS_LABEL[st] + '</span>' +
      '<span class="gc"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></span>';
    b.onclick = () => { view = { mode: 'lesson', track: t.id, lesson: l.id }; renderLearn(); };
    list.appendChild(b);
  });
}

function renderLesson(root) {
  const l = lessonById(view.lesson);
  const its = itemsForLesson(l.id);
  root.innerHTML = '<button class="btn ghost sm" id="back">&larr; ' + esc(TRACKS.find((t) => t.id === l.track).name) + '</button>' +
    '<div class="hero" style="margin-top:20px"><div class="kicker"><span class="dotb"></span>' + esc(l.short) + '</div>' +
    '<h1 class="big">' + esc(l.title) + '</h1></div>' +
    '<div class="lessonbody">' + l.body.map((p) => '<p>' + md(p) + '</p>').join('') + '</div>' +
    (l.anchors ? '<div class="sectitle">The 0&ndash;5 scale</div><div class="anchorlist">' +
      l.anchors.map((a, i) => '<div><b>' + i + '</b><span>' + esc(a) + '</span></div>').join('') + '</div>' : '') +
    '<div class="btnrow">' +
      (its.length ? '<button class="btn" id="quizthis">Test me on this (' + its.length + ')</button>' : '') +
      '<button class="btn ghost sm" id="next">Next concept &rarr;</button></div>' +
    (its.length ? '' : '<p class="tiny" style="margin-top:12px">This concept is covered by questions filed under related concepts.</p>');
  $('#back').onclick = () => { view = { mode: 'track', track: l.track }; renderLearn(); };
  if ($('#quizthis')) $('#quizthis').onclick = () => startSession(its);
  $('#next').onclick = () => {
    const all = lessonsByTrack(l.track); const i = all.findIndex((x) => x.id === l.id);
    view.lesson = all[(i + 1) % all.length].id; renderLearn();
  };
}

/* ── quiz session ──────────────────────────────────────────────────────── */
export function startSession(pool) {
  const built = buildSession(pool || ITEMS, state.srs, { maxItems: 20, maxNew: 5 });
  let queue = built.queue;
  if (!queue.length) queue = (pool || ITEMS).slice(0, 12);
  session = { queue, i: 0, answered: 0, relearn: [], relearnCount: {}, startedAt: Date.now(),
               confidence: null, phase: 'ask', chosen: null, correct: null, shown: Date.now() };
  renderLearn();
}
export function inSession() { return !!session; }

function renderSession(root) {
  if (session.i >= session.queue.length) {
    if (session.relearn.length) { session.queue = session.queue.concat(session.relearn); session.relearn = []; }
    else return renderDone(root);
  }
  const item = session.queue[session.i];
  const total = session.queue.length;
  root.innerHTML =
    '<div class="qmeta"><span>' + (session.i + 1) + ' of ' + total + '</span>' +
      '<span class="qbar"><i style="width:' + ((session.i / total) * 100) + '%"></i></span>' +
      '<button id="endsession" style="color:var(--tx3);font-size:12px">End session</button></div>' +
    '<div class="quizcard" id="qcard"></div>';
  $('#endsession').onclick = () => { session = null; renderLearn(); };
  drawItem(item);
}

function drawItem(item) {
  const c = $('#qcard');
  const conf = session.phase === 'ask'
    ? '<div class="confid"><span>Before you answer &mdash; how sure are you?</span>' +
      ['unsure|Not sure', 'fairly|Fairly sure', 'certain|Certain'].map((x) => {
        const [k, l] = x.split('|');
        return '<button data-conf="' + k + '" aria-pressed="' + (session.confidence === k ? 'true' : 'false') + '">' + l + '</button>';
      }).join('') + '</div>'
    : '';
  let body;
  if (item.format === 'cloze') {
    body = '<input class="clozein" id="clozein" placeholder="type your answer" autocomplete="off" ' +
      (session.phase === 'ask' ? '' : 'disabled') + ' value="' + (session.chosen ? esc(session.chosen) : '') + '">' +
      (session.phase === 'ask' ? '<div class="btnrow"><button class="btn sm" id="submitcloze">Check</button></div>' : '');
  } else {
    body = '<div class="choices">' + item.options.map((o, i) => {
      let cls = 'choice';
      if (session.phase !== 'ask') {
        if (i === item.answer) cls += ' right';
        else if (i === session.chosen) cls += ' wrong';
      }
      return '<button class="' + cls + '" data-opt="' + i + '"' + (session.phase !== 'ask' ? ' disabled' : '') + '>' +
        '<span class="key">' + 'ABCD'[i] + '</span><span>' + esc(o) + '</span></button>';
    }).join('') + '</div>';
  }
  c.innerHTML = conf + '<div class="quizq">' + md(item.q) + '</div>' + body +
    (session.phase === 'ask' ? '' : feedbackBlock(item));

  $$('[data-conf]', c).forEach((b) => (b.onclick = () => { session.confidence = b.dataset.conf; drawItem(item); }));
  $$('[data-opt]', c).forEach((b) => (b.onclick = () => answer(item, Number(b.dataset.opt))));
  if ($('#submitcloze')) {
    const go = () => answer(item, $('#clozein').value.trim());
    $('#submitcloze').onclick = go;
    $('#clozein').onkeydown = (e) => { if (e.key === 'Enter') go(); };
    $('#clozein').focus();
  }
  if (session.phase !== 'ask') {
    $$('[data-grade]', c).forEach((b) => (b.onclick = () => grade(item, Number(b.dataset.grade))));
    const lb = $('#tolesson', c);
    if (lb) lb.onclick = () => { session = null; view = { mode: 'lesson', track: lessonById(item.lesson).track, lesson: item.lesson }; renderLearn(); };
  }
}

function feedbackBlock(item) {
  const good = session.correct;
  const confidentWrong = !good && session.confidence === 'certain';
  return '<div class="feedback' + (good ? '' : ' miss') + '">' +
    '<div class="fh"><span>' + (good ? 'Correct' : confidentWrong ? 'Worth a second look' : 'Not quite') + '</span>' +
    '<button id="tolesson" style="color:var(--brand);font-weight:600;font-size:13px">Read the concept &rarr;</button></div>' +
    '<div>' + md(item.why) + '</div>' +
    (confidentWrong ? '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">You were certain and it was wrong. That is the most correctable kind of error — and the most likely to come back, so this one returns later in the session and again sooner than usual.</div>' : '') +
    '</div>' +
    '<div class="grades">' +
      '<button data-grade="0">Again</button><button data-grade="3">Hard</button>' +
      '<button data-grade="4">Good</button><button data-grade="5">Easy</button>' +
    '</div>';
}

function answer(item, value) {
  let correct;
  if (item.format === 'cloze') {
    const norm = String(value).toLowerCase().replace(/[^a-z0-9. ]/g, '').trim();
    correct = item.answers.some((a) => norm === String(a).toLowerCase().trim());
  } else correct = value === item.answer;
  session.chosen = value; session.correct = correct; session.phase = 'feedback';
  drawItem(item);
}

function grade(item, q) {
  const latency = Date.now() - session.shown;
  const confidentWrong = !session.correct && session.confidence === 'certain';
  // The learner's button wins, but a wrong answer can never grade above Again,
  // and an unsure-but-correct answer is capped at Hard — those are the fragile
  // ones that feedback rescues and optimistic scheduling loses.
  let g = q;
  if (!session.correct) g = GRADE.AGAIN;
  else if (session.confidence === 'unsure') g = Math.min(q, GRADE.HARD);
  else g = q || autoGrade(true, latency, 6000, session.confidence);

  state.srs[item.id] = review(state.srs[item.id] || newCard(item.id), g, Date.now(), { confidentWrong });
  state.reviewLog.push({
    item: item.id, node: item.node, type: item.type, grade: g,
    correct: !!session.correct, confidence: session.confidence, latency, at: Date.now()
  });
  if (state.reviewLog.length > 500) state.reviewLog = state.reviewLog.slice(-500);
  saveLocal(); queueSrsPush();

  // End on a success where possible: a missed item comes back later in the same
  // session. Capped at two extra attempts — an item you cannot get today is not
  // learned by grinding it now, it is learned by meeting it again tomorrow, and
  // an uncapped loop would trap a struggling learner in a session with no exit.
  if (!session.correct) {
    const tries = session.relearnCount[item.id] || 0;
    if (tries < 2 && !session.relearn.includes(item)) {
      session.relearn.push(item);
      session.relearnCount[item.id] = tries + 1;
    }
  }
  session.answered += 1;
  session.i += 1; session.phase = 'ask'; session.confidence = null;
  session.chosen = null; session.correct = null; session.shown = Date.now();
  renderLearn();
}

function renderDone(root) {
  const n = session.answered;
  const nextDue = ITEMS.map((i) => state.srs[i.id]).filter((c) => c && c.due)
    .sort((a, b) => a.due - b.due)[0];
  const when = nextDue ? Math.max(1, Math.round((nextDue.due - Date.now()) / 864e5)) : 1;
  const dueThen = ITEMS.filter((i) => { const c = state.srs[i.id]; return c && c.due && c.due <= Date.now() + when * 864e5; }).length;
  const f = retentionForecast(ITEMS, state.srs, 90);
  session = null;
  root.innerHTML = '<div class="card sessiondone">' +
    '<div class="big">Session complete</div>' +
    '<p style="color:var(--tx2);max-width:46ch;margin:0 auto">' + n + ' retrievals. Projected to still hold <b style="color:var(--tx)">' + f.held + ' of ' + f.total + '</b> concepts at 90 days.</p>' +
    '<p class="tiny" style="margin-top:18px">Next session: ' + (when === 1 ? 'tomorrow' : 'in ' + when + ' days') + ' &middot; about ' + Math.max(1, dueThen) + ' items</p>' +
    '<div class="btnrow" style="justify-content:center"><button class="btn ghost sm" id="backtracks">Back to tracks</button></div></div>';
  $('#backtracks').onclick = () => { view = { mode: 'tracks' }; renderLearn(); };
}
