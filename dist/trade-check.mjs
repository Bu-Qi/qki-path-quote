import {address,word,encode,MAX} from './abi.mjs';
// Read-only call data for swapExactTokensForTokens; never broadcast.
export function encodeSwap(input,path,sender,deadline){
  address(sender);encode(input.toString(),path);
  if(input>=MAX||deadline<0n||deadline>MAX)throw Error('模拟参数超出范围');
  return '0x38ed1739'+word(input)+word(input+1n)+word(160)+sender.slice(2).toLowerCase().padStart(64,'0')+word(deadline)+word(path.length)+path.map(a=>a.slice(2).toLowerCase().padStart(64,'0')).join('');
}
export function failureType(error){
  const text=String(error.rpcMessage??error.message??'');
  return error.rpcCode===3||/execution reverted|\brevert(?:ed)?\b/i.test(text)?'reverted':'unverified';
}
