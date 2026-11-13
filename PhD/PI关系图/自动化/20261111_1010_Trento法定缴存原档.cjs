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
 orig.audit_id='pi_archive_20261111_1010_'+id;
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
 relations.push({event_id:'pi_archive_20261111_1010_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const id='e0fc6317', name='Luca Dal Negro', mentor='Lorenzo Pavesi';
const m='师承人物 - '+mentor;
const u='https://tesidottorato.depositolegale.it/handle/20.500.14242/257641';
const lab='https://nanolab.physics.unitn.it/people.html';
const bu='https://www.bu.edu/nano/people/';
const faculty='https://www.bu.edu/eng/profile/luca-dal-negro/';
const proof='意大利法定缴存目录的作者和论文题名对应本人。Università degli Studi di Trento 论文记录 URN:NBN:IT:UNITN-257641 的 Relatore, Supervisor, Advisor o Tutor 字段列 Lorenzo Pavesi。2004 是目录的发表年份，BU 本人课题组履历列 2003 年获学位。';
const link=source('意大利法定缴存论文原档',u);
const from=who(id,name), to=wiki(m,mentor);
const suffix='。'+proof+' '+link+' · '+source('BU 本人课题组',bu);
rewrite(pf(id),x=>x.startsWith('- 博士导师：'+to),()=>'- 博士导师：'+to+suffix);
rewrite(mf(m),x=>x.startsWith('- 博士生：'+from),()=>'- 博士生：'+from+suffix);
rewrite(index,x=>x.startsWith('- '+from+' → 博士导师：'+to),()=>'- '+from+' → 博士导师：'+to+suffix);
rewrite(pf(id),x=>x.startsWith('- 博士阶段组属补证：'),()=>'- 博士阶段组属补证：Trento 实验室将 Dal Negro 列为前博士生、Pavesi 列为负责人。 '+source('Trento 实验室成员原档',lab));
rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+'MIT EMAT 组属见 Yi 学位论文签署页及致谢。BU 同期校刊和本人署名论文作者履历核其 2003 年起在 MIT 材料系任博后，2006 年 1 月入 BU。Kimerling 的个人博士后导师职衔及精确任期待核。 '+source('2007 年作者履历','https://citeseerx.ist.psu.edu/document?doi=aa45376918d0924814566b19bdba200238c8f0fc&repid=rep1&type=pdf')+' · '+source('BU 工学院本校页',faculty));
school(id,'Lorenzo Pavesi（既有导师记录；本轮另证实验室博士生组属）','Lorenzo Pavesi（Trento 博士论文正式导师，法定缴存目录具名）');
rewrite(sl(id),x=>x.startsWith('| '+from),x=>x.replace('[既有论文目录]','[法定缴存论文目录]').replace('2004 论文目录年份和本人所列 2003 学位年份继续分列。','目录明列 2004 年发表，BU 本人组页列 2003 年获学位。').replace('Kimerling 继续列为博后指导候选。','Kimerling 的个人博后指导待核。').replace('继续保留 Kimerling 候选。','Kimerling 的 EMAT 组属见同期学位论文。'));
const a=audit(id,[
 ['phd',proof,[u,bu,lab],'confirmed_advisor']
],'继续追 MIT 2003–2005/06 EMAT 的任用原档或本人履历，核 Kimerling 的个人博士后指导职衔。');
relation(id,a,'phd',m,'advisor',proof,[u,bu,lab],'pavesi');
const pages=[{record_id:id,url:u,raw:'DC.title: Stimulated emission and photon diffusion in low dimensional silicon structures. citation_author: Luca, Dal Negro. Università degli Studi di Trento. URN:NBN:IT:UNITN-257641. Data di pubblicazione: 2004. Relatore, Supervisor, Advisor o Tutor: Lorenzo, Pavesi.',excerpt:'法定缴存目录正文和元数据核定 Trento 博士论文作者及具名导师，2004 是发表年份。'}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_1010_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_1010_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_1010_Trento法定缴存原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
