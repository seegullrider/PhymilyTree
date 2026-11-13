const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const e=JSON.parse(db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('cd12c234').details_json);db.close();
e.audit_id='20261113_cd12c234_notredame';e.aspects.identity.note+=' Notre Dame 政治学博士生为同名不同人，其研究方向和履历与 Rutgers 化学教授不符。';e.aspects.identity.sources.push('https://politicalscience.nd.edu/people/jing-li/');
fs.writeFileSync(path.join(__dirname,'20261113_JingLi身份复核_人工.json'),JSON.stringify(e,null,2));
