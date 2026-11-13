const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),out=[];
for(const id of ['96c6c9ff','24542bbd']){
 const prev=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);
 if(prev?.audit_id!==`20261105_sels_${id}`)throw Error('最新事件已变：'+id);
 const a=JSON.parse(prev.details_json);a.audit_id=`20261108_sels_${id}_bu_postdoc`;
 a.aspects.postdoc={status:'group_or_candidate',note:'Polkovnikov 本人 BU 履历 Postdoctoral Fellows 栏列 D. Sels 2015–2017；Sels BU 页面确认其 BU 博后，2017 论文核对全名、同期与单位，支持 Polkovnikov 课题组关系，正式 advisor 待核。Harvard 报道另称 Sels 是 Demler 的博士后。',sources:['https://www.bu.edu/physics/files/2021/05/Polkovnikov_CV.pdf','https://www.bu.edu/physics/profile/dries-sels/','https://pmc.ncbi.nlm.nih.gov/articles/PMC5441767/','https://news.harvard.edu/gazette/story/2020/07/harvard-researchers-create-hybrid-algorithm-for-nmr-readings/']};
 a.followup_required=true;a.next_step='查 BU 博后 appointment 或本人履历的正式 advisor 字段；核实两个博士后阶段的正式指导称谓及 Demler 当前任职。';
 const f=path.join(__dirname,`人工-20261108-sels-${id}.json`);fs.writeFileSync(f,JSON.stringify(a,null,2)+'\n','utf8');out.push(f);
}db.close();console.log(JSON.stringify(out));
