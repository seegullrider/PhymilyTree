// 对特定人物、来源及阶段登记人工判断；不排除整篇名册或自动建立师承。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'));
db.exec(`PRAGMA busy_timeout=10000; CREATE TABLE IF NOT EXISTS cross_list_reviews(
 record_id TEXT NOT NULL,url TEXT NOT NULL,stage TEXT NOT NULL,
 reason TEXT NOT NULL,reviewed_at TEXT NOT NULL,
 PRIMARY KEY(record_id,url,stage),FOREIGN KEY(record_id) REFERENCES records(id));
 CREATE TABLE IF NOT EXISTS cross_list_review_history(
 record_id TEXT NOT NULL,url TEXT NOT NULL,stage TEXT NOT NULL,
 reason TEXT NOT NULL,reviewed_at TEXT NOT NULL,superseded_at TEXT NOT NULL);`);
try{
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 if(!Array.isArray(input)||input.length===0||input.length>100)throw Error('需要 1–100 条人工复核结果');
 let inserted=0,reused=0,refreshed=0;db.exec('BEGIN IMMEDIATE');
 try{for(const x of input){
  if(!db.prepare('SELECT 1 FROM records WHERE id=?').get(x.record_id)||!['phd','postdoc'].includes(x.stage)||!/^https?:\/\//.test(x.url||'')||typeof x.reason!=='string'||x.reason.trim().length<25)throw Error('人物、阶段、来源或复核理由无效');
  if(!db.prepare('SELECT 1 FROM pages p JOIN page_observations o ON o.page_id=p.id WHERE p.url=? LIMIT 1').get(x.url))throw Error('该来源没有保存原文观察');
  const old=db.prepare('SELECT reason,reviewed_at FROM cross_list_reviews WHERE record_id=? AND url=? AND stage=?').get(x.record_id,x.url,x.stage);
  if(old){
   if(x.refresh===true){
    const newer=db.prepare('SELECT 1 FROM pages p JOIN page_observations o ON o.page_id=p.id WHERE p.url=? AND o.retrieved>? LIMIT 1').get(x.url,old.reviewed_at);
    if(!newer)throw Error('没有复核之后的新原文观察，不允许刷新判断');
    const time=new Date().toISOString();
    db.prepare('INSERT INTO cross_list_review_history VALUES(?,?,?,?,?,?)').run(x.record_id,x.url,x.stage,old.reason,old.reviewed_at,time);
    db.prepare('UPDATE cross_list_reviews SET reason=?,reviewed_at=? WHERE record_id=? AND url=? AND stage=?').run(x.reason.trim(),time,x.record_id,x.url,x.stage);refreshed++;continue;
   }
   if(old.reason!==x.reason.trim())throw Error('已有不同判断，拒绝覆盖');reused++;continue;
  }
  db.prepare('INSERT INTO cross_list_reviews VALUES(?,?,?,?,?)').run(x.record_id,x.url,x.stage,x.reason.trim(),new Date().toISOString());inserted++;
 }db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 console.log(JSON.stringify({inserted,reused,refreshed,note:'仅标记特定人物与来源阶段组合；有新原文时可人工复核并指定 refresh，历史判断与原始网页保留。'}));
}catch(e){console.error(String(e));process.exitCode=1}finally{db.close()}
