export const GAS_PRICE_WEI=1000n*10n**9n;
export const WQKI='0x835f6df988b6f51c9477d49e96adbbc644ba97a2';
export function gasCost(gas){if(gas<=0n)throw Error('无效 gas 估算');return gas*GAS_PRICE_WEI}
export function valuationPath(base,pairs){
  base=base.toLowerCase();if(base===WQKI)return [WQKI];
  const queue=[[WQKI]],seen=new Set([WQKI]);
  for(let i=0;i<queue.length;i++){const path=queue[i];if(path.length>3)continue;for(const p of pairs.values()){const last=path.at(-1),next=p.token0===last?p.token1:p.token1===last?p.token0:null;if(!next||seen.has(next))continue;const extended=[...path,next];if(next===base)return extended;seen.add(next);queue.push(extended)}}
  throw Error('找不到 WQKI 到起止币的 gas 费用换算路径（最多 3 跳）；请加入中间币或改用 WQKI 起止');
}
