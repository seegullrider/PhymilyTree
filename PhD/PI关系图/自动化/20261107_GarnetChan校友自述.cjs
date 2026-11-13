const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const ev=JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('9a4a4057').details_json);db.close();
const cam='https://www.ch.cam.ac.uk/news/cambridge-chemistry-alumni-elected-fellows-royal-society-2026',cal='https://qse.caltech.edu/qse-research-groups/garnet-chan';
ev.audit_id='20261107_9a4a4057_cambridge_personal';
ev.aspects.identity={status:'confirmed',note:'Cambridge 系所报道明确 Garnet Kin-Lic Chan 为 Caltech Bren Professor，与既有 Caltech 人物及多体计算方向一致。',sources:[cam,cal]};
ev.aspects.phd={status:'confirmed_advisor',note:'Cambridge 化学系报道载 Chan 本人回忆 1996 年开始博士研究时 under the guidance of Nicholas Handy；确认为博士研究指导，正式学位签署角色另待学位档案。',sources:[cam]};
ev.aspects.postdoc={status:'unresolved',note:'Cambridge 官方介绍列 Christ’s College 与 UC Berkeley 博士后 fellowship，但未命名个人指导者，不能推定。',sources:[cam]};
ev.followup_required=true;ev.next_step='查 Cambridge 博士学位档案正式签署角色，分别追查 Cambridge 与 Berkeley 博士后指导者。';
fs.writeFileSync(path.join(__dirname,'本轮核查-GarnetChan-20261107.json'),JSON.stringify(ev,null,2),'utf8');console.log('已准备 Chan 博士研究指导事件');
