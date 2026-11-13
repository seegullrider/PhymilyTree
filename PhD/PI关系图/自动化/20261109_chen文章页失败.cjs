const path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite')); const id='756bf589',url='https://chen.chemistry.ucsc.edu/articles/',now=new Date().toISOString(),key=crypto.createHash('sha256').update(id+'\n'+url).digest('hex').slice(0,24);
db.prepare('INSERT OR IGNORE INTO pages(id,record_id,job_id,url,state,attempts,error,retrieved) VALUES(?,?,?,?,?,1,?,?)').run(key,id,id+':training',url,'retry','直接访问 502；搜索索引仅是线索，至少 30 分钟后才考虑重试',now);
db.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(id+':training','page_failure',url+' 502；至少 30 分钟退避，不根据搜索摘要确证',now);db.close();
