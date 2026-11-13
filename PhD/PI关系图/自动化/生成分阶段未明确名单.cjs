// 根据每条校属记录的最新人工事件生成分阶段清单；不改变台账或导师关系。
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { phdLabel, postLabel } = require('./人物页导师标签.cjs');
const root = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), {readOnly: true});
db.exec('BEGIN');
const rows = db.prepare(`SELECT r.id,r.name,r.unit,r.filename,r.relation_json,a.details_json FROM records r
 LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x
 WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 ORDER BY r.unit COLLATE NOCASE,r.name COLLATE NOCASE`).all();
db.exec('COMMIT'); db.close();
const data = rows.map(row => {
 if (!row.details_json) throw Error('缺少人工事件：' + row.id);
 const relations = JSON.parse(row.relation_json);
 return {
  ...row,
  event: JSON.parse(row.details_json),
  explicit: { phd: relations.some(v => phdLabel(v.type)), postdoc: relations.some(v => postLabel(v.type)) },
 };
});
const sections = [
 ['博士导师未明确：只有阶段关系或候选', 'phd', 'group_or_candidate'],
 ['博士导师未查明', 'phd', 'unresolved'],
 ['博士后导师未明确：只有阶段关系或候选', 'postdoc', 'group_or_candidate'],
 ['博士后导师未查明', 'postdoc', 'unresolved'],
 ['未发现博士后经历（需复核）', 'postdoc', 'no_postdoc_documented'],
];
const esc = s => String(s || '').replace(/\|/g,'／').replace(/[\r\n]+/g,' ').trim();
let out = '# 师承未明确名单（按阶段和学校）\n\n[[师承待查名单（按最新人工事件）|全部后续待查事项]] · [[人工核查台账进度|逐校进度]] · [[PI关系图总入口|图谱入口]]\n\n';
out += `生成时间：${new Date().toISOString()}。依据 SQLite 同步的人物页导师标签和每条校属记录的最新人工事件，包含 ${data.length} 条校属记录，同一人跨校可能重复。旧台账的 confirmed_advisor 曾同时记录明确导师和阶段研究师长。末尾列出两套记录不一致的条目，供逐人核对原文、角色及是否沿用同人主记录。\n\n`;
const missingLabels = data.filter(r => !r.explicit.phd || !r.explicit.postdoc)
 .map(r => ({ ...r, phd: !r.explicit.phd, postdoc: !r.explicit.postdoc }));
const missingPhd = missingLabels.filter(r => r.phd).length;
const missingPostdoc = missingLabels.filter(r => r.postdoc).length;

out += `## 人物页缺明确导师标签的校属记录（${missingLabels.length} 条）\n\n`;
out += `与检索进度表按人物页标签计算的口径一致。博士导师缺 ${missingPhd} 条，博士后导师缺 ${missingPostdoc} 条，两阶段可能重叠。“缺博士后”也包括未发现该段经历的情况。以下按学校列出缺哪一阶段，后续章节仍按最新人工事件分类。\n\n`;
let labelUnit = null;
for (const r of missingLabels) {
 if (labelUnit !== r.unit) {
  labelUnit = r.unit;
  out += `\n### ${esc(labelUnit)}\n\n`;
 }
 const stages = [r.phd && '博士', r.postdoc && '博士后'].filter(Boolean).join('、');
 const noPostdoc = r.postdoc && r.event.aspects?.postdoc?.status === 'no_postdoc_documented';
 const detail = noPostdoc ? '（目前未见博士后经历，待复核）' : '';
 out += `- [[${r.filename}|${esc(r.name)}]] · ${stages}${detail}\n`;
}
out += '\n';

function addSection(title, stage, matches) {
 out += `## ${title}（${matches.length} 条）\n\n`;
 let unit = null;
 for(const r of matches){
  if(unit!==r.unit){unit=r.unit;out+=`\n### ${esc(unit)}\n\n`;}
  const note=esc(r.event.aspects[stage].note);
  out+=`- [[${r.filename}|${esc(r.name)}]]${note?'：'+note:''}\n`;
 }
 out+='\n';
}

const counts = {};
for (const [title, stage, status] of sections) {
 const matches = data.filter(r => r.event.aspects[stage].status === status);
 counts[title] = matches.length;
 addSection(title, stage, matches);
}

const labelAuditDifferences = {};
for (const [stage, title] of [['phd', '博士'], ['postdoc', '博士后']]) {
 const auditOnly = data.filter(r => !r.explicit[stage] && r.event.aspects[stage].status === 'confirmed_advisor');
 const labelOnly = data.filter(r => r.explicit[stage] && r.event.aspects[stage].status !== 'confirmed_advisor');
 labelAuditDifferences[stage] = { audit_only: auditOnly.length, label_only: labelOnly.length };
 addSection(title + '阶段：台账已记指导，人物页缺明确导师标签', stage, auditOnly);
 addSection(title + '阶段：人物页有明确导师标签，最新台账状态待对照', stage, labelOnly);
}
const target=path.join(root,'师承未明确名单（按阶段和学校）.md');
fs.writeFileSync(target,out,'utf8');
console.log(JSON.stringify({target,total:data.length,missing_explicit_labels:{phd:missingPhd,postdoc:missingPostdoc,either:missingLabels.length},counts,label_audit_differences:labelAuditDifferences}));
