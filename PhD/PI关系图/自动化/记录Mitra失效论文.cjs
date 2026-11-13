const {DatabaseSync}=require('node:sqlite');
const crypto=require('node:crypto');
const d=new DatabaseSync('检索队列.sqlite');
const id='92bf3d22',url='https://citeseerx.ist.psu.edu/document?doi=5dc86c0c166e95165809761b4e03d2025f5c0d13&repid=rep1&type=pdf';
if(!d.prepare('select id from pages where record_id=? and url=?').get(id,url))d.prepare('insert into pages(id,record_id,job_id,url,state,attempts,error,retrieved) values(?,?,?,?,?,?,?,?)').run(crypto.createHash('sha256').update(id+url).digest('hex').slice(0,24),id,id+':training',url,'retry',1,'(403) Forbidden，未取得原文',new Date().toISOString());
d.close();
