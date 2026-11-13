// 将此前直接读取并保存于 Vanderbilt 页面任务的 Dreyer 本人 CV 证据归入 Dreyer。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const id='866ddb3f',p='人员 - Stony Brook - Cyrus Dreyer - 866ddb3f',m='人员 - Rutgers - David Vanderbilt - 08306a21';
const cv='https://bpb-us-e1.wpmucdn.com/you.stonybrook.edu/dist/8/2945/files/2018/09/CyrusDreyerCV091318-1d0mseq.pdf',uni='https://www.stonybrook.edu/physics/people/_profiles/dreyerc.html',phd='https://www.materials.ucsb.edu/people/our-alumni/record-dissertations';
const cached=db.prepare("select excerpt from pages where record_id='08306a21' and url=? and state='done'").get(cv)?.excerpt;
if(!cached?.includes('2015 Postdoctoral Associate, Physics, Rutgers University; Advisor: David Vanderbilt')||!cached.includes('Cyrus E. Dreyer'))throw Error('缓存缺少身份或导师原文');
const old=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(old?.audit_id!=='20261105_866ddb3f_primary')throw Error('人工事件已经变更');
const audit=JSON.parse(old.details_json);audit.audit_id='20261108_dreyer_cached_cv_vanderbilt';audit.aspects.postdoc={status:'confirmed_advisor',note:'此前直接读取的 Stony Brook 托管 Dreyer CV 缓存写 2015 Postdoctoral Associate, Physics, Rutgers University; Advisor: David Vanderbilt；同一摘录含 Cyrus E. Dreyer，学校本人页独立确认 UCSB 博士及 Rutgers 博后。其他博士后阶段和可能共同导师继续核查。',sources:[cv,uni,phd]};audit.followup_required=true;audit.next_step='继续查其他博士后阶段、共同指导者及具体起止日期；Rutgers 2015 阶段 Vanderbilt 已由本人 CV 明列 advisor。';db.close();
const ev=`[本人 Stony Brook 托管 CV 的已读缓存](${cv})列 “2015 Postdoctoral Associate, Physics, Rutgers University; Advisor: David Vanderbilt”；摘录另含 Cyrus E. Dreyer，[学校本人页](${uni})确认 UCSB 博士及 Rutgers 博后。关系类型可信度：高；其他博士后阶段、共同导师及完整起止日期待核。`;
function load(rel){const f=path.join(root,rel);return [f,fs.readFileSync(f,'utf8')]};const changes=new Map();
function replaceLine(rel,needle,repl){const f=path.join(root,rel),s=changes.has(f)?changes.get(f):fs.readFileSync(f,'utf8'),lines=s.split('\n'),ix=lines.map((x,i)=>x.includes(needle)?i:-1).filter(i=>i>=0);if(ix.length!==1)throw Error(rel+' expected one line '+needle+' got '+ix.length);lines[ix[0]]=repl;changes.set(f,lines.join('\n'))}
function addAfter(rel,needle,line){const f=path.join(root,rel),s=changes.has(f)?changes.get(f):fs.readFileSync(f,'utf8');if(s.includes(line))throw Error('already present '+rel);if(s.split(needle).length!==2)throw Error('expected one anchor '+rel);changes.set(f,s.replace(needle,needle+'\n'+line))}
addAfter('人物/'+p+'.md','## 师承',`- 博士后导师：[[${m}|David Vanderbilt]]。${ev}`);
replaceLine('人物/'+p+'.md','- 核查边界：','- 核查边界：本人 CV 在 Rutgers 博后条目明确列 Vanderbilt 为 advisor；继续追查是否有其他博士后阶段及共同导师。');
addAfter('人物/'+m+'.md','## 师承',`- 博士后受指导者：[[${p}|Cyrus Dreyer]]。${ev}`);
addAfter('师承关系索引.md',`- [[${p}|Cyrus Dreyer]] → 博士导师：[[人员 - UC Santa Barbara - Chris G. Van de Walle - 6a28e8b5|Chris G. Van de Walle]]。[来源](${phd}) 证据：UCSB 材料系博士论文名录列 2014 年 Cyrus Dreyer 的论文及 advisor Chris Van de Walle；关系类型可信度：高。`,`- [[${p}|Cyrus Dreyer]] → 博士后导师：[[${m}|David Vanderbilt]]。${ev}`);
replaceLine('Stony Brook逐人复核记录.md',`| [[${p}|Cyrus Dreyer]]`,`| [[${p}|Cyrus Dreyer]] | Physics and Astronomy；第一性原理计算、电子材料、半导体缺陷 | Chris G. Van de Walle | David Vanderbilt（Rutgers 博后 advisor；其他阶段待查） | [学校](${uni})；[UCSB 论文名录](${phd})；[本人 CV 已读原文](${cv}) |`);
for(const [f,s] of changes)fs.writeFileSync(f,s,'utf8');
fs.writeFileSync(path.join(__dirname,'人工-20261108-dreyer-cached-cv.json'),JSON.stringify(audit,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'结构化-20261108-dreyer-cached-cv.json'),JSON.stringify([{event_id:'20261108_dreyer_vanderbilt_cached_cv_advisor',record_id:id,stage:'postdoc',mentor_filename:m,kind:'advisor',source_audit_id:audit.audit_id,evidence:'本人 CV 已读缓存明列 2015 Rutgers Physics Postdoctoral Associate; Advisor: David Vanderbilt；学校本人页确认其 UCSB 博士与 Rutgers 博后。',sources:[cv,uni]}],null,2)+'\n');
console.log(JSON.stringify({files:changes.size,audit:audit.audit_id,relation:'Rutgers postdoc advisor'}));
