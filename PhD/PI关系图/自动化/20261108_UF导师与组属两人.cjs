// 逐人核对原文后补录；一手资料不能证明正式导师时只登记组属或阶段研究关系。
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),school='University of Florida';
const rd=p=>fs.readFileSync(path.join(root,p),'utf8'),wr=(p,s)=>fs.writeFileSync(path.join(root,p),s,'utf8');
const pp=[
  {
    "id": "7e112b30",
    "name": "Kevin Ingersent",
    "faculty": "https://phys.ufl.edu/directory/kevin-ingersent/",
    "self": "https://people.clas.ufl.edu/ingersent/files/2026/04/vita.pdf",
    "research": "强关联电子、量子杂质、Kondo 效应及非费米液体",
    "topics": [
      "凝聚态理论",
      "强关联电子",
      "量子材料"
    ],
    "phdStatus": "confirmed_advisor",
    "postStatus": "confirmed_advisor",
    "phd": "1990 Pennsylvania 博士；本人 CV 明列博士阶段 mentor Paul J. Steinhardt，论文正式 advisor 字段待核",
    "post": "1990–1992 Ohio State 博士后；本人 CV 明列博士后 mentor John W. Wilkins，正式聘任 advisor 称谓待核",
    "rels": [
      {
        "stage": "phd",
        "kind": "stage_mentor",
        "mentor": "人员 - Princeton - Paul J. Steinhardt - c9ac030a",
        "display": "Paul J. Steinhardt",
        "label": "博士阶段研究师长",
        "reverse": "博士阶段受指导者",
        "evidence": "本人 2026 年 CV 在 Doctoral and Postdoctoral Mentors 下明确将 Paul J. Steinhardt 列为 doctoral mentor；1990 Pennsylvania PhD，论文正式 advisor 字段待核。",
        "sources": [
          "https://people.clas.ufl.edu/ingersent/files/2026/04/vita.pdf"
        ]
      },
      {
        "stage": "postdoc",
        "kind": "stage_mentor",
        "mentor": "师承人物 - John W. Wilkins",
        "display": "John W. Wilkins",
        "label": "博士后阶段研究师长",
        "reverse": "博士后阶段受指导者",
        "evidence": "本人 2026 年 CV 明列 John W. Wilkins 为 postdoctoral mentor，且列 1990–1992 Ohio State 博士后；正式岗位 advisor 称谓待核。",
        "sources": [
          "https://people.clas.ufl.edu/ingersent/files/2026/04/vita.pdf"
        ]
      }
    ]
  },
  {
    "id": "d2af2825",
    "name": "James Hamlin",
    "faculty": "https://phys.ufl.edu/directory/james-hamlin/",
    "self": "https://phys.ufl.edu/2019/03/01/faculty-profile-james-hamlin/",
    "research": "高压凝聚态实验、非常规超导及电子磁性材料",
    "topics": [
      "超导",
      "量子材料"
    ],
    "phdStatus": "group_or_candidate",
    "postStatus": "group_or_candidate",
    "phd": "2007 Washington University in St. Louis 博士；James S. Schilling 研究组，正式论文 advisor 待核",
    "post": "2008 起 UC San Diego 博士后加入 M. Brian Maple 组；正式岗位 advisor 待核",
    "rels": [
      {
        "stage": "phd",
        "kind": "group_leader",
        "mentor": "师承人物 - James S. Schilling",
        "display": "James S. Schilling",
        "label": "博士课题组负责人",
        "reverse": "博士课题组成员",
        "evidence": "Washington University 校友页称 Hamlin 2007 博士并在 Schilling 研究组完成研究；UF 人物介绍明确 Schilling 全名、毕业后留组读博，论文正式 advisor 字段待核。",
        "sources": [
          "https://physics.washu.edu/alumni",
          "https://phys.ufl.edu/2019/03/01/faculty-profile-james-hamlin/"
        ]
      },
      {
        "stage": "postdoc",
        "kind": "group_leader",
        "mentor": "人员 - UC San Diego - M. Brian Maple - bbe5869d",
        "display": "M. Brian Maple",
        "label": "博士后课题组负责人",
        "reverse": "博士后课题组成员",
        "evidence": "Washington University 校友页和 Schilling 组校友页均列 Hamlin 2008 年加入 UCSD Maple 组为博士后；正式岗位 advisor 称谓待核。",
        "sources": [
          "https://physics.washu.edu/alumni",
          "https://web.physics.wustl.edu/jss/where.html"
        ]
      }
    ]
  }
];
const sf=path.join(root,'人物','师承人物 - James S. Schilling.md'); if(fs.existsSync(sf))throw Error('Schilling 节点已存在，先核对'); fs.writeFileSync(sf,'# James S. Schilling\n\n> [!info] 师承扩展人物\n> Washington University 物理荣休教授；本科和博士经历及其学校任职见 [院系页面](https://physics.washu.edu/people/james-schilling)。\n\n## 师承\n\n',{flag:'wx'});
const m=JSON.parse(rd('graph-manifest.json'));for(const p of pp){p.filename=`人员 - ${school} - ${p.name} - ${p.id}`;if(m.nodes.some(n=>n.id===p.id||n.filename===p.filename||n.unit===school&&n.name===p.name)||fs.existsSync(path.join(root,'人物',p.filename+'.md')))throw Error('人物重复 '+p.name);for(const r of p.rels){const s=rd(`人物/${r.mentor}.md`);if(s.split('## 师承\n').length!==2||s.includes(`[[${p.filename}|`))throw Error('导师标题或反链异常 '+r.mentor)}for(const t of p.topics)if(!fs.existsSync(path.join(root,'已核实方向',`已核实方向 - ${t}.md`)))throw Error('方向缺失 '+t)}
const dept=`已核实单位 - ${school} - 物理系`;for(const p of [`院校与机构/院校 - ${school}.md`,`已核实院系/${dept}.md`,`${school}逐人复核记录.md`,`${school}院系待核候选.md`,'师承关系索引.md'])if(!fs.existsSync(path.join(root,p)))throw Error('缺少 '+p);
function append(p,l){const s=rd(p);if(!s.includes(l))wr(p,s.replace(/\s*$/,'')+'\n'+l+'\n')}
for(const p of pp){const links=p.topics.map(t=>`[[已核实方向 - ${t}|${t}]]`).join(' · '),lines=p.rels.map(r=>`- ${r.label}：[[${r.mentor}|${r.display}]]。${r.evidence} ${r.sources.map((u,i)=>`[来源${i+1}](${u})`).join('；')}`).join('\n');
 wr(`人物/${p.filename}.md`,`# ${p.name}\n\n> [!info] 漏校新增记录\n> ${school} 各相关院系尚未查全。\n\n## 所在的学校或机构记录\n\n- [[院校 - ${school}|${school}]] · [[${dept}|物理系]]。\n\n## 院系与研究方向核验（2026-11-08）\n\n- UF 物理系；${p.research}；${links}。[院系或本人资料](${p.faculty})；[研究资料](${p.researchSource||p.faculty})。\n\n## 师承\n\n${lines}\n- 核查边界：${p.phd}；${p.post}。\n`);
 append(`院校与机构/院校 - ${school}.md`,`- [[${p.filename}|${p.name}]]`);append(`已核实院系/${dept}.md`,`- [[${p.filename}|${p.name}]] — [UF 物理系](${p.faculty})`);for(const t of p.topics)append(`已核实方向/已核实方向 - ${t}.md`,`- [[${p.filename}|${p.name} · ${school}]] — [UF 物理系](${p.faculty})`);
 for(const r of p.rels){const f=`人物/${r.mentor}.md`,s=rd(f),line=`- ${r.reverse}：[[${p.filename}|${p.name}]]。${r.evidence} ${r.sources.map((u,i)=>`[来源${i+1}](${u})`).join('；')}`;wr(f,s.replace('## 师承\n','## 师承\n\n'+line+'\n'));append('师承关系索引.md',`- [[${p.filename}|${p.name}]] → ${r.label}：[[${r.mentor}|${r.display}]]。${r.evidence} ${r.sources.map((u,i)=>`[来源${i+1}](${u})`).join('；')}`)}
 const table=`${school}逐人复核记录.md`,row=`| [[${p.filename}|${p.name}]] | 物理；${p.research} | ${p.phd} | ${p.post} | [UF 院系](${p.faculty}) · [本人资料](${p.self}) |`;let s=rd(table);if(!s.includes('\n## 待逐院系调查'))throw Error('学校表缺边界');wr(table,s.replace('\n## 待逐院系调查','\n'+row+'\n\n## 待逐院系调查'));
 const candidate=`${school}院系待核候选.md`;s=rd(candidate);const old=`- ${p.name}\n`;if(!s.includes(old))throw Error('候选清单缺 '+p.name);wr(candidate,s.replace(old,`- ${p.name}（已纳入逐人表；未解决项目继续追查）\n`));
 m.nodes.push({id:p.id,filename:p.filename,name:p.name,unit:school,kind:'美国'});const aid=`20261108_uf_${p.id}_primary`,aspects={identity:{status:'confirmed',note:'UF 院系页与本人履历、已核学位和研究方向对应。',sources:[...new Set([p.faculty,p.self,...p.rels[0].sources])]},affiliation:{status:'confirmed',note:'UF 物理系教师。',sources:[p.faculty]},research:{status:'confirmed',note:p.research,sources:[p.researchSource||p.faculty]},phd:{status:p.phdStatus,note:p.phd,sources:p.rels.filter(r=>r.stage==='phd').flatMap(r=>r.sources)},postdoc:{status:p.postStatus,note:p.post,sources:p.rels.filter(r=>r.stage==='postdoc').flatMap(r=>r.sources)}};const audit={audit_id:aid,record_id:p.id,aspects,followup_required:true,next_step:'继续逐院系查 UF 名单；核论文原文、各博后阶段及正式导师称谓。'};
 const typed=p.rels.map((r,i)=>({event_id:`20261108_uf_${p.id}_${r.stage}_${i}`,record_id:p.id,stage:r.stage,mentor_filename:r.mentor,kind:r.kind,source_audit_id:aid,evidence:r.evidence,sources:r.sources}));wr(`自动化/人工-20261108-UF-${p.id}.json`,JSON.stringify(audit,null,2)+'\n');wr(`自动化/结构化-20261108-UF-${p.id}.json`,JSON.stringify(typed,null,2)+'\n');}
m.notes=m.nodes.length;m.units=new Set(m.nodes.map(n=>n.unit)).size;wr('graph-manifest.json',JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({added:pp.map(x=>x.name),total:m.nodes.length}));
