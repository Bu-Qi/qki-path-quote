import {getTokens} from './custom-tokens.mjs';
import {scan,roi,filterResults,exportData,toCSV} from './scanner-core.mjs';
import {MAX_UINT} from './optimizer.mjs';
import {uint,units,address} from './abi.mjs';
import {toRaw,rawValue} from './conversion.mjs';
const $=id=>document.getElementById(id);
function el(parent,tag,value,cls){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;parent.append(e);return e}
export function initScanner(getNodes){
  let controller=null,snapshot=null,visible=[],selectionTokens=[];
  const controls=$('scanCap').closest('.scan-controls');
  for(const [id,label,placeholder] of [['scanBalanceOverride','自定义模拟余额','留空：采用链上余额'],['scanAllowanceOverride','自定义模拟 allowance','留空：采用链上 allowance']]){const box=document.createElement('div'),title=document.createElement('label'),input=document.createElement('input');title.htmlFor=id;title.textContent=label+'（起止币 raw）';input.id=id;input.inputMode='numeric';input.placeholder=placeholder;box.append(title,input);controls.append(box)}
  const overrideHint=document.createElement('p');overrideHint.className='hint';overrideHint.textContent='自定义余额与 allowance 只会收紧本次扫描的资金上限；不能替代链上真实余额或授权。';controls.after(overrideHint);
  function notice(s,error=false){$('scanStatus').textContent=s;$('scanStatus').className=error?'hint error':'hint'}
  function refresh(){
    const base=$('scanBase').value;selectionTokens=getTokens();$('scanBase').replaceChildren();$('scanTokens').replaceChildren();
    for(const t of selectionTokens){const option=el($('scanBase'),'option',t.name);option.value=t.address;const label=el($('scanTokens'),'label','','scan-check');const input=document.createElement('input');input.type='checkbox';input.value=t.address;input.checked=true;input.setAttribute('aria-label','扫描 '+t.name);label.prepend(input);el(label,'span',t.name);label.title=t.address}
    if(selectionTokens.some(t=>t.address===base))$('scanBase').value=base;
  }
  function busy(value){$('startScan').disabled=value;$('stopScan').disabled=!value;for(const id of ['scanWallet','scanBase','scanHops','scanLimit','scanCap','scanBalanceOverride','scanAllowanceOverride','refreshScanTokens','allScanTokens','noneScanTokens'])$(id).disabled=value;$('scanTokens').querySelectorAll('input').forEach(input=>input.disabled=value)}
  function format(value){return snapshot.decimals===null?value.toString():units(value.toString(),snapshot.decimals)}
  function filters(){return {minimumNetProfit:$('scanMinProfit').value.trim()||'0',minimumRoiPercent:$('scanMinROI').value.trim()||'0',sort:$('scanSort').value}}
  function render(){
    $('scanRows').replaceChildren();$('exportScanJSON').disabled=true;$('exportScanCSV').disabled=true;visible=[];if(!snapshot)return;
    try{const f=filters(),min=snapshot.decimals===null?BigInt(rawValue(f.minimumNetProfit)):BigInt(toRaw(f.minimumNetProfit,snapshot.decimals)),roiMin=BigInt(toRaw(f.minimumRoiPercent,4));visible=filterResults(snapshot.results.filter(r=>r.tradeSimulation?.status==='passed'),min,roiMin,f.sort);$('scanFilterStatus').textContent='显示 '+visible.length+' / '+snapshot.results.length+' 条模拟通过且预计净收益为正的路径 · '+snapshot.baseName+(snapshot.decimals===null?'（数量为 raw）':'（普通数量）');
      for(const r of visible){const tr=el($('scanRows'),'tr','');const td=el(tr,'td','');el(td,'div',r.path.map(a=>snapshot.tokens.find(t=>t.address.toLowerCase()===a)?.name??a).join(' → '));const code=el(td,'code',JSON.stringify(r.path),'scan-path');code.title=JSON.stringify(r.path);
        const use=el(td,'button','填入路径与数量','textbutton');use.type='button';use.onclick=()=>{$('path').value=JSON.stringify(r.path);$('path').dispatchEvent(new Event('input',{bubbles:true}));$('amount').value=r.input.toString();$('path').focus()};
        for(const v of [r.input,r.output,r.profit,r.gasFeeBase,r.netProfit]){const cell=el(tr,'td',format(v));cell.title='raw: '+v}
        el(tr,'td',roi(r)+'%');el(tr,'td',r.exact?'毛收益模型最优':'毛收益近似；差距上界 '+format(r.upperProfit-r.profit));el(tr,'td','已通过 · 预计 gas '+r.gasEstimate);
      }
      if(!visible.length){const tr=el($('scanRows'),'tr','');const td=el(tr,'td','没有符合当前筛选条件且完整兑换模拟通过的结果。');td.colSpan=9}
      $('exportScanJSON').disabled=false;$('exportScanCSV').disabled=false;
    }catch(error){$('scanFilterStatus').textContent='筛选条件无效：'+error.message}
  }
  function workerSolver(signal){
    const worker=new Worker(new URL('./scanner-worker.mjs',import.meta.url),{type:'module'});
    return {destroy:()=>worker.terminate(),solve:(pools,cap)=>new Promise((resolve,reject)=>{
      const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel)};
      const cancel=()=>{finish();worker.terminate();reject(Error('扫描已取消'))};
      const timer=setTimeout(()=>{finish();worker.terminate();reject(Error('计算超时，请减少跳数或 Token 数量'))},30000);
      signal.addEventListener('abort',cancel,{once:true});if(signal.aborted){cancel();return}
      worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data.result)};
      worker.onerror=()=>{finish();reject(Error('扫描计算器不可用，请刷新页面'))};worker.postMessage({pools,cap});
    })};
  }
  $('startScan').onclick=async()=>{
    if(controller)return;controller=new AbortController();const signal=controller.signal;busy(true);snapshot=null;render();$('scanFilterStatus').textContent='';$('scanSummary').textContent='';$('scanFailures').replaceChildren();let solver;
    try{
      const sender=$('scanWallet').value.trim();if(!sender)throw Error('请先填写模拟钱包地址');address(sender);
      const base=$('scanBase').value,selected=new Set([...$('scanTokens').querySelectorAll('input:checked')].map(i=>i.value));selected.add(base);
      const tokens=selectionTokens.filter(t=>selected.has(t.address));if(tokens.length<3||tokens.length>20)throw Error('请选 3–20 个 Token（包含起止币）');
      const maxHops=Number($('scanHops').value),limit=Number($('scanLimit').value),cap=$('scanCap').value.trim()?uint($('scanCap').value.trim()):MAX_UINT,balanceOverride=$('scanBalanceOverride').value.trim()?uint($('scanBalanceOverride').value.trim()):null,allowanceOverride=$('scanAllowanceOverride').value.trim()?uint($('scanAllowanceOverride').value.trim()):null;
      if(!Number.isInteger(limit)||limit<1||limit>20000)throw Error('路径上限必须是 1–20000 的整数');
      notice('准备扫描节点…');const nodes=await getNodes();if(signal.aborted)throw Error('扫描已取消');solver=workerSolver(signal);
      snapshot=await scan({nodes,tokens,base,sender,maxHops,limit,cap,balanceOverride,allowanceOverride,signal,solve:solver.solve,onProgress:notice});
      $('scanSummary').textContent='快照 '+snapshot.scannedAt+' · Block '+snapshot.block+' · 起止币 '+snapshot.baseName+' · 最大 '+snapshot.maxHops+' 跳 · '+snapshot.pairCount+' 个非空池子 · '+snapshot.pathCount+' 条已扫描路径 · 输入上限 '+(snapshot.inputCap??'自动')+' raw。'+(snapshot.truncated?'已触及路径上限，只扫描了部分路径。':'已遍历所选 Token 与跳数范围内的简单循环路径。')+' 尚未确定有无正毛收益：'+snapshot.unresolved+'；Router 拒绝复核：'+snapshot.quoteRejected+'；模型不一致：'+snapshot.modelMismatch+'。';
      $('scanMinProfitLabel').textContent='最低预计净收益（'+snapshot.baseName+(snapshot.decimals===null?' · raw':'')+'）';
      $('scanSummary').textContent+=' 模拟地址：'+snapshot.simulationSender+'；链上余额 '+snapshot.walletBalanceRaw+'，链上 allowance '+snapshot.routerAllowanceRaw+'；本次采用余额 '+snapshot.effectiveBalanceRaw+'，采用 allowance '+snapshot.effectiveAllowanceRaw+'。兑换回退：'+snapshot.tradeReverted+'；无法验证：'+snapshot.tradeUnverified+'；扣费不盈利：'+snapshot.gasUnprofitable+'。gas price 固定 1000 gwei。';
      for(const failure of snapshot.tradeFailures){const box=el($('scanFailures'),'div','','step');el(box,'div',failure.path.map(a=>snapshot.tokens.find(t=>t.address.toLowerCase()===a)?.name??a).join(' → '));el(box,'p',(failure.status==='reverted'?'兑换执行回退':failure.status==='nonpositive_net'?'扣费后不盈利':'无法验证')+'：'+failure.reason,'hint');el(box,'div','amountIn raw: '+failure.inputRaw,'raw')}
      if(!snapshot.tradeFailures.length)el($('scanFailures'),'p','没有记录到兑换失败的候选路径。','hint');
      render();notice('✓ 扫描完成 · '+snapshot.results.length+' 条路径模拟通过且预计净收益为正'+(snapshot.truncated?' · 未扫描全部路径':''));
    }catch(error){snapshot=null;render();notice(error.message+'；本次没有可导出的完整扫描结果。',true)}
    finally{controller.abort();controller=null;solver?.destroy();busy(false)}
  };
  $('stopScan').onclick=()=>{controller?.abort();notice('正在取消扫描…')};
  $('refreshScanTokens').onclick=()=>{refresh();notice('已重新载入常用 Token；已有结果仍属于上次扫描快照。')};
  $('allScanTokens').onclick=()=>{$('scanTokens').querySelectorAll('input').forEach(i=>i.checked=true)};
  $('noneScanTokens').onclick=()=>{$('scanTokens').querySelectorAll('input').forEach(i=>i.checked=false)};
  for(const id of ['scanMinProfit','scanMinROI','scanSort'])$(id).addEventListener('input',render);
  for(const type of ['JSON','CSV'])$('exportScan'+type).onclick=()=>{
    if(!snapshot)return;render();if($('exportScan'+type).disabled)return;
    const data=exportData(snapshot,visible,filters()),content=type==='JSON'?JSON.stringify(data,null,2):toCSV(data);
    const url=URL.createObjectURL(new Blob([content],{type:type==='JSON'?'application/json;charset=utf-8':'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='qki-routes-'+snapshot.block+'.'+type.toLowerCase();a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  };
  refresh();busy(false);
}
