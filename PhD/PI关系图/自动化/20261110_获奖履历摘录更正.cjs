const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('检索队列.sqlite');
const id='3ef34015',url='https://www.electrochem.org/247/division-awards';
const old="ECS 官方获奖履历明确 Bordeaux 在 Claude Delmas 指导下从事研究。",corrected="ECS 官方获奖履历记其获 NSF 海外研究 fellowship，在 Bordeaux 与 Claude Delmas 共事。";
db.exec('BEGIN IMMEDIATE');
try{
 const p=db.prepare('SELECT id,job_id,excerpt FROM pages WHERE record_id=? AND url=? AND state=?').get(id,url,'done');
 if(!p||p.excerpt!==old)throw Error('Expected excerpt not found');
 db.prepare('UPDATE pages SET excerpt=? WHERE id=?').run(corrected,p.id);
 const now=new Date().toISOString();
 db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(p.job_id,'page_excerpt_corrected',JSON.stringify({url,old,corrected}),now);
 const dirty=db.prepare('UPDATE render_queue SET dirty=1,attempts=0,error=NULL,updated=? WHERE record_id=?').run(now,id);
 if(dirty.changes!==1)throw Error('Expected render queue row not found');
 db.exec('COMMIT');
}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
