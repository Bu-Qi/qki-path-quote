import {encode,decode,units} from './abi.mjs';
import './picker.mjs';
import {parsePath} from './path.mjs';
import {initUtilities} from './utilities.mjs';
import {initScanner} from './scanner-ui.mjs';
import {address} from './abi.mjs';
import {simulate} from './simulation.mjs';
import {ENDPOINTS,ROUTER,CHAIN,rpc,quantity,measure,rankNodes,failover} from './network.mjs';
const $=id=>document.getElementById(id);
function paths(){return parsePath($('path').value)}
function text(parent,tag,content,cls){const el=document.createElement(tag);el.textContent=content;if(cls)el.className=cls;parent.append(el);return el}
$('reverse').onclick=()=>{try{$('path').value=JSON.stringify(paths().reverse());$('path').dispatchEvent(new Event('input'))}catch(error){$('pickerNotice').textContent='无法反转：'+error.message}};
function formatPath(){try{const formatted=JSON.stringify(paths());if($('path').value!==formatted){$('path').value=formatted;$('path').dispatchEvent(new Event('input'))}return formatted}catch(error){$('pickerNotice').textContent='路径格式错误：'+error.message;return null}}
$('path').addEventListener('blur',formatPath);
$('copyPath').onclick=async()=>{const formatted=formatPath();if(formatted===null)return;try{await navigator.clipboard.writeText(formatted);$('pickerNotice').textContent='已复制 JSON 路径'}catch{$('path').focus();$('path').select();$('pickerNotice').textContent='浏览器未允许自动复制，已选中路径，请按 Ctrl+C / ⌘C 复制'}};
let ranked=[],measuredAt=0,testing=null,busy=false;
function buttons(){ $('retest').disabled=busy||!!testing;$('submit').disabled=busy||!!testing;$('simulate').disabled=busy||!!testing; }
function showNode(node){$('rpc').value=node.url;$('networkStatus').textContent='Chain ID '+CHAIN+' · '+node.ms+' ms / 请求 · 查询失败时自动切换';}
async function speedtest(){
  if(testing)return testing;
  testing=(async()=>{
    ranked=[];$('rpc').value='正在检测 11 个固定节点…';$('nodeList').replaceChildren();
    ENDPOINTS.forEach(url=>text($('nodeList'),'div',url,'addr'));
    $('networkStatus').className='hint';$('networkStatus').textContent='正在测试 Chain ID 和区块高度，约需 1–9 秒…';
    try{
      const rows=await measure();$('nodeList').replaceChildren();
      rows.forEach(row=>text($('nodeList'),'div',row.url+' · '+(row.ok?row.ms+' ms · 区块 '+row.block:row.error),'addr'));
      ranked=rankNodes(rows);measuredAt=Date.now();showNode(ranked[0]);
    }catch(error){$('rpc').value='暂无可用节点';$('networkStatus').textContent=error.message;$('networkStatus').className='hint error'}
  })();
  buttons();try{await testing}finally{testing=null;buttons()}
}
$('retest').onclick=speedtest;
$('form').onsubmit=async e=>{
  e.preventDefault();if(busy)return;busy=true;buttons();$('status').className='';$('status').textContent='正在读取链上状态…';$('output').replaceChildren();
  try{
    const path=paths(),amount=$('amount').value.trim(),data=encode(amount,path);
    if(testing)await testing;
    if(!ranked.length||Date.now()-measuredAt>60000)await speedtest();
    if(!ranked.length)throw Error('暂无可用 RPC，请重新测速');
    const {node,block,quoted}=await failover(ranked,async node=>{
      if(quantity(await rpc(node.url,'eth_chainId',[])).toString()!==CHAIN)throw Error('节点 Chain ID 不匹配');
      const block=await rpc(node.url,'eth_blockNumber',[]);quantity(block);
      const quoted=decode(await rpc(node.url,'eth_call',[{to:ROUTER,data},block]),path.length);
      return {node,block,quoted};
    },showNode);
    const precisions=await Promise.all(path.map(async to=>{try{const v=await rpc(node.url,'eth_call',[{to,data:'0x313ce567'},block]);if(!/^0x[0-9a-fA-F]{64}$/.test(v))return null;const d=BigInt(v);return d<=255n?Number(d):null}catch{return null}}));
    path.forEach((token,i)=>{const row=text($('output'),'div','','step');text(row,'small',i===0?'输入 TOKEN':i===path.length-1?'最终输出 TOKEN':'第 '+i+' 跳输出');text(row,'div',token,'addr');text(row,'div',precisions[i]===null?quoted[i]:units(quoted[i],precisions[i]),'quantity');text(row,'div','raw: '+quoted[i]+' · '+(precisions[i]===null?'精度读取失败，仅显示原始整数':'decimals: '+precisions[i]),'raw')});
    text($('output'),'div','Chain ID '+CHAIN+' · Block '+BigInt(block)+' · '+new Date().toLocaleString()+' · '+node.url,'meta');
    $('status').textContent='✓ 查询完成 · '+(path.length-1)+' 跳 · 结果为本次输入快照';
  }catch(error){$('status').textContent=error.message;$('status').className='error'}finally{busy=false;buttons()}
};
$('simulate').onclick=async()=>{
  if(busy)return;busy=true;buttons();$('simStatus').className='hint';$('simStatus').textContent='准备读取循环路径…';$('simOutput').replaceChildren();
  try{
    if(testing)await testing;
    if(!ranked.length||Date.now()-measuredAt>60000)await speedtest();
    if(!ranked.length)throw Error('暂无可用 RPC，请重新测速');
    await simulate(paths(),ranked,showNode);
  }catch(error){$('simStatus').textContent=error.message;$('simStatus').className='hint error'}finally{busy=false;buttons()}
};
for(const id of ['path','simCap'])$(id).addEventListener('input',()=>{if($('simOutput').childElementCount)$('simStatus').textContent='输入已变化，请重新模拟；下方是上一次结果。'});
initUtilities(async token=>{
  address(token);
  if(testing)await testing;
  if(!ranked.length||Date.now()-measuredAt>60000)await speedtest();
  if(!ranked.length)throw Error('暂无可用 RPC');
  return failover([...ranked],async node=>{
    if(quantity(await rpc(node.url,'eth_chainId',[])).toString()!==CHAIN)throw Error('Chain ID 不匹配');
    const result=await rpc(node.url,'eth_call',[{to:token,data:'0x313ce567'},'latest']);
    if(!/^0x[0-9a-fA-F]{64}$/.test(result)||BigInt(result)>255n)throw Error('合约没有返回有效精度');
    return Number(BigInt(result));
  });
});
initScanner(async()=>{
  if(testing)await testing;
  if(!ranked.length||Date.now()-measuredAt>60000)await speedtest();
  if(!ranked.length)throw Error('暂无可用 RPC');
  return [...ranked];
});
speedtest();
