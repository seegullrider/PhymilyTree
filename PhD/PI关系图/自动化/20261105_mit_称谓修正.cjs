const fs=require('fs'),path=require('path'),root='C:/note/PhD/PI关系图',p=n=>'人物/'+n+'.md';
function edit(f,a,b){f=path.join(root,f);const s=fs.readFileSync(f,'utf8');if(s.includes(b))return;if(!s.includes(a))throw Error('missing '+f+' '+a);fs.writeFileSync(f,s.replace(a,b));}
function ch(f,needle,from,to,e){const s=fs.readFileSync(path.join(root,f),'utf8'),l=s.split('\n').find(x=>x.includes(needle));if(!l)throw Error('missing '+f+' '+needle);edit(f,l,l.replace(from,to)+' '+e);}
const k='人员 - MIT - Wolfgang Ketterle - c6a09de1',bio='https://www.rle.mit.edu/cua_pub/ketterle_group_old/Projects_2002/Pubs_02/kett02_Nobel_autobiography.pdf';
for(const [node,name] of [['师承人物 - Herbert Walther','Herbert Walther'],['师承人物 - Hartmut Figger','Hartmut Figger']]){const e='证据：本人自传称博士初期项目由两人指导，后在同实验室转变选题；最终论文的正式导师职务待核。关系类型可信度：高（博士阶段研究指导）。';ch(p(k),`[[${node}|${name}]]`,'博士导师','博士阶段研究师长',e);ch(p(node),`[[${k}|Wolfgang Ketterle]]`,'博士生','博士阶段研究者',e);ch('师承关系索引.md',`[[${k}|Wolfgang Ketterle]] → 博士导师：[[${node}|${name}]]`,'博士导师','博士阶段研究师长',e);}
const o='人员 - MIT - William Oliver - 55dfd7e3',y='师承人物 - Yoshihisa Yamamoto',e='证据：MIT 新闻称 Stanford 博士工作与 Yamamoto 一起完成；论文正式 advisor 称谓待核。关系类型可信度：高（博士阶段研究关系）。';ch(p(o),`[[${y}|Yoshihisa Yamamoto]]`,'博士导师','博士阶段研究师长',e);ch(p(y),`[[${o}|William Oliver]]`,'博士生','博士阶段研究者',e);ch('师承关系索引.md',`[[${o}|William Oliver]] → 博士导师`,'博士导师','博士阶段研究师长',e);
edit('MIT逐人复核记录.md','| Herbert Walther、Hartmut Figger | David E. Pritchard |','| Herbert Walther、Hartmut Figger（博士初期项目指导；论文职务待核） | David E. Pritchard |');
edit('MIT逐人复核记录.md','| Yoshihisa Yamamoto | 待核 | [来源](https://ide.mit.edu/events/business-of-quantum-summit/) |','| Yoshihisa Yamamoto（博士阶段研究师长；论文导师待核） | 待核 | [来源](https://ide.mit.edu/events/business-of-quantum-summit/) |');
edit(p('人员 - MIT - Zachary P. Smith - a82898b7'),'- 待核：[[师承人物 - Benny D. Freeman|Benny D. Freeman]]','- 已核实：[[师承人物 - Benny D. Freeman|Benny D. Freeman]]');
const d='师承人物 - David E. Pritchard',ke='证据：本人自传称 1990 年赴 MIT 在 Pritchard 组做博士后，采访描述 Pritchard 指导其研究决策；正式 advisor 职务待核。关系类型可信度：高（博士后阶段研究指导）。';
ch(p(k),`[[${d}|David E. Pritchard]]`,'博士后导师','博士后阶段研究师长',ke);
ch(p(d),`[[${k}|Wolfgang Ketterle]]`,'博士后研究者','博士后阶段研究者',ke);
ch('师承关系索引.md',`[[${k}|Wolfgang Ketterle]] → 博士后导师`,'博士后导师','博士后阶段研究师长',ke);
edit(p(k),'MIT 采访明确 Pritchard 为其 MIT 博士后导师；其他阶段待核。','MIT 采访描述 Pritchard 对其博士后研究的指导，正式 advisor 称谓及其他阶段待核。');
edit('MIT逐人复核记录.md','| Herbert Walther、Hartmut Figger（博士初期项目指导；论文职务待核） | David E. Pritchard |','| Herbert Walther、Hartmut Figger（博士初期项目指导；论文职务待核） | David E. Pritchard（博士后研究师长） |');
