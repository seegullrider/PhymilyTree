const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const batch='20261111_1100_材料相变PI';
const links={
  ox:'https://ora.ox.ac.uk/objects/uuid%3A76a40bde-0be9-4166-851b-20e56c1ccaad',
  huber:'https://eng.ox.ac.uk/people/john-huber',
  carter:'https://ilpstex.mit.edu/en/content/faculty-profiles/w-craig-carter',
  ananya:'https://www.materials.ucsb.edu/people/faculty/ananya-renuka-balakrishna',
  ananyaHire:'https://www.materials.ucsb.edu/news/ucsb-materials-will-welcome-assistant-professor-ananya-renuka-balakrishna-november-1-2022',
  ananyaCV:'https://viterbi.usc.edu/directory/cv/renuka%20balakrishna_ananya_cv.pdf#page=1',
  james:'https://james.umn.edu/news',
  paul:'https://viterbi.usc.edu/directory/faculty/Plucinsky/Paul',
  paulCV:'https://viterbi.usc.edu/directory/cv/plucinsky_paul_cv.pdf#page=1',
  paulThesis:'https://thesis.caltech.edu/10250/',
  ashley:'https://www.me.engin.umich.edu/people/faculty/ashley-bucsek/',
  ashleyReport:'https://me.engin.umich.edu/wp-content/uploads/mev1/2020-01/ME201819AnnualReport.pdf',
  ashleyJoint:'https://regents.umich.edu/files/meetings/03-23/2023-03-V-2.pdf',
  ashleyAward:'https://www.minesnewsroom.com/news/phd-candidate-wins-presidents-postdoctoral-fellowship',
  ashleyCV:'https://inside.mines.edu/UserFiles/File/StebnerLab/BucsekA_CV.pdf',
  ashleySem:'https://dept.aem.umn.edu/info/seminars/Solids/index.shtml',
  stebner:'https://www.me.gatech.edu/news/aaron-stebner-selected-receive-2025-asm-silver-medal',
  stebnerHire:'https://www.me.gatech.edu/news/associate-professor-aaron-stebner-appointed-eugene-c-gwaltney-jr-chair-manufacturing',
  stebnerCV:'https://inside.mines.edu/UserFiles/File/StebnerLab/Stebner_CV_Mar2015%281%29.pdf',
  stebnerQA:'https://me.gatech.edu/news/qa-associate-professor-aaron-stebner',
  brinson:'https://dmi.duke.edu/people/faculty/l-catherine-brinson',
  ravi:'https://www.aphms.caltech.edu/people/ravichan'
};
const idFor=(unit,name)=>crypto.createHash('sha256').update(unit+'|'+name).digest('hex').slice(0,8);
const nameFor=(unit,name)=>'人员 - '+unit+' - '+name+' - '+idFor(unit,name);
const ext=name=>'师承人物 - '+name;
const aaron=nameFor('Georgia Tech','Aaron Stebner');
const records=[
 {name:'Aaron Stebner',unit:'Georgia Tech',deps:['机械工程系','材料科学与工程系'],topics:['固态相变','材料建模'],
  affiliation:'Woodruff 机械工程学院教授，联合任职材料科学与工程学院。2025 年校方记录为 Eugene C. Gwaltney, Jr. Chair in Manufacturing。',
  research:'形状记忆合金、马氏体相变、材料显微结构与力学。',
  identity:'Georgia Tech 履历中的 Northwestern 2012 博士、Caltech 博后和 Colorado School of Mines 教职与本人 CV 一致。',
  current:['stebner','stebnerHire','stebnerQA'],
  phd:[['L. Catherine Brinson',ext('L. Catherine Brinson'),'advisor','本人 CV 第 2 页将 Brinson 列为 Northwestern 2008–2012 Graduate Research Fellow 的 Advisor，博士论文为形状记忆镍钛合金的应变与中子衍射。',['stebnerCV','stebnerHire']]],
  postdoc:[
   ['Guruswami Ravichandran',ext('Guruswami Ravichandran'),'group_leader','本人 CV 第 1 页列 Caltech 2012–2013 博后项目 PI 为 Ravichandran。',['stebnerCV','stebnerHire','ravi']],
   ['Kaushik Bhattacharya',ext('Kaushik Bhattacharya'),'stage_mentor','本人 CV 第 1 页在 Caltech 博后经历中称 Bhattacharya 为 Collaborator/Mentor。',['stebnerCV','stebnerHire']]
  ],
  step:'继续核对 Caltech 博后聘书中的正式导师称谓及 Northwestern 学位签署原件。',
  observations:[
   ['stebner','Georgia Tech names Aaron Stebner professor of Mechanical Engineering and Materials Science and Engineering.'],
   ['stebnerHire','Georgia Tech appointment history lists Northwestern PhD in 2012 and Caltech postdoctoral scholar 2012–2013.'],
   ['stebnerCV','The CV explicitly labels Catherine Brinson doctoral-period advisor, Ravichandran postdoctoral PI, and Bhattacharya postdoctoral collaborator and mentor.']
  ]},
 {name:'Ananya Renuka Balakrishna',unit:'UC Santa Barbara',deps:['Materials'],topics:['铁电材料','相变与微结构','计算材料科学'],
  affiliation:'UC Santa Barbara Materials 副教授。校方任用公告列 2022 年 11 月由 USC 转入。',
  research:'铁电和磁性材料、相场建模、固态相变与微结构演化。',
  identity:'UCSB 现任、本人 USC 时期 CV 和 Oxford 论文题名及 DPhil 一致。',
  current:['ananya','ananyaHire'],
  phd:[['John E. Huber',ext('John E. Huber'),'advisor','本人 CV 指名 John E. Huber 为 2016 Oxford DPhil 论文 Advisor，Oxford 学位目录同题论文列 J. Huber 为 Supervisor。',['ananyaCV','ox']]],
  postdoc:[
   ['W. Craig Carter',ext('W. Craig Carter'),'stage_mentor','本人 CV 列 MIT 材料系 Lindemann 博后 2016–2018，导师一栏使用 Mentor，具名 Carter 与 Chiang。',['ananyaCV','ananyaHire','carter']],
   ['Yet-Ming Chiang',ext('Yet-Ming Chiang'),'stage_mentor','本人 CV 列 MIT 材料系 Lindemann 博后 2016–2018，具名 Mentor 为 Chiang 与 Carter。',['ananyaCV','ananyaHire']],
   ['Richard D. James',ext('Richard D. James'),'stage_mentor','本人 CV 列 Minnesota 2018–2020 博后 Mentor 为 James。James 组 2019 同期新闻及 2023 回顾均核组属。',['ananyaCV','james','ananyaHire']]
  ],
  step:'按 CV 保留 MIT 与 Minnesota 的阶段及导师称谓，继续查正式博士后任命中的 advisor 字段。',
  observations:[
   ['ananya','UCSB lists Associate Professor of Materials, with research in phase transformations of magnetic and ferroelectric compounds.'],
   ['ananyaHire','UCSB hiring notice identifies the 2022 move from USC and postdoctoral research at MIT and Minnesota.'],
   ['ananyaCV','The CV lists Oxford doctoral advisor John E. Huber and postdoctoral mentors Carter and Chiang at MIT, James at Minnesota.']
  ]},
 {name:'Paul Plucinsky',unit:'USC',deps:['航空航天与机械工程系'],topics:['软物质力学','材料相变'],
  affiliation:'USC 航空航天与机械工程系，现行工程目录列助理教授。2020 年 1 月入职。',
  research:'向列液晶弹性体、可变形材料、形状记忆合金和纳米结构相变。',
  identity:'USC 现任系档与本人 CV、Caltech 学位题名和 Minnesota 组档一致。',
  current:['paul','paulCV'],
  phd:[['Kaushik Bhattacharya',ext('Kaushik Bhattacharya'),'advisor','Caltech 学位库列 Bhattacharya 为 2017 机械工程博士论文 Advisor，本人 CV 第 1 页同列。',['paulThesis','paulCV']]],
  postdoc:[['Richard D. James',ext('Richard D. James'),'advisor','USC 托管本人 CV 第 1 页把 Richard D. James 列为 Minnesota 2017–2020 Postdoctoral Scholar 的 Advisor，James 组同期新闻确认 2017 年 9 月入组。',['paulCV','james']]],
  observations:[
   ['paul','USC current directory identifies Aerospace and Mechanical Engineering and research on nematic elastomers and phase transitions.'],
   ['paulCV','CV lists Kaushik Bhattacharya doctoral advisor and Richard D. James postdoctoral advisor.'],
   ['paulThesis','CaltechTHESIS lists 2017 PhD dissertation, Paul P. Plucinsky, and advisor Kaushik Bhattacharya.']
  ]},
 {name:'Ashley Bucsek',unit:'University of Michigan, Ann Arbor',deps:['机械工程系','材料科学与工程系'],topics:['固态相变','同步辐射 X 射线衍射'],
  affiliation:'Michigan 机械工程及材料科学与工程任职。机械系当前资料列两系副教授，校董事会原档另核历史联合任命。',
  research:'马氏体相变、形状记忆合金、微观力学和三维原位 X 射线衍射。',
  identity:'Michigan 任用年报列 Mines 机械工程博士及 Minnesota 博后，与 Mines 当期奖助和 Minnesota 同期组档对应。',
  current:['ashley','ashleyReport','ashleyJoint'],
  phd:[['Aaron Stebner',aaron,'advisor','Mines 托管本人博士阶段 CV 将 Aaron Stebner 列为 NSF Graduate Research Fellow 的 Advisor，Stebner CV 的博士生名单和 Mines 2018 报道核同一学位阶段。',['ashleyCV','stebnerCV','ashleyAward','ashleyReport']]],
  postdoc:[['Richard D. James',ext('Richard D. James'),'stage_mentor','Mines 2018 校方奖助原报道具名 Bucsek 将在 Richard James 指导下任 Minnesota 博后，Minnesota 2018 系内报告和组新闻证实实际入组。正式任命职衔待核。',['ashleyAward','ashleySem','james']]],
  step:'继续找本人学位签署页及 Minnesota 博后任命原档的正式指导职衔。',
  observations:[
   ['ashleyReport','Michigan department annual report records Mines PhD and Minnesota postdoctoral training for Ashley Bucsek.'],
   ['ashleyCV','Doctoral-period CV identifies Aaron Stebner as advisor of the Mines NSF graduate research appointment.'],
   ['ashleyAward','Colorado School of Mines states Bucsek will work under Richard James on her University of Minnesota postdoctoral fellowship.'],
   ['ashleySem','Minnesota 2018 seminar identifies Bucsek as postdoctoral fellow in the James group.']
  ],
  errors:[['ashley','原网址直接核读返回 HTTP 403。公开索引的院系职衔以 Michigan 董事会历史联合任命、系年报和材料研究中心目录交叉核对。']]
 }
];
const mentorNotes=[
 ['John E. Huber','Oxford 工程科学系，研究铁电、压电和材料微力学。','huber'],
 ['W. Craig Carter','MIT 材料科学与工程系，研究界面热力学、动力学和微结构演化。','carter'],
 ['L. Catherine Brinson','Duke 机械工程与材料科学系，研究纳米结构聚合物、复杂材料力学与建模。','brinson'],
 ['Guruswami Ravichandran','Caltech 航空航天与机械工程，研究铁电、形状记忆合金和固体力学。','ravi']
];
const labels={
 phd:{advisor:['博士导师','博士生']},
 postdoc:{advisor:['博士后导师','博士后研究者'],stage_mentor:['博士后阶段研究师长','博士后阶段研究者'],group_leader:['博士后课题组负责人','博士后课题组研究者']}
};
const files=new Map();
const read=f=>files.get(f)??fs.readFileSync(path.join(root,f),'utf8');
const exists=f=>files.has(f)||fs.existsSync(path.join(root,f));
const personFile=f=>'人物/'+f+'.md';
const wiki=(f,label)=>'[['+f+'|'+label+']]';
const refs=keys=>keys.map((k,i)=>'[原档 '+(i+1)+']('+links[k]+')').join(' · ');
const urls=keys=>keys.map(k=>links[k]);
function addLine(file,line,heading){
 const before=read(file);
 const eol=before.includes('\r\n')?'\r\n':'\n';
 const rows=before.split(/\r?\n/);
 if(rows.includes(line))return;
 if(heading){
  const pos=rows.indexOf(heading);
  if(pos<0||rows.lastIndexOf(heading)!==pos)throw Error('nonunique heading '+file+' '+heading);
  rows.splice(pos+1,0,line);
  files.set(file,rows.join(eol));
 }else files.set(file,before.trimEnd()+eol+line+eol);
}
const manifest=JSON.parse(read('graph-manifest.json'));
const audits=[], edges=[], pages=[];
for(const [name,description,key] of mentorNotes){
 const file=personFile(ext(name));
 if(!exists(file))files.set(file,['# '+name,'','- 类型：师承扩展人物','- '+description+' '+refs([key]),'','## 师承',''].join('\n'));
}
for(const person of records){
 const {name,unit,deps,topics,current}=person;
 const id=idFor(unit,name), filename=nameFor(unit,name), file=personFile(filename);
 const auditId='pi_archive_'+batch.slice(0,13)+'_'+id;
 const who=wiki(filename,name), school='院校 - '+unit, evidence=refs(current);
 const departmentNodes=deps.map(d=>'已核实单位 - '+unit+' - '+d);
 const prior=manifest.nodes.filter(n=>n.id===id||n.filename===filename||n.name===name);
 if(prior.length&&(prior.length!==1||prior[0].id!==id||prior[0].filename!==filename))throw Error('identity collision '+name);
 if(!prior.length){
  if(exists(file))throw Error('untracked person note '+file);
  manifest.nodes.push({id,filename,name,unit,kind:'美国'});
  files.set(file,['# '+name,'','## 所在的学校或机构记录','', '- '+wiki(school,unit),'',
   '## 院系与研究方向核验（2026-11-11）','',
   '- 院系／机构：'+departmentNodes.map((d,i)=>wiki(d,deps[i])).join(' · ')+'。'+person.affiliation+' '+evidence,
   '- 研究方向：'+topics.map(t=>wiki('已核实方向 - '+t,t)).join(' · ')+'。'+person.research+' '+evidence,
   '- 身份：'+person.identity,'','## 师承',''].join('\n'));
 }
 const aspects={
  identity:{status:'confirmed',note:person.identity,sources:urls(current)},
  affiliation:{status:'confirmed',note:person.affiliation,sources:urls(current)},
  research:{status:'confirmed',note:person.research,sources:urls(current)}
 };
 const schoolCells=[];
 for(const stage of ['phd','postdoc']){
  const summaries=[], descriptions=[], sources=[];
  for(const [i,[mentor,mfile,kind,description,keys]] of person[stage].entries()){
   const [forward,reverse]=labels[stage][kind];
   const relationEvidence=description+' '+refs(keys);
   addLine(file,'- '+forward+'：'+wiki(mfile,mentor)+'。'+relationEvidence,'## 师承');
   addLine(personFile(mfile),'- '+reverse+'：'+who+'。'+relationEvidence,'## 师承');
   addLine('师承关系索引.md','- '+who+' → '+forward+'：'+wiki(mfile,mentor)+'。'+relationEvidence,'# 师承关系与候选线索索引');
   summaries.push(mentor+'（'+forward+'）');
   descriptions.push(description);
   sources.push(...urls(keys));
   edges.push({event_id:auditId+'_'+stage+'_'+i,record_id:id,stage,mentor_filename:mfile,kind,source_audit_id:auditId,evidence:description,sources:urls(keys)});
  }
  aspects[stage]={status:person[stage].some(x=>x[2]==='advisor')?'confirmed_advisor':'group_or_candidate',note:descriptions.join(' '),sources:[...new Set(sources)]};
  schoolCells.push(summaries.join('、'));
 }
 addLine('院校与机构/'+school+'.md','- '+who);
 for(const d of departmentNodes)addLine('已核实院系/'+d+'.md','- '+who+' — '+evidence);
 for(const t of topics)addLine('已核实方向/已核实方向 - '+t+'.md','- '+wiki(filename,name+' · '+unit)+' — '+evidence);
 const reviewRefs=[...new Set([...current,...person.phd.flatMap(x=>x[4]),...person.postdoc.flatMap(x=>x[4])])];
 addLine(unit+'逐人复核记录.md','| '+who+' | '+deps.join('、')+'。'+person.research+' | '+schoolCells.join(' | ')+' | '+refs(reviewRefs)+' |','|---|---|---|---|---|');
 audits.push({record_id:id,audit_id:auditId,aspects,followup_required:Boolean(person.step),next_step:person.step??'两阶段具名导师已由原始记录交叉核验。'});
 for(const [k,raw] of person.observations)pages.push({record_id:id,url:links[k],raw,excerpt:raw});
 for(const [k,error] of person.errors??[])pages.push({record_id:id,url:links[k],error});
}
manifest.notes=manifest.nodes.length;
manifest.units=new Set(manifest.nodes.map(n=>n.unit)).size;
files.set('graph-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({records:audits.map(a=>a.record_id),files:files.size,relations:edges.length,observations:pages.length}));
if(process.argv[2]!=='apply')process.exit(0);
for(const [file,body] of files)fs.writeFileSync(path.join(root,file),body,'utf8');
function persist(suffix,data){
 const file=batch+'_'+suffix+'.json';
 fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n','utf8');
 return file;
}
function run(file,...args){execFileSync(process.execPath,['--no-warnings',file,...args],{stdio:'inherit'});}
run('检索流程.cjs','sync');
for(const audit of audits)run('人工核查台账.cjs','record',persist(audit.record_id,audit));
run('结构化师承关系.cjs','record',persist('关系',edges));
run('检索流程.cjs','ingest-reviewed-pages',persist('原档回执',pages));

