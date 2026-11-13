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
 a.audit_id='20261110_'+id+'_brown_princeton_duke_1246';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_brown_princeton_duke_1246_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const items=[["ece93d69","https://www.pheliqs.fr/Pages/Imapec/Theses/Adrien-Rosuel.aspx","Directeur de thèse : Jean-Pascal Brison","Brown 物理人员名录核任职，CEA 原始答辩档核非常规超导研究与博士指导。","非常规超导与关联量子材料。","保留 Mitrović 的博士后阶段研究指导，查正式职衔。",["https://vivo.brown.edu/display/arosuel","Rosuel, Adrien"]],["fb76fde7","https://axelvandewalle.github.io/www-avdw/cv.pdf","Advisor: Prof. Gerbrand Ceder / Post-doctoral Fellow (Sep 2000–Aug 2002) (under the supervision of Mark Asta)","本人履历核 Brown 工程教授。","计算材料、固体热力学及合金设计。","履历第 1 页单列 2000–2002 博后 Mark Asta。2004–2006 Senior Research Associate 下的 Mark Asta 与 Don Ellis 属随后岗位。"],["8e89d79f","https://vivo.brown.edu/docs/c/crosepet_cv.pdf?dt=070815214","Thesis advisor: Professor Karl L. Kompa","Brown 化学系原档核任职；本人 CV 确认 Karl L. Kompa 指导 LMU 博士论文。","超快 X 射线光谱和纳米材料成像。","UCSD 博后期 Kent R. Wilson 仍列候选，继续追原任用。",["https://chemistry.brown.edu/people/christoph-g-rose-petruck","Professor of Chemistry"]],["f5b4003d","https://atwater.caltech.edu/team-member/domenico-pacifici","Dr. Pacifici was a senior postdoctoral scholar at Caltech from 2005-2009.","Caltech Atwater 组校友档核 2005–2009 博后，本人 CV 列 Brown 工程与物理。","纳米光子、等离激元与光学材料。","保留 Catania F. Priolo 博士导师和 Caltech Atwater 博后课题组，核正式博后指导。",["https://vivo.brown.edu/docs/d/dpacific_cv.pdf?dt=580215214","Associate Professor, School of Engineering & Department of Physics"]],["f8ac889b","https://vivo.brown.edu/docs/j/jmarston_cv.pdf?dt=355208131","Advisors: Barbara Cooper and Chris Henley. / Ph.D. Thesis Advisor: Ian Affleck.","Brown 托管本人 CV 核现任物理教授。","多体、统计物理与地球流体。","本人 CV 再次确认 Princeton 1989 博士及 Cornell 1989–1991 IBM 博后与对应指导。"],["feb90390","https://chemistry.brown.edu/people/matthew-coley-orourke","Assistant Professor of Chemistry","Brown 化学系原档核现名、Caltech 博士以及 Brown 助理教授。","量子材料、电子结构与多体动力学。","Caltech 原论文重读超时，沿用已核 Garnet Chan；Rabani 博后课题组保留。"],["efb8b1e5","https://ece.princeton.edu/people/barry-p-rand","Professor of Electrical and Computer Engineering and Andlinger Center for Energy and the Environment","Princeton ECE 原档核 ECE 与 Andlinger 任职。","有机光电子、半导体器件与薄膜。","复核 Forrest 组毕业年份 2006 与学位 2007 的差别，并追 IMEC 任用性质。"],["f9febc7d","https://turecigroup.princeton.edu/people/hakan-e-t%C3%BCreci","After postdoctoral work at Yale and ETH Zurich, he joined ETH Zurich as an Assistant Professor","本人实验室分列 Yale 2003 博士、Yale 及 ETH 博后和后来 ETH 教职。","量子工程、介观量子光学及多体光子。","追 Yale、ETH 两段博士后正式指导。"],["a68c6e2b","https://dof.princeton.edu/people/jeffrey-schwartz-0","effectively ended his postdoctoral plans","Princeton 教务长办公室核化学系，2022 年 7 月 1 日荣休。","表面及界面化学、有机金属化学和自组装单层。","教务档核 1970 年 Columbia 博后计划中止，5 月提前加入 Princeton；追 Stanford 论文正式导师。"],["d2180a91","https://jyotirmoymandal.com/team/","Prof Aaswath Raman (postdoctoral advisor)","Princeton 土木与环境工程院档和本人团队页核现任。","热光子学、辐射热流和超材料。","本人团队页明确博士导师 Yuan Yang 与博后导师 Aaswath Raman。保留 Nanfang Yu 的阶段指导，续查论文正式角色。",["https://cee.princeton.edu/people/jyotirmoy-mandal","Jyotirmoy Mandal"]],["fe39bc00","https://cpb-us-w2.wpmucdn.com/voices.uchicago.edu/dist/8/2031/files/2019/10/Saien-Xie-Thesis_for-committee-approval.pdf","my advisor Jiwoong Park, for his constant support and guidance","Princeton ECE 原档核现任，Cornell 论文原文核姓名及博士学位。","二维范德瓦耳斯薄膜、异质结构和量子器件。","Cornell 学位论文致谢明确 Jiwoong Park 为 advisor；Schlom、Shen 博后仍列课题组。",["https://ece.princeton.edu/people/saien-xie","Saien Xie"],["https://ece.princeton.edu/events/atomically-thin-films-and-superlattices","Atomically Thin Films and Superlattices"]],["fa1e3f70","https://dof.princeton.edu/people/shivaji-lal-sondhi-0","He then moved with his advisor to the University of California-Los Angeles, where he received his Ph.D. in 1992.","Princeton 教务长办公室核 2021 年 Princeton 荣休、转 Oxford。","凝聚态多体和拓扑量子物态。","院档明确 Kivelson 博士导师及 Illinois ICMT 三年博后。Fradkin 现有博后课题组待核正式个人指导。"],["b3393546","https://escholarship.org/content/qt7xs8f92s/qt7xs8f92s.pdf","Professor Gareth … Thomas for his guidance and encouragement","沿用 Duke 原档核机械工程与材料科学系荣休；Berkeley 原论文核材料科学与工程博士研究。","电子显微、半导体缺陷及材料扩散。","论文致谢确认 Gareth Thomas 博士研究指导。本人 CV 记 1971 学位，LBL 报告封面为 1972 年 1 月。续查正式博士导师栏、Cornell Research Associate 是否为博后。",["https://mse.berkeley.edu/2014/02/in-memoriam-professor-emeritus-gareth-thomas/","Professor Emeritus of the Department of Materials Science and Engineering Gareth Thomas"]]];
const stampId='20261110_BrownPrinceton与Duke原档';
const aidById=new Map(), proofById=new Map();
const done=new Set(['fb76fde7','f8ac889b']);
const srcTan=items.find(x=>x[0]==='b3393546')[1];
const srcXie=items.find(x=>x[0]==='fe39bc00')[1];
const tanEv='Berkeley 论文第 151 页致谢明确感谢 Gareth Thomas 的指导与鼓励；对 Walter L. Bell 的叙述为讨论和建议。保留博士阶段研究师长，正式 advisor 待核。';
const xieEv='Cornell 博士论文致谢第 vii 页明确称 Jiwoong Park 为 advisor。';
for(const [id,src,raw,aff,topic,next,...more] of items){
 const a=JSON.parse(latest.get(id).details_json);
 const sources=[src,...more.map(([url])=>url)];
 const proof=sources.map((u,i)=>web(i?'相关原证':'原始资料',u)).join(' · ')+'。';
 const msg=proof+aff+' '+next;
 const c={affiliation:[a.aspects.affiliation.status,aff,[...sources,...a.aspects.affiliation.sources]],research:['confirmed',topic,sources]};
 if(id==='fe39bc00')c.phd=['confirmed_advisor',xieEv,[srcXie]];
 if(id==='b3393546')c.phd=['group_or_candidate',tanEv,[srcTan,...more.map(([url])=>url)]];
 const aid=audit(id,c,next);
 aidById.set(id,aid);
 proofById.set(id,proof);
 if(done.has(id))audits.at(-1).followup_required=false;
 const f=fn(local(id));
 if(id==='d2180a91')editLine(f,l=>l.startsWith('- 博士论文原始证据：'),l=>l+' '+msg);
 else if(id==='fe39bc00')editLine(f,l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+msg);
 else note(id,'- 核查边界：',msg);
 const ph=id==='fe39bc00'?'Jiwoong Park（明确博士导师）':
  id==='b3393546'?'Gareth Thomas（博士阶段研究师长，正式 advisor 待核）':null;
 changeRow(id,ph,null,msg);
}
const xie='fe39bc00', jp=local('034bd7b0');
const xp=' '+web('Cornell 博士论文原文',srcXie+'#page=7')+'。'+xieEv;
replaceNoteLabel(xie,'博士阶段研究师长','博士导师',jp,xp);
replaceInverseLabel(jp,xie,'博士阶段研究者','博士生',xp);
replaceIndexLabel(xie,jp,'博士阶段研究师长','博士导师',xp);
relation(xie,'phd',jp,'advisor',xieEv,[srcXie],aidById.get(xie),false);
const tan='b3393546', th='师承人物 - Gareth Thomas', tp=web('Berkeley 论文致谢',srcTan+'#page=158')+'。'+tanEv;
const tanLine='- 博士阶段研究师长：[['+th+'|Gareth Thomas]]。'+tp;
editLine(fn(local(tan)),l=>l.startsWith('- 核查边界：'),l=>tanLine+'\n'+l);
editLine(idx,l=>l==='# 师承关系与候选线索索引',l=>l+'\n\n- [['+local(tan)+'|Teh Yu Tan]] → '+tanLine.slice(2));
inverse(tan,th,'博士阶段研究者',tp);
relation(tan,'phd',th,'stage_mentor',tanEv,[srcTan],aidById.get(tan),false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_BrownPrinceton与Duke原档';
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
