// 人工核查事件台账：只登记实际逐项查过的记录；不能从标题或自动检索推算。
const fs = require('fs');
const {DatabaseSync} = require('node:sqlite');
const path = require('path');
const db = new DatabaseSync(process.env.PI_AUTOMATION_DB || path.join(__dirname, '检索队列.sqlite'));
db.exec(`PRAGMA busy_timeout=10000;
CREATE TABLE IF NOT EXISTS manual_audit_events (
  audit_id TEXT PRIMARY KEY, record_id TEXT NOT NULL, recorded_at TEXT NOT NULL,
  details_json TEXT NOT NULL, FOREIGN KEY(record_id) REFERENCES records(id)
);
CREATE INDEX IF NOT EXISTS idx_manual_audit_record ON manual_audit_events(record_id, recorded_at);`);
const domains = {
  identity: ['confirmed', 'uncertain'],
  affiliation: ['confirmed', 'uncertain'],
  research: ['confirmed', 'uncertain'],
  phd: ['confirmed_advisor', 'group_or_candidate', 'unresolved'],
  postdoc: ['confirmed_advisor', 'group_or_candidate', 'unresolved', 'no_postdoc_documented']
};
const profileFields = {identity:'身份', affiliation:'院系／任用', research:'研究方向'};
function validate(input) {
  if (!input || typeof input !== 'object' || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.audit_id || '')) throw Error('audit_id 必须是 8–100 位字母、数字、下划线或连字符');
  const rec = db.prepare('SELECT id,name,unit FROM records WHERE id=?').get(input.record_id);
  if (!rec) throw Error('未知校属记录 ID');
  if (!input.aspects || Object.keys(domains).some(k => !input.aspects[k])) throw Error('必须逐项登记身份、院系、方向、博士及博士后');
  for (const [k, allowed] of Object.entries(domains)) {
    const a = input.aspects[k];
    if (!allowed.includes(a.status) || typeof a.note !== 'string' || a.note.trim().length < 8 || !Array.isArray(a.sources)) throw Error(`${k}: 状态、简要证据和来源数组不完整`);
    if (a.sources.some(x => typeof x !== 'string' || !/^https?:\/\//i.test(x))) throw Error(`${k}: 来源须是网页 URL`);
    if (!['unresolved','uncertain'].includes(a.status) && a.sources.length === 0) throw Error(`${k}: 已判断事项须附来源`);
  }
  if (typeof input.next_step !== 'string' || input.next_step.trim().length < 8) throw Error('须注明后续核查步骤或尚存限制');
  if (input.followup_required !== undefined && typeof input.followup_required !== 'boolean') throw Error('followup_required 必须是布尔值');
  return rec;
}
function record(input) {
  const rec = validate(input), serialized = JSON.stringify(input);
  const previous = db.prepare('SELECT details_json FROM manual_audit_events WHERE audit_id=?').get(input.audit_id);
  if (previous) {
    if (previous.details_json !== serialized) throw Error('audit_id 已存在且内容不同，拒绝覆盖');
    return {inserted:false,record:rec};
  }
  db.prepare('INSERT INTO manual_audit_events(audit_id,record_id,recorded_at,details_json) VALUES(?,?,?,?)').run(input.audit_id,rec.id,new Date().toISOString(),serialized);
  return {inserted:true,record:rec};
}
function status() {
  return {total_records:db.prepare('SELECT count(*) n FROM records').get().n,
    records_with_logged_review:db.prepare('SELECT count(DISTINCT record_id) n FROM manual_audit_events').get().n,
    review_events:db.prepare('SELECT count(*) n FROM manual_audit_events').get().n,
    by_school:db.prepare('SELECT r.unit,count(DISTINCT a.record_id) n FROM records r LEFT JOIN manual_audit_events a ON a.record_id=r.id GROUP BY r.unit ORDER BY r.unit').all(),
    note:'仅统计本台账已登记过人工核查事件的校属记录；历史未登记不等于未核查，也不等于关系已全部查明。'};
}
function next(limit) {
  return db.prepare(`SELECT r.id,r.name,r.unit,r.filename FROM records r WHERE NOT EXISTS
    (SELECT 1 FROM manual_audit_events a WHERE a.record_id=r.id) ORDER BY r.unit,r.name LIMIT ?`).all(limit);
}
// 根据每条校属记录最新的人工核查事件生成后续队列。状态反映该事件的证据，
// 不推断此前可靠记录已失效，也不把未发现正式导师当作不存在。
function latestReviews() {
  return db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.recorded_at,a.details_json
    FROM records r JOIN manual_audit_events a ON a.audit_id=(
      SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id
      ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1) ORDER BY r.unit,r.name`).all()
    .map(({details_json,...r})=>({...r,details:JSON.parse(details_json)}));
}
function needsFollowup(r) {
  const {aspects,followup_required}=r.details;
  return followup_required===true || aspects.phd.status!=='confirmed_advisor' || aspects.postdoc.status!=='confirmed_advisor'
    || Object.keys(profileFields).some(k=>aspects[k].status!=='confirmed');
}
function followupStatus(rows=latestReviews()) {
  const stages={phd:{},postdoc:{}};
  const profile_confirmed={identity:0,affiliation:0,research:0};
  for(const r of rows){
    for(const key of ['phd','postdoc']){const s=r.details.aspects[key].status;stages[key][s]=(stages[key][s]||0)+1;}
    for(const key of Object.keys(profileFields)) profile_confirmed[key]+=Number(r.details.aspects[key].status==='confirmed');
  }
  return {total:rows.length,stages,profile_confirmed,needs_followup:rows.filter(needsFollowup).length,
    explanation:'按每条校属记录最新一次人工事件统计；历史 confirmed_advisor 状态混合正式导师和阶段研究师长，不能单独据此统计正式导师人数。显式 followup_required 为 true 的记录即使已记录指导关系仍需追查；旧事件可能没有该字段，后续数量不是正式导师缺口的完整统计。阶段可交叉；事件中的未明不否定已有可靠记录，未发现博士后也保留后续复核。'};
}
function followup(limit, school) {
  return latestReviews().filter(r=>(!school||r.unit===school)&&needsFollowup(r))
    .sort((a,b)=>Number(a.details.aspects.phd.status==='confirmed_advisor')-Number(b.details.aspects.phd.status==='confirmed_advisor')||a.recorded_at.localeCompare(b.recorded_at))
    .slice(0,limit).map(r=>({id:r.id,name:r.name,unit:r.unit,filename:r.filename,recorded_at:r.recorded_at,
      phd:r.details.aspects.phd,postdoc:r.details.aspects.postdoc,next_step:r.details.next_step}));
}
function report() {
  const s = status(), rows = latestReviews();
  const graph = process.env.PI_GRAPH_ROOT || path.resolve(__dirname,'..');
  const bySchool = new Map(s.by_school.map(({unit})=>[unit,[]]));
  for(const row of rows) bySchool.get(row.unit).push(row);
  const schoolTable = [...bySchool].map(([unit, reviews])=>{
    const {total,stages,profile_confirmed,needs_followup}=followupStatus(reviews);
    const {phd,postdoc}=stages;
    const title = unit.replaceAll('|','／');
    const table = `${unit}逐人复核记录`;
    const label = fs.existsSync(path.join(graph,`${table}.md`)) ? `[[${table}\\|${title}]]` : title;
    const {identity,affiliation,research}=profile_confirmed;
    return `| ${label} | ${total} | ${identity} | ${affiliation} | ${research} | ${phd.group_or_candidate||0} | ${phd.unresolved||0} | ${postdoc.group_or_candidate||0} | ${postdoc.unresolved||0} | ${postdoc.no_postdoc_documented||0} | ${needs_followup} |`;
  }).join('\n');
  const f = followupStatus(rows);
  const content = `# 人工核查台账进度\n\n[[自动检索运行进度|自动检索进度]] · [[结构化师承关系（人工确认）|已结构化关系]] · [[PI关系图总入口|返回图谱]]\n\n生成时间：${new Date().toISOString()}。全库 ${s.total_records} 条校属记录，其中 ${s.records_with_logged_review} 条已登记人工核查，共 ${s.review_events} 项人工事件。\n\n${s.note}\n\n表中身份、院系、方向与阶段状态来自每条记录的最新人工事件。院系或任用可以是已核实的历史任用。点击学校可查看逐人证据。\n\n| 学校或机构 | 已登记人工核查 | 身份已核 | 院系／任用已核 | 方向已核 | 博士阶段关系或候选 | 博士未明 | 博后阶段关系或候选 | 博后未明 | 履历未见博后 | 仍需追查 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${schoolTable}\n`;
  const stageLine = key => Object.entries(f.stages[key]).map(([k,v])=>`${k}: ${v}`).join('；');
  const expanded = content + `\n## 最新人工事件的阶段状态\n\n博士：${stageLine('phd')}。\n\n博士后：${stageLine('postdoc')}。\n\n至少一项阶段、身份、院系或方向仍需追查：${f.needs_followup} 条校属记录。${f.explanation}\n\n使用 \`node 自动化/人工核查台账.cjs followup 10 [学校]\` 查看下一批；来源、证据及先前记录必须再人工核对。\n`;
  const profilePending = rows.flatMap(row=>{
    const fields=Object.entries(profileFields).filter(([key])=>row.details.aspects[key].status!=='confirmed');
    if(!fields.length) return [];
    const details=fields.map(([key,label])=>`  - ${label}。${row.details.aspects[key].note.replace(/\s+/g,' ')}`);
    return [`- [[${row.filename}|${row.name.replaceAll('|','／')}]]（${row.unit}）\n${details.join('\n')}`];
  });
  const profileTotals = Object.entries(profileFields).map(([key,label])=>`${label} ${f.profile_confirmed[key]} 条已核`).join('、');
  const profileSection = `\n## 身份、院系与研究方向待核\n\n${profileTotals}。${profilePending.length} 条已登记记录仍至少有一项待核。\n\n${profilePending.join('\n')}\n`;
  fs.writeFileSync(path.join(graph,'人工核查台账进度.md'),expanded+profileSection,'utf8');
  return s;
}
try {
  const [command,arg] = process.argv.slice(2);
  if (command === 'record') console.log(JSON.stringify(record(JSON.parse(fs.readFileSync(arg,'utf8')))));
  else if (command === 'status') console.log(JSON.stringify(status()));
  else if (command === 'next') console.log(JSON.stringify(next(Math.max(1,Math.min(100,Number(arg)||10)))));
  else if (command === 'followup-status') console.log(JSON.stringify(followupStatus()));
  else if (command === 'followup') console.log(JSON.stringify(followup(Math.max(1,Math.min(100,Number(arg)||10)),process.argv[4])));
  else if (command === 'report') console.log(JSON.stringify(report()));
  else throw Error('命令：record JSON文件 | status | next 数量 | report');
} catch (e) { console.error(String(e)); process.exitCode=1; }
finally { db.close(); }
