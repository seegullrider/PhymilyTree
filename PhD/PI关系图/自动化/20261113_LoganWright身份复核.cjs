const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));const e=JSON.parse(db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('fa520ffb').details_json);db.close();
e.audit_id='20261113_fa520ffb_uscc';e.aspects.identity.note+=' USCC 证人资料中的 Logan Wright 是 George Washington 政经博士、研究中国市场，非 Cornell 应用物理博士及 Yale 教师。';e.aspects.identity.sources.push('https://www.uscc.gov/sites/default/files/2023-08/Logan_Wright_Bio.pdf');
fs.writeFileSync(path.join(__dirname,'20261113_LoganWright身份复核_人工.json'),JSON.stringify(e,null,2));
