const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');

const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const batch = '20261111_1220';
const indexFile = '../师承关系索引.md';
const fileUpdates = new Map();
const events = [];
const edges = [];
const pages = [];
const records = db.prepare('SELECT name, unit, filename FROM records WHERE id=?');
const latest = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const read = file => fileUpdates.get(file) ?? fs.readFileSync(file, 'utf8');
const note = filename => '../人物/' + filename + '.md';
const link = (label, url) => '[' + label + '](' + url + ')';
const wiki = (filename, name) => '[[' + filename + '|' + name + ']]';

function updateLine(file, test, update) {
  const current = read(file);
  const nl = current.includes('\r\n') ? '\r\n' : '\n';
  const lines = current.split(/\r?\n/);
  const matched = lines.flatMap((line, i) => test(line) ? [i] : []);
  if (matched.length !== 1) throw Error(file + ' matched ' + matched.length + ' lines');
  lines[matched[0]] = update(lines[matched[0]], nl);
  fileUpdates.set(file, lines.join(nl));
}
function addLine(file, text) {
  if (read(file).includes(text)) return;
  updateLine(file, line => line === '## 师承', (line, nl) => line + nl + nl + text);
}
function mergeAspect(event, aspect, note, sources, status) {
  const prior = event.aspects[aspect];
  event.aspects[aspect] = { ...prior, status, note, sources: [...new Set([...sources, ...prior.sources])] };
}
function beginAudit(id) {
  const event = JSON.parse(latest.get(id).details_json);
  event.audit_id = 'pi_archive_' + batch + '_' + id;
  event.followup_required = true;
  events.push(event);
  return event;
}
function receipt(id, url, text, error) {
  pages.push(error ? { record_id: id, url, error } : { record_id: id, url, raw: text, excerpt: text });
}
function roleEdge(event, stage, mentor, evidence, sources, suffix) {
  edges.push({ event_id: event.audit_id + '_' + stage + '_' + suffix, record_id: event.record_id, stage,
    kind: 'advisor', mentor_filename: mentor, source_audit_id: event.audit_id, evidence, sources });
}

const id = '8d453193';
const p = records.get(id);
const cv = 'https://wang.faculty.asu.edu/wp-content/uploads/sites/57/2021/07/CV-RWang-July-2021.pdf';
const urban = 'https://www.gruppourban.com/current-group/';
const faculty = 'https://forge.engineering.asu.edu/faculty_mentor/robert-wang/';
const majumdar = 'https://web.stanford.edu/group/magiclab/people-alumni.html';
const segalman = 'https://www.segalman.mrl.ucsb.edu/members';
const cvLink = link('Robert Y. Wang 本人 CV 第 1 页', cv + '#page=1');
const phd = '本人 ASU 托管 CV 第 1 页在 2008 年 UC Berkeley 机械工程 Ph.D. 条目的 Advisors 栏具名 Arun Majumdar 与 Rachel Segalman，和各自的实验室博士校友档一致。';
const post = '本人 CV 第 1 页明确列 2008–2011 年 LBNL Molecular Foundry 博后 Advisor 为 Delia Milliron。Urban 组在 Postdoctoral Advisees 下另具名记录同一人和任期，并明确与 Delia Milliron 共同指导。';
const followup = '本人 CV 已证两位 Berkeley 博士导师与 Delia Milliron 博后导师。Urban 博后共同指导有其组指导名册。继续查 Wang 本人学位馆藏的签署角色；此前查到的 Joseph Patrick Feser 学位论文另存消歧。';
const title = wiki(p.filename,p.name);
const personFile = note(p.filename);

const event = beginAudit(id);
mergeAspect(event,'phd',phd,[cv,majumdar,segalman],'confirmed_advisor');
mergeAspect(event,'postdoc',post,[cv,urban],'confirmed_advisor');
mergeAspect(event,'identity','ASU 本人 CV 具名 Robert Y. Wang、2008 Berkeley 博士、2008–2011 LBNL 博后及 2011 年起 ASU 任用。本人原档和 ASU 工程学院、组校友档相符。',[cv,faculty],'confirmed');
event.next_step = followup;

for (const [mentor,name,origin,oldReverse,suffix] of [
  ['师承人物 - Arun Majumdar','Arun Majumdar',majumdar,'博士课题组研究者','majumdar'],
  ['人员 - UC Santa Barbara - Rachel A. Segalman - 7f811895','Rachel A. Segalman',segalman,'博士阶段课题组成员','segalman'],
]) {
  const mentorLink = wiki(mentor,name);
  const evidence = phd + ' ' + cvLink + ' · ' + link(name + ' 组博士校友档',origin);
  const newLine = '博士导师：' + mentorLink + '。' + evidence;
  updateLine(personFile,line => /^- 博士(?:阶段)?(?:课题组负责人|导师)：/.test(line) && line.includes(mentorLink),() => '- ' + newLine);
  updateLine(note(mentor),line => (line.startsWith('- ' + oldReverse + '：') || line.startsWith('- 博士生：')) && line.includes(title),() => '- 博士生：' + title + '。' + evidence);
  updateLine(indexFile,line => line.startsWith('- ' + title + ' → 博士') && line.includes(mentorLink),() => '- ' + title + ' → ' + newLine);
  roleEdge(event,'phd',mentor,phd,[cv,origin],suffix);
}
updateLine(personFile,line => line.startsWith('- 博士关系证据：'),() => '- 博士学位原件追查：本人履历已具名两位博士导师，论文封面和签署角色继续追查。' + cvLink);
updateLine(personFile,line => line.startsWith('- 核查边界：'),() => '- 核查边界：' + followup);
updateLine(personFile,line => line.startsWith('- 2026-11-05 复核：'),() => '- 2026-11-05 核过 ' + link('Urban 博后指导名册',urban) + ' 和 ' + link('Majumdar 组校友档',majumdar) + '。本次以具名 CV 补足博士导师的正式证据。 ' + cvLink);
updateLine(personFile,line => line.startsWith('- 博士后导师：[[人员 - UT Austin - Delia Milliron - 987f59bc|'),line => line.includes(cvLink) ? line : line + ' ' + cvLink + ' 另具名 Delia Milliron。');
updateLine(note('人员 - UT Austin - Delia Milliron - 987f59bc'),line => line.startsWith('- 博士后研究者：') && line.includes(title),line => line.includes(cvLink) ? line : line + ' ' + cvLink + ' 另具名 Delia Milliron。');
updateLine(indexFile,line => line.startsWith('- ' + title + ' → 博士后导师：'),line => line.includes(cvLink) ? line : line + ' ' + cvLink + ' 另具名 Delia Milliron。');
updateLine('../Arizona State逐人复核记录.md',line => line.startsWith('| ' + title),line => {
  const old = 'Arun Majumdar、Rachel A. Segalman（博士阶段课题组负责人；正式论文导师待核）';
  const next = 'Arun Majumdar、Rachel A. Segalman（本人 CV 具名博士导师）';
  if (!line.includes(old) && !line.includes(next)) throw Error('unexpected Robert Wang school row');
  const replaced = line.replace(old,next);
  return replaced.includes(cvLink) ? replaced : replaced.slice(0,-2) + ' · ' + cvLink + ' |';
});
roleEdge(event,'postdoc','人员 - UT Austin - Delia Milliron - 987f59bc',post,[cv,urban],'milliron');
receipt(id,cv,phd + ' ' + post);
receipt(id,urban,'Urban 的 Postdoctoral Advisees 原档明确 Robert Wang 2008–2011 博后，标注与 Delia Milliron 共同指导。');

for (const [otherId,url,detail] of [
  ['070d0f17','https://cse.umn.edu/physics/jian-ping-wang','Stanford MAGIC Lab 第 58 行 Jian-gang Wang 为该组 PhD 校友，去向 Hewlett Packard。Minnesota 的 Jian-Ping Wang 由本人校方核 1995 中国科学院物理所博士、1996 NUS 博后，排除该名录误配。'],
  ['becc32e1','https://nusgs.nus.edu.sg/thesis-advisors/phywjs','Stanford MAGIC Lab 第 58 行 Jian-gang Wang 为该组 PhD 校友，去向 Hewlett Packard。NUS 本人档核 Jian-Sheng Wang 是 1987 Carnegie Mellon 博士并有 Rutgers 及 Jülich 博后，排除该名录误配。'],
  ['972b25fe','https://personal.ntu.edu.sg/zhaoyang/CV.html','Stanford MAGIC Lab 第 67 行的 Yang Zhao 为 Majumdar 组 PhD 校友，名录去向 USTC。NTU 的 Yang Zhao 本人 CV 明列 UC San Diego 1994 物理博士及 Katja Lindenberg，排除该名录同名误配。'],
]) {
  const other = records.get(otherId);
  const e = beginAudit(otherId);
  const old = e.aspects.identity.note;
  mergeAspect(e,'identity',old.includes(detail) ? old : old + ' ' + detail,[url,majumdar],'confirmed');
  addLine(note(other.filename),'- 姓名消歧。' + detail + ' ' + link('校方本人原档',url) + ' · ' + link('Stanford 名录',majumdar));
  receipt(otherId,majumdar,detail);
}

db.close();
console.log(JSON.stringify({files:fileUpdates.size, audits:events.length, edges:edges.length, pages:pages.length}));
if (process.argv[2] === 'apply') {
  function persist(label,value) {
    const file = batch + '_' + label + '.json';
    fs.writeFileSync(file,JSON.stringify(value,null,2) + '\n','utf8');
    return file;
  }
  function run(script,...args) {
    execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});
  }
  for (const e of events) run('人工核查台账.cjs','record',persist('人工_' + e.record_id,e));
  for (const [file,value] of fileUpdates) fs.writeFileSync(file,value,'utf8');
  run('结构化师承关系.cjs','record',persist('Wang导师核实结构化',edges));
  run('检索流程.cjs','ingest-reviewed-pages',persist('Wang导师及姓名比对回执',pages));
}
