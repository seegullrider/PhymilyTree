// 同一研究者两条校属记录的已知关系核实；不推断博后正式导师职衔。
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const rows=[['人员 - UC San Diego - Sheng Xu — 现 Stanford 主聘，UCSD adjunct - 3caf9ac9','Sheng Xu — 现 Stanford 主聘，UCSD adjunct'],['人员 - Stanford - Sheng Xu - 2a66e08b','Sheng Xu']];
const award='https://bpb-us-e1.wpmucdn.com/sites.gatech.edu/dist/0/283/files/2018/05/Sigma-Xi-awards-2001-2018.pdf?bid=283',alumni='https://www.gtalumni.org/40-under-40/class-of-2022.html',uc='https://jacobsschool.ucsd.edu/people/profile/sheng-xu',col='https://me.columbia.edu/files/seasdepts/Sheng_Xu_Seminar_2.23.pdf';
const phd=` [Georgia Tech 2011 博士论文奖名录](${award})明确列 Sheng Xu（材料科学与工程）及 Advisor Zhong Lin Wang；[校友资料](${alumni})交叉核对同为 UCSD 的 Georgia Tech 博士。关系类型可信度：高。`;
const post=` [UCSD 工程学院](${uc})列 UIUC 博后 2011–2015 年；[Columbia 讲座简介](${col})称其博后 working with John Rogers，正式导师职衔待核。`;
function edit(rel,needle,add){const f=path.join(root,rel),s=fs.readFileSync(f,'utf8'),lines=s.split(/\r?\n/),m=lines.filter(x=>x.includes(needle));if(m.length!==1)throw Error(rel+' 匹配 '+m.length+' '+needle);if(!m[0].includes(add))fs.writeFileSync(f,s.replace(m[0],m[0]+add),'utf8')}
for(const [p,label] of rows){edit('人物/'+p+'.md','- 博士导师：[[师承人物 - Zhong Lin Wang|',phd);edit('人物/师承人物 - Zhong Lin Wang.md','- 博士生：[['+p+'|',phd);edit('师承关系索引.md','[['+p+'|'+label+']] → 博士导师：',phd);edit('人物/'+p+'.md','- 博士后阶段研究师长：[[师承人物 - John A. Rogers|',post);edit('人物/师承人物 - John A. Rogers.md','- 博士后阶段研究者：[['+p+'|',post);edit('师承关系索引.md','[['+p+'|'+label+']] → 博士后阶段研究师长：',post)}
// 两校表均保留同一博士导师；更正 Stanford 表中较弱的博后组属标签。
{const f=path.join(root,'Stanford逐人复核记录.md'),s=fs.readFileSync(f,'utf8'),needle='[['+rows[1][0]+'|Sheng Xu]]',m=s.split(/\r?\n/).filter(x=>x.includes(needle));if(m.length!==1)throw Error('Stanford 表匹配异常');const x=m[0].replace('John A. Rogers（课题组）','John A. Rogers（阶段研究师长，正式导师待核）');if(x!==m[0])fs.writeFileSync(f,s.replace(m[0],x),'utf8')}
console.log('已对齐两校人物页、反向链接、索引和学校表');
