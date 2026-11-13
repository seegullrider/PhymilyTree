const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const old = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('8e46bc7f');
if (!old) throw Error('缺少原人工事件');
const audit = JSON.parse(old.details_json);
audit.audit_id = '20261108_fengyuan_yang_identity_thesis';
audit.aspects.identity = {status:'confirmed',note:'Ohio State 物理教师 2001 Johns Hopkins 物理博士、1992 USTC 学士；2014 JHU 材料学同名博士的 2006 和 2009 北京化工大学学历不同，不能合并。',sources:['https://physics.osu.edu/sites/default/files/2020-02/CV_Yang_2020.pdf','https://jscholarship.library.jhu.edu/bitstream/handle/1774.2/37884/YANG-DISSERTATION-2014.pdf']};
audit.aspects.affiliation = {status:'confirmed',note:'Ohio State 物理系本人页面及履历列该校物理系教授。',sources:['https://physics.osu.edu/people/yang.1006','https://physics.osu.edu/sites/default/files/2020-02/CV_Yang_2020.pdf']};
audit.aspects.research = {status:'confirmed',note:'Ohio State 物理系研究生手册列纳米结构材料、外延薄膜及自旋电子学研究。',sources:['https://physics.osu.edu/sites/physics.osu.edu/files/Physics_Graduate_Studies_program_%202012.pdf']};
audit.aspects.phd = {status:'group_or_candidate',note:'Johns Hopkins 2001 学位典礼名册列本人同名、物理与天文博士及磁输运论文题名，未列导师。第三方学术树检索索引将论文与 Chien 关联，但原网页本轮未能读取；Chien 组校友名单不分阶段，只记候选。',sources:['https://jscholarship.library.jhu.edu/bitstream/handle/1774.2/36843/commencement2001.pdf','https://academictree-staging.thetransmitter.org/physics/peopleinfo.php?pid=459948','https://sites.krieger.jhu.edu/chienlab/people/']};
audit.aspects.postdoc = {status:'confirmed_advisor',note:'Chien 组 Post-Doctoral Advisees 列 F. Y. Yang（Ohio State 教授）；本人 CV 将 2001–2003 任职列研究科学家并明确 Chien 为该职位 advisor。',sources:['https://sites.krieger.jhu.edu/chienlab/people/','https://physics.osu.edu/sites/default/files/2020-02/CV_Yang_2020.pdf']};
audit.followup_required = true;
audit.next_step = '寻找 2001 年磁输运博士论文审批页及正式导师字段；不要使用不同人的 2014 年材料学论文。';
const rel = [
 {event_id:'20261108_fengyuan_phd_candidate',record_id:'8e46bc7f',stage:'phd',mentor_filename:'人员 - Johns Hopkins - Chia-Ling Chien - a2e3b1d4',kind:'candidate',source_audit_id:audit.audit_id,evidence:'第三方学术树检索索引关联两人与 2001 年学位，原网页本轮未读取；组校友名单不分阶段，论文正式导师待核。',sources:['https://academictree-staging.thetransmitter.org/physics/peopleinfo.php?pid=459948','https://sites.krieger.jhu.edu/chienlab/people/']},
 {event_id:'20261108_fengyuan_postdoc_advisor',record_id:'8e46bc7f',stage:'postdoc',mentor_filename:'人员 - Johns Hopkins - Chia-Ling Chien - a2e3b1d4',kind:'advisor',source_audit_id:audit.audit_id,evidence:'实验室列其为博士后受指导者，CV 在 2001–2003 研究科学家职位下明确列 Chien 为 advisor。',sources:['https://sites.krieger.jhu.edu/chienlab/people/','https://physics.osu.edu/sites/default/files/2020-02/CV_Yang_2020.pdf']}
];
for (const [name,obj] of [['人工核查-20261108-FengyuanYang.json',audit],['结构化-20261108-FengyuanYang.json',rel]]) fs.writeFileSync(path.join(__dirname,name),JSON.stringify(obj,null,2)+'\n',{encoding:'utf8',flag:'wx'});
db.close();
