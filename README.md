# Deckard

*Named for the man whose job was deciding what was real.*

A buy-side workbench for buying a small business. Three decision tools and a
curriculum that teaches every part of them.

- **Gate I — Operator Assessment.** Twelve statements across the four capacities
  an SBA personal guarantee actually tests. Places you on the ownership ladder.
- **Gate II — The Double Diamond.** A weighted 16-criterion scorecard. Diamond I
  scores the business, Diamond II scores the deal, each clears at 70, and both
  must clear. Five criteria are hard stops rather than low scores.
- **Gate III — IRR & Deal Model.** Sources and uses, true monthly amortization,
  taxes on EBITDA − D&A − interest, free cash flow to equity, exit. Returns IRR,
  MOIC, the lender's DSCR, year‑1 cash yield, a value bridge and a sensitivity grid.
- **Learn.** 53 concepts — every criterion, every model input, every output —
  each with a lesson and retrieval items on a spaced schedule.
- **Saved companies.** Each target keeps its own scores and model. Sign in with
  Google to sync across devices.

Runs with no backend at all. Add a Firebase project and it gains Google sign‑in
and cross-device sync; without one it stores everything in the browser.

---

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # engine, scheduler and curriculum suites
npm run build     # -> dist/
```

Requires Node `^20.19.0 || >=22.12.0`.

---

## Turning on Google sign-in

Roughly ten minutes. Everything below is free — no billing account is needed.

### 1. Create the project

1. <https://console.firebase.google.com> → **Create a Firebase project**. Google
   Analytics is optional; skip it.
2. On the project overview click the **`</>` (Web)** icon, give the app a
   nickname, and **Register app**. The `firebaseConfig` object it shows you is
   what goes in `.env`. You can always find it again under
   **⚙️ Project settings → General → Your apps → SDK setup and configuration**.

### 2. Enable the Google provider

**Build → Authentication → Get started → Sign-in method → Google → Enable.**
Set a public-facing project name and pick a support email, then Save.

This automatically creates the OAuth client and configures the consent screen —
for a plain sign-in app you never need to open the Google Cloud console.

### 3. Create the database

**Build → Firestore Database → Create database.** Pick a location (permanent)
and choose **production mode**. Test mode leaves your data world-readable for 30
days.

Then publish the rules in this repo:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

`firestore.rules` scopes every document to `users/{uid}` and denies everything
else. Read it before you deploy it — it is the only thing protecting your data.

### 4. Add the config

```bash
cp .env.example .env
# paste the six values from step 1
```

### 5. Authorize your domains

**Authentication → Settings → Authorized domains.** `localhost` is there by
default. Add every host you deploy to — `your-app.vercel.app`,
`your-app.netlify.app`, `username.github.io`, your custom domain.

Missing this produces `auth/unauthorized-domain` on sign-in, which the app
surfaces with that hint.

### Do I need Google's OAuth verification review?

**No** — as long as the app only requests name, email and basic profile, which
is all Firebase Google sign-in asks for. Google's own documentation carves out
exactly this case: users see no warning, they do not need to be listed as test
users, and authorizations do not expire after 7 days. You would only need the
weeks-long verification review if you added sensitive scopes like Drive or Gmail.

You do need to click **Publish app** on the Google Auth Platform → Audience
screen to move out of Testing mode, which otherwise caps you at 100 users.

---

## Is the API key a secret?

**No.** From [Google's own docs](https://firebase.google.com/docs/projects/api-keys):

> API keys restricted to Firebase services do *not* need to be treated as
> secrets, and it's safe to include them in your code or configuration files.

It is a project identifier, not an authorization credential. It is compiled into
the public bundle and anyone can read it in DevTools — including in Google's own
sample apps. What actually protects the data is `firestore.rules`, evaluated
server-side on every request against a cryptographically verified ID token.

The `.env` file is gitignored as good hygiene, not as security.

What *must* never be committed: a Firebase **Admin SDK service account JSON**,
which bypasses all security rules, or an OAuth **client secret**. Neither belongs
anywhere near a frontend.

---

## Deploying

Build command `npm run build`, output directory `dist`, for all of them. Add the
resulting hostname to Firebase authorized domains or sign-in will fail.

| Host | Notes |
|---|---|
| **Vercel** | Auto-detects Vite. Set the `VITE_*` vars under Settings → Environment Variables. `vercel.json` in this repo handles the SPA rewrite. Preview deploys get unique hostnames that will not be authorized — sign-in works on production only unless you add a stable preview domain. |
| **Netlify** | `netlify.toml` is included. Set env vars under Site configuration → Environment variables. |
| **Firebase Hosting** | `firebase.json` is included. `firebase deploy`. Best choice if you ever want redirect-based sign-in, since the app is then same-origin with the auth handler. Env vars must be set locally or in CI — Hosting has no build-time env store. |
| **GitHub Pages** | `.github/workflows/deploy.yml` is included. Set `VITE_BASE_PATH` to `/<repo>/` as a repository variable. Pages serves static files only, so the workflow copies `index.html` to `404.html`. |

Env vars are **inlined at build time**, not read at runtime — changing one
requires a rebuild and redeploy.

---

## How the Learn module works, and why

The learning design is not a matter of taste; it follows the evidence, and in
several places it deliberately does the opposite of what a conventional course
does.

**Only two study techniques earned a HIGH utility rating** in Dunlosky et al.
(2013), the standard review of ten: *practice testing* and *distributed
practice*. Rereading, highlighting, summarization and the keyword mnemonic were
all rated LOW — and four of those five are what a "lessons plus a final quiz"
product delivers by default. So this module is a scheduled retrieval engine with
reading attached, not a course with quizzes bolted on.

**Reading never marks a concept learned.** Karpicke & Roediger (2008) found that
items dropped from testing after one correct recall fell to **33%** at one week,
while items kept in retrieval held around **80%** (d = 4.03). Nothing here is
retired after a single correct answer.

**Similar things are mixed together — but only where that helps.** Brunmair &
Richter's 2019 meta-analysis found interleaving helps when between-category
similarity is high (g = 0.42 overall, 0.67 for confusable visual categories) and
actively *hurts* for paired-associate material (**g = −0.39**). The sixteen
scorecard criteria are highly confusable, so criterion and formula items are
interleaved and never run two in a row from the same concept. Bare definitions
are allowed to block.

**Distractors are sourced from adjacent criteria.** Little, Bjork, Bjork &
Angello (2012) showed multiple choice with *competitive plausible* alternatives
matches or beats cued recall, and spreads benefit to related untested material —
because working out why each wrong option is wrong is itself a retrieval. The
operative variable is distractor quality, not format. The test suite enforces
that every generated distractor comes from the same diamond and that the correct
answer is not always in the same slot.

**Feedback is immediate.** The popular "delayed feedback is better" claim is
substantially a retention-interval artifact (Metcalfe, Kornell & Finn 2009); for
adults the difference is unreliable, and in a self-paced app delayed feedback
means most learners never see it. A confidently-wrong answer gets an expanded
explanation and comes back sooner — the hypercorrection effect is real but
partially decays within a week.

**There is no accuracy score, no streak and no percent-complete.** Those are
fluency signals, and current performance is famously not an index of learning:
in Karpicke & Roediger's study, learners whose actual retention ranged from 33%
to 80% all predicted about 50%. Progress is shown as a **projected retention**
count instead — how many concepts your review history predicts you will still
recall at 90 days.

### The scheduler

Hardened SM-2. Textbook SM-2 is ~40 lines and fully explainable, and these are
the specific modifications, each fixing a documented failure mode:

| Change | Why |
|---|---|
| Ease floor 1.3 → **1.5**, Hard penalty −0.14 → **−0.05** | "Ease hell": a few lapses drive ease to the floor, where intervals grow 30% per success and the item is reviewed forever |
| **+0.15** ease bonus after three consecutive strong answers | Lets an item recover instead of being permanently punished |
| Lapse sets interval to **50%** of the previous, not 1 day | A 90-day item missed once has not been forgotten the way a new item is unknown |
| Deterministic **±5%** interval fuzz | Stops items introduced together clumping into review avalanches forever |
| **180-day** interval cap | Past that an item leaves a 60-item module and you return to a wall |
| Leech suspension at **8 lapses** | In a hand-authored bank a leech nearly always means the *item* is ambiguous |
| In-session relearning, capped at 2 extra attempts | Ends on a success without trapping a struggling learner in an endless session |

Every review is logged in full (`item, node, type, grade, correct, confidence,
latency, timestamp`). That schema is the thing you cannot retrofit: it is what
would let the scheduler be swapped for FSRS later without losing history.

---

## Testing

```bash
npm test              # engine + scheduler + curriculum, pure Node, no browser
node test/serve.mjs . # then node test/e2e.mjs for the browser suite
```

- **`test/engine.test.js`** — ten published IRR vectors including the two-root
  case `[−100, 230, −132]` (returns both 10% and 20%) and the two-sign-changes-
  no-real-root case; the full worked LBO checked line by line against
  independently computed figures; and the guard rails (sources over uses, salary
  above earnings, an unrecoverable deal reporting no IRR rather than a number).
- **`test/srs.test.js`** — the schedule, and each hardening above proven to
  actually fire.
- **`test/curriculum.test.js`** — coverage (every criterion, input, output and
  capacity has a lesson), item integrity, and distractor quality.
- **`test/e2e.mjs`** — the app in a real browser, light and dark, desktop and
  phone widths.

---

## Limits — read before relying on any of it

- No search costs, no owner salary during the hold, no transaction costs at exit.
- No tax on the gain at sale; exit proceeds arrive untaxed, which flatters IRR.
- Fixed interest rate. Real SBA variable loans reset quarterly against Prime.
- No working-capital peg true-up, no earnout, no real estate, no revolver.
- No probability of impairment. The model cannot lose you money unless you tell it to.
- Flat tax rate. Entity choice, state tax and pass-through treatment all matter and none are here.
- SBA rules change; the 50 10 series SOP is revised regularly. Confirm with a lender.
- Rates quoted in the content (Prime at 6.75%) are as of late 2025 and do not update.

**Not investment, legal, or tax advice.** This is a teaching model. Before you
sign anything, get a quality-of-earnings report, a transaction attorney and a
lender's term sheet.

---

## A note on the frameworks

"Double Diamond" names two different things. In design it is the UK Design
Council's model of the innovation process — Discover, Define, Develop, Deliver.
In acquisition entrepreneurship, practitioners use the same diverge/converge
shape as a scorecard for rating targets.

The scorecard here is the acquisition reading, built from criteria that are
standard across buy-side screening. It is an independent implementation of a
common approach, **not** a reproduction of any particular practitioner's
proprietary scorecard. If you are working from a specific published framework,
use its weights rather than these.

## License

MIT — see `LICENSE`.
