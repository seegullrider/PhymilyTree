const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('365a11b4');
db.close();
if (!row) throw Error('缺少此前人工事件，停止以免覆盖');
const event = JSON.parse(row.details_json);
event.audit_id = '20261107_365a11b4_postdoc_primary';
event.aspects.affiliation.sources = ['https://viterbigradadmission.usc.edu/doctoral/faculty-research/profile/?fname=Andrea&lname=Armani'];
event.aspects.research.sources = [...event.aspects.affiliation.sources];
event.aspects.postdoc = {
  status: 'confirmed_advisor',
  note: '本人问答直接称 Scott Fraser 与 Richard Flagan 为其 Caltech 两位 post-doc advisors；保留 Vahala 实验室博士后组属但不推断其正式指导角色。',
  sources: ['https://www.engineergirl.org/3040/Andrea-Armani', 'https://www.pma.caltech.edu/news/caltech-scientists-create-breakthrough-sensor-capable-detecting-individual-molecules-1300']
};
event.followup_required = true;
event.next_step = '追查本人 Caltech 博士论文原文及正式导师，确认博士后时间与各阶段角色。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Armani-20261107.json'), JSON.stringify(event, null, 2) + '\n');
