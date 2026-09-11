import { model } from '../engine.js';
import { CRIT_A, CRIT_B, ALL_CRIT, aggregate } from '../data/criteria.js';

export function projMetrics(p){
  if(!p) return {a:null,b:null,irr:null};
  var A=null,B=null,ir=null;
  if(Object.keys(p.d).length===ALL_CRIT.length){ A=aggregate(CRIT_A,p.d); B=aggregate(CRIT_B,p.d); }
  try{ var m=model(p.i); if(!m.error&&m.irr.ok&&m.irr.unique) ir=m.irr.irr; }catch(e){}
  return {a:A,b:B,irr:ir,scored:Object.keys(p.d).length};
}
function sparkFor(p){
  try{
    var m=model(p.i); if(m.error||!m.cfs||m.cfs.length<2) return "";
    var cum=[],run=0;
    m.cfs.forEach(function(v){ run+=v; cum.push(run); });
    var lo=Math.min.apply(null,cum), hi=Math.max.apply(null,cum), rng=(hi-lo)||1;
    var w=46,h=22,pad=2, n=cum.length, pts=[];
    for(var i=0;i<n;i++){
      var x=(w/(n-1))*i, y=pad+(h-pad*2)*(1-(cum[i]-lo)/rng);
      pts.push(x.toFixed(1)+","+y.toFixed(1));
    }
    var col=cum[n-1]>=0?"var(--up)":"var(--down)";
    var zy=pad+(h-pad*2)*(1-(0-lo)/rng);
    return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" aria-hidden="true">'+
      (zy>=0&&zy<=h?'<line x1="0" y1="'+zy.toFixed(1)+'" x2="'+w+'" y2="'+zy.toFixed(1)+'" stroke="var(--line2)" stroke-width="0.75" stroke-dasharray="2 2"/>':'')+
      '<polyline points="'+pts.join(" ")+'" fill="none" stroke="'+col+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>'+
      '<circle cx="'+w+'" cy="'+pts[n-1].split(",")[1]+'" r="1.9" fill="'+col+'"/></svg>';
  }catch(e){ return "" }
}
export { sparkFor };
