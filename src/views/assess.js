import { $, el, pct } from '../ui.js';
import { DIMS, QS, SCALE, SAMPLE, RUNGS, scoreAssessment } from '../data/questions.js';
import { state, saveLocal } from '../store.js';

let onChange = () => {};
let queueProfile = () => {};
export function initAssess(opts = {}) { onChange = opts.onChange || onChange; queueProfile = opts.queueProfile || queueProfile; }
export { scoreAssessment as assessScore };
export { SAMPLE };

function renderQ(){
  var w=$("#qlist"); w.innerHTML="";
  var box=el("div","qbox");
  QS.forEach(function(q,i){
    var row=el("div","q");
    row.innerHTML='<div class="qt"><span class="qn">'+String(i+1).padStart(2,"0")+'</span><span>'+q.t+'</span></div>';
    var wrap=el("div",null); wrap.style.flex="0 0 auto";
    var lk=el("div","likert");
    for(var v=1;v<=5;v++){
      var b=el("button",null,String(v)); b.type="button";
      b.setAttribute("aria-pressed", state.assessment[i]===v?"true":"false");
      b.setAttribute("aria-label",SCALE[v-1]); b.title=SCALE[v-1];
      b.onclick=(function(qi,vv){return function(){ state.assessment[qi]=vv; saveLocal(); queueProfile(); renderQ(); scoreA(); onChange(); }})(i,v);
      lk.appendChild(b);
    }
    wrap.appendChild(lk);
    wrap.appendChild(el("div","lkey",'<span>'+SCALE[0]+'</span><span>'+SCALE[4]+'</span>'));
    row.appendChild(wrap); box.appendChild(row);
  });
  w.appendChild(box);
}
function scoreA(){
  var out=$("#ares"), n=Object.keys(state.assessment).length, r=scoreAssessment(state.assessment);
  if(!r){ out.innerHTML='<div class="note"><b>'+(12-n)+' statements left.</b> Your rung and the four capacity readings appear once all twelve are answered.</div>'; return; }
  var score=r.score, byDim=r.byDim, rung=r.rung, weakest=r.weakest;
  var cls=score>=78?"up":score>=48?"warn":"down";
  var gauges=DIMS.map(function(d){
    var raw=byDim[d.k], p=(raw-3)/12, w=Math.round(p*100);
    var col=p>=.72?"var(--up)":p>=.45?"var(--warn)":"var(--down)";
    var note=p>=.72?d.d.hi:p>=.45?d.d.mid:d.d.lo;
    return '<div class="gauge"><div class="gh"><span class="gn">'+d.n+'</span><span class="gv">'+raw+' / 15</span></div>'+
      '<div class="track"><div class="tf" style="width:'+w+'%;background:'+col+'"></div></div><div class="gd">'+note+'</div></div>';
  }).join("");
  out.innerHTML=
   '<div class="card" style="display:flex;gap:26px;flex-wrap:wrap;align-items:center">'+
     '<div style="flex:0 0 auto"><div class="kicker" style="margin-bottom:4px">Readiness</div>'+
       '<div class="bignum '+cls+'" style="font-size:60px">'+score+'</div>'+
       '<div class="tiny">out of 100</div></div>'+
     '<div style="flex:1 1 260px;min-width:0"><h3 style="font-size:24px;font-weight:800;margin-bottom:8px">'+rung.name+'</h3>'+
       '<p style="color:var(--tx2);font-size:14.5px;line-height:1.55">'+rung.p+'</p></div>'+
   '</div>'+
   '<div class="sectitle">The four capacities</div>'+
   '<div class="gauges">'+gauges+'</div>'+
   '<div class="note ok" style="margin-top:20px"><b>On these answers, your lowest capacity is '+weakest.d.n.toLowerCase()+'.</b> A composite score hides this &mdash; you do not need to raise all four, you need to raise the lowest one, because that is the one that will decide what happens in a bad quarter.</div>';
}

export { renderQ, scoreA };
