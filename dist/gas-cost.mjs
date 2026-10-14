export const GAS_PRICE_WEI=1000n*10n**9n;
export const WQKI='0x835f6df988b6f51c9477d49e96adbbc644ba97a2';
export function gweiToWei(value){
  value=String(value).trim();if(!/^\d+(?:\.\d{1,9})?$/.test(value))throw Error('Gas Price 必须是最多 9 位小数的 Gwei 数量');
  const [whole,fraction='']=value.split('.'),wei=BigInt(whole)*1000000000n+BigInt((fraction+'000000000').slice(0,9));
  if(wei<1n||wei>(1n<<256n)-1n)throw Error('Gas Price 必须大于 0 且不能超过 uint256 上限');return wei;
}
export function gasCost(gas,gasPriceWei=GAS_PRICE_WEI){if(gas<=0n)throw Error('无效 gas 估算');if(gasPriceWei<=0n)throw Error('无效 Gas Price');return gas*gasPriceWei}
export function valuationPath(base,pairs){
  base=base.toLowerCase();if(base===WQKI)return [WQKI];
  const queue=[[WQKI]],seen=new Set([WQKI]);
  for(let i=0;i<queue.length;i++){const path=queue[i];if(path.length>3)continue;for(const p of pairs.values()){const last=path.at(-1),next=p.token0===last?p.token1:p.token1===last?p.token0:null;if(!next||seen.has(next))continue;const extended=[...path,next];if(next===base)return extended;seen.add(next);queue.push(extended)}}
  throw Error('找不到 WQKI 到起止币的 gas 费用换算路径（最多 3 跳）；请加入中间币或改用 WQKI 起止');
}
