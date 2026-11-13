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
 orig.audit_id='pi_archive_20261111_0950_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0950_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const id='b71d2411';
const cv='https://broadcast.ccny.cuny.edu/lyris/SchwartzCV.pdf';
const uv='https://www.cheme.washington.edu/sites/cheme/files/news/docs/2016-04-11%20Yu_0.pdf';
const uw='https://www.cheme.washington.edu/facultyfinder/qiuming-yu';
const co='https://www.duffield.cornell.edu/people/qiuming-yu/';
const mentor='师承人物 - Daniel T. Schwartz';
const mn=wiki(mentor,'Daniel T. Schwartz');
const me=who(id,'Qiuming Yu');
const unit='已核实单位 - University of Washington, Seattle - 化学工程系';
const schoolNote=path.join(root,'院校与机构','院校 - University of Washington, Seattle.md');
const uwNote=path.join(root,'已核实院系',unit+'.md');
const note='Schwartz 本人 CV 在 POSTDOCTORAL SUPERVISION 下列 Qiuming Yu 和 Cornell PhD。Washington 化工系 2016 讲座履历核同一人 1995 Cornell 博士、JPL／Caltech 博后、Kansas State 科研任用、2000 年进入 Washington 物理与化工任 Research Associate。CV 括号的 2000 与到 Washington 年份相同，原文未明确其含义。两份原档支持 Washington 阶段具名研究指导，正式任用以 Washington 原档为准。';
const links=source('Schwartz 本人 CV',cv+'#page=21')+' · '+source('Washington 2016 履历',uv+'#page=2')+' · '+source('Cornell 本人档',co);
const label='- 博士后阶段研究师长：'+mn+'。'+note+' 身份与具名指导可信度高，指导起止与正式职衔待核。 '+links;
rewrite(pf(id),x=>x.startsWith('- 博士后导师：'+mn)||x.startsWith('- 博士后阶段研究师长：'+mn),()=>label);
rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+'Cornell 与 Washington 原档一致列 1995 年 Cornell 化工博士，并将 1995–1996 JPL／Caltech Microdevices Laboratory 博士后与后续 Washington Research Associate 分列。博士导师及 JPL 具名指导仍待核。 '+links);
personLine(id,'- 院系／机构：',' '+wiki(unit,'Washington 化工系')+'（Affiliate Professor）。 '+source('Washington 教师档',uw));
rewrite(mf(mentor),x=>x.startsWith('- 博士后研究者：'+me)||x.startsWith('- 博士后阶段研究者：'+me),()=>'- 博士后阶段研究者：'+me+'。'+note+' '+links);
rewrite(index,x=>x.startsWith('- '+me+' → 博士后')&&x.includes(mn),()=>'- '+me+' → '+label.slice(2));
school(id,'Daniel T. Schwartz（指导名单，身份及年份再核；JPL 待核）','Daniel T. Schwartz（Washington 阶段研究师长）；1995–1996 NASA JPL 博后具名指导待核');
schoolSource(id,' · '+source('Washington 2016 履历',uv+'#page=2')+' · '+source('Washington 关联教职',uw));
function addEnd(file,x){
 const t=get(file);
 if(t.includes(x))return;
 const nl=t.includes('\r\n')?'\r\n':'\n';
 updates.set(file,t.trimEnd()+nl+x+nl);
}
const cross='- '+me+'（Cornell 主聘，Washington 化工系 Affiliate Professor） · '+source('Washington 教师档',uw);
addEnd(uwNote,cross);
addEnd(schoolNote,'\n## 跨校关联任用\n\n'+cross);
const ev=audit(id,[
 ['identity','Washington 2016 履历、当前 Affiliate Professor 页和 Cornell 原档的学位年份、单位和光电材料方向一致；Schwartz CV 所列姓名、Cornell 博士和后续 Washington 合作轨迹一致。',[co,uw,uv,cv],'confirmed'],
 ['affiliation','Cornell 化学与生物分子工程教授，University of Washington Chemical Engineering Affiliate Professor，UW 页面将 Cornell 列为教师主页。',[co,uw],'confirmed'],
 ['research','Cornell 与 Washington 档核光电材料、半导体纳米材料、等离激元及传感。',[co,uw],'confirmed'],
 ['postdoc',note+' 1995–1996 JPL 独立博后阶段的具名导师仍待核。',[cv,uv,co],'group_or_candidate']
],'续查 Cornell 1995 学位导师、JPL／Caltech 1995–1996 具名指导，以及 Washington 阶段确切指导任期。');
relation(id,ev,'postdoc',mentor,'stage_mentor',note,[cv,uv,co],'schwartz');
const pages=[
 {record_id:id,url:uv,raw:'Washington 2016 Chemical Engineering seminar biography confirms the 1995 Cornell PhD and JPL postdoc, followed by Kansas State and arrival at UW in 2000 as a research associate.',excerpt:'独立核学位、JPL 博后、2000 进入 Washington 的岗位。'},
 {record_id:id,url:uw,raw:'UW Chemical Engineering lists Qiuming Yu as an Affiliate Professor and links to Cornell. Education: Cornell 1995. Research interests include optoelectronics, plasmonics, and nanofabrication.',excerpt:'核现任关联教职、方向。'},
 {record_id:id,url:cv,raw:'Daniel Schwartz’s CV lists Qiuming Yu, Cornell University PhD, followed by (2000) in the Postdoctoral Supervision section.',excerpt:'保留具名研究指导及括号年份歧义。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0950_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0950_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0950_Cornell及Washington履历原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
