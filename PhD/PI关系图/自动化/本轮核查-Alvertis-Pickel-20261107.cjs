const fs = require('fs');
const path = require('path');
const {DatabaseSync} = require('node:sqlite');
const {spawnSync} = require('child_process');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), {readOnly:true});
const specs = [
  ['eea56a11', 'Berkeley Kavli 原始页面将其博士交流阶段的 Home Faculty Advisor 明确列为 Cambridge 的 Akshay Rao；既有 Cambridge 页面也记录 Alex Chin，本轮该页 403，保留历史记录，不冒称本轮重新核读。', ['https://kavli.berkeley.edu/antonios-alvertis', 'https://physics.utexas.edu/directory/antonios-alvertis'], '查 Cambridge 原论文或其他原始资料复核 Chin；区分 Neaton 博士访学 host 与后来的博后组属及正式导师。'],
  ['803f55a3', '本人 2025 年 CV 教育栏目将 2019 Berkeley 机械工程博士 Advisor 明确列为 Chris Dames，论文题目与原记录相符。', ['https://labsites.rochester.edu/pickel/wp-content/uploads/2025/06/pickel_andrea_CV_June_2025.pdf', 'https://me.utexas.edu/person/andrea-pickel/'], '继续查博士后经历及导师；履历没有列出博士后不等于能够断定从未有过。']
];
for (const [id,note,sources,next] of specs) {
  const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);
  if (!row) throw Error('缺少台账 '+id);
  const event=JSON.parse(row.details_json);
  event.audit_id='20261107_alvertis_pickel_primary_'+id;
  event.aspects.phd={status:'confirmed_advisor',note,sources};
  event.followup_required=true; event.next_step=next;
  const out=path.join(__dirname,'本轮核查-Alvertis-Pickel-'+id+'-20261107.json');
  fs.writeFileSync(out,JSON.stringify(event,null,2)+'\n');
  const result=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',out],{encoding:'utf8'});
  if(result.status!==0) throw Error(result.stderr);
  console.log(result.stdout.trim());
}
db.close();
