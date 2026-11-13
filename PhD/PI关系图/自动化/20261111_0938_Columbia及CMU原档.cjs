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
 orig.audit_id='pi_archive_20261111_0938_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0938_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const w='b3ffd32f', m='b1363da8';
const a='https://www.apam.columbia.edu/faculty-staff/directory/wen-i-wang';
const q='https://www.sems.qmul.ac.uk/staff/wen.wang/';
const qg=q+'research/members/';
const c='https://mse.engineering.cmu.edu/directory/bios/skowronski-marek.html';
const cf='https://www.mse.engineering.cmu.edu/directory/bios/skowronski-marek.html';
const cc='https://coursecatalog.web.cmu.edu/schools-colleges/melloncollegeofscience/departmentofphysics/';
const qproof='QMUL 系页列 1993 Imperial College London 生物工程博士、Manchester 博后和血管力学研究。Columbia APAM 原档列 Cornell 电气工程博士、Rockwell／IBM 科研任用和半导体光电研究，已核为不同人员。';
const wz=audit(w,[['identity',qproof,[a,q,qg],'confirmed']],
 'Cornell 电子工程博士论文待学位原档；eCommons 主机退避按 SQLite。Rockwell／IBM 任职性质待同期履历。');
personLine(w,boundary,' '+qproof+' [QMUL 本人院系档]('+q+') · [QMUL 组员档]('+qg+')');
schoolSource(w,' · [QMUL 同名排除]('+q+')');
const p=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(w,qg);
if(!p)throw Error('缺少 Columbia Wen Wang 的 QMUL 组员网页记录');
const exclusions=[{page_id:p.id,url:qg,record_id:w,audit_id:wz,external_subject:'Wen Wang，Queen Mary University of London 生物工程与血管力学教授',evidence:qproof}];
personLine(m,boundary,' CMU 材料系现行原档的 Education 栏列 1982 年 Warsaw 固体物理博士，并分列 MIT 博后和后续 Cabot 工作。 [CMU 材料系现行档]('+c+')');
school(m,' | 待核 | 待核 | ',' | 1982 Warsaw 固体物理博士，导师待核 | MIT 博后，导师待核 | ');
schoolSource(m,' · [CMU 材料系现行档]('+c+')');
audit(m,[
 ['phd','CMU 材料系原档在 Education 栏列 Warsaw University 固体物理 1982 博士，导师待原始学位档。',[c],'unresolved'],
 ['postdoc','CMU 材料系原档明确 MIT 博士后以结谱研究化合物半导体，后续 Cabot 任用单列。具名指导待核。',[c],'unresolved']
],'按 Warsaw 1982 固体物理学位档检索论文，按 MIT 结谱研究与 Cabot 1986 起始追查博后任用。');
const pages=[
 {record_id:w,url:a,raw:'The Columbia APAM profile names Wen I. Wang, Cornell electrical engineering graduate degrees, Rockwell in 1981–1982, IBM in 1982–1987, and Columbia since 1987.',excerpt:'核 Cornell、Rockwell、IBM 及 Columbia 履历。'},
 {record_id:m,url:c,raw:'CMU MSE lists a 1982 PhD in Solid State Physics from Warsaw University, an MIT postdoctoral appointment in junction spectroscopy, and subsequent work at Cabot.',excerpt:'补 Warsaw 学位年份，分列 MIT 博后与 Cabot 任用。'},
 {record_id:m,url:cf,raw:'CMU MSE lists 1982 Warsaw University PhD, MIT postdoctoral appointment, then Cabot.',excerpt:'用 Education 栏补前次网页已读记录。'},
 {record_id:m,url:cc,error:'Failed to fetch '+cc+': (400) Timeout fetching'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0938_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0938_结构化回执.json';
if(relations.length)persist(rf,relations);
if(relations.length)call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0938_Columbia及CMU原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);

const xf='20261111_0938_ColumbiaWenWang同名排除.json';
persist(xf,exclusions);
call('人物网页身份纠偏.cjs',[xf]);
call('检索流程.cjs',['report']);
