// 人工逐页记录已验证的同名误配。保留已读内容、原始任务与身份比较证据；不自动合并记录。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'));
db.exec(`PRAGMA busy_timeout=10000;
CREATE TABLE IF NOT EXISTS page_identity_mismatches(page_id TEXT PRIMARY KEY,subject_record_id TEXT NOT NULL,identity_event_id TEXT NOT NULL,evidence TEXT NOT NULL,snapshot_json TEXT NOT NULL,recorded_at TEXT NOT NULL,FOREIGN KEY(page_id) REFERENCES pages(id),FOREIGN KEY(subject_record_id) REFERENCES records(id));`);
const externalPrefix = '已人工核实属于数据库外其他同名者：';
function excludeExternal(page, item) {
 if (page.record_id !== item.record_id || typeof item.external_subject !== 'string' || item.external_subject.trim().length < 8) {
  throw Error('须指定当前人物记录及库外同名者的姓名、单位或方向');
 }
 const audit = db.prepare('SELECT record_id FROM manual_audit_events WHERE audit_id=?').get(item.audit_id);
 if (audit?.record_id !== page.record_id) throw Error('须引用当前人物的人工核查事件');
 const error = `${externalPrefix}${item.external_subject.trim()}。${item.evidence.trim()}`;
 if (page.state === 'excluded' && page.error === error) return false;
 if (!['pending','retry','done'].includes(page.state)) throw Error('网页已有其他排除原因，须人工处理');
 if (db.prepare('SELECT 1 FROM page_identity_mismatches WHERE page_id=?').get(page.id)) throw Error('网页已有库内身份判定');
 if (db.prepare('SELECT 1 FROM page_leases WHERE page_id=? AND expires_at>?').get(page.id,new Date().toISOString())) throw Error('该网页存在有效租约，稍后再登记');
 const time = new Date().toISOString();
 db.prepare("UPDATE pages SET state='excluded',error=? WHERE id=?").run(error,page.id);
 db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(page.job_id,'manual_identity_exclusion',
  JSON.stringify({ page_id:page.id, url:page.url, audit_id:item.audit_id, reason:error, previous_state:page.state, previous_error:page.error }),time);
 db.prepare(`INSERT INTO render_queue(record_id,dirty,attempts,error,updated) VALUES(?,1,0,NULL,?)
  ON CONFLICT(record_id) DO UPDATE SET dirty=1,attempts=0,error=NULL,updated=excluded.updated`).run(page.record_id,time);
 return true;
}
function record(items){
 if(!Array.isArray(items)||!items.length||items.length>100)throw Error('需 1–100 条经人工核实的网页归属');
 let added=0,reused=0,excluded=0;db.exec('BEGIN IMMEDIATE');try{
  for(const x of items){
   const p=db.prepare('SELECT * FROM pages WHERE id=?').get(x.page_id);
   if(!p||p.url!==x.url)throw Error('网页或精确 URL 不匹配');
   if(typeof x.evidence!=='string'||x.evidence.trim().length<20)throw Error('需要具体身份对照证据');
   if (x.external_subject !== undefined) {
    if (x.subject_record_id !== undefined) throw Error('库内和库外判定不能同时提交');
    if (excludeExternal(p,x)) { added++; excluded++; } else reused++;
    continue;
   }
   const subject=db.prepare('SELECT * FROM records WHERE id=?').get(x.subject_record_id);
   if(!subject||p.record_id===subject.id)throw Error('实际人物不匹配');
   const lo=[p.record_id,subject.id].sort(),identity=db.prepare('SELECT * FROM identity_assertion_events WHERE left_id=? AND right_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(...lo);
   if(!identity||identity.kind!=='different'||identity.event_id!==x.identity_event_id)throw Error('需要引用最新的、两记录间不同人判定');
   const prior=db.prepare('SELECT * FROM page_identity_mismatches WHERE page_id=?').get(p.id);
   if(prior){if(prior.subject_record_id!==subject.id||prior.identity_event_id!==x.identity_event_id||prior.evidence!==x.evidence)throw Error('网页已有不同的身份判定，须人工处理');reused++;continue;}
   if(!['pending','retry','done'].includes(p.state))throw Error('只处理待查、重试或已读网页，其他状态须人工处理');
   if(db.prepare('SELECT 1 FROM page_leases WHERE page_id=? AND expires_at>?').get(p.id,new Date().toISOString()))throw Error('该网页存在有效租约，稍后再登记');
   const t=new Date().toISOString();db.prepare('INSERT INTO page_identity_mismatches VALUES(?,?,?,?,?,?)').run(p.id,subject.id,identity.event_id,x.evidence,JSON.stringify(p),t);
   if(p.state!=='done'){db.prepare("UPDATE pages SET state='excluded',error=? WHERE id=?").run('已人工核实属于其他同名者，停止按本人物自动读取',p.id);excluded++;}
   db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(p.job_id,'identity_mismatch',p.id+' '+x.evidence,t);
   db.prepare(`INSERT INTO render_queue(record_id,dirty,attempts,error,updated) VALUES(?,1,0,NULL,?) ON CONFLICT(record_id) DO UPDATE SET dirty=1,attempts=0,error=NULL,updated=excluded.updated`).run(p.record_id,t);added++;
  }
  db.exec('COMMIT');return {added,reused,excluded,note:'已读原网页和历史结果不删除，待处理误配停止自动读取；不自动建立师承关系。'};
 }catch(e){db.exec('ROLLBACK');throw e}
}
try{const file=process.argv[2];if(!file)throw Error('用法: node 人物网页身份纠偏.cjs 人工确认JSON');console.log(JSON.stringify(record(JSON.parse(fs.readFileSync(file,'utf8')))));}catch(e){console.error(String(e));process.exitCode=1}finally{db.close()}
