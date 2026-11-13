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
 a.audit_id='20261110_'+id+'_chicago_original_1116';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_chicago_original_1116_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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
    "id": "f98016cc",
    "label": "UChicago PME",
    "raw": "holds a joint appointment at Argonne National Laboratory",
    "detail": "PME 原档核分子工程与 Argonne 双任、MIT 化工博士、Stanford TomKat Center 博后及电解质和电化学。",
    "url": "https://pme.uchicago.edu/directory/chibueze-amanchukwu"
  },
  {
    "id": "fc4b8bd4",
    "label": "UChicago PME",
    "raw": "University Professor of Physics",
    "detail": "PME 原档列物理系 University Professor。",
    "url": "https://pme.uchicago.edu/directory/dam-thanh-son"
  },
  {
    "id": "f9610fd7",
    "label": "UChicago 化学系",
    "raw": "Duke University / Postdoctoral Fellow / Princeton University / NSF Postdoctoral Fellow",
    "detail": "化学系原档分别列 1999 Harvard 博士、1999 Duke 博后、2001 Princeton NSF 博后。本人组档确认 Harvard 化学博士。",
    "url": "https://chemistry.uchicago.edu/faculty/david-mazziotti"
  },
  {
    "id": "e08df3fa",
    "label": "UChicago 化学系",
    "raw": "University of California, Berkeley / Ph.D - Chemistry / Columbia University / Postdoctoral Researcher",
    "detail": "化学系原档列 Berkeley 2022 化学博士、Columbia 博后及理论／物理／材料化学方向。",
    "url": "https://chemistry.uchicago.edu/faculty/dipti-jasrasaria"
  },
  {
    "id": "e23901a7",
    "label": "UChicago 化学系",
    "raw": "IBM T. J. Watson Research Center / Postdoctoral Fellow",
    "detail": "化学系原档分列 2002 Hamburg 博士、IBM Watson 博后和 Molecular Foundry 后续岗位，研究纳米晶自组装与电子、光学性质。",
    "url": "https://chemistry.uchicago.edu/faculty/dmitri-talapin"
  },
  {
    "id": "f9678cee",
    "label": "James Franck Institute",
    "raw": "Departments of Physics and Molecular Genetics & Cell Biology",
    "detail": "JFI 原档核物理、分子遗传与细胞生物学、分子工程任职及 JFI 主任。",
    "url": "https://jamesfranckinstitute.uchicago.edu/people/profile/margaret-gardel/"
  },
  {
    "id": "ef22ed60",
    "label": "UChicago PME",
    "raw": "Tirrell began his academic career at the University of Minnesota as an assistant professor",
    "detail": "PME 原档列 UMass 高分子博士及 Minnesota 早期助理教授，未分列独立博士后。",
    "url": "https://pme.uchicago.edu/directory/matthew-tirrell"
  },
  {
    "id": "fab3a8d7",
    "label": "UChicago 化学系",
    "raw": "Director's Postdoctoral Fellow",
    "detail": "化学系原档列 Los Alamos 博后、Caltech 博士及无机材料和光化学研究。",
    "url": "https://chemistry.uchicago.edu/faculty/michael-hopkins"
  },
  {
    "id": "f01c840b",
    "label": "UChicago PME",
    "raw": "joint postdoctoral appointment at the Massachusetts Institute of Technology",
    "detail": "PME 原档列 2019 年 Dresden／MPI 博士、2019–2024 Harvard 博后及最后一年 MIT 联合博后。",
    "url": "https://pme.uchicago.edu/directory/ruben-verresen"
  },
  {
    "id": "dffc5fb8",
    "label": "UChicago 化学系",
    "raw": "University of California, Berkeley / Postdoctoral Fellow",
    "detail": "化学系原档列 Maryland 2011 化学物理博士、Berkeley 博后，研究非平衡统计力学及自组装。",
    "url": "https://chemistry.uchicago.edu/faculty/suri-vaikuntanathan"
  },
  {
    "id": "e6275c0b",
    "label": "UChicago 物理系",
    "raw": "Dicke Postdoctoral Fellow at Princeton University",
    "detail": "物理系原档核物理系和 JFI 任职、MIT 博士及 Princeton Dicke 博后，研究超冷原子和分子多体实验。",
    "url": "https://physics.uchicago.edu/people/profile/zoe-yan/"
  }
];
const sol="https://solvayinstitutes.be/wp-content/uploads/2025/08/Annual_report-2016.pdf", viet="https://hsgs.edu.vn/en/thong-tin-chung/tin-tuc-tong-hop/385-dam-thanh-son-cong-trinh-xuat-sac-dang-o-phia-truoc", hops="https://chronicle.uchicago.edu/990923/new.shtml", dre="https://tu-dresden.de/mn/physik/die-fakultaet/aktuell/dresdner-promotionspreis-physik-zum-zweiten-mal-verliehen?set_language=en", ma="https://mazziotti.uchicago.edu/members/", bao="https://baogroup.stanford.edu/people/chibueze-amanchukwu";
const son='fc4b8bd4', maz='f9610fd7', hop='fab3a8d7', tir='ef22ed60', ver='f01c840b', am='f98016cc';
const sonPh='河内自然科学大学附属高中刊载的人物报道在莫斯科博士答辩段明确点名 Valery Rubakov 为指导者，并列 1995 年 INR 博士。与原 ICTP 博士导师记录一致。';
const sonPost='Solvay Institutes 2016 年报第 50 页明确华盛顿大学与 MIT 两段博后，之后任 Columbia 教职并同期在 Brookhaven 为 Fellow。两段个人指导、任期分界未列。';
const verPh='TU Dresden 博士奖原文引 Verresen 本人称 Roderich Moessner 与 Frank Pollmann 为其 advisors，并列 MPI-PKS 完成的博士论文 Topology and Excitations in Low-Dimensional Quantum Matter。';
const hopPost='Chicago Chronicle 1999 原文明确 Caltech 1986 博士、1986–1987 Los Alamos Director’s Postdoctoral Fellow、1987 起 Pittsburgh 教职；1998 年 Los Alamos 访问职位另列。个人博士后导师待查。';
const tirPost='PME 原档列 UMass 高分子博士后在 Minnesota 从助理教授开始学术任职，结合已有口述史，所阅履历未分列独立博士后。';
const stages={
 [son]:['University of Washington 与 MIT 博后；各阶段个人指导待核',sonPost,[sol,viet],'unresolved'],
 [maz]:['Duke 博后（院档列 1999）；Princeton NSF 博后（院档列 2001），Herschel Rabitz 保持低可信候选','院系训练栏列 1999 Harvard 博士、1999 Duke 博后及 2001 Princeton NSF 博后，未列两阶段个人导师。',[ma],'group_or_candidate'],
 [hop]:['Los Alamos Director’s Postdoctoral Fellow 1986–1987；个人导师待核',hopPost,[hops],'unresolved'],
 [tir]:['博士毕业后任 Minnesota 助理教授；所阅履历未分列独立博士后',tirPost,[],'no_postdoc_documented'],
 [ver]:['Harvard 2019–2024，最后一年 MIT 联合任职；Ashvin Vishwanath（Harvard 博后课题组负责人）','UChicago PME 明列 2019–2024 Harvard 博后，前四年 Harvard Quantum Initiative Fellowship，最后一年 MIT 联合博后；两校分工与正式个人指导待核。',[dre],'group_or_candidate'],
 [am]:['Stanford TomKat Center 博后；Zhenan Bao（课题组负责人，2017–2019）','PME 原档明列 Stanford TomKat Center 博士后，Bao 组页面确认为组成员。正式个人 advisor 职衔待查。',[bao],'group_or_candidate'],
 'e23901a7':['IBM Watson 博后，Christopher B. Murray（阶段研究师长）；后续 Molecular Foundry 岗位另列','院档和既有 CV 分列 IBM Watson 博后和后续 Molecular Foundry 岗位；本人 CV 用 with Murray。',[],'group_or_candidate']
};
for(const row of data){
 const {id,url,detail,label}=row;
 const old=JSON.parse(latest.get(id).details_json);
 const stage=stages[id];
 const refs=[url,...(stage?.[2]??[])];
 const proof=refs.map((source,i)=>web(i?'补充原档':label,source)).join(' · ')+'。';
 const combined=detail+(stage?' '+stage[1]:'');
 note(id,'- 核查边界：',proof+combined);
 changeRow(id,null,stage?.[0]??null,proof+combined);
 const changes={affiliation:[old.aspects.affiliation.status,old.aspects.affiliation.note+' '+detail,[url]]};
 if(stage)changes.postdoc=[stage[3],stage[1],refs];
 if(id===son){
  changes.phd=['confirmed_advisor',sonPh,[viet,sol]];
  enrich(id,'phd','师承人物 - Valery Rubakov','博士生',web('河内校方人物报道',viet)+'。'+sonPh);
 }
 if(id===ver){
  changes.phd=['confirmed_advisor',verPh,[dre,url]];
  for(const t of ['师承人物 - Frank Pollmann','师承人物 - Roderich Moessner'])enrich(id,'phd',t,'博士生',web('TU Dresden 本人获奖发言',dre)+'。'+verPh);
 }
 if(id===am)changes.phd=['confirmed_advisor','Stanford Bao 组履历在 MIT 化工博士条目明确列 Advisor Paula T. Hammond。',[bao]];
 if([am,maz,hop,'e08df3fa','e23901a7','dffc5fb8','e6275c0b'].includes(id)){
  changes.research=[old.aspects.research.status,old.aspects.research.note+' '+detail,[url]];
 }
 const next=id===son?'核华盛顿大学与 MIT 两段博后个人指导和起止，按原记录分列 Columbia 与 Brookhaven。'
 :id===hop?'查 Los Alamos 1986–1987 研究组任命和个人指导，1998 年访问另列。':old.next_step;
 const aid=audit(id,changes,next);
 audits.at(-1).followup_required=old.followup_required===true||Boolean(stage);
 if(id===son)relation(id,'phd','师承人物 - Valery Rubakov','advisor',sonPh,[viet,sol],aid,false);
 if(id===ver)for(const t of ['师承人物 - Frank Pollmann','师承人物 - Roderich Moessner'])relation(id,'phd',t,'advisor',verPh,[dre,url],aid,false);
}


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Chicago阶段原档';
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
