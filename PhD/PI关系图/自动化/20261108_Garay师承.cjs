const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),id='46190bdf';
const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(!row)throw Error('缺少 Garay 人工事件');
const a=JSON.parse(row.details_json),d='https://www.ucdavis.edu/news/materials-expert-wins-top-uc-davis-teaching-prize',r='https://engr.ucr.edu/media/2711/download';
a.audit_id='20261108_46190bdf_davis_ucr';a.aspects.phd={status:'confirmed_advisor',note:'UC Davis 报道称 Garay 博士与 Munir 工作；UCR 档案列 UC Davis 2004 年材料博士。具体论文 advisor 栏待核，按阶段研究师长标注。',sources:[d,r]};
a.aspects.postdoc={status:'unresolved',note:'UCR 档案列 2004 年博士及同年 7 月起任助理教授，不列博士后经历或导师；不能断定不存在。',sources:[r]};a.next_step='查博士论文正式导师字段和任何博士后经历。';a.followup_required=true;
fs.writeFileSync(path.join(__dirname,'人工-20261108-Garay.json'),JSON.stringify(a,null,2)+'\n');
const rel=[{event_id:'20261108_46190bdf_munir_stage',record_id:id,stage:'phd',mentor_filename:'师承人物 - Zuhair A. Munir',kind:'stage_mentor',source_audit_id:a.audit_id,evidence:'UC Davis 称 Garay 博士与 Munir 工作，UCR 档案确认 2004 年博士；正式 advisor 字段未核。',sources:[d,r]}];
fs.writeFileSync(path.join(__dirname,'结构化-20261108-Garay.json'),JSON.stringify(rel,null,2)+'\n');db.close();
