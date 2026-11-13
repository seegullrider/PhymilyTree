// 按清华大学研究生院供稿确认导师；Wen 合著候选保留但不升级。
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const person='人员 - UC San Diego - Yi-Zhuang You - 085b7566',weng='师承人物 - Zheng-Yu Weng';
const news='https://www.tsinghua.edu.cn/info/1178/30333.htm',id='https://www.ias.tsinghua.edu.cn/info/1049/1764.htm',name='https://www.ias.tsinghua.edu.cn/info/1039/1058.htm';
const proof=`[清华大学研究生院供稿](${news})明确列高研院尤亦庄的博士论文《铁基超导体的二流体模型》及导师翁征宇；[高研院论坛](${id})将 Yi-Zhuang You（尤亦庄）对应 UCSD，[高研院介绍](${name})对应翁征宇与 Zheng-Yu Weng。关系类型可信度：高。`;
function modify(rel,fn){const f=path.join(root,rel),old=fs.readFileSync(f,'utf8'),v=fn(old);if(v!==old)fs.writeFileSync(f,v,'utf8')}
function addAfter(s,marker,line){if(s.includes(line))return s;if(s.split(marker).length!==2)throw Error('anchor '+marker);return s.replace(marker,marker+'\n'+line+'\n')}
modify('人物/'+person+'.md',s=>{s=addAfter(s,'## 师承\n',`- 博士导师：[[${weng}|Zheng-Yu Weng（翁征宇）]]。${proof}`);const a='- 核查边界：博士期与 Wen 的合著论文仅作追查线索，博士导师仍为候选；Vishwanath 将其列为 Harvard 博士后组员，按课题组关系记录。',b='- 核查边界：清华官方明确翁征宇为博士导师。与 Wen 的博士期合著仅作其他指导角色待查线索，不能据此确认为导师或排除可能的合作指导；Vishwanath 将其列为 Harvard 博士后组员，按课题组关系记录。';if(s.includes(a))s=s.replace(a,b);else if(!s.includes(b))throw Error('boundary missing');return s});
modify('人物/'+weng+'.md',s=>addAfter(s,'## 师承\n',`- 博士生：[[${person}|Yi-Zhuang You（尤亦庄）]]。${proof}`));
modify('师承关系索引.md',s=>{const line=`- [[${person}|Yi-Zhuang You]] → 博士导师：[[${weng}|Zheng-Yu Weng（翁征宇）]]。${proof}`;if(s.includes(line))return s;const marker=`- [[${person}|Yi-Zhuang You]] → 博士导师候选：`;const a=s.split(/\r?\n/).find(x=>x.startsWith(marker));if(!a)throw Error('index anchor');return s.replace(a,line+'\n'+a)});
const caveat=` [清华官方](${news})明确翁征宇为博士导师；与 Wen 的合作不能单独证明其他指导关系。`;
for(const [rel,needle] of [['人物/'+person+'.md','- 博士导师候选：[[人员 - MIT - Xiao-Gang Wen'],['人物/人员 - MIT - Xiao-Gang Wen - 6130f1b4.md','- 博士生候选：[['+person+'|'],['师承关系索引.md','[['+person+'|Yi-Zhuang You]] → 博士导师候选：']])modify(rel,s=>{const lines=s.split(/\r?\n/).filter(x=>x.includes(needle));if(lines.length!==1)throw Error(rel+' candidate');return lines[0].includes(caveat)?s:s.replace(lines[0],lines[0]+caveat)});
modify('UC San Diego逐人复核记录.md',s=>{const marker=`[[${person}|Yi-Zhuang You]]`,m=s.split(/\r?\n/).filter(x=>x.includes(marker));if(m.length!==1)throw Error('school row');let line=m[0].replace('| Xiao-Gang Wen（候选） |','| Zheng-Yu Weng（博士导师）；Xiao-Gang Wen（合著候选，未确认） |');if(!line.includes(news))line=line.replace(/\s*\|\s*$/,`；[清华大学博士论文报道](${news}) |`);return s.replace(m[0],line)});
console.log('博士导师、反向链接、索引和学校表已更新；候选保留');
