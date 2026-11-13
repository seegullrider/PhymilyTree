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
 a.audit_id='20261110_'+id+'_mit_and_msu_0939';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_mit_and_msu_0939_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const az='7d1250ee', w=local('55dfd7e3'), cp='b304df5e', sh=local('6c004af0');
const mit='https://www.eecs.mit.edu/eecs-events/thesis-defense-aziza-almanakly/', aps='https://physics.aps.org/authors/aziza_almanakly', aLab='https://equs.mit.edu/aziza-almanakly/', nyu='https://engineering.nyu.edu/faculty/aziza-almanakly', award='https://alma.engineering.nyu.edu/news/almanakly-thesis-award/';
const cv='https://web.pa.msu.edu/people/carlo/CV_Piermarocchi07fullnm.pdf', msu='https://directory.natsci.msu.edu/directory/Profiles/Person/102143?group=1124&org=34', paper='https://arxiv.org/pdf/cond-mat/0102482';

const ae='APS 本人作者简介明确 MIT 博士后，以及 2026 年 9 月入 NYU 电气与计算机工程系。EQuS 旧个人页索引指向原博士课题组，但原页 404；William D. Oliver 暂列博后低可信候选。MIT 2025-07-22 答辩公告另明确列 William D. Oliver 为博士 Thesis Supervisor。';
const ap=web('APS 作者简介',aps)+' · '+web('MIT EQuS 旧档检索线索',aLab)+'。'+ae;
addEdge(az,'博士后导师候选',w,'William D. Oliver',ap,null,true);
editLine(fn(w),l=>l.startsWith('- 博士生：')&&l.includes('[['+local(az)+'|'),l=>l+'\n- 博士后候选研究者：[['+local(az)+'|Aziza Almanakly]]。'+ap);
enrich(az,'phd',w,'博士生',web('MIT 原答辩公告',mit)+'明确 Thesis Supervisor: William D. Oliver。');
editLine(fn(local(az)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('MIT 原答辩公告',mit)+'核博士导师。'+web('APS 原始作者简介',aps)+'明确 2025 MIT 博士之后仍在 MIT 做博士后。'+web('NYU 2026 年论文奖公告',award)+'列博士论文题名 Quantum Networking using Waveguide Quantum Electrodynamics，答辩公告使用另一题名；登记题名待学位档复读。');
changeRow(az,'William D. Oliver（MIT 答辩公告 Thesis Supervisor）','MIT 博士后；William D. Oliver（低可信候选）',web('MIT 论文答辩',mit)+' · '+web('APS 原档',aps)+' · '+web('NYU 论文奖',award));
const aa=audit(az,{phd:['confirmed_advisor','MIT EECS 博士答辩公告明确列 William D. Oliver 为 Thesis Supervisor。NYU 2026 论文奖公告使用另一题名。',[mit,award,nyu]],postdoc:['group_or_candidate',ae,[aps,aLab,nyu]],affiliation:['confirmed','NYU Tandon 原档列电气与计算机工程系助理教授，负责 ALMA Lab。',[nyu]],research:['confirmed','NYU 原档列超导电路、微波量子光学、量子互连及波导 QED。',[nyu,aps]]},'查 MIT RLE 博士后岗位原档及 EQuS 可读历史页；确定个人指导称谓。');
relation(az,'postdoc',w,'candidate',ae,[aps,aLab,nyu],aa);

const ce='MSU 托管的本人 CV 首次读得正文，Work Experience 栏明确列 1999–2002 年在 UCSD 的 Prof. L. J. Sham group 任 Research Assistant，MSU 原档列 1998 EPFL 理论物理博士。组属属实，CV 使用 Research Assistant，尚未找到同期明确的 Postdoc 职位或个人指导称谓，故保留博后阶段候选标签。';
const pr=web('MSU 本人 CV 任职栏',cv)+' · '+web('MSU 院系原档',msu)+'。'+ce;
function updateProof(file,prefix,target){
 editLine(file,l=>l.startsWith(prefix)&&l.includes('[['+target+'|'),l=>{
  const end=l.indexOf(']]',l.indexOf('[['+target+'|'))+2;
  return l.slice(0,end)+'。'+pr;
 });
}
updateProof(fn(local(cp)),'- 博士后阶段候选课题组负责人：',sh);
updateProof(fn(sh),'- 博士后阶段候选课题组成员（反向）：',local(cp));
updateProof(idx,'- [['+local(cp)+'|Carlo Piermarocchi]] → 博士后阶段候选课题组负责人：',sh);
editLine(fn(local(cp)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：EPFL 1998 年博士；论文导师待核。'+pr);
changeRow(cp,null,'UCSD 1999–2002 Research Assistant，Sham 组已核，博士后职称待核',web('本人 CV',cv));
const ca=audit(cp,{postdoc:['group_or_candidate',ce,[cv,msu,paper]],affiliation:['confirmed','MSU 院系原档列 Physics and Astronomy。',[msu]],research:['confirmed','MSU 院系原档列激子与极化激元光学、量子信息。',[msu]]},'查 EPFL 论文与 UCSD 1999–2002 Research Assistant 岗位的聘用类型及个人指导。');
relation(cp,'postdoc',sh,'candidate',ce,[cv,msu,paper],ca,false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_MIT与MSU阶段核查';
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
