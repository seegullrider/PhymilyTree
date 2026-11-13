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
 a.audit_id='20261110_'+id+'_bell_and_appointments_0932';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_bell_and_appointments_0932_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const haf='6106659d', mad='658cf8a7', cah='6d81f0c4', forest='d1b04e2a', ben='6fb96cb8', parNt='6f38527b', parCa='90af3728', am='6bdd2d04', zhu='6f324c9e';
const jack='师承人物 - Jack Rowe', jt='师承人物 - Jacob M. Taylor', ham=local('cc4bbab8'), allara='师承人物 - David L. Allara';
const hcv='https://www.umdphysics.umd.edu/images/CV/2023/Hafezi_CV.pdf', hnews='https://ece.umd.edu/sites/ece.umd.edu/files/connections_magazine_2014.pdf', hpre='https://arxiv.org/pdf/1102.3256', tcv='https://umdphysics.umd.edu/images/CV/curriculum-vitaeV8.pdf';
const mcv='https://viterbi.usc.edu/directory/cv/madhukar_anupam_cv.pdf', musc='https://viterbi.usc.edu/directory/faculty/Madhukar/Anupam';
const ccv='https://cahill.matse.illinois.edu/files/2023/01/cv23.pdf', cp='https://research.ibm.com/publications/ultrafast-time-resolution-in-scanned-probe-microscopies', hamcv='https://hamersgroup.chem.wisc.edu/wordpress/wp-content/uploads/2023/07/hamers_vita_july_2023-2.pdf', cill='https://physics.illinois.edu/people/directory/profile/d-cahill';
const fcv='https://forest.web.unc.edu/wp-content/uploads/sites/3313/2013/10/Forest-Full-CV-Jan-14-2017.pdf', fa='https://appliedmath.arizona.edu/person/m-gregory-forest';
const bOther='https://etd.ohiolink.edu/acprod/odb_etd/ws/send_file/send?accession=case1270141838&disposition=inline', bMusic='https://case.edu/artsci/music/about/people/faculty/peter-bennett', bAsu='https://asu.elsevierpure.com/en/persons/peter-bennett/', bLab='https://physics.asu.edu/researchgroup/peter-bennett', bWebb='https://www.physics.wisc.edu/tributes-to-professor-barney-webb/', bMemo='https://www.homepages.ucl.ac.uk/~ucapikr/Sally_PhysScripta_2015.pdf';
const pcv='https://parikh.ucdavis.edu/sites/g/files/dgvnsk1906/files/inline-files/PARIKH_cv_complete_2018.pdf', pntu='https://www.ntu.edu.sg/mse/about-us/our-people/faculty-staff', acv='https://engineering.nyu.edu/news/new-industry-assistant-professor-amelia-klein-bringing-quantum-optics-classroom', zu='https://physics.ucdavis.edu/people/faculty/xiangdong-zhu';

function inverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}
const he='本人 CV 将 JQI 任职分为 2009–2012 Research Associate 和 2012–2014 Senior Research Associate；Maryland ECE 2014 年院刊称其自 Harvard 博士毕业后为 JQI 博士后研究者。2011 原论文中 Hafezi 和 Jacob M. Taylor 同署 JQI，Taylor 本人 CV 列其 2009 年起在 JQI/NIST，并列多年后续合作；Taylor 暂列低可信博后候选，阶段及任命待查。';
const hp=web('Hafezi 本人 CV',hcv)+' · '+web('Maryland ECE 2014 院刊',hnews)+' · '+web('同期作者原稿',hpre)+' · '+web('Taylor 本人 CV',tcv)+'。'+he;
addEdge(haf,'博士后导师候选',jt,'Jacob M. Taylor',hp,null,true);
newMentor(jt,'Jacob M. Taylor','Maryland 本人 CV 列 2009 年起 JQI／NIST，研究量子信息和光子系统。'+web('Maryland 本人 CV',tcv)+'。',haf,'博士后候选研究者',hp);
note(haf,'- 核查边界：',web('本人履历',hcv)+'明确两个 JQI 职位的年份，'+web('Maryland ECE 2014 年院刊',hnews)+'记博士后研究经历。');
changeRow(haf,null,'JQI 博士后研究经历；Jacob M. Taylor（低可信候选）',web('本人 CV',hcv)+' · '+web('Maryland ECE 2014 院刊',hnews));
const ha=audit(haf,{postdoc:['group_or_candidate',he,[hcv,hnews,hpre,tcv]],affiliation:['confirmed','本人履历列 ECE 与 Physics 双聘，以及 Joint Quantum Institute。',[hcv,hnews]],research:['confirmed','Maryland ECE 档与本人研究成果确认量子光学、拓扑光子学、量子模拟及光机械。',[hnews,hpre]]},'查 JQI Research Associate 初聘档案和个人指导字段，区分 JQI 早期与 Senior Research Associate。');
relation(haf,'postdoc',jt,'candidate',he,[hcv,hnews,hpre,tcv],ha);

const me='USC 本人 CV 的 Work Experience 明列 1971–1972 Caltech Applied Physics 博后，1972–1974 IBM T. J. Watson 博后。另列 1974–1976 Chicago James Franck Institute Louis Block Fellow，保留其原称，岗位性质和各阶段个人导师待查。';
editLine(fn(local(mad)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('USC 本人 CV',mcv)+'。'+me);
changeRow(mad,null,'Caltech 1971–1972、IBM 1972–1974 两段博后；Chicago 1974–1976 Louis Block Fellow；指导待核',web('USC 本人 CV',mcv)+' · '+web('USC 工程院原档',musc));
audit(mad,{postdoc:['unresolved',me,[mcv,musc]],affiliation:['confirmed','USC 工程学院院系档列化工与材料、生物医学工程及电气与计算机工程，履历并列 Physics。',[musc]],research:['confirmed','USC 档列半导体外延量子点、单光子源及量子光子线路。',[musc]]},'查 Caltech Applied Physics 1971–1972、IBM 1972–1974 任命档和 Chicago 1974–1976 fellowship 的历史性质及个人指导。');

const ce='Cahill 本人 UIUC CV 明列 IBM Watson 1989–1991 Postdoctoral Research Associate。Hamers 本人 CV 列 1986–1990 IBM 纳米物理 Research Staff Member；IBM 原档列两人 1990 年合作，按岗位重叠和同领域合著列低可信博后候选。';
const cpp=web('Cahill 本人 CV',ccv)+' · '+web('IBM 同期原档',cp)+' · '+web('Hamers 本人 CV',hamcv)+'。'+ce;
addEdge(cah,'博士后导师候选',ham,'Robert J. Hamers',cpp,null,true);
inverse(cah,ham,'博士后候选研究者',cpp);
note(cah,'- 核查边界：',web('本人 UIUC CV',ccv)+'列 Cornell 实验凝聚态 1989 年 8 月博士及 IBM Watson 博后，两个阶段的个人导师均仍为候选。');
changeRow(cah,null,'IBM Watson 1989–1991；Robert J. Hamers（低可信候选）',web('本人 UIUC CV',ccv)+' · '+web('IBM 同期原档',cp));
const ca=audit(cah,{postdoc:['group_or_candidate',ce,[ccv,cp,hamcv]],affiliation:['confirmed','UIUC 原档和本人 CV 核材料科学与工程及物理等关联。',[cill,ccv]],research:['confirmed','UIUC CV 核纳米材料热输运、热导测量和界面。',[ccv,cill]]},'查 Cornell 图书馆博士学位档及 IBM Watson 初聘或完整履历；两位候选均需正式指导证据。');
relation(cah,'postdoc',ham,'candidate',ce,[ccv,cp,hamcv],ca);

const fe='UNC 托管的本人 2017 CV 列 1979 年 8 月 Arizona 博士，Tenure-Track Faculty Positions 栏列 Ohio State 1979–1996、UNC 1996 起；所阅未列独立博士后。后续访问职位另列，最早 1983 年。';
const fp=web('UNC 本人 2017 CV',fcv)+'。'+fe;
enrich(forest,'phd','师承人物 - David McLaughlin','博士生',web('UNC 本人 CV',fcv)+'明列 Ph.D. Adviser David W. McLaughlin；Arizona 官方校友档另核共同导师 Hermann Flaschka。');
editLine(fn(local(forest)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+fp+' Arizona 博士校友原档同时确认论文题目、正式导师与共同导师。');
changeRow(forest,null,'所阅未列独立博后；1979 年起 Ohio State tenure-track',web('UNC 本人 2017 CV',fcv));
const fA=audit(forest,{phd:['confirmed_advisor','UNC 本人 CV 明列 Ph.D. Adviser David W. McLaughlin；Arizona 原档另列 Co-Advisor Hermann Flaschka。',[fcv,fa]],postdoc:['no_postdoc_documented',fe,[fcv,fa]]},'若发现同年独立博士后任命再核，保留 Arizona 学位资料所载两位博士导师。');
relation(forest,'phd','师承人物 - David McLaughlin','advisor','本人 CV 列 Ph.D. Adviser；Arizona 博士校友档亦明确。',[fcv,fa],fA,false);

const rb='同期合作者的 Physica Scripta 回忆明确称 Peter Bennett 是在 Bell Labs 与 Jack Rowe 共事的博士后，并回忆 Bennett 在 Wisconsin 随 Barney Webb 研究硅 7×7；回忆中同一论文的合著者列作 J. E. Rowe。Bell Labs 关系列博士后阶段研究师长；正式个人任命及 Jülich 段指导仍待核。';
const bp=web('UCL 托管的同期合作者回忆第 5 页',bMemo)+'。'+rb;
addEdge(ben,'博士后阶段研究师长',jack,'Jack Rowe（J. E. Rowe）',bp,'师承人物 - Maurice Barnett Webb');
newMentor(jack,'Jack Rowe','Bell Labs 表面物理研究者，论文署名 J. E. Rowe。'+web('UCL 托管的同期合作者回忆',bMemo)+'。',ben,'博士后阶段研究者',bp);
const bx='Case Western Reserve 论文作者为 Richard Kolb，题页把 Peter Bennett 列为音乐学论文导师；Case Western 音乐系原档为早期音乐教师，与 ASU 物理系及其 Wisconsin 物理博士履历不同。';
note(ben,'- 核查边界：',web('Bell Labs 同期合作者回忆',bMemo)+'具名 Jack Rowe；'+web('同名 Case Western 音乐系档',bMusic)+'与物理学者分开。');
changeRow(ben,null,'Bell Labs：Jack Rowe（阶段研究师长）；Jülich 指导者待核',web('同期合作者回忆',bMemo));
const ba=audit(ben,{identity:['confirmed',bx,[bOther,bMusic,bAsu,bWebb]],affiliation:['confirmed','ASU 官方研究目录列 Physics、Materials Science and Engineering 及 Photonics Innovation。',[bAsu,bLab]],research:['confirmed','物理系课题组原档列自组装表面纳米结构、电子输运及表面表征。',[bLab,bAsu]],postdoc:['group_or_candidate',rb,[bMemo,bAsu]]},'追查 Bell Labs 正式 mentor/appointment 以及 Jülich 个人指导，核 Wisconsin 学位签署档；Case Western 同名音乐教师来源已排除。');
relation(ben,'postdoc',jack,'stage_mentor',rb,[bMemo,bAsu],ba);

const pe='本人 UC Davis CV 列 1987–1994 Penn State 聚合物博士，1994–1996 Penn State 材料博后，1996–1998 LANL 博后，后转技术员额。NTU 2016 原讲座的 1993 年博士记录暂并列。本人 CV 书目列 1992 年与 David L. Allara 合著及其后连续合作，Allara 暂列低可信博士候选。';
const pp=web('UC Davis 托管本人 2018 CV',pcv)+'。'+pe;
for(const id of [parNt,parCa]){
 addEdge(id,'博士导师候选',allara,'David L. Allara',pp,null,true);
 inverse(id,allara,'博士候选研究者',pp);
 changeRow(id,'David L. Allara（低可信候选；博士年 1993/1994 待核）','Penn State 1994–1996、LANL 1996–1998；导师待核',web('本人 2018 CV',pcv)+' · '+web('NTU 现任教师目录',pntu));
 const aspects={phd:['group_or_candidate',pe,[pcv]],postdoc:['unresolved','本人履历分别列 Penn State 1994–1996 和 Los Alamos 1996–1998 博后，均未命名指导者。',[pcv]]};
 if(id===parNt)aspects.affiliation=['confirmed','NTU 现行学校目录列 MSE 教授及 IDMxS 联合主任；UC Davis 2018 CV 用作历史履历。',[pntu,pcv]];
 const pa=audit(id,aspects,'查 Penn State 学位档核毕业年及 Allara 个人导师身份，查两阶段博后任命；现任双聘仍需近期 UC Davis 原档确认。');
 relation(id,'phd',allara,'candidate',pe,[pcv],pa);
}

const ae='NYU Tandon 原入职报道列 Applied Physics 教学轨，Penn 博士研究固态缺陷（含金刚石 NV 色心与 GaN 中稀土离子）；未列独立博后或正式论文导师。';
note(am,'- 核查边界：',web('NYU Tandon 入职原档',acv)+'。'+ae);
changeRow(am,null,'NYU 入职档未列独立博后；继续查个人完整履历',web('NYU Tandon 入职原档',acv));
audit(am,{identity:['confirmed',ae,[acv]],affiliation:['confirmed','NYU Applied Physics 教学轨，Industry Assistant Professor。',[acv]],research:['confirmed','固态缺陷、量子光学、半导体以及量子光学教学。',[acv]]},'查 Penn 博士毕业论文登记及最终共同导师称谓，保留 Engheta CV 旧来源，核实是否有独立博后。');

const ze='UC Davis 物理系个人页学术任职栏明确 Berkeley 1989 博士、UC Davis 1989–1993 助理教授，未列独立博士后职位。本人旧完整 CV 访问超时。';
note(zhu,'- 核查边界：',web('UC Davis 物理系本人原档',zu)+'。'+ze);
changeRow(zhu,null,'所阅未列独立博后；1989 年获博士并开始任 UC Davis 助理教授',web('UC Davis 原档',zu));
audit(zhu,{postdoc:['no_postdoc_documented',ze,[zu]],affiliation:['confirmed','UC Davis 物理系原档列物理与应用物理教授。',[zu]],research:['confirmed','本人学校档核表面与薄膜物理、磁光与非线性光学。',[zu]]},'到期后对照既有 Berkeley 博士论文与完整 CV，核 1989 年两个职位的精确年月。');

if(process.argv[2]==='apply'){
 const excluded=[{page_id:'14122af9c2125848c68020c1',record_id:ben,url:bOther,external_subject:'Peter Bennett，Case Western Reserve 音乐学教师',audit_id:ba,evidence:bx}];
 fs.writeFileSync('20261110_两段履历与BellLabs核查_同名排除.json',JSON.stringify(excluded,null,2)+'\n','utf8');
}

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_两段履历与BellLabs核查';
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
