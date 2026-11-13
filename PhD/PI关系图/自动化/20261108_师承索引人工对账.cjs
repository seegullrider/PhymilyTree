// 已人工比对人物页、人工事件和保存的来源记录，仅修正列出的索引；保留原索引来源。
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),file=path.join(root,'师承关系索引.md'),queue=JSON.parse(fs.readFileSync(path.join(__dirname,'人物页与师承索引角色待核.json'),'utf8')),selected=[
 ['569161e8','人员 - MIT - Xiao-Gang Wen - 6130f1b4','advisor'],['c14bcfb7','人员 - MIT - Xiao-Gang Wen - 6130f1b4','advisor'],
 ['7061f188','师承人物 - Martin Nuss','stage_mentor'],['7061f188','师承人物 - Richard R. Freeman','stage_mentor'],
 ['1ddfc803','师承人物 - David J. Thouless','candidate'],['25b9e4ef','人员 - MIT - Pablo Jarillo-Herrero - 0eae5986','candidate'],
 ['3daf3526','人员 - MIT - Michael S. Strano - 0cbbf5af','advisor'],['ced5d892','师承人物 - Clare P. Grey','advisor'],['ced5d892','师承人物 - Angelos Michaelides','advisor'],
 ['25d31a6d','人员 - Harvard - Mikhail Lukin - 310298e3','advisor'],['66461e75','人员 - MIT - Senthil Todadri - 781c3259','stage_mentor'],['66461e75','人员 - MIT - Patrick Lee - bc7878ac','stage_mentor'],
 ['24363548','人员 - Princeton - Ali Yazdani - 5f1200cb','group_leader'],['0ea0f83e','师承人物 - Sergey V. Iordansky','advisor'],['bafbf57a','师承人物 - Andreas Acrivos','advisor']
];
let idx=fs.readFileSync(file,'utf8');for(const [id,mentor,kind] of selected){const rows=queue.mismatches.filter(x=>x.record_id===id&&x.mentor_filename===mentor&&x.person_roles.length===1&&x.person_roles[0].kind===kind);if(rows.length!==1)throw Error('队列不唯一或已变化 '+id+' '+mentor);const r=rows[0],n=r.person_roles[0].line;if(idx.split(r.index_line).length!==2)throw Error('索引内容变化 '+id);const person=fs.readFileSync(path.join(root,'人物',r.filename+'.md'),'utf8');if(!person.split(/\r?\n/).includes(n))throw Error('人物页内容变化 '+id);
 const old=[...r.index_line.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(x=>x[1]),retained=old.filter(u=>!n.includes(u)).map(u=>`[旧索引另见](${u})`).join(' ');const next=`- [[${r.filename}|${r.name}]] → ${n.slice(2)}${retained?' '+retained:''}`;idx=idx.replace(r.index_line,next)}
fs.writeFileSync(file,idx,'utf8');console.log(JSON.stringify({corrected:selected.length,persons:new Set(selected.map(x=>x[0])).size}));
