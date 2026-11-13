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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0659';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0659_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const tab='097a7b59', wong='27b18064', dr='c05717d1';
const [timeline,uci,,gren,,lehigh]=["https://quilici.us/mudder74/Peter_Taborek_bio.pdf","https://www.faculty.uci.edu/profile/?facultyId=2166","https://live-sas-physics.pantheon.sas.upenn.edu/sites/default/files/2012_cv_drndic_marija.pdf","https://www.grenoble-inp.fr/fr/recherche-valorisation/h-s-philip-wong-curriculum-vitae","https://doaj.org/article/f6e0ddbeb5f847d5a007f712d5302711","https://engineering.lehigh.edu/news/article/h-s-philip-wong-phd-88-elected-national-academy-engineering"];
const [mit,nus,lab]=["https://physics.mit.edu/research/pappalardo-fellowships-in-physics/","https://www.physics.nus.edu.sg/seminar-2023-jan-marija-drndic/","https://nanocluster.mit.edu/publications"];
const [cal,harvard]=["https://thesis.caltech.edu/17704/","https://www.physics.harvard.edu/academics/phds1971-2000"];
const stan='https://web.stanford.edu/~hspwong/index.html';
function replaceBoundary(id,text){editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+text);}
function addBeforeBoundary(id,text){editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),l=>text+'\n'+l);}
const tProof='本人时间线记 Caltech 1974–1980、1980 年进入 Bell Labs、随后任职 Texas Instruments、1989 年转 UC Irvine；未单列博士后聘任，也未具名工业阶段导师。';
addBeforeBoundary(tab,'- 博士毕业后经历：'+tProof+' '+web('本人时间线',timeline)+' · '+web('UCI 教师档',uci));
replaceBoundary(tab,'Caltech 正式博士导师已核；Bell Labs 最初职位的正式名称及是否另有培训经历待原任职档。');
note(tab,'- 研究方向：',web('UCI 教师档',uci)+'核对物理与天文学系教授、量子流体相变、低温薄膜和界面流动。');
changeRow(tab,null,'Bell Labs（1980 起）及 Texas Instruments；未见独立博士后任命',web('本人时间线',timeline));
const tAudit=audit(tab,{phd:['confirmed_advisor','Caltech 1980 学位原档的 Advisor 栏直接列 David L. Goodstein。',[cal]],postdoc:['no_postdoc_documented',tProof,[timeline,uci]],affiliation:['confirmed','UCI 官方教师页列物理与天文学系教授。',[uci]],research:['confirmed','UCI 教师档列量子流体相变、低温薄膜和界面流动。',[uci]]},'查 Bell Labs 最初任职头衔与岗位性质，现已记录本人时间线中的工业经历。');
relation(tab,'phd','师承人物 - David L. Goodstein','advisor','Caltech 1980 博士论文档直接列 Goodstein 为 Advisor。',[cal],tAudit);
const wProof='本人 Stanford 履历将 1988–2004 连续列为 IBM T. J. Watson Research Center，Grenoble INP 履历列 Research Staff Member 及管理职务；两档均未单列博士后。';
addBeforeBoundary(wong,'- 博士毕业后经历：'+wProof+' '+web('Stanford 本人履历',stan)+' · '+web('Grenoble INP 履历',gren));
replaceBoundary(wong,'Lehigh 博士导师已核；IBM 研究任职的最初正式头衔仍可用同期档复核。');
note(wong,'- 研究方向：',web('Stanford 本人履历',stan)+'核对电气工程系教授、固态器件、半导体、纳米技术与存储。');
changeRow(wong,null,'IBM Research（1988–2004）；未见独立博士后任命',web('Stanford 本人履历',stan)+' · '+web('Grenoble INP 履历',gren));
const wAudit=audit(wong,{phd:['confirmed_advisor','Lehigh 原校友报道明确称 Marvin H. White 为其 advisor，并写其指导 Lehigh 博士研究。',[lehigh]],postdoc:['no_postdoc_documented',wProof,[stan,gren]],affiliation:['confirmed','Stanford 本人履历列电气工程系教授，2004 年 9 月入职。',[stan]],research:['confirmed','Stanford 本人履历列纳米科学技术、固态器件、半导体与固态存储。',[stan]]},'查 IBM 1988 年最初岗位原任职档；连续工作经历已核。');
relation(wong,'phd','师承人物 - Marvin H. White','advisor','Lehigh 工程学院校友原报道具名 White 为导师，指导其博士研究。',[lehigh],wAudit);
const west='人员 - Harvard - Robert Westervelt - 1f1887f8';
const candidateProof=web('MIT Pappalardo 项目档',mit)+'核对 2000–2003 MIT 博后。'+web('Bawendi 原组论文表',lab)+'列 2002 年 Drndić 与 Kastner、Bawendi 的 CdSe 纳米晶电输运合著。关系类型可信度：低（同期研究合作候选，指导关系待核）。';
for(const [target,label] of [['人员 - MIT - Marc A. Kastner - 65a0d30e','Marc A. Kastner'],['人员 - MIT - Moungi Bawendi - c8ddd180','Moungi G. Bawendi']]){
 addEdge(dr,'博士后导师候选',target,label,candidateProof,west,true);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- 博士后候选关联人物：[['+local(dr)+'|Marija Drndić]]。'+candidateProof);
}
addBeforeBoundary(dr,'- 博士后经历：'+web('MIT Pappalardo 项目档',mit)+'列 2000–2003 fellowship。'+web('NUS 物理系讲座档',nus)+'核对 Harvard 博士、MIT fellowship 与 2003 Penn 入职。');
replaceBoundary(dr,'Harvard 学位目录确认 Westervelt。旧 CV 未重试，先前 Ketterle 短期研究线索继续保留待核；Kastner、Bawendi 是经同期合作追出的候选，正式博士后指导及组属仍待查。');
note(dr,'- 研究方向：',web('NUS 物理系原讲座档',nus)+'核对 Penn 物理与天文学系 Langberg 教授及低维纳米器件。');
changeRow(dr,'Robert M. Westervelt（论文导师）','MIT Pappalardo Fellow 2000–2003；Marc A. Kastner、Moungi G. Bawendi（合作候选）',web('MIT Pappalardo 原档',mit)+' · '+web('Bawendi 实验室论文表',lab));
const dAudit=audit(dr,{phd:['confirmed_advisor','Harvard 学位目录将论文 Micro-Electromagnets for Particle Control 对应到 Marija Drndic，题后标 Westervelt。',[harvard]],postdoc:['group_or_candidate','MIT 具名 Pappalardo 2000–2003；原组论文表具名同期 CdSe 纳米晶输运合作者 Kastner 和 Bawendi，正式指导及具体组属待核。',[mit,lab,nus]],affiliation:['confirmed','NUS 物理系原讲座资料列 Penn 物理与天文学系 Langberg 教授。',[nus]],research:['confirmed','NUS 物理系原讲座资料核实实验凝聚态、介观及低维纳米器件。',[nus]]},'查首届 MIT Pappalardo 任命、个人 CV 可读本与旧 Ketterle 线索；保留同期合著作为候选证据。');
relation(dr,'phd',west,'advisor','Harvard 物理博士原名录在同题学位条目标 Westervelt，名录说明括号为论文导师。',[harvard],dAudit);
for(const target of ['人员 - MIT - Marc A. Kastner - 65a0d30e','人员 - MIT - Moungi Bawendi - c8ddd180'])relation(dr,'postdoc',target,'candidate','MIT Pappalardo 原档核 2000–2003 博后；Bawendi 原组 2002 论文清单列同阶段纳米晶电输运研究合作，个人指导关系仍待核。',[mit,lab,nus],dAudit);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_早期岗位原页复核';
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
