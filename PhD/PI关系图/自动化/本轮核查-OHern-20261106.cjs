const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('bd74faf6');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_bd74faf6_ucla_supervisor';
event.aspects.postdoc = {
  status: 'confirmed_advisor',
  note: 'UCLA 化学系同期博士后名单在 Corey O’Hern 的 Supervisor 栏列 A. Liu；UCLA 的 Andrea J. Liu 组主页列其为组员，本人 Yale 课题组简介称他为与 Andrea Liu 和 Sidney Nagel 共事的博士后。Liu 的 supervisor 得到明确确认；Nagel 的正式职衔未列，保留博士后阶段研究师长。',
  sources: ['https://www.chem.ucla.edu/dept/Postdocs.html', 'https://www.chem.ucla.edu/dept/Faculty/liu/', 'https://jamming.research.yale.edu/files/people.html']
};
event.followup_required = true;
event.next_step = '继续查 Penn 博士论文或学位档案核实 Tom Lubensky 候选；查 Chicago Sidney Nagel 的博士后正式导师职衔。';
fs.writeFileSync(path.join(__dirname, '本轮核查-OHern-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
