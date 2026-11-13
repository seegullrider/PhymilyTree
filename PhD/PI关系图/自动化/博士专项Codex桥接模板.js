// 将全文复制到 functions.exec 中运行；不能直接作为 Node 程序执行。
// 每批最多四条，逐条检索并立即保存、提交；停止时释放本批尚未提交的租约。
const thesisQueue = 'C:\\note\\PhD\\PI关系图\\自动化\\博士论文专项队列.cjs';
const thesisOut = 'C:/note/PhD/PI关系图/自动化';
// CLASSIFIER_START
function classifyThesisResponse(value) {
  const raw=String(value??'').trim();
  if(!raw) return {kind:'error',reason:'检索返回空内容'};
  // 只把响应自身的错误前缀作为工具失败，不扫描正常搜索结果中的文章正文、期刊页码或 DOI。
  if(/^(?:Internal Error|Fatal error|Failed to fetch|Error\s*:|HTTP\s+(?:4\d\d|5\d\d)\b)/i.test(raw)) {
    const limited=/\b(?:HTTP\s*)?429\b|\brate[ -]?limit(?:ed|ing)?\b|\btoo many requests\b/i.test(raw);
    const excerpt=raw.slice(0,500).replace(/https?:\/\/[^\s]+/g,'[URL 已省略]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已省略]').replace(/[\r\n]+/g,' ');
    return {kind:limited?'limited':'error',reason:excerpt};
  }
  return {kind:'ok'};
}
// CLASSIFIER_END
async function thesisCmd(...args){
  const r=await tools.exec_command({cmd:"node --no-warnings '"+thesisQueue+"' "+args.join(' '),workdir:'C:\\note',yield_time_ms:10000,max_output_tokens:3000});
  if(r.exit_code!==0)throw Error(r.output);return JSON.parse(r.output);
}
async function thesisSave(items){
  const f=thesisOut+'/博士专项桥接-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.json';
  await tools.apply_patch('*** Begin Patch\n*** Add File: '+f+'\n+'+JSON.stringify(items)+'\n*** End Patch');
  return thesisCmd('ingest',"'"+f.replaceAll('/','\\')+"'");
}
for(let round=0;round<8;round++){
  const jobs=await thesisCmd('next','4');
  if(!jobs.length){text('论文队列暂停、退避中或无可领取任务；检查 status。');break;}
  let stop=false;
  for(let i=0;i<jobs.length;i++){
    const j=jobs[i];let result;
    try {
      const raw=String(await tools.web__run({search_query:[{q:j.query}],response_length:'short'}));
      const verdict=classifyThesisResponse(raw);
      result=verdict.kind==='ok'?{record_id:j.record_id,lease_token:j.lease_token,raw}:{record_id:j.record_id,lease_token:j.lease_token,error:verdict.reason};
      stop=verdict.kind!=='ok';
    } catch(e) {
      const verdict=classifyThesisResponse('Error: '+String(e));
      result={record_id:j.record_id,lease_token:j.lease_token,error:verdict.reason};stop=true;
    }
    // 搜索正文由 ingest 内置清洗再入 SQLite；此临时结果文件同样可能含个人资料，
    // 因此先做最基本脱敏；不要打印完整响应。
    if(result.raw)result.raw=result.raw.replace(/https?:\/\/[^\s<>"\])]+/gi,u=>/[?&](?:x-amz-[^=]*|signature|access_token|expires)=/i.test(u)?'[临时签名链接已省略]':u).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已省略]').replace(/(^|\n)[ \t*]*(?:Phone|Telephone|Tel\.?|Fax|Mobile|Ph)\s*(?::\s*|\s+(?=[+(0-9]))[+()\d][^\r\n]*/gi,'$1[电话已省略]').replace(/(^|\n)[ \t*]*(?:Home|Residential|Personal)[ \t]+Address[ \t]*:\*{0,2}[^\r\n]*(?:\r?\n(?![ \t]*(?:\r?$|#{1,6}[ \t]|\*\*[^\r\n]+\*\*))[^\r\n]*){0,5}/gim,'$1[私人住址已省略]').replace(/(^|\n)[ \t*]*(?:Born|Date of Birth)\s*:[^\r\n]*/gi,'$1[出生日期已省略]');
    await thesisSave([result]);
    if(stop){
      const rest=jobs.slice(i+1).map(x=>({record_id:x.record_id,lease_token:x.lease_token,deferred:true,reason:'本批前序检索出错，当前项尚未提交；按队列退避后恢复。'}));
      if(rest.length)await thesisSave(rest);
      text('本批已停止并保存失败及未提交任务；依据队列退避，不立即重试。');break;
    }
  }
  if(stop)break;
  await new Promise(resolve=>setTimeout(resolve,1500));
}
text('本轮结束；以博士论文专项队列 status 为准。');
