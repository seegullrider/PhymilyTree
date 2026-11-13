const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('5197e2f3');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_5197e2f3_birman_candidate';
event.aspects.phd = {
  status: 'group_or_candidate',
  note: 'APS 记 Klein 1969 年 NYU 博士；CCNY 系通讯记 Birman 在 NYU 1962–1974 任教，Klein 在 Birman 纪念会的报告回顾与 Birman 的研究。通讯未区分 Klein 是学生、博后或同事，只作为低可信度博士导师候选，不能确证。',
  sources: ['https://www.ccny.cuny.edu/physics/department-physics-newsletter-vol-10-2016-2017', 'https://higherlogicdownload.s3.amazonaws.com/APS/418e9042-a445-4ad2-bd2d-c8d7527018c8/UploadedImages/Documents/spring1994.pdf']
};
event.followup_required = true;
event.next_step = '查 NYU 博士论文及 Birman 学生名录确认该候选，查 1969–1971 Naval Research Laboratory 博后研究指导资料。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Klein-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
