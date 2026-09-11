import { execSync } from 'node:child_process';
const pw = await import(execSync('npm root -g').toString().trim() + '/playwright/index.js');
const b = await (pw.chromium||pw.default.chromium).launch();
let fails=0; const ok=(n,c,m)=>{ if(c) console.log('  PASS',n); else { console.log('  FAIL',n,m??''); fails++; } };

for (const w of [430, 1360]) {
const ctx = await b.newContext({ viewport:{width:w,height:900} });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:5199/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(700);
console.log('— no jump while using the controls @ '+w+' —');

// MODEL: worst case, drive into the over-funded error state
await p.click('#mainnav button[data-go="irr"]'); await p.waitForTimeout(400);
await p.evaluate(()=>document.getElementById('rg-sbaPct').scrollIntoView({block:'center'}));
await p.waitForTimeout(250);
const top = (s) => p.evaluate((q)=>{const e=document.querySelector(q); return e?Math.round(e.getBoundingClientRect().top):null;}, s);
let t0 = await top('#in-sbaPct');
await p.evaluate(()=>{ const rg=document.getElementById('rg-sbaPct'); rg.value=0.9; rg.dispatchEvent(new Event('input',{bubbles:true})); });
await p.waitForTimeout(300);
let t1 = await top('#in-sbaPct');
ok('SBA slider holds position through an error state', Math.abs(t1-t0)<=4, `moved ${t1-t0}px`);

await p.evaluate(()=>{ const rg=document.getElementById('rg-sellerPct'); rg.value=0.5; rg.dispatchEvent(new Event('input',{bubbles:true})); });
await p.waitForTimeout(300);
let t2 = await top('#in-sbaPct');
await p.evaluate(()=>{ const rg=document.getElementById('rg-sbaPct'); rg.value=0.75; rg.dispatchEvent(new Event('input',{bubbles:true})); });
await p.waitForTimeout(300);
let t3 = await top('#in-sbaPct');
ok('recovering from the error state does not jump either', Math.abs(t3-t2)<=4, `moved ${t3-t2}px`);

// growth slider sweep
await p.evaluate(()=>document.getElementById('rg-growth').scrollIntoView({block:'center'}));
await p.waitForTimeout(250);
let g0 = await top('#in-growth'); let worst=0;
for (const v of [0.10,-0.05,0.18,0.0,0.25]) {
  await p.evaluate((val)=>{ const rg=document.getElementById('rg-growth'); rg.value=val; rg.dispatchEvent(new Event('input',{bubbles:true})); }, v);
  await p.waitForTimeout(200);
  const g = await top('#in-growth'); worst = Math.max(worst, Math.abs(g-g0));
}
ok('EBITDA growth slider stays put across a full sweep', worst<=4, `worst ${worst}px`);

// DIAMOND
await p.click('#mainnav button[data-go="dd"]'); await p.waitForTimeout(300);
await p.click('#dclear'); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#ddboard [data-k="legal"]').scrollIntoView({block:'center'}));
await p.waitForTimeout(250);
let d0 = await top('#ddboard [data-k="legal"]');
await p.click('#ddboard [data-k="legal"] .dots button:nth-child(5)'); await p.waitForTimeout(300);
let d1 = await top('#ddboard [data-k="legal"]');
ok('scoring a criterion keeps that criterion under the cursor', Math.abs(d1-d0)<=4, `moved ${d1-d0}px`);

await p.click('#dfill'); await p.waitForTimeout(400);
await p.evaluate(()=>document.querySelector('#ddboard [data-k="price"]').scrollIntoView({block:'center'}));
await p.waitForTimeout(250);
let d2 = await top('#ddboard [data-k="price"]');
await p.click('#ddboard [data-k="price"] .dots button:nth-child(1)'); await p.waitForTimeout(350);
let d3 = await top('#ddboard [data-k="price"]');
ok('a hard stop appearing does not throw the page', Math.abs(d3-d2)<=4, `moved ${d3-d2}px`);

// OPERATOR
await p.click('#mainnav button[data-go="assess"]'); await p.waitForTimeout(300);
await p.click('#aclear'); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#qlist [data-q="10"]').scrollIntoView({block:'center'}));
await p.waitForTimeout(250);
let a0 = await top('#qlist [data-q="10"]');
await p.click('#qlist [data-q="10"] .likert button:nth-child(4)'); await p.waitForTimeout(300);
let a1 = await top('#qlist [data-q="10"]');
ok('answering a statement keeps it in place', Math.abs(a1-a0)<=4, `moved ${a1-a0}px`);

if (errs.length) { ok('no runtime errors', false, errs[0]); } else ok('no runtime errors', true);
await ctx.close();
}
await b.close();
console.log(fails? `\n${fails} FAILED` : '\nALL ANCHOR TESTS PASS');
process.exit(fails?1:0);
