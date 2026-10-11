import {address,decode,encode,uint} from './abi.mjs';
import {CHAIN,ENDPOINTS,ROUTER} from './network.mjs';
import {encodeApprove,encodeSwap} from './trade-check.mjs';
import {parsePath} from './path.mjs';

const CHAIN_HEX='0x'+BigInt(CHAIN).toString(16),GAS_PRICE_WEI=1000000000000n;
const $=id=>document.getElementById(id);
const provider=()=>window.ethereum;
const txError=error=>error?.code===4001?'已在钱包中取消':String(error?.shortMessage||error?.message||error||'钱包操作失败').slice(0,500);
export function slippageBps(value){
  if(!/^\d+(?:\.\d{1,2})?$/.test(String(value).trim()))throw Error('滑点必须是 0–50 之间、最多两位小数的百分比');
  const [whole,fraction='']=String(value).trim().split('.'),bps=BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));
  if(bps<0n||bps>5000n)throw Error('滑点必须在 0–50% 之间');return bps;
}
export function minimumOutput(quoted,bps){if(quoted<=0n)throw Error('报价输出必须大于 0');return quoted*(10000n-bps)/10000n}
export function gweiToWei(value){
  if(!/^\d+(?:\.\d{1,9})?$/.test(String(value).trim()))throw Error('gas price 必须是最多 9 位小数的 gwei 数量');
  const [whole,fraction='']=String(value).trim().split('.'),wei=BigInt(whole)*1000000000n+BigInt((fraction+'000000000').slice(0,9));
  if(wei<1n||wei>(1n<<256n)-1n)throw Error('gas price 超出范围');return wei;
}
export const chainHex=CHAIN_HEX;
function accountWord(account){address(account);return account.slice(2).toLowerCase().padStart(64,'0')}
function setStatus(message,error=false){$('walletStatus').textContent=message;$('walletStatus').className='hint'+(error?' error':'')}
async function request(method,params=[]){const p=provider();if(!p?.request)throw Error('未检测到浏览器钱包，请安装支持 EIP-1193 的钱包扩展');return p.request({method,params})}
async function ensureChain(){
  if(BigInt(await request('eth_chainId'))===BigInt(CHAIN))return;
  try{await request('wallet_switchEthereumChain',[{chainId:CHAIN_HEX}])}
  catch(error){
    if(error?.code!==4902)throw error;
    await request('wallet_addEthereumChain',[{chainId:CHAIN_HEX,chainName:'QKI Chain',nativeCurrency:{name:'QKI',symbol:'QKI',decimals:18},rpcUrls:ENDPOINTS.filter(url=>url.includes('qkirpc.org'))}]);
  }
  if(BigInt(await request('eth_chainId'))!==BigInt(CHAIN))throw Error('钱包网络不是 Chain ID '+CHAIN);
}
let account='';
function renderAccount(){
  $('walletAccount').value=account;
  $('connectWallet').textContent=account?'已连接 '+account.slice(0,6)+'…'+account.slice(-4):'连接浏览器钱包';
  $('disconnectWallet').hidden=!account;
  if(account&&!$('scanWallet').value){$('scanWallet').value=account}
}
async function connect(){await ensureChain();const accounts=await request('eth_requestAccounts');if(!accounts?.length)throw Error('钱包没有返回账户');account=address(accounts[0]);renderAccount();return account}
async function current(){if(!account)await connect();await ensureChain();return account}
function values(){const path=parsePath($('path').value),amount=uint($('amount').value.trim());return {path,amount}}
async function tokenState(requireBalance=true){
  const owner=await current(),{path,amount}=values(),token=path[0];
  const [balanceHex,allowanceHex]=await Promise.all([
    request('eth_call',[{to:token,data:'0x70a08231'+accountWord(owner)},'latest']),
    request('eth_call',[{to:token,data:'0xdd62ed3e'+accountWord(owner)+ROUTER.slice(2).toLowerCase().padStart(64,'0')},'latest'])
  ]);
  const balance=BigInt(balanceHex),allowance=BigInt(allowanceHex);
  $('walletBalance').value=balance.toString();$('walletAllowance').value=allowance.toString();
  if(requireBalance&&balance<amount)throw Error('输入 Token 余额不足：需要 '+amount+' raw，当前 '+balance+' raw');
  return {owner,path,amount,token,balance,allowance};
}
async function waitReceipt(hash){
  for(let i=0;i<60;i++){const receipt=await request('eth_getTransactionReceipt',[hash]);if(receipt)return receipt;await new Promise(resolve=>setTimeout(resolve,2000))}
  return null;
}
async function run(button,task){if(button.disabled)return;button.disabled=true;try{await task()}finally{button.disabled=false}}
function addField(grid,id,label,placeholder,value=''){
  const box=document.createElement('div'),title=document.createElement('label'),input=document.createElement('input');title.htmlFor=id;title.textContent=label;input.id=id;input.placeholder=placeholder;input.value=value;input.autocomplete='off';box.append(title,input);grid.append(box);return input;
}
function setupCustomFields(){
  const grid=document.querySelector('.wallet-grid');
  addField(grid,'approvalAmount','自定义授权数量（raw）','留空：采用 amountIn');
  addField(grid,'swapRecipient','自定义收款地址','留空：采用当前钱包账户');
  addField(grid,'swapMinimumOverride','自定义 amountOutMin（raw）','留空：按报价和滑点计算');
  addField(grid,'swapGasPrice','自定义 gas price（gwei）','必须大于 0','1000');
}
export function initWallet(){
  setupCustomFields();
  renderAccount();
  setStatus('等待连接钱包。gas price 默认 1000 gwei，可在交易参数中修改。');
  $('connectWallet').onclick=()=>run($('connectWallet'),async()=>{try{setStatus('等待钱包连接和网络确认…');await connect();setStatus('✓ 钱包已连接 · Chain ID '+CHAIN);await tokenState().catch(error=>setStatus('已连接；'+error.message,true))}catch(error){setStatus(txError(error),true)}});
  $('disconnectWallet').onclick=()=>{account='';renderAccount();$('walletBalance').value='';$('walletAllowance').value='';setStatus('已在本页面断开显示；钱包扩展中的授权连接可能仍保留。')};
  $('refreshWallet').onclick=()=>run($('refreshWallet'),async()=>{try{setStatus('正在读取余额与授权…');const state=await tokenState();setStatus('✓ 余额与授权已更新'+(state.allowance>=state.amount?' · 当前输入数量已获授权':' · 需要先授权'))}catch(error){setStatus(txError(error),true)}});
  $('approveToken').onclick=()=>run($('approveToken'),async()=>{try{
    setStatus('正在检查授权…');const state=await tokenState(false),custom=$('approvalAmount').value.trim(),approval=custom?uint(custom):state.amount;if(state.allowance>=approval){setStatus('✓ 当前 Router allowance 已覆盖自定义授权数量，无需重复授权');return}
    setStatus('请在钱包中确认授权 '+approval+' raw…');const hash=await request('eth_sendTransaction',[{from:state.owner,to:state.token,value:'0x0',data:encodeApprove(ROUTER,approval)}]);
    $('walletTxHash').value=hash;setStatus('授权已提交：'+hash+' · 等待链上确认…');const receipt=await waitReceipt(hash);
    if(!receipt){setStatus('授权已提交，但 120 秒内未查询到回执。可稍后刷新余额与授权。');return}
    if(BigInt(receipt.status??'0x0')!==1n)throw Error('授权交易已上链但执行失败：'+hash);
    await tokenState();setStatus('✓ 授权已确认：'+hash);
  }catch(error){setStatus(txError(error),true)}});
  $('sendSwap').onclick=()=>run($('sendSwap'),async()=>{try{
    setStatus('正在读取最新报价和授权…');const state=await tokenState();if(state.allowance<state.amount)throw Error('Router allowance 不足，请先点击“授权当前输入数量”');
    const quote=decode(await request('eth_call',[{to:ROUTER,data:encode(state.amount.toString(),state.path)},'latest']),state.path.length).map(BigInt);
    const automaticMinimum=minimumOutput(quote.at(-1),slippageBps($('swapSlippage').value)),customMinimum=$('swapMinimumOverride').value.trim(),minOut=customMinimum?uint(customMinimum):automaticMinimum;
    const minutes=$('swapDeadline').value.trim();if(!/^\d+$/.test(minutes)||BigInt(minutes)<1n||BigInt(minutes)>1440n)throw Error('交易有效期必须是 1–1440 分钟');
    const deadline=BigInt(Math.floor(Date.now()/1000))+BigInt(minutes)*60n,recipient=$('swapRecipient').value.trim()?address($('swapRecipient').value.trim()):state.owner,gasPrice=gweiToWei($('swapGasPrice').value);
    $('swapQuote').value=quote.at(-1).toString();$('swapMinimum').value=minOut.toString();
    setStatus('请在钱包中确认兑换；最低输出 '+minOut+' raw…');
    const hash=await request('eth_sendTransaction',[{from:state.owner,to:ROUTER,value:'0x0',gasPrice:'0x'+gasPrice.toString(16),data:encodeSwap(state.amount,state.path,recipient,deadline,minOut)}]);
    $('walletTxHash').value=hash;setStatus('兑换已提交：'+hash+' · 等待链上确认…');const receipt=await waitReceipt(hash);
    if(!receipt){setStatus('兑换已提交，但 120 秒内未查询到回执：'+hash);return}
    if(BigInt(receipt.status??'0x0')!==1n)throw Error('兑换交易已上链但执行失败：'+hash);
    setStatus('✓ 兑换已确认：'+hash);
  }catch(error){setStatus(txError(error),true)}});
  const p=provider();if(p?.on){p.on('accountsChanged',accounts=>{account=accounts?.[0]&&/^0x[0-9a-f]{40}$/i.test(accounts[0])?accounts[0]:'';renderAccount();setStatus(account?'钱包账户已切换，请刷新余额与授权':'钱包已断开')});p.on('chainChanged',()=>setStatus('钱包网络已变化，请重新检查 Chain ID 与余额'))}
}
