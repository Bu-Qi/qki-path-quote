export const ENDPOINTS=Object.freeze(['https://116.62.144.117','https://118.178.121.168','https://101.132.39.198','https://8.210.130.36','https://139.224.206.117','https://rpc1.qkirpc.org','https://rpc2.qkirpc.org','https://rpc3.qkirpc.org','https://rpc1.qkiscan.io','https://rpc2.qkiscan.io','https://rpc3.qkiscan.io']);
export const ROUTER='0x3c91FD5247B050A1536F24D012a17a618EEFbfCA';
export const CHAIN='20181205';
let requestId=0;
export async function rpc(url,method,params,timeout=8000,signal){
  const id=++requestId;let response;
  try{response=await fetch(url,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:signal?AbortSignal.any([AbortSignal.timeout(timeout),signal]):AbortSignal.timeout(timeout)})}catch{if(signal?.aborted)throw Error('扫描已取消');throw Error('连接失败或超时（可能为 TLS 证书、CORS 或网络问题）')}
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(data.error){const error=Error('RPC 调用失败（'+data.error.code+'）：检查路径流动性、Router 兼容性或节点限流');error.rpcCode=data.error.code;error.rpcMessage=String(data.error.message??'').slice(0,500);throw error}
  if(data.id!==id||data.result===undefined)throw Error('无效 RPC 响应');
  return data.result;
}
export function quantity(v){if(typeof v!=='string'||!/^0x[0-9a-f]+$/i.test(v))throw Error('无效链状态');return BigInt(v)}
export function rankNodes(rows){
  const available=rows.filter(r=>r.ok&&r.chain===CHAIN);
  if(!available.length)throw Error('暂无 Chain ID 20181205 的可用节点。请检查网络、TLS 证书和 CORS。');
  const highest=available.reduce((m,r)=>BigInt(r.block)>m?BigInt(r.block):m,0n);
  return available.filter(r=>highest-BigInt(r.block)<=5n).sort((a,b)=>a.ms-b.ms);
}
export async function measure(call=rpc,now=()=>performance.now()){
  return Promise.all(ENDPOINTS.map(async url=>{try{
    const start=now(),chain=quantity(await call(url,'eth_chainId',[],4500)).toString();
    if(chain!==CHAIN)throw Error('Chain ID 不匹配：'+chain);
    const block=quantity(await call(url,'eth_blockNumber',[],4500)).toString();
    return {url,ok:true,chain,block,ms:Math.max(1,Math.round((now()-start)/2))};
  }catch(error){return {url,ok:false,error:error.message}}}));
}
export async function failover(nodes,operation,onAttempt=()=>{}){
  let last;for(const node of nodes){onAttempt(node);try{return await operation(node)}catch(error){last=error}}
  throw Error('可用节点均查询失败：'+(last?.message??'请重新测速'));
}
