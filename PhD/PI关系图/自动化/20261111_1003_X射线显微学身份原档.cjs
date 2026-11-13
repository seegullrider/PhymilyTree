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
 orig.audit_id='pi_archive_20261111_1003_'+id;
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
 relations.push({event_id:'pi_archive_20261111_1003_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const j='b7a7ae16', f='b96a5892';
const nw='https://physics.northwestern.edu/people/faculty/research-faculty/chris-jacobsen.html';
const an='https://www.aps.anl.gov/APS-News/Jacobsen-of-XSD-Elected-to-American-Physical-Society-Fellowship';
const c='https://sites.google.com/carnegiescience.edu/georgecody/laboratory/micro-xanes';
const kv='https://www.stonybrook.edu/commcms/physics/people/_profiles/_cvs/kirzj.pdf';
const o='https://www.osti.gov/servlets/purl/6794253';
const u1='https://www.uvm.edu/president/profile/chris-jacobsen';
const u2='https://www.uvm.edu/uvmnews/news/uvm-foundation-names-chris-jacobsen-president-and-ceo';
const pf1='https://www.oeaw.ac.at/en/mbi/the-institute/staff-members/staff/peter-fischer';
const lb='https://materialssciences.lbl.gov/profile/pjfischer/';
const k='师承人物 - Janos Kirz', kW=wiki(k,'Janos Kirz'), jW=who(j,'Chris Jacobsen');
const jNote='Carnegie Science 的 STXM 早期使用者 George Cody 具名把 Chris Jacobsen 称为 Janos Kirz 的学生，并将两人与 Stony Brook X 射线光学组的仪器开发对应。Northwestern 和 Argonne 核其 1988 年 Stony Brook 物理博士。记博士阶段研究师长；正式论文导师字段待可读学位原件。';
const jLinks=source('Cody 本人技术回顾',c)+' · '+source('Northwestern 原档',nw)+' · '+source('历史论文线索',o);
const jIdentity='UVM 两个机构原页的 Christopher D. Jacobsen 是 Boston College 高等教育博士、大学基金会负责人。Northwestern Chris Jacobsen 是 Stony Brook 1988 物理博士、X 射线显微学研究教授，系不同人员。';
const fIdentity='奥地利科学院同名 Peter Fischer 是 Detector Development 的 PhD Student；Berkeley Lab 与 UCSC 的 Peter Fischer 是 1993 TU Munich 物理博士、Berkeley Lab 材料科学部主任及 UCSC 物理兼职教授，系不同人员。';
const label='- 博士阶段研究师长：'+kW+'。'+jNote+' '+jLinks;
rewrite(pf(j),x=>x.startsWith('- 博士导师候选：'+kW)||x.startsWith('- 博士阶段研究师长：'+kW),()=>label);
rewrite(pf(j),x=>x.startsWith(boundary),()=>boundary+'Cody 记述支持 Stony Brook 博士阶段指导，论文正式导师字段待原件。Argonne 旧公告分列 Lawrence Berkeley 与 Stony Brook 两段博后，具名指导均待任用档。 '+source('Argonne 原档',an));
personLine(j,boundary,' '+jIdentity+' '+source('UVM 同名机构档',u1));
rewrite(mf(k),x=>x.startsWith('- 博士生候选：'+jW)||x.startsWith('- 博士阶段受指导者：'+jW),()=>'- 博士阶段受指导者：'+jW+'。'+jNote+' '+jLinks);
rewrite(index,x=>x.startsWith('- '+jW+' → 博士')&&x.includes(kW),()=>'- '+jW+' → '+label.slice(2));
school(j,'Janos Kirz（博士导师候选）','Janos Kirz（博士阶段研究师长；正式论文导师待核）');
schoolSource(j,' · '+source('Cody 本人技术回顾',c)+' · '+source('UVM 同名排除',u1));
const jv=audit(j,[['identity',jIdentity,[nw,an,u1,u2],'confirmed'],
 ['phd',jNote,[c,nw,an,kv],'group_or_candidate']],
 '追 Stony Brook 1988 论文题名页或馆藏具名字段，并查 Lawrence Berkeley、Stony Brook 具名博后任用。');
relation(j,jv,'phd',k,'stage_mentor',jNote,[c,nw,an],'kirz');
personLine(f,boundary,' '+fIdentity+' '+source('奥地利科学院同名档',pf1)+' · '+source('Berkeley Lab 本人档',lb));
schoolSource(f,' · '+source('奥地利科学院同名排除',pf1));
const fv=audit(f,[['identity',fIdentity,[pf1,lb],'confirmed'],
 ['affiliation','Berkeley Lab 原档列其 2024 起任材料科学部主任，2014 起 UCSC 物理 Adjunct Professor。保持原材料科学工程项目归属。',[lb],'confirmed'],
 ['research','Berkeley Lab 原档核磁性、软 X 射线显微及同步辐射研究。',[lb],'confirmed']],
 '查 TU Munich 1993 稀土体系 XMCD 学位原卷，及 Augsburg 博士后任用日期和具名指导。');
const pageId=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?');
const exclusions=[u1,u2,pf1].map(url=>{
 const target=url===pf1?f:j;
 const p=pageId.get(target,url);if(!p)throw Error('缺少已桥接的同名页 '+url);
 return {page_id:p.id,url,record_id:target,audit_id:target===j?jv:fv,external_subject:target===j?'Christopher D. Jacobsen，University of Vermont Foundation 负责人':'Peter Fischer，奥地利科学院 Detector Development 博士生',evidence:target===j?jIdentity:fIdentity};
});
const pages=[
 {record_id:j,url:c,raw:'George Cody’s first-person account of the Stony Brook X-ray optics project identifies Chris Jacobsen as a student of Janos Kirz and a major developer of the STXM.',excerpt:'原始回忆明确研究指导关系。'},
 {record_id:j,url:nw,raw:'Northwestern identifies its Chris Jacobsen as Research Professor and a Stony Brook 1988 physics PhD.',excerpt:'排除 UVM 同名者。'},
 {record_id:j,url:o,error:'Failed to fetch '+o+': (400) Timeout fetching'},
 {record_id:f,url:lb,raw:'Berkeley Lab identifies Peter Fischer as a 1993 TU Munich physics PhD, UCSC physics adjunct since 2014, and MSD division director since 2024.',excerpt:'排除奥地利科学院同名者。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_1003_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_1003_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_1003_X射线显微学身份原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);

const xf='20261111_1003_X射线显微学同名排除.json';
persist(xf,exclusions);
call('人物网页身份纠偏.cjs',[xf]);
call('检索流程.cjs',['report']);
