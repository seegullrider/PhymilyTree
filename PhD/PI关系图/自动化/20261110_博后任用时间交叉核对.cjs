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
 a.audit_id='20261110_'+id+'_cv_timing_1830';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_cv_timing_1830_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const bur='915bb887',eis='师承人物 - James P. Eisenstein';
const cal='https://burkeinstitute.caltech.edu/people/postdoctoral-fellows';
const ecv='https://www.its.caltech.edu/~je/cv_dec13.pdf';
const bcv='https://www.burkelab.com/wp-content/uploads/BurkeCV11Feb2021-1.pdf';
const bg='https://www.its.caltech.edu/~jpelab/people.html';
const be='Caltech Burke Institute 历史名录记 1997–2000，Burke 本人 CV 记 1997–2001，Eisenstein 2013 CV 名录记 1998–2001。三种记录分别留存。已有 Caltech Eisenstein 博后组属维持，个人正式指导称谓继续查。';
const bp=be+' '+web('Caltech 历史名录',cal)+' · '+web('Eisenstein 2013 CV',ecv)+' · '+web('Burke 本人 CV',bcv);
note(bur,'- 博士后课题组负责人：',bp);
mentorLine(eis,bur,'- 博士后课题组成员：',web('Caltech Burke Institute 历史名录',cal)+'另记 1997–2000。');
indexLine(bur,eis,'博士后课题组负责人',web('Caltech 历史名录',cal)+'另记 1997–2000。');
changeRow(bur,null,'James P. Eisenstein（Caltech 博后课题组负责人；任用年份有三个档案口径）',web('Caltech 历史名录',cal)+' · '+web('Eisenstein 2013 CV',ecv));
audit(bur,{postdoc:['group_or_candidate',be,[cal,ecv,bcv,bg]]},'查 Caltech Sherman Fairchild 原始任用起止及具名指导者。保留三种履历区间。');

const ph='20177731';
const cv='https://www.mccormick.northwestern.edu/materials-science/documents/cd-phatak-cv-jan-2021.pdf';
const ufl='https://ece.ufl.edu/2025/09/29/seminar-charudatta-phatak/';
const proj='https://science.osti.gov/-/media/bes/mse/pdf/docs/ESPM_2010.pdf';
const pe='本人 2021 CV 明列 2009–2011 Argonne 材料科学部 Postdoctoral Researcher 及之后 Assistant Materials Scientist。2010 DOE 项目名录支持 Petford-Long 组属，正式个人指导角色待核。UF 2025 ECE 报告原档核 Argonne 材料科学部副主任、磁性与电子异质结构组组长及 Northwestern 材料系兼任。';
note(ph,'- 核查边界：',pe+' '+web('本人 CV',cv)+' · '+web('UF ECE 原档',ufl));
changeRow(ph,null,'Amanda Petford-Long（Argonne 2009–2011 博后课题组负责人）',web('本人 CV',cv)+' · '+web('UF ECE 原档',ufl));
audit(ph,{postdoc:['group_or_candidate',pe,[cv,ufl,proj]],affiliation:['confirmed','UF ECE 2025 机构原档核 Argonne 材料科学部副主任、课题组负责人及 Northwestern 材料系兼任。',[ufl,cv]]},'查 Argonne 2009–2011 正式博后任命或项目的个人指导字段。');

const wh='205f65de';
const fnal='https://sqmscenter.fnal.gov/profile/william-halperin/';
const we='Fermilab SQMS 人物档核 Northwestern 任职与低温超流、超导谱学及磁共振方向。';
note(wh,'- 核查边界：',we+' '+web('Fermilab SQMS 原档',fnal));
changeRow(wh,null,null,web('Fermilab SQMS',fnal));
audit(wh,{research:['confirmed',we,[fnal]]},'查 Cornell 博士论文正式指导及任 Northwestern 前是否有独立博士后任用。');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_博后任用时间交叉核对';
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
 if(typed.length)console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}

