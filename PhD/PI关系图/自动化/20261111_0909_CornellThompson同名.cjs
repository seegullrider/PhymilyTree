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
 orig.audit_id='pi_archive_20261111_0909_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0909_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const id='a8809d7f';
const cu='https://www.engineering.cornell.edu/faculty-directory/michael-thompson';
const cin='https://www.business.uc.edu/faculty-research/obais/faculty/michael-thompson.html';
const unt='https://research.unt.edu/aeri/people/michael-thompson.html';
const rootNote='Cornell 工程学院本人档明确 Caltech 1979 本科、Cornell 1982 硕士和 1984 博士，现任材料科学与工程系教授，关联应用物理研究生方向。全名 Michael Olgar Thompson。Cincinnati 商学院与 UNT 哲学的同名页已按学历和研究轨迹核实为他人。';
const next='从 Cornell 图书目录及学位原卷找 1984 Applied and Engineering Physics 博士论文签署页，另查获得学位后至首任教职的履历。';
const ev=audit(id,[
 ['identity',rootNote,[cu,cin,unt],'confirmed'],
 ['affiliation','Cornell 材料科学与工程系 Dwight C. Baum Professor of Engineering，关联应用物理研究生方向。',[cu],'confirmed'],
 ['research','半导体激光瞬态热处理、快速相变、掺杂剂亚稳态激活。',[cu],'confirmed'],
 ['phd','Cornell 1984 博士、方向为 Applied and Engineering Physics，校方本人档未列导师。',[cu],'unresolved']
],next);
rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+rootNote+' '+next+' '+source('Cornell 工程学院本人档',cu));
const exclusions=[
 {page_id:'d8799c9a909284ec61ed8f77',url:cin,record_id:id,audit_id:ev,external_subject:'Michael Thompson，Cincinnati 商学院运营与商业分析兼职讲师',evidence:'本人档列 MIT 博士、Cincinnati 商学院任用；与 Cornell 1984 应用工程物理博士及半导体激光加工材料系教授轨迹不同。'},
 {page_id:'6e9d35c88a832f7ff276375c',url:unt,record_id:id,audit_id:ev,external_subject:'Michael Thompson，University of North Texas 哲学研究者',evidence:'UNT 档列 2009 University of South Florida 哲学博士和 Kant 研究；与 Cornell 1984 应用工程物理博士及半导体材料教授轨迹不同。'}
];
const pages=[{record_id:id,url:cu,raw:'Cornell Engineering lists Thompson’s Caltech BS in 1979, Cornell MS in 1982 and PhD in 1984; the biography specifies applied and engineering physics and the profile names materials science and semiconductor research.',excerpt:'核身份、学位和现任，排除两页库外同名。'}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0909_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0909_结构化回执.json';
if(relations.length)persist(rf,relations);
if(relations.length)call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0909_CornellThompson任用原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);

const xf='20261111_0909_CornellThompson同名排除.json';
persist(xf,exclusions);
call('人物网页身份纠偏.cjs',[xf]);
call('检索流程.cjs',['report']);
