// 复用此前已核读的交流项目页面，记录访学师长，不改变博士论文导师。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('eea56a11');db.close();
const a=JSON.parse(row.details_json);a.audit_id='20261108_alvertis_neaton_visiting_host';
const extra='Berkeley Kavli 交流项目另列 Jeffrey Neaton 为博士阶段访学 Host Faculty Advisor；与 Cambridge 论文指导及后来的博士后组属分开。';
if(!a.aspects.phd.note.includes(extra))a.aspects.phd.note+='；'+extra;
a.next_step='查 Cambridge 博士论文及 Alex Chin 的原始指导记录；继续核 Neaton 博士后阶段的正式指导称谓。';a.followup_required=true;
const rel=[{event_id:'20261108_alvertis_neaton_visiting_host',record_id:'eea56a11',stage:'phd',mentor_filename:'人员 - UC Berkeley - Jeffrey Neaton - b768db8c',kind:'stage_mentor',source_audit_id:a.audit_id,evidence:'Berkeley Kavli 交流项目将 Cambridge 博士生 Antonios Alvertis 的 Berkeley 接待师长明确列为 Jeffrey Neaton（Host Faculty Advisor）；不是正式博士论文导师的证据。',sources:['https://kavli.berkeley.edu/antonios-alvertis']}];
fs.writeFileSync(path.join(__dirname,'人工-20261108-alvertis-访学师长.json'),JSON.stringify(a,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'结构化-20261108-alvertis-访学师长.json'),JSON.stringify(rel,null,2)+'\n');
console.log('已准备人工与结构化事件');
