import assert from 'node:assert/strict';
import {optimize,quote,sqrt,validateLoop} from './dist/optimizer.mjs';
for(let n=0n;n<200n;n++){const s=sqrt(n);assert(s*s<=n&&(s+1n)**2n>n)}
assert.throws(()=>validateLoop(['A','B','A']));assert.throws(()=>validateLoop(['A','B','C','B','A']));validateLoop(['A','B','C','A']);
// Exhaustive comparisons exercise fee rounding, dust, no-profit, caps, and varied scales.
let state=71;const random=()=>{state=(state*16807)%2147483647;return state};
for(let t=0;t<150;t++){
  const pools=Array.from({length:3},()=>({rin:BigInt(10+random()%200),rout:BigInt(10+random()%200)}));const cap=BigInt(1+random()%200);
  let best=0n;for(let x=0n;x<=cap;x++){const p=quote(x,pools).at(-1)-x;if(p>best)best=p}
  const r=optimize(pools,cap,10000);assert.equal(r.exact,true);assert.equal(r.profit,best);assert.equal(r.output-r.input,r.profit);assert(r.input<=cap);
  const limited=optimize(pools,cap,0);assert(limited.profit<=best);assert(limited.upperProfit>=best);
}
const scale=10n**18n,pools=[{rin:1000n*scale,rout:2000n*scale},{rin:1000n*scale,rout:1000n*scale},{rin:1000n*scale,rout:1000n*scale}];
const r=optimize(pools);assert(r.profit>0n);assert(r.upperProfit>=r.profit);assert.equal(quote(r.input,pools).at(-1),r.output);
assert.equal(optimize([{rin:100n,rout:100n},{rin:100n,rout:100n},{rin:100n,rout:100n}]).profit,0n);
console.log('PASS: 150 exhaustive comparisons, constrained bounds, BigInt precision, sqrt, repeated pools, no-profit paths');
