const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
for (const id of ['61c3586b', 'c95af91e']) {
  const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);
  const event = JSON.parse(row.details_json);
  event.audit_id = `20261106_${id}_thesis_reread`;
  event.aspects.phd = {
    status: 'confirmed_advisor',
    note: '直接读取本人 Princeton 博士论文全文，封面写 Advisor: Ali Yazdani，致谢称其 my advisor。Yale 资料与论文年份为 2013，Yazdani CV 的前研究生名录写 2012，年份差异待核，不影响导师确认。',
    sources: ['https://www.academia.edu/145633125/Ordering_and_Superconductivity_Scanning_Tunneling_Spectroscopy_of_Unconventional_Superconductors', 'https://yazdanilab.princeton.edu/document/941', 'https://physics.yale.edu/profile/eduardo-higino-da-silva-neto']
  };
  event.followup_required = true;
  event.next_step = '追查 UBC 博后正式 supervisor 及 Keimer 课题组角色，并核对博士年份冲突；Yale 应用物理关联仍需现行院系资料。';
  fs.writeFileSync(path.join(__dirname, `本轮核查-SilvaNeto-${id}-20261106.json`), JSON.stringify(event, null, 2) + '\n', 'utf8');
}
db.close();
