const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const ev=JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('9d272b4c').details_json);db.close();
const rg='https://www.researchgate.net/publication/369620478_The_Magical_Power_of_Water_A_Reminiscence_of_Herman_Johan_Christiaan_Berendsen',pub='https://link.springer.com/article/10.1007/s10930-023-10107-7',cam='https://assets.cambridge.org/97805215/30187/frontmatter/9780521530187_frontmatter.pdf',spe='https://www.4spe.org/i4a/pages/index.cfm?pageid=8852';
ev.audit_id='20261107_9d272b4c_samulski_personal';
ev.aspects.phd={status:'group_or_candidate',note:'本人 2023 回忆称与 Arthur Tobolsky 完成 Princeton 博士论文，Cambridge 作者简介称博士 with Tobolsky，记博士论文研究师长；正式 advisor 职衔及 1969 论文年／1970 授位年差异待学位档案。',sources:[rg,cam,pub,spe]};
ev.aspects.postdoc={status:'confirmed_advisor',note:'本人回忆明确是 Herman Johan Christiaan Berendsen 的博士后研究助理，并称职业初期受其指导；记明确博士后阶段指导，正式行政职衔未写。Texas Wade 的原有阶段关系保留，正式称谓仍待核。',sources:[rg,cam]};
ev.followup_required=true;ev.next_step='查 Princeton 学位档案中 Tobolsky 正式头衔及 1969/1970 年份差异，追查 Texas Wade 的正式指导资料。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Samulski-20261107.json'),JSON.stringify(ev,null,2),'utf8');console.log('已准备 Samulski 本人自述核查事件');
