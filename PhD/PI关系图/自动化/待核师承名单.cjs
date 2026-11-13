// 按最新人工核查事件生成逐人待核名单；不将旧状态视为正式导师的确证。
const fs = require('fs');
const path = require('path');
const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync(process.env.PI_AUTOMATION_DB || path.join(__dirname, '检索队列.sqlite'), {readOnly:true});
db.exec('PRAGMA busy_timeout=10000');
const graph = process.env.PI_GRAPH_ROOT || path.resolve(__dirname, '..');
const records = db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.recorded_at,a.details_json FROM records r
 LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x
 WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 ORDER BY r.unit COLLATE NOCASE,r.name COLLATE NOCASE`).all()
 .map(r=>({...r,details:r.details_json?JSON.parse(r.details_json):null}));
db.close();
const clean = s=>String(s||'').replace(/[\r\n\t]+/g,' ').replaceAll('|','／').trim();
const label = s=>({unresolved:'未明',group_or_candidate:'组关系或候选',confirmed_advisor:'已登记指导关系（类型待核）',no_postdoc_documented:'未发现博士后经历，待核'})[s]||'无人工事件';
const stage = (r,k)=>r.details?.aspects?.[k]?.status;
const pending = (r,k)=>!stage(r,k)||stage(r,k)!=='confirmed_advisor';
const allPending=records.filter(r=>!r.details||r.details.followup_required===true||pending(r,'phd')||pending(r,'postdoc')||['identity','affiliation','research'].some(k=>r.details.aspects[k]?.status!=='confirmed'));
// 只展示本阶段最新人工事件保存的来源；链接不表示原文已证明正式导师。
function sourceLinks(aspect){
 const sources=Array.isArray(aspect?.sources)?aspect.sources:[];
 const valid=[...new Set(sources.filter(s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)}catch{return false}}))];
 return valid.map((url,i)=>`[${i+1}](<${url.replaceAll('|','%7C').replaceAll('>','%3E')}>)`).join('、')||'未登记';
}
function section(title,items,k){
 let out=`\n## ${title}（${items.length} 条校属记录）\n\n| 学校 | 人物 | 最新状态 | 事件中保存的线索或限制 | 事件来源 |\n|---|---|---|---|---|\n`;
 for(const r of items){const a=r.details?.aspects?.[k];out+=`| ${clean(r.unit)} | [[${clean(r.filename)}\\|${clean(r.name)}]] | ${label(a?.status)} | ${clean(a?.note)||'未登记人工事件'} | ${sourceLinks(a)} |\n`;}
 return out;
}
let out=`# 待核师承名单\n\n生成时间：${new Date().toISOString()}。按 SQLite 每条校属记录的最新人工事件生成；同一个人跨校可能多次出现，不是去重后人数。[[人工核查台账进度|台账进度]] · [[人物页与人工台账差异（待核）|人物页与最新台账差异]] · [[PI关系图总入口|图谱入口]]\n\n校属记录 ${records.length} 条；至少一项师承、身份、院系或方向仍有后续事项 ${allPending.length} 条。各名单可交叉，不能相加。\n\n“未明”表示最新人工事件未确认该阶段关系，不表示历史人物页一定没有较早记录；“组关系或候选”不等于正式导师。旧事件的 confirmed_advisor 混有阶段研究师长，不能据此精确算出正式导师缺口。每行“事件来源”仅列最新人工事件该阶段保存的网址，供复查；有链接不代表原文已证明正式导师，人物页可能另有历史来源。若人物页有旧导师记录而最新台账未确认，参阅差异清单并查原文，不得仅以最新状态否定历史证据。未发现博士后经历也不等于必然存在博士后导师。\n`;
out+=section('博士阶段未明或无人工事件',records.filter(r=>!stage(r,'phd')||stage(r,'phd')==='unresolved'),'phd');
out+=section('博士阶段只有组关系或候选',records.filter(r=>stage(r,'phd')==='group_or_candidate'),'phd');
out+=section('博士后阶段未明或无人工事件',records.filter(r=>!stage(r,'postdoc')||stage(r,'postdoc')==='unresolved'),'postdoc');
out+=section('博士后阶段只有组关系或候选',records.filter(r=>stage(r,'postdoc')==='group_or_candidate'),'postdoc');
out+=section('未发现博士后经历，待复核',records.filter(r=>stage(r,'postdoc')==='no_postdoc_documented'),'postdoc');
out+=`\n## 其他仍需追查的记录\n\n以下记录两阶段均有已登记指导关系，但身份、院系、方向或特别标记仍有后续事项；已登记指导关系可能包含阶段研究师长。\n\n`;
const others=allPending.filter(r=>!pending(r,'phd')&&!pending(r,'postdoc'));
for(const r of others)out+=`- ${clean(r.unit)}：[[${clean(r.filename)}\u007c${clean(r.name)}]]；${clean(r.details.next_step)}\n`;
fs.writeFileSync(path.join(graph,'待核师承名单.md'),out,'utf8');
console.log(JSON.stringify({records:records.length,followup:allPending.length,phd_unresolved:records.filter(r=>!stage(r,'phd')||stage(r,'phd')==='unresolved').length,phd_candidate:records.filter(r=>stage(r,'phd')==='group_or_candidate').length,postdoc_unresolved:records.filter(r=>!stage(r,'postdoc')||stage(r,'postdoc')==='unresolved').length,postdoc_candidate:records.filter(r=>stage(r,'postdoc')==='group_or_candidate').length,no_postdoc:records.filter(r=>stage(r,'postdoc')==='no_postdoc_documented').length,both_unresolved:records.filter(r=>stage(r,'phd')==='unresolved'&&stage(r,'postdoc')==='unresolved').length,other:others.length}));
