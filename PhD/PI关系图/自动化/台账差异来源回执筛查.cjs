// 只读差异清单与保存的页面回执；输出线索，不据此改变关系或删除历史证据。
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const input = fs.readFileSync(path.join(root, '人物页与人工台账差异（待核）.md'), 'utf8');
const query = db.prepare(`SELECT p.url,p.state,p.error,COUNT(o.sha256) AS observations
 FROM pages p LEFT JOIN page_observations o ON o.page_id=p.id
 WHERE p.record_id=? AND p.url=? GROUP BY p.id`);
const crossQuery = db.prepare(`SELECT p.record_id,COUNT(o.sha256) AS observations
 FROM pages p JOIN page_observations o ON o.page_id=p.id
 WHERE p.record_id<>? AND p.url=? GROUP BY p.record_id`);
const rows = [];
for (const block of input.split(/^## /m).slice(1)) {
  const head = block.split(/\r?\n/, 1)[0];
  const id = head.match(/ - ([0-9a-f]{8})(?:\||\]\])/i)?.[1];
  if (!id) continue;
  const after = block.split('  - 人物页原文：')[1] || '';
  const urls = [...new Set([...after.matchAll(/\]\((https?:[^)]+)\)/g)].map(x => x[1].split('#')[0]))];
  for (const url of urls) {
    const found = query.get(id, url);
    const cross = crossQuery.all(id, url);
    rows.push({ id, head, url, state: found?.state || '无同记录页面回执', observations: Number(found?.observations || 0), error: found?.error || '', cross });
  }
}
db.close();
const grouped = { saved: rows.filter(x => x.observations), failed: rows.filter(x => !x.observations && x.error), other: rows.filter(x => !x.observations && !x.error) };
const esc = s => s.replace(/[\r\n]+/g, ' ').replace(/\|/g, '／').slice(0, 220);
let out = '# 人物页与台账差异：来源回执筛查（待核）\n\n';
out += '仅对差异清单中人物页所引网址匹配 SQLite 页面回执。其他校属记录保存同一网址时仅列 ID，须先核对身份及原文；无回执不等于未曾读取或关系错误，有观察也不等于身份、阶段及导师角色已核。不同 URL 和外部保存证据不在本筛查范围。\n\n人工复核记录见 [[人物页台账差异来源回执人工复核]]。\n\n';
for (const [title, list] of [['有保存页面观察', grouped.saved], ['当前回执为失败且无保存观察', grouped.failed], ['无可用的同记录页面观察', grouped.other]]) {
  out += `## ${title}（${list.length} 条来源）\n\n`;
  for (const x of list) out += `- ${x.head} · [来源](${x.url}) · ${esc(x.state)}${x.observations ? ` · 保存观察 ${x.observations}` : ''}${x.cross.length ? ` · 同网址其他记录：${x.cross.map(y=>y.record_id).join('、')}` : ''}${x.error ? ` · ${esc(x.error)}` : ''}\n`;
  out += '\n';
}
fs.writeFileSync(path.join(root, '人物页台账差异来源回执（待核）.md'), out, 'utf8');
console.log(JSON.stringify({records:new Set(rows.map(x=>x.id)).size,sources:rows.length,saved:grouped.saved.length,failed:grouped.failed.length,other:grouped.other.length,cross_record:rows.filter(x=>x.cross.length).length}));
