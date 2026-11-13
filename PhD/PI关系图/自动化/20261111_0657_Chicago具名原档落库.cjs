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
 orig.audit_id='pi_archive_20261111_0657_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0657_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"fcv":"https://www.ferglab.com/wp-content/uploads/2023/04/Ferguson_CV.pdf#page=2","frole":"https://pme.uchicago.edu/directory/andrew-ferguson","fmit":"https://cheme.mit.edu/wp-content/uploads/2026/02/S26-Seminar-0410-Ferguson.pdf","kself":"https://www.linkedin.com/posts/dahlia-klein_homepage-activity-7370880442465595392-Ebva","krole":"https://neubauerassistantprofessors.uchicago.edu/faculty/dahlia-klein/","kgroup":"https://www.ilanigroup.com/members","kaward":"https://zuckermanstem.org/scholars/dahlia-klein/","ccself":"https://ultracold.uchicago.edu/news/2005","ccv":"https://ultracold.uchicago.edu/sites/default/files/web/cv_12_2014.pdf#page=1","ccv26":"https://ultracold.uchicago.edu/sites/default/files/cv_2026.1_web.pdf","ccrole":"https://physics.uchicago.edu/people/profile/cheng-chin/","ccjochim":"https://www.ultracold.at/theses/2004-jochim.pdf#page=179","pb":"https://qutech.nl/lab/taminiau-lab/team/","pbf":"https://chicagoquantum.org/people/benjamin-pingault","pbec":"https://cordis.europa.eu/project/id/840968","apr":"https://pme.uchicago.edu/directory/chibueze-amanchukwu","abao":"https://baogroup.stanford.edu/people/chibueze-amanchukwu","atom":"https://tomkat.stanford.edu/news/tomkat-center-welcomes-new-cohort-postdoctoral-fellows-stanford","murcv":"https://muruganlab.uchicago.edu/data/cv/MuruganCV.pdf#page=1","murtr":"https://muruganlab.uchicago.edu/data/cv/MuruganCV.pdf#page=3","murmirror":"https://studylib.net/doc/18620133/arvind-murugan---harvard-university","pmrole":"https://pme.uchicago.edu/directory/peter-maurer","pmf":"https://neuroscience.stanford.edu/research/funded-research/investigation-synapse-formation-novel-nanoscale-imaging-techniques","pmbio":"https://neuroscience.stanford.edu/people/peter-maurer","pmgroup":"https://www.stevechulab.com/people"};
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
function read(record_id,k,raw){pages.push({record_id,url:u[k],raw,excerpt:raw});}
function fail(record_id,k,error){pages.push({record_id,url:u[k],error});}
const f='bad15e2e',k='c42aecce',cc='16be5149',bp='1524c1b4',aId='f98016cc',am='43ce907a',pm='5efac2f5';
const fl=src(['本人 2026 CV 第 2 页','fcv'],['Chicago PME','frole'],['MIT 化工讲座档','fmit']);
const fd='Andrew L. Ferguson 本人 2026 CV 第 2 页在 Princeton 2005–2010 化工与生物工程博士条目明确并列三位 Advisors。论文题为 A Computational Investigation of Low-Dimensional Parametrizations for n-Alkanes and Peptides in Water。共同导师可信度高。';
const fp='本人 2026 CV 第 2 页明确列 Arup K. Chakraborty 为 2010 年 10 月至 2012 年 4 月 MIT Ragon 博士后 Advisor。导师关系可信度高。';
const fphd=[
 ['人员 - Princeton - Athanassios Z. Panagiotopoulos - f14696a9','Athanassios Z. Panagiotopoulos','pana'],
 ['师承人物 - Pablo Debenedetti','Pablo G. Debenedetti','debe'],
 ['师承人物 - Ioannis G. Kevrekidis','Ioannis G. (Yannis) Kevrekidis','kevr'],
];
for(const [target,name] of fphd)updateEdge(f,'Andrew Ferguson',target,name,'博士研究师长','博士阶段研究者','博士导师','博士生',fd,fl);
const chak='师承人物 - Arup Chakraborty';
updateEdge(f,'Andrew Ferguson',chak,'Arup K. Chakraborty','博士后研究师长','博士后阶段研究者','博士后导师','博士后研究者',fp,fl);
rewrite(pf(f),x=>x.startsWith(boundary),()=>boundary+'本人 CV 第 2 页分列 Princeton 三位博士共同导师和 MIT 一位博士后导师。 '+fl);
cell(f,2,'Athanassios Z. Panagiotopoulos、Pablo G. Debenedetti、Ioannis G. Kevrekidis（Princeton 博士共同导师）');
cell(f,3,'Arup K. Chakraborty（MIT Ragon 博士后导师，2010-10 至 2012-04）');
schoolWith(f,fl);
const fa=audit(f,[a('identity','Chicago 院系、MIT 讲座档与本人 CV 核 Andrew L. Ferguson、Princeton 博士和 MIT Ragon 博士后。',['fcv','frole','fmit'],'confirmed'),a('affiliation','Chicago Pritzker School of Molecular Engineering 与化学系教授。',['frole','fcv'],'confirmed'),a('research','软凝聚态材料、分子模拟、聚合物与胶体自组装。',['frole'],'confirmed'),a('phd',fd,['fcv','frole'],'confirmed_advisor'),a('postdoc',fp,['fcv','fmit'],'confirmed_advisor')],'两阶段导师已由本人 CV 具名，后续按新原档增量更新。');
audits.at(-1).followup_required=false;
for(const [target,,key] of fphd)relation(f,fa,'phd',target,'advisor',fd,ids('fcv','frole'),key);
relation(f,fa,'postdoc',chak,'advisor',fp,ids('fcv','fmit'),'chak');
read(f,'fcv','本人 2026-10-22 CV 第 2 页，Princeton 博士 Advisors 为 Panagiotopoulos、Debenedetti、Kevrekidis；MIT Ragon 博士后 Advisor 为 Chakraborty。');
read(f,'frole','Chicago PME 与化学系教授，研究分子模拟、聚合物、肽和胶体自组装。');
read(f,'fmit','MIT 化工 2026 讲座档列 2010 Princeton 学位、2010–2012 MIT Ragon 博士后。');
const kl=src(['Klein 本人公开自述','kself'],['Chicago 任用原档','krole'],['Ilani 组原档','kgroup']);
const kn='本人公开自述明确称 Shahal Ilani 为 postdoctoral advisor，同时将 MIT 博士导师单列为 Pablo Jarillo-Herrero。Chicago 任用原档与 Ilani 组原档核 Weizmann 博后。导师关系可信度高。';
const il='师承人物 - Shahal Ilani';
updateEdge(k,'Dahlia Klein',il,'Shahal Ilani','博士后课题组','博士后课题组成员','博士后导师','博士后研究者',kn,kl);
rewrite(pf(k),x=>x.startsWith(boundary),()=>boundary+'本人公开自述具名确认博士和博士后导师，Xiaodong Xu 在同一来源列为博士研究期间合作者。 '+kl);
cell(k,3,'Shahal Ilani（Weizmann 博士后导师）');
schoolWith(k,kl);
const ka=audit(k,[a('affiliation','Chicago 物理系 Neubauer Family Assistant Professor，自 2026 年 1 月。',['krole','kself'],'confirmed'),a('research','二维量子材料、磁性和扫描探针测量。',['krole','kself'],'confirmed'),a('phd','本人称 Pablo Jarillo-Herrero 为 PhD advisor，Xiaodong Xu 为博士阶段合作者。',['kself','krole'],'confirmed_advisor'),a('postdoc',kn,['kself','krole','kgroup'],'confirmed_advisor')],'博士及博士后具名导师已核，按新原档增量更新。');
audits.at(-1).followup_required=false;
relation(k,ka,'postdoc',il,'advisor',kn,ids('kself','krole','kgroup'),'ilani');
read(k,'kself','本人发表公开履历说明，将 Pablo Jarillo-Herrero 称博士导师、Shahal Ilani 称博士后导师，Xiaodong Xu 是博士期间合作者。');
read(k,'krole','Chicago 物理系 Neubauer Family Assistant Professor，自 2026-01。MIT 博士，Weizmann 博士后，二维量子材料。');
read(k,'kgroup','Weizmann Ilani 本人组原档列 Dahlia Klein。');
const gl=src(['Chin 本人 2005 组页日志','ccself'],['本人旧 CV 第 1 页','ccv'],['Chicago 物理系','ccrole'],['Jochim 同期学位论文第 179 页','ccjochim']);
const gn='本人 2005 年 7 月日志称 Rudolf Grimm 为 former advisor，且记录此前在 Innsbruck 的 Grimm 组研究。本人旧 CV 明列 2003–2005 Lise-Meitner Postdoctoral Research Fellow，Chicago 物理系及同组 2004 博士论文分别核该段博士后研究。保留较新 CV 所列 visiting scientist 聘任职称；Innsbruck 博士后研究导师已具名，Stanford 2001–2003 博士后导师另待核。';
const gr='师承人物 - Rudolf Grimm', oldGr='博士毕业后研究合作者（职位性质待核）';
updateEdge(cc,'Cheng Chin',gr,'Rudolf Grimm',oldGr,oldGr,'博士后导师','博士后研究者',gn,gl);
rewrite(pf(cc),x=>x.startsWith(boundary),()=>boundary+gn+' '+gl);
cell(cc,3,'Rudolf Grimm（Innsbruck 2003–2005 博后研究导师；visiting scientist 聘任）；Stanford 2001–2003 博后导师待核');
schoolWith(cc,gl);
const cca=audit(cc,[a('affiliation','Chicago 物理系、James Franck Institute、Enrico Fermi Institute。',['ccrole'],'confirmed'),a('research','超冷原子、量子模拟及多体物理。',['ccrole'],'confirmed'),a('postdoc',gn,['ccself','ccv','ccrole','ccjochim'],'confirmed_advisor')],'查 2001–2003 Stanford 博士后正式导师。两类 Innsbruck 职称与 Lise-Meitner 资助口径分别保留。');
relation(cc,cca,'postdoc',gr,'advisor',gn,ids('ccself','ccv','ccrole','ccjochim'),'grimm');
read(cc,'ccself','2005-07-08 本人日志具名 Rudi Grimm 为 former advisor，并在同页记录 Innsbruck Grimm 组研究。');
read(cc,'ccv','本人旧 CV 第 1 页列 Stanford 2001–2003 博士后及 2003–2005 Austrian Science Fund Lise-Meitner 博士后 fellow。');
read(cc,'ccrole','Chicago 物理系明确列 Stanford 和 University of Innsbruck 两段博士后研究。');
read(cc,'ccjochim','Grimm 组 Jochim 2004 本人论文第 179 页致谢，明确将 Cheng Chin 称为加入该组的博士后。');
fail(cc,'ccv26','本次本人 2026 CV 下载未取得可读内容，保留此前已经核对的 visiting scientist 聘任称谓。');
const pln='TU Delft QuTech Taminiau 实验室原页在 Alumni 的 Postdocs 栏具名 Benjamin Pingault。本人 CQE 履历分列 Harvard Marie Skłodowska-Curie 博后与其后 Delft 研究，现任 Argonne 材料科学及 Chicago CASE 附属科学家。Delft 博后组属明确，个人指导职衔待核。';
const pls=src(['QuTech Taminiau 组档','pb'],['Pingault 本人 CQE 履历','pbf']);
const tam='师承人物 - Tim H. Taminiau';
edge(bp,'Benjamin Pingault',tam,'Tim H. Taminiau','博士后课题组负责人','博士后课题组成员',pln,pls);
pl(bp,boundary,pln+' '+pls);
cell(bp,3,'Marko Lončar（Harvard 2019–2022 课题组）；Tim H. Taminiau（Delft 课题组）；个人指导职衔待核');
schoolWith(bp,pls);
const bpa=audit(bp,[a('affiliation','Argonne 材料科学部工作人员，Chicago CASE 附属科学家。',['pbf'],'confirmed'),a('research','固态自旋缺陷、量子材料与量子光子和纳米机械接口。',['pbf'],'confirmed'),a('postdoc',pln,['pb','pbf'],'group_or_candidate')],'查 Harvard 和 Delft 个人博士后任用／指导职衔，分别保留 Lončar 与 Taminiau 组属。');
relation(bp,bpa,'postdoc',tam,'group_leader',pln,ids('pb','pbf'),'taminiau');
read(bp,'pb','Taminiau 组校友原档在 Postdocs 专栏列 Benjamin Pingault。');
read(bp,'pbf','本人 CQE 履历核 Cambridge 博士、Harvard Marie Curie 博后及随后 Delft 研究，现任 Argonne、Chicago CASE。');
const ba='人员 - Stanford - Zhenan Bao - d573a8f0';
const aln='Stanford TomKat 2017 博后奖项原档具名 Amanchukwu 由 Zhenan Bao 指导，任期由两年资助和组履历核为 2017–2019。原档用 mentored by，按博士后阶段研究师长记录；正式 advisor 职衔仍待本人 CV 或任用档。';
const als=src(['Stanford TomKat 博后原档','atom'],['Bao 组履历','abao'],['Chicago PME','apr']);
updateEdge(aId,'Chibueze Amanchukwu',ba,'Zhenan Bao','博士后课题组','博士后课题组成员','博士后阶段研究师长','博士后阶段研究者',aln,als);
rewrite(pf(aId),x=>x.startsWith(boundary),()=>boundary+aln+' Cambridge 访问另列。 '+als);
cell(aId,3,'Zhenan Bao（Stanford TomKat 2017–2019 博士后阶段研究师长）');
schoolWith(aId,als);
const aa=audit(aId,[a('affiliation','Chicago PME、Argonne 联合任职。',['apr'],'confirmed'),a('research','电解质、电化学材料、离子输运。',['apr'],'confirmed'),a('postdoc',aln,['atom','abao','apr'],'group_or_candidate')],'继续查正式博士后 advisor 称谓，已确认 TomKat 期间具名研究指导。');
relation(aId,aa,'postdoc',ba,'stage_mentor',aln,ids('atom','abao','apr'),'bao');
read(aId,'atom','Stanford 2017 TomKat award 原档列 Chibueze Amanchukwu，并写由化工系 Zhenan Bao 指导，两年 fellowship。');
read(aId,'apr','Chicago PME 院系原档核 Stanford TomKat 博后、现任院系及材料研究。');
const aml=src(['Murugan 本人 2026 CV 第 1 页','murcv'],['Harvard 任内 CV 原件转载','murmirror']);
const amn='本人 2026 CV 分列 2009–2012 IAS 成员及同期 Rockefeller Leibler 组访问，之后 2012–2015 Harvard Brenner 组博士后。Harvard 任内 CV 转载另证三段日期及 Brenner 共同研究，未注明正式导师。';
pl(am,boundary,amn+' '+aml);
cell(am,3,'Michael P. Brenner（Harvard 2012–2015 博士后课题组）；此前 IAS 与 Rockefeller 任用另列');
schoolWith(am,aml);
audit(am,[a('postdoc',amn,['murcv','murmirror'],'group_or_candidate')],'查 Harvard Applied Mathematics 博士后任用具名指导；IAS 和 Rockefeller 访问保留为独立阶段。');
read(am,'murcv','本人 2026 CV 原档分列 2012–2015 Harvard Brenner 组博后、2009–2012 IAS 成员与 Rockefeller 访问。');
read(am,'murmirror','Harvard 任内本人 CV 转载明确入职年月及同 Brenner 合作研究。');
const pml=src(['Stanford 2016 奖项任用原档','pmf'],['Stanford 本人履历','pmbio'],['Chicago PME','pmrole']);
const pmn='Stanford 2016 Neurosciences Postdoctoral Scholar Award 具名 Steven Chu 为 sponsor，Stanford 及 Chicago 原履历确认博士后组属。sponsor 按该奖项职衔记录，正式博士后 advisor 待核。';
pl(pm,'- 博士后课题组：',pmn+' '+pml);
pl(pm,boundary,pmn+' '+pml);
cell(pm,1,'分子工程副教授；固态自旋、量子传感、量子生物物理');
cell(pm,3,'Steven Chu（Stanford 博后课题组负责人、2016 年项目 sponsor）');
schoolWith(pm,pml);
audit(pm,[a('affiliation','Chicago PME 副教授。',['pmrole'],'confirmed'),a('research','固态自旋、量子传感及量子生物物理。',['pmrole'],'confirmed'),a('postdoc',pmn,['pmf','pmbio','pmrole'],'group_or_candidate')],'查本人履历和 Stanford 博后正式 adviser 称谓，保留奖项 sponsor 原职衔。');
read(pm,'pmf','Stanford 2016 博士后资助原档，Peter Maurer 为 Postdoctoral Scholar，Steven Chu 为 Sponsor。');
read(pm,'pmrole','Chicago PME 列分子工程副教授及 Stanford Chu 组博士后研究，研究固态量子体系与传感。');
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0657_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0657_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0657_Chicago履历与博士后具名原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
