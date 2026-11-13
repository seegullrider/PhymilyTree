const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const source='https://vivo.brown.edu/display/jxu1';
for(const [id,file] of [['a1365cca','Xu'],['c2879202','Sargent']]){
 const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(!row)throw Error('无原人工事件 '+id);
 const a=JSON.parse(row.details_json);a.audit_id=`20261108_${id}_xusargent_identity`;
 if(id==='a1365cca'){
  a.aspects.identity={status:'confirmed',note:'Brown 官方页标题 Jingming Xu、正文 Jimmy Xu，并列 Brown 与此前 Toronto 任职；校属人物与原师承扩展节点为同一人。',sources:[source]};
  a.next_step='继续查 Minnesota 博士论文验证 Michael Shur 候选及博士后经历；Sargent 原导师目录与论文尚需重读。';
 }else{
  a.aspects.identity.note+=' Brown 官方页确认博士导师旧节点 Jingming Xu 与 Brown 校属 Jimmy Xu 为同一人。';
  if(!a.aspects.identity.sources.includes(source))a.aspects.identity.sources.push(source);
  a.next_step='查 Toronto 博士论文原文及导师字段，复核旧 Jimmy Xu 导师记录；查本人博士后经历。';
 }
 a.followup_required=true;fs.writeFileSync(path.join(__dirname,`人工-20261108-${file}身份对账.json`),JSON.stringify(a,null,2)+'\n');
}
db.close();console.log('已准备两条身份对账事件');
