const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'), unit='University of Virginia', name='Liqin Ke', id=crypto.createHash('sha256').update(`${unit}\n${name}\n20261108`).digest('hex').slice(0,8), person=`人员 - ${unit} - ${name} - ${id}`;
const school=`院校 - ${unit}`,mat=`已核实单位 - ${unit} - 材料科学与工程系`,phys=`已核实单位 - ${unit} - 物理系`,mentor='师承人物 - Mark van Schilfgaarde';
const faculty='https://engineering.virginia.edu/faculty/liqin-ke',bio='https://liqinke.github.io/about.html',thesis='https://www.opendata.uni-halle.de/bitstream/1981185920/7991/1/PhD_thesis_Danny_Thonig.pdf';
const manifestFile=path.join(root,'graph-manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8')),files=new Map();
if(manifest.nodes.some(x=>x.id===id||x.unit===unit&&/\bliqin\s+ke\b/i.test(x.name)))throw Error('已有记录，先核重');
function edit(rel,fn){const f=path.join(root,rel);if(!fs.existsSync(f))throw Error('缺少 '+rel);const old=files.has(f)?files.get(f):fs.readFileSync(f,'utf8');files.set(f,fn(old));}
function fresh(rel,s){const f=path.join(root,rel);if(fs.existsSync(f)||files.has(f))throw Error('已存在 '+rel);files.set(f,s);}
function append(rel,s){edit(rel,x=>x.replace(/\s*$/,'')+'\n'+s+'\n');}
const evidence=`[本人履历](${bio})明确 2009 年 Arizona State 博士研究在 Mark van Schilfgaarde 指导下完成；正式论文 advisor 字段待核。[大学馆藏论文参考文献](${thesis})列其博士论文题名与年份。`;
fresh('人物/'+person+'.md',`# ${name}\n\n> [!info] UVA 校属人员\n> 学校和研究方向已据官方教师页核实；招生状态和师承细节仍待核。\n\n## 学校、院系与研究方向\n\n- [[${school}|University of Virginia]]；[[${mat}|材料科学与工程系]]副教授，[[${phys}|物理系]]兼任副教授。[UVA 教师页](${faculty})\n- [[已核实方向 - 计算材料科学|计算材料科学]] · [[已核实方向 - 计算凝聚态物理|计算凝聚态物理]] · [[已核实方向 - 量子材料|量子材料]] · [[已核实方向 - 磁性材料|磁性材料]]：电子结构、二维范德华及磁性拓扑量子材料、磁性和电子光学性质。[UVA 教师页](${faculty})\n\n## 师承\n\n- 博士阶段研究师长：[[${mentor}|Mark van Schilfgaarde]]。${evidence}\n- 博士后：本人履历与 UVA 教师页未明确列出博士后具体任职及指导者，待查。\n- 核查边界：查 ASU 2009 论文 *First principles study of atomic-scale nanowires and dynamical transverse spin susceptibility* 原件及 advisor 字段；查 Ames 博士后经历与指导者，不能凭论文合著推断。\n`);
fresh('人物/'+mentor+'.md',`# Mark van Schilfgaarde\n\n师承扩展节点；[Liqin Ke 本人履历](${bio})列其为博士阶段研究师长。其他任职与师承待核。\n\n## 师承\n\n- 博士阶段研究者：[[${person}|${name}]]。${evidence}\n`);
fresh('已核实院系/'+phys+'.md',`# ${unit}：物理系\n\n[[${school}|返回学校]]\n\n本页只收录已核实人员，物理系及兼任人员尚未查全。\n\n- [[${person}|${name}]]（兼任）— [UVA](${faculty})\n`);
append('院校与机构/'+school+'.md',`- [[${phys}|物理系]]\n- [[${person}|${name}]]`);
append('已核实院系/'+mat+'.md',`- [[${person}|${name}]] — [UVA](${faculty})`);
for(const d of ['计算材料科学','计算凝聚态物理','量子材料','磁性材料'])append('已核实方向/已核实方向 - '+d+'.md',`- [[${person}|${name} · Virginia]] — [UVA](${faculty})`);
append('师承关系索引.md',`- [[${person}|${name}]] → 博士阶段研究师长：[[${mentor}|Mark van Schilfgaarde]]。${evidence}`);
append(unit+'逐人复核记录.md',`| [[${person}|${name}]] | 材料科学与工程系；物理系兼任；计算凝聚态、电子结构、磁性量子材料 | Mark van Schilfgaarde（博士阶段研究师长；正式论文导师待核） | 未明确 | [UVA](${faculty}) · [本人履历](${bio}) · [论文题名](${thesis}) |`);
edit(unit+'院系筛查待办.md',x=>{const old='- Liqin Ke：电子结构、凝聚态与磁光电材料；兼物理系。';if(!x.includes(old))throw Error('未找到待办');return x.replace(old,`- [[${person}|Liqin Ke]]：已补录；博士阶段研究师长已证，正式导师字段和博士后经历待核。`)});
manifest.nodes.push({id,filename:person,name,unit,kind:'美国'});manifest.notes=manifest.nodes.length;manifest.units=new Set(manifest.nodes.map(x=>x.unit)).size;files.set(manifestFile,JSON.stringify(manifest,null,2)+'\n');
const audit={audit_id:'20261108_uva_liqin_ke',record_id:id,aspects:{identity:{status:'confirmed',note:'本人履历列 2009 ASU 博士及 Ames 任职，UVA 教师页列同姓名、ASU 博士、此前 Ames 科学家及相同研究方向，支持同人。',sources:[faculty,bio]},affiliation:{status:'confirmed',note:'UVA 教师页明确材料科学与工程副教授、物理系 courtesy 副教授。',sources:[faculty]},research:{status:'confirmed',note:'UVA 教师页列计算材料科学与凝聚态交叉、电子结构、二维及磁性拓扑量子材料和磁性。',sources:[faculty]},phd:{status:'group_or_candidate',note:'本人履历明确 2009 ASU 博士在 Mark van Schilfgaarde 指导下完成，记博士阶段研究师长；论文正式 advisor 字段尚待查。大学馆藏参考文献证论文题名与年校。',sources:[bio,thesis]},postdoc:{status:'unresolved',note:'已读 UVA 教师页与本人旧履历，未明确列博士后任职或指导者；未知不等于没有经历。',sources:[faculty,bio]}},followup_required:true,next_step:'按论文题名查 ASU 2009 论文原件及 advisor 字段；查 Ames 博士后履历与指导者，不能仅凭合著推断。'};
const edge=[{event_id:'20261108_uva_liqin_ke_phd',record_id:id,stage:'phd',mentor_filename:mentor,kind:'stage_mentor',source_audit_id:audit.audit_id,evidence:'本人履历写 2009 年 ASU 博士在 Mark van Schilfgaarde 指导下完成；正式论文 advisor 字段待核。',sources:[bio,thesis]}];
files.set(path.join(__dirname,'人工-20261108-uva-liqinke.json'),JSON.stringify(audit,null,2)+'\n');files.set(path.join(__dirname,'结构化-20261108-uva-liqinke.json'),JSON.stringify(edge,null,2)+'\n');
for(const [f,s] of files)fs.writeFileSync(f,s,'utf8');console.log(JSON.stringify({id,person,files:files.size}));
