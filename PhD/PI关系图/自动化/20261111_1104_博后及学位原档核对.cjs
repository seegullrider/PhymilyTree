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
 const auditId='pi_archive_20261111_1104_'+id;
 if(orig.audit_id===auditId){
  audits.push(orig);
  return auditId;
 }
 orig.audit_id=auditId;

 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261111_1104_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






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
 const matches=(line,prefix,labels,target)=>line.includes(target)&&labels.some(label=>line.startsWith(prefix+label+'：'));
 const forward=[oldForward,newForward],back=[oldBack,newBack];
 rewrite(pf(id),x=>matches(x,'- ',forward,mFile),()=>'- '+newForward+'：'+to+after);
 rewrite(mf(mFile),x=>matches(x,'- ',back,rec.filename),()=>'- '+newBack+'：'+from+after);
 rewrite(index,x=>matches(x,'- '+from+' → ',forward,mFile),()=>'- '+from+' → '+newForward+'：'+to+after);
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

const u={
 roster:'https://physics.mit.edu/research/pappalardo-fellowships-in-physics/',
 hoff:'https://hoffmann.matse.illinois.edu/files/2024/03/Hoffmann-CV.pdf#page=8',
 hoff2:'https://hoffmann.matse.illinois.edu/files/2025/04/Hoffmann-CV.pdf#page=8',
 wei:'https://tarheels.live/zhanggroup/wp-content/uploads/sites/6762/2026/01/Wei_Zhang_CV_2026.pdf#page=1',
 weigroup:'https://tarheels.live/zhanggroup/',
 color:'https://www.colorado.edu/chemistry/media/658',
 flex:'https://www.zh.phy.cam.ac.uk/Publications/FletcherThesis.pdf',
 mit:'https://physics.mit.edu/faculty/richard-fletcher/',
 zw:'https://quantumgas.mit.edu/people/',
 shih:'https://web2.ph.utexas.edu/~nemrg/group.html',
 shihCV:'https://science.site.nthu.edu.tw/var/file/69/1069/img/4313/317652220.pdf#page=1',
 feen:'https://www.cmu.edu/physics/people/faculty-emeriti/feenstra.html',
 ibm:'https://research.ibm.com/publications/scanning-tunneling-microscopy-and-first-principles-theory-of-the-sngaas110-surface',
 ananth:'https://mrc.utexas.edu/sites/default/files/cv/Dodabalapur%20CV.pdf#page=1',
 tsao:'https://www.weewave.mer.utexas.edu/MED_files/Former_Students/thesis_dssrtns/Tsao_A_abstrct_TOC.html',
 aip:'https://pubs.aip.org/aip/apl/issue/60/8',
 victor:'https://spot.colorado.edu/~gurarie/Gurarie_cv_2015.pdf#page=1',
 ias:'https://www.ias.edu/sites/default/files/library/pdfs/ar/reportforacademi1997inst.pdf#page=83',
 cu:'https://experts.colorado.edu/display/fisid_129918',
 ber:'https://physics.berkeley.edu/news/three-trailblazing-scientists-join-faculty-2027-and-2028',
 patrick:'https://physics.mit.edu/research/pappalardo-fellowships-in-physics/patrick-ledwith/',
 cornell:'https://physics.cornell.edu/robert-thorne',
 bardeen:'https://archon.library.illinois.edu/archives/?id=690&p=collections%2Ffindingaid'
};
const pages=[];
const cite=(...pairs)=>pairs.map(([label,key])=>source(label,u[key])).join(' · ');
const trail=(id,text,links)=>rewrite(pf(id),s=>s.startsWith(boundary),()=>boundary+text+' '+links);
const schoolLinks=(id,links)=>schoolSource(id,' · '+links);
const obs=(record_id,key,raw,excerpt=raw)=>pages.push({record_id,url:u[key],raw,excerpt});
const stage=(key,text,keys,status)=>[key,text,keys.map(k=>u[k]),status];
const rel=(id,ai,phase,node,kind,desc,keys,suffix)=>relation(id,ai,phase,node,kind,desc,keys.map(k=>u[k]),suffix);

{
 const id='c079ed2b', name='Wei Zhang', ax='人员 - UIUC - Axel Hoffmann - 0b83a6d0', kr='师承人物 - Kannan M. Krishnan';
 const phd='本人 2026 CV 第 1 页列 University of Washington–Seattle 材料科学与工程 2013 博士和论文题目，advisor 栏为 Kannan M. Krishnan。';
 const post='Axel Hoffmann 的两份本人 CV 第 8 页在 POSTDOCS SUPERVISED 栏具名 Wei Zhang、UNC Chapel Hill 和 2013–2016。Wei Zhang 本人 CV 第 1 页列同任期 Argonne Postdoc Associate，身份及博士后指导吻合。';
 const lx=cite(['Hoffmann 本人 CV 第 8 页','hoff'],['Hoffmann 另一版第 8 页','hoff2'],['Wei Zhang 本人 CV 第 1 页','wei']);
 edge(id,name,ax,'Axel Hoffmann','博士后导师','博士后研究者',post,lx);
 trail(id,phd+' '+post,lx);
 school(id,'| 待核 |','| Axel Hoffmann（Argonne 2013–2016 博士后导师） |');
 schoolLinks(id,lx);
 const ai=audit(id,[stage('phd',phd,['wei'],'confirmed_advisor'),stage('postdoc',post,['hoff','hoff2','wei'],'confirmed_advisor'),
 stage('research','本人 UNC 组页核自旋电子学、磁振子、太赫兹与二维磁性。',['weigroup','wei'],'confirmed')],
 '两段具名导师已核。另有新的任用或指导档出现时再增补。');
 audits.at(-1).followup_required=false;
 rel(id,ai,'phd',kr,'advisor',phd,['wei'],'phd');
 rel(id,ai,'postdoc',ax,'advisor',post,['hoff','hoff2','wei'],'post');
 obs(id,'hoff','POSTDOCS SUPERVISED. Wei Zhang, 2013–2016, University of North Carolina at Chapel Hill.',post);
 obs(id,'wei','Wei Zhang lists Argonne Postdoc Associate from 2013.9 to 2016.9 and Kannan M. Krishnan as his PhD advisor.',phd+' '+post);
}
{
 const id='412600ca';
 const prev=JSON.parse(last.get(id).details_json);
 const mismatch='Colorado 的 Wei Zhang 本人 CV 列 Illinois 化学博士及 MIT 2006–2008 博后。Hoffmann 受指导者档的 2013–2016 博后后来任职 UNC，且 UNC 本人 CV 列 Washington 2013 博士与 Argonne 博后，两条身份已区分。';
 const lx=cite(['Colorado 本人 CV','color'],['UNC 本人 CV','wei'],['Hoffmann CV 第 8 页','hoff']);
 insertAfter(pf(id),'## 师承','\n- 同名核对。'+mismatch+' '+lx);
 schoolLinks(id,lx);
 audit(id,[stage('identity',prev.aspects.identity.note+' '+mismatch,['color','wei','hoff'],'confirmed')],prev.next_step);
}
{
 const id='a8264abd', name='Richard J. Fletcher', had='师承人物 - Zoran Hadzibabic', zw='人员 - MIT - Martin Zwierlein - 9b749439';
 const phd='Cambridge 博士论文封面列 Richard Jonathan Fletcher、物理系及 2015 年 4 月提交。致谢首段具名 Zoran，并叙述从早期暑研到博士论文期间持续指导和学术建议。MIT 物理系简介具名 Zoran Hadzibabic 为博士阶段研究者。学位原卷的正式 Supervisor 字段仍待核。';
 const post='MIT 物理系 Pappalardo 名录列 Fletcher 2016–2019。MIT 院系履历称与 Martin Zwierlein 开展人工磁场下量子流体研究，Zwierlein 本人组档在 Former Group Members 将 Fletcher 明列为 Pappalardo 博后。记录阶段研究师长及组属，正式聘任指导称谓待核。';
 const pl=cite(['Cambridge 本人博士论文','flex'],['MIT 物理系','mit']);
 const ps=cite(['MIT 物理系','mit'],['Zwierlein 组原档','zw'],['Pappalardo 名录','roster']);
 updateEdge(id,name,had,'Zoran Hadzibabic','博士阶段研究师长／导师候选','博士阶段受指导者／导师候选','博士阶段研究师长、正式论文导师候选','博士阶段受指导者、正式论文导师候选',phd,pl);
 updateEdge(id,name,zw,'Martin Zwierlein','博士后阶段研究师长','博士后阶段受指导者','博士后阶段研究师长','博士后阶段受指导者',post,ps);
 trail(id,phd+' '+post,pl+' · '+ps);
 schoolLinks(id,pl+' · '+ps);
 const ai=audit(id,[stage('phd',phd,['flex','mit'],'group_or_candidate'),stage('postdoc',post,['mit','zw','roster'],'group_or_candidate')],'查 Cambridge 学位元数据或导师登记及 MIT 个人聘用的正式指导称谓。');
 rel(id,ai,'phd',had,'stage_mentor',phd,['flex','mit'],'phd');
 rel(id,ai,'postdoc',zw,'stage_mentor',post,['mit','zw','roster'],'post');
 obs(id,'flex','The 2015 Cambridge dissertation is authored by Richard Jonathan Fletcher. Acknowledgements describe Zoran’s continuing academic guidance throughout the work.',phd);
 obs(id,'zw','Richard Fletcher is listed as a Pappalardo Postdoctoral Fellow in the two-dimensional Fermi gases project.',post);
}
{
 const id='c015ff74', name='Chih-Kang (Ken) Shih', fe='人员 - Carnegie Mellon - Randall Feenstra — 荣休 - 8688e0dd';
 const e='本人 UT 组页列 IBM Watson 1988–1989 博后，清华大学（台湾）校友原档细化为 1988 年 5 月至 1989 年 12 月。CMU 院系档列 Randall Feenstra 1982–1995 IBM Watson 研究员。1989 IBM 论文档同列 Shih 和 Feenstra 为 IBM 作者，证实同期扫描隧道研究合作。Feenstra 保留为低可信博后指导候选，需任用或明确指导原文。';
 const lx=cite(['本人 UT 组页','shih'],['清华校友履历','shihCV'],['CMU Feenstra 系档','feen'],['1989 IBM 论文原档','ibm']);
 edge(id,name,fe,'Randall Feenstra','博士后导师候选','博士后研究者候选',e,lx);
 trail(id,'SSRL 所载 Spicer 博士导师及既有共同指导线索照录。'+e,lx);
 school(id,'| 待核 |','| IBM Watson 1988–1989；Randall Feenstra（合作证据，低可信候选） |');
 schoolLinks(id,lx);
 const ai=audit(id,[stage('postdoc',e,['shih','shihCV','feen','ibm'],'group_or_candidate')],'查 Stanford 学位原件及 IBM Watson 博后组任命，核 Feenstra 与合作者各自角色。');
 rel(id,ai,'postdoc',fe,'candidate',e,['shih','shihCV','feen','ibm'],'ibm');
 obs(id,'ibm','IBM archive for the November 1989 publication names C. K. Shih and R. M. Feenstra among IBM-affiliated authors.',e);
 obs(id,'shihCV','Alumni career history lists IBM T. J. Watson postdoctoral research from May 1988 to December 1989.',e);
}
{
 const id='c1c5fb23';
 const phd='本人 CV 核 UT Austin 1990 电气工程博士。UT 存 Alwin J. Tsao 1993 论文致谢列 Dodabalapur 为 MBE 组成员。Tsao 的正式 Supervisor 是 Dean Neikirk，Streetman 是 Tsao 委员会及设备相关人物。该原文为 Dodabalapur 博士时期组属线索，Streetman 仍是低可信个人指导候选。';
 const post='本人 CV 首页明确 1990 年 7 月至 1992 年 9 月 AT&T Bell Labs Post-doctoral Member of Technical Staff。AIP 1992 同期器件论文具名 T. Y. Chang，保存为同期合作及可追查的人员线索。全名与指导职衔仍待原始资料。';
 const lx=cite(['本人 CV 第 1 页','ananth'],['UT Tsao 学位原档','tsao'],['AIP 1992 原刊目录','aip']);
 trail(id,phd+' '+post,lx);
 schoolLinks(id,lx);
 audit(id,[stage('phd',phd,['ananth','tsao'],'group_or_candidate'),stage('postdoc',post,['ananth','aip'],'unresolved')],
 '继续查 UT 1990 本人论文。另查 Bell Labs 1990–1992 博后组记录及 T. Y. Chang 的全名和指导职责。');
 obs(id,'tsao','Tsao’s 1993 doctoral acknowledgements identify Dodabalapur among the MBE group members and identify Dean P. Neikirk as Tsao’s supervisor.',phd);
}
{
 const id='c1402a03';
 const post='本人 CV 分列 1996–1997 IAS Member、1997–2000 UCSB ITP 凝聚态理论博后、2000–2002 Oxford 凝聚态理论组博后，以及 2002–2003 Oxford EPSRC Advanced Fellow。IAS 1996–97 年报第 83 PDF 页核自然科学与数学两校联合 Member。个人导师仍待核。';
 const lx=cite(['本人 CV','victor'],['IAS 年报第 83 PDF 页','ias'],['CU Boulder 研究档','cu']);
 trail(id,post,lx);
 school(id,'| 待核 |','| IAS Member 1996–1997；UCSB ITP 博后 1997–2000；Oxford 博后 2000–2002、EPSRC Fellow 2002–2003；具名导师待核 |');
 schoolLinks(id,lx);
 audit(id,[stage('postdoc',post,['victor','ias'],'unresolved')],'查 UCSB ITP 和 Oxford 组的原始任用或具名个人指导记录，保留四段履历。');
 obs(id,'ias','The 1996–97 IAS annual report names Victor Gurarie in Mathematics and Natural Sciences and lists his Princeton association.',post);
}
{
 const id='dfc4f320';
 const pd='MIT Pappalardo 名录当前栏明确 Patrick Ledwith 2025–2028。Berkeley 2026 年 9 月物理系公告为未来入职（2027 或 2028），未列个人到任年月。保留 MIT 当前博士后与 Berkeley 计划任用。导师待核。';
 const lx=cite(['MIT Pappalardo 届别原档','roster'],['Berkeley 物理系任用公告','ber']);
 trail(id,pd,lx);
 school(id,'| 待核 |','| MIT Pappalardo 2025–2028 届；具名导师待核 |');
 schoolLinks(id,lx);
 audit(id,[stage('postdoc',pd,['roster','patrick','ber'],'unresolved')],'查 MIT Pappalardo 个人接收教师及 Berkeley 计划到任日期。');
 obs(id,'roster','Patrick Ledwith appears in the current fellows list as 2025–2028 Pappalardo Fellow in condensed matter theory.',pd);
}
{
 const id='c232d17b', name='Robert Thorne', topic='生物物理';
 const research='Cornell 物理系原档列生物物理、实验凝聚态及物理教育。现行研究含低温样品制备、冷冻电镜和时间分辨生物分子 X 射线晶体学。电荷密度波保留历史研究方向。';
 const lx=cite(['Cornell 物理系研究档','cornell']);
 personLine(id,'- 研究方向：',' '+wiki('已核实方向 - '+topic,topic)+'。'+research+' '+lx);
 const tf=path.join(root,'已核实方向','已核实方向 - '+topic+'.md');
 const before=get(tf);
 if(!before.includes(records.get(id).filename)){
  const nl=before.includes('\r\n')?'\r\n':'\n';
  updates.set(tf,before.trimEnd()+nl+'- '+who(id,name)+' — '+research+' '+lx+nl);
 }
 school(id,'物理系；凝聚态实验、电荷密度波、低温物理','物理系；生物物理、冷冻电镜和时间分辨 X 射线晶体学；历史研究包括实验凝聚态、电荷密度波和低温物理');
 schoolLinks(id,lx);
 const post='Cornell 系档列 1987 年 Illinois 博士、1988 年起 Cornell 助理教授；该间隔的聘任未列。Illinois Bardeen 纸本档目录定位 Thorne 1986–1990 通信及 1986–1987 稿件，档目本身不足以认定博士后任用或导师。';
 const src=cite(['Cornell 物理系','cornell'],['Illinois Bardeen 纸本档目录','bardeen']);
 trail(id,'保留 John R. Tucker 博士阶段研究师长。'+post,src);
 audit(id,[stage('research',research,['cornell'],'confirmed'),stage('postdoc',post,['cornell','bardeen'],'unresolved')],'续找 Illinois 论文原件和 1987–1988 任用。Bardeen 纸本档 Box 28 Folder 2 是可定位的原始记录。');
 obs(id,'cornell','Cornell lists Illinois 1987 PhD and Cornell faculty from 1988, and describes cryoEM and time-resolved X-ray crystallography.',research);
}
const fellow=JSON.parse(fs.readFileSync('20261111_Pappalardo博后名录比对.json','utf8'));
const reviewedFellow=fellow.matches.flatMap(m=>m.candidates.map(c=>{
 const detail=JSON.parse(last.get(c.id).details_json);
 return {record_id:c.id,listed_name:m.name,listed_period:m.description,listed_affiliation:m.affiliation,
  school:c.unit,source:m.url,previous_stage_status:detail.aspects.postdoc.status,
  existing_stage_note:detail.aspects.postdoc.note,existing_stage_sources:detail.aspects.postdoc.sources};
}));
const hoff=JSON.parse(fs.readFileSync('20261111_Hoffmann导师名录比对.json','utf8'));
if(hoff.matches.length!==1||hoff.matches[0].name!=='Wei Zhang'||reviewedFellow.length!==19)throw Error('roster mismatch');
const rosterReview={
 pappalardo:{source:fellow.source,entries:fellow.source_entries,matches:reviewedFellow,
  interpretation:'The official fellowship roster establishes appointments and terms, with latest audit evidence retained for individual guidance.'},
 hoffmann:{source:hoff.source,entries:hoff.source_entries,outcomes:[
   {record_id:'c079ed2b',status:'advisor_confirmed',sources:[u.hoff,u.hoff2,u.wei]},
   {record_id:'412600ca',status:'different_person',sources:[u.hoff,u.wei,u.color]}
 ]}
};
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length,roster_matches:reviewedFellow.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n','utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_1104_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261111_Pappalardo及Hoffmann名录核对.json',rosterReview);
const rf='20261111_1104_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_1104_原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);

