/**
 * Finance engine — IRR solver and the levered small-business acquisition model.
 *
 * The IRR solver is a bracketed bisection over a scan of [-100%, +1000%], not
 * Newton's method. It finds every root the scan separates, reports honestly when
 * there is none, and flags the multi-root case that a spreadsheet's IRR()
 * silently hides. Verified against ten published test vectors — see
 * test/engine.test.js.
 */
function npv(rate,cf){ if(rate<=-1)return NaN; var df=1,s=0;
  for(var t=0;t<cf.length;t++){ s+=cf[t]/df; df*=(1+rate);} return s; }
function signChanges(cf){ var last=0,n=0;
  for(var i=0;i<cf.length;i++){ var v=cf[i]; if(Math.abs(v)<1e-12)continue;
    var s=v<0?-1:1; if(last!==0&&s!==last)n++; last=s; } return n; }
function irr(cf){
  var LO=-0.9999999999,HI=10,SCAN=2000,MAXIT=200,TOLX=1e-12;
  if(!cf||cf.length<2)return{ok:false,reason:"TOO_FEW"};
  for(var q=0;q<cf.length;q++){ if(typeof cf[q]!=="number"||!isFinite(cf[q]))return{ok:false,reason:"NON_FINITE"}; }
  var allz=true; for(q=0;q<cf.length;q++){ if(Math.abs(cf[q])>=1e-12){allz=false;break;} }
  if(allz)return{ok:false,reason:"ALL_ZERO"};
  if(signChanges(cf)===0)return{ok:false,reason:"NO_SIGN_CHANGE"};
  var brackets=[],step=(HI-LO)/SCAN,a=LO,fa=npv(a,cf);
  for(var i=1;i<=SCAN;i++){ var b=LO+i*step,fb=npv(b,cf);
    if(fa*fb<0)brackets.push([a,b]); a=b; fa=fb; }
  if(!brackets.length){
    var fHi=npv(HI,cf), f0=npv(0,cf);
    if(isFinite(fHi)&&isFinite(f0)&&fHi*f0>0&&f0>0) return{ok:false,reason:"ABOVE_RANGE"};
    return{ok:false,reason:"NO_ROOT_IN_RANGE"};
  }
  var roots=[];
  for(var k=0;k<brackets.length;k++){
    var lo=brackets[k][0],hi=brackets[k][1],flo=npv(lo,cf);
    for(var it=0;it<MAXIT;it++){ var mid=(lo+hi)/2,fm=npv(mid,cf);
      if(fm===0||(hi-lo)/2<TOLX)break;
      if(flo*fm<0){hi=mid;} else {lo=mid;flo=fm;} }
    roots.push((lo+hi)/2); }
  roots.sort(function(x,y){return x-y});
  var ded=[]; for(k=0;k<roots.length;k++){ if(!ded.length||Math.abs(roots[k]-ded[ded.length-1])>1e-7)ded.push(roots[k]); }
  if(ded.length===1)return{ok:true,irr:ded[0],unique:true};
  return{ok:true,irr:ded[0],unique:false,allRoots:ded,warning:"MULTIPLE_IRR"};
}
function pmt(P,rate,years){ if(P<=0||years<=0)return 0; var i=rate/12,n=Math.round(years*12);
  if(Math.abs(i)<1e-12)return P/n; return P*i/(1-Math.pow(1+i,-n)); }
function amortYear(bal,rate,m){ var i=rate/12,intv=0,pr=0,b=bal;
  for(var k=0;k<12;k++){ if(b<=1e-9)break; var im=b*i,pm=m-im; if(pm>b)pm=b;
    if(pm<0)pm=0; intv+=im; pr+=pm; b-=pm; }
  return {interest:intv,principal:pr,endBalance:Math.max(0,b)}; }

function model(p){
  var ebitda0 = p.etype==="sde" ? p.earnings-p.ownerComp : p.earnings;
  var priceBase = p.etype==="sde" ? p.earnings : ebitda0;
  var price = priceBase*p.entryMultiple;
  var impliedMult = ebitda0>0 ? price/ebitda0 : null;
  if(ebitda0<=0) return {error:"NO_EBITDA", ebitda0:ebitda0, price:price};
  var totalUses = price + p.closingCosts;
  var sba = price*p.sbaPct, seller = price*p.sellerPct;
  var equity = totalUses - sba - seller;
  if(equity < 1) return {error:"NO_EQUITY", equity:equity, price:price, totalUses:totalUses,
    sba:sba, seller:seller, ebitda0:ebitda0, impliedMult:impliedMult};
  var sbaPmt = pmt(sba,p.sbaRate,p.sbaTerm);
  var amortYrs = Math.max(0.0833, p.sellerTerm - p.sellerStandby);
  var sbaBal=sba, selBal=seller, selPmt=null;
  var rows=[], cfs=[-equity], prev=ebitda0, y;
  for(y=1;y<=p.holdYears;y++){
    var ebitda = ebitda0*Math.pow(1+p.growth,y);
    var capex = Math.max(0,ebitda)*p.capexPct;
    var dNwc = Math.max(0,ebitda-prev)*p.nwcPct;
    var sy = amortYear(sbaBal,p.sbaRate,sbaPmt);
    var sInt=0,sPrin=0;
    if(y<=p.sellerStandby){ selBal *= Math.pow(1+p.sellerRate/12,12);
      if(y===p.sellerStandby) selPmt = pmt(selBal,p.sellerRate,amortYrs);
    } else {
      if(selPmt===null) selPmt = pmt(selBal,p.sellerRate,amortYrs);
      var sz = amortYear(selBal,p.sellerRate,selPmt);
      sInt=sz.interest; sPrin=sz.principal; selBal=sz.endBalance; }
    sbaBal = sy.endBalance;
    var interest = sy.interest+sInt, principal = sy.principal+sPrin;
    var taxes = Math.max(0, ebitda - p.da - interest)*p.taxRate;
    var fcfe = ebitda - capex - dNwc - taxes - interest - principal;
    var ds = interest+principal;
    var dscr = ds>0 ? ebitda/ds : null;
    var dscrCash = ds>0 ? (ebitda-capex-taxes)/ds : null;
    rows.push({y:y,ebitda:ebitda,capex:capex,dNwc:dNwc,interest:interest,principal:principal,
      taxes:taxes,fcfe:fcfe,dscr:dscr,dscrCash:dscrCash,debt:sbaBal+selBal});
    cfs.push(fcfe); prev=ebitda;
  }
  var exitEbitda = ebitda0*Math.pow(1+p.growth,p.holdYears);
  var exitEV = exitEbitda*p.exitMultiple;
  var remaining = sbaBal+selBal;
  var exitEquity = exitEV - remaining;
  cfs[cfs.length-1] += exitEquity;
  var r = irr(cfs), dist=0, inflow=0, outflow=equity;
  for(var z=1;z<cfs.length;z++){ dist+=cfs[z]; if(cfs[z]>0) inflow+=cfs[z]; else outflow-=cfs[z]; }
  var moic = outflow>0 ? inflow/outflow : null;
  return {ebitda0:ebitda0,price:price,priceBase:priceBase,impliedMult:impliedMult,
    inflow:inflow,outflow:outflow,totalUses:totalUses,sba:sba,seller:seller,equity:equity,
    sbaPmt:sbaPmt,selPmt:selPmt,rows:rows,cfs:cfs,exitEbitda:exitEbitda,exitEV:exitEV,
    remaining:remaining,exitEquity:exitEquity,irr:r,moic:moic,dist:dist,
    bridge:{growth:(exitEbitda-ebitda0)*(price/Math.max(1e-9,ebitda0)),
            multiple:exitEbitda*(p.exitMultiple-(price/Math.max(1e-9,ebitda0))),
            debt:(sba+seller)-remaining, fees:-p.closingCosts}};
}

export { npv, signChanges, irr, pmt, amortYear, model };
