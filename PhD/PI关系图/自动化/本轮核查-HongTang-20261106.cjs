const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('640c96c7');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_640c96c7_stage_correction';
event.aspects.phd = {
  status: 'group_or_candidate',
  note: 'Yale 物理系资料列 Caltech 2002 博士。IEEE 原报道称 Roukes 为 Tang 的 supervisor，但 IEEE 期刊目录显示其刊于 2003 年 7 月，不能单凭该文将博士阶段导师确证；Roukes 仍是低可信候选，需论文及博士具体毕业时间。',
  sources: ['https://physics.yale.edu/profile/hong-tang', 'https://spectrum.ieee.org/flash-of-brilliance-or-flash-in-the-pan', 'https://spectrum.ieee.org/magazine/2003/july/']
};
event.aspects.postdoc = {
  status: 'unresolved',
  note: '按 Yale 2002 年博士及 IEEE 2003 年 7 月报道判断，Roukes 曾在毕业后指导研究；报道没有说明 Tang 当时是否为博士后，不能作为博士后导师确证。',
  sources: ['https://physics.yale.edu/profile/hong-tang', 'https://spectrum.ieee.org/flash-of-brilliance-or-flash-in-the-pan', 'https://spectrum.ieee.org/magazine/2003/july/']
};
event.followup_required = true;
event.next_step = '寻找 Caltech 学位论文或校方学位档案确认博士导师和毕业时间，查 2003 年任职性质与博士后指导。';
fs.writeFileSync(path.join(__dirname, '本轮核查-HongTang-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
