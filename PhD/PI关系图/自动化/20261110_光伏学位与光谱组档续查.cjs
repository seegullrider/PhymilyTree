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
 a.audit_id='20261110_'+id+'_doe_spectro_1658';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_doe_spectro_1658_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const d='1a97e27e', leo='9194ca79', il='1b0d084d', ang='1407bda3', pap='11788bab', ken='4808bea5';
const roh='师承人物 - Ajeet Rohatgi', moore='师承人物 - C. Bradley Moore', pufu='师承人物 - Silviu Pufu', lau='师承人物 - Y. Y. Lau', castle='师承人物 - A. Welford Castleman Jr';
const f=id=>fn(local(id));
const link=(target,label)=>'[['+target+'|'+label+']]';
const cites=items=>items.map(([label,url])=>web(label,url)).join(' · ');
const roleLine=(label,target,name,detail,source)=>'- '+label+'：'+link(target,name)+'。'+detail+' '+source;
const indexEntry=(id,name,line)=>'- '+link(local(id),name)+' → '+line.slice(2);
function indexReplace(id,target,label,replacement){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),()=>replacement);
}
function row(id,phd,postdoc,text){changeRow(id,phd,postdoc,text);}
function append(file,line){
 const content=graph.get(file)??fs.readFileSync(file,'utf8');
 const eol=content.includes('\r\n')?'\r\n':'\n';
 graph.set(file,content.trimEnd()+eol+line+eol);
}
const dECE='https://ece.gatech.edu/directory/william-alan-doolittle';
const dCV='https://ptacts.uspto.gov/ptacts/public-informations/petitions/1556576/download-documents?artifactId=a4gRv8zXD3txXY45r0Y1q-n6jmaosKDswCHhWxDQueBTsylIA4ES7Y0';
const rCV='https://studylib.net/doc/7821363/ajeet-rohatgi';
const rECE='https://ece.gatech.edu/directory/ajeet-rohatgi';
const dPat='https://patents.google.com/patent/US5521839A/en';
const dEv='Rohatgi 的 CV 镜像在 Ph.D. Students Supervised 栏列 W. A. Doolittle，论文题名为《Deep Level Transient Spectroscopy and Defects in Polycrystalline Silicon》，并列 Georgia Tech ECE 教职。Georgia Tech ECE 原档核论文研究主题，专利原件核二人的姓名和同方向研究。导师 CV 写 1995 年秋，本人 CV 与 ECE 写 1996 年。';
const dRefs=cites([['Rohatgi 本人 CV 镜像',rCV],['Georgia Tech ECE 原档',dECE],['Doolittle 本人 CV，第 4 页',dCV],['同期专利原件',dPat]]);
const dLine=roleLine('博士导师',roh,'Ajeet Rohatgi',dEv,dRefs);
const dPost='本人 CV Employment History 列 1996–2000 Georgia Tech ECE Research Engineer II，2001 年起为助理教授。ECE 教师原档独立确认该履历。已核资料未见独立博士后任用。';
editLine(f(d),l=>l.startsWith('- 核查边界：'),()=>dLine+'\n- 博士后经历：'+dPost+' '+cites([['本人 CV，第 4 页',dCV],['Georgia Tech ECE',dECE]]));
editLine(f(d),l=>l.startsWith('- 本人 CV 和学校页确认 1996 博士'),()=>'- 当时已核其 1996 博士和随后研究工程师任用。导师及 1995／1996 年份差异见上。');
note(d,'- Georgia Tech ECE 教授，','本人 CV 列 2019 年起 Joseph M. Pettit Professor。'+web('本人 CV，第 4 页',dCV));
append(fn(roh),'- 博士生：'+link(local(d),'William Alan Doolittle')+'。'+dEv+' '+dRefs);
row(d,'Ajeet Rohatgi（Georgia Tech 博士导师；1995 秋／1996 年份待核）','已核履历未见独立博后。1996–2000 ECE Research Engineer II',dRefs+'。');
const dA=audit(d,{affiliation:['confirmed','Georgia Tech ECE 教授，公开提交的本人 CV 列 2019 年起 Joseph M. Pettit Professor。',[dECE,dCV]],research:['confirmed','ECE 原档确认半导体物理、异质结构、光电材料与器件，博士方向为光伏硅缺陷。',[dECE,dCV]],phd:['confirmed_advisor',dEv,[rCV,dECE,dCV,dPat,rECE]],postdoc:['no_postdoc_documented',dPost,[dCV,dECE]]},'追 1995 年秋和 1996 年间学位授予档或论文签署页。');
relation(d,'phd',roh,'advisor',dEv,[rCV,dECE,dCV,dPat],dA);

const lBer='https://physics.berkeley.edu/people/faculty/stephen-leone';
const lLbnl='https://ultrafast.lbl.gov/chemical-dynamics/prof-stephen-leone/';
const lEv='Berkeley 物理系本人档写 1974 年在 UC Berkeley 完成化学博士，具名 with Professor C. Bradley Moore。同一履历列 1974–1976 USC 助理教授，1976 年起 NIST 与 Colorado 任用。';
const lPost='Berkeley 物理系履历将 1974 学位与同年赴 USC 任助理教授相接，1976 年转 NIST 和 University of Colorado。现有任用资料未发现独立博士后职位。';
note(leo,'- 博士导师：',lEv);
editLine(f(leo),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+lPost+' '+web('Berkeley 物理系履历',lBer));
note(leo,'- 物理和化学系教授，','Berkeley 物理系原档列 2002 起 Berkeley 双系教授及 LBNL Chemical Sciences Division Faculty PI，核研究方向为阿秒、超快及软 X 射线光谱。'+cites([['Berkeley 物理系',lBer],['LBNL 个人档',lLbnl]]));
mentorLine(moore,leo,'- 博士生：',lEv);
indexLine(leo,moore,'博士导师',lEv);
row(leo,'C. Bradley Moore（Berkeley 1974 化学博士导师）','已核履历未见独立博士后。1974–1976 USC 助理教授',cites([['Berkeley 物理系',lBer],['LBNL 原档',lLbnl]])+'。');
const lA=audit(leo,{phd:['confirmed_advisor',lEv,[lBer]],postdoc:['no_postdoc_documented',lPost,[lBer]],affiliation:['confirmed','Berkeley 物理系原档列物理及化学双系和 LBNL Chemical Sciences Division Faculty PI。',[lBer,lLbnl]],research:['confirmed','Berkeley 与 LBNL 原档列阿秒和超快光谱、软 X 射线探测、碰撞动力学。',[lBer,lLbnl]]},'候选学位 PDF 待可访问后核作者与签署，另核 1974 任用原始月份。');
relation(leo,'phd',moore,'advisor',lEv,[lBer],lA);

const pPaper='https://papanikolas.chem.unc.edu/assets/light_harvesting_collection.pdf';
const pGroup='https://sites.google.com/berkeley.edu/leonegrp/people/alumni/1990-1999';
const pConf='https://iee.ucsb.edu/news-events/events/seminar-series/visualizing-charge-carrier-motion-nanowires-using-femtosecond';
const pUNC='https://catalog.unc.edu/graduate/schools-departments/chemistry/';
const pEv='本人合著论文的作者简介写其取得 Colorado Boulder 化学物理博士后留校任 Postdoctoral Associate，1997 年入 UNC 化学系。Leone 组 1990 年代原始校友档列 John Papanikolas。组合证据支持 Boulder 博后组属，正式导师职衔待查。';
const pRef=cites([['本人合著论文作者简介，第 9 页',pPaper],['Leone 组原校友档',pGroup]]);
const pLine=roleLine('博士后课题组负责人',local(leo),'Stephen R. Leone',pEv,pRef);
editLine(f(pap),l=>l.startsWith('- 博士后候选关系：')&&l.includes(local(leo)),()=>pLine);
editLine(f(pap),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Colorado 博士学位签署与具名导师待查，Lineberger 与 Parson 保留候选。Leone 的 Boulder 博后课题组关系已登记，具名正式指导职衔待核。UCSB 原讲座网页本次仍未读到正文。'+cites([['本人合著论文作者简介',pPaper],['Leone 组原校友档',pGroup],['UCSB 讲座原地址',pConf]]));
editLine(f(leo),l=>l.startsWith('- 博士后候选研究者：')&&l.includes(local(pap)),()=>'- 博士后课题组成员：'+link(local(pap),'John M. Papanikolas')+'。'+pEv+' '+pRef);
indexReplace(pap,local(leo),'博士后候选关系',indexEntry(pap,'John M. Papanikolas',pLine));
row(pap,null,'Stephen R. Leone（Colorado Boulder 博后课题组负责人）',pRef+'。');
const pA=audit(pap,{postdoc:['group_or_candidate',pEv,[pPaper,pGroup]],affiliation:['confirmed','本人署名出版的履历列 1997 起 UNC 化学系；保留先前 UNC 研究生目录的荣休记录，本轮该目录超时。',[pPaper,pUNC]],research:['confirmed','本人论文作者简介列超快光谱、分子体系和纳米材料，系页的既有归类保留。',[pPaper]]},'查 Colorado 原始博士论文、导师签署及 Boulder 博后具名正式指导任用。');
relation(pap,'postdoc',local(leo),'group_leader',pEv,[pPaper,pGroup,lBer],pA);

const kBio='https://pmc.ncbi.nlm.nih.gov/articles/PMC13007029/';
const kPsu='https://science.psu.edu/chem/people/klk260';
const kGroup='https://sites.google.com/berkeley.edu/leonegrp/people/alumni/2000-2009';
const kEv='Knappenberger 共著的 2026 年论文作者简介直接写 Berkeley 博后与 Stephen R. Leone 工作，Leone 组 2000 年代校友档列 Ken Knappenberger，Penn State 院系档核身份、任用与研究。正式博后 advisor 职衔待查。';
const kPhd='2026 年论文作者简介明确 Penn State 博士 under the supervision of A. Welford Castleman, Jr.，与 Penn State 材料研究所既有介绍一致。';
const kRef=cites([['本人共著论文作者简介',kBio],['Leone 组原校友档',kGroup],['Penn State 院系档',kPsu]]);
const kLine=roleLine('博士后阶段研究师长',local(leo),'Stephen R. Leone',kEv,kRef);
editLine(f(ken),l=>l.startsWith('- 博士后候选研究师长：')&&l.includes(local(leo)),()=>kLine);
editLine(f(ken),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Penn State 化学博士导师为 A. Welford Castleman Jr.。Berkeley 2005–2008 博后关系按阶段研究师长与组属记录，具名正式指导称谓待查。'+kRef);
note(ken,'- 博士导师：',kPhd+' '+web('本人共著论文作者简介',kBio));
editLine(f(leo),l=>l.startsWith('- 博士后受指导者候选：')&&l.includes(local(ken)),()=>'- 博士后阶段研究者：'+link(local(ken),'Kenneth Knappenberger Jr.')+'。'+kEv+' '+kRef);
mentorLine(castle,ken,'- 博士生：',kPhd+' '+web('本人共著论文作者简介',kBio));
indexReplace(ken,local(leo),'博士后候选研究师长',indexEntry(ken,'Kenneth Knappenberger Jr.',kLine));
indexLine(ken,castle,'博士导师',kPhd+' '+web('本人共著论文作者简介',kBio));
row(ken,'A. Welford Castleman Jr.（Penn State 博士导师）','Stephen R. Leone（Berkeley 博后阶段研究师长）',kRef+'。');
const kA=audit(ken,{phd:['confirmed_advisor',kPhd,[kBio,kPsu]],postdoc:['group_or_candidate',kEv,[kBio,kGroup,kPsu]],affiliation:['confirmed','Penn State 院系原档列化学系主任和化学、物理教授。',[kPsu,kBio]],research:['confirmed','院系原档核结构光子学、纳米材料光与物质相互作用。',[kPsu,kBio]]},'追 Berkeley 2005–2008 博后具名正式指导职衔及任用文件。');
relation(ken,'phd',castle,'advisor',kPhd,[kBio,kPsu],kA);
relation(ken,'postdoc',local(leo),'stage_mentor',kEv,[kBio,kGroup,kPsu],kA);

const iBer='https://physics.berkeley.edu/people/luca-victor-iliesiu';
const iTh='https://inspirehep.net/files/1dcdee80b4bab4287d56af16fce2d0c1';
const iFpo='https://phy.princeton.edu/events/fpo-luca-iliesiu-two-dimensional-quantum-gravity';
const iSim='https://ultraqm.hsites.harvard.edu/postdoctoral-fellows';
const iEv='Princeton 博士论文首页列 2020 年 9 月和 Adviser: Silviu Pufu，Princeton 物理系 Final Public Oral 考试档独立核题名及身份。';
const iPost='Berkeley 物理系确认 Princeton 2020 博士后任 Stanford 博后，属 Simons Ultra Quantum Matter，2024 年 1 月入 Berkeley。Simons 合作项目同期成员原档核 Stanford 博后及研究方向，未具名个人导师。';
note(il,'- 博士导师：',iEv+' '+web('Princeton 答辩档',iFpo));
editLine(f(il),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+iPost+' 研究方向以高能理论为主，含与凝聚态的理论方法交叉。'+cites([['Berkeley 物理系',iBer],['Simons 合作项目博后档',iSim]]));
mentorLine(pufu,il,'- 博士生：',iEv+' '+web('Princeton 答辩档',iFpo));
indexLine(il,pufu,'博士导师',iEv+' '+web('Princeton 答辩档',iFpo));
row(il,'Silviu Pufu（Princeton 2020 博士导师）','Stanford Simons Ultra Quantum Matter 博后。个人导师待核',cites([['Princeton 答辩档',iFpo],['学位论文原件',iTh],['Simons 博后名录',iSim]])+'。');
const iA=audit(il,{phd:['confirmed_advisor',iEv,[iTh,iFpo,iBer]],postdoc:['unresolved',iPost,[iBer,iSim]],affiliation:['confirmed','Berkeley 物理系原档列 2024 年 1 月入职助理教授。',[iBer]],research:['confirmed','Berkeley 与 Simons 原档列高能理论、量子场论、量子引力与凝聚态理论交叉。',[iBer,iSim]]},'追 Stanford 博后聘任的具名导师或 faculty host。');
relation(il,'phd',pufu,'advisor',iEv,[iTh,iFpo,iBer],iA);

const aS='https://www.sutd.edu.sg/profile/ang-lay-kee-ricky/';
const aM='https://mipse.eecs.umich.edu/files/Ang_flyer_v02.pdf';
const aL='https://ners.engin.umich.edu/people/lau-yue-ying/';
const aCv='https://people.sutd.edu.sg/ricky_ang/wp-content/uploads/2021/12/2021-12-CV.pdf';
const aI='https://people.sutd.edu.sg/ricky_ang/wp-content/uploads/2019/05/2016JSTQE.pdf';
const aPost='Michigan MIPSE 原讲座档核 1999–2001 Los Alamos 博后，SUTD 学校履历核 Director Postdoctoral Fellow、Applied Physics Division 及随后 NTU EEE 任用。已有 IEEE 原刊核 Plasma Physics Applications Group，具名正式指导仍待查。';
const aName='Michigan 院系档将 Yue Ying Lau 与 Y. Y. Lau 写于同一人物档。Ang 的 2021 CV 原有 Advisor 字段沿用，PDF 本次返回 HTML。';
const aRef=cites([['SUTD 本人档',aS],['Michigan 讲座原档',aM]]);
const aInfo='SUTD 现行个人档列 Ng Teng Fong Chair Professor、Associate Provost for Research and International Relations，SMT 与 EPD 行政职务分列为过去任用。';
editLine(f(ang),l=>l.startsWith('- 博士导师：')&&l.includes(lau),l=>l.replace('|Y. Y. Lau]]','|Yue Ying Lau（Y. Y. Lau）]]').replace('暂按来源缩写记录姓名；','')+' '+aName+' '+web('Michigan 院系档',aL));
note(ang,'- 核查边界：',aPost+' '+aRef);
note(ang,'- SUTD 教师资料列其为',aInfo+' '+web('SUTD 本人档',aS));
editLine(fn(lau),l=>l.startsWith('- 博士生：')&&l.includes(local(ang)),l=>l.replace('暂按来源缩写记录姓名；','')+' '+aName+' '+web('Michigan 院系档',aL));
editLine(fn(lau),l=>l.startsWith('> 本节点依据'),l=>l+' Michigan NERS 官方姓名为 Yue Ying Lau。'+web('Michigan NERS 个人档',aL));
indexLine(ang,lau,'博士导师',aName+' '+web('Michigan 院系档',aL));
editLine(idx,l=>l.startsWith('- [['+local(ang)+'|')&&l.includes(' → 博士导师：')&&l.includes('[['+lau+'|'),l=>l.replace('|Y. Y. Lau]]','|Yue Ying Lau（Y. Y. Lau）]]').replace('暂按来源缩写记录姓名；',''));
row(ang,'Yue Ying Lau（Y. Y. Lau，Michigan 1999 博士导师）',null,aRef+' · '+web('Michigan NERS 人物档',aL)+'。');
audit(ang,{affiliation:['confirmed',aInfo,[aS,aM]],research:['confirmed','SUTD 及 Michigan 讲者原档列二维材料相关电子输运与发射、等离子体物理及交叉器件研究。',[aS,aM]],phd:['confirmed_advisor',aName+' Michigan MIPSE 原讲者档核 1999 博士。',[aL,aM,aCv]],postdoc:['unresolved',aPost,[aS,aM,aI]]},'继续追 Los Alamos 原始任用、具名博后指导及 1999 学位签署。');

const start=graph.get(idx)??fs.readFileSync(idx,'utf8');
const eol=start.includes('\r\n')?'\r\n':'\n';
append(idx,eol+'## Georgia Tech 学位与博士后履历补充（2026-11-10）'+eol+eol+indexEntry(d,'William Alan Doolittle',dLine));
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_光伏学位与光谱组档续查';
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

