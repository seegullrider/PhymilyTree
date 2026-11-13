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
 const auditId='pi_archive_20261111_1047_'+id;
 if(orig.audit_id===auditId){audits.push(orig);return auditId;}
 orig.audit_id=auditId;
 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261111_1047_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
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

const compared=JSON.parse(fs.readFileSync('20261111_UConn典礼册导师名录_比对.json','utf8'));
const checks={
 '8ad406e5':['NTU 材料学院目录','https://www.ntu.edu.sg/mse/about-us/our-people/faculty-staff','NTU 二维材料 PI 的博士工作在中国国家纳米科学中心完成，UConn 项为环境政策经济学。'],
 '2fc11ca6':['Penn 本人访谈','https://penntoday.upenn.edu/news/penn-chemistry-delving-quantum-dots-0','Penn 的 Christopher B. Murray 于 1995 年获 MIT 化学博士，UConn 海洋学条目全名为 Christopher Shea Murray。'],
 '0dd9a2ca':['WashU 物理系','https://artsci.washu.edu/faculty-staff/xi-wang','WashU 的 Xi Wang 获 Florida State 物理学博士，UConn 项为骨骼再生生物医学博士。'],
 'b9b5a5fe':['USC 本人 CV','https://viterbi.usc.edu/directory/cv/wu_wei_cv.pdf#page=1','两人均做纳米材料。USC 的 Wei Wu 是 Princeton 2003 电气工程博士，导师 Stephen Y. Chou。UConn 项属 2018 年机械工程，具名 Michael T. Pettes。'],
 '0a1c7de2':['Wisconsin 本人 CV','https://nanoscience.engr.wisc.edu/wp-content/uploads/2024/07/cv_xdwang.pdf#page=1','两人均做半导体纳米材料。Wisconsin 的 Xudong Wang 是 Georgia Tech 2005 材料博士，UConn 项为化学，具名 Jing Zhao。'],
 '427c7cd9':['Rice 本人档','https://profiles.rice.edu/faculty/matthew-r-jones','Rice 的 Matthew R. Jones 在 Northwestern 获材料博士；UConn 英语学项全名为 Matthew Charles Jones。'],
 '18e9c257':['Michigan 物理系','https://lsa.umich.edu/physics/people/faculty/luli.html','Michigan 的 Lu Li 获 Princeton 物理博士，UConn 项为机械工程激光增材制造。'],
 '33e214fc':['UCLA 任用原档','https://samueli.ucla.edu/new-faculty-2024-2025/','UCLA 的 Md Shafayat Hossain 在 Princeton 获博士并完成博后。UConn 名字中间项分别为 Julfiker、Billal，学科分别为交通工程、生物医学工程。'],
 'a66d9ce2':['JHU 本人 2025 CV','https://krieger.jhu.edu/physics/wp-content/uploads/sites/11/2016/07/Yi_Li_CV_2025.pdf#page=1','JHU 的 Yi Li 在 UC San Diego 于 2013 年获物理博士，UConn 项为液晶弹性体方向的材料工程，具名 Xueju Wang。'],
 '1165a704':['CMU 电气与计算机工程系','https://ece.cmu.edu/directory/bios/zhang-xu.html','CMU 的 Xu Zhang 于 2017 年获 MIT EECS 博士，UConn 项为脑刺激方向的生物医学工程，具名 Sabato Santaniello。'],
 'cd12c234':['Rutgers 化学系本人履历','https://www.rutchem.rutgers.edu/jing-li-people/jing-li-bio-cv','Rutgers 的 Jing Li 是 Cornell 化学博士，UConn 项为统计学。'],
 '972b25fe':['NTU 本人 CV','https://personal.ntu.edu.sg/zhaoyang/CV.html','NTU 的 Yang Zhao 是 UC San Diego 1994 物理博士，UConn 项为量子点晶体管方向的电气工程，具名 Lei Wang。'],
 '4c711ae0':['Princeton 2011 博后报道','https://www.princeton.edu/news/2011/06/27/princeton-researchers-solve-problem-filling-space-without-cubes','ASU 的 Yang Jiao 2011 年已是 Princeton 材料研究博士后，UConn 2026 项为统计学、分位数回归。'],
 '77a958a7':['Yale 化学系','https://chem.yale.edu/profile/tianyu-zhu','Yale 的 Tianyu Zhu 在 2018 年获 MIT 化学博士，UConn 项为工业制造数据方向的电气工程，具名 Liang Zhang。']
};
const excluded=new Map();
for (const entry of compared.matches) {
 for (const candidate of entry.candidates) {
  const check=checks[candidate.id];
  if (!check) throw Error('unreviewed match '+candidate.id);
  const item={record_id:candidate.id, matched_as:candidate.matching, uconn_name:entry.name,
   uconn_program:entry.program, ceremony_year:entry.ceremony_year,pdf_page:entry.pdf_page,
   uconn_page:entry.url, current_pi_source:check[1], evidence:check[2], outcome:'different_person'};
  const list=excluded.get(candidate.id)??[];
  list.push(item); excluded.set(candidate.id,list);
 }
}
if ([...excluded.values()].flat().length!==18 || excluded.size!==14) throw Error('name matches changed');
const u={
 yiAdvisor:'https://keni.physics.ucsd.edu/students%2Bpostdocs.html',
 yiPcts:'https://pcts.princeton.edu/sites/g/files/toruqf1126/files/documents/Topoplogical%20Schedule-4.27.15.pdf',
 yiDept:'https://physics-astronomy.jhu.edu/directory/yi-li/',
 xuCV:'https://epoch.org.tw/younginnovatorsconf/wp-content/uploads/2022/12/Xu-Zhang_CV.pdf#page=1',
 mtl:'https://www.mtl.mit.edu/sites/default/files/attachments/frs_pubs_0.pdf',
 arg:'https://publications.anl.gov/anlpubs/2020/08/161660.pdf',
 psu:'https://news.engr.psu.edu/2021/lopez-daniel-kirigami-style-fabrication.aspx',
 lopez:'https://news.engr.psu.edu/2020/eecs-faculty-appointments.aspx',
 hossain:'https://sites.google.com/view/shafayat-hossain/home',
 princeton:'https://ece.princeton.edu/news/department-confers-21-phds-awards-integrated-systems-expert-best-dissertation',
 tianyu:'https://chemistry.mit.edu/chemistry-news/graduate-student-spotlight-tianyu-zhu/',
 tianyuPost:'https://www.tianyuzhu.org/tianyu-zhu'
};
const extra=new Map();
const yi='a66d9ce2', xu='1165a704', hossain='33e214fc', tianyu='77a958a7';
const yiNote='JHU 托管本人 2025 年 CV 第 1 页列 UC San Diego 物理博士（2013），Congjun Wu 为 Advisor，Kenneth Intriligator 为 Co-advisor。Intriligator 本人名录确认共同指导。CV 列 Princeton PCTS 2013–2016 Associate Research Scholar，导师本人名录亦称该任用为博后，PCTS 同期原件确认 fellowship。可见资料未具名该阶段导师。';
const yiSources=[checks[yi][1],u.yiAdvisor,u.yiPcts];
const yiLinks=source('JHU 2025 CV 第 1 页',yiSources[0])+' · '+source('Intriligator 本人名录',u.yiAdvisor)+' · '+source('Princeton 同期 fellowship 名录',u.yiPcts);
const wu='人员 - UC San Diego - Congjun Wu（UCSD 荣休） - 9e0468d5', ki='师承人物 - Kenneth Intriligator';
for (const [file,name] of [[wu,'Congjun Wu（UCSD 荣休）'],[ki,'Kenneth Intriligator']]){
 updateEdge(yi,'Yi Li',file,name,'博士导师','博士生','博士导师','博士生',yiNote,yiLinks);
}
rewrite(pf(yi),x=>x.startsWith(boundary),()=>boundary+yiNote+' '+yiLinks);
school(yi,'| 待核 |','| Princeton PCTS 2013–2016 研究员及博后经历已核，具名导师待核 |');
schoolSource(yi,' · '+yiLinks);
extra.set(yi,{
 changes:[['phd',yiNote,yiSources,'confirmed_advisor'],['postdoc',yiNote,yiSources,'unresolved']],
 next:'查 Princeton PCTS 的个人任命和参与课题负责人，核对独立 fellowship 是否附有导师。'
});
const xuMit='本人 CV 及 CMU 系页均列 MIT MTL 2017–2018 博士后。MIT MTL 2019 年报在 Tomás Palacios 的 Faculty Profile 下将 Xu Zhang 列入 Postdoctoral Associates。核到课题组及负责人，正式博士后导师职衔待原始聘用文件。';
const xuArg='Penn State 工学院明确称 CMU 的 Xu Zhang 曾在 Daniel López 指导的研究团队做博士后。Argonne FY2019 LDRD 原档列两人为项目 2018-111 研究者，本人 CV 列 2018–2019 Argonne Scholar。按 Argonne 阶段研究师长登记，正式称谓待查。';
const xuMentor='人员 - MIT - Tomás Palacios - 94fe88d9', lopez='师承人物 - Daniel López';
const mitLinks=source('MIT MTL 2019 年报',u.mtl)+' · '+source('CMU 系页',checks[xu][1]);
const argLinks=source('Penn State 工学院原报道',u.psu)+' · '+source('Argonne FY2019 LDRD 原档',u.arg)+' · '+source('本人 CV',u.xuCV);
mentor(lopez,'Daniel López','Penn State 电气工程与计算机科学教授，曾领导 Argonne CNM 纳米加工与器件组。研究包括微纳机电系统、光学微系统及纳米制造。',source('Penn State 任用档',u.lopez));
edge(xu,'Xu Zhang',xuMentor,'Tomás Palacios','博士后课题组负责人','博士后课题组研究者',xuMit,mitLinks);
edge(xu,'Xu Zhang',lopez,'Daniel López','博士后阶段研究师长','博士后阶段研究者',xuArg,argLinks);
rewrite(pf(xu),x=>x.startsWith(boundary),()=>boundary+'两段博士后阶段分别记录。MIT 本人 CV 与年报核对组属，Argonne Scholar 的研究师长由原实验室项目档和其团队后续报道交叉核对。正式导师职衔待聘用文件。 '+mitLinks+' · '+argLinks);
school(xu,'| 待核 |','| Tomás Palacios（MIT 2017–2018 课题组负责人）；Daniel López（Argonne 2018–2019 阶段研究师长） |');
schoolSource(xu,' · '+mitLinks+' · '+argLinks);
extra.set(xu,{
 changes:[['postdoc',xuMit+' '+xuArg,[u.mtl,u.psu,u.arg,u.xuCV,checks[xu][1]],'group_or_candidate']],
 next:'查 MIT MTL 博士后聘用及 Argonne Enrico Fermi Fellowship 档案，核对两段的正式指导职衔。'
});
extra.set(hossain,{changes:[['phd','Princeton ECE 届别公报列 Md. Shafayat Hossain，由 Mansour Shayegan 指导。',[u.princeton,u.hossain]],['postdoc','本人 Princeton 时期主页明确为物理系 M. Zahid Hasan 实验室 Postdoctoral Research Associate，UCLA 任用原档确认在 Princeton 完成博后。',[u.hossain,checks[hossain][1]]]]});
schoolSource(hossain,' · '+source('本人 Princeton 博后主页',u.hossain));
extra.set(tianyu,{changes:[['phd','MIT 化学系 2017 年本人访谈核 Troy Van Voorhis 组的博士研究身份；Yale 系档另说明研究受 Troy Van Voorhis 指导。MIT 学位论文正式导师栏待核。',[u.tianyu]],['postdoc','本人组页核 Caltech 的 Garnet Kin-Lic Chan 组博士后，Yale 化学系档列 2018–2021。按已证阶段研究师长保留。',[u.tianyuPost,checks[tianyu][1]]]]});
schoolSource(tianyu,' · '+source('MIT 博士阶段访谈',u.tianyu));
for (const [id, entries] of excluded){
 const [label,primary,evidence]=checks[id];
 const sourceLinks=[source(label,primary),...entries.map(e=>source('UConn '+e.ceremony_year+' 册第 '+e.pdf_page+' 页',e.uconn_page))].join(' · ');
 const review='UConn 典礼册同名核对。'+evidence+' '+sourceLinks;
 insertAfter(pf(id),'## 师承','\n- '+review);
 schoolSource(id,' · '+review);
 const prev=JSON.parse(last.get(id).details_json);
 const prior=prev.aspects.identity;
 const additional=extra.get(id);
 const ai=audit(id,[['identity',prior.note+' '+evidence,[primary,...entries.map(e=>e.uconn_page)]],...(additional?.changes??[])],additional?.next??prev.next_step);
 if(id===xu) {
  relation(xu,ai,'postdoc',xuMentor,'group_leader',xuMit,[u.mtl,checks[xu][1]],'mit');
  relation(xu,ai,'postdoc',lopez,'stage_mentor',xuArg,[u.psu,u.arg,u.xuCV],'argonne');
 }
 if(id===yi) {
  relation(yi,ai,'phd',wu,'advisor',yiNote,yiSources,'wu');
  relation(yi,ai,'phd',ki,'advisor',yiNote,yiSources,'intriligator');
 }
}
const pages=[
 {record_id:yi,url:checks[yi][1],raw:yiNote,excerpt:yiNote},
 {record_id:yi,url:u.yiAdvisor,raw:'Yi Li: (co-advised with Congjun Wu) PhD June 2013. Postdoc at Princeton Center for Theoretical Science.',excerpt:'Kenneth Intriligator 本人名录确认共同博士导师和 Princeton 博后。'},
 {record_id:xu,url:u.mtl,raw:'Tomás Palacios. POSTDOCTORAL ASSOCIATES. Xu Zhang, MTL.',excerpt:xuMit},
 {record_id:xu,url:u.arg,raw:'LDRD# 2018-111. Named Fellow. Bio-inspired Smart Soft-Robots. Investigators: Xu Zhang; Daniel Lopez.',excerpt:'Argonne 2019 项目原档核 Xu Zhang 与 Daniel López 的阶段及单位。'},
 {record_id:xu,url:u.psu,raw:'Xu Zhang from Carnegie Mellon University and Haogang Cai from New York University, both former postdoctoral fellows with Lopez.',excerpt:xuArg},
 {record_id:hossain,url:u.hossain,raw:'I am a postdoctoral research associate in Prof. Zahid Hasan’s lab in the Physics department at Princeton University.',excerpt:'本人 Princeton 阶段主页核 Zahid Hasan 组博士后。'},
 {record_id:tianyu,url:u.tianyu,raw:'Tianyu is a member of Professor Troy Van Voorhis’s group and discusses the doctoral research himself.',excerpt:'MIT 化学系 2017 年研究生访谈确认 Tianyu Zhu 组属与研究方向。'}
];
const reviewed={source:compared.source, school_records:compared.school_records,source_entries:compared.source_entries,
 matches:[...excluded.values()].flat(), note:'逐页人工核对原册的姓名、项目、导师栏。院校原始履历用于身份区分。'};
const luqiao='be7fb895';
const cv='https://spintronics.mit.edu/wp-content/uploads/2019/12/Biographical-Sketch-of-Luqiao-Liu120219.pdf';
const luqiaoEvidence='本人履历第 1 页列 Cornell 2012 年 8 月博士、IBM Watson 2012 年 7 月至 2015 年 8 月 Research Staff Member、MIT 2015 年 9 月起教职。按履历保留工业研究岗位，未见单列博士后，未发现具名博后导师。';
const luqiaoSource=source('MIT 托管的本人履历第 1 页',cv+'#page=1');
rewrite(pf(luqiao),x=>x.startsWith(boundary),x=>x.includes(luqiaoSource)?x:x+' '+luqiaoEvidence+' '+luqiaoSource);
school(luqiao,'| 待核 |','| IBM Research Staff Member（2012–2015）；未发现单列博士后 |');
schoolSource(luqiao,' · '+luqiaoSource);
audit(luqiao,[['postdoc',luqiaoEvidence,[cv+'#page=1'],'no_postdoc_documented']],
 '等待 Cornell 主机退避结束后重读学位原卷。若出现 IBM 初始任用文件，再核对是否另有博后任命。');
pages.push({record_id:luqiao,url:cv,raw:'Ph.D. in Applied Physics Aug 2012. 2012/07 to 2015/08 Research Staff Member, IBM Watson Research. 2015/09 to 2019/06 Assistant Professor, MIT.',excerpt:luqiaoEvidence});

const han='bed8f3b6', helena='bedce8f0';
const hanSrc='https://minghsiehece.usc.edu/wp-content/uploads/2019/03/Han-Wang-Research-Summary.pdf';
const helenaSrc='https://engineering.uconn.edu/faculty/ece/helena-silva/';
const bridgeExclusions=[
 {page_id:'90f3aa2a026014baad744eb1',record_id:han,url:'https://ece.illinois.edu/about/directory/grad-students/hanw14',
  external_subject:'Illinois ECE 人工智能和自主系统方向的研究生 Han Wang',
  evidence:'Illinois 现任研究生档列 Advisor Huan Zhang，方向人工智能和自主系统。USC 人物档的 Han Wang 为 MIT EECS 2013 博士与 USC 半导体器件 PI。'},
 {page_id:'bc3a2553b0f50c2469558f65',record_id:han,url:'https://ce.berkeley.edu/spotlight/3184',
  external_subject:'UC Berkeley 2025 级土木与环境工程博士生 Han Wang',
  evidence:'Berkeley 博士生报告原文介绍车联网交通研究与 2025 届土木博士身份，USC 本人系档对应 MIT 2013 博士及二维器件方向。'},
 {page_id:'2a4b83f7dcc5a4d7ff28fec6',record_id:helena,url:'https://independent.academia.edu/helenasilva15',
  external_subject:'Academia 应用语言学作品页的 Helena Silva',
  evidence:'已读档案显示其主要作品为葡萄牙语应用语言学和师资教育，未见 Cornell 学位、UConn ECE、相变存储或纳米电子关联。以 UConn 工学院本人档区分。'}
];
for(const [id,primary] of [[han,hanSrc],[helena,helenaSrc]]){
 const items=bridgeExclusions.filter(x=>x.record_id===id);
 const orig=JSON.parse(last.get(id).details_json);
 const evidence=items.map(x=>x.evidence).join(' ');
 const links=[source('本人院系档',primary),...items.map(x=>source('已排除同名页',x.url))].join(' · ');
 insertAfter(pf(id),'## 师承','\n- 同名网页核对。'+evidence+' '+links);
 schoolSource(id,' · '+evidence+' '+links);
 const auditId=audit(id,[['identity',orig.aspects.identity.note+' '+evidence,[primary,...items.map(x=>x.url)]]],orig.next_step);
 for(const item of items) item.audit_id=auditId;
}
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size, audits:audits.length, relations:relations.length, excluded:reviewed.matches.length, bridgeExclusions:bridgeExclusions.length, pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n','utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_1047_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261111_UConn典礼册导师名录_核对.json',reviewed);
const rf='20261111_1047_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const exclusionsFile='20261111_1047_桥接同名排除.json';
persist(exclusionsFile,bridgeExclusions);
call('人物网页身份纠偏.cjs',[exclusionsFile]);
const receipt='20261111_1047_UConn与阶段原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);

