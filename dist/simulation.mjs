import {address,encode,decode,units,uint} from './abi.mjs';
import {ROUTER,CHAIN,rpc,quantity,failover} from './network.mjs';
import {quote,validateLoop,MAX_UINT} from './optimizer.mjs';
import {getTokens} from './custom-tokens.mjs';
const $=id=>document.getElementById(id);
const ZERO='0x'+'0'.repeat(40);
function words(hex,count){if(typeof hex!=='string'||!new RegExp('^0x[0-9a-fA-F]{'+count*64+'}$').test(hex))throw Error('合约返回数据不符合预期 ABI');return Array.from({length:count},(_,i)=>hex.slice(2+i*64,66+i*64))}
function addr(hex){const [w]=words(hex,1);if(!/^0{24}/.test(w))throw Error('合约地址编码错误');return '0x'+w.slice(24)}
function label(a){return getTokens().find(t=>t.address.toLowerCase()===a.toLowerCase())?.name??a.slice(0,8)+'…'+a.slice(-4)}
function el(parent,tag,value,cls){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;parent.append(e);return e}
function solve(pools,cap){return new Promise((resolve,reject)=>{const w=new Worker(new URL('./optimizer-worker.mjs',import.meta.url),{type:'module'});const timer=setTimeout(()=>{w.terminate();reject(Error('模拟计算超时，请缩短路径或设置输入上限'))},30000);const finish=()=>{clearTimeout(timer);w.terminate()};w.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data.result)};w.onerror=()=>{finish();reject(Error('模拟计算器启动失败，请刷新页面'))};w.postMessage({pools,cap})})}
async function snapshot(node,path){
  if(quantity(await rpc(node.url,'eth_chainId',[])).toString()!==CHAIN)throw Error('节点 Chain ID 不匹配');
  const block=await rpc(node.url,'eth_blockNumber',[]);quantity(block);
  const call=(to,data)=>rpc(node.url,'eth_call',[{to,data},block]);
  const factory=address(addr(await call(ROUTER,'0xc45a0155')));
  const pools=[];const used=new Set();
  for(let i=1;i<path.length;i++){
    const from=path[i-1].toLowerCase(),to=path[i].toLowerCase();
    const pair=addr(await call(factory,'0xe6a43905'+from.slice(2).padStart(64,'0')+to.slice(2).padStart(64,'0')));
    if(pair===ZERO)throw Error(label(from)+' / '+label(to)+' 没有池子');
    if(used.has(pair))throw Error('路径重复使用同一个池子，暂不支持');used.add(pair);
    const [res,t0,t1]=await Promise.all([call(pair,'0x0902f1ac'),call(pair,'0x0dfe1681'),call(pair,'0xd21220a7')]);
    const [r0,r1]=words(res,3).slice(0,2).map(w=>BigInt('0x'+w));const token0=addr(t0),token1=addr(t1);
    if(!((token0===from&&token1===to)||(token0===to&&token1===from)))throw Error('池子 Token 与路径不一致');
    if(r0===0n||r1===0n)throw Error('池子流动性为零');
    pools.push({pair,from,to,rin:token0===from?r0:r1,rout:token0===from?r1:r0});
  }
  const decimals=await Promise.all(path.slice(0,-1).map(async to=>{try{const d=BigInt('0x'+words(await call(to,'0x313ce567'),1)[0]);return d<=255n?Number(d):null}catch{return null}}));
  return {node,block,pools,decimals};
}
export async function simulate(path,nodes,onAttempt){
  // Validate before network reads; input amount is not needed for optimization.
  encode('1',path);validateLoop(path);
  const pathText=$('path').value,capText=$('simCap').value;
  const cap=capText.trim()?uint(capText.trim()):MAX_UINT;
  const out=$('simOutput');out.replaceChildren();$('simStatus').textContent='读取固定区块的池子储备…';
  const snap=await failover(nodes,n=>snapshot(n,path),onAttempt);
  snap.pathText=pathText;
  $('simStatus').textContent='正在计算最大毛收益…';
  const result=await solve(snap.pools,cap);
  // Validate the configured 997/1000 model against Router at the same block.
  let probe=result.input||snap.pools[0].rin/1000n||1n; if(probe>cap)probe=cap;
  const expected=quote(probe,snap.pools);
  $('simStatus').textContent='复核 Router 报价…';
  const actual=decode(await rpc(snap.node.url,'eth_call',[{to:ROUTER,data:encode(probe.toString(),path)},snap.block]),path.length).map(BigInt);
  if(actual.some((v,i)=>v!==expected[i]))throw Error('Router 报价与 0.3% 恒定乘积模型不一致，已停止输出优化结果');
  const d=snap.decimals[0],symbol=label(path[0]);
  const fmt=(v,dec=d)=>{const neg=v<0n;const s=(neg?-v:v).toString();return (neg?'-':'')+(dec===null?s:units(s,dec))};
  const metric=(name,value)=>{const box=el(out,'div','','simMetric');el(box,'small',name);el(box,'div',fmt(value)+' '+(d===null?'raw':symbol),'quantity');el(box,'div','raw: '+value,'raw')};
  metric(result.exact?'最佳输入数量（模型）':'建议输入数量（近似最优）',result.input);
  metric('预计最终输出',result.output);metric('预计毛收益 · 未扣 gas',result.profit);
  if(!result.profit)el(out,'p',result.exact?'当前区块、当前搜索范围内没有正毛收益，建议不兑换（输入 0）。':'本次搜索未找到正毛收益；尚未证明不存在机会。','hint');
  el(out,'p',result.exact?'已证明该输入达到模型范围内的最大整数毛收益；并列最优输入可能不止一个。':'这是有限计算内找到的最佳值，非严格全局最优；最大毛收益与当前结果的差距上界为 '+fmt(result.upperProfit-result.profit)+' '+(d===null?'raw':symbol)+'（'+(result.upperProfit-result.profit)+' raw）。','hint');
  if(result.input>0n){const use=el(out,'button','填入输入数量','textbutton');use.type='button';use.onclick=()=>{if($('path').value!==snap.pathText||$('simCap').value!==capText){$('simStatus').textContent='路径或上限已变化，请重新模拟后填入';return}$('amount').value=result.input.toString();$('amount').focus()}}
  const table=el(out,'table','','simTable');const head=el(table,'thead','');const tr=el(head,'tr','');['输入 '+symbol,'最终输出','毛收益'].forEach(t=>el(tr,'th',t));const body=el(table,'tbody','');
  if(result.input>0n){const seen=new Set();for(const percent of [25n,50n,75n,100n,125n,150n]){const x=result.input*percent/100n;if(!x||x>cap||seen.has(x.toString()))continue;seen.add(x.toString());const y=quote(x,snap.pools).at(-1),row=el(body,'tr','');[x,y,y-x].forEach(v=>el(row,'td',fmt(v)))}}
  const detail=el(out,'details','');el(detail,'summary','查看池子储备与计算范围');snap.pools.forEach((p,i)=>{el(detail,'p',label(p.from)+' → '+label(p.to),'hint');el(detail,'div',p.pair,'addr');el(detail,'div','输入储备 '+fmt(p.rin,snap.decimals[i])+' / 输出储备 '+fmt(p.rout,snap.decimals[(i+1)%snap.decimals.length]),'raw');el(detail,'div','raw: '+p.rin+' / '+p.rout,'raw')});
  el(detail,'p','每跳费用 0.3% · 原始整数运算 · 搜索输入范围 0–'+result.searchLimit+' raw'+(cap===MAX_UINT?'（自动推导）':'（受输入上限约束）'),'hint');
  el(out,'p','Chain ID '+CHAIN+' · Block '+BigInt(snap.block)+' · '+snap.node.url+' · '+new Date().toLocaleString(),'meta');
  el(out,'p','储备快照模拟，未计 gas、转账税或其他特殊代币行为。Router 复核只是报价一致性检查，不保证实际交易可执行或盈利。','hint');
  $('simStatus').textContent=$('path').value!==pathText||$('simCap').value!==capText?'输入已变化，以上为旧路径 / 旧上限快照，请重新模拟':'✓ 模拟完成 · Router 报价一致 · '+(result.exact?'模型最优已验证':'近似结果');
}
