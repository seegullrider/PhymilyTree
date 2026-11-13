const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const ber='https://www.grad.ubc.ca/researcher/13551-berciu',kre='https://www.grad.ubc.ca/researcher/15310-krems',identity='https://www.irtg-coco.uni-freiburg.de/members/alumni';
let typed=[];
for(const id of ['76587db0','28383745']){
 const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(!row)throw Error('缺少 '+id);
 const a=JSON.parse(row.details_json);a.audit_id=`20261108_${id}_ubc_supervision`;
 a.aspects.phd={status:'confirmed_advisor',note:'UBC 研究生院在 Berciu、Krems 各自 Doctoral Student Supervision 下列同一篇博士论文；Freiburg 项目校友目录将同一题名对应 John Sous 和 Krems/Berciu。两人论文指导有据，具体主／共同导师职衔待原论文确认。',sources:[ber,kre,identity]};
 a.next_step='查原论文的具体主／共同导师职衔、Columbia 博后指导者和 Stanford 博后正式称谓。';a.followup_required=true;
 fs.writeFileSync(path.join(__dirname,`人工-20261108-Sous-${id}.json`),JSON.stringify(a,null,2)+'\n');
 for(const [mentor,url,tag] of [['师承人物 - Mona Berciu',ber,'berciu'],['师承人物 - Roman V. Krems',kre,'krems']])typed.push({event_id:`20261108_${id}_ubc_${tag}`,record_id:id,stage:'phd',mentor_filename:mentor,kind:'stage_mentor',source_audit_id:a.audit_id,evidence:'UBC 研究生院博士生指导清单列同一论文；联合培养项目校友目录对应作者和两名研究者。具体正式导师职衔待原论文确认。',sources:[url,identity]});
}
db.close();fs.writeFileSync(path.join(__dirname,'结构化-20261108-Sous.json'),JSON.stringify(typed,null,2)+'\n');
