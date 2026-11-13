const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..'),person='人员 - Caltech - Linda Ye - b2587875',mentor='师承人物 - Yoshinori Tokura',url='https://q-mat.caltech.edu/documents/25854/CV_LYe.pdf';
const add=(rel,line)=>{const p=path.join(root,rel),s=fs.readFileSync(p,'utf8');if(!s.includes(line))fs.writeFileSync(p,s.replace(/\s*$/,'')+'\n'+line+'\n','utf8')};
const p=path.join(root,'人物',person+'.md'),s=fs.readFileSync(p,'utf8'),line=`- 硕士论文导师：[[${mentor}|Yoshinori Tokura]]。[本人履历](${url}) 证据：东京大学 2012–2014 M.Eng. 应用物理论文条目明确列 Advisor: Prof. Yoshinori Tokura；关系类型可信度：高。`;
if(!s.includes(line)){if(!s.includes('## 师承\n'))throw Error('缺少师承标题');fs.writeFileSync(p,s.replace('## 师承\n','## 师承\n\n'+line+'\n'),'utf8')}
add(`人物/${mentor}.md`,`- 硕士论文受指导者：[[${person}|Linda Ye]]。[本人履历](${url}) 证据：东京大学 2012–2014 M.Eng. 应用物理论文条目明确列 Advisor: Prof. Yoshinori Tokura；关系类型可信度：高。`);
add('师承关系索引.md',`- [[${person}|Linda Ye]] → 硕士论文导师：[[${mentor}|Yoshinori Tokura]]。[本人履历](${url})列东京大学 M.Eng. 阶段 Advisor；关系类型可信度：高。`);
console.log('已单独补硕士导师及反向链接。');
