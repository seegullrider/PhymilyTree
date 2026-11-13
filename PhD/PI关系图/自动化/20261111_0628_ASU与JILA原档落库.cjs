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
 orig.audit_id='pi_archive_20261111_0628_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0628_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"asua":"https://news.asu.edu/b/20250818-asu-welcomes-new-leader-groundbreaking-compact-xray-laser-project","uoa":"https://physics.arizona.edu/people/arvinder-sandhu","jila":"https://www.colorado.edu/jila/kapteyn-murnane-group-members","kumar":"https://link.springer.com/article/10.1007/s12043-009-0095-7","ias":"https://www.ias.ac.in/article/fulltext/pram/073/01/0113-0155","mat":"https://asu.elsevierpure.com/en/persons/dmitry-matyushov/","mat2":"https://physics.asu.edu/researchgroup/dmitry-matyushov","mat3":"https://www.mccormick.northwestern.edu/research/computation-theory-soft-materials-center/events/","australia":"https://science.org.au/our-focus/history-australian-science/fellows-biographical-memoirs/john-maxwell-cowley-1923-2004","monash":"https://www.monash.edu/__data/assets/pdf_file/0020/3701243/Seminar-David-Smith-July-2024.pdf","smithPaper":"https://doi.org/10.1016/S0304-3991(75)80015-5","midas":"https://cores.research.asu.edu/sites/default/files/2024-11/venablesEtAl2005_MIDASProjectCowleysVision.pdf#page=2","hansma":"https://hansmalab.physics.ucsb.edu/allpaper.html","ponce":"https://physics.asu.edu/research/research-areas/nanoscience-and-materials-physics","concytec":"https://ctivitae.concytec.gob.pe/appDirectorioCTI/VerDatosInvestigador.do?id_investigador=83151","hihath":"https://news.engineering.asu.edu/welcome/josh-hihath/","hihathTh":"https://www.researchgate.net/publication/253040912_Methods_and_applications_in_single_molecule_electronics","cao":"https://chemistry.mit.edu/profile/jianshu-cao/","vothTrib":"https://web.mit.edu/jianshucaogroup/pdfdir/2024/cao217.5.pdf","vothFest":"https://chemistry.uchicago.edu/news/the-enduring-legacy-of-gregory-voth-a-beacon-of-innovation-and-mentorship-in-theoretical"};
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
const sa='c122d0a5',mt='c85d5694',ds='f02f1c99',dr='eb5d441a',po='99719779',hh='a18ed0a3',jc='a7d17766';
const sNote='Arizona 物理系旧履历明确 2005 年 TIFR 博士，ASU 2025 年访谈确认从 University of Arizona 转任 ASU CXFEL 主任；JILA 联合组校友表的 Arizona 去向为历史信息。';
pl(sa,boundary,sNote+' '+src(['Arizona 历史院系档','uoa'],['ASU 任职原档','asua']));
schoolWith(sa,src(['Arizona 历史院系档','uoa'],['JILA 联合组原档','jila']));
audit(sa,[a('affiliation','ASU 物理及 CXFEL 主任，University of Arizona 物理与光学为历史任职。',['asua','uoa'],'confirmed'),a('phd',sNote+' Kumar 2009 出版页仅可读摘要和引用，继续保留候选及 2004／2005／2006 的来源差异。',['uoa','kumar'],'group_or_candidate'),a('postdoc','JILA 联合组原档及历史任用仍支持 Kapteyn、Murnane 课题组，具名个人指导待查。',['jila','asua'],'group_or_candidate')],'继续查 TIFR 与 Mumbai 授位档、Kumar 原文致谢及 JILA 任用。JILA 名录的旧任职不覆盖 ASU。');
read(sa,'asua','ASU 2025 任命访谈说明此前在 University of Arizona 物理及光学任职，现任 CXFEL 主任。');
read(sa,'uoa','Arizona 物理系院系档列 2005 TIFR 博士。');
read(sa,'jila','Kapteyn–Murnane 联合组原档列 Arvinder Sandhu 与原 University of Arizona 去向。');
read(sa,'kumar','2009 年 Pramana 第 73 卷 113–155 页的出版社记录确认题录，正文需订阅；公开的摘要及参考文献未列具名正式指导关系。');
fail(sa,'ias','IAS 期刊候选原址不可访问，未取得 PDF 正文。');
const mNote='Northwestern 原讲座履历具名 Vienna University of Technology，区分 Lise Meitner fellowship 与随后受邀任教；ASU 系档与现行研究门户核物理、分子科学及极性液体界面、统计与计算凝聚态。';
pl(mt,boundary,mNote+' '+src(['Northwestern 讲座原档','mat3'],['ASU 物理系','mat2']));
cell(mt,3,'Vienna University of Technology（Lise Meitner 博后，Roland Schmid 候选）；Branka Ladanyi（Colorado State 课题组负责人）；Gregory A. Voth（Utah 阶段研究师长）');
schoolWith(mt,src(['Northwestern 讲座原档','mat3'],['ASU 研究门户','mat']));
audit(mt,[a('affiliation','ASU 物理系、分子科学学院及生物物理中心。',['mat','mat2'],'confirmed'),a('research','理论与计算凝聚态，极性液体和介电界面、非平衡统计物理。',['mat','mat2','mat3'],'confirmed'),a('postdoc',mNote+' Colorado State 与 Utah 两段已知组属及阶段指导沿用；Vienna 具名指导待档。',['mat3','mat'],'group_or_candidate')],'查 FWF 原 fellowship 任用，区分 Vienna 的研究指导与同期 Roland Schmid 合作；追 Kyiv 学位论文题页。');
read(mt,'mat3','2021 Northwestern 原讲座履历列 Vienna University of Technology 的 Lise Meitner fellowship 及受邀教授，2000 年入 ASU。');
read(mt,'mat','ASU 研究门户复核 ASU 当前研究任职。');
const dsNote='澳大利亚科学院 Cowley 传记列 1975 年 Smith 与 Cowley 合写两项透射电镜研究，早于 Smith 在 Melbourne 获物理博士。该时间、姓名、领域及共同研究提供待查线索；两人的院校安排及指导角色仍待论文，候选可信度低。';
const dsLinks=src(['澳大利亚科学院原传记与发表清单','australia'],['Monash 原履历','monash']);
const cow='师承人物 - John M. Cowley';
edge(ds,'David J. Smith',cow,'John M. Cowley','博士导师候选','博士导师候选关联人物',dsNote,dsLinks);
cell(ds,2,'University of Melbourne 1978；John M. Cowley（同期合著线索，低可信候选）');
schoolWith(ds,dsLinks);
const da=audit(ds,[a('phd',dsNote,['australia','monash'],'group_or_candidate'),a('postdoc','澳科学院传记记 Cambridge 博后，Monash 原档证 Cambridge 显微项目主任经历；个人指导仍待核。',['australia','monash'],'unresolved')],'查 Melbourne 博士论文签署页及 1970 年代培养安排，区别 Cowley 同期合作者与正式导师；查 Cambridge 项目任用原册。');
relation(ds,da,'phd',cow,'candidate',dsNote,ids('australia','monash'),'cowley');
read(ds,'australia','澳科学院 Cowley 传记具名 Melbourne 毕业的 Smith 从 Cambridge 博后进入 ASU，其发表清单列 1975 Smith–Cowley 同期合著。');
read(ds,'monash','Monash 讲者档列 1978 Melbourne 物理博士、1988 DSc、Cambridge 项目主任、ASU 物理及原子分辨显微。');
fail(ds,'smithPaper','出版社 DOI 原文无法读取；1975 合著书目由科学院原档独立可读。');
const drNote='MIDAS 原刊第 2 页明确 Drucker 为初始项目的 Post-doctoral Research Associate，仪器在 1988 年 6 月抵达。文中同段所称 Cowley 早期博士生是 Gary Hembree，须与 Drucker 区分。Cowley、Venables 的个别指导保留候选。';
pl(dr,boundary,drNote+' '+src(['项目同期亲历者原刊第 2 页','midas']));
schoolWith(dr,src(['MIDAS 原刊第 2 页','midas']));
audit(dr,[a('phd','Hansma 自有实验室发表清单可核 1980 年代合作，UCSB 学位导师仍为候选。',['hansma'],'group_or_candidate'),a('postdoc',drNote,['midas'],'group_or_candidate')],'查 UCSB 博士论文和 ASU 博后任用，MIDAS 项目任用已核，1987–1991 的完整起止待直接证据。');
read(dr,'midas','MIDAS 亲历者文第 2 页明确 Jeff Drucker 博士后研究员，初始队伍。前一行 Cowley 的博士生为 Gary Hembree。');
const pNote='ASU 物理系纳米科学与材料物理方向列表列 Fernando Ponce，保留 1981 Stanford 材料博士和产业履历的既有核查。Peru Concytec 本人条目原地址此次 500。';
pl(po,boundary,pNote+' '+src(['ASU 物理系原档','ponce']));
schoolWith(po,src(['ASU 物理系研究方向原档','ponce']));
audit(po,[a('affiliation','ASU 物理系纳米科学与材料物理方向。',['ponce'],'confirmed')],'用全名查 Stanford 学位论文原档、1981 学位档案；候选 Sinclair 继续待具名，Xerox 与 HP 工业研究任用分列。');
read(po,'ponce','ASU 物理系纳米科学与材料物理名单列 Fernando Ponce。');
fail(po,'concytec','Concytec 本人档原地址返回 500，未取得正文。');
const hNote='ASU 院系聘任稿分列 2008 EE 博士、ASU 博后、实验室经理与研究教授、UC Davis 11 年及返回 ASU 两项现任。本人发表的论文摘要只能核题名与分子输运，未见签署页。';
pl(hh,boundary,hNote+' '+src(['ASU 工学院原档','hihath'],['本人论文摘要','hihathTh']));
schoolWith(hh,src(['ASU 工学院原档','hihath']));
audit(hh,[a('affiliation','ASU 电气计算机与能源工程教授及 Biodesign 生物电子与传感中心主任。',['hihath'],'confirmed'),a('phd','ASU 2008 EE 博士与本人摘要核题名，正式导师仍待论文签署页。',['hihath','hihathTh'],'group_or_candidate'),a('postdoc',hNote+' 原 2008 同期采访的 Tao 组属保留。',['hihath'],'group_or_candidate')],'依完整题名查 ASU 学位论文原卷；继续查 Tao 的研究生及博士后指导原档。');
read(hh,'hihath','ASU 工学院核 2008 EE 博士、ASU 博后、实验室经理、研究教授及返回 ASU 的两项现任。');
const jNote='Voth 纪念原文将 Cao 具名为 Penn 阶段的 postdoc，并详述该段共同研究；Chicago 化学系报道也列 Cao 为旧组成员。现有 Voth 与 Kent R. Wilson 两段研究师长标签保留。';
pl(jc,boundary,jNote+' '+src(['MIT 托管纪念原文','vothTrib'],['Chicago 化学系','vothFest']));
schoolWith(jc,src(['Chicago 化学系','vothFest']));
audit(jc,[a('affiliation','MIT 化学系。',['cao'],'confirmed'),a('research','凝聚体系的量子动力学、分子聚集体与光谱。',['cao'],'confirmed'),a('postdoc',jNote,['vothTrib','vothFest'],'group_or_candidate')],'查 Penn 与 UC San Diego 两段博士后任用和正式导师字段。');
read(jc,'vothFest','Chicago 化学系在 Voth 组历届人员中具名 Jianshu Cao，补独立机构证据。');
read(jc,'vothTrib','Cao 等共同署名文章第 1 页称 Jianshu Cao 是 Voth 在 Penn 阶段的博士后。');
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0628_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0628_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0628_ASU与JILA任用和论文原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
