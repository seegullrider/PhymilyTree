const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('7464b0a0');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_7464b0a0_harvard_group_candidate';
event.aspects.postdoc = {
  status: 'group_or_candidate',
  note: 'Schlom 组校友页与 UCI 简介确认 Cornell 博后组属。Harvard 2019 博士论文将 Qi Song 列为 Mundy 组成员，UCI 简介及 APS 2021 镍酸盐会议记录支持同人推断，但同名身份和正式导师职衔仍待核。',
  sources: ['https://schlom.mse.cornell.edu/people/postdoc-alum', 'https://engineering.uci.edu/files/10-9-2025_qi_song_flyer_0.pdf', 'https://hoffman.physics.harvard.edu/theses/2019-05-15-Tatiana-Webb-thesis.pdf', 'https://meetings-archive.aps.org/mar/2021/m55/']
};
event.followup_required = true;
event.next_step = '查 Fudan 论文正式导师；查 Mundy 组本人名录或 CV 排除同名、核实 Harvard 及 Cornell 博后正式导师。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Song-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
