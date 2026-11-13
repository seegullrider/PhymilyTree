// 独立队列：不同时调用中短时间两个不同主机限流时共享退避；同主机及旧事件不误触发。
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pi-cross-limit-')),file=path.join(temp,'queue.sqlite'),payload=path.join(temp,'input.json'),script=path.join(__dirname,'检索流程.cjs'),env={...process.env,PI_AUTOMATION_DB:file};
function run(...args){let p=spawnSync(process.execPath,['--no-warnings',script,...args],{encoding:'utf8',env});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout)}
function submit(id,url){fs.writeFileSync(payload,JSON.stringify([{id,lease_token:'lease-'+id,error:'Failed to fetch '+url+': (429) Too Many Requests'}]));return run('ingest-pages',payload)}
let db;try{
 run('status');db=new DatabaseSync(file);const now=new Date().toISOString(),future=new Date(Date.now()+600000).toISOString();
 for(const [id,host] of [['a','one.example'],['b','one.example'],['c','two.example'],['d','three.example']]){
  db.prepare('INSERT INTO records(id,name,unit,filename,reviewed,updated) VALUES(?,?,?,?,0,?)').run(id,id,'test',id,now);
  db.prepare("INSERT INTO jobs(id,record_id,kind,query,updated) VALUES(?,?,'training','q',?)").run(id+':training',id,now);
  db.prepare("INSERT INTO pages(id,record_id,job_id,url,state,attempts) VALUES(?,?,?,?,'pending',0)").run(id,id,id+':training','https://'+host+'/'+id);
  db.prepare('INSERT INTO page_leases VALUES(?,?,?)').run(id,'lease-'+id,future);
 }db.close();db=null;
 let first=submit('a','https://one.example/a');assert(!first.backoff_until||Date.parse(first.backoff_until)<Date.now(),'单主机限流不能触发共享退避');
 let same=submit('b','https://one.example/b');assert(!same.backoff_until||Date.parse(same.backoff_until)<Date.now(),'同主机两次限流不能作为两个主机');
 let other=submit('c','https://two.example/c');assert(Date.parse(other.backoff_until)>Date.now()+25*60*1000,'不同批次两个主机须触发共享退避');assert.deepEqual(run('next-page','1'),[]);
 db=new DatabaseSync(file);db.prepare("DELETE FROM settings WHERE key='backoff_until'").run();db.prepare("UPDATE events SET created=? WHERE level='site_rate_limit'").run(new Date(Date.now()-180000).toISOString());db.close();db=null;
 let old=submit('d','https://three.example/d');assert(!old.backoff_until||Date.parse(old.backoff_until)<Date.now(),'两分钟前的事件不能触发新的共享退避');
 console.log('通过：跨批不同主机触发共享退避，同主机及旧事件不触发。');
}finally{if(db)db.close();fs.rmSync(temp,{recursive:true,force:true})}
