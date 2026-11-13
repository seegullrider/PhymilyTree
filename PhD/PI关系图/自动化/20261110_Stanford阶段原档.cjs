const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root='..', people=path.join(root,'人物'), idx=path.join(root,'师承关系索引.md');
const records=db.prepare('select id,name,unit,filename from records where id=?');
const latest=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1');
const graph=new Map(), audits=[], typed=[];
const local=id=>records.get(id).filename;
const fn=filename=>path.join(people,filename+'.md');
const web=(label,url)=>'['+label+']('+url+')';
function editLine(file,test,edit){
 const content=graph.get(file)??fs.readFileSync(file,'utf8');
 const end=content.includes('\r\n')?'\r\n':'\n';
 const lines=content.split(/\r?\n/);
 const matches=lines.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected 1 match, got '+matches.length);
 const i=matches[0];lines[i]=edit(lines[i]);
 graph.set(file,lines.join(end));
}
function note(id,prefix,text){editLine(fn(local(id)),line=>line.startsWith(prefix),line=>line+' '+text);}
function mentorLine(mentor,id,prefix,text){
 const f=fn(mentor), r=records.get(id);
 editLine(f,line=>line.startsWith(prefix)&&line.includes('[['+r.filename+'|'),l=>l+' '+text);
}
function indexLine(id,mentor,label,text){
 const r=records.get(id);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
}
function audit(id,changes,next){
 const a=JSON.parse(latest.get(id).details_json);
 a.audit_id='20261110_'+id+'_stanford_original_1105';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_stanford_original_1105_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';
  return cells.join(' | ');
 });
}
function replaceNoteLabel(id,label,replacement,target,extra=''){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceInverseLabel(target,id,label,replacement,extra=''){
 editLine(fn(target),l=>l.startsWith('- '+label+'：')&&l.includes('[['+local(id)+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceIndexLabel(id,target,label,replacement,extra=''){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace(' → '+label+'：',' → '+replacement+'：')+extra);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

function addEdge(id,label,target,name,proof,after,candidate=false){
 const r=records.get(id);
 const line='- '+label+'：[['+target+'|'+name+']]。'+proof;
 editLine(fn(r.filename),l=>l.startsWith('- 核查边界：'),l=>line+'\n'+l);
 const file=candidate?path.join(root,'师承候选线索索引.md'):idx;
 editLine(file,l=>candidate?l==='# 师承候选线索索引':l.startsWith('- [['+r.filename+'|')&&l.includes('[['+after+'|'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+line.slice(2));
}
function newMentor(target,name,bio,student,reverse,proof){
 if(fs.existsSync(fn(target))||fs.existsSync(path.join(root,'师承人物',target+'.md')))throw Error('existing mentor '+target);
 const r=records.get(student);
 graph.set(fn(target),'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n\n- '+reverse+'：[['+r.filename+'|'+r.name+']]。'+proof+'\n');
}






function inverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}

const recordsRead=[
  {
    "record_id": "fb1eaf13",
    "url": "https://profiles.stanford.edu/alberto-salleo?tab=bio",
    "raw": "PhD, UC Berkeley, Materials Science (2001)",
    "excerpt": "Stanford 校档核材料科学与工程与 Photon Science 双任，2001 年 Berkeley 材料学博士。研究高分子半导体、柔性电子与光子器件。",
    "label": "Stanford 本人校档"
  },
  {
    "record_id": "f0b26075",
    "url": "https://physics.stanford.edu/people/alfred-zong",
    "raw": "Assistant Professor of Physics and Applied Physics",
    "excerpt": "院档核物理和应用物理任职、2020 年 MIT 物理博士及光诱导非平衡量子材料的超快探测。",
    "label": "Stanford 物理系"
  },
  {
    "record_id": "ff0e3394",
    "url": "https://biox.stanford.edu/people/amir-safavi-naeini",
    "raw": "post-doc at ETH Zurich in the group of Andreas Wallraff",
    "excerpt": "官方履历核 2013 年 Caltech 应用物理博士时在 Painter 组、ETH Wallraff 组博后、2014 年入职 Stanford。应用物理主聘，电气工程兼任。",
    "label": "Stanford Bio-X"
  },
  {
    "record_id": "e7833424",
    "url": "https://profiles.stanford.edu/charlotte-boettcher",
    "raw": "joined Qulab at Yale University as a postdoc",
    "excerpt": "本人校档核 2022 年 Harvard 物理博士、Yale QuLab 博后，2025 年入 Stanford 应用物理。博士阶段 IBM Quantum 经历独立记录。",
    "label": "Stanford 校档"
  },
  {
    "record_id": "fcee5758",
    "url": "https://hougen-programs.che.wisc.edu/hougen-professor-2004-shaqfeh.html",
    "raw": "in Chemical Engineering from Stanford University under Andreas Acrivos",
    "excerpt": "Wisconsin 讲座档核 Stanford 博士由 Acrivos 指导，1986 年 Cambridge 与 Hinch、Batchelor 做博后，1987 年后转 AT&T 技术岗位。",
    "label": "Wisconsin 化工讲座原档"
  },
  {
    "record_id": "fb3c4c3e",
    "url": "https://mse.stanford.edu/news/jennifer-dionne-faculty-spotlight",
    "raw": "advised by Harry Atwater / advised by Paul Alivisatos",
    "excerpt": "本人逐段点名 Caltech 博士导师 Atwater 和 Berkeley 化学博后导师 Alivisatos。材料科学与工程主聘，放射学兼任。",
    "label": "Stanford 材料系访谈"
  },
  {
    "record_id": "4d0aa0ff",
    "url": "https://cheme.stanford.edu/people/jian-qin",
    "raw": "under the supervision of David Morse and Frank Bates",
    "excerpt": "化工原档核 2009 年 Minnesota 博士及导师 Morse、Bates，另分 Penn State 与 Chicago 两段博后。研究聚合物、软物质和统计模拟。",
    "label": "Stanford 化工院档"
  },
  {
    "record_id": "e90bba01",
    "url": "https://choilab.stanford.edu/people/joonhee-choi",
    "raw": "IQIM postdoctoral fellow",
    "excerpt": "本人组档核 Stanford 电气工程、Harvard 应用物理博士与 Caltech IQIM 博后，研究量子多体动力学。",
    "label": "本人 Stanford 课题组"
  },
  {
    "record_id": "f5d396d8",
    "url": "https://physics.stanford.edu/people/kathryn-moler",
    "raw": "Professor of Applied Physics, of Physics and of Energy Science Engineering",
    "excerpt": "Stanford 物理系核应用物理、物理与能源科学工程三个任职及实验凝聚态方向。",
    "label": "Stanford 物理系"
  },
  {
    "record_id": "ff3e2c6a",
    "url": "https://faculty.slac.stanford.edu/person/leora-dresselhaus-marais",
    "raw": "a courtesy appointment in Mechanical Engineering",
    "excerpt": "SLAC 原档核材料科学与工程主聘、机械工程兼任及 SLAC Photon Science term appointment，另记 LLNL Lawrence Fellow。",
    "label": "SLAC 本人校档"
  },
  {
    "record_id": "f61813f4",
    "url": "https://qfarm.stanford.edu/people/paul-welander",
    "raw": "five years as a member of the technical staff at MIT Lincoln Laboratory",
    "excerpt": "Q-FARM 核 SLAC 量子器件部门负责人、Illinois 物理博士及 2012 年入 SLAC 前五年 MIT Lincoln Laboratory 技术人员，所阅履历未分列独立博后。",
    "label": "Stanford Q-FARM"
  },
  {
    "record_id": "f55e8c1e",
    "url": "https://bentgroup.stanford.edu/stacey/",
    "raw": "a postdoctoral fellow at AT&T Bell Laboratories",
    "excerpt": "本人组档核 Stanford 化学博士、AT&T Bell Labs 博后、NYU 早期教职及 Stanford 化工和能源工程，兼化学、EE 与材料。",
    "label": "本人 Stanford 课题组"
  },
  {
    "record_id": "ed7648a9",
    "url": "https://profiles.stanford.edu/vedika-khemani",
    "raw": "Junior Fellow, Harvard Society of Fellows (2019)",
    "excerpt": "Stanford 原档核现任物理系、2016 年 Princeton 物理博士、Harvard Society of Fellows 的 Junior Fellow。",
    "label": "Stanford 校档"
  }
];
const qcv="https://cap.stanford.edu/profiles/viewCV?facultyId=73239&name=Jian_Qin", scv="https://cap.stanford.edu/profiles/viewCV?facultyId=14135&name=Eric_Shaqfeh", molerProfile="https://profiles.stanford.edu/kathryn-moler";
const q='4d0aa0ff', sh='fcee5758', dion='fb3c4c3e', mol='f5d396d8', bent='f55e8c1e', wel='f61813f4', leora='ff3e2c6a';
const school=path.join(root,'Stanford逐人复核记录.md');
const udir=path.join(root,'已核实院系');
function addUnit(id,short,source){
 const target='已核实单位 - Stanford - '+short, f=path.join(udir,target+'.md');
 const slug=local(id), r=records.get(id), link='[['+target+'|'+short+']]';
 editLine(fn(slug),l=>l.startsWith('- 院系／机构：'),l=>l.replace(/。/,' · '+link+'。'));
 const uf=graph.get(f)??fs.readFileSync(f,'utf8');
 if(uf.includes('[['+slug+'|'))throw Error('已存在院系反链 '+slug);
 graph.set(f,uf.trimEnd()+'\n- [['+slug+'|'+r.name+']] — '+web('Stanford 原档',source)+'\n');
 editLine(school,l=>l.startsWith('| [['+slug+'|'),l=>{const cells=l.split(' | ');cells[1]=cells[1].replace('；','、'+short+'；');return cells.join(' | ');});
}
function addRadiology(id,source){
 const title='已核实单位 - Stanford - 放射学系（兼任）';
 const f=path.join(udir,title+'.md'), slug=local(id);
 if(fs.existsSync(f))throw Error('已有放射学系节点');
 graph.set(f,'# Stanford：放射学系（兼任）\n\n[[院校 - Stanford|返回学校]]\n\n- [['+slug+'|Jennifer Dionne]] — '+web('Stanford 材料系任职介绍',source)+'\n');
 editLine(fn(slug),l=>l.startsWith('- 院系／机构：'),l=>l.replace(/。/,' · [['+title+'|放射学系（兼任）]]。'));
 editLine(school,l=>l.startsWith('| [['+slug+'|'),l=>{const cells=l.split(' | ');cells[1]=cells[1].replace('；','、放射学系（兼任）；');return cells.join(' | ');});
 const stan=path.join(root,'院校与机构','院校 - Stanford.md');
 editLine(stan,l=>l.startsWith('- [[已核实单位 - Stanford - 能源科学与工程系|'),l=>l+'\n- [['+title+'|放射学系（兼任）]]');
}
const qPh='Stanford 托管的本人 CV 第 1 页教育栏明列 2004–2009 Minnesota 博士 advisors David Morse 与 Frank Bates。';
const qPost='本人 CV 第 1 页任职栏明确列 2009–2012 Penn State 博后 advisor Scott Milner 及 2012–2015 Chicago 博后 advisor Juan de Pablo。保留旧记录所述 Milner 组时间出入，该网页本轮返回 502。';
const sPh='Stanford 托管的本人 CV 第 1 页教育栏明列 1986-03 Stanford 化工博士 Thesis Advisor A. Acrivos。';
const sPost='本人 CV 第 1 页 Cambridge 博后条目明确列 1986-03–1986-12、Advisors G. K. Batchelor 与 E. J. Hinch；其后的 Bell Labs 技术岗位另列。';
const typedInputs={
 [q]:{phd:[qPh,qcv,[[local('dd0108f8'),'博士生'],[local('f5d72779'),'博士生']]],postdoc:[qPost,qcv,[[local('851d504c'),'博士后研究者'],[local('38ce23a3'),'博士后研究者']]]},
 [sh]:{phd:[sPh,scv,[['师承人物 - Andreas Acrivos','博士生']]],postdoc:[sPost,scv,[['师承人物 - George K. Batchelor','博士后研究者'],['师承人物 - E. J. Hinch','博士后研究者']]]},
 [dion]:{phd:['Dionne 在 Stanford 材料系本人访谈中明确其 Caltech 博士由 Harry Atwater 指导。',recordsRead.find(x=>x.record_id===dion).url,[[local('e118c47d'),'博士生']]],postdoc:['Dionne 在同一本人访谈中明确 Berkeley 化学博后由 Paul Alivisatos 指导。',recordsRead.find(x=>x.record_id===dion).url,[[local('9209cf4f'),'博士后研究者']]]}
};
const stageCells={
 [q]:[null,'Scott Milner（Penn State，2009–2012）、Juan de Pablo（Chicago，2012–2015），本人 CV 明列 advisor'],
 [sh]:[null,'Cambridge 1986-03–1986-12，George K. Batchelor 与 E. J. Hinch（本人 CV 明列 Advisors）'],
 [mol]:[null,'Princeton 1995–1998 R. H. Dicke 博后；Nai Phuan Ong（课题组负责人）'],
 [bent]:[null,'AT&T Bell Labs 博后；个人导师待核'],
 [wel]:[null,'MIT Lincoln Laboratory 技术人员；所阅履历未分列独立博士后'],
 [leora]:[null,'LLNL Lawrence Fellow，Jon Eggert（阶段研究师长；正式职衔待核）'],
 'ff0e3394':[null,'ETH Zurich Andreas Wallraff（博士后课题组负责人）']
};
const unitAdd={'fb1eaf13':'光子科学','ff0e3394':'电气工程系（兼任）','f5d396d8':'能源科学与工程系'};
for(const {record_id:id,url,excerpt,label} of recordsRead){
 const old=JSON.parse(latest.get(id).details_json);
 const refs=[url,...(id===q?[qcv]:id===sh?[scv]:id===mol?[molerProfile]:[])];
 const exp=excerpt+(id===mol?' 本人校档明确 Princeton R. H. Dicke 博后 1995–1998。':'');
 const text=web(label,url)+(refs[1]?' · '+web(id===mol?'本人校档':'本人 CV 第 1 页',refs[1]):'')+'。'+exp;
 note(id,id==='e7833424'?'- 博士后课题组负责人：':'- 核查边界：',text);
 const [phd,postdoc]=stageCells[id]??[null,null];
 changeRow(id,phd,postdoc,text);
 if(unitAdd[id])addUnit(id,unitAdd[id],url);
 if(id===dion)addRadiology(id,url);
 const changes={affiliation:['confirmed',old.aspects.affiliation.note+' '+exp,refs]};
 const typed=typedInputs[id];
 if(typed){
  for(const [stage,[evidence,source,targets]] of Object.entries(typed)){
   changes[stage]=['confirmed_advisor',evidence,[source,url]];
   for(const [target,reverse] of targets)enrich(id,stage,target,reverse,web('本人一手记录',source)+'。'+evidence);
  }
 }
 if(id===mol||id===bent||id==='e90bba01'||id==='e7833424'||id===leora||id==='ff0e3394'||id==='ed7648a9'){
  const prev=old.aspects.postdoc;
  changes.postdoc=[prev.status,prev.note+' '+exp,refs];
 }
 if(id===wel)changes.postdoc=['no_postdoc_documented',exp,refs];
 const next=id===q?'已明确博士和博士后导师；继续核对 Milner 组和本人 CV 的任期记法，待 PSU 原页可读。'
  :id===wel?'Illinois 学位档 403，保留既有博士导师关系；查可读元数据和技术岗位起点。'
  :id===sh?'两阶段指导由本人 CV 确证，后续按新履历增量核对任职。'
  :id===dion?'两阶段指导由本人访谈确证，后续按新履历增量核对任职。'
  :old.next_step;
 const auditId=audit(id,changes,next);
 const current=audits.at(-1);
 current.followup_required=id===q||id===wel||old.followup_required===true;
 if(typed)for(const [stage,[evidence,source,targets]] of Object.entries(typed)){
  for(const [target] of targets)relation(id,stage,target,'advisor',evidence,[source,url].filter((u,i,a)=>a.indexOf(u)===i),auditId,false);
 }
}


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Stanford阶段原档';
fs.writeFileSync(stamp+'_人工.json',JSON.stringify(audits,null,2)+'\n','utf8');
fs.writeFileSync(stamp+'_结构化.json',JSON.stringify(typed,null,2)+'\n','utf8');
for(const [file,content] of graph)fs.writeFileSync(file,content,'utf8');
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.review-'));
const temp=path.join(tmp,'audit.json');
try{
 for(const a of audits){
  fs.writeFileSync(temp,JSON.stringify(a),'utf8');
  console.log(execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',temp],{encoding:'utf8'}).trim());
 }
 console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
