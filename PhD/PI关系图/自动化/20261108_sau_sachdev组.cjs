const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),p=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('72a18dbd');db.close();
if(p?.audit_id!=='20261107_sau_ren_primary_72a18dbd')throw Error('最新事件已变化');
const a=JSON.parse(p.details_json);a.audit_id='20261108_sau_sachdev_postdoc_group';a.followup_required=true;
a.aspects.postdoc.note+=' Sachdev 本人 People 页的 Postdocs 名单另列 Jay Sau；未指定该名单关系的时间或正式 advisor 称谓。本人 CV 明确 Harvard 博后 advisor 为 Halperin，保留既有各阶段导师。';a.aspects.postdoc.sources=[...new Set([...a.aspects.postdoc.sources,'https://sachdev.physics.harvard.edu/people-all'])];
a.next_step+='；核实 Sachdev 组属的具体时间和性质，勿覆盖本人 CV 明列的 Halperin 博后 advisor。';
const f=path.join(__dirname,'人工-20261108-sau-sachdev组.json');fs.writeFileSync(f,JSON.stringify(a,null,2)+'\n','utf8');console.log(f);
