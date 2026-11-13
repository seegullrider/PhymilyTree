const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('4b16000c');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_4b16000c_wikidata_candidate';
event.aspects.phd = {
  status: 'group_or_candidate',
  note: 'APS 履历确认博士期间与 Wilkins 和 Wilson 工作；Wikidata 列 Wilkins 为博士导师并引 ProQuest 303698129，但该原档本轮不可读取，正式职衔保留候选。',
  sources: ['https://higherlogicdownload.s3.amazonaws.com/APS/418e9042-a445-4ad2-bd2d-c8d7527018c8/UploadedImages/Documents/summer1999.pdf', 'https://www.wikidata.org/wiki/Q2347650']
};
event.followup_required = true;
event.next_step = '查 ProQuest 303698129 或 Cornell 学位论文原档，确认正式导师及毕业时间；继续查博后导师职衔。';
fs.writeFileSync(path.join(__dirname, '本轮核查-White-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
