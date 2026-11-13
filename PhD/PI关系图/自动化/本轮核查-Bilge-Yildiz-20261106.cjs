const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('05036d8b');
if(!row)throw Error('缺少人工事件');const e=JSON.parse(row.details_json);
e.audit_id='20261106_05036d8b_golay_candidate';
e.aspects.phd={status:'group_or_candidate',note:'维基百科列 Michael W. Golay 为博士导师；MIT 博士论文目录索引提示一致，但原始目录本轮返回 405，保留候选不能确证。',sources:['https://en.wikipedia.org/wiki/Bilge_Y%C4%B1ld%C4%B1z','https://dspace.mit.edu/entities/publication/d3e81b44-36ca-4b2c-bff2-98337cc08535']};
e.aspects.postdoc={status:'unresolved',note:'MIT 材料系简介说明 2003 年博士毕业后在 MIT 做电化学博士后，未列导师。',sources:['https://dmse.mit.edu/people/faculty/bilge-yildiz/']};
e.followup_required=true;e.next_step='MIT 博士论文目录返回 405，退避后读取原始导师栏或博士论文；另查 MIT 电化学博后导师。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Bilge-Yildiz-20261106.json'),JSON.stringify(e,null,2)+'\n','utf8');db.close();
