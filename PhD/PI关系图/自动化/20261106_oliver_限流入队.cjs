const fs=require('fs'),path=require('path'),crypto=require('crypto'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const record='4a519ebb',job='4a519ebb:training',url='https://escholarship.org/uc/item/16b7v45k';
const id=crypto.createHash('sha256').update(record+'\n'+url).digest('hex').slice(0,24);
db.prepare('INSERT OR IGNORE INTO pages(id,record_id,job_id,url) VALUES(?,?,?,?)').run(id,record,job,url);
fs.writeFileSync(path.join(__dirname,'页面桥接-20261106-oliver限流.json'),JSON.stringify([{id,error:'Failed to fetch '+url+': (429) Too Many Requests'}],null,2)+'\n','utf8');
