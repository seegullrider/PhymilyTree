const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('33d4d05c');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_33d4d05c_lehigh_project_advisor';
event.aspects.phd = {
  status: 'group_or_candidate',
  note: 'Lehigh 2007 年研究生竞赛列 Dillon 晶界研究项目 Advisor 为 Harmer；Harmer 本人文章称 Dillon 为其研究生。项目指导已确认，正式论文导师待核。',
  sources: ['https://news.lehigh.edu/news/engineering-student-research-competition-sets-standard-university-research-event', 'https://citeseerx.ist.psu.edu/document?doi=5cb8e26b67eee50b8af1d80ce56d8e4d326ffd19&repid=rep1&type=pdf']
};
event.followup_required = true;
event.next_step = '查 Lehigh 博士论文原档确认正式导师；查 CMU 博后组与职位。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Dillon-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
