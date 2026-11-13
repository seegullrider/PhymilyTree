// 基于 Sachdev 本人课题组名单和已有身份资料增加组关系；不推定正式 advisor。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),mentor='人员 - Harvard - Subir Sachdev - a4367696',u='https://sachdev.physics.harvard.edu/people-all';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const specs=[
 {id:'4db8e5ec',expect:'chubukov_primary_secondary_20261107',school:'University of Minnesota',name:'Andrey Chubukov',old:'David Pines（Illinois 博士后期间密切合作；正式导师待核），Yale 阶段待核',replacement:'David Pines（Illinois 博后密切合作）；Subir Sachdev（博士后组属，具体阶段及正式导师待核）'},
 {id:'1277e820',expect:'20261105_1277e820_primary_v99',school:'University of Chicago',name:'Michael Levin',old:'Matthew P. A. Fisher（博士后研究关联，正式职衔待核）',replacement:'Matthew P. A. Fisher（博士后研究关联）；Subir Sachdev（博士后组属，具体阶段及正式导师待核）'},
 {id:'7f696124',expect:'20261105_7f696124_primary',school:'MIT',name:'Liang Fu',old:'待核',replacement:'Subir Sachdev（博士后组属；Harvard Junior Fellow 对应阶段及正式导师待核）'},
 {id:'afcac2e1',expect:'20261105_afcac2e1_primary',school:'Princeton',name:'Dmitry Abanin',old:'待核',replacement:'Subir Sachdev（博士后组属；Princeton／Harvard 对应阶段及正式导师待核）'}
];
const targets=[],types=[];let mentorFile=path.join(root,'人物',mentor+'.md'),mentorText=fs.readFileSync(mentorFile,'utf8');
const indexFile=path.join(root,'师承关系索引.md');let index=fs.readFileSync(indexFile,'utf8');
for(const z of specs){
 const rec=db.prepare('select id,name,unit,filename from records where id=?').get(z.id),prev=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(z.id);
 if(!rec||rec.unit!==z.school||prev?.audit_id!==z.expect)throw Error('记录或最新事件已变化: '+z.id);
 const noteFile=path.join(root,'人物',rec.filename+'.md'),note=fs.readFileSync(noteFile,'utf8'),mark='## 师承\n',tableFile=path.join(root,z.school+'逐人复核记录.md'),lines=fs.readFileSync(tableFile,'utf8').split('\n'),hits=lines.map((line,i)=>line.includes('[['+rec.filename+'|')?i:-1).filter(i=>i>=0);
 if(note.split(mark).length!==2||note.split('<!-- PI-AUTO-SEARCH:START -->')[0].includes(mentor)||hits.length!==1||!lines[hits[0]].includes('| '+z.old+' |'))throw Error('原文、学校表或已有关系不符: '+z.id);
 const ev='Sachdev 本人课题组 People 页在 Postdocs 名单中列出 '+z.name+' 并链接其所属机构；该名单支持博士后组属，但未说明该阶段具体职位、日期或正式 advisor 称谓。';
 const nl=`- 博士后课题组负责人：[[${mentor}|Subir Sachdev]]。[本人课题组 Postdocs 名单](${u})列 ${z.name} 并链接本人院校；名单未写明阶段日期及正式导师称谓，须与个人经历继续核对。\n`;
 const newNote=note.replace(mark,mark+'\n'+nl);lines[hits[0]]=lines[hits[0]].replace('| '+z.old+' |','| '+z.replacement+' |').replace(/\|\s*\r?$/,`；[Sachdev 博士后名单](${u}) |`);
 const reverse=`- 博士后课题组成员：[[${rec.filename}|${z.name}]]。[本人课题组 Postdocs 名单](${u})列其姓名并链接院校；具体时间与正式 advisor 称谓待核。`;
 if(mentorText.includes(reverse)||index.includes(`[[${rec.filename}|${z.name}]] → 博士后课题组负责人：[[${mentor}`))throw Error('索引或反链已存在: '+z.id);
 mentorText=mentorText.replace('## 师承\n','## 师承\n\n'+reverse+'\n');
 index+=`\n- [[${rec.filename}|${z.name}]] → 博士后课题组负责人：[[${mentor}|Subir Sachdev]]。[本人课题组 Postdocs 名单](${u})列其姓名并链接院校；具体阶段、时间和正式导师称谓待核。\n`;
 const a=JSON.parse(prev.details_json);a.audit_id=`20261108_sachdev_postdoc_${z.id}`;a.aspects.postdoc.status='group_or_candidate';a.aspects.postdoc.note+=' '+ev;a.aspects.postdoc.sources=[...new Set([...a.aspects.postdoc.sources,u])];a.followup_required=true;a.next_step+='；核查 Sachdev 组博士后具体机构和时间、是否存在正式个人 advisor；保留人物页原有博士及其他博士后关系。';
 const auditFile=path.join(__dirname,`人工-20261108-sachdev-${z.id}.json`);
 types.push({event_id:`20261108_sachdev_postdoc_group_${z.id}`,record_id:z.id,stage:'postdoc',mentor_filename:mentor,kind:'group_leader',source_audit_id:a.audit_id,evidence:ev,sources:[u]});
 targets.push([noteFile,newNote],[tableFile,lines.join('\n')],[auditFile,JSON.stringify(a,null,2)+'\n']);
}
db.close();targets.push([mentorFile,mentorText],[indexFile,index],[path.join(__dirname,'结构化-20261108-sachdev四名博士后.json'),JSON.stringify(types,null,2)+'\n']);for(const [f,s] of targets)fs.writeFileSync(f,s,'utf8');console.log(JSON.stringify({records:specs.map(x=>x.id),files:targets.length}));
