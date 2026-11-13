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
 orig.audit_id='pi_archive_20261111_0106_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0106_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"jhu":"https://engineering.jhu.edu/chembe/faculty/michael-bevan/","unlv":"https://oasis.library.unlv.edu/thesesdissertations/4824/","prieve":"https://www.cheme.engineering.cmu.edu/news/2023/05/30-remembering-prieve.html","acs":"https://doi.org/10.1021/la981381l","art":"https://electronicsandbooks.com/edt/manual/Magazine/T/The%20Journal%20of%20Adhesion/2004%20Volume%2080/5/365-394.pdf","sbu":"https://www.stonybrook.edu/bulletin-archives/all/_pdfs/Spring2025GraduateBulletinFinal.pdf","fac":"https://www.stonybrook.edu/electrical/faculty/faculty-directory.html","opt":"https://opg.optica.org/abstract.cfm?uri=CLEO-2004-CTuJ4","old":"https://www.ece.stonybrook.edu/~oe/leon.html"};
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




const b='62c4df3b', bm='师承人物 - Dennis C. Prieve', l='622dd66f', lm='师承人物 - Gregory Belenky';
const e='JHU 校方列 Michael A. Bevan 为 Carnegie Mellon 1999 博士。1999 年 Langmuir 论文的书目信息列其与 Dennis C. Prieve 同署名，2004 年原刊论文扉页再次核到两人同列 Carnegie Mellon 化工系。Carnegie Mellon 系史档核 Prieve 当时为该系教授并开展胶体力研究。以上线索支持待查候选，指导角色可信度低。';
const bl=src(['JHU 院系','jhu'],['Carnegie Mellon 纪念档','prieve'],['1999 Langmuir 书目','acs'],['2004 原刊全文','art']);
mentor(bm,'Dennis C. Prieve','Carnegie Mellon 化工系教授，研究胶体力与表界面现象。',src(['Carnegie Mellon 化工系档案','prieve']));
edge(b,'Michael Bevan',bm,'Dennis C. Prieve','博士导师候选','博士生候选',e,bl);
personLine(b,boundary,' UNLV 2023 论文作者为 Michael Bevan Dial，研究运动和昼夜节律，已与本人物区分。 '+src(['UNLV 论文馆藏','unlv'],['JHU 个人原档','jhu']));
cell(b,2,'Dennis C. Prieve（同期合作线索，候选）');
schoolWith(b,bl);
const ba=audit(b,[
 a('identity','JHU 院系档列 Michael A. Bevan、Carnegie Mellon 1999 博士及胶体界面。UNLV 学位档是 Michael Bevan Dial，2023 年运动与昼夜节律研究，已从搜索队列排除。',['jhu','unlv'],'confirmed'),
 a('affiliation','JHU 化学与生物分子工程系教授，保留已核实的机械工程关联。',['jhu'],'confirmed'),
 a('research','胶体界面相互作用、粒子动力学与自组装。',['jhu'],'confirmed'),
 a('phd',e,['jhu','prieve','acs','art'],'group_or_candidate')
],'继续查 Carnegie Mellon 1999 博士论文目录或签署页、Melbourne 博士后个人指导；保留 Jennifer A. Lewis 的 UIUC 组属。');
relation(b,ba,'phd',bm,'candidate',e,ids('jhu','prieve','acs','art'),'prieve');

const le='Optica 原始论文记录将 Leon Shterengas 和 Gregory Belenky 同署于 Stony Brook ECE 光电子组。2025 校方研究生手册列 Leon 2004 年 Stony Brook 博士；既有材料另列 2003 年。候选来自原索引线索及学位前后同期同组研究，需本人论文确认导师和年份。';
const ll=src(['Stony Brook 2025 Graduate Bulletin','sbu'],['Optica 论文作者及单位','opt'],['Stony Brook ECE 教师目录','fac']);
personLine(l,'- 博士导师候选：',' '+le+' '+ll);
line(mf(lm),x=>x.startsWith('- 博士候选研究者：')&&x.includes(records.get(l).filename),' '+le+' '+ll);
line(index,x=>x.startsWith('- [[人员 - Stony Brook - Dmitri Donetski - c4649558|Dmitri Donetski]]、')&&x.includes(records.get(l).filename),' 仅 Shterengas 另有同期论文署名证据。'+le+' '+ll);
cell(l,2,'Gregory Belenky（同期同组作者及索引候选，原学位档待核）');
schoolWith(l,ll);
const la=audit(l,[
 a('identity','当前 ECE 名录及 2025 研究生手册署 Leon Shterengas；与 2004 Optica 原件的姓名、Stony Brook 单位及研究方向相符。',['fac','sbu','opt'],'confirmed'),
 a('affiliation','Stony Brook 电气与计算机工程系 Professor。',['fac'],'confirmed'),
 a('research','半导体光子器件、纳米制造和分子束外延；Optica 原件补证量子阱激光器。',['sbu','opt'],'confirmed'),
 a('phd',le,['sbu','opt'],'group_or_candidate')
],'查 2003/2004 年的 Stony Brook 纸本或数字学位原档、当期本人 CV 和博士后任用。');

const pages=[
 [b,'jhu','Johns Hopkins identifies Michael A. Bevan, Carnegie Mellon PhD in 1999, and his colloidal interactions research.','与 UNLV 不同姓名、学校、年份及方向。'],
 [b,'prieve','CMU’s departmental memorial identifies Dennis Prieve as a chemical engineering professor and colloidal force researcher, appointed in 1975.','核同时期院系和研究。'],
 [b,'art','The article author block lists Michael Bevan and Dennis C. Prieve at the CMU Center for Complex Fluid Engineering and Chemical Engineering; Bevan’s current address is Texas A&M.','核合作者及单位，仅作追查线索。'],
 [l,'sbu','The 2025 Graduate Bulletin lists Leon Shterengas, Ph.D. 2004 Stony Brook and semiconductor photonics, nanofabrication and MBE.','交叉核对学位记录和研究方向。'],
 [l,'opt','The 2004 Optica conference article lists both Leon Shterengas and Gregory Belenky in the SUNY Stony Brook ECE Optoelectronics Group.','导师候选新增同期同组署名证据。'],
 [l,'fac','Stony Brook ECE’s Faculty Directory lists Leon Shterengas as a Professor.','核对现任院系。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:l,url:u.old,error:'502 Bad Gateway；已另核现任 ECE 教师档，旧个人课题组原页待之后复核。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0106_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0106_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0106_StonyBrook和JHU原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
