const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),{spawnSync}=require('child_process');
const root=path.join(__dirname,'..'),id='187a89bb',url='https://www.sciencedirect.com/science/article/abs/pii/S0022459618305607';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!row)throw Error('缺少台账');const e=JSON.parse(row.details_json);db.close();
e.audit_id='20261107_jianshi_zhou_candidate_'+id;e.aspects.phd={status:'group_or_candidate',note:'Goodenough 2019 本人回忆文章的搜索索引称 Zhou 为来 UT 与其完成 Jilin 博士论文的学生；文章原页本轮 403，故只登记博士阶段候选，不冒称已读取原文或核实正式导师。UT 不同记录的授予学校冲突保留。',sources:[url,'https://me.utexas.edu/person/jianshi-zhou/','https://catalog.utexas.edu/archive/2024-25/graduate/gsc-committees/gsc-committees.pdf']};e.followup_required=true;e.next_step='原文访问允许时直接核读 Goodenough 回忆文章和 Zhou 的学位原件，确认研究师长、正式导师及授予学校；核博士后经历。';
const out=path.join(__dirname,'本轮核查-JianshiZhou-'+id+'-20261107.json');fs.writeFileSync(out,JSON.stringify(e,null,2)+'\n');const r=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',out],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout.trim());
function edit(rel,old,neu){const f=path.join(root,rel),s=fs.readFileSync(f,'utf8');if(s.split(old).length!==2)throw Error('不唯一 '+rel);fs.writeFileSync(f,s.replace(old,neu));}
const person='[[人员 - UT Austin - Jianshi Zhou - 187a89bb|Jianshi Zhou]]',teacher='[[研究人物 - John B. Goodenough|John B. Goodenough]]';
const detail=`[Goodenough 本人回忆文章](${url})的搜索索引称 Zhou 为与其开展 Jilin 博士论文研究的学生；原页本轮 403，未能直接核读，仅为候选线索，不确证正式导师。`;
edit('人物/人员 - UT Austin - Jianshi Zhou - 187a89bb.md','## 师承\n','## 师承\n\n- 博士阶段研究师长候选：'+teacher+'。'+detail+'\n');
edit('人物/研究人物 - John B. Goodenough.md','## 研究合作',`## 师承候选\n\n- 博士阶段受指导者候选：${person}。${detail}\n\n## 研究合作`);
const ind=path.join(root,'师承关系索引.md');fs.appendFileSync(ind,`\n- ${person} → 博士阶段研究师长候选：${teacher}。${detail}\n`);
edit('UT Austin逐人复核记录.md','| 待核；学校资料对博士授予学校有冲突 | 待核 | [来源](https://me.utexas.edu/person/jianshi-zhou/) |',`| John B. Goodenough（搜索索引候选，原页 403）；博士授予学校有冲突 | 待核 | [UT 机械系](https://me.utexas.edu/person/jianshi-zhou/)；[本人回忆文章候选](${url}) |`);
console.log('候选及反链、索引、学校表已同步');
