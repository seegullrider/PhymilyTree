const fs=require('fs'),path=require('path'),root='C:/note/PhD/PI关系图',k='人员 - MIT - Wolfgang Ketterle - c6a09de1',d='师承人物 - David E. Pritchard';
function change(f,n,from,to,e){const x=path.join(root,f),s=fs.readFileSync(x,'utf8'),l=s.split('\n').find(t=>t.includes(n));if(!l)throw Error('missing '+n);if(l.includes(e))return;fs.writeFileSync(x,s.replace(l,l.replace(from,to)+' '+e));}
function edit(f,a,b){const x=path.join(root,f),s=fs.readFileSync(x,'utf8');if(s.includes(b))return;if(!s.includes(a))throw Error('missing '+a);fs.writeFileSync(x,s.replace(a,b));}
const ke='证据：本人自传称 1990 年赴 MIT 在 Pritchard 组做博士后，采访描述 Pritchard 指导其研究决策；正式 advisor 职务待核。关系类型可信度：高（博士后阶段研究指导）。';
change(`人物/${k}.md`,`[[${d}|David E. Pritchard]]`,'博士后导师','博士后阶段研究师长',ke);
change(`人物/${d}.md`,`[[${k}|Wolfgang Ketterle]]`,'博士后研究者','博士后阶段研究者',ke);
change('师承关系索引.md',`[[${k}|Wolfgang Ketterle]] → 博士后导师`,'博士后导师','博士后阶段研究师长',ke);
edit(`人物/${k}.md`,'MIT 采访明确 Pritchard 为其 MIT 博士后导师；其他阶段待核。','MIT 采访描述 Pritchard 对其博士后研究的指导，正式 advisor 称谓及其他阶段待核。');
edit('MIT逐人复核记录.md','| Herbert Walther、Hartmut Figger（博士初期项目指导；论文职务待核） | David E. Pritchard |','| Herbert Walther、Hartmut Figger（博士初期项目指导；论文职务待核） | David E. Pritchard（博士后研究师长） |');
