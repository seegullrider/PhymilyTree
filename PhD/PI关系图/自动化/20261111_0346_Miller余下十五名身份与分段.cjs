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
 orig.audit_id='pi_archive_20261111_0346_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0346_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"roster":"https://millermembers.berkeley.edu/all.php?nav=46","ab":"https://dmse.mit.edu/people/faculty/iwnetim-abate/","cu":"https://mse.stanford.edu/people/yi-cui","cuk":"https://www.colorado.edu/lab/cuk/tanja-cuk","cukh":"https://www.fhi.mpg.de/2139330/2025-10-09-Tanja-Cuk","em":"https://sites.google.com/view/ejdavislab/team","emd":"https://uwaterloo.ca/institute-for-quantum-computing/events/quantum-innovators-science-and-engineering-3","emh":"https://www.hertzfoundation.org/people/emily-davis/","emg":"https://sites.google.com/stanford.edu/sslab/people/past-members","role":"https://miller.berkeley.edu/nominate-apply/miller-research-fellowship/reference-faculty-host-information","he":"https://engineering.yale.edu/research-and-faculty/faculty-directory/yu-he","hel":"https://sites.google.com/yale.edu/becton326/","jain":"https://chemistry.illinois.edu/jain","jainlab":"https://www.nanogold.org/prashant-jain","jain24":"https://chemistry.illinois.edu/news/2024-01-08/prashant-jain-invested-gl-clark-professor-physical-chemistry","khal":"https://chem.washington.edu/people/munira-khalil","kim":"https://www.physics.harvard.edu/people/facpages/kim","kimcv":"https://philipkim.scholars.harvard.edu/sites/g/files/omnuum7026/files/philipkim/files/kim_cv_11_17_2024.pdf","phillips":"https://physics.illinois.edu/people/directory/profile/dimer","sch":"https://engineering.jhu.edu/chembe/faculty/rebecca-schulman/","schcv":"https://schulmanlab.jhu.edu/wp-content/uploads/2020/08/schulman_master_cv_0619.pdf","sho":"https://cheme.stanford.edu/people/sho-takatori","shoi":"https://chemengr.ucsb.edu/news/magic-active-matter","dv":"https://www.physics.rutgers.edu/~dhv/cv.html","fw":"https://physics.berkeley.edu/people/faculty/feng-wang","ny":"https://www.physics.harvard.edu/people/facpages/yao","nycv":"https://www.physics.harvard.edu/files/physics/files/cv_yao_2022.pdf","az":"https://physics.stanford.edu/people/alfred-zong","azg":"https://www.zuerchlab.org/2020/09/01/welcome-alfred/","xccv":"https://xiechen.caltech.edu/documents/33775/CV_XC_1125.pdf"};
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




const rows=[{"id":"0210a4fa","keys":["ab"],"detail":"MIT DMSE 本人原档核 Stanford 博士及 Berkeley Miller、Presidential 两项博士后 fellowship，和名录 2021–2024 届别对上。奖期不直接视为在岗终年。","aff":"MIT 材料科学与工程系助理教授、John Chipman Career Development Professor。","research":"界面电化学、凝聚态、储能与层状材料离子插入的可调磁性和电子态。","guidance":"既有 Asta 博后共同导师及 Bediako PPFP 阶段师长保留，Miller 个人接待职衔待核。","state":"identity_verified_advisor_and_group_followup"},{"id":"a3f24027","keys":["cu"],"detail":"Stanford 材料院档为 Harvard 2002 博士的 Yi Cui，与 Miller 原名录的 Stanford Cui 组链接及既有本人 2003–2005 Berkeley 获奖原册相符。与 Chicago 的同名青年博士后分开。","aff":"Stanford 材料科学与工程、能源科学与工程、光子科学教授，化学兼任。","research":"纳米材料、二维材料、储能、电催化及低温电子显微。","guidance":"已核 Alivisatos 是 Miller 接收教师且本人称 postdoctoral mentor；保留阶段研究师长。","state":"identity_verified_host_stage_mentor"},{"id":"accdd77e","keys":["cuk","cukh"],"detail":"Colorado 组页直接列 Stanford 2007 应用物理博士、Berkeley Miller Postdoctoral Fellow 2007–2010；FHI 原档分别具名 Shen 与 Frei。2025 年 Fritz Haber 访问与博士后分列。","aff":"Colorado Boulder 化学副教授、RASEI Fellow，并任材料科学与工程项目副主任；FHI 原档另列 CEDARS 关联。","research":"超快光谱、电化学界面与表面催化反应。","guidance":"FHI 明确博士阶段 Zhi-Xun Shen 和博士后 under direction of Heinz Frei，维持两阶段明确导师。","state":"identity_verified_both_advisors","close":true},{"id":"a444e328","keys":["em","emd","emh"],"detail":"Waterloo 2022 本人原简介为 Berkeley Miller、Stanford 博士，Hertz 原个人档确认同一 NYU 物理教师与两个阶段。","aff":"NYU 物理系助理教授及 Center for Quantum Phenomena，当前本人组页具名 PI。","research":"量子光学、非局域自旋动力学及固态色心多体物理与磁测量。","guidance":"Waterloo 本人原文具名 hosted by Norman Yao。按 Miller 项目指导角色记录博士后阶段研究师长，保留组属、正式职衔未明。","state":"identity_verified_host_stage_mentor"},{"id":"46fe35b0","keys":["he","hel"],"detail":"Yale 院档明示 Stanford 应用物理博士、此前 Berkeley Miller，2019 获奖与名录 2019–2022 届别吻合。Yale 2020 年秋已入职，名录末年不作实际在岗终点；Stanford／SLAC 与 Berkeley 两段分列。","aff":"Yale 应用物理系助理教授、物理系额外任用。","research":"关联电子和量子材料，ARPES、X 射线散射与动量分辨探测。","guidance":"已核 Stanford／SLAC 的 Zhi-Xun Shen 博后阶段 mentor；Berkeley Miller 接待教师仍待核，Stanford 论文目录检索入口仅返回验证页。","state":"identity_verified_named_other_stage"},{"id":"107d0329","keys":["jain","jainlab","jain24"],"detail":"本人组页及 Illinois 原系档对上 Georgia Tech 博士、Harvard 早期博后与 Berkeley Miller 届别；Miller 名录 2008–2011 不与 Harvard 第一段合并。","aff":"UIUC G. L. Clark 物理化学教授；现系页明确材料科学与工程教授、MRL 教授；本人列 Physics 与 IQUIST affiliate。","research":"纳米光与物质作用、等离激元光谱、凝聚态纳米相变与纳米催化。","guidance":"既有 El-Sayed 博士导师、Berkeley Alivisatos 博后导师保持；Harvard Adam Cohen 以课题组负责人另列。","state":"identity_verified_advisor_and_group_followup"},{"id":"46ffc6f0","keys":["khal"],"detail":"UW 原系页核 MIT 2004 化学博士、Berkeley 和 LBNL 的 Miller 博后及 2007 年 9 月入 UW；名录 2003–2006 的早期年度与授位原档并列。","aff":"UW 化学系 Leon C. Johnson Professor。","research":"电子、振动及溶剂自由度耦合与电荷／能量转移，物理化学和超快光谱。","guidance":"2003 获奖原册接收教师 Charles Shank 继续按阶段研究师长；LBNL 是否独立任用及共同指导待核。","state":"identity_verified_host_stage_mentor"},{"id":"be1d4c3b","keys":["kim","kimcv"],"detail":"Harvard 原系页及本人 2024 CV 首页核 1999 Harvard 应用物理博士、Berkeley 1999–2001 Miller 博后，2023 visiting Miller 与早期博后分列。","aff":"Harvard 物理及应用物理教授。","research":"低维和纳米结构凝聚态、二维范德华材料、介观量子输运与热输运。","guidance":"本人 CV 第 42 页分别明列 Graduate Student Advisor Charles M. Lieber、Postgraduate-Scholar Sponsor Paul L. McEuen。后者保留原 sponsor 称谓，具体个人研究指导待原任用。","state":"identity_verified_sponsor_role_pending"},{"id":"1ff9f7d8","keys":["phillips"],"detail":"Illinois 系档核 1982 UW 博士、Miller 后 1984 加入 MIT、1993 入 Illinois；同页奖项栏写 Miller 1981–1984，与项目原名录 1982–1984 起年不一致，两个原口径均保留。","aff":"Illinois 物理系教授及 Bliss Faculty Scholar；旧其他关联不由单一系页省略而删除。","research":"理论凝聚态、无序和强关联低维输运、Mott 物理及高温超导。","guidance":"Orlando Alvarez 保留博士后阶段学习指导候选，未由 Miller 日期或同署名升级。","state":"identity_verified_candidate_pending"},{"id":"0dda7509","keys":["sch","schcv"],"detail":"本人 CV 明确 Caltech 2001–2007 博士、Caltech 2007-06 至 2008-08 Postdoctoral Scholar，以及 Berkeley 2008-09 至 2011-08 Miller Fellow，后段与原名录对上。","aff":"JHU 化学与生物分子工程教授，化学和计算机科学为 secondary appointments。","research":"自组装、软物质与响应性材料。","guidance":"博士导师 Winfree 由本人 CV 明示，Caltech 博后 Winfree 是 Sponsor；Berkeley Liphardt 在 CV 是 Sponsor，既有会议 advisor 记录保留待独立核原文。","state":"identity_verified_advisor_and_sponsor_followup"},{"id":"62b53034","keys":["sho","shoi"],"detail":"Stanford 院档核 Caltech 2017 博士和 Berkeley Miller 2020 完成；UCSB 本人访谈明确两阶段导师。Miller 2017–2020 届别与原履历相符。","aff":"Stanford 化学工程副教授；2022 UCSB 访谈的教职是历史任用。","research":"活性物质、复杂流体、软材料与跨尺度显微、理论和计算。","guidance":"UCSB 本人原话具名 John Brady 为 Caltech 博士导师、Daniel Fletcher 为 Berkeley 博后导师。Stanford Eric Shaqfeh 的 scientific mentor 另列为后续研究交流，原访谈未列博士后职衔。","state":"identity_verified_both_advisors","close":true},{"id":"08306a21","keys":["dv"],"detail":"本人 Rutgers CV 核 1981 MIT 物理博士，随后 Berkeley Miller 博后约三年、1984 入 Harvard。名录 1981–1983 与本人实际约 1981–1984 履历分别保留。","aff":"Rutgers 物理与天文学系 Board of Governors Professor，本人 CV 记 1991 年起任教。","research":"计算材料理论、电子结构、Wannier 函数、Berry 相与氧化物极化。","guidance":"Berkeley Steven G. Louie 的同期论文合作仍仅为博后指导候选。","state":"identity_verified_candidate_pending"},{"id":"f6ff5120","keys":["fw"],"detail":"Berkeley 物理原系页核 Columbia 2004 博士、2005–2007 Miller 及 2007 秋入系；Miller 名录 2005–2008 届别单列，不与 2021–2022 Miller Professor 混淆。","aff":"Berkeley 物理教授，超快纳米光学研究组。","research":"凝聚态光与物质作用、纳米结构与界面激发态、先进激光光谱。","guidance":"既有 Yuen-Ron Shen 博后课题组负责人保留，任用的正式 advisor 待查。","state":"identity_verified_group_leader"},{"id":"87e368dd","keys":["ny","nycv"],"detail":"本人 Harvard CV 及当前原系页核 2014 Harvard 博士、Berkeley Miller 后 2017 入 Berkeley 教职。本人任用 2014–2016 与项目届别 2014–2017 并列。","aff":"Harvard 物理系教授，2022 年起本人 CV 记录。","research":"AMO、凝聚态与量子信息，非平衡多体、Floquet、拓扑及量子传感。","guidance":"本人 CV 首页明确 Mikhail D. Lukin 为博士导师；Weitz 是更早本科／硕士段。Berkeley Vishwanath 组属留原档，Miller 项目具名 host 仍待核。","state":"identity_verified_group_leader"},{"id":"f0b26075","keys":["az","azg"],"detail":"Stanford 物理原系页核 MIT 2020 物理博士与当前任用，Zuerch 组 2020-09-01 原公告具名 Alfred Zong 为 Miller 支持的组内博士后，名录届别 2020–2023。","aff":"Stanford 物理系与应用物理系助理教授。","research":"光诱导非平衡量子材料、超快电子衍射／显微与时间分辨谱。","guidance":"Michael Zuerch 的博士后组属已核，原组公告未明示个人正式 advisor。","state":"identity_verified_group_leader"}];
const pages=[];
const em='a444e328', y='人员 - Harvard - Norman Yao - 87e368dd';
const emNote='Waterloo 2022 本人原简介明确 Berkeley Miller fellowship hosted by Norman Yao。Miller 现行制度明确 Host 具有研究指导责任；Hertz 本人原档确认两人合作及具体博后方向，旧 Stanford 校友页的组属依据保留。按博士后阶段研究师长记录，保留原 Host 称谓，未推定历史 primary supervisor 或正式 advisor。';
updateEdge(em,'Emily Davis',y,'Norman Yao','博士后课题组负责人','博士后课题组成员','博士后阶段研究师长','博士后阶段研究者',emNote,src(['Waterloo 本人原简介','emd'],['Miller 角色制度','role'],['Hertz 个人档','emh'],['既有 Stanford 组档','emg']));
cell(em,3,'Norman Yao（Berkeley 2020–2023 Miller 届别，Host／博士后阶段研究师长）');
for(const x of rows){
 const orig=JSON.parse(last.get(x.id).details_json);
 const links=x.keys.map(k=>source('原档',u[k])).join(' · ');
 const changes=[a('identity',x.detail,[...x.keys,'roster'],'confirmed'),a('affiliation',x.aff,x.keys,'confirmed'),a('research',x.research,x.keys,'confirmed')];
 const oldPost=orig.aspects.postdoc;
 changes.push(a('postdoc',x.id===em?emNote:oldPost.note+' '+x.guidance,x.id===em?[...x.keys,'role']:x.keys,x.id===em?'group_or_candidate':oldPost.status));
 if(x.id==='62b53034')changes.push(a('phd','本人在 UCSB 受访时明确具名 Caltech 博士导师 John Brady，保留 Caltech 学位档佐证。',['shoi'],'confirmed_advisor'));
 if(x.id==='87e368dd')changes.push(a('phd','本人 Harvard CV 首页在 2014 物理 PhD 条目明确 Adviser: Mikhail D. Lukin。David A. Weitz 对应此前学位，阶段分列。',['nycv'],'confirmed_advisor'));
 const aid=audit(x.id,changes,x.close?'已核明确博士导师与博士后导师、身份、现职及方向；后续按新任用或具体新证据增量更新。':orig.next_step);
 if(x.close||orig.followup_required===false)audits.at(-1).followup_required=false;
 insertAfter(pf(x.id),'## 师承','\n- Miller 名录核对：'+x.detail+' '+x.guidance+' '+links+' · '+src(['Miller 历届原名录','roster']));
 schoolWith(x.id,links);
 for(const k of x.keys)pages.push({record_id:x.id,url:u[k],raw:x.detail+' '+x.aff+' '+x.research+' '+x.guidance,excerpt:x.detail+' '+x.guidance});
 if(x.id===em)relation(x.id,aid,'postdoc',y,'stage_mentor',emNote,ids('emd','emh','role','emg'),'yao');
 if(x.id==='62b53034'){
  relation(x.id,aid,'phd','人员 - Caltech - John F. Brady - bafbf57a','advisor','本人 UCSB 访谈具名 Caltech 博士导师。',ids('shoi'),'brady');
  relation(x.id,aid,'postdoc','师承人物 - Daniel Fletcher','advisor','本人 UCSB 访谈具名 UC Berkeley 博士后导师。',ids('shoi'),'fletcher');
 }
}
pages.push({record_id:em,url:u.role,raw:'Miller 原制度明确 Host 承担研究指导，primary Host 为校内系统 supervisor；不倒推过去的实际人事登记。',excerpt:'与具名本人档对照指导职责，仍区分 Host 和正式 advisor。'});
for(const[record_id,url,error]of[
 ['0210a4fa','https://abatelab.mit.edu/','502 Bad Gateway；改核 MIT DMSE 现任院系原档。'],
 [em,'https://as.nyu.edu/faculty/emily-davis.html','405 Method Not Allowed；改核本人组页、同期 Waterloo 个人简介及 Hertz。'],
 ['f0b26075','https://zonglab.stanford.edu','400 Timeout fetching；改核 Stanford 现任系页与 Zuerch 原组公告。'],
 ['46fe35b0','https://searchworks.stanford.edu/?q=%22He%2C%20Yu%22&search_field=search','页面返回人机验证／JavaScript 安全提示，没有公开目录结果；原 PDF／签署页仍待另寻，不反复提交此查询。']
])pages.push({record_id,url,error});
unit('86f39155','Xie Chen','Walter Burke Institute for Theoretical Physics','2025 年 8 月起任该所所长，并任 Caltech Eddleman 理论物理教授。',src(['本人 CV','xccv']));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0346_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0346_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0346_Miller余下十五名身份与分段回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
