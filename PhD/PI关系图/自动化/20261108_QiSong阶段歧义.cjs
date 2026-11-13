// 混合校友目录未写具体阶段：保留原证据和研究关系，仅将博士后组属标为待核。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),id='7464b0a0',mentor='人员 - Cornell - Darrell Schlom - 30d7c793',dir=path.join(root,'人物');
const saved=fs.readFileSync(path.join(__dirname,'Schlom组博士后访问校友目录-20261108.txt'),'utf8');
for(const s of ['L142: Alumni - Postdocs and Visiting Scholars','L320: Qi Song','L322: 【78†University of California, Irvine'])if(!saved.includes(s))throw Error('名录原文不符 '+s);
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row=db.prepare('SELECT r.filename,a.audit_id,a.details_json FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1) WHERE r.id=?').get(id);if(!row||row.audit_id!=='20261106_7464b0a0_harvard_group_candidate')throw Error('最新事件已变化');
if(db.prepare("SELECT 1 FROM typed_relation_events WHERE record_id=? AND stage='postdoc' AND mentor_filename=?").get(id,mentor))throw Error('已有类型化关系，需人工对照');db.close();
const alumn='https://schlom.mse.cornell.edu/all-members/resume',uci='https://engineering.uci.edu/files/10-9-2025_qi_song_flyer_0.pdf';
const evidence=`[Schlom 组校友目录](${alumn})将 Qi Song、UC Irvine 列在博士后与访问学者混合栏目；[UCI 简介](${uci})确认 Cornell 博后，但名录未写明她的组属阶段或日期，故暂作博士后课题组候选，正式 advisor 亦待核。`;
const updates=new Map();function lineEdit(file,find,replace){let s=updates.get(file)??fs.readFileSync(file,'utf8'),lines=s.split('\n'),idx=lines.map((x,i)=>find(x)?i:-1).filter(i=>i>=0);if(idx.length!==1)throw Error('目标行不唯一 '+file+' '+idx.length);lines[idx[0]]=replace(lines[idx[0]].replace(/\r$/,''));updates.set(file,lines.join('\n'));}
const person=path.join(dir,row.filename+'.md'),supervisor=path.join(dir,mentor+'.md'),index=path.join(root,'师承关系索引.md'),school=path.join(root,'UC Irvine逐人复核记录.md');
lineEdit(person,l=>l.startsWith('- 博士后课题组负责人：[['+mentor),()=>'- 博士后课题组候选：[['+mentor+'|Darrell Schlom]]。'+evidence);
lineEdit(person,l=>l.startsWith('- 核查边界：')&&l.includes('Cornell 页面确证组归属'),l=>l.replace('Cornell 页面确证组归属而非正式导师职衔','Cornell 混合校友名录不能单独证明组属与博士后阶段对应，正式导师职衔亦待核'));
lineEdit(supervisor,l=>l.startsWith('- 博士后课题组成员：[[')&&l.includes(id),()=>'- 博士后课题组成员候选：[['+row.filename+'|Qi Song]]。'+evidence);
lineEdit(index,l=>l.includes(id)&&l.includes('→ 博士后课题组负责人：[['+mentor),()=>'- [['+row.filename+'|Qi Song]] → 博士后课题组负责人候选：[['+mentor+'|Darrell Schlom]]。'+evidence);
lineEdit(school,l=>l.startsWith('| [['+row.filename+'|'),l=>{if(!l.includes('Darrell Schlom（Cornell 课题组负责人）'))throw Error('校表旧标签已变化');return l.replace('Darrell Schlom（Cornell 课题组负责人）','Darrell Schlom（Cornell 博士后组属候选）').replace(/\s*\|\s*$/,'；[Schlom 混合校友目录]('+alumn+') |')});
const audit=JSON.parse(row.details_json);audit.audit_id='20261108_qi_song_mixed_alumni';audit.aspects.postdoc.note='Schlom 组校友目录列 UCI Qi Song 于博士后和访问学者混合栏目；UCI 简介确认 Cornell 博后，但目录未列她的组属时间或阶段，故暂记博士后组属候选，不确定正式导师。Harvard 2019 博士论文中的 Mundy 组同名者、任职与方向的交叉线索仍待核。';if(!audit.aspects.postdoc.sources.includes(alumn))audit.aspects.postdoc.sources.push(alumn);audit.followup_required=true;audit.next_step='核对本人 CV 或组方原始资料，确定 Cornell Schlom 组属是否为博士后阶段、Harvard Mundy 组同名身份及两段正式导师；追查博士论文。';
const af=path.join(__dirname,'人工-20261108_qi_song_mixed_alumni.json');if(fs.existsSync(af))throw Error('事件已存在');for(const [f,s] of updates)fs.writeFileSync(f,s,'utf8');fs.writeFileSync(af,JSON.stringify(audit,null,2)+'\n',{encoding:'utf8',flag:'wx'});console.log(JSON.stringify({record:id,files:updates.size,audit:audit.audit_id,note:'保留历史证据；须随后导入人工事件并录入候选类型。'}));
