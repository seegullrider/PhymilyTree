const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const latest = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const pages = db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?');
const records = db.prepare('SELECT filename, name FROM records WHERE id=?');
const cases = [
 {
  id: '0dd9a2ca',
  url: 'https://hemkerlab.jhu.edu/people/past-group-members/',
  external: '北京交通大学机电学院轨道车辆系王曦',
  profile: 'https://artsci.washu.edu/faculty-staff/xi-wang',
  other: 'https://faculty.bjtu.edu.cn/8651/',
  evidence: 'Hemker 组档列 Xi Wang 去向为中科院力学所。北交大原档列王曦 2007 年 Harvard 工程科学博士、2008–2009 年 Johns Hopkins 机械工程博后及 2009–2013 年中科院力学所任用，并列同阶段与 Hemker 团队的材料力学论文。WashU 原档对应 Florida State 物理博士及 UW Seattle 量子材料博后。身份分别保存。',
 },
 {
  id: '237d7f22',
  url: 'https://pi.math.cornell.edu/m/People/Grads/belanger.html',
  external: 'Cornell 2015 年数学博士 David Belanger',
  profile: 'https://news.ucsc.edu/2008/10/physicists-sriram-shastry-and-peter-young-honored-by-american-physical-society/',
  other: 'https://pi.math.cornell.edu/m/People/Grads/belanger.html',
  evidence: 'Cornell 原档明确为 2015 数学逻辑博士，导师 Richard A. Shore，研究递归函数，首任 NUS。UCSC 2008 年原刊已经列本记录的 David Belanger 为物理教授兼系主任。原人物页保留此区分，队列排除同名误配。',
 },
];
const exclusions = [];
try {
 for (const item of cases) {
  const audit = JSON.parse(latest.get(item.id).details_json);
  audit.audit_id = 'pi_identity_20261110_1902_' + item.id;
  audit.aspects.identity = {
   status: 'confirmed',
   note: audit.aspects.identity.note + ' ' + item.evidence,
   sources: [...new Set([...audit.aspects.identity.sources,item.profile,item.other,item.url])],
  };
  const file = '20261110_同名复核_' + item.id + '.json';
  fs.writeFileSync(file, JSON.stringify(audit, null, 2), 'utf8');
  execFileSync(process.execPath, ['--no-warnings','人工核查台账.cjs','record',file], { stdio:'inherit' });
  const record = records.get(item.id);
  const path = '../人物/' + record.filename + '.md';
  const prior = fs.readFileSync(path, 'utf8');
  const newline = prior.includes('\r\n') ? '\r\n' : '\n';
  const marker = '## 师承' + newline;
  const newLine = '- 同名网页复核：' + item.evidence + ' [本人机构](' + item.profile + ') · [同名者原档](' + item.other + ') · [比对网页](' + item.url + ')';
  if (item.id === '0dd9a2ca' && !prior.includes(newLine)) {
   if (prior.split(marker).length !== 2) throw Error('人物页师承标题不唯一 ' + record.name);
   fs.writeFileSync(path, prior.replace(marker, marker + newline + newLine + newline), 'utf8');
  }
  exclusions.push({ page_id: pages.get(item.id,item.url).id, record_id:item.id, url:item.url, audit_id:audit.audit_id,
   external_subject:item.external, evidence:item.evidence });
 }
 const file = '20261110_同名网页排除_1902.json';
 fs.writeFileSync(file,JSON.stringify(exclusions,null,2),'utf8');
 execFileSync(process.execPath,['--no-warnings','人物网页身份纠偏.cjs',file],{stdio:'inherit'});
} finally { db.close(); }
