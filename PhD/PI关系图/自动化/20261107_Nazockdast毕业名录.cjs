const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const ev=JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('637a1640').details_json);db.close();
const grad='https://www.gc.cuny.edu/sites/default/files/2021-06/49th_PhD_Commence_Prgm.pdf',school='https://www.ccny.cuny.edu/sites/default/files/engineering/upload/Annual_Report_2012-2013_FFF.pdf',allen='https://alleninstitute.org/person/ehssan-nazockdast';
ev.audit_id='20261107_637a1640_cuny_commencement';
ev.aspects.phd={status:'group_or_candidate',note:'CUNY 2013 年博士典礼册列本人及论文题目；CCNY 年报明确博士工作 under Jeffrey Morris。论文原文访问遇 429，未核读正式 advisor 字段，保留阶段研究师长。',sources:[grad,school]};
ev.aspects.postdoc={status:'group_or_candidate',note:'CCNY 年报明确 Courant 博士后 under Michael Shelley，Allen 履历将其与 NYU、Flatiron 阶段关联；正式 advisor 字段未单列。',sources:[school,allen]};
ev.followup_required=true;ev.next_step='ResearchGate 全站退避后或由 CUNY 其他原始馆藏直接读取博士论文 advisor 字段；核实 UNC 现有兼职与其余博后经历。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Nazockdast-20261107.json'),JSON.stringify(ev,null,2),'utf8');console.log('已准备 CUNY 学位目录核查事件');
