const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
function latest(id) {const r=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!r)throw Error('缺少事件 '+id);return JSON.parse(r.details_json);}
const a=latest('9e8a4dc5');
a.audit_id='20261106_9e8a4dc5_plummer_candidate';
a.aspects.phd={status:'group_or_candidate',note:'1983 IEEE 日程标 Stanford IC Lab A. I. Akinwande 为学生，与 J. D. Plummer 合作；MIT 简介的全名、Stanford 博士及时间吻合。姓名缩写身份与正式论文导师未证，Plummer 仅为低可信候选。',sources:['https://www.ieeesisc.org/programs/1983_SISC_technical_program.pdf','https://cis.mit.edu/our-people/akintunde-akinwande']};
a.followup_required=true;a.next_step='查 Stanford 1986 学位论文档案或本人 CV，区分同名缩写并确认导师；继续查博士后经历。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Akintunde-Akinwande-20261106.json'),JSON.stringify(a,null,2)+'\n','utf8');
const b=latest('69fc41f5');
b.audit_id='20261106_69fc41f5_dunham_candidate';
b.aspects.phd={status:'group_or_candidate',note:'Scott Dunham 实验室论文清单列 Agarwal 的 BU 1994 博士论文和同期合著，姓名、年份、研究主题与 MIT 简介相符；清单亦收录 Dunham 本人论文，未写指导者，Dunham 仅为低可信候选。',sources:['https://dunham.ece.uw.edu/pubframe.html','https://mrl.mit.edu/PIs/Anu-Agarwal']};
b.followup_required=true;b.next_step='寻找 BU 1994 博士论文可读版本或导师本人正式指导名单，核实 Dunham 和博士后经历。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Anuradha-Agarwal-20261106.json'),JSON.stringify(b,null,2)+'\n','utf8');
db.close();
