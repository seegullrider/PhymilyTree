const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');

const batch = '20261111_1153';
const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const files = new Map();
const audits = [];
const edges = [];
const pages = [];
const people = db.prepare('SELECT name, unit, filename FROM records WHERE id=?');
const latest = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const index = '../师承关系索引.md';

const read = file => files.get(file) ?? fs.readFileSync(file, 'utf8');
const person = filename => '../人物/' + filename + '.md';
const wiki = (filename, name) => '[[' + filename + '|' + name + ']]';
const cite = (label, url) => '[' + label + '](' + url + ')';
const links = sources => sources.map(([label, url]) => cite(label, url)).join(' · ');
const urls = sources => sources.map(([, url]) => url);

function change(file, predicate, update) {
  const old = read(file);
  const nl = old.includes('\r\n') ? '\r\n' : '\n';
  const lines = old.split(/\r?\n/);
  const matches = lines.flatMap((line, index) => predicate(line) ? [index] : []);
  if (matches.length !== 1) throw Error(file + ' matched ' + matches.length);
  lines[matches[0]] = update(lines[matches[0]], nl);
  files.set(file, lines.join(nl));
}
function addNoteLine(file, line) {
  if (read(file).includes(line)) return;
  change(file, value => value === '## 师承', (value, nl) => value + nl + nl + line);
}
function addEvidence(line, newEvidence) {
  return line.includes(newEvidence) ? line : line + ' ' + newEvidence;
}
function updateSchool(record, sources, oldCell, newCell) {
  change('../' + record.unit + '逐人复核记录.md', line => line.startsWith('| [[' + record.filename + '|'), line => {
    const labelEnd = line.indexOf(']]') + 2;
    const tail = line.slice(labelEnd, -2).split(' | ');
    if (tail.length !== 5 || !line.endsWith(' |')) throw Error('Invalid school row ' + record.name);
    if (oldCell !== undefined) {
      if (tail[3] !== oldCell && tail[3] !== newCell) throw Error('Unexpected postdoc cell ' + record.name + ' ' + tail[3]);
      tail[3] = newCell;
    }
    tail[4] = addEvidence(tail[4], '· ' + links(sources));
    return line.slice(0, labelEnd) + tail.join(' | ') + ' |';
  });
}
function audit(id, updates, next) {
  const event = JSON.parse(latest.get(id).details_json);
  const auditId = 'pi_archive_' + batch + '_' + id;
  event.audit_id = auditId;
  for (const [aspect, status, note, sources] of updates) {
    const prior = event.aspects[aspect];
    event.aspects[aspect] = { ...prior, status, note, sources: [...new Set([...urls(sources), ...prior.sources])] };
  }
  event.followup_required = true;
  event.next_step = next;
  audits.push(event);
  return auditId;
}
function edge(auditId, recordId, stage, kind, mentor, evidence, sources) {
  edges.push({ event_id: auditId + '_' + stage, record_id: recordId, stage, kind,
    mentor_filename: mentor, source_audit_id: auditId, evidence, sources: urls(sources) });
}
function receipt(id, sources, detail) {
  for (const url of urls(sources)) pages.push({ record_id: id, url, raw: detail, excerpt: detail });
}
function appendIndex(line) {
  const old = read(index);
  if (old.includes(line)) return;
  const nl = old.includes('\r\n') ? '\r\n' : '\n';
  files.set(index, old.trimEnd() + nl + line + nl);
}
function addPostdocMentor({ id, mentor, detail, sources, oldCell, newCell, next }) {
  const record = people.get(id);
  const who = wiki(record.filename, record.name);
  const mentorFilename = '师承人物 - ' + mentor;
  const how = wiki(mentorFilename, mentor);
  const evidence = detail + ' ' + links(sources);
  const file = person(record.filename);
  const phaseLine = '博士后阶段研究师长：' + how + '。' + evidence;
  const reverse = '- 博士后阶段研究者：' + who + '。' + evidence;
  addNoteLine(file, '- ' + phaseLine);
  const mentorFile = person(mentorFilename);
  if (fs.existsSync(mentorFile)) addNoteLine(mentorFile, reverse);
  else files.set(mentorFile, '# ' + mentor + '\n\n## 师承\n\n' + reverse + '\n');
  appendIndex('- ' + who + ' → ' + phaseLine);
  change(file, line => line.startsWith('- 核查边界：'), () => '- 核查边界：' + next + ' ' + links(sources));
  updateSchool(record, sources, oldCell, newCell);
  const auditId = audit(id, [['postdoc', 'group_or_candidate', detail, sources]], next);
  edge(auditId, id, 'postdoc', 'stage_mentor', mentorFilename, detail, sources);
  receipt(id, sources, detail);
}

addPostdocMentor({
  id: 'd797c39e', mentor: 'Rich Dondero',
  detail: 'Sandia 2011 年 7 月任命原报第 12 页明确列 Matt Eichenfield 已在 Sandia 就职，并具名 Rich Dondero 为 manager and mentor。Colorado 本人 CV 将 Sandia Truman Fellowship 记作 2011–2014，与此前 Caltech KNI 博后分开。Caltech 2010 学位授予按原馆藏及毕业名册，Sandia 原报回顾另写 2009。',
  sources: [['Sandia 同期任命原报', 'https://www.sandia.gov/app/uploads/sites/81/2021/07/labnews07-29-11.pdf'], ['Colorado 本人 CV', 'https://www.colorado.edu/ecee/media/2524']],
  oldCell: 'Oskar Painter（Caltech KNI 博士后课题组负责人）；Sandia 2011–2014 Truman Fellow 指导待核',
  newCell: 'Oskar Painter（Caltech KNI 博士后课题组负责人）、Rich Dondero（Sandia 2011–2014 博士后阶段研究师长）',
  next: 'Sandia 具名指导已核。继续查 Caltech KNI 博后入职月份与 Oskar Painter 的个人指导称谓。Caltech 2010 年学位授予按馆藏与名册。'
});

addPostdocMentor({
  id: '73a5677d', mentor: 'Farid El Gabaly Marquez',
  detail: 'Sandia 2017 年 8 月任命原档明确列材料物理部门具名导师 Farid El Gabaly Marquez，并将 Christian Mailhoit 分列为经理。Michigan 院系履历核 2017–2020 Sandia Truman 博后、2016 Stanford 材料博士及同一研究方向。既有 Alec Talin 阶段关系仍有本人旧资料，分别保留。',
  sources: [['Sandia 同期任命档', 'https://www.sandia.gov/labnews/2017/08/04/meet-sandias-2018-truman-fellows/'], ['Michigan 院系履历', 'https://www.mse.engin.umich.edu/people/fac/yiyangli'], ['Michigan 本人组档', 'https://ligroup.engin.umich.edu/members']],
  oldCell: 'Alec Talin（博士后研究师长）',
  newCell: 'Farid El Gabaly Marquez（Sandia Truman 博士后阶段研究师长）、Alec Talin（既有博士后研究师长）',
  next: 'Sandia 具名任用指导已核。继续查 Farid El Gabaly Marquez 与 Alec Talin 的职责分工和指导起止时间。Stanford 论文主导师 Chueh、研究师长 Yi Cui 及审阅委员身份已核，注意 Notre Dame 同名者。'
});

for (const [id, url, detail, boundary] of [
  ['92227ead', 'https://dspace.mit.edu/entities/publication/83e52b94-0d54-47c0-9eec-fa466ba6467c',
    'MIT 学位馆藏在 Arvind Narayanaswamy 的 2007 机械工程博士论文 Advisor(s) 栏列 Gang Chen，题名与导师监督履历一致。',
    'MIT 学位馆藏的博士导师已核。继续复核 2007 年 Columbia 入职原档及是否有单列博士后。'],
  ['3e3e32ea', 'https://dspace.mit.edu/entities/publication/5465469b-3cad-4855-840d-06844a63b8eb',
    'MIT 学位馆藏的 Advisor(s) 栏列 Gang Chen，发行年为 2006。论文扫描本题名页列 2005 年 12 月 20 日提交及 2006 年 2 月学位月份。华中科技大学履历具名 Mildred Dresselhaus 参与博士阶段研究，保留阶段研究师长。',
    '已分开记录 2005 年论文提交与 2006 年学位月份。Dresselhaus 的阶段研究师长证据保留，继续查独立共同导师委任、Colorado 离任时间与是否另有博后。'],
]) {
  const record = people.get(id);
  const mentor = '师承人物 - Gang Chen';
  const sources = [['MIT 学位馆藏', url]];
  if (id === '3e3e32ea') sources.push(['论文原件镜像', 'https://core.ac.uk/download/pdf/4405607.pdf']);
  const evidence = detail + ' ' + links(sources);
  change(person(record.filename), line => line.startsWith('- 博士导师：') && line.includes(mentor), line => addEvidence(line, evidence));
  change(person(mentor), line => line.startsWith('- 博士生：') && line.includes(record.filename), line => addEvidence(line, evidence));
  change(index, line => line.includes(record.filename + '|') && line.includes('→ 博士导师：') && line.includes(mentor), line => addEvidence(line, evidence));
  change(person(record.filename), line => line.startsWith('- 核查边界：'), () => '- 核查边界：' + boundary + ' ' + links(sources));
  updateSchool(record, sources);
  const auditId = audit(id, [['phd', 'confirmed_advisor', detail, sources]], boundary);
  edge(auditId, id, 'phd', 'advisor', mentor, detail, sources);
  receipt(id, sources, detail);
}

{
  const id = '39c34319';
  const record = people.get(id);
  const official = 'https://www.duffield.cornell.edu/people/zhiting-tian/';
  const vt = 'https://www.undergradcatalog.registrar.vt.edu/2014-15%20Undergraduate%20Catalog%20and%20Academic%20Policies.pdf';
  const thesis = 'https://dspace.mit.edu/entities/publication/b95fea66-55dc-4910-94f0-44891e93b967';
  const sources = [['Virginia Tech 同期教员名册', vt], ['Cornell 院系档', official]];
  const detail = 'Virginia Tech 2014–2015 教员名册列 Tian 2014 年任机械工程助理教授，学位栏亦为 2014 MIT 博士。Cornell 院系和本人组页记 2014–2018 Virginia Tech 教职，公开履历未见单列博后。';
  const next = 'MIT 馆藏具名博士导师 Gang Chen。Binghamton 本人采访所称 Ying Sun 是硕士导师。MIT 毕业至 Virginia Tech 教职未见单列博后，继续查月份及是否另有短期聘任。';
  change(person(record.filename), line => line.startsWith('- 核查边界：'), () => '- 博士后经历：' + detail + ' ' + links(sources) + '\n- 核查边界：' + next + ' ' + cite('Binghamton 本人采访', 'https://www.binghamton.edu/news/story/2161/alumni-spotlight-zhiting-tian'));
  updateSchool(record, sources, '待核', '2014 年任 Virginia Tech 教职，未见单列博士后');
  const doctoral = 'MIT 2014 博士论文馆藏 Advisor(s) 栏具名 Gang Chen，姓名及 Mechanical Engineering 与 Cornell 现任机构履历一致。';
  const doctoralSources = [['MIT 学位馆藏', thesis], ['Cornell 院系档', official]];
  const auditId = audit(id, [['phd', 'confirmed_advisor', doctoral, doctoralSources], ['postdoc', 'no_postdoc_documented', detail, sources]], next);
  edge(auditId, id, 'phd', 'advisor', '师承人物 - Gang Chen', doctoral, doctoralSources);
  receipt(id, sources, detail);
  receipt(id, doctoralSources.slice(0, 1), doctoral);
}

{
  const id = 'd412a632';
  const record = people.get(id);
  const mentor = '师承人物 - Ahmed Zewail';
  const faculty = 'https://engineering.ucsb.edu/people/bolin-liao';
  const group = 'https://www.tealab-liao.com/team';
  const sources = [
    ['UCSB 讲座履历', 'https://www.materials.ucsb.edu/sites/materials.ucsb.edu/files/docs/liao_flyer.pdf'],
    ['Caltech 校方讣告', 'https://www.caltech.edu/about/news/ahmed-zewail-1946-2016-51594'],
    ['本人实验室履历', group],
  ];
  const detail = 'UCSB 讲座履历列 2016 年 5 月至 2017 年 6 月 Caltech Kavli 博后，由 Ahmed Zewail 接待。Caltech 公告核 Zewail 于 2016 年 8 月 2 日去世，其阶段接待限于在世期间，后续具名指导者待核。';
  const next = '继续查 2016 年 8 月后的 Caltech 博后指导衔接及正式任用头衔。MIT MTL 2016 年报在相同论文条目括号内列 M. Dresselhaus，未说明其角色，待原档。';
  const proof = detail + ' ' + links(sources);
  const mentorLink = wiki(mentor, 'Ahmed Zewail');
  const personLink = wiki(record.filename, record.name);
  const phase = '博士后阶段研究师长：' + mentorLink + '。' + proof;
  change(person(record.filename), line => line.startsWith('- 博士后阶段研究师长：') && line.includes(mentor), () => '- ' + phase);
  change(person(mentor), line => line.startsWith('- 博士后阶段研究者：') && line.includes(record.filename), () => '- 博士后阶段研究者：' + personLink + '。' + proof);
  change(index, line => line.startsWith('- ' + personLink + ' → 博士后阶段研究师长：'), () => '- ' + personLink + ' → ' + phase);
  change(person(record.filename), line => line.startsWith('- 核查边界：'), () => '- 核查边界：' + next + ' ' + cite('MIT MTL 学位年报', 'https://mtlsites.mit.edu/annual_reports/2016/theses.pdf'));
  change(person(record.filename), line => line.startsWith('- UC Santa Barbara 机械工程教授'), () => '- UC Santa Barbara 工学院现列机械工程教授，本人组页列 2026 年 7 月升正教授。研究材料中的能量输运与超快电子显微学。 ' + cite('UCSB 工学院', faculty) + ' · ' + cite('本人实验室履历', group));
  updateSchool(record, sources, 'Ahmed Zewail（博士后阶段研究师长）', 'Ahmed Zewail（Caltech 博后早段接待教授）；2016 年 8 月后指导待核');
  const auditId = audit(id, [['postdoc', 'group_or_candidate', detail, sources], ['affiliation', 'confirmed', 'UCSB 工学院现列机械工程教授，本人实验室履历列 2026 年 7 月升正教授。', [['UCSB 工学院', faculty], ['本人实验室履历', group]]]], next);
  edge(auditId, id, 'postdoc', 'stage_mentor', mentor, detail, sources);
  receipt(id, sources, detail);
  receipt(id, [['UCSB 工学院', faculty]], '院系原页现列 Bolin Liao 为机械工程教授。');
}
db.close();

console.log(JSON.stringify({ files: files.size, audits: audits.length, edges: edges.length, pages: pages.length }));
if (process.argv[2] === 'apply') {
  function persist(label, value) {
    const file = batch + '_' + label + '.json';
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
    return file;
  }
  function run(script, ...args) {
    execFileSync(process.execPath, ['--no-warnings', script, ...args], { stdio: 'inherit' });
  }
  for (const event of audits) run('人工核查台账.cjs', 'record', persist('人工_' + event.record_id, event));
  for (const [file, content] of files) fs.writeFileSync(file, content, 'utf8');
  run('结构化师承关系.cjs', 'record', persist('MIT及Sandia结构化', edges));
  run('检索流程.cjs', 'ingest-reviewed-pages', persist('MIT及Sandia原页回执', pages));
}

