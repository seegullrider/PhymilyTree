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
 orig.audit_id='pi_archive_20261111_0658_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0658_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"mur":"https://muruganlab.uchicago.edu/data/cv/MuruganCV.pdf#page=3","lab":"https://muruganlab.uchicago.edu/pages/people.html","unc":"https://zhiyuelu.wixsite.com/unc-lu-group","old":"https://dae6c05b-1731-4abb-9842-ac6630b3ce4d.filesusr.com/ugd/7756b8_894aad74f08247809615f7a54ac6d9ab.pdf"};
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




const id='6c98ea94', dateEvidence='Murugan 本人 2026 CV 第 3 页的 Postdocs 栏具名 Zhiyue Lu，列 2017–2019 并注明 UNC Chapel Hill 去向。Lu 本人此前核读的 2026 CV 列 Chicago 全段 2016–2019 及 Aaron Dinner、Arvind Murugan 两位 advisers。分别保留两份年份，无法从原档判断差一年具体原因。';
const sources=src(['Murugan 本人 CV 第 3 页','mur'],['Murugan 组校友原档','lab'],['Lu 本人 UNC 组页','unc'],['已核 Lu 本人 CV','old']);
pl(id,boundary,dateEvidence+' '+sources);
schoolWith(id,sources);
audit(id,[a('affiliation','UNC Chapel Hill 化学系副教授。',['unc'],'confirmed'),a('postdoc',dateEvidence,['mur','lab','old'],'confirmed_advisor')],'查 2016–2017 Chicago 初始任用与 Murugan 组名单的起年口径；正式导师两位继续保留。');
const pages=[
{record_id:id,url:u.mur,raw:'Murugan 2026 CV 第 3 页 Postdocs 具名 Zhiyue Lu，2017–2019，去向 UNC Chapel Hill。',excerpt:dateEvidence},
{record_id:id,url:u.lab,raw:'Murugan 组校友名录列 Zhiyue Lu 及 UNC Chapel Hill Chemistry。',excerpt:'核同一博士后校友和去向。'},
{record_id:id,url:u.unc,raw:'Zhiyue Lu 本人实验室原档列 UNC Chapel Hill 化学系副教授。',excerpt:'核现任院系及方向。'},
{record_id:id,url:u.old,error:'此前核实过的 CV 直达链接本轮不可访问，保留历史成功证据。'}
];
const rfile='20261111_Ferguson_CV_比对.json';
const roster=JSON.parse(fs.readFileSync(rfile,'utf8'));
const matched=roster.matches.find(x=>x.name==='Wei Chen');
if(!matched||matched.candidates.length!==2)throw Error('Wei Chen 名录比对记录有变化');
const disambiguation={
 '9c9be2a5':{status:'excluded_distinct_person',evidence:'NUS 学校履历列 NUS 2004 化学博士；Ferguson CV 是 UIUC 2015–2020 物理博士阶段研究。',source:'https://greenenergy.nus.edu.sg/our_team/academic-staff/wei-chen/'},
 'b7ad4151':{status:'excluded_distinct_person',evidence:'Northwestern 院系列 Georgia Tech 机械工程博士；Ferguson CV 是 UIUC 物理博士阶段研究。',source:'https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/chen-wei.html'}
};
for(const candidate of matched.candidates){
 if(!disambiguation[candidate.id])throw Error('出现未核对的同名记录');
 candidate.review=disambiguation[candidate.id];
}
updates.set(rfile,JSON.stringify(roster,null,2)+'\n');
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0658_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
if(relations.length){
const rf='20261111_0658_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
}
const receipt='20261111_0658_指导名录匹配核查原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
