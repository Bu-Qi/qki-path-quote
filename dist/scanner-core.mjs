import {address,encode,decode,units} from './abi.mjs';
import {CHAIN,ROUTER,rpc,quantity} from './network.mjs';
import {quote,MAX_UINT} from './optimizer.mjs';
import {encodeSwap,failureType} from './trade-check.mjs';
import {GAS_PRICE_WEI,WQKI,gasCost,valuationPath} from './gas-cost.mjs';
export const key=(a,b)=>[a.toLowerCase(),b.toLowerCase()].sort().join(':');
function words(hex,count){if(typeof hex!=='string'||!new RegExp('^0x[0-9a-fA-F]{'+count*64+'}$').test(hex))throw Error('池子 ABI 返回格式无效');return Array.from({length:count},(_,i)=>hex.slice(2+i*64,66+i*64))}
function addr(hex){const [w]=words(hex,1);if(!/^0{24}/.test(w))throw Error('无效地址编码');return '0x'+w.slice(24)}
const ZERO='0x'+'0'.repeat(40);
function check(signal){if(signal?.aborted)throw Error('扫描已取消')}
export function enumerate(base,tokens,pairs,maxHops,limit){
  const start=base.toLowerCase(),routes=[];let truncated=false;
  const all=tokens.map(t=>t.address.toLowerCase());
  function visit(path){
    const last=path.at(-1);
    if(path.length>=3&&pairs.has(key(last,start))){
      const cycle=[...path,start],poolIds=cycle.slice(1).map((to,i)=>pairs.get(key(cycle[i],to)).pair);
      if(new Set(poolIds).size===poolIds.length){if(routes.length===limit){truncated=true;return}routes.push(cycle)}
    }
    if(path.length===maxHops)return;
    for(const next of all){if(truncated)return;if(!path.includes(next)&&pairs.has(key(last,next)))visit([...path,next])}
  }
  visit([start]);return {routes,truncated};
}
export function poolsFor(path,pairs){return path.slice(1).map((to,i)=>{const p=pairs.get(key(path[i],to));return {pair:p.pair,rin:p.token0===path[i]?p.r0:p.r1,rout:p.token0===path[i]?p.r1:p.r0}})}
export function effectiveFunds(actual,override){return override===null||override===undefined?actual:override<actual?override:actual}
export async function scan({nodes,tokens,base,sender,maxHops=5,limit=2000,cap=MAX_UINT,balanceOverride=null,allowanceOverride=null,gasPriceWei=GAS_PRICE_WEI,signal,onProgress=()=>{},solve,read=(url,m,p)=>rpc(url,m,p,10000,signal)}){
  if(tokens.length<3||tokens.length>20)throw Error('每次请选择 3–20 个 Token');
  tokens.forEach(t=>address(t.address));address(base);
  if(!sender)throw Error('请填写用于只读兑换模拟的钱包地址');address(sender);
  if(new Set(tokens.map(t=>t.address.toLowerCase())).size!==tokens.length||!tokens.some(t=>t.address.toLowerCase()===base.toLowerCase()))throw Error('扫描列表重复或未包含起止币');
  if(!Number.isInteger(maxHops)||maxHops<3||maxHops>6||!Number.isInteger(limit)||limit<1||limit>20000)throw Error('跳数或扫描上限无效');
  if(cap<1n||cap>MAX_UINT)throw Error('资金上限无效');
  if(balanceOverride!==null&&(balanceOverride<1n||balanceOverride>MAX_UINT))throw Error('自定义模拟余额无效');
  if(allowanceOverride!==null&&(allowanceOverride<1n||allowanceOverride>MAX_UINT))throw Error('自定义模拟 allowance 无效');
  if(typeof gasPriceWei!=='bigint'||gasPriceWei<1n||gasPriceWei>MAX_UINT)throw Error('Gas Price 无效');
  const call=async(url,m,p)=>{check(signal);const result=await read(url,m,p);check(signal);return result};
  onProgress('读取区块快照…');let node,block,hash,factory,blockTimestamp;
  for(const candidate of nodes){check(signal);try{
    if(quantity(await call(candidate.url,'eth_chainId',[])).toString()!==CHAIN)continue;
    const h=await call(candidate.url,'eth_getBlockByNumber',['latest',false]);
    if(!h||!/^0x[0-9a-fA-F]{64}$/.test(h.hash))throw Error('无法读取区块哈希');quantity(h.number);
    const f=address(addr(await call(candidate.url,'eth_call',[{to:ROUTER,data:'0xc45a0155'},h.number])));
    blockTimestamp=quantity(h.timestamp);node=candidate;block=h.number;hash=h.hash;factory=f;break;
  }catch{check(signal)}}
  if(!node)throw Error('没有节点能读取完整 Router 区块快照');
  const contract=(to,data)=>call(node.url,'eth_call',[{to,data},block]);
  onProgress('检查模拟地址余额与现有 Router 授权…');
  const walletWord=sender.slice(2).toLowerCase().padStart(64,'0'),routerWord=ROUTER.slice(2).toLowerCase().padStart(64,'0');
  const [balanceHex,allowanceHex]=await Promise.all([contract(base,'0x70a08231'+walletWord),contract(base,'0xdd62ed3e'+walletWord+routerWord)]);
  const walletBalance=BigInt('0x'+words(balanceHex,1)[0]),routerAllowance=BigInt('0x'+words(allowanceHex,1)[0]);
  if(walletBalance===0n)throw Error('该地址的起止币链上余额为 0，无法完成真实状态兑换模拟；自定义值不能替代链上资金');
  if(routerAllowance===0n)throw Error('该地址的链上 Router allowance 为 0，无法验证兑换；自定义值不能替代链上授权');
  const effectiveBalance=effectiveFunds(walletBalance,balanceOverride),effectiveAllowance=effectiveFunds(routerAllowance,allowanceOverride);
  const requestedCap=cap;cap=[cap,effectiveBalance,effectiveAllowance].reduce((a,b)=>a<b?a:b);
  let decimals=null;try{const d=BigInt('0x'+words(await contract(base,'0x313ce567'),1)[0]);if(d<=255n)decimals=Number(d)}catch{check(signal)}
  const graphTokens=tokens.some(t=>t.address.toLowerCase()===WQKI)?tokens:[...tokens,{name:'WQKI',address:WQKI}];
  const pairs=new Map(),jobs=[];for(let i=0;i<graphTokens.length;i++)for(let j=i+1;j<graphTokens.length;j++)jobs.push([graphTokens[i].address.toLowerCase(),graphTokens[j].address.toLowerCase()]);
  let next=0,done=0;
  async function loadPairs(){while(next<jobs.length){const [a,b]=jobs[next++];check(signal);
    const pair=addr(await contract(factory,'0xe6a43905'+a.slice(2).padStart(64,'0')+b.slice(2).padStart(64,'0')));
    if(pair!==ZERO){
      const [res,t0,t1]=await Promise.all([contract(pair,'0x0902f1ac'),contract(pair,'0x0dfe1681'),contract(pair,'0xd21220a7')]);
      const token0=addr(t0),token1=addr(t1),[r0,r1]=words(res,3).slice(0,2).map(w=>BigInt('0x'+w));
      if(key(token0,token1)!==key(a,b))throw Error('池子 Token 与 Factory 不一致');
      if(r0>0n&&r1>0n)pairs.set(key(a,b),{pair,token0,token1,r0,r1});
    }
    onProgress('读取池子 '+(++done)+' / '+jobs.length+' · Block '+BigInt(block));
  }}
  await Promise.all(Array.from({length:Math.min(3,jobs.length)},loadPairs));
  check(signal);
  const gasValuationPath=valuationPath(base,pairs);
  const {routes,truncated}=enumerate(base,tokens,pairs,maxHops,limit),results=[];
  let unresolved=0,quoteRejected=0,modelMismatch=0,checked=0,tradeReverted=0,tradeUnverified=0,gasUnprofitable=0;
  const tradeFailures=[];
  for(const path of routes){
    check(signal);onProgress('模拟路径 '+(++checked)+' / '+routes.length+' · 已确认预计净收益为正 '+results.length);
    const pools=poolsFor(path,pairs),best=await solve(pools,cap);check(signal);
    if(best.profit<=0n){if(!best.exact)unresolved++;continue}
    let quoted;
    try{quoted=decode(await contract(ROUTER,encode(best.input.toString(),path)),path.length).map(BigInt)}catch(error){check(signal);if(error.rpcCode!==undefined){quoteRejected++;continue}throw error}
    const expected=quote(best.input,pools);
    if(quoted.some((v,i)=>v!==expected[i])){modelMismatch++;continue}
    const output=quoted.at(-1),profit=output-best.input;if(profit<=0n)continue;
    onProgress('只读模拟完整兑换 '+checked+' / '+routes.length+' · 已通过 '+results.length);
    const deadline=blockTimestamp+1200n;
    let gasEstimate,gasFeeWei,gasFeeBase;
    const tx={from:sender,to:ROUTER,value:'0x0',gasPrice:'0x'+gasPriceWei.toString(16),data:encodeSwap(best.input,path,sender,deadline)};
    try{
      const returned=decode(await call(node.url,'eth_call',[tx,block]),path.length).map(BigInt);
      if(returned.some((v,i)=>v!==quoted[i]))throw Error('兑换返回数量与报价不一致，无法验证');
      gasEstimate=quantity(await call(node.url,'eth_estimateGas',[tx,block]));gasFeeWei=gasCost(gasEstimate,gasPriceWei);
      gasFeeBase=gasValuationPath.length===1?gasFeeWei:BigInt(decode(await contract(ROUTER,encode(gasFeeWei.toString(),gasValuationPath)),gasValuationPath.length).at(-1));
      if(gasFeeBase<=0n)throw Error('gas 费用换算为零，无法可靠计算净收益');
    }catch(error){
      check(signal);const status=failureType(error);if(status==='reverted')tradeReverted++;else tradeUnverified++;
      tradeFailures.push({path,inputRaw:best.input.toString(),status,reason:String(error.rpcMessage||error.message).slice(0,500)});continue;
    }
    const netProfit=profit-gasFeeBase;
    if(netProfit<=0n){gasUnprofitable++;tradeFailures.push({path,inputRaw:best.input.toString(),status:'nonpositive_net',reason:'扣除预计 gas 费后净收益不为正：毛收益 '+profit+' raw，gas 费用 '+gasFeeBase+' raw（起止币）'});continue}
    results.push({path,input:best.input,output,profit,netProfit,gasEstimate,gasFeeWei,gasFeeBase,upperProfit:best.upperProfit,exact:best.exact,pools,tradeSimulation:{status:'passed',method:'swapExactTokensForTokens',from:sender,to:sender,gasPriceWei:gasPriceWei.toString(),amountOutMinRaw:(best.input+1n).toString(),deadline:deadline.toString()}});
  }
  const finalBlock=await call(node.url,'eth_getBlockByNumber',[block,false]);
  if(finalBlock?.hash!==hash)throw Error('扫描期间区块发生重组，请重新扫描；本次结果已丢弃');
  return {base:base.toLowerCase(),baseName:tokens.find(t=>t.address.toLowerCase()===base.toLowerCase()).name,decimals,chainId:CHAIN,router:ROUTER,block:BigInt(block).toString(),blockHash:hash,rpc:node.url,scannedAt:new Date().toISOString(),tokens,maxHops,limit,inputCap:cap.toString(),requestedInputCap:requestedCap===MAX_UINT?null:requestedCap.toString(),simulationSender:sender,walletBalanceRaw:walletBalance.toString(),routerAllowanceRaw:routerAllowance.toString(),customBalanceRaw:balanceOverride?.toString()??null,customAllowanceRaw:allowanceOverride?.toString()??null,effectiveBalanceRaw:effectiveBalance.toString(),effectiveAllowanceRaw:effectiveAllowance.toString(),gasPriceWei:gasPriceWei.toString(),gasValuationPath,gasUnprofitable,tradeReverted,tradeUnverified,tradeFailures,pairCount:pairs.size,pathCount:routes.length,truncated,unresolved,quoteRejected,modelMismatch,results};
}
export function roi(row){return units((row.netProfit*1000000n/row.input).toString(),4)}
export function filterResults(rows,minProfit,minRoi,order){
  return rows.filter(r=>r.netProfit>0n&&r.netProfit>=minProfit&&r.netProfit*1000000n>=r.input*minRoi).sort((a,b)=>{const x=order==='roi'?a.netProfit*b.input:a.netProfit,y=order==='roi'?b.netProfit*a.input:b.netProfit;return x>y?-1:x<y?1:0});
}
export function exportData(snapshot,rows,filters){
  const {results,...metadata}=snapshot;
  return {metadata:{...metadata,filters,feePerHop:'0.3%',gasIncluded:true,gasCostSource:'eth_estimateGas at snapshot block multiplied by the selected gasPriceWei',roiBasis:'estimated net profit',inputOptimizationBasis:'gross profit, not guaranteed net optimum',scope:'simple cycles; no repeated intermediate tokens or pools',optimizerBudgetPerPath:512,exportedCount:rows.length,amountEncoding:'raw integers are decimal strings',warning:'eth_call passed only for this sender, amount and block. Net profit subtracts estimated gas using the selected gas price; other-base gas value uses a snapshot WQKI conversion quote. Transfer taxes and actual balance delta are not measured. No transaction broadcast or guarantee of future execution.'},results:rows.map(r=>({path:r.path,pathNames:r.path.map(a=>snapshot.tokens.find(t=>t.address.toLowerCase()===a)?.name??a),amountInRaw:r.input.toString(),amountOutRaw:r.output.toString(),grossProfitRaw:r.profit.toString(),netProfitRaw:r.netProfit.toString(),gasEstimate:r.gasEstimate.toString(),gasFeeQkiWei:r.gasFeeWei.toString(),gasFeeBaseRaw:r.gasFeeBase.toString(),netRoiPercent:roi(r),modelExact:r.exact,modelMaxProfitUpperRaw:r.upperProfit.toString(),routerQuoteVerified:true,tradeSimulation:r.tradeSimulation,pools:r.pools.map(p=>({pair:p.pair,reserveInRaw:p.rin.toString(),reserveOutRaw:p.rout.toString()}))}))};
}
export function toCSV(data){
  const headers=['chainId','block','blockHash','scannedAt','baseToken','baseName','decimals','maxHops','inputCapRaw','walletBalanceRaw','routerAllowanceRaw','customBalanceRaw','customAllowanceRaw','effectiveBalanceRaw','effectiveAllowanceRaw','pathLimit','scanTruncated','unresolvedPaths','quoteRejected','modelMismatch','pathNames','pathJSON','amountInRaw','amountOutRaw','grossProfitRaw','netRoiPercent','modelExact','modelMaxProfitUpperRaw','gasIncluded','simulationStatus','simulationSender','simulationMethod','simulationDeadline','amountOutMinRaw','gasPriceWei','estimatedGas','gasFeeQkiWei','gasFeeBaseRaw','netProfitRaw','gasValuationPath'];
  const cell=x=>{let s=String(x??'');if(/^[\s]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  const m=data.metadata;return '\uFEFF'+[headers,...data.results.map(r=>[m.chainId,m.block,m.blockHash,m.scannedAt,m.base,m.baseName,m.decimals,m.maxHops,m.inputCap,m.walletBalanceRaw,m.routerAllowanceRaw,m.customBalanceRaw,m.customAllowanceRaw,m.effectiveBalanceRaw,m.effectiveAllowanceRaw,m.limit,m.truncated,m.unresolved,m.quoteRejected,m.modelMismatch,r.pathNames.join(' → '),JSON.stringify(r.path),r.amountInRaw,r.amountOutRaw,r.grossProfitRaw,r.netRoiPercent,r.modelExact,r.modelMaxProfitUpperRaw,true,r.tradeSimulation?.status,m.simulationSender,r.tradeSimulation?.method,r.tradeSimulation?.deadline,r.tradeSimulation?.amountOutMinRaw,m.gasPriceWei,r.gasEstimate,r.gasFeeQkiWei,r.gasFeeBaseRaw,r.netProfitRaw,JSON.stringify(m.gasValuationPath)])].map(row=>row.map(cell).join(',')).join('\r\n');
}
