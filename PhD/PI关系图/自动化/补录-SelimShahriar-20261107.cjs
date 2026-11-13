const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const f=path.join(root,'graph-manifest.json'),m=JSON.parse(fs.readFileSync(f,'utf8'));
const e={id:'8f4c75ba',filename:'人员 - Northwestern - Selim M. Shahriar - 8f4c75ba',name:'Selim M. Shahriar',unit:'Northwestern',kind:'美国'};
const old=m.nodes.find(n=>n.id===e.id||n.filename===e.filename);if(old&&old.filename!==e.filename)throw Error('ID 冲突');if(!old)m.nodes.push(e);m.notes=m.nodes.length;fs.writeFileSync(f,JSON.stringify(m,null,2)+'\n','utf8');
function add(rel,line){const p=path.join(root,rel),s=fs.readFileSync(p,'utf8');if(!s.includes(line))fs.writeFileSync(p,s.replace(/\s*$/,'')+'\n'+line+'\n','utf8')}
add('院校与机构/院校 - Northwestern.md','- [[人员 - Northwestern - Selim M. Shahriar - 8f4c75ba|Selim M. Shahriar]]');
add('已核实院系/已核实单位 - Northwestern - 电气与计算机工程系.md','- [[人员 - Northwestern - Selim M. Shahriar - 8f4c75ba|Selim M. Shahriar]] — [工程学院](https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/shahriar-selim.html)');
add('已核实院系/已核实单位 - Northwestern - 物理与天文学系.md','- [[人员 - Northwestern - Selim M. Shahriar - 8f4c75ba|Selim M. Shahriar（联聘）]] — [物理系](https://physics.northwestern.edu/people/faculty/affiliated-faculty/selim-shahriar.html)');
add('已核实方向/已核实方向 - 量子光学.md','- [[人员 - Northwestern - Selim M. Shahriar - 8f4c75ba|Selim M. Shahriar · Northwestern]] — [工程学院](https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/shahriar-selim.html)');
add('Northwestern逐人复核记录.md','| [[人员 - Northwestern - Selim M. Shahriar - 8f4c75ba|Selim M. Shahriar]] | 电气与计算机工程、物理联聘；量子光学、量子信息、量子传感 | Shaoul Ezekiel（本人履历列论文导师，博士阶段角色待核） | MIT RLE 1991–1992 博后；导师待核，日期与博士重叠 | [院系](https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/shahriar-selim.html) · [本人履历](https://lapt.ece.northwestern.edu/selim/shahriar_cv.pdf) |');
add('师承候选线索索引.md','- [[人员 - Northwestern - Selim M. Shahriar - 8f4c75ba|Selim M. Shahriar]] → 博士导师候选：[[师承人物 - Shaoul Ezekiel|Shaoul Ezekiel]]。[本人履历](https://lapt.ece.northwestern.edu/selim/shahriar_cv.pdf)列 Ezekiel 为 Thesis Supervisor，但未区分硕士与博士；待原论文确认。');
add('师承关系索引.md','- [[人员 - Northwestern - Selim M. Shahriar - 8f4c75ba|Selim M. Shahriar]] → 研究生论文导师／博士导师候选：[[师承人物 - Shaoul Ezekiel|Shaoul Ezekiel]]。[本人履历](https://lapt.ece.northwestern.edu/selim/shahriar_cv.pdf)列 Thesis Supervisor，学位阶段待核。');
console.log(JSON.stringify({nodes:m.notes,id:e.id}));
