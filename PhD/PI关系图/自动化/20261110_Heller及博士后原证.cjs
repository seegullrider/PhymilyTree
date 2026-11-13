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
 a.audit_id='20261110_'+id+'_heller_and_fellowship_0948';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_heller_and_fellowship_0948_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const he='cdb3f8be', re='师承人物 - William P. Reinhardt', tak='870b3aae', su=local('ab40335d'), plum=local('88655d8b'), griff='师承人物 - Peter B. Griffin';
const wi='866768f8', ji='87da0275', cold='8a3992bc', bc='e2ebf9d2', yz='8624f6d1', kap='fb3670d3';
const hPaper='https://ciqm.harvard.edu/uploads/2/3/3/4/23349210/heller2019.pdf', hCCB='https://www.chemistry.harvard.edu/people/eric-heller';
const tcv='https://research.engineering.ucdavis.edu/takamura/wp-content/uploads/sites/73/2018/07/Takamura_CV_July2018.pdf', tName='https://engineering.ucdavis.edu/news/faculty-spotlight-yayoi-takamura', tRole='https://engineering.ucdavis.edu/news/yayoi-takamura-shaping-future-materials-science-and-engineering', tCsu='https://www.physics.colostate.edu/wp-content/uploads/sites/14/2019/09/takamura-yayoi-colloquim-2.pdf', tPu='https://profiles.stanford.edu/jim-plummer?tab=publications', tApl='https://www.ele.uva.es/~mmm/papers/2003_Aboy_APL_83.pdf';
const wiS='https://materials.ucsb.edu/people/faculty/stephen-wilson', wiO='https://orb.binghamton.edu/dissertation_and_theses/196/';
const jiS='https://experts.azregents.edu/en/persons/jian-li/', jiO='https://www.binghamton.edu/electrical-computer-engineering/docs/cv/lij.cv.pdf';
const coldCV='https://coldren.ece.ucsb.edu/sites/default/files/bio-files/2023_cv_0.pdf', coldBio='https://coldren.ece.ucsb.edu/bio/larry-coldren-bio', coldUcb='https://wu.mse.berkeley.edu/ems/pastfliers/1991.pdf';
const bcD='https://www.epfl.ch/education/phd/edmx-materials-science-and-engineering/edmx-published-theses/', bcF='https://www.admin.cam.ac.uk/reporter/2018-19/weekly/6535/section12.shtml';
const y20='https://faculty.engineering.asu.edu/zhao/wp-content/uploads/sites/30/2020/09/Yuji-Zhao-CV_Sep-2020.pdf', y24='https://bpb-us-e1.wpmucdn.com/blogs.rice.edu/dist/a/12346/files/2024/09/Yuji-Zhao_CV-Sep-2024.pdf', yRice='https://profiles.rice.edu/faculty/yuji-zhao';
const kI='https://www.ias.edu/scholars/anton-kapustin', kCal='https://www.pma.caltech.edu/people/anton-n-kapustin';
function inverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}

const hE='Heller 作为作者在 Harvard CIQM 托管的原论文致谢亲述，相关问题出现在自己在 Reinhardt 教授指导下完成的论文中；参考文献第 12 项是其 1973 年 Harvard 博士论文 Discrete Methods in Quantum Scattering Theory。';
const hP=web('本人原论文第 10 页致谢与参考文献',hPaper)+'。'+hE;
enrich(he,'phd',re,'博士生',hP);
changeRow(he,'William P. Reinhardt（本人论文致谢明示博士论文指导）',null,web('本人原论文致谢',hPaper));
note(he,'- 核查边界：',hP);
const hA=audit(he,{phd:['confirmed_advisor',hE,[hPaper,hCCB]]},'继续查 Chicago 博后任命是否明示 Stuart A. Rice 为个人导师。');
relation(he,'phd',re,'advisor',hE,[hPaper,hCCB],hA,false);

const tE='Takamura 在 UC Davis 本人访谈具名说其 Berkeley 材料系博后与 Yuri Suzuki 工作；另一本人访谈描述带她转向氧化物研究的女性指导者并明确称 future postdoc advisor。Colorado State 报告履历独立确认 Berkeley 博后 with Yuri Suzuki。两份本人叙述与第三份履历交叉支持 Yuri Suzuki 为博士后导师；任命文件仍待查。';
const tP=web('本人访谈具名',tName)+' · '+web('本人访谈导师称谓',tRole)+' · '+web('Colorado State 报告履历',tCsu)+'。'+tE;
replaceNoteLabel(tak,'博士后阶段研究师长','博士后导师',su,' '+tP);
mentorLine(su,tak,'- 博士后研究者：',tP);
replaceIndexLabel(tak,su,'博士后阶段研究师长','博士后导师',' '+tP);
editLine(fn(local(tak)),l=>l.startsWith('- 博士后关系证据：'),()=>'- 博士后关系证据：'+tP);
editLine(fn(local(tak)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('本人 CV',tcv)+'分列 2004 Stanford 材料博士与 2003–2006 Berkeley 博后，开始年早于授位年，按原文保留。'+web('本人访谈',tName)+'列 2006 年 7 月赴 UC Davis。博士导师待学位档核实。');
const pE='本人 CV 核 Stanford 材料博士阶段；Stanford Plummer 本人发表档和同期原论文记录 Takamura 与 James D. Plummer、Peter B. Griffin 共同研究硅掺杂。两人仅列博士阶段低可信候选。';
const pP=web('Stanford 本人发表目录',tPu)+' · '+web('同期原论文',tApl)+'。'+pE;
addEdge(tak,'博士导师候选',plum,'James D. Plummer',pP,null,true);
inverse(tak,plum,'博士候选研究者',pP);
addEdge(tak,'博士导师候选',griff,'Peter B. Griffin',pP,null,true);
newMentor(griff,'Peter B. Griffin','Stanford 集成系统中心的半导体材料研究。'+web('Stanford 同期原论文',tApl)+'。',tak,'博士候选研究者',pP);
changeRow(tak,'James D. Plummer、Peter B. Griffin（低可信候选）','Yuri Suzuki（Berkeley 博后；两份本人访谈及 CSU 履历交叉）',web('本人 CV',tcv)+' · '+web('本人导师叙述',tRole)+' · '+web('具名访谈',tName));
const tA=audit(tak,{phd:['group_or_candidate',pE,[tcv,tPu,tApl]],postdoc:['confirmed_advisor',tE,[tName,tRole,tCsu,tcv]],affiliation:['confirmed','UC Davis 工程学院和本人 CV 支持材料科学与工程任职。',[tName,tcv]],research:['confirmed','本人访谈核氧化物薄膜、异质界面及磁性。',[tName,tRole]]},'查 Stanford 2004 博士签署，核 Berkeley 博后准确开始月与 Stanford 授位月份。');
relation(tak,'postdoc',su,'advisor',tE,[tName,tRole,tCsu,tcv],tA,false);
relation(tak,'phd',plum,'candidate',pE,[tcv,tPu,tApl],tA);
relation(tak,'phd',griff,'candidate',pE,[tcv,tPu,tApl],tA);

const wE='UCSB 本人页列 Stephen Wilson 为材料系教师，研究复杂氧化物、量子磁性及相关物态。Binghamton 原论文为 Stephen Wilson McIntire 1973 年俄罗斯法律史研究；与 Tennessee 2007 年凝聚态物理博士及 UCSB 材料系任职不同。';
note(wi,'- 核查边界：',web('UCSB 材料系本人档',wiS)+'核身份，'+web('Binghamton 同名原档',wiO)+'已排除。');
changeRow(wi,null,null,web('UCSB 材料系原档',wiS));
const wA=audit(wi,{identity:['confirmed',wE,[wiS,wiO]],affiliation:['confirmed','UCSB 本人院系原档列 Materials。',[wiS]],research:['confirmed','本人 UCSB 原档核量子材料、复杂氧化物与关联磁性。',[wiS]]},'既有明确博士及博后边保留；将 2015 UCSB 年报的博士后 Advisor 字段在原页恢复时复读。');

const jE='ASU Regents 原档列有机材料方向 Jian Li 的 USC 2005 年化学博士及 Arizona State Materials Science and Engineering。Binghamton 原 CV 为计算机网络研究者 Jian Li，其 Texas A&M ECE 博士导师 Srinivas Shakkottai，经历与 ASU 目标不同。';
note(ji,'- 学位阶段：',web('Arizona Board of Regents 本人档',jiS)+'与'+web('Binghamton 同名者原 CV',jiO)+'核对，已排除网络研究者。');
changeRow(ji,null,null,web('Arizona Board of Regents 原档',jiS));
const jA=audit(ji,{identity:['confirmed',jE,[jiS,jiO]],affiliation:['confirmed','Arizona Board of Regents 原档列 Materials Science and Engineering。',[jiS]],research:['confirmed','原档记录有机电子、OLED 与光电材料。',[jiS]]},'查 USC 2005 论文题名及签署，以及 2005–2009 工业／博士后职位。');

const cE='Coldren 本人 UCSB 技术履历称 1968 年加入 Bell Labs，在 Bell Labs 支持下取得 Stanford 1969 年硕士、1972 年博士，后在 Bell Labs research area 工作，1984 年赴 UCSB。UCSB 本人 CV 及 Berkeley 讲座也记这段研究任职，所阅未列独立博士后。';
note(cold,'- 核查边界：',web('UCSB 本人技术履历',coldBio)+'。'+cE);
changeRow(cold,null,'Bell Labs 研究任职，所阅未列独立博后',web('本人技术履历',coldBio)+' · '+web('Berkeley 1991 讲座',coldUcb));
audit(cold,{postdoc:['no_postdoc_documented',cE,[coldBio,coldCV,coldUcb]],affiliation:['confirmed','UCSB 本人 CV 确认 ECE、Materials 与 Distinguished Research Professor。',[coldCV,coldBio]],research:['confirmed','UCSB 原档核光子集成电路及半导体光电子器件。',[coldBio,coldCV]]},'查 Stanford 1972 博士论文及 Kino 的直接学位指导证据，暂保留候选。');

const bE='Cambridge University Reporter 的 Trinity College 正式公告列 Bingqing Cheng 获选 Title A Fellowship，生效日期 2019-10-07，未列指导者；ISTA 履历另列 2020–2021 Departmental Early Career Fellow。EPFL 博士目录仍明示 Michele Ceriotti (Dir.)。';
note(bc,'- 核查边界：',web('Cambridge 正式任命公告',bcF)+'。'+bE);
changeRow(bc,null,'Trinity Title A Fellowship 2019-10-07 起；另有 Cambridge 院系 fellowship，个人指导待核',web('Cambridge University Reporter',bcF));
audit(bc,{phd:['confirmed_advisor','EPFL 材料学位目录直接列 B. Cheng / M. Ceriotti (Dir.)。',[bcD]],postdoc:['unresolved',bE,[bcF]]},'查 Cambridge 两项 fellowship 的指导或接待档，区别独立职位和正式博后导师。');

const yE='ASU 2020 与 Rice 2024 版本本人 CV 均核 Shuji Nakamura 博士 Advisor。ASU 2020 CV 明列 2013-01–2014-08 UCSB Materials／SSLEC Assistant Project Scientist，另列 2013 博士后研究奖；具体博后任命及其个人导师待核。';
note(yz,'- 核查边界：',web('ASU 本人 2020 CV',y20)+'。'+yE);
changeRow(yz,'Shuji Nakamura（两个本人 CV 明列 Advisor）','UCSB Assistant Project Scientist（2013-01–2014-08）；独立博后任命及导师待核',web('ASU 本人 2020 CV',y20)+' · '+web('Rice 本人原档',yRice));
audit(yz,{phd:['confirmed_advisor',yE,[y20,y24]],postdoc:['unresolved',yE,[y20,y24]],affiliation:['confirmed','Rice 原档列 Electrical and Computer Engineering。',[yRice]],research:['confirmed','Rice 原档核宽禁带半导体及量子光电子。',[yRice,y24]]},'查 UCSB SSLEC 2013–2014 任命和博士后奖正式资料，区分研究职位与个人指导。');

const kE='IAS 本人档明列 School of Natural Sciences 1997-09–2001-09 Member。该档未用 Postdoc，也未列具体个人指导；Caltech 教员原档核物理与数学研究及任职。';
note(kap,'- 核查边界：',web('IAS 原始任职栏',kI)+'。'+kE);
changeRow(kap,null,'IAS Natural Sciences Member 1997-09–2001-09；是否有博后指导待查',web('Caltech 教员原档',kCal)+' · '+web('IAS 会员档',kI));
audit(kap,{postdoc:['unresolved',kE,[kI,kCal]]},'查 1997–2001 IAS 历史岗位的正式性质及个人指导，不从同期合作推断。');

if(process.argv[2]==='apply')fs.writeFileSync('20261110_Heller及博士后原证_同名排除.json',JSON.stringify([
 {page_id:'5c35aba9e94d9a29dbf007ef',record_id:wi,url:wiO,external_subject:'Stephen Wilson McIntire，Binghamton 1973 年历史学博士',audit_id:wA,evidence:wE},
 {page_id:'69a1b2cc6e7ff06f87171511',record_id:ji,url:jiO,external_subject:'Jian Li，Texas A&M ECE 网络研究博士',audit_id:jA,evidence:jE}
],null,2)+'\n','utf8');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Heller及博士后原证';
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
