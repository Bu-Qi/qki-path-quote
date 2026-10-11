import {address} from './abi.mjs';
export function parsePath(value){
  const s=value.trim(),items=s.startsWith('[')?JSON.parse(s):s.split(/[\s,，]+/).filter(Boolean);
  if(!Array.isArray(items)||items.some(x=>typeof x!=='string'))throw Error('路径必须是地址字符串数组');
  items.forEach(address);
  if(items.length>20)throw Error('路径最多支持 20 个 Token');
  return items;
}
