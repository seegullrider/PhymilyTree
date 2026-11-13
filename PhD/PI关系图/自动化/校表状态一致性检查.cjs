// 只报告可能的不一致；多导师、旧记录和证据冲突须人工核实，绝不自动改表。
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const rows = db.prepare('SELECT record_id, details_json FROM manual_audit_events ORDER BY recorded_at DESC, rowid DESC').all();
db.close();
const latest = new Map();
for (const row of rows) if (!latest.has(row.record_id)) latest.set(row.record_id, JSON.parse(row.details_json));
const results = [];
for (const filename of fs.readdirSync(root).filter(f => f.endsWith('逐人复核记录.md'))) {
  for (const line of fs.readFileSync(path.join(root, filename), 'utf8').split(/\r?\n/)) {
    const match = line.match(/\[\[人员 - [^\]]+ - ([0-9a-f]{8})\|[^\]]+\]\]/i);
    if (!match || !line.startsWith('|')) continue;
    const audit = latest.get(match[1]);
    if (!audit) continue;
    const cols = line.replace(/\[\[([^\]]+)\]\]/g, (_, s) => s.replace(/\|/g, '¦')).split('|').map(s => s.trim());
    for (const [stage, col] of [['phd', 3], ['postdoc', 4]]) {
      if (audit.aspects?.[stage]?.status === 'confirmed_advisor' && /待核|候选|未明|未查/.test(cols[col] || ''))
        results.push({ file: filename, id: match[1], stage, cell: cols[col], audit: audit.aspects[stage].note });
    }
  }
}
console.log(JSON.stringify({ checkedSchoolTables: fs.readdirSync(root).filter(f => f.endsWith('逐人复核记录.md')).length, potentialMismatches: results.length, results }, null, 2));
