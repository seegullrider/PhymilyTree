// 只结构化经人工身份核对、人物页与师长反链均已存在的关系。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'Stanford化学博士目录匹配候选-20261107.json'),'utf8')),saved=fs.readFileSync(path.join(__dirname,'Stanford化学博士目录-801-1167-20261107.txt'),'utf8');
const approved={
 '047f6d7f':'人员 - Stanford - Michael Fayer - 5b976ac0','a92c9bbe':'人员 - Stanford - Michael Fayer - 5b976ac0',
 '897314c8':'人员 - Stanford - Michael Fayer - 5b976ac0','7974de53':'师承人物 - Richard N. Zare',
 '2ba751f4':'人员 - Stanford - Michael Fayer - 5b976ac0','72d37491':'师承人物 - Richard N. Zare',
 '4bc01763':'师承人物 - Robert M. Waymouth','abdc86e2':'师承人物 - Richard N. Zare','ac86f637':'师承人物 - Edward I. Solomon'
};
const events=[];for(const [id,mentor] of Object.entries(approved)){
 const x=input.candidates.filter(c=>c.record_id===id);if(x.length!==1)throw Error('候选非唯一 '+id);const c=x[0],line=saved.split(/\r?\n/).find(l=>l.startsWith('L'+c.source_line+':'));if(!line||!line.includes(c.directory_name)||!line.includes(c.directory_adviser))throw Error('保存原文不符 '+id);
 const row=db.prepare('SELECT r.filename,a.audit_id,a.details_json FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT t.audit_id FROM manual_audit_events t WHERE t.record_id=r.id ORDER BY t.recorded_at DESC,t.rowid DESC LIMIT 1) WHERE r.id=?').get(id);if(!row)throw Error('缺少事件 '+id);const a=JSON.parse(row.details_json);
 if(a.aspects.identity.status!=='confirmed'||a.aspects.phd.status!=='confirmed_advisor'||db.prepare('SELECT 1 FROM typed_relation_events WHERE record_id=? AND stage=?').get(id,'phd'))throw Error('身份、状态或结构化记录变化 '+id);
 const person=fs.readFileSync(path.join(root,'人物',row.filename+'.md'),'utf8'),back=fs.readFileSync(path.join(root,'人物',mentor+'.md'),'utf8');if(!person.includes('- 博士导师：[['+mentor+'|')||!back.includes('[['+row.filename+'|'))throw Error('正反链接缺失 '+id);
 events.push({event_id:'20261108_stanford_existing_'+id,record_id:id,stage:'phd',mentor_filename:mentor,kind:'advisor',source_audit_id:row.audit_id,evidence:`Stanford 化学系博士目录 ${c.directory_year} 年 Ph.D./Adviser 表列 ${c.directory_name}、${c.directory_adviser}。此前身份核对：${a.aspects.identity.note}；既有博士判断及年份差异：${a.aspects.phd.note}`,sources:[...new Set([input.source,...a.aspects.identity.sources,...a.aspects.phd.sources])]});
}db.close();const out=path.join(__dirname,'结构化-20261108-Stanford既有博士导师.json');fs.writeFileSync(out,JSON.stringify(events,null,2)+'\n',{encoding:'utf8',flag:'wx'});console.log(JSON.stringify({prepared:events.length,file:out,ids:events.map(x=>x.record_id)}));
