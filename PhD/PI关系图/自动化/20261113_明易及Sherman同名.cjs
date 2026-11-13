const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const items=[
 {id:'8d4dc6e7',audit:'pi_20261113_ming_yi_pku_identity',url:'https://sbms.bjmu.edu.cn/English/Faculty/PrincipalInvestigators/neurobiology/Ming_Yi.html',subject:'北京大学神经科学研究所 Ming Yi',evidence:'北大原档列其医学学位及 UCL 解剖学与发育生物学博士训练、神经科学研究；Rice 原档列 2014 Stanford 物理博士、凝聚态物理研究。两人学位单位、领域不符。'},
 {id:'8cbeb717',audit:'pi_20261113_sherman_uni_identity',url:'https://scholarworks.uni.edu/grp/4492/',subject:'北爱荷华大学健康与体育教育 2012 年硕士 Zachary Sherman',evidence:'北爱荷华大学原档为 2012 健康与体育教育硕士论文，UW 原档列本人 2013 Cornell 化工学士和 2019 MIT 化工博士，领域及学位时间不符。'},
 {id:'8cbeb717',audit:'pi_20261113_sherman_harvard_identity',url:'https://gis.harvard.edu/people/zachary-sherman',subject:'Harvard 地理信息研究助理 Zachary Sherman',evidence:'Harvard 原档列 2025 Virginia Tech 地理信息系统硕士；UW 原档列本人 2019 MIT 化工博士及 2019–2023 UT Austin 博后，身份与领域不符。'}
];
const current=new Map();
for(const x of items){const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(x.id);const page=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(x.id,x.url);if(!row||!page)throw Error('Missing review or page');const event=current.get(x.id)||JSON.parse(row.details_json);event.audit_id=x.audit;event.aspects.identity.note+=' 同名排除：'+x.evidence;if(!event.aspects.identity.sources.includes(x.url))event.aspects.identity.sources.push(x.url);event.followup_required=true;fs.writeFileSync(path.join(__dirname,x.audit+'.json'),JSON.stringify(event,null,2));current.set(x.id,event);x.page_id=page.id;}
fs.writeFileSync(path.join(__dirname,'20261113_明易及Sherman同名排除.json'),JSON.stringify(items.map(x=>({page_id:x.page_id,url:x.url,record_id:x.id,audit_id:x.audit,external_subject:x.subject,evidence:x.evidence})),null,2));db.close();
