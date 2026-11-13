const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),p=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('bb5b0777');db.close();
if(p?.audit_id!=='20261105_bb5b0777_primary')throw Error('最新事件已变化');
const a=JSON.parse(p.details_json);a.audit_id='20261108_kaul_duke_title_unverified';a.followup_required=true;
a.aspects.phd.note+=' 第三方搜索索引给出 Duke 博士论文可能题名 Interacting electrons and quenched randomness，页面账户停用无法读取原始条目，题名及拼写未核验，未列导师。';a.aspects.phd.sources=[...new Set([...a.aspects.phd.sources,'https://globethesis.com/?t=2440390005966003'])];a.next_step+='；用未验证的论文题名线索搜索 Duke 学位馆藏，核验作者、题名与导师，不按搜索索引确认。';
const f=path.join(__dirname,'人工-20261108-kaul论文线索.json');fs.writeFileSync(f,JSON.stringify(a,null,2)+'\n','utf8');console.log(f);
