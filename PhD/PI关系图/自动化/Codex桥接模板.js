// 在 Codex functions.exec 中运行此文件的内容；不是独立 Node 程序。
// 为保持单轮可观察，默认最多 8 批；每批结果先保存再提交，服务限流立即停止。
const graphQueue = "C:\\note\\PhD\\PI关系图\\自动化\\检索流程.cjs";
const bridgeCache = "C:/Users/32187/.codex/visualizations/2026/11/01/01a19844-0920-7d62-8e33-7e52115a2a23";
// 本轮人工确认需要延期的站点，可填写不带 www. 的主机名；不会消耗网页重试次数。
const deferredPageHosts = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function queue(...args) {
  const r = await tools.exec_command({cmd:"node --no-warnings '"+graphQueue+"' "+args.join(' '),workdir:"C:\\note",yield_time_ms:10000,max_output_tokens:3000});
  if (r.exit_code !== 0) throw Error(r.output); return JSON.parse(r.output);
}
async function persist(items, kind) {
  const f=bridgeCache+"/pi_bridge_"+Date.now()+"_"+kind+".json";
  await tools.apply_patch("*** Begin Patch\n*** Add File: "+f+"\n+"+JSON.stringify(items)+"\n*** End Patch");
  return await queue(kind==='search'?'ingest-json':'ingest-pages',"'"+f.replaceAll('/','\\')+"'");
}
function pageExcerpt(raw, name) {
  const normalize = value => value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const parts = normalize(name.replace(/[:：].*$/,'').replace(/（[^）]*）|\([^)]*\)/g,'').replace(/\s*[—–]\s*.*$/,'')).split(' ');
  const variants = [parts.join(' ')];
  if (parts.length === 2) variants.push(parts.slice().reverse().join(' '));
  const isAcademicTitle = line => /^(?:#{2,6}\s+|\*\s+)?(?:(?:assistant|associate|distinguished|emeritus|adjunct)\s+)?professor\b/i.test(line);
  const lines = [...raw.matchAll(/^L(\d+)(?:@P\d+(?:-\d+)?)?:[^\S\r\n]*(.+)$/gm)].map(([, number, line]) => ({
    number:Number(number),
    text:line.replace(/【[^†】]*†([^†】]*)(?:†[^】]*)?】/g,'$1').trim(),
    startsLinkedProfile:/^【\d+†[^†】]+†[^】]+】\s+(?:is|joined|serves|received|obtained|was|will)\b/i.test(line)
  })).filter(({text})=>text && !/^(?:image:|e-?mail:|phone:|fax:|contact:)/i.test(text) &&
    !/^(?:\S+@\S+|[+\d(][\d ()+./-]{6,})$/.test(text));
  const hasName = line => variants.some(candidate => candidate.length >= 5 && (' '+normalize(line.text)+' ').includes(' '+candidate+' '));
  const hasRole = line => /\b(?:advis[eo]r|supervis\w*|mentor|thesis|postdoctoral|dissertation|director of|professor (?:at|in|of|with))\b/i.test(line.text);
  // Rosters and profiles can put a short name heading before the actual role or appointment.
  const candidates = lines.filter(hasName).map(anchor => {
    const following = lines.filter(line => line.number > anchor.number && line.number <= anchor.number+4);
    const nextProfile = following.findIndex((line, index) =>
      (/^#{2,6}\s/.test(line.text) && !hasRole(line) && !isAcademicTitle(line.text)) ||
      (line.startsLinkedProfile && !hasName(line) && following[index-1]?.text === 'Image'));
    const context = (nextProfile < 0 ? following : following.slice(0,nextProfile))
      .filter(line => line.text !== 'Image' && !/\b(?:e-?mail|phone|fax|passcode)\s*:|\S+@\S+/i.test(line.text));
    const relevant = context.some(line => hasRole(line) || isAcademicTitle(line.text));
    return { anchor, context, score: 2 * Number(hasRole(anchor)) + Number(relevant) };
  });
  const match = candidates.sort((a,b) => b.score-a.score || b.anchor.text.length-a.anchor.text.length)[0];
  if (match) {
    return [match.anchor,...match.context].map(line=>line.text).join(' ').slice(0,1500);
  }
  return lines.length ? '已保存网页正文片段。当前片段未定位目标人物，须按姓名核对原页。' : '';
}
function isAnubisDenied(raw) {
  return /(?:access denied|oh noes!)/i.test(raw) && /(?:protected by|running)s*(?:【[^】]*】s*)?anubis|anubis version|image:s*sad anubis/i.test(raw);
}
function isOutageNotice(raw) {
  return /Redirected to URL:\s+https?:\/\/itstatus\.uconn\.edu\/\S+/i.test(raw) &&
    /^(?:L\d+:\s*)?Aurora is currently unavailable\./mi.test(raw);
}
function isDirectoryRedirect(raw) {
  return /^Directory Listing\s*\(/i.test(raw.trimStart()) &&
    /Redirected to URL:\s+https?:\/\/[^/\s;]+(?:\/[^/\s;?#]+)*\/directory\/?(?=[\s;?#]|$)/i.test(raw);
}
function isPdfHomepageRedirect(raw, requestedUrl) {
  // 原论文或期刊 PDF 被重定向到网站首页时，首页文字不是论文正文。
  return /\.pdf(?:[?#]|$)/i.test(requestedUrl) &&
    /Redirected to URL:\s+https?:\/\/[^/\s;]+\/?(?=[\s;]|$)/i.test(raw);
}
for(let round=0;round<8;round++) {
  const jobs=await queue('next','4');
  let state=await queue('status');
  if(jobs.length){const searched=await Promise.allSettled(jobs.map(async j=>({id:j.id,query:j.query,raw:String(await tools.web__run({search_query:[{q:j.query}],response_length:'short'})).slice(0,5500)})));
  const sr=searched.map((r,i)=>r.status==='fulfilled'?r.value:{id:jobs[i].id,query:jobs[i].query,error:String(r.reason)});
  state=await persist(sr,'search'); if(sr.some(x=>/http 429|rate limit exceeded|too many requests/i.test(x.error||(/^Fatal error/i.test(x.raw||'')?x.raw:'')))){notify('搜索服务限流，已记录并暂停。');break;}
  await pause(1500);}
  // 原子领取并附带租约，避免多个桥接实例同时访问同一网址。
  const pages=await queue('lease-pages','4');
  if(!jobs.length&&!pages.length){notify('队列暂停或无可立即处理任务；请查看 status。');break;}
  if(pages.length){
    const visits=await Promise.allSettled(pages.map(async p=>{
      const host=p.url.match(/^https?:\/\/(?:www\.)?([^/:?#]+)/i)?.[1].toLowerCase();
      if(deferredPageHosts.includes(host))return {id:p.id,deferred_reason:'本站先前返回浏览器验证，本轮延期'};
      const raw=String(await tools.web__run({open:[{ref_id:p.url}],response_length:'short'}));
      if(/^(Internal Error|Fatal error)|Failed to fetch/i.test(raw)){
        const error = raw.replace(/https?:\/\/[^\s<>"']+\?[^\s<>"']+/gi, url =>
          /[?&](?:x-amz-[\w-]+|signature|access_token|expires)=/i.test(url)
            ? url.split('?')[0]+'?[临时签名已省略]'
            : url);
        return {id:p.id,error:error.slice(0,600)};
      }
      if(isAnubisDenied(raw))return {id:p.id,error:'Anubis 访问拒绝，未取得原始正文'};
      if(isOutageNotice(raw))return {id:p.id,error:'目标原件重定向到 UConn 系统故障页，未取得正文'};
      if(isDirectoryRedirect(raw))return {id:p.id,error:'旧个人页重定向到学校通用目录，未取得人物正文'};
      if(isPdfHomepageRedirect(raw,p.url))return {id:p.id,error:'PDF 原件重定向至网站首页，未取得论文正文'};
      const excerpt=pageExcerpt(raw,p.name);
      if(/an error has occurr?ed with the api/i.test(excerpt))return {id:p.id,error:'目标页面返回 API 错误，未取得人物正文'};
      return excerpt?{id:p.id,excerpt,raw_page:raw}:{id:p.id,error:'网页无可提取正文或受访问限制'};
    }));
    const localFailure=r=>r.status==='rejected'&&(r.reason instanceof ReferenceError||r.reason instanceof SyntaxError);
    const pr=visits.map((r,i)=>({...(r.status==='fulfilled'?r.value:localFailure(r)?
      {id:pages[i].id,deferred_reason:'桥接运行时错误：'+String(r.reason)}:{id:pages[i].id,error:String(r.reason)}),lease_token:pages[i].lease_token}));
    state=await persist(pr,'pages');
    if(visits.some(localFailure)){notify('桥接运行时错误，已保存网页延期并归还租约。');break;}
    const throttled=pr.filter(x=>/\b429\b|rate limit|too many requests/i.test(x.error||''));
    // 多个不同站点在同一批同时限流时，也可能是共同传输服务限流；暂停整批，避免继续施压。
    if(throttled.length>=2){notify('多个来源同时限流，已保存失败并暂停整批；请等待队列全局退避到期。');break;}
    if(throttled.some(x=>!String(x.error).includes('Failed to fetch ')||!/\(429\)/.test(String(x.error)))){notify('页面工具限流，已记录并暂停。');break;}
    if(throttled.length)notify('来源站点限流，已暂停该站点并记录重试时间；继续处理其他站点。');
  }
  notify(JSON.stringify({round:round+1,搜索完毕记录:state.automatically_searched,网页任务:state.pages,待处理:state.jobs,待写回:state.pending_render}));
  await pause(1500);
}
text('本轮桥接已结束；以本地队列和自动检索运行进度为准。');
