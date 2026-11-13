const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),{spawnSync}=require('child_process');
const dir=path.join(__dirname,'..'),id='c2cedfc7',url='https://mrlweb.mrl.ucsb.edu/sites/default/files/mrl_docs/2015-UCSB-MRSEC-AnnualReport-BOOKLET.pdf',person='[[人员 - UT Austin - Gabriel Sanoja - c2cedfc7|Gabriel Sanoja]]';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!row)throw Error('缺少事件');const e=JSON.parse(row.details_json);db.close();
e.audit_id='20261107_sanoja_segalman_primary_'+id;e.aspects.phd={status:'confirmed_advisor',note:'Segalman 2015 年 UCSB 年报个人资料的 Graduate Advisors / Postdoctoral Sponsors 混合名单，将 Gabriel Sanoja 明确标为 UCB GS；与本人 2016 Berkeley 博士及先前论文记录吻合，支持 Segalman 博士阶段指导；论文正式职衔及 Balsara 待复读学位库。',sources:[url,'https://che.utexas.edu/person/gabriel-sanoja/']};e.followup_required=true;e.next_step='遵守 eScholarship 主机退避，之后直接复读论文确认两个正式导师及分工；另查 UCSB 博后阶段师长。';
const out=path.join(__dirname,'本轮核查-Sanoja-'+id+'-20261107.json');fs.writeFileSync(out,JSON.stringify(e,null,2)+'\n');const r=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',out],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout.trim());
function edit(rel,old,neu){const f=path.join(dir,rel),s=fs.readFileSync(f,'utf8');if(s.split(old).length!==2)throw Error('不唯一: '+rel);fs.writeFileSync(f,s.replace(old,neu));}
const old='- 博士导师：[[师承人物 - Rachel A. Segalman|Rachel A. Segalman]]。[来源](https://escholarship.org/uc/item/9vt0d157)';
edit('人物/人员 - UT Austin - Gabriel Sanoja - c2cedfc7.md',old,old+` [UCSB 2015 年报](${url})的 Segalman 研究生指导与博士后资助混合名单列 Sanoja 为 UCB GS；支持博士阶段指导，论文正式职衔待学位库可用后复核。`);
const rev=`- 博士生：${person}。[来源](https://escholarship.org/uc/item/9vt0d157)`;
edit('人物/师承人物 - Rachel A. Segalman.md',rev,rev+` [UCSB 年报](${url})列 UCB GS，支持博士阶段指导。`);
const idx=`- ${person} → 博士导师：[[师承人物 - Rachel A. Segalman|Rachel A. Segalman]]。[来源](https://escholarship.org/uc/item/9vt0d157)`;
edit('师承关系索引.md',idx,idx+` [UCSB 年报](${url})列 UCB GS，支持博士阶段指导。`);
const oldrow='| Rachel A. Segalman、Nitash P. Balsara | Costantino Creton（[本人组校友页](https://ccreton.simm.espci.fr/home/research-group/article/former-group-members)；另 UCSB 博后待查）';
edit('UT Austin逐人复核记录.md',oldrow,`| Rachel A. Segalman、Nitash P. Balsara（既有博士论文记录；[UCSB 年报](${url})独立支持 Segalman 博士阶段指导） | Costantino Creton（[本人组校友页](https://ccreton.simm.espci.fr/home/research-group/article/former-group-members)；另 UCSB 博后待查）`);
console.log('人物、反链、索引及学校表已同步');
