const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s,'utf8');
const add=(p,l)=>{const s=read(p);if(!s.includes(l))write(p,s.replace(/\s*$/,'')+'\n'+l+'\n')};
const people=[
 {name:'Chin-Sen Ting',id:'77ca81ad',profile:'https://www.tcsuh.com/people/prininv/ting_chinsen/',cv:'https://tcsuh.com/pdf/cv/ting_chinsen.pdf',topics:['凝聚态理论','高温超导','强关联电子'],research:'凝聚态理论、强关联电子、铜氧化物及铁基超导',phd:'[超导中心履历](https://tcsuh.com/pdf/cv/ting_chinsen.pdf)列 1970 年 UC San Diego 物理博士，导师待核。',post:'[超导中心履历](https://tcsuh.com/pdf/cv/ting_chinsen.pdf)列 1970–1976 年 NYU 和 Brown 博士后，具体分段及导师待核。',next:'查 UC San Diego 1970 博士论文原始档案及 NYU、Brown 博士后项目资料。'},
 {name:'Zhifeng Ren',id:'7a058deb',profile:'https://www.uh.edu/nsm/physics/people/profiles/zhifeng-ren/index.php',cv:'https://uh.edu/uh-energy/research/faculty-cv/ren-zhifeng-cv.pdf',topics:['热电材料','超导材料'],research:'热电材料、超导材料、碳纳米管及热管理',phd:'[本人履历](https://uh.edu/uh-energy/research/faculty-cv/ren-zhifeng-cv.pdf)列 1987–1990 年中国科学院凝聚态物理博士，导师待核。',post:'[本人履历](https://uh.edu/uh-energy/research/faculty-cv/ren-zhifeng-cv.pdf)列 1990–1992 年 SUNY Buffalo 化学系博士后，导师待核。',next:'查中科院物理所 1990 年学位论文与 Buffalo 1990–1992 博士后课题组和指导者。'},
 {name:'Xiao-Jia Chen',id:'825a726c',profile:'https://www.uh.edu/nsm/physics/people/profiles/xiao-jia-chen/index.php',cv:'https://hpstar.ac.cn/upload/files/2015/7/12104955232.pdf',topics:['拓扑量子材料','高温超导','热电材料'],research:'量子材料、高压超导、拓扑及热电性质',phd:'[HPSTAR 讲座简介](https://hpstar.ac.cn/upload/files/2015/7/12104955232.pdf)列 1997 年浙江大学博士，导师待核。',post:'[HPSTAR 讲座简介](https://hpstar.ac.cn/upload/files/2015/7/12104955232.pdf)列 Carnegie 地球物理实验室 research scientist；该职位不能自动视为博士后，具体经历和导师待核。',next:'查浙江大学 1997 博士论文及 Carnegie、Max Planck 等经历的职位与导师；排除同名研究者。'}
];
for(const p of ['院校与机构/院校 - University of Houston.md','University of Houston逐人复核记录.md','已核实院系/已核实单位 - University of Houston - 物理系.md','人物/人员 - Rice - Matthew Foster - 2f0b9b07.md','师承关系索引.md'])if(!fs.existsSync(path.join(root,p)))throw Error('缺少 '+p);
const manifest=JSON.parse(read('graph-manifest.json'));
for(const p of people){p.filename=`人员 - University of Houston - ${p.name} - ${p.id}`;if(manifest.nodes.some(n=>n.id===p.id||n.filename===p.filename||n.unit==='University of Houston'&&n.name===p.name))throw Error('重复记录 '+p.name);if(fs.existsSync(path.join(root,'人物',p.filename+'.md')))throw Error('已有笔记 '+p.filename);for(const t of p.topics)if(!fs.existsSync(path.join(root,'已核实方向',`已核实方向 - ${t}.md`)))throw Error('缺少方向 '+t);}
const student='师承人物 - Sayed Ali Akbar Ghorashi（Houston 2018 博士）', studentSource='https://sites.google.com/view/ghorashiphysics/home';
if(fs.existsSync(path.join(root,'人物',student+'.md')))throw Error('学生节点已存在，需人工检查');
const school='院校与机构/院校 - University of Houston.md', dept='已核实院系/已核实单位 - University of Houston - 物理系.md', table='University of Houston逐人复核记录.md';
let rows=[];
for(const p of people){
  const topicLinks=p.topics.map(t=>`[[已核实方向 - ${t}|${t}]]`).join(' · ');
  let body=`# ${p.name}\n\n## 所在学校或机构\n\n- [[院校 - University of Houston|University of Houston]] · [[已核实单位 - University of Houston - 物理系|物理系]]。\n\n## 院系与研究方向核验（2026-11-06）\n\n- ${p.research}；${topicLinks}。[Houston 院系或超导中心](${p.profile})。\n`;
  if(p.name==='Zhifeng Ren')body+='- 历史本人履历列机械、化学、[[已核实单位 - University of Houston - 电气与计算机工程系|电子与计算机工程]]等多院系任命；[电子与计算机工程系教师页](https://www.ece.uh.edu/faculty/ren)也列本人。具体任命类别及当前状态继续核查。\n';
  body+=`\n## 师承\n\n- 博士导师：未查明。${p.phd}\n- 博士后导师：未查明。${p.post}\n`;
  if(p.name==='Chin-Sen Ting')body+=`- 博士生：[[${student}|Sayed Ali Akbar Ghorashi]]，与 [[人员 - Rice - Matthew Foster - 2f0b9b07|Matthew Foster]] 共同指导。[Ghorashi 本人履历](${studentSource})列 2018 Houston 博士 Advisers: Chin-Sen Ting 与 Matthew Foster；关系类型可信度：高。\n`;
  body+=`\n## 后续核查\n\n- ${p.next}\n`;
  write(`人物/${p.filename}.md`,body);
  manifest.nodes.push({id:p.id,filename:p.filename,name:p.name,unit:'University of Houston',kind:'美国'});
  add(school,`- [[${p.filename}|${p.name}]]`);add(dept,`- [[${p.filename}|${p.name}]] — [院系或超导中心](${p.profile})`);
  for(const t of p.topics)add(`已核实方向/已核实方向 - ${t}.md`,`- [[${p.filename}|${p.name} · University of Houston]] — [学校资料](${p.profile})`);
  rows.push(`| [[${p.filename}|${p.name}]] | 物理系；${p.research} | 未查明 | 未查明 | [学校资料](${p.profile}) · [经历资料](${p.cv}) |`);
  const e={audit_id:`20261106_${p.id}_houston_faculty`,record_id:p.id,aspects:{identity:{status:'confirmed',note:'学校教师资料与经历资料的本人姓名、研究领域和单位交叉核对。',sources:[p.profile,p.cv]},affiliation:{status:'confirmed',note:'Houston 物理系或超导中心原始教师资料确认物理系任职。',sources:[p.profile]},research:{status:'confirmed',note:'学校原始教师资料列出 '+p.research+' 等方向。',sources:[p.profile]},phd:{status:'unresolved',note:p.phd,sources:[p.cv]},postdoc:{status:'unresolved',note:p.post,sources:[p.cv]}},followup_required:true,next_step:p.next};
  write(`自动化/本轮核查-${p.id}-20261106.json`,JSON.stringify(e,null,2)+'\n');
}
write(`人物/${student}.md`,`# Sayed Ali Akbar Ghorashi（Houston 2018 博士）\n\n> [!info] 师承扩展人物\n> 本人页面列 Houston 2018 博士及后续 William & Mary、Stony Brook 研究经历；不与同名者合并。\n\n## 师承\n\n- 博士导师：[[人员 - University of Houston - Chin-Sen Ting - 77ca81ad|Chin-Sen Ting]]、[[人员 - Rice - Matthew Foster - 2f0b9b07|Matthew Foster]]。[本人履历](${studentSource})在 2018 Houston 博士条目列两位 Advisers；关系类型可信度：高。\n`);
const ee='已核实院系/已核实单位 - University of Houston - 电气与计算机工程系.md';
if(!fs.existsSync(path.join(root,ee)))write(ee,'# University of Houston 电气与计算机工程系\n\n[[院校 - University of Houston|返回学校]]\n\n');
add(ee,'- [[人员 - University of Houston - Zhifeng Ren - 7a058deb|Zhifeng Ren]] — [系教师页](https://www.ece.uh.edu/faculty/ren)，具体任命类别待核。');
add(school,'- [[已核实单位 - University of Houston - 电气与计算机工程系|电气与计算机工程系]]');
add('人物/人员 - Rice - Matthew Foster - 2f0b9b07.md',`- 博士生：[[${student}|Sayed Ali Akbar Ghorashi]]，与 [[人员 - University of Houston - Chin-Sen Ting - 77ca81ad|Chin-Sen Ting]] 共同指导。[学生本人履历](${studentSource})列两位博士 Advisers；关系类型可信度：高。`);
add('师承关系索引.md',`- [[${student}|Sayed Ali Akbar Ghorashi]] → 博士导师：[[人员 - University of Houston - Chin-Sen Ting - 77ca81ad|Chin-Sen Ting]]、[[人员 - Rice - Matthew Foster - 2f0b9b07|Matthew Foster]]。[本人履历](${studentSource})明确列两位 Advisers。`);
let t=read(table).replace('\n\n| [[师承人物 - Paul Ching-Wu Chu','\n| [[师承人物 - Paul Ching-Wu Chu');
if(!t.includes('\n## 待逐院系调查'))throw Error('缺少学校表边界');
t=t.replace('\n## 待逐院系调查','\n'+rows.join('\n')+'\n\n## 待逐院系调查');
t=t.replace('- [Xiao-Jia Chen](https://facnewsletter.nsm.uh.edu/issues/august-2023/articles/new-faculty)：学校 2023 年新教员资料列量子材料研究；须复查当前任职及师承。\n','').replace('Zhifeng Ren、Wei-Kan Chu、Byron Freelon、John Miller、Wu-Pei Su、Chin-Sen Ting 等','Wei-Kan Chu、Byron Freelon、John Miller、Wu-Pei Su 等');
write(table,t);
manifest.notes=manifest.nodes.length;manifest.units=new Set(manifest.nodes.map(n=>n.unit)).size;write('graph-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('已补 3 个 Houston 校属节点及一组已证实博士指导关系；待 sync 和导入人工事件。');
