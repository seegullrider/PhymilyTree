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
 a.audit_id='20261110_'+id+'_msu_uher_original_1357';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_msu_uher_original_1357_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const p={
 uher:'https://www.yumpu.com/en/document/view/11017382/ctirad-uher-international-thermoelectric-society',aps:'https://engage.aps.org/fiap/governance/executive-committee/biographies-statements',morelli:'https://engineering.msu.edu/news/donald-morelli-receives-international-honor',morelliLab:'https://www.egr.msu.edu/morelli-research/members.html',yang:'https://mse.washington.edu/facultyfinder/jihui-yang',
 cocker:'https://directory.natsci.msu.edu/Directory/Profiles/Person/102089',alberta:'https://www.ualberta.ca/en/science/about-us/contours/2018-spring-contours/2018/may/new-window-into-nanoworld.html',huber:'https://www.uni-regensburg.de/en/physics/wg/rhuber/team/alumni',cockerNews:'https://natsci.msu.edu/news/nanoscale-tunneling-microscopy-goes-contact-free.aspx',
 pratt:'https://directory.natsci.msu.edu/directory/Profiles/Person/103034',prattMN:'https://conservancy.umn.edu/bitstreams/c50da204-eb1f-4b36-b231-3c33fc68fc9b/download',
 birge:'https://pa.msu.edu/sites/_pa/assets/File/MSU_PA_GradStudies_2020-PRINT.pdf',nagel:'https://nagelgroup.uchicago.edu/Nagel-Group/members.html',birgePaper:'https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.54.2674',gold:'https://directory.natsci.msu.edu/directory/Profiles/Person/101998',
 fan:'https://engineering.msu.edu/directory/faculty/qfan',fanHire:'https://www.egr.msu.edu/newfaculty/2016/Faculty2.html',pt:'https://files.dre.pt/gratuitos/2s/2000/10/2S233A0000S00.pdf',fanTh:'https://www.academia.edu/10500454/Polycrystalline_diamond_coatings_on_steel_substrates',fanPaper:'https://www.academia.edu/29910457/Diamond_coating_on_steel_with_a_titanium_interlayer',
 hogan:'https://engineering.msu.edu/directory/faculty/hogant',hoganPaper:'https://chemgroups.northwestern.edu/kanatzidis/Reprints/KBi6.33S10_186.pdf',hoganCV:'https://www.egr.msu.edu/~hogant/RESUME-most%20current%20for%20web.pdf',
 beck:'https://www.chemistry.msu.edu/faculty-research/faculty-members/beck-warren.aspx',beckGen:'https://www2.chemistry.msu.edu/Genealogy/PID613.shtml',sauer:'https://link.springer.com/article/10.1007/s11120-024-01119-0'
};
const cite=(label,url)=>web(label,url)+'。';
const uher='daaa0cb4', u=local(uher), y='0c4f4e31', mo='9cc0f7e2';
const uCV=cite('Ctirad Uher 本人履历可读副本',p.uher);
const addIndex=(id,label,target,alias,proof,anchor)=>editLine(idx,l=>l.startsWith('- [['+local(anchor)+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+local(id)+'|'+records.get(id).name+']] → '+label+'：[['+target+'|'+alias+']]。'+proof);
const setBoundary=(id,body)=>editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+body);
function replaceEdge(id,target,from,to,oldInverse,newInverse,proof){
 const person=local(id), outgoing='[['+target+'|', incoming='[['+person+'|';
 const replace=(l,find,next,wiki)=>l.slice(0,l.indexOf(find))+next+l.slice(l.indexOf(wiki),l.indexOf(']]',l.indexOf(wiki))+2)+'。'+proof;
 editLine(fn(person),l=>l.startsWith('- '+from+'：')&&l.includes(outgoing),l=>replace(l,'- '+from+'：','- '+to+'：',outgoing));
 editLine(fn(target),l=>l.startsWith('- '+oldInverse+'：')&&l.includes(incoming),l=>replace(l,'- '+oldInverse+'：','- '+newInverse+'：',incoming));
 editLine(idx,l=>l.startsWith('- '+incoming)&&l.includes(' → '+from+'：')&&l.includes(outgoing),l=>replace(l,' → '+from+'：',' → '+to+'：',outgoing));
}

const moEv='Ctirad Uher 本人履历的 Dissertations Directed 一栏明确列 D. T. Morelli、1985 年与 MSU 教授去向，和 APS 履历的 1985 Michigan 物理博士吻合。博士导师，可信度高。';
const moProof=moEv+' '+uCV+cite('APS 传记',p.aps);
editLine(fn(local(mo)),l=>l.startsWith('- 核查边界：'),l=>'- 博士导师：[['+u+'|Ctirad Uher]]。'+moProof+'\n'+l);
addIndex(mo,'博士导师',u,'Ctirad Uher',moProof,uher);
inverse(mo,u,'博士生',moProof);
setBoundary(mo,moProof+' APS 传记列 1985 年加入 GM Research Laboratories 任 Senior Research Scientist。此职位与独立博士后分开记。MSU 工学院档核材料科学与工程任职，旧组档亦列物理与天文学系。招生资格仍待核。'+cite('MSU 工学院',p.morelli)+cite('实验室成员原档',p.morelliLab));
changeRow(mo,'Ctirad Uher（1985 Michigan 博士导师）','1985 年加入 GM 研究实验室任 Senior Research Scientist；独立博士后待核',moProof);
const moAid=audit(mo,{phd:['confirmed_advisor',moEv,[p.uher,p.aps]],postdoc:['unresolved','APS 传记列博士毕业同年加入 GM 任 Senior Research Scientist。独立博士后经历和具名指导者待核。',[p.aps]],affiliation:['confirmed','MSU 工学院原档核化学工程与材料科学，组档另列物理与天文学系。后者当前聘任边界待核。',[p.morelli,p.morelliLab]],research:['confirmed','MSU 原档核热电材料、热输运和固态能量转换。',[p.morelli,p.morelliLab]]},'继续追 Michigan 论文签署页、GM 当年岗位和其他可能的短期任职。');
relation(mo,'phd',u,'advisor',moEv,[p.uher,p.aps],moAid,false);

const yEv='Ctirad Uher 本人履历的 Dissertations Directed 一栏列 2000 年 J. Yang、Washington 教授去向，与 UW 材料系 Jihui Yang 的 2000 Michigan 物理博士履历一致。博士导师，可信度高。';
const yProof=yEv+' '+uCV+cite('UW 材料系',p.yang);
replaceEdge(y,u,'博士导师候选','博士导师','博士生候选','博士生',yProof);
setBoundary(y,yProof+' UW 原档另列 GM 1996–2011 任职，保留和博士期重叠的原日期。独立博士后聘任与论文馆藏签署页待核。');
changeRow(y,'Ctirad Uher（2000 Michigan 博士导师）',null,yProof);
const yAid=audit(y,{phd:['confirmed_advisor',yEv,[p.uher,p.yang]],affiliation:['confirmed','UW 材料科学与工程系教授。',[p.yang]],research:['confirmed','UW 材料系原档列热电、储能材料及输运性质。',[p.yang]]},'继续找 2000 年 Michigan 学位论文签署页及是否有独立博士后岗位。');
relation(y,'phd',u,'advisor',yEv,[p.uher,p.yang],yAid,false);

const co='9701a640', he='师承人物 - Frank A. Hegmann', hu='师承人物 - Rupert Huber';
const heEv='Alberta 理学院报道引述 Cocker 本人由硕士转入博士，在 Hegmann 实验室开发太赫兹 STM。MSU 原档确认 2012 Alberta 博士研究 with Hegmann。记博士阶段研究师长，可信度高。';
const huEv='MSU 原档分列 Regensburg 博后、Humboldt Fellow 和 Junior Group Leader。Regensburg Huber 组原始校友名单列 Cocker，核组属。MSU 报道另明确较后的 Junior Group 在 Huber 领导下。正式博后导师职衔待核。';
const heProof=heEv+' '+cite('Alberta 理学院本人访谈',p.alberta)+cite('MSU 院系原档',p.cocker);
const huProof=huEv+' '+cite('Regensburg 组校友原档',p.huber)+cite('MSU 院系原档',p.cocker)+cite('MSU 项目报道',p.cockerNews);
replaceEdge(co,he,'博士合作／导师候选','博士阶段研究师长','博士合作／导师候选','博士阶段研究者',heProof);
replaceEdge(co,hu,'博士后合作／导师候选','博士后课题组负责人','博士后合作／导师候选','博士后课题组成员',huProof);
setBoundary(co,heProof+' '+huProof+' ARCNL 的 Paul Planken 为访问岗位 host，独立于 Regensburg 博后。');
changeRow(co,'Frank A. Hegmann（Alberta 博士阶段研究师长）','Rupert Huber（Regensburg 博后课题组负责人）',heProof+' '+huProof);
const coAid=audit(co,{phd:['group_or_candidate',heEv,[p.alberta,p.cocker]],postdoc:['group_or_candidate',huEv,[p.huber,p.cocker,p.cockerNews]],affiliation:['confirmed','MSU 物理与天文学系原档核实验物理和太赫兹纳米显微实验室。',[p.cocker]],research:['confirmed','院档列太赫兹扫描隧道与近场光学、超快电子动力学及复杂量子材料。',[p.cocker]]},'继续定位 Alberta 本人学位论文及 Regensburg 博后任用中的正式指导职衔。');
relation(co,'phd',he,'stage_mentor',heEv,[p.alberta,p.cocker],coAid,false);
relation(co,'postdoc',hu,'group_leader',huEv,[p.huber,p.cocker,p.cockerNews],coAid,false);

const bi='d5b84d0c', g='c58836b7', nag=local('334d75ce'), go=local(g);
const biPh='Nagel 组原档列 Norman O. Birge 为前成员。1985 年两人原论文同署 Chicago 物理与 James Franck Institute，与 MSU 系刊所列 1986 Chicago 博士和本人报告的玻璃转变研究吻合。保留博士阶段组属及 Nagel 正式导师待核。';
const biPd='MSU 系刊明确 1986 年 Chicago 博士之后在 Bell Labs 做两年博士后，1988 年加入 MSU。Golding 同期 Bell Labs 任职有 MSU 原档。Golding 个人指导仍为候选。';
const biPhProof=biPh+' '+cite('Nagel 实验室',p.nagel)+cite('1985 论文原档',p.birgePaper)+cite('MSU 系刊',p.birge);
const biPdProof=biPd+' '+cite('MSU 系刊',p.birge)+cite('Golding 院档',p.gold);
replaceEdge(bi,nag,'博士导师候选','博士阶段课题组负责人','博士候选','博士阶段课题组成员',biPhProof);
for(const [file,match] of [[fn(local(bi)),l=>l.startsWith('- 博士后导师候选：')&&l.includes('[['+go+'|')],[fn(go),l=>l.startsWith('- 博士后研究人员候选')&&l.includes('[['+local(bi)+'|')],[idx,l=>l.startsWith('- [['+local(bi)+'|')&&l.includes('[['+go+'|')]]){
 editLine(file,match,l=>l.slice(0,l.indexOf(']]。')+3)+biPdProof+' '+cite('既有候选线索','https://academictree-staging.thetransmitter.org/physics/peopleinfo.php?pid=448735'));
}
setBoundary(bi,biPhProof+' '+biPdProof+' Urazhdin 可能受 Birge 指导的反向候选保留。');
changeRow(bi,'Sidney R. Nagel（Chicago 博士阶段课题组负责人，正式指导待核）','1986–1988 Bell Labs 博后已核；Brage Golding（个人指导候选）',biPhProof+' '+biPdProof);
const biAid=audit(bi,{phd:['group_or_candidate',biPh,[p.nagel,p.birgePaper,p.birge]],postdoc:['group_or_candidate',biPd,[p.birge,p.gold]],affiliation:['confirmed','MSU 物理与天文学系 1988 年入职。',[p.birge]],research:['confirmed','MSU 系刊列介观物理、超导与磁性杂化结构和量子输运。',[p.birge]]},'找 Chicago 博士论文原档和 Bell Labs 岗位指导人，保留两阶段未明细节。');
relation(bi,'phd',nag,'group_leader',biPh,[p.nagel,p.birgePaper,p.birge],biAid,false);
relation(bi,'postdoc',go,'candidate',biPd,[p.birge,p.gold],biAid,false);
note(g,'- 核查边界：','MSU 系刊独立证实 Birge 的两年 Bell Labs 博后。此为 Golding 的反向候选，Golding 本人的 MIT 博士及 Bell Labs 岗位导师仍待原证。'+cite('MSU 系刊',p.birge));
changeRow(g,null,null,cite('Golding MSU 院档',p.gold)+'本人 1966 MIT 博士、1991 年前 Bell Labs 技术岗位 24 年。Birge 的 Bell Labs 博后属反向候选。');
audit(g,{affiliation:['confirmed','MSU 院系原档列物理与天文学系荣休教授，曾任 Bell Labs 两个研究部门负责人。',[p.gold]]},'MIT 学位库现有退避，待可访问时追 1966 学位档；继续核 Bell Labs 初任岗位及本人导师。');

const pr='e894f72f',prExt='师承人物 - William P. Pratt';
const prEv='MSU 院档核本人 1965 Minnesota 硕士、1967 Minnesota 博士，Minnesota 校董会档列物理研究助理。博士导师及本人博后仍待核。';
const prProof=prEv+' '+cite('MSU 院档',p.pratt)+cite('Minnesota 校董会档',p.prattMN);
note(pr,'- 核查边界：',prProof);
changeRow(pr,'1967 Minnesota 博士，导师待查',null,prProof);
audit(pr,{phd:['unresolved',prEv,[p.pratt,p.prattMN]],affiliation:['confirmed','MSU 院档列物理与天文学系荣休教授。',[p.pratt]],research:['confirmed','院档列自旋输运、多层磁性材料、近邻超导与自旋三重态。',[p.pratt]]},'按 Minnesota 学位年份追本人论文及毕业后的岗位档案。');
const upEv='Uher 本人履历在 Graduate and postdoctoral Advisors 中明确称 W. P. Pratt Jr. 为 Michigan State 的 postdoc mentor。保留博士后阶段研究师长标签与其他已核指导关系。';
const upProof=upEv+' '+uCV;
editLine(fn(u),l=>l.startsWith('- 博士后研究师长：')&&l.includes('[['+prExt+'|'),l=>l+' '+upProof);
mentorLine(prExt,uher,'- 博士后阶段研究成员：',upProof);
inverse(uher,local(pr),'博士后研究者',upProof);
indexLine(uher,prExt,'博士后研究师长',upProof);
changeRow(uher,null,null,upProof);
const upAid=audit(uher,{postdoc:['group_or_candidate',upEv+' 其他已核 Michigan State 指导和 CSIRO 博后阶段保留。',[p.uher]]},'分别核 CSIRO 的具名指导及 MSU 任用各师长的正式职衔，并复核博士授位年份。');
relation(uher,'postdoc',prExt,'stage_mentor',upEv,[p.uher],upAid,false);

const fa='3e9371a9',gr='师承人物 - José Joaquim de Almeida Grácio';
const faEv='Aveiro 研究者署名论文引本人 1999 年 Aveiro 博士论文 Diamond Growth on Metals。同期金刚石涂层原论文列 Fan 与 Grácio 为合作者。葡萄牙官方公报核 Grácio 的 Aveiro 聘任和其为 Fan 2000 年受聘签署同行意见。Grácio 为低可信博士导师候选。';
const faProof=faEv+' '+cite('论文参考文献原文',p.fanTh)+cite('同期研究原文',p.fanPaper)+cite('葡萄牙政府公报',p.pt);
newMentor(gr,'José Joaquim de Almeida Grácio','Aveiro 大学历史任职，研究金刚石薄膜及表面工程。'+cite('葡萄牙政府公报',p.pt),fa,'博士阶段反向候选',faProof);
addEdge(fa,'博士导师候选',gr,'José Joaquim de Almeida Grácio',faProof,null,true);
note(fa,'- 核查边界：',faProof+' 2000 年 Aveiro 兼职受聘为客座助理教授，后任 South Dakota State 副教授。两个职位单独登记，博后经历待原证。'+cite('MSU 入职档',p.fanHire));
changeRow(fa,'José Joaquim de Almeida Grácio（低可信博士导师候选）','待核；2000 Aveiro 客座助理教授为单列岗位',faProof);
const faAid=audit(fa,{phd:['group_or_candidate',faEv,[p.fanTh,p.fanPaper,p.pt]],postdoc:['unresolved','葡萄牙官方档核 2000 年 Aveiro 兼职客座助理教授。独立博士后经历待查。',[p.pt,p.fanHire]],affiliation:['confirmed','MSU 工学院列电气与计算机工程及化学工程与材料科学的关联。',[p.fan,p.fanHire]],research:['confirmed','MSU 入职档列等离子体与表面、光伏薄膜、半导体及能源材料。',[p.fanHire]]},'按论文全题名查 Aveiro 目录与签署页，核博士后是否有独立岗位。');
relation(fa,'phd',gr,'candidate',faEv,[p.fanTh,p.fanPaper,p.pt],faAid);

const ho='524cbe7c',ca='师承人物 - Carl R. Kannewurf';
const hoEv='Hogan 的 MSU 工学院履历列 1996 Northwestern 博士。1996 年热电研究原文列 Hogan 与 Carl R. Kannewurf 同署 Northwestern 电气工程与计算机科学系。保留 Kannewurf 为低可信博士导师候选。';
const hoProof=hoEv+' '+cite('MSU 工学院',p.hogan)+cite('Northwestern 托管原文',p.hoganPaper);
addEdge(ho,'博士导师候选',ca,'Carl R. Kannewurf',hoProof,null,true);
inverse(ho,ca,'博士阶段反向候选',hoProof);
note(ho,'- 核查边界：',hoProof);
changeRow(ho,'Carl R. Kannewurf（低可信博士导师候选）',null,hoProof);
const hoAid=audit(ho,{phd:['group_or_candidate',hoEv,[p.hogan,p.hoganPaper]],affiliation:['confirmed','MSU 工学院目录列电气与计算机工程副教授。',[p.hogan]],research:['confirmed','工学院目录列热电材料和薄膜电子材料。',[p.hogan]]},'查 Northwestern 学位论文及任职履历，MSU 托管旧 CV 入口本轮 cache miss。');
relation(ho,'phd',ca,'candidate',hoEv,[p.hogan,p.hoganPaper],hoAid);

const wb='d8f108a9';
const wbEv='MSU 化学系个人谱系页列 Gary Wayne Brudvig、Warren Findlay Beck 及 1988 Yale 学位。MSU 教师档独立核 1989–1991 Berkeley Miller 博后。Sauer 同事所写纪念文的合照同时含学生、博士后和访客，证据不足以区分个人角色。';
const wbProof=wbEv+' '+cite('MSU 化学系个人谱系',p.beckGen)+cite('MSU 化学系教师页',p.beck)+cite('Sauer 纪念文及图注',p.sauer);
note(wb,'- 核查边界：',wbProof);
changeRow(wb,null,'1989–1991 Berkeley Miller 博后；个人指导待核',wbProof);
audit(wb,{phd:['group_or_candidate','MSU 化学系个人谱系和工作表一致指向 Brudvig，保留为候选，等待 Yale 学位原证。',[p.beckGen]],postdoc:['unresolved','MSU 履历确认 Miller 博后；Sauer 团队合照含多种身份，未提供 Beck 的个人指导关系。',[p.beck,p.sauer]]},'查 Yale 论文签署页及 Berkeley Miller fellowship 记录，出版社纪念文附录本轮未读。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_MSU与Uher指导档';
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

