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
 orig.audit_id='pi_archive_20261111_0207_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0207_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"hAsu":"https://news.engineering.asu.edu/welcome/josh-hihath/","hReport":"https://www.nanowerk.com/spotlight/spotid=5828.php","hThesis":"https://www.researchgate.net/publication/253040912_Methods_and_applications_in_single_molecule_electronics","yThesis":"https://www.researchgate.net/profile/Nan-Yao-4/4","yBook":"https://library.knu.edu.af/opac/temp/16076.pdf","yAcad":"https://science.org.au/our-focus/history-australian-science/fellows-biographical-memoirs/john-maxwell-cowley-1923-2004","yCV":"https://nyao.princeton.edu/pdf/Nan%20Yao%20CV.pdf","yProfile":"https://materials.princeton.edu/people/nan-yao","yHome":"https://nyao.princeton.edu/","huMIT":"https://dmse.mit.edu/people/faculty/juejun-hu/","huBook":"https://www.researchgate.net/publication/43334802_Planar_chalcogenide_glass_materials_and_devices","huURL":"https://dspace.mit.edu/handle/1721.1/54562","huGroup":"https://photonics.mit.edu/people/alumni/"};
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




const h='a18ed0a3',hn='Joshua Hihath',tao='师承人物 - Nongjian Tao';
const hPhd='本人条目提供 2008 年论文摘要及题名 Methods and applications in single molecule electronics。ASU 工程学院确认该校硕士与博士，2005 年项目报道和共同献辞仍只支持 Nongjian Tao 为博士阶段项目负责人、导师候选，待查论文签署页。';
const hPost='2008 年对 Hihath 和 Tao 的同期采访将 Hihath 明列为 ASU Electrical Engineering 的 Tao 组博士后研究者。ASU 工程学院独立确认在同校博士毕业后任 postdoctoral scholar，之后才任实验室经理和研究教授。记录 Tao 为博士后课题组负责人，组属可信度高；正式导师称谓和任期边界待核。';
const hLinks=src(['2008 年两人采访原文','hReport'],['ASU 工程学院履历','hAsu']);
edge(h,hn,tao,'Nongjian Tao','博士后课题组负责人','博士后课题组成员',hPost,hLinks);
pl(h,boundary,'博士论文题名线索为 Methods and applications in single molecule electronics，已核其署名摘要。 '+src(['本人论文摘要','hThesis'])+' 同期采访及 ASU 院档核 Tao 组博后，个人导师待核。 '+hLinks);
cell(h,3,'Nongjian Tao（ASU 博士后课题组负责人）；正式指导职衔及任期边界待核');
schoolWith(h,hLinks+' · '+src(['本人论文摘要','hThesis']));
const he=audit(h,[
 a('identity','访谈和 ASU 工程学院履历同指 ASU 博士后、后在 UC Davis 任教的 Joshua／Josh Hihath。',['hAsu','hReport'],'confirmed'),
 a('affiliation','ASU School of Electrical, Computer and Energy Engineering 与 Biodesign Center for Bioelectronics and Biosensors。',['hAsu'],'confirmed'),
 a('research','分子电子学、纳米电子学和生物传感。',['hAsu','hReport'],'confirmed'),
 a('phd',hPhd,['hThesis','hAsu'],'group_or_candidate'),
 a('postdoc',hPost,['hReport','hAsu'],'group_or_candidate')
],'按 Methods and applications in single molecule electronics 查 2008 年 ASU 签署页；核 2008 ASU 博后聘期和 Tao 的正式个人指导称谓。');
relation(h,he,'postdoc',tao,'group_leader',hPost,ids('hReport','hAsu'),'tao_postdoc');

const y='12745a88',yn='Nan Yao',cow='师承人物 - John M. Cowley';
const yPhd='本人学术发表条目将 Electron diffraction and microscopy studies of surfaces 列为 Arizona State University 1990 博士论文。本人合编原书题献与署名前言将 Cowley 称为研究生指导者，澳大利亚科学院纪念档将 N. Yao 放在 ASU 博士生群体的反射电子显微项目。保留博士阶段研究师长标签，论文导师字段待签署原件。';
const ySources=src(['1990 论文书目线索','yThesis'],['本人合编原书题献与前言','yBook'],['澳大利亚科学院 Cowley 档','yAcad']);
const yPost='本人 CV 第 1 页分列 1990–1991 Shell Visiting Staff Scientist、1991–1993 ExxonMobil Post-doctoral Fellow；具名导师待核。';
pl(y,boundary,'本轮找到题名 Electron diffraction and microscopy studies of surfaces，澳大利亚科学院档进一步核博士项目。 '+ySources);
schoolWith(y,ySources);
const ye=audit(y,[
 a('identity','本人 CV 与学位条目对应 Arizona State 1990 应用物理和电子显微博士，并核 Princeton 现任。',['yCV','yThesis','yProfile'],'confirmed'),
 a('affiliation','Princeton Materials Institute Professor of the Practice；Andlinger Center Associated Faculty。',['yCV','yProfile'],'confirmed'),
 a('research','电子显微学和纳米材料结构表征。',['yCV','yProfile'],'confirmed'),
 a('phd',yPhd,['yThesis','yBook','yAcad','yCV'],'group_or_candidate'),
 a('postdoc',yPost,['yCV'],'unresolved')
],'按 Electron diffraction and microscopy studies of surfaces 查 ASU 1990 论文签署页；本人主页超时，依退避后再核。追 ExxonMobil 1991–1993 博后项目及具名指导。');

const uId='8aa2a759',huPhd='MIT 系页与 MIT MTL 名录确认 2009 年材料科学与工程博士，题名 Planar Chalcogenide Glass Materials and Devices。题名对应论文定位 MIT Libraries handle 1721.1/54562，dspace.mit.edu 尚在既有主机退避，保留原论文及导师字段待核。';
pl(uId,'- 博士论文追查：','已定位 [MIT 论文入口]('+u.huURL+')，待主机退避到期查签署页。');
schoolWith(uId,src(['MIT 材料科学与工程系','huMIT'])+' · '+src(['MIT 论文入口，待查签署','huURL']));
audit(uId,[
 a('identity','MIT 材料科学与工程系本人档列 2009 MIT 博士、2010–2014 Delaware 任教与 MIT 现职。',['huMIT'],'confirmed'),
 a('affiliation','MIT 材料科学与工程系 John F. Elliott Professor。',['huMIT'],'confirmed'),
 a('research','集成光子学、光学相变材料、芯片级光谱、超构光学和柔性光子学。',['huMIT'],'confirmed'),
 a('phd',huPhd,['huMIT','huBook','huURL'],'group_or_candidate')
],'待 MIT dspace 主机退避到期，查 1721.1/54562 论文签署页；追 2010 MIT Microphotonics Center 博后指导。');

const pages=[
 [h,'hAsu','ASU Engineering identifies Joshua Hihath’s ASU doctoral training and subsequent ASU postdoctoral scholar, lab manager and research professor positions.','核教育、博后任用和现任。'],
 [h,'hReport','The May 2008 interview places Hihath in Professor Nongjian Tao’s ASU Electrical Engineering research group as a postdoctoral researcher.','确认 2008 ASU 博后组属。'],
 [h,'hThesis','Methods and applications in single molecule electronics, Josh Hihath, 2008. Author abstract was read; advisor is absent.','为签署页追查保存论文题名。'],
 [y,'yThesis','Electron diffraction and microscopy studies of surfaces, Nan Yao, August 1990, Ph.D., Arizona State University.','题名线索，指导字段未见。'],
 [y,'yBook','Signed preface and dedication describe Professor John M. Cowley as the editors’ graduate advisor.','本人第一手研究生指导来源。'],
 [y,'yAcad','Cowley’s Academy memoir describes the ASU PhD-student cohort and includes N. Yao in the REM and SREM research projects.','核博士阶段具体研究背景。'],
 [y,'yCV','Nan Yao’s CV lists ASU 1990 Ph.D., Shell 1990–91 Visiting Staff Scientist and ExxonMobil 1991–93 Post-doctoral Fellow.','区分两段岗位。'],
 [uId,'huMIT','MIT DMSE lists Juejun Hu’s 2009 MIT PhD, MIT professor appointment, photonics and optical phase-change research.','核身份院系与研究方向。'],
 [uId,'huBook','ResearchGate displays the title and author Juejun Hu. It does not provide a scanned thesis signature page.','题名与 MIT MTL 名录相符。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:y,url:u.yHome,error:'Princeton 本人主页浏览器 ERR_CONNECTION_TIMED_OUT；检索工具 400 Timeout fetching。校方 CV 和书籍原文已核，主页按队列退避。'});
pages.push({record_id:uId,url:u.huGroup,error:'502 Bad Gateway；索引列研究组校友条目，但未取得原页正文。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0207_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0207_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0207_ASU采访与学位题名回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
