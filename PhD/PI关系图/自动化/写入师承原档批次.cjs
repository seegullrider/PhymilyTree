const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { resolveMentor } = require('./解析师承节点.cjs');

const [input, mode] = process.argv.slice(2);
if (!input || !/^[^\\/]+\.json$/.test(input) || (mode && mode !== 'apply')) {
  throw Error('用法：node 写入师承原档批次.cjs 批次.json [apply]');
}
const root = path.resolve(__dirname, '..');
const specs = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!Array.isArray(specs) || !specs.length) throw Error('批次须为非空数组');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const getRecord = db.prepare('SELECT * FROM records WHERE id=?');
const getAudit = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const getSavedAudit = db.prepare('SELECT details_json FROM manual_audit_events WHERE audit_id=?');
const stem = path.basename(input, '.json');
const batchId = require('node:crypto').createHash('sha256').update(stem).digest('hex').slice(0, 14);
const indexFile = path.join(root, '师承关系索引.md');
const marker = '<!-- PI-AUTO-SEARCH:START -->';
const files = new Map();
const audits = [], relations = [];
const labels = {
  'phd.advisor': ['博士导师', '博士生'],
  'phd.stage_mentor': ['博士阶段研究师长', '博士阶段研究者'],
  'phd.group_leader': ['博士课题组负责人', '博士课题组成员'],
  'phd.candidate': ['博士导师候选', '博士阶段研究者候选（待核）'],
  'postdoc.advisor': ['博士后导师', '博士后研究者'],
  'postdoc.stage_mentor': ['博士后阶段研究师长', '博士后阶段研究者'],
  'postdoc.group_leader': ['博士后课题组负责人', '博士后课题组成员'],
  'postdoc.candidate': ['博士后导师候选', '博士后研究者候选（待核）']
};
const get = file => files.get(file) ?? fs.readFileSync(file, 'utf8');
const wiki = (target, label) => '[[' + target + '|' + label + ']]';
const linkTo = (line, target) => line.includes('[[' + target + '|') || line.includes('[[' + target + ']]');
const sources = urls => [...new Set(urls)].map((url, i) => '[原档 ' + (i + 1) + '](' + url + ')').join(' · ');

function changeLine(file, predicate, fn) {
  const current = get(file), nl = current.includes('\r\n') ? '\r\n' : '\n';
  const rows = current.split(/\r?\n/), matched = rows.map((line, i) => predicate(line) ? i : -1).filter(i => i >= 0);
  if (matched.length !== 1) throw Error(file + ' 的目标行数为 ' + matched.length);
  const i = matched[0];
  rows[i] = fn(rows[i], nl);
  files.set(file, rows.join(nl));
}

function append(file, text, before) {
  const current = get(file), nl = current.includes('\r\n') ? '\r\n' : '\n';
  if (current.includes(text)) return;
  if (!before) {
    files.set(file, current.trimEnd() + nl + text + nl);
    return;
  }
  changeLine(file, line => before(line), (line, sep) => text + sep + line);
}

for (const spec of specs) {
  const rec = getRecord.get(spec.id);
  if (!rec || !rec.name.startsWith(spec.name)) throw Error('校属身份不符 ' + spec.id);
  const file = path.join(root, '人物', rec.filename + '.md');
  const auditId = 'pi_original_' + batchId + '_' + rec.id;
  const existing = getSavedAudit.get(auditId);
  const prior = getAudit.get(rec.id);
  if (!prior) throw Error('无此前人工事件 ' + rec.id);
  const priorAudit = JSON.parse((existing ?? prior).details_json);
  const { aspects } = priorAudit;
  for (const [field, value] of Object.entries(spec.aspects)) {
    if (aspects[field].status === 'confirmed_advisor' && value.status !== 'confirmed_advisor') {
      throw Error('已有明确导师，须先核对该阶段的全部证据 ' + rec.id + ' ' + field);
    }
    aspects[field] = { ...value, sources: [...new Set([...value.sources, ...aspects[field].sources])] };
  }
  const followupRequired = spec.next === undefined ? priorAudit.followup_required : true;
  audits.push({
    audit_id: auditId,
    record_id: rec.id,
    aspects,
    followup_required: followupRequired,
    next_step: spec.next ?? priorAudit.next_step
  });

  for (const fix of spec.corrections ?? []) {
    const target = fix.where === 'person' ? file : fix.where === 'index' ? indexFile :
      resolveMentor(root, rec.filename, fix.filename).file;
    const current = get(target), nl = current.includes('\r\n') ? '\r\n' : '\n';
    const rows = current.split(/\r?\n/);
    const eligible = line => fix.where === 'person' || linkTo(line, rec.filename);
    const found = rows.filter(line => eligible(line) && line.includes(fix.old)).length;
    const alreadyFixed = line => line.includes(fix.replacement) || (fix.after && line.includes(fix.after));
    if (found === 0 && rows.filter(line => eligible(line) && alreadyFixed(line)).length === fix.expected) continue;
    if (found !== fix.expected) throw Error('旧核查说明匹配失败 ' + target + ' ' + found);
    files.set(target, rows.map(line => eligible(line) ? line.replace(fix.old, fix.replacement) : line).join(nl));
  }

  const person = wiki(rec.filename, spec.name);
  const boundary = line => line.startsWith('- 核查边界：');
  for (const [i, edge] of spec.edges.entries()) {
    const roles = labels[edge.stage + '.' + edge.kind];
    const mentor = resolveMentor(root, rec.filename, edge.mentor);
    if (!roles || !mentor.file || mentor.ambiguous || !['add', 'refresh', 'upgrade'].includes(edge.mode)) throw Error('关系或师长节点无效 ' + rec.id);
    if (edge.kind === 'advisor' && aspects[edge.stage]?.status !== 'confirmed_advisor') {
      throw Error('明确导师与人工台账阶段状态不一致，先核对并更新阶段证据 ' + rec.id + ' ' + edge.stage);
    }
    const [role, reverse] = roles;
    const proof = edge.evidence + ' ' + sources(edge.sources);
    if (edge.mode !== 'add') {
      const [oldRole, oldReverse] = edge.previousRoles ?? roles;
      const supportedUpgrade = ['advisor', 'stage_mentor'].includes(edge.kind) ||
        (edge.kind === 'group_leader' && oldRole.includes('候选'));
      if (edge.mode === 'upgrade' && (oldRole === role || !supportedUpgrade)) {
        throw Error('升级须指定旧标签及较明确的新关系 ' + rec.id);
      }
      const suffix = ' ' + proof;
      const extend = line => line.includes(suffix) ? line : line + suffix;
      const forward = prefix => [prefix + oldRole + '：', prefix + role + '：'];
      const backward = ['- ' + oldReverse + '：', '- ' + reverse + '：'];
      function updateRole(target, personTarget, prefixes, selector = line => line.startsWith('- ')) {
        const [before, after] = prefixes;
        changeLine(target, line => selector(line) && linkTo(line, personTarget) &&
          (line.includes(before) || (line.includes(after) && line.includes(suffix))),
        line => extend(line.replace(before, after)));
      }
      updateRole(file, mentor.target, forward('- '));
      updateRole(indexFile, mentor.target, forward(' → '), line => line.startsWith('- [[' + rec.filename + '|'));
      updateRole(mentor.file, rec.filename, backward);
    } else {
      const front = role + '：' + wiki(mentor.target, edge.label) + '。' + proof;
      const already = get(file).split(/\r?\n/).some(line =>
        line.startsWith(edge.stage === 'phd' ? '- 博士' : '- 博士后') &&
        (edge.stage !== 'phd' || !line.startsWith('- 博士后')) &&
        linkTo(line, mentor.target) && !line.includes(front));
      if (already) throw Error('已有同阶段人物链接，须人工核对旧角色 ' + rec.id + ' ' + edge.mentor);
      append(file, '- ' + front, boundary);
      append(indexFile, '- ' + person + ' → ' + front);
      append(mentor.file, '- ' + reverse + '：' + person + '。' + proof, get(mentor.file).includes(marker) ? line => line === marker : null);
    }
    relations.push({ event_id: auditId + '_' + i, record_id: rec.id, stage: edge.stage, mentor_filename: edge.mentor,
      kind: edge.kind, source_audit_id: auditId, evidence: edge.evidence, sources: edge.sources });
  }
  if (spec.add) append(file, '- 复核原档：' + spec.add + ' ' + sources(spec.refs), boundary);
  if (spec.profileNote) {
    append(file, '- ' + spec.profileNote + ' ' + sources(spec.refs), line => line === '## 师承');
  }
  if (spec.next !== undefined) {
    changeLine(file, boundary, line => line.includes(spec.next) ? line : line + ' ' + spec.next);
  }
  changeLine(path.join(root, rec.unit + '逐人复核记录.md'), line => line.startsWith('| [[' + rec.filename + '|'), line => {
    const end = line.indexOf(']]');
    const fields = line.slice(end + 2, -2).split(' | ');
    if (end < 0 || !line.endsWith(' |') || fields.length !== 5) throw Error('校表结构不符 ' + rec.id);
    for (const [stage, i] of [['schoolAffiliation', 1], ['phd', 2], ['postdoc', 3]]) {
      if (!spec[stage]) continue;
      if (fields[i] !== spec.previousSchool?.[stage] && fields[i] !== spec[stage]) {
        throw Error('校表阶段内容已变化，须先复核 ' + rec.id + ' ' + stage);
      }
      fields[i] = spec[stage];
    }
    const newSources = spec.refs.filter(url =>
      !fields[4].includes('](' + url + ')') && !fields[4].includes('](<' + url + '>)'));
    if (newSources.length) fields[4] += ' · ' + sources(newSources);
    return line.slice(0, end + 2) + fields.join(' | ') + ' |';
  });
}
db.close();

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
function call(script, ...args) {
  execFileSync(process.execPath, ['--no-warnings', script, ...args], { stdio: 'inherit' });
}
if (mode === 'apply') {
  for (const event of audits) {
    const file = stem + '_人工_' + event.record_id + '.json';
    writeJson(file, event);
    call('人工核查台账.cjs', 'record', file);
  }
  for (const [file, content] of files) fs.writeFileSync(file, content, 'utf8');
  if (relations.length) {
    const file = stem + '_结构化.json';
    writeJson(file, relations);
    call('结构化师承关系.cjs', 'record', file);
  }
}
console.log(JSON.stringify({ records: audits.length, relationships: relations.length, files: files.size, applied: mode === 'apply' }));
