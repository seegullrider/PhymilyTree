const path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const id='8a149b22', now=new Date().toISOString();
const pages=[['https://alexandria.ucsb.edu/downloads/h989r357r','excluded','重定向至 UCSB 新地址，当前网页工具无法访问；原文未读取'],['https://escholarship.org/content/qt5f99w3p4/qt5f99w3p4.pdf','excluded','网页工具报告文件 24236910 字节过大，原文未读取；不自动重试'],['https://escholarship.org/uc/item/5f99w3p4','excluded','网页返回 JavaScript 人机验证；原文未读取，不自动重试']];
for(const [url,state,error] of pages){let key=crypto.createHash('sha256').update(id+'\n'+url).digest('hex').slice(0,24);db.prepare('INSERT OR IGNORE INTO pages(id,record_id,job_id,url,state,attempts,error,retrieved) VALUES(?,?,?,?,?,1,?,?)').run(key,id,id+':training',url,state,error,now);db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(id+':training','page_failure',url+' '+error,now)}db.close();
