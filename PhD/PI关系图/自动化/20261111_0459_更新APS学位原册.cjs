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
 orig.audit_id='pi_archive_20261111_0459_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0459_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"aps":"https://higherlogicdownload.s3.amazonaws.com/APS/4b42e4b2-afbc-47ee-a8b9-5d7a930357e6/UploadedImages/Sept_1993.pdf#page=2","rawaps":"https://higherlogicdownload.s3.amazonaws.com/APS/4b42e4b2-afbc-47ee-a8b9-5d7a930357e6/UploadedImages/Sept_1993.pdf","book":"https://books.google.com/books/about/Atom_Interferometry_in_an_Atomic_Fountai.html?id=BARFAQAAIAAJ","cap":"https://cap.ca/congress-conference/herzberg-memorial-public-lecture/","dt":"https://backend.orbit.dtu.dk/ws/portalfiles/portal/239393461/OSA_SiegmanSchoolProgBook_6_18.pdf#page=8","st":"https://profiles.stanford.edu/mark-kasevich","pq":"https://www.proquest.com/openview/7b2b62b67060cf9f42b57c060ee7ab6e/1?cbl=18750&diss=y&pq-origsite=gscholar"};
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




const K='8201a262';
const ev='APS DAMOP 1993 年 9 月通讯第 2 页的博士论文获奖原文，称 Mark Kasevich 为 Stanford 的 Steve Chu former student，并具名同一博士论文 Atom Interferometry in an Atomic Fountain。原册视觉核读。1992 Stanford 应用物理学位和作者、题名交叉核实，保留既有博士导师标签，论文签署页待补。';
const doc=src(['APS 同期获奖原册第 2 页','aps'],['学位书目','book'],['本人活动履历','cap']);
updateEdge(K,'Mark Kasevich','师承人物 - Steven Chu','Steven Chu','博士导师','博士生','博士导师','博士生',ev,doc);
const career=src(['2018 Optica 讲者原册第 8 页','dt'],['加拿大物理学会 2023 讲者履历','cap']);
pl(K,boundary,'两份讲者原档均列 1992 年在 Stanford 获应用物理博士并于同年进入 Stanford Physics 教员序列，1997–2002 任 Yale Physics 教员。公开履历未发现单列博士后。博士导师见同期 APS 论文奖原文。 '+career);
cell(K,2,'Steven Chu（APS 同期博士论文获奖原册核实）');
cell(K,3,'未发现单列博士后经历（同年加入 Stanford Physics 教员序列）');
schoolWith(K,doc+' · '+career);
const aId=audit(K,[a('identity','Stanford 人物档、同名学位书目与 APS 原刊的博士研究方向吻合。',['st','book','rawaps']),a('phd',ev,['rawaps','book','cap'],'confirmed_advisor'),a('postdoc','Optica 2018 讲者原册与 CAP 2023 讲者履历均明确 1992 年 Stanford 应用物理博士且同年加入该校 Physics faculty，未单列博士后。',['dt','cap'],'no_postdoc_documented')],'待 Stanford 纸本学位签署页和首份人事任用月份进一步核对。');
relation(K,aId,'phd','师承人物 - Steven Chu','advisor',ev,ids('aps','book','cap'),'p1');
const page=(key,excerpt)=>({record_id:K,url:u[key],raw:excerpt,excerpt});
const pages=[
 page('rawaps','APS DAMOP 1993 年 9 月原刊，第 2 页左上博士论文奖报道，视觉核读 Mark Kasevich、Stanford 的 Steve Chu 和题名 Atom Interferometry in an Atomic Fountain。本地 PDF 20261111_0457_APS_DAMOP_1993-09.pdf，SHA-256 d23c1e6804c7a51215544cbfe97f70f71d21886e6f2fa5d1ec16073d62e34a58。'),
 page('book','Stanford 1992 学位书目列题名、作者 Mark A. Kasevich、应用物理系和 258 页。'),
 page('dt','第 8 页 Optica 讲者履历核 Stanford 1992 Applied Physics PhD、同年加入 Stanford Physics faculty、1997–2002 Yale 后返 Stanford。'),
 page('cap','加拿大物理学会 2023 年讲者履历确认 1992 Stanford 应用物理博士及同年 Stanford 物理系任用。'),
 {record_id:K,url:u.pq,error:'ProQuest 公开预览 URL 返回 cache miss，未取得签署页。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0459_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0459_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0459_APS学位获奖原册回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
