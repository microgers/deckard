/** Gate I — the operator assessment. About you, not about a company. */

export const DIMS = [
 {k:"control",n:"Control appetite",
  teach:"Whether you need to be the one deciding, and whether accountability energizes or drains you. An SBA acquisition loan requires a personal guarantee from anyone owning 20% or more, and the lender expects the buyer to run the business. There is no version of this where you hold the upside and someone else carries the downside.",
  d:{hi:"You want the decision, and the accountability that comes attached. That's the temperament the guarantee assumes.",
     mid:"You like authority in principle, though these answers don't show whether you have tested it when a decision was irreversible and yours alone.",
     lo:"You prefer a structure where someone else carries the final call. That's a legitimate preference — and it points to an equity-employee path, not an owner-operator one."}},
 {k:"operator",n:"Operator temperament",
  teach:"Willingness to run something that already exists rather than invent something new. Buying a business means inheriting customers, staff and habits, and most days you serve them rather than change them. It is also the capacity buyers most often discover, too late, that they lack.",
  d:{hi:"You'd rather improve something that already works than invent something that might. It is also the capacity buyers most often discover, too late, that they lack.",
     mid:"You're drawn to the ownership, less so to the daily work of an existing business. Spend a week inside one before you commit.",
     lo:"You want to build, not to run. Acquisition will feel like a cage — the business already has customers, staff, and habits, and most days you serve them rather than change them."}},
 {k:"downside",n:"Downside capacity",
  teach:"Runway, dependents, and honest tolerance for a guarantee you cannot walk away from. This is the capacity that most often responds to deliberate effort — and the one least safe to ignore, because it decides what you are willing to do in a bad quarter.",
  d:{hi:"You can absorb a bad outcome without it breaking anything else in your life. That's what lets you make unpopular decisions in year two.",
     mid:"You could survive a failure, but it would hurt in ways that will pull on your judgment during the deal. Fix the runway before the search.",
     lo:"A personal guarantee would put more at risk than you can currently afford to lose. Of the four this one usually responds fastest to deliberate effort — and it is the one least safe to ignore."}},
 {k:"grit",n:"Staying power",
  teach:"Stanford's search fund studies put median time to acquisition at roughly 20 months, and a substantial minority of searches never close at all. The work is long, largely unrewarded in the middle, and gives almost no feedback for months at a time.",
  d:{hi:"You finish long, unrewarded things. A 20-month search with no salary is exactly that kind of thing.",
     mid:"You persist when there's feedback. A search gives almost none for months at a time — build external accountability now.",
     lo:"Long stretches without visible progress wear you down. Consider a self-funded search alongside income, or a smaller, faster first acquisition."}}
];

export const QS = [
 {d:"control",t:"When a decision is irreversible, I want to be the one who makes it."},
 {d:"control",t:"I would rather have full control of a smaller outcome than a minority stake in a larger one."},
 {d:"operator",t:"I would rather improve a business that already has customers than launch something new."},
 {d:"grit",t:"I finish things that stopped being interesting long before they were done."},
 {d:"operator",t:"I could spend a year on scheduling, hiring, collections, and pricing without feeling my talent was wasted."},
 {d:"downside",t:"I could lose the money I put in without changing where my family lives or how they are schooled."},
 {d:"control",t:"Being the person everyone escalates to energizes me more than it drains me."},
 {d:"grit",t:"I can work for months with no external sign that I am on the right track."},
 {d:"operator",t:"I would be content running a business in an unglamorous industry — waste hauling, HVAC, machining, landscaping."},
 {d:"downside",t:"I have, or can raise, the cash for a 10% equity injection on a deal this size."},
 {d:"downside",t:"I have, or can raise, enough to cover my living expenses through a search and the first year of ownership."},
 {d:"grit",t:"When something I wanted falls apart late, I start the next attempt quickly rather than stalling."}
];

export const SCALE = ["Strongly disagree","Disagree","Neither","Agree","Strongly agree"];
export const SAMPLE = [5,4,4,5,3,3,4,4,4,3,2,4];

export const RUNGS = [
 {min:0, name:"Employee — for now",
  p:"On today's answers, the honest read is that you are not yet positioned to be an owner-operator. That is a starting point rather than a verdict: every capacity below is buildable, and the two that move fastest are downside capacity and operator temperament."},
 {min:48, name:"Equity employee",
  p:"You have real ownership instincts but at least one capacity is not yet load-bearing. The highest-return move is to take an operating role with equity in a small business — you get the reps and the upside without signing a guarantee you can't yet carry."},
 {min:64, name:"Business owner",
  p:"You are ready to own an asset. What's less clear is whether you want the operating job that comes attached to a small acquisition. Consider a deal with a strong existing general manager, or a partner who runs while you own."},
 {min:78, name:"Entrepreneurial business owner",
  p:"Your profile matches what an SBA-financed acquisition demands: you want the control, you'll do the operating work, you can carry the downside, and you'll last the search. Go to Gate II and start scoring real targets."}
];

export const LADDER = [
 {n:"Employee", d:"Trades time for wage. No equity, no guarantee, no say in the capital structure. Downside is capped at losing the job."},
 {n:"Equity employee", d:"Wage plus a slice — options, phantom equity, a profit interest. Real upside, still no control and no personal liability. The most common place to stall."},
 {n:"Business owner", d:"Owns the asset. May or may not run it day to day. Capital is at risk and cash flow is theirs to direct, but the operating job can be delegated to a hired CEO."},
 {n:"Entrepreneurial business owner", d:"Owns it, runs it, and changes it. Signs the personal guarantee, makes the payroll decision, absorbs the bad quarter. This is what buying a small business with an SBA loan actually makes you."}
];

export function scoreAssessment(answers) {
  if (Object.keys(answers).length < QS.length) return null;
  const byDim = {}; let tot = 0;
  DIMS.forEach((d) => (byDim[d.k] = 0));
  QS.forEach((q, i) => { byDim[q.d] += answers[i]; tot += answers[i]; });
  const score = Math.round(((tot - 12) / 48) * 100);
  let rung = RUNGS[0];
  RUNGS.forEach((r) => { if (score >= r.min) rung = r; });
  let weakest = null;
  DIMS.forEach((d) => { const p = (byDim[d.k] - 3) / 12; if (!weakest || p < weakest.p) weakest = { d, p }; });
  return { score, byDim, rung, weakest };
}
