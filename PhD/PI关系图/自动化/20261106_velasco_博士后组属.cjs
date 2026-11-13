const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('52b1ad60');if(!row)throw Error('缺少原台账');
const ev=JSON.parse(row.details_json);ev.audit_id='20261106_velasco_crommie_group_52b1ad60';
ev.aspects.postdoc={status:'group_or_candidate',note:'Berkeley Crommie 组成员表列 Jairo Velasco Jr.（UCSC）为前博士后；本人 CV 列 2012–2015 Berkeley 博后 host Crommie。组属高可信，正式 advisor 职衔待查。',sources:['https://physics.berkeley.edu/research-faculty/crommie-group/members','https://bpb-us-e1.wpmucdn.com/sites.ucsc.edu/dist/5/235/files/2025/01/Full-CV-01-06-25.pdf']};
ev.followup_required=true;ev.next_step='查正式博士后导师或 supervisor 称谓。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Jairo-Velasco-20261106.json'),JSON.stringify(ev,null,2)+'\n','utf8');
