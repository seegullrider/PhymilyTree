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
 a.audit_id='20261110_'+id+'_appointments_and_roles_1540';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_appointments_and_roles_1540_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const src={
brus:'https://www.columbia.edu/cu/chemistry/groups/brus/members.html',
sfm:'https://www.mse.gatech.edu/people/matthew-sfeir',
sfb:'https://www.bnl.gov/newsroom/news.php?a=212878',
sfc:'https://www.gc.cuny.edu/people/matthew-sfeir',
ang:'https://www.eea.tsinghua.edu.cn/en/info/1038/3506.htm',
xj:'https://meeting.xjtu.edu.cn/wxlecturecontent/6819',
cv:'https://people.sutd.edu.sg/ricky_ang/wp-content/uploads/2021/12/2021-12-CV.pdf',
jproj:'https://research.jku.at/en/projects/nmr-spectroscopy-of-co-polymers/',
jmain:'https://prisma.uni-mainz.de/en/2023/01/18/grosse-auszeichnung-fuer-prisma-gastwissenschaftler/',
pines:'https://escholarship.org/content/qt9zc0c575/qt9zc0c575.pdf',
man:'https://escholarship.org/content/qt9xf3p117/qt9xf3p117.pdf',
manlab:'https://manikantan.faculty.ucdavis.edu/people/',
manbio:'https://mae.ucsd.edu/seminar/2023/tunable-collective-dynamics-inclusions-viscous-biological-membranes',
mansq:'https://sites.google.com/site/hmanikantan/home',
fullcat:'https://catalog.ucsd.edu/faculty/NANO.html',
fulljac:'https://jacobsschool.ucsd.edu/node/3309',
fullrep:'https://www.osti.gov/servlets/purl/5430644',
alt:'https://columbia.edu/cu/physics/fac-bios/Atlshuler/faculty.html',
aron:'https://physicstoday.aip.org/obituaries/arkady-aronov'};
const link=(label,u)=>web(label,u);
const select=(file,start,target,edit)=>editLine(file,l=>l.startsWith(start)&&l.includes('[['+target+'|'),edit);
const iNote=(id,target,proof)=>select(idx,'- [['+local(id)+'|',target,l=>l+' '+proof);
const nNote=(id,prefix,target,proof)=>select(fn(local(id)),'- '+prefix+'：',target,l=>l+' '+proof);
const rev=(id,target,prefix,proof)=>select(fn(target),'- '+prefix+'：',local(id),l=>l+' '+proof);
const stampSchool=(id,old,newValue)=>editLine(path.join(root,records.get(id).unit+'逐人复核记录.md'),l=>l.startsWith('| [['+local(id)+'|'),l=>{if(!l.includes(old))throw Error('school affiliation not matched '+id);return l.replace(old,newValue)});
const readAudit=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,extra,urls)=>{const prev=readAudit(id,k);return [prev.status,prev.note+' '+extra,urls];};

const s='142f9ae4',br='人员 - Columbia - Louis E. Brus — 已故 - 17cdecad';
const sp='Columbia Brus 组同期原档列 Sfeir 为研究生，Georgia Tech 材料系教师档列 2005 Columbia 化学物理博士。Brus 记作博士阶段课题组负责人，正式论文导师待查。';
const sd='Brookhaven 原档列 2005 年起为凝聚态物理与材料科学部 Postdoctoral Research Associate，2009 年转 CFN assistant scientist。博后指导者未列。';
const sa='Georgia Tech 材料院档列化学与生物化学、材料科学与工程双院系。CUNY 原档另列物理兼职教授与 ASRC 关联教师。';
const sl=link('Columbia Brus 组原档',src.brus)+' · '+link('Georgia Tech 材料院档',src.sfm);
const sl2=link('Brookhaven 任用原档',src.sfb)+' · '+link('CUNY 院档',src.sfc);
nNote(s,'博士阶段课题组负责人',br,sp+' '+sl);rev(s,br,'博士课题组成员',sp+' '+sl);iNote(s,br,sp+' '+sl);
note(s,'- 核查边界：',sd+' '+sa+' '+sl2);
changeRow(s,null,'Brookhaven 2005 起任博后，2009 转 CFN 助理科学家；导师待核',sl+' · '+sl2);
const as=audit(s,{identity:['confirmed','Columbia 组档与 Georgia Tech 材料院档交叉匹配 Sfeir。',[src.brus,src.sfm]],affiliation:['confirmed',sa,[src.sfm,src.sfc]],research:['confirmed','Georgia Tech 材料院档确认超快光谱、纳米光子学、有机半导体与光电子。',[src.sfm]],phd:['group_or_candidate',sp,[src.brus,src.sfm]],postdoc:['unresolved',sd,[src.sfb,src.sfm]]},'追 Columbia 2005 化学物理论文原件及 Brookhaven 凝聚态物理与材料科学部 2005 年具名指导或聘任档。');
relation(s,'phd',br,'group_leader',sp,[src.brus,src.sfm],as,false);

const a='1407bda3',lau='师承人物 - Y. Y. Lau';
const aa='清华电机系任用公告列 SUTD SMT 终身教授、副教务长及清华杰出访问教授。清华职务按访问任用记录。';
const ad='西安交大讲者原档独立确认 1999–2001 年在 Los Alamos Applied Physics Division 任 Director Postdoctoral Fellow。具名指导待查。';
const al=link('清华电机系任用公告',src.ang)+' · '+link('西安交大讲者原档',src.xj);
note(a,'- 院系／机构：',aa+' '+link('清华电机系任用公告',src.ang));
note(a,'- 核查边界：',ad+' '+al);
changeRow(a,null,'Los Alamos 应用物理部 1999–2001 Director Postdoctoral Fellow；导师待核',al);
stampSchool(a,'Engineering Product Development；','Engineering Product Development；清华电机系访问教授；');
const oldAng=readAudit(a,'phd');
const aA=audit(a,{affiliation:['confirmed',aa,[src.ang,src.xj]],research:['confirmed','清华公告和西安交大原档复核二维材料电子发射、输运及等离子体研究。',[src.ang,src.xj]],postdoc:['unresolved',ad,[src.xj,src.ang]]},'沿 LANL Director Fellowship 及 Applied Physics Division 旧资料查具名指导者。');
if(oldAng.status!=='confirmed_advisor'||!oldAng.sources.includes(src.cv))throw Error('prior CV evidence absent');
relation(a,'phd',lau,'advisor',oldAng.note,oldAng.sources,aA,false);

const j='2f23c3bc', mu='师承人物 - Norbert Müller', pn='师承人物 - Alexander Pines';
const jp='JKU 1995–1997 直接项目档明列 Jerschow 为 researcher、Müller 为 PI，并列一份博士论文产出。Mainz 原档确认 Linz 博士和 Trondheim 研究访问。Müller 仍记博士导师候选。';
const jd='Mainz 原公告明确 Lausanne 与 UC Berkeley 是两段博后。既有 Berkeley 学位论文原件证实 Pines 组属，Lausanne 的 Bodenhausen 仍是导师候选。';
const jl=link('JKU 项目原档',src.jproj)+' · '+link('Mainz 原公告',src.jmain);
nNote(j,'博士导师候选',mu,jp+' '+jl);rev(j,mu,'博士生候选',jp+' '+jl);iNote(j,mu,jp+' '+jl);
nNote(j,'博士后课题组负责人',pn,jd+' '+jl);rev(j,pn,'博士后课题组成员',jd+' '+jl);iNote(j,pn,jd+' '+jl);
note(j,'- 核查边界：',jp+' '+jd+' '+jl);
changeRow(j,'Linz 博士，曾在 Trondheim 研究；Norbert Müller（博士导师候选）','Lausanne 博后，Bodenhausen（候选）；UC Berkeley 博后，Pines（组负责人）',jl);
const aj=audit(j,{phd:['group_or_candidate',jp,[src.jproj,src.jmain]],postdoc:['group_or_candidate',jd,[src.jmain,src.pines]]},'查 JKU 1997 博士论文签署原档、Lausanne NMR 中心任用和 Berkeley fellowship 具名导师。');
relation(j,'postdoc',pn,'group_leader',jd,[src.jmain,src.pines],aj,false);

const m='4b57e796',saint='师承人物 - David Saintillan', todd='人员 - UC Santa Barbara - Todd Squires - d92cccbf';
const mp='2015 学位论文题页列 Saintillan 为委员会主席，致谢第 xi 页直接记科学训练和指导。UCSD MAE 活动正文日期为 2021 年 10 月 1 日，独立称博士阶段与 Saintillan 共事。既有结构化标签维持博士阶段研究师长，人物页旧正式导师标签保留待复核。';
const md='本人 UC Davis 组页列 UC Santa Barbara 化学工程博后 2015–2019，校方讲者档列约 3.5 年。本人早期页明确同期与 Todd Squires 共事，维持组负责人及阶段研究师长。';
const ml=link('本人组页',src.manlab)+' · '+link('UCSD MAE 活动原档',src.manbio)+' · '+link('本人博士论文致谢',src.man+'#page=12');
note(m,'- 博士关系证据：',mp+' '+ml);rev(m,saint,'博士生',mp+' '+ml);iNote(m,saint,mp+' '+ml);
nNote(m,'博士后课题组负责人及阶段研究师长',todd,md+' '+ml);iNote(m,todd,md+' '+ml);
const tf=fn(todd);editLine(tf,l=>l.startsWith('- 博士后')&&l.includes('[['+local(m)+'|'),l=>l+' '+md+' '+ml);
changeRow(m,null,'Todd Squires（UCSB 2015–2019 博后，约 3.5 年；课题组负责人及阶段研究师长）',ml);
const am=audit(m,{phd:['group_or_candidate',mp,[src.man,src.manbio]],postdoc:['group_or_candidate',md,[src.manlab,src.mansq,src.manbio]]},'早期 CV 直链不可读，继续找 2015 答辩公告或 CV 中的博士 advisor，以及 UCSB 博后指导原档。');
relation(m,'postdoc',todd,'stage_mentor',md,[src.manlab,src.mansq,src.manbio],am,false);

const f='48e0d021',cne='已核实单位 - UC San Diego - 化学与纳米工程系';
const fa='UC San Diego 校级目录列 CNE/ECE Distinguished Professor，Jacobs 原档分别列电气与计算机工程教授、化学与纳米工程教员及 CMRR 讲席。';
const fl=link('UCSD 校级目录',src.fullcat)+' · '+link('Jacobs 教师档',src.fulljac);
note(f,'- 院系／机构：','[['+cne+'|化学与纳米工程系]]。'+fa+' '+fl);
editLine(path.join(root,'已核实院系',cne+'.md'),l=>l.startsWith('- [[人员 - UC San Diego - David Fenning '),l=>l+'\n- [['+local(f)+'|Eric Fullerton]] — '+fl);
changeRow(f,null,null,fl);
const row=path.join(root,'UC San Diego逐人复核记录.md');
editLine(row,l=>l.startsWith('| [['+local(f)+'|'),l=>{const chunks=l.split(' | ');if(!chunks[1].includes('化学与纳米工程系'))chunks[1]=chunks[1].replace('电气与计算机工程系','电气与计算机工程系、化学与纳米工程系');if(!chunks[1].includes('化学与纳米工程系'))throw Error('UCSD affiliation not matched');return chunks.join(' | ');});
audit(f,{affiliation:['confirmed',fa,[src.fullcat,src.fulljac]],research:['confirmed','Jacobs 原档复核磁薄膜、磁记录、超晶格及 X 射线和中子散射。',[src.fulljac]],phd:keep(f,'phd','DOE 项目报告的博士论文与项目资助字段已重核，导师字段待论文原件。',[src.fullrep])},'沿确切论文题名追 UCSD 图书馆原件，另查 Argonne 磁性薄膜组聘任档。');

const b='8da135b8', ar='师承人物 - Arkady Aronov';
const bp='Columbia 旧院档确认 1979 年 Leningrad Institute for Nuclear Physics 博士。AIP 原目录列 Altshuler 合著 Aronov 纪念文，本轮只取得书目信息。维持博士导师候选，待纪念文正文及学位原件。';
const bl=link('Columbia 旧院档',src.alt)+' · '+link('AIP 纪念文目录',src.aron);
nNote(b,'博士导师候选',ar,bp+' '+bl);rev(b,ar,'博士生候选',bp+' '+bl);iNote(b,ar,bp+' '+bl);
changeRow(b,null,null,bl);
audit(b,{phd:keep(b,'phd',bp,[src.alt,src.aron])},'查 1979 Leningrad 博士论文或 AIP 1995 纪念文 PDF 正文，另追博士毕业后职务及指导。');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_履历与阶段复核';
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

