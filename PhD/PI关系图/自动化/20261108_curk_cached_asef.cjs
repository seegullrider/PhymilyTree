// 按已读 ASEF 人物页缓存，分别记录 Curk 在 CAS 和 Northwestern 的博士后研究师长。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),id='2fe7dc7a',p='人员 - Johns Hopkins - Tine Curk - 2fe7dc7a',e='人员 - Northwestern - Erik Luijten - 257f1179',j='师承人物 - Jure Dobnikar';
const src='https://asef.net/asef-mentors-and-tutors/tine-curk/',school='https://inbt.jhu.edu/people/tine-curk/',oldsrc='https://tc387.github.io/';
const page=db.prepare("select excerpt from pages where record_id=? and url=? and state='done'").get(id,src)?.excerpt;
for(const text of ['Tine Curk is an assistant professor','Chinese Academy of Sciences (under the mentorship of Jure Dobnikar)','Northwestern University (under the mentorship of Erik Luijten)'])if(!page?.includes(text))throw Error('已读缓存缺少 '+text);
const old=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(old?.audit_id!=='20261105_2fe7dc7a_primary')throw Error('最新事件变化');
const audit=JSON.parse(old.details_json);audit.audit_id='20261108_curk_cached_asef_mentors';audit.aspects.postdoc={status:'confirmed_advisor',note:'ASEF 人物介绍的已读原文分别称其中国科学院博士后 under mentorship of Jure Dobnikar、Northwestern 博后 under mentorship of Erik Luijten。按两个阶段研究师长记录；正式 advisor 职衔和具体任职时间仍需核查。',sources:[src,oldsrc,school]};audit.followup_required=true;audit.next_step='查 CAS 与 Northwestern 两段博士后正式聘任角色和准确年份；阶段研究师长已由人物简介明确。';db.close();
const evidence=`[ASEF 人物介绍的已读原文](${src})明确称其中国科学院博士后 “under the mentorship of Jure Dobnikar”、Northwestern 博后 “under the mentorship of Erik Luijten”；支持两段研究指导，未直接说明正式 advisor 职衔。`;
const changes=new Map();function text(rel){const f=path.join(root,rel);return [f,changes.has(f)?changes.get(f):fs.readFileSync(f,'utf8')]}
function replaceLine(rel,needle,repl){let [f,s]=text(rel),lines=s.split('\n'),idx=lines.map((x,i)=>x.includes(needle)?i:-1).filter(i=>i>=0);if(idx.length!==1)throw Error(rel+' hits '+idx.length);lines[idx[0]]=repl;changes.set(f,lines.join('\n'))}
function addAfter(rel,needle,line){let [f,s]=text(rel);if(s.includes(line)||s.split(needle).length!==2)throw Error('重复或锚点有误 '+rel);changes.set(f,s.replace(needle,needle+'\n'+line))}
replaceLine('人物/'+p+'.md','- 博士后课题组：',`- 博士后阶段研究师长：[[${e}|Erik Luijten]]。${evidence}`);
addAfter('人物/'+p+'.md',`- 博士后阶段研究师长：[[${e}|Erik Luijten]]。${evidence}`,`- 博士后阶段研究师长：[[${j}|Jure Dobnikar]]。${evidence}`);
replaceLine('人物/'+p+'.md','- 核查边界：','- 核查边界：两段博士后研究师长依据 ASEF 人物介绍；正式 advisor 职衔及各段准确年份待核。与其他课题组合作不自动记为导师。');
replaceLine('人物/'+e+'.md',`[[${p}|Tine Curk]]`,`- 博士后阶段受指导者：[[${p}|Tine Curk]]。${evidence}`);
const jf=path.join(root,'人物',j+'.md');if(fs.existsSync(jf))throw Error('候选师长节点已存在，需核对');changes.set(jf,`# Jure Dobnikar\n\n> [!info] 师承扩展人物\n> ASEF 人物介绍称其为 Tine Curk 中国科学院博士后阶段研究师长；现职与其他身份信息待核。\n\n## 师承\n\n- 博士后阶段受指导者：[[${p}|Tine Curk]]。${evidence}\n`);
replaceLine('师承关系索引.md',`[[${p}|Tine Curk]] → 博士后课题组：`,`- [[${p}|Tine Curk]] → 博士后阶段研究师长：[[${e}|Erik Luijten]]。${evidence}`);
addAfter('师承关系索引.md',`- [[${p}|Tine Curk]] → 博士后阶段研究师长：[[${e}|Erik Luijten]]。${evidence}`,`- [[${p}|Tine Curk]] → 博士后阶段研究师长：[[${j}|Jure Dobnikar]]。${evidence}`);
replaceLine('Johns Hopkins逐人复核记录.md',`| [[${p}|Tine Curk]]`,`| [[${p}|Tine Curk]] | 材料科学与工程系、物理系（兼任）；软物质、统计物理、聚合物物理 | Daan Frenkel | Jure Dobnikar（CAS 阶段研究师长）、Erik Luijten（Northwestern 阶段研究师长）；正式 advisor 待核 | [ASEF 人物页](${src})；[学校研究所](${school})；[旧主页](${oldsrc}) |`);
const events=[[j,'dobnikar','CAS'],[e,'luijten','Northwestern']].map(([mentor_filename,key,unit])=>({event_id:`20261108_curk_${key}_cached_stage`,record_id:id,stage:'postdoc',mentor_filename,kind:'stage_mentor',source_audit_id:audit.audit_id,evidence:`ASEF 已读人物介绍明确 Curk 的 ${unit} 博士后 under the mentorship of ${key==='dobnikar'?'Jure Dobnikar':'Erik Luijten'}；正式岗位 advisor 称谓待核。`,sources:[src]}));
for(const [f,s] of changes)fs.writeFileSync(f,s,'utf8');fs.writeFileSync(path.join(__dirname,'人工-20261108-curk-asef.json'),JSON.stringify(audit,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'结构化-20261108-curk-asef.json'),JSON.stringify(events,null,2)+'\n');console.log(JSON.stringify({files:changes.size,typed:events.length,audit:audit.audit_id}));
