const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
for(const id of ['aecf7914','dd6cd959']){
 const ev=JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id).details_json);
 ev.audit_id='20261107_'+id+'_uiuc_groups';ev.followup_required=true;
 if(id==='aecf7914'){
  const dept='https://physics.illinois.edu/people/directory/profile/burkova',group='https://research.physics.illinois.edu/bezryadin/members.html';
  ev.aspects.identity={status:'confirmed',note:'物理系本人页与 Bezryadin 组成员页姓名及学校邮箱一致。',sources:[dept,group]};
  ev.aspects.affiliation={status:'confirmed',note:'物理系本人目录列 Teaching Assistant Professor，Bezryadin 组列 Research Associate；组属不代表博士后或导师关系，独立 PI 资格待核。',sources:[dept,group]};
  ev.aspects.research={status:'confirmed',note:'院系本人页记博士研究磁性多层膜，另从事超导器件、纳米电容等。',sources:[dept]};
  ev.aspects.phd={status:'group_or_candidate',note:'院系确认 2001 年 Far Eastern Federal University 凝聚态博士；Vorobyev 和 Chebotkevich 仅为同期同题合著候选，尚未证导师。',sources:[dept]};
  ev.aspects.postdoc={status:'unresolved',note:'未在本人系页或组页看到博士后经历；当前 Research Associate 职位不等于博士后。',sources:[dept,group]};
  ev.next_step='查俄文原始学位论文和机构档案、本人后续经历，核实导师与 PI 资格。';
 }else{
  const dept='https://physics.illinois.edu/people/directory/profile/fahad',alumni='https://sites.google.com/site/nparmitagegroup/home/people';
  ev.aspects.postdoc={status:'group_or_candidate',note:'UIUC 本人页列 2016–2019 年 Johns Hopkins Armitage 组博后；Armitage 组校友页亦列其博士后校友，未使用 advisor 或 supervisor。',sources:[dept,alumni]};
  ev.next_step='查本人 MIT 博士论文正式 advisor 和 Johns Hopkins 博后指导称谓；避免误用其他同名 Fahad Mahmood 的学位论文。';
 }
 fs.writeFileSync(path.join(__dirname,'本轮核查-'+id+'-20261107.json'),JSON.stringify(ev,null,2),'utf8');
}db.close();console.log('两条人工核查事件已准备');
