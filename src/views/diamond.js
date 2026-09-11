import { $, el, esc } from '../ui.js';
import { CRIT_A, CRIT_B, aggregate, hardStops, PASS_MARK } from '../data/criteria.js';
import { activeCompany, touchCompany } from '../store.js';
import { openModal, closeModal } from '../modal.js';

let onChange = () => {};
export function initDiamond(opts = {}) { onChange = opts.onChange || onChange; }

function openCrit(c){
  var p=activeCompany(); if(!p) return;
  var sel=p.d[c.k];
  var h='<p style="color:var(--tx2);font-size:14.5px;margin-bottom:12px">'+esc(c.d)+'</p>'+
    '<p style="margin-bottom:14px"><span class="pill">weight '+c.w.toFixed(1)+'&times;</span>'+
    (c.crit?' <span class="pill bad">&#9670; critical &mdash; 0 or 1 is a hard stop</span>':'')+'</p><div id="optlist"></div>';
  openModal(c.n,h);
  var L=$("#optlist");
  c.a.forEach(function(txt,v){
    var b=el("button","opt");
    b.setAttribute("aria-checked", sel===v?"true":"false");
    b.innerHTML='<span class="on">'+v+'</span><span class="ot">'+esc(txt)+'</span><span class="ck">&#10003;</span>';
    b.onclick=function(){ p.d[c.k]=v; touchCompany(); renderDD(); scoreD(); onChange(); closeModal(); };
    L.appendChild(b);
  });
}
function renderDD(){
  var w=$("#ddboard"); w.innerHTML="";
  var p=activeCompany();
  if(!p){ w.innerHTML='<div class="note"><b>No company selected.</b> Add one from the Saved companies list, or load the example scores below to see a finished scorecard.</div>'; return; }
  var agg = (l) => aggregate(l, p.d);
  [["Diamond I — The Business","Durability of the asset, independent of price",CRIT_A,"var(--brand)"],
   ["Diamond II — The Deal","Whether you can own it on terms that hold",CRIT_B,"var(--warn)"]].forEach(function(g){
    var sc=agg(g[2]), done=g[2].filter(function(c){return p.d[c.k]!=null}).length;
    var box=el("div","critwrap");
    box.appendChild(el("div","crithead",'<span class="dm" style="border-color:'+g[3]+'"></span>'+
      '<b>'+g[0]+'</b><span class="tiny" style="flex:1 1 100%;order:9">'+g[1]+'</span>'+
      '<span class="sc" style="color:'+(done===8?g[3]:"var(--tx3)")+'">'+(done===8?Math.round(sc):done+"/8")+'</span>'));
    g[2].forEach(function(c){
      var sel=p.d[c.k];
      var row=el("div","crit");
      row.appendChild(el("div",null,'<div class="cn">'+esc(c.n)+(c.crit?' <span style="color:var(--down)">&#9670;</span>':'')+'</div>'+
        '<div class="cd">'+esc(c.d)+'</div><span class="cw">weight '+c.w.toFixed(1)+'&times;'+(c.crit?' &middot; critical':'')+'</span>'+
        (sel!=null?'<div class="ca">&ldquo;'+esc(c.a[sel])+'&rdquo;</div>':'')));
      var dots=el("div","dots");
      for(var v=0;v<=5;v++){
        var b=el("button",null,String(v)); b.type="button"; b.dataset.v=v;
        b.setAttribute("aria-pressed", sel===v?"true":"false");
        b.setAttribute("aria-label",c.n+" — "+v+" of 5 — "+c.a[v]); b.title=c.a[v];
        b.onclick=(function(ck,vv){return function(){ p.d[ck]=vv; touchCompany(); renderDD(); scoreD(); onChange(); }})(c.k,v);
        dots.appendChild(b);
      }
      var more=el("button","tiny"); more.textContent="what these mean";
      more.style.cssText="display:block;margin-top:7px;color:var(--brand);font-weight:600";
      more.onclick=function(){ openCrit(c) };
      var cell=el("div",null); cell.appendChild(dots); cell.appendChild(more);
      row.appendChild(cell); box.appendChild(row);
    });
    w.appendChild(box);
  });
}
function diamondSVG(a,b){
  var W=520,H=132,g=22,dw=(W-g)/2,cy=H/2;
  function poly(x0){ return x0+","+cy+" "+(x0+dw/2)+",5 "+(x0+dw)+","+cy+" "+(x0+dw/2)+","+(H-5); }
  function d(x0,id,v,col){
    return '<clipPath id="'+id+'"><polygon points="'+poly(x0)+'"/></clipPath>'+
      '<rect x="'+x0+'" y="0" width="'+(dw*v/100)+'" height="'+H+'" fill="'+col+'" clip-path="url(#'+id+')"/>'+
      '<polygon points="'+poly(x0)+'" fill="none" stroke="var(--line2)" stroke-width="1.6" stroke-linejoin="round"/>';
  }
  return '<svg viewBox="0 0 '+W+' '+(H+28)+'" role="img" aria-label="Diamond I '+Math.round(a)+' of 100, Diamond II '+Math.round(b)+' of 100">'+
   d(0,"dgA",a,"var(--brand)")+ d(dw+g,"dgB",b,"var(--warn)")+
   '<text x="'+(dw/2)+'" y="'+(H+20)+'" text-anchor="middle" fill="var(--tx3)" font-family="Manrope,sans-serif" font-size="11.5" font-weight="700" letter-spacing="1.2">THE BUSINESS</text>'+
   '<text x="'+(dw+g+dw/2)+'" y="'+(H+20)+'" text-anchor="middle" fill="var(--tx3)" font-family="Manrope,sans-serif" font-size="11.5" font-weight="700" letter-spacing="1.2">THE DEAL</text></svg>';
}
function scoreD(){
  var out=$("#dres"), p=activeCompany();
  if(!p){ out.innerHTML=""; return; }
  var n=Object.keys(p.d).length;
  if(n<16){ out.innerHTML='<div class="note"><b>'+(16-n)+' criteria still unscored.</b> The verdict appears when all sixteen are in.</div>'; return; }
  function agg(l){ var num=0,den=0; l.forEach(function(c){ num+=p.d[c.k]*c.w; den+=5*c.w; }); return num/den*100; }
  var A=agg(CRIT_A), B=agg(CRIT_B), tot=(A+B)/2;
  var stops=hardStops(p.d);
  var verdict,sub,cls;
  if(stops.length){ verdict="Hard stop"; cls="bad";
    sub="One or more critical criteria scored 0 or 1. These are not averageable — a business whose earnings can't be proven, or whose customers are one phone call from leaving, is not a cheaper version of a good deal. Resolve the flag or walk."; }
  else if(A>=PASS_MARK&&B>=PASS_MARK){ verdict="Pursue"; cls="ok";
    sub="Both diamonds clear. The business is durable enough to be worth owning and the terms are workable. Move to the Model, price it, then get a letter of intent and a quality-of-earnings engagement."; }
  else if(A>=PASS_MARK){ verdict="Restructure the deal"; cls="mid";
    sub="The business is worth owning; the terms aren't there yet. This is a workable position: the asset is real, so the remaining work is negotiation. Push on seller financing, price, and transition before you walk."; }
  else if(B>=PASS_MARK){ verdict="Don't be seduced by the terms"; cls="mid";
    sub="Attractive terms on a business with structural problems. Cheap money does not fix customer concentration or shrinking demand — it just increases what you lose. Re-score Diamond I with your most skeptical hat on."; }
  else { verdict="Pass"; cls="bad";
    sub="Neither diamond clears. Passing costs you nothing but the hours already spent. The discipline of writing this down is the point — it's the record you'll want when you're tempted back in month nine."; }
  var lows=CRIT_A.concat(CRIT_B).filter(function(c){return p.d[c.k]<=2})
    .sort(function(x,y){return (p.d[x.k]*x.w)-(p.d[y.k]*y.w)}).slice(0,4);
  var lowHtml = lows.length ? '<div class="sectitle">Where it loses points</div><div class="gauges">'+
    lows.map(function(c){ var q=p.d[c.k]/5;
      return '<div class="gauge"><div class="gh"><span class="gn">'+esc(c.n)+'</span><span class="gv">'+p.d[c.k]+' / 5 &middot; '+c.w.toFixed(1)+'&times;</span></div>'+
        '<div class="track"><div class="tf" style="width:'+(q*100)+'%;background:'+(q<=.2?"var(--down)":"var(--warn)")+'"></div></div>'+
        '<div class="gd">&ldquo;'+esc(c.a[p.d[c.k]])+'&rdquo;</div></div>'; }).join("")+'</div>'
    : '<div class="note" style="margin-top:18px">Nothing scored 2 or below. Either this is a genuinely strong target, or you are scoring it the way you want it to be. Have someone who is not buying it score it too.</div>';
  var stopHtml = stops.length ? '<div class="note bad" style="margin-top:18px"><b>Hard stops triggered:</b> '+
    stops.map(function(s){return esc(s.n)+" ("+s.v+"/5)"}).join(", ")+'. Critical criteria are marked &#9670; &mdash; they are the ones that most reliably destroy small acquisitions, so the scorecard refuses to average them into a comfortable middle.</div>' : "";
  out.innerHTML=
   '<div class="card" style="display:flex;gap:30px;flex-wrap:wrap;align-items:center">'+
     '<div style="flex:1 1 300px;min-width:0">'+diamondSVG(A,B)+
       '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;text-align:center;margin-top:6px">'+
       '<div><div class="bignum" style="font-size:36px;color:var(--brand)">'+Math.round(A)+'</div></div>'+
       '<div><div class="bignum" style="font-size:36px;color:var(--warn)">'+Math.round(B)+'</div></div></div></div>'+
     '<div style="flex:1 1 260px;min-width:0">'+
       '<div class="kicker" style="margin-bottom:5px">'+esc(p.name)+' &middot; verdict</div>'+
       '<h3 style="font-size:26px;font-weight:800;margin-bottom:9px">'+verdict+'</h3>'+
       '<p style="color:var(--tx2);font-size:14.5px;line-height:1.55">'+sub+'</p>'+
       '<div style="margin-top:12px"><span class="pill '+cls+'">Composite '+Math.round(tot)+' / 100</span> '+
       '<span class="tiny">for reference &mdash; the verdict reads each diamond on its own</span></div></div>'+
   '</div>'+ stopHtml + lowHtml;
}

export { renderDD, scoreD, diamondSVG, openCrit };
