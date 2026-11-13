// 在 Codex functions.exec 中运行；搜索结果仅是线索，不能自动认定导师。
// 每批至多四人，逐批落盘并提交；遇到服务限流立即停止。
const thesisQueue = "C:\\note\\PhD\\PI关系图\\自动化\\博士论文专项队列.cjs";
const bridgeCache = "C:/Users/32187/.codex/visualizations/2026/11/01/01a19844-0920-7d62-8e33-7e52115a2a23";
async function queue(...args) {
  const r = await tools.exec_command({cmd:"node --no-warnings '"+thesisQueue+"' "+args.join(' '),workdir:"C:\\note",yield_time_ms:10000,max_output_tokens:1500});
  if (r.exit_code !== 0) throw Error(r.output);
  return JSON.parse(r.output);
}
await queue('init');
for (let round=0;round<8;round++) {
  const jobs=await queue('next','4');
  if (!jobs.length) break;
  const results=await Promise.allSettled(jobs.map(j=>tools.web__run({search_query:[{q:j.query}],response_length:'short'})));
  const items=results.map((r,i)=>({record_id:jobs[i].record_id,lease_token:jobs[i].lease_token,...(r.status==='fulfilled'?{raw:String(r.value).slice(0,50000)}:{error:String(r.reason)})}));
  const file=bridgeCache+'/thesis_'+Date.now()+'_'+round+'.json';
  await tools.apply_patch('*** Begin Patch\n*** Add File: '+file+'\n+'+JSON.stringify(items)+'\n*** End Patch');
  await queue('ingest',"'"+file.replaceAll('/','\\')+"'");
  await queue('queue-sources');
  if(items.some(x=>/429|rate.?limit|too many requests/i.test(x.error||(/^(Internal Error|Fatal error)/i.test(x.raw||'')?x.raw:'')))) break;
  await new Promise(resolve=>setTimeout(resolve,1500));
}
text(JSON.stringify(await queue('status')));
