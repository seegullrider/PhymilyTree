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
 orig.audit_id='pi_archive_20261111_1027_'+id;
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
 relations.push({event_id:'pi_archive_20261111_1027_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
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




const u={
 stach:'https://stachgroup.seas.upenn.edu/wp-content/uploads/2020/06/CV_Eric_Stach_June_2020.pdf',
 hull:'https://news.rpi.edu/luwakkey/2357',tromp:'https://physics.asu.edu/sites/default/files/2022-10/Cowley%20Lecture%20Flyer-11x17-Tromp.pdf',
 viest:'https://viest.upenn.edu/people/eric-stach',bnl:'https://www.bnl.gov/newsroom/news.php?a=112551',
 ies:'https://citeseerx.ist.psu.edu/document?doi=75e2ffa29d9e60042b9315e5ec0d71cc2d06271a&repid=rep1&type=pdf',
 innovation:'https://www.innovationmagazine.com/volumes/v5n2/feature.html',
 ntu2005:'https://opg.optica.org/josab/abstract.cfm?uri=josab-22-7-1498',
 ntu2006:'https://opg.optica.org/abstract.cfm?uri=ofc-2006-OWI70',
 ntubio:'https://dr.ntu.edu.sg/server/api/core/bitstreams/91229561-9394-4d62-9777-cb6d89f834ce/content',
 polyu:'https://www.polyu.edu.hk/pri/people/international-advisory-committee/prof-qijie-wang/?sc_lang=en',
 fuller:'https://cap.stanford.edu/profiles/viewCV?facultyId=8066&name=Gerald_Fuller',
 stan:'https://engineering.stanford.edu/news/gerry-fuller-i-didnt-have-roadmap-becoming-professor',
 leal:'https://feeds.library.caltech.edu/people/Leal-L-G/combined_advisor.html',
 chem:'https://chemistry.uconn.edu/?person=fotios-papadimitrakopoulos',
 acs:'https://pubs.acs.org/doi/10.1021/ma00044a032',
 acs2:'https://pubs.acs.org/doi/abs/10.1021/ma00044a033',
 forth:'https://www.iceht.forth.gr/wp-content/uploads/rd/abstracts/20050113_abstract.pdf',
 hkust:'https://ias.hkust.edu.hk/people/ias-members/visitors/prof-patrick-a-lee',
 mit:'https://physics.mit.edu/faculty/patrick-lee/',
 syr:'https://surface.syr.edu/com_etd/32/',
 shen:'https://zhishifenzi.blog.caixin.com/archives/172071',
 slac:'https://faculty.slac.stanford.edu/person/zhi-xun-shen',
 shenProfile:'https://profiles.stanford.edu/zhi-xun-shen',
 pan:'https://engineering.uci.edu/directory/pan_xiaoqing.php'
};
const st='bbf51fa6',sn='Eric Stach',rh='师承人物 - Robert Hull',rt='师承人物 - Rudolf M. Tromp';
const stPhd='本人 2020 CV 第 2 页列 1998 University of Virginia 材料科学与工程博士论文，Dissertation Advisor 栏具名 Robert Hull，Co-advisor 栏具名 Rudolf M. Tromp。Tromp 同时在 CV 第 3 页的 1997 IBM Cooperative Fellowship 栏列为 IBM Mentor。';
const stPost='本人 CV 第 2 页列 1998–2002 Berkeley Lab National Center for Electron Microscopy 的 Materials Staff Scientist 和 2003–2004 Metals Program Leader。Brookhaven 履历独立核实 staff scientist／PI，现有时间线未发现单列博士后。';
mentor(rh,'Robert Hull','University of Virginia 材料科学与工程教授，后任 Rensselaer 材料科学与工程系主任。',src(['RPI 任用原档','hull']));
mentor(rt,'Rudolf M. Tromp','IBM T. J. Watson Research Center 与 Leiden University 表面和材料物理研究者。',src(['ASU 本人讲座履历','tromp']));
const stSrc=source('本人 CV 第 2 页',u.stach+'#page=2');
edge(st,sn,rh,'Robert Hull','博士导师','博士生',stPhd,stSrc+' · '+src(['RPI 任用原档','hull']));
edge(st,sn,rt,'Rudolf M. Tromp','博士导师（共同导师）','博士生（共同指导）',stPhd,stSrc+' · '+src(['ASU 本人讲座履历','tromp']));
rewrite(pf(st),x=>x.startsWith(boundary),()=>boundary+stPost+' '+stSrc+' · '+src(['Brookhaven 履历','bnl'],['Penn 院系档','viest']));
cell(st,2,'Robert Hull（博士论文导师）；Rudolf M. Tromp（共同导师）');
cell(st,3,'1998 起 Berkeley Lab Materials Staff Scientist，未发现单列博士后');
schoolWith(st,stSrc+' · '+src(['Penn 院系档','viest'],['Brookhaven 履历','bnl']));
const sa=audit(st,[
 a('identity','本人 CV 和 Penn 院系档核本人、UVA 博士及 Berkeley、Brookhaven 和 Penn 任用。',['stach','viest','bnl'],'confirmed'),
 a('affiliation','University of Pennsylvania 材料科学与工程教授及 LRSM 主任。',['viest'],'confirmed'),
 a('research','电子、离子与 X 射线显微学，纳米材料原位及 operando 表征。',['viest','bnl'],'confirmed'),
 a('phd',stPhd,['stach','hull','tromp'],'confirmed_advisor'),
 a('postdoc',stPost,['stach','bnl'],'no_postdoc_documented')
],'若获得 1998 UVA 学位原件，补直接签署页并复核 CV 中博士论文题名。');
relation(st,sa,'phd',rh,'advisor',stPhd,[u.stach+'#page=2',u.hull],'hull');
relation(st,sa,'phd',rt,'advisor',stPhd,[u.stach+'#page=2',u.tromp],'tromp');

const qi='bc70814b',qn='Qijie Wang',soh='师承人物 - Yeng Chai Soh',zy='师承人物 - Ying Zhang（SIMTech 光信号处理）';
const qiPhd='同期 Innovation 报道明确 Qijie Wang 的 NTU EEE 博士研究受 Yeng Chai Soh（NTU）和 Ying Zhang（SIMTech）指导。IES 2005 项目原档具名两人为合作项目负责人并列王岐捷为项目成员，Optica 原刊核对应姓名、单位与光学滤波方向。博士阶段指导关系可信度高，正式论文导师及分工仍待学位原件。';
const qiPost='DR-NTU 作者履历核 2005 NTU SMF 博士后。2006 年 3 月 Optica 会议原档列王岐捷、Soh 和 Zhang 继续在 NTU／SIMTech 合作。该证据支持低可信博士后导师候选，个人指导待 fellowship 原档。Harvard Capasso 组属另列。';
const qPhdSrc=src(['同期具名指导报道','innovation'],['IES 2005 项目原档','ies'],['Optica 原刊','ntu2005']);
const qPostSrc=src(['DR-NTU 本人作者履历','ntubio'],['2006 Optica 会议论文','ntu2006']);
mentor(soh,'Yeng Chai Soh','NTU 电气与电子工程研究者，2005 年 NTU／SIMTech 光信号处理合作项目负责人。',src(['IES 项目原档','ies']));
mentor(zy,'Ying Zhang（SIMTech 光信号处理）','2005 年在 SIMTech 从事光学滤波与光信号处理，NTU／SIMTech 合作项目负责人。',src(['Optica 作者与单位','ntu2005'],['IES 项目原档','ies']));
for(const [target,label] of [[soh,'Yeng Chai Soh'],[zy,'Ying Zhang（SIMTech 光信号处理）']]){
 edge(qi,qn,target,label,'博士阶段研究师长','博士阶段受指导者',qiPhd,qPhdSrc);
 edge(qi,qn,target,label,'博士后导师候选','博士后候选关系',qiPost,qPostSrc);
}
rewrite(pf(qi),x=>x.startsWith(boundary),x=>x+' '+qiPhd+' '+qPhdSrc+' '+qiPost+' '+qPostSrc);
cell(qi,2,'NTU 2005 EEE 博士。Yeng Chai Soh、Ying Zhang（SIMTech）为博士阶段研究师长，正式导师待学位原件');
cell(qi,3,'2005 NTU SMF 博后，Soh、Zhang 为低可信候选；Harvard Federico Capasso（博士后课题组负责人）');
schoolWith(qi,qPhdSrc+' · '+qPostSrc+' · '+src(['PolyU 联聘档','polyu']));
const qa=audit(qi,[
 a('affiliation','NTU 电气与电子工程学院、物理与数学科学学院联合任职。',['polyu'],'confirmed'),
 a('phd',qiPhd,['innovation','ies','ntu2005','ntubio'],'group_or_candidate'),
 a('postdoc',qiPost,['ntubio','ntu2006'],'group_or_candidate')
],'追 2005 NTU 电气与电子工程论文和 SMF 聘任原档的正式导师栏。Harvard 阶段保留 Capasso 组属，继续追个人指导职衔。');
for(const [target,key] of [[soh,'soh'],[zy,'zhang']]){
 relation(qi,qa,'phd',target,'stage_mentor',qiPhd,ids('innovation','ies','ntu2005'),key+'_phd');
 relation(qi,qa,'postdoc',target,'candidate',qiPost,ids('ntubio','ntu2006'),key+'_post');
}

const fu='bcffe1c3';
const fPost='Stanford 托管本人 CV 明列 1980 年 2 月 Caltech 化工博士，2–9 月 Strasbourg Centre de Recherches sur les Macromolécules 的 Visiting Scientist，10 月起任 Stanford 化工助理教授。按 CV 保存访问研究者职衔，是否另有博士后合同及具名指导待核。';
rewrite(pf(fu),x=>x.startsWith(boundary),()=>boundary+fPost+' '+source('本人 CV 任用页',u.fuller+'#page=2')+' · '+src(['Stanford 本人访谈','stan']));
cell(fu,3,'1980 年 2–9 月 Strasbourg 访问研究者，10 月任 Stanford 化工助理教授；博士后身份与导师待核');
schoolWith(fu,source('本人 CV 任用页',u.fuller+'#page=2'));
audit(fu,[a('postdoc',fPost,['fuller','stan'],'unresolved')],'查 Strasbourg 1980 研究人员名录和具体聘用，核其访问研究是否同时属于博士后以及个人指导。');

const fo='bb8689dc';
const fB='UConn 化学系本人档明列 AT&T Bell Laboratories 1992–1994 Postdoctoral Fellow，FORTH 履历列两年及 1994 入 UConn。FORTH 所列 UMass 博士 1993 与博士后开始年重叠，学位授予年和任用确切月份分别待核。';
const fD='ACS 1992 年两篇液晶聚氨酯原始论文具名 Papadimitrakopoulos 与 William J. MacKnight 合著。按既有导师候选保留，可信度低。';
personLine(fo,'- 博士后经历：',' '+fB+' '+src(['UConn 化学系任用原档','chem']));
personLine(fo,'- 博士导师候选：',' '+fD+' '+src(['ACS 同期论文 I','acs'],['ACS 同期论文 II','acs2']));
personLine(fo,boundary,' '+fB+' '+src(['UConn 化学系任用原档','chem']));
cell(fo,3,'UConn 化学系列 AT&T Bell Laboratories 1992–1994 博后。个人导师待核，博士授予年与任用月份待原档');
schoolWith(fo,src(['UConn 化学系任用原档','chem'],['ACS 原刊','acs']));
audit(fo,[
 a('affiliation','UConn Chemistry 教授，校内 IMS 人员页为跨院系资料。',['chem'],'confirmed'),
 a('research','单壁碳纳米管、半导体纳米晶及光子晶体等纳米材料。',['chem'],'confirmed'),
 a('phd',fD,['acs','acs2','forth'],'group_or_candidate'),
 a('postdoc',fB,['chem','forth'],'unresolved')
],'查 UMass 学位签署及 Bell Labs 1992–1994 人员任命、项目或本人履历中的指导者。');

const p='bc7878ac';
const pPost='HKUST IAS 履历列 1970 MIT 博士、1970–1972 Yale 任教、1972–1982 Bell Labs 理论物理部门。MIT 院系档核约十年 Bell Labs 和 1982 入 MIT。Yale 具体职衔和可能单列博士后任用待核。';
const pIdentity='Syracuse 2002 论文作者全名为 Patrick Lee Plaisance，研究新闻伦理；MIT 校属记录是 1970 MIT 物理博士 Patrick A. Lee，研究凝聚态理论。两人有不同姓氏、年份和领域。';
rewrite(pf(p),x=>x.startsWith(boundary),()=>boundary+pPost+' Marlan O. Scully 保留博士导师候选。Post-Tenure 是现行 MIT 目录状态。 '+src(['HKUST IAS 历史履历','hkust'],['MIT 物理系','mit']));
cell(p,3,'Yale 1970–1972 任教；Bell Labs 1972–1982 理论物理研究。具体职衔与独立博后待核');
schoolWith(p,src(['HKUST IAS 历史履历','hkust'],['Syracuse 同名误配','syr']));
const pa=audit(p,[
 a('identity',pIdentity,['mit','hkust','syr'],'confirmed'),
 a('postdoc',pPost,['mit','hkust'],'unresolved')
],'追 Yale 1970–1972 教师或研究人员目录中的职衔，并待 MIT 学位原卷确认 Scully 角色。');
const exclusions=[{page_id:'1561ebd0c77d4b3b1ff0a825',url:u.syr,record_id:p,audit_id:pa,external_subject:'Patrick Lee Plaisance，Syracuse 新闻伦理博士',evidence:pIdentity}];

const sh='177eaec9', shn='Zhi-Xun Shen',sp='师承人物 - William E. Spicer',spName='William E. Spicer';
const shFrom=who(sh,shn), shTo=wiki(sp,spName);
const shPhd='沈志勋访谈报道明确称其到 Stanford 后由 Ingolf Lindau 和 William Spicer 共同指导博士阶段研究。既有 SSRL 目录列 Lindau 为论文 Advisor；Spicer 的研究指导关系明确，论文共同导师职衔待签署页。';
const shPost='沈志勋访谈报道描述博士毕业后做过约两年博士后，并称两位博士阶段导师曾建议他继续博士后。任用职衔和精确起讫时间待 Stanford 当期档，博后指导者待具名证据。';
const shLinks=src(['沈志勋访谈报道','shen'],['SLAC 本人档','slac']);
rewrite(pf(sh),x=>x.startsWith('- 待核 '+shTo),()=>'- 博士阶段研究师长：'+shTo+'。'+shPhd+' '+shLinks);
rewrite(mf(sp),x=>x.startsWith('- '+shFrom+'：博士阶段候选'),()=>'- 博士阶段受指导者：'+shFrom+'。'+shPhd+' '+shLinks);
rewrite(index,x=>x.startsWith('- '+shFrom+' → 博士导师候选：'+shTo),()=>'- '+shFrom+' → 博士阶段研究师长：'+shTo+'。'+shPhd+' '+shLinks);
rewrite(path.join(root,'师承候选线索索引.md'),x=>x.startsWith('- '+shFrom+' → 待查 '+shTo),()=>'- '+shFrom+' → '+shTo+'。已核博士阶段研究指导，正式论文共同导师称谓待核。 '+shLinks);
rewrite(pf(sh),x=>x.startsWith(boundary),()=>boundary+shPhd+' '+shPost+' '+shLinks);
cell(sh,2,'Ingolf Lindau（博士论文导师）；William E. Spicer（博士阶段研究师长）');
cell(sh,3,'本人访谈记博士毕业后做过博士后，任用日期与具名导师待核');
schoolWith(sh,shLinks);
const sha=audit(sh,[
 a('phd',shPhd,['shen','slac'],'confirmed_advisor'),
 a('postdoc',shPost,['shen','slac'],'unresolved')
],'核 Stanford 1989–1992 ECE 原年报和论文签署页。学位论文正式导师沿用 SSRL 的 Lindau，Spicer 按阶段研究师长。');
relation(sh,sha,'phd',sp,'stage_mentor',shPhd,ids('shen','slac'),'spicer');

const pan='ba89032c';
const panProof='UCI 工学院现行本人档明列 Materials Science and Engineering、Physics and Astronomy 教职和 Saarland 1991 博士，列氧化物异质结构、铁电和多铁材料及 4D-STEM。与 Michigan 早期任用档对应。';
schoolWith(pan,src(['UCI 工学院现行目录','pan']));
personLine(pan,boundary,' '+panProof+' '+src(['UCI 工学院现行目录','pan']));
audit(pan,[
 a('affiliation','UCI 材料科学与工程、物理与天文，IMRI 及 CCAM。',['pan'],'confirmed'),
 a('research',panProof,['pan'],'confirmed')
],'继续查 1991 Saarland 学位原件及 Stuttgart 1991–1996 博后任用，保留 Rühle 低可信候选。');

const pages=[
 [st,'stach','University of Virginia PhD 1998. Dissertation Advisor: Robert Hull. Co-advisor: Rudolf M. Tromp. NCEM Materials Staff Scientist 1998–2002.','本人 CV 第 2 页核博士导师和毕业后工作。'],
 [st,'viest','Robert D. Bent Professor of Engineering, Materials Science and Engineering. Director of LRSM. Materials characterization by electron, ion and x-ray microscopy.','核现任和研究方向。'],
 [st,'hull','Hull joined Rensselaer from the University of Virginia as head of Materials Science and Engineering.','核博士导师身份。'],
 [st,'tromp','Rudolf Tromp, IBM and Leiden University, surfaces and materials physics.','核共同导师身份。'],
 [qi,'innovation','Contemporary article states Qijie Wang was completing his NTU EEE doctorate under the guidance of Yeng Chai Soh and Ying Zhang of SIMTech.','核博士阶段两位具名研究指导者。'],
 [qi,'ies','IES 2005 project release lists Zhang Ying, Soh Yeng Chai and Wang Qijie, and identifies Zhang and Soh as project leaders.','独立核身份、单位及项目角色。'],
 [qi,'ntu2005','Ying Zhang (SIMTech), Qijie Wang and Yeng Chai Soh (NTU EEE) coauthored the 2005 optical lattice filtering paper.','核单位与博士研究项目。'],
 [qi,'ntu2006','March 2006 OFC proceedings identify Wang and Soh at NTU and Zhang at SIMTech on the fiber interleaving filter project.','核博士后当期合作，用于候选追查。'],
 [fu,'fuller','Ph.D. February 1980. Visiting Scientist in Strasbourg February–September 1980. Stanford Chemical Engineering Assistant Professor since October 1980.','核博士后时段准确的访问职衔。'],
 [fu,'leal','Caltech advisor index lists Fuller, Gerald Gendall, 1980, under L. Gary Leal.','复核既有博士关系。'],
 [fo,'chem','UConn Chemistry Professor. Postdoctoral Fellow, AT&T Bell Laboratories 1992–1994. PhD, University of Massachusetts Amherst.','补博后任期，核院系和研究。'],
 [fo,'acs','1992 Macromolecules article lists Fotios Papadimitrakopoulos, Shaw L. Hsu, and William J. MacKnight.','博士候选原刊追查。'],
 [fo,'acs2','The second 1992 article lists Papadimitrakopoulos, Eiji Sawa, and MacKnight.','博士候选原刊追查。'],
 [p,'hkust','Patrick A. Lee obtained MIT PhD 1970, taught at Yale 1970–1972, and worked at Bell Labs 1972–1982.','区分 Yale 任教和 Bell Labs。'],
 [sh,'shen','Interview describes Ingolf Lindau and William Spicer jointly guiding doctoral research at Stanford, and subsequent postdoctoral work after the doctorate.','核博士阶段研究指导及本人博后线索。'],
 [sh,'slac','Ph.D. in applied physics at Stanford, 1989. Professor of Physics and Applied Physics; ARPES and quantum materials.','核身份、院系及研究方向。'],
 [pan,'pan','Ph.D. Universität des Saarlandes, 1991. Professor of Materials Science and Engineering and Physics and Astronomy, IMRI and CCAM.','核现任、学位学校及研究方向。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:fu,url:'https://resolver.caltech.edu/CaltechETD%3Aetd-12112006-152815',error:'Failed to fetch https://resolver.caltech.edu/CaltechETD%3Aetd-12112006-152815: Cache miss'});
pages.push({record_id:sh,url:'https://alumni.fudan.edu.cn/_upload/article/files/7d/6c/b0d8e9f04f8b98f8d6892166d8f1/06a709fc-d0e7-4f09-9338-c7a6aa971dff.pdf',error:'(400) Content length is too large: 13362961'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_1027_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_1027_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_1027_PennStanford与NTU原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);

const xf='20261111_1027_Syracuse同名排除.json';
persist(xf,exclusions);
call('人物网页身份纠偏.cjs',[xf]);
call('检索流程.cjs',['report']);
