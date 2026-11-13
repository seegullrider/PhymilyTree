const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const cv = 'https://physics.uconn.edu/wp-content/uploads/sites/2234/2017/10/CVHancock_20181110.pdf';
const bio = 'https://physics.uconn.edu/person/jason-hancock/';
for (const id of ['af41deb6', 'e926f20a']) {
  const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);
  if (!row) throw Error('缺少原台账 ' + id);
  const ev = JSON.parse(row.details_json);
  ev.audit_id = '20261106_hancock_full_cv_' + id;
  if (id === 'af41deb6') {
    ev.aspects.phd = {status:'confirmed_advisor', note:'本人完整 CV 明列 UCSC 2005 博士及 PhD advisor Zack Schlesinger。', sources:[cv]};
    ev.aspects.postdoc = {status:'confirmed_advisor', note:'本人 CV 在 Postdoctoral advisors 栏明列 Stanford Martin Greven 与 Geneva Dirk van der Marel；学校页与 CV 将 Geneva 2008–2012 职位列为 Maître assistant，须保留原称。', sources:[cv,bio]};
    ev.followup_required = false;
    ev.next_step = '已直接核实本人两阶段导师；若调查 Geneva 职位性质，保留 Maître assistant 原称。';
  } else {
    ev.aspects.phd.note = 'Schlesinger 本人博士导师仍待学位论文；Hancock 本人 CV 已明确称 Schlesinger 为其 PhD advisor。';
    ev.aspects.phd.sources = [...new Set([...ev.aspects.phd.sources,cv])];
    ev.followup_required = true;
    ev.next_step = '查 Schlesinger 本人的 Cornell 学位档案、IBM 经历及可能的博士后指导，不用合著替代导师证据。';
  }
  fs.writeFileSync(path.join(__dirname, '本轮核查-Hancock-Schlesinger-' + id + '.json'), JSON.stringify(ev,null,2)+'\n','utf8');
}
