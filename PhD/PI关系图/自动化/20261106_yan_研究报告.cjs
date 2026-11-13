const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('12155879');
if(!row)throw Error('缺少原台账');
const ev=JSON.parse(row.details_json),url='https://www.osti.gov/servlets/purl/1092761';
ev.audit_id='20261106_yan_dravid_report_12155879';
ev.aspects.phd={status:'group_or_candidate',note:'Dravid 的 2010 DOE 进度报告列其为项目支持的博士三年级学生，Dravid CV 列 2013 年博士；组属可信，报告未列正式论文导师。',sources:[url,'https://vpd.ms.northwestern.edu/documents/dravid_cv-5-25-20.pdf']};
ev.followup_required=true;ev.next_step='查 Northwestern 学位论文及 Berkeley 博后原始履历，核对两阶段正式指导称谓。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Aiming-Yan-20261106.json'),JSON.stringify(ev,null,2)+'\n','utf8');
