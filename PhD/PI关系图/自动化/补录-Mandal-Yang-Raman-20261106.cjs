// 幂等补录：仅添加已创建人物节点、图链接和人工事件输入，不覆盖既有记录。
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const add=(rel,line)=>{const f=path.join(root,rel),s=fs.readFileSync(f,'utf8');if(!s.includes(line))fs.writeFileSync(f,s.replace(/\s*$/,'')+'\n'+line+'\n','utf8')};
const entries=[
 {id:'d2180a91',name:'Jyotirmoy Mandal',unit:'Princeton'},
 {id:'4d823e31',name:'Yuan Yang',unit:'Columbia'},
 {id:'b3ac6f21',name:'Aaswath Raman',unit:'UCLA'}
];
const mf=path.join(root,'graph-manifest.json'),m=JSON.parse(fs.readFileSync(mf,'utf8'));
for(const e of entries){e.filename=`人员 - ${e.unit} - ${e.name} - ${e.id}`;const existing=m.nodes.find(n=>n.id===e.id||n.filename===e.filename);if(existing&&existing.filename!==e.filename)throw Error('ID 冲突 '+e.id);if(!existing)m.nodes.push({...e,kind:'美国'});}
m.notes=m.nodes.length;fs.writeFileSync(mf,JSON.stringify(m,null,2)+'\n','utf8');
for(const e of entries)add(`院校与机构/院校 - ${e.unit}.md`,`- [[${e.filename}|${e.name}]]`);
add('院校与机构/院校 - Princeton.md','- [[已核实单位 - Princeton - 土木与环境工程系|土木与环境工程系]]');
add('已核实院系/已核实单位 - Columbia - 应用物理与应用数学系.md','- [[人员 - Columbia - Yuan Yang - 4d823e31|Yuan Yang]] — [学校资料](https://www.engineering.columbia.edu/faculty-staff/directory/yuan-yang)');
add('已核实院系/已核实单位 - UCLA - 材料科学与工程系.md','- [[人员 - UCLA - Aaswath Raman - b3ac6f21|Aaswath Raman]] — [学校资料](https://samueli.ucla.edu/people/aaswath-raman/)');
add('已核实方向/已核实方向 - 光学超材料.md','- [[人员 - Princeton - Jyotirmoy Mandal - d2180a91|Jyotirmoy Mandal · Princeton]] — [学校资料](https://cee.princeton.edu/people/jyotirmoy-mandal)');
add('已核实方向/已核实方向 - 光学超材料.md','- [[人员 - UCLA - Aaswath Raman - b3ac6f21|Aaswath Raman · UCLA]] — [学校资料](https://samueli.ucla.edu/people/aaswath-raman/)');
add('已核实方向/已核实方向 - 光子学.md','- [[人员 - Princeton - Jyotirmoy Mandal - d2180a91|Jyotirmoy Mandal · Princeton]] — [学校资料](https://cee.princeton.edu/people/jyotirmoy-mandal)');
add('已核实方向/已核实方向 - 光子学.md','- [[人员 - Columbia - Yuan Yang - 4d823e31|Yuan Yang · Columbia]] — [学校资料](https://www.engineering.columbia.edu/faculty-staff/directory/yuan-yang)');
add('已核实方向/已核实方向 - 纳米光子学.md','- [[人员 - UCLA - Aaswath Raman - b3ac6f21|Aaswath Raman · UCLA]] — [学校资料](https://samueli.ucla.edu/people/aaswath-raman/)');
add('已核实方向/已核实方向 - 能源材料.md','- [[人员 - Columbia - Yuan Yang - 4d823e31|Yuan Yang · Columbia]] — [学校资料](https://www.engineering.columbia.edu/faculty-staff/directory/yuan-yang)');
add('Princeton逐人复核记录.md','| [[人员 - Princeton - Jyotirmoy Mandal - d2180a91|Jyotirmoy Mandal]] | 土木与环境工程；光学超材料、热光子学 | Yuan Yang；Nanfang Yu（博士阶段 advisor，正式学位角色待核） | Aaswath Raman | [学校](https://cee.princeton.edu/people/jyotirmoy-mandal) · [本人履历](https://cee.princeton.edu/sites/g/files/toruqf2216/files/documents/25200_960512694_%20Mandal.pdf) · [本人团队页](https://jyotirmoymandal.com/team/) |');
add('Columbia逐人复核记录.md','| [[人员 - Columbia - Yuan Yang - 4d823e31|Yuan Yang]] | 应用物理与应用数学、材料科学；能源材料、热光学 | Yi Cui | Gang Chen（课题组） | [学校](https://www.engineering.columbia.edu/faculty-staff/directory/yuan-yang) · [本人履历](https://apam.columbia.edu/files/seasdepts/applied-physics-and-applied-math/cv-yangy.pdf) |');
// Raman 的逐校状态与索引由后续人工事件维护，此补录脚本不再追加可能过时的快照。
const idx='师承关系索引.md';
add(idx,'- [[人员 - Princeton - Jyotirmoy Mandal - d2180a91|Jyotirmoy Mandal]] → 博士导师：[[人员 - Columbia - Yuan Yang - 4d823e31|Yuan Yang]]；博士后导师：[[人员 - UCLA - Aaswath Raman - b3ac6f21|Aaswath Raman]]。[本人 CV](https://cee.princeton.edu/sites/g/files/toruqf2216/files/documents/25200_960512694_%20Mandal.pdf) · [本人团队页](https://jyotirmoymandal.com/team/)。');
add(idx,'- [[人员 - Princeton - Jyotirmoy Mandal - d2180a91|Jyotirmoy Mandal]] → 博士阶段研究师长：[[人员 - Columbia - Nanfang Yu - 80a42f2c|Nanfang Yu]]。[本人团队页](https://jyotirmoymandal.com/team/)称博士阶段 advisor，学位正式角色待核。');
add(idx,'- [[人员 - Columbia - Yuan Yang - 4d823e31|Yuan Yang]] → 博士导师：[[师承人物 - Yi Cui|Yi Cui]]；博士后课题组负责人：[[师承人物 - Gang Chen|Gang Chen]]。[本人 CV](https://apam.columbia.edu/files/seasdepts/applied-physics-and-applied-math/cv-yangy.pdf)明确博士 advisor 与博后组属；后者正式导师称谓待核。');
console.log(JSON.stringify({nodes:m.nodes.length,added:entries.map(e=>e.id)}));
