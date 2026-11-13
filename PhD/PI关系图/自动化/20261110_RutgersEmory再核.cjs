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
 a.audit_id='20261110_'+id+'_original_1342';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_original_1342_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const co='053b0c4a', hy='eb228b25', k='04f6da22';
const u={coCV:'https://www.physics.rutgers.edu/~coleman/mycv24.pdf',coHistory:'https://www.physics.rutgers.edu/dept/history/robbins/chapt13.pdf',hySchool:'https://physics.emory.edu/people/bios/harutyunyan-hayk.html',hyLab:'https://sites.google.com/site/haykharutyunyan/people',hyPub:'https://pubmed.ncbi.nlm.nih.gov/23003302/',min:'https://cse.umn.edu/cems/satish-kumar',other:'https://www.iul.ac.in/DWC/Faculty/fileupload/Computer%20Application/_Computer%20Application-Dr%20Satish%20CV%20for%20Assistant%20Professor%20_CSE_IT_CA.pdf'};
const coP='本人 Rutgers CV 首页在 Princeton 1984 博士项目明确写 P. W. Anderson 为 Advisor。';
const coQ='本人 Rutgers CV 将 1984–1986 UCSB ITP Postdoctoral Fellow 与 1984–1989 Trinity College Cambridge Junior Research Fellow 分列；Rutgers 物理系史另核 Santa Barbara 两年和 1987 入职，个人博后指导者未列。';
const coA=audit(co,{
 affiliation:['confirmed','Rutgers 物理与天文学 Distinguished Professor。',[u.coCV]],
 research:['confirmed','凝聚态理论及强关联电子、重费米子。',[u.coCV,u.coHistory]],
 phd:['confirmed_advisor',coP,[u.coCV]],
 postdoc:['unresolved',coQ,[u.coCV,u.coHistory]]
},'追查 UCSB ITP 同期任用和项目导师资料；Trinity JRF 单列。');
enrich(co,'phd','师承人物 - Philip W. Anderson','博士生',web('本人 Rutgers CV',u.coCV)+' '+coP);
note(co,'- 核查边界：',coQ+' '+web('本人 Rutgers CV',u.coCV)+' '+web('Rutgers 院系史',u.coHistory));
changeRow(co,null,'1984–1986 UCSB ITP 博后；个人导师待核；Trinity JRF 分列',web('本人 Rutgers CV',u.coCV));
relation(co,'phd','师承人物 - Philip W. Anderson','advisor',coP,[u.coCV],coA,false);

const hyEv='Emory 物理系原档列 Pisa 2009 物理博士和 2012 Argonne CNM Distinguished Postdoctoral Fellow。2012 原论文标其 Rochester Institute of Optics 与 Lukas Novotny 同期署名，仅补 Rochester 候选证据；Argonne 的 Wiederrecht 仍为独立候选。';
audit(hy,{
 affiliation:['confirmed','Emory 物理系。本人课题组页与院系一致。',[u.hySchool,u.hyLab]],
 research:['confirmed','纳米光子学、等离激元与非线性光学。',[u.hySchool,u.hyLab]],
 postdoc:['group_or_candidate',hyEv,[u.hySchool,u.hyPub]]
},'继续查 Rochester 与 Argonne 的正式任用或个人指导，保留两段候选与已核博士导师。');
note(hy,'- 核查边界：',hyEv+' '+web('Emory 物理系原档',u.hySchool)+' '+web('2012 论文出版记录',u.hyPub));
changeRow(hy,null,null,web('Emory 物理系原档',u.hySchool));

const kEv='Minnesota 原档列本人为 1998 Stanford 化工博士，Massey 2001 林木遗传同名者已排除。另读到 Integral University 计算机应用系同名者的可读 CV；桥接中的另一同校 PDF 未返回正文。Integral 两条网页不用于 Minnesota 的师承证据。';
audit(k,{identity:['confirmed',kEv,[u.min,u.other]]},'继续定位 Stanford 论文及 Minnesota 本人早期履历；仅保留 George M. Homsy 为低可信博士导师候选。');
note(k,'- 核查边界：',kEv+' '+web('Integral 同名者 CV',u.other));

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_RutgersEmory再核';
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
