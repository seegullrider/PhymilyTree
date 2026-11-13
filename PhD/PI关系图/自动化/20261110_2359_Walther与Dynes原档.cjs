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
 orig.audit_id='pi_archive_20261110_2359_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2359_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"kcv":"https://www.rle.mit.edu/cua_pub/ketterle_group/group_info/WK/CV%20WK.pdf","kn":"https://www.rle.mit.edu/cua_pub/ketterle_group_old/Projects_2002/Pubs_02/kett02_Nobel_autobiography.pdf","km":"https://physics.mit.edu/faculty/wolfgang-ketterle/","kt":"https://www.mpq.mpg.de/7120914/MPQ-Reports","kpdf":"https://www.mpq.mpg.de/7107199/MPQ---116.pdf","kd":"https://www.weltderphysik.de/gebiet/teilchen/atome-und-molekuele/das-quantenorchester/","kho":"https://www.uni-heidelberg.de/presse/unispiegel/us04_5/eis.html","kh":"https://www.uni-heidelberg.de/de/newsroom/festkolloquium-fuer-juergen-wolfrum","ktu":"https://www.community.tum.de/en/wolfgang-ketterle/","ki":"https://infinite.mit.edu/video/wolfgang-ketterle/","xp":"https://quantum.fsu.edu/people/faculty/highlights/peng-xiong","xl":"https://www.xionglabfsu.com/people","xa":"https://www.linkedin.com/pulse/real-life-interferes-with-neuroimaging-news-stephen-applebaum-yajcc","xr":"https://journals.aps.org/prb/abstract/10.1103/PhysRevB.52.3795","xcv":"https://docs.google.com/document/d/1I2eYS1l-V8HUhyJTYpPL3ghhVg9kWV3O/export?format=txt","xb":"https://library.brown.edu/theses/theses.php?task=search&author=Xiong%2C+Peng&advisor=&keyword=","gx":"https://sites.brown.edu/xiaolab/people-2-2/","d":"https://today.ucsd.edu/story/in-memoriam-robert-c-dynes","da":"https://meetings-archive.aps.org/mar/2005/p7/1/","dt":"https://macsphere.mcmaster.ca/handle/11375/17619","dpdf":"https://macsphere.mcmaster.ca/bitstreams/d18b3917-e89c-43ff-bb09-d056517094cf/download","ss":"https://www.rfsuny.org/media/rfsuny/documents/Program-Book.pdf","se":"https://www.stonybrook.edu/electrical/research/semiconductors.html","sg":"https://ehs.stonybrook.edu/commcms/electrical/graduate/_program_guide/guide_fall_2020_v2.pdf","si":"https://new.ras.ru/staff/chlen-korrespondent-ran/kopev-petr-sergeevich/","sk":"https://www.fkf.mpg.de/342979/Prof_Klaus_von_Klitzing","sal":"https://www.ioffe.ru/qslab/beam/history.php?lng=en","sr":"https://www.fizmathim.com/submillimetrovaya-spektroskopiya-dvumernyh-poluprovodnikovyh-struktur-v-silnom-magnitnom-pole","sm":"https://www.dissercat.com/content/submillimetrovaya-spektroskopiya-dvumernykh-poluprovodnikovykh-struktur-v-silnom-magnitnom-p","fp":"https://www.pnnl.gov/news-media/kai-mei-fu-joins-pnnl-dual-appointee","fe":"https://people.ece.uw.edu/fu_kaimei/","fu":"https://phys.washington.edu/people/kai-mei-fu"};
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

const [k,x,d,s,f]=['c6a09de1','58476f36','dcc17369','f0d195d4','41c97d5c'];
const kn='Wolfgang Ketterle',wal='师承人物 - Herbert Walther',fig='师承人物 - Hartmut Figger',pri='师承人物 - David E. Pritchard',wol='师承人物 - Jürgen Wolfrum';
const kd='本人 MIT CV 在 1986 年 Ludwig-Maximilians-Universität München 与 MPQ 的最终博士论文条目明列 Prof. H. Walther；MaxPlanckForschung 同期报道明确称 Herbert Walther 为 Doktorvater。MPQ-116 核题名。关系类型可信度高。';
const kl=src(['本人 MIT CV 教育栏','kcv'],['MaxPlanckForschung 转载原文','kd'],['MPQ-116 目录','kt'],['本人 Nobel 自传','kn']);
updateEdge(k,kn,wal,'Herbert Walther','博士阶段研究师长','博士阶段研究者','博士导师','博士生',kd,kl);
const kf='本人 Nobel 自传明确 Hartmut Figger 与 Herbert Walther 指导博士初期的半导体痕量分析项目。其后在同组改做分子光谱，最终论文的本人 CV 单列 Walther。Figger 保留博士初期研究师长，关系类型可信度高。';
const kfl=src(['本人 Nobel 自传','kn'],['本人 MIT CV','kcv']);
updateEdge(k,kn,fig,'Hartmut Figger','博士阶段研究师长','博士阶段研究者','博士阶段研究师长','博士阶段研究者',kf,kfl);
const kg='本人 CV 在 MPQ 1982–1988 任用条目标 Herbert Walther，区分 1982–1985 Research Assistant 与 1985–1988 Staff Scientist。本人 Nobel 自传把 1986 年获博士之后继续留 MPQ 的分子光谱阶段明确称 postdoc。记录该段课题组归属。';
const kgl=src(['本人 MIT CV 任用栏','kcv'],['本人 Nobel 自传','kn'],['MIT 物理系','km']);
edge(k,kn,wal,'Herbert Walther','博士后课题组负责人','博士后课题组成员',kg,kgl);
const kh='本人 CV 列 Heidelberg 1989–1990 Research Scientist（J. Wolfrum），本人自传明说加入该组，Heidelberg 原档称截至 1990 年为 Post-Doktorand，2019 年校方活动称 Ketterle 为 Wolfrum 的学生。列博后阶段研究师长，正式个人 advisor 职衔待核。';
const khl=src(['本人 MIT CV','kcv'],['本人 Nobel 自传','kn'],['Heidelberg 博后报道','kho'],['Heidelberg Wolfrum 原档','kh']);
mentor(wol,'Jürgen Wolfrum','Heidelberg 物理化学研究所教授，研究激光化学与光谱。',src(['Heidelberg 本人机构档','kh']));
edge(k,kn,wol,'Jürgen Wolfrum','博士后阶段研究师长','博士后阶段研究者',kh,khl);
const kp='本人 CV 具名列 MIT 1990–1993 Research Associate（D. E. Pritchard），并另列 1990–1991 NATO/DAAD Postdoctoral Fellowship。MIT 物理系称 1990 年以博后身份赴 MIT，TUM 与本人访谈均支持在 Pritchard 组，保留阶段研究师长；正式 advisor 职衔待查。';
const kpl=src(['本人 MIT CV','kcv'],['MIT 物理系','km'],['TUM 原校友档','ktu'],['MIT 本人访谈','ki']);
updateEdge(k,kn,pri,'David E. Pritchard','博士后阶段研究师长','博士后阶段研究者','博士后阶段研究师长','博士后阶段研究者',kp,kpl);
rewrite(pf(k),row=>row.startsWith(boundary),()=>boundary+' 博士论文 Herbert Walther，博士初期 Hartmut Figger。毕业后分 MPQ、Heidelberg、MIT 三段，原机构称博后，本人 CV 任用头衔分别为 Staff Scientist、Research Scientist、Research Associate。正式博后个人指导字段待核。 '+kgl+' · '+src(['Heidelberg 原任用报道','kho'],['TUM 任用履历','ktu']));
pl(k,'- 研究方向：','MIT 物理系原档另列超冷原子物质、超流体、自旋和分子，附属 MIT–Harvard 超冷原子中心及 RLE。 '+src(['MIT 物理系','km']));
cell(k,2,'Herbert Walther（1986 最终博士论文导师）；Hartmut Figger（初期项目研究师长）');
cell(k,3,'MPQ Herbert Walther（博士后课题组负责人）、Heidelberg Jürgen Wolfrum 和 MIT David E. Pritchard（博后阶段研究师长）');
schoolWith(k,kl+' · '+src(['Heidelberg 博后报道','kho'],['Heidelberg Wolfrum 原档','kh'],['TUM 校友档','ktu']));
const ka=audit(k,[a('phd',kd+' '+kf,['kcv','kd','kt','kn'],'confirmed_advisor'),a('postdoc',kg+' '+kh+' '+kp,['kcv','kn','km','kho','kh','ktu','ki'],'group_or_candidate'),a('affiliation','MIT 物理系 MacArthur 讲席、RLE 与 MIT–Harvard Center for Ultracold Atoms。',['km']),a('research','超冷原子物质、玻色凝聚、超流体、自旋物理与超冷分子。',['km'])],'追三段博后的个人聘任或明确导师字段。');
relation(k,ka,'phd',wal,'advisor',kd,ids('kcv','kd','kt','kn'),'WaltherPhD');
relation(k,ka,'phd',fig,'stage_mentor',kf,ids('kn','kcv'),'Figger');
relation(k,ka,'postdoc',wal,'group_leader',kg,ids('kcv','kn','km'),'WaltherPostdoc');
relation(k,ka,'postdoc',wol,'stage_mentor',kh,ids('kcv','kn','kho','kh'),'Wolfrum');
relation(k,ka,'postdoc',pri,'stage_mentor',kp,ids('kcv','km','ktu','ki'),'Pritchard');

const xn='Peng Xiong',dyn=records.get(d).filename,oldDyn='师承人物 - Robert C. Dynes';
const xp='本人 FSU 访谈及课题组履历列 UCSD Physics 1993–1997 Postdoctoral Scholar。Dynes 组同期研究生 Stephen Applebaum 的第一手回忆把 Peng Xiong 列为组内博后，1995 年 APS 原论文核 Xiong、Dynes 与同组 Herzog 同署 UCSD 物理系。记录课题组负责人，个人指导职衔待核。';
const xl=src(['FSU 本人访谈','xp'],['本人组页','xl'],['同期组员回忆','xa'],['APS 1995 原刊','xr']);
edge(x,xn,dyn,'Robert C. Dynes','博士后课题组负责人','博士后课题组成员',xp,xl);
pl(x,boundary,xp+' '+xl);
cell(x,3,'Robert C. Dynes（UC San Diego 1993–1997 博士后课题组负责人）；正式个人指导待核');
schoolWith(x,xl);
const xa=audit(x,[a('postdoc',xp,['xp','xl','xa','xr'],'group_or_candidate'),a('affiliation','Florida State 物理系杰出研究教授；保留既有 MagLab 机构关系。',['xp','xl']),a('research','低维材料和纳米结构凝聚态实验，博后方向为低维超导及涨落。',['xp','xr'])],'查 UCSD 博后任用或个人指导原档，保留 Brown 1993／1994 两种记录。');
relation(x,xa,'postdoc',dyn,'group_leader',xp,ids('xp','xl','xa','xr'),'Dynes');
const dyl=src(['UCSD 讣告','d'],['Dynes 本人 APS 讲者档','da']);
const same='原师承扩展节点与 UC San Diego 物理系 Robert C. Dynes 为同一人。';
insertAfter(pf(d),'## 师承','\n- 同一人物的扩展节点：'+wiki(oldDyn,'Robert C. Dynes 师承扩展')+'。'+same+' '+dyl);
insertAfter(mf(oldDyn),'## 师承','\n- 同一人物的校属记录：'+who(d,'Robert C. Dynes')+'。'+same+' '+dyl);
const dy='McMaster 机构档核 1968 年论文题名及作者，文件下载重定向未取得正文；Colin K. Campbell 保留候选。本人 APS 原档列毕业后在 Bell Laboratories 22 年，第一份岗位性质未明。';
audit(d,[a('identity','UCSD 校属记录和现有同名师承扩展节点归属同一人。',['d','da']),a('phd',dy,['dt','da'])],'追 McMaster 论文签署页和 Bell Labs 入职原档。');

const ss='SUNY 项目原册确认 Suchalkin 的 1998 Ioffe 博士，并列毕业后在 Ioffe 的 G. Alferov 组与 Stuttgart Max Planck 的 K. von Klitzing 组工作。原册在相邻 Schneble 的条目单列 Postdoctoral research associate，但 Suchalkin 的条目只称 worked。两段任用性质及日期待核。';
const slinks=src(['SUNY 原册 Suchalkin 条目','ss'],['Max Planck von Klitzing 原档','sk']);
const sn='Sergey Suchalkin',sk='师承人物 - Klaus von Klitzing';
edge(s,sn,sk,'Klaus von Klitzing','毕业后研究组负责人','毕业后研究组成员','SUNY 原册列 Stuttgart 的 von Klitzing 组，聘任性质和日期待查。',slinks);
const sp='SUNY 原册核对同题远红外二维半导体光谱与 1998 Ioffe 博士。俄文答辩摘要索引具名 П. С. Копьев，但原页及独立复制入口仍未取得正文。俄罗斯科学院原档核全名 Петр Сергеевич Копьев 及 Ioffe 半导体纳米异质结构任用。保留博士候选。';
const spl=src(['SUNY 1998 学位及论文题名','ss'],['俄罗斯科学院 Kop’ev 原档','si']);
pl(s,boundary,ss+' '+slinks+' '+sp+' '+spl);
cell(s,3,'毕业后在 Ioffe（Alferov 组）和 MPI Stuttgart（Klaus von Klitzing 组）研究；博后任命及个人指导待核');
schoolWith(s,slinks+' · '+spl);
audit(s,[a('phd',sp,['ss','si','sg','sr'],'group_or_candidate'),a('postdoc',ss,['ss','sk'],'unresolved'),a('affiliation','Stony Brook ECE 副教授。',['se','ss']),a('research','半导体纳米结构、远红外与中红外固体光谱、光电子器件。',['se','ss'])],'从 Ioffe 馆藏找俄文答辩摘要原件，另追两段毕业后任用记录。');

const ff='PNNL 2022 原任用公告和 UW 现行 ECE 履历明确 Kai-Mei Fu 在 UW 物理、ECE 双聘基础上兼聘 PNNL，研究晶体点缺陷的量子态及器件集成。';
const fl=src(['PNNL 任用公告','fp'],['UW ECE 原档','fe'],['UW 物理系','fu']);
const fn='太平洋西北国家实验室（联合任用）',fSchool=path.join(root,'院校与机构','院校 - University of Washington, Seattle.md');
unit(f,'Kai-Mei Fu',fn,'UW 与 PNNL 联合任用，量子点缺陷及固态器件。',fl);
insertAfter(fSchool,'- [[已核实单位 - University of Washington, Seattle - 物理系|物理系]]','\n- '+wiki('已核实单位 - University of Washington, Seattle - '+fn,fn));
cell(f,1,'物理系、电气与计算机工程系、PNNL（联合任用）；量子缺陷、量子光学、固态自旋');
schoolWith(f,fl);
pl(f,'- 研究方向：',ff+' '+fl);
audit(f,[a('affiliation',ff,['fp','fe','fu']),a('research','固态点缺陷、量子光学、自旋和量子信息器件。',['fp','fe','fu'])],'追 Stanford 学位论文签署页，以及 HP Labs 个人指导原始档。');

const pages=[
 [k,'kcv','Ketterle CV lists Walther alongside 1986 final experimental dissertation and names supervisors/hosts in MPQ, Heidelberg and MIT employment entries.',kd+' '+kg+' '+kh+' '+kp],
 [k,'kn','Nobel autobiography names first doctoral project supervisors, describes postdoc at MPQ, and says he joined Wolfrum’s Heidelberg group.',kf+' '+kg+' '+kh],
 [k,'kd','MaxPlanckForschung report reproduced by Welt der Physik explicitly calls Herbert Walther Ketterle’s Doktorvater.',kd],
 [k,'kt','MPQ institutional report inventory identifies Ketterle’s 1986 thesis as MPQ-116.',kd],
 [k,'kho','University of Heidelberg states Ketterle worked there as a Post-Doktorand until 1990.',kh],
 [k,'kh','Heidelberg 2019 official event identifies Ketterle as a student of Jürgen Wolfrum.',kh],
 [x,'xl','Peng Xiong lab page names 1993–1997 postdoc in physics at UCSD.',xp],
 [x,'xa','Stephen Applebaum recalls the UCSD Dynes lab and names Peng Xiong among its postdocs.',xp],
 [x,'xr','APS 1995 paper names Xiong, Herzog and Dynes at UC San Diego Physics.',xp],
 [s,'ss','SUNY project book lists 1998 Ioffe doctorate and postgraduation group appointments at Ioffe and Stuttgart Max Planck.',ss],
 [s,'si','Russian Academy of Sciences identifies Ioffe senior scientist Petr Sergeevich Kop’ev.',sp],
 [s,'sk','Max Planck confirms Klaus von Klitzing led low dimensional electronic systems in Stuttgart.',ss],
 [f,'fp','PNNL announces joint appointment with UW Physics and ECE for quantum properties of crystal point defects.',ff],
 [f,'fe','UW ECE current faculty profile confirms joint PNNL appointment and UW Physics and ECE professorship.',ff]
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:k,url:u.kpdf,error:'HTTP 400 OK; MPQ catalogue accessible, dissertation body unavailable'},
 {record_id:x,url:u.xcv,error:'CV Google Docs export inaccessible'},
 {record_id:d,url:u.dpdf,error:'HTTP 500; repository redirects to an unavailable origin'},
 {record_id:s,url:u.sm,error:'Cache miss'}, {record_id:s,url:u.sal,error:'HTTP 400 Timeout fetching'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2359_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2359_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2359_Walther与Dynes原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
