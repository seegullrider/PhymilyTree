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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0734';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0734_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const az='9ea77333', sas='b08f8614', lia='师承人物 - Lia Addadi', ste='师承人物 - Steve Weiner', st='人员 - Princeton - Howard A. Stone - 419add8c';
const wei='https://wis-wander.weizmann.ac.il/content/learning-nature', har='https://aizenberglab.seas.harvard.edu/people/joanna-aizenberg';
const azProof='Weizmann 机构原档直接称 Aizenberg 是两位教授当时的研究生，描述三人具体晶体光学研究；本人组页确认 1996 年结构生物学博士。共同论文导师签署待核。';
const azId=audit(az,{phd:['group_or_candidate',azProof,[wei,har]],postdoc:['group_or_candidate','本人 Harvard 组履历列 1996–1998 Postdoctoral Associate with George M. Whitesides；按博士后阶段研究师长，正式导师职衔待核。',[har]],research:['confirmed','本人实验室原档列生物矿化、仿生材料、晶体工程、表面化学和生物光学。',[har]]},'查 1996 Weizmann 博士论文签署、Addadi／Weiner 两人角色及 Harvard 博后正式职衔。');
for(const [mentor,old] of [[lia,'https://www.weizmann.ac.il/csb/Addadi/group-members'],[ste,'https://www.weizmann.ac.il/csb/Weiner/biomineralization/Overview']]){
 replaceNoteLabel(az,'博士导师','博士阶段研究师长',mentor);
 replaceIndexLabel(az,mentor,'博士导师','博士阶段研究师长');
 replaceInverseLabel(mentor,az,'博士生','博士阶段研究者');
 relation(az,'phd',mentor,'stage_mentor',azProof,[wei,har,old],azId,false);
}
changeRow(az,'Lia Addadi、Steve Weiner（Weizmann 博士阶段研究师长，论文签署待核）',null,web('本人履历',har));
const h='https://mechse.illinois.edu/people/profile/sascha', hi='https://mechse.illinois.edu/news/53010', sl='https://stonelab.princeton.edu/index.php?id=people';
const s='https://collaborate.princeton.edu/en/publications/interfaces-in-fluid-mechanics-and-across-disciplines/';
const hProof='Illinois 教师档分列 Harvard 1998–2000 与 Marburg 1997–1998 博后。Stone 本人在回顾文章中把 Hilgenfeldt 列为自己的博士后，其实验室档也收录为前成员。Harvard 正式任命中的导师称谓与 Marburg 研究指导者待核。';
const extra=' '+web('Illinois 教师档',h)+' · '+web('Stone 组原名册',sl)+'。'+hProof;
replaceNoteLabel(sas,'博士后导师','博士后课题组负责人',st,extra);
replaceInverseLabel(st,sas,'博士后研究者','博士后课题组成员',extra);
replaceIndexLabel(sas,st,'博士后导师','博士后课题组负责人',extra);
note(sas,'- 院系／机构：',web('Illinois MechSE 本人教师档',h)+'核实本系教授。');
note(sas,'- 研究方向：',web('Illinois 原访谈',hi)+'核实泡沫、软材料、界面流体与微流控研究。');
changeRow(sas,null,'Howard A. Stone（Harvard 1998–2000 博后课题组负责人）；Marburg 1997–1998 指导者待核',web('Illinois 教师档',h)+' · '+web('Stone 组原名册',sl));
const hId=audit(sas,{postdoc:['group_or_candidate',hProof,[h,hi,sl,s]],affiliation:['confirmed','Illinois MechSE 本系教师档确认为教授，物理系目录另保留任职性质待查。',[h,hi]],research:['confirmed','本人 Illinois 访谈与官方教师档核泡沫、软凝聚态、微流控与界面动力学。',[h,hi]]},'查 1997 Marburg 学位签署及 Lohse 本人旧简历可读原件，区分 Marburg 和 Harvard 两段博后任命中的指导关系。');
relation(sas,'postdoc',st,'group_leader',hProof,[s,sl,h,hi],hId,false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_博士与博后角色补证';
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
