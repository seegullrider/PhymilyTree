const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),{spawnSync}=require('child_process');
const root=path.join(__dirname,'..'),id='857ac7ad',cv='https://sites.utexas.edu/shyamshankar/files/2020/08/Shyam_cv.pdf',thesis='https://www.princeton.edu/~sturmlab/theses/Kun_Yao_thesis.pdf',cv2='https://sites.utexas.edu/shyamshankar/files/2024/10/Shankar_CV_CSEformat_20240911.pdf';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!row)throw Error('缺少台账');const e=JSON.parse(row.details_json);db.close();
e.audit_id='20261107_shyam_princeton_thesis_trace_'+id;e.aspects.phd={status:'group_or_candidate',note:'本人 2020 CV 明列 Princeton 2010 博士论文题名 Electron spin coherence in bulk silicon and silicon heterostructures；Princeton Kun Yao 的 2009 论文致谢明确称 Shyam Shankar 属 Lyon 组，可确认博士阶段组属但不单凭此证明正式导师。2024/2025 本人 CV 的斜体导师标记本轮截图缓存不可用。',sources:[cv,thesis,cv2]};e.next_step='按本人 CV 的精确论文题名追查 Princeton 学位论文；可用时获取保留斜体的本人 CV，区分 Lyon 正式论文导师和 Devoret 博后 mentor。';e.followup_required=true;
const out=path.join(__dirname,'本轮核查-Shyam-'+id+'-20261107.json');fs.writeFileSync(out,JSON.stringify(e,null,2)+'\n');const r=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',out],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout.trim());
function edit(rel,old,neu){const f=path.join(root,rel),s=fs.readFileSync(f,'utf8');if(s.split(old).length!==2)throw Error('不唯一 '+rel);fs.writeFileSync(f,s.replace(old,neu));}
const title=`- 已核博士论文题名：《Electron spin coherence in bulk silicon and silicon heterostructures》，Princeton 2010。[本人 2020 CV](${cv})直接列出；论文导师仍须其学位论文或可见格式的履历确认。`;
edit('人物/人员 - UT Austin - Shyam Shankar - 857ac7ad.md','## 师承\n','## 师承\n\n'+title+'\n');
const line='- 博士阶段课题组负责人：[[人员 - Princeton - Stephen A. Lyon - 60b542fc|Stephen A. Lyon]]。[来源]('+thesis+')';
edit('人物/人员 - UT Austin - Shyam Shankar - 857ac7ad.md',line,line+' 证据：2009 年 Kun Yao 博士论文致谢称 Shyam Shankar 属 Lyon 组；组属不单独确证正式导师。');
const s='PhD/PI关系图/人物/人员 - UT Austin - Shyam Shankar - 857ac7ad.md';
edit('UT Austin逐人复核记录.md','[课题组](https://sites.utexas.edu/shyamshankar/)；[本人简历]','[课题组](https://sites.utexas.edu/shyamshankar/)；[本人 2020 CV 博士论文题名]('+cv+')；[本人简历]');
console.log('博士论文题名与组属来源已更新，未提升正式导师');
