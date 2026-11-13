const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),p=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('70c0251a');db.close();
if(p?.audit_id!=='20261105_70c0251a_primary')throw Error('最新事件已变化');
const a=JSON.parse(p.details_json);a.audit_id='20261108_bulchandani_sondhi_candidate';
a.aspects.postdoc={status:'group_or_candidate',note:'Sondhi 本人 Princeton 页面将 Vir Bulchandani（PCTS）列在曾有合作或指导接触的博士后混合名单；Rice 本人页确认 2020–2023 PCTS 博后。名单未区分合作及指导，不能确认课题组或正式导师，仅保留候选。',sources:['https://sondhi.scholar.princeton.edu/research-supervision','https://profiles.rice.edu/faculty/vir-b-bulchandani']};
a.followup_required=true;a.next_step='查 2020–2023 Princeton 博后职位、个人 CV 与课题组原文，区分 Sondhi 的合作和指导关系，不由混合名单推断正式导师。';
const f=path.join(__dirname,'人工-20261108-bulchandani候选.json');fs.writeFileSync(f,JSON.stringify(a,null,2)+'\n','utf8');console.log(f);
