/**
 * The Double Diamond scorecard.
 *
 * Diamond I scores the BUSINESS — would anyone want to own this, at any price?
 * Diamond II scores the DEAL — can you own this one, on terms that survive a
 * bad year? Each clears at 70 of 100 and both must clear.
 *
 * Every criterion carries:
 *   w       weight, 1.0x to 1.5x
 *   crit    a 0 or 1 here is a hard stop, not a low score
 *   d       the scoring prompt
 *   a       six anchors, 0 (worst) through 5 (best)
 *   teach   what it actually measures and why it is weighted this way
 *   killer  the specific way this one destroys a deal
 *   scenario a short case used for interleaved discrimination practice
 */

export const PASS_MARK = 70;

export const CRIT_A = [
 {k:"frag",n:"Customer fragmentation",w:1.5,crit:true,
  d:"No single customer is load-bearing. Score on the largest customer's share of revenue — and drop a point if the top three together clear half.",
  a:["Top customer is over half of revenue","Top customer 30–50%","Top customer 20–30%","Top customer 10–20%","Top customer 5–10%","No customer above 5%"],
  teach:"Concentration is the most common way a small acquisition goes to zero, which is why it carries the maximum 1.5× weight. One customer at 40% of revenue means the business has one conversation standing between it and insolvency — and that conversation happens with a new owner they never chose. Lenders underwrite it explicitly; buyers routinely discount it away because the historical numbers look fine right up until they don't.",
  killer:"The seller's golf partner runs the biggest account. He retires with the seller, the account leaves in month four, and the loan payment does not change.",
  scenario:"A commercial landscaping firm bills $2.1M a year. One property-management group accounts for $780k of it, on a contract that renews annually and is up for renewal three months after close."},

 {k:"recur",n:"Revenue recurrence",w:1.3,
  d:"How much of next year's revenue is already predictable — contracts, routes, maintenance plans, repeat buyers?",
  a:["Every job won from scratch","Occasional repeat, no pattern","Strong repeat behavior, nothing written","Annual or evergreen agreements, cancellable","Multi-year contracts on much of it","Contracted or route-based, renews automatically"],
  teach:"Recurring revenue is the difference between owning an asset and owning a job that starts at zero every January. It changes what you can borrow against, what a future buyer pays, and how much of your attention goes to selling rather than operating. Note the ladder is about the strength of the commitment, not the warmth of the relationship — a customer who always comes back but has signed nothing is genuinely less valuable than one who has.",
  killer:"Revenue looks stable in the historicals because the same customers happened to return. Nothing obliges them to, and a competitor's price cut proves it.",
  scenario:"A pest-control company serves 1,400 homes. 1,150 of them are on quarterly service plans that auto-renew and bill by card on file."},

 {k:"mgmt",n:"Management depth",w:1.4,crit:true,
  d:"Is there a team that can run the week without the seller — and will they stay after close?",
  a:["Seller is the only manager","One key person, likely to leave","Supervisors exist, untested","Working managers, retention uncertain","Real general manager or ops lead, stays","Full team, committed, incentives in place"],
  teach:"You are buying an operating business, not a spreadsheet, and on day one the person who knew how it worked leaves. Management depth is what stands between you and learning the job while running it. Retention matters as much as existence: a general manager who is excellent and resigns in month two is worth zero. Ask who the team would follow, then ask them directly during diligence.",
  killer:"The ops manager expected to be offered the business herself. She learns about the sale at closing and gives notice the same week.",
  scenario:"A machine shop has a working foreman of eleven years who schedules all jobs, quotes most work and manages eight people. He has agreed in writing to a two-year retention bonus."},

 {k:"owner",n:"Owner independence",w:1.4,crit:true,
  d:"How much of the business lives in the seller's head, hands, and relationships?",
  a:["Seller IS the business — license, relationships, sales","Seller holds the key accounts","Seller does sales and pricing","Seller in the loop on most decisions","Seller mostly strategic","Seller could vanish tomorrow"],
  teach:"This is the criterion buyers most often score generously, because the seller is charming and says the business runs itself. Test it with specifics: who quotes a job, who a customer calls when something goes wrong, whose name is on the license. Owner dependence is distinct from management depth — a business can have capable managers and still route every pricing decision and every key relationship through one person.",
  killer:"The seller's personal license is what makes the work legal. It does not transfer, and the replacement hire takes nine months to find.",
  scenario:"At a specialty contractor, the owner personally prices every bid over $15k using judgment he has never written down, and the three largest general contractors call his cell directly."},

 {k:"margin",n:"Margin durability",w:1.2,
  d:"Have gross margins held through cost inflation, and can the business raise price without losing the customer?",
  a:["Margins collapsing, no pricing power","Eroding year over year","Flat but thin and fragile","Stable, some pricing power","Stable and defended","Expanding, real pricing power"],
  teach:"Margin history is the cheapest available test of whether a business has pricing power, and pricing power is what lets you survive a cost shock you did not forecast. Look at gross margin across at least three years spanning a period of input inflation. A business that absorbed higher wages and materials without raising price is telling you it cannot.",
  killer:"Wages rise 9% in a year. The business has never raised price without losing work, so the entire increase comes out of the earnings you borrowed against.",
  scenario:"A commercial bakery's gross margin ran 41%, 41% and 42% across three years in which flour and labor both rose sharply. It passes an annual increase to customers every January."},

 {k:"capex",n:"Capex intensity",w:1.0,
  d:"Capital expenditure as a share of earnings. Heavy is survivable when it is scheduled, financeable, and buys assets that hold resale value.",
  a:["Heavy, lumpy, and deferred by the seller — you inherit the bill","Heavy and unpredictable","Moderate but poorly tracked","Heavy, scheduled, financeable, assets hold value","Moderate and steady","Light and predictable"],
  teach:"Capex is the earnings that never reach you. It carries the baseline 1.0× weight because heavy capex is survivable — plenty of excellent businesses are equipment-intensive — but only when it is predictable and the assets can be financed or resold. What is not survivable is deferred capex: a seller who stopped replacing trucks two years before listing has quietly moved a cost onto your first-year cash flow.",
  killer:"The fleet looks fine at the walkthrough. Four of nine vehicles need replacing within eighteen months, which the seller knew and you did not ask.",
  scenario:"A septic service runs six pump trucks on a documented ten-year replacement cycle, two vehicles due in the next three years, each financeable at roughly $9k a month."},

 {k:"demand",n:"Demand trajectory",w:1.2,
  d:"Is the underlying need growing, flat, or structurally shrinking? Score the industry here; the company's own trajectory is scored elsewhere.",
  a:["Being replaced by technology or regulation","Declining","Flat, mature","Flat with local growth","Growing steadily","Growing, non-discretionary, non-cyclical"],
  teach:"You are underwriting a five-to-ten year hold, so the question is whether the underlying need still exists at the end of it. Score the industry, not the company — a well-run business in a structurally shrinking category is a well-run business with a countdown. Flat and boring is fine and often ideal; declining is not, because every operating gain you make is spent offsetting the decline.",
  killer:"The service is fine today and quietly obsolete in seven years. You find out when you try to sell and the buyer pool has evaporated.",
  scenario:"A company services and certifies backflow-prevention devices. Testing is mandated annually by municipal code across its territory, and the installed base grows with new construction."},

 {k:"moat",n:"Switching cost or barrier",w:1.1,
  d:"Licenses, permits, route density, integration, certifications, relationships — anything that makes leaving expensive.",
  a:["Pure commodity, price-shopped every time","Low switching cost","Some habit and inconvenience","Meaningful switching friction","Licensed, certified, or embedded","Hard license or genuine local monopoly"],
  teach:"At this size a moat is rarely a brand or a technology — it is usually regulatory, logistical, or procedural. A license that is hard to get, a route dense enough that no competitor can serve it at your cost, a system integrated into the customer's own workflow. The practical test: estimate what it would cost a customer, in money and disruption, to switch away. If the answer is 'a phone call,' the business competes on price forever.",
  killer:"A competitor prices 8% below you for one quarter and takes a third of the book, because there was never anything holding it.",
  scenario:"A medical-waste hauler holds one of four state permits issued in its region, and its trucks pass 40 clinics on a single route that a new entrant would have to run half-empty."}
];

export const CRIT_B = [
 {k:"seller",n:"Seller motivation",w:1.3,
  d:"Why are they selling, and is the reason one that survives a slow close? Retirement and health beat “testing the market”.",
  a:["Testing the market, no real reason","Curious, no timeline","Wants out eventually","Clear reason, flexible timing","Retiring on a timeline","Motivated, deadline-driven, realistic on price"],
  teach:"A deal takes months and gets uncomfortable at least twice. A seller without a real reason to be done will use that discomfort as an exit, and you will have spent the time. Motivation also sets your negotiating room: a seller with a date is a seller who will discuss seller financing and transition. Ask why now, and ask what happens to them if it does not sell.",
  killer:"Four months in, after your legal spend and your quality-of-earnings deposit, the seller decides to 'wait and see what next year looks like.'",
  scenario:"The owner is 67, has scheduled a knee replacement for the spring, and has already told his three managers the business is for sale."},

 {k:"finance",n:"Financeability",w:1.5,crit:true,
  d:"Will a lender fund this? Clean entity, transferable licenses, debt service coverage above 1.25× — earnings comfortably exceeding the loan payments — under the $5M SBA ceiling, no disqualifying industry.",
  a:["Structurally unfinanceable","Serious obstacles","Possible with a stronger buyer and more equity","Bankable with work","Clean, comfortable coverage","Pre-qualified, lender already interested"],
  teach:"Financeability carries the maximum 1.5× weight because it is binary and it is external. Everything else on this scorecard is your judgment; this one is a third party's, and if the answer is no, nothing else matters. Get it answered early — a lender will give you a read on a business in a week, long before you spend on diligence. The usual disqualifiers are an entity that cannot be cleanly transferred, licenses that do not convey, coverage below 1.25×, and industries the SBA excludes.",
  killer:"You negotiate for two months and then discover no lender will fund it. The seller will not carry the whole price, and there was never a deal to have.",
  scenario:"The business is an S-corp with clean reviewed statements, transferable licenses, and $640k of EBITDA against roughly $410k of proposed annual debt service. A local SBA preferred lender has issued a term sheet."},

 {k:"sellerfin",n:"Seller financing",w:1.2,
  d:"Willingness to carry a note — and to subordinate it behind the bank, or place it on full standby (no payments at all while the bank is repaid). Seller paper is cheaper capital and a signal they believe their own numbers.",
  a:["All cash at close, no exceptions","Under 5%, on senior terms","5–9% note, standard terms","10–14% note, subordinated","15%+ note, subordinated","15%+ note on full standby"],
  teach:"A seller note does three things at once: it lowers the cash you must raise, it is usually cheaper than bank debt, and it keeps the seller financially interested in the business surviving the transition. The last is the real point. A seller who will not carry any paper is telling you something about their own confidence in the numbers they just handed you. Under SBA rules a note can count toward part of your required equity injection, but only on full standby.",
  killer:"All-cash at close means the seller's exposure ends at the wire. Every surprise after that is entirely yours.",
  scenario:"The seller has agreed to carry 15% of the price on a note with no principal or interest paid until the bank loan is retired."},

 {k:"price",n:"Price against real earnings",w:1.4,
  d:"Multiple paid on EBITDA after a market-rate owner salary — not on SDE. Score what the price implies, not what the listing says.",
  a:["Above what any lender will fund against these earnings","Above market, seller inflexible","At the top of the range","Fair for the quality","Below comparables, and you know why","Below comparables for a verified reason, with the diligence to prove it"],
  teach:"Price is the most negotiable item on this scorecard, which is why it is weighted heavily but is deliberately NOT a hard stop — an overpriced good business is a negotiation, not a disqualification. Score the multiple on real EBITDA, after subtracting what it would cost to pay someone to do the owner's job. The single most common error at this size is scoring a listing's SDE multiple as though it were an EBITDA multiple.",
  killer:"You pay '3× earnings' on SDE, hire a manager for $150k, and discover you actually paid 4× and the debt service assumes the higher number.",
  scenario:"A business lists at 3.5× its $520k SDE, or $1.82M. A general manager for the role costs $140k, so real EBITDA is $380k and the price is 4.8× EBITDA."},

 {k:"books",n:"Quality of earnings",w:1.4,crit:true,
  d:"Can the earnings be proven? Reviewed statements, tax returns that tie, defensible add-backs (expenses the seller says a new owner wouldn't have), no cash economy.",
  a:["Cash business, no records","Claimed add-backs exceed reported profit","Messy but reconcilable","Clean books, unaudited","Reviewed statements, tax returns tie","Quality-of-earnings report complete, no material findings"],
  teach:"Every other number on this page is computed from earnings. If the earnings are not provable, the whole model is fiction dressed as arithmetic — which is why this is a hard stop rather than a low score. Watch the add-backs specifically: a seller adding back their own salary, their spouse's no-show salary, the truck, the boat, and 'one-time' expenses that recur annually is constructing earnings, not reporting them. Tie every year to a filed tax return.",
  killer:"The add-backs are 60% of stated EBITDA. Half of them are real operating costs a new owner will absolutely have.",
  scenario:"Three years of reviewed financial statements tie to filed returns within 2%, and the add-back schedule is four lines totaling under 8% of EBITDA."},

 {k:"fit",n:"Your fit",w:1.2,
  d:"Skills, licenses, and whether you want to spend the whole hold period inside this business. Score geography separately if it is the only obstacle.",
  a:["Wrong skills and no interest","Right instincts, wrong industry","Learnable, low enthusiasm","Reasonable fit","Strong fit, real interest","Directly relevant experience and genuine enthusiasm"],
  teach:"You will be in this business for years, on days when it is going badly, and the only thing that gets you through is wanting to be there. Fit is not about glamour — plenty of people are genuinely energized by waste hauling or commercial HVAC. It is about whether the daily work matches what you are good at and willing to do. A lender also cares: relevant experience improves your credit file.",
  killer:"You bought a business you found boring. Eighteen months in you are not making the hundred small decisions that keep it healthy, and the numbers show it.",
  scenario:"The buyer spent six years managing field service teams for a regional HVAC company and is looking at a commercial refrigeration service business in the same metro."},

 {k:"transition",n:"Transition plan",w:1.2,
  d:"Is there a real handover — a seller consulting period, customer introductions, staff retention — or a handshake and a key?",
  a:["Seller leaves at close","14 days, informal","30 days, no structure","90 days, defined","6 months plus a consulting agreement","Structured handover with retention incentives for staff"],
  teach:"The transition is where the value you underwrote either survives or leaks away. What you want is specific and written: how long the seller stays, what they are obliged to do, who they personally introduce you to, and what keeps the key staff. Vague goodwill is worth nothing at month three when the seller is on a boat. Tie part of the seller note or an earnout to the handover actually happening.",
  killer:"The seller means well, but 'available by phone' turns into unanswered calls by week six, and the customer introductions never happen.",
  scenario:"The seller will stay six months full-time, then consult twenty hours a month for a year, with a schedule of named customer introductions in the first ninety days."},

 {k:"legal",n:"Legal & working capital",w:1.0,
  d:"Licenses transfer, leases assign, no environmental or litigation surprises, and the working-capital peg — the receivables and inventory the seller must leave behind — is agreed.",
  a:["Known litigation or environmental exposure","Licenses may not transfer","Several open items","Minor items, resolvable","Clean, peg agreed in principle","Clean, peg agreed and documented"],
  teach:"These are the items that do not change what the business is worth but can stop the deal or cost you real money at closing. The working-capital peg is the one people forget: if the seller sweeps the receivables on the way out, you fund the next payroll from your own pocket on top of the purchase price. Agree the peg in the letter of intent, in a number, not in principle.",
  killer:"The lease has a change-of-control clause. The landlord uses it to reset rent 30% higher, and you sign because the equipment cannot move.",
  scenario:"All operating licenses convey with the entity, the building lease assigns with landlord consent already obtained, and the LOI specifies a $310k working-capital peg delivered at close."}
];

export const ALL_CRIT = CRIT_A.concat(CRIT_B);
export const DDSAMPLE = {frag:4,recur:4,mgmt:3,owner:2,margin:4,capex:3,demand:4,moat:5,
  seller:5,finance:4,sellerfin:4,price:3,books:3,fit:4,transition:4,legal:4};

export function aggregate(list, scores) {
  let num = 0, den = 0, any = false;
  for (const c of list) {
    if (scores[c.k] != null) { num += scores[c.k] * c.w; any = true; }
    den += 5 * c.w;
  }
  return any ? (num / den) * 100 : null;
}
export function hardStops(scores) {
  return ALL_CRIT.filter((c) => c.crit && scores[c.k] != null && scores[c.k] <= 1)
                 .map((c) => ({ n: c.n, v: scores[c.k] }));
}
