const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const f=path.join(root,'graph-manifest.json'),m=JSON.parse(fs.readFileSync(f,'utf8'));
const e={id:'89bf70a2',filename:'人员 - Duke - Simon Divilov - 89bf70a2',name:'Simon Divilov',unit:'Duke',kind:'美国'};
const old=m.nodes.find(n=>n.id===e.id||n.filename===e.filename);if(old&&old.filename!==e.filename)throw Error('ID 冲突');if(!old)m.nodes.push(e);m.notes=m.nodes.length;fs.writeFileSync(f,JSON.stringify(m,null,2)+'\n','utf8');
function add(rel,line){const p=path.join(root,rel),s=fs.readFileSync(p,'utf8');if(!s.includes(line))fs.writeFileSync(p,s.replace(/\s*$/,'')+'\n'+line+'\n','utf8')}
add('院校与机构/院校 - Duke.md','- [[人员 - Duke - Simon Divilov - 89bf70a2|Simon Divilov（研究教师，独立 PI 待核）]]');
add('已核实院系/已核实单位 - Duke - 机械工程与材料科学系.md','- [[人员 - Duke - Simon Divilov - 89bf70a2|Simon Divilov]] — [院系](https://mems.duke.edu/people/simon-divilov-ph-d/)');
add('已核实方向/已核实方向 - 计算材料科学.md','- [[人员 - Duke - Simon Divilov - 89bf70a2|Simon Divilov · Duke]] — [Johns Hopkins 资料](https://me.jhu.edu/wp-content/uploads/2022/09/aflow_jhu_syllabus_2022.pdf)');
add('已核实方向/已核实方向 - 高熵材料.md','- [[人员 - Duke - Simon Divilov - 89bf70a2|Simon Divilov · Duke]] — [Duke 目录](https://mems.duke.edu/people/simon-divilov-ph-d/)');
add('Duke逐人复核记录.md','| [[人员 - Duke - Simon Divilov - 89bf70a2|Simon Divilov（研究教师，独立 PI 待核）]] | 机械工程与材料科学；计算材料、高熵材料、相变 | Marivi Fernández-Serra（博士论文） | Duke 2022 年博后；导师待核 | [Duke](https://mems.duke.edu/people/simon-divilov-ph-d/) · [博士论文](https://www.stonybrook.edu/commcms/grad-physics-astronomy/_theses/divilov-simon-august-2018.pdf) · [JHU 培训资料](https://me.jhu.edu/wp-content/uploads/2022/09/aflow_jhu_syllabus_2022.pdf) |');
add('师承关系索引.md','- [[人员 - Duke - Simon Divilov - 89bf70a2|Simon Divilov]] → 博士导师：[[人员 - Stony Brook - Marivi Fernández-Serra - 42a1790e|Marivi Fernández-Serra]]。[本人 2018 博士论文](https://www.stonybrook.edu/commcms/grad-physics-astronomy/_theses/divilov-simon-august-2018.pdf)签字页和致谢明确 Dissertation Advisor。');
console.log(JSON.stringify({nodes:m.notes,id:e.id}));
