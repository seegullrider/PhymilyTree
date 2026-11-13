const fs = require('node:fs'), path = require('node:path'), {DatabaseSync} = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const person = '人员 - NYU - Mark Tuckerman - 35dfbad6';
const mentors = [
  {file:'师承人物 - Bruce Berne',name:'Bruce Berne',stage:'phd',forward:'博士阶段研究师长',reverse:'博士阶段受指导者',evidence:'本人著作序言称 Berne 在其研究生阶段给予指导；NYU 原简介将其博士阶段归入 Berne 组。论文正式 advisor 字段仍待核。'},
  {file:'师承人物 - Michele Parrinello',name:'Michele Parrinello',stage:'postdoc',forward:'博士后阶段研究师长',reverse:'博士后阶段受指导者',evidence:'本人著作序言称 Parrinello 在 IBM Rüschlikon 博士后期间给予指导；岗位正式 advisor 职衔待核。'},
  {file:'师承人物 - Michael L. Klein',name:'Michael L. Klein',stage:'postdoc',forward:'博士后阶段研究师长',reverse:'博士后阶段受指导者',evidence:'本人著作序言称 Klein 在其 Penn NSF 博士后期间给予指导；岗位正式 advisor 职衔待核。'}
];
const source='https://api.pageplace.de/preview/DT0400.9780192559616_A47280314/preview-9780192559616_A47280314.pdf';
const oldSource='https://research.shanghai.nyu.edu/centers-and-institutes/chemistry/people/mark-tuckerman';
const ref=`[本人著作序言，第 xi–xii 页](${source})`;
const staged=new Map();
function edit(rel, fn) {const f=path.join(root,rel),s=staged.has(f)?staged.get(f):fs.readFileSync(f,'utf8');staged.set(f,fn(s));}
function one(s,old,rep){if(!old||s.split(old).length!==2)throw Error('Expected exactly one occurrence: '+old);return s.replace(old,rep);}
function line(s,needle){return s.split('\n').find(x=>x.includes(needle));}
edit('人物/'+person+'.md',s=>{for(const m of mentors){let old=line(s,`- ${m.stage==='phd'?'博士阶段课题组负责人':'博士后课题组负责人'}：[[${m.file}`);s=one(s,old,`- ${m.forward}：[[${m.file}|${m.name}]]。${ref}：${m.evidence}`);}let old=line(s,'- 核查边界：');return one(s,old,'- 核查边界：本人著作序言直接确认三个阶段的 mentoring，Berne 的正式论文导师字段及两段博士后正式 advisor 职衔仍需核对。此前 NYU 组属来源保留：'+oldSource+' 。');});
for(const m of mentors) edit('人物/'+m.file+'.md',s=>{let old=line(s,`- ${m.stage==='phd'?'博士阶段课题组成员':'博士后课题组成员'}：[[${person}`);return one(s,old,`- ${m.reverse}：[[${person}|Mark Tuckerman]]。${ref}：${m.evidence}`)});
edit('师承关系索引.md',s=>{for(const m of mentors){let old=line(s,`[[${person}|Mark Tuckerman]] → ${m.stage==='phd'?'博士阶段课题组负责人':'博士后课题组负责人'}：[[${m.file}`);s=one(s,old,`- [[${person}|Mark Tuckerman]] → ${m.forward}：[[${m.file}|${m.name}]]。${ref}：${m.evidence}`);}return s;});
edit('NYU逐人复核记录.md',s=>{const old=line(s,`| [[${person}|Mark Tuckerman]]`);return one(s,old,`| [[${person}|Mark Tuckerman]] | 化学系、数学系、物理系；统计力学、分子动力学、量子动力学、分子晶体 | Bruce Berne（博士阶段研究师长；正式论文导师待核） | Michele Parrinello、Michael L. Klein（博士后阶段研究师长；正式岗位称谓待核） | ${ref}；[既有院系来源](${oldSource}) |`)});
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('35dfbad6');db.close();if(!row)throw Error('missing audit');
const audit=JSON.parse(row.details_json);audit.audit_id='20261108_tuckerman_preface';audit.aspects.phd={status:'confirmed_advisor',note:'本人著作序言明确 Berne 为研究生阶段师长；结合既有博士组属支持博士阶段研究指导，正式论文导师字段待核。',sources:[source,oldSource]};audit.aspects.postdoc={status:'confirmed_advisor',note:'本人著作序言明确 Parrinello 指导 IBM 博士后、Klein 指导 Penn NSF 博士后；记阶段研究师长，正式岗位称谓待核。',sources:[source,oldSource]};audit.followup_required=true;audit.next_step='查 Columbia 学位论文的正式 advisor 字段；核博士后正式岗位称谓；复查研究方向及物理系关联。';
const events=mentors.map((m,i)=>({event_id:`20261108_tuckerman_preface_${i}`,record_id:'35dfbad6',stage:m.stage,mentor_filename:m.file,kind:'stage_mentor',source_audit_id:audit.audit_id,evidence:m.evidence,sources:[source]}));
staged.set(path.join(__dirname,'人工-20261108-tuckerman.json'),JSON.stringify(audit,null,2)+'\n');staged.set(path.join(__dirname,'结构化-20261108-tuckerman.json'),JSON.stringify(events,null,2)+'\n');for(const [f,s] of staged)fs.writeFileSync(f,s,'utf8');console.log('prepared '+staged.size+' files');
