const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('ef0ab105');
if(!row)throw Error('缺少已有人工事件');const e=JSON.parse(row.details_json);
e.audit_id='20261106_ef0ab105_personal_cv_advisor';
e.aspects.phd={status:'confirmed_advisor',note:'本人 Yale 托管 CV 在 2020 年 Penn 物理与天文博士条目明确列 Advisor: Dani S. Bassett，并列论文题目。',sources:['https://lynnlab.yale.edu/sites/default/files/files/Lynn_CV.pdf','https://lynnlab.yale.edu/sites/default/files/files/Lynn_CV%285%29.pdf']};
e.aspects.postdoc={status:'group_or_candidate',note:'本人 CV 的 Princeton/CUNY 博后条目称与 William Bialek、Stephanie E. Palmer 和 David J. Schwab 共事，但未逐人称 advisor；保留博士后合作关系。',sources:['https://lynnlab.yale.edu/sites/default/files/files/Lynn_CV.pdf','https://physics.yale.edu/profile/christopher-lynn']};
e.followup_required=true;e.next_step='追查 Princeton/CUNY 博后正式指导职衔；本人 CV 的 with 不单独推定正式导师。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Christopher-Lynn-20261106.json'),JSON.stringify(e,null,2)+'\n','utf8');db.close();
