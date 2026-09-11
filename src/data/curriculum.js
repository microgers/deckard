/**
 * The curriculum: one lesson node for every part of the app, plus a retrieval
 * item bank.
 *
 * Design follows the evidence rather than convention:
 *  - Lessons exist to be RETRIEVED, not read. Reading a node never marks it
 *    learned; only recalling it on a later day does.
 *  - Items are typed, because interleaving helps for confusable categories and
 *    HURTS for paired-associate material (Brunmair & Richter 2019, g = -0.39
 *    for vocabulary-like items). Criterion and formula items interleave;
 *    definitions may block.
 *  - Multiple-choice distractors are drawn from ADJACENT criteria, which is
 *    where the discrimination training actually happens. Little et al. (2012)
 *    showed MC with competitive plausible alternatives matches or beats cued
 *    recall, and spreads benefit to related untested material — but only when
 *    every distractor is a mistake a real novice would make.
 */

import { CRIT_A, CRIT_B, ALL_CRIT } from './criteria.js';
import { ALL_FIELDS, OUTPUTS } from './fields.js';
import { DIMS, LADDER } from './questions.js';

export const TRACKS = [
  { id: 'core',     name: 'Core finance',      blurb: 'The vocabulary everything else is written in — SDE, EBITDA, leverage, coverage.' },
  { id: 'operator', name: 'The Operator',      blurb: 'Gate I. The four capacities an SBA personal guarantee actually tests.' },
  { id: 'diamond',  name: 'The Double Diamond',blurb: 'Gate II. All sixteen criteria, what each measures, and how each one kills a deal.' },
  { id: 'model',    name: 'The Deal Model',    blurb: 'Gate III. Every input you can move and every number that moves with it.' }
];

/* ── Authored lessons for concepts that are not a single UI node ──────────── */
const CORE_LESSONS = [
 {id:'core-sde', track:'core', title:'SDE vs EBITDA', short:'The single most expensive mistake at this size',
  body:[
   "Main Street listings quote **SDE** — seller's discretionary earnings. It is profit with one owner's compensation and perks added back, on the theory that a new owner takes those instead of a salary.",
   "**EBITDA** — earnings before interest, tax, depreciation and amortization — does not add back a salary. It is what the business earns after paying someone to run it.",
   "The gap between them is whatever it costs to do the owner's job. If you buy on SDE and then pay yourself or hire a manager, that cost is real and it comes straight out of the earnings you borrowed against.",
   "Worked through: a business with $600k of SDE listed at '3×' is priced at $1.8M. If the job is worth $150k, real EBITDA is $450k — and $1.8M ÷ $450k means you paid **4.0×**, not 3.0×. The debt service was sized on the wrong number."
  ]},
 {id:'core-npv', track:'core', title:'What IRR actually is', short:'The discount rate where NPV hits zero',
  body:[
   "IRR is the annual rate at which your money would have to compound to turn what you put in into what you got back out.",
   "Formally it is the discount rate **r** that solves `NPV(r) = Σ Cₜ ÷ (1+r)ᵗ = 0`. There is no closed-form solution; you find it numerically.",
   "The cash flow series for a buyout is short and specific: year 0 is the equity you wire at closing (negative), years 1 through N are the distributions after debt service and tax, and the final year also carries what is left of the sale price after the lender is repaid.",
   "Two honest caveats. An IRR only becomes the return on your **wealth** if every distribution is redeployed at the same rate — it is a property of the cash flow equation, not a forecast of what you will do with the cash. And if money ever goes out again mid-hold, the equation can have two valid IRRs, or none."
  ]},
 {id:'core-sources', track:'core', title:'Sources and uses', short:'Where the money comes from and where it goes',
  body:[
   "**Uses** is what you must pay: the purchase price, plus closing costs, plus any working capital you have to fund.",
   "**Sources** is where it comes from: the SBA loan, the seller note, and your equity. Sources must equal uses exactly — if they do not, the deal does not fund.",
   "Your equity is therefore the residual: uses minus everything anyone else is lending you. SBA rules require it to be at least **10% of total project cost** on a change of ownership, of which at most half can be a seller note on full standby. The other 5% has to be genuine cash.",
   "This is why raising the loan percentage is not free money — it raises your return on paper while raising the payment that has to be made in a bad year."
  ]},
 {id:'core-amort', track:'core', title:'How the loan actually repays', short:'Interest and principal are not the same kind of cost',
  body:[
   "A level-payment loan pays the same total each month, but the split moves: early payments are mostly interest, later ones mostly principal. The formula is `PMT = P · i / (1 − (1+i)⁻ⁿ)` with **i** the monthly rate and **n** the number of months.",
   "The distinction matters because **interest is tax-deductible and principal is not.** Two businesses with identical cash flow and identical debt service can owe very different tax.",
   "This is also the mechanism behind the most common accounting surprise in a levered small business: it reports a profit, pays tax on that profit, and still has no cash, because principal repayment never appears on the income statement.",
   "Approximating a year's interest as opening balance × rate overstates it by roughly half a year of amortization. This model runs a true monthly schedule instead."
  ]},
 {id:'core-leverage', track:'core', title:'What leverage does to a return', short:'It amplifies both directions, and only one is in the model',
  body:[
   "Debt raises the return on equity when the business earns more than the debt costs, because a smaller cheque claims the same upside. That is the entire reason an SBA-financed acquisition can show a 60% IRR on a business growing 3% a year.",
   "The value bridge in the model makes this visible: it splits the exit proceeds into earnings growth, multiple change, and debt paydown. When most of the bar is debt paydown, what you have modelled is a financing structure rather than an operating improvement.",
   "The asymmetry is the part models hide. Leverage takes your equity before it touches the bank's. A 15%-equity deal is wiped out by a 15% fall in enterprise value — and the loan payment does not adjust.",
   "So a high modelled IRR is usually a statement about leverage rather than about skill. Read it beside MOIC and DSCR, and always run the downside case."
  ]},
 {id:'core-basrates', track:'core', title:'Base rates', short:'What actually happens to searchers',
  body:[
   "Stanford's search fund studies report a strong **aggregate** return for the asset class, but the distribution is brutal: a substantial share of completed acquisitions lose money outright.",
   "Median time to acquisition runs around 20 months, and a substantial minority of searches never close at all.",
   "Any model that assumes nothing goes wrong — including this one, unless you make it — is not a model of the asset class. It is a model of the good outcome.",
   "The practical discipline: before you believe a base case, run growth at −5%, push the exit multiple a full turn below entry, and add a year to the hold. If it still clears debt service, you have a deal. If it needs growth and expansion to work, you have a hope."
  ]}
];

/* ── Every UI node becomes a lesson, so nothing is left unexplained ───────── */
function criterionLessons() {
  return ALL_CRIT.map((c) => {
    const dia = CRIT_A.includes(c) ? 'Diamond I · the business' : 'Diamond II · the deal';
    return {
      id: 'crit-' + c.k, track: 'diamond', node: c.k, title: c.n,
      short: dia + ' · weight ' + c.w.toFixed(1) + '×' + (c.crit ? ' · critical' : ''),
      body: [
        c.teach,
        '**How it is scored.** ' + c.d,
        '**A 0 looks like:** ' + c.a[0] + '.  **A 5 looks like:** ' + c.a[5] + '.',
        '**How it kills a deal.** ' + c.killer,
        c.crit
          ? '**This one is critical.** A 0 or 1 here is a hard stop, not a low score — the scorecard refuses to average it into a comfortable middle, because these are the failures that most reliably destroy small acquisitions.'
          : '**Weighted ' + c.w.toFixed(1) + '×.** It moves the composite proportionally, but a low score here is an argument, not a verdict.'
      ],
      anchors: c.a
    };
  });
}
function fieldLessons() {
  return ALL_FIELDS.map((f) => ({
    id: 'field-' + f.k, track: 'model', node: f.k, title: f.n,
    short: 'Model input · ' + (f.u === '$' ? 'dollars' : f.u === '%' ? 'percent' : f.u === '×' ? 'multiple' : 'years'),
    body: [f.teach]
  }));
}
function outputLessons() {
  return OUTPUTS.map((o) => ({
    id: 'out-' + o.k, track: 'model', node: o.k, title: o.n,
    short: 'Model output', body: [o.teach]
  }));
}
function operatorLessons() {
  const l = [{
    id: 'op-ladder', track: 'operator', node: 'ladder', title: 'The ownership ladder',
    short: 'Four rungs, and who carries the downside',
    body: ['“I want to buy a business” describes an outcome. It does not describe a job. There are four rungs, and they differ less in income than in **who carries the downside**.']
      .concat(LADDER.map((r) => '**' + r.n + '.** ' + r.d))
      .concat(['The last rung is the one the financing forces. An SBA 7(a) acquisition loan requires a personal guarantee from anyone owning 20% or more, and the lender expects the buyer to run the business.'])
  }];
  return l.concat(DIMS.map((d) => ({
    id: 'op-' + d.k, track: 'operator', node: d.k, title: d.n,
    short: 'Capacity · scored by three statements', body: [d.teach]
  })));
}

export const LESSONS = [].concat(
  CORE_LESSONS, operatorLessons(), criterionLessons(), fieldLessons(), outputLessons()
);

export function lessonsByTrack(track) { return LESSONS.filter((l) => l.track === track); }
export function lessonById(id) { return LESSONS.find((l) => l.id === id); }

/* ═══════════════════════════════════════════════════════════════════════════
   ITEM BANK
   type:   'criterion' | 'formula' | 'definition' | 'concept'
           criterion + formula interleave; definition may block.
   format: 'mc'   — four options, every distractor a real novice mistake
           'cloze'— type the missing term
   node:   the lesson this item retrieves, so the session never runs two
           consecutive items from the same node.
   ═════════════════════════════════════════════════════════════════════════ */

/** Deterministic shuffle. Stable across sessions so an item does not reshuffle
 *  under the learner, but genuinely varied across items — a correct answer that
 *  always lands in the same slot is a positional tell, and a learner can score
 *  on it without knowing anything. */
function shuffleStable(arr, seed) {
  const a = arr.slice();
  // FNV-1a, then xorshift — a 31-hash over short seeds produces near-identical
  // permutations, which is exactly the bug this replaced.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const next = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Scenario → which criterion is at issue. Distractors come from adjacent
 *  criteria in the same diamond, which is exactly where learners confuse them. */
function criterionScenarioItems() {
  return ALL_CRIT.map((c) => {
    const pool = (CRIT_A.includes(c) ? CRIT_A : CRIT_B).filter((x) => x.k !== c.k);
    const distract = shuffleStable(pool, c.k).slice(0, 3).map((x) => x.n);
    const options = shuffleStable([c.n].concat(distract), c.k + 'opt');
    return {
      id: 'sc-' + c.k, type: 'criterion', node: c.k, lesson: 'crit-' + c.k, format: 'mc',
      q: c.scenario + '\n\nWhich criterion does this describe?',
      options, answer: options.indexOf(c.n),
      why: c.n + ' — ' + c.d + ' Weighted ' + c.w.toFixed(1) + '×' + (c.crit ? ', and critical: a 0 or 1 is a hard stop.' : '.')
    };
  });
}

/** Which criteria are hard stops. These are the five that most reliably
 *  destroy a deal, so knowing them cold is worth its own retrieval. */
function criticalItems() {
  const crits = ALL_CRIT.filter((c) => c.crit);
  const nonCrits = ALL_CRIT.filter((c) => !c.crit);
  return crits.map((c, i) => {
    const distract = shuffleStable(nonCrits, c.k + 'hs').slice(0, 3).map((x) => x.n);
    const options = shuffleStable([c.n].concat(distract), c.k + 'hsopt');
    return {
      id: 'hs-' + c.k, type: 'criterion', node: c.k, lesson: 'crit-' + c.k, format: 'mc',
      q: 'Which of these is a **critical** criterion, where a score of 0 or 1 is a hard stop rather than a low score?',
      options, answer: options.indexOf(c.n),
      why: 'The five critical criteria are customer fragmentation, management depth, owner independence, financeability, and quality of earnings. They are not averageable: a business whose earnings cannot be proven is not a cheaper version of a good deal. Note that price is deliberately NOT critical — it is the most negotiable item on the board.'
    };
  });
}

const AUTHORED = [
 /* ── core finance ─────────────────────────────────────────────────────── */
 {id:'a-sde1', type:'concept', node:'sde', lesson:'core-sde', format:'mc',
  q:'A business lists at 3.0× its $600,000 SDE, so $1,800,000. A general manager for the owner\'s role costs $150,000. What multiple of EBITDA are you actually paying?',
  options:['4.0×','3.0×','3.3×','2.4×'], answer:0,
  why:'Real EBITDA is $600k − $150k = $450k. $1,800,000 ÷ $450,000 = 4.0×. The listing price does not change — what changes is what you are getting for it. This is the most expensive arithmetic error at Main Street size.'},
 {id:'a-sde2', type:'definition', node:'sde', lesson:'core-sde', format:'cloze',
  q:'SDE stands for seller\'s discretionary ______.', answers:['earnings','earning'],
  why:'Seller\'s discretionary earnings — profit with one owner\'s compensation and perks added back. EBITDA does not add back a salary, which is the whole difference.'},
 {id:'a-irr1', type:'definition', node:'irr', lesson:'core-npv', format:'mc',
  q:'IRR is defined as the discount rate at which…',
  options:['net present value equals zero','cash flows equal the purchase price','the loan is fully repaid','MOIC equals 1.0×'], answer:0,
  why:'IRR solves NPV(r) = Σ Cₜ ÷ (1+r)ᵗ = 0. Everything else on the list is a real thing, just not this one — repaying the loan is a DSCR question, and MOIC = 1.0× means you merely got your money back.'},
 {id:'a-irr2', type:'concept', node:'irr', lesson:'core-npv', format:'mc',
  q:'A deal returns 2.0× in 18 months. Another returns 4.0× in 10 years. Which statement is right?',
  options:['The first wins on IRR, the second wins on MOIC','The first wins on both','The second wins on both','They are equivalent'], answer:0,
  why:'IRR rewards speed and MOIC ignores time entirely. 2.0× in 18 months is roughly a 59% IRR; 4.0× over 10 years is roughly 15%. But you end up with twice as much money in the second. This is exactly why the two are read together and neither is read alone.'},
 {id:'a-irr3', type:'concept', node:'irr', lesson:'core-npv', format:'mc',
  q:'Your equity cash flows are [−1000, +3000, −2500]. What does the model report?',
  options:['No IRR exists — there is no real solution','Two IRRs','One IRR near 20%','An error in the inputs'], answer:0,
  why:'Two sign changes mean up to two roots, but here the discriminant is negative, so there is no real solution at all. Sign changes are necessary but not sufficient. A spreadsheet returns #NUM! or a wrong root without explaining why; the model says so.'},
 {id:'a-reinvest', type:'concept', node:'irr', lesson:'core-npv', format:'mc',
  q:'What is the honest caveat about a modelled 60% IRR?',
  options:['It only becomes your realised return if every distribution is redeployed at 60%','It is mathematically impossible','It means the business grows 60% a year','It guarantees the lender is repaid'], answer:0,
  why:'IRR is a property of the cash flow equation, not a forecast of what you will do with the cash. A high figure is usually telling you about leverage rather than about skill — which is why you read it beside MOIC and the value bridge.'},
 {id:'a-dscr1', type:'formula', node:'dscr', lesson:'out-dscr', format:'cloze',
  q:'DSCR = earnings ÷ ______ ______  (two words, what the loan costs each year)', answers:['debt service','debt payments','annual debt service'],
  why:'Debt service — interest plus principal. Below 1.25× most SBA lenders decline; below 1.0× the business cannot pay its own loan out of its own earnings.'},
 {id:'a-dscr2', type:'concept', node:'dscr', lesson:'out-dscr', format:'mc',
  q:'A deal shows DSCR of 1.10×. What does that mean in practice?',
  options:['Earnings cover the loan but with almost no margin, and most SBA lenders would decline','The loan cannot be repaid at all','The lender is fully protected','The business is 10% more profitable than last year'], answer:0,
  why:'1.10× means earnings exceed debt service by 10% — real but thin. The SBA underwriting threshold is 1.25×. Below 1.0× the business genuinely cannot pay its own loan. And note DSCR is struck before you pay yourself anything.'},
 {id:'a-interest', type:'concept', node:'taxRate', lesson:'core-amort', format:'mc',
  q:'Why does a levered small business often report a profit and still have no cash?',
  options:['Principal repayment is not deductible and never appears on the income statement','Interest is not deductible','Depreciation consumes cash','Revenue is recognised late'], answer:0,
  why:'Interest is deductible and shows up as an expense. Principal is neither — it leaves the bank account without ever reducing taxable income. So you pay tax on a profit you did not keep.'},
 {id:'a-moic', type:'definition', node:'moic', lesson:'out-moic', format:'mc',
  q:'MOIC stands for…',
  options:['Multiple on invested capital','Margin on invested cash','Multiple of internal capital','Measure of implied coverage'], answer:0,
  why:'Total cash back ÷ cash in. It ignores time entirely, which is precisely the dimension IRR over-weights.'},
 {id:'a-lever', type:'concept', node:'bridge', lesson:'core-leverage', format:'mc',
  q:'The value bridge shows 71% of exit value came from debt paydown. What does that tell you?',
  options:['The return is mostly a financing structure, and leverage takes your equity first in a bad year','The business grew 71%','The lender earned most of the return','The exit multiple expanded'], answer:0,
  why:'Debt paydown means the business repaid the loan from its own cash flow — the balance sheet, not the operation. It works, right up until a bad year, when the same leverage takes your equity before it touches the bank\'s.'},
 {id:'a-baserate', type:'concept', node:'basrates', lesson:'core-basrates', format:'mc',
  q:'Roughly how long does the median search take before an acquisition closes?',
  options:['About 20 months','About 3 months','About 5 years','It closes within weeks for most searchers'], answer:0,
  why:'Stanford\'s search fund studies put median time to acquisition at roughly 20 months, and a substantial minority of searches never close at all. This is why staying power is one of the four capacities in Gate I.'},

 /* ── sources, uses, and the capital stack ─────────────────────────────── */
 {id:'a-equity1', type:'formula', node:'equity', lesson:'core-sources', format:'mc',
  q:'Purchase price $4.8M, closing costs $200k, SBA loan $3.6M, seller note $480k. What is your equity cheque?',
  options:['$920,000','$720,000','$1,120,000','$680,000'], answer:0,
  why:'Uses = $4.8M + $200k = $5.0M. Sources must equal uses, so equity = $5.0M − $3.6M − $480k = $920k. Closing costs are a use — they raise the cheque you write without buying you any of the business.'},
 {id:'a-inject', type:'definition', node:'sbaPct', lesson:'core-sources', format:'mc',
  q:'What is the minimum SBA equity injection on a change of ownership?',
  options:['10% of total project cost','5% of the purchase price','20% of total project cost','There is no minimum'], answer:0,
  why:'10% of total project cost. At most half of that can be a seller note on full standby — the other 5% has to be genuine cash from the buyer.'},
 {id:'a-standby', type:'definition', node:'sellerStandby', lesson:'field-sellerStandby', format:'mc',
  q:'A seller note on "full standby" means…',
  options:['No principal and no interest is paid while the bank loan is being repaid','Interest only, no principal','The seller can call the note at any time','The note is forgiven if the business underperforms'], answer:0,
  why:'Nothing is paid at all; interest accrues onto the balance instead. Full standby is what lets a seller note count toward the SBA equity injection, and it must run for the life of the SBA loan to qualify.'},
 {id:'a-sbacap', type:'definition', node:'sbaPct', lesson:'field-sbaPct', format:'cloze',
  q:'The maximum SBA 7(a) loan size is $______ million.', answers:['5','5.0','five'],
  why:'$5,000,000. Above that you need a second lender or a larger equity cheque — which is a real ceiling on how big a business a single SBA-financed buyer can acquire.'},
 {id:'a-sbaterm', type:'definition', node:'sbaTerm', lesson:'field-sbaTerm', format:'mc',
  q:'What is the maximum amortization for an SBA loan against business goodwill?',
  options:['10 years','25 years','7 years','15 years'], answer:0,
  why:'Ten years, unless real estate is included, in which case it can run to 25. A ten-year SBA loan also carries no prepayment penalty.'},
 {id:'a-sbarate', type:'definition', node:'sbaRate', lesson:'field-sbaRate', format:'mc',
  q:'SBA 7(a) variable rates on loans over $350,000 are capped at…',
  options:['Prime + 3.00%','Prime + 6.00%','a flat 9.75%','Prime + 1.00%'], answer:0,
  why:'Prime + 3.00%, resetting quarterly. Acquisition paper typically prices at Prime + 2.50–3.00%. The model holds it fixed, which understates your real risk — run it a point higher as a stress case.'},
 {id:'a-197', type:'definition', node:'da', lesson:'field-da', format:'cloze',
  q:'In an asset purchase, goodwill amortizes over ______ years under IRC §197.', answers:['15','fifteen'],
  why:'Fifteen years. On an all-goodwill deal that is roughly the purchase price ÷ 15 of tax shield every year — a real and frequently forgotten benefit of structuring as an asset purchase.'},

 /* ── model behaviour ──────────────────────────────────────────────────── */
 {id:'a-exit1', type:'concept', node:'exitMultiple', lesson:'field-exitMultiple', format:'mc',
  q:'What is the honest default for the exit multiple?',
  options:['Equal to the entry multiple','Half a turn above entry','Whatever the broker quotes','The highest comparable transaction'], answer:0,
  why:'Any expansion you assume is a bet on the future buyer pool rather than on anything you did. Setting exit equal to entry keeps the return attributable to growth and debt paydown, which are the parts you control.'},
 {id:'a-exit2', type:'concept', node:'sens', lesson:'out-sens', format:'mc',
  q:'In most small-cap holds, which has the larger effect on IRR?',
  options:['Half a turn on the exit multiple','A year of margin improvement','A 1% change in the loan rate','Closing costs'], answer:0,
  why:'Half a turn typically outweighs a year of hard operating work — which is what makes the exit assumption the riskiest line in the model and the one you have least control over. That asymmetry is the whole point of the sensitivity grid.'},
 {id:'a-growth', type:'concept', node:'growth', lesson:'field-growth', format:'mc',
  q:'What does an honest downside case look like in this model?',
  options:['Negative growth, exit multiple a full turn below entry, and a longer hold','Growth reduced from 5% to 3%','A slightly higher loan rate','Removing closing costs'], answer:0,
  why:'A lost customer or a bad hire shows up as negative growth, not as slightly-less-growth. If the deal still clears its debt service under that, you have a deal. If it needs growth and expansion to work, you have a hope.'},
 {id:'a-nwc', type:'concept', node:'nwcPct', lesson:'field-nwcPct', format:'mc',
  q:'Why does growth consume cash in this model?',
  options:['Receivables and inventory build before customers pay','Tax is charged on growth','Depreciation rises with revenue','The loan rate increases'], answer:0,
  why:'Working capital is funded ahead of collection. It is why a fast-growing small business can be profitable and short of cash at the same time — and why the model draws a share of each year\'s earnings increase away before it reaches you.'},
 {id:'a-capex', type:'concept', node:'capexPct', lesson:'field-capexPct', format:'mc',
  q:'Which capex situation is genuinely dangerous, rather than merely heavy?',
  options:['Deferred — the seller stopped replacing equipment before listing','Heavy but on a documented replacement schedule','Moderate and financeable','Light and predictable'], answer:0,
  why:'Heavy capex is survivable when it is predictable and the assets can be financed or resold. Deferred capex is a cost the seller quietly moved onto your first-year cash flow, and it does not appear anywhere in the historical earnings you paid a multiple for.'},
 {id:'a-coc', type:'concept', node:'coc', lesson:'out-coc', format:'mc',
  q:'What question does year-1 cash yield answer that IRR does not?',
  options:['What does this pay me while I own it','Is the lender repaid','How fast does the business grow','What will a future buyer pay'], answer:0,
  why:'A deal can carry a spectacular IRR driven entirely by the exit and pay you nothing for five years. Cash yield is first-year distribution ÷ equity invested — the number that determines whether you can live on it.'},
 {id:'a-price', type:'concept', node:'price', lesson:'out-price', format:'mc',
  q:'A model shows equity IRR above 1000% and the page refuses to report a number. What has almost certainly happened?',
  options:['The financing assumptions drove the equity cheque near zero','The business is extraordinarily profitable','The solver has a bug','The hold period is too long'], answer:0,
  why:'An enormous IRR on a trivial amount of capital is a rounding artefact, not an opportunity. Look at MOIC and at the dollars. In reality a lender would never allow the injection to go that low.'},

 /* ── operator ─────────────────────────────────────────────────────────── */
 {id:'a-guarantee', type:'definition', node:'control', lesson:'op-ladder', format:'mc',
  q:'Who must personally guarantee an SBA 7(a) acquisition loan?',
  options:['Anyone owning 20% or more','Only the majority owner','Nobody — the SBA guarantee covers it','Only if the loan exceeds $2M'], answer:0,
  why:'Anyone at 20% or more, and the lender expects the buyer to run the business. There is no version of an SBA-financed acquisition where you hold the upside and someone else carries the downside — which is exactly what Gate I is testing.'},
 {id:'a-rungs', type:'concept', node:'ladder', lesson:'op-ladder', format:'mc',
  q:'What most distinguishes an "equity employee" from a "business owner"?',
  options:['The owner has capital at risk and controls the cash flow','The owner earns more','The employee has no upside','The owner works more hours'], answer:0,
  why:'An equity employee has real upside — options, phantom equity, a profit interest — but no control and no personal liability. It is the most common place to stall, and it is a legitimate destination rather than a failure.'},
 {id:'a-dims', type:'concept', node:'downside', lesson:'op-downside', format:'mc',
  q:'Which of the four capacities usually responds fastest to deliberate effort?',
  options:['Downside capacity','Control appetite','Operator temperament','Staying power'], answer:0,
  why:'Runway is buildable in a way temperament largely is not — and it is also the capacity least safe to ignore, because it decides what you are willing to do in a bad quarter.'},

 /* ── scorecard mechanics ──────────────────────────────────────────────── */
 {id:'a-pass', type:'definition', node:'dd-pass', lesson:'crit-frag', format:'cloze',
  q:'Each diamond clears at ______ out of 100, and both must clear.', answers:['70','seventy'],
  why:'70. A great business on impossible terms is not a deal, and a cheap deal on a dying business is not a deal either — which is why the verdict reads each diamond separately rather than averaging them.'},
 {id:'a-weights', type:'concept', node:'dd-weight', lesson:'crit-finance', format:'mc',
  q:'Which two criteria carry the maximum 1.5× weight?',
  options:['Customer fragmentation and financeability','Price and quality of earnings','Management depth and owner independence','Seller motivation and transition plan'], answer:0,
  why:'They are the two things that most reliably kill small acquisitions. Concentration is how the business goes to zero; financeability is binary, external, and answered by someone other than you — if it is no, nothing else matters.'},
 {id:'a-restructure', type:'concept', node:'dd-verdict', lesson:'crit-price', format:'mc',
  q:'Diamond I scores 78 and Diamond II scores 61. What is the verdict?',
  options:['Restructure the deal — the asset is real, so the work is negotiation','Pass','Pursue immediately','Hard stop'], answer:0,
  why:'A good business on terms that are not there yet is the most workable position in a search. Push on seller financing, price and transition before you walk. The reverse — good terms on a weak business — is the one to be suspicious of.'},
 {id:'a-seduced', type:'concept', node:'dd-verdict2', lesson:'crit-frag', format:'mc',
  q:'Diamond I scores 58 and Diamond II scores 81. What is the risk?',
  options:['Attractive terms on a business with structural problems — cheap money increases what you lose','Nothing, the terms carry it','The lender will decline','The price is too high'], answer:0,
  why:'Cheap money does not fix customer concentration or shrinking demand; it increases what you lose. The price is low because the price should be low.'}
];

export const ITEMS = [].concat(criterionScenarioItems(), criticalItems(), AUTHORED);

export function itemsForLesson(id) { return ITEMS.filter((i) => i.lesson === id); }
export function itemsForTrack(track) {
  const ids = new Set(lessonsByTrack(track).map((l) => l.id));
  return ITEMS.filter((i) => ids.has(i.lesson));
}
