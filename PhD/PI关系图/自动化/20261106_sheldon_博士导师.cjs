const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
for(const [id,unit] of [['6e75df77','UCI'],['5e02f271','TAMU']]){
 const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);
 if(!row) throw Error('缺少人工台账 '+id);
 const ev=JSON.parse(row.details_json);
 ev.audit_id='20261106_sheldon_cv_adviser_'+id;
 ev.aspects.phd={status:'confirmed_advisor',note:'本人 2022 年 CV 明确列 Berkeley 2010 化学博士 Ph.D. Adviser: Paul Alivisatos；两条校属记录为同一人。',sources:['https://www.chem.tamu.edu/rgroup/sheldon/Sheldon_full_CV_05132022.pdf','https://scholarconnect.uci.edu/msheldo1']};
 ev.aspects.postdoc={status:'group_or_candidate',note:'本人 CV 列 Caltech 博后 2010–2014 和 Harry Atwater，Atwater 组网页列 2012–2015，组属明确但年份存在差异，正式 advisor 职衔仍待核。',sources:['https://www.chem.tamu.edu/rgroup/sheldon/Sheldon_full_CV_05132022.pdf','https://atwater.caltech.edu/team-member/matthew-sheldon']};
 ev.followup_required=true;
 ev.next_step='核对本人 CV 和 Atwater 组页的博士后年份差异及正式导师职衔；确认现任职和跨校历史。';
 fs.writeFileSync(path.join(__dirname,'本轮核查-Sheldon-'+unit+'-20261106.json'),JSON.stringify(ev,null,2)+'\n','utf8');
}
