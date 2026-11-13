
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_Brongersma博后原档';
const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const files = new Map();
const audits = [];
const relations = [];
const pages = [];
const record = db.prepare('SELECT name, unit, filename FROM records WHERE id=?');
const priorAudit = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const fileFor = filename => '../人物/' + filename + '.md';
const link = (label,url) => '[' + label + '](' + url + ')';
const roster = 'https://vahala.caltech.edu/alumni';
const vahala = '人员 - Caltech - Kerry Vahala - 20861ff7';
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
 event.audit_id = 'pi_archive_20261111_caltech_' + id;
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
{
 const id = '2026ea79';
 const p = record.get(id);
 const cv = 'https://cap.stanford.edu/profiles/viewCV?facultyId=8051&name=Mark_Brongersma';
 const profile = 'https://profiles.stanford.edu/mark-brongersma';
 const conf = 'https://congress2021.metamorphose-vi.org/index.php/plenary-speakers';
 const atwater = '人员 - Caltech - Harry Atwater - e118c47d';
 const atwaterThesis = 'https://thesis.caltech.edu/2079/2/Julie_Casperson_Thesis.pdf';
 const history = '本人 CV 分列 Caltech 1998–2000 Postdoctoral Research Fellow 与 2000–2001 Senior Postdoctoral Research Fellow。';
 const two = '2021 会议原讲者简介记两位博后共事老师 Harry Atwater、Kerry Vahala。各人具体监督日期与正式个人导师职衔待核。';
 const vahalaRole = 'Vahala 组官方名录列 Mark Brongersma 为 2001 Post Doctoral Scholar 和 Stanford 材料教授。' + history + two;
 const atwaterRole = 'Caltech 同组原论文支持 Atwater 组属，' + history + two;
 const next = '查 Caltech 1998–2000 及 2000–2001 两段博后的任用或项目原件，确认两位负责人各自的指导称谓及任期。';
 const refs = link('Vahala 组原名录',roster)+' · '+link('本人 CV',cv)+' · '+link('会议原讲者履历',conf);
 const person = '[['+p.filename+'|'+p.name+']]';
 const role = '博士后课题组负责人：[['+vahala+'|Kerry Vahala]]。'+vahalaRole+' '+refs;
 const mark = line => line.includes(p.filename);
 edit(fileFor(p.filename),line=>line.startsWith('- 博士后课题组负责人：')&&line.includes(atwater),(line,nl)=>line+' '+history+' '+link('本人 CV',cv)+nl+'- '+role);
 edit(fileFor(p.filename),line=>line.startsWith('- 核查边界：'),line=>line+' '+next);
 edit(fileFor(vahala),line=>line.startsWith('- 博士后课题组成员：')&&line.includes('Oskar Painter'),(line,nl)=>line+nl+'- 博士后课题组成员：'+person+'。'+vahalaRole+' '+refs);
 append(fileFor(atwater),line=>line.startsWith('- 博士后课题组成员：')&&mark(line),history+two+' '+link('本人 CV',cv)+' · '+link('会议原讲者履历',conf));
 edit(index,line=>line.startsWith('- '+person+' → 博士后课题组负责人：')&&line.includes(atwater),(line,nl)=>line+' '+link('本人 CV',cv)+nl+'- '+person+' → '+role);
 edit('../Stanford逐人复核记录.md',line=>line.startsWith('| '+person+' |'),line=>line.replace(' | Harry Atwater | ',' | Harry Atwater、Kerry Vahala（博后课题组负责人，正式导师待查） | ').slice(0,-2)+' · '+refs+' |');
 const e = review(id,[['postdoc',atwaterRole+' '+vahalaRole,[cv,profile,roster,conf,atwaterThesis]]],next);
 evidence(e,'postdoc','group_leader',vahala,vahalaRole,[roster,cv,conf],'vahala');
 evidence(e,'postdoc','group_leader',atwater,atwaterRole,[atwaterThesis,cv,conf],'atwater');
 original(id,roster,'Vahala 组原名录具名 Mark Brongersma 2001 Post Doctoral Scholar 与 Stanford 材料科学和工程教授。');
 original(id,cv,'Stanford 托管本人 CV 第 1 页分列 Caltech 1998–2000 博后研究员和 2000–2001 高级博后研究员。');
 original(id,conf,'会议原始讲者简介称 Mark Brongersma 1998–2001 Caltech 博后期与 Harry Atwater、Kerry Vahala 共事。');
 pages.push({record_id:id,url:'https://atwater.caltech.edu/past-members',error:'网页工具返回不可访问。本轮保留失败，使用 Vahala 组档、本人 CV 和讲者履历。'});
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
 run('结构化师承关系.cjs','record',persist('关系',relations));
 run('检索流程.cjs','ingest-reviewed-pages',persist('原档',pages));
}
