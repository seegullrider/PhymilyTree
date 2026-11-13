// Append a low-confidence lead, not an assertion of supervision.
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),id='12daaa82';
const person='人员 - Ohio State - Jonathan Pelz — 荣休 - 12daaa82',mentor='人员 - UC Berkeley - John Clarke - 1c042385';
const aps='https://journals.aps.org/prb/abstract/10.1103/PhysRevB.38.10371',lab='https://www.osti.gov/servlets/purl/6247378',directory='https://library.osu.edu/node/11730',thesis='https://escholarship.org/content/qt6923n54c/qt6923n54c.pdf';
const evidence='1985 年 Berkeley／LBL 原始报告及 1988 年 APS 页面列 Jonathan Pelz 与 John Clarke 合作铜薄膜噪声研究；只能作为博士导师候选，合著不证明指导。搜索索引提示同题博士论文，原文因主机退避尚未打开，姓名及指导字段须复核。';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);db.close();if(!row)throw Error('Missing existing audit');
const audit=JSON.parse(row.details_json);audit.audit_id='20261108_Pelz_Clarke_candidate';audit.aspects.phd={status:'group_or_candidate',note:'1985 Berkeley／LBL 合著报告及 1988 APS 论文列 Pelz 与 Clarke 同领域合作；仅是低可信导师候选。搜索索引提示同名博士论文，原文未读，身份、正式导师及 1987／1988 年份待核。',sources:[aps,lab,directory]};audit.followup_required=true;audit.next_step='遵守 escholarship.org 退避至 13:56 UTC；届时核读候选论文原文、姓名及签署／致谢页，查 IBM 博后导师。';
const files=new Map();const get=rel=>{const f=path.join(root,rel);if(!fs.existsSync(f))throw Error('Missing '+rel);return [f,fs.readFileSync(f,'utf8')]};
function atHeading(rel,line){let [f,s]=get(rel);if(s.includes(line))throw Error('Already inserted '+rel);if(!s.includes('## 师承\n'))throw Error('Missing section '+rel);files.set(f,s.replace('## 师承\n','## 师承\n\n'+line+'\n'))}
const relation=`- 博士导师候选（低可信）：[[${mentor}|John Clarke]]。${evidence} [1985 LBL 报告](${lab})；[1988 APS 论文](${aps})；[论文检索线索，未读原文](${thesis})。`;
atHeading('人物/'+person+'.md',relation);
atHeading('人物/'+mentor+'.md',`- 博士导师候选关联者（低可信）：[[${person}|Jonathan Pelz]]。${evidence} [1985 LBL 报告](${lab})；[1988 APS 论文](${aps})。`);
let [ix,s]=get('师承关系索引.md');const i=`- [[${person}|Jonathan Pelz]] → 博士导师候选：[[${mentor}|John Clarke]]。${evidence} [LBL 报告](${lab})；[APS](${aps})。`;if(s.includes(i))throw Error('duplicate index');files.set(ix,s.trimEnd()+'\n'+i+'\n');
let [tb,t]=get('Ohio State逐人复核记录.md');const old='| 待核；同系两页分别列博士 1987、1988，年份待核 | 待核 |';const neu='| John Clarke（低可信候选，仅同校同期合著；论文原文和正式导师未核）；同系两页列 1987、1988，年份待核 | 待核 |';if(!t.includes(old))throw Error('school row changed');files.set(tb,t.replace(old,neu));
const event=[{event_id:'20261108_Pelz_Clarke_candidate',record_id:id,stage:'phd',mentor_filename:mentor,kind:'candidate',source_audit_id:audit.audit_id,evidence,sources:[lab,aps,directory]}];
files.set(path.join(__dirname,'人工-20261108-Pelz候选.json'),JSON.stringify(audit,null,2)+'\n');files.set(path.join(__dirname,'结构化-20261108-Pelz候选.json'),JSON.stringify(event,null,2)+'\n');
for(const [f,v] of files)fs.writeFileSync(f,v,'utf8');console.log(JSON.stringify({id,files:files.size,candidate_only:true}));
