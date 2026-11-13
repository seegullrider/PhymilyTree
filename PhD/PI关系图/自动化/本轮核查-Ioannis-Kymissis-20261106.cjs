const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('c22f61aa');if(!row)throw Error('缺少已有人工事件');const e=JSON.parse(row.details_json);
const cv='https://ptacts.uspto.gov/ptacts/public-informations/petitions/1554114/download-documents?artifactId=k0dww3gHytUqWqPhoXe6OW-5uliEHcZxmcV65FjKMAmv-JmrGw97bkI';
e.audit_id='20261106_c22f61aa_uspto_personal_cv';
e.aspects.phd={status:'confirmed_advisor',note:'本人 CV 在 MIT 2003 博士教育条目明确列 Advisor Prof. Akintunde I. Akinwande 与论文题目。',sources:[cv]};
e.aspects.postdoc={status:'confirmed_advisor',note:'本人 CV 在 MIT 2003–2006 Postdoctoral Associate 条目明确列 Advisor Vladimir Bulovic。',sources:[cv]};
e.followup_required=false;e.next_step='后续增量核查其他可能的共同指导者及任职变化。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Ioannis-Kymissis-20261106.json'),JSON.stringify(e,null,2)+'\n','utf8');db.close();
