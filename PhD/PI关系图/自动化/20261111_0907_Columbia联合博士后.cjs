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
 orig.audit_id='pi_archive_20261111_0907_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0907_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const group='https://reichmangroup.chem.columbia.edu/directory';
const yale='https://sous.yale.edu/profile/john-sous';
const mich='https://sites.lsa.umich.edu/zgid/dominika/';
const news='https://lsa.umich.edu/content/dam/chem-assets/chem-docs/newsletters/12newsletter.pdf#page=2';
const mentors=[['38d42d59','David R. Reichman','reichman'],['2c80d694','Andrew J. Millis','millis']];
const sous='Reichman 实验室原校友档把 John Sous 列为 2019–2022 年 Columbia 博士后，并明确为与 Andy Millis 的联合博士后。Sous 本人 Yale 履历将 Columbia MRSEC 博士后和后续 Stanford Moore 博士后分开，另核 2024 年由 UCSD 转 Yale。联合组属可信度高，正式导师职衔待任用原件。';
const zgid='Reichman 实验室原校友档明确 Dominika Zgid 于 2011–2012 年在 Columbia 为与 Andy Millis 的联合博士后。Zgid 本人 Michigan 履历把这段和 2009–2011 Cornell 博后分列，Michigan 化学系当期系刊亦列两个任用单位。联合组属可信度高，正式导师职衔待任用原件。';
const pages=[];
function updateJoint(id,name,evidence,additional,oldCell,newCell,boundaryNote,sourceNote){
 const link=[source('Reichman 联合组属原档',group),...additional.map(([label,url])=>source(label,url))].join(' · ');
 const urls=[group,...additional.map(([,url])=>url)];
 const event=audit(id,[['postdoc',evidence,urls,'group_or_candidate']],boundaryNote);
 const person=who(id,name);
 for(const [mid,mname,suffix] of mentors){
  const filename=records.get(mid).filename;
  const entry='- 博士后课题组负责人：'+wiki(filename,mname)+'。'+evidence+' '+link;
  insertAfter(pf(id),'## 师承',entry);
  insertAfter(mf(filename),'## 师承','- 博士后课题组成员：'+person+'。'+evidence+' '+link);
  const ix='- '+person+' → '+entry.slice(2);
  if(!get(index).includes(ix))updates.set(index,get(index).trimEnd()+'\n'+ix+'\n');
  relation(id,event,'postdoc',filename,'group_leader',evidence,urls,suffix);
 }
 rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+boundaryNote+' '+link);
 school(id,oldCell,newCell);
 schoolSource(id,' · '+link);
 pages.push({record_id:id,url:group,raw:sourceNote,excerpt:'核 Columbia 博士后联合组属，未见正式导师职衔。'});
}
const suOld=' | Steven Kivelson（博士后课题组负责人） | ';
const suNew=' | David R. Reichman、Andrew J. Millis（Columbia 联合博士后课题组负责人）；Steven Kivelson（Stanford 博士后课题组负责人） | ';
for(const [id,name,note] of [
 ['28383745','John Sous','UBC 博士论文签署页和具体指导职衔仍待核。Columbia 联合博士后组属及 Stanford Kivelson 组属已分列，正式博士后导师职衔待任用档。'],
 ['76587db0','John Sous — 已转 Yale','与 Yale 校属节点为同一人，UCSD 为历史任职。UBC 博士论文签署页及 Columbia、Stanford 博士后正式导师职衔仍待查。']
]){
 updateJoint(id,name,sous,[['Yale 本人履历',yale]],suOld,suNew,note,'Columbia Reichman group identifies John Sous as a joint postdoc with Andy Millis, 2019–2022. Yale bio confirms the separate Columbia and Stanford fellowships.');
 pages.push({record_id:id,url:yale,raw:'John Sous’s Yale group biography lists current Yale Applied Physics and Physics appointment, one year at UCSD and separate Stanford and Columbia postdoctoral fellowships.',excerpt:'核现任、跨校历史身份和两段博士后。'});
}
updateJoint('b3ef77a3','Dominika Zgid',zgid,[['Michigan 本人履历',mich],['Michigan 当期化学系刊',news]],' | Garnet K.-L. Chan（Cornell 2009–2011 课题组负责人）；Columbia 2011–2012 指导待核 | ',' | Garnet K.-L. Chan（Cornell 博士后课题组负责人）；David R. Reichman、Andrew J. Millis（Columbia 联合博士后课题组负责人） | ','Waterloo 博士答辩公告列 Marcel Nooijen 为 supervisor。Cornell 2009–2011 Chan 博士后组属与 Columbia 2011–2012 Reichman、Millis 联合博士后组属分列。两段正式博后导师职衔待任用档。','Columbia Reichman group lists Dominika Zgid as a joint postdoc with Andy Millis at Columbia, 2011–2012.');
pages.push({record_id:'b3ef77a3',url:mich,raw:'Zgid’s Michigan group biography lists separate Cornell Chemistry and Columbia Physics postdoctoral appointments.',excerpt:'核两个博士后阶段与 Michigan 教职。'});
pages.push({record_id:'b3ef77a3',url:news,raw:'The Michigan Chemistry new faculty profile lists both Cornell and Columbia postdocs and computational chemistry research.',excerpt:'当期系刊交叉核任用与研究。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0907_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0907_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0907_Columbia联合博士后原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
