const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const id='94e94c80',db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);db.close();if(!row)throw Error('无已有人工事件');
const group='https://www.tandfonline.com/doi/pdf/10.1080/00268976.2012.693254',cv='https://vivo.brown.edu/docs/r/rstratt_cv.pdf?dt=252110191';
const a=JSON.parse(row.details_json);a.audit_id='20261108_94e94c80_miller_group';a.aspects.phd={status:'group_or_candidate',note:'Miller 组校友名录列 Richard M. Stratt、1979；本人 Brown CV 列 Berkeley 化学博士、同年及统计力学方向一致。支持博士阶段课题组负责人关系，正式论文导师字段尚待查。',sources:[group,cv]};a.followup_required=true;a.next_step='查 Berkeley 博士论文的正式导师字段；查 Illinois 博士后原始组档案，不凭合著或学术树搜索摘要认定导师。';
fs.writeFileSync(path.join(__dirname,'人工-20261108-Stratt组名录.json'),JSON.stringify(a,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'结构化-20261108-Stratt组名录.json'),JSON.stringify([{event_id:'20261108_94e94c80_miller_group',record_id:id,stage:'phd',mentor_filename:'师承人物 - William H. Miller',kind:'group_leader',source_audit_id:a.audit_id,evidence:a.aspects.phd.note,sources:a.aspects.phd.sources}],null,2)+'\n');
console.log('已准备人工及结构化事件');
