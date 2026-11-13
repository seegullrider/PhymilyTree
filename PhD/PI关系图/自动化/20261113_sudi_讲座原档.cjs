const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('95701d41');if(!row)throw Error('Missing review');
const event=JSON.parse(row.details_json),url='https://legacy.phys.ufl.edu/colloquium/';event.audit_id='pi_20261113_sudi_uf_colloquium';
for(const stage of ['phd','postdoc']){event.aspects[stage].note+=' UF 2026 年 1 月讲座简介将其博士列为 Stanford Shen 组、Berkeley 博后与 Feng Wang 合作；讲座简介是阶段补证，导师称谓沿用 Stanford 目录和 Kavli 项目原档。';if(!event.aspects[stage].sources.includes(url))event.aspects[stage].sources.push(url);}
event.followup_required=true;event.next_step='博士导师和博后 fellowship 指导已由原档确认；继续核博士论文全文及项目外任用。';fs.writeFileSync(path.join(__dirname,'20261113_sudi_讲座原档.json'),JSON.stringify(event,null,2));db.close();
