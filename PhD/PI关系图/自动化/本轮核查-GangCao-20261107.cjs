const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),{spawnSync}=require('child_process');
const root=path.join(__dirname,'..'),id='4bb105ec';
const book='https://api.pageplace.de/preview/DT0400.9780192555519_A41927060/preview-9780192555519_A41927060.pdf';
const cv='https://www.colorado.edu/lab/cao/sites/default/files/attached-files/gang_cao-cv-december-2019-s.pdf';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!row)throw Error('缺少台账');const e=JSON.parse(row.details_json);db.close();
e.audit_id='20261107_gang_cao_postdoc_memoir_'+id;e.aspects.postdoc={status:'confirmed_advisor',note:'本人 2021 专著序言明确称 Jack E. Crow 为其 postdoc mentor；本人 CV 证 1993–1995 National High Magnetic Field Laboratory 博士后。导师与研究阶段明确，原文称 mentor 而非正式 advisor。',sources:[book,cv]};e.aspects.phd.sources=[cv,book];e.next_step='两阶段关系由本人 CV 和专著明确；若需要行政任命头衔可后查原始任命档案。';e.followup_required=false;
const out=path.join(__dirname,'本轮核查-GangCao-'+id+'-20261107.json');fs.writeFileSync(out,JSON.stringify(e,null,2)+'\n');const r=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',out],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout.trim());
function edit(rel,old,neu){const f=path.join(root,rel),s=fs.readFileSync(f,'utf8');if(s.split(old).length!==2)throw Error('不唯一 '+rel);fs.writeFileSync(f,s.replace(old,neu));}
const person='[[人员 - Colorado Boulder - Gang Cao - 4bb105ec|Gang Cao]]',mentor='[[师承人物 - Jack E. Crow|Jack E. Crow]]';
const line=`- 博士后阶段研究导师（mentor）：${mentor}。[本人专著序言](${book})第 viii–ix 页明确称 Crow 为 postdoc mentor；[本人 CV](${cv})列 1993–1995 国家强磁场实验室博士后。原文未称正式 advisor，研究指导关系可信度高。`;
edit('人物/人员 - Colorado Boulder - Gang Cao - 4bb105ec.md','- 核查边界：本人 CV 明确 Temple 博士论文导师；国家强磁场实验室博士后导师待核。',line+'\n- 核查边界：Crow 同时是博士论文导师及博士后阶段 mentor；两阶段分开记载，不把 mentor 改写成正式职位。');
const reverse=`- 博士生：${person}。[来源](${cv})`;edit('人物/师承人物 - Jack E. Crow.md',reverse,reverse+`\n- 博士后阶段受指导者：${person}。[Cao 本人专著序言](${book})明确称 Crow 为 postdoc mentor。`);
const idx=`- ${person} → 博士导师：${mentor}。[来源](${cv})`;edit('师承关系索引.md',idx,idx+`\n- ${person} → 博士后阶段研究导师（mentor）：${mentor}。[Cao 本人专著序言](${book})明确称 Crow 为 postdoc mentor；[CV](${cv})列 1993–1995 博后。`);
edit('Colorado Boulder逐人复核记录.md','| Jack E. Crow | 待核 | [来源]('+cv+') |',`| Jack E. Crow | Jack E. Crow（博士后 mentor） | [本人 CV](${cv})；[本人专著序言](${book}) |`);
console.log('人物页、反链、索引及学校表已更新');
