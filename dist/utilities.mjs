import {decimals,toRaw,toHuman,deadline} from './conversion.mjs';
import {getTokens} from './custom-tokens.mjs';
import {parsePath} from './path.mjs';
const $=id=>document.getElementById(id);
export function initUtilities(readDecimals){
  let expires=null,raw=null,readVersion=0;
  const message=(id,value,error=false)=>{ $(id).textContent=value;$(id).className=error?'hint error':'hint'; };
  function tick(){const now=Math.floor(Date.now()/1000);if(document.activeElement!==$('unixNow'))$('unixNow').value=String(now);$('clockLocal').textContent=new Date().toLocaleString()+' · '+Intl.DateTimeFormat().resolvedOptions().timeZone;if(expires!==null)$('deadlineRemaining').textContent=expires>now?'剩余 '+(expires-now)+' 秒 · '+new Date(expires*1000).toLocaleString():'已过期，请重新生成';}
  function generate(){try{expires=deadline(Date.now(),$('deadlineMinutes').value.trim());$('deadlineValue').value=String(expires);message('timeStatus','deadline 已固定；再次点击生成才会更新。');tick()}catch(e){message('timeStatus',e.message,true)}}
  async function copy(id,status){const input=$(id);if(!input.value){message(status,'暂无可复制的结果',true);return}const value=input.value;try{await navigator.clipboard.writeText(value);message(status,'已复制：'+value)}catch{input.focus();input.select();message(status,'已选中，请按 Ctrl+C / ⌘C 复制')}}
  $('generateDeadline').onclick=generate;
  $('copyNow').onclick=()=>{ $('unixNow').value=String(Math.floor(Date.now()/1000));copy('unixNow','timeStatus'); };
  $('copyDeadline').onclick=()=>copy('deadlineValue','timeStatus');
  tick();generate();setInterval(tick,1000);document.addEventListener('visibilitychange',tick);
  function refreshTokens(){const previous=$('conversionToken').value;const select=$('conversionToken');select.replaceChildren();const manual=document.createElement('option');manual.value='';manual.textContent='手动填写精度 / 自定义地址';select.append(manual);for(const t of getTokens()){const option=document.createElement('option');option.value=t.address;option.textContent=t.name+' · '+t.address.slice(0,8)+'…'+t.address.slice(-4);select.append(option)}select.value=previous;}
  function invalidate(){raw=null;$('conversionResult').value='';$('copyConversion').disabled=true;$('useConversion').disabled=true;}
  async function loadDecimals(){const version=++readVersion;invalidate();const addr=$('conversionAddress').value.trim();$('conversionDecimals').value='';message('conversionStatus','正在读取 decimals()…');try{const d=await readDecimals(addr);if(version!==readVersion)return;$('conversionDecimals').value=String(d);message('conversionStatus','已从 Chain ID 20181205 读取精度：'+d)}catch(e){if(version===readVersion)message('conversionStatus','精度读取失败：'+e.message+'。可手动填写。',true)}}
  refreshTokens();$('conversionToken').addEventListener('focus',refreshTokens);
  $('conversionToken').onchange=()=>{++readVersion;invalidate();$('conversionAddress').value=$('conversionToken').value;$('conversionDecimals').value='';if($('conversionToken').value)loadDecimals();else message('conversionStatus','请手动填写精度，或输入 Token 地址后读取。')};
  $('readDecimals').onclick=loadDecimals;
  for(const id of ['conversionAddress','conversionDecimals','humanQuantity','rawQuantity'])$(id).addEventListener('input',()=>{++readVersion;invalidate();if(id==='conversionAddress'){$('conversionToken').value='';$('conversionDecimals').value=''}message('conversionStatus','输入已改变，请重新转换。')});
  function convert(direction){invalidate();try{const d=decimals($('conversionDecimals').value.trim());if(direction==='raw'){raw=toRaw($('humanQuantity').value.trim(),d);$('rawQuantity').value=raw;$('conversionResult').value=raw}else{const human=toHuman($('rawQuantity').value.trim(),d);raw=toRaw(human,d);$('humanQuantity').value=human;$('conversionResult').value=human}message('conversionStatus',(direction==='raw'?'链上整数':'普通数量')+' · 精度 '+d+' · 已精确转换');$('copyConversion').disabled=false;$('useConversion').disabled=false}catch(e){message('conversionStatus',e.message,true)}}
  $('humanToRaw').onclick=()=>convert('raw');$('rawToHuman').onclick=()=>convert('human');
  $('copyConversion').onclick=()=>copy('conversionResult','conversionStatus');
  $('useConversion').onclick=()=>{if(raw===null)return;try{if(raw==='0')throw Error('报价输入数量需要大于 0');const path=parsePath($('path').value),token=$('conversionAddress').value.trim();if(token&&path.length&&path[0].toLowerCase()!==token.toLowerCase())throw Error('当前 Token 与路径首个 Token 不一致');$('amount').value=raw;$('amount').focus();message('conversionStatus','已将链上整数填入 amountIn')}catch(e){message('conversionStatus',e.message,true)}};
}
