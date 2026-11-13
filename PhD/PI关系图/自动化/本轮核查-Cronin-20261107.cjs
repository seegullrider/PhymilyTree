const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('a953938c');
db.close();
if (!row) throw Error('缺少此前人工事件，停止以免覆盖');
const event = JSON.parse(row.details_json);
event.audit_id = '20261107_a953938c_phd_supervision';
event.aspects.phd = {
  status: 'confirmed_advisor',
  note: '2023 学校研究中心讲座简历直接称 MIT 博士 under supervision of Mildred Dresselhaus；按明确博士阶段研究师长统计，不推定正式论文签署角色，MIT 馆藏原文仍待查。',
  sources: ['https://www.metrans.org/assets/upload/Stephen%20Cronin%20Seminar%20Flyer%20on%20125.pdf']
};
event.aspects.affiliation.note = 'USC 官方目录确认 ECE、物理；2021 USC 报道及 2023 项目页还称化学教授，但当前 USC 目录未列，化学现职待核。';
event.aspects.affiliation.sources = ['https://dornsife.usc.edu/profile/stephen-cronin/', 'https://viterbischool.usc.edu/news/2021/12/four-viterbi-faculty-receive-durip-funding/', 'https://ncst.ucdavis.edu/people/stephen-cronin'];
event.followup_required = true;
event.next_step = '待 MIT 论文目录可读取后核论文 advisor；查 Harvard 博后正式指导及 USC 化学现任聘任。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Cronin-20261107.json'), JSON.stringify(event, null, 2) + '\n');
