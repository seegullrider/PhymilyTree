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
 orig.audit_id='pi_archive_20261110_2320_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2320_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"kro":"https://www.pas.rochester.edu/graduate/alumni-pages/alumni-1970-1979.html","kcv":"https://www.ee.psu.edu/directory/FacultyInfo/Khoo/Khoo%20CV%20with%20highlighted%20publications%209-5-2014.pdf","rgrp":"https://www.epfl.ch/labs/lns/page-31306-en-html/","rbr":"https://cmsfox.ewha.ac.kr/physics/board/seminar-coloquium.do?articleNo=608008&attachNo=356120&mode=download","rlbl":"https://foundry.lbl.gov/2019/12/18/elisa-riedo-nyu/","rAcad":"https://www.ae-info.org/ae/Member/Riedo_Elisa","mfr":"https://uni-freiburg.de/frias/prof-dr-suzanne-mohney/","mmrs":"https://www.cambridge.org/core/journals/mrs-online-proceedings-library-archive/article/abs/metallurgical-behavior-of-the-metalinp-systems-implications-for-the-design-of-contacts-to-inp/AF18D31714860A9977E2CD5D40E1F71C","mabs":"https://www.cambridge.org/core/services/aop-cambridge-core/content/view/D5D7031348B341FC777E3743C50419F0/S0883769400041890a.pdf/broad_content_spurs_new_collaborations_at_the_1992_mrs_spring_meeting.pdf","mch":"https://engineering.wisc.edu/news/materials-science-remembers-long-time-chair-y-austin-chang/"};
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
const [k,r,m]=['502fc97d','50734e6e','4f9e66dd'];
const kd='Rochester 物理系校友原表在 Iam Choon Khoo 的 1976 年学位条目列 Advisor Eberly, J.H.，论文是关于自发发射的源场探测和干涉效应。本人 Penn State CV 核 Rochester 1976 物理博士，Penn State EE 对应后来任职。可信度高。';
const kp='本人 Penn State CV 分列 Ames Laboratory 1976–1977 Postdoctoral Fellow、USC 1977–1978 Research Associate、Michigan 1978–1979 Research Associate with Emmitt Leith、Toronto 1979 Research Fellow。Ames 博后导师未具名，其余按履历原职称记录。';
const kl=src(['Rochester 物理系博士校友表','kro'],['本人 Penn State CV','kcv']);
pl(k,'- 博士导师：',kd+' '+kl);
pl(k,'- 博士后导师：',kp+' '+kl);
cell(k,2,'Joseph H. Eberly（Rochester 1976 物理博士导师）');
cell(k,3,'Ames Laboratory 1976–1977 Postdoctoral Fellow，导师待核；Michigan Research Associate 另列');
schoolWith(k,kl);
const ka=audit(k,[a('phd',kd,['kro','kcv'],'confirmed_advisor'),a('postdoc',kp,['kcv'])],'查 Ames 博后任命及指导；保持 USC、Michigan、Toronto 不同任职头衔。');
relation(k,ka,'phd','师承人物 - Joseph H. Eberly','advisor',kd,ids('kro','kcv'),'Eberly');

const rp='EPFL Laboratory of Nanostructures at Surfaces 名录列 Harald Brune 为组负责人，并列 Elisa Riedo 为前组员。LBL 原讲座确认 Riedo 在 EPFL 做博后，Academia Europaea 履历列 1999–2003，Brune 本人 CV 列 2000–2004 为 EPFL 副教授。组属可信度高，正式博后导师称谓及 1999 年入职与 2000 年授位的日期口径待核。';
const rl=src(['EPFL LNS 名录','rgrp'],['Brune 本人 CV','rbr'],['LBL 讲座履历','rlbl'],['Academia Europaea 履历','rAcad']);
updateEdge(r,'Elisa Riedo','师承人物 - Harald Brune','Harald Brune','博士后导师候选','博士后研究者候选','博士后课题组负责人','博士后课题组成员',rp,rl);
rewrite(pf(r),x=>x.startsWith(boundary),()=>boundary+'LBL 讲座原履历列 2000 年 Milano 物理博士，联合论文在 ESRF。博士导师待原论文。'+rp+' '+rl);
cell(r,3,'Harald Brune（EPFL 博后课题组负责人）；组属已核，正式指导称谓待核');
schoolWith(r,rl);
const ra=audit(r,[a('phd','LBL 原讲座核 2000 年 Milano 物理博士和 ESRF 联合论文，导师未具名。',['rlbl']),a('postdoc',rp,['rgrp','rbr','rlbl','rAcad'],'group_or_candidate')],'查 Milano–ESRF 论文签署页、EPFL 博后任用起算及正式个人指导。');
relation(r,ra,'postdoc','师承人物 - Harald Brune','group_leader',rp,ids('rgrp','rbr','rlbl','rAcad'),'Brune');

const md='Freiburg 原履历核 Mohney 1994 Wisconsin 材料科学博士。MRS 同期论文和会报显示 Mohney 与 UW–Madison Y. Austin Chang 同署、合作研究 Metal–In–P 相平衡及 InP 电接触。合著和课题吻合仅支持低可信博士导师候选，待论文签署页。';
const ml=src(['Freiburg 研究员履历','mfr'],['同期 MRS 论文','mmrs'],['同期 MRS 会报','mabs'],['UW–Madison Chang 档案','mch']);
const chang='师承人物 - Y. Austin Chang';
mentor(chang,'Y. Austin Chang','UW–Madison 材料科学与工程教授，研究冶金热力学。',src(['UW–Madison 原档','mch']));
edge(m,'Suzanne Mohney',chang,'Y. Austin Chang','博士导师候选','博士候选学生',md,ml);
pl(m,boundary,md+' '+ml);
cell(m,2,'Y. Austin Chang（低可信候选，待 1994 Wisconsin 博士论文）');
schoolWith(m,ml);
const ma=audit(m,[a('phd',md,['mfr','mmrs','mabs','mch'],'group_or_candidate'),a('research','材料界面反应、金属接触及二维半导体薄膜。',['mfr','mmrs'])],'以 Metal–In–P 相平衡与 InP 电接触为主题找 Wisconsin 1994 博士论文；核博士后阶段任用。');
relation(m,ma,'phd',chang,'candidate',md,ids('mfr','mmrs','mabs','mch'),'Chang');

const pages=[
 [k,'kro','Rochester 1976 alumni entry lists Khoo, Iam Choon, advisor Eberly, J.H., and thesis about source field detection and interference effects in spontaneous emission.',kd],
 [k,'kcv','CV lists Rochester PhD in Physics, 1976; Ames Laboratory Postdoctoral Fellow 1976–1977 and Michigan Research Associate with Emmitt Leith 1978–1979.',kp],
 [r,'rgrp','EPFL LNS roster lists Harald Brune as group head and Elisa Riedo in former members.',rp],
 [r,'rbr','Brune CV lists EPFL Lecturer 1998–2000 and Associate Professor 2000–2004.',rp],
 [r,'rAcad','Academia Europaea lists Elisa Riedo at EPFL as Post Doctoral Fellow, 1999–2003.',rp],
 [m,'mfr','Freiburg faculty biography lists Penn State appointments and PhD in Materials Science, University of Wisconsin, 1994.',md],
 [m,'mmrs','MRS paper authors Suzanne E. Mohney and Y. Austin Chang are listed at UW–Madison and report work on metal–In–P phase equilibria and InP contacts.',md],
 [m,'mabs','MRS meeting proceedings list Suzanne E. Mohney of UW–Madison for a presentation about metal–In–P phase equilibria and contacts to InP.',md],
 [m,'mch','UW–Madison institutional archive documents the MSE faculty role of Y. Austin Chang since 1980 and his work in metallurgical thermodynamics.',md],
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2320_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2320_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2320_网页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
