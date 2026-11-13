const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root='..', people=path.join(root,'人物'), idx=path.join(root,'师承关系索引.md');
const records=db.prepare('select id,name,unit,filename from records where id=?');
const latest=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1');
const graph=new Map(), audits=[], typed=[];
const local=id=>records.get(id).filename;
const fn=filename=>path.join(people,filename+'.md');
const web=(label,url)=>'['+label+']('+url+')';
function editLine(file,test,edit){
 const content=graph.get(file)??fs.readFileSync(file,'utf8');
 const end=content.includes('\r\n')?'\r\n':'\n';
 const lines=content.split(/\r?\n/);
 const matches=lines.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected 1 match, got '+matches.length);
 const i=matches[0];lines[i]=edit(lines[i]);
 graph.set(file,lines.join(end));
}
function note(id,prefix,text){editLine(fn(local(id)),line=>line.startsWith(prefix),line=>line+' '+text);}
function row(id,text,postdoc=null){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';return cells.join(' | ');
 });
}
function mentorLine(mentor,id,prefix,text){
 const f=fn(mentor), r=records.get(id);
 editLine(f,line=>line.startsWith(prefix)&&line.includes('[['+r.filename+'|'),l=>l+' '+text);
}
function indexLine(id,mentor,label,text){
 const r=records.get(id);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
}
function audit(id,changes,next){
 const a=JSON.parse(latest.get(id).details_json);
 a.audit_id='20261110_'+id+'_degree_and_fellowship_stages_0516';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_stages_0516_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';
  return cells.join(' | ');
 });
}
function replaceNoteLabel(id,label,replacement,target,extra=''){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceInverseLabel(target,id,label,replacement,extra=''){
 editLine(fn(target),l=>l.startsWith('- '+label+'：')&&l.includes('[['+local(id)+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceIndexLabel(id,target,label,replacement,extra=''){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace(' → '+label+'：',' → '+replacement+'：')+extra);
}

function addRelation(id,label,target,display,detail,inverseLabel){
 const r=records.get(id);
 editLine(fn(r.filename),l=>l==='## 师承',l=>l+'\n\n- '+label+'：[['+target+'|'+display+']]。'+detail);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- '+inverseLabel+'：[['+r.filename+'|'+r.name+']]。'+detail);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+label+'：[['+target+'|'+display+']]。'+detail);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);
}

const chen='cf1df826', lieber='师承人物 - Charles M. Lieber';
const bu='https://www.bu.edu/photonics/files/2018/10/Pho-Forum-Chen-Yang.pdf';
const buaa='https://ygy.buaa.edu.cn/info/1005/1261.htm';
const buHire='https://www.bu.edu/chemistry/2017/06/08/bus-chemistry-and-electrical-and-chemical-engineering-departments-welcome-professor-chen-yang/';
const yEvidence='BU 光子学中心与北航的原报告明确 2006 年 Harvard 化学博士学位在 Charles M. Lieber 指导下取得；BU 化学系入职公告核实授位学校和 Lieber 实验室。论文签署页尚待查。';
const yAudit=audit(chen,{phd:['confirmed_advisor',yEvidence,[bu,buaa,buHire]]},'用已有题名线索继续查 Harvard 学位馆藏签署页；补查毕业后履历。');
const yCitation=' '+web('BU 化学系入职档',buHire)+'佐证本人身份和博士组属；导师标签依据两份具名学位指导说明。';
replaceNoteLabel(chen,'博士阶段研究师长','博士导师',lieber,yCitation);
replaceInverseLabel(lieber,chen,'博士阶段研究受指导者','博士生',yCitation);
replaceIndexLabel(chen,lieber,'博士阶段研究师长','博士导师',yCitation);
editLine(fn(local(chen)),l=>l.startsWith('- 博士关系证据边界：'),l=>l.replace('原来源支持博士阶段研究指导；人物页、索引及结构化关系已按该阶段统一，正式登记待核。','博士导师标签基于两校具名的学位指导说明，论文正式登记待核。'));
changeRow(chen,'Charles M. Lieber（2006 Harvard 化学博士导师；具名校方履历，论文签署页待核）',null,web('BU 化学系入职档',buHire));
relation(chen,'phd',lieber,'advisor',yEvidence,[bu,buaa,buHire],yAudit,false);

const luk='e7b271bc',car=local('68db4c68');
const pNews='https://partnerships.princeton.edu/news/flatiron-institute-and-princeton-researchers-find-electronic-excitations-transform-semimetal';
const pDoe='https://www.osti.gov/servlets/purl/1860622';
const psu='https://science.psu.edu/news/lukas-muechler-joins-faculty-department-chemistry';
const sim='https://www.simonsfoundation.org/people/lukas-muechler/';
const lEvidence='Princeton 当时的研究报道将 Muechler 列为 Car 组研究生，Simons 履历称 Princeton 化学博士阶段与 Car 研究电子结构，DOE 结项原报告明确同一课题属于其博士论文。正式论文导师字段仍待核。';
const lAudit=audit(luk,{
 phd:['group_or_candidate',lEvidence,[pNews,pDoe,sim]],
 postdoc:['unresolved','Simons 记录 2018 年 7 月加入 CCQ，Princeton 新闻和 DOE 结项报告称该岗位是 Flatiron 博后，Penn State 2021 年 7 月 1 日入职报道将其称为独立研究职位。已核材料未列具名博后导师。',[sim,pNews,pDoe,psu]]
},'查 Princeton 论文导师字段及 Flatiron 具名博后指导档；合作论文留作线索。');
const lSource=web('Princeton 同期报道',pNews)+'与'+web('DOE 结项原报告',pDoe)+'交叉核实博士组属与论文研究；正式导师字段待核。';
note(luk,'- 博士阶段研究师长：',lSource);
mentorLine(car,luk,'- 博士阶段研究者：',lSource);
indexLine(luk,car,'博士阶段研究师长',lSource);
note(luk,'- 核查边界：',web('Penn State 入职公告',psu)+'称 Flatiron 为独立研究职位，'+web('Princeton 同期报道',pNews)+'列为博后。Flatiron 开始为 2018 年 7 月，2021 年 7 月入职 Penn State，已读履历未具名博后导师。');
changeRow(luk,null,'Flatiron CCQ 博后 fellow（2018 年 7 月起；2021 年 7 月入职 Penn State；具名导师待核）',web('Simons 履历',sim)+' · '+web('Penn State 入职',psu)+' · '+web('Princeton 报道',pNews));
relation(luk,'phd',car,'stage_mentor',lEvidence,[pNews,pDoe,sim],lAudit);

const hong='79a2a19b', cui='师承人物 - Yi Cui', hwang=local('6f70288e');
const hcv='https://honglab.ucdavis.edu/sites/g/files/dgvnsk8476/files/media/documents/CV_Hong_jan2022_0.pdf';
const hmrs='https://www.cambridge.org/core/services/aop-cambridge-core/content/view/B8DC3411653FC6F13D45097ED481FD0F/S0883769414002188a.pdf/meet_our_authors.pdf';
const hEvidence='本人 2022 CV 列 Stanford 应用物理博士、论文 Electronic transport in topological insulator nanostructures 与 2007–2013 博士研究助理 advisor Yi Cui；MRS 作者简介明确其 Stanford 博士由 Cui 指导。';
const hAudit=audit(hong,{
 phd:['confirmed_advisor',hEvidence+' CV 写 2014，作者简介的学位年份不同，待授位档。',[hcv,hmrs]],
 postdoc:['confirmed_advisor','本人 2022 CV 第 1 页直接列 Stanford 2014–2019 Postdoctoral Research Scholar，Advisor Harold Hwang。',[hcv]]
},'查 Stanford 学位档案，解决学位年份差异。');
enrich(hong,'phd',cui,'博士生',web('本人 2022 CV',hcv)+'列博士研究助理 advisor Yi Cui 及论文题目，MRS 简介具名博士指导；授位年份有异待档。');
enrich(hong,'postdoc',hwang,'博士后研究者',web('本人 2022 CV',hcv)+'明列 2014–2019 Stanford 博后和 advisor Harold Hwang。');
changeRow(hong,'Yi Cui（Stanford 博士导师；本人 CV 与作者履历交叉核对）','Harold Y. Hwang（2014–2019 Stanford 博后导师）',web('本人 2022 CV',hcv));
relation(hong,'phd',cui,'advisor',hEvidence,[hcv,hmrs],hAudit,false);

const ban='9a40117c', lin='师承人物 - Lin Lin', cy='师承人物 - Chao Yang';
const bcv='https://www.amartyabanerjee.com/_files/ugd/34a806_27681bdf041746ca81e5c7284da782a8.pdf';
const blin='https://www.lin.caltech.edu/people.html';
const bEvidence='本人 CV 明列 2015-06 至 2018-07 LBNL 博后 fellowship，称 Lin Lin 和 Chao Yang 为 Mentors；Lin 本人组档同列两人共同指导。另有 2014-01 至 2015-05 Minnesota 博后，CV 未列该段具名指导者。';
audit(ban,{postdoc:['group_or_candidate',bEvidence,[bcv,blin]]},'查 Minnesota 2014–2015 博士后具名指导者，以及 LBNL 是否另有正式 advisor 字段。');
const bSource=' '+web('本人 CV',bcv)+'将两人明确列为 2015-06 至 2018-07 LBNL 博后 Mentors，与 Minnesota 博后阶段分列。';
for(const m of [lin,cy]){
 replaceNoteLabel(ban,'博士后导师','博士后阶段研究师长',m,bSource);
 replaceInverseLabel(m,ban,'博士后研究者','博士后阶段研究者',bSource);
 replaceIndexLabel(ban,m,'博士后导师','博士后阶段研究师长',bSource);
}
note(ban,'- 核查边界：',web('本人 CV',bcv)+'把 2014-01 至 2015-05 Minnesota 博后与 2015-06 至 2018-07 LBNL 博后分列；前者未具名指导者，后者为明确共同研究指导，正式 advisor 字段待核。');
changeRow(ban,null,'Minnesota（2014-01 至 2015-05，指导者待核）；Lin Lin、Chao Yang（2015-06 至 2018-07 LBNL 博后共同研究师长）',web('本人 CV',bcv)+' · '+web('Lin Lin 组档',blin));

const man='a2b4730f';
const cnf='https://www.cnfusers.cornell.edu/announcements_archive';
const buPrize='https://www.bu.edu/eng/2025/11/05/david-bishop-wins-prestigious-award-for-his-contributions-to-understanding-superfluids/';
const manCv='https://www.bu.edu/stem/files/2014/10/Goldberg-CV-STEM.pdf';
audit(man,{
 phd:['group_or_candidate','BU 工程学院与 Cornell 讲座确认 1999 BU 物理博士；Goldberg 本人 CV 在 Ph.D. Theses 一节列 Manfra 及题名，条目未注明角色，同节对其他个案列不同角色。保留候选与 1998 论文年份。',[buPrize,cnf,manCv]],
 postdoc:['unresolved','Cornell 讲座与 Georgia Tech 同列 Bell Labs 1998–2000 博后技术岗位和 2001 年转技术岗，未具名导师。',[cnf]]
},'查 BU 论文签署页与 Goldberg 角色；追查 Bell Labs 1998–2000 博后项目和具名指导。');
note(man,'- 博士后经历：',web('Cornell CNF 讲座',cnf)+'独立复核 1998–2000 博后及 2001 年转技术岗；'+web('BU 工程学院',buPrize)+'明确 1999 BU 物理博士。');
changeRow(man,null,null,web('BU 授位学校',buPrize)+' · '+web('Cornell CNF 博后履历',cnf));
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0516';
fs.writeFileSync(stamp+'_人工.json',JSON.stringify(audits,null,2)+'\n','utf8');
fs.writeFileSync(stamp+'_结构化.json',JSON.stringify(typed,null,2)+'\n','utf8');
for(const [file,content] of graph)fs.writeFileSync(file,content,'utf8');
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.review-'));
const temp=path.join(tmp,'audit.json');
try{
 for(const a of audits){
  fs.writeFileSync(temp,JSON.stringify(a),'utf8');
  console.log(execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',temp],{encoding:'utf8'}).trim());
 }
 console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
