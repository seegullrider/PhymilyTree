// 此论文已在本轮此前通过网页工具直接读取；仅为既有博士关系补充论文原文证据。
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const p='人员 - Columbia - Chris A. Marianetti - 7214b2d2',m='师承人物 - Gerbrand Ceder',url='https://ceder.berkeley.edu/theses/2004_Chris_Marianetti_Thesis.pdf',proof=`[本人 MIT 博士论文](${url})题页列 Gerbrand Ceder 为 Thesis Supervisor。`;
const edits=new Map();function edit(rel,fn){const f=path.join(root,rel),s=fs.readFileSync(f,'utf8'),v=fn(s);if(v===s)throw Error('未修改 '+rel);edits.set(f,v)}function line(s,test){const a=s.split('\n'),i=a.findIndex(test);if(i<0||a.filter(test).length!==1)throw Error('目标行不唯一');a[i]+=' '+proof;return a.join('\n')}
edit('人物/'+p+'.md',s=>line(s,x=>x.startsWith('- 博士导师：')&&x.includes(`[[${m}|`)));
edit('人物/'+m+'.md',s=>line(s,x=>x.startsWith('- 博士生：')&&x.includes(`[[${p}|`)));
edit('师承关系索引.md',s=>line(s,x=>x.includes(`[[${p}|`)&&x.includes(`[[${m}|`)));
edit('Columbia逐人复核记录.md',s=>{const a=s.split('\n'),i=a.findIndex(x=>x.startsWith(`| [[${p}|`));if(i<0)throw Error('缺校表');a[i]=a[i].replace(/ \|$/,`；[博士论文](${url}) |`);return a.join('\n')});
for(const [f,t] of edits)fs.writeFileSync(f,t,'utf8');console.log('论文与正反链补证完成');
