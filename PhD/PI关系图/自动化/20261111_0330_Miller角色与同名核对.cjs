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
 orig.audit_id='pi_archive_20261111_0330_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0330_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"role":"https://miller.berkeley.edu/nominate-apply/miller-research-fellowship/reference-faculty-host-information","lake":"https://miller.berkeley.edu/people/ethan-lake","reidy":"https://miller.berkeley.edu/people/kate-reidy","molly":"https://miller.berkeley.edu/people/molly-mcfadden","hart":"https://hartwig.cchem.berkeley.edu/members/Molly_McFadden","m25":"https://miller.berkeley.edu/images/events/allEvents/2025_SYMPOSIUM_PROGRAM_052225.pdf","niroui":"https://niroui.mit.edu/farnaz-niroui-bio/","n17":"https://miller.berkeley.edu/images/newsletters/Spring2017_MillerNewsletter4.6.17Final.pdf","mit18":"https://www.mtl.mit.edu/news/farnaz-niroui-new-assistant-professor-eecs-and-new-core-member-mtl","kspot":"https://mse.stanford.edu/news/kate-reidy-faculty-spotlight","lnews":"https://physics.berkeley.edu/news/three-trailblazing-scientists-join-faculty-2027-and-2028","ldir":"https://physics.berkeley.edu/people/ethan-lake","roster":"https://millermembers.berkeley.edu/all.php?nav=46","mrpm":"https://www.ampere-society.org/books/MRPM15.pdf","iowawu":"https://sites.google.com/view/yuewugroup/home/principal-investigator","ucsb":"https://www.chem.ucsb.edu/people/yang-yang","uclacv":"https://yylab.seas.ucla.edu/CV%202018%20YY.pdf"};
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
const roleNote='Miller 现行正式项目说明明确 Faculty Host 承担指导、研究进展讨论及年度反馈，并规定 primary Host 是校内系统 supervisor。该制度说明作为指导角色的补充证据，保留原 Faculty Host 称谓；不据此判断历史任期的主次导师或人事登记。';
const hosts=[
 ['da6ae25a','Ethan Lake','人员 - UC Berkeley - Ehud Altman - ed927ac7','Ehud Altman','博士后 host','博士后研究者','lake','2023–2026 Miller 个人档具名 Ehud Altman 与 Mike Zaletel 为 Hosts。'],
 ['da6ae25a','Ethan Lake','人员 - UC Berkeley - Mike Zaletel - 5cc7a0b0','Mike Zaletel','博士后 host','博士后研究者','lake','2023–2026 Miller 个人档具名 Mike Zaletel 与 Ehud Altman 为 Hosts。'],
 ['597b55ed','Kate Reidy','人员 - UC Berkeley - Andrew Minor - 9bb1782b','Andrew Minor','博士后 host','博士后研究者','reidy','Miller 个人档具名 Andrew Minor 与 Michael Crommie 为 Hosts；Stanford 本人访谈独立叙述在 Berkeley 与二人做博士后研究。2024–2027 是项目原定届别，不作实际在岗终止年。'],
 ['597b55ed','Kate Reidy','人员 - UC Berkeley - Michael Crommie - d0d635fd','Michael Crommie','博士后 host','博士后研究者','reidy','Miller 个人档具名 Michael Crommie 与 Andrew Minor 为 Hosts；Stanford 本人访谈独立叙述与二人的博士后研究。2026 年已在 Stanford 任教，与 Miller 原定届别分列。'],
 ['b58a15e0','Molly McFadden（2027 年计划到任）','师承人物 - John F. Hartwig','John F. Hartwig','博士后 host','博士后 host 接收者','m25','已有可靠 2025 Miller 原名单具名 John Hartwig 为 Host；本次可读 Hartwig 组个人档核 2023 年 8 月入组，Miller 本人档核 2023–2026 博后届别。原名单本次 404，不声称重新读到。'],
 ['b9df5547','Farnaz Niroui','人员 - University of Chicago - Paul Alivisatos - 9209cf4f','Paul Alivisatos','博士后阶段接收教师','博士后阶段研究者','n17','已有可靠 2017 Miller 名单具名 Paul Alivisatos 为 Faculty Host，原名单本次 404。本人 MIT 履历及 2018 入职公告核 Berkeley Miller 博后后于 2018 年 11 月入 MIT。现行项目说明不能单独证明 2017 年校内 supervisor 的人事登记。']
];
const idsHost=[...new Set(hosts.map(x=>x[0]))];
for(const id of idsHost){
 const hs=hosts.filter(x=>x[0]===id), key=hs[0][6], extra=id==='597b55ed'?['kspot']:id==='b58a15e0'?['hart','molly']:id==='b9df5547'?['niroui','mit18']:[];
 const evidence=hs.map(x=>x[7]).join(' ')+' '+roleNote+' 以阶段研究师长记录，指导关系可信度高，正式主次及历史人事职衔待核。';
 const changes=[a('postdoc',evidence,[key,'role',...extra],'group_or_candidate')];
 if(id==='da6ae25a')changes.push(a('affiliation','Berkeley 名录当前显示 Assistant Professor，而 2026 年 9 月学校公告说 2027／2028 年加入，Miller 档为 2023–2026 alumni；任命生效日期继续核对，保留未来任职边界。',['ldir','lnews','lake'],'uncertain'),a('research','量子物质理论、非平衡多体及量子信息。',['lake','lnews'],'confirmed'));
 if(id==='597b55ed')changes.push(a('affiliation','Stanford 本人访谈确认已入职材料科学与工程系助理教授，Miller 2024–2027 为原定届别，不能延至 2027 视作仍在 Berkeley 任职。',['kspot','reidy'],'confirmed'),a('research','原位透射电镜、二维与量子材料原子尺度生长及电光外场调控。',['kspot','reidy'],'confirmed'));
 if(id==='b9df5547')changes.push(a('affiliation','本人现任 MIT 电气工程与计算机科学系副教授；MIT 任用公告核 2018 年 11 月入职。',['niroui','mit18'],'confirmed'),a('research','原子尺度器件、材料动态控制及计算、存储、感知与换能。',['niroui'],'confirmed'));
 const aid=audit(id,changes,id==='597b55ed'?'继续核 MIT 博士论文签署页；查两位 Miller Hosts 的主次及实际 fellowship 结束日期。':id==='da6ae25a'?'核 Berkeley 未来任命生效日期和两位 Hosts 中的 primary designation。':id==='b9df5547'?'追 2017–2018 任用原档的主导师登记，保留已核 Faculty Host 与现行制度证据的年代区分。':'保持 2027 年 1 月未来任职标签；追 Miller 原任用文件的 primary Host designation。');
 for(let j=0;j<hs.length;j++){
  const [rid,n,mf,mn,oldF,oldB,k,ev]=hs[j],keys=[k,'role',...extra];
  const note=ev+' '+roleNote+' 指导关系可信度高，按博士后阶段研究师长记录。';
  const links=keys.map(k=>source(k==='role'?'Miller 角色制度':k===key?'原始名录／个人档':'本人及院系原档',u[k])).join(' · ');
  updateEdge(rid,n,mf,mn,oldF,oldB,'博士后阶段研究师长','博士后阶段研究者',note,links);
  relation(rid,aid,'postdoc',mf,'stage_mentor',note,ids(...keys),'host'+j);
 }
 rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+evidence+(id==='da6ae25a'?' 未来入职与已显示的教师目录分列，具体任命生效日期待核。':id==='597b55ed'?' MIT 博士论文正式导师签署页仍待核。':id==='b58a15e0'?' Stanford 任命 2027 年 1 月生效，保留计划到任标签。':' 2017 原名单保留可靠历史核读，未以本次失败覆盖。'));
 cell(id,3,hs.map(x=>x[3]+'（Miller Faculty Host／博士后阶段研究师长）').join('；'));
 schoolWith(id,src(['Miller 角色制度','role'],['本人／名录',''+(id==='b9df5547'?'niroui':id==='b58a15e0'?'hart':key)]));
 pages.push({record_id:id,url:u.role,raw:roleNote,excerpt:'制度原文明确 hosts 的指导与 primary Host 的 supervisor 责任；未据现行制度反推历史主次。'});
}
const y='e3f03b12',yn='Yue Wu',st='师承人物 - André Stesmans',pi='师承人物 - Alexander Pines';
const phd='已下载并视觉核对 MRPM15 原会议文集 PDF 第 50 页，UNC NMR 研究者本人简介明确 1987 年 12 月 KU Leuven 物理博士在 Andre Stesmans 指导下完成（under the supervision）。博士导师可信度高。';
const pd='同页本人简介明确 1988–1991 在 Berkeley 化学系任博士后研究助理并与 Alex Pines 工作。阶段、单位和姓名均已核对，Pines 由阶段不明候选改为博士后阶段研究师长；指导关系可信度高，原文未明示正式 advisor 职衔。';
const dis='会议原文对应 UNC 1991 年入职、KU Leuven 1987 博士及 NMR；与 Iowa State 的 Harvard 2006 化学博士、2006–2009 Miller Fellow 同名 Yue Wu 为两人。排除后者名录误配，不将 Alivisatos 关系写入本页。';
updateEdge(y,yn,st,'André Stesmans','博士候选关系','博士候选研究者','博士导师','博士生',phd,src(['MRPM15 本人简介第 50 页','mrpm']));
updateEdge(y,yn,pi,'Alexander Pines','博士后候选关系','博士后候选研究者','博士后阶段研究师长','博士后阶段研究者',pd,src(['MRPM15 本人简介第 50 页','mrpm']));
rewrite(pf(y),x=>x.startsWith(boundary),()=>boundary+phd+' '+pd+' '+dis+' '+src(['原会议文集','mrpm'],['另一位 Yue Wu 本人简历','iowawu']));
cell(y,2,'André Stesmans（KU Leuven 1987 博士导师）');cell(y,3,'Alexander Pines（Berkeley 1988–1991 博士后阶段研究师长）');schoolWith(y,src(['MRPM15 原会议文集第 50 页','mrpm'],['Iowa State 同名区分','iowawu']));
const ya=audit(y,[a('identity',dis,['mrpm','iowawu'],'confirmed'),a('phd',phd,['mrpm'],'confirmed_advisor'),a('postdoc',pd,['mrpm'],'group_or_candidate'),a('research','MRPM15 本人报告核 NMR 检测等温吸附、MOF 与多孔介质中的分子及宏观物性关系。',['mrpm'],'confirmed')],'继续核 Pines 在 1988–1991 的正式博士后指导职衔，保持与 Iowa State 同名者的区分。');
relation(y,ya,'phd',st,'advisor',phd,ids('mrpm'),'stesmans');relation(y,ya,'postdoc',pi,'stage_mentor',pd,ids('mrpm'),'pines');
const yang='71c8ac33';
const yangdis='Miller 历届名录 Yang Yang 的个人链接指向 UCSB 化学系；该系原文为 MIT 2016 有机化学博士、Buchwald 研究生指导及 Caltech Arnold 博后，与本库 UCLA 的 UMass Lowell 1992 博士、Kumar 和 Tripathy 指导者为两人。不得按同名把该 Miller 届别或 Hosts 合入本页。';
insertAfter(pf(yang),'## 师承','\n- 同名排除：'+yangdis+' '+src(['Miller 原名录','roster'],['UCSB 同名教师档','ucsb'])+' 本页 UCLA 博士履历依据原已核本人 CV 保留。');
schoolWith(yang,src(['排除 UCSB 同名','ucsb']));
audit(yang,[a('identity',yangdis,['roster','ucsb','uclacv'],'confirmed')],'继续核 UCLA Yang Yang 在 UC Riverside 博后原任用的正式指导职衔，勿与 UCSB 同名记录合并。');
const success=[
 ['da6ae25a','lake','Miller 原个人档：2023–2026 Physics，Hosts Altman、Zaletel，MIT 博士。'],
 ['da6ae25a','lnews','Berkeley 2026 年 9 月公告称三位教师于 2027 和 2028 年加入，Lake 结束 Miller 后入职。'],
 ['da6ae25a','ldir','Berkeley 当前个人目录显示 Assistant Professor；与未来任用公告日期继续核对。'],
 ['597b55ed','reidy','Miller 原个人档：2024–2027 MSE，Hosts Andrew Minor、Michael Crommie，MIT 博士。'],
 ['597b55ed','kspot','Stanford 本人访谈明确现任材料系助理教授、此前与 Minor 和 Crommie 做 Miller 博后；原位电镜、量子材料。'],
 ['b58a15e0','molly','Miller 原个人档列 2023–2026 Kathryn A. Day Miller Postdoctoral Fellow，Chemistry；当前页未列 Host。'],
 ['b58a15e0','hart','Hartwig 组本人简介明确 2023 年 8 月入组，在聚烯烃后聚合催化功能化领域做研究。'],
 ['b9df5547','niroui','MIT 本人原始简历确认 EECS 副教授，此前 Berkeley Miller 博后，现做原子尺度器件与材料控制。'],
 ['b9df5547','mit18','MIT 2018 年 12 月原入职公告明确 2018 年 11 月加入 EECS，之前任 Berkeley Miller 博后。'],
 [y,'mrpm',phd+' '+pd+' 本地 PDF SHA-256 c22eb549929bd5f511e9d00a2bc83937ba2aad6256f3a3f25ead1432c2618e91，已视觉核第 50 页，完整文件 159 页。'],
 [y,'iowawu','Iowa State 本人原简介：Harvard 2006 化学博士，Berkeley Miller 2006–2009；与 UNC NMR 研究者不同人。'],
 [yang,'ucsb','UCSB 院系原文对应 MIT 2016 有机化学博士、Buchwald 指导及 Arnold 博后，不是 UCLA 同名教授。']
];
for(const [record_id,k,raw]of success)pages.push({record_id,url:u[k],raw,excerpt:raw.slice(0,700)});
for(const[record_id,url,error]of[
 ['b9df5547',u.n17,'本次直接读取 404；保留已有可靠 Faculty Host 记录，不覆盖历史成功核读。'],
 ['b9df5547','https://miller.berkeley.edu/images/events/allEvents/2018--SYMPOSIUM-PROGRAM.pdf','404，当前已核任用用 MIT 入职原文佐证。'],
 ['b9df5547','https://alivisatoslab.uchicago.edu/alumni/','502 Bad Gateway，未取得校友原名单；不使用搜索摘要建边。'],
 ['b58a15e0',u.m25,'本次直接读取 404；此前可靠名录记录保留，当前 Hartwig 个人原档核组属。'],
 ['b58a15e0','https://miller.berkeley.edu/images/newsletters/Spring2023_digital.pdf','404，当前 Miller 本人页未具名 Host，保留历史核读。'],
 ...[['0210a4fa','iwnetim-abate'],['d71af7c3','soonwon-choi'],['a444e328','emily-davis'],['46fe35b0','yu-he'],['114ae273','xueyue-sherry-zhang'],['f0b26075','alfred-zong']].map(([id,s])=>[id,'https://miller.berkeley.edu/people/'+s,'网页工具未能访问该个人页入口；待追原年度名录或本人履历，不以猜测的 slug 或搜索摘要确证关系。'])
])pages.push({record_id,url,error});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0330_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0330_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0330_Miller角色与同名核对回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
