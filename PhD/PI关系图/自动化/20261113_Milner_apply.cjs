const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const batch = '20261113_Milner';
const records = JSON.parse(fs.readFileSync(batch + '.json', 'utf8'));
const writes = new Map();
const read = name => writes.get(name) ?? fs.readFileSync(path.join(root, name), 'utf8');
const wiki = (file, label) => '[[' + file + '|' + label + ']]';
const ref = urls => [...new Set(urls)].map((url, i) => '[原档 ' + (i + 1) + '](' + url + ')').join(' · ');
const personNote = file => '人物/' + file + '.md';
const schoolNote = unit => '院校与机构/院校 - ' + unit + '.md';
const deptFile = (unit, name) => '已核实单位 - ' + unit + ' - ' + name;
const topicFile = name => '已核实方向 - ' + name;
const mentorFile = '师承人物 - Juan G. Santiago';
const indexFile = '师承关系索引.md';
const anchor = '## 师承';

function insert(file, line, heading) {
  const content = read(file);
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  if (lines.includes(line)) return;
  if (heading) {
    const at = lines.indexOf(heading);
    if (at < 0 || lines.lastIndexOf(heading) !== at) throw Error('章节不唯一 ' + file);
    lines.splice(at + 1, 0, line);
    writes.set(file, lines.join(eol));
  } else {
    writes.set(file, content.trimEnd() + eol + line + eol);
  }
}

const manifest = JSON.parse(read('graph-manifest.json'));
const edges = [];
const audits = [];
for (const r of records) {
  const id = createHash('sha256').update(r.unit + '|' + r.name).digest('hex').slice(0, 8);
  if (r.id !== id) throw Error('人员 ID 不一致 ' + r.name);
  const filename = '人员 - ' + r.unit + ' - ' + r.name + ' - ' + r.id;
  const prior = manifest.nodes.filter(n => n.id === r.id || n.filename === filename || n.name === r.name || r.aliases.split('、').includes(n.name));
  if (prior.length > 1 || (prior.length && (prior[0].id !== r.id || prior[0].filename !== filename))) {
    throw Error('已有相近人物 ' + r.name);
  }
  if (!prior.length) {
    if (fs.existsSync(path.join(root, personNote(filename)))) throw Error('已有未登记的人物页 ' + filename);
    manifest.nodes.push({ id: r.id, filename, name: r.name, unit: r.unit, kind: '美国' });
    const depts = r.departments.map(name => wiki(deptFile(r.unit, name), name));
    const topics = r.topics.map(name => wiki(topicFile(name), name));
    writes.set(personNote(filename), [
      '# ' + r.name, '', '## 所在的学校或机构记录', '',
      '- ' + wiki('院校 - ' + r.unit, r.unit),
      '- 资料中亦见 ' + r.aliases + '。', '',
      '## 院系与研究方向核验（2026-11-13）', '',
      '- 院系／机构：' + depts.join(' · ') + '。' + r.affiliation + ' ' + ref(r.current),
      '- 研究方向：' + topics.join(' · ') + '。' + r.research + ' ' + ref(r.current),
      '- 身份：' + r.identity,
      '', anchor, '', '- 核查边界：' + r.next, ''
    ].join('\n'));
  }
}

for (const r of records) {
  const filename = '人员 - ' + r.unit + ' - ' + r.name + ' - ' + r.id;
  const person = wiki(filename, r.name);
  insert(schoolNote(r.unit), '- ' + person);
  for (const dept of r.departments) {
    insert('已核实院系/' + deptFile(r.unit, dept) + '.md', '- ' + person + ' — ' + ref(r.current));
  }
  for (const topic of r.topics) {
    insert('已核实方向/' + topicFile(topic) + '.md', '- ' + wiki(filename, r.name + ' · ' + r.unit) + ' — ' + ref(r.current));
  }
  const auditId = '20261113_0520_cross_dept_' + r.id;
  const aspects = Object.fromEntries(['identity', 'affiliation', 'research'].map(k => [
    k, { status: 'confirmed', note: r[k], sources: r.current }
  ]));
  for (const [stage, label, reverse] of [['postdoc','博士后导师','博士后研究者'],['phd','博士导师','博士生']]) {
    const relation = r[stage];
    aspects[stage] = {
      status: relation.mentor ? 'confirmed_advisor' : 'no_postdoc_documented',
      note: relation.evidence,
      sources: relation.urls
    };
    const proof = relation.evidence + ' ' + ref(relation.urls);
    if (relation.mentor) {
      const forward = label + '：' + wiki(relation.target, relation.mentor) + '。' + proof;
      edges.push({ event_id: auditId + '_' + stage, record_id: r.id, stage,
        mentor_filename: relation.target, kind: 'advisor', source_audit_id: auditId,
        evidence: relation.evidence, sources: relation.urls });
      if (relation.target === mentorFile && !writes.has(personNote(mentorFile)) && !fs.existsSync(path.join(root, personNote(mentorFile)))) {
        writes.set(personNote(mentorFile), '# Juan G. Santiago\n\n> [!info] 师承扩展人物\n> Stanford 机械工程系教授，研究微流控、微尺度输运及电动流体。 [Stanford 本人档](https://profiles.stanford.edu/juan-santiago?tab=bio)\n\n## 师承\n');
      }
      insert(personNote(filename), '- ' + forward, anchor);
      insert(personNote(relation.target), '- ' + reverse + '：' + person + '。' + proof, anchor);
      insert(indexFile, '- ' + person + ' → ' + forward, '# 师承关系与候选线索索引');
    } else {
      insert(personNote(filename), '- 博士后经历：' + proof, anchor);
    }
  }
  const postdoc = r.postdoc.mentor ? r.postdoc.mentor + '（明确博士后导师）' : '本人履历未见独立博后，待复核';
  insert(r.unit + '逐人复核记录.md', '| ' + person + ' | ' + r.affiliation + ' ' + r.research +
    ' | ' + r.phd.mentor + '（明确博士导师） | ' + postdoc + ' | ' +
    ref([...r.current, ...r.phd.urls, ...r.postdoc.urls]) + ' |', '|---|---|---|---|---|');
  audits.push({ audit_id: auditId, record_id: r.id, aspects, followup_required: true, next_step: r.next });
}
manifest.notes = manifest.nodes.length;
manifest.units = new Set(manifest.nodes.map(r => r.unit)).size;
writes.set('graph-manifest.json', JSON.stringify(manifest, null, 2) + '\n');

function run(script, ...args) {
  execFileSync(process.execPath, ['--no-warnings', script, ...args], { stdio: 'inherit' });
}
function save(name, data) {
  const file = batch + '_' + name + '.json';
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}
console.log(JSON.stringify({ records: audits.map(a => a.record_id), files: writes.size, edges: edges.length }));
if (process.argv[2] === 'apply') {
  for (const [name, content] of writes) fs.writeFileSync(path.join(root, name), content, 'utf8');
  run('检索流程.cjs', 'sync');
  for (const event of audits) run('人工核查台账.cjs', 'record', save('人工_' + event.record_id, event));
  run('结构化师承关系.cjs', 'record', save('结构化', edges));
}
