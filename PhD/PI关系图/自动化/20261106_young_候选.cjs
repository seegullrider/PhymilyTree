const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('35e4db39');if(!row)throw Error('缺少原台账');
const ev=JSON.parse(row.details_json);ev.audit_id='20261106_young_elliott_candidate_35e4db39';
ev.aspects.phd={status:'group_or_candidate',note:'德文维基人物传记称 1973 Oxford 博士师从 Roger Elliott，但未给出该陈述的原始学位出处；仅候选。本人 CV 搜索索引有指导关系线索，PDF 两个地址本次均未读取。',sources:['https://de.wikipedia.org/wiki/Allan_Peter_Young','https://peteryoung.sites.ucsc.edu/cv/']};
ev.followup_required=true;ev.next_step='读取本人 CV PDF 或 Oxford 博士论文原始档案，并追查 Oxford 与 Cornell 博后导师。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Peter-Young-20261106.json'),JSON.stringify(ev,null,2)+'\n','utf8');
