
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const unit = 'University of Florida', name = 'Jennifer Andrew';
const id = crypto.createHash('sha256').update(unit + '|' + name).digest('hex').slice(0, 8);
const filename = `人员 - ${unit} - ${name} - ${id}`;
const department = '已核实单位 - University of Florida - 材料科学与工程系';
const topics = ['多铁材料', '磁性纳米材料', '功能纳米材料'];
const faculty = 'https://mse.ufl.edu/people/name/jennifer-andrew/';
const research = 'https://andrewresearchgroup.com/research/';
const award = 'https://ppfp.ucop.edu/info/fellowship-recipients/fellows-pages/andrew-jennifer.html';
const cohort = 'https://ppfp.ucop.edu/info/fellowship-recipients/fellows-2009/fellows-2009-name/';
const lab = 'https://sailorgroup.ucsd.edu/people/alumni/';
const phase = [
 { stage: 'phd', filename: '人员 - Harvard - David R. Clarke - 299173ef', name: 'David R. Clarke', kind: 'advisor',
   role: '博士导师', reverse: '博士生', proof: 'UC PPFP 个人原档和 2009 年度档分别明确 Thesis Advisor 为 David R. Clarke。UF 教师页确认 2008 UCSB 材料博士，Sailor 组名册核对 Clarke 与多铁纳米复合材料方向。', sources: [award, cohort, faculty, lab] },
 { stage: 'postdoc', filename: '人员 - UC San Diego - Michael J. Sailor - 78a59ff6', name: 'Michael J. Sailor', kind: 'stage_mentor',
   role: '博士后阶段研究师长', reverse: '博士后阶段研究者', proof: 'UC PPFP 原档明确项目 Mentor 为 Michael J. Sailor，Sailor 组校友原档列 2008–2011 UC San Diego 博后及 2011 转 UF，2009 是奖项年度。正式聘任 advisor 字段待核。', sources: [award, cohort, lab] }
];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const wiki = (target, label) => `[[${target}|${label}]]`;
const source = (label, url) => `[${label}](${url})`;
const person = wiki(filename, name);
const files = new Map();

function update(file, change) {
 const content = files.get(file) ?? read(file);
 files.set(file, change(content));
}
function append(file, line, before = null) {
 update(file, content => {
  if (content.includes(line)) return content;
  const sep = content.includes('\r\n') ? '\r\n' : '\n';
  if (!before) return content.trimEnd() + sep + line + sep;
  const at = content.indexOf(before);
  if (at < 0 || content.indexOf(before, at + before.length) !== -1) throw Error('位置不唯一 ' + file);
  return content.slice(0, at).trimEnd() + sep + sep + line + sep + sep + content.slice(at);
 });
}

const manifestFile = 'graph-manifest.json';
const manifest = JSON.parse(read(manifestFile));
if (manifest.nodes.some(r => r.id === id || r.filename === filename || r.unit === unit && /jennifer(?: s\.)? andrew/i.test(r.name))) {
 throw Error('可能已有校属记录');
}
const noteFile = `人物/${filename}.md`;
if (fs.existsSync(path.join(root, noteFile))) throw Error('人物页已存在');
const advisorLine = r => r.proof + ' ' + source('UC PPFP 原档', award) + ' · ' + source('Sailor 组档', lab);
files.set(noteFile, `# ${name}\n\n## 所在的学校或机构记录\n\n- ${wiki('院校 - '+unit, unit)} · ${wiki(department, '材料科学与工程系')}\n\n## 院系与研究方向核验（2026-11-10）\n\n- UF 材料科学与工程系 Margaret A. Ross 教授，研究磁电多铁复合材料和磁性、功能纳米材料，包含多铁相及压电与磁致伸缩耦合。方向关联 ${topics.map(t=>wiki('已核实方向 - '+t,t)).join(' · ')}。 ${source('UF 教师页',faculty)} · ${source('本人组研究页',research)}\n\n## 师承\n\n${phase.map(r=>'- '+r.role+'：'+wiki(r.filename,r.name)+'。'+advisorLine(r)).join('\n')}\n\n- 核查边界：博士论文签署页及 UC San Diego 博后正式个人导师字段待核。\n`);
append('院校与机构/院校 - '+unit+'.md','- '+person);
append('已核实院系/'+department+'.md','- '+person+' — '+source('UF 教师页',faculty));
for (const t of topics) append('已核实方向/已核实方向 - '+t+'.md','- '+wiki(filename,name+' · '+unit)+' — '+source('本人组研究页',research));
append(unit+'逐人复核记录.md',`| ${person} | 材料科学与工程系；多铁性、磁电复合材料、磁性纳米材料 | David R. Clarke（2008 UCSB 材料博士导师） | Michael J. Sailor（2008–2011 UC San Diego 博后阶段研究师长） | ${source('UF 教师页',faculty)} · ${source('UC PPFP 原档',award)} · ${source('Sailor 组档',lab)} |`,'## 待逐院系调查');
append(unit+'院系待核候选.md','- '+person+' 已补录。磁电多铁复合材料及磁性纳米材料方向。 '+source('UF 教师页',faculty),'EE、材料其他分支');
for (const r of phase) {
 const f = '人物/'+r.filename+'.md', before = '<!-- PI-AUTO-SEARCH:START -->';
 append(f, '- '+r.reverse+'：'+person+'。'+advisorLine(r), read(f).includes(before)?before:null);
 append('师承关系索引.md','- '+person+' → '+r.role+'：'+wiki(r.filename,r.name)+'。'+advisorLine(r));
}

const auditId = '20261110_'+id+'_uf_advanced_materials';
const audit = { audit_id: auditId, record_id: id, aspects: {
 identity: { status: 'confirmed', note: 'UF 教师页与 UC PPFP 及 Sailor 组档中的 UCSB 博士、UF 去向一致。', sources: [faculty, award, lab] },
 affiliation: { status: 'confirmed', note: 'UF 材料科学与工程系 Margaret A. Ross 教授。', sources: [faculty] },
 research: { status: 'confirmed', note: '本人组页明确磁电多铁复合材料以及压电和磁致伸缩耦合，结合 UF 教师档归入功能与磁性纳米材料方向。', sources: [faculty, research] },
 phd: { status: 'confirmed_advisor', note: phase[0].proof, sources: phase[0].sources },
 postdoc: { status: 'group_or_candidate', note: phase[1].proof, sources: phase[1].sources }
}, followup_required: true, next_step: '查 UCSB 博士论文签署页及 UC San Diego 博后正式个人导师称谓。' };
const typed = phase.map(r=>({ event_id:'20261110_'+id+'_'+r.stage+'_uf',record_id:id,stage:r.stage,mentor_filename:r.filename,kind:r.kind,evidence:r.proof,sources:r.sources,source_audit_id:auditId }));
manifest.nodes.push({ id, filename, name, unit, kind:'美国' });
manifest.notes = manifest.nodes.length;
manifest.units = new Set(manifest.nodes.map(r=>r.unit)).size;
files.set(manifestFile, JSON.stringify(manifest,null,2)+'\n');
files.set('自动化/人工-20261110-JenniferAndrew.json',JSON.stringify(audit,null,2)+'\n');
files.set('自动化/结构化-20261110-JenniferAndrew.json',JSON.stringify(typed,null,2)+'\n');
if (process.argv[2] === 'apply') {
 for (const [file,content] of files) fs.writeFileSync(path.join(root,file),content,{encoding:'utf8',flag:file===noteFile?'wx':'w'});
}
console.log(JSON.stringify({ id, filename, validatedFiles: files.size, total: manifest.notes }));

