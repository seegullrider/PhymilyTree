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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0802';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0802_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const fw='f6ff5120', yh='人员 - Stanford - Tony F. Heinz - d6fdab44', sh='人员 - UC Berkeley - Yuen-Ron Shen - 81347a28';
const cv='https://studylib.net/doc/18500058/feng-wang-physics-department-phone--510-486';
const bk='https://physics.berkeley.edu/people/faculty/feng-wang', sp='https://physics.berkeley.edu/people/faculty/yuen-ron-shen', prl='https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.97.206806', m='https://miller.berkeley.edu/images/newsletters/2008_spring.pdf', old='https://www.iop.cas.cn/xshd/xsbg/201307/P020130708568407260764.pdf';
const sy='https://events.syracuse.edu/event/dissertation-defense-feng-wang';
const doc='本人履历转存件的 2004 年 10 月 Columbia 物理博士条目明确列 Adviser: Tony Heinz，并记论文《Optical Spectroscopy of Nano-structures with femtosecond laser pulses》。Berkeley 官方教师档核授位院校和年份。';
const post='Berkeley 的 Shen 原教师页具名称 Feng Wang 为其组内研究者，具体提及单壁碳纳米管光谱。2006 年 Miller 阶段原论文将二人同署 Berkeley Physics 与 LBNL，和本人 CV 的 2005-08 至 2007-07 Miller 任职相符。记 Shen 为博士后课题组负责人；任命的正式 advisor 字段待查。';
const ev=web('Shen 的 Berkeley 原档',sp)+' · '+web('同期 PRL',prl)+' · '+web('Berkeley 教师档',bk)+'。'+post;
enrich(fw,'phd',yh,'博士生',web('本人 CV 转存件',cv)+'。'+doc);
addEdge(fw,'博士后课题组负责人',sh,'Yuen-Ron Shen（沈元壤）',ev,yh);
editLine(fn(sh),l=>l==='## 师承',l=>l+'\n\n- 博士后课题组成员：[['+local(fw)+'|Feng Wang]]。'+ev);
editLine(fn(local(fw)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Berkeley 物理系教师档与本人 CV 将 Miller 阶段列为 2005–2007，Miller 2008 新闻简报写作 2005–2008，保留两个日期口径。Syracuse 的同名答辩属于深度学习安全方向，已排除。 '+web('Miller 原简报',m)+' · '+web('同名答辩',sy));
note(fw,'- 院系／机构：',web('Berkeley 物理系原档',bk)+'核物理系及 2007 任教。');
note(fw,'- 研究方向：',web('Berkeley 教师原档',bk)+'核超快光学、低维纳米结构与光谱。');
changeRow(fw,'Tony F. Heinz（本人 CV 明列 Adviser）','Yuen-Ron Shen（Miller 博后课题组负责人；正式导师待核）',web('本人 CV 转存件',cv)+' · '+web('Shen 原档',sp)+' · '+web('Miller 简报',m));
const id=audit(fw,{phd:['confirmed_advisor',doc,[cv,bk,old]],postdoc:['group_or_candidate',post+' 校系档和本人 CV 写 2005–2007，2008 Miller 简报写 2005–2008。',[sp,bk,cv,prl,m]],affiliation:['confirmed','Berkeley 物理系原档确认 Columbia 2004 博士及 2007 起加入 Berkeley 物理。',[bk]],research:['confirmed','Berkeley 原教师页核超快光谱、单纳米结构与低维凝聚态。',[bk,sp]]},'找 Miller 2005 原任命和 host／advisor 字段，核 2007／2008 结束年份口径；Syracuse 深度学习安全同名者已排除。');
relation(fw,'phd',yh,'advisor',doc,[cv,bk,old],id);
relation(fw,'postdoc',sh,'group_leader',post,[sp,prl,cv,bk,m],id);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_FengWang两阶段与同名';
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
