import assert from 'node:assert/strict';
import {scan,key,enumerate,poolsFor,filterResults,exportData,toCSV} from './dist/scanner-core.mjs';
import {optimize,quote} from './dist/optimizer.mjs';
import {word} from './dist/abi.mjs';
import {CHAIN,ROUTER} from './dist/network.mjs';
import {encodeSwap,failureType} from './dist/trade-check.mjs';
import {WQKI,GAS_PRICE_WEI,gasCost,valuationPath} from './dist/gas-cost.mjs';
const address=i=>'0x'+i.toString(16).padStart(40,'0');
const six=Array.from({length:6},(_,i)=>({name:'T'+i,address:i===0?WQKI:address(i+1)})),complete=new Map();
let n=100;for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)complete.set(key(six[i].address,six[j].address),{pair:address(n++)});
for(const [hops,count] of [[3,20],[4,80],[5,200],[6,320]]){
  const r=enumerate(six[0].address,six,complete,hops,1000);assert.equal(r.routes.length,count);assert.equal(r.truncated,false);
  for(const path of r.routes){assert.equal(path[0],path.at(-1));assert(path.length-1<=hops);assert.equal(new Set(path.slice(0,-1)).size,path.length-1)}
}
assert.equal(enumerate(six[0].address,six,complete,6,20).truncated,true);
assert.equal(enumerate(six[0].address,six,complete,6,320).truncated,false);
assert.equal(enumerate(six[0].address,six,new Map(),6,10).routes.length,0);
const tokens=six.slice(0,3),[a,b,c]=tokens.map(t=>t.address),scale=10n**18n,factory=address(999),hash='0x'+'ab'.repeat(32),block='0x123';
const pairs=new Map([[key(a,b),{pair:address(100),token0:a,token1:b,r0:1000n*scale,r1:2000n*scale}],[key(a,c),{pair:address(101),token0:a,token1:c,r0:1000n*scale,r1:1000n*scale}],[key(b,c),{pair:address(102),token0:b,token1:c,r0:1000n*scale,r1:1000n*scale}]]);
const aw=a=>'0x'+a.slice(2).padStart(64,'0');let calls=0;
async function read(url,method,params){calls++;
  if(method==='eth_chainId')return '0x'+BigInt(CHAIN).toString(16);
  if(method==='eth_getBlockByNumber')return {hash,number:block,timestamp:'0x6553f100'};
  if(method==='eth_estimateGas'){assert.equal(params[1],block);assert.equal(BigInt(params[0].gasPrice),GAS_PRICE_WEI);return '0x30d40'}
  assert.equal(method,'eth_call');assert.equal(params[1],block);
  const {to,data}=params[0];
  if(data==='0xc45a0155'){assert.equal(to,ROUTER);return aw(factory)}
  if(data==='0x313ce567')return '0x'+word(18);
  if(data.startsWith('0x70a08231')||data.startsWith('0xdd62ed3e'))return '0x'+word(1000n*scale);
  if(data.startsWith('0x38ed1739')){
    assert.equal(params[0].from,address(777));assert.equal(params[0].value,'0x0');assert.equal(to,ROUTER);
    const amount=BigInt('0x'+data.slice(10,74));assert.equal(BigInt('0x'+data.slice(74,138)),amount+1n);assert.equal(BigInt('0x'+data.slice(138,202)),160n);assert.equal('0x'+data.slice(226,266),address(777));assert.equal(BigInt('0x'+data.slice(266,330)),1700001200n);
    const count=Number(BigInt('0x'+data.slice(330,394))),path=Array.from({length:count},(_,i)=>'0x'+data.slice(418+i*64,458+i*64));
    const out=quote(amount,poolsFor(path,pairs));return '0x'+word(32)+word(out.length)+out.map(word).join('');
  }
  if(data.startsWith('0xe6a43905')){const x='0x'+data.slice(34,74),y='0x'+data.slice(98,138);return aw(pairs.get(key(x,y))?.pair??address(0))}
  const p=[...pairs.values()].find(p=>p.pair===to);
  if(data==='0x0902f1ac')return '0x'+word(p.r0)+word(p.r1)+word(0);
  if(data==='0x0dfe1681')return aw(p.token0);
  if(data==='0xd21220a7')return aw(p.token1);
  if(data.startsWith('0xd06ca61f')){const amount=BigInt('0x'+data.slice(10,74)),count=Number(BigInt('0x'+data.slice(138,202))),path=Array.from({length:count},(_,i)=>'0x'+data.slice(202+i*64+24,266+i*64));const out=quote(amount,poolsFor(path,pairs));return '0x'+word(32)+word(out.length)+out.map(word).join('')}
  throw Error('Unexpected call');
}
const options={nodes:[{url:'mock'}],tokens,base:a,sender:address(777),maxHops:3,limit:100,read,solve:async(p,c)=>optimize(p,c,512)};
const result=await scan(options);assert.equal(result.pathCount,2);assert.equal(result.results.length,1);assert(result.results[0].profit>0n);assert.equal(result.block,'291');assert.equal(result.decimals,18);
assert.equal(filterResults(result.results,0n,0n,'roi').length,1);assert.equal(filterResults(result.results,result.results[0].profit+1n,0n,'profit').length,0);
const exp=exportData(result,result.results,{minimumGrossProfit:'0'}),json=JSON.parse(JSON.stringify(exp));assert.equal(json.results[0].amountInRaw,result.results[0].input.toString());assert.equal(json.results[0].path.length,4);assert.equal(json.metadata.gasIncluded,true);
exp.results[0].pathNames[0]='=DANGEROUS';assert(toCSV(exp).includes("'=DANGEROUS"));assert(toCSV(exp).includes('pathJSON'));
const controller=new AbortController();controller.abort();await assert.rejects(scan({...options,signal:controller.signal}),/取消/);
await assert.rejects(scan({...options,read:async(url,m,p)=>{if(m==='eth_getBlockByNumber'&&p[0]===block)return {hash:'0x'+'cd'.repeat(32)};return read(url,m,p)}}),/重组/);
await assert.rejects(scan({...options,read:async(url,m,p)=>{if(m==='eth_call'&&p[0].data==='0x0902f1ac')throw Error('transport failed');return read(url,m,p)}}),/transport/);
assert.equal(result.results[0].tradeSimulation.status,'passed');assert.equal(json.results[0].tradeSimulation.from,address(777));assert(toCSV(exp).includes('simulationStatus'));
const reverted=await scan({...options,read:async(url,m,p)=>{if(p[0]?.data?.startsWith('0x38ed1739')){const e=Error('blacklist');e.rpcCode=3;e.rpcMessage='execution reverted: blacklist';throw e}return read(url,m,p)}});assert.equal(reverted.results.length,0);assert.equal(reverted.tradeReverted,1);
const unsupported=await scan({...options,read:async(url,m,p)=>{if(p[0]?.data?.startsWith('0x38ed1739')){const e=Error('node unavailable');e.rpcCode=-32601;throw e}return read(url,m,p)}});assert.equal(unsupported.results.length,0);assert.equal(unsupported.tradeUnverified,1);
for(const selector of ['0x70a08231','0xdd62ed3e'])await assert.rejects(scan({...options,read:async(url,m,p)=>p[0]?.data?.startsWith(selector)?'0x'+word(0):read(url,m,p)}),/余额|授权/);
const limited=await scan({...options,read:async(url,m,p)=>p[0]?.data?.startsWith('0xdd62ed3e')?'0x'+word(scale):read(url,m,p)});assert.equal(limited.inputCap,scale.toString());assert(limited.results.every(r=>r.input<=scale));
assert.equal(failureType({rpcCode:-32000,rpcMessage:'execution reverted'}),'reverted');assert.equal(failureType({rpcCode:-32000,rpcMessage:'insufficient funds'}),'unverified');
assert.throws(()=>encodeSwap(1n,[a,b,c,a],'bad',10n));
assert.equal(GAS_PRICE_WEI,1000000000000n);assert.equal(gasCost(200000n),200000000000000000n);
assert.equal(result.results[0].netProfit,result.results[0].profit-200000000000000000n);
assert.equal(json.results[0].netProfitRaw,result.results[0].netProfit.toString());assert(toCSV(exp).includes('netProfitRaw'));
const expensive=await scan({...options,read:async(url,m,p)=>m==='eth_estimateGas'?'0x'+(10n**12n).toString(16):read(url,m,p)});assert.equal(expensive.results.length,0);assert.equal(expensive.gasUnprofitable,1);
const estimateFailure=await scan({...options,read:async(url,m,p)=>{if(m==='eth_estimateGas')throw Error('estimate unavailable');return read(url,m,p)}});assert.equal(estimateFailure.results.length,0);assert.equal(estimateFailure.tradeUnverified,1);
const otherBase=await scan({...options,base:b});assert.deepEqual(otherBase.gasValuationPath,[WQKI,b]);assert(otherBase.results.every(r=>r.netProfit===r.profit-r.gasFeeBase));
assert.throws(()=>valuationPath(b,new Map()),/换算/);
console.log('PASS: scanner + complete eth_call simulation, blacklist/revert exclusion, unverified RPC errors, balance/allowance limits, swap ABI, export status, cancellation and reorg; '+calls+' mock reads');
