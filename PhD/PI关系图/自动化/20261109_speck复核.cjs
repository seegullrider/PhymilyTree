const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),file=path.join(root,'人物','人员 - UC Santa Barbara - James S. Speck - 69acab35.md');
let s=fs.readFileSync(file,'utf8');const line='- 独立来源复核：Minnesota 的 Simons 合作项目人物页确认其 UCSB Materials 教授任职、1989 年 MIT 材料学 Sc.D.，研究包括 GaN 外延生长与缺陷。该页未列导师。[来源](https://cse.umn.edu/wave/james-s-speck)\n';
if(!s.includes(line))s=s.replace('\n## 师承\n','\n'+line+'\n## 师承\n');fs.writeFileSync(file,s,'utf8');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite')),id='69acab35',url='https://dspace.mit.edu/entities/publication/0cd295fd-eecb-4376-ace9-98834d99503a',now=new Date().toISOString(),key=crypto.createHash('sha256').update(id+'\n'+url).digest('hex').slice(0,24);
db.prepare('INSERT OR IGNORE INTO pages(id,record_id,job_id,url,state,attempts,error,retrieved) VALUES(?,?,?,?,?,1,?,?)').run(key,id,id+':training',url,'retry','直接打开返回 405，未读取原始学位目录；检索摘要仅为线索，至少退避30分钟',now);
db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(id+':training','page_failure',url+' 405；原文未读取，至少退避30分钟',now);db.close();
