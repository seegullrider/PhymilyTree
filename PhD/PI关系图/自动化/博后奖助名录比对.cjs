const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const input = process.argv[2];
if (!input) throw new Error('用法: node 博后奖助名录比对.cjs 名录JSON');
const roster = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!Array.isArray(roster.entries) || roster.entries.some(row => typeof row.name !== 'string' || typeof row.source !== 'string')) {
  throw new Error('名录必须包含有 name 和 source 的 entries 数组');
}

function nameKey(name) {
  const names = name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[（(].*?[）)]|\s*[—–：].*$/gu, ' ')
    .replace(/[^\p{L}\s-]/gu, ' ').trim().split(/\s+/)
    .filter(part => part.length > 1 && !/^(jr|sr|ii|iii|iv)$/.test(part));
  return names.length >= 2 ? names[0] + '|' + names.at(-1) : null;
}

const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const records = db.prepare('SELECT id,name,unit,filename FROM records').all();
db.close();

const byName = new Map();
for (const record of records) {
  const key = nameKey(record.name);
  if (!key) continue;
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(record);
}

const matches = [];
for (const entry of roster.entries) {
  const candidates = new Map();
  for (const name of [entry.name, ...(entry.aliases || [])]) {
    for (const record of byName.get(nameKey(name)) || []) candidates.set(record.id, record);
  }
  if (candidates.size) matches.push({ ...entry, candidates: [...candidates.values()] });
}

console.log(JSON.stringify({
  program: roster.program,
  entries: roster.entries.length,
  school_records: records.length,
  matched_entries: matches.length,
  matches,
  note: '首尾姓名及显式别名仅生成候选。逐人核实机构、年份和具体导师称谓后再入图。'
}, null, 2));
