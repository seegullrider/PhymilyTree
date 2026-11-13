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
 a.audit_id='20261110_'+id+'_gong_post_candidates_1314';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_gong_post_candidates_1314_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const id='01c0b72d', pb='师承人物 - Paul Brumer', sr='师承人物 - Stuart A. Rice';
const pku='https://icqm.pku.edu.cn/docs/20180201155242888271.pdf';
const tor='https://ethz.ch/content/dam/ethz/special-interest/chab/physical-chemistry/ultrafast-spectroscopy-dam/documents/publications/2003/Gong03b.pdf';
const chi='https://arxiv.org/pdf/quant-ph/0405061';
const rev='https://www.annualreviews.org/doi/pdf/10.1146/annurev.physchem.59.032607.093731';
const chronology='https://www.annualreviews.org/content/journals/10.1146/annurev.physchem.56.092503.141319';
const cv='https://www.cqt.sg/highlight/2022-07-meet-gong-jiangbin/';
const pEv='北京大学讲座原档确认 Toronto Chemical Physics Theory Group 博后。2003 年原论文将 Gong 与 Brumer 同列该组并共同署名。博士导师关系由本人采访单独确认，Toronto 博后个人指导暂仅为低可信候选。';
const sEv='北京大学讲座原档确认 Chicago James Franck Institute 博后。2004 年 Gong 与 Stuart A. Rice 共同署名并同列 Chicago；2005 年作者单位独立确认 Gong 在 James Franck Institute，Rice 本人回忆讨论合作成果。正式指导仍待聘任资料。';
const pLink=web('Toronto 2003 原论文',tor)+' · '+web('北京大学讲座原档',pku)+'。'+pEv;
const sLink=web('Chicago 2004 原论文',chi)+' · '+web('2005 原始作者单位',chronology)+' · '+web('Rice 本人回忆',rev)+' · '+web('北京大学讲座原档',pku)+'。'+sEv;
const aid=audit(id,{
 phd:['confirmed_advisor','本人 CQT 采访明确称 Paul Brumer 为 PhD supervisor。',[cv]],
 postdoc:['group_or_candidate',pEv+' '+sEv,[pku,tor,chi,rev,chronology]]
},'分别核 Toronto Henry Croft 与 Chicago JFI 任用中的个人指导及任期。');
addEdge(id,'博士后导师候选',pb,'Paul Brumer',pLink,null,true);
addEdge(id,'博士后导师候选',sr,'Stuart A. Rice',sLink,null,true);
inverse(id,pb,'博士后研究者候选',pLink);
inverse(id,sr,'博士后研究者候选',sLink);
note(id,'- 核查边界：','Toronto 与 Chicago 分别保留低可信候选。'+pLink+' '+sLink);
changeRow(id,null,'Paul Brumer（Toronto 候选）；Stuart A. Rice（Chicago 候选）',pLink+' '+sLink);
relation(id,'postdoc',pb,'candidate',pEv,[tor,pku],aid,false);
relation(id,'postdoc',sr,'candidate',sEv,[pku,chi,rev,chronology],aid,false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Gong两段博后候选';
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
