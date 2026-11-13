const {DatabaseSync}=require('node:sqlite');
const crypto=require('node:crypto');
const d=new DatabaseSync('检索队列.sqlite');
const id='d2d595fb',url='https://poplab.stanford.edu/pdfs/EricPop_CV_Feb2026.pdf';
if(!d.prepare('select id from pages where record_id=? and url=?').get(id,url)) d.prepare('insert into pages(id,record_id,job_id,url,state,attempts,error,retrieved) values(?,?,?,?,?,?,?,?)').run(crypto.createHash('sha256').update(id+url).digest('hex').slice(0,24),id,id+':training',url,'retry',1,'(404) Not Found，未取得原文',new Date().toISOString());
d.close();
