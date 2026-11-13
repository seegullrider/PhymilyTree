// 基于人工身份事件生成待核分组，不写人物页，不合并数据库记录或推断导师。
// 仅当一个同人连通分量的每一对均有最新 same 事件，才作为一个已知身份单元；不完整或冲突则逐条保留。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {phdLabel,postLabel}=require('./人物页导师标签.cjs');
const root=process.env.PI_GRAPH_ROOT||path.resolve(__dirname,'..'),db=new DatabaseSync(process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
db.exec('BEGIN');
const records=db.prepare(`SELECT r.id,r.name,r.unit,r.filename,r.relation_json,a.details_json FROM records r LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1) ORDER BY r.unit,r.name,r.id`).all().map(x=>{
 const relations=JSON.parse(x.relation_json);
 return {...x,event:x.details_json?JSON.parse(x.details_json):null,explicit:{
  phd:relations.some(relation=>phdLabel(relation.type)),
  postdoc:relations.some(relation=>postLabel(relation.type))
 }};
});
const assertions=db.prepare(`SELECT i.left_id,i.right_id,i.kind FROM identity_assertion_events i WHERE i.rowid=(SELECT x.rowid FROM identity_assertion_events x WHERE x.left_id=i.left_id AND x.right_id=i.right_id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();
const hasTyped = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='typed_relation_events'").get());
const typed = hasTyped ? db.prepare(`SELECT t.record_id,t.stage,t.mentor_filename,t.kind,t.evidence
 FROM typed_relation_events t WHERE t.kind<>'retracted' AND t.rowid=(SELECT x.rowid FROM typed_relation_events x
  WHERE x.record_id=t.record_id AND x.stage=t.stage AND x.mentor_filename=t.mentor_filename
  ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all() : [];
db.exec('COMMIT');
db.close();
const byId=new Map(records.map(r=>[r.id,r])),pair=(a,b)=>[a,b].sort().join('\0'),allEdges=new Map(),adj=new Map();for(const e of assertions){if(!byId.has(e.left_id)||!byId.has(e.right_id)||e.left_id===e.right_id)throw Error('身份事件指向未知或相同记录');allEdges.set(pair(e.left_id,e.right_id),e.kind);if(e.kind==='same'){for(const [a,b] of [[e.left_id,e.right_id],[e.right_id,e.left_id]]){if(!adj.has(a))adj.set(a,new Set());adj.get(a).add(b)}}}
const seen=new Set(),groups=[],issues=[];for(const id of adj.keys()){if(seen.has(id))continue;let todo=[id],ids=[];seen.add(id);while(todo.length){let x=todo.pop();ids.push(x);for(const y of adj.get(x))if(!seen.has(y)){seen.add(y);todo.push(y)}}ids.sort();let missing=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)if(allEdges.get(pair(ids[i],ids[j]))!=='same')missing.push({left:ids[i],right:ids[j],kind:allEdges.get(pair(ids[i],ids[j]))||'missing'});if(missing.length){issues.push({ids,missing});for(const x of ids)groups.push([byId.get(x)])}else groups.push(ids.map(x=>byId.get(x)));}
for(const r of records)if(!seen.has(r.id))groups.push([r]);
const typedByRecord = new Map();
for (const relation of typed) {
 const edges = typedByRecord.get(relation.record_id) || [];
 edges.push(relation);
 typedByRecord.set(relation.record_id, edges);
}
const roleDifferences = [];
for (const group of groups.filter(items => items.length > 1)) {
 const byMentorAndStage = new Map();
 for (const r of group) for (const relation of typedByRecord.get(r.id) || []) {
  const key = `${relation.stage}\0${relation.mentor_filename}`;
  const edges = byMentorAndStage.get(key) || [];
  edges.push(relation);
  byMentorAndStage.set(key, edges);
 }
 for (const edges of byMentorAndStage.values()) {
  if (new Set(edges.map(edge => edge.kind)).size > 1) roleDifferences.push(edges);
 }
}
const status=(r,k)=>r.event?.aspects?.[k]?.status||'no_event';const desc={confirmed_advisor:'已登记指导关系（类型可能混合）',group_or_candidate:'阶段关系或候选',unresolved:'未明',no_postdoc_documented:'未发现博士后经历（待核）',no_event:'无人工事件'};
const counts={};for(const k of ['phd','postdoc']){counts[k]={all_unresolved:0,any_unresolved:0,any_candidate:0,any_no_postdoc:0,mixed_status:0};for(const g of groups){let s=g.map(r=>status(r,k));if(s.every(x=>x==='unresolved'||x==='no_event'))counts[k].all_unresolved++;if(s.some(x=>x==='unresolved'||x==='no_event'))counts[k].any_unresolved++;if(s.includes('group_or_candidate'))counts[k].any_candidate++;if(s.includes('no_postdoc_documented'))counts[k].any_no_postdoc++;if(new Set(s).size>1)counts[k].mixed_status++;}}
const esc=s=>String(s??'').replace(/[\r\n|]+/g,'／').replace(/[\[\]]/g,' ').trim(),link=r=>`[[${r.filename}|${esc(r.name)} · ${esc(r.unit)}]]`;
groups.sort((a,b)=>a[0].name.localeCompare(b[0].name)||a[0].unit.localeCompare(b[0].unit));
const stages=['phd','postdoc'];
const stageName={phd:'博士',postdoc:'博士后'};
const units=groups.map(records=>({
 records,
 missing:stages.filter(stage=>records.every(r=>!r.explicit[stage])),
 mixed:stages.filter(stage=>records.some(r=>r.explicit[stage])&&records.some(r=>!r.explicit[stage]))
}));
const explicitLabelGaps={
 phd:units.filter(u=>u.missing.includes('phd')).length,
 postdoc:units.filter(u=>u.missing.includes('postdoc')).length,
 either:units.filter(u=>u.missing.length).length,
 mixed:units.filter(u=>u.mixed.length).length
};
let out=`# 已知同人聚合的师承待核\n\n[[待核师承名单|按校属记录查看]] · [[跨校人物身份判定（人工核查）|已登记身份判断]] · [[PI关系图总入口|图谱入口]]\n\n生成时间：${new Date().toISOString()}。共 ${records.length} 条校属记录，依据已有人工同人事件形成 ${groups.length} 个身份聚合单元；这不是去重后的精确人数，未登记的同人、同名与非 PI 记录仍可能存在。仅将所有两两同人关系都已明确记录的连通分量聚合，不完整或冲突的分量保留原记录。\n\n下表按每条校属记录的最新人工事件显示各阶段状态；同一身份的不同状态同时展示，不能以其中一条自动覆盖其他记录。旧台账的“已登记指导关系”可能混合正式导师和阶段师长；未明也可能有历史可靠记录，必须查看人物页与原始来源。未发现博士后经历不等于存在博士后导师。此表不将检索结束视为查明师承。\n\n`;
out+=`## 人物页明确导师标签缺口\n\n将同一身份单元中全部校属人物页都缺标签的阶段计为缺口。博士缺 ${explicitLabelGaps.phd} 个单元，博士后缺 ${explicitLabelGaps.postdoc} 个单元，至少缺一阶段共 ${explicitLabelGaps.either} 个单元。另有 ${explicitLabelGaps.mixed} 个单元至少一阶段只有部分校属页有明确标签，可能与前述单元重叠。逐校原始缺口见 [[师承未明确名单（按阶段和学校）]]。\n\n## 最新人工事件统计\n\n`;
out+='| 统计口径 | 博士 | 博士后 |\n|---|---:|---:|\n';out+=`| 聚合单元中所有记录为未明或无事件 | ${counts.phd.all_unresolved} | ${counts.postdoc.all_unresolved} |\n| 聚合单元中至少一条记录为未明或无事件 | ${counts.phd.any_unresolved} | ${counts.postdoc.any_unresolved} |\n| 聚合单元中至少一条记录仅为阶段关系或候选 | ${counts.phd.any_candidate} | ${counts.postdoc.any_candidate} |\n| 同一聚合单元的校属记录状态不一致 | ${counts.phd.mixed_status} | ${counts.postdoc.mixed_status} |\n\n`;
out+=`博士后另有 ${counts.postdoc.any_no_postdoc} 个单元含“未发现经历，待核”的记录。各行、两阶段和校属记录可交叉，不可相加；由于旧事件分类混合，不能从这组事件统计计算正式导师缺口。\n\n`;
if(issues.length){out+='## 同人事件组合待复核\n\n';for(const x of issues)out+=`- ${x.ids.map(id=>link(byId.get(id))).join(' / ')}：尚有 ${x.missing.length} 个记录对缺少一致的同人判断，未聚合。\n`;out+='\n'}
if (hasTyped) {
 const types = { advisor: '明确导师', stage_mentor: '阶段研究师长', group_leader: '课题组负责人', candidate: '候选' };
 out += `## 同人记录中的关系分类差异（${roleDifferences.length} 组）\n\n只比较已确认同人的记录中，阶段和师长节点均相同且双方都有结构化记录的关系。每条列出各自证据，供人工复核。\n\n`;
 for (const edges of roleDifferences) {
  const [first] = edges;
  out += `- ${first.stage === 'phd' ? '博士' : '博士后'}，[[${first.mentor_filename}]]。\n`;
  for (const edge of edges) out += `  - ${link(byId.get(edge.record_id))}：${types[edge.kind]}。${esc(edge.evidence)}\n`;
 }
 out += '\n';
}
out+='## 待进一步核查的身份单元\n\n| 校属记录（已知同人放在同一行） | 博士阶段：各记录最新状态 | 博士后阶段：各记录最新状态 | 人物页标签缺口 |\n|---|---|---|---|\n';
let pending=0;
for(const {records:group,missing,mixed} of units){
 if(!missing.length&&!mixed.length&&!group.some(r=>stages.some(stage=>status(r,stage)!=='confirmed_advisor')))continue;
 pending++;
 const cell=stage=>group.map(r=>`${esc(r.unit)}：${desc[status(r,stage)]||esc(status(r,stage))}`).join('<br>');
 const gap=[missing.length&&`全部缺：${missing.map(s=>stageName[s]).join('、')}`,mixed.length&&`部分缺：${mixed.map(s=>stageName[s]).join('、')}`].filter(Boolean).join('<br>');
 out+=`| ${group.map(link).join('<br>')} | ${cell('phd')} | ${cell('postdoc')} | ${gap} |\n`;
}
const dest=path.join(root,'已知同人聚合的师承待核.md');fs.writeFileSync(dest,out,'utf8');console.log(JSON.stringify({records:records.length,identity_units:groups.length,known_same_groups:groups.filter(x=>x.length>1).length,incomplete_components:issues.length,pending_units:pending,explicit_label_gaps:explicitLabelGaps,typed_role_differences:hasTyped?roleDifferences.length:null,counts,target:dest,note:'单元数以已核同人记录为限；标签与最新人工事件分列。'}));
