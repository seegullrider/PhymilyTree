const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),id='1bdfb166';
const source='https://dornsife.usc.edu/news/stories/nobel-prize-in-physics-awarded-for-ultracold-electronics-research-that-launched-a-quantum-technology/';
const person='[[人员 - USC - Eli Levenson-Falk - 1bdfb166|Eli Levenson-Falk]]';
const mentor='[[人员 - UC Berkeley - Irfan Siddiqi - 28c17cbe|Irfan Siddiqi]]';
const secondary='[[人员 - UC Berkeley - John Clarke - 1c042385|John Clarke]]';
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const updated=new Map();
function transform(rel,fn){const old=read(rel),next=fn(old);if(next===old)throw Error('未发生预期变更：'+rel);updated.set(path.join(root,rel),next)}
function oneLine(s,needle,replacement){const lines=s.split('\n');let n=0;for(let i=0;i<lines.length;i++)if(lines[i].includes(needle)){lines[i]=replacement;n++}if(n!==1)throw Error('匹配数 '+n+'：'+needle);return lines.join('\n')}
const p='人物/人员 - USC - Eli Levenson-Falk - 1bdfb166.md';
transform(p,s=>{s=oneLine(s,'- 博士阶段研究师长：'+mentor,`- 博士导师：${mentor}。[本人文章](${source})明确称其为“Ph.D. adviser”；[USC 学校履历](https://viterbigradadmission.usc.edu/doctoral/faculty-research/profile/?fname=Eli&lname=Levenson-Falk)确认其 2013 年 Berkeley 博士及 Siddiqi 实验室身份。关系类型可信度：高。\n- 博士阶段次级指导者：${secondary}。[本人文章](${source})称 Clarke 为其“secondary adviser”；具体正式论文共同导师职衔仍待学位资料确认。关系类型可信度：高。`);s=s.replace('两阶段正式导师称谓仍待论文或其他明确原始材料。','博士后正式导师称谓仍待明确原始材料；博士论文中 Clarke 的具体正式职衔仍待核。');s=s.replace('故正式导师仍待复核。','可在主机退避结束后核对学位目录，但本人文章已明确 Siddiqi 为博士导师。');return s});
transform('人物/人员 - UC Berkeley - Irfan Siddiqi - 28c17cbe.md',s=>oneLine(s,'- 博士阶段研究者：'+person,`- 博士生：${person}。[学生本人文章](${source})明确称 Irfan Siddiqi 为其博士导师；[USC 学校履历](https://viterbigradadmission.usc.edu/doctoral/faculty-research/profile/?fname=Eli&lname=Levenson-Falk)核对 Berkeley 博士身份。关系类型可信度：高。`));
transform('人物/人员 - UC Berkeley - John Clarke - 1c042385.md',s=>{const marker='## 师承\n';if(s.split(marker).length!==2)throw Error('Clarke 师承标题异常');return s.replace(marker,marker+`\n- 博士阶段次级指导者对应的研究生：${person}。[学生本人文章](${source})称 Clarke 为 secondary adviser；正式论文共同导师职衔待核。关系类型可信度：高。\n`)});
transform('师承关系索引.md',s=>oneLine(s,person+' → 博士阶段研究师长：'+mentor,`- ${person} → 博士导师：${mentor}。[本人文章](${source})明确称 Siddiqi 为其 Ph.D. adviser；关系类型可信度：高。\n- ${person} → 博士阶段次级指导者：${secondary}。[本人文章](${source})称 Clarke 为 secondary adviser；正式论文共同导师职衔待核。`));
transform('USC逐人复核记录.md',s=>{const old='Irfan Siddiqi（博士阶段研究师长）';if(s.split(old).length!==2)throw Error('校表匹配异常');return s.replace(old,`[Irfan Siddiqi（博士导师）、John Clarke（次级指导者，正式职衔待核）](${source})`)});
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);db.close();if(!row)throw Error('无人工事件');const e=JSON.parse(row.details_json);
e.audit_id='20261107_eli_levenson_falk_first_person_'+id;e.aspects.phd={status:'confirmed_advisor',note:'本人文章明确称 Siddiqi 为 Ph.D. adviser，Clarke 为 secondary adviser；后者的正式论文共同导师职衔仍待核。',sources:[source,'https://viterbigradadmission.usc.edu/doctoral/faculty-research/profile/?fname=Eli&lname=Levenson-Falk']};e.followup_required=true;e.next_step='查 Berkeley 2013 学位论文核对 Clarke 的正式角色；继续核 Stanford 博后 Kapitulnik 是否正式 advisor。';
const file=path.join(__dirname,'本轮核查-EliLevensonFalk-'+id+'-20261107.json');if(fs.existsSync(file))throw Error('事件文件已存在，请避免重复');fs.writeFileSync(file,JSON.stringify(e,null,2)+'\n');
for(const [f,data] of updated)fs.writeFileSync(f,data,'utf8');
const r=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',file],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout.trim());console.log('已更新 '+updated.size+' 个人物、反链、索引及学校表文件');
