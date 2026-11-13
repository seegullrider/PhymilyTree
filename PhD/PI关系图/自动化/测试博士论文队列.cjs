// 独立临时数据库验证队列筛选，不读取或修改正式台账。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {DatabaseSync} = require('node:sqlite');
const dir=fs.mkdtempSync(path.join(process.env.PI_TEST_TMP || os.tmpdir(),'pi-thesis-test-'));
const dbPath=path.join(dir,'test.sqlite');
const db=new DatabaseSync(dbPath);
db.exec(`CREATE TABLE records(id TEXT PRIMARY KEY,name TEXT,unit TEXT,name_collision TEXT);
 CREATE TABLE manual_audit_events(audit_id TEXT PRIMARY KEY,record_id TEXT,recorded_at TEXT,details_json TEXT);
 CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);`);
const addRecord=db.prepare('INSERT INTO records VALUES(?,?,?,NULL)');
const addEvent=db.prepare('INSERT INTO manual_audit_events VALUES(?,?,?,?)');
for(const [id,name,status,note] of [
 ['1','Stage Mentor','confirmed_advisor','博士阶段研究师长，正式论文导师待核'],
 ['2','Formal Advisor','confirmed_advisor','本人论文列博士导师 A'],
 ['3','Unknown Scholar','unresolved','未查明'],
 ['4','Another Formal','confirmed_advisor','本人论文列博士导师 B']
]){
 addRecord.run(id,name,'Test');
 addEvent.run('event'+id,id,'2026-01-01',JSON.stringify({aspects:{phd:{status,note}},next_step:''}));
}
addRecord.run('5','Missing Audit','Test');
db.close();
function run(...args){
 const result=spawnSync(process.execPath,['--no-warnings',path.join(__dirname,'博士论文专项队列.cjs'),...args],{
  encoding:'utf8',env:{...process.env,PI_AUTOMATION_DB:dbPath}
 });
 assert.equal(result.status,0,result.stderr);
 return JSON.parse(result.stdout);
}
const initial=run('init');
assert.equal(initial.eligible,3);
for(const key of ['backoff_until','thesis_search_retry_after']){
 const control=new DatabaseSync(dbPath);control.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(key,new Date(Date.now()+60000).toISOString());control.close();
 assert.deepEqual(run('next','4'),[],key+' 应阻止论文队列领取任务');
 const reset=new DatabaseSync(dbPath);assert.equal(reset.prepare("SELECT count(*) n FROM thesis_search_jobs WHERE state='leased'").get().n,0);reset.prepare('DELETE FROM settings WHERE key=?').run(key);reset.close();
}
const leased=run('next','4');
assert.deepEqual(leased.map(x=>x.record_id).sort(),['1','3','5']);
const old=new DatabaseSync(dbPath);old.prepare("INSERT INTO thesis_search_jobs(record_id,query,state,updated) VALUES('2','Formal Advisor thesis','superseded',?)").run(new Date().toISOString());old.close();
const full=run('init-all');
assert.equal(full.coverage_mode,'all');assert.equal(full.total,5);assert.equal(full.inserted,1);assert.equal(full.reactivated,1);
const extra=run('next','4');assert.deepEqual(extra.map(x=>x.record_id).sort(),['2','4'],'全覆盖不得因旧状态将正式导师记录自动跳过');
const again=run('init-all');assert.equal(again.inserted,0);assert.equal(again.reactivated,0);assert.equal(again.total,5);
const check=new DatabaseSync(dbPath);assert.equal(check.prepare("SELECT count(*) n FROM thesis_search_jobs WHERE state='leased'").get().n,5);
check.prepare("UPDATE thesis_search_jobs SET state='pending',lease_token=NULL,lease_until=NULL WHERE record_id IN ('2','3')").run();check.close();
const chosen=run('next','1')[0];assert.equal(chosen.record_id,'3','全覆盖时应优先处理最新台账尚未确认的博士阶段');
const resultFile=path.join(dir,'result.json');fs.writeFileSync(resultFile,JSON.stringify([{record_id:'3',lease_token:chosen.lease_token,raw:'Title (https://example.edu/document)\nAdvisor Test; contact person@example.edu\nDate of Birth: 1990\nBorn: February 11, 1955\nPhone: 555-0101\n  * Ph: 555-0102\n(617) 555-1234\n**Home Address:**\n123 Example Street\nBoston MA 02110\n\n## Education\nA researcher was born in a city on 29th March, 1991.\nPh.D. advisor: Scholar Name\nMy Ph.D. study began in 2015.'}]));run('ingest',resultFile);
const verify=new DatabaseSync(dbPath);const saved=verify.prepare('SELECT raw,sources_json,state FROM thesis_search_jobs WHERE record_id=?').get('3');verify.close();
assert.equal(saved.state,'done');assert(!saved.raw.includes('secret'));assert(!saved.raw.includes('person@example.edu'));assert(!saved.raw.includes('1990'));assert(!saved.raw.includes('1991'));assert(!saved.raw.includes('1955'));assert(!saved.raw.includes('555-0101'));assert(!saved.raw.includes('555-0102'));assert(!saved.raw.includes('555-1234'));assert(!saved.raw.includes('123 Example Street'));assert(!saved.raw.includes('Boston MA 02110'));assert(saved.raw.includes('## Education'));assert(saved.raw.includes('Ph.D. advisor: Scholar Name'));assert(saved.raw.includes('My Ph.D. study began in 2015.'));assert(!saved.sources_json.includes('secret'));
const neverSent=leased.find(x=>x.record_id==='1');fs.writeFileSync(resultFile,JSON.stringify([{record_id:'1',lease_token:neverSent.lease_token,deferred:true,reason:'前序检索失败，当前任务没有发送。'}]));run('ingest',resultFile);
const deferred=new DatabaseSync(dbPath);const held=deferred.prepare('SELECT state,attempts,lease_token,retry_after FROM thesis_search_jobs WHERE record_id=?').get('1');deferred.close();assert.equal(held.state,'retry');assert.equal(held.attempts,0,'未发送的任务不得耗掉重试次数');assert.equal(held.lease_token,null);assert(Date.parse(held.retry_after)>Date.now());
const aliases=new DatabaseSync(dbPath);aliases.prepare('INSERT INTO records VALUES(?,?,?,NULL)').run('6','Haozhe（Harry）Wang','Test');aliases.prepare('INSERT INTO records VALUES(?,?,?,NULL)').run('7','James（Jim）Plummer','Test');aliases.prepare('INSERT INTO records VALUES(?,?,?,NULL)').run('8','Custom（Alias）Name','Test');aliases.prepare("INSERT INTO thesis_search_jobs(record_id,query,state,updated) VALUES(?,?,?,?)").run('7','"JamesPlummer" PhD dissertation thesis advisor','pending',new Date().toISOString());aliases.prepare("INSERT INTO thesis_search_jobs(record_id,query,state,updated) VALUES(?,?,?,?)").run('8','custom query','pending',new Date().toISOString());aliases.close();
run('init-all');let inspect=new DatabaseSync(dbPath);assert.equal(inspect.prepare('SELECT query FROM thesis_search_jobs WHERE record_id=?').get('6').query,'"Haozhe Wang" PhD dissertation thesis advisor');inspect.close();
function migrate(...args){const r=spawnSync(process.execPath,['--no-warnings',path.join(__dirname,'20261109_博士姓名检索词修复.cjs'),...args],{encoding:'utf8',env:{...process.env,PI_AUTOMATION_DB:dbPath}});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout)}
assert.equal(migrate().candidates.length,1);assert.equal(migrate('apply').changed,1);assert.equal(migrate('apply').changed,0);inspect=new DatabaseSync(dbPath);assert.equal(inspect.prepare('SELECT query FROM thesis_search_jobs WHERE record_id=?').get('7').query,'"James Plummer" PhD dissertation thesis advisor');assert.equal(inspect.prepare('SELECT query FROM thesis_search_jobs WHERE record_id=?').get('8').query,'custom query');assert.equal(inspect.prepare('SELECT count(*) n FROM thesis_query_revisions').get().n,1);inspect.close();
const incremental=new DatabaseSync(dbPath);
const insertRecord=incremental.prepare('INSERT INTO records VALUES(?,?,?,NULL)');
insertRecord.run('9','New University PI','Test');
insertRecord.run('10','Unknown Scholar','Other University');
incremental.close();
const resumed=run('next','4');
assert(resumed.some(row=>row.record_id==='9' && row.query==='"New University PI" PhD dissertation thesis advisor'));
assert(!resumed.some(row=>row.record_id==='10'),'新校属记录应复用近期同一检索式的响应');
const afterResume=new DatabaseSync(dbPath);
const reused=afterResume.prepare('SELECT state,reused_from FROM thesis_search_jobs WHERE record_id=?').get('10');
assert.equal(reused.state,'done');
assert.equal(reused.reused_from,'3');
assert.equal(afterResume.prepare('SELECT count(*) n FROM thesis_search_jobs').get().n,10);
afterResume.close();
const targeted=path.join(dir,'targeted.json');
fs.writeFileSync(targeted,JSON.stringify([{record_id:'3',title:'Surface Dynamics of a Disordered Quantum Material',source:'https://example.edu/thesis'}]));
assert.equal(run('refine-queries',targeted).refined,1);
assert.equal(run('refine-queries',targeted).refined,0);
const refined=new DatabaseSync(dbPath);
const prior=refined.prepare('SELECT snapshot_json,title_source FROM thesis_query_history WHERE record_id=?').get('3');
assert.equal(prior.title_source,'https://example.edu/thesis');
assert.equal(JSON.parse(prior.snapshot_json).raw,saved.raw,'原检索响应需保留');
const pending=refined.prepare('SELECT query,state FROM thesis_search_jobs WHERE record_id=?').get('3');
assert.equal(pending.query,'"Surface Dynamics of a Disordered Quantum Material" "Unknown Scholar" dissertation');
assert.equal(pending.state,'pending');
refined.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('backoff_until',?)").run(new Date(Date.now()+60000).toISOString());
refined.close();
assert.deepEqual(run('next','4'),[],'题名续查不得绕开共享退避');
assert.equal(run('status').archived_responses,1);
console.log('通过：选择模式、共享退避、全覆盖及增量入队、缺失台账、旧任务恢复、优先级、租约、未发送任务延期和检索响应脱敏。');
