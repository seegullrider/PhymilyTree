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
 orig.audit_id='pi_archive_20261110_2354_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2354_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"n":"https://jacobsschool.ucsd.edu/people/profile/kenji-nomura","lab":"https://www.mdxes.iir.isct.ac.jp/members/kamiya/index-e.html","museum":"https://sts.kahaku.go.jp/albums/abm.php?d=6689&f=abm00010616.pdf&n=133_e.pdf","nt":"https://g-www.jim.titech.ac.jp/public-relations/prospective-students/first-step/career-design-nomura","ncii":"https://cir.nii.ac.jp/crid/2120026414536660736","sid":"https://www.sid.org/Portals/5/pdf/2023H%26A%20Awards%20Winners.pdf","c":"https://news.cornell.edu/stories/2014/10/welcome-new-members-faculty-2014-15","duf":"https://www.duffield.cornell.edu/people/jeffrey-moses/","usc":"https://viterbi.usc.edu/events/files/2022/914f7f7a_Jeffery%20Moses%20Flyer.pdf","rle":"https://www.rle.mit.edu/media/pr149/31.pdf","dtu":"https://backend.orbit.dtu.dk/ws/portalfiles/portal/145256599/Bache_Dr_Technices_thesis_2017.pdf","wise":"https://wise.research.engineering.cornell.edu/people/","aps":"https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.97.073903","o":"https://cap.csail.mit.edu/members/people/william-oliver"};
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

const [n,m,o]=['55b8c2be','57a1e204','55dfd7e3'];
const mp='Cornell 2014 同期入职档把 MIT RLE 2007–2009 Postdoctoral Associate 与 2009–2014 Research Scientist 分列，USC 讲者原档明确两段均在 Optics & Quantum Electronics Group。';
const mc='MIT RLE Progress Report 149 的同期项目成员表把 Moses 和 Franz X. Kärtner 列入同一项目，RLE 该章列三位 Academic Staff。结合已证实的博后时间，Kärtner 记低可信指导候选，个人指导待核。';
const md='Cornell 机构原档列 2007 应用物理博士。Bache 本人 DTU 论文前言明确初识 Moses 时他是 Cornell 博士生，并描述与 Wise 的研究合作。Wise 组原名录地址本轮 502，保留既有博士候选，正式导师待论文或组原件。';
const ml=src(['Cornell 2014 入职原档','c'],['USC 讲者原档','usc'],['MIT RLE 项目原档','rle']);
const mdl=src(['Cornell 2014 入职原档','c'],['Bache 本人 DTU 原论文','dtu'],['APS 博士期间原刊','aps']);
const mName='Jeffrey Moses',kart='师承人物 - Franz X. Kärtner',wise=records.get('39d5fad4').filename;
const mid=who(m,mName),mw=wiki(wise,'Frank Wise'),mk=wiki(kart,'Franz X. Kärtner'),ci=path.join(root,'师承候选线索索引.md');
const candLine='- '+mid+' → 博士候选：'+mw+'。'+md+' '+mdl;
for(const file of [index,ci])rewrite(file,x=>x.startsWith('- '+mid+' → 博士候选：')&&x.includes(wise),()=>candLine);
rewrite(pf(m),x=>x.startsWith('- 博士候选：')&&x.includes(wise),()=>'- 博士候选：'+mw+'。'+md+' '+mdl);
rewrite(mf(wise),x=>x.startsWith('- 博士阶段研究者候选（反向线索）：')&&x.includes(records.get(m).filename),()=>'- 博士阶段研究者候选（反向线索）：'+mid+'。'+md+' '+mdl);
edge(m,mName,kart,'Franz X. Kärtner','博士后导师候选','博士后候选关联人物',mc,ml);
const mline='- '+mid+' → 博士后导师候选：'+mk+'。'+mc+' '+ml;
rewrite(ci,x=>x===candLine,(x,nl)=>x+nl+mline);
rewrite(pf(m),x=>x.startsWith(boundary),()=>boundary+' '+mp+' '+ml+' '+md+' '+mdl);
cell(m,2,'Frank Wise（博士候选，正式指导待核）');
cell(m,3,'MIT RLE 光学与量子电子组 2007–2009 博士后；Franz X. Kärtner（低可信指导候选）；2009–2014 研究科学家');
schoolWith(m,ml+' · '+mdl);
const ma=audit(m,[a('phd',md,['c','dtu','aps'],'group_or_candidate'),a('postdoc',mp+' '+mc,['c','usc','rle'],'group_or_candidate'),a('affiliation','Cornell 应用与工程物理学院副教授。',['duf','c']),a('research','超快光谱、非线性光学、光激发材料非平衡动力学。',['duf','c'])],'查 Cornell 原论文或可直接读的 Wise 组论文附件，及 MIT RLE 2007–2009 个人任用记录。');
relation(m,ma,'postdoc',kart,'candidate',mc,ids('c','usc','rle'),'Kaertner');

const np='UCSD Jacobs 履历明列 Tokyo Tech 材料科学实验室博士后。Science Tokyo Kamiya 组原页称其为 Hosono–Kamiya 组校友，未列毕业后博后具体归属日期及个人指导人。保留既有博士阶段研究师长 Hideo Hosono。';
const nl=src(['UCSD Jacobs 院系履历','n'],['Science Tokyo Kamiya 组原档','lab'],['SID 学会授奖原册','sid']);
pl(n,boundary,np+' '+nl);
cell(n,3,'Tokyo Tech 材料科学实验室博士后；正式个人指导待核');
schoolWith(n,nl);
audit(n,[a('postdoc',np,['n','lab','sid'],'unresolved'),a('affiliation','UC San Diego 电气与计算机工程系教授。',['n']),a('research','宽禁带氧化物半导体、薄膜晶体管、柔性电子与器件物理。',['n','sid'])],'追 Tokyo Tech 学位签署或主查字段及材料科学实验室博后聘任。本人母校访谈超时，暂不复发。');

const ol=src(['MIT CSAIL 原始履历','o']);
const os='MIT CSAIL 原档具名列 EECS 与物理系教授、Lincoln Laboratory Fellow，并列超导量子比特、低温封装与控制电子。';
const un='林肯实验室（Fellow）';
unit(o,'William Oliver',un,'Lincoln Laboratory Fellow，量子信息与集成纳米系统 PI。',ol);
const on=path.join(root,'院校与机构','院校 - MIT.md');
const olink='- '+wiki('已核实单位 - MIT - '+un,un);
insertAfter(on,'- [[已核实单位 - MIT - 物理系|物理系]]','\n'+olink);
cell(o,1,'电气工程与计算机科学系、物理系、林肯实验室（Fellow）；超导量子器件、量子多体与量子模拟、低温封装与控制电子');
schoolWith(o,ol);
pl(o,'- 研究方向：',os+' '+ol);
audit(o,[a('affiliation',os,['o']),a('research','超导量子比特材料生长、器件设计、测量、低温封装与控制。',['o'])],'继续查 Stanford 学位论文正式导师与独立博士后聘任材料。');

const pages=[
 [m,'c','Cornell lists Jeffrey Moses 2007 Cornell PhD, 2007–2009 MIT RLE postdoc, and 2009–2014 research scientist.',mp],
 [m,'usc','USC speaker bio identifies MIT Optics and Quantum Electronics Group for both positions.',mp],
 [m,'rle','MIT RLE Progress Report 149 lists Moses and Kärtner as Project Staff, and names three academic staff in this group.',mc],
 [m,'dtu','Bache’s thesis preface identifies Moses as a then Cornell PhD student and describes work with Wise.',md],
 [n,'lab','Science Tokyo Kamiya lab calls Kenji Nomura its Hosono–Kamiya group alumnus and reports 2018 appointment to UCSD.',np],
 [n,'sid','SID 2023 awards brochure names Nomura, Hosono, and Kamiya, identifies Nomura as UCSD ECE and Tokyo Tech materials doctorate.',np]
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:m,url:u.wise,error:'HTTP 502 Bad Gateway'}, {record_id:n,url:u.nt,error:'HTTP 400 Timeout fetching'}, {record_id:n,url:u.ncii,error:'Cache miss'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2354_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2354_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2354_RLE与TokyoTech原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
