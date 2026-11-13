const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root = '..';
const notes = path.join(root,'人物');
const index = path.join(root,'师承关系索引.md');
const records = db.prepare('SELECT id,filename,unit FROM records WHERE id=?');
const last = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const updates = new Map(), audits = [], relations = [];
function line(file, match, suffix) {
 const text = updates.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = text.includes('\r\n') ? '\r\n' : '\n';
 const rows = text.split(/\r?\n/);
 const matches = rows.map((row,i) => match(row) ? i : -1).filter(i=>i>=0);
 if (matches.length !== 1) throw Error(file+' expected one line, found '+matches.length);
 const i = matches[0];
 if (!rows[i].includes(suffix)) rows[i] += suffix;
 updates.set(file, rows.join(newline));
}
function source(label,url) { return '['+label+']('+url+')'; }
function personLine(id,prefix,suffix) {
 const record = records.get(id);
 line(path.join(notes,record.filename+'.md'),x=>x.startsWith(prefix),suffix);
}
function schoolSource(id,suffix) {
 const record=records.get(id);
 const file=path.join(root,record.unit+'逐人复核记录.md');
 const contents=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=contents.includes('\r\n')?'\r\n':'\n';
 const rows=contents.split(/\r?\n/);
 const i=rows.findIndex(x=>x.startsWith('| [['+record.filename+'|'));
 if(i<0||!rows[i].endsWith(' |'))throw Error('missing school row '+id);
 if(!rows[i].includes(suffix))rows[i]=rows[i].slice(0,-2)+suffix+' |';
 updates.set(file,rows.join(newline));
}
function audit(id,changes,next) {
 const original=JSON.parse(last.get(id).details_json);
 original.audit_id='pi_archive_20261110_1944_'+id;
 original.followup_required=true;
 original.next_step=next;
 for(const [key,note,sources] of changes){
  const aspect=original.aspects[key];
  original.aspects[key]={...aspect,note,sources:[...new Set([...sources,...aspect.sources])]};
 }
 audits.push(original);
 return original.audit_id;
}

function edit(file,match,replacement){
 const content=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const matches=rows.map((row,i)=>match(row)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected one line, found '+matches.length);
 const i=matches[0];
 rows[i]=replacement(rows[i],newline);
 updates.set(file,rows.join(newline));
}
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mentorFile=name=>path.join(notes,name+'.md');
const who=(id,role)=>row=>row.startsWith('- '+role+'：')&&row.includes('[['+records.get(id).filename+'|');
const indexed=(id,role,mentor)=>row=>row.startsWith('- [['+records.get(id).filename+'|')&&row.includes('→ '+role+'：[['+mentor+'|');
function schoolReplace(id,from,to){
 const record=records.get(id);
 edit(path.join(root,record.unit+'逐人复核记录.md'),row=>row.startsWith('| [['+record.filename+'|'),row=>{
  if(row.includes(to))return row;
  if(!row.includes(from))throw Error(id+' 校表字段已变');
  return row.replace(from,to);
 });
}
function appendAfter(file,match,entry){
 edit(file,match,(row,nl)=>{
  const full=updates.get(file)??fs.readFileSync(file,'utf8');
  return full.includes(entry)?row:row+nl+entry;
 });
}
function addRelation(id,auditId,key,stage,mentor_filename,kind,evidence,sources) {
 relations.push({event_id:'pi_archive_20261110_1944_'+id+'_'+key,record_id:id,stage,mentor_filename,kind,source_audit_id:auditId,evidence,sources});
}

const isHeading=row=>row==='## 师承';
const label=(id,name)=>'[['+records.get(id).filename+'|'+name+']]';
const target=(node,name)=>'[['+node+'|'+name+']]';
function addIndex(file,heading,lineText) {
 const body=updates.get(file)??fs.readFileSync(file,'utf8');
 if(body.includes(lineText))return;
 const nl=body.includes('\r\n')?'\r\n':'\n';
 const marker=nl+'## '+heading+nl;
 if(body.includes(marker)) throw Error('已存在索引标题：'+heading);
 updates.set(file,body.trimEnd()+nl+nl+'## '+heading+nl+nl+lineText.replaceAll('\n',nl)+nl);
}
function putEdge({id,name,mentor,mentorName,role,reverse,details}) {
 const from=label(id,name),to=target(mentor,mentorName);
 appendAfter(pf(id),isHeading,'\n- '+role+'：'+to+'。 '+details);
 appendAfter(mentorFile(mentor),isHeading,'\n- '+reverse+'：'+from+'。 '+details);
 return '- '+from+' → '+role+'：'+to+'。 '+details;
}
const n='d7f53f33',p='2a9f6669',s='29f6e178',h='bb3d5f3c',k='f4261ccd',a='a8bcce3c',d='2a7f289d',l='5de11ebc';
const huce='https://www.environment.harvard.edu/people/prineha-narang-';
const cti='https://engenuity.caltech.edu/stories/alumna-profile-prineha-narang-phd-15';
const asp='师承人物 - Alán Aspuru-Guzik';
const np='Harvard 环境中心原档将 Narang 的 Ziff Environmental Fellow 任期列为 2016–2017，Faculty Host 具名化学与化学生物学系 Alán Aspuru-Guzik。Caltech 本人访谈将 Harvard fellowship 与 MIT 物理系 Research Scholar 分列。Harvard 记录接收教师，正式个人导师称谓待核，MIT 两条合著候选仍按原标签。';
const na=audit(n,[['postdoc',np,[huce,cti]],['identity','Caltech 校友访谈及 Harvard 原档确认应用物理博士、MIT Research Scholar 与 UCLA 跨学科任职。',[huce,cti]]],'追 Harvard 个人导师职衔和 MIT Research Scholar 任用期及正式指导者。');
addRelation(n,na,'aspuru','postdoc',asp,'stage_mentor',np,[huce,cti]);
const nidx=putEdge({id:n,name:'Prineha Narang',mentor:asp,mentorName:'Alán Aspuru-Guzik',role:'博士后阶段研究师长',reverse:'博士后阶段研究者',details:source('Harvard fellowship 原档',huce)+'。'+np});
edit(pf(n),row=>row.startsWith('- 核查边界：'),row=>row.replace('MIT 博士后阶段与','MIT Research Scholar 阶段与')+' '+source('Caltech 本人访谈',cti)+'将 MIT 职位与 Harvard fellowship 分列。');
schoolReplace(n,'| Marin Soljačić（博士后候选）、John D. Joannopoulos（博士后候选） |','| Harvard Alán Aspuru-Guzik（2016–2017 fellowship 接收教师）；MIT Marin Soljačić、John D. Joannopoulos（候选） |');
schoolSource(n,' · '+source('Harvard fellowship 原档',huce));

const pcv='https://cbe.princeton.edu/sites/g/files/toruqf1386/files/people-cv/priestley_cv.pdf';
const academy='https://academie-sciences.fr/pdf/documentation/elus_2014/plaquette_elus_2015.pdf';
const cnrs='https://lejournal.cnrs.fr/articles/ludwik-leibler-inventeur-europeen-de-lannee';
const lie='师承人物 - Ludwik Leibler';
const pnote='Priestley 本人 CV 列 2008 年 6 月至 2009 年 6 月在 ESPCI Matière Molle et Chimie 博士后。法国科学院院士档案及 CNRS 原刊确认该实验室由 Ludwik Leibler 领导，登记博士后课题组负责人。个人指导职衔待核。';
const pa=audit(p,[['affiliation','Princeton 化学与生物工程院系列 Pomeroy and Betty Perry Smith 教授。',['https://cbe.princeton.edu/people/rodney-priestley']],['research','Princeton 化工原档列聚合物薄膜、胶体与纳米复合材料的界面及限域效应。',['https://cbe.princeton.edu/people/rodney-priestley']],['postdoc',pnote,[pcv,academy,cnrs]]],'查 ESPCI/NSF/Chateaubriand 个人指导档及 Northwestern 博士签署页。');
audits.at(-1).aspects.postdoc.status='group_or_candidate';
addRelation(p,pa,'leibler','postdoc',lie,'group_leader',pnote,[pcv,academy,cnrs]);
const pidx=putEdge({id:p,name:'Rodney D. Priestley',mentor:lie,mentorName:'Ludwik Leibler',role:'博士后课题组负责人',reverse:'博士后课题组成员',details:source('Princeton 本人 CV',pcv)+' · '+source('法国科学院任职档案',academy)+'。'+pnote});
edit(pf(p),row=>row.startsWith('- 核查边界：'),row=>row.replace('两者均未注明博士后导师。','两者未列个人正式导师称谓，实验室负责人另列。'));
schoolReplace(p,'| John M. Torkelson、Linda Broadbelt | 待核 |','| John M. Torkelson、Linda Broadbelt | Ludwik Leibler（ESPCI 2008–2009 博后实验室负责人） |');
schoolSource(p,' · '+source('本人 CV',pcv)+' · '+source('法国科学院任职档案',academy));
addIndex(index,'Harvard 与 ESPCI 博后阶段补证（2026-11-10）',nidx+'\n'+pidx);

const nw='https://www.mccormick.northwestern.edu/nu-tau-workshop/documents/abstracts/2018/shull.pdf';
const nwdept='https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/shull-kenneth.html';
const sh='Northwestern 会议原档列 Cornell 1990 年材料科学博士，接下来任 IBM Almaden Research Staff Member 三年，并于 1993 年加入 Northwestern。已核履历未分列独立博士后。';
audit(s,[['affiliation','Northwestern 材料科学与工程系教授。',[nw,nwdept]],['research','本人会议报告与院系介绍核高分子界面、薄膜、软材料力学及粘附断裂。',[nw,nwdept]],['postdoc',sh,[nw,nwdept]]],'待 Cornell 退避结束查博士档与 IBM 起始任职，Kramer 继续按低可信候选。');
audits.at(-1).aspects.postdoc.status='no_postdoc_documented';
edit(pf(s),row=>row.startsWith('- 核查边界：'),()=>'- 核查边界：'+sh+' '+source('Northwestern 本人会议履历',nw)+'。博士导师仍待 Cornell 学位档。');
schoolReplace(s,'| 待核 |','| IBM Almaden 1990–1993 Research Staff Member，未见单列博士后 |');
schoolSource(s,' · '+source('Northwestern 本人会议履历',nw));

const mitf='https://physics.mit.edu/research/pappalardo-fellowships-in-physics/pappalardo-symposium/';
const haah='https://physics.stanford.edu/news/new-faculty-alfred-zong-jeongwan-haah';
const hp='MIT 2014 年研讨会项目原档将 Jeongwan Haah 列为 2013–2016 Pappalardo Fellow，领域为量子信息理论。本人 Stanford 访谈确认 Caltech 物理博士后曾担任该 fellowship，再进入 Microsoft Quantum。个人指导者待核。';
audit(h,[['postdoc',hp,[mitf,haah]],['research','本人访谈明确研究拓扑多体系统、量子容错和量子学习算法。',[haah]]],'继续找 2013–2016 Pappalardo 接收教师与正式导师原档。');
edit(pf(h),row=>row.startsWith('- 核查边界：'),()=>'- 博士后：'+hp+' '+source('MIT Pappalardo 同期项目',mitf));
schoolReplace(h,'| John Preskill | 待核 |','| John Preskill | MIT Pappalardo 2013–2016，个人指导者待核 |');
schoolSource(h,' · '+source('MIT Pappalardo 同期项目',mitf));

const um='https://eng.umd.edu/clark/faculty/159/Peter-Kofinas';
const kp='Maryland 工学院履历列 MIT 化工博士后 1994 年 7 月至 1996 年 6 月，随后 1996 年 8 月加入 Maryland 材料系。个人导师未列。';
audit(k,[['affiliation','Maryland 工学院原档列主聘化学与生物分子工程、兼任生物工程和材料科学与工程。',[um]],['postdoc',kp,[um]]],'查 MIT 化工 1994–1996 年博后课题组与个人指导。');
personLine(k,'- 核查边界：',' '+source('Maryland 工学院任用时间',um)+'。'+kp);
schoolReplace(k,'| Robert E. Cohen（博士导师） | 待核 |','| Robert E. Cohen（博士导师） | MIT 化学工程 1994-07 至 1996-06 博后，个人指导待核 |');
schoolSource(k,' · '+source('Maryland 工学院任用时间',um));

const ar='https://muchomas.lassp.cornell.edu/CV/cv.html';
const ac='https://www.lassp.cornell.edu/people/tomas-arias';
const aj='人员 - MIT - John D. Joannopoulos — 纪念条目 - cbedf46d';
const ap='本人 CV 在 1992 年 6 月至 1993 年 9 月 MIT Post Doctoral Associate 条目下具名 Joannopoulos 为研究支持者，同时将 1988–1992 研究生阶段另列。研究支持职衔按 CV 原称谓，个人正式导师待查。';
audit(a,[['affiliation','Cornell LASSP 原档核物理教授。',[ac]],['research','凝聚态电子结构和第一性原理计算。',[ac,ar]],['postdoc',ap,[ar]]],'待 MIT DSpace 可读后复核博士论文签署及 MIT 博后个人指导职衔。');
const aas=' '+ap;
personLine(a,'- 博士后研究支持者：',aas);
line(mentorFile(aj),who(a,'博士后受支持研究者'),aas);
line(index,indexed(a,'博士后研究支持者',aj),aas);
schoolReplace(a,'（研究支持） |','（MIT 1992-06 至 1993-09，研究支持） |');
schoolSource(a,' · '+source('Cornell 本人 CV',ar));

const sutd='https://www.sutd.edu.sg/profile/dawn-tan/';
const dt='https://escholarship.org/content/qt9mr317vv/qt9mr317vv.pdf';
const dpost='SUTD 院系履历核 MIT 访问教授及 Luxtera 任职，未列独立博士后。原档核 UCSD 电气工程（光子学）博士。';
audit(d,[['affiliation','SUTD 教师原档列副教授及 Photonics Devices and Systems Group 负责人。',[sutd]],['research','SUTD 原档列非线性光学、纳米光子学与量子光学。',[sutd]],['postdoc',dpost,[sutd]]],'eScholarship 原始论文 429，按 SQLite 主机退避。Fainman 仍为委员会主席低可信候选；查 UCSD 直接具名指导资料。');
personLine(d,'- 核查边界：',' '+source('SUTD 正式履历',sutd)+'。'+dpost);
schoolSource(d,' · '+source('SUTD 任用与研究原档',sutd));

const nus='https://www.physics.nus.edu.sg/faculty/lee-ching-hua/';
const sj='https://sites.google.com/site/justincsong/team-members';
const hom='https://chltw.github.io/experience/';
const song='人员 - NTU - Justin Song - 9b21f9df';
const lp='Justin Song 的 Quantum Materials Theory 实验室在 Alumni 下列 Ching Hua Lee（2019–2020），去向 NUS 物理助理教授。组档未列其在组内的具体职衔，按博士后阶段候选保留，低可信。';
const idnote='NUS 物理系原档为 2015 Stanford 物理博士及 NUS 教授。另一同名者的本人经历为 2016–2020 UCSD ECE 研究生，此后从事 Samsung、Apple 音频机器学习。两人经历不同。';
const la=audit(l,[['identity',idnote,[nus,hom]],['affiliation','NUS 物理系副教授及 2026–2029 Dean’s Chair Professor。',[nus]],['research','NUS 物理系原页列非厄米、非平衡和拓扑量子系统研究。',[nus]],['postdoc',lp,[sj,nus]]],'找 2019–2020 组内任用身份、2015 之后各职位和个人正式指导。');
audits.at(-1).aspects.postdoc.status='group_or_candidate';
addRelation(l,la,'song','postdoc',song,'candidate',lp,[sj,nus]);
const lidx=putEdge({id:l,name:'Ching Hua Lee',mentor:song,mentorName:'Justin Song',role:'博士后导师候选',reverse:'博士后阶段候选关系',details:source('Justin Song 实验室原档',sj)+'。'+lp});
addIndex(path.join(root,'师承候选线索索引.md'),'NUS 博后候选补证（2026-11-10）',lidx);
schoolReplace(l,'| Xiao-Liang Qi | 待核 |','| Xiao-Liang Qi | Justin Song（2019–2020 组校友，博后候选） |');
schoolSource(l,' · '+source('Justin Song 实验室校友档',sj));
const mismatch=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(l,hom);
if(!mismatch)throw Error('缺少已保存的同名者原页');
const exclusion=[{page_id:mismatch.id,url:hom,record_id:l,audit_id:la,external_subject:'UCSD ECE 及 Samsung／Apple 音频机器学习 Ching-Hua Lee',evidence:idnote}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,exclusions:exclusion.length}));
 process.exit(0);
}
function persist(file,data) {
 fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');
}
function call(script,file) { execFileSync(process.execPath,['--no-warnings',script,...(script==='人物网页身份纠偏.cjs' ? [] : ['record']),file],{stdio:'inherit'}); }
for(const event of audits) {
 const file='20261110_1944_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates) fs.writeFileSync(file,contents,'utf8');
persist('20261110_1944_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_1944_结构化回执.json');


persist('20261110_1944_同名排除.json',exclusion);
call('人物网页身份纠偏.cjs','20261110_1944_同名排除.json');
