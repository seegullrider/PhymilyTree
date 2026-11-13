const fs=require('fs');
const path=require('path');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
const ieee='https://ieeemagnetics.org/files/ieeemagnetics/2023-03/IEEEMS-N-30-4-Oct-1993.pdf';
const ucsd='https://cmrr.ucsd.edu/research/faculty-profiles/bertram.html';
function replace(file,oldText,newText){const p=path.join(root,file);const s=fs.readFileSync(p,'utf8');if(!s.includes(oldText))throw Error('未找到预期原文 '+file);fs.writeFileSync(p,s.replace(oldText,newText),'utf8');}
replace('人物/人员 - Carnegie Mellon - Jian-Gang（Jimmy）Zhu - 4312e787.md',
'- 核查边界：IEEE 简介称 1989 年 UCSD 获博士、1989–1990 年继续在 CMRR 任博士后；Bertram 在博士期间指导研究，但尚未见论文或学位记录明确正式 thesis advisor，也未明确博士后导师。UCSD 组网页列学生年份 1988，与 IEEE 1989 获学位可能为不同时间口径，待核。',
'- 论文线索：Bertram 的 [UCSD 课题组校友清单]('+ucsd+') 列 Jian-Gang Zhu 为博士生，论文题为 *Interface Phenomena in Magnetic Thin Films*，年份 1988；IEEE 同期介绍写 1989 年获博士。两处年份冲突，尚待论文或学位登记核对。IEEE 明确 1989–1990 年在 CMRR 做博士后，但未明确博士后导师。Bertram 为博士阶段研究师长；论文正式 thesis advisor 仍待学位原始资料核对。');
replace('Carnegie Mellon逐人复核记录.md','H. Neal Bertram（博士阶段课题组） | 待核 |','H. Neal Bertram（博士阶段研究师长；论文正式导师待核） | 待核 |');
replace('师承关系索引.md','→ 博士阶段课题组负责人：[[师承人物 - H. Neal Bertram|H. Neal Bertram]]。[来源](https://cmrr.ucsd.edu/research/faculty-profiles/bertram.html)','→ 博士阶段研究师长：[[师承人物 - H. Neal Bertram|H. Neal Bertram]]；论文正式导师待核。[IEEE 1993 介绍]('+ieee+')');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const prior=JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('4312e787').details_json);db.close();
prior.audit_id='20261108_zhu_bertram_ieee_review';prior.followup_required=true;
prior.aspects.phd={status:'confirmed_advisor',note:'IEEE 1993 简介明言 1985 起在 CMRR under supervision of H. Neal Bertram，确认博士阶段研究指导；UCSD 清单列同名博士生及论文题名。论文正式 advisor 未直接标出，UCSD 1988 与 IEEE 1989 年份冲突待核。',sources:[ieee,ucsd]};
prior.next_step='查 UCSD 博士论文签字或学位原始登记核正式导师和年份；1989–1990 CMRR 博士后经历已证，继续查博士后正式导师。';
fs.writeFileSync(path.join(__dirname,'人工-20261108-zhu-bertram.json'),JSON.stringify(prior,null,2)+'\n');
const typed=[{event_id:'20261108_zhu_bertram_stage_mentor',record_id:'4312e787',stage:'phd',mentor_filename:'师承人物 - H. Neal Bertram',kind:'stage_mentor',source_audit_id:prior.audit_id,evidence:'IEEE 1993 简介明确 1985 在 UCSD CMRR under supervision of Professor H. Neal Bertram；论文正式导师字段及 1988/1989 年份冲突待查。',sources:[ieee,ucsd]}];
fs.writeFileSync(path.join(__dirname,'结构化-20261108-zhu-bertram.json'),JSON.stringify(typed,null,2)+'\n');
console.log('Updated notes and prepared append-only evidence records.');
