const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),id='4f0e566c',who='师承人物 - John A. Rogers',nelson='人员 - MIT - Keith Adam Nelson - a92c9bbe',white='师承人物 - George M. Whitesides';
const profile='https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/rogers-john.html',lab='https://web.mit.edu/nelsongroup/thegroup/_formergroupmembers.shtml',mag='https://magazine.northwestern.edu/features/stretching-the-imagination';
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),write=(p,s)=>fs.writeFileSync(path.join(root,p),s,'utf8');
const add=(p,l)=>{let s=read(p);if(!s.includes(l))write(p,s.replace(/\s*$/,'')+'\n'+l+'\n')};
const insert=(p,l)=>{let s=read(p);if(s.includes(l))return;const m='\n<!-- PI-AUTO-SEARCH:START -->';write(p,s.includes(m)?s.replace(m,'\n'+l+'\n'+m):s.replace(/\s*$/,'')+'\n'+l+'\n')};
const dept=['材料科学与工程系','电气与计算机工程系','化学系'],topics=['纳米光子学','柔性电子','微纳加工'];
for(const f of [`人物/${who}.md`,`人物/${nelson}.md`,`人物/${white}.md`,'院校与机构/院校 - Northwestern.md','Northwestern逐人复核记录.md','师承关系索引.md',...dept.map(x=>`已核实院系/已核实单位 - Northwestern - ${x}.md`),...topics.map(x=>`已核实方向/已核实方向 - ${x}.md`)])if(!fs.existsSync(path.join(root,f)))throw Error('缺少目标 '+f);
const manifest=JSON.parse(read('graph-manifest.json')),existing=manifest.nodes.filter(n=>n.id===id||n.filename===who||n.unit==='Northwestern'&&/^john\s+(a\.\s*)?rogers$/i.test(n.name));
if(existing.length&&!(existing.length===1&&existing[0].id===id&&existing[0].filename===who))throw Error('校属记录冲突');
const p=`人物/${who}.md`,old=read(p),marker='## 师承';
const intro=`## 所在学校或机构\n\n- [[院校 - Northwestern|Northwestern University]]；保留既有扩展人物文件名和反向链接。\n\n## 院系与研究方向核验（2026-11-06）\n\n- 机构：[[已核实单位 - Northwestern - 材料科学与工程系|材料科学与工程系]]教授，兼生物医学工程与神经外科；[[已核实单位 - Northwestern - 电气与计算机工程系|电气与计算机工程]]、[[已核实单位 - Northwestern - 化学系|化学]]等为 courtesy 任命。[学校工程学院](${profile})。\n- 方向：[[已核实方向 - 柔性电子|柔性电子]]、[[已核实方向 - 纳米光子学|纳米光子学]]与 [[已核实方向 - 微纳加工|微纳加工]]；研究软材料、电子与光子响应。[学校工程学院](${profile})。\n\n`;
if(!old.includes('## 所在学校或机构')){if(!old.includes(marker))throw Error('缺少师承标题');write(p,old.replace(marker,intro+marker))}
insert(p,`- 博士课题组负责人、正式博士导师候选：[[${nelson}|Keith A. Nelson]]。[MIT Nelson 组毕业生名单](${lab})列 John Rogers 为 1995 年博士生并给出论文题目、Illinois 教职；[Northwestern 工程学院](${profile})确认 MIT 物理化学博士及本人研究经历，时间和身份一致。名单证实博士组属，未明确 thesis advisor 称谓，待论文原文；可信度：高（组属）。`);
insert(p,`- 博士后阶段研究师长：[[${white}|George M. Whitesides]]。[Northwestern 校刊人物报道](${mag})称 Rogers 为 Harvard Junior Fellow 时与 Whitesides 学习，后文称其为博士后 fellowship；未直接标注正式导师职衔。可信度：高（阶段研究指导）。`);
insert(`人物/${nelson}.md`,`- 博士课题组成员：[[${who}|John A. Rogers]]。[MIT Nelson 组毕业生名录](${lab})列 1995 年 John Rogers 博士毕业及 Illinois 教职；正式 thesis advisor 仍待论文确认。`);
insert(`人物/${white}.md`,`- 博士后阶段研究者：[[${who}|John A. Rogers]]。[Northwestern 校刊](${mag})称其 Harvard Junior Fellow 时与 Whitesides 学习，后文将其经历称为博士后 fellowship；正式导师职衔待核。`);
if(!existing.length){manifest.nodes.push({id,filename:who,name:'John A. Rogers',unit:'Northwestern',kind:'美国'});write('graph-manifest.json',JSON.stringify(manifest,null,2)+'\n')}
add('院校与机构/院校 - Northwestern.md',`- [[${who}|John A. Rogers]]`);
for(const d of dept)add(`已核实院系/已核实单位 - Northwestern - ${d}.md`,`- [[${who}|John A. Rogers]] — [Northwestern 工程学院](${profile})${d==='材料科学与工程系'?'':'（courtesy）'}`);
for(const t of topics)add(`已核实方向/已核实方向 - ${t}.md`,`- [[${who}|John A. Rogers · Northwestern]] — [Northwestern 工程学院](${profile})`);
add('Northwestern逐人复核记录.md',`| [[${who}|John A. Rogers]] | 材料科学与工程、生物医学工程；电气与计算机工程、化学为 courtesy；柔性电子、纳米光子与微纳加工 | Keith A. Nelson（博士组属；正式导师待核） | George M. Whitesides（博士后阶段研究师长，正式职衔待核） | [院系](${profile})；[MIT 组名录](${lab})；[Northwestern 访谈](${mag}) |`);
add('师承关系索引.md',`- [[${who}|John A. Rogers]] → 博士课题组负责人、正式导师候选：[[${nelson}|Keith A. Nelson]]。[MIT 组毕业生名录](${lab})确认 1995 年毕业及 Illinois 教职，正式 thesis advisor 称谓待核。`);
add('师承关系索引.md',`- [[${who}|John A. Rogers]] → 博士后阶段研究师长：[[${white}|George M. Whitesides]]。[Northwestern 校刊](${mag})称 Harvard Junior Fellow 与 Whitesides 学习，后文称博士后 fellowship，正式导师职衔待核。`);
const e={audit_id:'20261106_4f0e566c_john_rogers_northwestern',record_id:id,aspects:{identity:{status:'confirmed',note:'MIT Nelson 组名录列 1995 博士 John Rogers 和 Illinois 教职；Northwestern 工程页列 MIT 物理化学博士及 Northwestern 教授，校刊追溯 Illinois 经历。',sources:[lab,profile,mag]},affiliation:{status:'confirmed',note:'Northwestern 材料与生医工程教授；电气与计算机工程、化学等为 courtesy。',sources:[profile]},research:{status:'confirmed',note:'软材料的电子与光子响应、柔性电子和纳米光子器件。',sources:[profile]},phd:{status:'group_or_candidate',note:'MIT Nelson 组名录列 John Rogers 1995 博士及 Illinois 任职，正式论文 advisor 字段待核。',sources:[lab,profile]},postdoc:{status:'group_or_candidate',note:'Northwestern 校刊称 Harvard Junior Fellow 时与 Whitesides 学习并称相关经历为博士后 fellowship；正式 advisor 待核。',sources:[mag]}},followup_required:true,next_step:'查 MIT 学位论文 Advisor 字段及 Harvard 本人 CV 或正式博后指导记录。'};
write('自动化/本轮核查-John-Rogers-20261106.json',JSON.stringify(e,null,2)+'\n');console.log('已补校属记录，保留原扩展节点。');
