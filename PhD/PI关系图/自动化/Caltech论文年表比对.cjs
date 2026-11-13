// 对直接读取并保存的 CaltechTHESIS 年度目录做离线姓名筛选；匹配仅是线索，不写入师承。
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const [input, source] = process.argv.slice(2);
if (!input || !/^https:\/\/thesis\.caltech\.edu\/view\/year\/\d{4}\.html$/.test(source || '')) {
  console.error('用法: node Caltech论文年表比对.cjs 已保存的目录文本 官方年度目录URL');
  process.exit(2);
}
const year = Number(source.match(/(\d{4})\.html$/)[1]);
const db = new DatabaseSync(process.env.PI_AUTOMATION_DB || path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const rows = db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.details_json FROM records r
 LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x
 WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();
db.close();
const norm = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/（[^）]*）|\([^)]*\)/g, ' ').replace(/\s*[—–]\s*.*$/, '')
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const tokens = s => norm(s).split(' ').filter(Boolean);
const data = fs.readFileSync(input, 'utf8');
const total = Number(data.match(/Total lines:\s*(\d+)/)?.[1]);
const numbered = [...data.matchAll(/^L(\d+):/gm)].map(m => Number(m[1]));
const missing = Number.isInteger(total) && total > 0
  ? Array.from({length:total}, (_, i) => i).filter(i => !numbered.includes(i)) : [];
if (!total || missing.length) {
  console.error(`目录文本缺失行，拒绝给出完整结果：总行数 ${total || '未知'}，缺失 ${missing.slice(0,20).join(',') || '无法确定'}。请读取缺失范围并合并。`);
  process.exit(1);
}
const matches = [];
for (const line of data.split(/\r?\n/)) {
  // 只考虑博士论文，排除本科和硕士论文；目录不包含导师，需打开具体学位记录。
  const m = line.match(/^L\d+:\s+\*\s+([^—]+?)\s+—\s+【(\d+)†([^】]+)】\s+\(Dissertation \(Ph\.D\.\)\)/);
  if (!m) continue;
  const [surname, given] = m[1].split(',').map(x => x.trim());
  if (!surname || !given) continue;
  const last = tokens(surname), first = tokens(given)[0];
  if (!first || !last.length) continue;
  for (const r of rows) {
    const names = tokens(r.name);
    // 首名和姓氏必须分别占据不同位置；避免 “Wei, Wei” 命中所有含 Wei 的人。
    if (names.length < last.length + 1 || names[0] !== first ||
        !last.every((t, i) => names[names.length - last.length + i] === t)) continue;
    let event = null;
    if (r.details_json) event = JSON.parse(r.details_json);
    matches.push({ record_id:r.id, name:r.name, unit:r.unit, filename:r.filename,
      directory_author:m[1], year, title:m[3], directory_link_id:Number(m[2]),
      phd_status:event?.aspects?.phd?.status || 'no_manual_event',
      phd_note:event?.aspects?.phd?.note || '', source });
  }
}
console.log(JSON.stringify({source,year,matches,note:'名字相符仅为候选，姓名相同不能证明身份；必须交叉核对学位、年份、方向并打开每篇学位记录；本工具不写入台账。'},null,2));
