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
 a.audit_id='20261110_'+id+'_columbia_original_1229';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_columbia_original_1229_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const data=[["e3e4eb4e","https://www.columbia.edu/cu/chemistry/groups/cacciuto/angelo.html","2005-2007 postdoc - University of Illinois at Urbana Champaign; 2002-2005 postdoc - FOM Institute for Atomic and Molecular Physics","Columbia 化学系，软凝聚态物理、胶体和聚合物统计力学。","本人组档分列 2002–2005 AMOLF 与 2005–2007 Illinois 材料博后。Syracuse 2002 论文原档确认 Mark Bowick；Luijten 组关系和 Frenkel 低可信合作候选各自保留。","追 AMOLF 正式聘任与个人指导，核 Illinois 博后 advisor 称谓。"],["f57fca20","https://www.cheme.columbia.edu/faculty-staff/directory/christopher-james-durning","earned his PhD in Chemical Engineering from Princeton University in 1983","Columbia 化学工程，软物质、聚合物、胶体与玻璃态。","Princeton Russel 组博士生原页列 December 1982，并注与 L.R. Rebenfeld；Columbia 列 1983 学位与同年入职。两种时间记录并记，维持两位博士阶段研究师长。","查 Princeton 学位签署与正式授位日期，核 1983 入职前岗位。"],["7f7df42b","https://deanlab.physics.columbia.edu/people/cory-raymond-dean","Professor of Physics, Department of Physics","Columbia 物理系，范德华材料和量子输运。","本人 McGill 博士论文致谢明确 Guillaume Gervais 为 supervisor；James Hone 的本人履历明确将 Cory Dean 列为博士后 advisee。","两阶段已核，随任职和研究方向更新。"],["ff867a7c","https://back.skoltech.ru/storage/app/media/archive/2015/10/Basov_CV.pdf","Graduate advisor – V.S.Bagaev; Post-graduate Advisor – T.Timusk","Columbia 物理，实验凝聚态、光谱和量子材料。","本人 CV 分列 Lebedev 1991 博士 Graduate advisor V. S. Bagaev 与 McMaster 1992–1996 博后 Post-graduate Advisor T. Timusk；1996 Brookhaven 的 Assistant Physicist 另列。","已确认两阶段个人指导，随任职和研究方向更新。"],["efd8ab2e","https://www.apam.columbia.edu/faculty-staff/directory/james-s-im","a PhD in Electronic Materials from the Massachusetts Institute of Technology in 1989","Columbia 应用物理与应用数学系材料科学与工程。","院档核 1989 MIT 电子材料博士；既有 Caltech 阶段线索待任用档。博士阶段合作署名留作追查线索，两个阶段指导仍待查。","MIT 馆藏退避结束后追博士论文，另查 Caltech 访问和任命档。"],["f19cf751","https://www.engineering.columbia.edu/sites/default/files/2024-05/C.V._Schuck%203-2024.pdf","Thesis Advisor: Professor Robert Grober; Post-doctoral Advisor: Professor W. E. Moerner","Columbia 机械工程，纳米光学、光谱和材料探测。","本人 CV 明确 Yale 2003 博士 Robert Grober、Stanford 2003–2006 博后 W. E. Moerner。","已核两阶段，随任职和方向更新。"],["4d823e31","https://www.engineering.columbia.edu/faculty-staff/directory/yuan-yang","Associate Professor of Materials Science and Engineering in the Department of Applied Physics and Applied Mathematics","Columbia 应用物理与应用数学系材料科学与工程。","本人 Columbia CV 明确 Stanford 博士 Advisor Yi Cui，MIT 博后是 Gang Chen Group。工学院核 2012 Stanford 博士、MIT 三年后 2015 入职，组关系与个人正式指导分列。","查 MIT 博后任用原件和正式个人指导职衔。"]], extra={"e3e4eb4e":[["https://www.chem.columbia.edu/content/angelo-cacciuto","soft condensed matter physics","Columbia 化学系核任职与研究。"],["https://surface.syr.edu/phy_etd/50/","Advisor(s): Mark J. Bowick","Syracuse 博士学位馆藏导师字段。"]],"f57fca20":[["https://www.princeton.edu/~rrg/people.shtml","Christopher J. Durning (December 1982) [with L.R. Rebenfeld]","Princeton 组档核博士组与合作关系。"]],"7f7df42b":[["https://gervaislab.mcgill.ca/Dean_PhD_Thesis.pdf","I thank my supervisor, Dr. Guillaume Gervais","本人 McGill 学位论文原件致谢。"],["https://www.engineering.columbia.edu/sites/default/files/2024-04/James-Hone-CV.pdf","Former Postdoctoral advisees: Cory Dean (Columbia)","Hone 本人 Columbia CV 第 1 页明确博士后指导。"]],"ff867a7c":[["https://www.ae-info.org/ae/User/Basov_Dmitri/CV?skin=raw","1992-96 McMaster University, experimental condensed matter physics","Academia Europaea 发表的本人履历核博士、博后经历及 Columbia 任职。"]],"4d823e31":[["https://apam.columbia.edu/files/seasdepts/applied-physics-and-applied-math/cv-yangy.pdf","Advisor: Yi Cui; Postdoctoral Associate, Gang Chen Group","本人 Columbia CV 分列博士导师和博后组属。"]]};
const u=(label,url)=>web(label,url)+'。';
const aid=new Map();
for(const [id,src,raw,aff,ev,next] of data){
 const related=extra[id]??[], refs=[src,...related.map(x=>x[0])];
 const proof=u('原始机构档',src)+related.map(x=>u('相关原证',x[0])).join('')+ev;
 if(id==='4d823e31')editLine(fn(local(id)),l=>l==='## 师承',l=>l+'\n\n- 本轮核查原档：'+proof);
 else note(id,'- 核查边界：',proof);
 changeRow(id,null,null,proof);
 const a=JSON.parse(latest.get(id).details_json);
 const n=audit(id,{
  affiliation:['confirmed',aff,refs],research:['confirmed',a.aspects.research.note,refs],
  phd:[a.aspects.phd.status,a.aspects.phd.note,refs],postdoc:[a.aspects.postdoc.status,ev,refs]
 },next);
 if(['7f7df42b','ff867a7c','f19cf751'].includes(id))audits.at(-1).followup_required=false;
 aid.set(id,n);
}
const cv=data.find(x=>x[0]==='ff867a7c')[1];
for(const [s,t,rev,proof] of [
 ['phd','师承人物 - V. S. Bagaev','博士生','本人 CV 第 2 页列 Lebedev 博士 Graduate advisor V. S. Bagaev。'],
 ['postdoc','师承人物 - Thomas Timusk','博士后研究者','本人 CV 第 1 页列 1992–1996 McMaster 博后，第 2 页列 Post-graduate Advisor T. Timusk。']
]){
 enrich('ff867a7c',s,t,rev,u('Skoltech 托管本人 CV',cv)+proof);
 relation('ff867a7c',s,t,'advisor',proof,[cv],aid.get('ff867a7c'),false);
}

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Columbia院系与指导原档';
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
