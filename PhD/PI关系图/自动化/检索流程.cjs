// 本地断点队列。搜索传输由外部浏览工具提供；返回的原文只作为待复核线索。
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const {phdLabel,postLabel,supplement} = require('./人物页导师标签.cjs');
const {isNonRetryablePageError,isPageVerification} = require('./页面人工访问前检查.cjs');
const graph = process.env.PI_GRAPH_ROOT || path.resolve(__dirname, '..'), people = path.join(graph, '人物');
const db = new DatabaseSync(process.env.PI_AUTOMATION_DB || path.join(__dirname, '检索队列.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000;
CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL, filename TEXT NOT NULL, reviewed INTEGER NOT NULL, name_collision INTEGER NOT NULL DEFAULT 0, relation_json TEXT NOT NULL DEFAULT '[]', updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, record_id TEXT NOT NULL, kind TEXT NOT NULL, query TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, error TEXT, updated TEXT NOT NULL, FOREIGN KEY(record_id) REFERENCES records(id));
CREATE TABLE IF NOT EXISTS results(job_id TEXT PRIMARY KEY, raw TEXT NOT NULL, sources_json TEXT NOT NULL, retrieved TEXT NOT NULL, FOREIGN KEY(job_id) REFERENCES jobs(id));
CREATE TABLE IF NOT EXISTS result_history(id INTEGER PRIMARY KEY,job_id TEXT NOT NULL,raw TEXT NOT NULL,sources_json TEXT NOT NULL,retrieved TEXT NOT NULL,archived TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS render_queue(record_id TEXT PRIMARY KEY, dirty INTEGER NOT NULL DEFAULT 1, attempts INTEGER NOT NULL DEFAULT 0, error TEXT, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, job_id TEXT, level TEXT NOT NULL, detail TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS host_limits(host TEXT PRIMARY KEY, until TEXT NOT NULL, streak INTEGER NOT NULL, last_limit TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pages(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,job_id TEXT NOT NULL,url TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,error TEXT,excerpt TEXT,retrieved TEXT,UNIQUE(record_id,url));
CREATE TABLE IF NOT EXISTS page_leases(page_id TEXT PRIMARY KEY,token TEXT NOT NULL,expires_at TEXT NOT NULL,FOREIGN KEY(page_id) REFERENCES pages(id));
CREATE TABLE IF NOT EXISTS page_priorities(page_id TEXT PRIMARY KEY,priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 9),reason TEXT NOT NULL,updated TEXT NOT NULL,FOREIGN KEY(page_id) REFERENCES pages(id));
-- 工具返回的原始内容与人工摘要分开保存；它可能只是网页片段，不能当作完整原文。
CREATE TABLE IF NOT EXISTS page_observations(page_id TEXT NOT NULL,sha256 TEXT NOT NULL,tool_output TEXT NOT NULL,bytes INTEGER NOT NULL,retrieved TEXT NOT NULL,completeness TEXT NOT NULL CHECK(completeness='unknown'),PRIMARY KEY(page_id,sha256),FOREIGN KEY(page_id) REFERENCES pages(id));
CREATE TABLE IF NOT EXISTS reviewed_page_failures(page_id TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(page_id,sha256),FOREIGN KEY(page_id) REFERENCES pages(id));
CREATE TABLE IF NOT EXISTS page_refresh_history(id INTEGER PRIMARY KEY,page_id TEXT NOT NULL,reason TEXT NOT NULL,snapshot_json TEXT NOT NULL,requested_at TEXT NOT NULL,FOREIGN KEY(page_id) REFERENCES pages(id));
-- 精确网页的人物归属经人工核实为其他同名者时，保留原网页和证据；不把整站或其他页面一概判错。
CREATE TABLE IF NOT EXISTS page_identity_mismatches(page_id TEXT PRIMARY KEY,subject_record_id TEXT NOT NULL,identity_event_id TEXT NOT NULL,evidence TEXT NOT NULL,snapshot_json TEXT NOT NULL,recorded_at TEXT NOT NULL,FOREIGN KEY(page_id) REFERENCES pages(id),FOREIGN KEY(subject_record_id) REFERENCES records(id));
CREATE TABLE IF NOT EXISTS manual_audit_events(audit_id TEXT PRIMARY KEY,record_id TEXT NOT NULL,recorded_at TEXT NOT NULL,details_json TEXT NOT NULL,FOREIGN KEY(record_id) REFERENCES records(id));
CREATE INDEX IF NOT EXISTS idx_manual_audit_record ON manual_audit_events(record_id,recorded_at);
CREATE INDEX IF NOT EXISTS idx_pages_state ON pages(state,record_id);
CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);
CREATE INDEX IF NOT EXISTS idx_page_leases_expiry ON page_leases(expires_at);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state,record_id);`);
const now = () => new Date().toISOString();
const externalIdentityExclusion = '已人工核实属于数据库外其他同名者：';
// 搜索结果可能夹带网页事件处理器或脚本协议；保留原始结果，但不自动访问带有此类查询参数的链接。
function unsafeQuery(url){try{const u=new URL(url);return [...u.searchParams.values()].some(v=>/(?:^|[\s"'<>])on(?:error|load|click)\s*=/i.test(v)||/<script\b|javascript\s*:/i.test(v));}catch{return false}}
for(const p of db.prepare("SELECT id,job_id,url FROM pages WHERE state IN ('pending','retry')").all())if(unsafeQuery(p.url)){db.prepare("UPDATE pages SET state='excluded',error='查询参数含可执行脚本或事件处理器，停止自动访问并保留原链接' WHERE id=?").run(p.id);db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(p.job_id,'warning','页面 '+p.id+' 的查询参数疑似脚本注入，已停止自动访问；原链接保留',now());}
// 第三方转发站不作为原始资料入口，也不用于绕过来源网站的访问限制。
// workers.dev 本身可能是合法个人网站；仅识别路径中显式嵌入 http(s) 目标的转发格式。
function thirdPartyProxy(url){try{const u=new URL(url),host=u.hostname.toLowerCase(),pathname=decodeURIComponent(u.pathname);return host==='please.untaint.us'||(host.endsWith('.workers.dev')&&/^\/https?(?:\/|:)/i.test(pathname))}catch{return false}}
for(const p of db.prepare("SELECT id,job_id,url FROM pages WHERE state IN ('pending','retry')").all())if(thirdPartyProxy(p.url)){db.prepare("UPDATE pages SET state='excluded',error='第三方代理网址，不自动访问；应查找原始来源' WHERE id=?").run(p.id);db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(p.job_id,'warning','页面 '+p.id+' 为第三方代理地址，已停止自动访问；原链接保留',now())}
// 明确拒绝自动抓取的页面保留错误，但不再自动重试。
db.prepare("UPDATE pages SET state='excluded' WHERE state='retry' AND lower(error) LIKE '%robots.txt%'").run();
// 人机验证不是暂时性网络错误：保留记录并暂停对该页面的自动重试，等待人工处理或其他原始来源。
db.exec('BEGIN IMMEDIATE');
try {
  for (const page of db.prepare("SELECT id,record_id,job_id,url,error FROM pages WHERE state='retry' AND error IS NOT NULL").all()) {
    if (!isPageVerification(page.error)) continue;
    db.prepare("UPDATE pages SET state='excluded' WHERE id=?").run(page.id);
    db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)')
      .run(page.job_id,'page_verification_excluded',page.url+' '+page.error,now());
    db.prepare(`INSERT INTO render_queue(record_id,dirty,attempts,error,updated) VALUES(?,1,0,NULL,?)
      ON CONFLICT(record_id) DO UPDATE SET dirty=1,attempts=0,error=NULL,updated=excluded.updated`).run(page.record_id,now());
  }
  db.exec('COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; }
const cleanName = s => s.replace(/[:：].*$/,'').replace(/（[^）]*）|\([^)]*\)/g,'').replace(/\s*[—–]\s*.*$/,'').trim();
const normalize = s => cleanName(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
// 人物页混有本人师承和指向学生的反向链接。分类仅按既有标签惯例推断，不改人物页或认定事实。
function relationDirection(type) {
  if (/反向(?:线索|候选)/.test(type)) return 'reverse_likely';
  if (/合作者|合作研究者|研究关联者/.test(type)) return 'undetermined';
  if (/^博士生|受指导者|研究者|研究人员|研究成员|研究助理|课题组(?:候选)?成员|候选关联人物|阶段学生/.test(type)) return 'reverse_likely';
  if (/导师|师长|负责人|接收教师|联合指导|课题组关系|所在课题组|候选关系|候选研究关系|候选课题组/.test(type)||/^博士(?:后)?(?:课题组|候选|阶段候选)$/.test(type)) return 'own_likely';
  return 'undetermined';
}
function searchQuery(j){if(j.state!=='retry'||j.attempts===0)return j.query;const name=cleanName(j.name),unit=j.unit.split(',')[0];if(j.kind==='training')return j.attempts===1?`"${name}" ${unit} PhD`:`"${name}" PhD advisor`;return j.attempts===1?`"${name}" ${unit} professor`:`"${name}" university`;}
const args = process.argv.slice(2), command = args[0];
function writeAtomic(file, contents, expected) { const temp=file+'.tmp-'+process.pid; fs.writeFileSync(temp,contents,'utf8');if(expected!==undefined&&fs.readFileSync(file,'utf8')!==expected)throw Error('写入前人物页已变更，保留原页并等待重试：'+file);fs.renameSync(temp,file); }
function sync() {
  const manifest=JSON.parse(fs.readFileSync(path.join(graph,'graph-manifest.json'),'utf8'));
  const counts=new Map(); for (const n of manifest.nodes) { const k=normalize(n.name); counts.set(k,(counts.get(k)||0)+1); }
  // 手工核实的同名冲突也可能来自名单之外；同步时不能仅按名单内重复姓名清除标记。
  const put=db.prepare(`INSERT INTO records(id,name,unit,filename,reviewed,name_collision,relation_json,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,unit=excluded.unit,filename=excluded.filename,reviewed=excluded.reviewed,name_collision=MAX(records.name_collision,excluded.name_collision),relation_json=excluded.relation_json,updated=excluded.updated`);
  const job=db.prepare(`INSERT INTO jobs(id,record_id,kind,query,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET query=excluded.query`);
  db.exec('BEGIN'); try { for(const n of manifest.nodes) {
    const file=path.join(people,n.filename+'.md'); if(!fs.existsSync(file)) throw Error('缺少人物页 '+file);
    const s=fs.readFileSync(file,'utf8'); const lines=s.split(/\r?\n/).filter(l=>/^- 博士(?:生|后受指导者|后主要接收导师|毕业后(?:研究|\s+fellowship|课题组)|(?:后)?(?:导师|阶段|课题组|候选|研究|合作))/.test(l));
    const boundary=(s.match(/^- 核查边界：(.+)$/m)||[])[1]||'';
    const relationPhase=type=>type.startsWith('博士毕业后')?'博士毕业后（职位未核）':type.startsWith('博士后')?'博士后':'博士';
    const evidenceFor=phase=>phase==='博士毕业后（职位未核）'?'':s.split(/\r?\n/).filter(l=>phase==='博士后'?/^- 博士后.*关系证据：/.test(l):/^- 博士关系证据：/.test(l)).map(l=>l.replace(/^- /,'')).join(' '),phaseTotals={博士:lines.filter(l=>relationPhase(l.slice(2))==='博士').length,博士后:lines.filter(l=>relationPhase(l.slice(2))==='博士后').length,'博士毕业后（职位未核）':lines.filter(l=>relationPhase(l.slice(2))==='博士毕业后（职位未核）').length};
    const rel=lines.map(l=>{const m=l.match(/^- ([^：]+)：\[\[([^\]]+)\]\].*?\]\((https?:[^)]+)\)/);if(!m)return null;const phase=relationPhase(m[1]),ev=evidenceFor(phase),inline=(l.match(/证据：(.+?)[；。]\s*关系类型可信度：/)||[])[1],conf=[...ev.matchAll(/可信度：([^；。]+)/g)].map(x=>x[1]),single=phaseTotals[phase]===1,lineConf=(l.match(/关系类型可信度：([^；。]+)/)||[])[1],assigned=inline||(single?ev:'')||'',qs=assigned.match(/[“"]([^”"]{1,200})[”"]/);return {type:m[1],target:m[2],url:m[3],phase,direction:relationDirection(m[1]),confidence:lineConf||(single&&conf.length===1?conf[0]:ev?'见人物页证据，逐关系核对':'沿用人物页原标签，证据待独立复核'),evidence:assigned||'该关系缺少可单独归属的证据；请核对人物页和来源正文',source_quote:qs?qs[1]:null,...(ev&&!single&&!inline?{phase_evidence_unassigned:ev}:{}),...(boundary?{review_boundary:boundary}:{})}}).filter(Boolean);
    const trainingSection=s.match(/(?:^|\n)## 师承\s*\r?\n([\s\S]*?)(?=\r?\n## |\r?\n<!-- PI-AUTO-SEARCH:START|$)/)?.[1]||'';
    rel.push(...supplement(trainingSection,rel));
    put.run(n.id,n.name,n.unit,n.filename,/## 院系与研究方向核验（\d{4}-\d{2}-\d{2}）/.test(s)?1:0,counts.get(normalize(n.name))>1?1:0,JSON.stringify(rel),now());
    const name=cleanName(n.name);
    job.run(n.id+':training',n.id,'training',`"${name}" "${n.unit}" PhD thesis advisor postdoctoral mentor`,now());
    job.run(n.id+':identity',n.id,'identity',`"${name}" "${n.unit}" faculty research laboratory`,now());
  } db.exec('COMMIT'); } catch(e) {db.exec('ROLLBACK');throw e;}
  return status();
}
function status() {
 const total=db.prepare('SELECT count(*) n FROM records').get().n;
 const records=db.prepare('SELECT reviewed,relation_json FROM records').all(); let phd=0,post=0,other=0,onlyOther=0,unresolved=0,directionUnknown=0,reverse=0;
 for(const r of records){const x=JSON.parse(r.relation_json),p=x.some(v=>phdLabel(v.type)),q=x.some(v=>postLabel(v.type)),o=x.some(v=>relationDirection(v.type)==='own_likely'&&/候选|课题组|研究师长|接收教师/.test(v.type));if(p)phd++;if(q)post++;if(o)other++;if(o&&!p&&!q)onlyOther++;if(!p||!q)unresolved++;if(x.some(v=>relationDirection(v.type)==='undetermined'))directionUnknown++;if(x.some(v=>relationDirection(v.type)==='reverse_likely'))reverse++;}
 const recordsWithLoggedReview = db.prepare(`
   SELECT count(*) AS n FROM records r
   WHERE EXISTS(SELECT 1 FROM manual_audit_events a WHERE a.record_id = r.id)
 `).get().n;
 return {records:total,manual_reviewed:records.filter(x=>x.reviewed).length,records_with_logged_review:recordsWithLoggedReview,explicit_phd_records:phd,explicit_post_records:post,records_with_group_or_candidate:other,only_group_or_candidate:onlyOther,records_with_direction_undetermined:directionUnknown,records_with_likely_reverse:reverse,needs_further_review:unresolved,collisions:db.prepare('SELECT count(*) n FROM records WHERE name_collision=1').get().n,jobs:db.prepare('SELECT state,count(*) n FROM jobs GROUP BY state').all(),pages:db.prepare('SELECT state,count(*) n FROM pages GROUP BY state').all(),records_with_page_read:db.prepare("SELECT count(DISTINCT record_id) n FROM pages WHERE state='done'").get().n,pending_render:db.prepare('SELECT count(*) n FROM render_queue WHERE dirty=1').get().n,backoff_until:db.prepare("SELECT value FROM settings WHERE key='backoff_until'").get()?.value||null,thesis_backoff_until:db.prepare("SELECT value FROM settings WHERE key='thesis_search_retry_after'").get()?.value||null,host_limits:db.prepare('SELECT host,until FROM host_limits WHERE until>? ORDER BY until').all(now()),automatically_searched:db.prepare("SELECT count(*) n FROM records r WHERE 2=(SELECT count(*) FROM jobs j WHERE j.record_id=r.id AND j.state='done')").get().n};
}
function enqueuePage(recordId,jobId,src){if(!src||!/^https?:\/\//.test(src.url))return;const id=crypto.createHash('sha256').update(recordId+'\n'+src.url).digest('hex').slice(0,24);if(unsafeQuery(src.url)||thirdPartyProxy(src.url)){const reason=thirdPartyProxy(src.url)?'第三方代理网址，不自动访问；应查找原始来源':'查询参数含可执行脚本或事件处理器，停止自动访问并保留原链接';db.prepare("INSERT OR IGNORE INTO pages(id,record_id,job_id,url,state,error) VALUES(?,?,?,?,'excluded',?)").run(id,recordId,jobId,src.url,reason);return}db.prepare('INSERT OR IGNORE INTO pages(id,record_id,job_id,url) VALUES(?,?,?,?)').run(id,recordId,jobId,src.url)}
function enqueueSources(recordId,jobId,parsed){for(const src of parsed.slice(0,2))enqueuePage(recordId,jobId,src)}
// 只为人工定位的稳定来源排队，读取仍由租约和主机退避控制。
function enqueueReviewedLinks(links) {
 const getJob = db.prepare("SELECT id FROM jobs WHERE record_id=? AND kind='training'");
 const getPage = db.prepare('SELECT id,state,attempts FROM pages WHERE record_id=? AND url=?');
 const setPriority = db.prepare("INSERT OR IGNORE INTO page_priorities(page_id,priority,reason,updated) VALUES(?,1,?,?)");
 if (!Array.isArray(links) || !links.length) throw Error('需提供人工定位的来源数组');
 const entries = links.map(({record_id, url, reason}) => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !pageHost(url) ||
      /[?&](?:x-amz-signature|x-amz-security-token|signature|access_token|expires)=/i.test(url) ||
      unsafeQuery(url) || thirdPartyProxy(url) || typeof reason !== 'string' || !reason.trim()) {
   throw Error('来源须为不含凭据或临时签名的原始 HTTPS 网址，并附排队原因');
  }
  parsed.hash = '';
  const job = getJob.get(record_id);
  if (!job) throw Error('未知校属记录 ' + record_id);
  return { record_id, url: parsed.href, reason: reason.trim(), job_id: job.id };
 });
 const pages = [];
 let added = 0, prioritized = 0;
 db.exec('BEGIN IMMEDIATE');
 try {
  for (const entry of entries) {
   const {record_id, url, reason, job_id} = entry;
   if (!getPage.get(record_id, url)) {
    enqueuePage(record_id, job_id, {url});
    added++;
   }
   const page = getPage.get(record_id, url);
   if (page.state === 'pending' || page.state === 'retry') {
    prioritized += Number(setPriority.run(page.id, reason, now()).changes);
   }
   pages.push({record_id, url, ...page});
  }
  db.exec('COMMIT');
 } catch (error) {
  db.exec('ROLLBACK');
  throw error;
 }
 return {added, prioritized, pages};
}
// 让已有核查来源但缺少可领页面的记录重新进入首读队列。
function seedFirstReadPages(apply) {
 if (apply) db.exec('BEGIN IMMEDIATE');
 try {
  const records=db.prepare(`SELECT r.id,r.name,r.unit,j.id AS job_id,a.details_json FROM records r
   JOIN jobs j ON j.record_id=r.id AND j.kind='training'
   JOIN manual_audit_events a ON a.rowid=(SELECT x.rowid FROM manual_audit_events x WHERE x.record_id=r.id
    ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
   WHERE NOT EXISTS(SELECT 1 FROM pages p WHERE p.record_id=r.id AND p.state IN ('done','pending'))
   ORDER BY r.unit,r.name`).all();
  const hasPage=db.prepare('SELECT 1 FROM pages WHERE record_id=? AND url=?');
  const blockedUrls=new Set(db.prepare('SELECT url,error FROM pages WHERE error IS NOT NULL').all()
   .filter(row=>isNonRetryablePageError(row.error)).map(row=>row.url));
  const result=[];
  for(const row of records) {
   const {affiliation,research}=JSON.parse(row.details_json).aspects;
   const links=[affiliation,research].filter(a=>a?.status==='confirmed').flatMap(a=>a.sources);
   const urls=[...new Set(links)].filter(url=>{
    if(typeof url!=='string'||!URL.canParse(url))return false;
    const parsed=new URL(url);
    return parsed.protocol==='https:'&&!parsed.username&&!parsed.password
     &&!/[?&](?:x-amz-signature|x-amz-security-token|signature|access_token|expires)=/i.test(url)
     &&!unsafeQuery(url)&&!thirdPartyProxy(url)&&!blockedUrls.has(url)&&!hasPage.get(row.id,url);
   }).slice(0,2);
   if(!urls.length)continue;
   if(apply)for(const url of urls)enqueuePage(row.id,row.job_id,{url});
   result.push({id:row.id,name:row.name,unit:row.unit,urls});
  }
  if(apply)db.exec('COMMIT');
  return {scanned:records.length,records:result.length,pages:result.reduce((n,row)=>n+row.urls.length,0),applied:apply,items:result};
 }catch(error){if(apply)db.exec('ROLLBACK');throw error;}
}
function backoff(minimumMs=0){const last=db.prepare("SELECT value FROM settings WHERE key='last_rate_limit'").get()?.value,previous=Number(db.prepare("SELECT value FROM settings WHERE key='rate_limit_streak'").get()?.value||0),existing=db.prepare("SELECT value FROM settings WHERE key='backoff_until'").get()?.value,streak=last&&Date.now()-Date.parse(last)<900000?previous+1:1,delay=Math.max(minimumMs,Math.min(1800000,120000*2**Math.min(streak-1,4))),until=new Date(Math.max(Date.now()+delay,Date.parse(existing)||0)).toISOString(),put=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');put.run('rate_limit_streak',String(streak));put.run('last_rate_limit',now());put.run('backoff_until',until)}
function pageHost(url){try{const host=new URL(url).hostname.toLowerCase().replace(/^www\./,'');return host==='linkedin.com'||host.endsWith('.linkedin.com')?'linkedin.com':host}catch{return null}}
// 仅调整读取顺序，不把旧台账的 confirmed_advisor 视作正式导师已证实。
// 未记录或无法解析的事件与未明同优先级；全部状态的页面仍保留在队列。
function pageReviewPriority(details){try{const a=details?JSON.parse(details).aspects:null,stages=[a?.phd?.status,a?.postdoc?.status];if(stages.some(x=>!x||x==='unresolved'))return 0;if(stages.some(x=>x==='group_or_candidate'||x==='no_postdoc_documented'))return 1;return 2}catch{return 0}}
// 同等核查需求时，先读可能包含导师字段的学位档案和本人履历。排序不判定身份或关系。
function pageSourcePriority(row) {
 const { pathname } = new URL(row.url);
 const thesisHost = /^(?:dspace|etd|thesis|theses|escholarship|jscholarship|ideals|academiccommons|conservancy|deepblue|ora|knowledge|repository|repositories)\./i;
 const trainingPath = /(?:^|[/_.-])(?:dissertations?|theses|thesis|curriculum|cv)(?=$|[/_.-]|\d)/i;
 // 导师索引通常从 PI 指向学生，同等需求时先读个人论文或履历，索引仍可领取。
 const advisorIndex = /\/(?:view\/(?:advisor|committee)|(?:thesis|dissertation)-advisors?|combined_advisor\.html)(?:\/|$)/i;
 if (advisorIndex.test(pathname)) return 3;
 if (thesisHost.test(row.host) || trainingPath.test(pathname)) return 0;
 // Bare ORCID profiles often return only the JavaScript shell through the web bridge.
 if (row.host === 'orcid.org' && /^\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]\/?$/i.test(pathname)) return 4;
 return row.job_kind === 'training' ? 1 : 2;
}
function availablePages(limit) {
 const pauses = db.prepare("SELECT value FROM settings WHERE key IN ('backoff_until','thesis_search_retry_after')").all();
 if (pauses.some(x => Date.parse(x.value) > Date.now())) return [];
 const time = now();
 const retryBefore = new Date(Date.now() - 1800000).toISOString();
 const paused = new Set(db.prepare('SELECT host FROM host_limits WHERE until>?').all(time)
  .map(x => pageHost('https://' + x.host)));
 const rows = db.prepare(`SELECT p.id,p.record_id,p.url,p.state,p.retrieved,r.name,r.unit,a.details_json,j.kind AS job_kind,
   COALESCE(pp.priority,0) AS manual_priority,
   EXISTS (SELECT 1 FROM pages read WHERE read.record_id=p.record_id AND read.state='done') AS has_read_page
  FROM pages p JOIN records r ON r.id=p.record_id
  LEFT JOIN jobs j ON j.id=p.job_id
  LEFT JOIN page_priorities pp ON pp.page_id=p.id
  LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x
   WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
  WHERE (p.state='pending' OR (p.state='retry' AND (p.retrieved IS NULL OR p.retrieved<=?))) AND p.attempts<3
  AND NOT EXISTS (SELECT 1 FROM pages prior WHERE prior.url=p.url AND prior.state='retry' AND prior.retrieved>?)
  AND NOT EXISTS (SELECT 1 FROM page_leases l JOIN pages leased ON leased.id=l.page_id
   WHERE l.expires_at>? AND leased.url=p.url)
  ORDER BY p.record_id,p.id`).all(retryBefore, retryBefore, time);
 // 同一精确网址的访问失败可跨校属记录复用；身份排除仍只作用于原记录。
 const blockedUrls = new Set(db.prepare('SELECT url,error FROM pages WHERE error IS NOT NULL').all()
  .filter(row => isNonRetryablePageError(row.error)).map(row => row.url));
 // 最近 12 小时在两个不同路径遇到浏览验证的站点暂后排，保留原任务及人工优先级。
 const recentChallenges = new Map();
 const challengeSince = new Date(Date.now() - 12 * 3600000).toISOString();
 const failures = db.prepare("SELECT DISTINCT url,error FROM pages WHERE state IN ('retry','excluded') AND retrieved>? AND error IS NOT NULL").all(challengeSince);
 for (const failure of failures) {
  if (!/返回[^。\n]*(?:浏览器|机器人)验证|(?:网页|站点)要求[^。\n]*(?:浏览器|机器人)验证|checking your browser|reCAPTCHA|human verification required|verify that you[^\n]*not a robot/i.test(failure.error)) continue;
  const host = pageHost(failure.url);
  if (!host) continue;
  const urls = recentChallenges.get(host) ?? new Set();
  urls.add(new URL(failure.url).pathname);
  recentChallenges.set(host, urls);
 }
 const eligible = rows.map(row => ({ ...row, host: pageHost(row.url), reviewPriority: pageReviewPriority(row.details_json) }))
  .filter(row => row.host && !paused.has(row.host) && !blockedUrls.has(row.url))
  .map(row => ({ ...row, sourcePriority: pageSourcePriority(row), challengeHost: (recentChallenges.get(row.host)?.size ?? 0) >= 2 }));
 const byNeed = (a, b) => a.reviewPriority - b.reviewPriority || a.sourcePriority - b.sourcePriority || a.has_read_page - b.has_read_page;
 const byAvailability = (a, b) => a.challengeHost - b.challengeHost || byNeed(a, b);
 const manual = eligible.filter(row => row.manual_priority).sort((a, b) => b.manual_priority - a.manual_priority || byNeed(a, b));
 const fresh = eligible.filter(row => !row.manual_priority && row.state === 'pending').sort(byAvailability);
 const retries = eligible.filter(row => !row.manual_priority && row.state === 'retry')
  .sort((a, b) => byAvailability(a, b) || (a.retrieved || '').localeCompare(b.retrieved || ''));
 const selected = [], hosts = new Set(), records = new Set();
 const take = (candidates, stopAt, distinctRecords = false) => {
  for (const row of candidates) {
   if (selected.length >= stopAt) break;
   if (hosts.has(row.host) || (distinctRecords && records.has(row.record_id))) continue;
   selected.push({ id: row.id, url: row.url, name: row.name, unit: row.unit });
   hosts.add(row.host);
   records.add(row.record_id);
  }
 };
 take(manual, limit);
 if (limit === 1) {
  take(retries, limit);
  take(fresh, limit);
 } else {
  // 先覆盖不同人物，至少留一席给符合退避条件的旧重试；有空位时再取同人其他来源。
  // 为尚无成功读取的记录留一席，同时保留普通原文和到期重试。
  take(fresh.filter(row => !row.has_read_page), Math.min(limit - 1, selected.length + 1), true);
  take(fresh, limit - 1, true);
  const retryLimit = Math.min(limit, selected.length + 1);
  take(retries, retryLimit, true);
  take(retries, retryLimit);
  take(fresh, limit, true);
  take(retries, limit, true);
  take(fresh, limit);
  take(retries, limit);
 }
 return selected;
}
function leasePages(limit){db.exec('BEGIN IMMEDIATE');try{const selected=availablePages(limit),until=new Date(Date.now()+600000).toISOString(),save=db.prepare('INSERT INTO page_leases(page_id,token,expires_at) VALUES(?,?,?) ON CONFLICT(page_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at');for(const row of selected){row.lease_token=crypto.randomBytes(16).toString('hex');row.lease_until=until;save.run(row.id,row.lease_token,until)}db.exec('COMMIT');return selected}catch(e){db.exec('ROLLBACK');throw e}}
// 仅针对已成功读取但证据不完整的页面，显式登记复读理由并保留历史快照；不修改共享或主机退避。
function refreshPage(id,reason){if(typeof reason!=='string'||reason.trim().length<8||reason.length>500)throw Error('须提供 8–500 字符的具体复读理由');db.exec('BEGIN IMMEDIATE');try{const p=db.prepare('SELECT * FROM pages WHERE id=?').get(id);if(!p||p.state!=='done')throw Error('仅可复读已完成的网页；未完成任务保留现有状态');if(db.prepare('SELECT 1 FROM page_identity_mismatches WHERE page_id=?').get(id))throw Error('该页已核为其他同名者，不可按本人物复读');const active=db.prepare('SELECT token FROM page_leases WHERE page_id=? AND expires_at>?').get(id,now());if(active)throw Error('网页已有有效租约');const ts=now();db.prepare('INSERT INTO page_refresh_history(page_id,reason,snapshot_json,requested_at) VALUES(?,?,?,?)').run(id,reason.trim(),JSON.stringify(p),ts);db.prepare('DELETE FROM page_leases WHERE page_id=?').run(id);db.prepare("UPDATE pages SET state='pending',attempts=0,error=NULL WHERE id=?").run(id);db.prepare('INSERT INTO page_priorities(page_id,priority,reason,updated) VALUES(?,1,?,?) ON CONFLICT(page_id) DO UPDATE SET priority=max(priority,1),reason=excluded.reason,updated=excluded.updated').run(id,reason.trim(),ts);db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(p.job_id,'page_refresh',p.url+' '+reason.trim(),ts);db.exec('COMMIT');return {id,url:p.url,state:'pending',previous_retrieved:p.retrieved,note:'历史页面快照已保留；复读仍遵守共享和主机退避。'}}catch(e){db.exec('ROLLBACK');throw e}}
// 在 ingestPages 的事务中验证并消费租约；无租约的历史人工结果仍可入库。
function validatePageLease(item,page){if(page.state==='excluded'&&page.error?.startsWith(externalIdentityExclusion))throw Error('已核实网页属于其他同名者，拒绝按当前人物导入');const lease=db.prepare('SELECT * FROM page_leases WHERE page_id=?').get(page.id),other=db.prepare('SELECT l.page_id FROM page_leases l JOIN pages p ON p.id=l.page_id WHERE p.url=? AND l.expires_at>? AND l.page_id<>? LIMIT 1').get(page.url,now(),page.id);if(other)throw Error('相同网址正被其他任务领取');if(!item.lease_token&&db.prepare('SELECT 1 FROM page_refresh_history WHERE page_id=? LIMIT 1').get(page.id))throw Error('复读任务须持当前租约，避免旧结果重复提交');if(item.lease_token){if(!lease||lease.token!==item.lease_token||Date.parse(lease.expires_at)<=Date.now())throw Error('网页租约已失效或不匹配，结果保留待人工核对');}else if(lease&&Date.parse(lease.expires_at)>Date.now())throw Error('网页存在有效租约，须提交匹配的 lease_token');if(lease)db.prepare('DELETE FROM page_leases WHERE page_id=?').run(page.id)}
function hostBackoff(url){const host=pageHost(url);if(!host){backoff();return}const old=db.prepare('SELECT * FROM host_limits WHERE host IN (?,?) ORDER BY until DESC LIMIT 1').get(host,'www.'+host),streak=old&&Date.now()-Date.parse(old.last_limit)<86400000?old.streak+1:1,until=new Date(Math.max(old?Date.parse(old.until):0,Date.now()+Math.min(86400000,1800000*2**Math.min(streak-1,5)))).toISOString();db.prepare('INSERT INTO host_limits(host,until,streak,last_limit) VALUES(?,?,?,?) ON CONFLICT(host) DO UPDATE SET until=excluded.until,streak=excluded.streak,last_limit=excluded.last_limit').run(host,until,streak,now())}
function sources(raw, person) {
 const blocks=raw.split(/\n-{10,}\n/); let out=[];
 for(const block of blocks){let m=block.match(/^([\s\S]{1,300}?)\s+\((https?:\/\/[^\s)]+)\)/);if(!m||/[?&](?:x-amz-signature|x-amz-security-token|signature|access_token|expires)=/i.test(m[2]))continue;
 const excerpt=block.replace(/cite[^]*/g,'').replace(/\[wordlim:\s*\d+\]/g,'').split('\n').slice(1,5).join(' ').replace(/\s+/g,' ').trim();
 const evidence=(m[1]+' '+excerpt).toLowerCase(), needle=cleanName(person.name).toLowerCase();
 out.push({title:m[1].replace(/\s+/g,' ').trim().slice(0,200),url:m[2],excerpt:excerpt.slice(0,500),identity:needle&&evidence.includes(needle)?'姓名字符串出现，仍须核对单位时间':'摘要未见完整姓名，须核对',relation:'未判定',confidence:'未评估'}); }
 return out.slice(0,12);
}
function ingest(payload) { const list=JSON.parse(Buffer.from(payload,'base64').toString('utf8')); let limitedSeen=false;db.exec('BEGIN'); try {
 for(const item of list){let j=db.prepare('SELECT * FROM jobs WHERE id=?').get(item.id);if(!j)throw Error('未知任务 '+item.id);if(j.state==='done')continue;if(item.query)db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(item.id,'query',String(item.query).slice(0,600),now());
 const fail=Boolean(item.error)||typeof item.raw!=='string'||!item.raw.trim(); const person=db.prepare('SELECT name FROM records WHERE id=?').get(j.record_id); const parsed=fail?[]:sources(item.raw,person);
 if(fail||!parsed.length){const reason=String(item.error||'搜索结果无可识别来源'),limited=/\b429\b|rate limit|too many requests/i.test(reason);db.prepare("UPDATE jobs SET state='retry', attempts=attempts+?,error=?,updated=? WHERE id=?").run(limited?0:1,reason,now(),item.id);db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(item.id,limited?'rate_limit':'error',reason,now());if(limited)limitedSeen=true;continue;}
 db.prepare('INSERT INTO result_history(job_id,raw,sources_json,retrieved,archived) SELECT job_id,raw,sources_json,retrieved,? FROM results WHERE job_id=?').run(now(),item.id);db.prepare('INSERT OR REPLACE INTO results(job_id,raw,sources_json,retrieved) VALUES(?,?,?,?)').run(item.id,item.raw,JSON.stringify(parsed),now());
 enqueueSources(j.record_id,item.id,parsed);
 db.prepare(`INSERT INTO render_queue(record_id,dirty,attempts,error,updated) VALUES(?,1,0,NULL,?) ON CONFLICT(record_id) DO UPDATE SET dirty=1,attempts=0,error=NULL,updated=excluded.updated`).run(j.record_id,now());
 db.prepare("UPDATE jobs SET state='done',attempts=attempts+1,error=NULL,updated=? WHERE id=?").run(now(),item.id);
 } if(limitedSeen)backoff();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
function displayPageError(error) {
  const lines=String(error || '').split(/\r?\n/).map(line=>line.trim())
    .filter(line=>line && !line.startsWith('cite'));
  const detail=lines.find(line=>line.startsWith('Failed to fetch ')) || lines.join(' ');
  return detail.replace(/^Failed to fetch https?:\/\/\S+:\s+/, '')
    .replace(/https?:\/\/\S+/g, '[网址略]')
    .slice(0,160);
}
function render(id) { const r=db.prepare('SELECT * FROM records WHERE id=?').get(id);if(!r)throw Error('未知人物 '+id);
 const data=db.prepare('SELECT j.kind,j.query,j.state,j.error,r.sources_json,r.retrieved FROM jobs j LEFT JOIN results r ON r.job_id=j.id WHERE j.record_id=? ORDER BY j.kind').all(id);
 const completed=data.filter(x=>x.sources_json); if(!completed.length)return false;
 let lines=['## 自动检索线索（待人工核实）','','> [!warning] 检索摘要只是线索。姓名、机构、时间和研究方向必须交叉核对；不得仅凭合著或搜索摘要认定导师。'+(r.name_collision?' 此姓名存在跨校或同名记录，尚不能自动合并。':''),''];
 const mismatches=new Map(db.prepare('SELECT p.url,s.filename,s.name,s.unit FROM page_identity_mismatches m JOIN pages p ON p.id=m.page_id JOIN records s ON s.id=m.subject_record_id WHERE p.record_id=?').all(id).map(x=>[x.url,x]));
 const external = new Set(db.prepare("SELECT url FROM pages WHERE record_id=? AND state='excluded' AND error LIKE ?").all(id,externalIdentityExclusion+'%').map(p=>p.url));
 const identityWarning=url=>{const x=mismatches.get(url);return x?` **已核为其他同名者 [[${x.filename}|${x.name} · ${x.unit}]] 的页面，不作为本人物的身份或师承证据。**`:external.has(url)?' **已核为库外同名者页面，不作为本人物的身份或师承证据。**':''};
 for(const x of completed){lines.push(`- 检索类型：${x.kind==='training'?'博士及博士后':'任职及研究方向'}；检索时间：${x.retrieved}${x.state==='done'?'':'；旧结果，重新检索待完成'}`);for(const z of JSON.parse(x.sources_json).slice(0,4)){const title=z.title.replace(/[\[\]\r\n]/g,' ');lines.push(`  - [${title}](${z.url})：${z.excerpt.replace(/[\r\n]/g,' ').slice(0,240)}（${z.identity}；关系未判定，可信度未评估）${identityWarning(z.url)}`)} }
 for(const x of data.filter(x=>x.state==='retry')) lines.push(`- 待重试：${x.kind}；${String(x.error).slice(0,180)}`);
 for(const p of db.prepare("SELECT url,state,error,excerpt,retrieved FROM pages WHERE record_id=? AND (state IN ('done','retry') OR id IN (SELECT page_id FROM page_identity_mismatches) OR (state='excluded' AND error LIKE ?)) ORDER BY url").all(id,externalIdentityExclusion+'%')) {
  const warning=identityWarning(p.url);
  if(p.state==='done') lines.push(`- 已读取来源页 [网页](${p.url})（${p.retrieved}）：${String(p.excerpt||'').replace(/[\r\n]/g,' ').slice(0,200)}（身份及关系仍待核）。${warning}`);
  else if(p.state==='excluded') lines.push(`- 已排除来源页 [网页](${p.url})：${displayPageError(p.error)}。${warning}`);
  else {
   const nextStep=isNonRetryablePageError(p.error)?'需另找可访问的原始来源':'待重试';
   lines.push(`- 页面读取失败 [网页](${p.url})：${displayPageError(p.error)}；${nextStep}。${warning}`);
  }
 }
 const file=path.join(people,r.filename+'.md'),old=fs.readFileSync(file,'utf8'),start='<!-- PI-AUTO-SEARCH:START -->',end='<!-- PI-AUTO-SEARCH:END -->';
 const starts=old.split(start).length-1,ends=old.split(end).length-1;if(starts!==ends||starts>1||(starts===1&&old.indexOf(start)>old.indexOf(end)))throw Error('自动检索区标记不完整或重复，停止写入等待修复：'+file);
 const section=start+'\n'+lines.join('\n')+'\n'+end; let result;
 if(old.includes(start)&&old.includes(end)){let a=old.indexOf(start),b=old.indexOf(end,a)+end.length;result=old.slice(0,a)+section+old.slice(b);}else result=old.trimEnd()+'\n\n'+section+'\n';
 if(result!==old)writeAtomic(file,result,old);return true;
}
function flush() { const rows=db.prepare('SELECT record_id FROM render_queue WHERE dirty=1 AND attempts<3 ORDER BY updated').all(); let ok=0,failed=0;for(const x of rows){try{render(x.record_id);db.prepare('UPDATE render_queue SET dirty=0,error=NULL,updated=? WHERE record_id=?').run(now(),x.record_id);ok++;}catch(e){db.prepare('UPDATE render_queue SET attempts=attempts+1,error=?,updated=? WHERE record_id=?').run(String(e).slice(0,500),now(),x.record_id);failed++;}}return {rendered:ok,failed}; }
function report(){ const all=db.prepare(`SELECT r.*, (SELECT count(*) FROM jobs j WHERE j.record_id=r.id AND j.state='done') completed, (SELECT count(*) FROM pages p WHERE p.record_id=r.id AND p.state='done') page_count, EXISTS(SELECT 1 FROM manual_audit_events a WHERE a.record_id=r.id) logged_review FROM records r ORDER BY r.unit`).all(), groups=new Map();for(const r of all){let a=groups.get(r.unit)||{unit:r.unit,total:0,manual:0,loggedReview:0,searched:0,pageRead:0,phd:0,post:0,only:0,unresolved:0};const x=JSON.parse(r.relation_json),p=x.some(v=>phdLabel(v.type)),q=x.some(v=>postLabel(v.type)),o=x.some(v=>relationDirection(v.type)==='own_likely'&&/候选|课题组|研究师长/.test(v.type));a.total++;a.manual+=r.reviewed;a.loggedReview+=r.logged_review;a.searched+=Number(r.completed===2);a.pageRead+=Number(r.page_count>0);a.phd+=Number(p);a.post+=Number(q);a.only+=Number(o&&!p&&!q);a.unresolved+=Number(!p||!q);groups.set(r.unit,a)}const rows=[...groups.values()];
 const st=status(), date=now();let s=`# 自动检索运行进度\n\n[[逐校师承与方向复核进度|返回人工复核进度]] · [[人工核查台账进度|查看结构化人工核查事件]] · [[网页读取受阻与后续追查|网页受阻清单]] · [[PI关系图总入口|返回图谱]]\n\n生成时间：${date}。校属记录不等于去重人数。自动检索完成只表示两类检索都有可识别来源，不代表来源已核实或导师已查明。自动线索不创建师承关系。\n\n`;
 s+=`原网页读取任务：${st.pages.map(x=>x.state+' '+x.n).join('；')||'尚未建立'}；至少读取一页的校属记录：${st.records_with_page_read}。搜索摘要与实际打开网页分别计数；网页成功读取也不等于身份和关系已核实。\n\n`;
 s+=`总校属记录：${st.records}；已有人工台账事件：${st.records_with_logged_review}；人物页含院系核验标题：${st.manual_reviewed}；自动两类检索完成：${st.automatically_searched}；人物页标签为明确博士导师：${st.explicit_phd_records}；标签为明确博士后导师：${st.explicit_post_records}；只有候选或课题组等阶段关系（按标签推断本人方向）：${st.only_group_or_candidate}；至少一个阶段缺明确导师标签：${st.needs_further_review}；同名需核记录：${st.collisions}；存在方向未判定标签：${st.records_with_direction_undetermined}。人工台账数按有事件的校属记录计，关系待查也可有事件。院系核验标题是人物页格式标记。阶段方向仅按标签规则推断，不保证完整或正确，须逐人复核；标签沿用旧资料，不自动证明来源准确；各类可重叠；缺博士后导师也可能是没有博士后经历。\n\n| 学校或机构 | 校属记录 | 已登记人工核查 | 含院系核验标题 | 自动检索 | 读取网页 | 明确博士标签 | 明确博士后标签 | 仅候选或阶段关系（推断） | 缺至少一个明确标签 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
 for(const r of rows)s+=`| ${r.unit.replaceAll('|',' ')} | ${r.total} | ${r.loggedReview} | ${r.manual} | ${r.searched} | ${r.pageRead} | ${r.phd} | ${r.post} | ${r.only} | ${r.unresolved} |\n`;
 s+='\n失败与未完成的检索保存在同目录 SQLite 队列中，可重试；同名、阶段关系及导师缺失仍须逐条复核。\n';writeAtomic(path.join(graph,'自动检索运行进度.md'),s);
}
// 同人核读后复用精确网址的原始快照，保留读取时间及此前错误回执。
function reuseCachedPages(items, apply) {
 if (!Array.isArray(items) || !items.length) throw Error('须提供待复用原文的 JSON 数组');
 const getPage = db.prepare('SELECT * FROM pages WHERE id=?');
 const getIdentity = db.prepare(`SELECT event_id,kind FROM identity_assertion_events
  WHERE left_id=? AND right_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1`);
 const getObservation = db.prepare('SELECT * FROM page_observations WHERE page_id=? AND sha256=?');
 const mismatch = db.prepare('SELECT 1 FROM page_identity_mismatches WHERE page_id IN (?,?)');
 const activeLease = db.prepare('SELECT 1 FROM page_leases l JOIN pages p ON p.id=l.page_id WHERE p.url=? AND l.expires_at>?');
 const refresh = db.prepare('SELECT 1 FROM page_refresh_history WHERE page_id=? LIMIT 1');
 const copy = db.prepare(`INSERT OR IGNORE INTO page_observations
  (page_id,sha256,tool_output,bytes,retrieved,completeness) VALUES(?,?,?,?,?,?)`);
 const update = db.prepare("UPDATE pages SET state='done',error=NULL,excerpt=?,retrieved=? WHERE id=?");
 const event = db.prepare("INSERT INTO events(job_id,level,detail,created) VALUES(?,'page_cache_reused',?,?)");
 const dirty = db.prepare(`INSERT INTO render_queue(record_id,dirty,attempts,error,updated) VALUES(?,1,0,NULL,?)
  ON CONFLICT(record_id) DO UPDATE SET dirty=1,attempts=0,error=NULL,updated=excluded.updated`);
 const prefix = '复用已核同人缓存原文';
 const seen = new Set(), ready = [], skipped = [];
 db.exec(apply ? 'BEGIN IMMEDIATE' : 'BEGIN');
 try {
  for (const {source_id,target_id,identity_event_id,sha256,excerpt} of items) {
   if ([source_id,target_id,identity_event_id,sha256,excerpt].some(value => typeof value!=='string'||!value.trim())) {
    throw Error('缓存回执须提供来源页、目标页、同人事件、快照 SHA256 和人工核读摘要');
   }
   if (seen.has(target_id)) throw Error('重复的目标页面 '+target_id);
   seen.add(target_id);
   const source = getPage.get(source_id), target = getPage.get(target_id);
   const skip = reason => skipped.push({target_id, reason});
   if (!source || !target || source.record_id === target.record_id || source.url !== target.url) {
    skip('须为不同校属记录的同一精确网址');
    continue;
   }
   const identity = getIdentity.get(...[source.record_id,target.record_id].sort());
   if (identity?.kind !== 'same' || identity.event_id !== identity_event_id || mismatch.get(source_id,target_id)) {
    skip('缺少当前有效同人判定，或有网页同名冲突');
    continue;
   }
   const observation = getObservation.get(source_id,sha256);
   if (source.state !== 'done' || source.excerpt?.startsWith(prefix) ||
       !observation?.tool_output.trim() || !Number.isFinite(Date.parse(observation.retrieved))) {
    skip('来源缺少指定的直接读取快照');
    continue;
   }
   if (!['pending','retry'].includes(target.state) || refresh.get(target_id) ||
       activeLease.get(target.url,now())) {
    skip('目标已处理、已安排显式复读或存在有效租约');
    continue;
   }
   const detail = {source_id,target_id,identity_event_id,sha256,url:target.url,
    original_observed_at:observation.retrieved,previous_state:target.state,
    previous_error:target.error,previous_retrieved:target.retrieved};
   ready.push(detail);
   if (!apply) continue;
   copy.run(target_id,sha256,observation.tool_output,observation.bytes,observation.retrieved,observation.completeness);
   update.run((prefix+'（未重新请求）：'+excerpt.trim()).slice(0,3000),observation.retrieved,target_id);
   event.run(target.job_id,JSON.stringify(detail),now());
   dirty.run(target.record_id,now());
  }
  db.exec('COMMIT');
 } catch (error) { db.exec('ROLLBACK'); throw error; }
 return {applied:apply,ready,skipped};
}

function savePageObservation(pageId, raw) {
  if (typeof raw !== 'string' || !raw.trim() || Buffer.byteLength(raw, 'utf8') > 1048576) {
    throw Error('页面工具原始返回为空或超过 1 MiB，未保存或消费租约');
  }
  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  return db.prepare("INSERT OR IGNORE INTO page_observations(page_id,sha256,tool_output,bytes,retrieved,completeness) VALUES(?,?,?,?,?,'unknown')")
    .run(pageId, digest, raw, Buffer.byteLength(raw, 'utf8'), now()).changes;
}
// Correct an excerpt against a saved observation without claiming a new retrieval.
function correctReviewedExcerpts(items, apply) {
  if (!Array.isArray(items) || !items.length || items.length > 100) {
    throw Error('摘录更正须为 1–100 条的 JSON 数组');
  }
  const find = db.prepare(`SELECT p.record_id,p.job_id,p.excerpt,p.url,p.state,p.error FROM pages p
    JOIN page_observations o ON o.page_id=p.id AND o.sha256=?
    WHERE p.id=? AND (p.state='done' OR (p.state='retry' AND p.error LIKE '原网页返回替代内容：%'))
    AND NOT EXISTS(SELECT 1 FROM page_identity_mismatches m WHERE m.page_id=p.id)
    AND NOT EXISTS(SELECT 1 FROM page_leases l WHERE l.page_id=p.id AND l.expires_at>?)`);
  const update = db.prepare('UPDATE pages SET excerpt=? WHERE id=?');
  const markRetry = db.prepare("UPDATE pages SET state='retry',excerpt=NULL,error=? WHERE id=?");
  const event = db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)');
  const dirty = db.prepare(`INSERT INTO render_queue(record_id,dirty,attempts,error,updated) VALUES(?,1,0,NULL,?)
    ON CONFLICT(record_id) DO UPDATE SET dirty=1,attempts=0,error=NULL,updated=excluded.updated`);
  const seen = new Set();
  let changed = 0, unchanged = 0;
  db.exec(apply ? 'BEGIN IMMEDIATE' : 'BEGIN');
  try {
    for (const {page_id, sha256, before, after, reason} of items) {
      const invalid = after === null;
      if (typeof page_id !== 'string' || seen.has(page_id) || !/^[a-f0-9]{64}$/.test(sha256) ||
          typeof before !== 'string' || (!invalid && (typeof after !== 'string' || !after.trim() || after.length > 3000)) ||
          before === after || typeof reason !== 'string' || reason.trim().length < 8) {
        throw Error('每项须有唯一页面、原文散列、新旧摘录和更正理由');
      }
      seen.add(page_id);
      const time = now();
      const page = find.get(sha256, page_id, time);
      if (!page) throw Error('未找到对应已读原文，或页面有有效租约／身份冲突：' + page_id);
      const retryReason = invalid ? '原网页返回替代内容：' + reason.trim() : null;
      if (page.state === 'retry') {
        if (invalid && page.error === retryReason && page.excerpt === null) { unchanged++; continue; }
        throw Error('页面已进入重试，请核对原纠正事件：' + page_id);
      }
      if (page.excerpt === after) { unchanged++; continue; }
      if (page.excerpt !== before) throw Error('原摘录已变化：' + page_id);
      if (apply) {
        if (invalid) markRetry.run(retryReason, page_id);
        else update.run(after, page_id);
        event.run(page.job_id, invalid ? 'page_reading_invalidated' : 'page_excerpt_corrected',
          JSON.stringify({page_id, sha256, url:page.url, before, after, reason}), time);
        dirty.run(page.record_id, time);
      }
      changed++;
    }
    db.exec('COMMIT');
    return {changed, unchanged, applied:apply};
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
// Register a manual reading receipt by record and URL. The caller has already read the source.
function reviewedPage(item, skipped) {
  const {record_id, url, raw, excerpt, error} = item;
  const validPayload = error === undefined
    ? typeof raw === 'string' && raw.trim() && typeof excerpt === 'string' && excerpt.trim()
    : typeof error === 'string' && error.trim() && raw === undefined && excerpt === undefined;
  if (!validPayload || typeof record_id !== 'string' || typeof url !== 'string' ||
      !/^https?:\/\//.test(url) || !pageHost(url) ||
      (item.observed_at !== undefined && (typeof item.observed_at !== 'string' || !Number.isFinite(Date.parse(item.observed_at)))) ||
      /[?&](?:x-amz-signature|x-amz-security-token|signature|access_token|expires)=/i.test(url)) {
    throw Error('人工网页回执须提供校属 ID、持久 HTTP(S) 网址和原文及摘要，或单独的失败原因');
  }
  const job = db.prepare("SELECT id FROM jobs WHERE record_id=? AND kind='training'").get(record_id);
  if (!job) throw Error('未知校属记录 '+record_id);
  const skip = reason => { skipped.push({record_id, url, reason}); return null; };
  if (db.prepare('SELECT 1 FROM page_leases l JOIN pages p ON p.id=l.page_id WHERE p.url=? AND l.expires_at>?').get(url, now())) {
    return skip('同一网址存在有效租约');
  }
  enqueuePage(record_id, job.id, {url});
  const page = db.prepare('SELECT * FROM pages WHERE record_id=? AND url=?').get(record_id, url);
  if (db.prepare('SELECT 1 FROM page_identity_mismatches WHERE page_id=?').get(page.id)) return skip('该网址属于其他同名者');
  if (page.state === 'excluded') return skip('该网址已排除');
  if (page.state !== 'done' && db.prepare('SELECT 1 FROM page_refresh_history WHERE page_id=?').get(page.id)) {
    return skip('显式复读须凭租约提交');
  }
  if (error !== undefined && page.state === 'done') return skip('已保存成功读取');
  return page;
}
function ingestPages(items, reviewed = false) {
  const limitedHosts = new Set(), tally = {processed: 0, observations: 0, duplicates: 0, skipped: []};
  let limitedSeen = false;
  if (reviewed && (!Array.isArray(items) || !items.length || items.length > 100)) {
    throw Error('人工网页回执须为 1–100 条记录的 JSON 数组');
  }
  db.exec(reviewed ? 'BEGIN IMMEDIATE' : 'BEGIN');
  try {
    for (const item of items) {
      const p = reviewed ? reviewedPage(item, tally.skipped) : db.prepare('SELECT * FROM pages WHERE id=?').get(item.id);
      if (reviewed && !p) continue;
      if (!p) throw Error('未知页面任务 '+item.id);
      if (db.prepare('SELECT 1 FROM page_identity_mismatches WHERE page_id=?').get(p.id)) {
        throw Error('该页已核为其他同名者，不可按本人物导入');
      }
      const raw = reviewed ? item.raw : item.raw_page;
      const deferred = item.deferred_reason;
      if (deferred !== undefined && (reviewed || !item.lease_token || typeof deferred !== 'string' ||
          !deferred.trim() || item.error !== undefined || item.excerpt !== undefined || raw !== undefined)) {
        throw Error('网页延期须使用有效租约，且只提供延期原因');
      }
      if (!reviewed && p.state === 'done') continue;
      const content = String(item.excerpt || '') + '\n' + String(raw || '');
      const challenge = isPageVerification(content) ||
        /^(?:L\d+(?:@P\d+(?:-\d+)?)?:\s*)?(?:#\s*)?javascript is disabled\.?\s*$/im.test(content) ||
        /enable javascript and then reload|please enable javascript to continue/i.test(content);
      const campusRestricted = /you need to be on the university network in order to access this service/i.test(content);
      const missingResourceRedirect = typeof raw === 'string' &&
        /Redirected to URL:\s+https?:\/\/[^/\s]+\/(?:[^/\s;?#]+\/)*(?:notfound|404)\.html?(?=[\s;?&#]|$)/i.test(raw) &&
        /^L\d+:\s*(?:The resource you requested cannot be found|The requested (?:page|resource) (?:cannot be found|was not found))\b/im.test(raw);
      const error = item.error || (campusRestricted ? '页面要求校园网或 VPN，未获取正文' : null)
        || (missingResourceRedirect ? '404 Not Found：旧链接重定向至通用缺页，未取得人物原文' : null)
        || (challenge ? '页面返回浏览器验证而非正文' : null) || (!item.excerpt ? '未获取可用正文' : null);
      if (p.state === 'done') {
        if (reviewed && !error) tally.observations += savePageObservation(p.id, raw);
        continue;
      }
      validatePageLease(item, p);
      if (reviewed && error) {
        // The same saved failure must not consume another attempt or extend a host pause on replay.
        const digest = crypto.createHash('sha256').update(JSON.stringify([error, raw, item.observed_at])).digest('hex');
        const added = db.prepare('INSERT OR IGNORE INTO reviewed_page_failures(page_id,sha256) VALUES(?,?)').run(p.id, digest);
        if (!added.changes) { tally.duplicates++; continue; }
      }
      if (deferred !== undefined) {
        const reason = deferred.trim().slice(0, 1000);
        db.prepare("UPDATE pages SET state='retry',retrieved=? WHERE id=?").run(now(), p.id);
        db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)')
          .run(p.job_id, 'page_deferred', p.url+' '+reason, now());
      } else if (error) {
        const message = String(error);
        const limited = /\b429\b|rate limit|too many requests/i.test(message);
        const siteLimited = limited && message.includes('Failed to fetch '+p.url) && /\(429\)/.test(message);
        db.prepare("UPDATE pages SET state='retry',attempts=attempts+?,error=?,retrieved=? WHERE id=?")
          .run(limited ? 0 : 1, message.slice(0, 1000), now(), p.id);
        db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)')
          .run(p.job_id, siteLimited ? 'site_rate_limit' : limited ? 'rate_limit' : 'page_error', p.url+' '+message.slice(0, 500), now());
        if (isPageVerification(message) || /robots\.txt/i.test(message)) db.prepare("UPDATE pages SET state='excluded' WHERE id=?").run(p.id);
        if (siteLimited) { hostBackoff(p.url); limitedHosts.add(pageHost(p.url)); }
        else if (limited) limitedSeen = true;
      } else {
        if (raw !== undefined) tally.observations += savePageObservation(p.id, raw);
        db.prepare("UPDATE pages SET state='done',attempts=attempts+1,error=NULL,excerpt=?,retrieved=? WHERE id=?")
          .run(String(item.excerpt).slice(0, 3000), now(), p.id);
      }
      db.prepare(`INSERT INTO render_queue(record_id,dirty,attempts,error,updated) VALUES(?,1,0,NULL,?)
        ON CONFLICT(record_id) DO UPDATE SET dirty=1,attempts=0,error=NULL,updated=excluded.updated`).run(p.record_id, now());
      tally.processed++;
    }
    if (limitedHosts.size) {
      const since = new Date(Date.now()-120000).toISOString();
      for (const e of db.prepare("SELECT detail FROM events WHERE level='site_rate_limit' AND created>=?").all(since)) {
        const m = String(e.detail).match(/^https?:\/\/[^\s]+/i);
        if (m && pageHost(m[0])) limitedHosts.add(pageHost(m[0]));
      }
    }
    if (limitedSeen || limitedHosts.size >= 2) backoff(limitedHosts.size >= 2 ? 1800000 : 0);
    db.exec('COMMIT');
    return tally;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
if(command==='sync'){console.log(JSON.stringify(sync()));report();}
else if(command==='next'){const limit=Math.max(1,Math.min(8,Number(args[1])||2)),pauses=db.prepare("SELECT value FROM settings WHERE key IN ('backoff_until','thesis_search_retry_after')").all();if(pauses.some(x=>Date.parse(x.value)>Date.now()))console.log('[]');else {const jobs=db.prepare("SELECT j.id,j.kind,j.query,j.state,j.attempts,r.name,r.unit,r.name_collision FROM jobs j JOIN records r ON r.id=j.record_id WHERE j.state IN ('pending','retry') AND j.attempts<3 ORDER BY CASE WHEN j.state='retry' THEN 0 ELSE 1 END,r.reviewed,r.unit,r.name,j.kind LIMIT ?").all(limit);console.log(JSON.stringify(jobs.map(j=>({...j,query:searchQuery(j)}))));}}
else if(command==='ingest'){const p=args[1]||fs.readFileSync(0,'utf8').trim();ingest(p);const result=flush();sync();report();console.log(JSON.stringify({flush:result,...status()}));}
else if(command==='ingest-json'){const p=Buffer.from(fs.readFileSync(args[1],'utf8'),'utf8').toString('base64');ingest(p);const result=flush();sync();report();console.log(JSON.stringify({flush:result,...status()}));}
else if(command==='enqueue-pages'){const rows=db.prepare('SELECT j.id,j.record_id,r.sources_json FROM jobs j JOIN results r ON r.job_id=j.id').all();db.exec('BEGIN');try{for(const r of rows)enqueueSources(r.record_id,r.id,JSON.parse(r.sources_json));db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}console.log(JSON.stringify(status()));}
else if(command==='reparse-sources'){const rows=db.prepare('SELECT j.id,j.record_id,r.name,s.raw FROM jobs j JOIN records r ON r.id=j.record_id JOIN results s ON s.job_id=j.id').all();db.exec('BEGIN');try{for(const r of rows){const parsed=sources(r.raw,r);if(parsed.length){db.prepare('UPDATE results SET sources_json=? WHERE job_id=?').run(JSON.stringify(parsed),r.id);enqueueSources(r.record_id,r.id,parsed);}else db.prepare("UPDATE jobs SET state='retry',error='仅含临时签名链接或无法识别的来源',updated=? WHERE id=?").run(now(),r.id);db.prepare(`INSERT INTO render_queue(record_id,dirty,attempts,error,updated) VALUES(?,1,0,NULL,?) ON CONFLICT(record_id) DO UPDATE SET dirty=1,attempts=0,error=NULL,updated=excluded.updated`).run(r.record_id,now())}for(const p of db.prepare('SELECT id,url FROM pages').all())if(/[?&](?:x-amz-signature|x-amz-security-token|signature|access_token|expires)=/i.test(p.url))db.prepare("UPDATE pages SET state='excluded',error='临时签名链接，不作为持久来源' WHERE id=?").run(p.id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}const f=flush();sync();report();console.log(JSON.stringify({flush:f,...status()}));}
else if(command==='seed-first-read-pages'){console.log(JSON.stringify(seedFirstReadPages(args[1]==='apply')));}
else if(command==='enqueue-reviewed-links'){console.log(JSON.stringify(enqueueReviewedLinks(JSON.parse(fs.readFileSync(args[1],'utf8')))));}
else if(command==='correct-reviewed-excerpts'){console.log(JSON.stringify(correctReviewedExcerpts(JSON.parse(fs.readFileSync(args[1],'utf8')),args[2]==='apply')));}
else if(command==='next-page'){console.log(JSON.stringify(availablePages(Math.max(1,Math.min(4,Number(args[1])||1)))));}
else if(command==='page-observation'){const p=db.prepare('SELECT id,url,state FROM pages WHERE id=?').get(args[1]);if(!p)throw Error('未知页面任务');const o=db.prepare('SELECT sha256,tool_output,bytes,retrieved,completeness FROM page_observations WHERE page_id=? ORDER BY retrieved DESC,rowid DESC LIMIT 1').get(p.id)||null;console.log(JSON.stringify({page:p,observation:o,note:'这是网页工具的返回内容，可能不完整；没有留存不代表没有读取过。'}));}
else if(command==='refresh-page'){console.log(JSON.stringify(refreshPage(args[1],args[2])));}
else if(command==='lease-pages'){console.log(JSON.stringify(leasePages(Math.max(1,Math.min(4,Number(args[1])||1)))));}
else if(command==='ingest-pages'){const items=JSON.parse(fs.readFileSync(args[1],'utf8'));ingestPages(items);const result=flush();sync();report();console.log(JSON.stringify({flush:result,...status()}));}
else if(command==='ingest-reviewed-pages'){const items=JSON.parse(fs.readFileSync(args[1],'utf8'));const reviewed=ingestPages(items,true);const result=flush();sync();report();console.log(JSON.stringify({reviewed,flush:result,...status()}));}
else if(command==='ingest-pages-base64'){const items=JSON.parse(Buffer.from(args[1],'base64').toString('utf8'));ingestPages(items);const result=flush();sync();report();console.log(JSON.stringify({flush:result,...status()}));}
else if(command==='reuse-cached-pages'){
 const items=JSON.parse(fs.readFileSync(args[1],'utf8'));
 const reused=reuseCachedPages(items,args[2]==='apply');
 console.log(JSON.stringify(reused.applied ? {...reused,flush:flush()} : reused));
}
else if(command==='flush'){console.log(JSON.stringify(flush()));}
else if(command==='retry-failed'){db.prepare("UPDATE jobs SET attempts=0,updated=? WHERE state='retry' AND attempts>=3").run(now());db.prepare("UPDATE pages SET attempts=0,retrieved=NULL WHERE state='retry' AND attempts>=3").run();db.prepare('UPDATE render_queue SET attempts=0,updated=? WHERE dirty=1 AND attempts>=3').run(now());console.log(JSON.stringify(status()));}
else if(command==='retry-no-sources'){const rows=db.prepare("SELECT id FROM jobs WHERE state='retry' AND error='搜索结果无可识别来源' AND attempts>=3").all();db.exec('BEGIN');try{for(const r of rows){db.prepare('UPDATE jobs SET attempts=1,updated=? WHERE id=?').run(now(),r.id);db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(r.id,'retry','原检索无可识别来源，使用较宽松查询重新排队；原查询保留',now())}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}console.log(JSON.stringify({requeued:rows.length,...status()}));}
else if(command==='recover-site-limits'){let count=0;for(const p of db.prepare("SELECT url,error,retrieved FROM pages WHERE state='retry' AND error IS NOT NULL AND retrieved IS NOT NULL").all()){if(!String(p.error).includes('Failed to fetch '+p.url)||!/\(429\)/.test(p.error))continue;const host=pageHost(p.url),ts=Date.parse(p.retrieved);if(!host||!Number.isFinite(ts)||ts+1800000<=Date.now())continue;const until=new Date(ts+1800000).toISOString(),old=db.prepare('SELECT until FROM host_limits WHERE host=?').get(host);if(old&&old.until>=until)continue;db.prepare('INSERT INTO host_limits(host,until,streak,last_limit) VALUES(?,?,1,?) ON CONFLICT(host) DO UPDATE SET until=excluded.until,last_limit=excluded.last_limit').run(host,until,p.retrieved);count++}console.log(JSON.stringify({recovered_hosts:count,...status()}));}
else if(command==='refresh-record'){const id=args[1];if(!db.prepare('SELECT id FROM records WHERE id=?').get(id))throw Error('未知记录 '+id);db.prepare("UPDATE jobs SET state='pending',attempts=0,error=NULL,updated=? WHERE record_id=?").run(now(),id);db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(id,'refresh','手动要求增量重新检索；旧结果保留',now());console.log(JSON.stringify(status()));}
else if(command==='recover-429'){db.prepare("UPDATE jobs SET attempts=CASE WHEN attempts>0 THEN attempts-1 ELSE 0 END WHERE state='retry' AND (error LIKE '%429%' OR lower(error) LIKE '%rate limit%')").run();db.prepare("INSERT INTO settings(key,value) VALUES('backoff_until',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(new Date(Date.now()+120000).toISOString());console.log(JSON.stringify(status()));}
else if(command==='report'){flush();sync();report();console.log(JSON.stringify(status()));}
else if(command==='status')console.log(JSON.stringify(status()));
else throw Error('用法: node 检索流程.cjs sync|next [数量]|ingest BASE64|ingest-reviewed-pages JSON文件|enqueue-reviewed-links JSON文件|correct-reviewed-excerpts JSON文件 [apply]|seed-first-read-pages [apply]|report|status');
