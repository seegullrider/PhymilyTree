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
 a.audit_id='20261110_'+id+'_tanwhite_1017';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_tanwhite_1017_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const tan='b3393546', white='ec405d11';
const tc='https://fds.duke.edu/db/pratt/mems/faculty/ttan/files/cv.pdf', td='https://mems.duke.edu/people/teh-tan/';
const tt='https://escholarship.org/content/qt7xs8f92s/qt7xs8f92s.pdf', tb='https://news.cornell.edu/stories/2022/12/robert-balluffi-materials-science-professor-dies-98';
const te='Tan 本人 Duke CV 第 1 页列 1971 Berkeley 材料博士、1972–1974 Cornell 材料系 Research Associate，第 5 页列同期与 Robert W. Balluffi 合作晶界。Cornell 院档核 Balluffi 自 1964 任教并开展晶界研究。岗位是否属正式博后、带教关系均待核，Balluffi 仅为低可信候选。';
const tp=web('Tan 本人 CV',tc)+' · '+web('Duke 院系档',td)+' · '+web('Cornell Balluffi 院档',tb)+'。'+te;
const ball='师承人物 - Robert W. Balluffi';
addEdge(tan,'博士后导师候选',ball,'Robert W. Balluffi',tp,null,true);
inverse(tan,ball,'博士后候选研究者',tp);
note(tan,'- 核查边界：',tp+' '+web('疑似 Berkeley 博士论文线索，待原文',tt)+'已找到索引，当前主机退避，未开原文。');
changeRow(tan,'待核，已找到疑似 Berkeley 论文线索','Cornell 1972–1974 Research Associate；Balluffi（低可信候选，博后性质待核）',tp);
const ta=audit(tan,{phd:['unresolved','本人 CV 列 1971 Berkeley 材料科学博士，疑似论文原件已排队，退避期间未读。',[tc,td]],postdoc:['group_or_candidate',te,[tc,td,tb]],affiliation:['confirmed','Duke 院系档为机械工程与材料科学荣休教授。',[td]],research:['confirmed','Duke CV 与院系页核半导体缺陷、扩散及电子材料。',[tc,td]]},'主机退避到期后核 Berkeley 疑似学位论文题页、致谢与签署页；查 Cornell Research Associate 原始任命及组档。');
relation(tan,'postdoc',ball,'candidate',te,[tc,tb],ta);

const wc='https://www.colorado.edu/chbe/2018/06/13/welcoming-professors-michael-mcgehee-and-timothy-white';
const wi='https://guymon.lab.uiowa.edu/personnel/timothy-white', wp='https://www.colorado.edu/research/rpmgroup/publications';
const wa='https://pmsedivision.org/wp-content/uploads/2019/04/Coop_Award_2013.pdf', wt='师承人物 - Timothy J. Bunning';
const we='Colorado Boulder 2018 入职报道明确 White 2006 年以博士后研究员身份加入 AFRL。White 课题组书目明确分列 AFRL 博后论文，多篇与 Timothy J. Bunning 同署。ACS 2013 合作奖确认持续合作，但个人指导角色与博后结束日期仍未明。Bunning 保留低可信博后候选。';
const wproof=web('Colorado Boulder 入职原档',wc)+' · '+web('本人课题组博后论文书目',wp)+' · '+web('ACS 合作奖原档',wa)+'。'+we;
addEdge(white,'博士后导师候选',wt,'Timothy J. Bunning',wproof,null,true);
newMentor(wt,'Timothy J. Bunning','AFRL 响应材料研究。'+web('ACS 合作奖原档',wa),white,'博士后候选研究者',wproof);
editLine(fn(local(white)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Iowa Guymon 本人课题组列 White 为 2006 博士，保留博士课题组负责人；正式博士导师称谓待学位档。'+wproof);
changeRow(white,null,'AFRL 自 2006 博后；Timothy J. Bunning（低可信候选）',wproof);
const wai=audit(white,{phd:['group_or_candidate','Iowa Guymon 课题组原始个人条目列 Timothy White 为 2006 年博士。Colorado 入职档核 Iowa 化工硕士与博士。Guymon 继续标组负责人。',[wi,wc]],postdoc:['group_or_candidate',we,[wc,wp,wa]],affiliation:['confirmed','Colorado Boulder 2018 录用原档列化学与生物工程和材料科学与工程；现有研究中心任职另见人物页。',[wc]],research:['confirmed','Colorado Boulder 院档核响应软材料与液晶聚合物。',[wc,wp]]},'查 Iowa 博士论文和 AFRL 2006 年聘任、带教原件；区分博士课题组与博后候选。');
relation(white,'postdoc',wt,'candidate',we,[wc,wp,wa],wai);


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_TanWhite阶段复核';
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
