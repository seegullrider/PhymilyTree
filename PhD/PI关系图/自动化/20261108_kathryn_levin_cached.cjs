// Link the previously read institutional first-person account to an existing edge.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const url='https://litp.uchicago.edu/people/profile/kathryn-levin/',link=`[Chicago 本人经历自述](${url})`;
const rows=[
 ['人物/人员 - University of Chicago - Kathryn Levin - 2b43ee19.md','- 博士后研究师长：'],
 ['人物/师承人物 - Ron Parks.md','|Kathryn Levin]]'],
 ['师承关系索引.md','|Kathryn Levin]] → 博士后研究师长：'],
 ['University of Chicago逐人复核记录.md','|Kathryn Levin]]'],
];let changes=new Map();for(const [rel,needle] of rows){const f=path.join(root,rel),s=changes.get(f)??fs.readFileSync(f,'utf8'),a=s.split('\n'),ids=a.map((x,i)=>x.includes(needle)?i:-1).filter(x=>x>=0);if(ids.length!==1)throw Error('ambiguous line '+rel);const i=ids[0];if(!a[i].includes(link))a[i]=/\|\s*\r?$/.test(a[i])?a[i].replace(/\s*\|\s*\r?$/,`；${link} |`):a[i].replace(/\r?$/,` ${link}`);changes.set(f,a.join('\n'));}for(const [f,s] of changes)fs.writeFileSync(f,s,'utf8');console.log(JSON.stringify({files:changes.size}));
