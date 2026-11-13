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
 orig.audit_id='pi_archive_20261111_0913_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0913_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const id='997c29b8', name='Manas Mukherjee', mentor='师承人物 - Rainer Blatt';
const publication='https://asianjournalofphysics.com/wp-content/uploads/2021/11/magneticfieldcalibrationusingasinglebariumion_1_compressed.pdf#page=7';
const second='https://asianjournalofphysics.com/wp-content/uploads/2021/11/surfaceiontrapforbariumion-theindustrialway_1_compressed.pdf#page=23';
const speaker='https://www.sginnovate.com/deeptechsummit';
const cv='https://coldiongroup.wixsite.com/index/manas';
const paper='https://arxiv.org/pdf/quant-ph/0610065';
const official='https://www.cqt.sg/people/manas-mukherjee/';
const lab='https://www.cqt.sg/groups/manas-mukherjee/';
const proof='两篇本人署名文章的作者简介均明确 Innsbruck Lise-Meitner 博士后由 Rainer Blatt 指导。本人在 SGInnovate 的第一人称履历将这段 fellowship 的课题对应 Blatt 组，2006 年原论文核两人 Innsbruck 单位。本人组履历列 fellowship 至 2007 年，起始月份待原任用档。关系可信度高。';
const links=[source('本人署名文章作者简介，第 7 页',publication),source('本人同期学术经历',speaker),source('本人组履历',cv),source('Innsbruck 同期原稿',paper)].join(' · ');
const from=who(id,name),to=wiki(mentor,'Rainer Blatt');
rewrite(pf(id),x=>x.startsWith('- 博士后候选关系：')&&x.includes(mentor),()=>'- 博士后导师：'+to+'。'+proof+' '+links);
rewrite(mf(mentor),x=>x.startsWith('- 博士后研究者候选（待核）：')&&x.includes(records.get(id).filename),()=>'- 博士后研究者：'+from+'。'+proof+' '+links);
rewrite(index,x=>x.startsWith('- '+from+' → 博士后候选关系：')&&x.includes(mentor),()=>'- '+from+' → 博士后导师：'+to+'。'+proof+' '+links);
rewrite(pf(id),x=>x.startsWith('- 博士后经历：'),()=>'- 博士后经历：完成 Heidelberg／GSI 博士研究后赴 Innsbruck 任 Lise Meitner Fellow 至 2007 年，后任印度 IACS 助理教授。 '+source('本人组履历',cv));
rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+'博士和博士后导师已分别确证。Innsbruck 任用起始月份仍待资助原档。 '+links);
school(id,' | Rainer Blatt（博士后候选关系） | ',' | Rainer Blatt（Innsbruck 博士后导师） | ');
schoolSource(id,' · '+source('本人署名文章作者简介',publication)+' · '+source('本人会议履历',speaker));
const a=audit(id,[
 ['identity','作者简介与本人组履历同列 Heidelberg 博士、Innsbruck Lise Meitner 博后、CQT 任职。',[publication,cv,official],'confirmed'],
 ['affiliation','NUS 物理系副教授，CQT 离子阱组 PI。',[official,cv],'confirmed'],
 ['research','离子阱量子处理器、精密光谱、量子模拟和计量。',[lab,official],'confirmed'],
 ['postdoc',proof,[publication,second,speaker,cv,paper],'confirmed_advisor']
],'两个阶段导师已核，继续查 Innsbruck 原任用的起始月份及项目编号。');
relation(id,a,'postdoc',mentor,'advisor',proof,[publication,second,speaker,cv,paper],'blatt');
const pages=[
 {record_id:id,url:publication,raw:'The journal’s author biography explicitly names Rainer Blatt as the supervisor of Manas Mukherjee’s Lise-Meitner postdoctoral fellowship at the University of Innsbruck.',excerpt:'原作者简介确证博士后导师。'},
 {record_id:id,url:second,raw:'A second paper’s author biography independently repeats the named Innsbruck postdoctoral supervision by Rainer Blatt.',excerpt:'第二篇署名原文佐证。'},
 {record_id:id,url:speaker,raw:'In his first-person biography Mukherjee ties the Innsbruck Lise-Meitner fellowship to the Rainer Blatt group.',excerpt:'本人会议履历核导师组和阶段。'},
 {record_id:id,url:paper,raw:'The 2006 author manuscript lists Manas Mukherjee and Rainer Blatt at the Institute for Experimental Physics, University of Innsbruck.',excerpt:'核同期单位与研究。'},
 {record_id:id,url:'https://iqti.iisc.ac.in/wp-content/uploads/2022/12/Prof.-Manas-flyer.pdf',error:'IISc conference PDF direct open returned HTTP 404. Two original signed-article biographies and first-person SGInnovate biography reviewed.'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0913_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0913_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0913_Manas具名博士后导师原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
