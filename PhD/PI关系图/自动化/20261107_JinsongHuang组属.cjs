const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const ev=JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('1218078d').details_json);db.close();
const paper='https://nuengr.unl.edu/academicunits/mechanical-materials/research/labs-facilities/OrganicElectronics-Nanoelectronics/Articles/Previous%20Articles/P18%20Manipulating%20regioregular%20poly.pdf',profile='https://tarheels.live/huanglab/pi/';
ev.audit_id='20261107_1218078d_biography_primary';ev.aspects.phd={status:'group_or_candidate',note:'本人 2007 论文作者简介明确称其从 2003 年起为 UCLA Yang Yang 组博士生，UNC 本人履历确认 2007 UCLA 材料博士；确证组属，正式论文导师待核。',sources:[paper,profile]};
ev.followup_required=true;ev.next_step='查 UCLA 博士论文正式 advisor；2007–2009 Agilent 岗位未称博士后，须独立核实。';
fs.writeFileSync(path.join(__dirname,'本轮核查-JinsongHuang-20261107.json'),JSON.stringify(ev,null,2),'utf8');console.log('已准备 Jinsong Huang 组属核查事件');
