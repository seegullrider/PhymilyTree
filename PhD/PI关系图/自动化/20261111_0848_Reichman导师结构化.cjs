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
 orig.audit_id='pi_archive_20261111_0848_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0848_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const id='38d42d59',doctoralMentor='师承人物 - Robert Silbey',postMentor='师承人物 - Gregory A. Voth';
const u={
 self:'https://reichmangroup.chem.columbia.edu/directory/david-r-reichman',
 students:'https://web.mit.edu/robertsilbey/students/students.html',
 yale:'https://chem.yale.edu/events/2025-10-21-anomalous-low-temperature-behavior-of-glasses',
 voth:'https://voices.uchicago.edu/vothgroup/pastmembers/'
};
const p=who(id,'David R. Reichman');
const proof='MIT 的 Silbey 组学生档直接列 David Reichman、1991–1996 组内时间及 Columbia 化学教授去向。本人履历记 MIT 化学博士 1997，明确由 Silbey 指导。';
const post='Columbia 本人组页明确列 1997–1999 Utah NIH Postdoctoral Fellow 由 Greg Voth 指导，Yale 讲座原档复核。';
const src=source('MIT Silbey 学生档',u.students);
personLine(id,'- 博士导师：',' '+proof+' '+src);
line(mf(doctoralMentor),x=>x.startsWith('- 博士生：'+p),' '+proof+' '+src);
line(index,x=>x.startsWith('- '+p+' → 博士导师：'),' '+proof+' '+src);
schoolSource(id,' · '+src);
const a=audit(id,[
 ['identity','Columbia 本人页、Yale 原讲座与 MIT Silbey 学生表的 Columbia Chemistry 去向相符。',[u.self,u.students,u.yale],'confirmed'],
 ['affiliation','Columbia Chemistry Centennial Professor。',[u.self,u.yale],'confirmed'],
 ['phd',proof,[u.self,u.students,u.yale],'confirmed_advisor'],
 ['postdoc',post,[u.self,u.yale],'confirmed_advisor']
],'继续找 MIT 学位签署页和 Utah 当期任用文件；博士与博士后导师已分别具名。');
relation(id,a,'phd',doctoralMentor,'advisor',proof,[u.self,u.students,u.yale],'silbey');
relation(id,a,'postdoc',postMentor,'advisor',post,[u.self,u.yale],'voth');
const pages=[
 {record_id:id,url:u.students,raw:'MIT Robert J. Silbey student list records David Reichman, 1991–1996, later Professor of Chemistry at Columbia University.',excerpt:'MIT 导师组学生名录补身份与指导。'},
 {record_id:id,url:u.self,raw:'Columbia’s faculty group bio states MIT chemistry PhD in 1997 under Robert Silbey and a 1997–1999 NIH Postdoctoral Fellowship at Utah under Greg Voth.',excerpt:'分别核博士及博士后指导。'},
 {record_id:id,url:u.voth,error:'Voth group alumni page returned HTTP 502; independent Columbia faculty original biography was available.'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0848_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0848_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0848_Reichman原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
