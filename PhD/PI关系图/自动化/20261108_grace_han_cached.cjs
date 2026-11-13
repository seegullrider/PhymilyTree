// Add a previously read institutional source to both existing graph directions.
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const url='https://www.chem.ucsb.edu/news/welcome-our-new-associate-professor-grace-han';
const paths=[
 ['人物/人员 - UC Santa Barbara - Grace Han - 0ae05a57.md','- 博士导师：'],
 ['人物/人员 - UC Santa Barbara - Grace Han - 0ae05a57.md','- 博士后课题组负责人：'],
 ['人物/人员 - MIT - Timothy Manning Swager - 45e69f97.md','|Grace Han]]'],
 ['人物/人员 - MIT - Jeffrey Grossman - 04c581fa.md','|Grace Han]]'],
 ['师承关系索引.md','|Grace Han]] → 博士导师：'],
 ['师承关系索引.md','|Grace Han]] → 博士后课题组负责人：'],
 ['UC Santa Barbara逐人复核记录.md','|Grace Han]]'],
];const edits=new Map();for(const [rel,needle] of paths){const file=path.join(root,rel),s=edits.get(file)??fs.readFileSync(file,'utf8'),lines=s.split('\n'),hits=lines.map((v,i)=>v.includes(needle)?i:-1).filter(i=>i>=0);if(hits.length!==1)throw Error('expected one matching line: '+rel+' '+needle);const i=hits[0],label=`[UCSB 2025 院系介绍](${url})`;if(!lines[i].includes(label))lines[i]=lines[i].includes(' |')?lines[i].replace(/ \|\r?$/,`；${label} |`):lines[i].replace(/\r?$/,` ${label}`);edits.set(file,lines.join('\n'));}for(const [f,s] of edits)fs.writeFileSync(f,s,'utf8');console.log(JSON.stringify({files:edits.size}));
