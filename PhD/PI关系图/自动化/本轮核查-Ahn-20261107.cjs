const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),{spawnSync}=require('child_process');
const root=path.join(__dirname,'..'),id='11b84b60',snu='https://ctp.snu.ac.kr/files/newsletters/2021.pdf',award='https://ctp.snu.ac.kr/files/newsletters/2022.pdf',names='https://physics.snu.ac.kr/en/boards/news?bbsidx=6219&md=v';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!row)throw Error('缺少台账');const e=JSON.parse(row.details_json);db.close();
e.audit_id='20261107_ahn_snu_advisor_'+id;e.aspects.phd={status:'confirmed_advisor',note:'首尔国立大学理论物理研究所博士毕业名录在导师（지도교수）列明确将 2020 年毕业的 안준영 对应 양범정，论文题目 Band Topology of Space-Time Inversion Symmetric Systems；研究所 2022 获奖报道亦明示导师。SNU 英文报道与研究方向对应 Junyeong Ahn、Bohm-Jung Yang。',sources:[snu,award,names]};e.followup_required=true;e.next_step='博士正式导师已核；继续核 Harvard Vishwanath 博后具体职称及 RIKEN/Tokyo 阶段导师。';
const out=path.join(__dirname,'本轮核查-Ahn-'+id+'-20261107.json');fs.writeFileSync(out,JSON.stringify(e,null,2)+'\n');const r=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',out],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout.trim());
function edit(rel,old,neu){const f=path.join(root,rel),s=fs.readFileSync(f,'utf8');if(s.split(old).length!==2)throw Error('不唯一 '+rel);fs.writeFileSync(f,s.replace(old,neu));}
const subject='[[人员 - UT Austin - Junyeong Ahn - 11b84b60|Junyeong Ahn]]',mentor='[[师承人物 - Bohm-Jung Yang|Bohm-Jung Yang]]';
const evidence=`[SNU 2021 博士毕业名录](${snu})导师（지도교수）栏列 안준영 对应 양범정；[2022 年获奖报道](${award})再次明确指导教授。[SNU 英文报道](${names})对应两人英文名、课题组及拓扑研究。`;
const old=`- 博士阶段课题组负责人：${mentor}。[来源](https://sites.google.com/site/bjyanglab/members) 证据：Yang 本人组校友页列 Ahn 为 2015–2020 PhD；只确证博士阶段组属。关系类型可信度：高。`;
edit('人物/人员 - UT Austin - Junyeong Ahn - 11b84b60.md',old,`- 博士导师：${mentor}。${evidence} 关系类型可信度：高。`);
edit('人物/人员 - UT Austin - Junyeong Ahn - 11b84b60.md','- 核查边界：Yang 实验室列其为博士生，标课题组负责人；本人称 Harvard 博后与 Vishwanath 工作，标研究师长；RIKEN/Tokyo 博后导师待核，论文只构成候选线索。','- 核查边界：SNU 博士毕业及获奖资料明确 Yang 为指导教授；本人称 Harvard 博后与 Vishwanath 工作，标研究师长；RIKEN/Tokyo 博后导师待核，论文只构成候选线索。');
const rev=`- 博士阶段课题组成员：${subject}。[来源](https://sites.google.com/site/bjyanglab/members) 证据：Yang 本人组校友页列 Ahn 为 2015–2020 PhD；只确证博士阶段组属。关系类型可信度：高。`;
edit('人物/师承人物 - Bohm-Jung Yang.md',rev,`- 博士生：${subject}。${evidence}`);
const idx=`- ${subject} → 博士阶段课题组负责人：${mentor}。[来源](https://sites.google.com/site/bjyanglab/members) 证据：Yang 本人组校友页列 Ahn 为 2015–2020 PhD；只确证博士阶段组属。关系类型可信度：高。`;
edit('师承关系索引.md',idx,`- ${subject} → 博士导师：${mentor}。${evidence}`);
edit('UT Austin逐人复核记录.md','Bohm-Jung Yang（[博士课题组](https://sites.google.com/site/bjyanglab/members)）',`Bohm-Jung Yang（[SNU 博士毕业名录](${snu})明确导师）`);
console.log('人物、反链、索引、学校表已同步');
