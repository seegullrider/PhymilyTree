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
 a.audit_id='20261110_'+id+'_miller_usc_brown_cce_1825';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_miller_usc_brown_cce_1825_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



function addAtHeading(file,heading,line){
 editLine(file,l=>l===heading,l=>l+'\n\n'+line);
}
function addCandidate(id,stage,target,label,evidence,proof,sources,aid){
 const learner=local(id), name=records.get(id).name;
 const edge='[['+target+'|'+label+']]。'+proof;
 addAtHeading(fn(learner),'## 师承','- '+stage+'导师候选：'+edge);
 if(target.startsWith('人员 - '))addAtHeading(fn(target),'## 师承','- '+stage+'候选受指导者：[['+learner+'|'+name+']]。'+proof);
 else addAtHeading(fn(target),'## 师承候选线索','- '+stage+'候选受指导者：[['+learner+'|'+name+']]。'+proof);
 editLine(idx,l=>l.startsWith('- [['+learner+'|')&&l.includes(' → '),l=>l+'\n- [['+learner+'|'+name+']] → '+stage+'导师候选：'+edge);
 relation(id,stage==='博士'?'phd':'postdoc',target,'candidate',evidence,sources,aid);
}
const pp='1ff9f7d8', al='师承人物 - Orlando Alvarez';
const aip='https://history.aip.org/history/catalog/icos/46899.html';
const miller='https://miller.berkeley.edu/images/newsletters/Fall2020_digital.pdf';
const icmt='https://icmt.illinois.edu/people/dimer';
const pEvidence='Berkeley Miller Institute 原刊把 Phillips 列为 1982–1984 Miller Fellow。AIP 的本人访谈档案概要提及 Berkeley 博后阶段向 Orlando Alvarez 学习重整化群。保留待查个人关系。';
const pProof=pEvidence+' '+web('Miller 原刊',miller)+' · '+web('AIP 访谈档案',aip);
const pa=audit(pp,{postdoc:['group_or_candidate',pEvidence,[miller,aip,icmt]]},'查 Miller Fellow 受聘档案中的 host、AIP 访谈全文与 Berkeley 同期研究记录，核 Alvarez 的具体指导角色。');
note(pp,'- 核查边界：',web('Miller Institute 原刊核 1982–1984',miller));
changeRow(pp,null,'UC Berkeley Miller Fellow（1982–1984）；Orlando Alvarez（待核候选）',web('AIP 访谈目录',aip)+' · '+web('Miller 原刊',miller)+' · '+web('Illinois ICMT',icmt));
addCandidate(pp,'博士后',al,'Orlando Alvarez',pEvidence,pProof,[miller,aip],pa);

const gu='1ff1665d', mad=local('658cf8a7');
const uc='https://climate.uchicago.edu/people/supratik-guha/';
const mcv='https://viterbi.usc.edu/directory/cv/madhukar_anupam_cv.pdf';
const gEvidence='Chicago 原档核 Supratik Guha 于 1991 年获 USC 材料科学博士。USC 的 Madhukar 本人 CV 列 S. Guha 在 1990 年共同发表数篇半导体外延与量子结构论文。博士阶段合作提供追查线索，候选可信度低。';
const gProof=gEvidence+' '+web('Chicago 履历',uc)+' · '+web('USC Madhukar CV',mcv);
const ga=audit(gu,{phd:['group_or_candidate',gEvidence,[uc,mcv]]},'查 USC 材料科学 1991 年博士论文题名及签署页，核 Madhukar 候选。IBM Esaki–Chang 博后具体个人关系仍待查。');
note(gu,'- 核查边界：',web('Chicago 原档',uc)+'核 USC 博士年份、分子工程及 Argonne 的微电子和量子信息工作。');
changeRow(gu,'Anupam Madhukar（待核候选）',null,web('Chicago 现任档',uc)+' · '+web('Madhukar CV',mcv));
addCandidate(gu,'博士',mad,'Anupam Madhukar',gEvidence,gProof,[uc,mcv],ga);

const lom='b7987800';
const lm='https://matsci.ucsd.edu/faculty/vitaliy-lomakin';
const ln='https://cem01.ucsd.edu/news.html';
const lEvidence='UC San Diego 材料项目原档合记 2002–2005 Illinois Center for Computational Electromagnetics 的 Postdoctoral Associate 与 Visiting Assistant Professor，未分列任用起止；同页另列 Tel Aviv 博士 2003，两个区间重叠须核具体生效年月。';
note(lom,'- 核查边界：',lEvidence+' '+web('UC San Diego 材料项目档',lm));
editLine(fn(local(lom)),l=>l.startsWith('- ECE 教授；'),l=>l+' 课题组公告记其自 2026 年 7 月任 CMRR 主任。'+web('课题组任用公告',ln));
changeRow(lom,null,'Illinois CCE 博士后及访问助理教授（合记 2002–2005）；指导者待核',web('材料项目档',lm)+' · '+web('CMRR 主任公告',ln));
audit(lom,{postdoc:['unresolved',lEvidence,[lm]],affiliation:['confirmed','UCSD 材料项目档列 ECE 任职，本人组公告记 2026 年 7 月起任 CMRR 主任。',[lm,ln]]},'定位 Illinois CCE 同期个人任用或指导原件，核 Michielssen 搜索线索和博士与博后具体月份。');

const feld='2c0d9567';
const brown='https://archive2.news.brown.edu/1987-2007/2003-04/03-015d.html';
const fcv='https://vivo.brown.edu/docs/d/dfeldman_cv.pdf?dt=422016130';
const fe='Brown 2003 年任用档明确 Argonne 材料科学部博后隶属其 Material Theory Institute；Brown 所存本人 CV 核 Weizmann 1999 Koshland award。两段个人指导者均待查。';
note(feld,'- 博士后经历：',fe+' '+web('Brown 2003 招聘原档',brown)+' · '+web('本人 CV 补档',fcv));
changeRow(feld,null,'Weizmann（1999–2001）、Argonne 材料科学部 Material Theory Institute（2001–2003）；指导者待核',web('Brown 任用档',brown));
audit(feld,{postdoc:['unresolved',fe,[brown,fcv]]},'分别查 Weizmann Koshland fellowship 和 Argonne Material Theory Institute 个人任用。追 2001 Weizmann 合作论文的具名课题档，按任用时段核实。');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Miller与跨院系研究履历';
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

