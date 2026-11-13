// 以可读取的 2023 ORNL 履历复核已有关系，保留研究指导与岗位职衔区别。
const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..'),id='bcdf4e7c';
const person='人员 - Arizona State - Houlong Zhuang - '+id,mentor='师承人物 - Panchapakesan Ganesh';
const cv='https://www.ornl.gov/sites/default/files/2023-06/PGanesh_Bio%20Sketch.pdf',lab='https://web.ornl.gov/~ganeshp/People.html',asu='https://resilience.asu.edu/Zhuang';
const rd=f=>fs.readFileSync(path.join(root,f),'utf8'),wr=(f,s)=>fs.writeFileSync(path.join(root,f),s,'utf8');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);db.close();if(!row)throw Error('缺少台账');
let a=JSON.parse(row.details_json),p=rd(`人物/${person}.md`),m=rd(`人物/${mentor}.md`),idx=rd('师承关系索引.md'),table=rd('Arizona State逐人复核记录.md');
if(!p.includes('- 博士后导师：[['+mentor+'|')||!idx.includes(`→ 博士后导师：[[${mentor}|Panchapakesan Ganesh]]`)||!table.includes('Panchapakesan Ganesh（明确指导）')||!m.includes('- 博士后研究者：[['+person+'|'))throw Error('既有标记未匹配');
p=p.replace('- 博士后导师：[['+mentor+'|','- 博士后阶段研究师长：[['+mentor+'|').replace('关系类型：明确博士后指导；可信度：高。','关系类型：明确博士后阶段研究指导；岗位正式 advisor 职衔未单列；可信度：高。');
p=p.replace('且 ORNL 课题组页列 2014–2015 年博士后；关系类型可信度：高。','且 ORNL 课题组页列 2014–2015 年博士后；[可读的 2023 年履历]('+cv+')同样在“Postdoctoral Trainees I advised”名单列其人。岗位正式 advisor 职衔未单列；阶段指导可信度高。');
m=m.replace('- 博士后研究者：[['+person+'|','- 博士后阶段受指导者：[['+person+'|').replace('列为其指导过的博士后；[课题组页]','列为其指导过的博士后；[可读的 2023 年履历]('+cv+')复核同一名单；[课题组页]');
idx=idx.replace(`→ 博士后导师：[[${mentor}|Panchapakesan Ganesh]]`,`→ 博士后阶段研究师长：[[${mentor}|Panchapakesan Ganesh]]`).replace('列为其指导过的博士后。','列为其指导过的博士后；[可读的 2023 年履历]('+cv+')证实该名单，岗位正式 advisor 职衔待核。');
table=table.replace('Panchapakesan Ganesh（明确指导）','Panchapakesan Ganesh（博士后阶段明确研究指导，岗位正式职衔待核）');
wr(`人物/${person}.md`,p);wr(`人物/${mentor}.md`,m);wr('师承关系索引.md',idx);wr('Arizona State逐人复核记录.md',table);
a.audit_id='20261108_zhuang_ganesh_2023_'+id;a.aspects.identity.sources=[...new Set([...a.aspects.identity.sources,asu])];a.aspects.postdoc={status:'confirmed_advisor',note:'Ganesh 本人 2023 ORNL 履历明确把 Zhuang 列入其指导的博士后学员，实验室页面列 2014–2015；确认为博士后阶段研究师长，岗位正式 advisor 职衔未单列，其他三人仍为候选。',sources:[cv,lab,asu]};a.followup_required=true;a.next_step='Cornell 主机退避结束后复核既有博士论文；核 ORNL 岗位正式 advisor 职衔、Princeton Carter 组及 Kent、Cooper 的指导身份。';
const edge=[{event_id:'20261108_zhuang_ganesh_stage_'+id,record_id:id,stage:'postdoc',mentor_filename:mentor,kind:'stage_mentor',source_audit_id:a.audit_id,evidence:'Ganesh 本人 2023 ORNL 履历明确在 Postdoctoral Trainees I advised 一节列 Houlong Zhuang；实验室页面列 2014–2015 博后及其 ASU 去向，证明阶段指导；岗位正式 advisor 职衔未单列。',sources:[cv,lab,asu]}];
wr(`自动化/人工-20261108-ZhuangGanesh-${id}.json`,JSON.stringify(a,null,2)+'\n');wr(`自动化/结构化-20261108-ZhuangGanesh-${id}.json`,JSON.stringify(edge,null,2)+'\n');console.log(JSON.stringify({record_id:id}));
