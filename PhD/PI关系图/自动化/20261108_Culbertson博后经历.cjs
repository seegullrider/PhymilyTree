const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('e264961e');db.close();
if(!row)throw Error('未找到已有人工核查事件');
const a=JSON.parse(row.details_json);a.audit_id='20261108_e264961e_bell_postdoc';
a.aspects.postdoc={status:'unresolved',note:'ASU 本人工作履历明确 1979 年 9 月至 1981 年 7 月为 AT&T Bell Laboratories 博士后技术人员，未指明个人导师或课题组负责人。',sources:['https://search.asu.edu/profile/84471']};
a.followup_required=true;a.next_step='查 Penn State 1979 物理博士论文、Bell Labs 1979–1981 年项目与本人履历，分别确定博士和博士后导师；不可由同事合著推断。';
fs.writeFileSync(path.join(__dirname,'人工-20261108-Culbertson博后经历.json'),JSON.stringify(a,null,2)+'\n');
console.log('已准备追加式人工事件');
