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
 orig.audit_id='pi_archive_20261111_0706_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0706_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"hgroup":"https://dudley-herschbach.faculty.chemistry.harvard.edu/pages/former-group","hpdf":"https://dudley-herschbach.faculty.chemistry.harvard.edu/sites/g/files/omnuum7781/files/dudley-herschbach/files/dudley_herschbachs_students_and_postdocs.pdf","duk":"https://yanglab.chem.duke.edu/people/alumni/","mc":"https://chemistry.uchicago.edu/faculty/david-mazziotti","mb":"https://mazziotti.uchicago.edu/members/david/","mm":"https://news.uchicago.edu/story/chemist-tames-longstanding-electron-computation-problem","apsm":"https://journals.aps.org/pra/abstract/10.1103/PhysRevA.60.4396","ads":"https://ui.adsabs.harvard.edu/abs/1999PhDT........42M/abstract","mason":"https://pme.uchicago.edu/directory/nadya-mason","mp":"https://physics.illinois.edu/people/directory/profile/nadya","kap":"https://kapitulnik.stanford.edu/people","mr":"https://www.mrsec.harvard.edu/research/nugget_22.php","soc":"https://socfell.fas.harvard.edu/2000-2009","pq":"https://www.proquest.com/docview/304727938/abstract","oral":"https://doi.org/10.1063/nbla.wqqr.cjwo","cq":"https://chicagoquantum.org/people/joseph-heremans","ornl":"https://events.ornl.gov/sqc26/speakers/joseph-heremans/","pc":"https://professional.uchicago.edu/person/f-joseph-heremans-phd","arg":"https://www.anl.gov/profile/f-joseph-heremans","psu":"https://science.psu.edu/physics/people/nxk913","arr":"https://arratia.engineering.upenn.edu/people/","pn":"https://penntoday.upenn.edu/news/penn-researchers-design-failure-model-material","nag":"https://nagelgroup.uchicago.edu/Nagel-Group/members.html","kp":"https://physics.aps.org/articles/v10/18","kn":"https://www.eurekalert.org/news-releases/917218","kit":"https://chemistry.jhu.edu/directory/kit-hansell-bowen-jr/","cv":"https://ece.ncsu.edu/wp-content/uploads/2026/01/Kais-CV-2026.pdf","kai":"https://quantum.ncsu.edu/people/sabre-kais/","coh":"https://cris.huji.ac.il/en/persons/maurice-cohen/","cp":"https://cris.huji.ac.il/en/publications/rayleigh-schrodinger-perturbation-theory-with-a-strong-perturbati/"};
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



const pages=[];
const p=(record_id,key,raw,excerpt)=>pages.push({record_id,url:u[key],raw,excerpt});
const fail=(record_id,key,error)=>pages.push({record_id,url:u[key],error});
const end=(id,note,links)=>rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+note+' '+links);

{
 const id='f9610fd7',name='David A. Mazziotti',h='师承人物 - Dudley R. Herschbach',y='人员 - Duke - Weitao Yang - 8d6cfdc7';
 const phd='Harvard Herschbach 组原档及 2012 年出版名录均把 Mazziotti 列在 1999 年 Graduate Students。Chicago 原访谈称 Herschbach 为其 graduate school mentor。保持博士阶段研究师长，论文签署角色待核。';
 const duke='Duke Yang 组在 Postdoctoral Alumni 项列 Mazziotti，任期 1999–2000，方向为约化密度矩阵。本人组档和 1999 年原刊分别证实 Duke 博后及当期 Duke 化学系单位。博士后组属可信度高，正式导师职衔待核。';
 const pri='本人组页与 Chicago 化学系原档列 Duke 之后有 Princeton NSF 博后；Herschel Rabitz 保留原低可信候选，待当期资助或任用。';
 const hlinks=src(['Herschbach 组学员原档','hgroup'],['出版名录第 2 页','hpdf'],['Chicago 原访谈','mm']);
 const yl=src(['Duke Yang 组博士后原档','duk'],['本人组页','mb'],['1999 年原刊','apsm']);
 updateEdge(id,name,h,'Dudley R. Herschbach','博士研究师长','博士阶段研究者','博士研究师长','博士阶段研究者',phd,hlinks);
 edge(id,name,y,'Weitao Yang','博士后课题组负责人','博士后课题组成员',duke,yl);
 end(id,phd+' '+duke+' '+pri,src(['Chicago 化学系','mc'])+' · '+yl+' · '+hlinks);
 cell(id,3,'Weitao Yang（Duke 1999–2000 博士后课题组）；Herschel Rabitz（Princeton NSF 博后低可信候选）');
 schoolWith(id,hlinks+' · '+yl);
 const e=audit(id,[a('identity','Harvard 1999 博士、Duke 博后及 Chicago 任职在两组原档与本校履历间一致。',['hgroup','duk','mc','mb'],'confirmed'),a('affiliation','Chicago 化学系、James Franck Institute。',['mc','mb'],'confirmed'),a('research','多体电子结构、约化密度矩阵与量子材料计算。',['mc','mb'],'confirmed'),a('phd',phd,['hgroup','hpdf','mm'],'group_or_candidate'),a('postdoc',duke+' '+pri,['duk','mb','mc','apsm'],'group_or_candidate')],'找 Harvard 学位原卷签署信息、Duke 具名指导职衔及 Princeton NSF fellowship 原任用档。');
 relation(id,e,'phd',h,'stage_mentor',phd,ids('hgroup','hpdf','mm'),'herschbach');
 relation(id,e,'postdoc',y,'group_leader',duke,ids('duk','mb','apsm'),'yang');
 p(id,'hgroup','The Herschbach Graduate Students section lists David Mazziotti with 1999 and his Duke postdoctoral placement.','核博士组属及去向。');
 p(id,'hpdf','Published lab roster lists David Mazziotti in Graduate Students, vintage 1999.','交叉核博士阶段。');
 p(id,'duk','Weitao Yang’s Postdoctoral Alumni lists David Mazziotti for 1999–2000 and his reduced-density-matrix research.','核博后组属及任期。');
 p(id,'mb','Mazziotti’s lab bio lists Harvard Chemical Physics PhD in 1999 and postdoctoral research at Duke and Princeton.','核任用顺序、院系和方向。');
 p(id,'apsm','APS original article lists Duke Chemistry as Mazziotti’s then present address in 1999.','补同一人及当期单位。');
 fail(id,'ads','Public ADS abstract endpoint returned an internal error. Dissertation identifier is a finding aid; no advisor evidence extracted.');
}
{
 const id='a2c1fc91',name='Nadya Mason',k='人员 - Stanford - Aharon Kapitulnik - 614fbb10';
 const phd='Stanford 原组档把 Mason 列在 2001 年 PhD Students。Harvard MRSEC 当期档及 Illinois 教师履历独立确认 Stanford 博士阶段与 Kapitulnik 工作，正式论文导师字段仍待学位原卷。';
 const pd='Harvard MRSEC 原档将 2001 年 MRSEC 博士后和 2002 年 7 月入选 Society of Fellows 分列。本人访谈称后续 Junior Fellow 为博士后阶段；Illinois 原履历称其与 Charles Marcus、Michael Tinkham 合作。两位保留该阶段具名研究合作者，正式指导待核。';
 const pr=src(['Stanford 组档','kap'],['Harvard MRSEC 当期档','mr'],['Illinois 历史教师页','mp']);
 const pos=src(['Harvard MRSEC 当期档','mr'],['Harvard Society of Fellows','soc'],['Illinois 历史教师页','mp']);
 updateEdge(id,name,k,'Aharon Kapitulnik','博士课题组','博士课题组成员','博士课题组','博士课题组成员',phd,pr);
 end(id,phd+' '+pd,pos);
 pl(id,'- 院系／机构：','芝大现任 Robert J. Zimmer Professor of Molecular Engineering and Physics、Vice President for Research。 '+src(['Chicago PME','mason']));
 cell(id,3,'Harvard 2001 MRSEC 博后，2002 起 Junior Fellow；Charles Marcus、Michael Tinkham（阶段合作者）');
 schoolWith(id,pos+' · '+src(['Chicago PME 现任','mason']));
 const e=audit(id,[a('identity','Harvard 学位、Stanford 2001 博士及 Chicago 现任与机构历史档一致。',['mason','mr','kap','mp'],'confirmed'),a('affiliation','Chicago 分子工程与物理学 Robert J. Zimmer Professor，Vice President for Research。',['mason'],'confirmed'),a('research','低维关联电子系统、量子输运与纳米超导。',['mason','mp'],'confirmed'),a('phd',phd,['kap','mr','mp'],'group_or_candidate'),a('postdoc',pd,['mr','soc','mp'],'group_or_candidate')],'找 Stanford 学位原卷 ProQuest 304727938，以及 Harvard 2001 MRSEC 任用指导栏。');
 relation(id,e,'phd',k,'group_leader',phd,ids('kap','mr','mp'),'kapitulnik');
 p(id,'mr','Harvard MRSEC records Mason as a postdoctoral fellow in 2001, then elected to the Society of Junior Fellows in July 2002.','分列两段任用。');
 p(id,'kap','Stanford group lists Mason among its 2001 PhD students.','核博士组属。');
 p(id,'mason','The Chicago PME directory identifies Mason as Vice President for Research and Robert J. Zimmer Professor of Molecular Engineering and Physics.','核现任。');
 p(id,'soc','The Society of Fellows historical directory includes Nadya Mason.','核 Junior Fellowship。');
 fail(id,'oral','AIP oral-history DOI failed to resolve in the web tool. Public AIP editorial excerpt does not cover named advisors.');
 fail(id,'pq','ProQuest thesis lookup did not provide usable dissertation text.');
}
{
 const id='6df7aed5',name='F. Joseph Heremans',aw='人员 - University of Chicago - David Awschalom - d5d8b990';
 const ph='本人 Chicago Quantum Exchange 第一人称简介将 2013 年 UCSB 电气工程博士阶段列在 David Awschalom 组，Oak Ridge 讲座原档独立核实。博士课题组关系可信度高，待学位论文导师栏。';
 const pd='本人 Chicago Quantum Exchange 第一人称简介明确列 2013–2015 Chicago Awschalom 组博士后，Oak Ridge 原档核 Chicago 博后与 2016 年 Argonne 任用顺序。博士后组属可信度高，正式指导职衔待核。';
 const l=src(['本人 CQE 履历','cq'],['ORNL 讲座原档','ornl']);
 updateEdge(id,name,aw,'David Awschalom','博士课题组','博士课题组成员','博士课题组','博士课题组成员',ph,l);
 updateEdge(id,name,aw,'David Awschalom','博士后课题组','博士后课题组成员','博士后课题组','博士后课题组成员',pd,l);
 pl(id,boundary,'ORNL 原档确认现任 Argonne 材料科学部 staff scientist、Chicago PME CASE 附属科学家。 '+l);
 schoolWith(id,l);
 const e=audit(id,[a('identity','UCSB 2013 电气工程博士、Chicago 2013–2015 博后、Argonne 2016 任用及研究内容匹配。',['cq','ornl','pc'],'confirmed'),a('affiliation','Argonne 材料科学部 staff scientist、Chicago 分子工程 CASE 附属科学家。',['ornl','pc'],'confirmed'),a('research','宽禁带固态材料中的自旋缺陷、量子材料与量子传感。',['ornl','pc'],'confirmed'),a('phd',ph,['cq','ornl'],'group_or_candidate'),a('postdoc',pd,['cq','ornl'],'group_or_candidate')],'继续找 UCSB 电气工程 2013 学位馆藏与 Chicago 当期博后任用的正式导师，核独立招生资格。');
 relation(id,e,'phd',aw,'group_leader',ph,ids('cq','ornl'),'awschalom_phd');
 relation(id,e,'postdoc',aw,'group_leader',pd,ids('cq','ornl'),'awschalom_postdoc');
 p(id,'ornl','Oak Ridge speaker bio confirms UCSB Electrical Engineering in the Awschalom group, Chicago postdoc, and current Argonne and Chicago CASE affiliation.','独立核身份、任用和方向。');
 p(id,'cq','First-person Chicago Quantum Exchange profile identifies Awschalom group in the UCSB PhD and 2013–2015 Chicago postdoc periods.','两阶段组属。');
 p(id,'pc','Chicago faculty program biography identifies Argonne staff role and solid-state spin research.','补研究范围。');
 fail(id,'arg','Argonne faculty endpoint returned 403; the ORNL and Chicago originals were readable.');
}
{
 const id='8a73fe40',name='Nathan Keim',na='人员 - University of Chicago - Sidney R. Nagel - 334d75ce',ar='人员 - UPenn - Paulo E. Arratia - f533311d';
 const ph='Nagel 组校友页列 Nathan Keim、Penn State。Chicago 当期原报道具名 Chicago 研究生 Keim 在该组开展气泡破裂研究，APS 本人文章履历确认这是 2010 年 Chicago 物理博士的研究内容。博士阶段组属可信度高，正式论文导师待核。';
 const pd='Arratia 的 Penn Complex Fluids Lab 原校友档明确把 Nathan C. Keim 列为 postdoc。同期 Penn 报道及 APS 本人文章履历核 Penn 机械工程与应用力学博士后和研究方向。组属可信度高，正式指导职衔待核。';
 const fl=src(['Nagel 组校友页','nag'],['Chicago 原报道','kn'],['APS 本人文章履历','kp']);
 const plinks=src(['Penn Complex Fluids Lab 校友','arr'],['Penn 同期报道','pn'],['APS 本人文章履历','kp']);
 updateEdge(id,name,na,'Sidney R. Nagel','博士候选课题组负责人','博士候选课题组成员','博士阶段课题组负责人','博士阶段课题组成员',ph,fl);
 updateEdge(id,name,ar,'Paulo E. Arratia','博士后候选研究师长','博士后候选研究者','博士后课题组负责人','博士后课题组成员',pd,plinks);
 end(id,ph+' '+pd+' Wendy Zhang 保留博士阶段合作线索，Chicago 当期原报道描述其与 Keim 日常讨论及实验研究。',fl+' · '+plinks);
 cell(id,2,'Sidney R. Nagel（Chicago 博士课题组负责人）；Wendy Zhang（同期研究合作者线索）');
 cell(id,3,'Paulo E. Arratia（Penn 机械工程博士后课题组负责人）');
 schoolWith(id,fl+' · '+plinks);
 const e=audit(id,[a('identity','Chicago 2010 物理博士、Penn 机械工程博后、Penn State 物理系现任与同名缩写及研究吻合。',['kp','pn','arr','psu'],'confirmed'),a('affiliation','Penn State 物理系副教授。',['psu'],'confirmed'),a('research','实验凝聚态、软物质、无序体系机械记忆。',['psu','kp'],'confirmed'),a('phd',ph+' Wendy Zhang 的同期合作证据保留。',['nag','kn','kp'],'group_or_candidate'),a('postdoc',pd,['arr','pn','kp'],'group_or_candidate')],'找 Chicago 2010 学位签署页及 Penn MEAM 具名指导栏。');
 relation(id,e,'phd',na,'group_leader',ph,ids('nag','kn','kp'),'nagel');
 relation(id,e,'postdoc',ar,'group_leader',pd,ids('arr','pn','kp'),'arratia');
 p(id,'arr','The Penn Complex Fluids Lab lists Nathan C. Keim in Alumni as a postdoc.','确证博后组属。');
 p(id,'kn','Chicago contemporary report identifies Keim as a Chicago graduate student on the Nagel group’s bubble breakup work.','与组校友和 APS 履历匹配。');
 p(id,'kp','Keim’s APS author profile lists his 2010 Chicago physics doctorate and a Penn mechanical-engineering postdoc.','核博士与博后阶段。');
 p(id,'psu','Penn State identifies Nathan Keim as an Associate Professor of Physics, working in experimental condensed matter.','核现任。');
}
{
 const id='6761ec62',name='Kit Hansell Bowen Jr.',h='师承人物 - Dudley R. Herschbach';
 const ph='Herschbach 的 Harvard Graduate Students 原档和 2012 年名录都列 Kit Bowen，1977。JHU 院系页核当前任职及团簇与光电子谱研究，博士课题组负责人身份可信度高，正式导师称谓保留候选。';
 const l=src(['Harvard 组原档','hgroup'],['出版名录第 2 页','hpdf'],['JHU 院系','kit']);
 updateEdge(id,name,h,'Dudley R. Herschbach','博士阶段课题组负责人','博士阶段课题组成员','博士阶段课题组负责人','博士阶段课题组成员',ph,l);
 schoolWith(id,l);
 const e=audit(id,[a('identity','Herschbach 名录的 Kit Bowen、1977、Johns Hopkins 与 JHU 教师档匹配。',['hgroup','hpdf','kit'],'confirmed'),a('affiliation','Johns Hopkins 化学系。',['kit'],'confirmed'),a('research','团簇和纳米粒子、负离子光电子谱、有限体系多体物理。',['kit'],'confirmed'),a('phd',ph,['hgroup','hpdf','kit'],'group_or_candidate')],'找 Harvard 1977 博士学位原卷和其后可能的博士后任用。');
 relation(id,e,'phd',h,'group_leader',ph,ids('hgroup','hpdf','kit'),'herschbach');
 p(id,'hpdf','The published Herschbach lab roster names Kit Bowen in Graduate Students, vintage 1977.','独立补博士组属。');
 p(id,'kit','JHU Chemistry describes his faculty affiliation, clusters and photoelectron spectroscopy.','核现任和方向。');
}
{
 const id='9ae82e90',name='Sabre Kais',h='师承人物 - Dudley R. Herschbach',cm='师承人物 - M. Cohen（身份待核）';
 const co='2026 年本人 CV 的博士栏将 M. Cohen 与 Raphael D. Levine 并列为导师，出版目录另列两人同期合著的 1986 论文。Hebrew University 原出版记录将同一篇论文的 M. Cohen 链至该校化学所 Maurice Cohen 的教师档，核对全名和身份。导师关系与身份可信度高。';
 const pd='本人 CV 列 Harvard 1989 博士后任用及 D. R. Herschbach，2012 年博士后出版名录为 Kais 标 1994。组网页 Vintage 写 1988，原表未释义，按原档并列记录。保持博士后阶段研究师长，正式导师职衔待核。';
 const cl=src(['Kais 本人 2026 CV','cv'],['Hebrew University 原出版记录','cp'],['Maurice Cohen 本校档','coh']);
 const hl=src(['Kais 本人 2026 CV','cv'],['Harvard 出版名录','hpdf'],['Harvard 组原档','hgroup']);
 updateEdge(id,name,cm,'Maurice Cohen','博士导师','博士生','博士导师','博士生',co,cl);
 rewrite(mf(cm),x=>x==='# M. Cohen（身份待核）',()=> '# Maurice Cohen');
 insertAfter(mf(cm),'# Maurice Cohen','\n- Hebrew University of Jerusalem 化学所 Maurice Cohen。1986 年论文档将 M. Cohen 作者链接至本人教师档。 '+src(['作者档','coh'],['出版档','cp']));
 updateEdge(id,name,h,'Dudley R. Herschbach','博士后阶段研究师长','博士后阶段研究者','博士后阶段研究师长','博士后阶段研究者',pd,hl);
 end(id,co+' '+pd,cl+' · '+hl);
 cell(id,2,'Raphael D. Levine、Maurice Cohen（Hebrew University 博士共同导师）');
 schoolWith(id,cl+' · '+hl);
 const e=audit(id,[a('phd',co,['cv','cp','coh'],'confirmed_advisor'),a('postdoc',pd,['cv','hpdf','hgroup'],'group_or_candidate')],'查 Harvard 具名博后指导任用档；原学位资料保留。');
 relation(id,e,'phd',cm,'advisor',co,ids('cv','cp','coh'),'cohen');
 relation(id,e,'postdoc',h,'stage_mentor',pd,ids('cv','hpdf','hgroup'),'herschbach');
 p(id,'cv','Kais’s CV lists R. D. Levine and M. Cohen for PhD supervision and names D. R. Herschbach with the 1989 Harvard postdoctoral appointment.','核导师称谓和博士后阶段。');
 p(id,'cp','Hebrew University’s publication record for the paper listed in Kais’s CV links M. Cohen to its full-name professor record.','核导师身份。');
 p(id,'coh','Hebrew University’s linked chemistry faculty publication profile spells out Maurice Cohen.','核全名，原节点文件名保留。');
 p(id,'hpdf','The 2012 published roster lists Sabre Kais under Postdoctoral Fellows, vintage 1994.','独立核 Harvard 组属。');
}
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0706_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0706_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0706_Chicago与导师名录原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
