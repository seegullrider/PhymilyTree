const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('e5cb17a6');
const event = JSON.parse(row.details_json);
event.audit_id = '20261106_e5cb17a6_dissertation_locator';
event.aspects.phd = {
  status: 'group_or_candidate',
  note: '上海大学讲座简介记 2003 Berkeley 物理化学博士 studying under Alex Pines；Berkeley Lab 同期报道记 Moulé 在 Pines 实验室研究远程探测；Pines 论文参考文献第 25 条确认 Moulé 博士论文题目 Ex situ and remote detection nuclear magnetic resonance。尚未看到论文签署页，正式 advisor 仍待核。',
  sources: ['https://fpd.shu.edu.cn/info/1111/4101.htm', 'https://www2.lbl.gov/Science-Articles/Archive/MSD-remote-detection-MRI.html', 'https://pines.berkeley.edu/sites/default/files/publications/hyperpolarized_xenon_nmr_and_mri_signal_amplification_by_gas_extraction.pdf']
};
event.followup_required = true;
event.next_step = '按已定位论文题目查 Berkeley 学位论文原件或学校档案，确认正式博士导师；继续查 Cologne 博士后正式导师。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Moule-20261106.json'), JSON.stringify(event, null, 2) + '\n', 'utf8');
db.close();
