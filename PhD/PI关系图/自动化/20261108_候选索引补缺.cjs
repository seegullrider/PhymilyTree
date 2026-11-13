// 只复制已经存在的人物页候选到索引，不确认关系或改变人物页。
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'人物与索引缺边待核.json'),'utf8'));
const selected=new Set(['7c288ddc','fe72b0d0','0b50f629','9e17b383','57a1e204','c8351556','709db6a1']);
const rows=data.missingIndex.filter(x=>selected.has(x.id));if(rows.length!==8||new Set(rows.map(x=>x.id)).size!==7)throw Error('待核名单变化，须重新审查');
const idxPath=path.join(root,'师承关系索引.md'),old=fs.readFileSync(idxPath,'utf8'),newRows=new Map();
for(const x of rows){const body=fs.readFileSync(path.join(root,'人物',x.filename+'.md'),'utf8'),reverse=fs.readFileSync(path.join(root,'人物',x.mentor+'.md'),'utf8'),line=x.lines[0].line;
 if(!body.includes(line)||!reverse.includes(x.id)||!/候选/.test(line)||old.split('\n').some(s=>s.includes(`[[${x.filename}|`)&&s.includes(`[[${x.mentor}|`)))throw Error('方向、候选标签、反链或原索引发生变化 '+x.id);
 const key=x.id+'\0'+line;if(!newRows.has(key))newRows.set(key,`- [[${x.filename}|${x.name}]] → ${line.slice(2)}`);
}
const tail=[...newRows.values()];if(tail.length!==7)throw Error('候选行数不符');fs.writeFileSync(idxPath,old.replace(/\s*$/,'')+'\n'+tail.join('\n')+'\n','utf8');console.log(JSON.stringify({candidate_relations:rows.length,index_lines:tail.length,people:selected.size}));
