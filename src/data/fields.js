/** Gate III — every input and output of the deal model, with what each one means. */

export const DEF = {
  etype: "ebitda", earnings: 1200000, ownerComp: 200000, entryMultiple: 4, growth: 0.03,
  capexPct: 0.08, nwcPct: 0.15, da: 120000, taxRate: 0.25, sbaPct: 0.75, sbaRate: 0.095,
  sbaTerm: 10, sellerPct: 0.10, sellerRate: 0.06, sellerTerm: 5, sellerStandby: 0,
  closingCosts: 0, holdYears: 5, exitMultiple: 4
};

export const FIELD_GROUPS = [
  { id: "grpBiz", name: "The business" },
  { id: "grpCap", name: "The capital stack" },
  { id: "grpOps", name: "Operating & exit" }
];

export const FIELDS = {
 grpBiz: [
  {k:"earnings",n:"Reported earnings",u:"$",min:100000,max:8000000,step:10000,kind:"money",
   hint:(P)=>P.etype==="sde"?"as listed (SDE)":"already EBITDA",
   teach:"The number the listing quotes. At Main Street size it is almost always SDE — seller's discretionary earnings — which includes one owner's pay and perks. Everything downstream depends on getting this right, so use the toggle to tell the model which one you typed."},
  {k:"ownerComp",n:"Market-rate owner salary",u:"$",min:0,max:500000,step:5000,kind:"money",
   hint:(P)=>P.etype==="sde"?"subtracted from SDE":"not applied",
   dim:(P)=>P.etype!=="sde",
   teach:"What it costs to pay a competent person to do the owner's job — you or a hired manager. Subtracting it from SDE gives real EBITDA. This single number is the difference between a business that looks like 3× earnings and one that is actually 4×."},
  {k:"entryMultiple",n:"Entry multiple",u:"×",min:1,max:10,step:0.1,kind:"mult",
   hint:(P)=>P.etype==="sde"?"applied to SDE, as listed":"applied to EBITDA",
   teach:"What you pay per dollar of annual earnings. Small businesses under $1M of EBITDA typically trade in the low single digits; multiples rise with size, recurring revenue and management depth. The multiple is applied to whichever earnings figure you selected above, which is why the model shows you the implied EBITDA multiple separately."},
  {k:"closingCosts",n:"Closing costs",u:"$",min:0,max:400000,step:5000,kind:"money",
   hint:()=>"legal, quality-of-earnings, lender, title",
   teach:"Legal fees, the quality-of-earnings engagement, lender fees, title and search costs. They come out of your equity on day one and never earn anything back, so they lower your return without buying you any of the business."}
 ],
 grpCap: [
  {k:"sbaPct",n:"SBA 7(a) loan",u:"%",min:0,max:0.9,step:0.01,kind:"pct",
   hint:()=>"of purchase price",
   teach:"The bank loan, expressed as a share of the purchase price. The SBA 7(a) program guarantees most of the lender's exposure, which is what makes a bank willing to lend against goodwill at all. Maximum loan size is $5,000,000, and a change of ownership requires at least a 10% equity injection of total project cost."},
  {k:"sbaRate",n:"SBA rate",u:"%",min:0.04,max:0.16,step:0.0025,kind:"pct",
   hint:()=>"Prime + spread",
   teach:"Interest rate on the bank loan. SBA variable rates are capped at Prime + 3.00% for loans over $350,000 and reset quarterly. Acquisition paper typically prices at Prime + 2.50–3.00%. The model holds the rate fixed, which understates your real risk — run it a point or two higher as a stress case."},
  {k:"sbaTerm",n:"SBA amortization",u:"yrs",min:5,max:25,step:1,kind:"int",
   hint:()=>"10 yrs max for goodwill",
   teach:"How long the loan takes to repay. Business-acquisition and goodwill loans amortize over a maximum of ten years unless real estate is included, and a ten-year SBA loan carries no prepayment penalty. A longer term lowers the payment and raises total interest."},
  {k:"sellerPct",n:"Seller note",u:"%",min:0,max:0.5,step:0.01,kind:"pct",
   hint:()=>"of purchase price",
   teach:"The portion of the price the seller lends you rather than taking in cash. Cheaper than bank debt, and it keeps the seller financially interested in the business surviving the handover. Under SBA rules it can count toward part of your required equity injection, but only on full standby."},
  {k:"sellerRate",n:"Seller note rate",u:"%",min:0,max:0.14,step:0.0025,kind:"pct",
   hint:()=>"typically 5–8%",
   teach:"Interest on the seller note. Usually below the bank rate, because the seller's alternative is not lending the money at all."},
  {k:"sellerTerm",n:"Seller note term",u:"yrs",min:1,max:15,step:1,kind:"int",
   hint:()=>"total, including standby",
   teach:"Total life of the seller note, standby period included. The note amortizes over whatever is left after standby ends, so a five-year note with two years of standby repays over three."},
  {k:"sellerStandby",n:"Full standby",u:"yrs",min:0,max:10,step:1,kind:"int",
   hint:(P)=>P.sellerStandby>=P.sellerTerm?"must be less than the term":"no principal or interest paid; interest accrues",
   teach:"Years during which the seller receives nothing at all — no principal and no interest — while the bank is repaid. Interest accrues onto the balance instead. Full standby is what lets a seller note count toward the SBA equity injection, and it must run for the life of the SBA loan to qualify."}
 ],
 grpOps: [
  {k:"growth",n:"EBITDA growth",u:"%",min:-0.15,max:0.3,step:0.005,kind:"pct",
   hint:()=>"per year",
   teach:"How fast earnings grow each year. This is the assumption most likely to be optimistic. A base case should be low single digits; the honest stress case is negative, because that is what a lost customer or a bad hire actually looks like in the model."},
  {k:"capexPct",n:"Capex",u:"%",min:0,max:0.5,step:0.01,kind:"pct",
   hint:()=>"of EBITDA",
   teach:"Capital expenditure as a share of earnings — trucks, machines, systems. It is cash that leaves before you see any, and it is the line sellers most often understate by deferring purchases before a sale."},
  {k:"nwcPct",n:"Working capital draw",u:"%",min:0,max:0.6,step:0.01,kind:"pct",
   hint:()=>"of EBITDA growth",
   teach:"Growth consumes cash before it produces it: receivables and inventory build ahead of collection. This is the share of each year's earnings increase that gets absorbed that way, which is why a fast-growing small business can be profitable and still short of cash."},
  {k:"da",n:"D&A for tax",u:"$",min:0,max:1500000,step:10000,kind:"money",
   hint:(P,lastPrice)=>"all-goodwill deal ≈ $"+Math.round(lastPrice/15/1000)+"k/yr",
   teach:"Depreciation and amortization. Non-cash, but it lowers taxable income, so it is a real shield. Most SBA acquisitions are asset purchases, which step up basis and let you amortize goodwill over fifteen years under IRC §197 — on an all-goodwill deal that is roughly the price divided by 15, every year."},
  {k:"taxRate",n:"Tax rate",u:"%",min:0,max:0.5,step:0.01,kind:"pct",
   hint:()=>"blended, on taxable income",
   teach:"A blended rate applied to EBITDA minus D&A minus interest, floored at zero. Interest is deductible; principal is not — which is precisely why a highly levered small business can look profitable on paper and still be cash-poor."},
  {k:"holdYears",n:"Hold period",u:"yrs",min:2,max:15,step:1,kind:"int",
   hint:()=>"years to exit",
   teach:"How long you own it before selling. IRR is sensitive to this in both directions: a longer hold gives debt more time to amortize but discounts the exit proceeds harder."},
  {k:"exitMultiple",n:"Exit multiple",u:"×",min:1,max:12,step:0.1,kind:"mult",
   hint:(P)=>P.exitMultiple>P.entryMultiple?"expansion assumed":P.exitMultiple<P.entryMultiple?"compression assumed":"no expansion — the honest default",
   teach:"What a future buyer pays per dollar of earnings. Setting it equal to entry is the honest default, because any expansion you assume is a bet on the buyer pool rather than on anything you did. It is also the single most powerful lever in the model, which is exactly why it deserves the least trust."}
 ]
};

export const ALL_FIELDS = [].concat(FIELDS.grpBiz, FIELDS.grpCap, FIELDS.grpOps);

/** The outputs — every number the model produces, and what it is for. */
export const OUTPUTS = [
 {k:"irr",n:"Equity IRR",
  teach:"The annual rate at which your money would have to compound to turn what you put in into what you got back out. Formally: the discount rate that makes the net present value of the cash flow series equal zero. It is the only common metric that combines how much with how long — tripling your money is excellent in three years and mediocre in twelve, and IRR is what tells those apart."},
 {k:"moic",n:"MOIC",
  teach:"Multiple on invested capital — total cash back divided by cash in. IRR rewards speed: a two-year double out-IRRs a five-year triple. MOIC ignores time entirely and says how much money you ended up with, which is the part you actually spend. Always read the two together."},
 {k:"dscr",n:"DSCR",
  teach:"Debt service coverage ratio — earnings divided by loan payments. The lender's test at origination, not yours. Below 1.25× most SBA lenders decline; below 1.0× the business cannot pay its own loan out of its own earnings. Note it is struck before you pay yourself anything."},
 {k:"coc",n:"Year-1 cash yield",
  teach:"First-year distribution divided by the equity you invested. It answers the question IRR never asks: what does this pay me while I own it? A deal can carry a spectacular IRR driven entirely by the exit and still pay you nothing for five years."},
 {k:"price",n:"Purchase price",
  teach:"Earnings times the entry multiple. Quoted cash-free and debt-free, with a normalized working-capital peg delivered at close."},
 {k:"equity",n:"Equity in",
  teach:"The cheque you write at closing: total uses minus the bank loan and the seller note. SBA rules require at least 10% of total project cost as a genuine injection, of which at most half can be a seller note on full standby."},
 {k:"bridge",n:"Value bridge",
  teach:"Where the exit proceeds came from, split three ways: earnings growth (the part you actually earn), multiple change (a bet on the buyer pool), and debt paydown (leverage working — the balance sheet, not the operation). If the bars are mostly the last two, what you have modelled is a financing structure rather than a business."},
 {k:"sens",n:"Sensitivity grid",
  teach:"IRR across a range of entry and exit multiples. In most small-cap holds half a turn on the exit outweighs a year of margin work, which makes the exit assumption the riskiest line in the model and the one you have least control over."}
];
