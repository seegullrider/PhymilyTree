const {DatabaseSync}=require('node:sqlite');
const crypto=require('node:crypto');
const d=new DatabaseSync('检索队列.sqlite');
for(const [id,url,error] of [['4f19b99d','https://vishiklab.faculty.ucdavis.edu/wp-content/uploads/sites/394/2020/06/CVJune2020.pdf','网页工具无法访问，未取得原文'],['61c3586b','https://physics.yale.edu/sites/default/files/files/2019-07-26_Announcements.pdf','(404) Not Found，未取得原文']]){
 if(!d.prepare('select id from pages where record_id=? and url=?').get(id,url))d.prepare('insert into pages(id,record_id,job_id,url,state,attempts,error,retrieved) values(?,?,?,?,?,?,?,?)').run(crypto.createHash('sha256').update(id+url).digest('hex').slice(0,24),id,id+':training',url,'retry',1,error,new Date().toISOString());
}
d.close();
