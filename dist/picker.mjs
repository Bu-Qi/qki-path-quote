import {getTokens,addToken,removeToken,storageWarning} from './custom-tokens.mjs';
import {address} from './abi.mjs';
import {parsePath} from './path.mjs';
const search=document.getElementById('tokenSearch'),list=document.getElementById('tokenOptions'),path=document.getElementById('path'),notice=document.getElementById('pickerNotice');
function appendToken(token){
  try{
    const raw=path.value.trim();
    const entries=parsePath(raw);
    if(!Array.isArray(entries))throw Error('路径必须是地址数组');
    entries.forEach(address);
    if(entries.length>=20)throw Error('路径最多支持 20 个 token');
    if(entries.at(-1)?.toLowerCase()===token.address.toLowerCase())throw Error(token.name+' 已是路径最后一个 token，不能连续重复添加');
    path.value=JSON.stringify([...entries,token.address]);
    path.dispatchEvent(new Event('input',{bubbles:true}));
    notice.className='hint';notice.textContent='已添加 '+token.name+' · 当前路径 '+(entries.length+1)+' 个 token';
  }catch(error){notice.className='hint error';notice.textContent='未添加：'+(error instanceof SyntaxError?'请先修正路径 JSON 格式':error.message)}
}
function render(){
  const query=search.value.trim().toLowerCase();list.replaceChildren();
  const matches=getTokens().filter(t=>t.name.toLowerCase().includes(query)||t.address.toLowerCase().includes(query));
  for(const token of matches){
    const button=document.createElement('button');button.type='button';button.className='token-option';button.title=token.address;button.setAttribute('aria-label','追加 '+token.name+'，地址 '+token.address);
    const name=document.createElement('strong');name.textContent='+ '+token.name;
    const addr=document.createElement('span');addr.textContent=token.address.slice(0,8)+'…'+token.address.slice(-6);
    button.append(name,addr);button.onclick=()=>appendToken(token);
    const item=document.createElement('div');item.className='token-item';item.append(button);list.append(item);
    if(token.custom){const remove=document.createElement('button');remove.type='button';remove.className='token-remove';remove.textContent='删除自定义';remove.setAttribute('aria-label','删除自定义 Token '+token.name);remove.onclick=()=>{const saved=removeToken(token.address);render();notice.className='hint';notice.textContent='已从常用列表删除 '+token.name+'，当前路径保留。'+(saved?'':'浏览器保存失败，刷新后可能恢复。');search.focus()};item.append(remove)}
  }
  if(!matches.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='没有匹配的常用 Token，仍可在下方手动输入地址。';list.append(empty)}
}
search.addEventListener('input',render);
search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();list.querySelector('button')?.click()}});
render();
const customName=document.getElementById('customName'),customAddress=document.getElementById('customAddress'),customStatus=document.getElementById('customStatus');
function addCustom(){
  try{
    const {token,saved}=addToken(customName.value,customAddress.value);
    customStatus.className='hint';customStatus.textContent='已添加 '+token.name+'。'+(saved?'已保存在当前浏览器，可点击加入路径。':'浏览器存储不可用，仅本次页面有效。');
    customName.value='';customAddress.value='';search.value='';render();
  }catch(error){customStatus.className='hint error';customStatus.textContent=error.message}
}
document.getElementById('addCustomToken').onclick=addCustom;
for(const input of [customName,customAddress])input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCustom()}});
if(storageWarning){customStatus.textContent=storageWarning;customStatus.className='hint error'}
