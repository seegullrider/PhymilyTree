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
 orig.audit_id='pi_archive_20261110_2251_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2251_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"mj25":"https://physics.media.uconn.edu/wp-content/uploads/sites/2234/2017/10/MJain_CV-full-April-2025xphysics-online.pdf","mj15":"https://physics.uconn.edu/wp-content/uploads/sites/2234/2017/10/Jain-CV-2015.pdf","upr":"https://natsci.uprrp.edu/speclab/people/","uprcat":"https://bcn.uprrp.edu/SubjectsPlus20_tesis/subjects/guide.php?subject=fisi","jia":"https://www.buffalo.edu/content/dam/engineering/materials-design-innovation/faculty/cv/Cv_Jia_2023.pdf","fp":"https://www.iceht.forth.gr/wp-content/uploads/rd/abstracts/20050113_abstract.pdf","fu":"https://materials-science.institute.uconn.edu/person/fotios-papadimitrakopoulos/","al":"https://www.umass.edu/polymer-science/alumni/phd_alumni_list","um":"https://www.umass.edu/polymer-science/about/history/history-polymers-umass","mk":"https://academictree-staging.thetransmitter.org/chemistry/inst.php?locid=4151","facs":"https://pubs.acs.org/doi/10.1021/ma00044a032","qpdf":"https://dr.ntu.edu.sg/server/api/core/bitstreams/91229561-9394-4d62-9777-cb6d89f834ce/content","qhar":"https://seas.harvard.edu/news/scientists-demonstrate-laser-controlled-polarization","q25":"https://polysense.poliba.it/wp-content/uploads/2025/11/Benzene-Lites.pdf","guog":"https://sites.google.com/view/guoqingchang/people","guop":"https://www.princeton.edu/news/2015/07/16/after-85-year-search-massless-particle-promise-next-generation-electronics","guopo":"https://www.princeton.edu/news/2019/03/20/princeton-scientists-discover-chiral-crystals-exhibiting-exotic-quantum-effects","hsin":"https://www.physics.nus.edu.sg/about-us/a-brief-history/","named":"https://ultralaser.iphy.ac.cn/news_detail.php?id=24614","xia":"https://chemistry-europe.onlinelibrary.wiley.com/doi/10.1002/chem.201805675","xiaj":"https://www.bme.jhu.edu/people/faculty/younan-xia/","xiab":"https://bdp.jhu.edu/bd-professors/younan-xia/","tut":"https://icqm.pku.edu.cn/docs/20181112152824832833.pdf","tut2":"https://utaustinportugal.org/2023-annual-conference/","ily":"https://superconductivity.biu.ac.il/node/412","ilyth":"https://archive-superconductivity.biu.ac.il/files/superconductivity/thesis_ilya_sochnikov_15may2011_final.pdf"};
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


const ids=(...keys)=>keys.map(key=>u[key]);
const [m,f,q,g,xj,xg,t,i]=['e3da7893','bb8689dc','bc70814b','6c493ec5','4a546812','f2cf867c','4abf014b','b3036a40'];
const mName='Menka Jain',fName='Fotios Papadimitrakopoulos',gName='Guoqing Chang';
const k='师承人物 - Ram S. Katiyar',jia='师承人物 - Quanxi Jia',mack='师承人物 - William J. MacKnight',lin='师承人物 - Hsin Lin';
function replaceBounds(id,body,links){
 rewrite(pf(id),row=>row.startsWith(boundary),()=>boundary+body+' '+links);
}
function fillAspect(id,kind,text,sources,status){
 return a(kind,text,sources,status);
}
const mL=src(['2025 本人 CV 指导人栏','mj25'],['2015 本人 CV 指导人栏','mj15'],['UPR 原课题组档','upr']);
const mPhd='UConn 托管 2015 与 2025 两版本人 CV 的 Graduate and Postdoctoral Advisors 栏均列 R. S. Katiyar 同为博士和博后导师，履历列 UPR 2004 化学物理博士。可信度高。';
const mPost='两版本人 CV 均具名 R. S. Katiyar 为 UPR 2004 年 8–12 月博士后导师，与博士指导分列。可信度高。';
const mJia='两版本人 CV 均具名 Q. X. Jia 为 LANL 博士后导师，时间 2005 年 4 月至 2008 年 4 月。Buffalo 本人 CV 核 Quanxi Jia 当时任 LANL Superconductivity Technology Center Team Leader。可信度高。';
const jL=src(['2025 本人 CV','mj25'],['2015 本人 CV','mj15'],['Quanxi Jia 本人 CV','jia']);
updateEdge(m,mName,k,'Ram S. Katiyar','博士候选关系','博士候选研究者','博士导师','博士生',mPhd,mL);
updateEdge(m,mName,k,'Ram S. Katiyar','博士后候选关系','博士后候选研究者','博士后导师','博士后研究者',mPost,mL);
edge(m,mName,jia,'Quanxi Jia','博士后导师','博士后研究者',mJia,jL);
replaceBounds(m,'两版本人 CV 现已直接核读。已分列 2004 年 UPR 博士、2004 年 8–12 月 UPR 博后与 2005 年 4 月至 2008 年 4 月 LANL 博后，并核对本人 UConn 物理及材料研究所任职和多铁薄膜研究。UPR 论文馆藏可作为补充来源。',mL+' · '+jL);
cell(m,2,'Ram S. Katiyar（UPR 2004 博士导师）');
cell(m,3,'Ram S. Katiyar（UPR 2004 年 8–12 月博士后导师）、Quanxi Jia（LANL 2005 年 4 月至 2008 年 4 月博士后导师）');
cell(m,4,src(['UConn 本人 2025 CV','mj25'],['UConn 本人 2015 CV','mj15'],['UPR 课题组原档','upr'],['Jia 本人 CV','jia'])+'。两版 CV 的导师栏和履历分别列三段。');
const mEvt=audit(m,[a('phd',mPhd,['mj25','mj15','upr'],'confirmed_advisor'),a('postdoc',mPost+' '+mJia,['mj25','mj15','jia'],'confirmed_advisor'),a('affiliation','本人 CV 核 UConn Physics、Institute of Materials Science。',['mj25','mj15']),a('research','本人 CV 核多铁性、铁电性和功能氧化物薄膜。',['mj25','mj15'])],'已核两阶段指导与院系方向；若取得 UPR 论文馆藏，可补论文签署页。');
audits.at(-1).followup_required=false;
relation(m,mEvt,'phd',k,'advisor',mPhd,ids('mj25','mj15','upr'),'KatiyarPhD');
relation(m,mEvt,'postdoc',k,'advisor',mPost,ids('mj25','mj15','upr'),'KatiyarPostdoc');
relation(m,mEvt,'postdoc',jia,'advisor',mJia,ids('mj25','mj15','jia'),'Jia');
const fD='FORTH 2005 讲者履历列 1987 Athens 学士、1989 UMass Amherst 硕士、1993 UMass Amherst 博士。UMass 校友名单把名字归于 1987 栏，栏目年份含义及正式授位日期待馆藏。Academic Tree 列 MacKnight，UMass 本人院史核其同系任教，1992 年论文书目只佐证研究交集，导师列低可信候选。';
const fP='FORTH 2005 讲者履历明确在 AT&T Bell Laboratories 从事两年光电子聚合物和发光二极管博后，又列 1994 年任 UConn 助理教授。履历的博士年份与两年长度不够推出起讫年份，保留期限，具体任用日期及导师待核。';
const fL=src(['FORTH 讲者履历','fp'],['UConn 材料研究所','fu'],['UMass 校友名册','al'],['UMass 院史','um'],['师承候选出处','mk']);
mentor(mack,'William J. MacKnight','曾任 UMass Amherst Polymer Science and Engineering 主任。',src(['本人撰写 UMass 院史','um']));
edge(f,fName,mack,'William J. MacKnight','博士导师候选','博士候选研究者',fD,fL);
const bell='机构 - Bell Laboratories';
insertAfter(pf(f),'## 师承','\n- 博士后经历：'+wiki(bell,'AT&T Bell Laboratories')+'。'+fP+' '+src(['FORTH 讲者履历','fp']));
insertAfter(path.join(root,'院校与机构',bell+'.md'),'## 博士后经历','\n- '+who(f,fName)+'。'+fP+' '+src(['FORTH 讲者履历','fp']));
replaceBounds(f,fD+' '+fP,fL);
cell(f,2,'William J. MacKnight（低可信候选）；1993 学位年份据 FORTH，UMass 校友表栏目口径待核');
cell(f,3,'AT&T Bell Laboratories 两年博士后；任期及导师待核');
schoolWith(f,fL);
const fEvt=audit(f,[a('phd',fD,['fp','al','um','mk'],'group_or_candidate'),a('postdoc',fP,['fp']),a('affiliation','UConn Chemistry、Institute of Materials Science 原档核实。',['fu','fp']),a('research','UConn 原档核单壁碳纳米管、半导体纳米晶、光子晶体与自组装。',['fu'])],'追 UMass 纸本论文、MacKnight 的博士生档案和 Bell Labs 博后任用原件。');
relation(f,fEvt,'phd',mack,'candidate',fD,ids('fp','um','mk'),'MacKnight');
const qD='DR-NTU 托管本人合著期刊的作者履历列 2005 NTU 电气与电子工程博士，研究阶段导师待学位原件。';
const qP='同页列 2005 NTU Singapore Millennium Foundation Post-Doctoral Fellowship 及后来 Harvard SEAS 任用；Harvard 2009 院系原新闻明确其为博后，并列与 Capasso 同一激光项目。Capasso 保留课题组负责人，NTU 段与 Harvard 段个人指导待任用原件。';
const qL=src(['DR-NTU 托管本人作者履历','qpdf'],['Harvard SEAS 同期原档','qhar']);
pl(q,boundary,qD+' '+qP+' '+qL);
cell(q,2,'NTU 2005 电气与电子工程博士；导师待核');
cell(q,3,'NTU 2005 SMF 博后，导师待核；Harvard Federico Capasso（博士后课题组负责人）');
schoolWith(q,qL);
audit(q,[a('phd',qD,['qpdf']),a('postdoc',qP,['qpdf','qhar'])],'以 NTU SMF fellowship 名录及电气工程学位文件追具名导师，复核 Harvard 接收指导档。');
const gD='本人组页列 2014–2017 NUS 物理博士，Princeton 2015 原报道将 Chang 与 Hsin Lin 同列 NUS 拓扑物态项目，NUS 物理系原史核 Hsin Lin 自 2013 年任职。只作为 NUS 博士导师候选，可信度低。';
const gP='本人组页明确 2018 年 6 月至 2020 年 9 月为 Princeton 博后，2019 Princeton 原报道独立确认博士后研究员身份。Hasan 维持既有课题组标签。中国科学院同英文名的超快激光学者为 Michigan 博士，身份分开。';
const gL=src(['本人课题组','guog'],['Princeton 2015 同期原报道','guop'],['NUS 物理系史','hsin']);
const gPL=src(['Princeton 2019 博后原报道','guopo'],['本人组页','guog'],['中科院超快激光同名者','named']);
mentor(lin,'Hsin Lin','曾任 NUS 物理系教员，研究拓扑材料。',src(['NUS 物理系史','hsin']));
edge(g,gName,lin,'Hsin Lin','博士导师候选','博士候选研究者',gD,gL);
pl(g,boundary,gD+' '+gP+' '+gL+' · '+gPL);
cell(g,2,'Hsin Lin（NUS 博士导师低可信候选）；2017／2018 授位年待馆藏');
schoolWith(g,gL+' · '+gPL);
const gEvt=audit(g,[a('phd',gD,['guog','guop','hsin'],'group_or_candidate'),a('postdoc',gP,['guog','guopo','named']),a('identity','本人组履历、Princeton 同期博后新闻和中科院超快激光同名者履历分别核对。',['guog','guopo','named'])],'按 NUS 学位档和导师项目名录查签署人，继续核 Princeton 博后个人指导。');
relation(g,gEvt,'phd',lin,'candidate',gD,ids('guog','guop','hsin'),'Lin');
const xD='2019 年本人署名回忆的 Education 行列 1993–1996 Harvard 博士、论文题名 Micro- and Nanofabrication Based on Microcontact Printing and Replica Molding 及 George M. Whitesides；JHU BME 人物档独立核实。';
const xP='同一回忆明确列 Harvard 1996 年 8 月至 1997 年 7 月为 Postdoctoral Fellow 并具名 George M. Whitesides。既有论文作者简介另列 Mara Prentiss 同期指导，分别按博士后阶段研究师长。二人各自正式 appointment advisor 字段待核。';
const xL=src(['本人署名回忆及履历表','xia'],['JHU BME','xiaj'],['JHU Bloomberg 讲席','xiab']);
const w='师承人物 - George M. Whitesides';
for(const [id,fLabel,bLabel] of [[xj,'博士后研究师长','博士后研究合作者'],[xg,'博士后阶段研究师长','博士后阶段研究者']]){
 const name=records.get(id).filename.replace(/^人员 - (Johns Hopkins|Georgia Tech) - /,'').replace(/ - [a-f0-9]{8}$/,'');
 const link=who(id,name);
 pl(id,boundary,xD+' '+xP+' '+xL);
 line(pf(id),row=>row.startsWith('- '+fLabel+'：')&&row.includes(w),' '+xP+' '+xL);
 line(mf(w),row=>row.startsWith('- '+bLabel+'：')&&row.includes(records.get(id).filename),' '+xP+' '+xL);
 line(index,row=>row.startsWith('- '+link+' → '+fLabel+'：')&&row.includes(w),' '+xP+' '+xL);
 schoolWith(id,xL);
 const e=audit(id,[a('phd',xD,['xia','xiaj'],'confirmed_advisor'),a('postdoc',xP,['xia','xiaj'],'group_or_candidate'),a('affiliation','JHU Bloomberg 讲席原页核 2026 从 Georgia Tech 转至 JHU，材料科学与工程及生物医学工程双聘。',['xiab','xiaj']),a('research','纳米材料合成、结构表征、等离激元和催化。',['xiab','xiaj'])],'已直接核到本人博后日期与 Whitesides；追 Harvard 任用档中的正式指导职衔与 Prentiss 的分工。');
 relation(id,e,'phd',w,'advisor',xD,ids('xia','xiaj'),'XiaPhD');
 relation(id,e,'postdoc',w,'stage_mentor',xP,ids('xia','xiaj'),'XiaPostdoc');
}
const tN='北大所存 PDF 实为 Peking University 的 Yang Liu 履历，列其 Princeton 2008–2014 电气工程博士和后续 Stanford 博后。UT 原会务履历列 Tutuc 的 Princeton 2004 物理博士。已排除该 PDF 作为 Tutuc 证据，其 Shayegan 组属及候选边按已核来源保留。';
const tL=src(['误配 PDF（Yang Liu）','tut'],['UT Austin Portugal Tutuc 履历','tut2']);
pl(t,boundary,tN+' '+tL);
schoolWith(t,tL);
const tEvent=audit(t,[a('identity',tN,['tut','tut2'])],'按 2004 Princeton 物理学位档追 Tutuc 原论文，另查 IBM 博后指导原档。');
const iN='Bar-Ilan 现行个人档明示博士论文题名 Superconducting Properties of La₂₋ₓSrₓCuO₄ nano-layers and nano-rings。其归档 PDF 本轮仍未取得正文，大学域名的本机解析失败，未读到指导字段。保留 2011／2012 年差异和既有 Stanford 博后课题组信息。';
pl(i,boundary,iN+' '+src(['Bar-Ilan 本人旧档','ily']));
audit(i,[a('phd',iN,['ily'])],'追 Bar-Ilan 纸本或正式馆藏条目，另查 Stanford 博后指导。');

const pages=[["m","mj25","Menka Jain  (https://physics.media.uconn.edu/wp-content/uploads/sites/2234/2017/10/MJain_CV-full-April-2025xphysics-online.pdf)\nciteturn41086view1 [wordlim: 200] Crawled: last year; Content type: application/pdf; Source: find({\"ref_id\":\"turn41085search16\",\"pattern\":\"Postdoctoral\"}); Total lines: 1364\nL0: Menka Jain\nL6: Professional Preparation:\nL7: 04/2005-04/2008\nL8: Director’s funded postdoctoral fellow, Superconductivity Technology Center,\nL9: Materials Physics and Applications Division, Los Alamos National Laboratory,\nL10: Los Alamos, NM\nL11: 08/2004-12/2004\nL12: Postdoctoral fellow, Dept. Physics, University of Puerto Rico, San Juan, PR (USA)\nL13: 2004\nL14: Ph.D., Chemical Physics, University of Puerto Rico, San Juan, PR (USA)\nL212: 15. Graduate and Postdoctoral Advisors:\nL213: Ph.D. and Postdoctoral\nL214: Dr. R.S. Katiyar, University of Puerto Rico, San Juan, PR\nL215: Postdoctoral\nL216: \nL217: Dr. Q.X. Jia, Los Alamos National Laboratory, Los Alamos, NM","Menka Jain 2025 CV 逐段列日期、UPR 导师 Katiyar 和 LANL 导师 Q. X. Jia。"],["m","mj15","Menka Jain  (https://physics.uconn.edu/wp-content/uploads/sites/2234/2017/10/Jain-CV-2015.pdf)\nciteturn41086view2 [wordlim: 200] Crawled: 2.2 years ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn41085search13\",\"pattern\":\"University of Puerto Rico\"}); Total lines: 1091\nL0: Menka Jain\nL7: Professional Preparation:\nL8: 04/2005-04/2008\nL9: Director’s funded postdoctoral fellow, Superconductivity Technology Center,\nL10: Materials Physics and Applications Division, Los Alamos National Laboratory, Los\nL11: Alamos, NM\nL12: 08/2004-12/2004\nL13: Postdoctoral fellow, Dept. Physics, University of Puerto Rico, San Juan, PR (USA)\nL14: 2004\nL15: Ph.D., Chemical Physics, University of Puerto Rico, San Juan, PR (USA)\nL217: Graduate and Postdoctoral Advisors:\nL218: Ph.D. and Postdoctoral\nL219: Dr. R.S. Katiyar, University of Puerto Rico, San Juan, PR\nL220: Postdoctoral\nL221: Dr. Q.X. Jia, Los Alamos National Laboratory, Los Alamos, NM","Menka Jain 2015 CV 具名相同的三段关系。"],["m","jia","Quanxi JIA  (https://www.buffalo.edu/content/dam/engineering/materials-design-innovation/faculty/cv/Cv_Jia_2023.pdf)\nciteturn41089view2 [wordlim: 200] Crawled: 9 months ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn41088search12\",\"pattern\":\"Team Leader\"}); Total lines: 142\nL29: PROFESSIONAL EXPERIENCE\nL30: 11/2021 - present SUNY Distinguished Professor, University at Buffalo, Buffalo, NY\nL34: Materials Design & Innovation, University at Buffalo, Buffalo, NY\nL35: 02/2016 - 08/2016 Director of the Center for Integrated Nanotechnologies (CINT), Los Alamos\nL36: National Laboratory (LANL), Los Alamos, NM\nL37: 04/2015 - 02/2016 Co-Director of CINT, LANL, Los Alamos, NM\nL38: 04/2015 - 08/2016 Group Leader of MPA-CINT, Division of Materials Physics and Applications\nL39: (MPA), LANL, Los Alamos, NM\nL40: 06/2014 - 04/2015 Acting Co-Director of CINT, LANL, Los Alamos, NM\nL41: 03/2010 - 02/2023 Foreign Visiting Professor, Konkuk University, Seoul, Korea\nL42: 12/2009 - 06/2014 Thrust Leader, CINT, LANL, Los Alamos, NM\nL43: 09/2003 - 09/2017 Laboratory Fellow (currently, retired Fellow), LANL, Los Alamos, NM\nL44: 10/1997 - 12/2009 Team Leader, Superconductivity Technology Center, LANL, Los Alamos, NM","Jia 本人 2023 CV 核 LANL Superconductivity Technology Center 同期组长职务。"],["f","fp","ΙΔΡΥΜΑ ΤΕΧΝΟΛΟΓΙΑΣ ΚΑΙ ΕΡΕΥΝΑΣ  (https://www.iceht.forth.gr/wp-content/uploads/rd/abstracts/20050113_abstract.pdf)\nciteturn41074view0 [wordlim: 200] Crawled: 7 months ago; Content type: application/pdf; Source: open({\"ref_id\":\"turn41073view0\",\"lineno\":37}); Total lines: 48\nL36: two year postdoc at AT&T Bell Laboratories working on Optoelectronic Polymers and Light\nL37: Emitting Diodes, he joined the faculty of the University of Connecticut as an assistant professor of\nL38: Chemistry, at the Institute of Materials Science (IMS) (1994), and in 1999 was promoted to","FORTH 2005 讲座履历列 Fotios 的硕博年份和 AT&T Bell Labs 博后。"],["f","fu","Fotios Papadimitrakopoulos | Institute of Materials Science | University of Connecticut (https://materials-science.institute.uconn.edu/person/fotios-papadimitrakopoulos/)\nciteturn41088view2 [wordlim: 200] Crawled: last week; Content type: text/html; Source: open({\"ref_id\":\"turn41077search1\",\"lineno\":null}); Total lines: 188\nL145: ### Education\nL146: \nL147:   * Ph.D. in Polymer Science & Engineering University of Massachusetts, Amherst\nL148:   * M.S. in Polymer Science & Engineering University of Massachusetts, Amherst\nL149:   * B.S. with honors in Chemistry National University of Athens, Greece\nL151: ### Research Focus\nL152: \nL153:   * Single wall carbon nanotubes (SWNTs)\nL154:   * Semiconductor nanocrystals (NCs)\nL155:   * DNA-assisted solid freeform fabrication manufacture of photonic crystals\nL156:   * Totally implantable wireless glucose sensors","UConn 材料研究所原档核 UMass Amherst 学位及研究方向。"],["f","al","PhD Alumni List : Polymer Science and Engineering : UMass Amherst (https://www.umass.edu/polymer-science/alumni/phd_alumni_list)\nciteturn41083view1 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"turn41072search5\",\"pattern\":\"Fotios Papadimitrakopoulos\"}); Total lines: 399\nL246: ### 1987\nL251: Michele Mansfield Warren Nachlis Fotios Papadimitrakopoulos Bert Reekmans","UMass 博士校友表把此名放在 1987 栏，与讲者履历年份需分开解释。"],["f","um","The History of Polymers at UMass : Polymer Science and Engineering : UMass Amherst (https://www.umass.edu/polymer-science/about/history/history-polymers-umass)\nciteturn41093view1 [wordlim: 200] Crawled: today; Content type: text/html; Source: open({\"ref_id\":\"turn41091search2\",\"lineno\":null}); Total lines: 63\nL11: As the 50th anniversary of the PSE program approaches, we take the opportunity reflect on the evolution of polymer research and education at UMass through a series of retrospectives written by PSE faculty and alumni.  Prof. Bill MacKnight, who was there from the inception of the program and who served as department head for many years starting in 1976, authors the first in this series.  Here, he revisits the origins and early history of PSE.\nL18: by W. J. MacKnight\nL21: Beyond the establishment of a polymer research program, Richard Stein can be credited with starting the university’s computer center, and further, with reestablishing and modernizing the physical chemistry curriculum at UMass. In 1961, he established the Polymer Research Institute (PRI) at UMass (only the 2nd such entity in the US at that time), which was to be vital for consolidating polymer research efforts on campus for decades.\nL22: Immediately following the 1965 appointment of William MacKnight as Assistant Professor of Chemistry, Stein and MacKnight began to design a Polymer Science and Engineering Program. The program was approved in 1966 as an interdisciplinary effort with authority to confer M.S. and Ph.D. degrees. By the beginning of the fall semester of 1966, Roger Porter was in place as Head and sole faculty member of PSE. In the same year, Robert Lenz, an organic polymer chemist, was hired in Chemical Engineering.\nL23: These original four were united through their common interests in polymer research, and more formally, through their membership in the PRI. At that time, the first graduate students were admitted to the PSE program and the requirements for the Ph.D. were formalized. Critical elements of the curriculum were established at that time, notably the cumulative exam system, which remains in place to this very day.","MacKnight 本人 UMass 院史核其任教及学术单位。"],["q","qpdf"," (https://dr.ntu.edu.sg/server/api/core/bitstreams/91229561-9394-4d62-9777-cb6d89f834ce/content)\nciteturn41092view0 [wordlim: 200] Crawled: 2.3 years ago; Content type: application/pdf; Source: open({\"ref_id\":\"turn41083view2\",\"lineno\":1136}); Total lines: 1169\nL1129: Qijie Wang (M’10–SM’10) received the B.E. degree in\nL1130: electrical engineering from the University of Science and\nL1131: Technology of China, Hefei, China, in 2001, graduating one\nL1132: year in advance, and the Ph.D. degree in electrical and\nL1133: electronic engineering from Nanyang Technological\nL1134: University (NTU), Singapore, in 2005, with NTU and\nL1135: Singapore Millennium Foundation (SMF) scholarship.  He\nL1136: received the 2005 SMF Post-Doctoral Fellowship at NTU.","DR-NTU 作者简历分别列 2005 NTU 博士、NTU SMF 博后。"],["q","qhar","Scientists demonstrate laser with controlled polarization (https://seas.harvard.edu/news/scientists-demonstrate-laser-controlled-polarization)\nciteturn41083view3 [wordlim: 200] Crawled: 2 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"turn41078search5\",\"pattern\":\"Qijie Wang\"}); Total lines: 94\nL24: Spearheaded by graduate student Nanfang Yu (above right) and Federico Capasso (above left), Robert L. Wallace Professor of Applied Physics and Vinton Hayes Senior Research Fellow in Electrical Engineering, both of SEAS, and by a team at Hamamatsu Photonics headed by Dr. Hirofumi Kan, General Manager of the Laser Group, the findings will be published as a cover feature of the April 13 issue of Applied Physics Letters.\nL31: The team's co-authors are postdoctoral researcher Qijie Wang and research associates Christian Pflügl and Laurent Diehl (all from Harvard) and researchers Tadataka Edamura, Sninichi Furuta, and Masamichi Yamanishi (both from Hamamatsu Photonics).","Harvard SEAS 2009 原档核 Qijie Wang 博后及参与 Capasso 研究。"],["g","guog","G. CHANG's Group@NTU,SG - People (https://sites.google.com/view/guoqingchang/people)\nciteturn41093view2 [wordlim: 200] Crawled: 5 days ago; Content type: text/html; Source: open({\"ref_id\":\"turn41074view1\",\"lineno\":24}); Total lines: 120\nL22: Principal Investigator: Guoqing CHANG, NRF Fellow\nL24: 2020.10 – Present  Nanyang Assistant Professor, NTU\nL26: 2018.06 – 2020.09 Postdoctoral Research Associate, Princeton University\nL28: 2014.01 – 2017.10    Ph.D in Physics, National University of Singapore","常国庆本人实验室原页明确 NUS 博士及 Princeton 博后任期。"],["g","guop","After 85-year search, massless particle with promise for next-generation electronics discovered (https://www.princeton.edu/news/2015/07/16/after-85-year-search-massless-particle-promise-next-generation-electronics)\nciteturn41092view4 [wordlim: 200] Crawled: today; Content type: text/html; Source: open({\"ref_id\":\"turn41091search6\",\"lineno\":null}); Total lines: 241\nL62: Other co-authors were Chenglong Zhang, Zhujun Yuan and Shuang Jia from Peking University; Raman Sankar and Fangcheng Chou from National Taiwan University; Guoqing Chang, Chi-Cheng Lee, Shin-Ming Huang, BaoKai Wang and Hsin Lin from the National University of Singapore; Jie Ma from Oak Ridge National Laboratory; and Arun Bansil from Northeastern University. Wang is also affiliated with Northeastern University, and Jia is affiliated with the Collaborative Innovation Center of Quantum Matter in Beijing.","Princeton 2015 同期原报道同列 NUS 的 Chang 与 Hsin Lin。"],["g","guopo","Princeton scientists discover chiral crystals exhibiting exotic quantum effects (https://www.princeton.edu/news/2019/03/20/princeton-scientists-discover-chiral-crystals-exhibiting-exotic-quantum-effects)\nciteturn41091view0 [wordlim: 200] Crawled: 2 weeks ago; Content type: text/html; Source: open({\"ref_id\":\"turn41076search0\",\"lineno\":null}); Total lines: 243\nL56: “We expect this is the tip of the iceberg,” said fellow graduate student and co-first author 【18†Ilya Belopolski†phy.princeton.edu】. “There are so many chiral crystals in nature. It would be great to check how many of those are topological. This would be a fantastic playground for new types of quantum phenomena.”\nL60: “It is indeed immensely satisfying when you predict something exotic and it also appears in the laboratory experiments,” Hasan said. “This is not the first time we have succeeded in predicting topological effects in quantum physics. We successfully predicted some of the new bismuth-based topological insulators that are now among the mostly studied compounds in the field.”\nL61: \nL62: 【21†Image: Electron distribution along chiral crystals showing two diagonal arcs at top left and bottom right】\nL63: This video shows the fermi arc within topological chiral crystals, moving up and down through the crystal.\nL64: \nL65: He added, “We are combining theory and experiments to advance the knowledge frontier.”\nL66: The team included numerous researchers from Princeton’s Department of Physics, including present and past graduate students Daniel Sanchez, Ilya Belopolski, Tyler Cochran, Nasser Alidoust, Daniel Multer, 【22†Songtian Sonia Zhang†phy.princeton.edu】, 【23†Nana Shumiya†phy.princeton.edu】 and Suyang Xu, and present and past postdoctoral research associates 【24†Jia-Xin Yin†phy.princeton.edu】, Guoqing Chang and Weiwei Xie.\nL67: Other co-authors were Xitong Xu, Kaustuv Manna, Vicky Süß, Cheng-Yi Huang, Xirui Wang, Guang-Qiang Wang, Tay-Rong Chang, Claudia Felser, Shuang Jia and Hsin Lin.\nL68: The paper, “【25†Topological Chiral Crystals with Helicoid Arc Quantum States†www.nature.com】” appears in the March 20 issue of Nature. The work at Princeton was supported by the 【26†U.S. Department of Energy†www.energy.gov】’s Basic Energy Sciences Division (grant no. DE-FG-02-05ER462000) and the Gordon and Betty Moore Foundation’s Emergent Phenomena in Quantum Systems Initiative (grant no. GBMF4547)","Princeton 2019 研究报道核 Chang 的 Princeton 博后身份。"],["g","hsin","A Brief History | NUS Physics (https://www.physics.nus.edu.sg/about-us/a-brief-history/)\nciteturn41093view3 [wordlim: 200] Crawled: yesterday; Content type: text/html; Source: find({\"ref_id\":\"turn41092search0\",\"pattern\":\"Lin Hsin (2013)\"}); Total lines: 413\nL392: In 2010, NUS invested more than $40 million to set up a Graphene Research Centre (GRC), the first in Asia. Antonio Castro-Neto joined the department and became the Director of GRC. The centre was hosted in the Faculty of Science and operated through the Department of Physics. A number of new physicists were recruited, including NRF research fellows Goki Eda (2011), Shaffique Adam (2012), Slaven Garaj (2012), Quek Su Ying (2013), Lin Hsin (2013).","NUS 院系史核 Hsin Lin 2013 入职。"],["g","named","新闻详情 (https://ultralaser.iphy.ac.cn/news_detail.php?id=24614)\nciteturn41082view1 [wordlim: 200] Crawled: last month; Content type: text/html; Source: open({\"ref_id\":\"turn41074search1\",\"lineno\":null}); Total lines: 11\nL2: \nL3:    常国庆(Guoqing Chang)老师博士毕业于密歇根大学电子工程系，先后在密歇根大学和麻省理工从事博士后以及研究员工作。2012年获聘Helmholtz研究员，在德国自由电子激光科学中心创建了超快激光与相干成像实验室，并担任实验室主任，于2016年获得永久职位（Tenure）。常老师的主要研究方向包括高功率超快光纤激光器、飞秒激光频率梳、超快中红外激光技术以及超快生物光子学。\nL4:    在此热烈欢迎正式加入我们L07组！期望常老师在本组新的工作岗位上发挥更大的作用，进一步提升我组在相关研究领域的实验技术手段和学术水平。\nL5: \nL6: ﻿\nL7: \nL8: Copyright © 2014-2026 中国科学院物理研究所光物理重点实验室L07组\nL9: 地址: 北京市海淀区中关村南三街8号, 北京市603信箱136分箱, 邮编100190","中科院原档的超快激光 Guoqing Chang 是 Michigan 博士，和 NTU 同名者分开。"],["xj","xia","In My Element: Silver - Xia - 2019 - Chemistry – A European Journal - Wiley Online Library (https://chemistry-europe.onlinelibrary.wiley.com/doi/10.1002/chem.201805675)\nciteturn41092view2 [wordlim: 200] Crawled: last month; Content type: text/html; Source: open({\"ref_id\":\"turn41088view3\",\"lineno\":101}); Total lines: 220\nL101: Education  | B.S (University of Science and Technology of China, 9/1982 to 7/1987, Hefei, Anhui, P. R. China)M.S. (9/1991 to 5/1993, Alan G. MacDiarmid, University of Pennsylvania, Philadelphia, PA, USA)Ph.D. (9/1993 to 8/1996, George M. Whitesides, Micro- and Nanofabrication Based on Microcontact Printing and Replica Molding, Harvard University, Cambridge, MA, USA)Postdoctoral Fellow (8/1996 to 7/1997, George M. Whitesides, Harvard University, Cambridge, MA, USA)","Younan Xia 本人署名回忆的学位和 Harvard 博后条目均列 Whitesides。"],["xg","xia","In My Element: Silver - Xia - 2019 - Chemistry – A European Journal - Wiley Online Library (https://chemistry-europe.onlinelibrary.wiley.com/doi/10.1002/chem.201805675)\nciteturn41092view2 [wordlim: 200] Crawled: last month; Content type: text/html; Source: open({\"ref_id\":\"turn41088view3\",\"lineno\":101}); Total lines: 220\nL101: Education  | B.S (University of Science and Technology of China, 9/1982 to 7/1987, Hefei, Anhui, P. R. China)M.S. (9/1991 to 5/1993, Alan G. MacDiarmid, University of Pennsylvania, Philadelphia, PA, USA)Ph.D. (9/1993 to 8/1996, George M. Whitesides, Micro- and Nanofabrication Based on Microcontact Printing and Replica Molding, Harvard University, Cambridge, MA, USA)Postdoctoral Fellow (8/1996 to 7/1997, George M. Whitesides, Harvard University, Cambridge, MA, USA)","Georgia Tech 历史记录同人，本人自述 Harvard 博后起讫年月及 Whitesides。"],["xj","xiaj","Younan Xia - Johns Hopkins Biomedical Engineering (https://www.bme.jhu.edu/people/faculty/younan-xia/)\nciteturn41089view3 [wordlim: 200] Crawled: 4 days ago; Content type: text/html; Source: find({\"ref_id\":\"turn41088view0\",\"pattern\":\"Whitesides\"}); Total lines: 201\nL100: Ross 726\nL101: \nL102: Research Interests\nL103: ## Research Interests\nL104: Dr. Younan Xia is a Bloomberg Distinguished Professor at Johns Hopkins University, with equally-split appointments in the Department of Materials Science and Engineering and the Department of Biomedical Engineering. He received a B.S. degree in chemical physics from the University of Science and Technology of China (USTC) in 1987, M.S. degree in chemistry from University of Pennsylvania (with Alan G. MacDiarmid) in 1993, and Ph.D. degree in physical chemistry from Harvard University (with George M.\nL105: Whitesides) in 1996.\nL106: His group invented numerous nanomaterials with well-controlled properties for use in applications related to plasmonics, electronics, display, catalysis, energy conversion, controlled release, drug delivery, nanomedicine, and regenerative medicine. Notably, the silver nanowires invented by his group were commercialized for the manufacturing of flexible, transparent, and conductive coatings key to applications such as touchscreen display, flexible electronics, and photovoltaics.\nL107: His technology on the alignment of electrospun nanofibers was commercially used for multiple clinical products in regenerative medicine, including those for the management of surgical and trauma wounds.\nL108: Xia has co-authored over 900 publications in peer-reviewed journals, together with a total citation of about 220,000 and an h-index of 223. He has been named a Top 10 Chemist and Materials Scientist based on the citation data. He has received many prestigious awards, including the Linus Pauling Medal (2024), ACS Award for Creative Invention (2023), MRS Medal (2017), ACS Award in the Chemistry of Materials (2013), NIH Director’s Pioneer Award (2006), and NSF CAREER Award (2000).","JHU BME 官方履历核 Younan Xia 博士和现聘。"],["i","ily","Sochnikov Ilya | Institute of Superconductivity (https://superconductivity.biu.ac.il/node/412)\nciteturn41080view1 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"turn41079view0\",\"pattern\":\"Dissertation\"}); Total lines: 181\nL166: Dissertation\nL167: \nL168: 【16† Superconducting Properties of La2−xSrxCuO4 nano-layers and nano-rings†archive-superconductivity.biu.ac.il】","Bar-Ilan 个人档直接列论文题名并连接旧 PDF。"]].map(([id,key,raw,excerpt])=>({record_id:({m,f,q,g,xj,xg,t,i})[id],url:u[key],raw,excerpt}));
pages.push(
 {record_id:m,url:u.uprcat,error:'UPR subject thesis inventory timed out; both actual UConn-hosted personal CVs were reviewed.'},
 {record_id:f,url:u.facs,error:'ACS 403; formal PhD supervisor remains unverified.'},
 {record_id:i,url:u.ilyth,error:'Archive PDF cache miss and DNS could not resolve Bar-Ilan archive host. Current author page provided the thesis title.'}
);
const exclusions=[{page_id:'029931c2a6dbed45eadf0a6a',record_id:t,audit_id:tEvent,url:u.tut,external_subject:'Yang Liu（Peking University 量子输运研究者）',evidence:tN}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length,exclusions:exclusions.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2251_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2251_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const ex='20261110_2251_Tutuc网页归属纠偏.json';
persist(ex,exclusions);
call('人物网页身份纠偏.cjs',[ex]);
const receipt='20261110_2251_UConn与NTU院系及本人履历网页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
