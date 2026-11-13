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
 orig.audit_id='pi_archive_20261111_0518_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0518_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"n":"https://www2.chem.wisc.edu/deptfiles/Nippe%20Thesis.pdf","tam":"https://artsci.tamu.edu/chemistry/contact/profiles/michael-nippe.html","csu":"https://www.chem.colostate.edu/seminars/tba-michael-nippe/","k":"https://asset.library.wisc.edu/1711.dl/OGDQJFKYJJOID8I/R/file-8bd25.pdf","uw":"https://www.supportuw.org/stories/feature/caught-doing-something-wonderful/","rsc":"https://pubs.rsc.org/en/content/articlehtml/2016/qi/c6qi90021f","chang":"https://changlabucb.wordpress.com/alumni/","newchang":"https://chrischang.chemistry.princeton.edu/our-lab/alumni/","long":"https://alchemy.cchem.berkeley.edu/static/pdf/jeffcv.pdf","tifr":"https://www.tifralumni.org/pdf/taanl2007no1B.pdf","insa":"https://insaindia.res.in/pdf/annualeng1.pdf","asu":"https://news.asu.edu/b/20250818-asu-welcomes-new-leader-groundbreaking-compact-xray-laser-project","pram":"https://www.ias.ac.in/article/fulltext/pram/073/01/0113-0155","jila":"https://www.colorado.edu/jila/kapteyn-murnane-group-members","sconf":"https://www.quantumbattles.com/attofridaysposters.html","sreview":"https://studyres.com/doc/20007850/intense--ultrashort-light-and-dense--hot-matter","mon":"https://www.monash.edu/__data/assets/pdf_file/0020/3701243/Seminar-David-Smith-July-2024.pdf","scow":"https://science.org.au/our-focus/history-australian-science/fellows-biographical-memoirs/john-maxwell-cowley-1923-2004","sj":"https://www.jos.ac.cn/en/article/doi/10.1088/1674-4926/43/4/041102?viewType=HTML","pi":"https://elcomercio.pe/blog/vidayfuturo/2012/06/entrevista-a-fernando-ponce-an/","pr":"https://experts.azregents.edu/en/persons/fernando-ponce/","pold":"https://wu.mse.berkeley.edu/ems/pastfliers/1993.pdf","pn":"https://www.nature.com/articles/290386a0","pcv":"https://search.asu.edu/profile/215963/cv"};
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




const N='ba1ad8f2', A='c122d0a5', D='f02f1c99', P='99719779';
const ne='Wisconsin 化学系公开答辩通知具名 Michael Nippe，明确写 Under the supervision of Assistant Professor John F. Berry。Texas A&M 化学系与 Colorado State 讲者履历均核 Wisconsin–Madison 2011 化学博士。';
const nl=src(['Wisconsin 化学系答辩原件','n'],['Texas A&M 化学系','tam'],['Colorado State 化学系讲者原档','csu']);
updateEdge(N,'Michael Nippe','师承人物 - John F. Berry','John F. Berry','博士阶段研究师长','博士阶段研究者','博士导师','博士生',ne,nl);
rewrite(pf(N),x=>x.startsWith(boundary),()=>boundary+'Wisconsin 化学系原始答辩通知已核 John F. Berry 为博士导师。Colorado State 讲者履历列 Berkeley 博后任期为 2011–2014，Chang 组校友页列 2013–2014。Long、Raymond 的阶段研究指导及 Chang 组属分别保留，博士后个人导师职衔待查。 '+nl+' · '+src(['Chang 组校友档','chang']));
cell(N,2,'John F. Berry（Wisconsin 化学系答辩原件明确指导）');
cell(N,3,'Berkeley 2011–2014；Jeffrey R. Long、Kenneth N. Raymond（阶段研究师长）；Christopher J. Chang（博士后课题组负责人，2013–2014）');
schoolWith(N,nl);
const na=audit(N,[a('identity','Wisconsin 答辩原件和 Texas A&M 院系履历对应同名化学研究者、同一学位单位。',['n','tam','csu']),a('affiliation','Texas A&M 化学系人物档明确其现任院系。',['tam']),a('research','院系档和 Colorado State 讲者履历核无机分子材料、分子磁性、分子催化及金属间作用。',['tam','csu','n']),a('phd',ne,['n','tam','csu'],'confirmed_advisor'),a('postdoc','Colorado State 讲者履历明确 Berkeley 博后总任期 2011–2014；Chang 组档列 2013–2014。Long、Raymond 的阶段研究师长及 Chang 组属保留。',['csu','rsc','chang'])],'查 Berkeley 与 LBNL 2011–2014 分段的具名指导任用或导师本人 CV。');
relation(N,na,'phd','师承人物 - John F. Berry','advisor',ne,ids('n','tam','csu'),'p1');
const al=src(['TIFR 校友通讯第 6 页','tifr'],['印度国家科学院原年报第 20 页','insa'],['ASU 入职报道','asu']);
pl(A,boundary,'TIFR 校友通讯核全名 Arvinder Singh Sandhu 及学科部门，印度国家科学院同期年报列 JILA Senior Research Associate。该职级与组校友档及讲座所列博士后经历分开记录。博士论文原卷和个人博士后指导仍待查。 '+al);
schoolWith(A,al);
audit(A,[a('identity','TIFR 校友通讯写全名 Arvinder Singh Sandhu，印度国家科学院原年报同名、JILA 任用及激光物质相互作用方向吻合。',['tifr','insa','asu']),a('affiliation','ASU 官方入职报道核 CXFEL 主任及 University of Arizona 物理与光学历史任用。',['asu']),a('phd','TIFR 校友通讯确认 Nuclear and Atomic Physics 部门。Kumar 综述官方原卷未读到，保留博士候选及各文献的年份口径。',['tifr','pram','sreview','sconf']),a('postdoc','印度国家科学院同期年报称 JILA Senior Research Associate；本人讲座另称 JILA 博后，JILA 组页面核联合组归属。个人指导和职级转折月份待查。',['insa','jila','sconf'])],'以全名和已知题名查 Mumbai/TIFR 学位档。分别查 JILA 博后与 Senior Research Associate 任用及具名指导。');
const dl=src(['本人署名论文作者档','sj'],['Monash 讲者履历','mon'],['澳大利亚科学院传记','scow']);
pl(D,boundary,'本人署名论文作者档交叉确认 1978 Melbourne PhD 与 1988 D.Sc. 为两项不同学位，并核 ASU 物理与半导体纳米结构显微方向。Monash 讲者档和 Cowley 传记继续区分 Cambridge 博后、此后显微项目任职和 ASU。 '+dl);
schoolWith(D,dl);
audit(D,[a('identity','本人署名作者档及 Monash 讲者资料均列 Melbourne PhD 1978、D.Sc. 1988 及 ASU 物理学任用。',['sj','mon']),a('affiliation','署名单位为 ASU Physics，Monash 履历核 Regents Professor。',['sj','mon']),a('research','本人署名作者档列先进电子显微技术用于半导体异质结构与纳米结构。',['sj']),a('phd','本人作者履历和 Monash 讲者档均明确 1978 年获 Melbourne 物理博士。1988 D.Sc. 独立列出，博士导师待原学位档。',['sj','mon']),a('postdoc','澳大利亚科学院传记核从 Cambridge 博后赴 ASU，Monash 材料确认 Cambridge 显微项目履历，个人博后导师未列。',['scow','mon'])],'按 D. J. Smith 与 David J. Smith 分别在 Melbourne 纸本学位档和 Cambridge Cavendish 任用档查个人指导。');
const plinks=src(['本人西语访谈','pi'],['Arizona Board of Regents 本人档','pr'],['Berkeley 同期会议名册','pold']);
pl(P,boundary,'本人西语访谈核全名 Fernando Ponce Antúnez de Mayolo，第一人称回忆在 Stanford 做材料学论文，但未具名所述教授。Berkeley 1993 同期会议册确其当时署 Xerox，Arizona Regents 原档核 ASU 物理及电子显微研究。Sinclair 保留候选。 '+plinks);
schoolWith(P,plinks);
audit(P,[a('identity','西语本人访谈核全名 Fernando Ponce Antúnez de Mayolo、Stanford 材料研究和 Xerox/HP 任用，与 Arizona Regents 本人档匹配。',['pi','pr','pold']),a('affiliation','Arizona Regents 原档列 ASU Physics；Berkeley 1993 原会议档列 Xerox。',['pr','pold']),a('phd','本人访谈回忆 Stanford 材料学论文及指导教授，但未具名，不能据此升级 Sinclair 候选。',['pi','pn','pcv']),a('postdoc','Berkeley 1993 原名册核 Xerox 历史任用，ASU CV 所列早期 Xerox 与 HP 岗位为产业研究。独立博士后经历仍待查。',['pold','pcv','pi'])],'用全名和学位年份查 Stanford 纸本学位目录与签署页，另查产业阶段有无博士后性质任用。');
const page=(record_id,key,excerpt)=>({record_id,url:u[key],raw:excerpt,excerpt});
const fail=(record_id,key,error)=>({record_id,url:u[key],error});
const pages=[
 page(N,'n','Wisconsin 化学系 1 页原始答辩通知列 Michael Nippe，Under the supervision of Assistant Professor John F. Berry。本地原件 20261111_0515_Nippe_Wisconsin_Defense.pdf，SHA-256 7e171f9fc5340a01a80079d2d0025b9d2c0b20914b570555254c05049d5cbfd1。'),
 page(N,'tam','Texas A&M Chemistry 本人档核 2011 University of Wisconsin–Madison PhD。'),
 page(N,'csu','Colorado State 化学系讲者履历核 2011 Wisconsin–Madison 无机化学博士与 2011–2014 Berkeley 博后。'),
 page(N,'k','这是 Katherine P. Kornecki 的 2013 博士论文，不是 Nippe 学位论文。原卷第 5 页致谢称 Nippe 是 Berry Group 前成员。该页只作组属背景。'),
 fail(N,'newchang','Princeton Chang 实验室校友原页返回 403。保留既有旧组档。'),
 fail(N,'long','Berkeley Long 本人 CV 下载返回 502。'),
 page(A,'tifr','TIFR Alumni Association 2007 通讯第 6 页 Physical Sciences award 列 Arvinder Singh Sandhu，Department of Nuclear Atomic Physics。'),
 page(A,'insa','印度国家科学院年报第 20 页列 Arvinder Singh Sandhu，PhD，Sr. Research Associate, JILA，研究激光与物质相互作用。'),
 page(A,'asu','ASU 2025-08-18 入职原档核 CXFEL 主任及 Arizona 历史任用。'),
 fail(A,'pram','印度科学院综述全文路径直接获取返回 403，未读到原文。'),
 page(D,'sj','本人署名文章作者档核 Melbourne 1978 PhD、1988 DSc、ASU Physics 与半导体显微研究。'),
 page(D,'mon','Monash 2024 讲者原档确认 Melbourne 1978 PhD、1988 DSc 及 Cambridge 高分辨电子显微项目任职。'),
 page(P,'pi','本人第一人称回忆 Stanford 材料学论文阶段，未具名教授。访谈题头全名 Fernando Ponce Antúnez de Mayolo。'),
 page(P,'pr','Arizona Board of Regents 本人档列 Arizona State Physics 教授及电子显微与半导体材料研究。'),
 page(P,'pold','Berkeley 1993 年同期会议名册第 2 页列 Fernando Ponce, Xerox。')
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0518_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0518_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0518_Wisconsin答辩与任用原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
