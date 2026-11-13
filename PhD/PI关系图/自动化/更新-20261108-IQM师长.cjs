// IQM 原始项目报告直接列出了两名博士后及其阶段研究指导者。
const fs=require('node:fs'), path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const dir=__dirname, root=path.resolve(dir,'..');
const source='https://www.osti.gov/servlets/purl/2999814';
const people=[
 {id:'dd6cd959',audit:'20261108_mahmood_iqm_supervised',name:'Fahad Mahmood',person:'人员 - UIUC - Fahad Mahmood - dd6cd959',mentor:'人员 - Johns Hopkins - N. Peter Armitage - 09d3c44c',mentorName:'N. Peter Armitage',school:'UIUC',start:'2016–2019',other:'博士阶段 Gedik 论文导师正式称谓待查；注意同名者。'},
 {id:'4d22e754',audit:'20261108_changlani_iqm_supervised',name:'Hitesh Changlani',person:'人员 - Florida State - Hitesh Changlani - 4d22e754',mentor:'人员 - Johns Hopkins - Oleg Tchernyshyov - c951d360',mentorName:'Oleg Tchernyshyov',school:'Florida State',start:'2016–2018',other:'Illinois Wagner 博后组的指导称谓仍待查；Cornell 博士论文与 CV 对 Garnet Chan 角色的差异待核。'}
];
const db=new DatabaseSync(path.join(dir,'检索队列.sqlite'),{readOnly:true});
const events=[], typed=[];
for(const p of people){
 const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(p.id);
 if(!row)throw Error('缺人工事件 '+p.id);const e=JSON.parse(row.details_json);e.audit_id=p.audit;
 e.aspects.postdoc.status='confirmed_advisor';
 e.aspects.postdoc.note=`IQM 官方项目报告明确 ${p.name} ${p.start} 博士后 supervised by ${p.mentorName}；按阶段研究师长标注，不声称正式任命职称。${p.other}`;
 e.aspects.postdoc.sources=[source,...e.aspects.postdoc.sources.filter(s=>s!==source)];e.next_step=p.other;e.followup_required=true;events.push(e);
 typed.push({event_id:p.audit,record_id:p.id,stage:'postdoc',mentor_filename:p.mentor,kind:'stage_mentor',source_audit_id:p.audit,evidence:`IQM 项目报告列 ${p.name} 于 ${p.start} 在 JHU 任博士后，supervised by ${p.mentorName}；确定阶段研究指导，正式职衔未明。`,sources:[source,...e.aspects.postdoc.sources.slice(1)]});
}
db.close();
function update(file,fn){const full=path.join(root,file),s=fs.readFileSync(full,'utf8'),t=fn(s);if(s===t)throw Error('未修改 '+file);fs.writeFileSync(full,t,'utf8');}
function lineReplace(s,find,newLine){const a=s.split('\n'),hits=a.map((x,i)=>x.includes(find)?i:-1).filter(i=>i>=0);if(hits.length!==1)throw Error('预期唯一行 '+find+' '+hits.length);a[hits[0]]=newLine;return a.join('\n');}
for(const p of people){
 const lab=`博士后阶段研究师长`, proof=`[IQM 官方项目报告](${source})明确 ${p.start} 博士后 supervised by ${p.mentorName}；正式聘任职衔未说明。`;
 update(`人物/${p.person}.md`,s=>{
  s=lineReplace(s,`- 博士后课题组负责人：[[${p.mentor}|`, `- ${lab}：[[${p.mentor}|${p.mentorName}]]。${proof}`);
  return s.replace(/- 核查边界：[^\n]*/,`- 核查边界：IQM 项目报告明确此博士后阶段由 ${p.mentorName} 指导，但未使用正式任命职衔。${p.other}`);
 });
 update(`人物/${p.mentor}.md`,s=>lineReplace(s,`- 博士后课题组成员：[[${p.person}|`,`- 博士后阶段研究人员：[[${p.person}|${p.name}]]。${proof}`));
 update('师承关系索引.md',s=>lineReplace(s,`[[${p.person}|${p.name}]] → 博士后课题组负责人：[[${p.mentor}|`,`- [[${p.person}|${p.name}]] → ${lab}：[[${p.mentor}|${p.mentorName}]]。${proof}`));
 update(`${p.school}逐人复核记录.md`,s=>{const a=s.split('\n'), i=a.findIndex(x=>x.includes(`[[${p.person}|${p.name}]]`));if(i<0)throw Error('缺学校表');a[i]=a[i].replace('Lucas K. Wagner、Oleg Tchernyshyov（博士后课题组负责人，正式称谓待核）','Lucas K. Wagner（博士后组负责人）；Oleg Tchernyshyov（博士后阶段研究师长，正式职衔待核）').replace(p.mentorName+'（2016–2019 博士后课题组负责人；正式导师待核）',p.mentorName+'（2016–2019 博士后阶段研究师长；正式职衔待核）');a[i]=a[i].replace(/ \|$/,`；[IQM 项目报告](${source}) |`);return a.join('\n')});
}
for(const e of events)fs.writeFileSync(path.join(dir,`人工-${e.audit_id}.json`),JSON.stringify(e));
fs.writeFileSync(path.join(dir,'结构化-20261108-IQM师长.json'),JSON.stringify(typed));
console.log(JSON.stringify({people:people.map(p=>p.id),events:events.length,typed:typed.length}));
