const fs=require('fs'),path=require('path'),root='C:/note/PhD/PI关系图',idx='师承关系索引.md';
const zs='人员 - UC Berkeley - Michael W. Zuerch - 1947e3ef',mw='人员 - UC Berkeley - Ming C. Wu - 0cf0b545',pl='人员 - UC Berkeley - Patrick Ledwith - dfc4f320';
const rows=[
[zs,'师承人物 - Christian Spielmann','博士导师','博士生','本人 CV 在 2014 Jena 博士条目明确 adviser Christian Spielmann'],
[zs,'师承人物 - Christian Spielmann','博士后所在课题组','博士后课题组成员','本人 CV 将 2014–2015 Jena 博后列于 Spielmann 组，未明确正式 advisor'],
[zs,'师承人物 - Daniel M. Neumark','博士后所在课题组','博士后课题组成员','本人 CV 将 2015–2017 Berkeley 博后列于 Neumark 和 Leone 两组，未明确正式 advisor'],
[zs,'人员 - UC Berkeley - Stephen Leone - 9194ca79','博士后所在课题组','博士后课题组成员','本人 CV 将 2015–2017 Berkeley 博后列于 Neumark 和 Leone 两组，未明确正式 advisor'],
[mw,'师承人物 - Shyh Wang','博士导师','博士生','Berkeley EECS 官方资料明确 PhD 1988 advisor Shyh Wang'],
[pl,'人员 - Harvard - Ashvin Vishwanath - 49dc4464','博士导师','博士生','MIT fellowship 本人简介明确其 Harvard 博士 advised by Vishwanath，原页误拼 Asvhin']];
function edit(rel,fn){const f=path.join(root,rel),s=fs.readFileSync(f,'utf8');let count=0;const t=s.split('\n').map(l=>{if(fn(l)){count++;return l.includes('关系类型可信度：高。')?l:l+' 证据：'+fn.ev+'；关系类型可信度：高。'}return l}).join('\n');if(count!==1)throw Error(rel+' 匹配数 '+count);if(t!==s)fs.writeFileSync(f,t)}
for(const [self,ref,label,reverse,ev] of rows){let a=l=>l.startsWith('- '+label+'：[['+ref+'|');a.ev=ev;edit('人物/'+self+'.md',a);let b=l=>l.startsWith('- '+reverse+'：[['+self+'|');b.ev=ev;edit('人物/'+ref+'.md',b);let c=l=>l.startsWith('- [['+self+'|')&&l.includes('→ '+label+'：[['+ref+'|');c.ev=ev;edit(idx,c)}
