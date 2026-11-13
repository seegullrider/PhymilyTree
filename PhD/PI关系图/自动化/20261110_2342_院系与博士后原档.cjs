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
 orig.audit_id='pi_archive_20261110_2342_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2342_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"sc":"https://www.gsas.columbia.edu/news/dissertations-february-10-2020","sv":"https://umdphysics.umd.edu/images/CV/2023/Sternbach_CV.pdf","su":"https://umdphysics.umd.edu/about-us/news/department-news/new-s24.html","rv":"https://ptacts.uspto.gov/ptacts/public-informations/petitions/1471857/download-documents?artifactId=m5gLH8irtHjK1hgixSKmCO3sHgBJ6uWxYzIbN57tXdDw7D63OYIU2B4","rv2":"https://ptacts.uspto.gov/ptacts/public-informations/petitions/1471855/download-documents?artifactId=3UL979MRm0YB9ur5RIDUa3GF_LAmrbugECmVIzMwecsnofYzwfnFCTo","rc":"https://news.uchicago.edu/story/hellmut-fritzsche-experimental-physicist-who-explored-materials-led-flat-screen-displays-1927","ru":"https://mse.umd.edu/clark/faculty/709/gary-rubloff","ce":"https://engineering.yale.edu/research-and-faculty/faculty-directory/hui-cao","cp":"https://physics.yale.edu/people/faculty","cv":"https://www.eng.yale.edu/caolab/CV_Cao.pdf","cl":"https://www.eng.yale.edu/caolab/PI.html","ci":"https://www.eng.yale.edu/caolab/papers/LFW16.pdf","cy":"https://yoshihisa.people.stanford.edu/people","ck":"https://researchportal.hkust.edu.hk/en/persons/hui-cao/","iu":"https://materials-science.institute.uconn.edu/person/ilya-sochnikov/","ib":"https://superconductivity.biu.ac.il/node/412","ip":"https://web.stanford.edu/group/moler/grouptheses/bert_thesis.pdf","it":"https://superconductivity.biu.ac.il/files/superconductivity/thesis_ilya_sochnikov_15may2011_final.pdf","wu":"https://ece.umd.edu/news/story/edo-waks-joins-ece-faculty","wv":"https://stanford.edu/~jela/jv_files/vuckovic_CV.pdf","wn":"https://www.nii.ac.jp/pi/n1/1_5.pdf","wd":"https://pdfroom.com/books/quantum-information-processing-with-non-classical-light-stanford/bWx5aLe82BJ"};
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
const [s,r,c,i,w]=['549969af','552dbb0a','55b5f8d9','b3036a40','a324db68'];
const basov=records.get('ff867a7c').filename;
const sd='Columbia 研究生院 2020 答辩条目列 Sternbach 的 Dynamics of quantum materials at the nanoscale 及 Sponsor Dmitri Basov。本人 UMD 托管 CV 将 Basov 列作博士阶段 PI。可信度高。';
const sp='本人 CV 列 Columbia 2020–2023 博士后。Maryland 物理系本人采访明确说毕业后继续与 Basov 做博士后研究，研究极化激元与超快近场。按博士后阶段研究师长记录，正式聘任导师职衔待核。';
const slk=src(['Columbia 研究生院论文答辩','sc'],['本人 UMD CV','sv'],['Maryland 本人采访','su']);
updateEdge(s,'Aaron Sternbach',basov,'Dmitri N. Basov','博士导师','博士生','博士导师','博士生',sd,slk);
edge(s,'Aaron Sternbach',basov,'Dmitri N. Basov','博士后阶段研究师长','博士后阶段研究者',sp,slk);
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+sd+' '+sp+' '+slk+' Columbia 物理系另一通知存在姓名拼写差异，以上以研究生院和本人履历为准。');
cell(s,3,'Dmitri N. Basov（Columbia 2020–2023 博士后阶段研究师长；正式职衔待核）');
schoolWith(s,slk);
const sa=audit(s,[a('phd',sd,['sc','sv'],'confirmed_advisor'),a('postdoc',sp,['sv','su'],'group_or_candidate'),a('affiliation','University of Maryland 物理系。',['su','sv']),a('research','量子材料、超快近场光谱、纳米光学和极化激元。',['su','sv'])],'追 Columbia Energy Frontiers 博后任命及正式个人指导。');
relation(s,sa,'phd',basov,'advisor',sd,ids('sc','sv'),'Basov_PhD');
relation(s,sa,'postdoc',basov,'stage_mentor',sp,ids('sv','su'),'Basov_Postdoc');

const fit='师承人物 - Hellmut Fritzsche';
const rd='Rubloff 本人两份 USPTO 存档 CV 列 Chicago 1971 年物理博士论文及 advisor H. Fritzsche；Chicago 本校档核物理教授全名 Hellmut Fritzsche。可信度高。';
const rp='本人 CV 将 Brown 1971–1973 职位称 Research Associate in Physics，UMD 材料系同一时段称 postdoctoral position，记录两者原文口径。Brown 个人指导仍待核。';
const rl=src(['本人 CV（USPTO）','rv'],['本人 CV 另一案卷','rv2'],['Chicago Fritzsche 原档','rc'],['UMD 材料系','ru']);
updateEdge(r,'Gary Rubloff',fit,'Hellmut Fritzsche','博士导师','博士生','博士导师','博士生',rd,rl);
rewrite(pf(r),x=>x.startsWith(boundary),()=>boundary+rp+' '+rl);
cell(r,2,'Hellmut Fritzsche（Chicago 1971 物理博士导师，CV 署 H. Fritzsche）');
cell(r,3,'Brown 1971–1973，CV 称 Research Associate in Physics，UMD 履历称博士后；导师待核');
schoolWith(r,rl);
const ra=audit(r,[a('phd',rd,['rv','rv2','rc'],'confirmed_advisor'),a('postdoc',rp,['rv','rv2','ru']),a('research','固体表面、界面、半导体工艺及纳米能源材料。',['ru','rv'])],'查 Brown 任用或课题组原档，核当时接收组及个人指导。');
relation(r,ra,'phd',fit,'advisor',rd,ids('rv','rv2','rc'),'Fritzsche');

const yam='师承人物 - Yoshihisa Yamamoto';
const cd='本人访谈明确说 Stanford 量子光学研究与 Yoshihisa Yamamoto 开展，Stanford Yamamoto 组原名录在 1997 年列 Hui Cao。Yale 实验室档核 1997 Stanford 应用物理博士及半导体微腔量子电动力学论文。保留博士阶段研究师长及正式导师候选，论文签署页待查。';
const cp='Yale 本人课题组和本人访谈均称 1997 Stanford 博士毕业后直接赴 Northwestern 教职，现有任用履历未列独立博士后。';
const cx='HKUST 同名 Hui Cao 的机构档列 NUS 有机化学博士、合成与催化方向。Yale Hui Cao 为 Stanford 1997 应用物理博士、研究光子学，两人独立。';
const cl=src(['Yale 院系','ce'],['Yale 物理教师目录','cp'],['本人 CV','cv'],['本人访谈（Yale 存档）','ci'],['Yamamoto 组名录','cy']);
pl(c,boundary,cd+' '+cp+' '+cx+' '+cl+' · '+src(['HKUST 同名原档','ck']));
unit(c,'Hui Cao','电气与计算机工程系','Yale 物理教师目录同时列 Professor of Electrical Engineering，本人 CV 记 2019 年起。',src(['Yale 物理教师目录','cp'],['本人 CV','cv']));
cell(c,1,'应用物理、物理、电气工程；随机激光、纳米光子学、复杂介质光传播');
cell(c,3,'公开履历列 1997 博士后直接任 Northwestern 教职，未发现独立博士后聘任');
schoolWith(c,cl);
const ca=audit(c,[a('identity',cx,['ce','ck','cl']),a('affiliation','Yale 物理系教师目录列应用物理、物理及电气工程。本人 CV 列电气工程自 2019 年。',['cp','cv','ce']),a('research','介观物理、纳米光子学、散射、激光与生物光子学。',['ce','cl']),a('phd',cd,['ci','cy','cl'],'group_or_candidate'),a('postdoc',cp,['cl','ci','cv'],'no_postdoc_documented')],'继续找 Stanford 应用物理学位论文签署页，核 1997 年前后任用；HKUST 同名网页退出。');
relation(c,ca,'phd',yam,'stage_mentor',cd,ids('ci','cy','cl'),'Yamamoto');

const moler=records.get('f5d396d8').filename;
const ip='Julie Bert 2012 Stanford 论文签署页列 Kathryn Moler 为主要导师，致谢把 Ilya Sochnikov 列在 Moler 组成员中。UConn 材料研究所列 Stanford 2011–2015 博后、题目为拓扑材料扫描 SQUID。确认为博士后课题组归属，个人指导职衔待核。';
const id='Bar-Ilan 本人旧履历列博士论文题目及 2011 年，UConn 机构履历列 2012 年博士，保留不同口径。论文两处档案地址未返回正文，导师未核。';
const il=src(['Stanford Bert 论文','ip'],['UConn 材料研究所','iu'],['Bar-Ilan 本人旧档','ib']);
updateEdge(i,'Ilya Sochnikov',moler,'Kathryn Moler','博士后课题组负责人','博士后课题组成员','博士后课题组负责人','博士后课题组成员',ip,il);
pl(i,boundary,id+' '+il);
cell(i,3,'Kathryn Moler（Stanford 2011–2015 博士后课题组负责人，正式指导待核）');
schoolWith(i,il);
const ia=audit(i,[a('phd',id,['iu','ib']),a('postdoc',ip,['ip','iu'],'group_or_candidate'),a('research','扫描 SQUID 显微、超导、拓扑材料。',['iu','ib'])],'追 Bar-Ilan 论文签署页与 Stanford 个人博后指导任用。');
relation(i,ia,'postdoc',moler,'group_leader',ip,ids('ip','iu'),'Moler');

const vu=records.get('1fe868ab').filename;
const wp='UMD ECE 2006 入职原报道明确称 Waks 当时在 Stanford Ginzton Laboratory 与 Jelena Vučković 做博后，Vučković 本人 Stanford CV 的博士后和研究人员名录列 Waks 2003–2006。同期署名论文也确认 Stanford 博后及项目。保留博士后阶段研究师长，正式个人 advisor 字段待核。';
const wd='UMD ECE 原报道核 Stanford 电气工程博士研究与 Yoshihisa Yamamoto 开展，现有正式学位签署原文仍待读。';
const wl=src(['UMD ECE 同期入职报道','wu'],['Vučković 本人 Stanford CV','wv'],['NII 托管同期署名论文','wn']);
updateEdge(w,'Edo Waks',vu,'Jelena Vučković (Vuckovic)','博士后阶段研究师长','博士后阶段研究者','博士后阶段研究师长','博士后阶段研究者',wp,wl);
pl(w,boundary,wp+' '+wl);
cell(w,3,'Jelena Vučković（Stanford 2003–2006 博士后阶段研究师长，正式称谓待核）');
schoolWith(w,wl);
const wa=audit(w,[a('phd',wd,['wu','wn']),a('postdoc',wp,['wu','wv','wn'])],'继续找 Stanford 2003 学位论文签署原文和博后聘任正式个人指导字段。');
relation(w,wa,'postdoc',vu,'stage_mentor',wp,ids('wu','wv','wn'),'Vuckovic');

const pages=[
 [s,'sc','Columbia GSAS item: Sternbach, Aaron; Dynamics of quantum materials at the nanoscale; Sponsor Dmitri Basov.',sd],
 [s,'sv','Aaron Sternbach CV lists Columbia 2020 PhD with PI Dmitri Basov and 2020–2023 Columbia Postdoctoral Fellow.',sp],
 [s,'su','UMD Physics interview says Sternbach continued working with Basov as postdoctoral researcher after his degree.',sp],
 [r,'rv2','Rubloff CV lists Brown Research Associate in Physics and Chicago dissertation adviser H. Fritzsche.',rp],
 [r,'rc','University of Chicago official obituary identifies physics professor Hellmut Fritzsche.',rd],
 [r,'ru','UMD MSE profile describes the 1971–1973 Brown physics position as postdoctoral and lists current research.',rp],
 [c,'ce','Yale Engineering lists applied physics and additional physics appointment, Stanford PhD, and complex photonic nanostructures.',cd],
 [c,'cp','Yale Physics faculty list gives Hui Cao applied physics, physics, and electrical engineering professorships.','Yale 物理教师名录核应用物理、物理和电气工程教授任职。'],
 [c,'cv','Hui Cao CV lists Yale Professor of Electrical Engineering from June 2019 and early Northwestern appointment.',cp],
 [c,'ci','Hui Cao interview names Yoshihisa Yamamoto in connection with Stanford quantum optics, and direct Northwestern faculty transition.',cd],
 [c,'cy','Yamamoto Stanford group alumni roster lists Hui Cao.',cd],
 [i,'iu','UConn Materials lists Bar-Ilan PhD 2012 and Stanford Postdoctoral Certificate 2011–2015.',ip],
 [i,'ip','Julie Bert thesis credits Kathryn Moler as Primary Adviser and includes Ilya Sochnikov in the Moler group.',ip],
 [w,'wu','2006 UMD appointment news identifies Waks as then a Stanford postdoctoral fellow working with Jelena Vuckovic, and doctoral work with Yoshihisa Yamamoto.',wp],
 [w,'wv','Vuckovic CV lists Waks 2003–2006 under present and former postdocs, research scientists and engineers.',wp],
 [w,'wn','NII-hosted paper author biography names Edo Waks as Stanford postdoctoral fellow after his Stanford electrical engineering PhD.',wp]
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:i,url:u.it,error:'HTTP 400 Timeout fetching'}, {record_id:w,url:u.wd,error:'Cache miss; hosted copy not available in web tool'});
const exclusions=[{page_id:'0370ac945e8f527ca8bdf8d7',record_id:c,audit_id:ca,url:u.ck,external_subject:'Hui Cao（HKUST 有机化学研究者、NUS 博士）',evidence:cx}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length,exclusions:exclusions.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2342_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2342_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const ex='20261110_2342_HKUST同名网页归属纠偏.json';
persist(ex,exclusions);
call('人物网页身份纠偏.cjs',[ex]);
const receipt='20261110_2342_院系与博士后原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
