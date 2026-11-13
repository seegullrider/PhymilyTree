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
 orig.audit_id='pi_archive_20261110_2213_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2213_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"mi":"https://miller.berkeley.edu/images/newsletters/2003_spring.pdf","mh":"https://miller.berkeley.edu/fellowship","mm":"https://miller.berkeley.edu/images/events/60/MillerProgram60.pdf","mn":"https://cse.umn.edu/chem/events/professor-munira-khalil-0","me":"https://physics.berkeley.edu/people/faculty/charles-shank","se":"https://lapt.ece.northwestern.edu/collaborators/CV-Philip_Hemmer.pdf","sc":"https://lapt.ece.northwestern.edu/selim/shahriar_cv.pdf","sn":"https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/shahriar-selim.html","sp":"https://physics.northwestern.edu/people/faculty/affiliated-faculty/selim-shahriar.html","ma":"https://kernie.materials.cmu.edu/~degraef/www/bio.html","mc":"https://www.mse.engineering.cmu.edu/directory/bios/degraef-marc.html","mw":"https://academic.oup.com/mt/article/33/3/10/8191177","mv":"https://materials.ucsb.edu/people/memoriam","md":"https://news.ucsb.edu/print/pdf/node/11324","vo":"https://www.annualreviews.org/content/journals/10.1146/annurev.physchem.55.081203.151413?crawler=true&mimetype=application%2Fpdf","vu":"https://dornsife.usc.edu/profile/andrey-vilesov/","vp":"https://pure.mpg.de/rest/items/item_3276696_8/component/file_3287417/content","gp":"https://liquids.seas.harvard.edu/sxnspeterindex.html","gb":"https://www.bnl.gov/staff/ogang","gn":"https://www.bnl.gov/newsroom/news.php?a=22203","gc":"https://cheme.columbia.edu/files/seas/content/oleg_gang_shortcv_march2020.pdf","gw":"https://www.cheme.columbia.edu/faculty-staff/directory/oleg-gang","gv":"https://liquids.seas.harvard.edu/masa/thesis_mfukuto.pdf","pn":"https://appliedphysics.northwestern.edu/people/faculty/peter-w-voorhees.html","pc":"https://www.nims.go.jp/nimsweek/2016/pdf/J22_Voorhess_vc.pdf","pr":"https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nbsir84-2995.pdf","fr":"https://engineering.washu.edu/faculty/Francisco-Lagunas-Vargas.html","fh":"https://tcsuh.com/post/news_events/jointseminar/784/","fm":"https://www.mrs.org/meetings-events/annual-meetings/archive/meeting/presentations/view/2025-mrs-spring-meeting/2025-mrs-spring-meeting-4278059","fu":"https://www.uh.edu/news-events/stories/2024/march/03292024-argonne-joint-appointments.php","fx":"https://happenings.washu.edu/event/mems-seminar-dr-francisco-lagunas-vargas-washington-university-in-st-louis","fa":"https://pubs.acs.org/doi/10.1021/acsaelm.5c02352","wa":"https://onlinelibrary.wiley.com/doi/abs/10.1002/polc.5070630120","sd":"https://www.sciencedirect.com/science/article/pii/0001616077902322","fd":"https://www.energy.gov/cmei/ammto/articles/small-but-powerful-could-nanotechnology-help-address-climate-crisis"};
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




const [k,s,m,v,g,p,f,y]=['46ffc6f0','8f4c75ba','9df7c545','46d46534','09de1be5','47158a52','d750f0c9','a3f24027'];
const kName='Munira Khalil',sName='Selim M. Shahriar',mName='Marc De Graef',vName='Andrey Vilesov',gName='Oleg Gang',pName='Peter W. Voorhees — 荣休',fName='Francisco Lagunas Vargas';
const sh=records.get('d79daa66').filename,he=records.get('2e2ac818').filename,cl=records.get('299173ef').filename,pe=records.get('f4e438b4').filename,al=records.get('9209cf4f').filename;
const ev='师承人物 - Anthony G. Evans',ot='师承人物 - Christoph Ottinger',to='师承人物 - J. Peter Toennies',de='师承人物 - Moshe Deutsch',ho='师承人物 - Zachary D. Hood';
const rs=(...keys)=>keys.map(key=>u[key]);
const add=(id,event,stage,mentor,kind,detail,suffix,...keys)=>relation(id,event,stage,mentor,kind,detail,rs(...keys),suffix);
const bounds=(id,detail,links)=>rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+detail+' '+links);

const kD='Berkeley Miller Institute 获奖原册具名 Charles Shank 为 Khalil 的接收教师。历年名册确认 2003–2006，Miller 项目说明接收教师承担指导职责，标具名项目接收导师（博士后阶段研究师长）。MIT 博士论文档列 2004，原档日期分别保留。关系类型可信度：高。';
const kL=src(['Miller 获奖原册','mi'],['Miller 历年名册','mm'],['Miller 项目职责','mh'],['Minnesota 化学系','mn']);
edge(k,kName,sh,'Charles Shank','博士后阶段研究师长','博士后阶段研究者',kD,kL);
bounds(k,'Andrei Tokmakoff 为博士导师。Miller 2003–2006 接收导师 Charles Shank 已核，LBNL 是否有单独任用及共同指导待档。',kL);
cell(k,3,'UC Berkeley Miller Fellow 2003–2006；Charles Shank（具名项目接收导师，博士后阶段研究师长）；LBNL 单独任用待核');
schoolWith(k,kL);
const ka=audit(k,[a('postdoc',kD,['mi','mm','mh','mn','me'],'group_or_candidate'),a('affiliation','UW 化学教授。',['mn'],'confirmed'),a('research','超快光谱，研究分子与材料的电子、振动与溶剂动力学。',['mn'],'confirmed')],'查 Berkeley/LBNL 博后任用档，核共同导师与单独任用。');
add(k,ka,'postdoc',sh,'stage_mentor',kD,'shank','mi','mm','mh','mn','me');

const sD='Hemmer 本人 CV 的 Air Force Research Laboratory 指导栏明确列 1992 年博士论文 Fundamental Studies and Applications in Three Level Atoms 及 1989 年硕士论文 Raman Atomic Clock Studies。Shahriar 本人 CV 的教育栏逐项吻合。具名博士论文指导可信度高。MIT 签署页所列校内外角色及 Shaoul Ezekiel 所指导学位待原卷。';
const sL=src(['Hemmer 本人 CV','se'],['Shahriar 本人 CV','sc']);
const sf=who(s,sName),st=wiki(he,'Philip Hemmer');
rewrite(pf(s),x=>x.startsWith('- 博士导师候选：')&&x.includes(he),()=>'- 博士导师：'+st+'。'+sD+' '+sL);
rewrite(mf(he),x=>x.startsWith('- 博士导师候选 →')&&x.includes(records.get(s).filename),()=>'- 博士生：'+sf+'。'+sD+' '+sL);
insertAfter(index,'# 师承关系与候选线索索引','\n- '+sf+' → 博士导师：'+st+'。'+sD+' '+sL);
rewrite(path.join(root,'师承候选线索索引.md'),x=>x.startsWith('- '+sf+' → 博士导师候选：')&&x.includes(he),()=>'- '+sf+' → Philip Hemmer 的博士论文指导已核，见 [[师承关系索引]]。 '+sL);
pl(s,'- 论文题名复核（2026-11-09）：','Hemmer 本人 CV 原文已取得并对齐两阶段。Ezekiel 的学位分工待 MIT 原卷。 '+sL);
cell(s,2,'Philip Hemmer（本人 CV 具名 1992 博士论文指导，1989 硕士另列）；Shaoul Ezekiel（本人 CV 列 Thesis Supervisor，学位分工待核）');
schoolWith(s,sL+' · '+src(['工程学院','sn'],['物理系','sp']));
const sa=audit(s,[a('phd',sD,['se','sc'],'confirmed_advisor'),a('affiliation','Northwestern ECE 教授，物理与天文学系 affiliated faculty。',['sn','sp','sc'],'confirmed'),a('research','量子光学、原子干涉和精密传感。',['sn','sc'],'confirmed')],'查 MIT 签署页以核校内外导师分工，并校 1991–1992 MIT RLE 博后与授位日期。');
add(s,sa,'phd',he,'advisor',sD,'hemmer','se','sc');

const mD='De Graef 本人履历明确 UCSB 材料系博后受 A. Evans 与 D. Clarke 指导，列 1989 年 9 月赴 UCSB 及 1993 年 3 月到 CMU。显微学会原档核 Tony Evans 当时任系主任，UCSB 原档核 Anthony G. Evans 全名及 David R. Clarke 自 1990 年加入。关系可信度高，Clarke 的指导起月待查。';
const mL=src(['De Graef 本人履历','ma'],['显微学会原档','mw'],['UCSB Evans 纪念档','mv'],['UCSB Clarke 任用','md']);
mentor(ev,'Anthony G. Evans','UCSB 材料及机械工程教授，1985 年加入并任材料系创系主任，研究结构材料与陶瓷复合材料。',src(['UCSB 纪念档','mv']));
edge(m,mName,ev,'Anthony G. Evans','博士后导师','博士后研究者',mD,mL);
edge(m,mName,cl,'David R. Clarke','博士后导师','博士后研究者',mD,mL);
bounds(m,'Leuven 博士导师 Delaey 与 King 保留。UCSB 1989–1993 博后由本人具名 Evans 与 Clarke 指导，Clarke 于 1990 年加入 UCSB。',mL);
unit(m,mName,'Materials Characterization Facility','CMU 原院系档列 Faculty Director',src(['CMU 材料系','mc']));
cell(m,1,'材料科学与工程系、Materials Characterization Facility；电子显微、磁性材料、材料表征、晶体结构');
cell(m,3,'UCSB 1989–1993：Anthony G. Evans 与 David R. Clarke（本人履历具名博士后指导）');
schoolWith(m,mL+' · '+src(['CMU 材料系','mc']));
const ma=audit(m,[a('postdoc',mD,['ma','mc','mw','mv','md'],'confirmed_advisor'),a('affiliation','CMU 材料系教授及 Materials Characterization Facility Faculty Director。',['mc'],'confirmed'),a('research','电子显微、材料显微结构、Lorentz 磁学成像。',['ma','mc'],'confirmed')],'两阶段均有具名来源。若取得同期人事原档，补两位 UCSB 导师各自指导起止。');
add(m,ma,'postdoc',ev,'advisor',mD,'evans','ma','mw','mv','mc');
add(m,ma,'postdoc',cl,'advisor',mD,'clarke','ma','mc','md');

const vD='J. Peter Toennies 本人回忆明确记 Andrej Vilesov 于 1990–1996 为 Ottinger 的 postdoc。回忆另记 1990 年 11 月持 Alexander von Humboldt 博后奖学金到 Ottinger 组。USC 履历与 Max Planck 存档稿交叉核对。博士后阶段研究师长可信度高。';
const vT='USC 履历明确 Toennies 组归属，Toennies 回忆具名记录 1992 年起参与超流氦液滴研究及 1993 年实验讨论，作为后期研究分工证据。个人正式指导和具体任用待核。';
const vL=src(['Toennies 本人回忆','vo'],['USC 本人履历','vu'],['Max Planck 研究史原稿','vp']);
const vf=who(v,vName),vot=wiki(ot,'Christoph Ottinger'),vto=wiki(to,'J. Peter Toennies');
rewrite(pf(v),x=>x.startsWith('- 博士毕业后课题组负责人：')&&x.includes(ot),(x,nl)=>'- 博士后阶段研究师长：'+vot+'。'+vD+' '+vL+nl+'- 博士毕业后课题组负责人：'+vto+'。'+vT+' '+vL);
rewrite(mf(ot),x=>x.startsWith('- 博士毕业后课题组研究者：')&&x.includes(records.get(v).filename),()=>'- 博士后阶段研究者：'+vf+'。'+vD+' '+vL);
rewrite(mf(to),x=>x.startsWith('- 博士毕业后课题组研究者：')&&x.includes(records.get(v).filename),()=>'- 博士毕业后课题组研究者：'+vf+'。'+vT+' '+vL);
rewrite(index,x=>x.startsWith('- '+vf+' → 博士毕业后课题组负责人：')&&x.includes(ot),(x,nl)=>'- '+vf+' → 博士后阶段研究师长：'+vot+'。'+vD+' '+vL+nl+'- '+vf+' → 博士毕业后课题组负责人：'+vto+'。'+vT+' '+vL);
bounds(v,'1985 St. Petersburg 物理博士导师待学位档。Ottinger 1990–1996 博后已核，Toennies 组属分列。1999 Göttingen habilitation 为另一阶段。',vL);
cell(v,3,'Christoph Ottinger（1990–1996 博后阶段研究师长）；J. Peter Toennies（博士毕业后课题组，具体岗位待核）');
schoolWith(v,vL);
const va=audit(v,[a('phd','1985 St Petersburg 物理博士，1999 Göttingen habilitation 另列。导师待原档。',['vu'],'unresolved'),a('postdoc',vD+' '+vT,['vo','vu','vp'],'group_or_candidate'),a('affiliation','USC 化学、物理与天文学教授。',['vu'],'confirmed'),a('research','超流氦液滴光谱与量子流体。',['vu'],'confirmed')],'查 1985 学位论文和 Göttingen 人事原档，区分两个组的任用阶段。');
add(v,va,'postdoc',ot,'stage_mentor',vD,'ottinger','vo','vu','vp');

const gD='BNL 教育档明列博士论文 Surface Ordering in Chain Molecules，硕士论文另列。本人 CV 列 Bar-Ilan 2000 博士，Pershan 回忆具名称 Gang 在 Deutsch 指导下完成博士。学位原卷的正式导师字段仍待核。';
const gP='Pershan 本人回忆和 BNL 报道列 Harvard 博后 1999–2002。Gang 本人 CV 列 2000–2002 Rothschild Fellow，两种起年并存。2002–2004 BNL Goldhaber Fellowship 单列，指导待核。';
const gL=src(['Pershan 本人回忆','gp'],['BNL 学位题名','gb'],['Columbia 本人 CV','gc'],['BNL 人员报道','gn']);
updateEdge(g,gName,de,'Moshe Deutsch','博士阶段研究师长','博士阶段研究成员','博士阶段研究师长','博士阶段研究成员',gD,gL);
updateEdge(g,gName,pe,'Peter S. Pershan','博士后研究师长','博士后研究合作者','博士后阶段研究师长','博士后阶段研究者',gP,gL);
bounds(g,'博士论文题名与 2000 学位依 BNL 和本人 CV。Harvard 博后起年 1999／2000 并存，BNL 2002–2004 Goldhaber 另列。',gL);
cell(g,2,'Moshe Deutsch（博士阶段研究师长；2000 博士，论文 Surface Ordering in Chain Molecules）');
cell(g,3,'Peter S. Pershan（Harvard 博士后阶段研究师长，起年 1999／2000）；BNL 2002–2004 Goldhaber 具名指导待核');
schoolWith(g,gL);
const ga=audit(g,[a('phd',gD,['gp','gb','gc'],'group_or_candidate'),a('postdoc',gP,['gp','gn','gc','gv'],'group_or_candidate'),a('affiliation','Columbia 化工与应用物理和应用数学双聘，BNL CFN 软与生物纳米材料组。',['gc','gw','gb'],'confirmed'),a('research','可编程自组装、DNA 纳米材料、软物质及 X 射线方法。',['gb','gw'],'confirmed')],'查 Bar-Ilan 学位原卷或正式导师字段，以及 BNL Goldhaber 具名指导。');
add(g,ga,'phd',de,'stage_mentor',gD,'deutsch','gp','gb','gc');
add(g,ga,'postdoc',pe,'stage_mentor',gP,'pershan','gp','gn','gc','gv');

const pD='本人 CV 分列 1982 夏 RPI 博后与 1982 年 10 月至 1984 年 7 月 NBS NRC 博后。NBS 1984 年报列 Voorhees、R. J. Schaefer 与 C. A. Handwerker 共同负责显微结构转变子课题，两人为同期项目合作线索。';
const pL=src(['本人 CV','pc'],['NBS 1984 年报','pr'],['Northwestern 应用物理','pn']);
unit(p,pName,'工程科学与应用数学系','校方项目页列礼节性兼任',src(['Northwestern 应用物理','pn']));
pl(p,boundary,pD+' '+pL);
cell(p,1,'材料科学与工程系（荣休）、工程科学与应用数学系（礼节性兼任）、应用物理；相变动力学、凝固与微结构');
cell(p,3,'RPI 1982 夏博士后；NBS NRC 1982-10 至 1984-07 博士后，指导待核');
schoolWith(p,pL);
audit(p,[a('postdoc',pD,['pc','pr'],'unresolved'),a('affiliation','Northwestern 材料系荣休，工程科学与应用数学礼节性兼任及应用物理项目。',['pn','pc'],'confirmed'),a('research','材料相变热力学与动力学、凝固与微结构。',['pn','pr'],'confirmed')],'RPI 博士 Glicksman 既有候选继续查 1982 学位原卷，两段博后分别查任用档。');

const fD='WashU 核 Argonne 博后及随后教职。2024 DOE 署名及 2025 MRS 项目原档确认与 Zachary D. Hood 同在 Argonne 合作，Houston 同期履历列 Hood 为 Applied Materials Division 下电化学材料组负责人。标低可信博后导师候选，具体组属和指导待核。';
const fL=src(['WashU 教师档','fr'],['DOE 同期署名','fd'],['MRS 项目原档','fm'],['Houston 讲座原档','fh']);
mentor(ho,'Zachary D. Hood','Houston 2024 官方任命档列 Argonne Applied Materials Division 研究组负责人及 Houston ECE 联合任用，研究固态离子导体。',src(['Houston 任命','fu'],['Houston 讲座','fh']));
edge(f,fName,ho,'Zachary D. Hood','博士后导师候选','博士后候选研究者',fD,fL);
unit(f,fName,'Institute of Materials Science and Engineering','WashU 教师原档并列研究所和 MEMS 助理教授',src(['WashU 教师档','fr']));
pl(f,'- 博士后经历：','DOE 2024 及 MRS 2025 原档补同期项目线索，候选关系另列。 '+fL);
cell(f,1,'Mechanical Engineering and Materials Science、Institute of Materials Science and Engineering；电子显微、低维和功能材料');
cell(f,3,'Argonne 2023 年 5 月起至赴 WashU 前；Zachary D. Hood（低可信博士后导师候选）');
schoolWith(f,fL);
const fa=audit(f,[a('postdoc',fD,['fr','fd','fh','fm'],'group_or_candidate'),a('affiliation','WashU MEMS 助理教授，列 Institute of Materials Science and Engineering。',['fr'],'confirmed'),a('research','亚埃扫描透射电子显微、功能材料结构与性质。',['fr','fm'],'confirmed')],'查 Argonne 任用和原组员档，核分工及博后结束日。');
add(f,fa,'postdoc',ho,'candidate',fD,'hood','fr','fd','fh','fm');

const yD='Berkeley Miller 2003–2006 获奖原册具名 A. Paul Alivisatos 为 Yi Cui 的项目接收教师，与本人所称 postdoctoral mentor 相符。保留原奖期和实际任用日期口径。';
const yL=src(['Miller 原获奖公告','mi']);
pl(y,'- 博士后阶段研究师长：',yD+' '+yL);
line(mf(al),x=>x.startsWith('- 博士后阶段研究者：')&&x.includes('[[师承人物 - Yi Cui|'),' '+yD+' '+yL);
line(index,x=>x.startsWith('- [[师承人物 - Yi Cui|')&&x.includes(al),' '+yD+' '+yL);
schoolWith(y,yL);
audit(y,[a('postdoc',yD,['mi'],'group_or_candidate')],'两阶段已有具名关系；若找到同期任用档，补实际到离岗与奖期差别。');
const raw={"mi":"Spring  2003MILLER INSTITUTE NEWSThe Miller Institute is \"dedicated to the encouragement of creative thought and the (https://miller.berkeley.edu/images/newsletters/2003_spring.pdf)\nciteturn41001view5 [wordlim: 200] Crawled: 7 months ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn40990view0\",\"pattern\":\"Twelve Miller Fellowships\"}); Total lines: 172\nL134: 2003–2006Twelve Miller Fellowships were awarded for a three-year term, generally beginning\nL138: will be hosted by Professor Chung-Pei MaASTRONOMYYI CUI, (Harvard University) will be hosted by Professor\nL139: Paul Alivisatos\nL140: MUNIRA KHALIL, (Massachusetts Institute of Technology)\nL141: will be hosted by Professor Charles ShankCHEMISTRYSERGIO SPEZIALE, (Princeton University) will be hosted by Professors Raymond Jeanloz and Jill BanfieldEARTH & PLANETARY SCIENCEELECTRICAL ENGINEERING &","mh":"Miller Research Fellowship | Miller Institute for Basic Research in Science (https://miller.berkeley.edu/fellowship ; rewritten summary of https://miller.berkeley.edu/nominate-apply/miller-research-fellowship)\nciteturn40993view3 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"https://miller.berkeley.edu/fellowship\",\"pattern\":\"host\"}); Redirected to URL: https://miller.berkeley.edu/nominate-apply/miller-research-fellowship; Total lines: 114\nL68: Note: You are REQUIRED to include your potential UC Berkeley Faculty Host as a UCB Host/Reference in your application and their support letter will be in addition to the 3 required reference letters. As part of the Miller Fellow application process, your proposed Faculty Host(s) must submit a support letter confirming their willingness and ability to host and mentor you as a Miller Institute Fellow should you be awarded.\nL69: ##### Proposed UC Berkeley Faculty Host\nL70: The Miller Institute is the Sponsor and the Administrative Home Department for each Miller Fellow who is hosted and mentored by UC Berkeley Faculty in the facilities provided by the Faculty Host and academic department(s). As part of the Miller Fellow application process, a support letter from the proposed UCB Faculty Host is required by the Executive Committee.\nL71: The UCB Faculty Host support letter must address questions posed by the Executive Committee as well as confirm willingness and ability to host and mentor a Miller Institute Fellow should they be awarded. Only professors who have an active full-time appointment in the Berkeley academic campus department are eligible for the hosting/mentoring role. Emeritus, adjunct and professors of the Graduate school are not eligible as UCB Faculty Hosts.\nL72: Only the UC Berkeley academic departments listed in the application’s UCB Host Department selection menu are eligible for fellowship award. The Faculty Host name and email address entered in the application will generate an auto-email to them.\nL73: (Note: If the nominator is also UCB Faculty, their name and email must be entered as the UCB Faculty Host in the application so that the system can generate the email soliciting their supplementary support letter that addresses host/mentor items required by the Executive Committee.) Uploaded letters are not viewable by the applicant. Support letters by UCB Faculty Hosts must be uploaded to the online application file by the October 9, 2026 deadline.\nL75: It is necessary for applicants to make themselves known to potential host faculty at Berkeley. The application form requires that you select a minimum of one academic host department in which you would like to work, and it is optional to select up to two additional departments. Please list a department only one time. It is required to specify at least one faculty host in each department listed.\nL76: If you need help identifying potential faculty hosts, you may wish to contact the chair of your preferred host department to discuss your research interests\nL77: (【3†http://www.berkeley.edu/academics/dept/a.shtml†www.berkeley.edu】). While the Miller Institute does not financially support campus visits by candidates, we encourage applicants to contact potential UC Berkeley campus host academic departments and/or individual faculty hosts during the course of your application process to ascertain possible collaborative opportunities.\nL78: The support of your potential host is required if you expect to be placed in their group.It is necessary for applicants to make themselves known to potential host faculty at Berkeley. The application form requires that you select a minimum of one academic host department in which you would like to work, and it is optional to select up to two additional departments. Please list a department only one time. It is required to specify at least one faculty host in each department listed.\nL79: If you need help identifying potential faculty hosts, you may wish to contact the chair of your preferred 【4†host department†www.berkeley.edu】 to discuss your research interests. While the Miller Institute does not financially support campus visits by candidates, we encourage applicants to contact potential UC Berkeley campus host academic departments and/or individual faculty hosts during the course of your application process to ascertain possible collaborative opportunities.","mm":"Miller Institute Members H-P (https://miller.berkeley.edu/images/events/60/MillerProgram60.pdf)\nciteturn40990view1 [wordlim: 200] Crawled: 10.8 years ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn40989search13\",\"pattern\":\"Khalil, Munira\"}); Total lines: 1756\nL973: <tr><td>Khalil, Munira</td><td>MF</td><td>2003 - 2006</td></tr>","mn":"Professor Munira Khalil | Department of Chemistry | College of Science and Engineering (https://cse.umn.edu/chem/events/professor-munira-khalil-0)\nciteturn40986view1 [wordlim: 200] Crawled: 2 months ago; Content type: text/html; Source: find({\"ref_id\":\"https://cse.umn.edu/chem/events/professor-munira-khalil-0\",\"pattern\":\"postdoctoral\"}); Total lines: 228\nL14: # Professor Munira Khalil\nL16: 【7†Professor Munira Khalil†chem.washington.edu】\nL22: ### Munira Khalil\nL24: Munira Khalil is a Professor of Chemistry at the University of Washington. She earned her PhD from MIT and was a Miller Postdoctoral Fellow at UC Berkeley. Professor Khalil’s research seeks to develop a molecular-level understanding of how electronic, vibrational, and solvent dynamics govern charge and energy transfer in molecules and materials.\nL32: 【9†Image: Headshot photograph of Munira Khalil】","me":"Charles Shank | Physics (https://physics.berkeley.edu/people/faculty/charles-shank)\nciteturn41002view3 [wordlim: 200] Crawled: 3 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"https://physics.berkeley.edu/people/faculty/charles-shank\",\"pattern\":\"Emeritus\"}); Total lines: 159\nL56: # Charles Shank\nL58: 【50†Image: Charles Shank】\nL69: Professor Emeritus\nL72: Professor in Chemistry, Physics, Electrical Engineering and Computer Sciences and Director, Lawrence Berkeley National Laboratory, born 1943; B.S. (1965), M.S. (1966), Ph.D. (1969) in Electrical Engineering, University of California, Berkeley; AT&T Bell Laboratories: Member of Technical Staff (1969-76), Head, Quantum Physics & Electronics Research Department (1976-83), Director, Electronics Research Laboratory, (1983-89); R.W.","se":"CV – Philip Hemmer – April 2016  (https://lapt.ece.northwestern.edu/collaborators/CV-Philip_Hemmer.pdf)\nciteturn40987view0 [wordlim: 200] Crawled: 1.8 years ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn40985search12\",\"pattern\":\"Supervised doctorate thesis\"}); Total lines: 1962\nL1555: Supervised doctorate thesis for Selim Shahriar, “Fundamental Studies and Applications in Three Level Atoms,”\nL1556: 1992\nL1567: Supervised masters thesis for Selim Shahriar, “Raman Atomic Clock Studies,” 1989\nL1570: Supervised Masters thesis for Honam Yum “A 6-beam combiner using superimposed volume index holographic\nL1573: Supervised Doctorate thesis for Zhijie Deng, “Novel Optical Devices for Information Processing,” May 2006\nL1575: Supervised Doctorate thesis for Mughees Kahn, “Fabrication and testing of nano-optical structures for advanced\nL1578: Supervised Doctorate thesis for Changseok Shin, “One dimensional electron spin imaging for single spin\nL1581: Supervised Doctorate thesis for Honam Yum, “Study of white light cavity effect via stimulated Brillouin\nL1584: Supervised Doctorate thesis for Changdong Kim, “Ultrasensitive Magnetometry and Imaging with NV\nL1587: Supervised Doctorate thesis for Huilang Zhang, “Novel Nonlinear Optics and Quantum Optics Approaches for\nL1595: Supervised Doctorate thesis for Jeson Chen, “Quantum engineering in diamond,” August 2015\nL1548: Supervisory Experience\nL1550: Supervision at Air Force Research Laboratory","sc":"Biographical Sketch: (https://lapt.ece.northwestern.edu/selim/shahriar_cv.pdf)\nciteturn40991view0 [wordlim: 200] Crawled: 2 weeks ago; Content type: application/pdf; Number of pages: 68; Source: find({\"ref_id\":\"https://lapt.ece.northwestern.edu/selim/shahriar_cv.pdf\",\"pattern\":\"Fundamental Studies\"}); Total lines: 2281\nL19@P1: MIT EECS Ph.D. 1992\nL20@P1: Ph.D. Thesis Title: Fundamental Studies and Applications in Three Level Atoms\nL21@P1: SM Thesis Title: Raman Atomic Clock Studies\nL24@P1: Professor, EECS Dept., Northwestern University, 9/1/08-\nL25@P1: Professor, Physics and Astronomy Dept., Northwestern University, 9/1/08-8/31/18\nL26@P1: Professor, Applied Physics Graduate Program, 9/1/11-\nL28@P1: Associate Professor, EECS Dept., Northwestern University, 2001-2008\nL30@P1: Research Laboratory of Electronics, MIT, Research Scientist, 1992-2000\nL31@P1: Research Laboratory of Electronics, MIT, Postdoctoral Associate, 1991-1992","sn":"Shahriar, Selim | Faculty | Northwestern Engineering (https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/shahriar-selim.html)\nciteturn40995view2 [wordlim: 200] Crawled: yesterday; Content type: text/html; Source: open({\"ref_id\":\"turn40994view3\",\"lineno\":133}); Total lines: 286\nL107: Selim Shahriar\nL111: Professor of Electrical and Computer Engineering\nL122: 【48†Selim Shahriar's Homepage†lapt.ece.northwestern.edu】","sp":"Selim Shahriar: Department of Physics and Astronomy - Northwestern University (https://physics.northwestern.edu/people/faculty/affiliated-faculty/selim-shahriar.html)\nciteturn40998view2 [wordlim: 200] Crawled: 2 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"https://physics.northwestern.edu/people/faculty/affiliated-faculty/selim-shahriar.html\",\"pattern\":\"Affiliated\"}); Total lines: 325\nL265:   * 【200†Affiliated Faculty】\nL266:   * Selim Shahriar\nL271:     * 【200†Affiliated Faculty】\nL283: ## Selim Shahriar","ma":"Marc De Graef: Short Biography (https://kernie.materials.cmu.edu/~degraef/www/bio.html)\nciteturn41003view1 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"turn41002search0\",\"pattern\":\"In September of 1989\"}); Total lines: 18\nL3: In September of 1989 he joined the Materials Department at the University of California at Santa Barbara as a post-doctoral researcher. Under supervision of Profs. A. Evans and D. Clarke, he worked in various areas of materials science, using transmission electron microscopy and computer simulations as main research tools. Among the topics covered during that period are:\nL10:   * Vortex-dynamics in two-dimensional arrays of superconducting Josephson junctions\nL11: In March of 1993 he joined the Department of Materials Science and Engineering at Carnegie Mellon University as Assistant Professor. He has initiated research on the influence of hydrogen on titanium aluminides, magnetostrictive microstructures in Terfenol-D, grain boundary segregation in ZnO varistors, and a fundamental study of the use of energy-filtered TEM. He has won the Carnegie Mellon George T.\nL14: 【2†Recent research interests】 are in the area of quantitative Lorentz microscopy, as applied to the study of magnetic thin films and magnetostrictive materials, and the three-dimensional microstructure of structural intermetallics.","mc":"Marc De Graef - Materials Science and Engineering (https://www.mse.engineering.cmu.edu/directory/bios/degraef-marc.html)\nciteturn41003view0 [wordlim: 200] Crawled: yesterday; Content type: text/html; Source: open({\"ref_id\":\"https://www.mse.engineering.cmu.edu/directory/bios/degraef-marc.html\",\"lineno\":null}); Total lines: 129\nL15: # Marc De Graef\nL18: Faculty Director, Materials Characterization Facility\nL20: 【11†Image: Marc De Graef†engineering.cmu.edu】\nL23: Marc De Graef received his B.S. and M.S. degrees in physics from the University of Antwerp (Belgium) in 1983, and his Ph.D. in physics from the Catholic University of Leuven (Belgium) in 1989, with a thesis on copper-based shape memory alloys. He then spent three and a half years as a postdoctoral researcher in the Materials Department at the University of California at Santa Barbara before joining Carnegie Mellon University in 1993 as an assistant professor.\nL24: He is currently a professor in the Department of Materials Science and Engineering and faculty director of the Materials Characterization Facility. In 2023, he was appointed as the John and Claire Bertucci Distinguished Professor of Engineering.\nL47:     【12†Marc De Graef†scholar.google.com】\nL78: MSE’s Marc De Graef was selected by the Microscopy Society of America as the 2025 recipient of the Society’s Distinguished Scientist Award in the physical sciences.\nL82: Professor Marc De Graef has been selected by the Microscopy Society of America (MSA) as the 2025 recipient of the Society’s Distinguished Scientist Award in the physical sciences.","mw":"oup.silverchair-cdn.com (https://academic.oup.com/mt/article/33/3/10/8191177 ; rewritten summary of https://oup.silverchair-cdn.com/article-minimal/8191177)\nciteturn41003view2 [wordlim: 200] Crawled: 2 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"turn41002search5\",\"pattern\":\"Tony Evans\"}); Redirected to URL: https://oup.silverchair-cdn.com/article-minimal/8191177; Total lines: 296\nL52: After a few months Marc learned that a doctoral position had opened up in the \"Materiaalkunde\" department (Materials Science) at the Catholic University of Leuven, Belgium, and he started there in March of 1983 with research on phase stability in copper-based martensitic shape-memory alloys, in particular Al-Cu-Zn and Al-Ni-Cu. Since he was going for a PhD in Physics, he needed a co-advisor in the Physics department, so his thesis advisors were Luc Delaey (MSE) and G.S.D. King (Physics).\nL55: After completing his doctoral degree, Marc's original plan was to join the University of Wollongong, Australia, as a post-­doctoral researcher to continue his work on shape memory alloys.\nL56: A few weeks before his scheduled departure, however, he received a telegram from Wollongong (these were the pre-email days in most of the world), stating that the funding for the project did not come through, so \"Please, don't come.\" After a brief period of panic, Marc's advisor (Deleay) found out that the Materials Department at the University of California at Santa Barbara was looking for a post-doc with broad TEM expertise, and the rest is history.\nL57: Marc started in September of 1989 at UCSB and quickly became the resident TEM expert, working with nearly all faculty and numerous students; this is also where the modeling work really took off. Marc was asked by Tony Evans, the then-department head, to prepare and teach a graduate-level course on crystallography; this led to an extensive set of lecture notes which later formed the basis of his 2007 textbook, co-authored by M.","mv":"In Memoriam | Materials - UC Santa Barbara (https://materials.ucsb.edu/people/memoriam)\nciteturn41007view0 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"https://materials.ucsb.edu/people/memoriam\",\"pattern\":\"Anthony G. Evans\"}); Total lines: 178\nL153: ## Anthony G. Evans\nL156: Prof. Evans joined our faculty in 1985 and served as the founding chair of our top-ranked Materials Department. He was our Alcoa Professor of Materials, Professor of Mechanical Engineering, Director of our Center for Multifunctional Materials and Structures, and past Director of our High Performance Composites Center. An expert on the properties and behavior of advanced structural materials, Prof.","md":"November 4, 1999 (https://news.ucsb.edu/print/pdf/node/11324)\nciteturn41005view0 [wordlim: 200] Crawled: 9 months ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn41004search15\",\"pattern\":\"came to UCSB in 1990\"}); Total lines: 42\nL5: David R. Clarke, professor of materials at the University of California, Santa Barbara,\nL17: Clarke came to UCSB in 1990 after spending seven years at IBM's Research Division","vo":"L4: SERENDIPITOUS MEANDERINGS AND ADVENTURES\nL6: J. Peter Toennies\nDownloaded from www.annualreviews.org.  Guest (gue (https://www.annualreviews.org/content/journals/10.1146/annurev.physchem.55.081203.151413?crawler=true&mimetype=application%2Fpdf)\nciteturn41001view3 [wordlim: 200] Crawled: 7 months ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn41000view0\",\"pattern\":\"Andrej Vilesov\"}); Total lines: 1404\nL716: In the fall of 1969, Christoph Ottinger, also joined our new group after two\nL718: his Habilitation in 1976, Ottinger received the equivalent to an associate professor\nL721: Andrej Vilesov, who was a postdoc with Ottinger from 1990 to 1996, later played\nL722: an important role in our studies of superﬂuid helium droplets.\nL905: insight into the properties such as the temperatures of the helium droplets.\nL906: Molecular Spectroscopy in Superﬂuid Helium Droplets\nL907: Andrej Vilesov (now a professor of chemistry at the University of Southern Cali-\nL909: from the Alexander von Humboldt Foundation to do spectroscopy in Ottinger’s\nL912: ing sharp infrared absorption lines of SF6 in helium droplets (41), started to work\nL914: in helium droplets. At that time, our colleagues Udo Buck and Rudolf D¨uren had\nL1154: vided the theory that enabled Andrej Vilesov and myself to interpret some spectral\nL1185: Hubert Van den Berg (Great Britain), and Andrej Vilesov (Russia). Additional\nL907: Andrej Vilesov (now a professor of chemistry at the University of Southern Cali-\nL908: fornia) arrived from Saint Petersburg in November 1990 with a postdoc fellowship\nL909: from the Alexander von Humboldt Foundation to do spectroscopy in Ottinger’s\nL910: research group within our department. Andrej attended the seminars on He droplet\nL917: In early August 1993, a young postdoc Ralf Fr¨ochtenicht and Andrej were\nL918: ﬁnally ready for their ﬁrst experiment. Prior to his departure a few days later\nL919: for summer holidays in Russia, Andrej came to my ofﬁce on a Friday afternoon\nL920: to ask me which of the two lasers to use ﬁrst. Recalling advice received from","vu":"Andrey Vilesov - USC Dornsife (https://dornsife.usc.edu/profile/andrey-vilesov/)\nciteturn41001view4 [wordlim: 200] Crawled: yesterday; Content type: text/html; Source: find({\"ref_id\":\"turn40999search0\",\"pattern\":\"he did research in groups\"}); Total lines: 275\nL216: # Andrey Vilesov\nL220: 【143†Image: Andrey Vilesov】\nL224: Andrey F. Vilesov obtained his Ph.D. in Physics at St. Petersburg State University, St. Petersburg, Russia in 1985. In 1990 he moved to the Max Planck Institute for Fluid Dynamics (Strömungsforschung), Göttingen, Germany, where he did research in groups of Prof. Christoph Ottinger and Prof. J. Peter Toennies. In 1999 He received his habilitation in physics from University of Göttingen for his works on helium nano-droplets.\nL225: Since 2000 he has been a Professor of Chemistry, Physics and Astronomy at the University of Southern California in Los Angeles.\nL229:   * Ph.D. Physics, St. Petersburg State University, Russia, 1985\nL234: We specialize in the spectroscopy of molecules, ions and clusters in superfluid He droplets and the study of isolated quantum fluids with x-ray free electron lasers","vp":"Peter Festschrift_12.8.2020 (https://pure.mpg.de/rest/items/item_3276696_8/component/file_3287417/content)\nciteturn40992view0 [wordlim: 200] Crawled: 6.2 years ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn40991search12\",\"pattern\":\"Humboldt Fellow with Christoph\"}); Total lines: 770\nL289: with Manfred Faubel and Christoph Ottinger, Fig. 19, is post-\nL290: Wende too, likely from 1992, when Andrey Vilesov was\nL291: receiving his molecular beam spectroscopy training from","gp":"XSNS14 (https://liquids.seas.harvard.edu/sxnspeterindex.html)\nciteturn40987view1 [wordlim: 200] Crawled: 3 months ago; Content type: text/html; Source: find({\"ref_id\":\"turn40985search0\",\"pattern\":\"After getting his PhD\"}); Total lines: 70\nL25: ### Oleg Gang\nL27: After getting his PhD with Moshe Deutsch at Bar Ilan he joined me as a postdoc from 1999 to 2002. He is now a scientist at Brookhaven; however, starting this month he will have a joint appointment in Applied Physics and Chemical Engineering at Columbia University.","gb":"BNL | Staff | Oleg Gang, Center for Functional Nanomaterials (https://www.bnl.gov/staff/ogang)\nciteturn40994view1 [wordlim: 200] Crawled: 2 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"https://www.bnl.gov/staff/ogang\",\"pattern\":\"Dissertation Title\"}); Total lines: 165\nL84:   * MS in Physics: Bar-Ilan University, Israel\nL86:   * PhD in Physics: Bar-Ilan University, Israel\nL87:     * Dissertation Title: Surface Ordering in Chain Molecules\nL88:   * Postdoctoral Research: Harvard University (School of Engineering and Applied Sciences)","gn":"The Village Beacon Record Honors BNL Scientists | BNL Newsroom (https://www.bnl.gov/newsroom/news.php?a=22203)\nciteturn40993view2 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"turn40992search2\",\"pattern\":\"Rothschild Fellow\"}); Total lines: 155\nL81: Gang earned a bachelor’s degree in physics from Chernivtsi National University, Ukraine, in 1991, a master’s degree in physics and a Ph.D. in soft matter physics, both from Bar-Ilan University, in 1994 and 2000, respectively. He was a postdoctoral Rothschild Fellow at Harvard University from 1999 to 2002, joining BNL as a Goldhaber Fellow in 2002. He became a staff scientist at the Lab’s CFN in 2004, and was promoted to the CFN’s leader for Soft Matter and Biomaterials Theme in 2006.","gc":"Oleg_Gang_shortCV_March2020 (https://cheme.columbia.edu/files/seas/content/oleg_gang_shortcv_march2020.pdf)\nciteturn40997view4 [wordlim: 200] Crawled: 7 months ago; Content type: application/pdf; Number of pages: 3; Source: find({\"ref_id\":\"https://cheme.columbia.edu/files/seas/content/oleg_gang_shortcv_march2020.pdf\",\"pattern\":\"Bar-Ilan\"}); Total lines: 115\nL2@P0: Columbia University\nL6@P0: Bar-Ilan University, Israel Physics; B.Sc. & M.Sc. 1994\nL7@P0: Bar-Ilan University, Israel Soft Matter Physics with Highest Distinction; Ph.D. 2000\nL8@P0: Harvard University, Cambridge, MA Postdoctoral Rothschild Fellow 2000-2002\nL10@P0: 2016-present Professor, Department of Chemical Engineering, Columbia University, NY\nL11@P0: 2016-present Professor, Department of Applied Physics and Applied Mathematics, Columbia University,\nL18@P0: 2002- 2004 Goldhaber Fellow, Physics Department, BNL\nL35@P0: 2002 Goldhaber Distinguished Fellowship, Brookhaven National Laboratory\nL36@P0: 2000 Rothschild Foundation Distinguished Fellowship\nL37@P0: 1998 University Presidential Award, Bar-Ilan University","gw":"Oleg Gang | Chemical Engineering (https://www.cheme.columbia.edu/faculty-staff/directory/oleg-gang)\nciteturn40991view1 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"https://www.cheme.columbia.edu/faculty-staff/directory/oleg-gang\",\"pattern\":\"Bar-Ilan\"}); Total lines: 173\nL64:  Gang actively develops novel strategies for creating designed nanoscale architectures through programmable self-assembly, where biomolecules, polymers and external fields guide a structure formation and transformation. The main objective of the research program is to enable autonomous material systems that exhibit designed spatial organization, pathway programmable behavior, and can be dynamically controlled.\nL66: Gang earned MS and PhD (2000) from Bar-Ilan University (Israel), specializing in Atomic Spectroscopy and Soft Matter, respectively. As a postdoctoral Distinguished Rothschild Fellow at Harvard University, he studied nanoscale wetting phenomena and liquid interface phenomena. Gang started at Brookhaven National Laboratory as a Distinguished Goldhaber Fellow in 2002, rising through the ranks to lead the Soft and Bio-Nanomaterials group at the Center for Functional Nanomaterials.\nL67: In 2016, Gang joined Columbia University as a Professor of Chemical Engineering, and of Applied Physics and Materials Science.\nL68: Gang has received numerous awards and recognitions, including University President Award and Wolf Foundation scholarship for his PhD work, Rothschild and Goldhaber fellowships, Department of Energy Outstanding Mentor Award, Gordon Battelle Prize for Scientific Discovery, has been named Battelle Inventor of the Year, and he is a Fellow of American Physical Society.\nL94:     * Professor, Department of Chemical Engineering, Columbia University, 2016–\nL115:     * PhD, Physics, Bar-Ilan University\nL116:     * MS, Physics, Bar-Ilan University\nL117: ## Oleg Gang in the News\nL143: Oleg Gang\nL153:   * 【37†Lab Website†gang.cheme.columbia.edu】","gv":"Microsoft Word - cover.doc (https://liquids.seas.harvard.edu/masa/thesis_mfukuto.pdf)\nciteturn40992view3 [wordlim: 200] Crawled: last month; Content type: application/pdf; Number of pages: 232; Source: find({\"ref_id\":\"https://liquids.seas.harvard.edu/masa/thesis_mfukuto.pdf\",\"pattern\":\"I also thank his successor Oleg Gang\"}); Total lines: 7235\nL84@P5: I also thank his successor Oleg Gang, who has always been ready to help, give advice,\nL86@P5: unofficial advisors with whom I can always exchange ideas and it has been fun to work.","pn":"Peter W. Voorhees: Applied Physics Graduate Program - Northwestern University (https://appliedphysics.northwestern.edu/people/faculty/peter-w-voorhees.html)\nciteturn40997view3 [wordlim: 200] Crawled: 2 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"https://appliedphysics.northwestern.edu/people/faculty/peter-w-voorhees.html\",\"pattern\":\"Engineering Sciences and Applied Mathematics\"}); Total lines: 151\nL58:   * Peter W. Voorhees\nL68: ## Peter W. Voorhees\nL69: ### Professor of Materials Science and Engineering; Professor of Engineering Sciences and Applied Mathematics (by courtesy)\nL71: Ph.D. in Materials Engineering, Rensselaer Polytechnic Institute, 1982; B.S. in Physics, Rensselaer Polytechnic Institute, 1977\nL81: Thermodynamics and kinetics of phase transformations","pc":"Peter W. Voorhees vc (https://www.nims.go.jp/nimsweek/2016/pdf/J22_Voorhess_vc.pdf)\nciteturn40991view3 [wordlim: 200] Crawled: last month; Content type: application/pdf; Number of pages: 31; Source: find({\"ref_id\":\"https://www.nims.go.jp/nimsweek/2016/pdf/J22_Voorhess_vc.pdf\",\"pattern\":\"Postdoctoral\"}); Total lines: 928\nL0@P0: Peter W. Voorhees\nL14@P0: Metallurgist, Metallurgy Division, National Bureau of Standards, Gaithersburg, MD,\nL16@P0: National Research Council-National Academy of Sciences Postdoctoral Associate, Metallurgy\nL17@P0: Division, National Bureau of Standards, Gaithersburg, MD, 10/82 - 7/84\nL18@P0: Postdoctoral Research Fellow, Materials Engineering Department, Rensselaer Polytechnic\nL19@P0: Institute, Troy, New York., summer 1982.","pr":"Center for Materials Science metallurgy division technical activities 1984 (https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nbsir84-2995.pdf)\nciteturn40998view0 [wordlim: 200] Crawled: 9.5 years ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn40996search14\",\"pattern\":\"P. W. Voorhees\"}); Total lines: 5425\nL2294: Microstructure Transformations--Coarsening; Liquefied Grain Boundaries\nL2295: Subtask 7 of Task 15443\nL2297: P. W. Voorhees, R. J. Schaefer, and C. A. Handwerker\nL3538: P. W. Voorhees\nL3545: P. W. Voorhees\nL3572: Coarsening in Metallurgical Systems\nL3576: P. W. Voorhees\nL3583: P. W. Voorhees","fr":"Francisco Lagunas Vargas | WashU McKelvey School of Engineering (https://engineering.washu.edu/faculty/Francisco-Lagunas-Vargas.html)\nciteturn40997view2 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"https://engineering.washu.edu/faculty/Francisco-Lagunas-Vargas.html\",\"pattern\":\"Argonne\"}); Total lines: 299\nL208: # Francisco Lagunas Vargas\nL214: 【92†Mechanical Engineering & Materials Science†mems.washu.edu】 【93†Institute of Materials Science & Engineering†imse.washu.edu】\nL251: Francisco Lagunas Vargas will be joining the McKelvey School of Engineering in June 2025. He completed his post-doctoral work at Argonne National Laboratory, where he was engaged in pioneering research on renewable energy materials and next-generation ionic sensors. His expertise lies in utilizing advanced Scanning Transmission Electron Microscopes (STEM) to investigate materials at angstrom scales.\nL256:   * 【93†The Institute of Materials Science & Engineering (IMSE)†imse.washu.edu】\nL267: 【107†Find more news about Francisco Lagunas Vargas】\nL284:   * 【28†Mechanical Engineering & Materials Science†mems.washu.edu】","fh":"Welcome to the Texas Center for Superconductivity at University of Houston (https://tcsuh.com/post/news_events/jointseminar/784/)\nciteturn41003view3 [wordlim: 200] Crawled: 5 months ago; Content type: text/html; Source: find({\"ref_id\":\"turn41002search1\",\"pattern\":\"Group Leader\"}); Total lines: 132\nL59: 【55†Image: Dr. Zachary D. Hood】\nL64: by: Dr. Zachary D. Hood\nL66: Affiliation: Applied Materials Division, Argonne National Laboratory\nL77: Dr. Zachary Hood, a Group Leader and Materials Scientist, leads the Advanced Electrochemical Materials Group within the Energy Storage and Conversion Department of Argonne National Laboratory’s Applied Materials Division. Under his guidance, the group pioneers inventive synthetic approaches to create cutting-edge solid-state materials, employing various characterization techniques to unravel their properties and performance across the nano-to-macro scale. Zachary Hood received his B.S.\nL79: He has received prestigious awards, including the Argonne Board of Governors Excellence in Diversity, Equity, Inclusion, and Accessibility Award in 2023, Impact Argonne Award, the Maria Goeppert Mayer Director’s Fellowship at Argonne National Laboratory, and the Materials Research Society Graduate Student Award (Gold), showcasing his leadership in pushing the boundaries of energy storage research.","fm":"Ionic-Based Electrochemical Gas Sensor for Ultra-Low SO<sub>2 </sub>Detection (https://www.mrs.org/meetings-events/annual-meetings/archive/meeting/presentations/view/2025-mrs-spring-meeting/2025-mrs-spring-meeting-4278059)\nciteturn41004view2 [wordlim: 200] Crawled: 2 months ago; Content type: text/html; Source: find({\"ref_id\":\"https://www.mrs.org/meetings-events/annual-meetings/archive/meeting/presentations/view/2025-mrs-spring-meeting/2025-mrs-spring-meeting-4278059\",\"pattern\":\"Francisco Lagunas Vargas\"}); Total lines: 266\nL176: # Ionic-Based Electrochemical Gas Sensor for Ultra-Low SO_{2 }Detection\nL180: Apr 11, 2025\nL187: 【110†Francisco Lagunas Vargas】\nL193: 【113†Zachary Hood】\nL196: Francisco Lagunas Vargas^{1},Hacksung Kim^{2,1},Gabriella Myslo^{3,1},Zachary Hood^{1}\nL201: Francisco Lagunas Vargas^{1},Hacksung Kim^{2,1},Gabriella Myslo^{3,1},Zachary Hood^{1}","fu":"Three Renowned Argonne Scientists Accept Joint Appointments at the University of Houston (https://www.uh.edu/news-events/stories/2024/march/03292024-argonne-joint-appointments.php)\nciteturn41003view4 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"turn41002search8\",\"pattern\":\"Hood, group leader\"}); Total lines: 86\nL20: 【6†Zachary Hood†www.anl.gov】, group leader and material scientist in Argonne’s Applied Materials Division (AMD), has accepted a joint appointment in the Department of Electrical and Computer Engineering at the UH Cullen College of Engineering. He will be hosted by 【7†Yan Yao†www.ece.uh.edu】, the Hugh Roy and Lillie Cranz Cullen Distinguished Professor and principal investigator at the Texas Center for Superconductivity.","fd":"Small but Powerful: Could Nanotechnology Help Address the Climate Crisis? | Department of Energy (https://www.energy.gov/cmei/ammto/articles/small-powerful-could-nanotechnology-help-address-climate-crisis)\nciteturn40999view0 [wordlim: 200] Crawled: 2 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"turn40998search5\",\"pattern\":\"Francisco Lagunas Vargas and Zachary Hood\"}); Total lines: 28\nL16: Francisco Lagunas Vargas and Zachary Hood, Argonne National Laboratory\nL17: "};
const read=(id,key,excerpt)=>({record_id:id,url:u[key],raw:raw[key],excerpt});
const error=(id,key,error)=>({record_id:id,url:u[key],error});
const pages=[read(k,"mi","Miller 获奖原册具名 Khalil 的接收导师为 Charles Shank。"),
read(k,"mh","Miller 说明 Faculty Host 负责接收并指导。"),
read(k,"mm","历年名册列 Khalil 为 2003–2006 Miller Fellow。"),
read(k,"mn","Minnesota 核 UW 化学、MIT 博士和 Miller 博后。"),
read(k,"me","Berkeley 物理系确认 Shank 身份及荣休。"),
read(s,"se","Hemmer CV 明列指导 Shahriar 1992 博士与 1989 硕士论文。"),
read(s,"sc","本人 CV 分列两学位题名及日期。"),
read(s,"sn","Northwestern 工程学院核 ECE 教授。"),
read(s,"sp","Northwestern 物理系列 affiliated faculty。"),
read(m,"ma","本人履历具名 UCSB 博后接受 Evans 与 Clarke 指导。"),
read(m,"mc","CMU 院系核博后、教职与中心主任。"),
read(m,"mw","显微学会核博士导师及 Tony Evans 当期系主任。"),
read(m,"mv","UCSB 原档确认 Anthony G. Evans 全名及创系主任。"),
read(m,"md","UCSB 原档核 Clarke 1990 到校。"),
read(v,"vo","Toennies 回忆录明列 Andrej Vilesov 1990–1996 为 Ottinger 博后。"),
read(v,"vu","USC 核博士、两个 Göttingen 组、habilitation 及现职。"),
read(v,"vp","Max Planck 原稿核 Ottinger 提供分子束谱学训练。"),
read(g,"gp","Pershan 本人核两阶段关系及 Harvard 博后起始年。"),
read(g,"gb","BNL 分列博士与硕士论文题名。"),
read(g,"gn","BNL 列 Harvard 1999–2002 与 BNL Goldhaber。"),
read(g,"gc","本人 CV 列 Harvard 2000–2002、BNL 2002–2004。"),
read(g,"gw","Columbia 核双聘和可编程自组装研究。"),
read(g,"gv","Fukuto 学位论文核 Harvard X-ray Group 博后。"),
read(p,"pn","应用物理项目核 ESAM courtesy 与 1982 RPI 学位。"),
read(p,"pc","本人 CV 分列两段博后。"),
read(p,"pr","NBS 1984 原档列三名项目成员。"),
read(f,"fr","WashU 核院系、研究所、Argonne 博后。"),
read(f,"fd","DOE 同期署名列 Lagunas 与 Hood。"),
read(f,"fh","Houston 核 Hood 任 Argonne 电化学材料组负责人。"),
read(f,"fm","MRS 会议原档列两人于 Argonne 同项目。"),
read(f,"fu","Houston 原任命确认 Hood ECE 联合任用。"),
read(y,"mi","获奖原册同页具名 Alivisatos 为 Yi Cui 的接收教师。"),
error(f,'fx','WashU event page returned 429; continue after host backoff.'),
error(f,'fa','ACS original endpoint returned 403; used MRS and DOE original sources for collaboration.'),
error('401d11fb','wa','Wiley original endpoint returned 403.'),
error('401d11fb','sd','ScienceDirect original endpoint returned 403.')];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2213_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2213_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2213_Miller与具名指导原档网页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
