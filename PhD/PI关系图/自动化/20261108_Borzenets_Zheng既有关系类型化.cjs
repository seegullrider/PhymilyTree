// 本轮离线补证／分类，未重新读取外网。旧关系保留，不创建未经证实的导师。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const base=__dirname,db=new DatabaseSync(path.join(base,'检索队列.sqlite'),{readOnly:true});
const page=db.prepare("select p.excerpt from pages p join records r on r.id=p.record_id where r.id='c4599ead' and p.url=? and p.state='done'").get('https://scholars.duke.edu/person/gleb.finkelstein/teaching-mentoring');
if(!page||!/Supervised 13 PhD students/i.test(page.excerpt)||!/Ivan Borzenets \(2012\)/i.test(page.excerpt))throw Error('Duke 已读名单摘录缺少预期原文');
let a=JSON.parse(db.prepare("select details_json from manual_audit_events where record_id='75dd3b62' order by recorded_at desc,rowid desc limit 1").get().details_json);db.close();
if(a.aspects.phd.status!=='confirmed_advisor'||!a.aspects.phd.note.includes('Advisor Gleb Finkelstein'))throw Error('既有博士判断不匹配，停止');
a.audit_id='20261108_borzenets_duke_supervised';a.aspects.phd.note+=' Duke 导师主页另列 2012 年受指导博士生 Ivan Borzenets；该名单独立支持阶段师生关系，正式 advisor 称谓仍采用此前已核读的本人 CV。';a.aspects.phd.sources.push('https://scholars.duke.edu/person/gleb.finkelstein/teaching-mentoring');
fs.writeFileSync(path.join(base,'人工-20261108-Borzenets-Duke名录.json'),JSON.stringify(a,null,2)+'\n');
const cv='https://artsci.tamu.edu/physics-astronomy/_files/_documents/ivan-v-borzenets.pdf',duke='https://scholars.duke.edu/person/gleb.finkelstein/teaching-mentoring',sinica='https://www.phys.sinica.edu.tw/files/PHYS_CV_Borzenets_Graphene_Talk_Abstract_2025.pdf',soc='https://www.mep.tum.de/fileadmin/w00bvc/mep/pdf/_2021_Electrochem._Soc._Interface_30_62.pdf';
const rows=[
 {event_id:'20261108_borzenets_finkelstein_advisor',record_id:'75dd3b62',stage:'phd',mentor_filename:'人员 - Duke - Gleb Finkelstein - ff28a6b1',kind:'advisor',source_audit_id:a.audit_id,evidence:'此前本人 CV 明列 Duke PhD Advisor Gleb Finkelstein；Duke 导师主页独立列 2012 年受指导博士生 Ivan Borzenets。',sources:[cv,duke]},
 {event_id:'20261108_borzenets_tarucha_group',record_id:'75dd3b62',stage:'postdoc',mentor_filename:'师承人物 - Seigo Tarucha',kind:'group_leader',source_audit_id:a.audit_id,evidence:'此前已核读 Academia Sinica 讲座简介，称 Tokyo 博士后在 Tarucha 实验室；正式 postdoc advisor 职称待核。',sources:[sinica]},
 {event_id:'20261108_kentzheng_archer_advisor',record_id:'dd219114',stage:'phd',mentor_filename:'人员 - Cornell - Lynden A. Archer - 9fc56c92',kind:'advisor',source_audit_id:'20261105_dd219114_primary_v88',evidence:'此前已核读电化学学会 2021 简介，列 Jingxu (Kent) Zheng 的 Cornell 博士 supervisor Lynden Archer。',sources:[soc]},
 {event_id:'20261108_kentzheng_checkelsky_advisor',record_id:'dd219114',stage:'postdoc',mentor_filename:'人员 - MIT - Joseph Checkelsky - 7dbc10da',kind:'advisor',source_audit_id:'20261105_dd219114_primary_v88',evidence:'此前已核读电化学学会 2021 简介，称其 MIT 博士后 under supervision of Joseph Checkelsky。',sources:[soc]}
];fs.writeFileSync(path.join(base,'结构化-20261108-Borzenets-Zheng.json'),JSON.stringify(rows,null,2)+'\n');console.log('已准备一条补证人工事件和四条既有关系类型事件。');
