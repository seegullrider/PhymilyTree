const fs = require('node:fs');
const path = require('node:path');
const cvGupta = 'https://www.colorado.edu/chbe/sites/default/files/attached-files/2023_05_gupta_cv.pdf';
const cvShields = 'https://experts.colorado.edu/vitas/165173.pdf';
const cvShields2017 = 'https://cbe.ncsu.edu/wp-content/uploads/sites/8/2017/02/C.-Wyatt-Shields-IV-Curriculum-Vitae-August-2017.pdf';
const cvShields2016 = 'https://cbe.ncsu.edu/wp-content/uploads/sites/8/2017/02/shields.pdf';
const rows = [
 ['3d527a4a','phd','人员 - MIT - Patrick S. Doyle - 4d4631e7','advisor','本人 2023 年 CV 的 MIT 博士论文 adviser 明列 Doyle 和 Hatton。',[cvGupta]],
 ['3d527a4a','phd','师承人物 - T. Alan Hatton','advisor','本人 2023 年 CV 的 MIT 博士论文 adviser 明列 Doyle 和 Hatton。',[cvGupta]],
 ['3d527a4a','postdoc','人员 - Princeton - Howard A. Stone - 419add8c','stage_mentor','本人 CV 将 Princeton 博士后条目的 Stone 称为 mentor；正式职衔继续核查。',[cvGupta]],
 ['c0dfe20e','phd','师承人物 - Gabriel P. López','advisor','本人 2026 年 CV 的 Duke 生物医学工程博士条目明列 López 为 advisor。',[cvShields]],
 ['c0dfe20e','phd','师承人物 - Benjamin B. Yellen','stage_mentor','本人 2017 年 CV 在推荐人一栏称 Yellen 为 doctoral mentor；论文正式职衔未明。',[cvShields2017]],
 ['c0dfe20e','postdoc','师承人物 - Orlin D. Velev','advisor','本人 2017 年 CV 将 Duke 与 NC State 联合博士后条目的 Velev 列为 advisor；2026 年 CV 亦列 NC State 博后 advisor。',[cvShields2017,cvShields]],
 ['c0dfe20e','postdoc','人员 - Duke - Stefan Zauscher - f5ba3a09','advisor','本人 2017 年 CV 将联合博士后条目的 Zauscher 列为 advisor；2026 年 CV 未再列名。',[cvShields2017,cvShields]],
 ['c0dfe20e','postdoc','师承人物 - Gabriel P. López','advisor','本人 2016 年 CV 将联合博士后条目的 López 列为 advisor；2017 和 2026 年版本未在相应条目列名，差异待查。',[cvShields2016,cvShields2017,cvShields]],
 ['c0dfe20e','postdoc','师承人物 - Samir Mitragotri','advisor','本人 2026 年 CV 明列 Harvard 生物工程博士后 advisor Mitragotri。',[cvShields]],
];
const events = rows.map(([record_id,stage,mentor_filename,kind,evidence,sources], i) => ({
 event_id:`20261108_colorado_type_${i+1}`,
 record_id,stage,mentor_filename,kind,
 source_audit_id:record_id==='3d527a4a'?'20261105_3d527a4a_primary':'20261105_c0dfe20e_primary',
 evidence,sources
}));
fs.writeFileSync(path.join(__dirname,'人工类型化-20261108-Colorado两人.json'),JSON.stringify(events,null,2));
