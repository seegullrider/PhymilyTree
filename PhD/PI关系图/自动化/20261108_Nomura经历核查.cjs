// 补充项目和机构原始证据，既有个人阶段关系保留，正式导师待核。
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const p='人员 - UC San Diego - Kenji Nomura - 55b8c2be',m='师承人物 - Hideo Hosono',inst='机构 - Tokyo Institute of Technology';
const uc='https://jacobsschool.ucsd.edu/people/profile/kenji-nomura',news='https://www.titech.ac.jp/news/2023/067017',award='https://www.jst.go.jp/kisoken/archives/sorst/pdf/h21_hosono.pdf';
const proof=` [东工大 2023 年报道](${news})对应 UCSD 的野村研二与该校博士毕业身份，称 Hosono 负责氧化物项目总体领导；[日本科技振兴机构项目报告](${award})列野村研二获 2005 年博士论文奖。所读来源未直接给出博士论文正式导师。`;
function edit(rel,needle,extra){const file=path.join(root,rel),s=fs.readFileSync(file,'utf8'),lines=s.split(/\r?\n/).filter(l=>l.includes(needle));if(lines.length!==1)throw Error(rel+' 匹配数 '+lines.length);if(!lines[0].includes(extra))fs.writeFileSync(file,s.replace(lines[0],lines[0]+extra),'utf8')}
edit('人物/'+p+'.md','- 博士阶段研究师长：[[师承人物 - Hideo Hosono|',proof);
edit('人物/'+m+'.md','- 博士阶段研究者：[['+p+'|',proof);
edit('师承关系索引.md','[['+p+'|Kenji Nomura]] → 博士阶段研究师长：',proof);
const post=`- 博士后经历：[[${inst}|Tokyo Institute of Technology]] 材料科学实验室，个人导师尚未查明。[UCSD 工程学院本人资料](${uc})明确博士后身份与机构，未说明导师。`;
{const f=path.join(root,'人物',p+'.md'),s=fs.readFileSync(f,'utf8');if(!s.includes(post)){const marker='- 核查边界：';if(s.split(marker).length!==2)throw Error('boundary');fs.writeFileSync(f,s.replace(marker,post+'\n'+marker),'utf8')}}
{const f=path.join(root,'人物',inst+'.md'),line=`- 博士后研究者：[[${p}|Kenji Nomura]]。[UCSD 工程学院本人资料](${uc})列东京工业大学材料科学实验室博后，具体导师待查。`;if(!fs.existsSync(f))fs.writeFileSync(f,`# Tokyo Institute of Technology\n\n> [!info] 机构节点\n> 据可查职业经历建立；日本东京工业大学于 2024 年与东京医科齿科大学合并为 Tokyo Science。\n\n## 博士后阶段\n\n${line}\n`,'utf8');else {let s=fs.readFileSync(f,'utf8');if(!s.includes(line))fs.writeFileSync(f,s+'\n'+line+'\n','utf8')}}
{const file=path.join(root,'UC San Diego逐人复核记录.md'),s=fs.readFileSync(file,'utf8'),m=s.split(/\r?\n/).filter(x=>x.includes('[['+p+'|Kenji Nomura]]'));if(m.length!==1)throw Error('school row');let line=m[0].replace('| 待核 |','| Tokyo Tech 博后，导师待核 |');if(!line.includes(news))line=line.replace(/\s*\|\s*$/,`；[东工大项目报道](${news})；[UCSD 博后资料](${uc}) |`);if(line!==m[0])fs.writeFileSync(file,s.replace(m[0],line),'utf8')}
console.log('项目证据、博士后机构、双向链接与学校表已更新');
