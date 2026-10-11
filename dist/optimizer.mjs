// Independent constant-product pools; all quantities are raw integer token units.
export const MAX_UINT=(1n<<256n)-1n;
const min=(a,b)=>a<b?a:b;
const max=(a,b)=>a>b?a:b;
function gcd(a,b){while(b){[a,b]=[b,a%b]}return a}
export function sqrt(n){if(n<0n)throw Error('negative sqrt');if(n<2n)return n;let x=1n<<BigInt(Math.ceil(n.toString(2).length/2));for(;;){const y=(x+n/x)/2n;if(y>=x)return x;x=y}}
export function quote(input,pools){let x=input;const amounts=[x];for(const p of pools){x=x*997n*p.rout/(p.rin*1000n+x*997n);amounts.push(x)}return amounts}
export function validateLoop(path){
  if(path.length<4||path[0].toLowerCase()!==path.at(-1).toLowerCase())throw Error('循环路径需要至少 3 个不同池子，并以同一种 Token 开始和结束');
  const seen=new Set();for(let i=1;i<path.length;i++){const key=[path[i-1].toLowerCase(),path[i].toLowerCase()].sort().join(':');if(seen.has(key))throw Error('暂不支持重复经过同一个池子，请调整循环路径');seen.add(key)}
}
export function optimize(pools,cap=MAX_UINT,budget=4096){
  if(!pools.length||pools.some(p=>p.rin<=0n||p.rout<=0n))throw Error('池子储备必须大于 0');
  if(cap<1n||cap>MAX_UINT)throw Error('输入上限超出 uint256 范围');
  // Without per-hop integer truncation: F(x)=a*x/(b+c*x).
  let a=1n,b=1n,c=0n;
  for(const p of pools){const na=997n*p.rout*a,nb=1000n*p.rin*b,nc=1000n*p.rin*c+997n*a;const g=gcd(gcd(na,nb),nc);a=na/g;b=nb/g;c=nc/g}
  let best={input:0n,output:0n,profit:0n},evaluations=0;
  const evaluate=x=>{if(x<0n||x>cap)return;const output=quote(x,pools).at(-1),profit=output-x;evaluations++;if(profit>best.profit)best={input:x,output,profit}};
  if(a<=b)return {...best,upperProfit:0n,exact:true,evaluations,searchLimit:0n};
  // For x >= (a-b)/c even the continuous profit is nonpositive.
  const limit=min(cap,(a-b)/c),root=sqrt(a*b),center=min(limit,max(0n,(root-b)/c));
  const continuousFloor=x=>a*x/(b+c*x)-x;
  const bound=(lo,hi)=>{
    if(a*b<=(b+c*lo)**2n)return continuousFloor(lo);
    if(a*b>=(b+c*hi)**2n)return continuousFloor(hi);
    // floor sqrt gives a conservative upper bound, including truncation losses.
    return (a+b-2n*root)/c;
  };
  evaluate(limit);for(let d=-16n;d<=16n;d++)evaluate(center+d);
  const stack=[{lo:0n,hi:limit,ub:bound(0n,limit)}];let steps=0;
  while(stack.length&&steps++<budget){
    const {lo,hi,ub}=stack.pop();if(ub<=best.profit)continue;
    if(hi-lo<=16n){for(let x=lo;x<=hi;x++)evaluate(x);continue}
    const mid=(lo+hi)/2n;evaluate(mid);
    const children=[{lo,hi:mid-1n},{lo:mid+1n,hi}].filter(n=>n.lo<=n.hi).map(n=>({...n,ub:bound(n.lo,n.hi)})).filter(n=>n.ub>best.profit).sort((u,v)=>u.ub<v.ub?-1:u.ub>v.ub?1:0);
    stack.push(...children);
  }
  const upperProfit=stack.reduce((ub,n)=>max(ub,n.ub),best.profit);
  return {...best,upperProfit,exact:upperProfit===best.profit,evaluations,searchLimit:limit};
}
