const fs = require('fs');
const path = require('path');
const {DatabaseSync} = require('node:sqlite');
const {spawnSync} = require('child_process');
const root=path.resolve(__dirname,'..');
const source='https://cap.stanford.edu/profiles/viewCV?facultyId=63234&name=Tony_Heinz';
const changes=[
  ['师承关系索引.md','- [[人员 - UNC Chapel Hill - Joanna Atkin - eddcf6cb|Joanna Atkin]] → 博士阶段研究师长：','- [[人员 - UNC Chapel Hill - Joanna Atkin - eddcf6cb|Joanna Atkin]] → 博士导师：'],
  ['师承关系索引.md','- [[人员 - Cornell - Jie Shan - 95d0012e|Jie Shan]] → 博士研究师长：','- [[人员 - Cornell - Jie Shan - 95d0012e|Jie Shan]] → 博士导师：'],
  ['UNC Chapel Hill逐人复核记录.md','Tony F. Heinz（博士阶段研究师长）','Tony F. Heinz（博士导师；[本人履历]('+source+')）'],
  ['Cornell逐人复核记录.md','Tony F. Heinz（研究师长）','Tony F. Heinz（博士导师；[本人履历]('+source+')）']
];
for(const [file,before,after] of changes){const p=path.join(root,file),s=fs.readFileSync(p,'utf8');if(s.split(before).length!==2)throw Error('匹配不是恰好一次：'+file);let t=s.replace(before,after);if(file==='师承关系索引.md'){const line=t.split('\n').find(x=>x.startsWith(after));const corrected=line.replace(/。\[来源\].*$/, '。[Heinz 本人履历]('+source+')博士生栏列出姓名。');t=t.replace(line,corrected);}fs.writeFileSync(p,t,'utf8');}
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
for(const [id,name] of [['eddcf6cb','Joanna Atkin'],['95d0012e','Jie Shan']]){
 const e=JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id).details_json);
 e.audit_id='20261107_heinz_phd_'+id;e.aspects.phd={status:'confirmed_advisor',note:'Tony Heinz 本人履历在研究生与博士后受指导者下的博士生栏明确列 '+name+'，并以院系或研究所身份匹配。',sources:[source]};
 e.followup_required=true;e.next_step=id==='eddcf6cb'?'追查 Colorado 博士后正式指导关系与是否仍有 UNC 兼任；Heinz 混合名单不能单独确认其博后角色。':'查是否曾有博士后经历及指导者，并继续核实 Cornell 和 Max Planck 的实际任职与指导安排。';
 const p=path.join(__dirname,'本轮核查-Heinz博士生-'+id+'-20261107.json');fs.writeFileSync(p,JSON.stringify(e,null,2)+'\n');
 const r=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',p],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout.trim());
}
db.close();
