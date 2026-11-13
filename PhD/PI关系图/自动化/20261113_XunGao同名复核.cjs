const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));const e=JSON.parse(db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('ee2c0ec6').details_json);db.close();
e.audit_id='20261113_ee2c0ec6_syracuse';e.aspects.identity.note+=' Syracuse 2010 计算机科学博士论文作者为同名不同人；Harvard 量子光学本人档记 2018 清华博士。';e.aspects.identity.sources.push('https://surface.syr.edu/eecs_etd/294/','https://mphq.physics.harvard.edu/people/xun-gao-0');
fs.writeFileSync(path.join(__dirname,'20261113_XunGao同名复核_人工.json'),JSON.stringify(e,null,2));
