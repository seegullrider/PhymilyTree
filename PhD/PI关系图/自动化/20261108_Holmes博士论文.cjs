const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const id='7a32901f',db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);db.close();if(!row)throw Error('无既有事件');
const thesis='https://files01.core.ac.uk/download/pdf/13623509.pdf',group='https://www.umass.edu/polymer-science/crosby-research-group',duke='https://fitzpatrick.duke.edu/event/1657';
const a=JSON.parse(row.details_json);a.audit_id='20261108_7a32901f_umass_thesis';a.aspects.phd={status:'confirmed_advisor',note:'直接读取 2009 UMass 博士论文，摘要写 Directed by Professor Alfred J. Crosby，致谢称其 thesis advisor；签名页列 Crosby 为主席、Narayanan Menon 为成员。UMass 名录以 2009 博士和 BU 去向确认身份。',sources:[thesis,group]};a.followup_required=true;a.next_step='继续寻找 Princeton 博后本人履历或组档案，确认 Howard A. Stone 的正式指导角色；保留已确认博士导师。';
fs.writeFileSync(path.join(__dirname,'人工-20261108-Holmes博士论文.json'),JSON.stringify(a,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'结构化-20261108-Holmes博士论文.json'),JSON.stringify([{event_id:'20261108_7a32901f_crosby_advisor',record_id:id,stage:'phd',mentor_filename:'师承人物 - Alfred Crosby',kind:'advisor',source_audit_id:a.audit_id,evidence:a.aspects.phd.note,sources:a.aspects.phd.sources}],null,2)+'\n');console.log('事件已准备');
