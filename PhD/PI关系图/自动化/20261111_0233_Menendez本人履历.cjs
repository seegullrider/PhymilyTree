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
 orig.audit_id='pi_archive_20261111_0233_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0233_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"cv":"https://www.yumpu.com/en/document/view/15671497/cv-jose-menendez-department-of-physics-and-astronomy-","official":"https://search.asu.edu/profile/25775/cv","nas":"https://www.nasonline.org/wp-content/uploads/2024/06/cardona-manuel.pdf","mpi":"https://www.fkf.mpg.de/5098831/20_Kondolenzbuch","guha":"https://guhas.mufaculty.umsystem.edu/team/pi-suchi-guha"};
const src=(...xs)=>xs.map(([label,key])=>source(label,u[key])).join(' · ');
const pl=(id,prefix,evidence)=>personLine(id,prefix,' '+evidence);
const schoolWith=(id,evidence)=>schoolSource(id,' · '+evidence);
const a=(key,note,sources,status)=>[key,note,sources.map(k=>u[k]),status];
function cell(id,n,value){
 const prefix='| [['+records.get(id).filename+'|';
 rewrite(sl(id),x=>x.startsWith(prefix),x=>{
  const end=x.indexOf(']]'), cells=x.slice(end+2).split(' | ');
  if(end<0||cells.length<4)throw Error('missing school cells '+id);
  cells[n]=value;
  return x.slice(0,end+2)+cells.join(' | ');
 });
}
function mentor(file,name,desc,links){
 if(fs.existsSync(mf(file)))return;
 updates.set(mf(file),['# '+name,'','- 类型：师承扩展人物','- '+desc+' '+links,'','## 师承',''].join('\n'));
}
function edge(id,name,mFile,mName,fLabel,bLabel,note,links){
 if(!links)throw Error('edge requires sources '+id);
 const from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 insertAfter(pf(id),'## 师承','\n- '+fLabel+'：'+to+after);
 insertAfter(mf(mFile),'## 师承','\n- '+bLabel+'：'+from+after);
 insertAfter(index,'# 师承关系与候选线索索引','\n- '+from+' → '+fLabel+'：'+to+after);
}
function updateEdge(id,name,mFile,mName,oldForward,oldBack,newForward,newBack,note,links){
 const rec=records.get(id),from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 rewrite(pf(id),x=>x.startsWith('- '+oldForward+'：')&&x.includes(mFile),()=>'- '+newForward+'：'+to+after);
 rewrite(mf(mFile),x=>x.startsWith('- '+oldBack+'：')&&x.includes(rec.filename),()=>'- '+newBack+'：'+from+after);
 rewrite(index,x=>x.startsWith('- '+from+' → '+oldForward+'：')&&x.includes(mFile),()=>'- '+from+' → '+newForward+'：'+to+after);
}
function unit(id,name,label,detail,links){
 const schoolName=records.get(id).unit, node='已核实单位 - '+schoolName+' - '+label;
 const file=path.join(root,'已核实院系',node+'.md');
 const line='- '+who(id,name)+' — '+detail+' '+links;
 const header='[[院校 - '+schoolName+'|返回学校]]';
 if(!fs.existsSync(file)&&!updates.has(file))updates.set(file,['# '+schoolName+'：'+label,'',header,'','## 已核实人物','',line,''].join('\n'));
 else if(!get(file).includes(records.get(id).filename)){
  const contents=get(file), nl=contents.includes('\r\n')?'\r\n':'\n';
  updates.set(file,contents.trimEnd()+nl+line+nl);
 }
 rewrite(pf(id),x=>x.startsWith('- 院系／机构：'),x=>x.includes(node)?x:x.replace(/。$/,'')+' · '+wiki(node,label)+'。');
}




const ids=(...keys)=>keys.map(k=>u[k]);




const id='2bf43d5e', name='José Menéndez', mentorFile='师承人物 - Manuel Cardona';
const evidence='本人 CV 首页在 Universität Stuttgart 1985 物理 Dr. rer. nat. 项下列 Raman 论文及 “Advisor: Prof. Dr. Dr. h.c. Manuel Cardona i Castro”。1980 Instituto Balseiro Licenciado 的 Advisor Raúl Baragiola 是另一学位。可信度高。';
const links=src(['本人 CV 可读副本','cv'],['ASU CV 原址','official'],['美国国家科学院纪念传记','nas']);
updateEdge(id,name,mentorFile,'Manuel Cardona i Castro','博士导师','博士生','博士导师','博士生',evidence,links);
rewrite(pf(id),x=>x.startsWith('- 补充证据：'),()=>'- 补充证据：Menéndez 在 Stuttgart 的研究经历见其 MPI 署名回忆。其博士生 Suchi Guha 保存的师承链亦列 Cardona。 '+src(['本人回忆','mpi'],['Guha 师承链','guha']));
rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+'本人 CV 将 1985–1987 AT&T Bell Laboratories 任用列为 Postdoctoral Member of Technical Staff，尚待具名指导。MPI 纪念册中其他署名段落的 Brown 博士和 MPI 博后经历属于其他作者。ASU 原址仍按主机退避，已核读同一作者早期 CV 的公开副本。 '+src(['本人 CV 可读副本','cv'],['本人 MPI 署名段','mpi']));
cell(id,2,'Manuel Cardona i Castro（Stuttgart 1985 博士；本人 CV 明示 Advisor）');
rewrite(sl(id),x=>x.startsWith('| [['+records.get(id).filename+'|'),x=>{
 const i=x.lastIndexOf(' | ',x.length-3);
 if(i<0)throw Error('missing school sources');
 return x.slice(0,i+3)+links+' · '+src(['本人 MPI 署名段','mpi'],['Guha 师承链','guha'])+' |';
});
const event=audit(id,[
 a('identity','本人 CV、MPI 署名回忆和学生师承链的姓名、单位及 Stuttgart 半导体物理研究一致。',['cv','mpi','guha'],'confirmed'),
 a('phd',evidence,['cv','official','mpi','nas'],'confirmed_advisor'),
 a('postdoc','本人 CV 首页列 AT&T Bell Laboratories 1985–1987 Postdoctoral Member of Technical Staff，未具名指导者。',['cv'])
],'追查 Bell Laboratories 1985–1987 博士后任用的具体研究指导者。');
relation(id,event,'phd',mentorFile,'advisor',evidence,ids('cv','official','mpi','nas'),'cardona');
const pages=[{record_id:id,url:u.cv,raw:'Education: Dr. rer. nat., Universität Stuttgart, 1985, Physics; thesis on phonon–phonon and electron–phonon interactions in tetrahedral semiconductors. Advisor: Prof. Dr. Dr. h.c. Manuel Cardona i Castro. AT&T Bell Laboratories Postdoctoral Member of Technical Staff, 1985–1987.',excerpt:'浏览器核读本人 CV 首页。1980 Instituto Balseiro 学位及其导师另列。'}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0233_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0233_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0233_Menendez本人履历回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
