const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('5d424887');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_5d424887_oxford_theses';
event.aspects.phd = {
  status: 'confirmed_advisor',
  note: 'Oxford 物理系将 Scaffidi 2016 年论文列入 Steve Simon 指导的论文清单；本人介绍也称 DPhil 期间与 Simon 工作。',
  sources: ['https://www.physics.ox.ac.uk/research/group/condensed-matter-theory/recent-theses', 'https://www-thphys.physics.ox.ac.uk/colleges/merton/gradscholars.html']
};
event.followup_required = true;
event.next_step = '查 Berkeley 博士后 advisor 正式名衔；Altman 目前仅确证课题组负责人。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Scaffidi-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
