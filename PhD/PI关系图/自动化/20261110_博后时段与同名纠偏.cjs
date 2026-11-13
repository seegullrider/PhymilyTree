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
 a.audit_id='20261110_'+id+'_career_identity_0847';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_career_identity_0847_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const hau='0d65d9e8', bolt='d5ffd5f5', joy='1ee94b06', war='26823615', hua='1218078d', ten='153a5ad8', man='4b57e796', lat='3e2cec3e', men='2bf43d5e', hel='cdb3f8be', dal='e0fc6317', har='eb228b25', lin='24e6a934';
const kot='人员 - Rutgers - Gabriel Kotliar - 1c24065f', rice='师承人物 - T. Maurice Rice', til='师承人物 - Richard D. Tilley', wie='师承人物 - Gary P. Wiederrecht';
const rc='https://www.physics.rutgers.edu/~haule/cv.html', rn='https://www.rutgers.edu/news/rutgers-physicist-earns-sloan-foundation-research-fellowship', rp='https://journals.aps.org/prb/abstract/10.1103/PhysRevB.70.125112';
const bc='https://engineering.purdue.edu/~aeb/2024-01-CV-Alexandra-Boltasseva-v1.pdf', bs='https://engineering.purdue.edu/~aeb/short_CV.shtml';
const jc='https://www.physics.wisc.edu/directory/joynt-robert-j/rjjoynt_cv.pdf', jf='https://www.physics.wisc.edu/directory/joynt-robert-j/', jr='https://www.urmc.rochester.edu/MediaLibraries/URMCMedia/neurology/documents/Robert_Joynt_cv.pdf', jp='https://www.physics.wisc.edu/wp-content/uploads/2019/12/rjjoynt_publications.pdf', et='https://ethz.ch/content/dam/ethz/main/eth-zurich/ArbeitenLehrenundForschen/professuren/nachrufe/2024/240730_Rice_Final.pdf';
const wb='https://sites.utexas.edu/warner/bio/', wg='https://sites.utexas.edu/warner/research/', wm='https://www.marshall.edu/polsci/files/CV-Warner-July-2014.pdf', wn='https://pubmed.ncbi.nlm.nih.gov/15973756/', wu='https://research.unsw.edu.au/people/professor-richard-david-tilley';
const hu='https://tarheels.live/huanglab/pi/', hc='https://www.choise-efrc.org/scientists/curricula-vitae';
const as='https://research.a-star.edu.sg/researcher/jinghua-teng/', nc='https://www.ece.nus.edu.sg/stfpage/elecsj/teaching.html';
const mh='https://sites.google.com/site/hmanikantan/home', md='https://che.engineering.ucdavis.edu/directory/harishankar-manikantan', ms='https://stokeslet.ucsd.edu/news.html', mi='https://mechse.illinois.edu/news/graduate-student-earns-fmc-technologies-inc-fellowship';
const fl='https://www.chem.fsu.edu/~latturner/index.php/the-group/dr-susan-latturner/', mp='https://www.fkf.mpg.de/5098831/20_Kondolenzbuch', hf='https://www.chemistry.harvard.edu/people/eric-heller';
const bu='https://www.bu.edu/eng/profile/luca-dal-negro/', bl='https://www.bu.edu/nano/people/';
const ep='https://physics.emory.edu/people/bios/harutyunyan-hayk.html', hp='https://sites.google.com/site/haykharutyunyan/pubs', an='https://cnm.anl.gov/people/leadership';
const tf='https://engineering.tamu.edu/cse/profiles/Lin-Yiruo.html', il='https://iquist.illinois.edu/news/51253';
const both = (evidence, urls) => ['confirmed',evidence,urls];
const phase = (status,evidence,urls) => [status,evidence,urls];
function candidate(id,target,name,evidence,sources,auditId,bio=null){
 const proof=sources.map(([label,url])=>web(label,url)).join(' · ')+'。'+evidence;
 addEdge(id,'博士后导师候选',target,name,proof,null,true);
 if(bio){
   newMentor(target,name,bio,id,'博士后候选研究者',proof);
 }else{
   editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- 博士后候选研究者：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
 }
 relation(id,'postdoc',target,'candidate',evidence,sources.map(([,url])=>url),auditId);
}
const he='Rutgers 2008 年校方档案称 Haule 2002 和 2003 年在 Rutgers 做博士后，之后在 Ljubljana 的 Jožef Stefan Institute 任研究科学家，2005 年回 Rutgers 任教。2004 年 APS 论文把 Haule 和 Gabriel Kotliar 均列 Rutgers Center for Materials Theory。论文出刊晚于该档的博后年份，仅保留 Kotliar 为低可信候选。';
const ha=audit(hau,{postdoc:phase('group_or_candidate',he,[rn,rp,rc]),affiliation:both('Rutgers 本人 CV 核 2005 年进入物理系，学校原公告称博士后及赴斯洛文尼亚的先后顺序。',[rc,rn]),research:both('本人 CV 核强关联固体电子结构、DMFT 与 DFT。',[rc])},'查 Rutgers 2002–2003 Center for Materials Theory 任命、项目负责人或个人 CV，区分 2004 年后发表的合作。');
note(hau,'- 核查边界：',web('Rutgers 2008 原公告',rn)+'确认 2002、2003 年 Rutgers 博后及随后赴 Ljubljana；个人指导者待核。');
candidate(hau,kot,'Gabriel Kotliar',he,[['Rutgers 任职原档',rn],['2004 APS 原文',rp]],ha);
changeRow(hau,null,'Rutgers 2002、2003 博后；Gabriel Kotliar 为低可信候选',web('Rutgers 2008 原公告',rn));

const be='2024 年本人 CV 列 2005–2007 COM·DTU 博后、2007–2008 COM·DTU 助理教授，2004 年 Talent Project 奖列独立博后资助，未指名个人指导者。Purdue 2007 年档案只提供其已转 DTU 助理教授的时间上限。';
note(bolt,'- 博士后经历：',web('本人 2024 CV',bc)+'。'+be);
editLine(fn(local(bolt)),l=>l.startsWith('- 博士后经历：'),l=>l.replace('确切博后日期、导师及资助项目负责人待核。','确切月份与个人指导者待核。'));
changeRow(bolt,null,'DTU COM 2005–2007 博后；本人 CV 列独立博后资助，指导者待核',web('本人 2024 CV',bc));
const ba=audit(bolt,{postdoc:phase('unresolved',be,[bc,bs]),affiliation:both('2024 年本人 CV 列 Purdue ECE Distinguished Professor、材料工程 courtesy，另列 DTU 兼职。',[bc]),research:both('Purdue 既有研究档和 2024 年本人 CV 公开成果对应纳米光子学、等离激元及光学超材料。',[bc,'https://engineering.purdue.edu/MSE/people/ptProfile?group_id=11984&resource_id=46150'])},'找独立博后资助任命或接收单位个人角色；保留 DTU 论文两个导师来源。');

const je='Wisconsin 本人 CV 列 Cambridge Cavendish 1982–1984 和 ETH 理论物理所 1984–1986 两段博后。本人书目列与 T. Maurice Rice 1985 年合著超导论文；ETH 原讣告确认 Rice 自 1981 年任理论物理教授。Rice 仅为 ETH 段低可信候选。';
const jId=audit(joy,{identity:both('Wisconsin 物理本人 CV 为 Maryland 1982 物理博士；Rochester CV 属 Iowa 1963 解剖学博士、神经科医生 Robert J. Joynt，同名异人。',[jc,jr]),phd:phase('confirmed_advisor','Wisconsin 本人 CV 明列 Maryland 1982 博士论文由 R. E. Prange 监督。',[jc]),postdoc:phase('group_or_candidate',je,[jc,jp,et]),affiliation:both('Wisconsin–Madison 物理系本人档与本人 CV 核实身份。',[jf,jc]),research:both('本人论文及书目核量子霍尔、凝聚态和超导理论。',[jc,jp])},'追查 Cambridge Cavendish 及 ETH 接收团队；排除 Rochester 神经科医生 CV。');
note(joy,'- 核查边界：',web('Wisconsin 本人 CV',jc)+'核两段单位及日期。[Rochester 同名 CV]('+jr+')的作者为 Iowa 解剖学博士和神经科医生，已核为不同人。');
candidate(joy,rice,'T. Maurice Rice',je,[['Wisconsin 本人 CV',jc],['本人同期论文书目',jp],['ETH 原档',et]],jId,web('ETH 原档',et)+'列其任理论物理教授并从事理论凝聚态研究。');
changeRow(joy,null,'Cambridge 1982–1984、ETH 1984–1986；T. Maurice Rice 为 ETH 段低可信候选',web('Wisconsin 本人 CV',jc));

const we='本人 UT Austin 履历称 Queensland 2004 年博士后在新西兰和澳大利亚共 18 个月，2006-11 转 Oxford，2008 年独立建组。2005 年论文作者记录列 Warner 的 Victoria University of Wellington／MacDiarmid 地址及合著者 Richard D. Tilley；UNSW 原档确认 Tilley 曾在该校及研究所任职。仅为新西兰段低可信候选。';
const wId=audit(war,{identity:both('UT Austin 本人页列 Queensland 2004 年物理博士与纳米材料研究；Marshall 原 CV 属 Penn State 2001 年博士、政治学教授 Jamie Warner。',[wb,wm]),postdoc:phase('group_or_candidate',we,[wb,wn,wu]),affiliation:both('UT Austin 本人课题组简介核 Texas Materials Institute 及其现职。',[wb,wg]),research:both('本人实验室原档核 TEM、二维材料和纳米器件。',[wb,wg])},'分别找新西兰、澳大利亚及 Oxford 2006–2008 任命材料，核个人指导身份，排除 Marshall 政治学者。');
note(war,'- 核查边界：',web('UT Austin 本人履历',wb)+'确认新西兰、澳大利亚博后共 18 个月。[Marshall 同名 CV]('+wm+')为政治学教授及 Penn State 博士，已核为不同人。');
candidate(war,til,'Richard D. Tilley',we,[['UT Austin 本人履历',wb],['2005 论文原书目',wn],['UNSW 本人原档',wu]],wId,web('UNSW 原档',wu)+'核其 Victoria University of Wellington 和 MacDiarmid Institute 历史任职及纳米材料研究。');
changeRow(war,null,'新西兰、澳大利亚共 18 个月；Richard D. Tilley 为新西兰段低可信候选',web('UT Austin 本人履历',wb));

const hue='UNC 本人履历列 2007 年 UCLA 材料科学博士、2007–2009 Agilent Research Scientist、2009 年起 UNL 教职。所阅履历未列独立博士后经历。';
note(hua,'- 核查边界：',web('UNC 本人履历',hu)+'。'+hue);
changeRow(hua,null,'Agilent 研究科学家后转 UNL 教职，所阅履历未列独立博后',web('UNC 本人履历',hu));
audit(hua,{postdoc:phase('no_postdoc_documented',hue,[hu,hc]),affiliation:both('UNC 本人履历及 CHOISE CV 明列 Applied Physical Sciences 教授。',[hu,hc]),research:both('CHOISE CV 核钙钛矿太阳能电池、光电探测器和电荷输运。',[hc,hu])},'查 UCLA 论文正式导师栏；保留 Yang Yang 博士组属。若发现独立博士后资料再分阶段。');

const te='NUS 的 Chua 本人教学档把 Teng Jing Hua 单列在所指导博士生中，并列 2003-09 与量子阱互混论文题目。来源明确指导方向，正式论文主导师和共同导师身份尚待签署档。';
note(ten,'- 核查边界：',web('Chua 的 NUS 原页',nc)+'复核了姓名、学位及论文题名。Southampton 下载及馆藏返回 403，不能用于本人。');
changeRow(ten,null,null,web('A*STAR 现任原档',as));
audit(ten,{phd:phase('group_or_candidate',te,[nc,as]),affiliation:both('A*STAR 本人原档同时列 IMRE Senior Principal Scientist 和 NUS ECE Adjunct Professor。',[as]),research:both('A*STAR 原档列二维光电子、纳米光学、超表面、等离激元、THz 及半导体器件。',[as])},'用 NUS 量子阱互混论文原题查学位签署和 Chua 角色；Southampton 链接仍未读。');

const me='本人页分开 Illinois 研究生起点与 UC San Diego 博士，并说明随 Saintillan 课题组转校。2012 Illinois 原报道中的 research advisor 是该校硕士阶段。UCSD 2015 答辩原档和本人页共同证实赴 UCSB Squires 组博士后。原正式导师标签待核。';
note(man,'- 核查边界：',web('本人早期页',mh)+' · '+web('UCSD 同期课题组档',ms)+'。'+me);
changeRow(man,null,'Todd Squires（UCSB 博士后组负责人，正式指导称谓待核）',web('UCSD 2015 答辩档',ms));
audit(man,{phd:phase('group_or_candidate',me,[mh,mi,ms]),postdoc:phase('group_or_candidate','UCSD 同期课题组档和本人主页明确为 Squires 组博后。',[ms,mh]),affiliation:both('UC Davis 化学工程本人系档确认本校任职。',[md]),research:both('UC Davis 官方页核复杂流体、软材料物理及界面。',[md])},'待既定退避结束再核 UCSD 博士论文或学院正式档案中的导师字段；Illinois 硕士导师不得代替博士字段。');

const le='FSU 本人课题组页列 2000 年 UCSB Stucky 组博士及 2000–2003 Michigan State Kanatzidis 组博后；直接核实两组组属。正式关系的既有 ACS 来源仍待复读，保留现有博士标签。';
note(lat,'- 核查边界：',web('FSU 本人课题组原页',fl)+'。'+le);
changeRow(lat,null,'Michigan State 2000–2003 Kanatzidis 组；个人正式导师字段待核',web('FSU 本人课题组原页',fl));
audit(lat,{postdoc:phase('group_or_candidate',le,[fl]),affiliation:both('FSU 化学与生物化学系本人课题组页确认其任职。',[fl]),research:both('本人课题组原页列金属间化合物、固体材料及合成方向。',[fl])},'找 UCSB 论文签署及 MSU 阶段 CV 的 Postdoctoral Advisor 原文；保留既有 ACS 记录。');

const mne='MPI 纪念册 Menéndez 本人署名段称 1981 年赴 Stuttgart 读研，并记 Cardona 提议 Raman 研究、反复提出实验建议。其下明确写 Brown 论文导师和 MPI 博后的段落属于另一作者，不能用于 Menéndez。';
note(men,'- 核查边界：',web('MPI 纪念册 Menéndez 署名段',mp)+'。'+mne);
changeRow(men,null,null,web('MPI 署名回忆',mp));
audit(men,{phd:phase('group_or_candidate',mne,[mp])},'遵守 ASU CV 退避；查 Stuttgart 物理博士目录及论文签署，保留旧正式标签。');

const eh='Harvard 化学与化学生物学系本人档列其 Harvard Chemical Physics 博士和 Physics、CCB 两段入职时间，确认半经典量子动力学与电子输运。Reinhardt 文章本轮 403，保留既有记录。';
note(hel,'- 核查边界：',web('Harvard CCB 原档',hf)+'。'+eh);
changeRow(hel,null,null,web('Harvard CCB 本人档',hf));
audit(hel,{affiliation:both(eh,[hf]),research:both('Harvard 原档列分子与器件的半经典动力学、半导体与石墨烯电子输运。',[hf])},'查 Chemical Physics 学位档或作者本人纪实，补 Reinhardt 正式角色；Chicago 博后 Rice 的正式称谓待核。');

const de='BU 本人课题组页与院系列 ECE、Physics、Materials Science；课题组履历列 2003 年获 Trento 博士学位，随后赴 MIT 做博士后。意大利论文库原页本轮 cache miss，保留原正式标签与 2004 存档时间线索。';
note(dal,'- 核查边界：',web('BU 工学院本校页',bu)+' · '+web('BU 本人课题组',bl)+'。'+de);
changeRow(dal,null,null,web('BU 工学院本校页',bu));
audit(dal,{affiliation:both(de,[bu,bl]),research:both('BU 原档列纳米光子学、光学散射和纳米材料。',[bu,bl])},'意大利学位库缓期复读并区分学位与入库年份；MIT 博后任命和个人指导者待核。');

const hpe='Emory 原系档列 2012 Argonne CNM Distinguished Postdoctoral Fellow；本人书目列与 Gary P. Wiederrecht 共同发表 2014–2015 年等离激元论文。CNM 现任原档列 Wiederrecht 为部门主任，历史个人指导证据待查。仅为 Argonne 段低可信候选。';
const hap=audit(har,{postdoc:phase('group_or_candidate',hpe,[ep,hp,an]),affiliation:both('Emory 物理系官方档列教授。',[ep]),research:both('Emory 本人档与实验室书目核超快纳米光子学、等离激元及光学材料。',[ep,hp])},'找 Argonne 2012 CNM fellowship sponsor 和 Rochester 博后监督原档；保留两段候选。');
candidate(har,wie,'Gary P. Wiederrecht',hpe,[['Emory 系档',ep],['本人实验室书目',hp],['CNM 原档',an]],hap,web('Argonne CNM 原档',an)+'列其为中心主任，已出版纳米光学与等离激元论文。');
changeRow(har,null,'Rochester：Lukas Novotny 候选；Argonne CNM：Gary P. Wiederrecht 候选',web('Emory 系档',ep)+' · '+web('本人书目',hp));

note(lin,'- 核查边界：',web('Illinois 量子中心原文',il)+'复核 2017 年 UIUC 博士导师 Leggett。'+web('Texas A&M CSE 原档',tf)+'列现任 Research Assistant Professor，方向为拓扑相与量子计算。两页均未列博士后任命。');
changeRow(lin,null,null,web('Illinois 量子中心原文',il));
audit(lin,{phd:phase('confirmed_advisor','Illinois 量子中心明确称 Leggett 为 Lin 的博士导师，Lin 2017 年获得 UIUC 博士。',[il,tf]),affiliation:both('Texas A&M CSE 列 Research Assistant Professor。',[tf]),research:both('Texas A&M 本人档列拓扑量子计算、量子信息和凝聚态。',[tf])},'找 2017 博士之后到 Texas A&M 之间的正式履历，IDEALS 原 PDF 本轮 403。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_博后时段与同名纠偏';
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
