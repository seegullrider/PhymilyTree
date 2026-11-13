const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),{spawnSync}=require('child_process');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
for(const id of ['14edbfb6','7e6c00a9']){
 const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!row)throw Error('缺少台账 '+id);const e=JSON.parse(row.details_json);e.audit_id='20261107_ub_eth_reconcile_'+id;
 if(id==='14edbfb6'){
  e.aspects.phd={status:'confirmed_advisor',note:'Buffalo 校方采访称 Jesús M. Velázquez 于 2012 年获该校化学博士，并将 Sarbajit Banerjee 明确称作其 adviser；UC Davis 系页独立核对姓名、机构和学位年份。',sources:['https://ed.buffalo.edu/about.host.html/content/shared/university/news/ub-reporter-articles/stories/2022/01/qa-cen-talented-twelve.detail.html','https://chemistry.ucdavis.edu/people/jesus-velazquez']};
  e.next_step='追查 Caltech 博后正式导师；旧 Lewis 组关系保留，所载论文链接本次不可访问，暂不升级。';
 }else{
  e.aspects.affiliation={status:'confirmed',note:'本人 ETH CV 列 2024 年 12 月起 ETH Zürich 教授与 PSI 电池实验室主任；TAMU 材料系直接列 adjunct professor；化学目录高级教授条目与本人 CV 历史年份有差异，需复核兼职。',sources:['https://chab.ethz.ch/en/the-department/people/a-z/person-detail/_jcr_content/listinfo.person-pdf.310.pdf','https://engineering.tamu.edu/materials/profiles/sbanerjee.html','https://artsci.tamu.edu/chemistry/contact/profiles/sarbajit-banerjee.html']};
  e.next_step='核 TAMU 化学兼职及招生资格；ETH/PSI 与 TAMU 材料兼职分别保留。';
 }
 e.followup_required=true;const out=path.join(__dirname,'本轮核查-Velazquez-Banerjee-'+id+'-20261107.json');fs.writeFileSync(out,JSON.stringify(e,null,2)+'\n');const p=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',out],{encoding:'utf8'});if(p.status!==0)throw Error(p.stderr);console.log(p.stdout.trim());
}db.close();
