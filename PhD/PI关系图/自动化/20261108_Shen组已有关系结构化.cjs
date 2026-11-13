// 人工核对后的既有关系分类：名录只证组属；正式导师另须本人 CV/论文等独立来源。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..');
const d=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),source='https://arpes.stanford.edu/our-people/previous-members',m='人员 - Stanford - Zhi-Xun Shen - 177eaec9';
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'StanfordShen校友候选-20261108.json'),'utf8')),back=fs.readFileSync(path.join(root,'人物',m+'.md'),'utf8');
const approved=[
 ['7dcca75a','postdoc','group_leader','博士后课题组负责人'],['4456f372','postdoc','group_leader','博士后课题组负责人'],
 ['09d3c44c','phd','advisor','博士导师'],['accdd77e','phd','stage_mentor','博士阶段研究师长'],
 ['c76b4c6a','phd','stage_mentor','博士阶段研究师长'],['c76b4c6a','postdoc','group_leader','博士后课题组负责人'],
 ['ad952bdf','phd','group_leader','博士课题组'],['ac3ccc7b','postdoc','advisor','博士后导师'],
 ['76e75667','postdoc','group_leader','博士后所在课题组'],['ec036f39','postdoc','group_leader','博士后阶段课题组负责人'],
 ['7ae93e88','phd','advisor','博士导师'],['4f19b99d','phd','advisor','博士导师']
],events=[];
for(const [id,stage,kind,label] of approved){
 const hits=input.candidates.filter(x=>x.record_id===id);if(hits.length!==1)throw Error('校友候选不唯一 '+id);const h=hits[0];
 if(stage==='postdoc'&&!/Postdoc/i.test(h.former)||stage==='phd'&&!/Ph\.D\. Student/i.test(h.former))throw Error('名录阶段不匹配 '+id);
 const row=d.prepare('SELECT r.filename,a.audit_id,a.details_json FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT t.audit_id FROM manual_audit_events t WHERE t.record_id=r.id ORDER BY t.recorded_at DESC,t.rowid DESC LIMIT 1) WHERE r.id=?').get(id),a=JSON.parse(row.details_json);
 if(a.aspects.identity.status!=='confirmed'||d.prepare('SELECT 1 FROM typed_relation_events WHERE record_id=? AND stage=? AND mentor_filename=?').get(id,stage,m))throw Error('身份或已有结构化关系变化 '+id);
 if(kind==='advisor'&&(!/advisor|adviser/i.test(a.aspects[stage].note)||!a.aspects[stage].sources.some(x=>x!==source)))throw Error('正式导师缺少独立来源 '+id);
 const person=fs.readFileSync(path.join(root,'人物',row.filename+'.md'),'utf8');if(!person.includes('- '+label+'：[['+m+'|')||!back.includes('[['+row.filename+'|'))throw Error('原类型或反链缺失 '+id);
 events.push({event_id:`20261108_shen_existing_${id}_${stage}`,record_id:id,stage,mentor_filename:m,kind,source_audit_id:row.audit_id,evidence:`Stanford Shen 组已保存校友名录列 ${h.listed_name}，${h.former}；此前身份核对：${a.aspects.identity.note}。该阶段原有判断：${a.aspects[stage].note}。名录本身只证明组属，导师或研究师长判断依其他列出来源。`,sources:[...new Set([source,...a.aspects.identity.sources,...a.aspects[stage].sources])]});
}d.close();const out=path.join(__dirname,'结构化-20261108-Shen组既有关系.json');fs.writeFileSync(out,JSON.stringify(events,null,2)+'\n',{encoding:'utf8',flag:'wx'});console.log(JSON.stringify({prepared:events.length,records:new Set(events.map(x=>x.record_id)).size,file:out}));
