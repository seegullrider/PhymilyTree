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
 orig.audit_id='pi_archive_20261111_0122_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0122_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"col":"https://academiccommons.columbia.edu/doi/10.7916/D8BP010F","colfac":"https://www.chem.columbia.edu/content/timothy-c-berkelbach","colgroup":"https://berkelbach.chem.columbia.edu/index.html","reich":"https://reichmangroup.chem.columbia.edu/directory","stan":"https://chemistry.stanford.edu/events/dr-timothy-berkelbach-princeton-university","pcts":"https://pcts.princeton.edu/people/past-postdocs","chan":"https://www.chan-lab.caltech.edu/former-members","chic":"https://neubauerassistantprofessors.uchicago.edu/faculty/timothy-berkelbach/","atu":"https://www.atualumni.com/s/978/bp24/interior.aspx?gid=1&pgid=1801&sid=978","wash":"https://physics.washu.edu/news/memory-kenneth-kelton","washPost":"https://source.washu.edu/2007/11/making-stronger-connections-2/","pisa":"https://etd.adm.unipi.it/t/etd-03172009-144125/","pisaIndex":"https://etd.adm.unipi.it/theses/browse/by_author/h.html","emory":"https://physics.emory.edu/people/bios/harutyunyan-hayk.html","jhu":"https://jscholarship.library.jhu.edu/items/3971c444-6c2d-407b-8e3a-90984bb20772","jpdf":"https://jscholarship.library.jhu.edu/bitstreams/154ef211-f2ab-45da-81d4-2654167c15a1/download","jalum":"https://me.jhu.edu/alumni/our-alumni/phd-alumni/","ucs":"https://materials.ucsb.edu/people/faculty/daniel-s-gianola","sbook":"https://doi.org/10.1007/978-0-387-30877-7_30","mrs":"https://www.cambridge.org/core/services/aop-cambridge-core/content/view/E6CB691E9DC0438B691DBE4B3E465E99/S0883769400040136a.pdf/candidate-profiles-1986-mrs-officers-and-councillors.pdf","hg":"https://news.harvard.edu/gazette/story/2002/04/rowland-institute-merges-with-harvard/","hcv":"https://spaepen.seas.harvard.edu/biocv/cv","hfac":"https://seas.harvard.edu/person/frans-spaepen","hpub":"https://spaepen.seas.harvard.edu/publications","wiley":"https://onlinelibrary.wiley.com/doi/abs/10.1002/polc.5070630120","italy":"https://tesidottorato.depositolegale.it/handle/20.500.14242/257641","trento":"https://webapps.unitn.it/du/en/Persona/PER0003263/Curriculum","trentoT":"https://webapps.unitn.it/du/en/Persona/PER0003263/Tesi","nus":"https://cde.nus.edu.sg/cdehighlights-dec-faculty-highlights/","nusseminar":"https://graphene.nus.edu.sg/event-details/?title=423"};
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




const col='41c1e5a1', chi='cff12e56', reich='人员 - Columbia - David R. Reichman - 38d42d59';
const cp='Columbia Academic Commons 的 2014 博士论文 Microscopic theories of excitons and their dynamics 原记录在 Thesis Advisors 栏具名 David R. Reichman，学位栏列 Columbia 化学物理 Ph.D.。可信度：高。';
const cl=src(['Columbia 学位论文原目录','col'],['Reichman 组校友档','reich']);
updateEdge(col,'Timothy Berkelbach',reich,'David R. Reichman','博士阶段课题组负责人','博士阶段课题组成员','博士导师','博士生',cp,cl);
const cs=who(chi,'Timothy Berkelbach：旧校更正'), ct=wiki(reich,'David R. Reichman');
rewrite(pf(chi),x=>x.startsWith('- 博士阶段课题组负责人：')&&x.includes(reich),()=>'- 博士导师：'+ct+'。'+cp+' '+cl);
rewrite(mf(reich),x=>x.startsWith('- 博士课题组成员：')&&x.includes(records.get(chi).filename),()=>'- 博士生：'+cs+'。'+cp+' '+cl);
rewrite(index,x=>x.startsWith('- '+cs+' → 博士课题组：'),()=>'- '+cs+' → 博士导师：'+ct+'。'+cp+' '+cl);
for(const id of [col,chi]){
 rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+'Columbia 学位库已核定 David R. Reichman 为博士导师。Princeton 的 PCTS 独立博士后岗位及 Chan 组属由院档和组档分别核实，个人正式导师待查。Chicago 为 2016–2018 历史任职，现任 Columbia。 '+src(['Columbia 学位论文原目录','col'],['Stanford 当期讲座','stan'],['Chan 组校友档','chan'],['本人组页','colgroup']));
 cell(id,2,'David R. Reichman（博士导师）');
 school(id,'Columbia 学位论文入口（未取得正文）','Columbia 学位论文原目录');
 const ca=audit(id,[
  a('identity','Columbia 论文原档列 Timothy C. Berkelbach，组履历及院系档与 Chicago 历史任职记录相符。',['col','colgroup','colfac','chic'],'confirmed'),
  a('affiliation',id===col?'Columbia 化学系，兼 Flatiron 研究；Chicago 为历史任职。':'Chicago 化学系历史任职，现任 Columbia 化学系，另有 Flatiron 研究职务。',['colgroup','colfac','chic'],'confirmed'),
  a('research','理论化学、凝聚态多体理论、激子动力学与材料计算。',['col','colgroup','colfac'],'confirmed'),
  a('phd',cp,['col','reich'],'confirmed_advisor')
 ],'继续核 Princeton 独立博士后是否有具名正式 advisor，Chan 组属证据保留。');
 relation(id,ca,'phd',reich,'advisor',cp,ids('col','reich'),'reichman');
}

const kk='f5a0922e', sp='401d11fb', sm=records.get(sp).filename;
const kp='Arkansas Tech University 校友荣誉档原页明确列 Kenneth F. Kelton 的 1983 Harvard 应用物理博士论文题名，并在该学位条目下具名 F. Spaepen 为 Thesis Advisor；同期研究与 Harvard 人物档对应 Frans Spaepen。可信度：高。';
const kl=src(['Arkansas Tech University 校友原档','atu'],['WashU 物理纪念档','wash']);
updateEdge(kk,'Kenneth Kelton',sm,'Frans Spaepen','博士导师候选','博士生候选','博士导师','博士生',kp,kl);
rewrite(pf(kk),x=>x.startsWith(boundary),()=>boundary+'校友原档核定博士导师。WashU 校刊核 1985 年赴 WashU 前有两年 Harvard 博士后，Spaepen 为同单位同期合作者，保留博士后候选。 '+src(['Arkansas Tech University 校友原档','atu'],['WashU 校刊','washPost'],['WashU 物理纪念档','wash']));
cell(kk,2,'Frans Spaepen（博士导师）');
school(kk,'Arkansas Tech 校友原页跳转登录，博士导师继续标候选。','Arkansas Tech 校友原页已核实博士导师。');
schoolWith(kk,src(['Arkansas Tech University 校友原档','atu']));
const ka=audit(kk,[
 a('identity','Arkansas Tech 全名、Harvard 博士与 WashU 物理履历和研究方向相符。',['atu','wash','washPost'],'confirmed'),
 a('affiliation','WashU 物理系历史任用，材料科学与工程研究所创始主任，2025 年去世。',['wash'],'confirmed'),
 a('research','材料物理，准晶、金属玻璃及凝聚态成核。',['wash'],'confirmed'),
 a('phd',kp,['atu','wash'],'confirmed_advisor')
],'追 Harvard 1983–1985 博士后正式导师，Spaepen 的博士与博士后边保持不同类型。');
relation(kk,ka,'phd',sm,'advisor',kp,ids('atu','wash'),'spaepen');

const h='eb228b25';
const hp='比萨大学 2009 年博士论文原目录 Excited State Dynamics of Individual Single-Walled Carbon Nanotubes 的 Supervisors 栏同时列 Maria Allegrini 和 Achim Hartschuh 为 Relatore。两人为同一论文的具名导师。可信度：高。';
const hl=src(['比萨大学博士论文原目录','pisa'],['比萨大学作者索引','pisaIndex'],['Emory 物理系','emory']);
for(const [f,n] of [['师承人物 - Maria Allegrini','Maria Allegrini'],['师承人物 - Achim Hartschuh','Achim Hartschuh']]){
 updateEdge(h,'Hayk Harutyunyan',f,n,'博士导师','博士生','博士导师','博士生',hp,hl);
}
rewrite(pf(h),x=>x.includes('原论文条目本轮缓存缺失'),x=>x.replace('原论文条目本轮缓存缺失，保留既有导师关系及博士后候选。','原论文条目现已直接核读，两位指导者见上方博士导师。'));
cell(h,2,'Maria Allegrini、Achim Hartschuh（博士论文共同指导）');
const ha=audit(h,[
 a('identity','比萨大学论文原档与 Emory 物理系及本人履历相符。',['pisa','pisaIndex','emory'],'confirmed'),
 a('affiliation','Emory 物理系。',['emory'],'confirmed'),
 a('research','纳米光子学、等离激元、非线性光学及纳米材料。',['emory','pisa'],'confirmed'),
 a('phd',hp,['pisa','pisaIndex','emory'],'confirmed_advisor')
],'继续追 Rochester 与 Argonne 两段博士后的正式指导者。');
relation(h,ha,'phd','师承人物 - Maria Allegrini','advisor',hp,ids('pisa','pisaIndex','emory'),'allegrini');
relation(h,ha,'phd','师承人物 - Achim Hartschuh','advisor',hp,ids('pisa','pisaIndex','emory'),'hartschuh');

const g='1a532b7f', he='人员 - Johns Hopkins - Kevin Hemker - 7a5f2c81', sh='师承人物 - William N. Sharpe Jr.';
const gp='Johns Hopkins 2007 年学位论文 Deformation Mechanisms in Nanocrystalline Aluminum Thin Films 的第 iii 页 Readers 栏明确区分 K. J. Hemker（primary advisor）、W. N. Sharpe, Jr.（co-advisor）和 E. Ma（reader）。第 iv–v 页致谢分别以 Kevin Hemker、William Sharpe, Jr. 全名称其博士阶段指导与共同指导。可信度：高。';
const gl=src(['Johns Hopkins 论文原件，第 iii–v 页','jpdf'],['Johns Hopkins 学位库','jhu'],['JHU 机械工程博士校友档','jalum']);
mentor(sh,'William N. Sharpe Jr.','Johns Hopkins 机械工程教授，从事实验固体力学与微纳力学表征。',src(['Johns Hopkins 学位论文原件','jpdf'],['Springer 手册编者档','sbook']));
updateEdge(g,'Daniel S. Gianola',he,'Kevin J. Hemker','博士课题组负责人','博士课题组成员','博士导师','博士生',gp,gl);
edge(g,'Daniel S. Gianola',sh,'William N. Sharpe Jr.','博士共同导师','博士生',gp,gl);
cell(g,2,'Kevin J. Hemker（主导师）；William N. Sharpe Jr.（共同导师）');
schoolWith(g,gl);
const ga=audit(g,[
 a('identity','JHU 论文扉页、校友档与 UCSB 材料系本人页均署 Daniel S. Gianola，学位及纳米力学研究相符。',['jhu','jpdf','jalum','ucs'],'confirmed'),
 a('affiliation','UC Santa Barbara 材料系教授。',['ucs'],'confirmed'),
 a('research','纳米结构变形、材料缺陷与原位力学表征，另研究极端环境材料。',['ucs','jpdf'],'confirmed'),
 a('phd',gp,['jpdf','jhu','jalum'],'confirmed_advisor')
],'追 JHU 博后任用原档、Karlsruhe Humboldt 早期任命的具名 host，保留两处博士后角色边界。');
relation(g,ga,'phd',he,'advisor',gp,ids('jpdf','jhu','jalum'),'hemker');
relation(g,ga,'phd',sh,'advisor',gp,ids('jpdf','jhu','jalum'),'sharpe');

const spp='MRS 1985 候选人原档列 Spaepen 于 Harvard 1975 年获博士，随后在 Harvard 任 IBM Research Fellow 至 1977 年。Harvard 校刊核 1977 年加入教员。这一岗位的任职单位与资助名称已分开，正式个人博士后指导仍待查。';
rewrite(pf(sp),x=>x.startsWith(boundary),()=>boundary+'Spaepen 本人卷首明确 Turnbull 是博士论文导师。'+spp+' '+src(['本人 CV','hcv'],['MRS 任用原档','mrs'],['Harvard 校刊','hg'],['Harvard 出版目录','hpub']));
cell(sp,3,'1975–1977 Harvard IBM Research Fellow；个人指导待核');
schoolWith(sp,src(['MRS 任用原档','mrs'],['Harvard 校刊','hg']));
audit(sp,[
 a('identity','MRS 1985 候选档及 Harvard 校刊对上学位、院系和任用。',['mrs','hg','hfac'],'confirmed'),
 a('affiliation','Harvard 应用物理、材料科学；曾任 Rowland Institute 负责人。',['mrs','hg','hfac'],'confirmed'),
 a('research','非晶金属和半导体、界面、相变及薄膜力学。',['mrs','hg'],'confirmed'),
 a('postdoc',spp,['mrs','hg','hcv'],'unresolved')
],'查 Harvard 1975–1977 IBM Fellowship 当期档的具名指导。Wiley 作者脚注原页有安全验证。');

const av='dff565f5', ap='NUS 工学院任用档列 2016–2020 EPFL Fellow（Marie Curie COFUND 共同资助）及其后 Newcastle 物理任职。EPFL 原报道具名 Kis 组，继续标博士后课题组负责人。';
personLine(av,boundary,' '+ap+' '+src(['NUS 工学院任用档','nus']));
schoolWith(av,src(['NUS 工学院任用档','nus']));
audit(av,[
 a('identity','NUS 工学院任用档独立核 NUS 物理博士、EPFL 及 Newcastle 经历。',['nus'],'confirmed'),
 a('research','二维材料中的自旋和激子输运及低功耗电子学。',['nus'],'confirmed'),
 a('postdoc',ap,['nus'],'group_or_candidate')
],'NUS 2018 活动原页浏览器无法解析域名，保留 Özyilmaz 博士组属；继续找 NUS 学位论文原档或本人 CV 明示导师。');

const pages=[
 [col,'col','Columbia Academic Commons identifies Timothy C. Berkelbach’s 2014 Ph.D. thesis and lists David R. Reichman under Thesis Advisors.','直接在学位库原页确认博士导师。'],
 [chi,'col','The same 2014 Columbia Ph.D. thesis record lists David R. Reichman as Thesis Advisor for Timothy C. Berkelbach.','同步 Chicago 历史人物记录的博士导师。'],
 [kk,'atu','The original Arkansas Tech distinguished alumnus profile names F. Spaepen as Kelton’s thesis advisor in the Harvard 1983 Applied Physics Ph.D. entry.','原网页展开校友卡片，核实博士导师。'],
 [h,'pisa','University of Pisa thesis entry has two Supervisors, Maria Allegrini and Achim Hartschuh, for Hayk Harutyunyan’s 2009 dissertation.','原目录核实两位博士论文指导人。'],
 [g,'jhu','The official Johns Hopkins dissertation record identifies Daniel S. Gianola and the 2007 mechanical engineering dissertation.','JHU 校库原页核身份。'],
 [g,'jpdf','Page iii of the thesis lists W. N. Sharpe, Jr. as co-advisor and K. J. Hemker as primary advisor; pages iv–v confirm names and roles.','已视觉核读扉页、读者栏及致谢。En Ma 列 reader。'],
 [g,'jalum','Johns Hopkins Mechanical Engineering’s PhD alumni archive lists Daniel Gianola in 2007 and links the named dissertation.','核对年份与论文题名。'],
 [g,'ucs','UCSB Materials’ profile lists the Johns Hopkins Mechanical Engineering Ph.D. and describes current structural materials research.','核对现任院系和方向。'],
 [sp,'mrs','MRS candidate profile identifies the 1975 Harvard Ph.D. and Harvard IBM Research Fellow appointment until 1977.','核实博士后时期的 fellowship 所在单位及任用。'],
 [sp,'hg','Harvard Gazette records his Applied Physics doctorate in 1975 and appointment to the Harvard faculty in 1977.','交叉核博士与教职时间。'],
 [av,'nus','NUS Engineering’s hiring announcement describes Avsar’s 2016–2020 EPFL fellowship, Newcastle appointment and NUS physics doctorate.','核身份、阶段和研究方向。'],
 ['e0fc6317','trento','Trento faculty CV identifies Lorenzo Pavesi as Physics professor, lab director and thesis advisor to doctoral students in general.','核 Pavesi 身份与研究单位，未具名对应 Dal Negro。'],
 ['e0fc6317','trentoT','Trento thesis-supervision profile returned a list without Luca Dal Negro.','保留旧导师记录，继续待国家目录恢复。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push(
 {record_id:sp,url:u.wiley,error:'Publisher displays Cloudflare security verification; MRS appointment archive directly read.'},
 {record_id:av,url:u.nusseminar,error:'Browser ERR_NAME_NOT_RESOLVED; search tool also returned Cache miss.'},
 {record_id:'e0fc6317',url:u.italy,error:'UNITESI original page displays Sistema in aggiornamento; search service reports 503.'}
);
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0122_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0122_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0122_浏览器与学位原件回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
