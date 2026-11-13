// 候选与确证可属于不同导师；输出仅供人工判断，不自动修改关系。
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const events = db.prepare('SELECT record_id, details_json FROM manual_audit_events ORDER BY recorded_at DESC, rowid DESC').all();
db.close();
const latest = new Map();
for (const event of events) if (!latest.has(event.record_id)) latest.set(event.record_id, JSON.parse(event.details_json));
const results = [];
const lines = fs.readFileSync(path.join(root, '师承关系索引.md'), 'utf8').split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/\[\[人员 - [^\]]+ - ([0-9a-f]{8})\|[^\]]+\]\]/i);
  if (!match || !line.includes('候选')) continue;
  const audit = latest.get(match[1]);
  if (!audit) continue;
  const edge = line.split('→')[1] || '';
  const stage = /^\s*博士后/.test(edge) ? 'postdoc' : /^\s*博士/.test(edge) ? 'phd' : null;
  if (stage && audit.aspects?.[stage]?.status === 'confirmed_advisor')
    results.push({ line: i + 1, id: match[1], stage, edge: line, audit: audit.aspects[stage].note });
}
console.log(JSON.stringify({ indexedLines: lines.length, potentialMismatches: results.length, results }, null, 2));
