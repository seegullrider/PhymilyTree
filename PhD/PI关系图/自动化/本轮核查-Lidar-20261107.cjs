const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('1b3c23cc');
db.close();
if (!row) throw Error('缺少此前人工事件，停止以免覆盖');
const event = JSON.parse(row.details_json);
event.audit_id = '20261107_1b3c23cc_postdoc_primary';
event.aspects.postdoc = {
  status: 'confirmed_advisor',
  note: '本人访谈直接称 Berkeley 理论化学家 Birgit Whaley 与 Bill Miller 为博士后导师；Miller 对应 William H. Miller 的全名仍可追查正式履历。',
  sources: ['https://www.newquantumera.com/podcast/quantum-noise-with-daniel-lidar/', 'https://dornsife.usc.edu/profile/daniel-lidar/']
};
event.followup_required = true;
event.next_step = '查 Hebrew University 学位论文及 Gerber、Biham 与本人博士关系的原始资料；复核 William H. Miller 全名对应。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Lidar-20261107.json'), JSON.stringify(event, null, 2) + '\n');
