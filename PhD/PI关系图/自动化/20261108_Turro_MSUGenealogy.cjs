const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('61dc8433');
if (!row) throw Error('缺少人工台账');
const a = JSON.parse(row.details_json);
const msu = 'https://www2.chemistry.msu.edu/Genealogy/PID693.shtml';
const osu = 'https://chemistry.osu.edu/people/turro.1';
a.audit_id = '20261108_turro_msu_genealogy';
a.aspects.identity = {status:'confirmed',note:'Michigan State 化学系目录列 1992 博士 Claudia Turro，Ohio State 本人简介的学校、姓名、年份和两名研究师长一致。',sources:[msu,osu]};
a.aspects.affiliation = {status:'confirmed',note:'Ohio State 化学与生物化学系本人页面列教授及个人简介。',sources:[osu]};
a.aspects.research = {status:'confirmed',note:'本人页面研究概述列无机光化学、激发态过程和太阳能转化等方向。',sources:[osu]};
a.aspects.phd = {status:'confirmed_advisor',note:'Michigan State 化学系师承目录列 Claudia Turro PhD 1992 为 Nocera 受指导学生，also: Leroi；目录说明 also 表示 joint preceptors，即共同指导者。原论文签署页尚待核。',sources:[msu,osu]};
a.aspects.postdoc = {status:'group_or_candidate',note:'Ohio State 简介明确 1992–1995 在 Columbia 的博士后研究 with Nicholas J. Turro，支持阶段研究师长但未列正式岗位导师称谓。',sources:[osu]};
a.followup_required = true;
a.next_step = '查 Michigan State 博士论文签署页及 Columbia 博后任命中的正式称谓，并核对博士后年份。';
const rel = [
 {event_id:'20261108_turro_nocera_msu',record_id:'61dc8433',stage:'phd',mentor_filename:'师承人物 - Daniel G. Nocera',kind:'advisor',source_audit_id:a.audit_id,evidence:'MSU 化学系目录列其为 Nocera 指导的 1992 博士，also Leroi 表示共同指导者；论文签署页未读。',sources:[msu,osu]},
 {event_id:'20261108_turro_leroi_msu',record_id:'61dc8433',stage:'phd',mentor_filename:'师承人物 - George E. Leroi',kind:'advisor',source_audit_id:a.audit_id,evidence:'MSU 化学系目录对其 1992 博士条目标 also Leroi，页面释义为 joint preceptor；论文签署页未读。',sources:[msu,osu]},
 {event_id:'20261108_turro_nicholas_postdoc',record_id:'61dc8433',stage:'postdoc',mentor_filename:'师承人物 - Nicholas J. Turro',kind:'stage_mentor',source_audit_id:a.audit_id,evidence:'本人学校简介列 1992–1995 Columbia 博士后 with Nicholas J. Turro，正式导师称谓待核。',sources:[osu]}
];
for (const [name,obj] of [['人工核查-20261108-Turro-MSU.json',a],['结构化-20261108-Turro-MSU.json',rel]]) fs.writeFileSync(path.join(__dirname,name),JSON.stringify(obj,null,2)+'\n',{encoding:'utf8',flag:'wx'});
db.close();
