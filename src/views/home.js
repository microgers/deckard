import { $, el, esc, pct } from '../ui.js';
import { state, activeCompany } from '../store.js';
import { projMetrics } from './metrics.js';
import { stageProgress } from '../progress.js';
import { scoreAssessment as assessScore } from '../data/questions.js';
import { ALL_CRIT } from '../data/criteria.js';

let nav = () => {};
export function initHome(opts = {}) { nav = opts.nav || nav; }

/**
 * The home hero headlines the strongest thing the user has actually established
 * about the active company, and nothing more.
 *
 *   model confirmed  → the modelled equity IRR
 *   16/16 scored     → the two diamond scores
 *   anything else    → no number at all
 *
 * projMetrics already withholds `irr` until prog.modelDone is set, so the first
 * branch cannot fire on the model's own defaults — a brand-new company used to
 * headline a DEF-derived 62.6% as if it were a finding about that business. The
 * middle branch exists so gating the IRR does not also hide a diamond verdict
 * the user really did earn.
 */
function renderHome(){
  var p=activeCompany(), mm=p?projMetrics(p):null, r=assessScore(state.assessment);
  var sp=p?stageProgress(p):null;
  var h="";
  if(p&&mm&&mm.irr!=null){
    var cls=mm.irr<0?"down":mm.irr<0.15?"warn":"up";
    h='<div class="kicker"><span class="dotb"></span>'+esc(p.name)+'</div>'+
      '<div class="heroline"><span class="bignum '+cls+'">'+pct(mm.irr,1)+'</span>'+
      '<span class="delta">modelled equity IRR'+(mm.a!=null?' &middot; diamonds '+Math.round(mm.a)+' / '+Math.round(mm.b):'')+'</span></div>'+
      '<p class="lede" style="margin-top:14px">Three gates between you and owning a business, in the order that saves you money. '+
      (mm.a!=null&&mm.a>=70&&mm.b>=70?'This one clears both diamonds &mdash; price it, then get a letter of intent.':
       mm.a!=null?'Open Diamond to see where this one loses points.':'Score the sixteen criteria in Diamond to get a verdict on this one.')+'</p>';
  } else if(p&&mm&&mm.a!=null){
    // Diamond finished, model not run. The scores are real, so they lead; the
    // lede names the one stage that is still missing rather than implying a
    // number the user has not produced.
    var dcls=(mm.a>=70&&mm.b>=70)?"up":"warn";
    h='<div class="kicker"><span class="dotb"></span>'+esc(p.name)+'</div>'+
      '<div class="heroline"><span class="bignum '+dcls+'">'+Math.round(mm.a)+' / '+Math.round(mm.b)+'</span>'+
      '<span class="delta">diamond scores &middot; deal model not run yet</span></div>'+
      '<p class="lede" style="margin-top:14px">'+
      (mm.a>=70&&mm.b>=70?'This one clears both diamonds. Price it in the deal model to see what return is left at the asking price.'
                         :'This one does not clear both diamonds. Open Diamond to see where it loses points before you spend time on the price.')+'</p>';
  } else if(p){
    h='<div class="kicker"><span class="dotb"></span>'+esc(p.name)+'</div>'+
      '<h1 class="big">Three gates between you and owning a business.</h1>'+
      '<p class="lede">Most people who want to buy a small business start with the spreadsheet. That&rsquo;s the third question. Work them in order &mdash; the cheapest deal to kill is the one you kill before diligence.</p>';
  } else {
    h='<div class="kicker"><span class="dotb"></span>Entrepreneurship through acquisition</div>'+
      '<h1 class="big">Three gates between you and owning a business.</h1>'+
      '<p class="lede">Most people who want to buy a small business start with the spreadsheet. That&rsquo;s the third question. Work them in order &mdash; the cheapest deal to kill is the one you kill before diligence.</p>'+
      '<div class="btnrow"><button class="btn" id="startnew">Add your first company</button></div>';
  }
  $("#homehero").innerHTML=h;
  if($("#startnew")) $("#startnew").onclick=function(){ $("#newproj").click() };

  var gl=$("#gatelist"); gl.innerHTML="";
  var gates=[
    {go:"assess",t:"Operator Assessment",s:"Are you built to own it?",
     v: r? String(r.score) : (Object.keys(state.assessment).length? Object.keys(state.assessment).length+"/12":"—"),
     c: r? (r.score>=78?"var(--up)":r.score>=48?"var(--warn)":"var(--down)") : "var(--tx3)",
     ic:'<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 1.8c-4.3 0-7.8 2.4-7.8 5.3V21h15.6v-1.9c0-2.9-3.5-5.3-7.8-5.3Z"/>'},
    {go:"dd",t:"The Double Diamond",s:"Is the business worth owning?",
     v: (mm&&mm.a!=null)? Math.round(mm.a)+" / "+Math.round(mm.b) : (p? Object.keys(p.d).length+"/16":"—"),
     c: (mm&&mm.a!=null)? ((mm.a>=70&&mm.b>=70)?"var(--up)":"var(--warn)") : "var(--tx3)",
     ic:'<path d="M6.6 3 1.4 12l5.2 9 5.2-9Zm10.8 0-5.2 9 5.2 9 5.2-9Z"/>'},
    // No IRR until the user has confirmed the model. Until then the row reports
    // how far through the assumptions they are — the same count the rail and the
    // hub show — which is a fact, where the DEF-derived percentage was not.
    {go:"irr",t:"IRR & Deal Model",s:"Does the price leave a return?",
     v: (mm&&mm.irr!=null)? pct(mm.irr,0) : (sp&&sp.model.n)? sp.model.n+"/"+sp.model.of : "—",
     c: (mm&&mm.irr!=null)? (mm.irr<0?"var(--down)":"var(--up)") : "var(--tx3)",
     ic:'<path d="M3.5 20h3.2v-6.8H3.5zm6.9 0h3.2V4h-3.2zM17.3 20h3.2v-10.6h-3.2z"/>'}
  ];
  gates.forEach(function(g){
    var b=el("button","gaterow");
    b.innerHTML='<span class="gi"><svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">'+g.ic+'</svg></span>'+
      '<span class="gt"><b>'+g.t+'</b><span>'+g.s+'</span></span>'+
      '<span class="gv" style="color:'+g.c+'">'+g.v+'</span>'+
      '<span class="gc"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></span>';
    b.onclick=function(){ nav(g.go) };
    gl.appendChild(b);
  });
}

export { renderHome };
