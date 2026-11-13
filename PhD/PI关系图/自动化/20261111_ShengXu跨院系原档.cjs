
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_ShengXu跨院系原档';
const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const files = new Map();
const audits = [];
const relations = [];
const pages = [];
const record = db.prepare('SELECT name, unit, filename FROM records WHERE id=?');
const priorAudit = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const fileFor = filename => '../人物/' + filename + '.md';
const link = (label,url) => '[' + label + '](' + url + ')';
const index = '../师承关系索引.md';
function edit(file, predicate, change) {
 const current = files.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = current.includes('\r\n') ? '\r\n' : '\n';
 const lines = current.split(/\r?\n/);
 const matches = lines.flatMap((line,i) => predicate(line) ? [i] : []);
 if (matches.length !== 1) throw new Error(file + ': ' + matches.length + ' matching lines');
 const i = matches[0];
 lines[i] = change(lines[i],newline);
 files.set(file,lines.join(newline));
}
function append(file,predicate,addition) {
 edit(file,predicate,line => line.includes(addition) ? line : line + ' ' + addition);
}
function review(id, changes, next) {
 const event = JSON.parse(priorAudit.get(id).details_json);
 event.audit_id = 'pi_archive_20261111_shengxu_units_' + id;
 for (const [aspect,note,sources] of changes) {
  const old = event.aspects[aspect];
  event.aspects[aspect] = {...old,note,sources:[...new Set([...sources,...old.sources])]};
 }
 event.next_step = next;
 event.followup_required = true;
 audits.push(event);
 return event;
}
function evidence(event,stage,kind,mentor,note,sources,key) {
 relations.push({event_id:event.audit_id + '_' + key,record_id:event.record_id,stage,kind,mentor_filename:mentor,source_audit_id:event.audit_id,evidence:note,sources});
}
function original(id,url,raw) {
 pages.push({record_id:id,url,raw,excerpt:raw});
}

function school(p,transform,refs) {
 const prefix='| [['+p.filename+'|';
 edit('../'+p.unit+'逐人复核记录.md',line=>line.startsWith(prefix),line=>transform(line).trimEnd().slice(0,-1).trimEnd()+' · '+refs+' |');
}
const starts=(label,filename)=>line=>line.startsWith('- '+label+'：')&&(!filename||line.includes(filename));



{
 const id='3caf9ac9',p=record.get(id),file=fileFor(p.filename);
 const who='[['+p.filename+'|'+p.name+']]';
 const source='https://jacobsschool.ucsd.edu/people/profile/sheng-xu';
 const ref=link('UC San Diego Jacobs 工学院原档',source);
 const ece='已核实单位 - UC San Diego - 电气与计算机工程系（affiliate）';
 const bio='已核实单位 - UC San Diego - 生物工程系（affiliate）';
 const cne='已核实单位 - UC San Diego - 化学与纳米工程系（adjunct）';
 const base='../已核实院系/';
 const label='化学与纳米工程系（adjunct）、生物工程系和电气与计算机工程系（均为 faculty affiliate）';
 const note='UC San Diego Jacobs 工学院将 Sheng Xu 明确列为'+label+'。Stanford 主聘资料和 UC San Diego 原档各自记录本校任用。';
 edit(file,line=>line.startsWith('- 院系／机构：'),line=>line.replace(/。$/u,'')+' · [['+bio+'|生物工程系（affiliate）]] · [['+ece+'|电气与计算机工程系（affiliate）]]。');
 append(file,line=>line.startsWith('- Stanford 主聘教授，'),note+' '+ref);
 school(p,line=>line.replace(' | 化学与纳米工程系（adjunct）；',' | '+label+'；'),ref);
 append(base+cne+'.md',line=>line.startsWith('- '+who+' — '),'· '+ref);
 edit(base+ece+'.md',line=>line.startsWith('- [[')&&line.includes('Prabhakar R. Bandaru'),(line,nl)=>line+nl+'- '+who+' — '+ref);
 if(fs.existsSync(base+bio+'.md')) throw Error('Affiliate unit note already exists');
 files.set(base+bio+'.md','# UC San Diego：生物工程系（affiliate）\n\n[[院校 - UC San Diego|返回学校]]\n\n- '+who+' — '+ref+'\n');
 edit('../院校与机构/院校 - UC San Diego.md',line=>line.startsWith('- [[已核实单位 - UC San Diego - 生物工程系|'),(line,nl)=>line+nl+'- [['+bio+'|生物工程系（affiliate）]]');
 const prior=JSON.parse(priorAudit.get(id).details_json);
 review(id,[['affiliation',note,[source]],['research','UCSD 原档列软电子、纳米电子、能量采集与储存器件，强调无机功能材料的电学及力学行为。',[source]]],prior.next_step);
 original(id,source,'Jacobs 工学院原档并列 Chemical and Nano Engineering adjunct、Bioengineering 与 Electrical and Computer Engineering faculty affiliates；另列 UIUC 2011–2015 博后。');
}
db.close();
console.log(JSON.stringify({files:files.size,audits:audits.length,relations:relations.length,pages:pages.length}));
if(process.argv[2]==='apply') {
 function persist(label,value) {
  const path = batch+'_'+label+'.json';
  fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n','utf8');
  return path;
 }
 function run(script,...args) { execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'}); }
 for(const [file,content] of files) fs.writeFileSync(file,content,'utf8');
 for(const event of audits) run('人工核查台账.cjs','record',persist('人工_'+event.record_id,event));
 if(relations.length)run('结构化师承关系.cjs','record',persist('关系',relations));
 run('检索流程.cjs','ingest-reviewed-pages',persist('原档',pages));
}
