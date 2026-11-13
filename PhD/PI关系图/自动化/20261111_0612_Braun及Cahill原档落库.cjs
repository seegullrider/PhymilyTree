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
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mf=name=>path.join(notes,name+'.md');
const sl=id=>path.join(root,records.get(id).unit+'逐人复核记录.md');
const wiki=(name,display)=>'[['+name+'|'+display+']]';
const who=(id,display)=>wiki(records.get(id).filename,display);
const get=file=>updates.get(file)??fs.readFileSync(file,'utf8');
const boundary='- 核查边界：';
function rewrite(file,test,fn) {
 const content=get(file);
 const nl=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const indexes=rows.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(indexes.length!==1)throw Error(file+' expected one matching row, found '+indexes.length);
 const i=indexes[0];
 rows[i]=fn(rows[i],nl);
 updates.set(file,rows.join(nl));
}
function school(id,oldField,newField) {
 const r=records.get(id);
 rewrite(sl(id),x=>x.startsWith('| [['+r.filename+'|'),x=>{
  if(x.includes(newField))return x;
  if(!x.includes(oldField))throw Error('missing school field '+id);
  return x.replace(oldField,newField);
 });
}
function insertAfter(file,prefix,entry){
 if(get(file).includes(entry))return;
 rewrite(file,x=>x===prefix,(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261111_0612_'+id;
 orig.followup_required=true;
 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261111_0612_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"braun":"https://braun.matse.illinois.edu/alumni/postdoctoral-researchers/","cahill":"https://cahill.matse.illinois.edu/files/2025/12/cv25.pdf#page=10","cahillRoster":"https://cahill.matse.illinois.edu/group-alumni/","mark":"https://mse.gatech.edu/people/mark-losego","bevan":"https://engineering.jhu.edu/chembe/faculty/michael-bevan/","lewis":"https://lewisgroup.seas.harvard.edu/team","bowers":"https://optoelectronics.ece.ucsb.edu/alumni","mirin":"https://www.nist.gov/people/richard-mirin","ucs":"https://www.ece.ucsb.edu/people/faculty/richard-mirin","nist":"https://upload.wikimedia.org/wikipedia/commons/e/ea/EEEL_1996,_technical_accomplishments-_advancing_metrology_for_electrotechnology_to_support_the_U.S._Economy_(IA_eeel1996technica5941unse).pdf#page=62","soci":"https://web.eng.ucsd.edu/ece/groups/iebl/Papers/Nano_Today_June_2009.pdf#page=12","socint":"https://www1.spms.ntu.edu.sg/~oson/people/cesare_soci.html","sociuc":"https://www.eurekalert.org/news-releases/839976","acs":"https://pubs.acs.org/doi/full/10.1021/acsaelm.5c02540","leong":"https://personal.ntu.edu.sg/wlleong/gl.html","leongDir":"https://www.ntu.edu.sg/sarc/about-us/faculty-directory","turn":"https://engineering.msu.edu/directory/faculty/turnleyj","jqi":"https://www.jqi.umd.edu/news/new-jqi-fellow-harnesses-light-emerging-quantum-tech","luo":"https://engineering.jhu.edu/materials/faculty/yuting-luo/","dong":"https://physics.ucdavis.edu/people/faculty/dong-yu","cvdong":"https://yu.physics.ucdavis.edu/CV_Yu.pdf"};
const src=(...xs)=>xs.map(([label,key])=>source(label,u[key])).join(' · ');
const pl=(id,prefix,evidence)=>personLine(id,prefix,' '+evidence);
const schoolWith=(id,evidence)=>schoolSource(id,' · '+evidence);
const a=(key,note,sources,status)=>[key,note,sources.map(k=>u[k]),status];
function cell(id,n,value){
 const prefix='| [['+records.get(id).filename+'|';
 rewrite(sl(id),x=>x.startsWith(prefix),x=>{
  const end=x.indexOf(']]'), cells=x.slice(end+2).split(' | ');
  if(end<0||cells.length<4)throw Error('missing school cells '+id);
  cells[n]=value;
  return x.slice(0,end+2)+cells.join(' | ');
 });
}
function mentor(file,name,desc,links){
 if(fs.existsSync(mf(file)))return;
 updates.set(mf(file),['# '+name,'','- 类型：师承扩展人物','- '+desc+' '+links,'','## 师承',''].join('\n'));
}
function edge(id,name,mFile,mName,fLabel,bLabel,note,links){
 if(!links)throw Error('edge requires sources '+id);
 const from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 insertAfter(pf(id),'## 师承','\n- '+fLabel+'：'+to+after);
 insertAfter(mf(mFile),'## 师承','\n- '+bLabel+'：'+from+after);
 insertAfter(index,'# 师承关系与候选线索索引','\n- '+from+' → '+fLabel+'：'+to+after);
}
function updateEdge(id,name,mFile,mName,oldForward,oldBack,newForward,newBack,note,links){
 const rec=records.get(id),from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 rewrite(pf(id),x=>x.startsWith('- '+oldForward+'：')&&x.includes(mFile),()=>'- '+newForward+'：'+to+after);
 rewrite(mf(mFile),x=>x.startsWith('- '+oldBack+'：')&&x.includes(rec.filename),()=>'- '+newBack+'：'+from+after);
 rewrite(index,x=>x.startsWith('- '+from+' → '+oldForward+'：')&&x.includes(mFile),()=>'- '+from+' → '+newForward+'：'+to+after);
}
function unit(id,name,label,detail,links){
 const schoolName=records.get(id).unit, node='已核实单位 - '+schoolName+' - '+label;
 const file=path.join(root,'已核实院系',node+'.md');
 const line='- '+who(id,name)+' — '+detail+' '+links;
 const header='[[院校 - '+schoolName+'|返回学校]]';
 if(!fs.existsSync(file)&&!updates.has(file))updates.set(file,['# '+schoolName+'：'+label,'',header,'','## 已核实人物','',line,''].join('\n'));
 else if(!get(file).includes(records.get(id).filename)){
  const contents=get(file), nl=contents.includes('\r\n')?'\r\n':'\n';
  updates.set(file,contents.trimEnd()+nl+line+nl);
 }
 rewrite(pf(id),x=>x.startsWith('- 院系／机构：'),x=>x.includes(node)?x:x.replace(/。$/,'')+' · '+wiki(node,label)+'。');
}




const ids=(...keys)=>keys.map(k=>u[k]);




const mark='62557402', bevan='62c4df3b', mirin='26350631', soci='fba2e894', leong='a23a1dad', turn='9b649eef', dutt='411d7061', luo='1bd9e75f', dong='47d737ac';
const braun='人员 - UIUC - Paul V. Braun - 429d125d', cahill='人员 - UIUC - David G. Cahill - 6d81f0c4';
const post='博士后导师', rev='博士后指导对象';
const pages=[];
function read(record_id,k,raw){pages.push({record_id,url:u[k],raw,excerpt:raw});}
function failure(record_id,k,error){pages.push({record_id,url:u[k],error});}
const ml=src(['Cahill 本人 CV 第 10 页','cahill'],['Cahill 组原档','cahillRoster'],['Braun 组原档','braun'],['Georgia Tech 院系','mark']);
const mNote='Cahill 本人履历把 Losego 列入博士后研究人员并明确写由他与 P. Braun 共同指导，任期为 2008 年 9 月至 2011 年 9 月。Braun 组校友表和 Georgia Tech 院系履历核对任期、身份及研究。共同导师关系可信度高。';
updateEdge(mark,'Mark D. Losego',braun,'Paul V. Braun','博士后课题组负责人','博士后课题组成员',post,rev,mNote,ml);
edge(mark,'Mark D. Losego',cahill,'David G. Cahill',post,rev,mNote,ml);
rewrite(pf(mark),x=>x.startsWith(boundary),()=>boundary+'NC State 博士导师 Jon-Paul Maria 保留原论文证据。Illinois 2008–2011 年两位博士后共同导师由 Cahill 本人 CV 和组页明确。 '+ml);
cell(mark,3,'David G. Cahill、Paul V. Braun（Illinois 博士后共同导师，2008-09 至 2011-09）');
schoolWith(mark,ml);
const ma=audit(mark,[a('affiliation','Georgia Tech 材料科学与工程系教授，Dean’s Education Innovation Professor。',['mark'],'confirmed'),a('research','有机-无机杂化材料与界面、气相薄膜工艺与热输运。',['mark'],'confirmed'),a('postdoc',mNote,['cahill','cahillRoster','braun','mark'],'confirmed_advisor')],'已核两位博士后共同导师及 NC State 博士导师，后续仅按新原档增量更新。');
audits.at(-1).followup_required=false;
relation(mark,ma,'postdoc',braun,'advisor',mNote,ids('cahill','cahillRoster','braun','mark'),'braun');
relation(mark,ma,'postdoc',cahill,'advisor',mNote,ids('cahill','cahillRoster','braun','mark'),'cahill');
read(mark,'cahill','第 10 页博士后名单具名 Mark Losego，由 Cahill 与 P. Braun 共同指导，2008 年 9 月至 2011 年 9 月，去向 Georgia Tech。');
read(mark,'cahillRoster','博士后名单注明 Mark Losego 由 Cahill 与 Braun 共同指导。');
read(mark,'braun','原校友表列 Mark Losego 和 Illinois 博士后时间 2008-09 至 2011-09，去向 Georgia Tech。');
read(mark,'mark','Georgia Tech 材料系教授，研究有机无机杂化材料及界面。2008 NC State 材料博士，Illinois 博士后。');
const be=src(['Braun 组原档','braun'],['Lewis 组原档','lewis'],['JHU 院系','bevan']);
const bNote='Braun 组原档以 Mike Bevan 列 2001–2002 Beckman 博士后和 Johns Hopkins 去向，Lewis 组原档亦列同一人及任期。两组组属均有原档，个人指导角色仍待任用档确认。';
edge(bevan,'Michael Bevan',braun,'Paul V. Braun','博士后课题组负责人','博士后课题组成员',bNote,be);
pl(bevan,boundary,bNote+' '+be);
cell(bevan,3,'Jennifer A. Lewis、Paul V. Braun（2001–2002 Illinois 博后课题组；正式导师待核）；Melbourne 师长待核');
schoolWith(bevan,be);
const ba=audit(bevan,[a('identity','JHU 化工系原档为 Michael A. Bevan、Carnegie Mellon 1999 博士，Braun 原档 Mike Bevan 对应同一 Johns Hopkins 教职、同期 Lewis 博后。',['bevan','braun','lewis'],'confirmed'),a('postdoc',bNote,['braun','lewis','bevan'],'group_or_candidate')],'查 Carnegie Mellon 学位原档，核 Dennis C. Prieve 的导师角色。查 Melbourne 博后指导及 Illinois Beckman 任用文件。');
relation(bevan,ba,'postdoc',braun,'group_leader',bNote,ids('braun','lewis','bevan'),'braun');
read(bevan,'braun','Mike Bevan，2001–2002 Beckman Postdoctoral Fellow，后任 Johns Hopkins 教职。');
read(bevan,'bevan','Michael A. Bevan，JHU 化学与生物分子工程教授，Carnegie Mellon 1999 博士，研究胶体与自组装。');
const mi='NIST 1996 财年光电子学部同期名录第 62 页在 Mirin 姓名后标 PREP；同页另有 PD 标签，手册将其释为博士后任用。Mirin 的具体合同与个人指导仍待核。';
pl(mirin,'- 博士后：',mi+' '+src(['NIST 同期名录第 62 页','nist'],['NIST 履历','mirin']));
cell(mirin,3,'1996 NIST 光电子学部档列 PREP；是否另有博士后及指导人待核');
schoolWith(mirin,src(['NIST 1996 原档','nist'],['NIST 履历','mirin'],['Bowers 原校友表','bowers']));
audit(mirin,[a('identity','UCSB 与 NIST 院系履历、Bowers 校友表核同一光电子研究者。',['ucs','mirin','bowers'],'confirmed'),a('postdoc',mi,['nist','mirin'],'unresolved')],'查 NIST 1996 PREP 合同类别与同期项目人员文件，补具体任用及具名指导。');
read(mirin,'nist','1996 财年 EEEL 同期名录第 62 页列 Richard Mirin (PREP)，另以 PD 标博士后任用。');
read(mirin,'mirin','NIST 1996 入职，量子光子学与单光子探测。');
read(mirin,'bowers','实验室校友表列 Richard Mirin，汇总表不分阶段。');
const sn='2009 年本人作者履历分列 Pavia 2005 物理博士、UCSB 聚合物与有机固体中心 2005–2006 博后及 2006 年起 UCSD ECE 博后。UCSD 2007 同期新闻稿指明 Deli Wang 组，UCSB 博士后个人指导与 Pavia 正式导师待核。';
const ss=src(['本人同期作者简介第 12 页','soci'],['NTU 本人组页','socint'],['UCSD 同期新闻稿','sociuc']);
pl(soci,boundary,sn+' '+ss);
cell(soci,2,'Pavia 2005；Heeger（博士阶段课题组，Pavia 正式导师待核）');
cell(soci,3,'2005–2006 UCSB CPOS，导师待核；2006–2009 UC San Diego ECE，Deli Wang（课题组负责人）');
schoolWith(soci,ss);
audit(soci,[a('affiliation','NTU 物理与数学科学学院、电气与电子工程双聘。',['socint'],'confirmed'),a('research','光谱学、光电子材料及纳米光子学。',['socint'],'confirmed'),a('phd','同期作者履历核 Pavia 2005 博士，UCSD 校方稿说明部分博士研究在 Heeger 组。正式导师待 Pavia 学位原档。',['soci','sociuc'],'group_or_candidate'),a('postdoc',sn,['soci','sociuc'],'group_or_candidate')],'查 Pavia 学位档具名导师。ACS 周年文章检索索引另提示 Heeger 组博后经历，出版网页 403，待原文并校对与同期履历 2006／2007 的口径。');
read(soci,'soci','本人 Nano Today 2009 作者简介第 12 页，Pavia 2005 博士；UCSB CPOS 2005–06 和 UCSD ECE 自 2006 博后。');
read(soci,'socint','NTU 物理与数学科学、电气与电子工程双聘及光谱、光电子材料研究。');
read(soci,'sociuc','2007 UCSD 新闻稿称 Soci 在 Deli Wang 组做博后，博士阶段部分工作在 Heeger 组。');
failure(soci,'acs','ACS 出版原页返回 403。检索索引有 UCSB 博后线索，正文未核，不确认角色。');
const ll=src(['NTU 本人组页','leong'],['NTU 中心名录','leongDir']);
pl(leong,boundary,'本人组页的 NTU 现行地址独立读回，保留 Alan Heeger 为博士后阶段研究师长。 '+ll);
schoolWith(leong,ll);
audit(leong,[a('affiliation','NTU EEE，SaRC 院系名录及本人组页。',['leong','leongDir'],'confirmed'),a('research','有机半导体、柔性电子与光伏材料。',['leong','leongDir'],'confirmed'),a('postdoc','本人称 UCSB 博士后 under Alan Heeger，保持阶段研究师长。',['leong'],'group_or_candidate')],'优先查 NTU 博士论文或授位档，及 UCSB 博后 fellowship 任用与导师条目。');
read(leong,'leong','本人组页列 2009 NTU 材料博士，UCSB fellowship under Alan Heeger，2012 加入 IMRE，2016 NTU EEE。');
const tn='Braun 组档将 Illinois 博后列为 2023 年 10 月至 2025 年 7 月及 Michigan State 去向。';
const ts=src(['Braun 组原档','braun'],['Michigan State 院系','turn']);
pl(turn,'- 博士后导师：',tn+' '+ts);
cell(turn,3,'Paul Braun（Illinois 博士后导师，2023-10 至 2025-07）');
schoolWith(turn,ts);
audit(turn,[a('affiliation','Michigan State 化学工程与材料科学系。',['turn','braun'],'confirmed'),a('postdoc',tn+' 正式导师依据本人实验室原导师栏。',['braun'],'confirmed_advisor')],'两阶段导师均有原档，后续按新原档增量更新。');
audits.at(-1).followup_required=false;
read(turn,'braun','Jonathan Turnley，2023-10 至 2025-07，后任 Michigan State 助理教授。');
const dn='JQI 原访谈确认博士阶段随 Lipson 从 Cornell 到 Columbia，并与 Paulo Nussenzveig 研究；2017 授位后加入 Stanford Fan 组。Maryland 和 Stanford 档列的博后结束年 2021／2022 保留待核。';
pl(dutt,boundary,dn+' '+src(['JQI 原访谈','jqi']));
schoolWith(dutt,src(['JQI 原访谈','jqi']));
audit(dutt,[a('phd','JQI 访谈核 Lipson 博士指导、随组转 Columbia 及 Nussenzveig 合作，正式博士导师依据论文原卷。',['jqi'],'confirmed_advisor'),a('postdoc',dn,['jqi'],'group_or_candidate')],'查 Fan 本人 CV 或 Stanford 任用档是否具名个人指导，并对齐 2021／2022 的任期口径。');
read(dutt,'jqi',dn);
const ln='JHU 材料系原档核 2022 Texas A&M 化学博士、Illinois 材料系博士后和 2024 年 1 月任职，研究固态离子、材料电化学及储能。Braun 组原档核博后 2022 年 4 月至 2023 年 12 月。';
pl(luo,boundary,ln+' '+src(['JHU 院系','luo'],['Braun 组原档','braun']));
schoolWith(luo,src(['JHU 材料系原档','luo']));
audit(luo,[a('affiliation','JHU 材料科学与工程系助理教授，ROSEI 核心成员。',['luo'],'confirmed'),a('research','储能材料、固态离子、材料电化学与表征。',['luo'],'confirmed'),a('postdoc',ln+' 正式指导角色仍待具名档。',['luo','braun'],'group_or_candidate')],'查本人博士后 CV 或 Illinois 任用档中 Braun 的具体指导称谓。');
read(luo,'luo',ln);
read(luo,'braun','Yuting Luo，2022-04 至 2023-12 博后，后任 Johns Hopkins 助理教授。');
const du='UC Davis 院系原档列 Dong Yu 2005 Chicago 物理博士、2005–2008 Harvard 博士后。Braun 名录同期间为 Dong-Guk Yu 在 Illinois 博后，依全名、机构与去向排除该匹配。';
pl(dong,boundary,du+' '+src(['UC Davis 院系','dong'],['Illinois 名录','braun']));
schoolWith(dong,src(['UC Davis 院系履历','dong']));
audit(dong,[a('identity',du,['dong','braun'],'confirmed'),a('affiliation','UC Davis 物理与天文学系。',['dong'],'confirmed'),a('research','凝聚态实验及胶体纳米晶、半导体纳米结构的光电性质和输运。',['dong'],'confirmed')],'继续查 University of Chicago 2005 学位原件以及 Harvard 2005–2008 博后任用，既有两条导师候选仍待核。');
read(dong,'dong',du);
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0612_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0612_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0612_Braun与Cahill及任用原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
