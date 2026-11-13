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
 orig.audit_id='pi_archive_20261111_0841_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0841_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const id='e4c23232',mentor='师承人物 - Sheldon Schultz';
const u={
 self:'https://people.ee.duke.edu/~drsmith/metamaterials/metamaterials_history.htm',
 bio:'https://people.ee.duke.edu/~drsmith/bio',
 duke:'https://pratt.duke.edu/people/david-smith/',
 ucsd:'https://today.ucsd.edu/story/in_memoriam_sheldon_schultz_1933_2017'
};
const whoLink=who(id,'David R. Smith'),mentorLink=wiki(mentor,'Sheldon Schultz');
const src=[source('本人 Duke 组回忆',u.self),source('本人学术履历',u.bio)].join(' · ');
const doctoral='本人在 Duke 组回忆中写 1994 年在 Sheldon Schultz 组完成 UC San Diego 物理博士，研究微波在光子晶体中的散射。确认博士课题组负责人；正式论文导师称谓待签署页。';
const post='本人 Duke 回忆直接称 Sheldon（Shelly）Schultz 为自己的 postdoc advisor，并叙述 1997 年已在该组做第三年博士后。UCSD 原纪念文独立确认博士后任用与同人。';
const oldForward='博士后课题组负责人：';
rewrite(pf(id),x=>x.startsWith('- '+oldForward+mentorLink),x=>x.replace(oldForward,'博士后导师：')+' '+post+' '+src);
insertAfter(pf(id),'## 师承','- 博士课题组负责人：'+mentorLink+'。'+doctoral+' '+src);
rewrite(pf(id),x=>x.startsWith(boundary),x=>'- 核查边界：博士组属和正式博后指导均有本人一手证据。博士论文原卷和正式导师栏仍待核。Rochester 1962 年 David Young Smith 与 1994 年 UC San Diego 博士 David R. Smith 为不同人。'+src);
rewrite(mf(mentor),x=>x.startsWith('- 博士后课题组成员：'+whoLink),x=>x.replace('博士后课题组成员：','博士后研究者：')+' '+post+' '+src);
insertAfter(mf(mentor),'## 师承','- 博士课题组成员：'+whoLink+'。'+doctoral+' '+src);
rewrite(index,x=>x.startsWith('- '+whoLink+' → '+oldForward+mentorLink),(x,nl)=>x.replace(oldForward,'博士后导师：')+' '+post+' '+src+nl+'- '+whoLink+' → 博士课题组负责人：'+mentorLink+'。'+doctoral+' '+src);
school(id,' | 待核 | Sheldon Schultz（博士后课题组） | ',' | Sheldon Schultz（博士课题组负责人） | Sheldon Schultz（博士后导师） | ');
schoolSource(id,' · '+src);
const a=audit(id,[
 ['identity','本人 Duke 学术履历核 1994 UCSD 物理博士和 Duke 任职；与 Rochester 1962 年 David Young Smith 不同。',[u.bio,u.duke],'confirmed'],
 ['affiliation','Duke Pratt 列 ECE 和 Physics 相关任职，本人履历列 Duke 讲席与超材料中心。',[u.duke,u.bio],'confirmed'],
 ['research','电磁超材料、光子晶体、等离激元与光和材料相互作用。',[u.duke,u.self],'confirmed'],
 ['phd',doctoral,[u.self,u.bio],'group_or_candidate'],
 ['postdoc',post,[u.self,u.ucsd],'confirmed_advisor']
],'继续查 1994 UCSD 博士论文原卷签署页与博士后准确起止。');
relation(id,a,'phd',mentor,'group_leader',doctoral,[u.self,u.bio],'schultz_phd');
relation(id,a,'postdoc',mentor,'advisor',post,[u.self,u.ucsd],'schultz_pd');
const pages=[
 {record_id:id,url:u.self,raw:'David R. Smith’s first-person Duke group history says he completed his 1994 UCSD physics PhD in Sheldon Schultz’s group, and explicitly calls Shelly his postdoc advisor.',excerpt:'分别确认博士组属和个人博士后导师。'},
 {record_id:id,url:u.bio,raw:'The Duke group biography identifies David R. Smith, Duke professor, and a 1994 UC San Diego doctorate in physics.',excerpt:'独立核对身份及学位年份。'},
 {record_id:id,url:u.duke,raw:'Duke Pratt faculty page identifies ECE/Physics and publications in photonic structures and metamaterials.',excerpt:'现任院系及研究方向交叉核对。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0841_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0841_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0841_DukeSmith本人原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
