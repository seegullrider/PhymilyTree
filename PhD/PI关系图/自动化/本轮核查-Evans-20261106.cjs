const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('5586b23e');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_5586b23e_acs_biography';
event.aspects.phd = {
  status: 'confirmed_advisor',
  note: '美国化学会南加州分会 2015 获奖简介明确 UCLA 博士 under the direction of M. Frederick Hawthorne，并列 UCI 化学及稀土研究核对身份。',
  sources: ['https://scalacs.org/magazine/2015-05.pdf']
};
event.aspects.postdoc = {
  status: 'group_or_candidate',
  note: '同一 ACS 简介明确 Cornell 博士后研究 with Earl L. Muetterties；正式 advisor 职衔仍待可直接读取的一手资料。',
  sources: ['https://scalacs.org/magazine/2015-05.pdf']
};
event.followup_required = true;
event.next_step = '查可直接读取的 UCI 获奖报道或本人 CV，核实 Muetterties 正式博士后导师职衔。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Evans-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
