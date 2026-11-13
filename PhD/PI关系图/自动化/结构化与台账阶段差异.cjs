// Surface classification differences for review; never rewrite an audit or edge.
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
db.exec('BEGIN');
const total=db.prepare('select count(*) n from records').get().n;
const rows=db.prepare(`SELECT r.id,r.name,r.unit,r.filename,t.stage,t.kind,t.mentor_filename,t.evidence,t.sources_json,t.source_audit_id,a.audit_id AS latest_audit,a.details_json
 FROM typed_relation_events t JOIN records r ON r.id=t.record_id
 JOIN manual_audit_events a ON a.rowid=(SELECT x.rowid FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 WHERE t.rowid=(SELECT x.rowid FROM typed_relation_events x WHERE x.record_id=t.record_id AND x.stage=t.stage AND x.mentor_filename=t.mentor_filename ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 AND t.kind IN ('advisor','stage_mentor') ORDER BY r.unit,r.name,t.stage,t.mentor_filename`).all();
db.exec('COMMIT');db.close();
const matches=rows.map(({details_json,...r})=>({...r,aspect:JSON.parse(details_json).aspects[r.stage]})).filter(r=>r.aspect.status!=='confirmed_advisor');
const compatible=matches.filter(r=>r.kind==='stage_mentor'&&r.aspect.status==='group_or_candidate');
const priority=matches.filter(r=>r.kind==='advisor'||r.aspect.status!=='group_or_candidate');
const titles={phd:'博士',postdoc:'博士后'},kind={advisor:'明确导师',stage_mentor:'阶段研究师长'},status={group_or_candidate:'阶段关系、课题组或候选',unresolved:'未查明',no_postdoc_documented:'未发现博士后经历'};
const esc=s=>String(s||'').replace(/[\r\n]+/g,' ').replace(/\|/g,'／');
let out=`# 结构化类型与最新台账阶段差异（待核）\n\n[[人工核查台账进度|人工台账]] · [[结构化师承关系（人工确认）|结构化关系]] · [[师承未明确名单（按阶段和学校）|分阶段名单]]\n\n生成时间：${new Date().toISOString()}。全库 ${total} 条校属记录。以下 ${priority.length} 条优先复核涉及 ${new Set(priority.map(x=>x.id)).size} 条记录。另有 ${compatible.length} 条阶段研究师长与台账「阶段关系、课题组或候选」相容。类型关系只覆盖部分数据库。\n\n`;
function section(title,items){
 out+='## '+title+'\n\n';
 for(const r of items){
  const src=JSON.parse(r.sources_json);
  out+=`### [[${r.filename}|${esc(r.name)}]]（${esc(r.unit)}）\n\n- ${titles[r.stage]}的结构化关系为${kind[r.kind]} [[${r.mentor_filename}]]。最新台账为「${status[r.aspect.status]||esc(r.aspect.status)}」。\n- 结构化证据 ${esc(r.evidence)} ${src.map((u,i)=>`[来源${i+1}](${u})`).join(' ')}\n- 最新台账 ${esc(r.aspect.note)}\n- 结构化事件的原核查编号 ${r.source_audit_id}，最新人工事件 ${r.latest_audit}。\n\n`;
 }
}
section('优先核对来源与角色',priority);
section('相容的阶段研究师长记录',compatible);
const target=path.join(root,'结构化类型与最新台账阶段差异（待核）.md');fs.writeFileSync(target,out,'utf8');console.log(JSON.stringify({target,total,edges:matches.length,records:new Set(matches.map(x=>x.id)).size,advisor:matches.filter(x=>x.kind==='advisor').length,stage_mentor:matches.filter(x=>x.kind==='stage_mentor').length,priority:priority.length,priority_records:new Set(priority.map(x=>x.id)).size,compatible_stage:compatible.length}));
