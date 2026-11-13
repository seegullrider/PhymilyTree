const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('dfca11b5');if(!row)throw Error('缺少原台账');
const ev=JSON.parse(row.details_json);ev.audit_id='20261106_makri_harvard_fellow_dfca11b5';
ev.aspects.postdoc={status:'unresolved',note:'Illinois 1992 化学通讯明确 Harvard Junior Fellow 为博士后 fellowship，但不命名导师；Harvard 名录记 1989–1992，本人 CV 任职栏记 1989–1991、奖项栏记 1989–1992，年份冲突需复核。',sources:['https://scs.illinois.edu/system/files/inline-files/SCS%201992%20Newsletter%20-%20O_0.pdf','https://socfell.fas.harvard.edu/past-junior-fellows-chemistry','https://chemistry.illinois.edu/sites/default/files/cv/cv.pdf']};
ev.followup_required=true;ev.next_step='查 Berkeley 博士论文正式导师及 Harvard 博后研究师长，核对 fellowship 结束日期。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Nancy-Makri-20261106.json'),JSON.stringify(ev,null,2)+'\n','utf8');
