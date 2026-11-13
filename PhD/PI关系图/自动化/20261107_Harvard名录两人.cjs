const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const query = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const source = 'https://www.physics.harvard.edu/academics/phds1971-2000';
const cases = [
  {id:'2b43ee19', name:'KathrynLevin', note:'Harvard 物理系博士论文名录明言标题后为论文导师，1971 年 Kathryn Joann Liebermann Levin 条目列 Ehrenreich；本人 Chicago 页及 Rice 会议简介交叉核对身份。', extra:['https://physics.uchicago.edu/people/profile/kathryn-levin/','https://s3-us-west-2.amazonaws.com/files30.webconnex.com/uploads/wysiwyg/54138/files/RCQM%202016%20Fall%20Workshop%20Program_V8.pdf'], next:'查 Rochester 博后 Parks 的正式指导角色和 UC Irvine 博后师长。'},
  {id:'1e06fc8c', name:'CharlieJohnson', note:'Harvard 物理系博士论文名录的 Alan Thornton Johnson Jr. 条目在 1990 年论文后明确列 Tinkham 为导师；论文题目和教育经历支持匹配。', extra:['https://curf.upenn.edu/profile/charlie-johnson'], next:'查 Delft 和 NIST 博后导师及其直接来源。'}
];
for (const c of cases) {
  const row = query.get(c.id); if (!row) throw new Error('原事件不存在: '+c.id);
  const ev = JSON.parse(row.details_json);
  ev.audit_id = '20261107_'+c.id+'_harvard_thesis';
  ev.aspects.phd = {status:'confirmed_advisor',note:c.note,sources:[source,...c.extra]};
  ev.followup_required = true; ev.next_step = c.next;
  fs.writeFileSync(path.join(__dirname,'本轮核查-'+c.name+'-20261107.json'), JSON.stringify(ev,null,2),'utf8');
}
db.close();
console.log('已准备两人 Harvard 学位名录核查事件');
