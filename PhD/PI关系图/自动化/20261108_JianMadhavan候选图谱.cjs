// 对照已有证据统一图谱中的待核关系；不以合著、混合学历或搜索索引确认导师。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'人物'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const j={id:'488c6abc',person:'人员 - Cornell - Chao-Ming Jian - 488c6abc',mentor:'人员 - Stanford - Xiao-Liang Qi - c441aeb5',audit:'20261105_488c6abc_primary'};
const v={id:'e4d6ef17',person:'人员 - UIUC - Vidya Madhavan - e4d6ef17',mentor:'人员 - UC Berkeley - Michael Crommie - d0d635fd',audit:'20261107_e4d6ef17_bu_davis_primary'};
for(const p of [j,v]){let a=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(p.id);if(!a||a.audit_id!==p.audit)throw Error('最新事件已变化 '+p.id);p.old=JSON.parse(a.details_json);if(db.prepare("select 1 from typed_relation_events where record_id=? and stage='phd' and mentor_filename=?").get(p.id,p.mentor))throw Error('已有类型化关系 '+p.id)}db.close();
const index=path.join(root,'师承关系索引.md'),updates=new Map();function edit(file,pred,fn){let s=updates.get(file)??fs.readFileSync(file,'utf8'),ls=s.split('\n'),xs=ls.map((x,i)=>pred(x)?i:-1).filter(i=>i>=0);if(xs.length!==1)throw Error('目标行不唯一 '+file+' '+xs.length);ls[xs[0]]=fn(ls[xs[0]].replace(/\r$/,''));updates.set(file,ls.join('\n'))}
const tree='https://academictree-staging.thetransmitter.org/physics/peopleinfo.php?pid=740261',cornell='https://voltron.as.cornell.edu/chao-ming-jian';
let idx=fs.readFileSync(index,'utf8');if(idx.includes('[['+j.person+'|Chao-Ming Jian]] →'))throw Error('索引已有 Jian 关系，先人工检查');
const insert=`- [[${j.person}|Chao-Ming Jian]] → 博士导师候选：[[${j.mentor}|Xiao-Liang Qi]]。既有人物页保留 [Physics Tree 线索](${tree})；原页面未能重读，[Cornell 履历与论文列表](${cornell})只提供经历与共同研究线索，正式导师须查本人或学位原档。\n`;
updates.set(index,idx.replace(/\s*$/,'\n')+insert);
edit(path.join(root,'Cornell逐人复核记录.md'),l=>l.startsWith('| [['+j.person+'|'),l=>{if(!l.includes('| 待核 | 待核 |'))throw Error('Cornell 校表阶段已变化');return l.replace('| 待核 | 待核 |','| Xiao-Liang Qi（博士导师候选；第三方线索未重读） | 待核 |')});
edit(path.join(dir,j.person+'.md'),l=>l.startsWith('- 博士候选：[['+j.mentor),l=>l.replace('Physics Tree 列其为 Stanford 师长','既有 Physics Tree 线索列其为 Stanford 师长，原页面本轮未能重读'));
edit(path.join(dir,j.mentor+'.md'),l=>l.startsWith('- 博士阶段候选：[['+j.person),l=>l.replace('Physics Tree 列其为 Stanford 师长','既有 Physics Tree 线索列其为 Stanford 师长，原页面本轮未能重读'));
const group='https://physics.berkeley.edu/research-faculty/crommie-group/members',cv='https://grainger.illinois.edu/about/directory/faculty/vm1';
const evidence=`[Crommie 组名录](${group})列其为前研究生；[Illinois 履历](${cv})列 2000 年 Boston University 博士。名录未列研究生学位、具体阶段或正式导师；博士阶段组属及导师身份均待核。`;
edit(path.join(dir,v.person+'.md'),l=>l.startsWith('- 博士阶段课题组负责人：[['+v.mentor),()=>`- 博士阶段课题组负责人候选：[[${v.mentor}|Michael Crommie]]。${evidence}`);
edit(path.join(dir,v.mentor+'.md'),l=>l.startsWith('- 前研究生组成员：[['+v.person),()=>`- 前研究生组成员（博士阶段待核）：[[${v.person}|Vidya Madhavan]]。${evidence}`);
edit(index,l=>l.includes('[['+v.person+'|')&&l.includes('→ 前研究生课题组负责人：[['+v.mentor),()=>`- [[${v.person}|Vidya Madhavan]] → 博士阶段课题组负责人候选：[[${v.mentor}|Michael Crommie]]。${evidence}`);
edit(path.join(root,'UIUC逐人复核记录.md'),l=>l.startsWith('| [['+v.person+'|'),l=>{if(!l.includes('Michael Crommie（前研究生组成员；Boston University 2000 博士，正式导师待核）'))throw Error('UIUC 校表已变化');return l.replace('Michael Crommie（前研究生组成员；Boston University 2000 博士，正式导师待核）','Michael Crommie（前研究生组成员；博士阶段及正式导师待核）')});
v.old.audit_id='20261108_madhavan_graduate_stage';v.old.aspects.phd.note='Crommie 组名录列其为前研究生，Illinois 履历列 2000 Boston University 博士；名录未说明其研究生学位、阶段和地点，博士阶段组属、正式论文导师待核。';v.old.followup_required=true;v.old.next_step='查 Boston University 2000 博士论文原档和研究经历，确认 Crommie 组属是否对应博士阶段及正式导师；核对博后日期。';
const f=path.join(__dirname,'人工-20261108_madhavan_graduate_stage.json');if(fs.existsSync(f))throw Error('新事件已存在');for(const [name,s] of updates)fs.writeFileSync(name,s,'utf8');fs.writeFileSync(f,JSON.stringify(v.old,null,2)+'\n',{encoding:'utf8',flag:'wx'});console.log(JSON.stringify({files:updates.size,audit:v.old.audit_id,note:'仅保存与修正候选，不新增确认；须导入台账和候选事件。'}));
