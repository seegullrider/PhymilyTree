const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));db.exec('PRAGMA busy_timeout=10000');
const jobs=JSON.parse(fs.readFileSync(path.join(__dirname,'博士桥接-20261107-延期本轮.json'),'utf8'));
const update=db.prepare("UPDATE thesis_search_jobs SET state='retry',retry_after=?,lease_until=NULL,lease_token=NULL,error=?,updated=? WHERE record_id=? AND state='leased' AND lease_token=?");
const now=new Date(),until=new Date(now.getTime()+30*60000).toISOString();
db.exec('BEGIN IMMEDIATE');try{for(const j of jobs){if(update.run(until,'本轮刚做相近人工检索，暂缓以避免重复',now.toISOString(),j.record_id,j.lease_token).changes!==1)throw Error('租约状态不符 '+j.record_id)}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}console.log(JSON.stringify({deferred:jobs.map(j=>j.record_id),retry_after:until}));
