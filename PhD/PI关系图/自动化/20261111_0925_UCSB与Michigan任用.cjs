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
 orig.audit_id='pi_archive_20261111_0925_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0925_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const v='aea9d2f3',x='acd71870';
const name='Vojtech Vlcek', mentor='人员 - UCLA - Daniel Neuhauser - 298475c2';
const eq='https://eqi.cnsi.ucsb.edu/people/faculty/vojtech-vlcek';
const stan='https://chemistry.stanford.edu/events/physical-chemistry-seminar-professor-vojtech-vlcek-uc-santa-barbara';
const n='https://www.chemistry.ucla.edu/directory/neuhauser-daniel/';
const p='https://www.chem.ucla.edu/dept/Faculty/dxn/pdf/p164_swiftGW.pdf#page=1';
const g='https://www.chem.ucla.edu/dept/Faculty/dxn/pages/publications.html';
const x2018='https://regents.umich.edu/files/meetings/05-18/assets/reports/Liang%2C%20Xiaogan.pdf#page=1';
const x2024='https://regents.umich.edu/files/meetings/05-24/assets/reports/Liang%2C%20Xiaogan.pdf#page=1';
const xap='https://lsa.umich.edu/appliedphysics/people/faculty/xlaoganl.html';
const xPh='https://engineering.princeton.edu/news/2007/12/19/move-over-silicon-advances-pave-way-powerful-carbon-based-electronics';
const q='UCSB Eddleman 研究所教师档与 Stanford 讲者档均列 2016–2018 UCLA 化学与生物化学系博士后。2018 年期内论文首页列 Vlček 和 Daniel Neuhauser 同署该系，UCLA Neuhauser 组出版目录列多篇同期合作。具名研究合作明确，保留 Neuhauser 为低可信博士后导师候选。正式指导待具名原件。';
const qLinks=[source('UCSB 本人院档',eq),source('Stanford 讲座',stan),source('UCLA 托管 2018 年论文首页',p),source('Neuhauser 组原档',g)].join(' · ');
const vFrom=who(v,name), vTo=wiki(mentor,'Daniel Neuhauser');
const entry='- 博士后导师候选：'+vTo+'。'+q+' '+qLinks;
insertAfter(pf(v),'## 师承',entry);
insertAfter(mf(mentor),'## 师承','- 博士后阶段研究者候选（待核）：'+vFrom+'。'+q+' '+qLinks);
const ix=path.join(root,'师承候选线索索引.md'),iLine='- '+vFrom+' → '+entry.slice(2);
if(!get(ix).includes(iLine))updates.set(ix,get(ix).trimEnd()+'\n'+iLine+'\n');
rewrite(pf(v),t=>t.startsWith(boundary),()=>boundary+'UCSB、Stanford 原档核 UCLA 2016–2018 博后、现任化学与生物化学系及 2023 起材料关联。Neuhauser 为博士后导师候选，继续查任用和具名导师档。 '+qLinks);
school(v,' | Gerd Steinle-Neumann、Roi Baer | 待核 | ',' | Gerd Steinle-Neumann、Roi Baer | Daniel Neuhauser（UCLA 博士后导师候选） | ');
schoolSource(v,' · '+qLinks);
const a=audit(v,[
 ['affiliation','UCSB 化学与生物化学系副教授，材料系关联，Eddleman Quantum Institute 教师目录列名。',[eq,stan],'confirmed'],
 ['research','量子多体方法、纳米与异质材料的电子激发态动力学和随机电子结构方法。',[eq,stan],'confirmed'],
 ['postdoc',q,[eq,stan,p,g,n],'group_or_candidate']
],'追 UCLA 2016–2018 博后任用档、本人 CV 或组成员原始身份栏。');
relation(v,a,'postdoc',mentor,'candidate',q,[eq,stan,p,g,n],'neuhauser');
const xd='Michigan 2018 校董会履历分列 Lawrence Berkeley National Laboratory Molecular Foundry 2008–2010 Post-doctoral Researcher、2010–2011 Staff Scientist；Michigan 2024 晋升原档列 Princeton EE 2008 博士及 Michigan 机械工程教授晋升。个人博士后指导待原任用档。';
const xl=[source('Michigan 2018 校董会原档',x2018),source('Michigan 2024 校董会原档',x2024),source('Michigan 应用物理项目',xap)].join(' · ');
personLine(x,boundary,' '+xd+' '+xl);
school(x,' | Stephen Y. Chou（博士阶段课题组负责人，正式导师待核） | 待核 | ',' | Stephen Y. Chou（博士阶段课题组负责人，正式导师待核） | LBNL Molecular Foundry 2008–2010 博士后；2010–2011 Staff Scientist，指导待核 | ');
schoolSource(x,' · '+xl);
audit(x,[
 ['identity','Princeton 工学院同期组档与 Michigan 校董会博士、专业和研究履历吻合。',[xPh,x2024,xap],'confirmed'],
 ['affiliation','Michigan 机械工程教授；应用物理项目与材料科学关联。',[x2024,xap],'confirmed'],
 ['research','纳米压印、二维材料界面及微纳器件。',[x2024,xap],'confirmed'],
 ['postdoc',xd,[x2018,x2024],'unresolved']
],'追 Molecular Foundry 2008–2010 博士后组属、具名指导和 Princeton 博士批准页。');
const pages=[
 {record_id:v,url:eq,raw:'UCSB Eddleman faculty profile identifies Vlcek as associate professor and reports a 2016–2018 UCLA Chemistry and Biochemistry postdoc.',excerpt:'核当前任职、博士后阶段和研究。'},
 {record_id:v,url:stan,raw:'Stanford speaker biography independently confirms the UCLA postdoc, UCSB chemistry faculty and materials affiliation from 2023.',excerpt:'核两个院系及研究方向。'},
 {record_id:v,url:p,raw:'The original 2018 paper lists Vlcek and Neuhauser together at UCLA Chemistry and Biochemistry.',excerpt:'同期同单位研究支持候选。'},
 {record_id:v,url:g,raw:'Neuhauser’s UCLA lab publications list multiple 2017 and 2018 collaborations with Vlcek.',excerpt:'核合作，个人导师待原件。'},
 {record_id:x,url:x2018,raw:'Michigan Regents 2018 appointment document lists Molecular Foundry 2008–2010 postdoctoral researcher and 2010–2011 staff scientist.',excerpt:'分别核博士后与后续岗位。'},
 {record_id:x,url:x2024,raw:'Michigan Regents 2024 record documents Princeton EE 2008 doctorate and the promotion to Michigan professor of mechanical engineering.',excerpt:'核学位、任用和研究。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0925_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0925_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0925_UCSB与Michigan任用原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
