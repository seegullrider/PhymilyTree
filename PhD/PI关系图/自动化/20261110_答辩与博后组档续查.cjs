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
 a.audit_id='20261110_'+id+'_ucsd_caltech_1649';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_ucsd_caltech_1649_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const man='4b57e796', bur='915bb887', bha='194c62b5', ash='19e85b35', chen='d6a628af';
const st='师承人物 - David Saintillan', eis='师承人物 - James P. Eisenstein', wb='师承人物 - William B. Russel', am='师承人物 - Ahmed Mourchid';
const pro='人员 - Yale - Daniel E. Prober - 2531bba0', storm='人员 - Columbia - Horst Störmer - 96a130f1';
const link=(target,label)=>'[['+target+'|'+label+']]';
const cite=(items)=>items.map(([label,url])=>web(label,url)).join(' · ');
const f=(id)=>fn(local(id));
const indexEntry=(id,name,line)=>'- '+link(local(id),name)+' → '+line.slice(2);
function replaceIndex(id,mentor,label,line){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+mentor+'|'),()=>line);
}
function addLine(file,line){
 const content=graph.get(file)??fs.readFileSync(file,'utf8');
 const eol=content.includes('\r\n')?'\r\n':'\n';
 graph.set(file,content.trimEnd()+eol+line+eol);
}
const th='https://escholarship.org/content/qt9xf3p117/qt9xf3p117.pdf';
const req='https://www.grad.ucsd.edu/academics/progress-to-degree/committees.html';
const stNews='https://stokeslet.ucsd.edu/news.html';
const stPast='https://web.eng.ucsd.edu/mae/groups/stokeslet/pastmembers.html';
const mSelf='https://sites.google.com/site/hmanikantan/home';
const mDavis='https://che.engineering.ucdavis.edu/directory/harishankar-manikantan';
const mRes='https://manikantan.faculty.ucdavis.edu/people/';
const mIll='https://mechse.illinois.edu/news/graduate-student-earns-fmc-technologies-inc-fellowship';
const mEv='2015 UC San Diego 博士论文签署页将 Saintillan 列为 Chair，致谢明确描述其科研指导。UC San Diego 研究生部门现行说明并列 dissertation advisor/Doctoral Committee Chair，组原档列其 2015 博士和同题论文。本人主页说明随 Saintillan 组从 Illinois 转入 UC San Diego。';
const mRef=cite([['2015 博士论文签署及致谢',th],['UCSD 研究生委员会说明',req],['Saintillan 组博士生目录',stPast],['本人主页',mSelf]]);
const mLine='- 博士导师：'+link(st,'David Saintillan')+'。'+mEv+' '+mRef;
editLine(f(man),l=>l.startsWith('- 博士导师：')&&l.includes(st),()=>mLine);
editLine(f(man),l=>l.startsWith('- 博士关系证据：'),()=>'- 博士关系证据：Saintillan 组同期新闻记 2015 年 10 月答辩和下一阶段转赴 UCSB Squires 组。Illinois 校刊称其硕士阶段 research advisor，分列为早期培养阶段。'+cite([['Saintillan 组同期答辩档',stNews],['Illinois 校刊',mIll]]));
editLine(f(man),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Illinois 硕士与 UC San Diego 博士分别登记。Todd Squires 是 UCSB 博士后课题组负责人及阶段研究师长，正式 advisor 职称待查。本人 UC Davis 组档列 UCSB 2015–2019 博士后。'+cite([['本人 UC Davis 组档',mRes],['本人早期主页',mSelf],['同期答辩原档',stNews]]));
editLine(fn(st),l=>l.startsWith('- 博士生：')&&l.includes(local(man)),()=>'- 博士生：'+link(local(man),'Harishankar Manikantan')+'。'+mEv+' '+mRef);
replaceIndex(man,st,'博士导师',indexEntry(man,'Harishankar Manikantan',mLine));
changeRow(man,'David Saintillan（2015 UC San Diego 博士导师及论文委员会主席）',null,web('UCSD 委员会说明',req)+'。');
const mA=audit(man,{phd:['confirmed_advisor',mEv,[th,req,stPast,mSelf,stNews,mIll]],affiliation:['confirmed','UC Davis 化工原档列副教授，核其研究集中在复杂多相流体、界面和生物膜输运。',[mDavis,mRes]],research:['confirmed','UC Davis 化工原档列复杂流体界面、生物膜输运、分散体系流变、微尺度颗粒动力学。',[mDavis]]},'继续追 UCSB 博后正式 advisor 称谓及原始任用文件。');
relation(man,'phd',st,'advisor',mEv,[th,req,stPast,mSelf],mA,false);

const bCv='https://www.burkelab.com/wp-content/uploads/BurkeCV11Feb2021-1.pdf';
const bMtt='https://mtt.org/profile/peter-burke/';
const bPro='https://proberlab.yale.edu/alumtheses';
const bGrp='https://www.its.caltech.edu/~jpelab/people.html';
const eCv='https://www.its.caltech.edu/~je/fullcv.pdf';
const bE='Caltech Eisenstein Group 将 Jim Eisenstein 列为 PI，将 Peter Burke 列入 Postdocs。Eisenstein 本人 CV 列 1998–2001 Caltech、后任 UC Irvine EECS 教授，IEEE MTT-S 履历年份一致。Burke 本人 CV 的任用栏列 1997–2001，起始年差异留存。';
const bRef=cite([['Eisenstein 组原名录',bGrp],['Eisenstein 本人 CV，第 11 页',eCv],['Burke 本人 CV，第 1 页',bCv],['IEEE MTT-S 履历',bMtt]]);
const bPost='- 博士后课题组负责人：'+link(eis,'James P. Eisenstein')+'。'+bE+' 已确认组属，个人正式指导职称待核。'+bRef;
editLine(f(bur),l=>l.startsWith('- 核查边界：'),()=>bPost+'\n- 核查边界：Yale 导师由 Graduate Advisees 原目录确认，扫描签署页待读。Caltech Sherman Fairchild 博后组属已有组档，具体任用起始年和正式个人指导称谓待核。');
note(bur,'- 院系／机构：','本人 2021 年 CV 另列 Biomedical Engineering courtesy appointment，按该履历的时间记录。'+web('本人 CV',bCv));
addLine(fn(eis),'- 博士后课题组成员：'+link(local(bur),'Peter Burke')+'。'+bE+' '+bRef);
changeRow(bur,'Daniel E. Prober（Yale 1998 博士导师）','James P. Eisenstein（Caltech 博后课题组负责人；任用起始年待核）',bRef+' · '+web('Yale 指导学生与论文目录',bPro)+'。');
const bA=audit(bur,{affiliation:['confirmed','本人 2021 CV 列 UC Irvine EECS 任用和 Biomedical Engineering courtesy appointment，IEEE 履历核 2001 起 UC Irvine。',[bCv,bMtt]],postdoc:['group_or_candidate',bE+' 正式个人导师职称待查。',[bGrp,eCv,bCv,bMtt]],phd:['confirmed_advisor','Yale Prober 组 Graduate Advisees 栏明确列 Peter Burke 及 1998 论文，CV 和 IEEE 履历核年份。',[bPro,bCv,bMtt]]},'追 Caltech 博后任用档的起始年份与正式指导称谓；Yale 论文签署页仍待核。');
relation(bur,'phd',pro,'advisor','Yale Prober 原始实验室名录 Graduate Advisees 栏列 Peter Burke、1998 年论文题名、现职 UC Irvine；本人 CV 确认 Yale 1998 博士。',[bPro,bCv,bMtt],bA);
relation(bur,'postdoc',eis,'group_leader',bE,[bGrp,eCv,bCv,bMtt],bA);

const sbu='https://news.stonybrook.edu/facultystaff/surita-r-bhatia-named-fellow-of-two-prestigious-national-organizations/';
const buf='https://engineering.buffalo.edu/chemical-biological/news-events/events/seminar-series/spring-2023-seminar-series/surita-r-nhatia.html';
const nist='https://www.ncnr.nist.gov/programs/sans/pdf/publications/0006.pdf';
const ai='https://proceedings.aiche.org/conferences/aiche-annual-meeting/2005/proceeding/paper/young-faculty-forum-panel-discussion-0';
const russ='https://www.princeton.edu/~rrg/people.shtml';
const bhE='Stony Brook 官方校讯核 Rhodia/CNRS Complex Fluids Laboratory 博后。NIST 保存的 2002 ACS 原刊首页将 Bhatia 和通讯作者 Ahmed Mourchid 列在同一 Complex Fluids Laboratory，地点为 Cranbury, New Jersey。低可信候选，正式任用指导待核。';
const bhCite=cite([['Stony Brook 校讯',sbu],['NIST 保存的 ACS 论文，第 1 页',nist]]);
const bhLine='- 博士后导师候选：'+link(am,'Ahmed Mourchid')+'。'+bhE+' '+bhCite;
editLine(f(bha),l=>l.startsWith('- 核查边界：'),()=>bhLine+'\n- 核查边界：Stony Brook 化学系档列 2001 Rhodia/CNRS 博后，后续核任用文件及具名指导。'+web('Stony Brook 化学系','https://www.stonybrook.edu/commcms/chemistry/people/faculty_profiles/bhatia-surita.php'));
note(bha,'- Stony Brook 化学教授及材料科学与化学工程兼职教授，','2012 入职时并任 Brookhaven National Laboratory 的 Center for Functional Nanomaterials staff scientist，Buffalo 讲座档另核材料科学与化学工程兼任。'+cite([['Stony Brook 校讯',sbu],['Buffalo 讲者原档',buf]]));
if(fs.existsSync(fn(am)))throw Error('Ahmed Mourchid node exists');
graph.set(fn(am),'# Ahmed Mourchid\n\n> [!warning] 候选师承人物\n> 2002 ACS 论文列其为 Rhodia/CNRS Complex Fluids Laboratory 通讯作者。'+web('NIST 保存的出版原刊',nist)+'。\n\n## 候选关系\n\n- 博士后导师候选的研究者：'+link(local(bha),'Surita R. Bhatia')+'。'+bhE+' '+bhCite+'\n');
changeRow(bha,'William B. Russel（Princeton 博士导师）','Ahmed Mourchid（Rhodia/CNRS 低可信候选）',bhCite+' · '+web('Buffalo 讲者原档',buf)+'。');
const bhA=audit(bha,{affiliation:['confirmed','Stony Brook 校讯核 2012 化学系入职及同期 BNL CFN staff scientist；Buffalo 2023 原讲座档核材料科学与化工兼任。',[sbu,buf]],research:['confirmed','校讯列胶体玻璃、聚合物凝胶、软生物材料、结构与流变。',[sbu,buf,nist]],postdoc:['group_or_candidate',bhE,[sbu,nist,buf]]},'追 Rhodia/CNRS Cranbury 博后任用与正式指导人，另核 Princeton 原始签署页。');
relation(bha,'phd',wb,'advisor','AIChE 的本人讲者简介明确记 Princeton 博士在 William Russel 指导下完成，Princeton Russel 组历届名录独立列其 2000 年博士毕业。',[ai,russ,sbu],bhA);
relation(bha,'postdoc',am,'candidate',bhE,[sbu,nist],bhA);

const mit='https://physics.mit.edu/faculty/raymond-ashoori/';
const mit93='https://news.mit.edu/1993/packard-1117';
const ashEv='MIT 物理系履历列 Cornell 1991 博士及随后 AT&T Bell Laboratories postdoctoral member of the technical staff，MIT 1993 原校讯写 1990 博士并记录约 1992 在 Bell Labs 博后。学位年份有冲突，待 Cornell 学位原档；Bell Labs 正式指导者仍未明。';
const ashCite=cite([['MIT 物理系履历',mit],['MIT 1993 原校讯',mit93]]);
note(ash,'- 核查边界：',ashEv+' '+ashCite);
indexLine(ash,storm,'博士后导师候选','MIT 1993 同期校讯确认 Bell Labs 博后期间的单电子电容谱研究。'+web('MIT 1993 原校讯',mit93)+'。');
changeRow(ash,null,null,ashCite+'。Cornell 学位年份 1990 与 1991 分列。');
audit(ash,{phd:['unresolved',ashEv+' 人物页原有 Silsbee 标签保留。',[mit,mit93]],postdoc:['group_or_candidate',ashEv+' Störmer 保持同期合作低可信候选。',[mit,mit93,'https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.68.3088']],research:['confirmed','MIT 校讯访谈核单电子电容谱，现系页核低维电子与量子材料。',[mit,mit93]]},'查 Cornell 学位及签署年份原件，追 Bell Labs 任用部门与具名正式指导人。');

const cde='https://cde.nus.edu.sg/mse/staff/chen-jingsheng/';
const ie='https://ieeemagnetics.org/contact/jingsheng-chen';
const sz='https://en.nusri.cn/nusrien/research/investigators/im/379.html';
const cRef=cite([['NUS 材料系',cde],['IEEE Magnetics Society 履历',ie],['NUS 苏州研究院本人档',sz]]);
note(chen,'- NUS 材料教授，','NUS 院系原档列 Provost’s Chair，方向包括拓扑材料、铁电／铁磁异质结构及强关联氧化物。'+web('NUS 材料系',cde));
editLine(f(chen),l=>l.startsWith('- 研究方向：'),l=>l.replace(/。$/,'')+' · '+link('已核实方向 - 拓扑材料','拓扑材料')+' · '+link('已核实方向 - 多铁性','多铁性')+'。');
for(const name of ['拓扑材料','多铁性']){
 const p=path.join(root,'已核实方向','已核实方向 - '+name+'.md');
 if(!fs.readFileSync(p,'utf8').includes('[['+local(chen)+'|'))addLine(p,'- '+link(local(chen),'Jingsheng Chen · NUS')+' — '+web('NUS 材料系',cde));
}
note(chen,'- 博士阶段：',cRef+'。');
note(chen,'- 博士后阶段：',cRef+'。');
changeRow(chen,null,null,cRef+'。NUS 材料系原档列 Provost’s Chair，方向含拓扑材料和多铁异质结构。');
audit(chen,{affiliation:['confirmed','NUS 材料系原档列 Professor 及 Provost’s Chair，IEEE 的旧履历列此前副教授身份。',[cde,ie,sz]],research:['confirmed','NUS 院系列量子及拓扑材料、自旋电子、铁电／铁磁多铁异质结构、强关联氧化物和神经形态器件。',[cde]],phd:['unresolved','NUS 苏州研究院及 IEEE 双重核兰州大学 1999 博士，苏州原档列现代物理系，正式导师未列。',[sz,ie]],postdoc:['unresolved','NUS 苏州研究院及 IEEE 双重核 NTU EEE 1999–2001 博后，DSI 2001–2007 科研人员另列。具名导师未列。',[sz,ie]]},'核兰州大学博士论文、NTU EEE 博后任用及指导人；Pin Ho 候选等指导档继续追原文。');

const eol=(graph.get(idx)??fs.readFileSync(idx,'utf8')).includes('\r\n')?'\r\n':'\n';
addLine(idx,eol+'## Caltech 博士后组档与 Rhodia/CNRS 候选（2026-11-10）'+eol+eol+indexEntry(bur,'Peter Burke',bPost)+eol+indexEntry(bha,'Surita R. Bhatia',bhLine));

const ubme='https://engineering.uci.edu/dept/bme/people/affiliated.php';
const buUnit='已核实单位 - UC Irvine - Biomedical Engineering';
const cfUnit='已核实单位 - Stony Brook - Brookhaven National Laboratory Center for Functional Nanomaterials';
const buFile=path.join(root,'已核实院系',buUnit+'.md');
const cfFile=path.join(root,'已核实院系',cfUnit+'.md');
const buDetails='本人 2021 年 CV 列 Biomedical Engineering courtesy appointment，院系现有 Affiliated Faculty 名录也列 Burke。'+cite([['本人 CV',bCv],['UCI BME 兼任教师目录',ubme]]);
editLine(f(bur),l=>l.startsWith('- 院系／机构：'),l=>l.slice(0,l.indexOf('。'))+' · '+link(buUnit,'Biomedical Engineering（兼任）')+'。'+buDetails);
if(!fs.readFileSync(buFile,'utf8').includes('[['+local(bur)+'|'))addLine(buFile,'- '+link(local(bur),'Peter Burke')+'（兼任） — '+web('UCI BME 兼任教师目录',ubme));
const burAudit=audits.find(x=>x.record_id===bur);
burAudit.aspects.affiliation.note='本人 2021 年 CV 列 Biomedical Engineering courtesy appointment，UCI BME 当前 Affiliated Faculty 名录亦列 Burke，IEEE 履历核 2001 起 UC Irvine。';
burAudit.aspects.affiliation.sources.push(ubme);
const burSchool=path.join(root,'UC Irvine逐人复核记录.md');
editLine(burSchool,l=>l.startsWith('| [['+local(bur)+'|'),l=>l.replace('Electrical Engineering and Computer Science；','Electrical Engineering and Computer Science、Biomedical Engineering（兼任）；').replace(/ \|$/, ' '+web('UCI BME 兼任教师目录',ubme)+' |'));
editLine(path.join(root,'UC Davis逐人复核记录.md'),l=>l.startsWith('| [['+local(man)+'|'),l=>l.replace('维持结构化阶段研究师长，人物旧正式标签差异仍待明确 advisor 原证。 ','已按论文签署、科研指导致谢及 UCSD 委员会说明统一正式导师标签。 '));
if(fs.existsSync(cfFile))throw Error('CFN node exists');
graph.set(cfFile,'# Stony Brook：Brookhaven National Laboratory Center for Functional Nanomaterials\n\n[[院校 - Stony Brook|返回学校]]\n\n记录 Stony Brook 与 BNL CFN 的可核实联合任用。\n\n- '+link(local(bha),'Surita R. Bhatia')+'（2012 年入职时兼任 staff scientist） — '+web('Stony Brook 官方校讯',sbu)+'。\n');
editLine(f(bha),l=>l.startsWith('- 院系／机构：'),l=>l.replace(/。$/,'')+' · '+link(cfUnit,'Brookhaven CFN（2012 联合任用）')+'。');
const bhSchool=path.join(root,'Stony Brook逐人复核记录.md');
editLine(bhSchool,l=>l.startsWith('| [['+local(bha)+'|'),l=>l.replace('Chemistry、Materials Science and Chemical Engineering；','Chemistry、Materials Science and Chemical Engineering、Brookhaven CFN（2012 联合任用）；'));
const cSchool=path.join(root,'NUS逐人复核记录.md');
editLine(cSchool,l=>l.startsWith('| [['+local(chen)+'|'),l=>l.replace('自旋电子学、量子材料、磁性异质结构','自旋电子学、量子与拓扑材料、磁性及多铁异质结构'));
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_答辩与博后组档续查';
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




