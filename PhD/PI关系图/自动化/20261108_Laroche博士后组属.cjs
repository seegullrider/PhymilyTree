// 基于 QuTech 和 Kavli 原网页补博士后组属，不推断正式 advisor。
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..'),id='e800f362';
const p='人员 - University of Florida - Dominique Laroche - '+id,m='师承人物 - Leo Kouwenhoven';
const rd=x=>fs.readFileSync(path.join(root,x),'utf8'),wr=(x,s)=>fs.writeFileSync(path.join(root,x),s,'utf8');
const lab='https://qutech.nl/lab/kouwenhoven-lab/kouwenhoven-lab-people/',kavli='https://kavli.tudelft.nl/wp-content/uploads/2018/04/13884-02-Kavli-21-2018webDEF.pdf',aps='https://journals.aps.org/prb/staff',cv='https://people.clas.ufl.edu/dlaroc10/files/CV-Dominique-Laroche-2019.pdf';
const evidence='QuTech Kouwenhoven Lab 名录在 Former Postdoctoral fellows 列 Dominique Laroche；Kavli 2018 通讯列其 Kouwenhoven lab 博后，个人 CV 确认 Delft 博后年份；资料未明确个人正式 advisor。';
const source=`[QuTech 名录](${lab})；[Kavli 通讯](${kavli})；[本人 CV](${cv})`;
const forward=`- 博士后课题组负责人：[[${m}|Leo Kouwenhoven]]。${evidence} ${source}`;
const reverse=`- 博士后课题组成员：[[${p}|Dominique Laroche]]。${evidence} ${source}`;
let person=rd(`人物/${p}.md`),mentor=rd(`人物/${m}.md`),idx=rd('师承关系索引.md'),table=rd('University of Florida逐人复核记录.md');
if(person.includes(forward)||!person.includes('- 博士后导师：待查。')||mentor.split('## 师承\n').length!==2||!table.includes('TU Delft 2016–2018，导师待核'))throw Error('已执行或文件锚点异常');
person=person.replace('- 博士后导师：待查。',forward+'\n- 博士后正式导师：待查。');
person=person.replace('2014–2016 Sandia 职位写 Condensed Matter Physics Researcher，不自动标为博士后。','2014–2016 Sandia 职位在本人 CV 写 Condensed Matter Physics Researcher；[APS 编辑简介]('+aps+')称 Sandia 和 TU Delft 均有博士后经历，两者职位口径待进一步核对，Sandia 指导者未确认。');
mentor=mentor.replace('## 师承\n','## 师承\n\n'+reverse+'\n');
table=table.replace('TU Delft 2016–2018，导师待核','TU Delft 2016–2018 Kouwenhoven 组（正式导师待核）；Sandia 博后职称口径待核');
wr(`人物/${p}.md`,person);wr(`人物/${m}.md`,mentor);wr('University of Florida逐人复核记录.md',table);wr('师承关系索引.md',idx.trimEnd()+`\n- [[${p}|Dominique Laroche]] → 博士后课题组负责人：[[${m}|Leo Kouwenhoven]]。${evidence} ${source}\n`);
const a=JSON.parse(rd(`自动化/人工-20261108-UF-Laroche-${id}.json`));a.audit_id=`20261108_uf_laroche_post_${id}`;a.aspects.postdoc={status:'group_or_candidate',note:'本人 CV 列 TU Delft 2016–2018 博后，QuTech 校友页及 Kavli 通讯证 Kouwenhoven 组属；个人正式导师待核。APS 编辑简介另称 Sandia 与 Delft 均有博士后经历，Sandia 职位口径和导师待查。',sources:[cv,lab,kavli,aps]};a.next_step='核 TU Delft 博后正式导师及 Sandia 职位与指导者；核 Lilly 正式学位登记角色并继续补 UF 各相关院系。';
const e=[{event_id:`20261108_laroche_kouwenhoven_${id}`,record_id:id,stage:'postdoc',mentor_filename:m,kind:'group_leader',source_audit_id:a.audit_id,evidence,sources:[lab,kavli,cv]}];
wr(`自动化/人工-20261108-UF-Laroche-post-${id}.json`,JSON.stringify(a,null,2)+'\n');wr(`自动化/结构化-20261108-UF-Laroche-post-${id}.json`,JSON.stringify(e,null,2)+'\n');console.log(JSON.stringify({person:p,mentor:m}));
