
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_Wasserman履历原档';
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
 event.audit_id = 'pi_archive_20261111_wasserman_' + id;
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
 const id='67ee8048',p=record.get(id),file=fileFor(p.filename);
 const person='[['+p.filename+'|'+p.name+']]';
 const cv='https://utdirect.utexas.edu/apps/student/coursedocs/nlogon/download/11305868/';
 const mrc='https://www.mrc.utexas.edu/sites/default/files/cv/DW_CV_2019.pdf';
 const ece='https://ece.utexas.edu/people/faculty/daniel-wasserman';
 const interview='https://www.edn.com/interview-with-dr-daniel-wasserman/';
 const title='Quantum Dots: Mid-Infrared Luminescence, (110) Growth, Single-Dot Luminescence and Cleaved Edge Overgrowth';
 const phd='两份本人履历列 Princeton 2004 电气工程博士及论文《'+title+'》。本人访谈确认博士期间在 Lyon 指导下研究 InAs 自组装量子点，学位签署角色仍待核。';
 const post='本人 CV 第 1 页列 Princeton Post-Doctoral Research Fellow 2004–2007。UT Austin ECE 教师档核 Princeton 的 Gmachl 组和量子级联激光研究，访谈中本人具名 Gmachl 为 post-doc advisor。';
 const refs=link('本人 CV 第 1 页',cv+'#page=1')+' · '+link('UT Austin ECE 教师档',ece);
 const ly='人员 - Princeton - Stephen A. Lyon - 60b542fc';
 const gm='人员 - Princeton - Claire Gmachl - 4d64afd6';
 const identity='UT Austin ECE 原档和两份 CV 对应 Brown 1998、本科工程物理及历史，Princeton 2004 电气博士，随后 Princeton 博后与 UMass Lowell、UIUC、UT Austin 任教。';
 append(file,starts('博士阶段研究师长',ly),phd+' '+refs);
 append(file,starts('博士后导师',gm),post+' '+refs);
 append(file,starts('核查边界'),'已补本人履历所载博士论文题名和 Princeton 2004–2007 博后任期。 '+refs);
 append(fileFor(ly),starts('博士阶段研究者',p.filename),phd+' '+refs);
 append(fileFor(gm),starts('博士后研究者',p.filename),post+' '+refs);
 append(index,line=>line.startsWith('- '+person+' → 博士阶段研究师长：')&&line.includes(ly),phd+' '+refs);
 append(index,line=>line.startsWith('- '+person+' → 博士后导师：')&&line.includes(gm),post+' '+refs);
 school(p,line=>line.replace('Claire Gmachl（[本人访谈]','Claire Gmachl（Princeton 2004–2007 博后导师，[本人访谈]'),refs);
 review(id,[
  ['identity',identity,[cv,mrc,ece]],
  ['phd',phd,[cv,mrc,interview]],
  ['postdoc',post,[cv,ece,interview]],
  ['affiliation','UT Austin ECE 原档列电气与计算机工程系教授及冠名职衔。',[ece]],
  ['research','UT Austin ECE 原档列半导体激光、光子器件及 Mid-IR Photonics Lab。',[ece,interview]]
 ],'按本人 CV 列出的题名找 Princeton 博士学位原卷或签署页。');
 original(id,cv,'本人 CV 第 1 页列 2004 Princeton Electrical Engineering PhD 和完整博士论文题名，并列 2004–2007 Princeton Post-Doctoral Research Fellow。');
 original(id,mrc,'Microelectronics Research Center 托管的另一版本人 CV 列相同论文题名和 2004 年学位。');
 original(id,ece,'UT Austin ECE 原档列教授及冠名职衔，Princeton Gmachl 组博后和量子级联激光研究，并列 Mid-IR Photonics Lab。');
 original(id,interview,'本人访谈前段说明博士期与 Lyon 做 InAs 量子点，后段明确用 post-doc advisor 称 Claire Gmachl。');
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
