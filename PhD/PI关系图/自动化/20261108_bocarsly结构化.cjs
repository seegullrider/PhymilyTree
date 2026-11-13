const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),id='4d6d9753',home='https://jdbocarsly.github.io/',cv='https://jdbocarsly.github.io/Bocarsly_CV_8Dec22w.pdf';
const p=path.join(root,'人物','人员 - University of Houston - Joshua D. Bocarsly - 4d6d9753.md');
let text=fs.readFileSync(p,'utf8');
const extra='- 原始证据复核：[本人主页]('+home+')按阶段列 UCSB 博士两位 advisors 和 Cambridge 博后两位 advisors；[本人 2022 CV]('+cv+')进一步分为各阶段 advisor 与 co-advisor，勿将本科导师混入博士关系。';
if(!text.includes(extra)){const anchor='## 师承\n';if(text.split(anchor).length!==2)throw Error('师承标题不唯一');text=text.replace(anchor,anchor+'\n'+extra+'\n');fs.writeFileSync(p,text,'utf8');}
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const a=JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id).details_json);db.close();
a.audit_id='20261108_bocarsly_cv_four_advisors';a.followup_required=true;
a.aspects.phd={status:'confirmed_advisor',note:'本人主页按 UCSB 博士论文列 Ram Seshadri 和 Stephen D. Wilson；本人 2022 CV 依次列 advisor 与 co-advisor。',sources:[home,cv]};
a.aspects.postdoc={status:'confirmed_advisor',note:'本人主页列 2020–2023 Cambridge 博后 advisors Clare Grey 和 Siân Dutton；2022 CV 依次列 advisor 与 co-advisor。',sources:[home,cv]};
a.next_step='两阶段指导者已由本人主页和履历明确；继续核对院系任职和招生状态、原论文元数据及时间。';
fs.writeFileSync(path.join(__dirname,'人工-20261108-bocarsly.json'),JSON.stringify(a,null,2)+'\n');
const items=[['phd','人员 - UC Santa Barbara - Ram Seshadri - ff3626c5','seshadri','本人 CV 列为 UCSB 博士研究 advisor；本人主页列博士论文两位 advisors。'],['phd','人员 - UC Santa Barbara - Stephen Wilson - 866768f8','wilson','本人 CV 列为 UCSB 博士研究 co-advisor；本人主页列博士论文两位 advisors。'],['postdoc','师承人物 - Clare P. Grey','grey','本人 CV 列为 Cambridge 博后 advisor；本人主页列其为 2020–2023 博后两位 advisors 之一。'],['postdoc','师承人物 - Siân Dutton','dutton','本人 CV 列为 Cambridge 博后 co-advisor；本人主页列其为 2020–2023 博后两位 advisors 之一。']].map(([stage,mentor_filename,key,evidence])=>({event_id:'20261108_bocarsly_'+key,record_id:id,stage,mentor_filename,kind:'advisor',source_audit_id:a.audit_id,evidence,sources:[home,cv]}));
fs.writeFileSync(path.join(__dirname,'结构化-20261108-bocarsly.json'),JSON.stringify(items,null,2)+'\n');console.log('prepared');
