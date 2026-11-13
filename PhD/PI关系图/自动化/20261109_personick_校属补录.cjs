const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const unit = 'University of Virginia';
const name = 'Michelle Personick';
const id = crypto.createHash('sha256').update(`${unit}|${name}`).digest('hex').slice(0, 8);
const filename = `人员 - ${unit} - ${name} - ${id}`;
const department = `已核实单位 - ${unit} - 化学系`;
const topics = ['无机纳米材料', '等离激元催化'];
const profile = 'https://chemistry.as.virginia.edu/people/michelle-personick';
const lab = 'https://uva.theopenscholar.com/personick-research-group/people/prof-michelle-l-personick';
const cv = 'https://uva.theopenscholar.com/files/personick-research-group/files/CV_Michelle%20Personick_6.12.23.pdf';
const auditId = `20261109_${id}_personick_primary`;
const advisors = [
  { key: 'mirkin', name: 'Chad A. Mirkin', filename: '人员 - Northwestern - Chad Mirkin - d6866c22', stage: 'phd', role: '博士导师', reverse: '博士生', evidence: '本人 CV 在 2013 年 Northwestern 无机化学博士条目下明确列 Mirkin 为 Advisor。' },
  { key: 'friend', name: 'Cynthia M. Friend', filename: '人员 - Harvard - Cynthia Friend（荣休） - 07e4c2bb', stage: 'postdoc', role: '博士后导师', reverse: '博士后研究者', evidence: '本人 CV 在 2013–2015 年 Harvard 化学与化学生物学系博士后条目下明确列 Friend 为 Advisor。' },
  { key: 'madix', name: 'Robert J. Madix', filename: '师承人物 - Robert J. Madix', stage: 'postdoc', role: '博士后共同导师', reverse: '博士后研究者（共同指导）', evidence: '本人 CV 在同一 Harvard 博士后条目下明确列 Madix 为 Co-Advisor。' },
];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, 'utf8');
const wiki = (file, label) => `[[${file}|${label}]]`;
const person = wiki(filename, name);
const school = wiki(`院校 - ${unit}`, unit);
const topicLinks = topics.map(topic => wiki(`已核实方向 - ${topic}`, topic)).join('、');
const profileLink = `[UVA 化学系](${profile})`;
const cvLink = `[本人 CV 第 1 页](${cv})`;
const audit = {
  audit_id: auditId,
  record_id: id,
  aspects: {
    identity: { status: 'confirmed', note: '化学系、实验室主页与本人 CV 的 Northwestern 博士及 Harvard 博后履历一致。', sources: [profile, lab, cv] },
    affiliation: { status: 'confirmed', note: 'UVA 化学系现列副教授兼研究生项目主任。', sources: [profile, lab] },
    research: { status: 'confirmed', note: '研究金属纳米材料的结构和表面性质，以及晶体缺陷、双金属界面上的等离激元催化。归入相邻材料方向。', sources: [profile] },
    phd: { status: 'confirmed_advisor', note: advisors[0].evidence, sources: [cv, lab] },
    postdoc: { status: 'confirmed_advisor', note: `${advisors[1].evidence}${advisors[2].evidence}`, sources: [cv, lab] },
  },
  followup_required: false,
  next_step: '当前院系及两个训练阶段均有直接来源。学校其余化学、物理、材料及工程人员继续筛查。',
};

const manifestFile = 'graph-manifest.json';
const manifest = JSON.parse(read(manifestFile));
const matching = manifest.nodes.filter(node => node.id === id || node.filename === filename ||
  (node.unit === unit && /^michelle (?:l\.? |louise )?personick$/i.test(node.name)));
if (matching.length && (matching.length !== 1 || matching[0].id !== id || matching[0].filename !== filename)) {
  throw Error('校属记录存在冲突，需人工核对');
}

const changes = new Map();
function append(file, line, beforeAuto = false) {
  const content = changes.get(file) ?? read(file);
  if (content.includes(line)) return;
  const marker = '<!-- PI-AUTO-SEARCH:START -->';
  const markerIndex = beforeAuto ? content.indexOf(marker) : -1;
  const start = markerIndex >= 0 ? content.slice(0, markerIndex) : content;
  const end = markerIndex >= 0 ? `\n${content.slice(markerIndex)}` : '';
  changes.set(file, `${start.trimEnd()}\n${line}\n${end}`);
}

const personFile = `人物/${filename}.md`;
const note = `# ${name}\n\n## 院系与研究方向核验（2026-11-09）\n\n- ${school} ${wiki(department, '化学系')}副教授兼研究生项目主任。${profileLink}\n- 相邻材料方向：${topicLinks}。研究金属纳米颗粒的结构与表面性质，以及等离激元在晶体缺陷和双金属界面上的催化作用。${profileLink}\n\n## 师承\n\n${advisors.map(a => `- ${a.role}：${wiki(a.filename, a.name)}。${a.evidence}${cvLink}`).join('\n')}\n\n- [本人实验室简介](${lab})可交叉核对博士和博士后履历。CV 中 Sunhee Choi 的指导关系属于本科阶段。\n`;

append(`院校与机构/院校 - ${unit}.md`, `- ${person}`);
append(`已核实院系/${department}.md`, `- ${person} · ${profileLink}`);
for (const topic of topics) append(`已核实方向/已核实方向 - ${topic}.md`, `- ${wiki(filename, `${name} · ${unit}`)} · ${profileLink}`);
append('University of Virginia逐人复核记录.md', `| ${person} | 化学系，金属纳米材料及等离激元催化 | Chad A. Mirkin（博士导师） | Cynthia M. Friend（博士后导师）、Robert J. Madix（博士后共同导师） | ${profileLink} · ${cvLink} |`);
append('University of Virginia院系筛查待办.md', `\n## 化学系\n\n- ${person} 已补录。研究金属纳米材料和等离激元催化，博士及博士后师承已查到直接证据。${profileLink} · ${cvLink}`);
for (const advisor of advisors) {
  append(`人物/${advisor.filename}.md`, `- ${advisor.reverse}：${person}。${advisor.evidence}${cvLink}`, true);
  append('师承关系索引.md', `- ${person} → ${advisor.role}：${wiki(advisor.filename, advisor.name)}。${advisor.evidence}${cvLink}`);
}

const typed = advisors.map(a => ({ event_id: `typed_20261109_${id}_${a.key}`, record_id: id,
  stage: a.stage, mentor_filename: a.filename, kind: 'advisor', source_audit_id: auditId,
  evidence: a.evidence, sources: [cv, lab] }));
if (!fs.existsSync(path.join(root, personFile))) {
  fs.writeFileSync(path.join(root, personFile), note, { encoding: 'utf8', flag: 'wx' });
}
for (const [file, content] of changes) write(file, content);
if (!matching.length) {
  manifest.nodes.push({ id, filename, name, unit, kind: '美国' });
  write(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
}
write('自动化/人工-20261109-personick新增.json', `${JSON.stringify(audit, null, 2)}\n`);
write('自动化/结构化-20261109-personick新增.json', `${JSON.stringify(typed, null, 2)}\n`);
console.log(JSON.stringify({ id, filename, inserted: !matching.length }));
