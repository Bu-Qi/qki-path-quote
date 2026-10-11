import {address,word,encode,MAX} from './abi.mjs';
export function encodeSwap(input,path,sender,deadline,minimumOutput=input+1n){
  address(sender);encode(input.toString(),path);
  if(input>=MAX||minimumOutput<0n||minimumOutput>MAX||deadline<0n||deadline>MAX)throw Error('交易参数超出范围');
  return '0x38ed1739'+word(input)+word(minimumOutput)+word(160)+sender.slice(2).toLowerCase().padStart(64,'0')+word(deadline)+word(path.length)+path.map(a=>a.slice(2).toLowerCase().padStart(64,'0')).join('');
}
export function encodeFeeSwap(input,path,sender,deadline,minimumOutput){
  const standard=encodeSwap(input,path,sender,deadline,minimumOutput);
  return '0x5c11d795'+standard.slice(10);
}
export function encodeApprove(spender,amount){address(spender);if(amount<0n||amount>MAX)throw Error('授权数量超出 uint256 范围');return '0x095ea7b3'+spender.slice(2).toLowerCase().padStart(64,'0')+word(amount)}
export function failureType(error){
  const text=String(error.rpcMessage??error.message??'');
  return error.rpcCode===3||/execution reverted|\brevert(?:ed)?\b/i.test(text)?'reverted':'unverified';
}
