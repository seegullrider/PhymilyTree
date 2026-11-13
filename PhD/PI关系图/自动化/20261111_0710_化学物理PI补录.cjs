
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const urls={"sloan":"https://news.wisc.edu/uw-madison-researchers-awarded-prestigious-sloan-fellowships-4/","mn":"https://cse.umn.edu/chem/events/professor-yang-yang","mrc":"https://naturalsciencesgrads.ucmerced.edu/sites/g/files/ufvvjh1291/f/page/documents/flyer_-_yang_yang.pdf","uw":"https://badgerchemist.chem.wisc.edu/2019/08/19/department-welcomes-yang-yang-assistant-professor/","duke":"https://chem.duke.edu/news/yang-yang-receives-dissertation-award","comm":"https://commencement.duke.edu/wp-content/uploads/2018/01/2017-commencement-program.pdf#page=16","cv":"https://yang.chem.wisc.edu/wp-content/uploads/sites/1145/2024/06/YangYangCV20241009.pdf","pr":"https://chemistry.princeton.edu/faculty-research/faculty/sharon-hammes-schiffer/","prn":"https://chemistry.princeton.edu/news/sharon-hammes-schiffer-joins-princeton-chemistry/","rsc":"https://www.rsc.org/standards-and-recognition/prizes/winners/professor-sharon-hammes-schiffer","stan":"https://news.stanford.edu/stories/2026/08/hans-andersen-obituary"};
const links=(...keys)=>keys.map(key=>urls[key]);
const sl=(label,key)=>'['+label+']('+urls[key]+')';
const ref=(...pairs)=>pairs.map(([label,key])=>sl(label,key)).join(' · ');
const mk=(unit,name)=>crypto.createHash('sha256').update(unit+'|'+name).digest('hex').slice(0,8);
const wu='Wisconsin–Madison', pu='Princeton';
const yname='Yang Yang', shname='Sharon Hammes-Schiffer';
const yFile='人员 - '+wu+' - '+yname+' - '+mk(wu,yname), shFile='人员 - '+pu+' - '+shname+' - '+mk(pu,shname);
const persons=[
 {
  unit:pu,name:shname,filename:shFile,department:'化学系',deptLabel:'化学系',topics:['凝聚相电荷转移','量子动力学与光物质相互作用'],
  affiliation:'Princeton 化学系 A. Barton Hepburn Professor of Chemistry，自 2024 年入职。',research:'电子与质子耦合量子动力学、凝聚相界面电荷转移和分子极化激元的第一性原理模拟。',
  identity:'Princeton 现行化学系及任用公告、RSC 本人问答与 Stanford 导师原档相互对应。',
  affiliateKeys:['pr','prn'],identityKeys:['pr','prn','rsc','stan'],researchKeys:['pr','prn'],
  phd:{mentor:'Hans C. Andersen',filename:'师承人物 - Hans C. Andersen',summary:'Hans C. Andersen（Stanford 1993 博士导师）',note:'RSC 本人获奖问答直接称 Hans Andersen 为博士导师。Princeton 任用原档和 Stanford 院史同时核博士单位与导师，RSC 履历列 1993。关系类型可信度高。',keys:['rsc','prn','stan']},
  postdoc:{mentor:'John C. Tully',filename:'人员 - Yale - John C. Tully - 406b1d72',summary:'John C. Tully（AT&T Bell Labs 1993–1995 博士后导师）',note:'RSC 本人获奖问答直接称 John Tully 为博士后导师，并列 Stanford 1993 博士后在 AT&T Bell Laboratories 两年，Princeton 入职原档交叉确认任用单位。关系类型可信度高。',keys:['rsc','prn']},
  sourcePairs:[['Princeton 化学系','pr'],['Princeton 任用原档','prn'],['RSC 本人问答','rsc'],['Stanford 导师原档','stan']],
  observations:[
   ['pr','The Princeton departmental profile identifies Hammes-Schiffer as A. Barton Hepburn Professor of Chemistry and describes theory of interfacial charge transfer and molecular quantum dynamics.'],
   ['prn','The Princeton hiring profile records Stanford doctoral work with Hans C. Andersen and a subsequent AT&T Bell Labs postdoc.'],
   ['rsc','In her own answer, Hammes-Schiffer identifies Hans Andersen as her PhD advisor and John Tully as her postdoc advisor.'],
   ['stan','Stanford describes Hammes-Schiffer as a former doctoral student of Andersen, with a quote from her and current Princeton title.']
  ]
 },
 {
  unit:wu,name:yname,filename:yFile,department:'Chemistry',deptLabel:'化学系',topics:['分子电子结构','量子化学与材料计算'],
  affiliation:'Wisconsin–Madison 化学系。2026 年 Sloan 校方报道列化学助理教授。',research:'理论与计算化学、多组分电子结构方法和核量子效应，应用到分子动力学与材料计算。',
  identity:'Wisconsin 任用与 2026 Sloan 原档、Duke 论文题名及 Minnesota、UC Merced 本人讲座匹配。同名 UCLA 光电子材料教授为另一人。',
  affiliateKeys:['sloan','uw'],identityKeys:['sloan','mn','mrc','duke','comm'],researchKeys:['sloan','mn'],
  phd:{mentor:'Weitao Yang',filename:'人员 - Duke - Weitao Yang - 8d6cfdc7',summary:'Weitao Yang（Duke 2016 博士导师）',note:'UC Merced 与 Minnesota 本人讲座明确 Duke 2016 博士 under Weitao Yang。Duke 院系论文奖报道核实验室及准确论文题名，Duke 典礼册原档第 16 页载同题名。关系类型可信度高。',keys:['mn','mrc','duke','comm']},
  postdoc:{mentor:shname,filename:shFile,summary:'Sharon Hammes-Schiffer（UIUC、Yale 博士后导师）',note:'Wisconsin 任用原档把 Yale 博士后写为 under the direction of Sharon Hammes-Schiffer；UC Merced 与 Minnesota 本人讲座列 UIUC、Yale 的连续阶段均与 Hammes-Schiffer 开展研究。Duke 2016 同期原档核 UIUC 博后在她的组。关系类型可信度高。',keys:['uw','mn','mrc','duke']},
  sourcePairs:[['Wisconsin 2026 Sloan 原档','sloan'],['Wisconsin 任用','uw'],['Minnesota 本人讲座','mn'],['UC Merced 本人讲座','mrc'],['Duke 论文奖','duke'],['Duke 典礼册第 16 页','comm']],
  observations:[
   ['sloan','Wisconsin identifies the 2026 Sloan fellow as Yang Yang, assistant professor of chemistry, developing quantum nuclear effects in electronic structure and molecular dynamics.'],
   ['uw','Wisconsin’s hiring article names Sharon Hammes-Schiffer as directing his Yale postdoctoral work.'],
   ['mn','Minnesota’s seminar lists Duke PhD under Weitao Yang, UIUC and Yale postdoc with Sharon Hammes-Schiffer, and Wisconsin chemistry.'],
   ['mrc','UC Merced’s seminar flyer records PhD under the guidance of Weitao Yang and postdoc with Sharon Hammes-Schiffer at UIUC and Yale.'],
   ['duke','Duke’s original award notice identifies Yang Yang of the Weitao Yang lab, gives dissertation title, and reports his UIUC postdoctoral appointment in Sharon Hammes-Schiffer’s group.'],
   ['comm','The Duke commencement book page 16 lists Yang Yang and his dissertation on the particle-particle random phase approximation.']
  ],
  errors:[['cv','University CV endpoint returned an anti-bot interstitial. Two original seminar biographies and two home department records were available.']]
 }
];
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
 const id=mk(unit,name), auditId='pi_archive_20261111_0710_'+id;
 const who=wk(filename,name), school='院校 - '+unit, departmentNode='已核实单位 - '+unit+' - '+department;
 const file=personFile(filename), cite=ref(...person.sourcePairs);
 const audit={record_id:id,audit_id:auditId,aspects:{
  identity:{status:'confirmed',note:identity,sources:links(...person.identityKeys)},
  affiliation:{status:'confirmed',note:affiliation,sources:links(...person.affiliateKeys)},
  research:{status:'confirmed',note:research,sources:links(...person.researchKeys)}
 },followup_required:false,next_step:'博士和博士后具名导师、任职、方向已核。'};
 const dup=manifest.nodes.filter(n=>n.id===id||n.filename===filename||(n.unit===unit&&n.name===name));
 if(dup.length&&!(dup.length===1&&dup[0].id===id&&dup[0].filename===filename))throw Error('Roster collision '+name);
 if(!dup.length){
  if(exists(file))throw Error('Non-manifest note already exists '+file);
  manifest.nodes.push({id,filename,name,unit,kind:'美国'});
  staged.set(file,[
   '# '+name,'','## 所在的学校或机构记录','','- '+wk(school,unit),'',
   '## 院系与研究方向核验（2026-11-11）','',
   '- 院系／机构：'+wk(departmentNode,deptLabel)+'。'+affiliation+' '+ref(...person.sourcePairs.slice(0,2)),
   '- 研究方向：'+topics.map(t=>wk('已核实方向 - '+t,t)).join(' · ')+'。'+research+' '+ref(...person.sourcePairs.slice(0,2)),
   '- 身份：'+identity,'','## 师承',''
  ].join('\n'));
 }
 for(const [stage,label,reverse] of [['phd','博士导师','博士生'],['postdoc','博士后导师','博士后研究者']]){
  const m=person[stage], mentor=wk(m.filename,m.mentor);
  const e=m.note+' '+m.keys.map((k,i)=>sl('原档 '+(i+1),k)).join(' · ');
  insertAfter(file,'## 师承','- '+label+'：'+mentor+'。'+e);
  insertAfter(personFile(m.filename),'## 师承','- '+reverse+'：'+who+'。'+e);
  insertAfter('师承关系索引.md','# 师承关系与候选线索索引','- '+who+' → '+label+'：'+mentor+'。'+e);
  audit.aspects[stage]={status:'confirmed_advisor',note:m.note,sources:links(...m.keys)};
  edges.push({event_id:auditId+'_'+stage,record_id:id,stage,mentor_filename:m.filename,kind:'advisor',source_audit_id:auditId,evidence:m.note,sources:links(...m.keys)});
 }
 append('院校与机构/'+school+'.md','- '+who);
 append('已核实院系/'+departmentNode+'.md','- '+who+' — '+ref(...person.sourcePairs.slice(0,2)));
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
 const f='20261111_0710_化学物理PI_'+suffix+'.json';
 fs.writeFileSync(f,JSON.stringify(value,null,2)+'\n','utf8');
 return f;
};
const run=(f,...args)=>execFileSync(process.execPath,['--no-warnings',f,...args],{stdio:'inherit'});
run('检索流程.cjs','sync');
for(const a of audits)run('人工核查台账.cjs','record',save(a.record_id,a));
run('结构化师承关系.cjs','record',save('关系',edges));
run('检索流程.cjs','ingest-reviewed-pages',save('学位及任用原档',pages));
