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
 a.audit_id='20261110_'+id+'_project_contrib_1556';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_project_contrib_1556_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.replace(/ \|\s*$/,'').split(' | ');if(cells.length<5)throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  const source=cells.splice(4).join('。 ');cells.push(source+' '+text+' |');
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



const sac='d5cf1286', teng='153a5ad8', kow='15762159', good='8374a772';
const n='https://physics.nyu.edu/pine/reprints/2010-03-25-Nature-Sacanna-Pacmen.pdf';
const j='https://engineering.jhu.edu/chembe/event/seminar-series-stefano-sacanna-from-nyu/';
const p='https://www.sacannalab.com/people-1';
const nv=web('2010 年论文原刊贡献段',n+'#page=4')+' · '+web('JHU 化工讲座原档',j);
const se='JHU 原档确认 Sacanna 于 2008 年加入 NYU 软物质研究中心任博士后。NYU 组站所存 2010 年 Nature 论文贡献段明确称 David J. Pine 与 Paul M. Chaikin 发起并指导了 Sacanna 参与的该项目，致谢同时列 Sacanna 的 NWO Rubicon 奖学金。支持项目层面的博后阶段研究指导。两人的正式聘任指导角色仍待核实。';
const mentors=[['人员 - NYU - David J. Pine - e301c4e7','David J. Pine'],['人员 - NYU - Paul Chaikin - 9527487c','Paul Chaikin']];
for(const [mentor,name] of mentors){
 const proof='论文贡献段记其与另一位负责人共同发起并指导该项目，时间落在 Sacanna 的 NYU 博后阶段。关系类型可信度为高（限该项目）。正式聘任导师角色待核。 '+nv;
 replaceNoteLabel(sac,'博士后导师候选','博士后阶段研究师长',mentor,' '+proof);
 replaceInverseLabel(mentor,sac,'博士后研究者候选','博士后阶段受指导者',' '+proof);
 replaceIndexLabel(sac,mentor,'博士后导师候选','博士后阶段研究师长',' '+proof);
}
editLine(fn(local(sac)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Utrecht 学位档案列 Philipse 为主要博士导师。'+se+' '+nv);
changeRow(sac,null,'2008 年起 NYU 软物质中心博后。Pine、Chaikin（博后阶段项目研究师长，聘任导师待核）',nv);
const sa=audit(sac,{affiliation:['confirmed','本人组页与 JHU 学术讲座介绍均列 NYU 化学教授。',[p,j]],research:['confirmed','JHU 报告原档核胶体合成、离子胶体结晶和自组装。',[j]],postdoc:['group_or_candidate',se,[j,n]]},'查 Rubicon 奖项记录、聘任或本人 CV 是否单独列名博后 host、sponsor 或 advisor。');
for(const [mentor] of mentors)relation(sac,'postdoc',mentor,'stage_mentor',se,[j,n],sa,false);

const ch='https://www.ece.nus.edu.sg/stfpage/elecsj/teaching.html';
const as='https://research.a-star.edu.sg/researcher/jinghua-teng/';
const tp='Chua 的 NUS 本人教学页在 Postgraduate Students Supervised 下的已毕业博士生第 9 项列 Teng Jing Hua、2003 年 9 月、无杂质光学量子阱互混与光子集成电路论文。该项未分别列出论文的主导师及共同导师。';
const ts=web('NUS 已毕业博士指导清单',ch)+' · '+web('A*STAR 研究人员原档',as);
note(teng,'- 核查边界：',tp+' '+ts);
changeRow(teng,null,null,ts);
const ta=audit(teng,{identity:['confirmed','NUS 指导页姓名写 Teng Jing Hua，论文为光电子量子阱。A*STAR 官档确认 Jinghua Teng 的半导体光电子研究身份。',[ch,as]],affiliation:['confirmed','A*STAR IMRE 高级首席科学家、NUS ECE 兼职教授。',[as]],research:['confirmed','A*STAR 列二维光电子、纳米光学、超表面、等离激元及太赫兹。',[as]],phd:['group_or_candidate',tp,[ch,as]]},'用论文完整题名和 2003 年 9 月查 NUS 学位书目，核主导师及共同导师字段。继续追早期聘历。');
relation(teng,'phd','师承人物 - Soo Jin Chua','stage_mentor',tp,[ch,as],ta,false);

const mi='https://engineering.cmu.edu/mfi/directory/bios/kowalewski-tomasz.html';
const wo='https://polymer.chem.cmu.edu/~kmatweb/2000/April_00/JPSPC/SCK.pdf';
const kp='CMU 制造未来研究所档案确认化学系教授、1988 年波兰科学院博士及有机电子、纳米石墨烯、聚合物自组装和 AFM。Wooley 的原刊致谢把 Kowalewski 与 Schaefer 并列为合作者。既有研究工作师长标签保留，博士后任用与指导称谓待查。';
const ks=web('CMU 研究所原档',mi)+' · '+web('Wooley 原刊致谢',wo);
note(kow,'- 核查边界：',kp+' '+ks);
changeRow(kow,'波兰科学院 1988 年博士。导师待核',null,ks);
audit(kow,{identity:['confirmed','CMU 研究所原档核 1988 年波兰科学院博士和现任化学教授。',[mi]],affiliation:['confirmed','CMU Chemistry Professor，见该校 Manufacturing Futures Institute 名录。',[mi]],research:['confirmed','有机电子、纳米石墨烯、聚合物自组装及 AFM。',[mi]],phd:['unresolved','CMU 列 1988 Polish Academy of Sciences 博士。待核论文档和导师。',[mi]],postdoc:['unresolved',kp,[wo,mi]]},'分辨波兰同名研究者，按 1988 年及研究主题向学位馆藏追论文，查早期任用和具名指导。');

const fb='https://physics.duke.edu/sites/physics.duke.edu/files/documents/Fairbank_publications.pdf';
const hm='https://webhome.phy.duke.edu/~hm/InvitedPresentations/LondonLegacyAPS2007.pdf';
const u='https://emeriti.ucsd.edu/_files/chronicles/2002-2003/Newsletter22.pdf';
const gp='Duke 所存 Fairbank 博士论文目录第 6 项列 John Morton Goodkind 1960 年固态氦-3 核自旋弛豫论文，Meyer 的 Duke 原讲稿亦将该实验列入 Fairbank 组。Horst Meyer 联合指导注记附于第 7 项 Adams。';
const gu='UCSD 荣休协会校史原文列 Goodkind 为物理系创系第三学年加入的实验低温物理人员。Duke 博士毕业与加入 UCSD 之间的任用待查。';
const gs=web('Duke 论文目录',fb+'#page=9')+' · '+web('Meyer 原报告',hm)+' · '+web('UCSD 物理系历史',u);
note(good,'- 核查边界：',gp+gu+' '+gs);
changeRow(good,null,'早期 UCSD 任用轨迹已查。博后任用与导师待核',gs);
const ga=audit(good,{identity:['confirmed','Duke 论文目录给出 John Morton Goodkind 全名、1960 年、固态氦-3 题名。',[fb,u]],affiliation:['confirmed','既有 UCSD 目录列物理系荣休。校史另核加入时的实验低温研究任职。',[u]],research:['confirmed','UCSD 校史和 Meyer 报告核实验低温物理与固态氦-3。',[u,hm]],phd:['group_or_candidate',gp+' Fairbank 博士阶段研究师长，正式论文导师签署待查。',[fb,hm]],postdoc:['unresolved',gu,[u]]},'查 1960 年 Duke 论文签署或致谢、1960 年至入 UCSD 之间的早期任用。');
relation(good,'phd','师承人物 - William M. Fairbank','stage_mentor',gp,[fb,hm],ga,false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_项目指导与学位记录复核';
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

