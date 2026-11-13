// Surface a previously read self-statement in the existing bidirectional notes.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const url='https://www.rsc.org/standards-and-recognition/prizes/winners/professor-chad-mirkin',link=`[本人 RSC 获奖感言](${url})`;
const rows=[
 ['人物/人员 - Northwestern - Chad Mirkin - d6866c22.md','- 博士导师：'],
 ['人物/人员 - Northwestern - Chad Mirkin - d6866c22.md','- 博士后导师：'],
 ['人物/师承人物 - Gregory L. Geoffroy.md','|Chad Mirkin]]'],
 ['人物/师承人物 - Mark S. Wrighton.md','|Chad Mirkin]]'],
 ['师承关系索引.md','|Chad Mirkin]] → 博士导师：'],
 ['师承关系索引.md','|Chad Mirkin]] → 博士后导师：'],
 ['Northwestern逐人复核记录.md','|Chad Mirkin]]'],
];let changes=new Map();for(const [rel,needle] of rows){const f=path.join(root,rel),s=changes.get(f)??fs.readFileSync(f,'utf8'),a=s.split('\n'),ids=a.map((x,i)=>x.includes(needle)?i:-1).filter(x=>x>=0);if(ids.length!==1)throw Error('ambiguous line '+rel+' '+needle);const i=ids[0];if(!a[i].includes(link)){const isRow=/\|\s*\r?$/.test(a[i]);a[i]=isRow?a[i].replace(/\s*\|\s*\r?$/,`；${link} |`):a[i].replace(/\r?$/,` ${link}`);}changes.set(f,a.join('\n'));}for(const [f,s] of changes)fs.writeFileSync(f,s,'utf8');console.log(JSON.stringify({files:changes.size}));
