const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),id='5fe30699';
const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(!row)throw Error('缺少 Averitt 人工事件');
const a=JSON.parse(row.details_json),bio='https://www.airuniversity.af.edu/Portals/10/CSAT/documents/researchpapers/2007/bh2007_imwalle.pdf',thesis='https://mengkun.weebly.com/uploads/3/9/6/5/39652852/terahertz_time_domain_spectroscopy_of_high-tc_superconductors.pdf',tree='https://academictree-staging.thetransmitter.org/physics/inst.php?locid=8256';
a.audit_id='20261108_5fe30699_lanl_sources';a.aspects.postdoc={status:'group_or_candidate',note:'美国空军大学档案列 1999.02–2001.02 LANL 博后，未列导师；学术树列 Antoinette Taylor 候选。同期研究生论文提 Taylor 超快实验室与作者和 Averitt 共事，但未明确 Averitt 组属或指导，保留候选。',sources:[bio,thesis,tree]};a.next_step='查 Rice 博士论文与 LANL 博后正式指导；Halas 追忆文章本次 403 不重试。';a.followup_required=true;
fs.writeFileSync(path.join(__dirname,'人工-20261108-Averitt.json'),JSON.stringify(a,null,2)+'\n');
const rel=[{event_id:'20261108_5fe30699_taylor_candidate',record_id:id,stage:'postdoc',mentor_filename:'师承人物 - Antoinette J. Taylor',kind:'candidate',source_audit_id:a.audit_id,evidence:'学术树提出候选；同期论文提及 Taylor 超快实验室及与 Averitt 共事，但未明确其归属或指导关系；履历证 LANL 博后时间。',sources:[tree,thesis,bio]}];
fs.writeFileSync(path.join(__dirname,'结构化-20261108-Averitt.json'),JSON.stringify(rel,null,2)+'\n');db.close();
