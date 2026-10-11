import {TOKENS} from './tokens.mjs';
import {address} from './abi.mjs';
const KEY='path-quote:20181205:custom-tokens:v1';
let custom=[];
export let storageWarning='';
function normalized(name,addr){
  if(typeof name!=='string'||typeof addr!=='string')throw Error('请输入名称与合约地址');
  name=name.trim();addr=addr.trim();
  if(!name||name.length>24||/[\u0000-\u001f\u007f]/.test(name))throw Error('Token 名称需要 1–24 个字符');
  address(addr);return {name,address:addr,custom:true};
}
export function getTokens(){return [...TOKENS,...custom]}
function duplicate(token,list){return list.some(t=>t.address.toLowerCase()===token.address.toLowerCase()||t.name.toLowerCase()===token.name.toLowerCase())}
try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'[]');
  if(!Array.isArray(saved))throw Error('invalid saved tokens');
  for(const item of saved.slice(0,100)){try{const t=normalized(item?.name,item?.address);if(!duplicate(t,getTokens()))custom.push(t)}catch{storageWarning='部分已保存的 Token 数据无效，已跳过。'}}
}catch{storageWarning='无法读取浏览器保存的数据；自定义 Token 暂按当前页面使用。'}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(custom));return true}catch{return false}}
export function addToken(name,addr){
  const token=normalized(name,addr);
  if(duplicate(token,getTokens()))throw Error('名称或合约地址已存在，请直接搜索使用');
  if(custom.length>=100)throw Error('最多保存 100 个自定义 Token，请先删除不需要的项目');
  custom.push(token);return {token,saved:persist()};
}
export function removeToken(addr){custom=custom.filter(t=>t.address.toLowerCase()!==addr.toLowerCase());return persist()}
