const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));const e=JSON.parse(db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('b243e3e6').details_json);db.close();
e.audit_id='20261113_b243e3e6_meyer_group';e.aspects.phd.note+=' Meyer 本人 Duke 低温组档将 Robert P. Behringer 列在 Ph.D. Students，个人条目为 1975 年博士，与讣告指导描述相符；正式论文导师字段仍待核。';e.aspects.phd.sources.push('https://webhome.phy.duke.edu/~hm/LTM/ltm.html');
fs.writeFileSync(path.join(__dirname,'20261113_Behringer组档复核_人工.json'),JSON.stringify(e,null,2));
