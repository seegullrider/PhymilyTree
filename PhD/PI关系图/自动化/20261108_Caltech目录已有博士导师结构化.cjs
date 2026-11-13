// 名录只作身份和来源交叉对照；只分类人工事件和人物页已有的博士导师。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'Caltech应用物理材料博士目录匹配候选-20261108.json'),'utf8')),raw=fs.readFileSync(path.join(__dirname,'Caltech应用物理材料博士名录-20261108.txt'),'utf8');
// 指定学位年份消歧，排除 Bellan 异常字段及身份、角色不清的条目。
const approved=[
 ['b7c6f9b9',1999,'人员 - Caltech - Kerry Vahala - 20861ff7','博士导师'],['8688e0dd',1982,'师承人物 - Thomas C. McGill','博士导师'],
 ['114ae273',2023,'人员 - Caltech - Oskar Painter - cd1f2756','博士导师'],['28fcfa1c',2014,'人员 - Northwestern - G. Jeffrey Snyder - 3c0943d4','博士导师'],
 ['87f2254b',2012,'人员 - Caltech - William A. Goddard III - ea39607c','博士导师'],['ff0e3394',2013,'人员 - Caltech - Oskar Painter - cd1f2756','博士导师'],
 ['1644787e',1983,'师承人物 - William Lewis Johnson','博士导师'],['fb3c4c3e',2009,'人员 - Caltech - Harry Atwater - e118c47d','博士导师'],
 ['f01e204d',2002,'人员 - Caltech - Harry Atwater - e118c47d','博士导师'],['d7f53f33',2015,'人员 - Caltech - Harry Atwater - e118c47d','博士导师'],
 ['d7f53f33',2015,'师承人物 - Nathan S. Lewis','博士共同导师'],['439a89cf',2023,'人员 - Caltech - Harry Atwater - e118c47d','博士导师'],
 ['801f1179',2007,'人员 - Caltech - Michael Roukes - 62ba1cc8','博士导师'],['658cf8a7',1971,'师承人物 - Pol Duwez','博士导师'],
 ['88aa2c72',1991,'师承人物 - Thomas C. McGill','博士导师'],['f4a33efb',2005,'人员 - Caltech - Kerry Vahala - 20861ff7','博士导师']
],events=[];
for(const [id,year,mentor,label] of approved){
 const hits=input.candidates.filter(x=>x.record_id===id&&x.alumnus.year===year);if(hits.length!==1)throw Error('人物与年度候选不唯一 '+id);const x=hits[0],line=raw.split(/\r?\n/).find(s=>s.startsWith('L'+x.alumnus.line+':'));if(!line||!line.includes(x.alumnus.title)||!line.includes(x.alumnus.advisor))throw Error('已保存目录原行不符 '+id);
 const row=db.prepare('SELECT r.filename,a.audit_id,a.details_json FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT t.audit_id FROM manual_audit_events t WHERE t.record_id=r.id ORDER BY t.recorded_at DESC,t.rowid DESC LIMIT 1) WHERE r.id=?').get(id);if(!row)throw Error('缺少人工事件 '+id);const a=JSON.parse(row.details_json);
 if(a.aspects.identity.status!=='confirmed'||a.aspects.phd.status!=='confirmed_advisor'||db.prepare('SELECT 1 FROM typed_relation_events WHERE record_id=? AND stage=? AND mentor_filename=?').get(id,'phd',mentor))throw Error('身份、状态或结构化记录变化 '+id);
 const person=fs.readFileSync(path.join(root,'人物',row.filename+'.md'),'utf8'),back=fs.readFileSync(path.join(root,'人物',mentor+'.md'),'utf8');if(!person.includes('- '+label+'：[['+mentor+'|')||!back.includes('[['+row.filename+'|'))throw Error('正反链接缺失 '+id+' '+mentor);
 const role=label==='博士共同导师'?'共同导师':'导师';events.push({event_id:'20261108_caltech_existing_'+id+'_'+(label==='博士共同导师'?'co':'main'),record_id:id,stage:'phd',mentor_filename:mentor,kind:'advisor',source_audit_id:row.audit_id,evidence:`Caltech 校友表列 ${x.alumnus.name.trim().replace(/\s+/g,' ')}、${year} 博士论文《${x.alumnus.title}》和 Adviser ${x.alumnus.advisor}；对该${role}的既有独立来源判断：${a.aspects.phd.note}。此前身份核对：${a.aspects.identity.note}`,sources:[...new Set([input.source,...a.aspects.phd.sources,...a.aspects.identity.sources])]});
}db.close();const out=path.join(__dirname,'结构化-20261108-Caltech既有博士导师.json');fs.writeFileSync(out,JSON.stringify(events,null,2)+'\n',{encoding:'utf8',flag:'wx'});console.log(JSON.stringify({prepared:events.length,records:new Set(events.map(x=>x.record_id)).size,file:out}));
