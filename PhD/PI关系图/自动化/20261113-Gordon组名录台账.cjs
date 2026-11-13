const fs=require('fs');
const {DatabaseSync}=require('node:sqlite');
const path=require('path');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const items=[['2d7fdf59','Rabitz','Harvard 课题组校友名录具名 Herschel Rabitz 并链接 Princeton 本人页面。名录未列阶段；结合 Harvard 博士履历仅记博士组属候选，正式导师待查。'],['cdb9f44d','Wolynes','Harvard 课题组校友名录具名 Peter Wolynes 并链接 Rice 本人页面。名录未列阶段；结合 Harvard 博士履历仅记博士组属候选，正式导师待查。']];
for(const [id,name,note] of items){
 const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);
 if(!row)throw Error('missing prior event '+id);
 const data=JSON.parse(row.details_json);
 data.audit_id='gordon_roster_20261113_'+name;
 data.aspects.phd={status:'group_or_candidate',note,sources:['https://gordon.faculty.chemistry.harvard.edu/alumni',...(data.aspects.phd.sources||[])]};
 data.next_step='查 Harvard 博士论文原卷及明确导师字段；继续追查博士后阶段指导。';
 data.followup_required=true;
 fs.writeFileSync(path.join(__dirname,'20261113-Gordon-'+name+'.json'),JSON.stringify(data,null,2));
}
