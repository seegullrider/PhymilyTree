// 逐人核对原文后补录；一手资料不能证明正式导师时只登记组属或阶段研究关系。
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),school='University of Florida';
const rd=p=>fs.readFileSync(path.join(root,p),'utf8'),wr=(p,s)=>fs.writeFileSync(path.join(root,p),s,'utf8');
const pp=[
  {
    "id": "2625e7a6",
    "name": "Yoonseok Lee",
    "faculty": "https://phys.ufl.edu/people/faculty/yoonseok-lee/",
    "self": "https://people.clas.ufl.edu/ysl/curriculum-vitae/",
    "research": "超低温凝聚态实验、液态与固态氦三及低维导体",
    "topics": [
      "凝聚态实验",
      "低温物理"
    ],
    "phdStatus": "confirmed_advisor",
    "postStatus": "group_or_candidate",
    "phd": "1997 Northwestern 物理博士，本人 CV 列论文 Advisor W. P. Halperin，Northwestern 校友报道确认为 William Halperin",
    "post": "1997–1999 Northwestern 博后 with W. P. Halperin，1999–2001 Stanford 博后 with D. D. Osheroff；仅确认阶段研究关联，正式岗位 advisor 待核",
    "rels": [
      {
        "stage": "phd",
        "kind": "advisor",
        "mentor": "人员 - Northwestern - William Halperin - 205f65de",
        "display": "William P. Halperin",
        "label": "博士导师",
        "reverse": "博士生",
        "evidence": "本人 CV 的 1997 Northwestern 博士论文条目明确列 Advisor W. P. Halperin；Northwestern 2005 年校友通讯将其全名写为 William Halperin，论文原文可再复核。",
        "sources": [
          "https://people.clas.ufl.edu/ysl/curriculum-vitae/",
          "https://physics.northwestern.edu/documents/dimensions/dimensions-spring2005.pdf"
        ]
      },
      {
        "stage": "postdoc",
        "kind": "candidate",
        "mentor": "人员 - Northwestern - William Halperin - 205f65de",
        "display": "William P. Halperin",
        "label": "博士后研究关联者",
        "reverse": "博士后研究关联者",
        "evidence": "本人 CV 列 1997 年 9 月至 1999 年 2 月 Northwestern 博士后 with W. P. Halperin；明确研究关联，未写正式 advisor。",
        "sources": [
          "https://people.clas.ufl.edu/ysl/curriculum-vitae/"
        ]
      },
      {
        "stage": "postdoc",
        "kind": "candidate",
        "mentor": "师承人物 - Douglas D. Osheroff",
        "display": "Douglas D. Osheroff",
        "label": "博士后研究关联者",
        "reverse": "博士后研究关联者",
        "evidence": "本人 CV 列 1999 年 3 月至 2001 年 7 月 Stanford 博士后 with D. D. Osheroff；仅确认阶段研究关联，正式 advisor 待核。",
        "sources": [
          "https://people.clas.ufl.edu/ysl/curriculum-vitae/"
        ]
      }
    ]
  }
];
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
