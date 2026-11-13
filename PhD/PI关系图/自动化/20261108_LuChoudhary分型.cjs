const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const src={lu:'https://sites.google.com/view/yuan-ming-lu-physics/home',kamal:'https://choudhary.wse.jhu.edu/wp-content/uploads/2025/12/KamalChoudhary-CV-JHU.pdf'};
const jobs=[['f3d5c4d8','Lu',src.lu],['5ae5be3d','Choudhary',src.kamal]];
for(const [id,name,url] of jobs){const r=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(!r)throw Error('缺少人工事件 '+id);const a=JSON.parse(r.details_json);a.audit_id=`20261108_${id}_cv_typed`;
 if(name==='Lu'){
  a.aspects.phd={status:'confirmed_advisor',note:'本人履历的 2007–2011 Boston College 博士条目明确列 advised by Ziqiang Wang。',sources:[url]};
  a.aspects.postdoc={status:'group_or_candidate',note:'本人履历的 2011–2014 LBNL 博士后条目列 supervised by Dung-Hai Lee 与 Ashvin Vishwanath；记录两位阶段研究师长，正式称谓待核。',sources:[url]};
 }else{
  a.aspects.phd={status:'confirmed_advisor',note:'本人 CV 的 University of Florida 2015 材料博士论文条目明确列 Advisor: Dr. Susan B. Sinnott。',sources:[url]};
 }
 a.followup_required=true;fs.writeFileSync(path.join(__dirname,`人工-20261108-${name}分型.json`),JSON.stringify(a,null,2)+'\n');
}
db.close();
const specs=[
 ['f3d5c4d8','phd','师承人物 - Ziqiang Wang','advisor','本人履历博士条目明确 advised by Ziqiang Wang。',src.lu],
 ['f3d5c4d8','postdoc','人员 - UC Berkeley - Dung-Hai Lee - ba527098','stage_mentor','本人履历 2011–2014 LBNL 博后条目列 supervised by Dung-Hai Lee 与 Ashvin Vishwanath，正式称谓待核。',src.lu],
 ['f3d5c4d8','postdoc','人员 - Harvard - Ashvin Vishwanath - 49dc4464','stage_mentor','本人履历 2011–2014 LBNL 博后条目列 supervised by Dung-Hai Lee 与 Ashvin Vishwanath，正式称谓待核。',src.lu],
 ['5ae5be3d','phd','人员 - Penn State - Susan Sinnott - 40df2c95','advisor','本人 CV Florida 2015 博士条目明确写 Advisor: Dr. Susan B. Sinnott。',src.kamal]
];
const typed=specs.map(([id,stage,mentor,kind,evidence,url],i)=>({event_id:`20261108_${id}_cv_typed_${i}`,record_id:id,stage,mentor_filename:mentor,kind,source_audit_id:`20261108_${id}_cv_typed`,evidence,sources:[url]}));
fs.writeFileSync(path.join(__dirname,'结构化-20261108-LuChoudhary.json'),JSON.stringify(typed,null,2)+'\n');console.log('已准备两条人工事件和四条分类关系');
