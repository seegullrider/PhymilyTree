// 可断点续跑的博士论文检索任务。搜索输出只能作为线索，不自动判定导师或改人物页。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync(process.env.PI_AUTOMATION_DB || path.join(__dirname, '检索队列.sqlite'));
db.exec(`PRAGMA busy_timeout=10000;
CREATE TABLE IF NOT EXISTS thesis_search_jobs (
 record_id TEXT PRIMARY KEY, query TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0, lease_until TEXT, retry_after TEXT,
 error TEXT, raw TEXT, sources_json TEXT NOT NULL DEFAULT '[]', updated TEXT NOT NULL,
 FOREIGN KEY(record_id) REFERENCES records(id));
CREATE INDEX IF NOT EXISTS idx_thesis_search_state ON thesis_search_jobs(state,retry_after,lease_until);`);
if (!db.prepare('PRAGMA table_info(thesis_search_jobs)').all().some(x=>x.name==='lease_token'))
 db.exec('ALTER TABLE thesis_search_jobs ADD COLUMN lease_token TEXT');
if (!db.prepare('PRAGMA table_info(thesis_search_jobs)').all().some(x=>x.name==='reused_from'))
 db.exec('ALTER TABLE thesis_search_jobs ADD COLUMN reused_from TEXT');
const now=()=>new Date().toISOString(), add=ms=>new Date(Date.now()+ms).toISOString();
const clean=s=>s.replace(/[:：].*$/,'').replace(/（[^）]*）|\([^)]*\)/g,' ').replace(/\s*[—–]\s*.*$/,'').replace(/["\r\n]/g,'').replace(/\s+/g,' ').trim();
function thesisQuery(name){
 const normalized=clean(name);
 return normalized ? `"${normalized}" PhD dissertation thesis advisor` : null;
}
function refineQueries(items){
 if(!Array.isArray(items)||!items.length||items.length>100)throw Error('须提供 1–100 条已核题名');
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec('CREATE TABLE IF NOT EXISTS thesis_query_history (record_id TEXT NOT NULL, query TEXT NOT NULL, snapshot_json TEXT NOT NULL, replacement_query TEXT NOT NULL, title_source TEXT NOT NULL, replaced_at TEXT NOT NULL, PRIMARY KEY(record_id,query), FOREIGN KEY(record_id) REFERENCES records(id))');
  const current=db.prepare('SELECT t.*,r.name FROM thesis_search_jobs t JOIN records r ON r.id=t.record_id WHERE t.record_id=?');
  const seen=db.prepare('SELECT 1 FROM thesis_query_history WHERE record_id=? AND query=?');
  const archive=db.prepare('INSERT INTO thesis_query_history VALUES(?,?,?,?,?,?)');
  const update=db.prepare("UPDATE thesis_search_jobs SET query=?,state='pending',attempts=0,lease_until=NULL,lease_token=NULL,retry_after=NULL,error=NULL,raw=NULL,sources_json='[]',reused_from=NULL,updated=? WHERE record_id=?");
  const changes=[];
  for(const item of items){
   const {record_id,title,source}=item||{};
   if(typeof record_id!=='string'||typeof title!=='string'||typeof source!=='string')throw Error('缺校属 ID、已核论文题名或来源');
   const normalized=title.replace(/["“”\s]+/gu,' ').trim();
   let reference;try{reference=new URL(source)}catch{throw Error('题名来源必须是可复核的网页 '+record_id)}
   if(!normalized||reference.protocol!=='https:'||reference.username||reference.password||
     /[?&](?:x-amz-[^=]*|signature|access_token|token|expires)=/i.test(reference.search)){
    throw Error('题名或稳定来源不合法 '+record_id);
   }
   const row=current.get(record_id);
   if(!row)throw Error('未知博士检索任务 '+record_id);
   const query='"'+normalized+'" "'+clean(row.name)+'" dissertation';
   if(row.query===query||seen.get(record_id,query))continue;
   if(row.state!=='done'&&(row.state!=='pending'||row.attempts!==0||row.raw!==null)){
    throw Error('仅可细化已返回响应或尚未尝试的任务 '+record_id);
   }
   const ts=now();
   archive.run(record_id,row.query,JSON.stringify(row),query,reference.href,ts);
   update.run(query,ts,record_id);
   changes.push(record_id);
  }
  db.exec('COMMIT');
  return {refined:changes.length,record_ids:changes,note:'既有检索响应保留；新检索仍遵循共享退避，题名和搜索结果不能自动建立导师关系。'};
 }catch(e){db.exec('ROLLBACK');throw e}
}
// 旧状态混合正式导师和阶段师长；全覆盖模式不能按状态跳过任何人。
function needsThesisSearch(e,all=false){
 if(all)return true;
 if(e.aspects?.phd?.status!=='confirmed_advisor')return true;
 const context=String(e.aspects.phd.note||'')+' '+String(e.next_step||'');
 return /(?:正式.{0,12}(?:待核|待查|未明|未核|尚未|待确认)|(?:论文|学位).{0,12}(?:导师|advisor|adviser|登记|职衔).{0,12}(?:待核|待查|未明|未核|需核))/i.test(context);
}
function init(forceAll=false){
 if(forceAll)db.prepare("INSERT INTO settings(key,value) VALUES('thesis_coverage_mode','all') ON CONFLICT(key) DO UPDATE SET value='all'").run();
 const all=db.prepare("SELECT value FROM settings WHERE key='thesis_coverage_mode'").get()?.value==='all';
 const rows=db.prepare(`SELECT r.id,r.name,r.unit,a.details_json FROM records r
 LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x
 WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();
 const insert=db.prepare('INSERT OR IGNORE INTO thesis_search_jobs(record_id,query,updated) VALUES(?,?,?)');
 const supersede=db.prepare("UPDATE thesis_search_jobs SET state='superseded',error='最新人工事件已确认博士导师且未提示正式论文导师待核，跳过重复检索',updated=? WHERE record_id=? AND state IN ('pending','retry')");
 const reactivate=db.prepare("UPDATE thesis_search_jobs SET state='pending',error=NULL,retry_after=NULL,attempts=0,updated=? WHERE record_id=? AND state='superseded'");
 let eligible=0,inserted=0,skipped=0,reactivated=0; db.exec('BEGIN IMMEDIATE');
 try{for(const r of rows){const e=r.details_json?JSON.parse(r.details_json):{};if(!needsThesisSearch(e,all)){skipped+=Number(supersede.run(now(),r.id).changes);continue;}
   const query=thesisQuery(r.name);if(!query)continue;eligible++;inserted+=Number(insert.run(r.id,query,now()).changes);
   reactivated+=Number(reactivate.run(now(),r.id).changes);
 }db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 return {eligible,inserted,skipped,reactivated,...status()};
}
const hasHistory=()=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='thesis_query_history'").get();
function status(){return {states:db.prepare('SELECT state,count(*) n FROM thesis_search_jobs GROUP BY state ORDER BY state').all(),
 total:db.prepare('SELECT count(*) n FROM thesis_search_jobs').get().n,
 coverage_mode:db.prepare("SELECT value FROM settings WHERE key='thesis_coverage_mode'").get()?.value||'selective',
 reused_search_results:db.prepare("SELECT count(*) n FROM thesis_search_jobs WHERE state='done' AND reused_from IS NOT NULL").get().n,
 archived_responses:hasHistory()?db.prepare("SELECT count(*) n FROM thesis_query_history WHERE json_type(snapshot_json,'$.raw')='text'").get().n:0,
 records_with_any_response:db.prepare(hasHistory()?
  "SELECT count(*) n FROM (SELECT record_id FROM thesis_search_jobs WHERE state='done' UNION SELECT record_id FROM thesis_query_history WHERE json_type(snapshot_json,'$.raw')='text')":
  "SELECT count(*) n FROM thesis_search_jobs WHERE state='done'").get().n,
 global_retry_after:db.prepare("SELECT value FROM settings WHERE key='thesis_search_retry_after'").get()?.value||null, shared_backoff_until:db.prepare("SELECT value FROM settings WHERE key='backoff_until'").get()?.value||null,
 note:'搜索结果只是线索；状态 done 不表示原文已读取或关系已核实。'};}
function report(){
 const st=status(),rows=db.prepare(`SELECT r.unit,count(*) total,
  SUM(CASE WHEN t.state='done' THEN 1 ELSE 0 END) done,
  SUM(CASE WHEN t.state='pending' THEN 1 ELSE 0 END) pending,
  SUM(CASE WHEN t.state='retry' THEN 1 ELSE 0 END) retry,
  SUM(CASE WHEN t.state='leased' THEN 1 ELSE 0 END) leased,
  SUM(CASE WHEN t.state='superseded' THEN 1 ELSE 0 END) superseded,
  SUM(CASE WHEN t.record_id IS NULL THEN 1 ELSE 0 END) absent
  FROM records r LEFT JOIN thesis_search_jobs t ON t.record_id=r.id GROUP BY r.unit ORDER BY r.unit`).all();
 let s=`# 博士论文专项检索进度\n\n[[师承待查名单（按最新人工事件）|师承待查名单]] · [[PI关系图总入口|图谱入口]]\n\n生成时间：${now()}。覆盖模式：${st.coverage_mode}。校属记录不是去重人数；全覆盖模式将每条校属记录纳入专项队列。\n\n`;
 s+=`状态：${st.states.map(x=>`${x.state} ${x.n}`).join('；')}；已保存响应中 ${st.reused_search_results} 条复用完全相同检索式。搜索响应只提供追查线索，done 不表示找到论文、读过全文或确认导师；姓名相同仍须分人核实。\n\n`;
 if (st.archived_responses) {
  s+=`更换为已核题名检索式时，旧响应已归档 ${st.archived_responses} 条。计入归档后，曾返回过检索响应的校属记录有 ${st.records_with_any_response} 条。\n\n`;
 }
 s+=`当前共享退避至：${st.shared_backoff_until||'未设置'}；论文检索退避至：${st.global_retry_after||'未设置'}。过期时间仅表示不再受该项暂停限制，具体主机限制仍须遵守。\n\n`;
 s+='| 学校或机构 | 校属记录 | 已保存响应 | 待检索 | 重试 | 租用中 | 跳过 | 未入队 |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
 for(const r of rows)s+=`| ${r.unit.replaceAll('|','／')} | ${r.total} | ${r.done} | ${r.pending} | ${r.retry} | ${r.leased} | ${r.superseded} | ${r.absent} |\n`;
 const target=path.join(process.env.PI_GRAPH_ROOT||path.resolve(__dirname,'..'),'博士论文专项检索进度.md');fs.writeFileSync(target,s,'utf8');return {target,...st};
}
function next(limit){
 // 搜索服务限流由两个队列共同遵守，不能借用另一队列绕开全局退避。
 const global=db.prepare("SELECT value FROM settings WHERE key IN ('thesis_search_retry_after','backoff_until')").all();
 if(global.some(x=>Date.parse(x.value)>Date.now()))return [];
 const all=db.prepare("SELECT value FROM settings WHERE key='thesis_coverage_mode'").get()?.value==='all';
 db.exec('BEGIN IMMEDIATE');try{
  if(all){
   const missing=db.prepare(`SELECT r.id,r.name FROM records r
    WHERE NOT EXISTS (SELECT 1 FROM thesis_search_jobs t WHERE t.record_id=r.id)`).all();
   const insert=db.prepare('INSERT INTO thesis_search_jobs(record_id,query,updated) VALUES(?,?,?)');
   for(const record of missing){
    const query=thesisQuery(record.name);
    if(query)insert.run(record.id,query,now());
   }
  }
  db.prepare("UPDATE thesis_search_jobs SET state='retry',lease_until=NULL,lease_token=NULL,error='检索任务租约过期，允许安全续跑',updated=? WHERE state='leased' AND lease_until<=?").run(now(),now());
  const pendingEvents=db.prepare(`SELECT t.record_id,a.details_json FROM thesis_search_jobs t JOIN manual_audit_events a
    ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=t.record_id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
    WHERE t.state IN ('pending','retry')`).all();
  const skip=db.prepare("UPDATE thesis_search_jobs SET state='superseded',error='最新人工事件已确认博士导师且未提示正式论文导师待核，跳过重复检索',updated=? WHERE record_id=? AND state IN ('pending','retry')");
  for(const r of pendingEvents)if(!needsThesisSearch(JSON.parse(r.details_json),all))skip.run(now(),r.record_id);
  // 只复用完全相同的检索响应，不合并人物，也不推断身份或师承。
  const candidates=db.prepare("SELECT record_id,query FROM thesis_search_jobs WHERE state IN ('pending','retry') AND (retry_after IS NULL OR retry_after<=?) AND attempts<3").all(now());
  const cached=db.prepare("SELECT record_id,raw,sources_json FROM thesis_search_jobs WHERE query=? AND state='done' AND reused_from IS NULL AND raw IS NOT NULL AND updated>=? ORDER BY updated DESC LIMIT 1");
  const reuse=db.prepare("UPDATE thesis_search_jobs SET state='done',raw=?,sources_json=?,reused_from=?,error='复用同一检索式的近期搜索线索；身份必须分别核对',retry_after=NULL,updated=? WHERE record_id=? AND state IN ('pending','retry')");
  const freshAfter=add(-30*24*3600000);for(const r of candidates){const x=cached.get(r.query,freshAfter);if(x&&x.record_id!==r.record_id)reuse.run(x.raw,x.sources_json,x.record_id,now(),r.record_id)}
  const rows=db.prepare(`SELECT t.record_id,t.query,t.attempts,r.name,r.unit,r.name_collision
   FROM thesis_search_jobs t JOIN records r ON r.id=t.record_id
   LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=t.record_id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
   WHERE t.state IN ('pending','retry') AND (t.retry_after IS NULL OR t.retry_after<=?) AND t.attempts<3
   ORDER BY CASE WHEN COALESCE(json_extract(a.details_json,'$.aspects.phd.status'),'')<>'confirmed_advisor' THEN 0 ELSE 1 END,
            CASE WHEN t.state='pending' THEN 0 ELSE 1 END,r.unit,r.name LIMIT ?`).all(now(),limit*8);
  const seen=new Set(),unique=rows.filter(r=>!seen.has(r.query)&&seen.add(r.query)).slice(0,limit);
  const lease=add(15*60*1000),put=db.prepare("UPDATE thesis_search_jobs SET state='leased',lease_until=?,lease_token=?,updated=? WHERE record_id=?");
  for(const r of unique){r.lease_token=crypto.randomUUID();put.run(lease,r.lease_token,now(),r.record_id)}db.exec('COMMIT');return unique;
 }catch(e){db.exec('ROLLBACK');throw e}
}
function urls(text){const out=[];for(const m of text.matchAll(/https?:\/\/[^\s<>"\])]+/g)){
 let u=m[0].replace(/-{8,}.*$/,'').replace(/[.,;，。]+$/,'');try{const x=new URL(u);if(x.protocol==='https:'||x.protocol==='http:'){u=x.href;if(!out.includes(u))out.push(u)}}catch{}
 }return out.slice(0,30);}
// 搜索服务可能返回临时签名网址和个人联系信息；仅保留完成师承追查所需内容。
function sanitizeRaw(text){return String(text).replace(/https?:\/\/[^\s<>"\])]+/gi,u=>/[?&](?:x-amz-[^=]*|signature|access_token|expires)=/i.test(u)?'[临时签名链接已省略]':u)
 .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已省略]')
 // 仅处理独立字段，避免把 Ph.D. 或普通学术正文误识别为电话。
 .replace(/(^|\n)[ \t*]*(?:Phone|Telephone|Tel\.?|Fax|Mobile|Ph)\s*(?::\s*|\s+(?=[+(0-9]))[+()\d][^\r\n]*/gi,'$1[电话已省略]')
 .replace(/(^|\n)[ \t*]*(?:Home|Residential|Personal)[ \t]+Address[ \t]*:\*{0,2}[^\r\n]*(?:\r?\n(?![ \t]*(?:\r?$|#{1,6}[ \t]|\*\*[^\r\n]+\*\*))[^\r\n]*){0,5}/gim,'$1[私人住址已省略]')
 .replace(/(^|\n)[ \t]*(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}[ \t]*(?=\r?\n|$)/g,'$1[电话已省略]')
 .replace(/(^|\n)[ \t*]*(?:Born|Date of Birth)\s*:[^\r\n]*/gi,'$1[出生日期已省略]')
 .replace(/\*\*Date of Birth:\*\*[^\r\n]*/gi,'[出生日期已省略]')
 .replace(/\bDate of Birth:[^\r\n]*/gi,'[出生日期已省略]')
 .split('\n').map(line=>/\b(?:was born|born on)\b.{0,150}\b(?:\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december))\b/i.test(line)?'[含出生日期的搜索片段已省略]':line).join('\n');}
function ingest(items){if(!Array.isArray(items)||!items.length||items.length>4)throw Error('结果须为 1–4 条数组');
 const ids=new Set();for(const x of items){if(!x||typeof x.record_id!=='string'||ids.has(x.record_id))throw Error('缺少或重复 record_id');ids.add(x.record_id);if(x.deferred===true){if(typeof x.reason!=='string'||x.reason.trim().length<8||x.raw!==undefined||x.error!==undefined)throw Error('未提交任务须提供 reason 且不能同时提供 raw/error');}else if(typeof x.raw!=='string'&&typeof x.error!=='string')throw Error('须提供 raw 或 error');}
 const done=db.prepare("UPDATE thesis_search_jobs SET state='done',attempts=attempts+1,lease_until=NULL,lease_token=NULL,retry_after=NULL,error=NULL,raw=?,sources_json=?,updated=? WHERE record_id=?");
 const fail=db.prepare("UPDATE thesis_search_jobs SET state='retry',attempts=attempts+1,lease_until=NULL,lease_token=NULL,retry_after=?,error=?,updated=? WHERE record_id=?");
 const defer=db.prepare("UPDATE thesis_search_jobs SET state='retry',lease_until=NULL,lease_token=NULL,retry_after=?,error=?,updated=? WHERE record_id=?");
 db.exec('BEGIN IMMEDIATE');try{for(const x of items){const old=db.prepare('SELECT state,lease_token FROM thesis_search_jobs WHERE record_id=?').get(x.record_id);
  if(!old)throw Error('未知任务 '+x.record_id);if(old.state==='done')continue;if(old.state!=='leased')throw Error('任务未被租用 '+x.record_id);
  if(!x.lease_token||x.lease_token!==old.lease_token)throw Error('租约已过期或不匹配 '+x.record_id);
  if(x.deferred===true){defer.run(add(30*60000),sanitizeRaw(x.reason).slice(0,1000),now(),x.record_id);continue;}
  const raw=sanitizeRaw(x.raw||''), error=x.error?sanitizeRaw(x.error):(!raw.trim()?'检索返回空内容':/^(Internal Error|Fatal error|Failed to fetch)/i.test(raw.trim())?raw.slice(0,1000):null);
  if(error){const limited=/429|rate.?limit|too many requests/i.test(String(error));const until=add(limited?4*3600000:30*60000);fail.run(until,String(error).slice(0,1000),now(),x.record_id);
   if(limited)db.prepare("INSERT INTO settings(key,value) VALUES('thesis_search_retry_after',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(until);
  }else done.run(raw.slice(0,60000),JSON.stringify(urls(raw)),now(),x.record_id);
 }db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return status();}
// 仅把可能的原始资料加入既有网页队列；身份及导师关系仍须人工核对。
function queueSources(){
 const rows=db.prepare("SELECT t.record_id,t.raw,r.name FROM thesis_search_jobs t JOIN records r ON r.id=t.record_id WHERE t.state='done'").all();
 const job=db.prepare("SELECT id FROM jobs WHERE record_id=? AND kind='training'");
 const insert=db.prepare("INSERT OR IGNORE INTO pages(id,record_id,job_id,url) VALUES(?,?,?,?)");
 let added=0;db.exec('BEGIN IMMEDIATE');try{for(const row of rows){const j=job.get(row.record_id);if(!j)continue;
   // 名字仅作为筛选，不能排除同名者；尤其不可把论文作者的导师误认为论文作者。
   const name=clean(row.name).toLowerCase().replace(/\s+/g,' ').trim();
   if(!name||name.length<5)continue;
   let count=0;for(const block of String(row.raw||'').split(/-{8,}/)){
    const header=block.trim().match(/^([^\n]+?) \((https?:\/\/[^\s)]+)\)/);if(!header)continue;
    const title=header[1].toLowerCase().replace(/\s+/g,' '),body=block.slice(0,2500).toLowerCase().replace(/\s+/g,' '),at=body.indexOf(name);
    const explicitAuthor=at>=0&&/\b(?:author|by|candidate|prepared by)\s*:?\s*$/i.test(body.slice(Math.max(0,at-32),at));
    if(!title.includes(name)&&!explicitAuthor)continue;
    const u=header[2];let x;try{x=new URL(u)}catch{continue}
    if(x.username||x.password||/[?&](?:x-amz-signature|signature|access_token|expires)=/i.test(x.search)||/[<>"'`]/.test(u)||[...x.searchParams.values()].some(v=>/(?:^|[\s"'<>])on(?:error|load|click)\s*=|<script\b|javascript\s*:/i.test(v)))continue;
    if(!/(^|\.)(?:edu|gov|ac)\.[a-z]{2}$|\.edu$|\.gov$|\.ac\.uk$|\.edu\.sg$|\.ac\.jp$/i.test(x.hostname))continue;
    const id=crypto.createHash('sha256').update(row.record_id+'\n'+u).digest('hex').slice(0,24);
    added+=Number(insert.run(id,row.record_id,j.id,u).changes);if(++count>=2)break;
   }
  }db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return {added,source:'博士论文专项搜索；网页仍需身份核实'};
}
try{const [cmd,arg]=process.argv.slice(2);let result;
 if(cmd==='init')result=init();else if(cmd==='init-all')result=init(true);else if(cmd==='status')result=status();else if(cmd==='report')result=report();
 else if(cmd==='next')result=next(Math.max(1,Math.min(4,Number(arg)||2)));
 else if(cmd==='ingest')result=ingest(JSON.parse(fs.readFileSync(arg,'utf8')));
 else if(cmd==='refine-queries')result=refineQueries(JSON.parse(fs.readFileSync(arg,'utf8')));
 else if(cmd==='queue-sources')result=queueSources();
 else if(cmd==='show'){result=db.prepare('SELECT * FROM thesis_search_jobs WHERE record_id=?').get(arg)||null;}
 else throw Error('命令：init | init-all | status | report | next [1–4] | ingest JSON文件 | refine-queries 已核题名JSON | queue-sources | show record_id');
 console.log(JSON.stringify(result));
}catch(e){console.error(String(e));process.exitCode=1;}finally{db.close();}
