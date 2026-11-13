const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),{DatabaseSync}=require('node:sqlite');
const base=path.resolve(__dirname,'..'), people=path.join(base,'人物');
const cv='https://bpb-us-e1.wpmucdn.com/sites.mit.edu/dist/d/868/files/2024/10/senthilcv0924.pdf';
const thesis='https://studylib.net/doc/11239425/applied--fractionalization---quantum--phases--and';
const roster='https://www.colorado.edu/conference/bss/2008/boulder-school-2008-roster';
function modify(file,oldText,newText){let s=fs.readFileSync(file,'utf8');if(s.includes(newText))return;if(!s.includes(oldText))throw Error('未找到预期内容：'+file+' '+oldText);s=s.replace(oldText,newText);fs.writeFileSync(file,s,'utf8');}
function person(name){return path.join(people,name+'.md')}
function add(file,anchor,line){if(fs.readFileSync(file,'utf8').includes(line.trim()))return;modify(file,anchor,line+'\n'+anchor)}
function row(file,needle,extra){const f=path.join(base,file),s=fs.readFileSync(f,'utf8'),line=s.split(/\r?\n/).find(x=>x.startsWith('| ')&&x.includes(needle));if(!line)throw Error('缺少校表行 '+needle);if(!line.includes(extra))modify(f,line,line.slice(0,-1)+'；'+extra+' |');}
const sent='人员 - MIT - Senthil Todadri - 781c3259', gro='人员 - UC San Diego - Tarun Grover - b56af531', gold='人员 - University of Minnesota - Hart Goldman - 719da2e7', dev='人员 - Stanford - Trithep Devakul - 3409555e';
add(person(sent),'- 核查边界：其他可能的共同导师或阶段仍需进一步核实。',`- 2026-11-07 直接复核[本人 MIT 履历](${cv})：Yale 1997 博士 thesis advisor 为 Subir Sachdev；1997–2001 UCSB KITP 博后 supervisor 为 Matthew P. A. Fisher。MIT 物理系页面核对任职和研究方向。`);
add(person(gro),'- 核查边界：本人 MIT 博士论文列 T. Senthil 为导师；Vishwanath 实验室将其列为 Berkeley 阶段博士后，按课题组关系记录。',`- 博士论文补证：[论文可读文本](${thesis})题页与摘要列 T. Senthil 为 Thesis Supervisor，致谢称其 advisor；[2008 Boulder School 名录](${roster})明确列 MIT 的 Tarun Grover 及 Advisor: Senthil Todadri，[Senthil 本人履历](${cv})列相同论文标题及 UC San Diego 去向。原 CORE PDF 本次 403，保留原链接，不声称本次成功读取。`);
add(person(gold),'- 核查边界：学校履历记载 MIT 2020–2023 与 Chicago 2023–2024 博士后阶段；导师尚待直接来源，不能仅凭与 T. Senthil 等人的合著推断。',`- 博士后课题组负责人：[[${sent}|Senthil Todadri]]。[Senthil 本人履历](${cv})的博士后名单列 Hart Goldman（2020–2023 Moore fellow，后任 Minnesota 助理教授）；[Minnesota 校页](https://cse.umn.edu/physics/hart-goldman)独立确认时段及身份。此为博士后课题组关系，正式个人导师称谓未明；Chicago 阶段另查。`);
add(person(sent),'- 核查边界：其他可能的共同导师或阶段仍需进一步核实。',`- 博士后课题组成员：[[${gold}|Hart Goldman]]。[本人履历](${cv})列 2020–2023 年 Moore Fellow；正式导师称谓待核。`);
add(person(dev),'## 师承',`[MIT Senthil 本人履历](${cv})的博士后名单直接列 Trithep Devakul，并注明 joint with Liang Fu、Stanford 助理教授；与 Stanford 学校档案一致。该证据支持联合课题组归属，未直接写正式 advisor。\n`);
for(const p of ['人员 - Harvard - Subir Sachdev - a4367696','人员 - UC Santa Barbara - Matthew Fisher - e180d959']) add(person(p),'## 师承',`[Senthil Todadri 本人履历](${cv})明确列其 Yale 博士导师 Subir Sachdev 与 UCSB 博士后导师 Matthew P. A. Fisher。\n`);
row('MIT逐人复核记录.md','Senthil Todadri',`[本人 CV](${cv})明确两阶段的 advisor / supervisor`);
row('UC San Diego逐人复核记录.md','Tarun Grover',`[博士论文可读文本](${thesis})及 [2008 校方名录](${roster})列 Senthil 为论文导师`);
row('University of Minnesota逐人复核记录.md','Hart Goldman',`[MIT 本人履历](${cv})列 Senthil 课题组博士后；正式导师和 Chicago 阶段待核`);
row('Stanford逐人复核记录.md','Trithep Devakul',`[Senthil 履历](${cv})确认与 Liang Fu 联合博士后组属`);
modify(path.join(base,'MIT逐人复核记录.md'),'Matthew P. A. Fisher（博士后阶段研究师长）','Matthew P. A. Fisher（明确博士后导师）');
modify(path.join(base,'University of Minnesota逐人复核记录.md'),'| Eduardo Fradkin | 待核 | [来源](https://cse.umn.edu/physics/hart-goldman) ；[MIT 本人履历]', '| Eduardo Fradkin | Senthil Todadri（博士后课题组，正式导师待核） | [来源](https://cse.umn.edu/physics/hart-goldman) ；[MIT 本人履历]');
add(path.join(base,'师承关系索引.md'),`- [[${gold}|Hart Goldman]] → 博士导师：`,`- [[${gold}|Hart Goldman]] → 博士后课题组负责人：[[${sent}|Senthil Todadri]]。[本人履历](${cv})列其 2020–2023 年 Moore 博士后及 Minnesota 去向；[本人学校页](https://cse.umn.edu/physics/hart-goldman)核对时段。正式导师头衔和 Chicago 阶段待查。\n`);
// Preserve the earlier primary-source links; append independent readable evidence.
const idx=path.join(base,'师承关系索引.md');
for(const [needle,extra] of [[`- [[${sent}|Senthil Todadri]] → 博士导师：`,`[本人 CV 可读镜像](${cv})明确 thesis advisor。`],[`- [[${sent}|Senthil Todadri]] → 博士后导师：`,`[本人 CV 可读镜像](${cv})明确 postdoctoral supervisor。`],[`- [[${gro}|Tarun Grover]] → 博士导师：`,`[论文可读文本](${thesis})及[校方名录](${roster})明确导师。`]]){const s=fs.readFileSync(idx,'utf8'),line=s.split(/\r?\n/).find(x=>x.startsWith(needle));if(!line)throw Error('缺少索引行 '+needle);if(!line.includes(extra))modify(idx,line,line+' '+extra)}
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const changes={
 '781c3259':{phd:{status:'confirmed_advisor',note:'本人 MIT 履历明确 Yale 1997 博士 thesis advisor 为 Subir Sachdev。',sources:[cv]},postdoc:{status:'confirmed_advisor',note:'本人 MIT 履历明确 UCSB KITP 1997–2001 postdoctoral supervisor 为 Matthew P. A. Fisher。',sources:[cv]},next:'进一步核查其他共同导师或阶段，当前两项均有明确来源。'},
 'b56af531':{phd:{status:'confirmed_advisor',note:'MIT 2010 博士论文可读文本题页和摘要明确 T. Senthil 为 thesis supervisor；2008 Boulder 名录列 advisor，Senthil 履历列论文题名与 UCSD 任职。',sources:[thesis,roster,cv]},next:'Berkeley Vishwanath 博后课题组已确认；继续核查正式指导者及其他阶段。'},
 '719da2e7':{postdoc:{status:'group_or_candidate',note:'Senthil 履历博士后名单列 Hart Goldman 为 2020–2023 Moore fellow 且赴 Minnesota；Minnesota 校页确认同一经历。正式导师头衔及 Chicago 阶段待查。',sources:[cv,'https://cse.umn.edu/physics/hart-goldman']},next:'核查 MIT 正式博后导师头衔及 Chicago Kadanoff 阶段师长。'},
 '3409555e':{postdoc:{status:'group_or_candidate',note:'Senthil 本人履历博士后名单列 Trithep Devakul，注明 joint with Liang Fu、Stanford 任职；支持共同组属但未明确 advisor。',sources:[cv,'https://profiles.stanford.edu/trithep-devakul']},next:'查 Princeton 学位论文导师及 MIT 联合博士后正式导师称谓。'}
};
for(const [id,change] of Object.entries(changes)){const e=JSON.parse(db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id).details_json);e.audit_id=`20261107_senthil_cv_recheck_${id}`;if(change.phd)e.aspects.phd=change.phd;if(change.postdoc)e.aspects.postdoc=change.postdoc;e.next_step=change.next;e.followup_required=true;const f=path.join(__dirname,`本轮核查-SenthilCV-${id}-20261107.json`);fs.writeFileSync(f,JSON.stringify(e,null,2)+'\n','utf8');const r=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',f],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);console.log(r.stdout.trim())}db.close();
