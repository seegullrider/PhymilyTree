const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert'),cp=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pi-typed-test-')),dbfile=path.join(dir,'test.sqlite'),tool=path.join(__dirname,'结构化师承关系.cjs');
try {
 fs.mkdirSync(path.join(dir,'人物'));
 fs.writeFileSync(path.join(dir,'人物','mentor.md'),'# mentor\n\n- 博士生：[[other|Other]]。\n');
 fs.writeFileSync(path.join(dir,'人物','other.md'),'# Other\n\n## 师承\n\n- 博士导师：[[mentor|Mentor]]。[CV](https://example.edu/cv#page=1)\n');
 const d=new DatabaseSync(dbfile);d.exec('CREATE TABLE records(id TEXT PRIMARY KEY,name TEXT,unit TEXT,filename TEXT); CREATE TABLE manual_audit_events(audit_id TEXT PRIMARY KEY,record_id TEXT,recorded_at TEXT,details_json TEXT);');
 d.prepare('INSERT INTO records VALUES (?,?,?,?)').run('person01','Person','Test School','person');d.prepare('INSERT INTO records VALUES (?,?,?,?)').run('person02','Other','Test School','other');
 const legacy=JSON.stringify({aspects:{identity:{status:'confirmed'},phd:{status:'confirmed_advisor',note:'本人履历博士条目明列导师姓名。',sources:['https://example.edu/cv']},postdoc:{status:'unresolved'}}});
 d.prepare('INSERT INTO manual_audit_events VALUES (?,?,?,?)').run('audit_001','person01','2026-01-01',legacy);d.prepare('INSERT INTO manual_audit_events VALUES (?,?,?,?)').run('audit_002','person02','2026-01-01',legacy);d.close();
 const env={...process.env,PI_AUTOMATION_DB:dbfile,PI_GRAPH_ROOT:dir};
 const run=(cmd,arg)=>cp.spawnSync(process.execPath,['--no-warnings',tool,cmd,...(arg?[arg]:[])],{env,encoding:'utf8'});
 const input=path.join(dir,'input.json'),item={event_id:'event_001',record_id:'person01',stage:'phd',mentor_filename:'mentor',kind:'advisor',source_audit_id:'audit_001',evidence:'本人履历明确列出该博士导师',sources:['https://example.edu/cv']};
 fs.writeFileSync(input,JSON.stringify([item]));assert.equal(JSON.parse(run('record',input).stdout).inserted,1);assert.equal(JSON.parse(run('record',input).stdout).reused,1);
 const bad={...item,event_id:'event_002',mentor_filename:'absent'};fs.writeFileSync(input,JSON.stringify([{...item,event_id:'event_003'},bad]));assert.notEqual(run('record',input).status,0);
 let s=JSON.parse(run('status').stdout);assert.equal(s.typed_relations,1);assert.equal(s.stages.phd.records_with_advisor,1);assert.equal(s.stages.phd.records_without_typed_relations,1);
 const next=JSON.parse(run('next','phd').stdout);assert.equal(next.length,1);assert.equal(next[0].id,'person02');
 const suggested=JSON.parse(run('suggest','phd').stdout);assert.equal(suggested.length,1);assert.equal(suggested[0].event.record_id,'person02');
 assert.deepEqual(suggested[0].event.sources,['https://example.edu/cv#page=1']);assert.equal(JSON.parse(run('status').stdout).typed_relations,1);
 const newer=new DatabaseSync(dbfile);newer.prepare('INSERT INTO manual_audit_events VALUES (?,?,?,?)').run('audit_003','person02','2026-01-02',legacy);newer.close();
 fs.writeFileSync(input,JSON.stringify([suggested[0].event]));assert.notEqual(run('record',input).status,0,'过期的补录建议必须重新核对');
 fs.writeFileSync(input,JSON.stringify([{...item,event_id:'event_004',kind:'candidate'}]));assert.equal(JSON.parse(run('record',input).stdout).inserted,1);
 s=JSON.parse(run('report').stdout);assert.equal(s.stages.phd.records_with_advisor,0);assert.equal(s.stages.phd.records_with_candidate,1);assert(fs.readFileSync(path.join(dir,'结构化师承关系（人工确认）.md'),'utf8').includes('候选关系'));
 console.log('结构化师承台账：去重、整批回滚、状态修订、未分类统计和报告检查通过');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
