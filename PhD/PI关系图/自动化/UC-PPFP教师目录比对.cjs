// 对官方奖学金教师目录与本地校属记录做姓名比对，只生成待核线索，不自动写师承。
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const dir = __dirname;
const lines = new Map();
for (const file of ['UC-PPFP教师名单-20261107.txt', 'UC-PPFP教师名单后半-20261107.txt']) {
  const data = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const line of data.split(/\r?\n/)) {
    const m = line.match(/^L(\d+): (.*)$/);
    if (m) lines.set(Number(m[1]), m[2]);
  }
}
const missing = [];
for (let i = 0; i <= 1231; i++) if (!lines.has(i)) missing.push(i);
const normalize = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/（.*?）|\(.*?\)|—.*/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const db = new DatabaseSync(path.join(dir, '检索队列.sqlite'), {readOnly:true});
const records = db.prepare('SELECT id,name,unit,filename FROM records').all();
db.close();
const results = [];
let campus = '';
for (const [number, content] of [...lines.entries()].sort((a,b) => a[0]-b[0])) {
  const heading = content.match(/^## (UC .+)$/);
  if (heading) { campus = heading[1]; continue; }
  const match = content.match(/^【\d+†([^†】]+)†([^】]+)】/);
  if (!match) continue;
  const terms = normalize(match[1]).split(' ');
  if (terms.length < 2) continue;
  const department = lines.get(number+1) || '';
  for (const record of records) {
    const parts = normalize(record.name).split(' ');
    if (parts.length < 2 || parts[0] !== terms[0] || parts.at(-1) !== terms.at(-1)) continue;
    results.push({record_id:record.id,name:record.name,unit:record.unit,listed_name:match[1],
      listed_campus:campus,department,source_line:number});
  }
}
const target = path.join(dir, 'UC-PPFP教师目录匹配候选-20261107.json');
fs.writeFileSync(target, JSON.stringify({source:'https://ppfp.ucop.edu/info/recruitment-and-hiring/meet-our-faculty.html',
  warning:'仅姓名匹配且列表可能过时；需逐人核验身份、单位、年份和导师原始资料，不能自动建立关系。',
  missing_line_numbers:missing, candidates:results}, null, 2)+'\n');
console.log(JSON.stringify({target,missing_lines:missing.length,candidates:results.length,results}));
