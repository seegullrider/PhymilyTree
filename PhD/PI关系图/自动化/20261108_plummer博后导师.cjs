const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const prev=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('bc7d318e');db.close();
if(prev?.audit_id!=='20261108_bc7d318e_sourcecheck')throw Error('最新事件已变化，须重读后再记录');
const a=JSON.parse(prev.details_json);a.audit_id='20261108_plummer_princeton_postdoc_adviser';
a.aspects.postdoc={status:'confirmed_advisor',note:'Princeton 生物物理中心本人页标 Postdoctoral Research Associate 并明确列 Adviser Andrej Košmrlj；导师中心页反向列 Plummer 为 advisee。Datta 与 Brun 仍仅为合作／导师候选。',sources:['https://biophysics.princeton.edu/people/abigail-plummer','https://biophysics.princeton.edu/people/andrej-kosmrlj','https://www.princeton.edu/~akosmrlj/kosmrlj_cv.pdf','https://www.bu.edu/eng/2024/04/18/bu-mechanical-engineering-welcomes-new-faculty-members/']};
a.followup_required=true;a.next_step='继续核查 Datta、Brun 的具体博士后指导角色；Princeton 页面 Adviser 仅对应 Košmrlj，不能由共同工作推断其他正式导师。';
const out=path.join(__dirname,'人工-20261108-plummer博后导师.json');fs.writeFileSync(out,JSON.stringify(a,null,2)+'\n','utf8');console.log(out);
