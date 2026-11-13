const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('28542d00');
db.close();
if (!row) throw Error('缺少此前人工事件，停止以免覆盖');
const event = JSON.parse(row.details_json);
event.audit_id = '20261107_28542d00_postdoc_history';
event.aspects.postdoc = {
  status: 'unresolved',
  note: '本人 CV 明列 St Andrews 1966–1968 博士后 Fellow 与 McMaster 1968–1970 博士后 Research Associate；均未命名导师，前一经历与履历中 1967 博士学位年份重叠。',
  sources: ['https://viterbi.usc.edu/directory/cv/vashishta_priya_cv.pdf']
};
event.aspects.phd.note = '本人 CV 列 1967 IIT Kanpur 博士但未命名导师；与 1966 年开始的博后经历存在日期重叠。';
event.aspects.phd.sources = ['https://viterbi.usc.edu/directory/cv/vashishta_priya_cv.pdf'];
event.followup_required = true;
event.next_step = '查 IIT Kanpur 博士论文及 St Andrews、McMaster 两段博士后原始记录和指导者，核对 1966–1967 时间重叠。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Vashishta-20261107.json'), JSON.stringify(event, null, 2) + '\n');
