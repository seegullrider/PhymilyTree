// 单人核查：仅补充直接读到的来源，保留正式 advisor 待核的边界。
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const p='人员 - UC San Diego - Nathan A. Romero - 71905983',m='人员 - MIT - Timothy Manning Swager - 45e69f97';
const csu='https://www.chem.colostate.edu/seminars/nathan-romero-ph-d/';
const cv='https://chem.unc.edu/wp-content/uploads/2020/12/nicewicz_cv.pdf';
const addPh=` [Nicewicz 2018 年履历](${cv})的 Dissertations and Theses 列其 2017 年题名，并在 Former Students 下列 Romero；未直接查看学位论文。`;
const addPost=` [Colorado State 讲座简介](${csu})明确 2017–2020 年 MIT 博士后在 Swager 实验室；简介未列正式 advisor 职衔。`;
function change(rel,needle,add){const file=path.join(root,rel),original=fs.readFileSync(file,'utf8');const matches=original.split(/\r?\n/).filter(s=>s.includes(needle));if(matches.length!==1)throw Error(`${rel}: ${needle} 匹配 ${matches.length}`);if(matches[0].includes(add))return;fs.writeFileSync(file,original.replace(matches[0],matches[0]+add),'utf8')}
change('人物/'+p+'.md','- 博士阶段研究师长：[[师承人物 - David A. Nicewicz|',addPh);
change('人物/师承人物 - David A. Nicewicz.md','- 博士阶段受指导者：[['+p+'|',addPh);
change('师承关系索引.md','[['+p+'|Nathan A. Romero]] → 博士阶段研究师长：',addPh);
change('人物/'+p+'.md','- 博士后课题组负责人：[[人员 - MIT - Timothy Manning Swager',addPost);
change('人物/'+m+'.md','- 博士后课题组成员：[['+p+'|',addPost);
change('师承关系索引.md','[['+p+'|Nathan A. Romero]] → 博士后课题组负责人：',addPost);
{const file=path.join(root,'UC San Diego逐人复核记录.md'),s=fs.readFileSync(file,'utf8'),needle='[['+p+'|Nathan A. Romero]]',matches=s.split(/\r?\n/).filter(x=>x.includes(needle));if(matches.length!==1)throw Error('学校表匹配数异常');const add=`[Colorado State 简介](${csu})（博士后 2017–2020；正式导师待核）`,line=matches[0];let fixed=line;if(line.includes('| '+add))fixed=line.replace('| '+add, '；'+add+' |');else if(!line.includes(add))fixed=line.replace(/\s*\|\s*$/, '；'+add+' |');if(fixed!==line)fs.writeFileSync(file,s.replace(line,fixed),'utf8')}
console.log('人物页、双向链接和学校表已对齐');
