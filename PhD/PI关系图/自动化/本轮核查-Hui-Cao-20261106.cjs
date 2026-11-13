const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('55b5f8d9');
if (!row) throw new Error('未找到 Hui Cao 已有人工台账，停止以防覆盖');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_55b5f8d9_stanford_roster';
event.aspects.phd = {
  status: 'group_or_candidate',
  note: '本人访谈称赴 Stanford 与 Yoshihisa Yamamoto 学习量子光学；Stanford 课题组校友表在 1997 年列其姓名并指向本人 Yale 实验室，本人 CV 列 Stanford 1997 应用物理博士。研究师长关系可信，维基百科称其正式博士导师但仍须原始学位档案核实。同名 Stanford 石油工程 2002 博士是不同记录，不得误并。',
  sources: ['https://www.laserfocusworld.com/optics/article/16547019/future-optics-complex-devices-make-photonics-more-efficient-interview-with-hui-cao', 'https://yoshihisa.people.stanford.edu/people', 'https://www.eng.yale.edu/caolab/CV_Cao.pdf', 'https://en.wikipedia.org/wiki/Hui_Cao', 'https://pangea.stanford.edu/ERE/pdf/pereports/PhD/Cao02.pdf']
};
event.aspects.postdoc = {
  status: 'unresolved',
  note: '本人 CV 列 Northwestern 助理教授 1997 年 9 月任职，访谈称 Stanford 博士毕业后即获该职位；未发现明确博士后导师，不能据此断言整个职业生涯没有博士后经历。',
  sources: ['https://www.eng.yale.edu/caolab/CV_Cao.pdf', 'https://www.laserfocusworld.com/optics/article/16547019/future-optics-complex-devices-make-photonics-more-efficient-interview-with-hui-cao']
};
event.followup_required = true;
event.next_step = '查 Stanford 1997 年应用物理博士论文及学位档案以确认正式 thesis advisor；继续核对是否有博士后阶段。避免与 2002 年同校石油工程同名博士混淆。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Hui-Cao-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
