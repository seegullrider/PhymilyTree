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
 orig.audit_id='pi_archive_20261111_0136_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0136_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"astar":"https://research.a-star.edu.sg/researcher/james-lourembam/","project":"https://cordis.europa.eu/project/id/891778","report":"https://cordis.europa.eu/project/id/891778/reporting","ntu":"https://dr.ntu.edu.sg/server/api/core/bitstreams/61b29f5d-3538-48ca-897b-3d693e73acc3/content","polyu":"https://pm.polyu.edu.hk/taowu/group/members.html","man":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10097601/","pin":"https://www.sutd.edu.sg/profile/ho-pin","ho":"https://ho-pin.weebly.com/about.html","teach":"https://research.nus.edu.sg/jingshengchen/teaching/","people":"https://research.nus.edu.sg/jingshengchen/staff-profiles-template/","cqt":"https://www.cqt.sg/highlight/2025-05-meet-johnson-goh/","goh":"https://www.cqt.sg/people/kuan-eng-johnson-goh/","cqreport":"https://citeseerx.ist.psu.edu/document?doi=cc980b3e1b3f262214d0682f4ab7631bf1de3607&repid=rep1&type=pdf","unsw":"https://unsworks.unsw.edu.au/"};
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




const james='569f0600', pin='db3c5103', goh='796c2c6d';
const jText='CORDIS 891778 原项目档列 2021 年 6 月 1 日启动、2022 年 12 月 21 日终止，页面另保留 2023 年 8 月 20 日计划结束日。任用精确起止仍需个人履历。Nature 致谢把项目号对应到 Lourembam，贡献栏仅指同篇论文的项目监督。三位既有个人博士后导师候选继续待任用或 fellowship 原件确认。';
const jSources=src(['CORDIS 项目时间原档','project'],['Nature 原刊','man']);
pl(james,boundary,jText+' '+jSources);
schoolWith(james,src(['CORDIS 项目原档','project'],['NTU 机构论文档','ntu']));
audit(james,[
 a('affiliation','A*STAR IMRE Senior Scientist，SpEED team PI。NTU 本科项目协同指导身份见原档；高校教职仍待核。',['astar'],'confirmed'),
 a('research','A*STAR 简介列面向存储及毫米波电子的量子材料，NTU 同期论文核锰氧化物薄膜研究。',['astar','ntu'],'confirmed'),
 a('phd','PolyU Tom Wu 实验室校友原档列 James Lourembam 为其博士阶段组员。NTU 机构原文确认博士期 NTU 物理与应用物理署名，Tom Wu 是当期论文通讯作者并署 KAUST。正式论文导师待查，维持组属。',['polyu','ntu','astar'],'group_or_candidate'),
 a('postdoc',jText,['project','man','astar'],'group_or_candidate')
],'从 NTU 论文原件或毕业生档追正式博士导师；从 Manchester fellowship 个人任用及院系研究员目录核后续指导。');
const pText='SUTD 本人档核 NUS 材料 2013 博士及 2016 入 A*STAR 前由 A*STAR International Fellowship 支持的 MIT Research Associate 经历。本人旧履历另明示 2013 年起在 Ross Research Group 任 Postdoctoral Associate。保留角色和称谓差异。NUS Chen 指导原页本轮重定向循环，博士关系仍按候选处理。';
pl(pin,boundary,pText+' '+src(['SUTD 本人档','pin'],['本人早期履历','ho']));
audit(pin,[
 a('affiliation','SUTD 原档称任 A*STAR IMRE Hybrid Spintronics 组负责人、Electronic Materials 副部门主管及 A*STAR 研究生事务主任。',['pin'],'confirmed'),
 a('research','SUTD 原档列纳米磁性、多铁性、自旋拓扑、存储与非传统计算。',['pin'],'confirmed'),
 a('postdoc',pText,['pin','ho'],'group_or_candidate')
],'保持 Jingsheng Chen 博士候选和 Caroline A. Ross 博后课题组负责人，继续核 NUS 学位论文及 MIT 具名指导任用。');
const gText='CQT 本人访谈明确称 UNSW 博士是随 Michelle Simmons 开展的，CQT 任职档列其为 CQT PI 及 A*STAR Senior Principal Scientist。2004–2008 年项目原报告将 Goh 和 Simmons 同列多篇硅中磷掺杂论文，未在报告内找到 Goh 的个人指导字段。UNSW 仓储在检索工具中受 robots 限制。博士阶段研究师长保留；正式学位论文原件待查。';
pl(goh,boundary,gText+' '+src(['CQT 访谈','cqt'],['项目原报告','cqreport']));
audit(goh,[
 a('affiliation','CQT Principal Investigator、A*STAR Senior Principal Scientist；其他已核任用见人物页。',['goh'],'confirmed'),
 a('phd',gText,['cqt','cqreport'],'group_or_candidate')
],'从 UNSW 图书馆书目、澳洲全国馆藏及学位册找论文题名与指导栏；保留 2006 入职／2007 授位先后及目前未见单列博士后经历。');
const pages=[
 [james,'project','European Commission CORDIS grant 891778 lists 2021-06-01 as the start date, 2023-08-20 as the planned end date, and termination on 2022-12-21. University of Manchester is the coordinator.','核项目有效时间，个人任期和指导另待任用档。'],
 [james,'ntu','NTU-hosted 2014 Physical Review B paper identifies James Lourembam as an NTU physics author and Tom Wu as a KAUST corresponding author.','同时期博士研究组线索，仍需学位原件。'],
 [pin,'pin','SUTD records a 2013 NUS materials science and engineering PhD and an MIT fellowship-supported research associate appointment before the 2016 A*STAR appointment.','核研究和任用时间，指导角色维持。'],
 [goh,'cqreport','The 2004–2008 quantum computer technology project report includes multiple silicon dopant publications by K. E. J. Goh and M. Y. Simmons. No adviser field was found in this report.','同期研究线索，正式导师待学位档。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:james,url:u.report,error:'Web cache miss on reporting tab; CORDIS fact sheet read. The individual supervisor remains unverified.'},{record_id:pin,url:u.teach,error:'NUS research group teaching page redirects in a loop on full page access. Candidate label preserved.'},{record_id:pin,url:u.people,error:'NUS group alumni page redirects in a loop on full page access.'},{record_id:goh,url:u.unsw,error:'Repository robots restriction in web tool; stopped requests to this host. Continue via Australian library or degree register.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0136_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0136_结构化回执.json';
if (relations.length) {
 persist(rf,relations);
 call('结构化师承关系.cjs',['record',rf]);
}
const receipt='20261111_0136_新加坡学位与博士后待查回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
