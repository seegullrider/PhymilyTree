// 只对已保存页面观察筛查补充措辞；结果是人工线索，不建立关系。
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
db.exec('PRAGMA busy_timeout=10000');
const rows = db.prepare(`SELECT r.id,r.name,r.unit,p.url,o.tool_output,a.details_json
 FROM records r JOIN pages p ON p.record_id=r.id AND p.state='done'
 JOIN page_observations o ON o.page_id=p.id
 JOIN manual_audit_events a ON a.rowid=(SELECT x.rowid FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 WHERE NOT EXISTS (SELECT 1 FROM page_identity_mismatches m WHERE m.page_id=p.id)`).all();
const pattern = /(?:doctoral|ph\.?d\.?|thesis|dissertation|postdoctoral|postdoc|graduate)\s+(?:research\s+)?(?:advis(?:or|er)|supervisor|mentor)|(?:advisor|adviser|supervisor|mentor)\s*(?:for|during|of)\s+(?:the\s+)?(?:doctoral|ph\.?d\.?|thesis|postdoctoral|postdoc|graduate)/i;
const results = [], seen = new Set();
for (const r of rows) {
  const a = JSON.parse(r.details_json).aspects;
  if (a.phd.status === 'confirmed_advisor' && a.postdoc.status === 'confirmed_advisor') continue;
  const name = r.name.replace(/（[^）]*）|\([^)]*\)|\s*[—–].*$/g, '').trim();
  if (name.length < 6) continue;
  let raw = r.tool_output;
  // Earlier bridge receipts occasionally stored a JSON-quoted tool response.
  try { const v = JSON.parse(raw); if (typeof v === 'string') raw = v; } catch {}
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!pattern.test(lines[i])) continue;
    const context = lines.slice(Math.max(0, i - 3), i + 4).join(' ').replace(/\s+/g, ' ');
    if (!context.toLocaleLowerCase().includes(name.toLocaleLowerCase())) continue;
    const key = [r.id, r.url, context].join('\n');
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ clue_id: createHash('sha256').update('advisor-phrase-v1\n' + key).digest('hex').slice(0, 20), record_id: r.id, name: r.name, unit: r.unit, url: r.url, evidence: context.slice(0, 1100) });
  }
}
let inserted = 0;
if (process.argv.includes('--sync')) {
  const put = db.prepare('INSERT OR IGNORE INTO saved_observation_clues(clue_id,record_id,url,evidence,created_at) VALUES(?,?,?,?,?)');
  db.exec('BEGIN IMMEDIATE');
  try { for (const r of results) inserted += Number(put.run(r.clue_id, r.record_id, r.url, r.evidence, new Date().toISOString()).changes); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
db.close();
const file = path.join(__dirname, '已存导师措辞扩展待核.json');
fs.writeFileSync(file, JSON.stringify({ warning: '原文可能是名录、反向受训者或同名者；必须人工核查身份、阶段与关系方向。', matches: results }, null, 2));
console.log(JSON.stringify({ observations: rows.length, candidates: results.length, inserted, examples: results.slice(0, 4) }));
