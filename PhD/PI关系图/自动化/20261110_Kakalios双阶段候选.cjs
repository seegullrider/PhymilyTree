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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0824';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0824_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const id='d7622f03', fr='师承人物 - Hellmut Fritzsche', st='师承人物 - Robert A. Street';
const self='https://cse.umn.edu/physics/james-kakalios', book='https://fliphtml5.com/dazyq/icfb/The_Physics_of_Superheroes_by_James_Kakalios_251204_135016/', pp='https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.53.1602', post='https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.59.1037', u='https://news.uchicago.edu/story/hellmut-fritzsche-experimental-physicist-who-explored-materials-led-flat-screen-displays-1927';
const phdEvidence='本人著作后记将 Fritzsche 和 Street 列入跨教育阶段的物理老师及师长，未分配称谓。1984 年 APS 论文将 Kakalios 与 Fritzsche 同列 Chicago 物理系和 James Franck Institute，题材吻合；本人校档列 1985 Chicago 博士。仅列博士阶段低可信候选。';
const postEvidence='本人著作后记将 Street 列为跨阶段老师及师长之一。学校履历确认 1985–1988 Xerox PARC 博后，APS 1987 年原档把 Street 与 Kakalios 同列 Xerox PARC 合作研究非晶硅。仅列博士后阶段低可信候选。';
const ppText=web('本人著作后记，第 360 页（翻页副本）',book)+' · '+web('APS 1984 原论文',pp)+' · '+web('Minnesota 本人履历',self)+'。'+phdEvidence;
const poText=web('本人著作后记，第 360 页（翻页副本）',book)+' · '+web('APS 1987 原论文',post)+' · '+web('Minnesota 本人履历',self)+'。'+postEvidence;
addEdge(id,'博士导师候选',fr,'Hellmut Fritzsche',ppText,null,true);
addEdge(id,'博士后导师候选',st,'Robert A. Street',poText,null,true);
editLine(fn(fr),s=>s==='## 师承',s=>s+'\n\n- 博士候选研究者：[['+local(id)+'|James Kakalios]]。'+ppText);
newMentor(st,'Robert A. Street',web('APS 1987 原文',post)+'确认 Xerox Palo Alto Research Center 和无序半导体研究。',id,'博士后候选研究者',poText);
note(id,'- 核查边界：','导师候选按机构和阶段拆开，待论文及 Xerox 人事档明确指导称谓。');
changeRow(id,'Hellmut Fritzsche（Chicago 博士阶段候选）','Robert A. Street（Xerox PARC 博士后阶段候选）',web('APS 1984 原档',pp)+' · '+web('APS 1987 原档',post));
const a=audit(id,{phd:['group_or_candidate',phdEvidence,[pp,self,book,u]],postdoc:['group_or_candidate',postEvidence,[post,self,book]],affiliation:['confirmed','Minnesota 校方资料列 School of Physics and Astronomy 教授兼院系负责人。',[self]],research:['confirmed','Minnesota 校方资料列无序凝聚态、非晶半导体的电子与光学性质。',[self,pp,post]]},'查 Chicago 博士论文签署和 Xerox PARC 1985–1988 聘任档，核两位的正式导师角色。');
relation(id,'phd',fr,'candidate',phdEvidence,[pp,self,book,u],a);
relation(id,'postdoc',st,'candidate',postEvidence,[post,self,book],a);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Kakalios双阶段候选';
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
