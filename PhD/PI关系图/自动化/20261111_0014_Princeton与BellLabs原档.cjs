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
 orig.audit_id='pi_archive_20261111_0014_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0014_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"st":"https://sethna.lassp.cornell.edu/pubPDF/SethnaPhD.pdf","cv":"https://sethna.lassp.cornell.edu/people/james_p_sethna","cp":"https://physics.cornell.edu/james-sethna","ha":"https://sethna.lassp.cornell.edu/pubPDF/HaydenPhD.pdf","ki":"https://www.kicnano.cornell.edu/people","ma":"https://sites.lsa.umich.edu/xiaoming-mao/members/","ro":"https://physics.gatech.edu/user/2100","ka":"https://www.kavliprize.org/eva-andrei-autobiography","or":"https://ethw.org/Oral-History:Eva_Andrei","ap":"https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.42.795","ru":"https://physics.sas.rutgers.edu/people/faculty-list/faculty-profile/andrei-eva-y","rk":"https://www.rutgers.edu/news/physicist-eva-andrei-becomes-first-rutgers-professor-earn-kavli-prize-one-highest-honors","rg":"https://www.physics.rutgers.edu/dept/history/robbins/app3.pdf","pt":"https://physicstoday.aip.org/obituaries/charles-c-grimes"};
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


const [s,r,e]=['d77716a7','2813baec','c98ce319'];
const sethna='James Sethna（荣休）', rock='D. Zeb Rocklin', eva='Eva Y. Andrei';
const and='师承人物 - Philip W. Anderson', sethnaFile=records.get(s).filename;
const phdE='1981 Princeton 博士论文总致谢明确称 Phil Anderson 为本人 advisor，系内 P. W. Anderson 为同一人。关系类型可信度高。';
const phdL=src(['Sethna 本人博士论文，总致谢','st'],['Cornell 物理系','cp']);
updateEdge(s,sethna,and,'Philip W. Anderson','博士阶段研究师长','博士阶段受指导者','博士导师','博士生',phdE,phdL);
rewrite(pf(s),x=>x.startsWith('- Cornell 理论凝聚态物理荣休教授；'),()=>'- Cornell 物理系荣休教授，理论凝聚态、统计物理与生物物理。 '+src(['Cornell 物理系','cp']));
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+'本人 Princeton 博士论文明确列 Philip W. Anderson 为指导者。本人履历分列 UCSB ITP 1981–1982、Cornell 1982–1983、UCSB ITP 1983–1984；院系简历将两所均概列为 1981–1984。保留本人分段记载与两处指导人待查。 '+src(['本人履历','cv'],['Cornell 物理系','cp']));
cell(s,2,'Philip W. Anderson（1981 Princeton 博士导师，论文致谢明示）');
cell(s,3,'UCSB ITP 1981–1982 与 1983–1984、Cornell 1982–1983，个人指导待核');
schoolWith(s,phdL+' · '+src(['本人履历','cv']));
const sa=audit(s,[
 a('affiliation','Cornell 物理系 James Gilbert White 荣休教授。',['cp'],'confirmed'),
 a('research','理论凝聚态、统计物理、玻璃与无序，以及生物物理。',['cp','cv'],'confirmed'),
 a('phd',phdE,['st','cp'],'confirmed_advisor'),
 a('postdoc','本人履历具体分列 UCSB ITP 1981–1982、Cornell 1982–1983、UCSB ITP 1983–1984。院系将两处概列为 1981–1984，指导人待核。',['cv','cp'],'unresolved')
],'查 Cornell LASSP 及 UCSB ITP 分段原档、项目报告和本人回忆以识别各阶段指导。');
relation(s,sa,'phd',and,'advisor',phdE,ids('st','cp'),'anderson');

const rockE='Cornell 博士生 Lorien Hayden 的论文致谢先具名博士导师 Jim Sethna，随后明确将 D. Zeb Rocklin 列为本组成员；Cornell KIC 独立列其 2016 博士后。可信度高（课题组）。';
const rockL=src(['Hayden 博士论文，致谢','ha'],['Cornell KIC','ki']);
edge(r,rock,sethnaFile,'James Sethna','博士后课题组负责人','博士后课题组成员',rockE,rockL);
rewrite(pf(r),x=>x.startsWith('- Cornell 阶段：'),()=>'- Cornell 阶段：Bethe／KIC 博士后与 Sethna 课题组归属分别有档案。个人正式指导及任期终点待核。 '+rockL);
rewrite(pf(r),x=>x.startsWith(boundary),()=>boundary+'Georgia Tech 列 Illinois 2013 物理博士。Goldbart 组页面不可达，论文签署页待核。Michigan Mao 与 Cornell Sethna 的博士后组属分别可核，具体个人指导待查。 '+src(['Georgia Tech 物理系','ro'],['Michigan 原组页','ma'],['Cornell 论文致谢','ha']));
cell(r,3,'Xiaoming Mao（Michigan 2013–2016 博后组负责人）；James Sethna（Cornell 博后组负责人）');
schoolWith(r,rockL);
const ra=audit(r,[a('postdoc',rockE+' Michigan 2013–2016 Mao 博士后组关系保留。',['ha','ki','ma'],'group_or_candidate')],'定位本人 Illinois 论文签署页，并追 Cornell 与 Michigan 个人正式指导的原档。');
relation(r,ra,'postdoc',sethnaFile,'group_leader',rockE,ids('ha','ki'),'sethna');

const gr='师承人物 - C. C. Grimes', wi='师承人物 - Francis Williams';
const bellE='Andrei 在第一人口述明确说到听过液氦表面电子结晶报告，随后在报告人的 Bell Labs 组做博士后。本人 Kavli 自传具名同一场报告人 Mike Grimes，APS 原论文确认其署名 C. C. Grimes 及 Bell Labs。证据支持组属，个人正式指导待查。';
const bellL=src(['Andrei 本人口述史','or'],['Kavli 本人自传','ka'],['Bell Labs APS 原论文','ap']);
mentor(gr,'C. C. Grimes','Bell Laboratories 低温凝聚态实验研究者，Andrei 自传称 Mike Grimes。',src(['APS 原论文','ap'],['Kavli 自传','ka']));
mentor(wi,'Francis Williams','Andrei 自传称 Francis “Tito” Williams，主持 Saclay 二维电子研究组。',src(['Kavli 自传','ka']));
edge(e,eva,gr,'C. C. Grimes','博士后课题组负责人','博士后课题组成员',bellE,bellL);
edge(e,eva,wi,'Francis Williams','访问科学家阶段课题组负责人','访问科学家阶段课题组成员','本人自传明确说赴 Francis Williams 的 Saclay 组任 visiting scientist。关系类型可信度高（访问岗位组属）。',src(['Kavli 自传','ka']));
rewrite(pf(e),x=>x.startsWith(boundary),()=>boundary+'Rutgers 学位名录为 1981 年，另份校新闻称 1982，分歧保留。Bell Labs 为博士后，口述史与自传共同核出 Grimes 组。Saclay 自传明确称访问科学家并具名 Williams，与旧简介的岗位归类不同，按第一人称原职衔分列。 '+src(['Rutgers 学位名录','rg'],['Andrei 口述','or'],['Andrei 自传','ka']));
cell(e,3,'C. C. Grimes（Bell Labs 博后课题组负责人）；Francis Williams（Saclay 访问科学家阶段组负责人）');
schoolWith(e,bellL);
const ea=audit(e,[
 a('postdoc',bellE+' Saclay 的 Williams 组按本人所述 visiting scientist 另记。',['or','ka','ap'],'group_or_candidate')
],'追 Bell Labs 个人正式指导与两段的精确聘期，保留 Rutgers 博士授位年份差异。');
relation(e,ea,'postdoc',gr,'group_leader',bellE,ids('or','ka','ap'),'grimes');

const pages=[
 [s,'st','Final acknowledgements explicitly identify Phil Anderson as Sethna’s advisor and describe his influence on the Princeton dissertation.','1981 年论文总致谢确认博士导师。'],
 [s,'cv','Sethna CV splits Cornell 1982–1983 from UCSB 1981–1982 and 1983–1984.','本人分列博士后任期，指导人待查。'],
 [s,'cp','Cornell Department of Physics lists emeritus role and research in theoretical condensed matter and biophysics.','核现职、学位与方向。'],
 [r,'ha','Hayden acknowledges advisor Jim Sethna and separately lists D. Zeb Rocklin among her research group.','确认 Cornell 博后阶段组属。'],
 [r,'ki','KIC roster lists David Zeb Rocklin as a former KIC postdoctoral fellow in 2016.','与论文致谢交叉核组属阶段。'],
 [e,'ka','Andrei autobiography names Mike Grimes as the colloquium speaker and Francis Williams as the leader of her group in Saclay while she was a visiting scientist.','核身份与访问岗位原职衔。'],
 [e,'or','Andrei says she did a Bell Labs postdoc in the group of the scientist who gave the seminar on electron crystallization on helium.','与自传具名报告人交叉核对。'],
 [e,'ap','1979 APS article identifies C. C. Grimes at Bell Laboratories and describes crystallization of electrons on liquid helium.','核署名、单位及研究身份。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:e,url:u.pt,error:'Cache miss for Physics Today obituary; group relationship established from independent first-person and APS sources'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0014_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0014_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0014_Princeton与BellLabs原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
