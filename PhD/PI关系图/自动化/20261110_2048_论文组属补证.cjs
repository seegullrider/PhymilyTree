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
 rewrite(file,x=>x.startsWith(prefix),(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261110_2048_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2048_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}



const d='e0fc6317', km='师承人物 - Lionel C. Kimerling';
const dl=who(d,'Luca Dal Negro'), kl=wiki(km,'Lionel C. Kimerling');
const y='https://citeseerx.ist.psu.edu/document?doi=07817bedf7937a619fc9072d43380d51084d8214&repid=rep1&type=pdf';
const b='https://www.bu.edu/eng/files/2022/10/eng.alumni.2005-Fall-ENG-Magazine.pdf';
const m='https://microphotonics.mit.edu/about/people/';
const a='https://tesidottorato.depositolegale.it/handle/20.500.14242/257641';
const ev='Jae Hyung Yi 的 2008 年 MIT 博士论文签署页列 Lionel C. Kimerling 为 Thesis Supervisor，致谢说明自己是 Kimerling 组成员，并记 Luca Dal Negro 在同一 EMAT 组任博后超过两年。BU 同期工程院原刊核其 2003 年起在 MIT 材料系做博后。Kimerling 的组负责人关系有同期原文，个人正式博后指导仍待核，旧候选线索保留。';
const es=[source('Yi 学位论文原文，签署页及致谢',y),source('BU 同期原刊',b),source('MIT Microphotonics 人物原档',m)].join(' · ');
rewrite(pf(d),x=>x.startsWith('- 博士后导师候选：')&&x.includes(km),x=>'- 博士后课题组负责人：'+kl+'。'+ev+' '+es+' 历史追查线索：'+x.slice(x.indexOf('。[来源]')+1));
rewrite(mf(km),x=>x.startsWith('- 博士后指导候选：')&&x.includes(records.get(d).filename),x=>'- 博士后课题组成员：'+dl+'。'+ev+' '+es+' 历史追查线索：'+x.slice(x.indexOf('。[既有')+1));
rewrite(index,x=>x.startsWith('- '+dl+' → 博士后导师候选：')&&x.includes(km),x=>'- '+dl+' → 博士后课题组负责人：'+kl+'。'+ev+' '+es+' 历史追查线索：'+x.slice(x.indexOf('。[来源]')+1));
school(d,'Lionel C. Kimerling（候选） |','Lionel C. Kimerling（EMAT 课题组负责人，个人指导待核） |');
schoolSource(d,' · '+es);
const ar=audit(d,[['postdoc',ev,[y,b,m],'group_or_candidate']], '取得 Trento 正式存档页或论文签署页，区分 2003 学位年与 2004 出版年，另核 MIT 个人博后任用指导。意大利目录网页工具缓存缺失，本地 DNS 未解析，搜索索引只留追查线索。');
relation(d,ar,'postdoc',km,'group_leader',ev,[y,b,m],'kimerling');
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length}));
 process.exit(0);
}
const observed=[
 {record_id:d,url:y,raw:'L33–35 Lionel C. Kimerling Thesis Supervisor. L43 Jae Hyung Yi. L88–96 author trained in Kimerling group and Dal Negro was a postdoctoral fellow in our group for more than two years; L97 identifies EMAT.',excerpt:'同期 MIT 学位论文签署页和致谢核 Dal Negro 博后课题组归属，个人导师仍待核。'},
 {record_id:d,url:m,raw:'L43–47, L147 Lionel Kimerling MIT Materials Science and Engineering, founded Microphotonics Center, design and processing of semiconductor materials and devices.',excerpt:'机构原档核课题组负责人身份及研究领域。'},
 {record_id:d,url:a,error:'Direct original page returned cache miss; local resolver could not resolve host. Search-index citation retained only as a clue.'}
];
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,mode,file){execFileSync(process.execPath,['--no-warnings',script,mode,file],{stdio:'inherit'});}
const pages='20261110_2048_网页原档补证回执.json';
persist(pages,observed);

for(const event of audits){
 const file='20261110_2048_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs','record',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261110_2048_结构化回执.json',relations);
call('结构化师承关系.cjs','record','20261110_2048_结构化回执.json');
call('检索流程.cjs','ingest-reviewed-pages',pages);
