// Offline cross-check of a saved, directly opened Berkeley EECS year index.
// Matches are leads only: namesakes and identity must be checked manually.
const fs = require('fs');
const path = require('path');
const {DatabaseSync} = require('node:sqlite');
const [input, source] = process.argv.slice(2);
if (!input || !/^https:\/\/www2\.eecs\.berkeley\.edu\/Pubs\/Dissertations\/Years\/\d{4}\.html$/.test(source || '')) {
  console.error('用法: node 院系学位目录比对.cjs 已保存的网页文本 官方年份目录URL');
  process.exit(2);
}
const db = new DatabaseSync(process.env.PI_AUTOMATION_DB || path.join(__dirname, '检索队列.sqlite'), {readOnly:true});
const rows = db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.details_json
 FROM records r LEFT JOIN manual_audit_events a ON a.audit_id=(
 SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id
 ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();
const normalize = s => s.normalize('NFKD').replace(/[（(].*?[）)]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const byName = new Map();
for (const row of rows) {
  const key = normalize(row.name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(row);
}
const content = fs.readFileSync(input, 'utf8');
const matches = [], expression = /(?:^|\n)(?:L\d+:\s*)?([^\n\[\]]+?)\s+\[advisor:\s*([^\]\n]+)\]/g;
let item, seen = new Set();
while ((item = expression.exec(content))) {
  const author = item[1].trim(), advisors = item[2].trim();
  for (const row of byName.get(normalize(author)) || []) {
    const key = row.id + '|' + advisors;
    if (seen.has(key)) continue;
    seen.add(key);
    let phdStatus = 'no_manual_event';
    if (row.details_json) phdStatus = JSON.parse(row.details_json).aspects.phd.status;
    matches.push({record_id:row.id,name:row.name,unit:row.unit,filename:row.filename,
      directory_author:author,directory_advisors:advisors,current_phd_status:phdStatus,source});
  }
}
db.close();
console.log(JSON.stringify({source,matches,note:'仅姓名相同，不证明身份；须逐条核对学位、年份、方向，再直接阅读来源；不会修改台账或图谱。'},null,2));
