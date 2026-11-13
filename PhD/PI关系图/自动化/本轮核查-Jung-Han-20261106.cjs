const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('8a17a122');
if(!row)throw Error('缺少已有人工事件');const e=JSON.parse(row.details_json);
e.audit_id='20261106_8a17a122_purdue_dissertation';
e.aspects.phd={status:'confirmed_advisor',note:'Purdue 的 Jung Han 电气工程博士论文档案 Advisors 栏明确列 Gunshor；同校 1989 半导体报告列 Robert L. Gunshor，姓名、院系和研究方向吻合。',sources:['https://docs.lib.purdue.edu/dissertations/AAI9301307/','https://docs.lib.purdue.edu/ecetr/651/']};
e.aspects.postdoc={status:'unresolved',note:'电化学学会获奖介绍记 Purdue 博士后研究，但未列导师或时间；本人履历列 1992–1994 visiting assistant professor 与 1994–1996 research scientist，职位如何对应待核。',sources:['https://www.electrochem.org/235/division-awards','https://ptacts.uspto.gov/ptacts/public-informations/petitions/1516796/download-documents?artifactId=xJu35cU_W-_MKgUa5a_aUsVm-ouzSVQIYVcCdnTWCgt4M1jxzp7n-0o']};
e.followup_required=true;e.next_step='追查 Purdue 博士后期间指导者及具体时间，并与同名教育学与食品科学研究者区分。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Jung-Han-20261106.json'),JSON.stringify(e,null,2)+'\n','utf8');db.close();
