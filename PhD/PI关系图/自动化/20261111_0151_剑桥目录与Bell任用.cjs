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
 orig.audit_id='pi_archive_20261111_0151_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0151_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"cam":"https://idiscover.lib.cam.ac.uk/permalink/f/t9gok8/44CAM_ALMA21433405640003606","acs":"https://scalacs.org/?page_id=1093","tamu":"https://engineering.tamu.edu/electrical/profiles/rentzepis-peter.html"};
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
 rewrite(pf(id),x=>(x.startsWith('- '+oldForward+'：')||x.startsWith('- '+newForward+'：'))&&x.includes(mFile),()=>'- '+newForward+'：'+to+after);
 rewrite(mf(mFile),x=>(x.startsWith('- '+oldBack+'：')||x.startsWith('- '+newBack+'：'))&&x.includes(rec.filename),()=>'- '+newBack+'：'+from+after);
 rewrite(index,x=>(x.startsWith('- '+from+' → '+oldForward+'：')||x.startsWith('- '+from+' → '+newForward+'：'))&&x.includes(mFile),()=>'- '+from+' → '+newForward+'：'+to+after);
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




const id='74d6ed61',name='Peter M. Rentzepis', mentorFile='师承人物 - T. Morris Sugden';
const phd='Cambridge University Library 的 1964 年博士论文目录（索书号 PhD.4912）列作者 Peter Michael Rentzepis，题名 Some reactions of nitrogen-containing radicals in flames，学位单位为剑桥物理化学系，并列 T. M. Sugden（Theodore Morris）为 degree supervisor。博士论文导师关系可信度高。';
const postdoc='ACS 南加州分会获奖者履历记，剑桥博士毕业后即赴 Bell Laboratories, Murray Hill 担任 Member of the Technical Staff；已读材料中未发现独立博士后任用或具名博士后导师。';
const cam=src(['Cambridge University Library 博士论文目录','cam']);
const acs=src(['ACS 南加州分会 Tolman Award 履历','acs']);
const tamu=src(['Texas A&M 工学院教师档','tamu']);
updateEdge(id,name,mentorFile,'T. Morris Sugden','博士候选关系','博士候选研究者','博士导师','博士生',phd,cam);
line(mf(mentorFile),x=>x.startsWith('[建立节点的来源]'),' '+cam);
rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+postdoc+' '+acs);
cell(id,2,'T. Morris Sugden（Cambridge 博士论文导师）');
cell(id,3,'未发现独立博士后任用；博士后首份已知职位为 Bell Labs 技术人员');
schoolWith(id,cam+' · '+acs);
const event=audit(id,[
 a('identity','剑桥目录的作者全名与 ACS 获奖履历相同，Texas A&M 工学院教师档列剑桥博士与同一超快谱学方向。',['cam','acs','tamu'],'confirmed'),
 a('affiliation','Texas A&M Electrical and Computer Engineering 教授、Biomedical Engineering 关联教师。',['tamu'],'confirmed'),
 a('research','激光物理及应用、超快光谱、时间分辨 X 射线衍射。',['tamu','acs'],'confirmed'),
 a('phd',phd,['cam'],'confirmed_advisor'),
 a('postdoc',postdoc,['acs'],'no_postdoc_documented')
],'若出现当期正式任用档，进一步核对 Bell Labs 职衔和博士后时段；已知首职为技术人员。');
relation(id,event,'phd',mentorFile,'advisor',phd,ids('cam'),'sugden');
const pages=[
 {record_id:id,url:u.cam,raw:'Some reactions of nitrogen-containing radicals in flames / Peter Michael Rentzepis. 1964. T. M. Sugden (Theodore Morris), degree supervisor. University of Cambridge, Department of Physical Chemistry. PhD.4912.',excerpt:'剑桥大学图书馆博士论文目录明示导师，浏览器已核读公开书目正文。'},
 {record_id:id,url:u.acs,raw:'The award biography states Rentzepis accepted a Member of the Technical Staff position at Bell Laboratories, Murray Hill, immediately after the Cambridge doctorate.',excerpt:'毕业后首职为 Bell Labs 技术人员，已读材料未列单独博后。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0151_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0151_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0151_剑桥目录与Bell任用回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
