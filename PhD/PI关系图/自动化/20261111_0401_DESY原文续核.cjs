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
 orig.audit_id='pi_archive_20261111_0401_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0401_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"cf":"https://www.duffield.cornell.edu/people/andrej-singer/","cr":"https://cmrr.ucsd.edu/_files/research-review/2014-fa-rr.pdf","ds":"https://www-library.desy.de/diss13.html","s":"https://www-library.desy.de/preparch/desy/thesis/desy-thesis-13-023.pdf","l":"https://www-library.desy.de/preparch/desy/thesis/desy-thesis-01-045.pdf","dl":"https://www-library.desy.de/diss01.html","cl":"https://www.classe.cornell.edu/about/people/matthias-liepe","as":"https://as.cornell.edu/news/research-spotlight-matthias-liepe","old":"https://edocs.tib.eu/files/e01fb05/497829576.pdf"};
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




const s='9172baa3', l='de90bf8f';
const slinks=src(['Hamburg 2012 学位论文第 2、121 页','s'],['Cornell 院系履历','cf'],['DESY 论文目录','ds']);
const sp='Hamburg 物理博士论文第 121 页由本人明确称 Ivan A. Vartanyants 与 Edgar Weckert 为 advisors，并感谢两人的指导。第 2 页两人也列为论文评阅人，另列 I. McNulty 为评阅人。答辩日期为 2012-12-20，DESY 报告出版于 2013 年。两位导师均具名，原文未分主次。可信度高。';
for(const name of ['Edgar Weckert','Ivan A. Vartanyants']){
 const file='师承人物 - '+name;
 updateEdge(s,'Andrej Singer',file,name,'博士阶段研究师长','博士阶段受指导研究者','博士导师','博士生',sp,slinks);
}
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+'博士导师已由本人论文致谢确认。'+sp+' UC San Diego CMRR 同期活动具名 Shpyrko 为博士后导师。 '+slinks+' · '+src(['2014 CMRR 博后导师','cr']));
cell(s,2,'Edgar Weckert、Ivan A. Vartanyants（Hamburg 2012 博士导师）');
rewrite(sl(s),x=>x.startsWith('| [['+records.get(s).filename+'|'),x=>x.replace(' 论文正文暂不可读，博士指导分工待核。',''));
schoolWith(s,src(['Hamburg 博士论文导师及答辩','s']));
const sa=audit(s,[a('phd',sp,['s','ds','cf'],'confirmed_advisor')],'博士与博士后均有具名来源。后续随院系任职增量更新。');
audits[audits.length-1].followup_required=false;
relation(s,sa,'phd','师承人物 - Edgar Weckert','advisor',sp,ids('s','cf','ds'),'weckert');
relation(s,sa,'phd','师承人物 - Ivan A. Vartanyants','advisor',sp,ids('s','cf','ds'),'vartanyants');

const llinks=src(['Hamburg 2001 学位论文第 2、7 页','l'],['DESY 论文目录','dl'],['旧候选来源','old']);
const lp='Hamburg 2001 物理博士论文题名 Superconducting Multicell Cavities for Linear Colliders。第 7 页致谢明确称 Peter Schmüser 为 advisor and Doktorvater，第 2 页列为论文及答辩评阅人，答辩日期 2001-10-17。可信度高。';
const lpd='Cornell CLASSE 履历明确 2001–2006 Research Associate。本人访谈称博士毕业后回 Cornell Newman Lab。论文致谢所谢 Hasan Padamsee 和 Jens Knobloch 对应博士期间的访问，毕业后 Research Associate 任期是否属博士后及其个人指导者待核。';
updateEdge(l,'Matthias Liepe','师承人物 - Peter Schmüser','Peter Schmüser','博士导师候选','博士导师候选对象','博士导师','博士生',lp,llinks);
rewrite(pf(l),x=>x.startsWith('- Cornell 物理教授，'),()=>'- Cornell 物理教授，研究超导射频材料和加速器。本人访谈称获博士后返回 Cornell，CLASSE 履历列 2001–2006 Research Associate。 '+src(['本人访谈','as'],['CLASSE 任职档','cl']));
rewrite(pf(l),x=>x.startsWith(boundary),()=>boundary+lp+' '+lpd+' '+llinks+' · '+src(['Cornell CLASSE 履历','cl'],['本人访谈','as']));
cell(l,2,'Peter Schmüser（Hamburg 2001 博士导师）');
cell(l,3,'Cornell 2001–2006 Research Associate（博后性质与导师待核）');
schoolWith(l,llinks+' · '+src(['Cornell CLASSE 履历','cl']));
const la=audit(l,[
 a('identity','Hamburg 博士论文与 Cornell CLASSE 个人履历的姓名、阶段和研究方向相符。',['l','cl','as'],'confirmed'),
 a('affiliation','Cornell 物理教授及 CLASSE 超导射频组负责人。',['cl'],'confirmed'),
 a('research','射频超导材料、超导量子材料及加速器物理。',['cl','as'],'confirmed'),
 a('phd',lp,['l','dl'],'confirmed_advisor'),a('postdoc',lpd,['cl','as','l'],'unresolved')
],'追 Cornell 2001–2006 Research Associate 当期任用或项目档，核岗位性质和个人指导。');
relation(l,la,'phd','师承人物 - Peter Schmüser','advisor',lp,ids('l','dl','cl'),'schmueser');
const pages=[
 [s,'s','PDF pp. 2 and 121: 20 December 2012 defense; advisors Ivan Vartanyants and Edgar Weckert in the acknowledgments. SHA-256 73a989862d061f40677875bd0989a165248bbdc3f812848e99b32c55a6c28413.','DESY 目录旧 CGI 返回检索表单，按公开档案号找到原文。核博士导师及答辩日期。'],
 [l,'l','PDF pp. 2 and 7 visually checked: 17 October 2001 defense; Peter Schmüser named advisor and Doktorvater. SHA-256 b288523a4e40c17099005e6fd5c26d4b81687c24b0b1f4aad5147c1df65b9953.','原文前页视觉核论文评阅与致谢个人导师，旧网页失败回执保留。'],
 [l,'dl','DESY 2001 directory lists Matthias U. Liepe, Hamburg physics and report DESY-THESIS-2001-045.','核论文编号及身份。'],
 [l,'cl','CLASSE lists 2001 Hamburg PhD, Cornell Research Associate 2001–2006, then Cornell physics faculty and superconducting RF group leader.','核 Cornell 任职序列和方向。'],
 [l,'as','Liepe recalls a visit to Cornell as a PhD student and his return after completing his PhD.','区分博士期访问与毕业后任用。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0401_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0401_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0401_DESY学位原文回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
