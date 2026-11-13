const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('199ec1d1');
if(!row)throw Error('缺少已有人工事件');const e=JSON.parse(row.details_json);
e.audit_id='20261106_199ec1d1_toronto_phd_supervisor';
e.aspects.phd={status:'confirmed_advisor',note:'Toronto ECE 博士答辩名单将 2018 年 6 月 22 日 Mengxia Liu 的量子点太阳能论文 Supervisor 列为 Prof. T. Sargent；MIT 同期简介列 Edward H. Sargent 组及相同研究题目，确认姓名与身份。',sources:['https://www.ece.utoronto.ca/graduates/oral-exams/','https://risingstars-eecs.mit.edu/participants/mengxia-liu/']};
e.followup_required=true;e.next_step='查 Cambridge 博后正式导师、是否在 Akshay Rao 组；现有论文合著仅为候选线索。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Mengxia-Liu-20261106.json'),JSON.stringify(e,null,2)+'\n','utf8');db.close();
