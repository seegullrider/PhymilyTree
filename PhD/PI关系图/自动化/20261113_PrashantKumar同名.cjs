const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const id='a288fedf',url='https://www.upes.ac.in/faculty/school-of-advanced-engineering/applied-science/prashant-kumar',audit='pi_20261113_ntu_prashant_upes_identity';
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id),p=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(id,url);if(!row||!p)throw Error('Missing review or page');
const evidence='UPES 教师原档列同名者 2009 年 University of Hyderabad 博士、2012–2015 Purdue 博后；NTU 学校讲座及本人履历列本人物 2018 Minnesota 博士、2018–2023 Michigan 博后。博士单位、时间和博士后经历不符。';
const e=JSON.parse(row.details_json);e.audit_id=audit;e.aspects.identity.note+=' 同名排除：'+evidence;if(!e.aspects.identity.sources.includes(url))e.aspects.identity.sources.push(url);e.followup_required=true;
fs.writeFileSync(path.join(__dirname,'20261113_PrashantKumar同名_人工.json'),JSON.stringify(e,null,2));fs.writeFileSync(path.join(__dirname,'20261113_PrashantKumar同名_排除.json'),JSON.stringify([{page_id:p.id,url,record_id:id,audit_id:audit,external_subject:'UPES 量子材料教师 Prashant Kumar（Hyderabad 2009 博士）',evidence}],null,2));db.close();
