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
 a.audit_id='20261110_'+id+'_pennstate_original_1136';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_pennstate_original_1136_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const a=["https://dabo.matse.psu.edu/dabo/resources/2023-12-23-cv-1.pdf","https://www.iitk.ac.in/dora/profile/prof-jainendra-k-jain","https://www.matse.psu.edu/directory/joan-redwing","https://science.psu.edu/physics/people/jos13","https://science.psu.edu/physics/people/kaf2","https://www.matse.psu.edu/directory/mauricio-terrones","https://www.matse.psu.edu/directory/robert-hickey","https://docs.lib.purdue.edu/dissertations/AAI3556555/","https://bizhen01.github.io/zhenbi-group/people/","https://sites.psu.edu/zqmao/zhiqiang-mao/"], b=["https://iee.psu.edu/people/zhiqiang-mao","https://www.ib.edu.ar/entrevista-a-jorge-sofo-fisico-de-materia-condensada-que-me-pagasen-por-estudiar-en-el-balseiro-fue-algo-unico/","https://www.che.psu.edu/faculty/fichthorn/group/members/fichthorn-bio.html","https://nanolight.psu.edu/team/principle-investigator/","https://www.cmu.edu/engineering/materials/people/faculty/dabo.html","https://pure.psu.edu/en/persons/zhen-bi/"], c=["https://www.carnegiebosch.cmu.edu/fellowships/faculty-directory/bios/dabo-ismaila.html","https://cermics-lab.enpc.fr/wp-content/uploads/2022/06/CERMICS-2009.pdf","https://uplopen.com/chapters/4878/files/4f57a7dc-d868-4d9a-966c-23fc81b6c2c5.pdf","https://www.matse.psu.edu/directory/zhiqiang-mao","https://cache.org/sites/default/files/Fichthorn_bio_2018.pdf","https://bates.cems.umn.edu/people/alumni"], d=["https://mse.engineering.cmu.edu/directory/bios/dabo-ismaila.html","https://engineering.cmu.edu/news-events/news/2025/01/21-presidential-early-career-award.html","https://www.academia.edu/145035024/6_Current_Era"], e=["https://sites.psu.edu/redwing/joan-redwing/","https://www.matse.psu.edu/sites/matse/files/imagine._summer_2008.pdf","https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.81.3765","https://ss.scphys.kyoto-u.ac.jp/members/","https://yess2012.wordpress.com/2012/03/14/speaker-on-photovoltaic-cells-simulation-ismaila-dabo/"];
const [da,ja,re,so,fi,te,hi,ni,bi,ma]=["efede036","f8f12fa1","f838e35e","1b28beaa","f69c595d","f647f6a6","b76ce051","fb7a8dac","f8128337","f0a78c04"], cm='4304b870';
const u=(label,url)=>web(label,url)+'。';
const append=(id,field,status,proof,src)=>{
 const old=JSON.parse(latest.get(id).details_json).aspects[field];
 return [status||old.status,old.note+' '+proof,src];
};
function review(id,proof,phd,post,changes,next,heading='- 核查边界：'){
 note(id,heading,proof);
 changeRow(id,phd,post,proof);
 return audit(id,changes,next);
}
const daD='本人 2023 CV 第 2 页列 2008-02 MIT 材料博士及论文 Towards first-principles electrochemistry，明确 Supervisor 为 Nicola Marzari。CERMICS 2009 年报独立确认该导师并给出 2007-10 答辩时间。';
const daP='本人 CV 列 2007-11–2009-09 École des Ponts、Université Paris-Est 博后，资助为 INRIA，2007 年答辩后、2008 年授位前起任。YESS 讲者档明确当时受 Éric Cancès 和 Claude Le Bris 指导，保留阶段研究师长。';
const daF='CMU 材料系原档列当前 CMU-Africa 与材料系任职；2025 校刊确认 2024 秋入职。此前为 Penn State 材料与物理系兼聘，另有材料研究所与能源环境研究所任职。';
for(const id of [da,cm]){
 const r=review(id,u('本人 2023 CV 第 2 页',a[0])+u('CERMICS 2009 年报',c[1])+u('YESS 讲者档',e[4])+u('CMU 材料系原档',d[0])+u('CMU 入职报道',d[1])+daD+daP+daF,null,'École des Ponts／INRIA 2007-11–2009-09；Éric Cancès、Claude Le Bris（博士后阶段研究师长）',{
  phd:['confirmed_advisor',daD,[a[0],c[1]]],postdoc:['group_or_candidate',daP,[a[0],c[1],e[4]]],
  affiliation:['confirmed',daF,[d[0],d[1]]],research:['confirmed','CMU 材料系档确认计算材料、能源转换与储存、凝聚态和电子结构。',[d[0],a[0]]]
 },'两校为同人。查 INRIA 资助或聘任档中的个人指导职衔，保留博士答辩与授位时间差。');
 enrich(id,'phd','师承人物 - Nicola Marzari','博士生',u('本人 2023 CV 第 2 页',a[0])+u('CERMICS 2009 年报',c[1])+daD);
 relation(id,'phd','师承人物 - Nicola Marzari','advisor',daD,[a[0],c[1]],r,false);
}
const jaF='IIT Kanpur 校友原档核 1985 Stony Brook 理论物理博士、Maryland 和 Yale 两地研究、1989 Stony Brook 教职和 1998 Penn State。IIT 概称两地博士后研究，Penn State 旧档的 Yale 具体职称为 Associate Research Scientist，任用性质及个人指导仍待核。';
review(ja,u('IIT Kanpur 校友档',a[1])+jaF,null,null,{
 phd:append(ja,'phd',null,jaF,[a[1]]),postdoc:append(ja,'postdoc',null,jaF,[a[1]]),
 affiliation:['confirmed',jaF,[a[1]]],research:['confirmed','校友档核复合费米子、分数量子霍尔效应、强相互作用量子系统。',[a[1]]]
},'查 Stony Brook 博士论文以解决 Kivelson 的正式职衔冲突，核 Yale 与 Maryland 人事与指导档。');
const reU='https://prem-dmr.org/people/14450153';
const reD='PREM 人物履历直接写 1994 Wisconsin–Madison 化工博士 under the direction of Thomas Kuech，论文研究 MOCVD 的 GaAs／AlGaAs 掺杂。';
const reP='PREM 履历和 Penn State 2008 院刊核博士后进入 ATMI 工业任职（1994–1999），校方当前档列 2000 进入 Penn State。ATMI 组经理 Michael Tischler 属工业岗位；所阅未分列独立博士后。';
const reF='Penn State 当前材料档核材料与电气工程双聘、2D Crystal Consortium 与半导体薄膜和外延；2008 年材料系刊物另列化工 courtesy 聘任，仅作为历史。';
const rea=review(re,u('Penn State 材料档',a[2])+u('PREM 人物履历',reU)+u('Penn State 2008 材料系刊物',e[1])+reD+reP+reF,'Thomas F. Kuech（PREM 履历明确）','1994–1999 ATMI 工业任职；所阅未列独立博士后',{
 phd:['confirmed_advisor',reD,[reU]],postdoc:['no_postdoc_documented',reP,[a[2],reU,e[1]]],
 affiliation:['confirmed',reF,[a[2],e[1]]],research:['confirmed',reF,[a[2],reU]]
},'继续查 Wisconsin 博士论文全文；化工历史 courtesy 如有新院档再更新。');
enrich(re,'phd','师承人物 - Thomas F. Kuech','博士生',u('PREM 人物履历',reU)+reD);
relation(re,'phd','师承人物 - Thomas F. Kuech','advisor',reD,[reU],rea,false);
const reTarget='已核实单位 - Penn State - 化学工程系';
note(re,'- 院系／机构：','2008 年兼任 [['+reTarget+'|化学工程系]]。'+u('材料系同期刊物',e[1]));
editLine(path.join(root,'已核实院系',reTarget+'.md'),l=>l.startsWith('仅收录已按'),l=>l+'\n- [['+local(re)+'|Joan M. Redwing]] — '+web('材料系同期刊物',e[1])+'（2008 年 courtesy）');
editLine(path.join(root,'Penn State逐人复核记录.md'),l=>l.startsWith('| [['+local(re)+'|'),l=>l.replace('电气工程系；','电气工程系、化学工程系（2008 年兼任）；'));
const soD='Instituto Balseiro 本人访谈明确 Carlos Balseiro 为博士论文 director，本人复述在其指导下做 BEC–BCS 过渡，Penn State 校档核 1991 博士。本人访谈另称毕业后有四年博后，未在该段列个人指导。';
const soa=review(so,u('Instituto Balseiro 本人访谈',b[1])+u('Penn State 物理档',a[3])+soD,null,null,{
 phd:['confirmed_advisor',soD,[b[1],a[3]]],postdoc:append(so,'postdoc',null,soD,[b[1]]),
 affiliation:append(so,'affiliation','confirmed','Penn State 物理原档核物理系教授，其他原有兼聘保留来源。',[a[3]]),
 research:['confirmed','Penn State 物理档核凝聚态理论、量子材料电子输运与第一性原理。',[a[3]]]
},'查 Sofo 四年博后聘任的校所、起止与 Mahan 具体指导职衔。');
enrich(so,'phd','师承人物 - Carlos A. Balseiro','博士生',u('Instituto Balseiro 本人访谈',b[1])+soD);
relation(so,'phd','师承人物 - Carlos A. Balseiro','advisor',soD,[b[1],a[3]],soa,false);
const fiD='Fritz Haber Institute 原史第 6 章可读镜像明确 1989 Michigan 化工博士两位 advisers，列 Robert Ziff，第二名拼作 Erdogan Gujlari；该镜像拼写与原可靠记录不同，沿用 Erdogan Gulari。';
const fiP='本人 Penn State 组档与 CACHE 原档独立核 1989 博士后赴 UCSB 化工系担任 IBM Postdoctoral Fellow 一年，1990 入职 Penn State。组档分列 FHI 1998–1999 休假访问。';
const fia=review(fi,u('FHI 原史第 6 章镜像',d[2])+u('本人 Penn State 组档',b[2])+u('CACHE 原档',c[4])+fiD+fiP,'Robert M. Ziff、Erdogan Gulari（FHI 原史列两位 advisers）','UCSB 化工 IBM 博后一年；个人导师待核',{
 phd:['confirmed_advisor',fiD,[d[2],b[2]]],postdoc:['unresolved',fiP,[b[2],c[4]]],
 affiliation:['confirmed','物理院系和本人组档核 Penn State 化工与物理任职。',[a[4],b[2]]],
 research:['confirmed','本人组档核原子尺度流固界面模拟、薄膜和晶体生长、胶体与表面催化。',[b[2],c[4]]]
},'查 Michigan 1989 原论文签署页并进一步核导师姓名拼写，查 UCSB 化工 IBM 博后项目史及个人指导。');
for(const f of [local('e0afe5fd'),'师承人物 - Erdogan Gulari']){
 enrich(fi,'phd',f,'博士生',u('FHI 原史第 6 章镜像',d[2])+fiD);
 relation(fi,'phd',f,'advisor',fiD,[d[2],b[2]],fia,false);
}
const teF='Penn State 材料院档确认物理、化学与材料科学工程三聘，1997 Sussex 化学物理博士。研究石墨烯、碳纳米管、低维材料合成、缺陷及表征。';
review(te,u('Penn State 材料院档',a[5])+teF,null,null,{
 phd:append(te,'phd',null,teF,[a[5]]),affiliation:['confirmed',teF,[a[5]]],research:['confirmed',teF,[a[5]]]
},'查 Sussex、Max Planck 及本人旧简介所列 UCSB 博后段，确认具体时间、资助及个人导师。');
const hiF='Penn State 材料院档核材料副教授、2013 Penn 化学博士在 So-Jung Park 实验室、其后在 Ewha 暑期接续博士课题，另赴 Minnesota 两实验室任博后。Bates 组校友档明确 Minnesota 2013–2016 及 Tim Lodge 共同指导。';
const hia=review(hi,u('Penn State 材料院档',a[6])+u('Bates 组校友档',c[5])+hiF,null,'Minnesota 2013–2016；Timothy P. Lodge（共同指导）、Frank Bates（课题组负责人）',{
 phd:append(hi,'phd',null,hiF,[a[6]]),postdoc:['confirmed_advisor',hiF,[a[6],c[5]]],
 affiliation:['confirmed',hiF,[a[6]]],research:['confirmed','院档核聚合物混合物自组装、相行为、纳米复合材料。',[a[6]]]
},'查 Penn 2013 论文签署页、Lodge 组的相互指导记录，以及 Ewha 暑期岗位类别。');
relation(hi,'postdoc',local('94e213bd'),'advisor',hiF,[c[5],a[6]],hia,false);
const niD='Purdue 博士论文目录 AAI3556555 以 Xingjie Ni 为作者，题名 Controlling the emission and propagation of light with nano-plasmonic metamaterials and metasurfaces，Advisors 栏明确 Shalaev。本人 NanoLight 组档补全 Vladimir M. Shalaev 并明确 2012 Purdue 博士；仅以该年计毕业，目录上架日期 2013 不作毕业年。';
const niP='本人 NanoLight 组档核 Berkeley 博后在 Xiang Zhang 实验室，沿用博士后课题组负责人。组档核 Penn State 电气工程、纳米光子器件及超表面。';
const nia=review(ni,u('Purdue 博士论文目录',a[7])+u('本人 NanoLight 组档',b[3])+niD+niP,'Vladimir M. Shalaev（Purdue 论文 Advisors 栏）',null,{
 phd:['confirmed_advisor',niD,[a[7],b[3]]],postdoc:['group_or_candidate',niP,[b[3]]],
 affiliation:['confirmed',niP,[b[3]]],research:['confirmed',niP,[b[3],a[7]]]
},'查 Berkeley 博后聘任档案以核 Xiang Zhang 的个人指导职衔；Purdue 博士论文原文有访问限制，保留学位目录证据。');
enrich(ni,'phd',local('2c34e094'),'博士生',u('Purdue 博士论文目录',a[7])+niD);
relation(ni,'phd',local('2c34e094'),'advisor',niD,[a[7],b[3]],nia,false);
const biF='本人组档原文分列 UCSB 2012–2017 物理博士 advisor Cenke Xu 和 MIT 2017–2020 Pappalardo Fellow mentors T. Senthil、Liang Fu。Penn State 校档核物理系与量子多体、拓扑物态理论。';
const bia=review(bi,u('本人组档',a[8])+u('Penn State 校档',b[5])+biF,null,'MIT Pappalardo 2017–2020；T. Senthil、Liang Fu（博士后阶段研究师长）',{
 phd:['confirmed_advisor',biF,[a[8]]],postdoc:['group_or_candidate',biF,[a[8]]],
 affiliation:['confirmed',biF,[a[8],b[5]]],research:['confirmed',biF,[a[8],b[5]]]
},'核 UCSB 博士论文原件及 MIT Pappalardo 任命资料，保留导师与 mentors 两种称谓。');
for(const [stage,target,kind] of [['phd','47bff11a','advisor'],['postdoc','781c3259','stage_mentor'],['postdoc','7f696124','stage_mentor']])
 relation(bi,stage,local(target),kind,biF,[a[8]],bia,false);
const maPub='https://pubmed.ncbi.nlm.nih.gov/11017423/';
const maF='Penn State 材料院档确认 1992 中国科技大学物理博士、Kyoto 和 Penn State 两段博后，现列物理、材料及化学教授。IEE 核低温输运、非常规超导和拓扑材料。';
const maP='Kyoto Quantum Materials Lab 原始前成员档列 Mao 为博士后，Maeno、Ishiguro 为同组前教授。2000 PRL 书目列 Mao 单位为 Kyoto 物理，并显示与两人共同署名。仅作为 Kyoto 阶段低可信导师候选，个人关系待聘任或本人原档。';
const maa=review(ma,u('Penn State 材料院档',c[3])+u('Penn State IEE',b[0])+u('Kyoto 前成员原档',e[3])+u('2000 PRL 权威书目',maPub)+maF+maP,null,'Penn State Ying Liu（博士后阶段研究师长）；Kyoto Yoshiteru Maeno、Takehiko Ishiguro（低可信候选）',{
 phd:append(ma,'phd',null,maF,[c[3]]),postdoc:append(ma,'postdoc','group_or_candidate',maP,[e[3],maPub,c[3]]),
 affiliation:['confirmed',maF,[c[3],b[0]]],research:['confirmed',maF,[c[3],b[0]]]
},'查 USTC 1992 博士学位论文、京都博士后聘任或课题负责人；继续查 Penn State 博后个人指导原档。');
for(const [name,isNew] of [['Yoshiteru Maeno',false],['Takehiko Ishiguro',true]]){
 const target='师承人物 - '+name;
 const proof=u('Kyoto 前成员原档',e[3])+u('2000 PRL 权威书目',maPub)+maP;
 addEdge(ma,'博士后导师候选',target,name,proof,null,true);
 if(isNew)newMentor(target,name,'京都大学物理，院组名录列为前教授。'+u('Kyoto 前成员原档',e[3]),ma,'博士后候选研究者',proof);
 else inverse(ma,target,'博士后候选研究者',proof);
 relation(ma,'postdoc',target,'candidate',maP,[c[3],e[3],maPub],maa);
}
const ro='a18577c1',roU='https://campusdirectory.ucsc.edu/cd_detail?uid=sroy11';
const roF='UCSC 本人目录明确物理系 adjunct professor，并为 Berkeley Lab Advanced Light Source 的 Staff Scientist 和 Coherence & Magnetism 负责人，以及 LBNL Materials Sciences Division PI。原档核拓扑自旋纹理、界面磁性及相干软 X 射线。';
review(ro,u('UCSC 本人目录',roU)+roF,null,null,{
 affiliation:['confirmed',roF,[roU]],research:['confirmed',roF,[roU]]
},'查 Southern Illinois 学位档确认 Naushad Ali 候选；查 UC San Diego 博后任职和指导。','- 院系／机构：');
const gr='b29b0a8d',grU='https://cbe.princeton.edu/document/3466';
const grF='2024 本人 CV 第 1 页列 1986 Minnesota 化工博士，同年入职 UC Berkeley 化工；2020 年 Berkeley 荣休并加入 Princeton 化学与生物工程系，2020–2022 另任 PPPL Associate Lab Director。履历未分列独立博士后。';
review(gr,u('Princeton 托管本人 CV',grU)+grF,null,'1986 博士同年任 Berkeley 助理教授；所阅未列独立博士后',{
 affiliation:['confirmed',grF,[grU]],postdoc:['no_postdoc_documented',grF,[grU]]
},'查 Minnesota 论文签署页，核 Klavs Jensen 正式职衔及 1985／1986 年差异。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_PennState论文与院系原证';
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
