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
 orig.audit_id='pi_archive_20261110_2135_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2135_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const [g,a0,k,p,i,m,t]=['1ff1665d','dff565f5','bb5b0777','ba89032c','3fd3cccc','3fc34a60','3f5e6fb9'];
const u={
 gr:'https://citeseerx.ist.psu.edu/document?doi=81aa7cad6f43d353c022e448aa89e12845ff416c&repid=rep1&type=pdf',
 gc:'https://climate.uchicago.edu/people/supratik-guha/',
 gp:'https://tzin.bgu.ac.il/~danrich/JAP75-8080-94.pdf',
 gv:'https://viterbi.usc.edu/directory/cv/madhukar_anupam_cv.pdf',
 an:'https://cde.nus.edu.sg/mse/staff/ahmet-avsar/',
 ap:'https://www.physics.nus.edu.sg/staff/faculty-on-courtesy/',
 ag:'https://nusgs.nus.edu.sg/thesis-advisors/aavsar',
 ai:'https://qd-oxford.com/blog/2024_12_04_blog_item.html',
 ae:'https://actu.epfl.ch/news/a-new-2d-magnet-draws-future-devices-closer/',
 ar:'https://publications.rwth-aachen.de/record/52855/files/3744.pdf',
 ao:'https://graphene.nus.edu.sg/event-details?title=423',
 aa:'https://graphene.nus.edu.sg/barbaros/?p=238',
 at:'https://www.nature.com/articles/s41699-025-00546-4',
 kk:'https://science.psu.edu/physics/people/rpk5594',
 ks:'https://sachdev.physics.harvard.edu/sites/g/files/omnuum12146/files/2025-10/cv_2.pdf',
 kr:'https://online.kitp.ucsb.edu/online/compqcm10/mishmash/pdf/Mishmash_CompQCM_KITP.pdf',
 kf:'https://www.icfo.eu/event/3495/matthew-fisher/',
 ka:'https://arxiv.org/abs/1008.4105',
 pu:'https://www.physics.uci.edu/node/9170',
 pm:'https://regents.umich.edu/files/meetings/12-11/2011-12-IV-1-8.pdf',
 pb:'https://www.cambridge.org/core/services/aop-cambridge-core/content/view/6413C3C4C45200889F4DF1C4B54FEE6A/S088376941400308Xa.pdf/meet-our-authors.pdf',
 ic:'https://ece.princeton.edu/sites/g/files/toruqf1836/files/documents/McCulloch%20-%20CV.pdf',
 ip:'https://ece.princeton.edu/people/iain-mcculloch',
 ia:'https://www.princeton.edu/news/2023/09/27/chemist-iain-mcculloch-appointed-new-director-andlinger-center-energy-and',
 ir:'https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=854123',
 ii:'https://patents.google.com/patent/US5212250A/en',
 mt:'https://sethna.lassp.cornell.edu/pubPDF/MachtaPhD.pdf',
 my:'https://medicine.yale.edu/profile/benjamin-machta/',
 mp:'https://lsi.princeton.edu/people/benjamin-b-machta',
 mv:'https://lsa.umich.edu/biophysics/people/core-faculty/sarah-veatch.html',
 ta:'https://publishing.aip.org/publications/latest-content/taking-thin-films-to-the-extreme/',
 tu:'https://cne.ucsd.edu/seminars/seminar-mikhail-kats',
 th:'https://capasso.seas.harvard.edu/alumni',
 tw:'https://energy.wisc.edu/about/energy-experts/mikhail-kats'
};
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




const gName='Supratik Guha', gMentor=records.get('658cf8a7').filename;
const gd='USC 材料系项目报告由 Madhukar 具名提交，前言说明列受资助研究生，人员表将 Guha 列为博士阶段研究生，并收录其与 Madhukar 的同期成果。可核博士阶段项目组，个人论文导师待签署页。项目表记 Dec 1990，Chicago 正式履历记 1991 博士，原样保留两种日期。';
const ge='1994 同期原刊致谢称 Guha 任职 3M Corporate Research Labs，确认该单位归属，职称与是否属独立博士后仍待核；此前 IBM Esaki–Chang 博后组属保留。';
const gLinks=src(['USC 项目原报告','gr'],['Chicago 履历','gc'],['USC Madhukar 本人 CV','gv']);
updateEdge(g,gName,gMentor,'Anupam Madhukar','博士导师候选','博士候选受指导者','博士课题组负责人','博士阶段课题组成员',gd,gLinks);
pl(g,boundary,ge+' '+src(['1994 原论文','gp']));
cell(g,2,'Anupam Madhukar（博士阶段项目课题组负责人；正式导师待核，1990/1991 两种档案日期）');
schoolWith(g,gLinks+' · '+src(['1994 原论文','gp']));
const gAudit=audit(g,[a('phd',gd,['gr','gc','gv'],'group_or_candidate'),a('postdoc',ge,['gp'],'group_or_candidate'),a('affiliation','Chicago 分子工程与 Argonne 微电子、量子信息项目。',['gc'],'confirmed'),a('research','纳米材料、外延与半导体材料。',['gc','gr'],'confirmed')],'继续追 USC 学位签署页以核个人导师与日期，查 IBM 具名任用与 3M 原始职称。');
relation(g,gAudit,'phd',gMentor,'group_leader',gd,['gr','gc','gv'].map(x=>u[x]),'madhukar');

const aName='Ahmet Avsar', aMentor=records.get('0e0562af').filename;
const ad='Avsar 在本人访谈中将 Özyilmaz 与 Kis 分别对应博士和博士后研究，NUS 院系列物理博士，EPFL 同期报道称 Kis 组博士后，既有 RWTH 同期学位论文致谢具名确认 Özyilmaz 组属。博士阶段课题组证据充分，2018 NUS 活动原页仍 502，正式论文导师待直接材料。';
const al=src(['本人访谈','ai'],['NUS 材料院系','an'],['EPFL 原报道','ae'],['RWTH 同期论文','ar']);
updateEdge(a0,aName,aMentor,'Barbaros Özyilmaz','博士导师候选','博士生候选','博士课题组负责人','博士阶段课题组成员',ad,al);
const au='NUS 物理系原名册确认 Courtesy Assistant Professor，研究生院列为联合任用；2025 本人论文另列 Centre for Advanced 2D Materials 署名关联。';
unit(a0,aName,'Centre for Advanced 2D Materials','2025 原论文署名关联',src(['本人论文','at']));
rewrite(pf(a0),x=>x.startsWith(boundary),x=>x.replace('MSE 是官方现职，NUS 物理系为博士学位单位，当前物理兼任待核。','MSE 为主聘，NUS 物理系原名册确认 courtesy 兼任。')+' '+au+' '+src(['NUS 物理系名册','ap'],['NUS 研究生院','ag'],['本人论文','at']));
cell(a0,1,'材料科学与工程系、物理系（courtesy 兼任）、Centre for Advanced 2D Materials（署名关联）；二维材料、自旋电子学、量子器件');
cell(a0,2,'Barbaros Özyilmaz（博士课题组负责人；正式论文导师待核）');
schoolWith(a0,al+' · '+src(['NUS 物理系名册','ap'],['本人论文','at']));
const aAudit=audit(a0,[a('phd',ad,['ai','an','ae','ar'],'group_or_candidate'),a('postdoc','EPFL 2016–2020 Fellow，校方原报道核 Kis 组。NUS 同组 Research Fellow 时段目前只有校友页索引，原页 502，继续查。',['an','ae'],'group_or_candidate'),a('affiliation',au,['an','ap','ag','at'],'confirmed'),a('research','NUS 学位项目页和论文核二维量子材料及自旋电子学。',['ag','at'],'confirmed')],'继续追 NUS 博士论文签署和 2014–2016 NUS Research Fellow 的任用原档，保留 EPFL 既有分类。');
relation(a0,aAudit,'phd',aMentor,'group_leader',ad,['ai','an','ae','ar'].map(x=>u[x]),'ozyilmaz');

const kName='Ribhu K. Kaul', kMentor=records.get('e180d959').filename;
const ke='Penn State 原履历列 Station Q 2008–2010 博后，ICFO 活动履历确认 Matthew P. A. Fisher 2007 在 Station Q 任研究员、2009–2010 到 Caltech；2010 KITP 报告及原论文显示二人在合作组。保留低可信博后候选，正式个人指导待证。';
const kl=src(['Penn State 履历','kk'],['ICFO Fisher 履历','kf'],['KITP 合作者报告','kr'],['本人参与原论文','ka']);
edge(k,kName,kMentor,'Matthew P. A. Fisher','博士后导师候选','博士后候选研究者',ke,kl);
pl(k,boundary,'Sachdev 本人 CV 在 Postdocs 栏具名 Kaul，Harvard 阶段沿用既有课题组关系。'+src(['Sachdev CV','ks']));
cell(k,3,'Subir Sachdev（Harvard 2006–2008 博后课题组）；Matthew P. A. Fisher（Station Q 阶段低可信导师候选）');
schoolWith(k,kl+' · '+src(['Sachdev CV','ks']));
const kAudit=audit(k,[a('postdoc',ke+' Sachdev 本人 CV 确认 Harvard 阶段组属。',['kk','kf','kr','ka','ks'],'group_or_candidate'),a('research','Penn State 物理系原档列凝聚态理论、多体量子、拓扑物态及量子材料。',['kk'],'confirmed')],'查 Duke 2006 学位原卷及 Station Q 2008–2010 指导任用；Harvard 组属与个人正式指导分记。');
relation(k,kAudit,'postdoc',kMentor,'candidate',ke,['kk','kf','kr','ka'].map(x=>u[x]),'fisher');

const plinks=src(['UCI 物理系','pu'],['Michigan 人事原档','pm'],['本人署名 MRS 履历','pb']);
unit(p,'Xiaoqing Pan','Irvine Materials Research Institute','创始主任',src(['UCI 物理系原档','pu']));
unit(p,'Xiaoqing Pan','Center for Complex and Active Materials','创始主任',src(['UCI 物理系原档','pu']));
pl(p,boundary,'MRS 本人署名履历再次确认 Saarland 博士和南京大学本科、硕士，1991 年以 Michigan 人事原件为准。'+plinks);
cell(p,1,'Physics and Astronomy、Materials Science and Engineering；IMRI 与 CCAM 创始主任；电子显微学、氧化物异质结构、凝聚态物理');
schoolWith(p,plinks);
audit(p,[a('phd','Michigan 人事原档和 MRS 本人署名作者履历相互确认 Saarland 固态物理博士。论文及导师待核。',['pm','pb'],'unresolved'),a('affiliation','UCI 系档明确材料／物理双聘及 IMRI、CCAM 创始主任。',['pu'],'confirmed'),a('research','材料界面、氧化物异质结构、铁电／多铁及四维扫描透射电子显微。',['pu','pm'],'confirmed')],'查 Saarland 1991 纸本学位档及 Stuttgart 1991–1996 博后原聘任，既有 Rühle 低可信候选保留。');

const ie='Princeton 托管本人 2022 CV 分列 1989 Strathclyde 聚合物化学博士、1989–1990 Hoechst Celanese 电子材料 Post Doctoral Fellow、1990–1998 同公司独立组长。1991 原专利列 Thomas M. Leslie 为共同发明人，日期在本人转组长后，作为合作线索留档。两阶段个人指导待查。';
const il=src(['本人 CV','ic'],['Princeton 院系','ip'],['原论文作者履历','ir'],['1991 原专利','ii']);
pl(i,boundary,ie+' '+il);
unit(i,'Iain McCulloch','Andlinger Center for Energy and the Environment','主任，自 2024-01-16 任命生效',src(['Princeton 任用原档','ia'],['Princeton ECE','ip']));
cell(i,1,'电气与计算机工程系、Andlinger Center 主任；有机半导体、聚合物电子材料、光电材料');
cell(i,2,'1989 Strathclyde 聚合物化学博士，导师待核');
cell(i,3,'1989–1990 Hoechst Celanese 电子材料博士后，导师待核；1990–1998 为独立组长');
schoolWith(i,il+' · '+src(['Princeton 任用原档','ia']));
audit(i,[a('phd','Princeton ECE 原页、本人 CV 和 NIST 托管本人署名原刊交叉核 1989 Strathclyde 聚合物化学博士。',['ip','ic','ir'],'unresolved'),a('postdoc',ie,['ic','ir','ii'],'unresolved'),a('affiliation','Princeton ECE 教授、Andlinger Center 主任。',['ip','ia'],'confirmed'),a('research','有机半导体及聚合物电子材料、光电材料。',['ip','ir'],'confirmed')],'继续查 Strathclyde 1989 学位原档、Hoechst 1989–1990 博后接收及具名指导材料。');

const mName='Benjamin Machta', mFormal=records.get('d77716a7').filename, mOther='师承人物 - Sarah L. Veatch';
const md='本人 2013 Cornell 博士论文封面列完整题名 Criticality in Cellular Membranes and the Information Geometry of Simple Models，致谢明确称 Jim Sethna 为 advisor，并将 formal advising 与后续合作区分。';
const me='本人博士论文致谢明确称 Sarah Veatch 为 mentor，描述在 Ann Arbor 实验室学习及参与多章实验工作。Michigan 院系档核同一人和膜相分离方向。按博士阶段研究师长记录，正式论文导师另为 Sethna。';
const ml=src(['本人博士论文','mt'],['Michigan 院系原档','mv']);
mentor(mOther,'Sarah L. Veatch','Michigan 物理与生物物理教授，研究脂质膜相分离和临界现象。',src(['Michigan 院系原档','mv']));
edge(m,mName,mOther,'Sarah L. Veatch','博士阶段研究师长','博士阶段受指导者',me,ml);
for(const [file,test] of [[pf(m),x=>x.startsWith('- 博士导师：')&&x.includes(mFormal)],[mf(mFormal),x=>x.startsWith('- 博士生：')&&x.includes(records.get(m).filename)],[index,x=>x.startsWith('- '+who(m,mName)+' → 博士导师：')&&x.includes(mFormal)]]) line(file,test,' '+md+' '+src(['本人博士论文','mt']));
rewrite(pf(m),x=>x.startsWith(boundary),()=>boundary+'本人论文已直接读到。Yale 学院档确认 Princeton Lewis-Sigler Theory Fellow 博后；Princeton 名录显示 2012–2017，论文 2013 年写毕业后将赴 Princeton，保留两种档案口径，个人指导待核。 '+src(['Yale 履历','my'],['Princeton Fellowship 原档','mp'],['本人博士论文','mt']));
cell(m,2,'James P. Sethna（博士导师）；Sarah L. Veatch（博士阶段研究师长）');
cell(m,3,'Princeton Lewis-Sigler Theory Fellow；档案年份口径待核，个人导师待核');
schoolWith(m,ml+' · '+src(['Princeton Fellowship 原档','mp']));
const mAudit=audit(m,[a('phd',md+' '+me,['mt','mv'],'confirmed_advisor'),a('postdoc','Princeton fellow 名录 2012–2017，与 2013 论文写毕业后才赴 Princeton 有时间口径差异。Yale 证有该博后，未指名导师。',['mt','my','mp'],'unresolved'),a('affiliation','Yale 物理及 Systems Biology Institute。',['my'],'confirmed'),a('research','统计物理、生物膜临界现象。',['my','mt'],'confirmed')],'追 Princeton fellowship 任用及个人指导文件，区分合作关系和导师。');
relation(m,mAudit,'phd',mFormal,'advisor',md,[u.mt],'sethna');
relation(m,mAudit,'phd',mOther,'stage_mentor',me,[u.mt,u.mv],'veatch');

const tName='Mikhail Kats', tMentor=records.get('e762b00c').filename;
const te='AIP 同期原报道明确 Kats 为在 Federico Capasso 实验室工作的 Harvard 博士后，UCSD 2014 年 1 月讲座已列为 Harvard 博后。Wisconsin 与 Capasso 组档列 2014 博士，UCSD 讲座记 2013，保留两种年份。组属已核，个人正式博后导师职衔待核。';
const tl=src(['AIP 2014 原报道','ta'],['UCSD 同期讲座','tu'],['Capasso 组档','th'],['Wisconsin 任职档','tw']);
edge(t,tName,tMentor,'Federico Capasso','博士后课题组负责人','博士后课题组成员',te,tl);
rewrite(pf(t),x=>x.startsWith(boundary),()=>boundary+te+' '+tl);
cell(t,3,'Federico Capasso（2014 Harvard 博士后课题组负责人；正式导师待核）');
schoolWith(t,tl);
const tAudit=audit(t,[a('phd','保留既有 Capasso 博士导师，UW 和 Harvard 组档列 2014，UCSD 2014 初介绍列 2013。',['tw','th','tu'],'confirmed_advisor'),a('postdoc',te,['ta','tu'],'group_or_candidate'),a('affiliation','Wisconsin Energy Institute 核 ECE 主聘、物理和材料关联。',['tw'],'confirmed'),a('research','热辐射、纳米光学和超表面。',['tw','ta'],'confirmed')],'核 Harvard 博士学位授予月份及博士后具名任用，以分别确认两阶段称谓。');
relation(t,tAudit,'postdoc',tMentor,'group_leader',te,['ta','tu','tw','th'].map(x=>u[x]),'capasso');

const read=(id,key,excerpt)=>({record_id:id,url:u[key],raw:excerpt,excerpt});
const error=(id,key,error)=>({record_id:id,url:u[key],error});
const pages=[
 read(g,'gr',gd),read(g,'gc','Chicago 履历核 1991 USC 材料博士与当前分子工程、Argonne。'),read(g,'gp',ge),
 read(a0,'an','材料系原档核 NUS 博士、EPFL 2016–2020。'),read(a0,'ap','NUS 物理系列 Ahmet Avsar 为 Courtesy Assistant Professor。'),read(a0,'ag','研究生院原档明确材料主聘、物理联合任用。'),read(a0,'ai','本人访谈联系两阶段研究与 Özyilmaz、Kis。'),read(a0,'ae','EPFL 报道核 Kis 实验室博后。'),read(a0,'at','2025 本人原论文署名列 NUS 材料、物理及 CA2DM。'),error(a0,'ao','Failed to fetch NUS event: (502) Bad Gateway'),error(a0,'aa','Failed to fetch NUS group alumni: (502) Bad Gateway'),
 read(k,'kk','Penn State 履历核 2006–2008 Harvard、2008–2010 Station Q 博后。'),read(k,'ks','Sachdev 本人 CV 的 Postdocs 栏列 Kaul。'),read(k,'kr','KITP 同期报告将 Kaul 与 Fisher 列合作者。'),read(k,'kf','ICFO 原档核 Fisher 2007 Station Q 与 2009–2010 Caltech。'),read(k,'ka','原稿列 Kaul、Fisher 为作者，提交 2010。'),
 read(p,'pu','UCI 系档列材料物理双聘和 IMRI、CCAM 创始主任。'),read(p,'pm','Michigan Regents 人事原件列 Saarland 1991 博士和 Stuttgart 1991–1996 博后。'),read(p,'pb','MRS 本人署名作者履历核 Saarland 博士、Michigan 材料科学。'),
 read(i,'ic',ie),read(i,'ip','Princeton ECE 现档核 1989 博士、Andlinger 主任及有机半导体。'),read(i,'ia','Princeton 2023 任命原档明确中心及 ECE，2024-01-16 生效。'),read(i,'ir','NIST 托管署名原刊列 Strathclyde 和 Hoechst Celanese。'),read(i,'ii','1991 原专利同列 Leslie、McCulloch；在 1990 转组长之后。'),
 read(m,'mt',md+' '+me),read(m,'my','Yale 现档核 2013 Cornell 博士、Princeton 博后及 Yale 物理。'),read(m,'mp','Princeton fellowship 人物原页列 2012–2017，保留与论文日期口径差异。'),read(m,'mv','Michigan 原页确认 Sarah Veatch 为物理和生物物理教授。'),
 read(t,'ta','AIP 2014 报道明指 Kats 为 Capasso 实验室博后。'),read(t,'tu','UCSD 2014 年 1 月讲座列 Harvard 博后及 2013 博士。'),read(t,'th','Capasso 组校友原档列 2014 博士。'),read(t,'tw','Wisconsin 能源所列 2014 Harvard 博士、ECE 任职及材料物理双关联。')
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2135_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2135_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2135_论文与项目原档网页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
