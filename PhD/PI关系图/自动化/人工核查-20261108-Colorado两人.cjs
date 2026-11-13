const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
for(const id of ['3d527a4a','c0dfe20e']) {
 const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);
 const data=JSON.parse(row.details_json);
 data.audit_id='20261108_'+id+'_cv';
 if(id==='3d527a4a') {
  const url='https://www.colorado.edu/chbe/sites/default/files/attached-files/2023_05_gupta_cv.pdf';
  data.aspects.phd.note+=' 复读 2023 年本人 CV，亦明确列两人。';
  data.aspects.postdoc.note+=' 复读 2023 年 CV，仍为 mentor 表述。';
  for(const stage of ['phd','postdoc']) if(!data.aspects[stage].sources.includes(url)) data.aspects[stage].sources.push(url);
 } else {
  const url='https://experts.colorado.edu/vitas/165173.pdf';
  data.aspects.phd.note+=' 2026 年本人 CV 亦列 López 为博士 advisor。';
  data.aspects.postdoc.note+=' 2026 年本人 CV 分别列 Velev、Mitragotri，早期履历其他列名保留。';
  for(const stage of ['phd','postdoc']) if(!data.aspects[stage].sources.includes(url)) data.aspects[stage].sources.push(url);
 }
 fs.writeFileSync(path.join(__dirname,'人工核查-20261108-'+id+'.json'),JSON.stringify(data,null,2));
}
db.close();
