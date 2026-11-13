const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const dir=__dirname,db=new DatabaseSync(path.join(dir,'检索队列.sqlite'));
const cases=[
 {id:'c491b104',aid:'20261113_c491b104_same_name',extra:'Minnesota Xiang Cheng 为 2009 Chicago 物理博士；Duke 和 Simons 页面为 2020 Berkeley EECS 博士的同名计算机科学家，二者不同。',urls:['https://cse.umn.edu/cems/xiang-cheng','https://ece.duke.edu/people/xiang-cheng/','https://live-simons-institute.pantheon.berkeley.edu/people/xiang-cheng'],next:'保留原已核师承，避免将 Duke 同名者的 Bartlett、Jordan 导师误归于 Minnesota 人物。'},
 {id:'22912962',aid:'20261113_22912962_same_name',extra:'Michigan Ross 页所列 2028 届 MBA 学生从事产品与运营；Cornell Karan Kartik Mehta 为 2017 MIT EECS 博士和量子光子学教授，两者履历不符。',urls:['https://michiganross.umich.edu/ambassadors/karan-mehta','https://www.duffield.cornell.edu/people/karan-mehta/'],next:'继续查 ETH 博士后正式导师；Georgia Tech 同名线索仍需原档。'}
];
for(const c of cases){const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(c.id);const e=JSON.parse(row.details_json);e.audit_id=c.aid;e.aspects.identity.note+=' '+c.extra;e.aspects.identity.sources=[...new Set([...e.aspects.identity.sources,...c.urls])];e.next_step=c.next;e.followup_required=true;fs.writeFileSync(path.join(dir,`20261113_${c.id}_同名人工.json`),JSON.stringify(e,null,2));}db.close();
