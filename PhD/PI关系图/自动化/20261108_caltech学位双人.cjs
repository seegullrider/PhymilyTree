const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'人物');
const lyon='人员 - Princeton - Stephen A. Lyon - 60b542fc',swager='人员 - MIT - Timothy Manning Swager - 45e69f97';
const mc='师承人物 - Thomas C. McGill',smith='师承人物 - Darryl L. Smith（Caltech 半导体研究）',grubbs='师承人物 - Robert H. Grubbs',wrighton='师承人物 - Mark S. Wrighton';
const lyonsrc='https://thesis.caltech.edu/8568/',lyonbio='https://ece.princeton.edu/people/stephen-lyon',thesis='https://thesis.caltech.edu/3126/09/Swager_tm_1988.pdf',cat='https://thesis.caltech.edu/3126/',cv='https://swagergroup.mit.edu/wp-content/uploads/2013/04/CV-Swager-2021.pdf';
function line(file,match,fn){let f=path.join(root,file),a=fs.readFileSync(f,'utf8').split('\n'),idx=a.map((x,i)=>x.includes(match)?i:-1).filter(i=>i>=0);if(idx.length!==1)throw Error(file+' '+match+' '+idx.length);a[idx[0]]=fn(a[idx[0]]);fs.writeFileSync(f,a.join('\n'),'utf8')}
function add(file,anchor,item){let f=path.join(root,file),s=fs.readFileSync(f,'utf8');if(!s.includes(item)){if(!s.includes(anchor))throw Error('missing '+file);s=s.replace(anchor,anchor+'\n'+item);fs.writeFileSync(f,s,'utf8')}}
const e=`[Caltech 博士论文及目录](${lyonsrc})的 Research Advisor(s) 字段列 Thomas C. McGill 与 Darryl L. Smith；论文致谢感谢两人对研究的指导。[Princeton 履历](${lyonbio})证同名本人于 1979 年获得 Caltech 博士。`;
const newnode=path.join(dir,smith+'.md');if(!fs.existsSync(newnode))fs.writeFileSync(newnode,`# Darryl L. Smith（Caltech 半导体研究）\n\n> [!info] 师承扩展人物\n> 本节点依据 1979 年 Caltech 论文目录建立，与其他同名人士未合并；其余经历与任职待核。\n\n## 师承\n\n- 博士生：[[${lyon}|Stephen A. Lyon]]。${e}\n`,'utf8');
add('人物/'+mc+'.md','## 师承',`- 博士生：[[${lyon}|Stephen A. Lyon]]。${e}`);
add('人物/'+lyon+'.md','## 师承',`- 博士导师：[[${mc}|Thomas C. McGill]]、[[${smith}|Darryl L. Smith]]。${e}两人均按目录中的 research advisor 记录，可信度高。`);
line('人物/'+lyon+'.md','- 核查边界：',()=>'- 核查边界：Caltech 论文库将两人分别列为 research advisor，论文致谢也称两人给予指导；博士后经历及导师仍待核。');
line('Princeton逐人复核记录.md','| [[人员 - Princeton - Stephen A. Lyon',x=>x.replace('| 待核 | 待核 |','| Thomas C. McGill、Darryl L. Smith（Caltech 目录列两位 research advisor） | 待核 |').replace('[来源](https://materials.princeton.edu/people/stephen-lyon)',`[Caltech 博士论文](${lyonsrc})；[Princeton ECE](${lyonbio})`));
for(const [filename,name] of [[mc,'Thomas C. McGill'],[smith,'Darryl L. Smith']])add('师承关系索引.md','# 师承关系与候选线索索引',`- [[${lyon}|Stephen A. Lyon]] → 博士导师：[[${filename}|${name}]]。${e}`);
const s1=`[本人 Caltech 博士论文](${thesis})致谢称 Bob Grubbs 为 research advisor，[学校目录](${cat})也列 Grubbs 为 advisor。`;
const s2=`[本人 CV](${cv})明确列 MIT 1988–1990 博士后 advisor 为 Mark S. Wrighton。`;
line('人物/'+swager+'.md','- 博士导师：',x=>x+' '+s1);
line('人物/'+swager+'.md','- 博士后导师：',x=>x+' '+s2);
line('人物/'+grubbs+'.md','- 博士生：[[人员 - MIT - Timothy Manning Swager',x=>x+' '+s1);
line('人物/'+wrighton+'.md','- 博士后研究者：[[人员 - MIT - Timothy Manning Swager',x=>x+' '+s2);
line('MIT逐人复核记录.md','| [[人员 - MIT - Timothy Manning Swager',x=>x.replace('[来源](https://swagergroup.mit.edu/tims-cv/)',`[博士论文](${thesis})；[本人 CV](${cv})`));
line('师承关系索引.md','Timothy Manning Swager]] → 博士导师：',x=>x+' '+s1);
line('师承关系索引.md','Timothy Manning Swager]] → 博士后导师：',x=>x+' '+s2);
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});function latest(id){return JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id).details_json)}
const a=latest('60b542fc'),b=latest('45e69f97');db.close();
a.audit_id='20261108_lyon_caltech_advisors';a.aspects.phd={status:'confirmed_advisor',note:'Caltech 1979 Lyon 博士论文目录列 Thomas C. McGill 与 Darryl L. Smith 两位 research advisor；致谢感谢二人研究指导，Princeton 本人页列同年 Caltech 博士。',sources:[lyonsrc,lyonbio]};a.next_step='追查博士后经历和导师；消歧 Darryl L. Smith 同名者。';a.followup_required=true;
b.audit_id='20261108_swager_caltech_mit_advisors';b.aspects.phd={status:'confirmed_advisor',note:'Caltech 博士论文致谢及目录明确 Robert H. Grubbs 为 research advisor；与本人 CV 一致。',sources:[thesis,cat,cv]};b.aspects.postdoc={status:'confirmed_advisor',note:'本人 CV 将 1988–1990 MIT 博士后 advisor 明列 Mark S. Wrighton。',sources:[cv]};b.next_step='核查学院与招生资料的后续更新；保留已有可靠图谱关系。';b.followup_required=true;
for(const [tag,x] of [['lyon',a],['swager',b]])fs.writeFileSync(path.join(__dirname,`人工-20261108-${tag}-论文.json`),JSON.stringify(x,null,2)+'\n');
const typed=[[a,lyon,mc,'phd','20261108_lyon_mcgill_advisor',`Caltech 博士论文目录列 McGill 为 research advisor，作者致谢感谢其研究指导。`,[lyonsrc,lyonbio]],[a,lyon,smith,'phd','20261108_lyon_smith_advisor',`Caltech 博士论文目录列 Darryl L. Smith 为 research advisor，作者致谢感谢其研究指导。`,[lyonsrc,lyonbio]],[b,swager,grubbs,'phd','20261108_swager_grubbs_advisor',`Caltech 博士论文致谢称 Grubbs 为 research advisor，学位目录与本人 CV 一致。`,[thesis,cat,cv]],[b,swager,wrighton,'postdoc','20261108_swager_wrighton_advisor',`本人 CV 明列 1988–1990 MIT 博士后 advisor Mark S. Wrighton。`,[cv]]].map(([a,p,m,stage,event_id,evidence,sources])=>({event_id,record_id:a.record_id,stage,mentor_filename:m,kind:'advisor',source_audit_id:a.audit_id,evidence,sources}));
fs.writeFileSync(path.join(__dirname,'结构化-20261108-caltech双人.json'),JSON.stringify(typed,null,2)+'\n');console.log('prepared');
