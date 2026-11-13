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
function row(id,text,postdoc=null){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';return cells.join(' | ');
 });
}
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
 a.audit_id='20261110_'+id+'_named_degree_supervision_0530';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_degree_0530_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

function addRelation(id,label,target,display,detail,inverseLabel){
 const r=records.get(id);
 editLine(fn(r.filename),l=>l==='## 师承',l=>l+'\n\n- '+label+'：[['+target+'|'+display+']]。'+detail);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- '+inverseLabel+'：[['+r.filename+'|'+r.name+']]。'+detail);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+label+'：[['+target+'|'+display+']]。'+detail);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

const r='38d42d59', sil='师承人物 - Robert Silbey', vo='师承人物 - Gregory A. Voth';
const rOwn='https://reichmangroup.chem.columbia.edu/directory/david-r-reichman';
const rYale='https://chem.yale.edu/events/2025-10-21-anomalous-low-temperature-behavior-of-glasses';
const rProof='Reichman 本人 Columbia 课题组传记与 Yale 化学系讲座原档均明确 1997 年 MIT 化学博士研究受 Robert Silbey 指导，另有 AFOSR fellowship。论文签署页仍待核。';
const ra=audit(r,{
 phd:['confirmed_advisor',rProof,[rOwn,rYale]],
 postdoc:['group_or_candidate','本人课题组传记与 Yale 讲座均指名 1997–1999 Utah NIH 博士后研究由 Greg Voth 指导，原文为 under the direction of，记录具体阶段研究师长；岗位正式 advisor 字段待查。',[rOwn,rYale]],
 affiliation:['confirmed','Columbia 本人组档及 Yale 2025 化学讲座均列 Columbia 化学 Centennial Professor。',[rOwn,rYale]]
},'MIT 学位库退避后查本人论文签署，另查 Utah NIH 博后原始任命或资助档。');
const rn=' '+web('Yale 化学系讲座履历',rYale)+'也明确指名 Silbey 指导 MIT 博士研究；论文签署页待核。';
replaceNoteLabel(r,'博士阶段研究师长','博士导师',sil,rn);
replaceInverseLabel(sil,r,'博士阶段受指导者','博士生',rn);
replaceIndexLabel(r,sil,'博士阶段研究师长','博士导师',rn);
const rv=web('Yale 化学系讲座履历',rYale)+'亦确认 1997–1999 Utah NIH 博后阶段与具名研究指导。';
note(r,'- 博士后阶段研究师长：',rv);
mentorLine(vo,r,'- 博士后阶段受指导者：',rv);
indexLine(r,vo,'博士后阶段研究师长',rv);
editLine(fn(local(r)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('本人组页',rOwn)+'与'+web('Yale 化学系讲座',rYale)+'分别将 Silbey 明确列为 MIT 1997 博士研究指导者，将 Voth 列为 Utah NIH 博后阶段研究师长；原论文签署及博后聘书待核。');
changeRow(r,'Robert Silbey（1997 MIT 化学博士导师，具名本人履历）','Gregory A. Voth（1997–1999 Utah NIH 博后阶段研究师长）',web('Yale 化学系讲座',rYale));
relation(r,'phd',sil,'advisor',rProof,[rOwn,rYale],ra,false);

const x='b342f700', mac='师承人物 - Mark MacLachlan';
const xOwn='https://www.roy-labs.com/xavier.html';
const xCol='https://www.columbia.edu/cu/chemistry/groups/newsletter/n2/newsletter1/xavierroy.html';
const xCSU='https://www.chem.colostate.edu/seminars/tba-xavier-roy-ph-d/';
const xProof='Roy 本人组传记与 Columbia 化学系入职系刊明确 2011 UBC 化学博士研究在 Mark MacLachlan 指导下完成，Colorado State 化学系讲座补证。与 2005 Montréal 硕士 Basil Favis 分列，UBC 论文签署仍待核。';
const xa=audit(x,{phd:['confirmed_advisor',xProof,[xOwn,xCol,xCSU]]},'查 UBC 学位签署档与 2011–2013 NSERC 博后任命，Nuckolls 保留合作和导师候选。');
const xn=' '+web('Columbia 化学系入职档',xCol)+'与本人组档均明确具名博士指导，论文签署页待核。';
replaceNoteLabel(x,'博士阶段研究师长','博士导师',mac,xn);
replaceInverseLabel(mac,x,'博士阶段研究受指导者','博士生',xn);
replaceIndexLabel(x,mac,'博士阶段研究师长','博士导师',xn);
changeRow(x,'Mark MacLachlan（2011 UBC 化学博士导师，具名本人传记及校方系刊）',null,web('Columbia 化学系入职档',xCol));
relation(x,'phd',mac,'advisor',xProof,[xOwn,xCol,xCSU],xa,false);

const c='a7d17766', be='师承人物 - Bruce Berne';
const cBio='https://web.mit.edu/jianshucaogroup/pdfdir/jp803347m.pdf';
const cPaper='https://web.mit.edu/jianshucaogroup/pdfdir/2024/cao217.5.pdf';
const cDept='https://chemistry.mit.edu/profile/jianshu-cao/';
const cProof='MIT 托管的本人论文作者简介直接写 Columbia 1993 物理博士由 Bruce Berne 指导；对齐既有博士导师标签和结构化类型，学位签署页尚待查。';
const ca=audit(c,{
 phd:['confirmed_advisor',cProof,[cBio]],
 postdoc:['group_or_candidate','本人作者简介分列 Penn 博后 with Greg Voth 和 UCSD 博后 with Kent Wilson；Cao 等作者发表的 Voth 纪念文章直接称 Cao 为 Penn 时的 Voth postdoc，复核阶段关系，未给正式 advisor 字段。',[cBio,cPaper]],
 affiliation:['confirmed','MIT 化学系现任档确认化学教授及 Postdoc Officer。',[cDept]]
},'查 Columbia 论文签署页、Penn 和 UCSD 博后任命档及 Kent Wilson 的具名指导材料。');
const ct=web('Cao 等本人合写的 Voth 纪念文',cPaper)+'直接称他为 Voth 在 Penn 时的 postdoc。';
editLine(fn(local(c)),l=>l.startsWith('- 博士后阶段研究师长：')&&l.includes('[['+vo+'|'),l=>l+' '+ct);
mentorLine(vo,c,'- 博士后阶段研究者：',ct);
indexLine(c,vo,'博士后阶段研究师长',ct);
changeRow(c,'Bruce Berne（1993 Columbia 物理博士导师）','Gregory A. Voth（Penn 博后研究师长）、Kent R. Wilson（UCSD 博后研究师长）',web('Voth 纪念文',cPaper));
relation(c,'phd',be,'advisor',cProof,[cBio],ca,false);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0530';
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
