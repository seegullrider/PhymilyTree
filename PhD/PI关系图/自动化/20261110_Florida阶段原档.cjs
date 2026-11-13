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
 a.audit_id='20261110_'+id+'_florida_original_1120';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_florida_original_1120_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const data=[
  {
    "id": "43e55cbe",
    "label": "UF 物理系",
    "raw": "PhD in Applied Physics, Stanford University (2014)",
    "detail": "UF 原档确认 2014 Stanford 应用物理博士、Quantum Theory Project 与凝聚态理论。",
    "url": "https://phys.ufl.edu/people/faculty/chunjing-jia/"
  },
  {
    "id": "e800f362",
    "label": "UF 物理系",
    "raw": "Condensed Matter Experiment / National High Magnetic Field Laboratory",
    "detail": "UF 院档确认物理与 National High Magnetic Field Laboratory 关联，核低温量子器件、隧穿和 Coulomb drag。",
    "url": "https://phys.ufl.edu/people/faculty/dominique-laroche/"
  },
  {
    "id": "92418648",
    "label": "本人 UF 课题组",
    "raw": "Advisor: Prof. Susanne Stemmer / Advisor: Prof. Jian-Min Zuo",
    "detail": "本人实验室明确将 Illinois 博士导师和 UCSB 博后导师分列，核 UF 材料系及电子显微方法。",
    "url": "https://kim.mse.ufl.edu/people/"
  },
  {
    "id": "d2af2825",
    "label": "UF 物理系",
    "raw": "PhD Washington University in St. Louis (2007)",
    "detail": "UF 院档核物理教授、WashU 2007 博士和高压超导研究。",
    "url": "https://phys.ufl.edu/directory/james-hamlin/"
  },
  {
    "id": "cb776233",
    "label": "UF 物理系",
    "raw": "Ph.D., Pennsylvania State University, University Park (2020)",
    "detail": "UF 物理原档核 Penn State 2020 博士、凝聚态理论、拓扑量子材料和 moiré。",
    "url": "https://phys.ufl.edu/directory/jiabin-yu/"
  },
  {
    "id": "7e112b30",
    "label": "本人 UF CV",
    "raw": "Doctoral and Postdoctoral Mentors",
    "detail": "本人 CV 第 1 页将 Paul J. Steinhardt、John W. Wilkins 分列博士与博士后 mentors，明确 Ohio State 1990–1992 博后。",
    "url": "https://people.clas.ufl.edu/ingersent/files/2026/04/vita.pdf"
  },
  {
    "id": "a346e262",
    "label": "本人 UF 主页",
    "raw": "Distinguished Professor of Physics",
    "detail": "本人页列物理系，核非常规超导、强关联费米体系及无序。",
    "url": "https://people.clas.ufl.edu/pjh/"
  },
  {
    "id": "95701d41",
    "label": "UF 物理系",
    "raw": "PhD, Stanford University (2021)",
    "detail": "UF 院档列 2021 Stanford 博士及现任物理系，研究强关联、非常规超导、ARPES 和太赫兹。",
    "url": "https://phys.ufl.edu/directory/sudi-chen/"
  },
  {
    "id": "74d54058",
    "label": "本人 UF 课题组",
    "raw": "Kavli Postdoc Fellow at Cornell, 2017-2019",
    "detail": "本人组页分列 Columbia 2016 博士、Stanford 2016–2017 博后、Cornell 2017–2019 博后。",
    "url": "https://sites.google.com/view/xxzhanglab/people"
  },
  {
    "id": "2625e7a6",
    "label": "本人 UF CV",
    "raw": "Advisor: Prof. W.P. Halperin",
    "detail": "本人 CV 明确 Northwestern 博士 Advisor；同页分列 1997-09–1999-02 Northwestern 和 1999-03–2001-07 Stanford 博后。",
    "url": "https://people.clas.ufl.edu/ysl/curriculum-vitae/"
  },
  {
    "id": "27e81c60",
    "label": "UF 物理系",
    "raw": "PhD University of Wisconsin-Madison (2015)",
    "detail": "UF 原档确认物理系副教授、2015 Wisconsin 博士及强关联、非常规超导、拓扑物态研究。",
    "url": "https://phys.ufl.edu/directory/yuxuan-wang/"
  }
];
const ext=["https://phys.ufl.edu/people/faculty/chunjing-jia/","https://web.stanford.edu/~chunjing/","https://devereauxgroup.stanford.edu/personnel/former","https://physics.washu.edu/alumni","https://www.linkedin.com/in/james-hamlin-3413a9286","https://kavli.berkeley.edu/sudi-chen","https://heinz.stanford.edu/people/former-members-stanford","https://phys.ufl.edu/directory/peter-hirschfeld/"], extra=["https://www.physastro.iastate.edu/event/2024/cmt-search-jiabin-yuprinceton-university","https://sites.google.com/site/makshangroup/people","https://www.kicnano.cornell.edu/people","https://www.nature.com/articles/s41563-020-0713-9","https://doczz.net/doc/8038894/curriculum-vitae-of-daniel-l.-stein"], hamGroup="https://web.physics.wustl.edu/jss/where.html";
const jia='43e55cbe',lar='e800f362',kim='92418648',ham='d2af2825',yu='cb776233',ing='7e112b30',hir='a346e262',su='95701d41',zh='74d54058',lee='2625e7a6',wang='27e81c60';
const court='Cornell Kavli 官方名录列 Xiao-Xiao Zhang 为 2017–2019 年博士后 fellow；Mak–Shan 本人联合组名单列 Zhang 为前成员，并在同页分别列 Kin Fai Mak 与 Jie Shan 为 PI。可核实 Cornell 博后组属，个人正式导师与两位分工待查。';
const cp=web('Cornell Kavli 博后名录',extra[2])+' · '+web('Mak–Shan 联合组人员页',extra[1])+'。'+court;
const zhs=[['95d0012e','Jie Shan'],['57193bbb','Kin Fai Mak']];
const zinc=path.join(root,'师承关系索引.md');
const zhNotes=zhs.map(([id,name])=>'- 博士后课题组负责人：[['+local(id)+'|'+name+']]。'+cp);
const zhIndex=zhNotes.map(l=>'- [['+local(zh)+'|Xiao-Xiao Zhang]] → '+l.slice(2));
editLine(fn(local(zh)),l=>l.startsWith('- 核查边界：'),l=>zhNotes.join('\n')+'\n'+l);
editLine(zinc,l=>l.startsWith('- [['+local(zh)+'|')&&l.includes(' → 博士后课题组负责人：')&&l.includes('Tony F. Heinz'),l=>l+'\n'+zhIndex.join('\n'));
for(const [id] of zhs)inverse(zh,local(id),'博士后课题组成员',cp);
const stein='Hirschfeld 本人 CV 明列博士论文 advisor D. L. Stein。NYU 物理与数学学者 Daniel L. Stein 的旧履历可读镜像分列 Princeton 教职并多次列与 P. Hirschfeld 的同期超流体合作；与论文方向、姓名缩写相合，增强身份对应，学位档全名仍待核。';
const hmt='WashU 校友档给出 2007 博士论文题名 Superconductivity Studies at Extreme Pressure 及 Schilling 博士组属；Schilling 本人校友页给出 2008-01 入 UCSD Brian Maple 组、2012-08 入 UF。两位继续按组负责人记录，已知博士 CV 和论文原网址此前 404，本轮未重复打开。';
const stages={
 [jia]:['Stanford 博后与 Thomas Devereaux 工作；正式导师称谓待核','Stanford 时期本人主页分列 2008-09–2014-10 研究助理及 2015-02 起博士后，两阶段均具名 Devereaux。组属和阶段师长保留。',[ext[1],ext[2]],'group_or_candidate'],
 [ham]:['2008-01 起 UCSD M. Brian Maple 博士后课题组；2012-08 转 UF 教职，正式指导称谓待核',hmt,[ext[3],hamGroup],'group_or_candidate'],
 [yu]:[null,'Iowa State 讲座原档写 Maryland 博后主要与 Das Sarma 工作，Princeton 2022-09 起与 Bernevig 密切合作。按原文区分阶段师长和合作候选。',[extra[0]],'group_or_candidate'],
 [ing]:[null,'本人 CV 将 Wilkins 明列 Postdoctoral Mentor，Ohio State 1990–1992 研究员。人物页保留阶段研究师长，台账角色与人物页对齐。',[],'group_or_candidate'],
 [su]:['Berkeley 2021–2023 博士后 fellowship Faculty Advisor Feng Wang；正式岗位导师待核','Berkeley Kavli 原档同时列 Faculty Advisor Feng Wang 和 Postdoctoral Fellow, UCB, Wang Group。指导确认在 fellowship 项目层级。',[ext[5]],'group_or_candidate'],
 [zh]:['Stanford 2016–2017 Heinz 组；Cornell 2017–2019 Mak–Shan 联合组（两位 PI，正式导师待核）',court,[ext[6],extra[1],extra[2]],'group_or_candidate'],
 [lee]:['Northwestern 1997-09–1999-02 with W. P. Halperin；Stanford 1999-03–2001-07 with D. D. Osheroff（研究关联／候选）','本人 CV 同页分列两段博后，使用 with，保留研究关联及候选标签。',[],'group_or_candidate']
};
for(const {id,url,label,detail} of data){
 const old=JSON.parse(latest.get(id).details_json);
 const stage=stages[id];
 const refs=[url,...(stage?.[2]??[]),...(id===hir?[extra[4],ext[7]]:[])];
 const proof=refs.map((source,i)=>web(i?'补充原档':label,source)).join(' · ')+'。';
 if(id===hir)note(id,'- 博士核查边界：',proof+stein);
 else if(id===lar)note(id,'- 博士后课题组负责人：',proof+detail);
 else note(id,'- 核查边界：',proof+detail+(stage?' '+stage[1]:''));
 const phd=id===ham?'WashU 2007 博士；James S. Schilling（课题组负责人）；论文题名已定位':null;
 changeRow(id,phd,stage?.[0]??null,proof+detail);
 const changes={affiliation:[old.aspects.affiliation.status,old.aspects.affiliation.note+' '+detail,[url]]};
 if([jia,lar,kim,ham,yu,hir,su,wang].includes(id))changes.research=[old.aspects.research.status,old.aspects.research.note+' '+detail,[url]];
 if(stage)changes.postdoc=[stage[3],stage[1],refs];
 if(id===ing)changes.phd=['group_or_candidate','本人 CV 明列 Paul J. Steinhardt 为 Doctoral Mentor，既有阶段研究师长和来源均保留，论文正式角色待原档。',[url]];
 if(id===ham)changes.phd=['group_or_candidate',hmt,[ext[3],hamGroup]];
 if(id===hir)changes.phd=['confirmed_advisor',stein,[extra[4],ext[7]]];
 if(id===kim){
  changes.phd=['confirmed_advisor','本人组页博士栏明列 Advisor Jian-Min Zuo。',[url]];
  changes.postdoc=['confirmed_advisor','本人组页 UCSB 博后栏明列 Advisor Susanne Stemmer，任期未列。',[url]];
 }
 if(id===lee)changes.phd=['confirmed_advisor','本人 UF CV 的 1997 Northwestern 物理博士论文明确列 Advisor W. P. Halperin。',[url]];
 const next=id===zh?'查 Stanford 与 Cornell 两段个人正式 advisor 职衔；Cornell 联合组归属及 2017–2019 fellowship 已证。'
 :id===ham?'沿明确题名寻找可访问的学位论文与本人 CV，核 Schilling 和 Maple 的正式导师措辞。'
 :old.next_step;
 const aid=audit(id,changes,next);
 audits.at(-1).followup_required=old.followup_required===true||Boolean(stage)||id===kim;
 if(id===zh)for(const [mid] of zhs)relation(id,'postdoc',local(mid),'group_leader',court,[url,extra[1],extra[2]],aid);
}


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Florida阶段原档';
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
