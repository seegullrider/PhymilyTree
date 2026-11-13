// 根据 SQLite 最新人工事件生成可复查名单，不修改队列或人物页。
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), {readOnly: true});
db.exec('BEGIN');
const rows = db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.recorded_at,a.details_json
  FROM records r LEFT JOIN manual_audit_events a ON a.audit_id=(
    SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id
    ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
  ORDER BY r.unit COLLATE NOCASE,r.name COLLATE NOCASE`).all();
const statuses = {confirmed_advisor:'已确认导师或阶段研究师长', group_or_candidate:'课题组或候选', unresolved:'未查明', no_postdoc_documented:'未发现博士后经历，待复核'};
const pending = [];
const tally = {total: rows.length, missing_events: 0, both: 0, neither: 0, phd_only: 0, postdoc_only: 0, both_followup: 0};
for (const row of rows) {
  if (!row.details_json) { tally.missing_events++; continue; }
  const e=JSON.parse(row.details_json), a=e.aspects;
  if (!a || !a.phd || !a.postdoc || !statuses[a.phd.status] || !statuses[a.postdoc.status]) throw Error('人工事件缺少有效阶段状态：'+row.id);
  const p=a.phd.status==='confirmed_advisor', q=a.postdoc.status==='confirmed_advisor';
  const more=e.followup_required===true || !p || !q || ['identity','affiliation','research'].some(k=>!a[k] || a[k].status!=='confirmed');
  if(p&&q) { tally.both++; if(more)tally.both_followup++; }
  else if(p) tally.phd_only++; else if(q) tally.postdoc_only++; else tally.neither++;
  if(more) pending.push({...row,e});
}
db.exec('COMMIT'); db.close();
if(tally.missing_events) throw Error('有未登记人工事件的记录，不能生成完整名单：'+tally.missing_events);
const esc=s=>String(s||'').replace(/\|/g,'／').replace(/[\r\n]+/g,' ').trim();
const title='师承待查名单（按最新人工事件）';
let out=`# ${title}\n\n[[人工核查台账进度|返回人工核查台账]] · [[PI关系图总入口|返回图谱]]\n\n生成时间：${new Date().toISOString()}。依据 SQLite 每条校属记录最新一次人工核查事件生成；人物页可能还有更早的可靠资料，最新事件未明不等于否定旧记录。校属记录不是去重人数；候选与课题组关系不是正式导师。自动搜索或登记人工事件不等于完成调查。\n\n`;
out+=`共 ${tally.total} 条校属记录；${pending.length} 条至少有导师、身份、院系、方向或显式后续事项待核。两阶段均未标确认导师或阶段研究师长 ${tally.neither} 条；仅博士阶段已标确认 ${tally.phd_only} 条；仅博士后阶段已标确认 ${tally.postdoc_only} 条；两阶段均已标确认但仍有其他复核事项 ${tally.both_followup} 条。\n\n`;
out+='“已确认导师或阶段研究师长”混合正式导师和已证实的阶段研究师长，不能全部视作正式导师；“课题组或候选”也不等于正式导师。旧事件可能没有显式后续标志，因此本名单及数量不能完整识别所有正式称谓尚待核实的记录；[[师承未明确名单（按阶段和学校）|分阶段名单]]另列混合状态的全部人物供逐项核对。具体关系类型和证据请打开人物页查看。“未查明”表示最新事件未可靠确认；未发现博士后经历不代表必然存在博士后或导师。\n\n';
const groups=new Map(); for(const r of pending){if(!groups.has(r.unit))groups.set(r.unit,[]);groups.get(r.unit).push(r)}
out+='## 按学校查看\n\n'; for(const [unit,records] of groups)out+=`- [[#${esc(unit)}|${esc(unit)}]]：${records.length} 条\n`;
for(const [unit,records] of groups){out+=`\n## ${esc(unit)}\n\n| 人物 | 博士阶段 | 博士后阶段 | 下一步或尚存限制 |\n|---|---|---|---|\n`;for(const r of records){const a=r.e.aspects;out+=`| [[${r.filename}]] | ${statuses[a.phd.status]} | ${statuses[a.postdoc.status]} | ${esc(r.e.next_step)} |\n`}}
const target=path.join(root,title+'.md');fs.writeFileSync(target,out,'utf8');
process.stdout.write(JSON.stringify({target,pending:pending.length,schools:groups.size,...tally})+'\n');
