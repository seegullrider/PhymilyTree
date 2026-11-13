// 隔离数据库验证网页原始工具返回与摘要分开保存，且不绕过租约或改变旧入参。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
const tmp=fs.mkdtempSync(path.join(__dirname,'.pi-observation-')),file=path.join(tmp,'queue.sqlite'),payload=path.join(tmp,'input.json'),script=path.join(__dirname,'检索流程.cjs'),env={...process.env,PI_AUTOMATION_DB:file,PI_GRAPH_ROOT:tmp};
fs.writeFileSync(path.join(tmp,'graph-manifest.json'),JSON.stringify({nodes:[]}));
function run(...args){return spawnSync(process.execPath,['--no-warnings',script,...args],{encoding:'utf8',env});}
function ok(...args){let p=run(...args);assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout)}
function ingest(x){fs.writeFileSync(payload,JSON.stringify(x));return run('ingest-pages',payload)}
let db;try{
 ok('status');db=new DatabaseSync(file);let now=new Date().toISOString(),until=new Date(Date.now()+600000).toISOString();
 for(let id of ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o']){db.prepare('INSERT INTO records(id,name,unit,filename,reviewed,updated) VALUES(?,?,?,?,0,?)').run(id,id,'test',id,now);db.prepare("INSERT INTO jobs(id,record_id,kind,query,updated) VALUES(?,?,'training','q',?)").run(id+':training',id,now);db.prepare("INSERT INTO pages(id,record_id,job_id,url,state,attempts) VALUES(?,?,?,?,'pending',0)").run(id,id,id+':training','https://'+id+'.example/page');db.prepare('INSERT INTO page_leases VALUES(?,?,?)').run(id,'lease-'+id,until)}db.close();db=null;
 const raw='Page (https://a.example/page)\nTotal lines: 3\nL0: First line\nL1: Adjacent line about advisor\nL2: Last line';
 let p=ingest([{id:'a',lease_token:'lease-a',excerpt:'short summary',raw_page:raw}]);assert.equal(p.status,0,p.stderr);
 let view=ok('page-observation','a');assert.equal(view.observation.tool_output,raw);assert.equal(view.page.url,'https://a.example/page');assert.equal(ok('page-observation','b').observation,null);
 db=new DatabaseSync(file);let obs=db.prepare('SELECT * FROM page_observations WHERE page_id=?').get('a');assert.equal(obs.tool_output,raw);assert.equal(obs.completeness,'unknown');assert.equal(obs.bytes,Buffer.byteLength(raw));assert.equal(db.prepare('SELECT excerpt FROM pages WHERE id=?').get('a').excerpt,'short summary');db.close();db=null;
 p=ingest([{id:'b',lease_token:'wrong',excerpt:'text',raw_page:raw}]);assert.notEqual(p.status,0,'错误租约不得写入');
 p=ingest([{id:'b',lease_token:'lease-b',excerpt:'text',raw_page:'x'.repeat(1048577)}]);assert.notEqual(p.status,0,'超出上限应整体回滚');
 db=new DatabaseSync(file);assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get('b').state,'pending');assert(db.prepare('SELECT * FROM page_leases WHERE page_id=?').get('b'));assert.equal(db.prepare('SELECT count(*) n FROM page_observations WHERE page_id=?').get('b').n,0);db.close();db=null;
 p=ingest([{id:'c',lease_token:'lease-c',excerpt:'historical summary'}]);assert.equal(p.status,0,p.stderr);
 p=ingest([{id:'d',lease_token:'lease-d',error:'Failed to fetch https://d.example/page (403)',raw_page:'error response'}]);assert.equal(p.status,0,p.stderr);
 p=ingest([{id:'e',lease_token:'lease-e',excerpt:'unrelated line',raw_page:'Please verify that you are not a robot'}]);assert.equal(p.status,0,p.stderr);
 p=ingest([{id:'f',lease_token:'lease-f',error:'Checking your browser - reCAPTCHA'}]);assert.equal(p.status,0,p.stderr);
 p=ingest([{id:'g',lease_token:'lease-g',error:'网页要求 JavaScript 和机器人验证，而非正文'}]);assert.equal(p.status,0,p.stderr);
 p=ingest([{id:'i',lease_token:'lease-i',excerpt:'supposed thesis',raw_page:"Let's confirm you are human. Complete the security check before continuing."}]);assert.equal(p.status,0,p.stderr);
 p=ingest([{id:'j',lease_token:'lease-j',error:'Making sure you’re not a bot! / 需要人机验证'}]);assert.equal(p.status,0,p.stderr);
 const notFoundBody='L5: The resource you requested cannot be found.';
 p=ingest([
  {id:'l',lease_token:'lease-l',excerpt:notFoundBody,raw_page:'Redirected to URL: https://l.example/notfound.htm; Total lines: 11\n'+notFoundBody},
  {id:'m',lease_token:'lease-m',excerpt:'A published guide quotes a web error.',raw_page:'Guide (https://m.example/page)\n'+notFoundBody}
 ]);
 assert.equal(p.status,0,p.stderr);
 const redirect=ok('page-observation','l');
 assert.equal(redirect.page.state,'retry');assert.equal(redirect.observation,null);
 assert.equal(ok('page-observation','m').page.state,'done','正文中的相同措辞不能单独作为缺页判定');
 const catalog = 'Catalog (https://n.example/page)\nL9: JavaScript is disabled for your browser. Some features of this site may not work without it.\nL38: # Dissertation title\nL40: Author Name';
 p=ingest([
  {id:'n',lease_token:'lease-n',excerpt:'Dissertation title and author',raw_page:catalog},
  {id:'o',lease_token:'lease-o',excerpt:'JavaScript is disabled',raw_page:'L0: # JavaScript is disabled\nL1: '}
 ]);
 assert.equal(p.status,0,p.stderr);
 assert.equal(ok('page-observation','n').observation.tool_output,catalog,'普通脚本提示后的馆藏正文仍须留存');
 assert.equal(ok('page-observation','o').page.state,'excluded','独立 JavaScript 阻断页仍须排除');
 db=new DatabaseSync(file);
 assert.match(db.prepare("SELECT error FROM pages WHERE id='l'").get().error,/404 Not Found/);
 for(const id of ['i','j']) {
  assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get(id).state,'excluded');
  assert.equal(db.prepare('SELECT count(*) n FROM page_observations WHERE page_id=?').get(id).n,0);
 }
 db.prepare("UPDATE pages SET state='retry',attempts=2,error='需要人机验证',retrieved=? WHERE id='k'").run(now);
 db.prepare("DELETE FROM page_leases WHERE page_id='k'").run();db.close();db=null;
 ok('status');ok('status');
 db=new DatabaseSync(file);
 const verification=db.prepare("SELECT state,attempts,error,retrieved FROM pages WHERE id='k'").get();
 assert.equal(verification.state,'excluded');assert.equal(verification.attempts,2);assert.equal(verification.retrieved,now);
 assert.equal(db.prepare("SELECT count(*) n FROM events WHERE job_id='k:training' AND level='page_verification_excluded'").get().n,1);
 db.close();db=null;
 db=new DatabaseSync(file);assert.equal(db.prepare('SELECT count(*) n FROM page_observations WHERE page_id IN (?,?,?)').get('c','d','e').n,0);assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get('d').state,'retry');assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get('e').state,'excluded');db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('thesis_search_retry_after',until);db.close();db=null;
 const refreshed=ok('refresh-page','a','保存内容不完整，需要复读原始网页');assert.equal(refreshed.state,'pending');assert.deepEqual(ok('next-page','4'),[],'复读不得绕过共享退避');assert.notEqual(run('refresh-page','a','保存内容不完整，需要复读原始网页').status,0,'已排队不可重复复读');
 db=new DatabaseSync(file);for(const id of ['e','f','g'])assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get(id).state,'excluded','人机验证页面须停止自动重试');db.close();db=null;
 db=new DatabaseSync(file);let history=db.prepare('SELECT * FROM page_refresh_history WHERE page_id=?').get('a');assert.equal(JSON.parse(history.snapshot_json).excerpt,'short summary');assert.equal(JSON.parse(history.snapshot_json).state,'done');assert.equal(db.prepare('SELECT tool_output FROM page_observations WHERE page_id=?').get('a').tool_output,raw);db.close();db=null;
 assert.notEqual(ingest([{id:'a',excerpt:'stale historical result'}]).status,0,'复读不得接受无租约的旧结果');
 db=new DatabaseSync(file);db.prepare('DELETE FROM settings WHERE key=?').run('thesis_search_retry_after');db.close();db=null;
 const lease=ok('lease-pages','1')[0];assert.equal(lease.id,'a');p=ingest([{id:'a',lease_token:lease.lease_token,excerpt:'new summary',raw_page:raw+'\nL3: New passage'}]);assert.equal(p.status,0,p.stderr);
 db=new DatabaseSync(file);assert.equal(db.prepare('SELECT count(*) n FROM page_observations WHERE page_id=?').get('a').n,2);assert.equal(db.prepare('SELECT excerpt FROM pages WHERE id=?').get('a').excerpt,'new summary');
 db.prepare("UPDATE pages SET state='excluded',error=? WHERE id='a'").run('已人工核实属于数据库外其他同名者：测试');db.close();db=null;
 p=ingest([{id:'a',excerpt:'historical result assigned to the wrong person'}]);assert.notEqual(p.status,0);assert.match(p.stderr,/其他同名者/);
 view=ok('page-observation','a');assert.equal(view.page.state,'excluded');assert.equal(view.observation.tool_output,raw+'\nL3: New passage');
 assert.notEqual(ingest([{id:'h',deferred_reason:'同站暂缓'}]).status,0,'延期须持租约');
 assert.notEqual(ingest([{id:'h',lease_token:'lease-h',error:'混用字段',deferred_reason:'同站暂缓'}]).status,0);
 p=ingest([{id:'h',lease_token:'lease-h',deferred_reason:'同站上一页返回机器人验证，本页未请求'}]);assert.equal(p.status,0,p.stderr);
 assert.notEqual(ingest([{id:'h',lease_token:'lease-h',deferred_reason:'重复提交'}]).status,0);
 db=new DatabaseSync(file);
 const deferred=db.prepare('SELECT state,attempts,error,retrieved FROM pages WHERE id=?').get('h');
 assert.equal(deferred.state,'retry');assert.equal(deferred.attempts,0);assert.equal(deferred.error,null);
 assert(deferred.retrieved);assert.equal(db.prepare("SELECT count(*) n FROM events WHERE job_id='h:training' AND level='page_deferred'").get().n,1);
 assert.equal(db.prepare("SELECT count(*) n FROM page_leases WHERE page_id='h'").get().n,0);
 db.close();db=null;
 assert(!ok('next-page','4').some(x=>x.id==='h'),'延期遵守原有网页退避');
 assert.equal(ok('page-observation','h').page.state,'retry','其他页面触发验证只导致延期');
 // 复用只接受同人记录的精确网址及指定快照，在共享退避时仍可处理本地数据。
 const cacheUrl='https://shared.example/biography';
 const originalTime='2026-01-01T00:00:00.000Z';
 const digest=require('node:crypto').createHash('sha256').update(raw).digest('hex');
 db=new DatabaseSync(file);
 db.exec('CREATE TABLE identity_assertion_events(event_id TEXT PRIMARY KEY,left_id TEXT,right_id TEXT,kind TEXT,recorded_at TEXT)');
 for(const id of ['source','target','other']){
  db.prepare('INSERT INTO records(id,name,unit,filename,reviewed,updated) VALUES(?,?,?,?,0,?)').run(id,id,id,id,now);
  db.prepare("INSERT INTO jobs(id,record_id,kind,query,updated) VALUES(?,?,'training','q',?)").run(id+':training',id,now);
  db.prepare('INSERT INTO pages(id,record_id,job_id,url,state,attempts,error,excerpt,retrieved) VALUES(?,?,?,?,?,2,?,?,?)')
   .run(id,id,id+':training',cacheUrl,id==='source'?'done':'retry',id==='source'?null:'previous failure','original excerpt',now);
 }
 db.prepare("INSERT INTO page_observations VALUES('source',?,?,?,?, 'unknown')").run(digest,raw,Buffer.byteLength(raw),originalTime);
 const identity=db.prepare('INSERT INTO identity_assertion_events VALUES(?,?,?,?,?)');
 identity.run('same','source','target','same',originalTime);
 identity.run('old-same','other','source','same',originalTime);
 identity.run('different','other','source','different',now);
 db.prepare("INSERT INTO settings(key,value) VALUES('backoff_until',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(until);
 db.prepare('INSERT INTO page_leases VALUES(?,?,?)').run('target','active',until);
 db.close();db=null;
 const item={source_id:'source',target_id:'target',identity_event_id:'same',sha256:digest,excerpt:'已核对的相同人物档案'};
 fs.writeFileSync(payload,JSON.stringify([item,{...item,target_id:'other',identity_event_id:'old-same'}]));
 assert.equal(ok('reuse-cached-pages',payload).ready.length,0,'同网址有活动租约时不复用');
 db=new DatabaseSync(file);db.prepare("DELETE FROM page_leases WHERE page_id='target'").run();db.close();db=null;
 const preview=ok('reuse-cached-pages',payload);
 assert.equal(preview.ready.length,1);assert.match(preview.skipped[0].reason,/同人判定/);
 assert.equal(ok('page-observation','target').observation,null,'预览保持只读');
 assert.equal(ok('reuse-cached-pages',payload,'apply').ready.length,1);
 assert.equal(ok('reuse-cached-pages',payload,'apply').ready.length,0,'重复提交不增加原文或事件');
 const reused=ok('page-observation','target');
 assert.equal(reused.page.state,'done');assert.equal(reused.observation.retrieved,originalTime);
 assert.equal(reused.observation.tool_output,raw);assert.equal(reused.observation.completeness,'unknown');
 db=new DatabaseSync(file);
 assert.equal(db.prepare("SELECT attempts FROM pages WHERE id='target'").get().attempts,2);
 const cacheEvents=db.prepare("SELECT detail FROM events WHERE level='page_cache_reused'").all();
 assert.equal(cacheEvents.length,1);assert.equal(JSON.parse(cacheEvents[0].detail).previous_error,'previous failure');
 assert.equal(db.prepare("SELECT value FROM settings WHERE key='backoff_until'").get().value,until);
 assert.equal(db.prepare("SELECT relation_json FROM records WHERE id='target'").get().relation_json,'[]');
 db.close();db=null;
 console.log('通过：原始返回、租约、验证错误、延期及同人缓存复用，原日期和失败回执均保留。');
}finally{if(db)db.close();const target=fs.realpathSync(tmp);assert.equal(path.dirname(target),fs.realpathSync(__dirname));assert(path.basename(target).startsWith('.pi-observation-'));fs.rmSync(target,{recursive:true,force:true})}
