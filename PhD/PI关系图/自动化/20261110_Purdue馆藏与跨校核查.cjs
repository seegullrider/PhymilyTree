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
 a.audit_id='20261110_'+id+'_purdue_and_identity_0919';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_purdue_and_identity_0919_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const kay='5a213693', alex='53012ae4', moh='4b3d7e75', islam='f6811f76', wan='45a13a33', ari='4b7afdfb';
const chen=local('a21b319c'), basov=local('ff867a7c'), webb='师承人物 - Richard A. Webb';
const kAdv='https://docs.lib.purdue.edu/dissertations/AAI10745115/', kChair='https://docs.lib.purdue.edu/open_access_dissertations/1791/', kPsu='https://science.psu.edu/frontiers/archive/2024/morteza-kayyalha-nitin-samarth', kMat='https://www.matse.psu.edu/directory/morteza-kayyalha';
const aPhd='https://www.simonsfoundation.org/event/qclub-seminar-dr-alexander-s-mcleod/', aPost='https://science.fas.columbia.edu/news/columbia-researchers-squeeze-light-into-nanoscale-devices-and-circuits/', aFellow='https://acmc.bilkent.edu.tr/wp-content/uploads/2024/11/ACMC-AlexMcLeod.pdf';
const mPaper='https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.78.3366', mWebb='https://www.physics.umd.edu/rgroups/spin/intro.html', mGroup='https://www.rajmohanty.org/papers', mBu='https://www.bu.edu/eng/profile/pritiraj-mohanty/', mTeam='https://www.femtodx.com/team';
const iDavis='https://ece.ucdavis.edu/directory/m-saif-islam', iUc='https://citris-uc.org/people/person/m-saif-islam/';
const wNus='https://cde.nus.edu.sg/mse/staff/yi-wan/', wTung='https://www.vctunglab.org/group-news/', wOther='https://epublications.marquette.edu/dissertations_mu/2214/';
const rNus='https://www.physics.nus.edu.sg/faculty/ariando/', rTwente='https://www.utwente.nl/en/tnw/ice/alumni/', rOther='https://etd.ohiolink.edu/acprod/odb_etd/r/etd/search/10?clear=10&p10_accession_num=case1515170982121573&session=10346859909524', rNtu='https://www.ntu.edu.sg/docs/librariesprovider152/cn-yang-100/cn-yang-100-booklet_ver-7-june-compressed.pdf?sfvrsn=4ce19e96_3';

const ke='Purdue 馆藏同名博士论文的 Advisors 栏列 Chen；另一原始馆藏记录列 Yong P. Chen 为论文委员会主席、Zhihong Chen 为委员，并列 2018 年 5 月 ECE 博士。Yong P. Chen 本人 2024 履历的博士生栏目列作者、学位年份与同一题名，三处交叉支持明确博士导师。';
const kp=web('Purdue 馆藏导师字段',kAdv)+' · '+web('委员会全名与学位',kChair)+' · '+web('Yong P. Chen 本人履历','https://www.physics.purdue.edu/quantum/docs/yongpchen_CVfull.pdf')+'。'+ke;
function overwriteEdge(file,label,target,newLabel,proof){
 editLine(file,l=>l.startsWith(label)&&l.includes('[['+target+'|'),l=>{
  const end=l.indexOf(']]',l.indexOf('[['+target+'|'))+2;
  return l.slice(0,end).replace(label,newLabel)+'。'+proof;
 });
}
overwriteEdge(fn(local(kay)),'- 博士阶段研究师长（论文委员会主席）：',chen,'- 博士导师：',kp);
overwriteEdge(fn(chen),'- 博士阶段研究者：',local(kay),'- 博士生：',kp);
const ik='- [['+local(kay)+'|Morteza Kayyalha]] → ';
overwriteEdge(idx,ik+'博士阶段研究师长（论文委员会主席）：',chen,ik+'博士导师：',kp);
editLine(fn(local(kay)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Purdue ECE 博士导师由馆藏导师字段及完整姓名交叉核实。'+web('Penn State 理学院原档',kPsu)+'载 2018–2020 年在 Penn State 物理系任博士后。Chang 组原页仍返回 502，保留低可信候选组属；正式个人导师待核。');
changeRow(kay,'Yong P. Chen（Purdue 博士论文导师）','Penn State 物理系博士后；Cui-Zu Chang 为候选组负责人',web('博士导师字段',kAdv)+' · '+web('委员会全名',kChair)+' · '+web('Penn State 原档',kPsu));
const ka=audit(kay,{phd:['confirmed_advisor',ke,[kAdv,kChair,'https://www.physics.purdue.edu/quantum/docs/yongpchen_CVfull.pdf']],postdoc:['group_or_candidate','Penn State 理学院原档确认 2018–2020 年物理系博士后；Chang 组原文返回 502，仅保留已有候选组关系。',[kPsu,'https://sites.psu.edu/changresearch/members/']],affiliation:['confirmed','Penn State 原档核电气工程、材料跨学科项目。',[kMat,kPsu]],research:['confirmed','Penn State 量子器件实验室研究量子材料电、热电及超导性质。',[kPsu,kMat]]},'退避后追查 Chang 组 2018 任命原文或本人 CV，区分组属和个人指导。');
relation(kay,'phd',chen,'advisor',ke,[kAdv,kChair,'https://www.physics.purdue.edu/quantum/docs/yongpchen_CVfull.pdf'],ka,false);

const ae='Columbia 2018 原报道明确列 Alexander S. McLeod 为 Basov Nano-optics Laboratory 的博士后研究科学家；Bilkent 报告履历列 Columbia Nano Initiative 博后 fellowship（2017–2021）。归类博士后课题组，个人导师任命待核。';
const ap=web('Columbia 同期原报道',aPost)+' · '+web('Bilkent 报告履历',aFellow)+'。'+ae;
enrich(alex,'phd',basov,'博士生',web('Simons 2018 讲座档',aPhd)+'称 UCSD 博士阶段由 Basov 指导。');
addEdge(alex,'博士后课题组负责人',basov,'Dmitri N. Basov',ap,basov);
editLine(fn(basov),l=>l.startsWith('- 博士生：')&&l.includes('[['+local(alex)+'|'),l=>l+'\n- 博士后课题组成员：[['+local(alex)+'|Alex McLeod]]。'+ap);
editLine(fn(local(alex)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：UCSD 博士导师 Basov 已核。Columbia 原报道确认博士后课题组；继续查 fellowship 个人指导字段。');
changeRow(alex,null,'Columbia 博士后；Dmitri N. Basov（课题组负责人）',web('Columbia 同期原报道',aPost)+' · '+web('Simons 博士监督',aPhd));
const aa=audit(alex,{phd:['confirmed_advisor','Simons 2018 讲座档复核 2017 UCSD 博士明确由 Basov 指导。',[aPhd]],postdoc:['group_or_candidate',ae,[aPost,aFellow]]},'查 Columbia Nano Initiative Director’s Fellow 任命或本人 CV 中的独立指导字段。');
relation(alex,'postdoc',basov,'group_leader',ae,[aPost,aFellow],aa);

const me='本人履历列 Maryland 博士；1997 年 APS 原文列 P. Mohanty 与 R. A. Webb 同署 University of Maryland 物理系超导研究中心，本人书目确认 P. Mohanty 是 Pritiraj Mohanty，并收录两人持续合作的论文。Maryland 原课题组介绍具名 Webb。暂列博士阶段低可信候选。';
const mp=web('1997 APS 原文',mPaper)+' · '+web('本人发表列表',mGroup)+' · '+web('Maryland 课题组原档',mWebb)+'。'+me;
addEdge(moh,'博士导师候选',webb,'Richard A. Webb',mp,null,true);
newMentor(webb,'Richard A. Webb','Maryland 物理系研究组负责人，介观输运与低温量子物理。'+web('Maryland 课题组原档',mWebb)+'。',moh,'博士候选研究者',mp);
changeRow(moh,'Richard A. Webb（低可信候选）',null,web('1997 APS 原文',mPaper)+' · '+web('Maryland 组档',mWebb));
const ma=audit(moh,{phd:['group_or_candidate',me,[mPaper,mWebb,mGroup,mTeam]],affiliation:['confirmed','Boston University 现任原档用 Pritiraj Mohanty。',[mBu]],research:['confirmed','本人实验室及 BU 原档支持量子输运、纳米机电及传感。',[mBu,mGroup]]},'查 Maryland 超导研究中心历届博士论文、博士学位登记或本人完整学术 CV，核 Webb 的个人指导角色。');
relation(moh,'phd',webb,'candidate',me,[mPaper,mWebb,mGroup,mTeam],ma);

const ie='UC 的 CITRIS 原档确认 UCLA ECE 2001 博士，2001–2004 履历列 JDS Uniphase 光网络组与 HP Labs 量子科学组。原档未将 postdoctoral fellow 职称分配至具体机构或个人。';
note(islam,'- 核查边界：',web('CITRIS 原履历',iUc)+'。'+ie);
changeRow(islam,null,'2001–2004 JDS Uniphase／HP Labs；具体博后岗位及导师待核',web('CITRIS 原履历',iUc)+' · '+web('UC Davis 电气与计算机工程系',iDavis));
audit(islam,{identity:['confirmed','CITRIS 核 UCLA ECE 2001 博士及 UC Davis 本人；与 Ming C. Wu 原组档中的 M. Saiful Islam 学位年和去向一致。',[iUc,iDavis]],postdoc:['unresolved',ie,[iUc,iDavis]],affiliation:['confirmed','UC Davis 原档列电气与计算机工程系教授兼系主任。',[iDavis]],research:['confirmed','UC Davis 原档列半导体、纳米器件、光电探测。',[iDavis,iUc]]},'查 HP Labs／JDS 人事或本人完整 CV，分配职位、年份和阶段指导；查 UCLA 博士论文导师字段。');

const we='NUS 本人院系履历列 KAUST 材料科学与工程博士，后任香港大学 Research Assistant Professor。研究为二维过渡金属硫族化物及其器件。Marquette 1998 机械工程同名博士研究座椅悬架，确认不同人。';
note(wan,'- 核查边界：',web('NUS 材料系原档',wNus)+' · '+web('排除的同名 Marquette 档',wOther)+'。'+we);
changeRow(wan,null,'已核港大 Research Assistant Professor；独立博后经历与导师待查',web('NUS 本人原档',wNus)+' · '+web('Tung 实验室原档',wTung));
const wa=audit(wan,{identity:['confirmed',we,[wNus,wTung,wOther]],affiliation:['confirmed','NUS 材料科学与工程系原档列助理教授。',[wNus]],research:['confirmed','本人 NUS 档列二维过渡金属硫族化物及相关器件。',[wNus]],postdoc:['unresolved','NUS 原档核港大 Research Assistant Professor；个人博士后经历和导师待查。',[wNus]]},'查 KAUST 学位档镜像或签署、港大原人事档和完整 CV；同名 Marquette 学位档已排除。');

const re='NUS 物理系原档列 Twente 2005 年博士及量子材料研究，Twente ICE 校友原档列 Ariando 为博士组校友；NTU 会议履历记录 NanoNed 博士后。OhioLINK 档为 David Joseph Ariando 的 2018 年 Case Western Reserve 便携式核磁方向硕士，确认不同人。';
note(ari,'- 核查边界：',web('Twente ICE 组档',rTwente)+' · '+web('排除的同名 OhioLINK 档',rOther)+'。'+re);
changeRow(ari,null,'NanoNed 博士后；具体课题组和指导者待核',web('Twente ICE 博士组名录',rTwente));
const ra=audit(ari,{identity:['confirmed',re,[rNus,rTwente,rNtu,rOther]],affiliation:['confirmed','NUS 物理系原档核 Provost’s Chair Professor 及研究副主任。',[rNus]],research:['confirmed','NUS 原档核量子氧化物界面、拓扑量子材料与强关联。',[rNus]],postdoc:['unresolved','NTU 履历确认 NanoNed 博士后，个人指导待核；Twente 组名录把 Ariando 列为 former PhD。',[rNtu,rTwente]]},'查 NanoNed fellowship／任命原档；其博士组同事在早期合著中已出现，暂不用于博后正式关系。');

const base='20261110_Purdue馆藏与跨校核查';
const exclusions=[
 {page_id:'1f2c19deed6655cea7bf08df',record_id:wan,url:wOther,external_subject:'Yi Wan，Marquette 1998 年机械工程博士',audit_id:wa,evidence:we},
 {page_id:'76edc2b99178b3ed1a4b6b0a',record_id:ari,url:rOther,external_subject:'David Joseph Ariando，Case Western Reserve 2018 年硕士',audit_id:ra,evidence:re}
];
if(process.argv[2]==='apply')fs.writeFileSync(base+'_同名排除.json',JSON.stringify(exclusions,null,2)+'\n','utf8');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Purdue馆藏与跨校核查';
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
