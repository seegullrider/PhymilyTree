const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('7a40377f');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_7a40377f_thesis_cv';
event.aspects.phd = {
  status: 'confirmed_advisor',
  note: '本人履历记 1997 RWTH Aachen 博士，Graduate Advisors 栏明确列该校 Knut Urban；博士论文致谢将 Urban 和 D. M. Herlach 并列感谢指导。Herlach 仅标博士研究师长，其正式学位导师职衔待核。',
  sources: ['https://www.schroerslab.com/jan-schroers-cv', 'https://juser.fz-juelich.de/record/863048/files/J%C3%BCl_3456_Schroer.pdf?version=1']
};
event.aspects.postdoc = {
  status: 'confirmed_advisor',
  note: '本人履历明确 Postdoctoral Advisor: William L. Johnson，Caltech 材料系博后 1998–2002。',
  sources: ['https://www.schroerslab.com/jan-schroers-cv']
};
event.followup_required = true;
event.next_step = '已确认博士及博士后导师；继续查 RWTH 正式论文档案或答辩文书，判断 Herlach 是否另具正式共同导师职衔。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Schroers-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
