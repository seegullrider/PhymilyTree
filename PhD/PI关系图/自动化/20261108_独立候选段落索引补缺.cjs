// 仅补充已人工核对方向、阶段及现有反链的候选；不把候选升级为正式关系。
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'人物与索引缺边待核.json'),'utf8'));
const ids=new Set(['45b1161f','acc54713','1fe868ab','f5d396d8','a9d1ffad','0b6e1fd1','68e05e80','3409555e','ab40335d','177eaec9','63770bc9','c65173eb','f9f7cb7a','d79daa66','ba527098','ed927ac7','d068c857']);
const rows=data.missingIndex.filter(x=>ids.has(x.id)&&x.lines[0].line.startsWith('- 待核 '));if(rows.length!==19||new Set(rows.map(x=>x.id)).size!==17)throw Error('候选集变化，须重新人工审核');
const target=path.join(root,'师承关系索引.md'),old=fs.readFileSync(target,'utf8'),out=[];
for(const x of rows){const line=x.lines[0].line,person=fs.readFileSync(path.join(root,'人物',x.filename+'.md'),'utf8'),mentor=fs.readFileSync(path.join(root,'人物',x.mentor+'.md'),'utf8');
 const duplicate=old.split('\n').some(s=>{if(!s.includes(`[[${x.filename}|`)||!s.includes(`[[${x.mentor}|`))return false;const label=(s.split('→')[1]||'').split('：')[0];return x.stage==='博士后'?/博士后/.test(label):/博士(?!后)/.test(label)});
 if(!person.includes(line)||!mentor.includes(x.id)||duplicate)throw Error('人物、反链或索引变化 '+x.id);
 if(!['博士','博士后'].includes(x.stage)||!line.startsWith(`- 待核 [[${x.mentor}|`))throw Error('候选或阶段不明确 '+x.id);
 out.push(`- [[${x.filename}|${x.name}]] → ${x.stage}导师候选：${line.slice('- 待核 '.length)}`);
}
fs.writeFileSync(target,old.replace(/\s*$/,'')+'\n'+out.join('\n')+'\n','utf8');console.log(JSON.stringify({candidate_relations:out.length,people:ids.size}));
