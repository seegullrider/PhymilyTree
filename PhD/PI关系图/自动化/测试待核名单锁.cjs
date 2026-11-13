// 独立数据库模拟短暂写锁；不得连接真实队列。
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert'),{spawn}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
const dir=fs.mkdtempSync(path.join(process.env.PI_TEST_ROOT||os.tmpdir(),'pi-review-lock-')),dbFile=path.join(dir,'fixture.sqlite'),graph=path.join(dir,'graph');fs.mkdirSync(graph);
const db=new DatabaseSync(dbFile);db.exec('CREATE TABLE records(id TEXT,name TEXT,unit TEXT,filename TEXT); CREATE TABLE manual_audit_events(audit_id TEXT,record_id TEXT,recorded_at TEXT,details_json TEXT); BEGIN EXCLUSIVE');
const started=Date.now(),child=spawn(process.execPath,['--no-warnings',path.join(__dirname,'待核师承名单.cjs')],{env:{...process.env,PI_AUTOMATION_DB:dbFile,PI_GRAPH_ROOT:graph}});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);
setTimeout(()=>{db.exec('COMMIT');db.close()},1200);
child.on('error',e=>{console.error(e);process.exitCode=1});child.on('close',code=>{try{assert.equal(code,0,err);assert(Date.now()-started>=900,'未观察到锁等待');const result=JSON.parse(out);assert.equal(result.records,0);assert(fs.existsSync(path.join(graph,'待核师承名单.md')));console.log(JSON.stringify({ok:true,waited_ms:Date.now()-started,fixture:dir}))}catch(e){console.error(e);process.exitCode=1}});
