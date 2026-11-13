const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
const bridge=fs.readFileSync(path.join(__dirname,'Codex桥接模板.js'),'utf8'),limitPattern=bridge.match(/const throttled=pr\.filter\(x=>(\/.+?\/i)\.test/);assert(limitPattern);const isLimited=require('vm').runInNewContext(limitPattern[1]);assert(!isLimited.test('Internal Error: turn5429view0: (405) Method Not Allowed'));assert(isLimited.test('Failed to fetch https://example.org: (429) Too Many Requests'));
const redirectHelper = bridge.match(/^function isDirectoryRedirect\(raw\) \{[\s\S]*?^\}/m);
assert(redirectHelper);
const isDirectoryRedirect = require('vm').runInNewContext('(' + redirectHelper[0] + ')');
assert(isDirectoryRedirect('Directory Listing (https://engineering.example.edu/users/old.php)\nRedirected to URL: https://engineering.example.edu/directory/; Total lines: 562'));
assert(!isDirectoryRedirect('Directory Listing (https://engineering.example.edu/directory/)\nTotal lines: 562'));
assert(!isDirectoryRedirect('Faculty Profile (https://engineering.example.edu/old)\nRedirected to URL: https://engineering.example.edu/directory/professor.php; Total lines: 90'));
const excerptHelper = bridge.match(/^function pageExcerpt\(raw, name\) \{[\s\S]*?^\}/m);
assert(excerptHelper);
const pageExcerpt = require('vm').runInNewContext('(' + excerptHelper[0] + ')');
assert.equal(
  pageExcerpt('L41: # Test Person\nL43: ### Assistant Professor, Physics\nL45: 【34†Image: Test Person】\nL47: 555-555-1234', 'Test Person'),
  '# Test Person ### Assistant Professor, Physics'
);
const multiProfile = [
  'L75: Test Person will be the new director of the Institute for Photonics.',
  'L76: Test Person is a professor with the School of Engineering.',
  'L84: Test Person',
  'L85: Another Researcher received a PhD in chemical engineering.',
  'L88: Her postdoctoral research focused on catalysis.'
].join('\n');
assert.equal(
  pageExcerpt(multiProfile, 'Test Person'),
  'Test Person will be the new director of the Institute for Photonics. Test Person is a professor with the School of Engineering.'
);
const base=process.env.PI_TEST_ROOT||os.tmpdir();const dir=fs.mkdtempSync(path.join(base,'pi-queue-check-')),root=path.join(dir,'graph'),people=path.join(root,'人物');fs.mkdirSync(people,{recursive:true});
const nodes=[{id:'one',name:'Test Person',unit:'School A',filename:'person-a'},{id:'two',name:'Test Person：任职待核',unit:'School B',filename:'person-b'},{id:'three',name:'Another Person',unit:'School C',filename:'person-c'}];
fs.writeFileSync(path.join(root,'graph-manifest.json'),JSON.stringify({nodes}));
fs.writeFileSync(path.join(people,'person-a.md'),'# Test Person\n\n## 院系与研究方向核验（2026-11-03）\n\n## 师承\n\n- 博士导师：[[Mentor|Mentor]]。[来源](https://example.org/evidence)\n- 博士关系证据：论文列 “Mentor, Advisor”；可信度：高。\n');
fs.appendFileSync(path.join(people,'person-a.md'),'\n- 博士后主要接收导师：[[Sponsor|Sponsor]]。[来源](https://example.org/sponsor) 证据：履历列 principal postdoctoral sponsor；关系类型可信度：高。\n');
for(const n of nodes.slice(1))fs.writeFileSync(path.join(people,n.filename+'.md'),'# Person\n\n## 师承\n\n尚未系统核对。\n');
fs.appendFileSync(path.join(people,'person-b.md'),'\n- 博士后课题组成员：[[FormerStudent|FormerStudent]]。[来源](https://example.org/student)\n- 博士后阶段研究合作者：[[Colleague|Colleague]]。[来源](https://example.org/colleague)\n- 博士后研究者：[[Alum|Alum]]。[来源](https://example.org/alum)\n');
fs.appendFileSync(path.join(people,'person-b.md'),'\n- 博士生：[[Graduate|Graduate]]。[来源](https://example.org/graduate)\n- 博士后受指导者：[[Postdoc|Postdoc]]。[来源](https://example.org/postdoc)\n');
fs.appendFileSync(path.join(people,'person-b.md'),'\n- 博士后合作者（反向候选）：[[ReverseCandidate|ReverseCandidate]]。[来源](https://example.org/reverse-candidate)\n');
fs.appendFileSync(path.join(people,'person-c.md'),'\n- 博士后候选关系：[[Candidate|Candidate]]。[来源](https://example.org/candidate) 关系类型可信度：低；具体证据见下方核查边界。\n- 博士后阶段研究师长：[[Other|Other]]。[来源](https://example.org/other) 证据：本人简历明确与 Other 共事。关系类型可信度：高。\n- 博士后课题组：[[Third|Third]]。[来源](https://example.org/third) 证据：实验室校友表列为博士后；关系类型可信度：高。\n- 博士后研究师长：[[Fourth|Fourth]]。[来源](https://example.org/fourth) 证据：机构明确指导关系。关系类型可信度：高。\n- 博士后关系证据：人物页另有阶段证据，尚未逐人分配。\n- 核查边界：此人博士导师仍待查，不应当作为博士后证据。\n');
const env={...process.env,PI_GRAPH_ROOT:root,PI_AUTOMATION_DB:path.join(dir,'fixture.sqlite')},script=path.join(__dirname,'检索流程.cjs');
fs.appendFileSync(path.join(people,'person-c.md'),'\n- 博士毕业后研究课题组负责人（职位性质待核）：[[Later|Later]]。[来源](https://example.org/later) 证据：博士后获研究员职位但具体性质待核；关系类型可信度：高。\n');
const run=(...a)=>JSON.parse(execFileSync(process.execPath,['--no-warnings',script,...a],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const enc=x=>Buffer.from(JSON.stringify(x),'utf8').toString('base64');
let s=run('sync');assert.equal(s.records,3);assert.equal(s.manual_reviewed,1);assert.equal(s.collisions,2);assert.equal(s.explicit_phd_records,1);assert.equal(s.only_group_or_candidate,1);assert.equal(s.records_with_direction_undetermined,1);assert.equal(s.records_with_likely_reverse,1);{const {DatabaseSync}=require('node:sqlite'),check=new DatabaseSync(env.PI_AUTOMATION_DB),rel=JSON.parse(check.prepare("select relation_json from records where id='three'").get().relation_json),rev=JSON.parse(check.prepare("select relation_json from records where id='two'").get().relation_json);assert.equal(rel[0].confidence,'低');assert.equal(rel[0].direction,'own_likely');assert.equal(rev[0].direction,'reverse_likely');assert.equal(rev[1].direction,'undetermined');assert.equal(rev[2].direction,'reverse_likely');assert(rel[0].evidence.includes('缺少可单独归属的证据'));assert(rel[0].phase_evidence_unassigned.includes('尚未逐人分配'));assert(rel[0].review_boundary.includes('博士导师仍待查'));assert(!rel[0].evidence.includes('博士导师仍待查'));assert.equal(rel[1].evidence,'本人简历明确与 Other 共事');assert.equal(rel[1].confidence,'高');assert.equal(rel[2].evidence,'实验室校友表列为博士后');assert.equal(rel[3].direction,'own_likely');assert.equal(rel[3].evidence,'机构明确指导关系');check.close();}assert(fs.readFileSync(path.join(root,'自动检索运行进度.md'),'utf8').includes('自动线索不创建师承关系'));
assert.equal(s.explicit_post_records,1);{const {DatabaseSync}=require('node:sqlite'),check=new DatabaseSync(env.PI_AUTOMATION_DB),rel=JSON.parse(check.prepare("select relation_json from records where id='one'").get().relation_json),sponsor=rel.find(x=>x.type==='博士后主要接收导师');assert(sponsor);assert.equal(sponsor.phase,'博士后');assert.equal(sponsor.direction,'own_likely');assert.equal(sponsor.evidence,'履历列 principal postdoctoral sponsor');check.close();}
{const {DatabaseSync}=require('node:sqlite'),check=new DatabaseSync(env.PI_AUTOMATION_DB),rel=JSON.parse(check.prepare("select relation_json from records where id='three'").get().relation_json),later=rel.find(x=>x.target.startsWith('Later|'));assert.equal(later.phase,'博士毕业后（职位未核）');assert.equal(later.direction,'own_likely');assert.equal(later.evidence,'博士后获研究员职位但具体性质待核');assert(!later.phase_evidence_unassigned);check.close();}
{const {DatabaseSync}=require('node:sqlite'),check=new DatabaseSync(env.PI_AUTOMATION_DB),rel=JSON.parse(check.prepare("select relation_json from records where id='two'").get().relation_json);assert.equal(rel.find(x=>x.target.startsWith('Graduate|')).direction,'reverse_likely');assert.equal(rel.find(x=>x.target.startsWith('Graduate|')).phase,'博士');assert.equal(rel.find(x=>x.target.startsWith('Postdoc|')).direction,'reverse_likely');assert.equal(rel.find(x=>x.target.startsWith('Postdoc|')).phase,'博士后');check.close();}
{const {DatabaseSync}=require('node:sqlite'),check=new DatabaseSync(env.PI_AUTOMATION_DB),relations=JSON.parse(check.prepare("select relation_json from records where id='two'").get().relation_json);assert.equal(relations.find(relation=>relation.target.startsWith('ReverseCandidate|')).direction,'reverse_likely');check.close();}
{const {DatabaseSync}=require('node:sqlite'),control=new DatabaseSync(env.PI_AUTOMATION_DB);control.prepare("INSERT INTO settings(key,value) VALUES('thesis_search_retry_after',?)").run(new Date(Date.now()+60000).toISOString());control.close();assert.deepEqual(run('next','8'),[]);assert.deepEqual(run('next-page','4'),[]);const reset=new DatabaseSync(env.PI_AUTOMATION_DB);reset.prepare("DELETE FROM settings WHERE key='thesis_search_retry_after'").run();reset.close();}
assert(run('next','8').find(x=>x.id==='two:identity').query.startsWith('"Test Person"'));
s=run('ingest',enc([{id:'one:identity',error:'模拟网络失败'}]));assert.equal(s.jobs.find(x=>x.state==='retry').n,1);assert.equal(s.automatically_searched,0);
assert.equal(run('next','1')[0].query,'"Test Person" School A professor');
const fake='Test Person faculty (https://example.org/profile)\nTest Person is a researcher.';
s=run('ingest',enc([{id:'one:identity',query:'"Test Person" School A faculty research laboratory',raw:fake},{id:'one:training',raw:fake}]));assert.equal(s.automatically_searched,1);assert.equal(s.pending_render,0);
const file=path.join(people,'person-a.md'),text=fs.readFileSync(file,'utf8');assert(text.includes('博士导师：[[Mentor|Mentor]]'));assert(text.includes('姓名字符串出现，仍须核对单位时间'));assert(text.includes('关系未判定，可信度未评估'));assert(!text.includes('博士后导师：'));
run('ingest',enc([{id:'one:identity',raw:fake}]));assert.equal(fs.readFileSync(file,'utf8'),text);
const page=run('next-page','1')[0];assert(page);const pagesFile=path.join(dir,'pages.json');fs.writeFileSync(pagesFile,JSON.stringify([{id:page.id,excerpt:'Test Person works on a research subject.'}]));s=run('ingest-pages',pagesFile);assert.equal(s.pages.find(x=>x.state==='done').n,1);assert(fs.readFileSync(file,'utf8').includes('已读取来源页'));
s=run('ingest',enc([{id:'two:identity',raw:fake+'\n----------\nTest Person other (https://www.example.org/profile2)\nTest Person other source.'},{id:'three:identity',raw:'Another Person (https://different.example/profile)\nAnother Person is a researcher.'}]));const candidatePages=run('next-page','4'),limited=candidatePages.find(x=>x.url==='https://example.org/profile');assert.equal(new Set(candidatePages.map(x=>new URL(x.url).hostname.replace(/^www\./,''))).size,candidatePages.length);assert(limited);fs.writeFileSync(pagesFile,JSON.stringify([{id:limited.id,error:'Internal Error: Failed to fetch '+limited.url+': (429) Too Many Requests'}]));s=run('ingest-pages',pagesFile);assert.equal(s.backoff_until,null);const remainingPages=run('next-page','4');assert(!remainingPages.some(x=>x.url===limited.url||x.url==='https://www.example.org/profile2'));assert(remainingPages.some(x=>x.url==='https://different.example/profile'));
{const {DatabaseSync:AliasDatabase}=require('node:sqlite'),adb=new AliasDatabase(env.PI_AUTOMATION_DB);assert.equal(adb.prepare("SELECT count(*) n FROM pages WHERE url='https://www.example.org/profile2'").get().n,1);adb.prepare("UPDATE host_limits SET host='www.example.org' WHERE host='example.org'").run();adb.close();assert(!run('next-page','4').some(x=>new URL(x.url).hostname.replace(/^www\./,'')==='example.org'));const restore=new AliasDatabase(env.PI_AUTOMATION_DB);restore.prepare("UPDATE host_limits SET host='example.org' WHERE host='www.example.org'").run();restore.close();}
const transient=remainingPages.find(x=>x.url==='https://different.example/profile');fs.writeFileSync(pagesFile,JSON.stringify([{id:transient.id,error:'HTTP 502 Bad Gateway'}]));run('ingest-pages',pagesFile);assert(!run('next-page','4').some(x=>x.id===transient.id));const {DatabaseSync:TestDatabase}=require('node:sqlite'),testDb=new TestDatabase(env.PI_AUTOMATION_DB);testDb.prepare("UPDATE pages SET retrieved='2000-01-01T00:00:00.000Z' WHERE id=?").run(transient.id);testDb.close();assert(run('next-page','4').some(x=>x.id===transient.id));fs.writeFileSync(pagesFile,JSON.stringify([{id:transient.id,excerpt:'Another Person works on a research subject.'}]));run('ingest-pages',pagesFile);
s=run('refresh-record','one');assert.equal(s.automatically_searched,0);s=run('ingest',enc([{id:'one:identity',raw:fake+' Updated.'}]));assert(fs.readFileSync(file,'utf8').includes('博士导师：[[Mentor|Mentor]]'));
const beforePages=s.pages.reduce((a,x)=>a+x.n,0),multi='Another Person CV (https://cv.example/person)\nAnother Person CV.\n----------\nAnother Person lab (https://lab.example/person)\nAnother Person laboratory.';s=run('ingest',enc([{id:'three:training',raw:multi}]));assert.equal(s.pages.reduce((a,x)=>a+x.n,0),beforePages+2);s=run('enqueue-pages');assert.equal(s.pages.reduce((a,x)=>a+x.n,0),beforePages+2);
const challengePage=run('next-page','4').find(x=>x.url==='https://cv.example/person');assert(challengePage);fs.writeFileSync(pagesFile,JSON.stringify([{id:challengePage.id,excerpt:'Click here if you are not automatically redirected. Checking your browser before accessing the site.'}]));run('ingest-pages',pagesFile);{const {DatabaseSync:ChallengeDB}=require('node:sqlite'),cdb=new ChallengeDB(env.PI_AUTOMATION_DB),row=cdb.prepare('SELECT state,error,excerpt FROM pages WHERE id=?').get(challengePage.id);assert.equal(row.state,'excluded');assert(row.error.includes('浏览器验证'));assert.equal(row.excerpt,null);cdb.prepare("UPDATE pages SET retrieved='2000-01-01T00:00:00.000Z' WHERE id=?").run(challengePage.id);cdb.close();}assert(!run('next-page','4').some(x=>x.id===challengePage.id));
const campusPage=run('next-page','4').find(x=>x.url==='https://lab.example/person');assert(campusPage);fs.writeFileSync(pagesFile,JSON.stringify([{id:campusPage.id,excerpt:'You need to be on the university network in order to access this service. Please connect to the VPN.'}]));run('ingest-pages',pagesFile);{const {DatabaseSync:CampusDB}=require('node:sqlite'),cdb=new CampusDB(env.PI_AUTOMATION_DB),row=cdb.prepare('SELECT state,error,excerpt FROM pages WHERE id=?').get(campusPage.id);assert.equal(row.state,'retry');assert(row.error.includes('校园网'));assert.equal(row.excerpt,null);cdb.close();}
run('refresh-record','three');s=run('ingest',enc([{id:'three:training',raw:'Another Person CV (https://blocked.example/person)\nAnother Person biography.'}]));const {DatabaseSync:PageDB}=require('node:sqlite'),pdb=new PageDB(env.PI_AUTOMATION_DB),robotsPage=pdb.prepare('SELECT id FROM pages WHERE url=?').get('https://blocked.example/person');pdb.close();assert(robotsPage);fs.writeFileSync(pagesFile,JSON.stringify([{id:robotsPage.id,error:'Fetch denied by robots.txt'}]));run('ingest-pages',pagesFile);{const {DatabaseSync:RobotsDB}=require('node:sqlite'),rdb=new RobotsDB(env.PI_AUTOMATION_DB),row=rdb.prepare('SELECT state,error FROM pages WHERE id=?').get(robotsPage.id);assert.equal(row.state,'excluded');assert(row.error.includes('robots.txt'));rdb.close();}run('retry-failed');assert(!run('next-page','4').some(x=>x.id===robotsPage.id));
s=run('ingest',enc([{id:'two:training',error:'HTTP 429 Too Many Requests'}]));assert(s.backoff_until);assert.equal(run('next','1').length,0);
const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(env.PI_AUTOMATION_DB);assert.equal(db.prepare("select count(*) n from events where level='error'").get().n,1);assert.equal(db.prepare("select detail from events where level='query' and job_id='one:identity'").get().detail,'"Test Person" School A faculty research laboratory');assert.equal(db.prepare("select count(*) n from result_history where job_id='one:identity'").get().n,1);assert.equal(db.prepare("select attempts from jobs where id='two:training'").get().attempts,0);assert.equal(db.prepare("select host from host_limits").get().host,'example.org');const rel=JSON.parse(db.prepare("select relation_json from records where id='one'").get().relation_json)[0];assert.equal(rel.source_quote,'Mentor, Advisor');assert.equal(rel.confidence,'高');db.prepare('DELETE FROM host_limits').run();assert.equal(run('recover-site-limits').recovered_hosts,1);assert.equal(run('recover-site-limits').recovered_hosts,0);
const badFile=path.join(people,'person-c.md'),beforeBad=fs.readFileSync(badFile,'utf8'),bad=beforeBad+'\n<!-- PI-AUTO-SEARCH:START -->';fs.writeFileSync(badFile,bad);run('refresh-record','three');s=run('ingest',enc([{id:'three:identity',raw:fake}]));assert.equal(s.flush.failed,1);assert.equal(fs.readFileSync(badFile,'utf8'),bad);fs.writeFileSync(badFile,beforeBad);assert.equal(run('flush').failed,0);
db.prepare("DELETE FROM settings WHERE key='backoff_until'").run();db.prepare("UPDATE pages SET state='excluded' WHERE state IN ('pending','retry')").run();db.prepare("INSERT INTO pages(id,record_id,job_id,url) VALUES('linkedin-subdomain','one','one:identity','https://in.linkedin.com/in/test')").run();db.prepare("INSERT OR REPLACE INTO host_limits(host,until,streak,last_limit) VALUES('linkedin.com',?,1,?)").run(new Date(Date.now()+600000).toISOString(),new Date().toISOString());assert(!run('next-page','4').some(x=>x.id==='linkedin-subdomain'));db.prepare("DELETE FROM host_limits WHERE host='linkedin.com'").run();assert(run('next-page','4').some(x=>x.id==='linkedin-subdomain'));
run('refresh-record','three');s=run('ingest',enc([{id:'three:training',raw:'Another Person\n\nProfessor,\nUniversity (https://example.org/multiline-cv.pdf)\nAnother Person CV; Advisor: Example Mentor.'}]));assert.equal(db.prepare('SELECT state FROM jobs WHERE id=?').get('three:training').state,'done');const parsedMulti=JSON.parse(db.prepare('SELECT sources_json FROM results WHERE job_id=?').get('three:training').sources_json);assert.equal(parsedMulti[0].url,'https://example.org/multiline-cv.pdf');assert.equal(parsedMulti[0].title,'Another Person Professor, University');assert.equal(parsedMulti[0].relation,'未判定');
// 不同站点同批 429 至少暂停半小时，且不得缩短已有的更长退避。
db.prepare("DELETE FROM settings WHERE key IN ('backoff_until','thesis_search_retry_after')").run();
const addTestPage=db.prepare('INSERT INTO pages(id,record_id,job_id,url) VALUES(?,?,?,?)');
addTestPage.run('multi-one','one','one:identity','https://first.example/a');
addTestPage.run('multi-two','two','two:identity','https://second.example/b');
fs.writeFileSync(pagesFile,JSON.stringify([{id:'multi-one',error:'Failed to fetch https://first.example/a: (429) Too Many Requests'},{id:'multi-two',error:'Failed to fetch https://second.example/b: (429) Too Many Requests'}]));
s=run('ingest-pages',pagesFile);assert(Date.parse(s.backoff_until)-Date.now()>29*60000);assert.deepEqual(run('next-page','4'),[]);
const longer=new Date(Date.now()+60*60000).toISOString();db.prepare("UPDATE settings SET value=? WHERE key='backoff_until'").run(longer);
addTestPage.run('multi-three','one','one:identity','https://third.example/a');
addTestPage.run('multi-four','two','two:identity','https://fourth.example/b');
fs.writeFileSync(pagesFile,JSON.stringify([{id:'multi-three',error:'Failed to fetch https://third.example/a: (429) Too Many Requests'},{id:'multi-four',error:'Failed to fetch https://fourth.example/b: (429) Too Many Requests'}]));
assert.equal(run('ingest-pages',pagesFile).backoff_until,longer);
// 页面队列优先处理最新台账中未明、再处理候选；旧 confirmed_advisor 并不代表证据充分，也不能被丢弃。
db.prepare("DELETE FROM settings WHERE key IN ('backoff_until','thesis_search_retry_after')").run();
db.prepare('DELETE FROM host_limits').run();db.prepare("UPDATE pages SET state='excluded' WHERE state IN ('pending','retry')").run();
const insAudit=db.prepare('INSERT INTO manual_audit_events(audit_id,record_id,recorded_at,details_json) VALUES(?,?,?,?)');
for(const [id,phd,post] of [['one','confirmed_advisor','confirmed_advisor'],['two','group_or_candidate','confirmed_advisor'],['three','unresolved','confirmed_advisor']])insAudit.run('priority-'+id,id,new Date().toISOString(),JSON.stringify({aspects:{phd:{status:phd},postdoc:{status:post}}}));
for(const [id,record,host] of [['priority-confirmed','one','confirmed.example'],['priority-candidate','two','candidate.example'],['priority-unresolved','three','unresolved.example']])addTestPage.run(id,record,record+':identity','https://'+host+'/person');
assert.equal(run('next-page','4')[0].id,'priority-candidate'); // 没有已读原页的校属记录先获得一席。
db.prepare("UPDATE pages SET state='done' WHERE id='priority-candidate'").run();
assert.equal(run('next-page','4')[0].id,'priority-unresolved');
db.prepare("UPDATE pages SET state='pending' WHERE id='priority-candidate'").run();
db.prepare("UPDATE pages SET state='retry',retrieved='2000-01-01T00:00:00.000Z' WHERE id='priority-confirmed'").run();
assert.equal(run('next-page','1')[0].id,'priority-confirmed');
db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('backoff_until',?)").run(new Date(Date.now()+60000).toISOString());assert.deepEqual(run('next-page','4'),[]);
assert.deepEqual(run('lease-pages','4'),[]);
// 领取须原子隔离同一页面和同网址的跨人物页面；过期租约不能覆盖新领取结果。
db.prepare("DELETE FROM settings WHERE key IN ('backoff_until','thesis_search_retry_after')").run();db.prepare("UPDATE pages SET state='excluded' WHERE state IN ('pending','retry')").run();
addTestPage.run('lease-a','one','one:identity','https://lease.example/same');addTestPage.run('lease-b','two','two:identity','https://lease.example/same');addTestPage.run('lease-c','three','three:identity','https://another-lease.example/page');
const leasedFirst=run('lease-pages','1')[0],leasedSecond=run('lease-pages','4');assert(leasedFirst.lease_token);assert(!leasedSecond.some(x=>x.id===leasedFirst.id||x.url===leasedFirst.url));assert(!run('next-page','4').some(x=>x.url===leasedFirst.url));
fs.writeFileSync(pagesFile,JSON.stringify([{id:leasedFirst.id,lease_token:'wrong',excerpt:'Incorrect stale result'}]));assert.throws(()=>run('ingest-pages',pagesFile));
fs.writeFileSync(pagesFile,JSON.stringify([{id:leasedFirst.id,lease_token:leasedFirst.lease_token,excerpt:'A directly read page for a fixture person.'}]));run('ingest-pages',pagesFile);run('ingest-pages',pagesFile);assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get(leasedFirst.id).state,'done');
const oldLease=leasedSecond[0];assert(oldLease);db.prepare("UPDATE page_leases SET expires_at='2000-01-01T00:00:00.000Z' WHERE page_id=?").run(oldLease.id);const renewed=run('lease-pages','4').find(x=>x.id===oldLease.id);assert(renewed&&renewed.lease_token!==oldLease.lease_token);
fs.writeFileSync(pagesFile,JSON.stringify([{id:oldLease.id,lease_token:oldLease.lease_token,excerpt:'A stale result'}]));assert.throws(()=>run('ingest-pages',pagesFile));
fs.writeFileSync(pagesFile,JSON.stringify([{id:renewed.id,lease_token:renewed.lease_token,excerpt:'A newly read fixture page.'}]));run('ingest-pages',pagesFile);assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get(renewed.id).state,'done');
// 两个真正的进程同时领取，不得收到相同页面或网址。
db.prepare('DELETE FROM page_leases').run();db.prepare("UPDATE pages SET state='excluded' WHERE state IN ('pending','retry')").run();
for(let i=0;i<4;i++)addTestPage.run('parallel-'+i,'one','one:identity','https://parallel'+i+'.example/page');
const parallel=`const {spawn}=require('node:child_process');function run(){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--no-warnings',process.argv[1],'lease-pages','4']);let o='',e='';p.stdout.on('data',x=>o+=x);p.stderr.on('data',x=>e+=x);p.on('error',reject);p.on('close',c=>c?reject(Error(e)):resolve(JSON.parse(o)))});}Promise.all([run(),run()]).then(r=>process.stdout.write(JSON.stringify(r))).catch(e=>{process.stderr.write(String(e));process.exitCode=1});`;
const concurrent=JSON.parse(execFileSync(process.execPath,['-e',parallel,script],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']})),flat=concurrent.flat();assert.equal(flat.length,4);assert.equal(new Set(flat.map(x=>x.id)).size,4);assert.equal(new Set(flat.map(x=>x.url)).size,4);
// 防止把嵌套原站地址的第三方代理重新排队；普通 workers.dev 个人网站不应一概排除。
addTestPage.run('proxy-http-path','one','one:identity','https://forwarder.workers.dev/https/original.example/p');
addTestPage.run('proxy-encoded-path','two','two:identity','https://forwarder.workers.dev/https%3A%2F%2Foriginal.example/p');
addTestPage.run('ordinary-worker','three','three:identity','https://my-lab.workers.dev/research');run('status');
assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get('proxy-http-path').state,'excluded');
assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get('proxy-encoded-path').state,'excluded');
assert.equal(db.prepare('SELECT state FROM pages WHERE id=?').get('ordinary-worker').state,'pending');
// 已知正文过大或只返回标题，间隔到期后也不能盲目再次请求；普通失败仍可重试。
db.prepare('DELETE FROM page_leases').run();db.prepare("UPDATE pages SET state='excluded' WHERE state IN ('pending','retry')").run();
for(const [id,host,error] of [['oversize','big.example','(400) Content length is too large: 74813018'],['title-only','title.example','页面可访问但仅返回标题，无法核实'],['denied-999','denied.example','(999) Unknown Status Code'],['denied-403','forbidden.example','(403) Forbidden'],['normal-retry','other.example','HTTP 502 Bad Gateway']]){
 addTestPage.run(id,'one','one:identity','https://'+host+'/p');
 db.prepare("UPDATE pages SET state='retry',error=?,retrieved='2000-01-01T00:00:00.000Z' WHERE id=?").run(error,id);
}
const retrySelection=run('next-page','4').map(x=>x.id);assert(retrySelection.includes('normal-retry'));assert(!retrySelection.includes('oversize'));assert(!retrySelection.includes('title-only'));assert(!retrySelection.includes('denied-999'));assert(!retrySelection.includes('denied-403'));
const reviewedRead = {record_id:'one',url:'https://reviewed.example/thesis',raw:'Primary thesis fragment',excerpt:'Award and adviser stated in the thesis.'};
const reviewedError = {record_id:'two',url:'https://reviewed-failure.example/cv',error:'HTTP 502 Bad Gateway'};
const importReviewed = (...rows) => {
 fs.writeFileSync(pagesFile,JSON.stringify(rows));
 return run('ingest-reviewed-pages',pagesFile).reviewed;
};
const getReviewed = row => db.prepare('SELECT * FROM pages WHERE record_id=? AND url=?').get(row.record_id,row.url);
assert.equal(importReviewed(reviewedRead,reviewedError).processed,2);
assert.equal(getReviewed(reviewedRead).state,'done');
assert.equal(getReviewed(reviewedError).attempts,1);
assert.equal(importReviewed(reviewedRead,reviewedError).duplicates,1);
assert.equal(getReviewed(reviewedError).attempts,1);
const extra = {...reviewedRead,raw:'Second fragment from the same thesis',excerpt:'Alternative excerpt'};
assert.equal(importReviewed(extra).observations,1);
assert.equal(getReviewed(reviewedRead).excerpt,reviewedRead.excerpt);
assert.equal(importReviewed(extra).observations,0);
assert.equal(importReviewed({record_id:'one',url:reviewedRead.url,error:'HTTP 502 Bad Gateway'}).skipped.length,1);
assert.equal(getReviewed(reviewedRead).state,'done');
run('refresh-page',getReviewed(reviewedRead).id,'重新核查学位论文的签署页');
assert.equal(importReviewed(extra).skipped[0].reason,'显式复读须凭租约提交');
const busy = {...reviewedRead,record_id:'two',url:'https://occupied.example/cv'};
addTestPage.run('reviewed-busy','one','one:training',busy.url);
db.prepare('INSERT INTO page_leases(page_id,token,expires_at) VALUES(?,?,?)')
 .run('reviewed-busy','owner-token',new Date(Date.now()+600000).toISOString());
assert.equal(importReviewed(busy).skipped[0].reason,'同一网址存在有效租约');
assert.equal(getReviewed(busy),undefined);
const invalid = {...reviewedRead,record_id:'missing',url:'https://other-reviewed.example/missing'};
const rolledBack = {...reviewedRead,url:'https://rollback-reviewed.example/new'};
assert.throws(()=>importReviewed(rolledBack,invalid));
assert.equal(getReviewed(rolledBack),undefined);
const throttledReceipt = {record_id:'one',url:'https://throttled-reviewed.example/page',error:'Failed to fetch https://throttled-reviewed.example/page: (429) Too Many Requests'};
assert.equal(importReviewed(throttledReceipt).processed,1);
const throttle = db.prepare('SELECT * FROM host_limits WHERE host=?').get('throttled-reviewed.example');
assert(throttle);
assert.equal(getReviewed(throttledReceipt).attempts,0);
assert.equal(importReviewed(throttledReceipt).duplicates,1);
assert.deepEqual(db.prepare('SELECT * FROM host_limits WHERE host=?').get(throttle.host),throttle);
console.log(JSON.stringify({ok:true,checks:['断点重试','重复导入幂等','网页租约及同网址隔离','失效租约不能覆盖','待核页面优先','同名标记','既有关系保留','博士后候选计数','检索线索不提升为导师','网页读取分开计数','普通网页失败延迟重试','超大或仅标题结果停止自动重试','robots拒绝停止重试','来源站点限流隔离','多站限流半小时及较长退避不缩短','LinkedIn子域退避共享','搜索服务 429 全局退避','增量更新保留历史','多行结果标题解析','状态统计'],fixture:dir}));
