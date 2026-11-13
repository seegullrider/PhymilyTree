// Compare the foundation's saved award announcements with local PI names.
// Fellowship announcements identify the host and year. Individual profiles supply mentors.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const input = process.argv[2];
if (!input) throw Error('用法：node Beckman博士后名录比对.cjs 已读名录.json');
const pages = JSON.parse(fs.readFileSync(input, 'utf8'));
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const records = db.prepare(`
 SELECT r.id, r.name, r.unit, a.details_json
 FROM records r
 LEFT JOIN manual_audit_events a ON a.rowid = (
   SELECT x.rowid FROM manual_audit_events x WHERE x.record_id = r.id
   ORDER BY x.recorded_at DESC, x.rowid DESC LIMIT 1)
`).all();
db.close();

function normalizedName(name) {
  return name.split(/[（(—：]/, 1)[0].normalize('NFKD').replace(/\p{M}|[’']/gu, '')
    .toLowerCase().match(/[a-z]+/g)?.filter(word => word.length > 1 && !['jr', 'sr', 'iii'].includes(word)).join(' ') ?? '';
}

const recordsByName = new Map();
for (const record of records) {
  const key = normalizedName(record.name);
  const previous = recordsByName.get(key) ?? [];
  recordsByName.set(key, [...previous, record]);
}

const awards = [];
for (const { url, raw } of pages) {
  if (!/^https:\/\/www\.beckman-foundation\.org\/latest-news\//.test(url) || typeof raw !== 'string') {
    throw Error('须提供基金会已读公告网址和原文');
  }
  const year = raw.match(/^L\d+: # Beckman Foundation Announces (20\d{2}) Arnold O\. Beckman Postdoctoral Fellows/m)?.[1];
  const rows = [...raw.matchAll(/^L(\d+):\s+[-*]\s+([^,\r\n]+),\s+Ph\.D\.,\s+([^\r\n]+)\r?$/gm)];
  if (!year || !rows.length) throw Error('公告标题或获奖名录格式需核对 ' + url);
  for (const [, line, name, institution] of rows) {
    const matches = (recordsByName.get(normalizedName(name)) ?? []).map(record => ({
      id: record.id,
      name: record.name,
      school: record.unit,
      postdoc: record.details_json && JSON.parse(record.details_json).aspects.postdoc.status
    }));
    awards.push({ name, year: Number(year), institution, url, line: Number(line), matches });
  }
}
console.log(JSON.stringify({
  awards,
  counts: { awards: awards.length, matched: awards.filter(award => award.matches.length > 0).length },
  note: '同名匹配待核身份。公告中的机构为获奖时的博士后机构；导师须查个人奖项原页。'
}, null, 2));
