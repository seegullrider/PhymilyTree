const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('83a17d8f');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_83a17d8f_cv_advisors';
event.aspects.phd = {
  status: 'confirmed_advisor',
  note: '本人 CV Education 栏明确 Texas A&M 1987 年博士 Thesis Advisor: Charles R. Martin。',
  sources: ['https://www.chem.uci.edu/~rmpenner/Penner_CV.pdf']
};
event.aspects.postdoc = {
  status: 'confirmed_advisor',
  note: '本人 CV 明确 Stanford 1987–1988 及 Caltech 1988–1990 的 Postdoctoral Advisor: Nathan S. Lewis。',
  sources: ['https://www.chem.uci.edu/~rmpenner/Penner_CV.pdf']
};
event.followup_required = false;
event.next_step = '两阶段导师及学校身份、研究方向均有来源；如有新资料可增量复查。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Penner-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
