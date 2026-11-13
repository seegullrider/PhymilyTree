const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root = '..';
const notes = path.join(root,'人物');
const index = path.join(root,'师承关系索引.md');
const records = db.prepare('SELECT id,filename,unit FROM records WHERE id=?');
const last = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const updates = new Map(), audits = [], relations = [];
function line(file, match, suffix) {
 const text = updates.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = text.includes('\r\n') ? '\r\n' : '\n';
 const rows = text.split(/\r?\n/);
 const matches = rows.map((row,i) => match(row) ? i : -1).filter(i=>i>=0);
 if (matches.length !== 1) throw Error(file+' expected one line, found '+matches.length);
 const i = matches[0];
 if (!rows[i].includes(suffix)) rows[i] += suffix;
 updates.set(file, rows.join(newline));
}
function source(label,url) { return '['+label+']('+url+')'; }
function personLine(id,prefix,suffix) {
 const record = records.get(id);
 line(path.join(notes,record.filename+'.md'),x=>x.startsWith(prefix),suffix);
}
function schoolSource(id,suffix) {
 const record=records.get(id);
 const file=path.join(root,record.unit+'逐人复核记录.md');
 const contents=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=contents.includes('\r\n')?'\r\n':'\n';
 const rows=contents.split(/\r?\n/);
 const i=rows.findIndex(x=>x.startsWith('| [['+record.filename+'|'));
 if(i<0||!rows[i].endsWith(' |'))throw Error('missing school row '+id);
 if(!rows[i].includes(suffix))rows[i]=rows[i].slice(0,-2)+suffix+' |';
 updates.set(file,rows.join(newline));
}
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mf=name=>path.join(notes,name+'.md');
const sl=id=>path.join(root,records.get(id).unit+'逐人复核记录.md');
const wiki=(name,display)=>'[['+name+'|'+display+']]';
const who=(id,display)=>wiki(records.get(id).filename,display);
const get=file=>updates.get(file)??fs.readFileSync(file,'utf8');
const boundary='- 核查边界：';
function rewrite(file,test,fn) {
 const content=get(file);
 const nl=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const indexes=rows.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(indexes.length!==1)throw Error(file+' expected one matching row, found '+indexes.length);
 const i=indexes[0];
 rows[i]=fn(rows[i],nl);
 updates.set(file,rows.join(nl));
}
function school(id,oldField,newField) {
 const r=records.get(id);
 rewrite(sl(id),x=>x.startsWith('| [['+r.filename+'|'),x=>{
  if(x.includes(newField))return x;
  if(!x.includes(oldField))throw Error('missing school field '+id);
  return x.replace(oldField,newField);
 });
}
function insertAfter(file,prefix,entry){
 if(get(file).includes(entry))return;
 rewrite(file,x=>x===prefix,(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261111_0826_'+id;
 orig.followup_required=true;
 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261111_0826_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const id='bc7878ac', mentor='师承人物 - Marlan O. Scully';
const u={
 mit:'https://physics.mit.edu/faculty/patrick-lee/',
 paper:'https://journals.aps.org/prb/abstract/10.1103/PhysRevB.3.769',
 copy:'https://www.phy.cuhk.edu.hk/itp/v3/qi%26o/Sun_CP-Lecture2-1.pdf',
 nist:'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nbsspecialpublication343.pdf'
};
const proof='MIT 物理系列 Patrick A. Lee 为 1970 年博士。1970 年送审的 Josephson radiation 论文由 Lee 和 Marlan O. Scully 合署，出版者记录注明基于 Lee 学位论文。机构存档的同期 NBS 论文明确列两人姓名和 Yale／MIT／Arizona 单位。Scully 保留为博士导师候选，正式职衔待论文签署页。';
const links=[source('MIT 物理系',u.mit),source('APS 论文书目',u.paper),source('CUHK 托管论文首页',u.copy),source('NIST 会议原刊',u.nist)].join(' · ');
const target=wiki(mentor,'Marlan O. Scully');
const trainee=who(id,'Patrick A. Lee');
const label='博士导师候选';
const edge='- '+label+'：'+target+'。'+proof+' '+links;
insertAfter(pf(id),'## 师承',edge);
const reverse='- 博士阶段研究者候选（待核）：'+trainee+'。'+proof+' '+links;
insertAfter(mf(mentor),'## 师承',reverse);
const idx=path.join(root,'师承候选线索索引.md');
if(!get(idx).includes(trainee+' → '+label+'：'+target))updates.set(idx,get(idx).trimEnd()+'\n- '+trainee+' → '+label+'：'+target+'。'+proof+' '+links+'\n');
school(id,' | 待核 | 待核 | ',' | Marlan O. Scully（博士导师候选） | 待核 | ');
schoolSource(id,' · '+links);
const a=audit(id,[['phd',proof,Object.values(u),'group_or_candidate']],'找 MIT 1970 学位论文的正式题名、批准页或书目导师字段，继续核毕业后 Yale 与 Bell Labs 任用类别。');
relation(id,a,'phd',mentor,'candidate',proof,Object.values(u),'scully');
const pages=[
 {record_id:id,url:u.mit,raw:'MIT Physics confirms 1970 PhD and post-tenure physics professor, condensed matter theory and strongly correlated electrons.',excerpt:'核博士年份、院系和方向。'},
 {record_id:id,url:u.copy,raw:'The original journal front-page reproduction identifies Patrick A. Lee and Marlan O. Scully as coauthors and lists the manuscript received date of 4 May 1970.',excerpt:'论文署名和时序仅支持候选。'},
 {record_id:id,url:u.nist,raw:'NBS conference proceedings list Lee (Yale) and Scully (MIT and Arizona) on Noise in a Josephson Junction.',excerpt:'原论文确认合作和早期单位，未列导师。'},
 {record_id:id,url:u.paper,error:'Publisher direct open returned cache miss; the publisher index reports a thesis footnote. Paper front page reproduction and NIST proceedings reviewed.'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0826_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0826_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0826_PatrickLee论文线索原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
