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
 a.audit_id='20261110_'+id+'_roles_1024';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_roles_1024_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

function addEdge(id,label,target,name,proof,after,candidate=false){
 const r=records.get(id);
 const line='- '+label+'：[['+target+'|'+name+']]。'+proof;
 editLine(fn(r.filename),l=>l.startsWith('- 核查边界：'),l=>line+'\n'+l);
 const file=candidate?path.join(root,'师承候选线索索引.md'):idx;
 editLine(file,l=>candidate?l==='# 师承候选线索索引':l.startsWith('- [['+r.filename+'|')&&l.includes('[['+after+'|'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+line.slice(2));
}
function newMentor(target,name,bio,student,reverse,proof){
 if(fs.existsSync(fn(target))||fs.existsSync(path.join(root,'师承人物',target+'.md')))throw Error('existing mentor '+target);
 const r=records.get(student);
 graph.set(fn(target),'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n\n- '+reverse+'：[['+r.filename+'|'+r.name+']]。'+proof+'\n');
}






function inverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}

const wang='b3ffd32f', nw='b7ad4151', brown='eca0a64e', sh='ec75ad51', dm='b43499b7', ak='bd849ee8';
const wCol='https://www.apam.columbia.edu/faculty-staff/directory/wen-i-wang';
const wBul='https://www.college.columbia.edu/sites/default/files/2014-2015_columbia_college_bulletin.pdf';
const wDuke='https://econ.duke.edu/sites/econ.duke.edu/files/cv-attachments/Wang_Wen_draftCV_0.pdf';
const wE='Columbia 校刊第 40 页列 Wen Wang 为 1981 年 Cornell 博士。APAM 原档用 Wen I. Wang，列同一双聘、Cornell 电气工程硕博、1981–82 Rockwell 与 1982–87 IBM Watson 科研任职，未说明任职是否为博后。Duke CV 所属是 2020 届经济学博士申请人，排除。';
note(wang,'- 核查边界：',web('Columbia 2014–15 校刊',wBul)+' · '+web('APAM 院系档',wCol)+'。'+wE);
changeRow(wang,'1981 Cornell 电气工程博士；导师待核','1981–82 Rockwell、1982–87 IBM Watson；博后性质待核',web('Columbia 2014–15 校刊',wBul)+' · '+web('APAM 院系档',wCol));
const wA=audit(wang,{identity:['confirmed',wE,[wCol,wBul,wDuke]],affiliation:['confirmed','Columbia 电气工程与应用物理及应用数学双聘。',[wCol,wBul]],research:['confirmed','半导体外延、光电材料与器件。',[wCol]],phd:['unresolved',wE,[wCol,wBul]],postdoc:['unresolved',wE,[wCol]]},'以 Wen I. Wang 和 1981 为识别条件继续追查 Cornell ECE 博士档与 Rockwell 任命原档。');

const nU='https://mathstats.uncg.edu/wei-chen-vivian-successfully-defended-her-ph-d-dissertation/';
const nN='https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/chen-wei.html';
const nA='https://ou.edu/content/dam/CoE/IE/ISEFaculty/Allen/Allen%20Vita.pdf';
const nE='UNC Greensboro 答辩原档的 Wei (Vivian) Chen 为 2018 统计学博士；Northwestern 本人系档和 Allen CV 所指为 1995 Georgia Tech 机械工程博士，研究设计、不确定性及材料信息学。此 URL 已按库外同名者排除。';
note(nw,'- 核查边界：',web('Northwestern 原院系',nN)+'。'+nE);
changeRow(nw,null,null,web('同名排除原档',nU)+' · '+web('Northwestern 系档',nN));
const nAudit=audit(nw,{identity:['confirmed',nE,[nU,nN,nA]]},'继续查 Georgia Tech 博士后去向与早期教职，保留博士正式导师和阶段研究师长的区分。');

const bA='https://researchers.adelaide.edu.au/profile/s.brown';
const bU='https://www.pa.ucla.edu/faculty-websites/brown.html';
const bQ='https://quantumfoundry.ucsb.edu/events/all/2020/stuart-brown-uc-los-angeles-condensed-matter-physics-nmr-selected-problems';
const bH='https://docs.house.gov/meetings/II/II06/20170621/106150/HHRG-115-II06-Bio-BrownS-20170621.pdf';
const bE='Adelaide 页面属于生物科学、生态地理研究者。UCLA 与 2017 年国会公开个人履历均核 1988 UCLA 物理博士及凝聚态 NMR。UCSB 讲座简介明确博士阶段受 Grüner 指导，尚未取得签署件。国会履历列 1987–1992 工业顾问、1989–1991 University of Florida 助理教授及同期 LANL 顾问，未分列独立博后。UCSB 简介将 Florida 教学期概述为 1989–1992。';
note(brown,'- 核查边界：',web('国会档案所存本人履历',bH)+' · '+web('UCSB 讲座档',bQ)+'。'+bE);
changeRow(brown,null,'1989 起 Florida 教职与 LANL 顾问；所阅履历未列独立博后',web('国会档案所存本人履历',bH));
const bAudit=audit(brown,{identity:['confirmed',bE,[bA,bU,bH]],affiliation:['confirmed','UCLA 物理与天文学系。',[bU,bH]],research:['confirmed','强关联电子、低维材料和 NMR。',[bU,bH]],phd:['group_or_candidate',bE,[bQ,bH]],postdoc:['no_postdoc_documented',bE,[bH,bQ]]},'查 1988 UCLA 原始学位档与 1988–89 过渡期任职，保留 George Grüner 为博士阶段研究师长。');

const sCV='https://physics-legacy.pbsci.ucsc.edu/~sriram/CV_Brief.pdf';
const sAPS='https://www.aps.org/apsnews/2008/07/2008-general-election-preview';
const sOwn='https://physics.ucsc.edu/~sriram/papers/paper_96.pdf';
const sP='https://physics-legacy.pbsci.ucsc.edu/~sriram/papers/paper_18.pdf';
const sD='https://collections.lib.utah.edu/dl_files/42/3b/423b9033959d395113e35f9287105f73d0d98b82.pdf';
const sE='APS 履历将 Imperial 1979–1980 和 Utah 1980–1982 列为博士后研究。Shastry 本人 2002 回忆称 Utah 1980 年以初级教员身份加入，并列同组 Daniel C. Mattis、Bill Sutherland。前者与本人有 1981 年同期原论文，后者与本人合作量子自旋模型。Utah 岗位原称差异保留，两人仅为低可信阶段候选。';
const sp=web('APS 履历',sAPS)+' · '+web('本人 2002 回忆',sOwn)+' · '+web('1981 Utah 原论文',sP)+'。'+sE;
for(const m of ['Daniel C. Mattis','Bill Sutherland']){
 const tgt='师承人物 - '+m;
 addEdge(sh,'博士后导师候选',tgt,m,sp,null,true);
 newMentor(tgt,m,'Utah 物理；来源见同期档案。'+web('本人或同期研究',m.startsWith('Daniel')?sD:sOwn),sh,'博士后候选研究者',sp);
}
editLine(fn(local(sh)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+sp);
changeRow(sh,null,'Imperial 1979–1980 博后；Utah 1980–1982 原岗位有异；Mattis、Sutherland（低可信候选）',sp);
const sa=audit(sh,{postdoc:['group_or_candidate',sE,[sAPS,sOwn,sP]],affiliation:['confirmed','本人简历列 UCSC 物理。',[sCV]],research:['confirmed','量子自旋、低维强关联电子和统计物理。',[sAPS,sOwn]]},'查 Imperial 博士后聘任档与 Utah Instructor／初级教员职位原件，确认是否有正式带教角色。');
for(const m of ['Daniel C. Mattis','Bill Sutherland'])relation(sh,'postdoc','师承人物 - '+m,'candidate',sE,[sAPS,sOwn,sP],sa);

const dCV='https://www.math.umd.edu/~dio/CV-Univ.pdf', dP='https://www.jpier.org/issues/volume.html?paper=9906282';
const dB='https://assets.cambridge.org/97805218/10104/frontmatter/9780521810104_frontmatter.pdf';
const dH='https://dash.harvard.edu/bitstreams/7e41d8d4-3e08-453d-a2d7-79813cd30449/download';
const dC='https://asrc.gc.cuny.edu/event/photonics-seminar-dionisios-margetis-university-of-maryland/';
const dE='Kaxiras 本人著作 Acknowledgments 将 Margetis 列在一起工作的博士后与访问学者名单。Margetis 本人 CV 明列 Harvard 1999-07 至 2001-08 博士后，Harvard 保存的同期论文两人同署工程及应用科学，收稿在任内。归入 Kaxiras 博后阶段课题组，未见正式个人指导职称。CUNY 讲座简介将 Harvard 和 MIT 都概称博士后工作，但本人 CV 将 MIT 列 Instructor／Lecturer。';
const dp=web('Kaxiras 本人著作致谢',dB)+' · '+web('Margetis 本人 CV',dCV)+' · '+web('Harvard 同期原论文',dH)+'。'+dE;
const kx=local('186f1527');
addEdge(dm,'博士后课题组负责人',kx,'Efthimios Kaxiras',dp,'师承人物 - Tai Tsun Wu');
inverse(dm,kx,'博士后课题组成员',dp);
editLine(fn(local(dm)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('本人原论文参考文献第 30 项',dP)+'列博士论文题名 Studies in Classical Electromagnetic Radiation and Bose-Einstein Condensation，签署页待核。'+dp);
changeRow(dm,null,'Harvard 1999–2001；Efthimios Kaxiras（博后课题组）',dp+' · '+web('本人参考文献',dP));
const da=audit(dm,{postdoc:['group_or_candidate',dE,[dB,dCV,dH,dC]],affiliation:['confirmed','本人 CV 第 1 页列 Maryland 数学主聘及物理科学与技术研究所双聘。',[dCV,dC]],research:['confirmed','晶面演化、统计物理、等离激元、凝聚态量子动力学。',[dCV,dC]]},'查 Harvard 学位论文签署页，分开两位博士期间论文研究师长；查 Harvard 博后指导职称与 MIT 聘任材料。');
relation(dm,'postdoc',kx,'group_leader',dE,[dB,dCV,dH,dC],da);

const aAV='https://pure.tue.nl/ws/portalfiles/portal/182724818/6.0001005.pdf', aPR='https://ece.princeton.edu/people/antoine-kahn', pt='师承人物 - Peter Mark';
const aE='AVS 原纪念文章第 3 页正文与图注分别明确 Kahn 是在 Peter Mark 指导下获得博士学位的最后一位学生，文章致谢说明访谈资料来自 Kahn 等人。Princeton ECE 院系档核 1978 年博士；同一原文图注列 1979-09-01 为 Princeton 助理教授起点。学位签署页与中间任职待查。';
const ap=web('AVS 纪念文正文与图注',aAV)+' · '+web('Princeton ECE 院系档',aPR)+'。'+aE;
editLine(fn(local(ak)),l=>l.startsWith('- 博士阶段研究师长：')&&l.includes('[['+pt+'|'),()=>'- 博士导师：[['+pt+'|Peter Mark]]。'+ap);
editLine(fn(pt),l=>l.startsWith('- 博士阶段研究者：')&&l.includes('[['+local(ak)+'|'),()=>'- 博士生：[['+local(ak)+'|Antoine Kahn]]。'+ap);
editLine(idx,l=>l.startsWith('- [['+local(ak)+'|')&&l.includes('[['+pt+'|'),()=>'- [['+local(ak)+'|Antoine Kahn]] → 博士导师：[['+pt+'|Peter Mark]]。'+ap);
editLine(fn(local(ak)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：博士指导关系由 AVS 正文和图注直接支持。Princeton 1978 博士、1979 年 9 月教职之间的任职性质及博后指导者待核。');
changeRow(ak,'Peter Mark（博士导师）','1979-09-01 起 Princeton 教职；间隔岗位待核',ap);
const aa=audit(ak,{phd:['confirmed_advisor',aE,[aAV,aPR]],postdoc:['unresolved',aE,[aAV,aPR]],affiliation:['confirmed','Princeton ECE 和 Princeton Materials Institute。',[aPR]],research:['confirmed','有机半导体、钙钛矿材料界面与光电器件。',[aPR]]},'继续查 Princeton 1978 论文签署页及 1978–79 任职记录。');
relation(ak,'phd',pt,'advisor',aE,[aAV,aPR],aa,false);

const excluded=[
 {page_id:'031daf6806d15c9dfd6969ae',record_id:wang,url:wDuke,audit_id:wA,external_subject:'Wen Wang（Duke 经济学博士候选人）',evidence:wE},
 {page_id:'acafbbc7162194f2703a4f01',record_id:nw,url:nU,audit_id:nAudit,external_subject:'Wei (Vivian) Chen（UNCG 统计学博士）',evidence:nE},
 {page_id:'ed0bd7e953d26d19f6be377e',record_id:brown,url:bA,audit_id:bAudit,external_subject:'Stuart Brown（Adelaide 生态地理学研究者）',evidence:bE}
];


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_WangBrownKahn阶段复核';
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
 const excludedFile=stamp+'_同名排除.json';
 fs.writeFileSync(excludedFile,JSON.stringify(excluded,null,2)+'\n','utf8');
 console.log(execFileSync(process.execPath,['--no-warnings','人物网页身份纠偏.cjs',excludedFile],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
