const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const id='96a07f96',url='https://siebelschool.illinois.edu/about/people/faculty/hanzhao',audit='pi_20261113_ucf_hanzhao_uiuc_identity';
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id),p=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(id,url);if(!row||!p)throw Error('Missing review or page');
const evidence='Illinois 原档列此 Han Zhao 为 2020 年 Carnegie Mellon 机器学习博士、2021 年起 Illinois 计算机系助理教授；UCF 原档列 2019 年 Penn 博士、2020–2024 年 UW 和 Caltech 博后、研究量子光子学。学位、任职及研究领域均不符。';
const e=JSON.parse(row.details_json);e.audit_id=audit;e.aspects.identity.note+=' 同名排除：'+evidence;if(!e.aspects.identity.sources.includes(url))e.aspects.identity.sources.push(url);e.followup_required=true;
fs.writeFileSync(path.join(__dirname,'20261113_HanZhao同名_人工.json'),JSON.stringify(e,null,2));
fs.writeFileSync(path.join(__dirname,'20261113_HanZhao同名_排除.json'),JSON.stringify([{page_id:p.id,url,record_id:id,audit_id:audit,external_subject:'Illinois 计算机与机器学习教师 Han Zhao',evidence}],null,2));db.close();
