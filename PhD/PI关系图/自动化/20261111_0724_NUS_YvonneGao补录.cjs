
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');

const urls={"nus":"https://www.physics.nus.edu.sg/staff/faculty/","nsg":"https://nusgs.nus.edu.sg/thesis-advisors/phyyyg","cqt":"https://www.cqt.sg/groups/yvonne-gao/","ya":"https://physics.yale.edu/earlier-alumni","cv":"https://rsl.yale.edu/sites/default/files/2025-11/RJ%20Schoelkopf-CV-revised-11.12.2025.pdf#page=2","pod":"https://insidequantum.org/episodes_s2/episode_yvonnegao/","app":"https://www.cqt.sg/highlight/2020-05-yvonne-gao-charles-lim-marco-tomamichel/","dis":"https://rsl.yale.edu/sites/default/files/2024-08/2018-RSL-Thesis-Yvonne%20Gao.pdf"};
const links=(...keys)=>keys.map(key=>urls[key]);
const sl=(label,key)=>'['+label+']('+urls[key]+')';
const ref=(...pairs)=>pairs.map(([label,key])=>sl(label,key)).join(' · ');
const mk=(unit,name)=>crypto.createHash('sha256').update(unit+'|'+name).digest('hex').slice(0,8);
const unit='NUS', name='Yvonne Y. Gao';
const persons=[{
 unit,name,filename:'人员 - '+unit+' - '+name+' - '+mk(unit,name),
 department:'物理系',deptLabel:'物理系、Centre for Quantum Technologies',topics:['超导量子电路','电路量子电动力学'],
 affiliation:'NUS 物理系副教授、Assistant Dean (Research and Translation)，Centre for Quantum Technologies 实验组 PI。',
 research:'超导量子电路、玻色模式电路量子电动力学和模块化量子硬件。',
 identity:'NUS 物理系原档署 Yvonne Y. Gao，CQT 原档、Yale 校友名录及导师 CV 署 Yvonne Gao，研究主题、学位及现任对应。与 NTU 物理 Weibo Gao 等人分别建档。',
 affiliateKeys:['nus','cqt','nsg'],identityKeys:['nus','cqt','ya','cv'],researchKeys:['nsg','cqt'],
 phd:{mentor:'Robert J. Schoelkopf',filename:'人员 - Yale - Robert J. Schoelkopf - f170a4a7',summary:'Robert J. Schoelkopf（Yale 2018 博士导师）',note:'Yale 物理系校友原档的 Advisor 栏列 Rob Schoelkopf 和 May 2018，Schoelkopf 本人 CV 第 2 页具名 2018 博士，CQT 本人组档交叉核博士阶段与身份。访谈提及共同指导但未具名，待原论文核对。关系类型可信度高。',keys:['ya','cv','cqt']},
 postdoc:{summary:'未发现单列博士后经历',note:'InsideQuantum 本人访谈 04:36–06:15 说明获博士学位后未接受完整博士后训练，随后返新加坡赴国家实验室工作，并曾与 Horizon Quantum 合作。CQT 2020 年原档列其开始独立组，国家实验室短期任用的职衔及指导关系仍待原档。',keys:['pod','app']},
 sourcePairs:[['NUS 物理系名录','nus'],['CQT 本人组档','cqt'],['Yale 博士名录','ya'],['导师本人 CV','cv'],['本人访谈','pod'],['CQT 独立任用','app']],
 observations:[
  ['nus','NUS Physics lists Yvonne Y. Gao as Associate Professor and Assistant Dean (Research and Translation).'],
  ['nsg','NUS Graduate School identifies her as a Physics faculty member and CQT Principal Investigator in experimental bosonic circuit QED.'],
  ['cqt','The group profile identifies her Yale doctorate in Schoelkopf’s group and independent CQT hardware group.'],
  ['ya','Yale’s department alumni table lists Yvonne Gao (May 2018), Advisor Rob Schoelkopf, with NUS placement.'],
  ['cv','Schoelkopf names Yvonne Gao among completed graduate students, PhD 2018.'],
  ['pod','She says she did not get full postdoctoral training, returned to Singapore to a national lab, and collaborated with Horizon Quantum before starting her independent group.'],
  ['app','CQT announces Yvonne Gao as one of three new Principal Investigators in May 2020.']
 ],
 errors:[['dis','Yale thesis PDF could not be loaded by the web tool because the document exceeded its size limit. The Yale department Advisor field and advisor CV were read.']]
}];
const staged=new Map();
const read=file=>staged.get(file)??fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>staged.has(file)||fs.existsSync(path.join(root,file));
const wk=(file,label)=>'[['+file+'|'+label+']]';
const personFile=name=>'人物/'+name+'.md';
function append(file,line){
 const before=read(file);
 if(before.split(/\r?\n/).includes(line))return;
 const eol=before.includes('\r\n')?'\r\n':'\n';
 staged.set(file,before.trimEnd()+eol+line+eol);
}
function insertAfter(file,heading,line,blankLine=true){
 const before=read(file);
 const eol=before.includes('\r\n')?'\r\n':'\n';
 const rows=before.split(/\r?\n/);
 if(rows.includes(line))return;
 const at=rows.indexOf(heading);
 if(at<0||rows.lastIndexOf(heading)!==at)throw Error('Nonunique anchor '+heading+' in '+file);
 if(blankLine)rows.splice(at+1,0,'');
 rows.splice(at+1+Number(blankLine),0,line);
 staged.set(file,rows.join(eol));
}
const manifest=JSON.parse(read('graph-manifest.json'));
const audits=[], edges=[], pages=[];
for(const person of persons){
 const {unit,name,filename,department,deptLabel,topics,affiliation,research,identity}=person;
 const id=mk(unit,name), auditId='pi_archive_20261111_0724_'+id;
 const who=wk(filename,name), school='院校 - '+unit, departmentNode='已核实单位 - '+unit+' - '+department;
 const file=personFile(filename), cite=ref(...person.sourcePairs);
 const audit={record_id:id,audit_id:auditId,aspects:{
  identity:{status:'confirmed',note:identity,sources:links(...person.identityKeys)},
  affiliation:{status:'confirmed',note:affiliation,sources:links(...person.affiliateKeys)},
  research:{status:'confirmed',note:research,sources:links(...person.researchKeys)}
 },followup_required:true,next_step:'追 2018–2020 新加坡国家实验室的具体任用及指导；本人访谈亦提到博士共同导师但未具名，待论文原件核对。'};
 const dup=manifest.nodes.filter(n=>n.id===id||n.filename===filename||(n.unit===unit&&n.name===name));
 if(dup.length&&!(dup.length===1&&dup[0].id===id&&dup[0].filename===filename))throw Error('Roster collision '+name);
 if(!dup.length){
  if(exists(file))throw Error('Non-manifest note already exists '+file);
  manifest.nodes.push({id,filename,name,unit,kind:'新加坡'});
  staged.set(file,[
   '# '+name,'','## 所在的学校或机构记录','','- '+wk(school,unit),'',
   '## 院系与研究方向核验（2026-11-11）','',
   '- 院系／机构：'+wk(departmentNode,deptLabel)+' · '+wk('已核实单位 - NUS - 量子技术中心','CQT')+'。'+affiliation+' '+ref(...person.sourcePairs.slice(0,2)),
   '- 研究方向：'+topics.map(t=>wk('已核实方向 - '+t,t)).join(' · ')+'。'+research+' '+ref(...person.sourcePairs.slice(0,2)),
   '- 身份：'+identity,'','## 师承',''
  ].join('\n'));
 }
 for(const [stage,label,reverse] of [['phd','博士导师','博士生'],['postdoc','博士后导师','博士后研究者']]){
  const m=person[stage];
  if(!m.filename){
   insertAfter(file,'## 师承','- '+m.summary+'。'+m.note+' '+ref(['本人访谈 04:36–06:15','pod'],['CQT 任用档','app']));
   audit.aspects[stage]={status:'no_postdoc_documented',note:m.note,sources:links(...m.keys)};
   continue;
  }
  const mentor=wk(m.filename,m.mentor);
  const e=m.note+' '+m.keys.map((k,i)=>sl('原档 '+(i+1),k)).join(' · ');
  insertAfter(file,'## 师承','- '+label+'：'+mentor+'。'+e);
  insertAfter(personFile(m.filename),'## 师承','- '+reverse+'：'+who+'。'+e);
  insertAfter('师承关系索引.md','# 师承关系与候选线索索引','- '+who+' → '+label+'：'+mentor+'。'+e);
  audit.aspects[stage]={status:'confirmed_advisor',note:m.note,sources:links(...m.keys)};
  edges.push({event_id:auditId+'_'+stage,record_id:id,stage,mentor_filename:m.filename,kind:'advisor',source_audit_id:auditId,evidence:m.note,sources:links(...m.keys)});
 }
 append('院校与机构/'+school+'.md','- '+who);
 append('已核实院系/'+departmentNode+'.md','- '+who+' — '+ref(...person.sourcePairs.slice(0,2)));
 append('已核实院系/已核实单位 - NUS - 量子技术中心.md','- '+who+' — '+ref(['CQT 原组档','cqt']));
 for(const topic of topics)append('已核实方向/已核实方向 - '+topic+'.md','- '+wk(filename,name+' · '+unit)+' — '+ref(...person.sourcePairs.slice(0,2)));
 insertAfter(unit+'逐人复核记录.md','|---|---|---|---|---|','| '+who+' | '+deptLabel+'；'+research+' | '+person.phd.summary+' | '+person.postdoc.summary+' | '+cite+' |',false);
 audits.push(audit);
 for(const [k,raw] of person.observations)pages.push({record_id:id,url:urls[k],raw,excerpt:raw});
 for(const [k,error] of person.errors??[])pages.push({record_id:id,url:urls[k],error});
}
manifest.notes=manifest.nodes.length;
manifest.units=new Set(manifest.nodes.map(n=>n.unit)).size;
staged.set('graph-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({records:audits.map(a=>a.record_id),files:staged.size,relations:edges.length,observations:pages.length}));
if(process.argv[2]!=='apply')process.exit(0);
for(const [f,t] of staged)fs.writeFileSync(path.join(root,f),t,'utf8');
const save=(suffix,value)=>{
 const f='20261111_0724_NUS_YvonneGao_'+suffix+'.json';
 fs.writeFileSync(f,JSON.stringify(value,null,2)+'\n','utf8');
 return f;
};
const run=(f,...args)=>execFileSync(process.execPath,['--no-warnings',f,...args],{stdio:'inherit'});
run('检索流程.cjs','sync');
for(const a of audits)run('人工核查台账.cjs','record',save(a.record_id,a));
run('结构化师承关系.cjs','record',save('关系',edges));
run('检索流程.cjs','ingest-reviewed-pages',save('学位及任用原档',pages));
