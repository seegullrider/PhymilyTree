
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_LSRF具名博后原档';
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
 event.audit_id = 'pi_archive_20261111_lsrf_' + id;
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
 const id='e9420673',p=record.get(id),file=fileFor(p.filename),mentor='师承人物 - F. Dean Toste';
 const url='https://lsrf.org/alumni-fellows/', bio='https://www.zhukogroup.com/about-alex';
 const note='LSRF 2016 年度名录在 Aleksandr Zhukhovitskiy 的 Merck Research Laboratories 奖助条目明确列 F. Dean Toste 为 Postdoc Mentor。本人实验室履历核其 2016–2019 Berkeley 化学系任期。';
 const refs=link('LSRF 奖助原档',url)+' · '+link('本人实验室履历',bio);
 const rename=(line,a,b)=>line.replace(a,b).split('。本人实验室履历列')[0]+'。'+note+' '+refs;
 edit(file,starts('博士后课题组负责人',mentor),line=>rename(line,'博士后课题组负责人：','博士后导师：'));
 edit(file,starts('核查边界'),()=>'- 核查边界：博士和博士后原档分别具名个人导师。MIT 学位论文签署页可在馆藏退避到期后补核。');
 edit(fileFor(mentor),starts('博士后课题组成员',p.filename),line=>rename(line,'博士后课题组成员：','博士后研究者：'));
 edit(index,line=>line.startsWith('- [['+p.filename+'|')&&line.includes(' → 博士后课题组负责人：')&&line.includes(mentor),line=>rename(line,' → 博士后课题组负责人：',' → 博士后导师：'));
 school(p,line=>line.replace('F. Dean Toste（博士后课题组负责人）','F. Dean Toste（2016–2019 Berkeley 博士后导师）'),refs);
 const e=review(id,[['postdoc',note,[url,bio]]],'MIT 学位馆藏退避到期后补博士论文签署页。');
 e.aspects.postdoc.status='confirmed_advisor';
 evidence(e,'postdoc','advisor',mentor,note,[url,bio],'postdoc');
 original(id,url,note);
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
