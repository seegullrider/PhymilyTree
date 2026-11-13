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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0706';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0706_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const fan='6baceb91', lu='ab67d742', loh='863e6672';
const cap='人员 - Harvard - Federico Capasso - e762b00c', ro='师承人物 - John A. Rogers';
const kp='人员 - NUS - Kian Ping Loh - 97f3ca6a', sl='人员 - UC Berkeley - Stephen Leone - 9194ca79';
const lab='https://fanlab.stanford.edu/people/', theses='https://capasso.seas.harvard.edu/theses';
const zju='https://physics.zju.edu.cn/2016/0511/c70851a2735380/page.htm', nus='https://chemistry.nus.edu.sg/people/lu-jiong/';
const cl='https://academic.oup.com/chemlett/article/50/5/965/7350883', ntu='https://www.ntu.edu.sg/spms/about-us/physics/people/faculty';
function addSource(id,label,target,reverse,text){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+text);
 mentorLine(target,id,'- '+reverse+'：',text);
 indexLine(id,target,label,text);
}
const fDoc='Fan 本人 Stanford 实验室履历明确称 2010 年 Harvard 应用物理博士 under the supervision of Federico Capasso。Harvard 组博士论文清单以全名 Jonathan Albert Fan 列其论文。';
enrich(fan,'phd',cap,'博士生',web('本人 Stanford 实验室履历',lab)+fDoc);
addSource(fan,'博士后课题组负责人',cap,'博士后课题组成员',web('本人 Stanford 实验室履历',lab)+'记博士后与 Capasso 继续工作至 2011 年。');
addSource(fan,'博士后阶段研究师长',ro,'博士后阶段研究者',web('本人 Stanford 实验室履历',lab)+'明确 Illinois Beckman 博后受 John Rogers 指导。');
editLine(fn(local(fan)),l=>l.startsWith('- 核查边界：'),l=>l+' 本人 Stanford 实验室履历已再次具名两段博士后，ProQuest 论文原始签署仍待核。');
changeRow(fan,'Federico Capasso（本人实验室履历明确博士指导）','Federico Capasso（Harvard 博后至 2011，课题组负责人）；John A. Rogers（Illinois Beckman 博后研究师长）',web('本人实验室履历',lab));
const f=audit(fan,{phd:['confirmed_advisor',fDoc,[lab,theses]],postdoc:['group_or_candidate','本人 Stanford 实验室履历分列 Harvard 与 Capasso 继续博后至 2011、Illinois Beckman 博后受 Rogers 指导。',[lab]],affiliation:['confirmed','本人 Stanford 实验室列 Jonathan Fan 为副教授，既有 Stanford 教师档核系属。',[lab]]},'继续查 Harvard 学位论文签署及两段博后岗位正式职衔，ProQuest 原条目本轮 403。');
relation(fan,'phd',cap,'advisor',fDoc,[lab,theses],f,false);
const jDoc='浙江大学物理系 2016 学术报告原档明确其 NUS 博士研究 under the supervision of Professor Loh Kian Ping；NUS 化学系现任档独立确认 2011 年 NUS 博士。';
enrich(lu,'phd',kp,'博士生',web('浙江大学物理系讲座原档',zju)+'明确为博士研究指导。'+web('NUS 化学系教师原档',nus)+'核对博士年份。');
changeRow(lu,'Kian Ping Loh（博士研究导师）','NUS Graphene Research Centre research fellow（导师待核）；2013 年起 Berkeley Crommie 组博士后',web('博士与博后时段核对',nus));
const j=audit(lu,{phd:['confirmed_advisor',jDoc,[zju,nus]],postdoc:['group_or_candidate','NUS 列 2011–2014 NUS 与 Berkeley 博后；浙江大学原档明确 2013 起 Berkeley Crommie 组，NUS 指导者待核。',[nus,zju]]},'追查 NUS 学位原件、Graphene Research Centre 博后导师及 Berkeley 正式博后任命。');
relation(lu,'phd',kp,'advisor',jDoc,[zju,nus],j,false);
const lDoc='Loh 本人的 Chemistry Letters 论文作者简介明确 2008 年 Berkeley 博士 under the tutelage of Stephen Leone，并独立写同组的后续博士后。NTU 教师目录核对 Berkeley 博士和现任。';
enrich(loh,'phd',sl,'博士生',web('本人论文作者简介',cl)+'明确 2008 年 Berkeley 博士研究由 Leone 指导，并分列同组后续博后。');
addSource(loh,'博士后阶段研究师长',sl,'博士后阶段受指导者',web('本人论文作者简介',cl)+'确认 Berkeley 同组两年博后，期间另到 Krausz 组短期访问。');
changeRow(loh,'Stephen Leone（本人论文作者简介明确博士指导）','Stephen Leone（Berkeley 两年博后，阶段研究师长）、Ferenc Krausz（短期访问课题组负责人）',web('本人论文作者简介',cl)+' · '+web('NTU 物理系名录',ntu));
const l=audit(loh,{phd:['confirmed_advisor',lDoc,[cl,ntu]],postdoc:['group_or_candidate','本人论文作者简介分列两年 Berkeley Leone 组博后与 Max Planck Krausz 组短期访问；正式博后任命指导者待核。',[cl]],affiliation:['confirmed','NTU 物理系现任名录列 Loh，Berkeley 博士，化学任职由此前院系档确认。',[ntu]]},'追查 Berkeley 2008 博士学位签署页及 Leone、Krausz 两阶段的正式任命与指导角色。');
relation(loh,'phd',sl,'advisor',lDoc,[cl,ntu],l,false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_原证角色对齐';
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
