// 基于 Ohio State 人物页与 Berkeley、UCSB 组校友页补录；正式 advisor 仍待原始论文核实。
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const rd=p=>fs.readFileSync(path.join(root,p),'utf8'),wr=(p,s)=>fs.writeFileSync(path.join(root,p),s,'utf8');
const id='f93ba010',name='Yiying Wu',school='Ohio State',person=`人员 - ${school} - ${name} - ${id}`,dept='已核实单位 - Ohio State - 化学与生物化学系';
const faculty='https://www.chemistry.ohio-state.edu/people/wu.531', research='https://chemistry.osu.edu/research/faculty', berkeley='https://nanowires.berkeley.edu/people/', ucsb='https://labs.chem.ucsb.edu/stucky/galen/stuckygroup/Past.html';
const rels=[{stage:'phd',mentor:'人员 - UC Berkeley - Peidong Yang - 67716191',display:'Peidong Yang',label:'博士课题组负责人',reverse:'博士课题组成员',evidence:'Ohio State 本人简介称 2003 年 Berkeley 博士 with Peidong Yang；Yang 课题组博士校友名录列 Yiying Wu、Ohio State 去向。确认组属，正式论文 advisor 待核。',sources:[faculty,berkeley]},
{stage:'postdoc',mentor:'师承人物 - Galen D. Stucky',display:'Galen D. Stucky',label:'博士后课题组负责人',reverse:'博士后课题组成员',evidence:'Ohio State 简介称其 UCSB 博士后研究 with Galen D. Stucky；Stucky 组历届成员名录列 Yiying Wu，Ohio State 主页对应。确认组属，正式岗位 advisor 待核。',sources:[faculty,ucsb]}];
const topics=['材料化学','氧化物半导体','光电化学'];
const m=JSON.parse(rd('graph-manifest.json'));
if(m.nodes.some(x=>x.id===id||x.filename===person||x.unit===school&&/yiying\s+wu/i.test(x.name))||fs.existsSync(path.join(root,'人物',person+'.md')))throw Error('人员已存在或 ID 冲突');
for(const f of [`院校与机构/院校 - ${school}.md`,`已核实院系/${dept}.md`,`${school}逐人复核记录.md`,'师承关系索引.md',...topics.map(t=>`已核实方向/已核实方向 - ${t}.md`),...rels.map(r=>`人物/${r.mentor}.md`)])if(!fs.existsSync(path.join(root,f)))throw Error('缺少 '+f);
for(const r of rels)if(rd(`人物/${r.mentor}.md`).split('## 师承\n').length!==2)throw Error('师长章节异常 '+r.mentor);
function append(f,line){let x=rd(f);if(!x.includes(line))wr(f,x.replace(/\s*$/,'')+'\n'+line+'\n')}
const relations=rels.map(r=>`- ${r.label}：[[${r.mentor}|${r.display}]]。${r.evidence} ${r.sources.map((u,i)=>`[来源${i+1}](${u})`).join('；')}`).join('\n');
wr(`人物/${person}.md`,`# ${name}\n\n> [!info] 院系补录\n> 本条依据 Ohio State 化学系本人页和课题组原始名录核实；学校及其他院系未因此视为查全。\n\n## 所在的学校或机构记录\n\n- [[院校 - Ohio State|Ohio State]] · [[${dept}|化学与生物化学系]]。\n\n## 院系与研究方向核验（2026-11-08）\n\n- Ohio State 化学与生物化学系教授；固态及纳米材料化学、氧化物半导体与光电化学，偏相邻材料方向。${topics.map(t=>`[[已核实方向 - ${t}|${t}]]`).join(' · ')}。[本人院系主页](${faculty})；[院系研究目录](${research})。\n\n## 师承\n\n${relations}\n\n- 核查边界：两阶段均有可对应的课题组原名录，但这些网页没有分别给出论文签署 advisor 与博士后正式聘任 advisor；继续查本人论文和履历。\n`);
append(`院校与机构/院校 - ${school}.md`,`- [[${person}|${name}]]`);
append(`已核实院系/${dept}.md`,`- [[${person}|${name}]] — [Ohio State 院系主页](${faculty})`);
for(const t of topics)append(`已核实方向/已核实方向 - ${t}.md`,`- [[${person}|${name} · ${school}]] — [Ohio State 院系主页](${faculty})`);
for(const r of rels){const f=`人物/${r.mentor}.md`,s=rd(f),source=r.sources.map((u,i)=>`[来源${i+1}](${u})`).join('；');wr(f,s.replace('## 师承\n',`## 师承\n\n- ${r.reverse}：[[${person}|${name}]]。${r.evidence} ${source}\n`));append('师承关系索引.md',`- [[${person}|${name}]] → ${r.label}：[[${r.mentor}|${r.display}]]。${r.evidence} ${source}`)}
append(`${school}逐人复核记录.md`,`| [[${person}|${name}]] | 化学与生物化学；固态与纳米材料、氧化物半导体、光电化学 | Peidong Yang（Berkeley 博士组负责人，正式导师称谓待核） | Galen D. Stucky（UCSB 博士后组负责人，正式导师称谓待核） | [Ohio State](${faculty})；[Yang 组](${berkeley})；[Stucky 组](${ucsb}) |`);
m.nodes.push({id,filename:person,name,unit:school,kind:'美国'});m.notes=m.nodes.length;m.units=new Set(m.nodes.map(x=>x.unit)).size;wr('graph-manifest.json',JSON.stringify(m,null,2)+'\n');
const aid='20261108_osu_yiying_wu_add',audit={audit_id:aid,record_id:id,aspects:{identity:{status:'confirmed',note:'Ohio State 院系本人页与两组校友名录中 Ohio State 去向和博士阶段匹配。',sources:[faculty,berkeley,ucsb]},affiliation:{status:'confirmed',note:'Ohio State 化学与生物化学系教授。',sources:[faculty]},research:{status:'confirmed',note:'固态纳米材料、氧化物半导体及光电化学，属于相邻材料方向。',sources:[faculty,research]},phd:{status:'group_or_candidate',note:rels[0].evidence,sources:rels[0].sources},postdoc:{status:'group_or_candidate',note:rels[1].evidence,sources:rels[1].sources}},followup_required:true,next_step:'查 Berkeley 2003 博士论文 advisor 字段和 UCSB 博后正式岗位指导者；继续 Ohio State 各院系核查。'};
const typed=rels.map((r,i)=>({event_id:`20261108_osu_yiying_wu_${r.stage}_${i}`,record_id:id,stage:r.stage,mentor_filename:r.mentor,kind:'group_leader',source_audit_id:aid,evidence:r.evidence,sources:r.sources}));
wr('自动化/人工-20261108-OSU-YiyingWu.json',JSON.stringify(audit,null,2)+'\n');wr('自动化/结构化-20261108-OSU-YiyingWu.json',JSON.stringify(typed,null,2)+'\n');
console.log(JSON.stringify({added:person,total:m.nodes.length}));
