import { $, $$, el, esc, money, dollars, pct, keepInPlace } from '../ui.js';
import { model } from '../engine.js';
import { FIELDS, DEF } from '../data/fields.js';
import { activeCompany, touchCompany } from '../store.js';

let onChange = () => {};
export function initModel(opts = {}) { onChange = opts.onChange || onChange; }

export let P = { ...DEF };
let lastPrice = 4800000;

export function syncPfromProject() { const p = activeCompany(); P = p ? p.i : { ...DEF }; }
function persist() { const p = activeCompany(); if (p) p.i = P; touchCompany(); }

function disp(f, v) {
  if (f.kind === 'pct') return String(+(v * 100).toFixed(4));
  if (f.kind === 'mult') return v.toFixed(1);
  if (f.kind === 'int') return String(Math.round(v));
  return String(Math.round(v));
}
function parseF(f, s) {
  let v = parseFloat(s); if (!isFinite(v)) return null;
  if (f.kind === 'pct') v = v / 100;
  if (f.kind === 'int') v = Math.round(v);
  return Math.min(f.max, Math.max(f.min, v));
}
export function syncEtype() {
  $$('#etype button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.t === (P.etype || 'ebitda') ? 'true' : 'false'));
}
export function resetModel() { P = { ...DEF }; persist(); renderInputs(); runModel(); syncEtype(); }
export function setEtype(t) { P.etype = t; syncEtype(); persist(); runModel(); }

function renderInputs(){
  Object.keys(FIELDS).forEach(function(g){
    var w=$("#"+g); w.innerHTML="";
    FIELDS[g].forEach(function(f){
      var dimmed=f.dim&&f.dim(P);
      var d=el("div","fld"); d.style.opacity=dimmed?".42":"1";
      d.innerHTML='<label for="in-'+f.k+'">'+f.n+'<span class="hint" id="hint-'+f.k+'">'+f.hint(P,lastPrice)+'</span></label>'+
        '<div class="r"><input type="number" id="in-'+f.k+'" value="'+disp(f,P[f.k])+'" min="'+(f.kind==="pct"?f.min*100:f.min)+'" max="'+(f.kind==="pct"?f.max*100:f.max)+'" step="'+(f.kind==="pct"?f.step*100:f.step)+'"><span class="u">'+f.u+'</span></div>'+
        '<input type="range" id="rg-'+f.k+'" min="'+f.min+'" max="'+f.max+'" step="'+f.step+'" value="'+P[f.k]+'" aria-label="'+f.n+'">';
      w.appendChild(d);
      var num=$("#in-"+f.k,d), rg=$("#rg-"+f.k,d);
      var hold=function(fn){ keepInPlace('#in-'+f.k, fn); };
      num.oninput=function(){ var v=parseF(f,num.value); if(v==null)return; P[f.k]=v; rg.value=v; persist(); hold(runModel); };
      num.onblur=function(){ num.value=disp(f,P[f.k]); rg.value=P[f.k]; };
      rg.oninput=function(){ P[f.k]=parseFloat(rg.value); num.value=disp(f,P[f.k]); persist(); hold(runModel); };
    });
  });
}
function renderError(m){
  var head,msg;
  if(m.error==="NO_EBITDA"){ head="A market-rate salary exceeds what the business earns.";
    msg="After paying someone — you or a manager — to do the owner's job, there is no EBITDA left to buy. That isn't an acquisition, it's a job with a purchase price attached. Lower the salary assumption or find a business that earns more."; }
  else { head="Your sources exceed your uses by "+dollars(-m.equity)+".";
    msg="The SBA loan plus the seller note now fund more than the purchase price and closing costs, which leaves no equity cheque to compute a return on. Real lenders won't do this: SBA rules require a minimum 10% equity injection on a change of ownership. Reduce the loan or the note."; }
  $("#stacknote").innerHTML="<b>"+head+"</b> "+msg;
  $("#ires").innerHTML='<div class="note bad"><b>'+head+'</b> '+msg+'</div>';
}
function runModel(){
  if(P.sellerStandby>=P.sellerTerm){
    P.sellerStandby=Math.max(0,P.sellerTerm-1); persist();
    var a=$("#in-sellerStandby"), b=$("#rg-sellerStandby");
    if(a) a.value=String(P.sellerStandby); if(b) b.value=String(P.sellerStandby);
  }
  Object.keys(FIELDS).forEach(function(g){ FIELDS[g].forEach(function(f){
    var h=$("#hint-"+f.k); if(h) h.textContent=f.hint(P,lastPrice);
    var i=$("#in-"+f.k); if(i&&f.dim) i.closest(".fld").style.opacity=f.dim(P)?".42":"1";
  })});
  var m=model(P);
  lastPrice=m.price||lastPrice;
  $("#ftrBiz").textContent = P.etype==="sde"
    ? "The entry multiple is applied to SDE, as listed. The implied EBITDA multiple appears in the result above."
    : "Earnings are already net of a market-rate owner salary, so the salary field is inactive.";
  if(m.error){ renderError(m); onChange(); return; }
  var eqPct=m.totalUses>0? m.equity/m.totalUses : 0, nb=[];
  nb.push("<b>Sources &amp; uses.</b> Uses "+dollars(m.totalUses)+". Sources: SBA "+dollars(m.sba)+", seller note "+dollars(m.seller)+", <b>your equity "+dollars(m.equity)+"</b> ("+pct(eqPct,1)+").");
  if(P.etype==="sde"&&m.impliedMult) nb.push("You are paying "+P.entryMultiple.toFixed(1)+"&times; the listed SDE &mdash; which, after a "+dollars(P.ownerComp)+" market salary, is <b>"+m.impliedMult.toFixed(1)+"&times; EBITDA</b>.");
  if(eqPct<0.10) nb.push("Equity is under the SBA's 10% minimum injection for a change of ownership &mdash; a lender will require more cash or a standby seller note.");
  if(m.sba>5000000) nb.push("SBA 7(a) caps at $5,000,000. This loan is "+dollars(m.sba)+" and would need a second lender or a larger equity cheque.");
  if(P.sbaTerm>10) nb.push("Goodwill and business-acquisition loans amortize over 10 years maximum unless real estate is included.");
  if(P.sellerStandby>0&&P.sellerStandby<P.sbaTerm) nb.push("To count toward the SBA equity injection, a seller note must sit on full standby for the life of the SBA loan &mdash; here that would be "+P.sbaTerm+" years, not "+P.sellerStandby+".");
  $("#stacknote").innerHTML=nb.join(" ");
  renderResult(m); onChange();
}
function cashChart(m){
  var cf=m.cfs,W=640,H=190,pad=10,n=cf.length;
  var posMax=0,negMax=0;
  cf.forEach(function(v){ if(v>=0) posMax=Math.max(posMax,v); else negMax=Math.max(negMax,-v); });
  var top=24, bot=34, avail=H-top-bot, span=(posMax+negMax)||1;
  var zero=top+avail*(posMax/span), s=avail/span;
  var gap=(W-pad*2)/n, bw=Math.min(52,gap*0.5), out="";
  for(var i=0;i<n;i++){
    var v=cf[i], x=pad+gap*i+(gap-bw)/2, h=Math.abs(v)*s, y=v>=0?zero-h:zero;
    var col=v>=0?"var(--up)":"var(--down)";
    out+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(2,h).toFixed(1)+'" rx="3" fill="'+col+'" opacity="'+(i===n-1?1:(i===0?1:.68))+'"/>';
    out+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(v>=0?y-7:y+h+15).toFixed(1)+'" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="600" font-size="11" fill="var(--tx2)">'+money(v)+'</text>';
    out+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="600" font-size="10.5" fill="var(--tx3)">'+(i===0?"Y0":"Y"+i)+'</text>';
  }
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Equity cash flows by year">'+
    '<line x1="'+pad+'" y1="'+zero+'" x2="'+(W-pad)+'" y2="'+zero+'" stroke="var(--line)" stroke-width="1"/>'+out+'</svg>';
}
function sensGrid(){
  var ents=[],exs=[],i,j;
  for(i=-1;i<=1;i++) ents.push(Math.max(1,+(P.entryMultiple+i).toFixed(1)));
  for(j=-1.5;j<=1.5;j+=0.75) exs.push(Math.max(1,+(P.exitMultiple+j).toFixed(2)));
  var h='<table class="sens" style="min-width:440px"><thead><tr><th>Entry / exit</th>'+
    exs.map(function(x){return '<th>'+(+x.toFixed(2))+'&times;</th>'}).join("")+'</tr></thead><tbody>';
  ents.forEach(function(en){
    h+='<tr><td><b>'+en.toFixed(1)+'&times;</b></td>';
    exs.forEach(function(ex){
      var q=Object.assign({},P,{entryMultiple:en,exitMultiple:ex});
      q.da=P.da*(en/Math.max(0.01,P.entryMultiple));
      var mm=model(q), r=mm.error?{ok:false,reason:"ERR"}:mm.irr;
      if(!r.ok){ h+='<td style="color:var(--tx3)">'+(r.reason==="ABOVE_RANGE"?"&gt;1000%":"n/a")+'</td>'; return; }
      var v=r.irr, a=Math.max(0,Math.min(1,v/0.60));
      var bg=v<0?"var(--down)":"color-mix(in srgb, var(--up) "+Math.round(14+a*86)+"%, transparent)";
      h+='<td class="'+((v<0||a>0.45)?"c":"")+'" style="background:'+bg+'"'+(r.unique===false?' title="Several valid IRRs — lowest shown"':'')+'>'+pct(v,0)+(r.unique===false?"*":"")+'</td>';
    });
    h+='</tr>';
  });
  return h+'</tbody></table>';
}
function renderResult(m){
  var r=m.irr, d1=m.rows.length?m.rows[0]:null;
  var y1coc=(d1&&m.equity>0)?d1.fcfe/m.equity:null, y1Dscr=d1?d1.dscr:null, minCash=null;
  m.rows.forEach(function(x){ if(x.dscrCash!=null&&(minCash==null||x.dscrCash<minCash)) minCash=x.dscrCash; });
  var irrTxt,irrCls="",irrSub;
  if(r.ok&&r.unique){ irrTxt=pct(r.irr,1); irrCls=r.irr<0?"down":r.irr<0.15?"warn":"up";
    irrSub=r.irr<0?"You lose money":r.irr<0.15?"Below what this risk deserves":r.irr>0.6?"Leverage more than genius — read MOIC":"Annualized on your equity"; }
  else if(r.ok){ irrTxt=pct(r.allRoots[0],1)+"*"; irrCls="warn";
    irrSub="Multiple valid IRRs: "+r.allRoots.map(function(x){return pct(x,1)}).join(", "); }
  else if(r.reason==="ABOVE_RANGE"){ irrTxt=">1000%"; irrCls="warn"; irrSub="Above the model's scan range — the equity cheque is negligible"; }
  else { irrTxt="—"; irrCls="down";
    irrSub=r.reason==="NO_SIGN_CHANGE"?"Equity never returns — no rate solves it":
           r.reason==="NO_ROOT_IN_RANGE"?"No real solution for this cash flow pattern":"Undefined for these inputs"; }
  var dCls=y1Dscr==null?"":y1Dscr<1?"down":y1Dscr<1.25?"warn":"up";
  var warn="";
  if(r.ok&&!r.unique) warn='<div class="note bad" style="margin-top:18px"><b>This cash flow series has '+r.allRoots.length+' valid IRRs.</b> Cash goes out more than once, so the equation has several roots &mdash; '+r.allRoots.map(function(x){return pct(x,2)}).join(" and ")+'. A spreadsheet would report just one of them without telling you. Use NPV at a stated hurdle rate instead.</div>';
  else if(!r.ok&&r.reason==="NO_SIGN_CHANGE") warn='<div class="note bad" style="margin-top:18px"><b>No IRR exists for this deal.</b> Every equity cash flow after closing is negative &mdash; including the sale. Money goes in and none comes back, so there is no rate at which it compounds. That is a real answer about the deal, not a failure of the model.</div>';
  else if(!r.ok&&r.reason==="ABOVE_RANGE") warn='<div class="note" style="margin-top:18px"><b>The return exceeds the model&rsquo;s +1000% scan range.</b> That almost always means the equity cheque has been driven near zero by the financing assumptions. An enormous IRR on a trivial amount of capital is a rounding artefact, not an opportunity &mdash; look at MOIC and at the dollars.</div>';

  var rows=m.rows.map(function(x){
    return '<tr><td>Year '+x.y+'</td><td>'+dollars(x.ebitda)+'</td><td>'+dollars(-x.capex)+'</td><td>'+dollars(-x.interest)+'</td><td>'+dollars(-x.principal)+'</td><td>'+dollars(-x.taxes)+'</td>'+
      '<td class="'+(x.fcfe<0?"neg":"")+'"><b>'+dollars(x.fcfe)+'</b></td>'+
      '<td class="'+(x.dscr!=null&&x.dscr<1.25?"neg":"")+'" title="After capex and tax: '+(x.dscrCash!=null?x.dscrCash.toFixed(2)+"×":"—")+'">'+(x.dscr!=null?x.dscr.toFixed(2)+"&times;":"—")+'</td><td>'+dollars(x.debt)+'</td></tr>';
  }).join("");
  var table='<table><thead><tr><th>Period</th><th>EBITDA</th><th>Capex</th><th>Interest</th><th>Principal</th><th>Tax</th><th>Cash to equity</th><th>DSCR</th><th>Debt left</th></tr></thead><tbody>'+rows+
   '<tr style="background:var(--surf)"><td><b>Exit (Y'+P.holdYears+')</b></td><td>'+dollars(m.exitEbitda)+'</td><td colspan="4" style="text-align:left;color:var(--tx3)">&times; '+P.exitMultiple.toFixed(1)+' = '+dollars(m.exitEV)+' less '+dollars(m.remaining)+' debt</td><td><b>'+dollars(m.exitEquity)+'</b></td><td></td><td>&mdash;</td></tr></tbody></table>';

  var bg=m.bridge, tot=bg.growth+bg.multiple+bg.debt+bg.fees;
  var denom=Math.max(1,Math.abs(bg.growth)+Math.abs(bg.multiple)+Math.abs(bg.debt)+Math.abs(bg.fees));
  function brow(name,v,col,note){ var w=Math.abs(v)/denom*100;
    return '<div class="gauge"><div class="gh"><span class="gn">'+name+'</span><span class="gv">'+dollars(v)+'</span></div>'+
      '<div class="track"><div class="tf" style="width:'+w.toFixed(1)+'%;background:'+col+'"></div></div><div class="gd">'+note+'</div></div>'; }
  var bridge=brow("Earnings growth",bg.growth,"var(--up)","EBITDA grew "+dollars(m.exitEbitda-m.ebitda0)+" and you sell it at the entry multiple. This is the part you earn.")+
    brow("Multiple change",bg.multiple,bg.multiple>=0?"var(--warn)":"var(--down)",bg.multiple===0?"You assumed no expansion. That is the honest default — every dollar here would be a bet on the buyer pool, not on you.":bg.multiple>0?"You assumed a higher exit multiple than you paid. Sensitivity-test this before you believe it.":"You assumed compression — a conservative and often realistic choice.")+
    brow("Debt paydown",bg.debt,"var(--brand)","The business repaid "+dollars(bg.debt)+" of debt out of its own cash flow. That is leverage working — the balance sheet, not the operation.")+
    (P.closingCosts?brow("Fees at close",bg.fees,"var(--down)","Closing costs came out of your equity on day one and never earn anything back."):"");
  var levShare = tot>0? Math.min(1,Math.max(0,bg.debt/tot)) : null;
  var p=activeCompany();

  $("#ires").innerHTML=
   '<div class="card">'+
     '<div class="kicker" style="margin-bottom:6px">'+(p?esc(p.name)+' &middot; ':'')+'equity IRR</div>'+
     '<div class="heroline"><span class="bignum '+irrCls+'">'+irrTxt+'</span><span class="delta">'+irrSub+'</span></div>'+
     '<div class="statrow" style="margin-top:22px">'+
      '<div class="st"><div class="k">MOIC</div><div class="v">'+(m.moic!=null&&isFinite(m.moic)?m.moic.toFixed(2)+"&times;":"—")+'</div><div class="s">'+dollars(m.inflow)+' back on '+dollars(m.outflow)+'</div></div>'+
      '<div class="st"><div class="k">Year-1 DSCR</div><div class="v '+dCls+'">'+(y1Dscr!=null?y1Dscr.toFixed(2)+"&times;":"—")+'</div><div class="s">'+(y1Dscr==null?"no debt":y1Dscr<1?"Loan not serviceable":y1Dscr<1.25?"Below the 1.25&times; threshold":"Clears the 1.25&times; threshold")+'</div></div>'+
      '<div class="st"><div class="k">Yr-1 cash yield</div><div class="v '+(y1coc!=null&&y1coc<0?"down":"")+'">'+(y1coc!=null?pct(y1coc,0):"—")+'</div><div class="s">'+(y1coc!=null&&y1coc<0?"You fund it from savings":"On equity invested")+'</div></div>'+
      '<div class="st"><div class="k">Purchase price</div><div class="v">'+money(m.price)+'</div><div class="s">'+
        (P.etype==="sde"? dollars(P.earnings)+' SDE &times; '+P.entryMultiple.toFixed(1)+' = '+(m.impliedMult?m.impliedMult.toFixed(1):'—')+'&times; EBITDA'
                        : dollars(m.ebitda0)+' EBITDA &times; '+P.entryMultiple.toFixed(1))+'</div></div>'+
      '<div class="st"><div class="k">Equity in</div><div class="v">'+money(m.equity)+'</div><div class="s">'+pct(m.totalUses>0?m.equity/m.totalUses:0,1)+' of total uses</div></div>'+
      '<div class="st"><div class="k">Exit proceeds</div><div class="v '+(m.exitEquity<0?"down":"")+'">'+money(m.exitEquity)+'</div><div class="s">'+money(m.exitEV)+' sale less '+money(m.remaining)+' debt</div></div>'+
     '</div>'+warn+'</div>'+
   '<div class="sectitle">Equity cash flows</div>'+
   '<div class="chart">'+cashChart(m)+'</div>'+
   '<p class="tiny" style="margin-top:10px;max-width:68ch">Year 0 is the cheque you write at closing. '+(P.holdYears>2?'Years 1&ndash;'+(P.holdYears-1)+' are':'Year 1 is')+' distributions after debt service and tax. Year '+P.holdYears+' combines the final year&rsquo;s cash with the sale proceeds after the lender is repaid. IRR is the rate that discounts this exact series to zero.</p>'+
   '<div class="sectitle">Year by year</div><div class="xs">'+table+'</div>'+
   '<p class="tiny" style="margin-top:10px;max-width:68ch">Debt service runs on a true monthly amortization schedule, so each year&rsquo;s interest/principal split is exact. DSCR is shown on the lender&rsquo;s basis &mdash; EBITDA &divide; debt service &mdash; because that is the test an SBA underwriter applies. Hover a cell for coverage after capex and tax, which bottoms out at '+(minCash!=null?minCash.toFixed(2)+"&times;":"—")+'. Neither figure pays you a salary.</p>'+
   '<div class="sectitle">Where the exit value came from</div>'+
   '<p class="tiny" style="margin:-4px 0 14px;max-width:68ch">The sale proceeds, minus the cheque you wrote, split into the forces that produced it. Distributions taken during the hold sit outside this bridge &mdash; they are counted in MOIC.</p>'+
   '<div class="gauges">'+bridge+'</div>'+
   '<div class="note'+(levShare===null?" bad":"")+'" style="margin-top:18px">'+
     (levShare===null
       ? "<b>This structure destroys "+dollars(-tot)+" of equity value.</b> The sale proceeds come back below the cheque you wrote, so there is nothing to decompose. The bars above show which force did the damage."
       : "<b>"+pct(levShare,0)+" of the equity value at exit is debt paydown.</b> "+
         (levShare>0.55?"That is a leverage story. It works &mdash; right up to a bad year, when the same leverage takes your equity before it touches the bank's. Stress the downside before you believe the headline."
                       :"A healthy share is coming from the business rather than the balance sheet."))+'</div>'+
   '<div class="sectitle">IRR by entry and exit multiple</div>'+
   '<p class="tiny" style="margin:-4px 0 14px;max-width:68ch">Read the columns against the rows. In most small-cap holds, half a turn on the exit outweighs a year of margin work &mdash; which is what makes the exit multiple the riskiest line in the model, and the one you have least control over. The D&amp;A shield is scaled with price across the grid so each cell stays internally consistent.</p>'+
   '<div class="xs">'+sensGrid()+'</div>'+
   '<div class="note" style="margin-top:18px"><b>Stress it before you trust it.</b> Set growth to &minus;5%, push the exit multiple a full turn below entry, and add a year to the hold. If the deal still clears its debt service, you have a deal. If it needs growth and expansion to work, you have a hope.</div>';
}

export { renderInputs, runModel, renderResult, cashChart, sensGrid };
