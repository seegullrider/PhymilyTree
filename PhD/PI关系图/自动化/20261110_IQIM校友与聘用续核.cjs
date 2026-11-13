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
 const i=matches[0];lines[i]=edit(lines[i]).replace(/\r?\n/g,end);
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
 a.audit_id='20261110_'+id+'_iqim_roster_followup_1822';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_iqim_roster_followup_1822_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.replace(/ \|\s*$/,'').split(' | ');if(cells.length<5)throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  const source=cells.splice(4).join('。 ');cells.push(source+' '+text+' |');
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



const hung='c7d88398', kimble='师承人物 - H. Jeff Kimble';
const hcv='https://ultracold.physics.purdue.edu/docs/cv_clhung.pdf';
const hreport='https://www.physics.purdue.edu/docs/interactions/PhysicsInteractions_2014.pdf';
const hgroup='https://www.its.caltech.edu/~qoptics/lab2/index.html';
const iqim='https://iqim.caltech.edu/people/alumni/';
const hstage='Purdue 物理系 2014 招聘原档明确记在 Caltech 与 Jeff Kimble 做博士后研究；Caltech 组页和 IQIM 校友原档核组属。本人 CV 列 Caltech 2011 年 12 月至 2014 年 12 月，另列 Chicago James Franck Institute 2011 年 9–10 月博士后，后者具名师长仍待查。';
const hevidence=hstage+' '+web('Purdue 招聘原档',hreport)+' · '+web('本人 CV',hcv)+' · '+web('IQIM 校友表',iqim);
replaceNoteLabel(hung,'博士后课题组负责人','博士后阶段研究师长',kimble,' '+hevidence);
editLine(fn(local(hung)),l=>l.startsWith('- 核查边界：'),l=>l.replace('另有 2011 年 Chicago 博士后阶段，师长待查。','Purdue 招聘原档另行支持 Kimble 为 Caltech 博后阶段研究师长。正式指导称谓待核。2011 年 9–10 月 Chicago 博士后师长待查。'));
replaceInverseLabel(kimble,hung,'博士后课题组成员','博士后阶段研究者',' '+web('Purdue 招聘原档',hreport));
replaceIndexLabel(hung,kimble,'博士后课题组负责人','博士后阶段研究师长',' '+web('Purdue 招聘原档',hreport));
changeRow(hung,null,'H. Jeff Kimble（Caltech 博后研究师长）；Chicago 博后指导者待核',web('Purdue 招聘原档',hreport)+' · '+web('本人 CV',hcv));
const aid=audit(hung,{postdoc:['group_or_candidate',hstage,[hcv,hreport,hgroup,iqim]]},'查 2011 年 9–10 月 University of Chicago James Franck Institute 博士后指导者，并查 Caltech 任用或奖学金具名指导记录。');
relation(hung,'postdoc',kimble,'stage_mentor',hstage,[hcv,hreport,hgroup,iqim],aid,false);
const choi='e90bba01';
const ciqim='https://iqim.caltech.edu/profile/joonhee-choi/?portfolioCats=324';
const cgroup='https://www.endreslab.com/people.html';
const cstage='Caltech IQIM 人物原档标为 IQIM Postdoctoral Scholar 并明确列 Endres Group。Endres 实验室原档列 2019–2022 博士后。两份记录核实组属，正式 sponsor 待查。';
note(choi,'- 博士后所在课题组：',cstage+' '+web('Caltech IQIM 本人档',ciqim));
audit(choi,{postdoc:['group_or_candidate',cstage,[ciqim,cgroup]]},'查 IQIM fellowship 任用记录、本人 CV 或具名指导陈述。');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_IQIM校友与聘用续核';
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

