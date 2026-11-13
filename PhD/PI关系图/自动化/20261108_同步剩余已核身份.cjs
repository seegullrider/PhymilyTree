// 同步已逐对人工登记的身份结论；三记录情况先验证每一对，保留所有校属节点。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..'),dir=path.join(root,'同名待核'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const cases=[
 ['同名候选 - Ali Shakouri - ec1296c9',['1717c9dc','b73a8d1d'],'same'],
 ['同名候选 - David Schuster - 58876a5a',['71dab6c8','933e36e2'],'same'],
 ['同名候选 - Ramamoorthy Ramesh - 77d8c6c6',['35af1b59','5f9c9300'],'same'],
 ['同名候选 - Shyue Ping Ong - 79d50244',['49d2b03d','4da906da'],'same'],
 ['同名候选 - Sujit Datta - 7fdbc61f',['249a3089','5ed4d998'],'same'],
 ['同名候选 - Wei Chen - bb0c3d3a',['b7ad4151','9c9be2a5'],'different'],
 ['同名候选 - Elaheh Ahmadi - 443e56ef',['39bcf5c6','8a149b22','b864143b'],'same'],
 ['同名候选 - Thomas Barthel - 534e6fa8',['3a8bc599','946926f5','ca17dd5e'],'same']
];
const updates=new Map(),index=path.join(root,'跨校同名待核索引.md'),ls=fs.readFileSync(index,'utf8').replace(/\r\n/g,'\n').split('\n');let personChanges=0,addedTargets=0;
for(const [hub,ids,kind] of cases){const people=ids.map(id=>{const x=db.prepare('select id,name,unit,filename from records where id=?').get(id);if(!x)throw Error('人物不存在 '+id);return x}),ev=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){let pair=[ids[i],ids[j]].sort(),x=db.prepare('select * from identity_assertion_events where left_id=? and right_id=? order by recorded_at desc,rowid desc limit 1').get(...pair);if(!x||x.kind!==kind)throw Error('身份事件未核 '+hub);ev.push(x)}
 const file=path.join(dir,hub+'.md');let s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),old='> [!warning] 不是身份确认\n> 以下记录只有姓名文本完全相同，可能是同一人的不同任职、同名不同人，或旧数据错误；必须查学校履历和来源才能判断。';if(s.split(old).length!==2)throw Error('同名页状态变化 '+hub);const evidence=ev[0].evidence,urls=[...new Set(ev.flatMap(x=>JSON.parse(x.sources_json)))],label=kind==='same'?'所列记录已核为同一人':'所列记录已核为不同研究者';s=s.replace(old,`> [!info] ${label}\n> ${evidence} ${urls.map((u,i)=>`[来源${i+1}](${u})`).join(' ')}`);s=s.replace(/^(# .+)：跨校同名待核$/m,'$1：跨校身份核对');for(const p of people)if(!s.includes('[['+p.filename+'|')){s+=`\n- [[${p.filename}|${p.name} · ${p.unit}]]\n`;addedTargets++}updates.set(file,s);
 const found=ls.map((l,i)=>l.includes('[['+hub+'|')?i:-1).filter(i=>i>=0);if(found.length!==1)throw Error('同名索引条目不唯一 '+hub);ls[found[0]]+=kind==='same'?'；已核为同一人，保留各校属记录。':'；履历已核对为不同研究者。';
 for(const p of people){const f=path.join(root,'人物',p.filename+'.md'),t=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),oldLine=`- [[${hub}|查看同名候选]]。姓名相同并不证明是同一人。`;if(t.includes(oldLine)){if(t.split(oldLine).length!==2)throw Error('人物提示不唯一 '+p.id);let msg=kind==='same'?'所列校属记录已核为同一人，其他同名者须另核。':'所列两位是不同研究者，不能互相复制师承。';updates.set(f,t.replace('## 跨校同名记录待核','## 跨校身份核对').replace(oldLine,`- [[${hub}|查看跨校身份核对]]：${msg}`));personChanges++;}}
}
db.close();updates.set(index,ls.join('\n'));for(const [f,s] of updates)fs.writeFileSync(f,s,'utf8');console.log(JSON.stringify({hubs:cases.length,personNotes:personChanges,addedTargets,files:updates.size,note:'已核身份提示同步；不新增或复制导师。'}));
