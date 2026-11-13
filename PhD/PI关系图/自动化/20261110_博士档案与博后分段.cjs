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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0752';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0752_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const such='f0d195d4', pan='f14696a9', min='f23e1d08', forest='d1b04e2a';
const k='师承人物 - P. S. Kop’ev', rid='师承人物 - Robert C. Reid', fl='师承人物 - Hermann Flaschka', mc='师承人物 - David McLaughlin';
const guide='https://ehs.stonybrook.edu/commcms/electrical/graduate/_program_guide/guide_fall_2020_v2.pdf', sbu='https://www.stonybrook.edu/electrical/research/semiconductors.html';
const rus='https://www.fizmathim.com/submillimetrovaya-spektroskopiya-dvumernyh-poluprovodnikovyh-struktur-v-silnom-magnitnom-pole';
const paper='https://journals.ioffe.ru/articles/viewPDF/35832', jeter='https://link.springer.com/article/10.1134/1.1450292';
const suny='https://www.rfsuny.org/media/rfsuny/documents/Program-Book.pdf';
const sProof='Stony Brook 工程指南确认其 1998 年 Ioffe 博士。Ioffe 1999 年同题材原论文列 С. Д. Сучалкин 与 П. С. Копьев 同所合作；俄文论文摘要检索索引把后者列为 научный руководитель，但当前不能直接读取答辩摘要或签署。仅列低可信候选。';
const sp=web('Stony Brook 博士记录',guide)+' · '+web('Ioffe 原论文',paper)+' · '+web('待复核俄文论文',rus)+'。'+sProof;
addEdge(such,'博士导师候选',k,'P. S. Kop’ev（П. С. Копьев）',sp,null,true);
newMentor(k,'P. S. Kop’ev（П. С. Копьев）','Ioffe 半导体研究者，同所署名见'+web('1999 年原论文',paper)+'。',such,'博士生候选（待核）',sp);
const sLate='2001 年 JETP 原论文的 Suchalkin 署 Ioffe、K. von Klitzing 署 MPI Stuttgart；所阅 SUNY 索引还提示两个毕业后研究组，原节目册未重读。暂保留合作和后续组属线索，具体任命及正式导师待查。';
editLine(fn(local(such)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+sLate+' '+web('JETP 原文',jeter)+' · '+web('SUNY 待核索引来源',suny));
note(such,'- 院系／机构：',web('Stony Brook ECE 原档',sbu)+'核同一位半导体方向教师。');
note(such,'- 研究方向：',web('Stony Brook ECE 教师研究原档',sbu)+'核低维半导体光谱和纳米光电子。');
changeRow(such,'Ioffe 1998 博士；P. S. Kop’ev（低可信候选，论文签署待核）','Ioffe／MPI Stuttgart 后续研究线索，博士后任命及导师待核',web('Stony Brook 博士记录',guide)+' · '+web('Ioffe 原论文',paper)+' · '+web('JETP 原文',jeter));
const sa=audit(such,{phd:['group_or_candidate',sProof,[guide,paper,rus]],postdoc:['unresolved',sLate,[jeter,suny]],affiliation:['confirmed','Stony Brook ECE 原目录核 Sergey Suchalkin 的现存校属教师记录。',[sbu]],research:['confirmed','Stony Brook ECE 原目录核窄带隙半导体纳米结构与中远红外光谱器件。',[sbu]]},'找 1998 Ioffe 学位原件或答辩公告，核博士导师签署；寻找毕业后 Ioffe／MPI Stuttgart 的原任命。');
relation(such,'phd',k,'candidate',sProof,[guide,paper,rus],sa);

const hist='https://aiichironakano.github.io/phys516/Battimelli-ComputerMeetsPhysics-Springer20.pdf', cv='https://cbe.princeton.edu/sites/g/files/toruqf1386/files/documents/panagiotopoulos_cv_0.pdf', pri='https://cbe.princeton.edu/people/athanassios-panagiotopoulos', acs='https://pubs.acs.org/doi/10.1021/acs.jpcb.5c06656';
const rProof='研究史第 151 页引本人称 Bob Reid 为其导师，第 149 页把所指关联到 MIT 博士期间；本人 2026 CV 核 1986 MIT 化工博士。第二导师 Suter 的既有自传证据保留，ACS 原页本轮 403。';
const post='本人 2026 CV 核 Oxford Physical Chemistry Laboratory 1986–1987 博后。研究史引本人 2018 访谈说明 Gubbins 提供机会，最终在 Oxford 独立研究，Rowlinson 是名义接收教师。正式指导未具名。';
enrich(pan,'phd',rid,'博士生',web('本人访谈研究史',hist+'#page=151')+' · '+web('2026 本人 CV',cv)+'。'+rProof);
note(pan,'- 核查边界：',web('2026 本人 CV',cv)+'。'+post);
note(pan,'- 研究方向：',web('Princeton 系原档',pri)+'核流体相平衡、分子模拟和软凝聚态。');
changeRow(pan,null,'Oxford 1986–1987 独立博士后；John Rowlinson 名义接收教师',web('本人 2026 CV',cv)+' · '+web('本人访谈研究史',hist));
const pa=audit(pan,{phd:['confirmed_advisor',rProof,[hist,cv,acs]],postdoc:['unresolved',post,[cv,hist]],affiliation:['confirmed','Princeton 化学与生物工程原教师档及本人 CV 核现任。',[pri,cv]],research:['confirmed','Princeton 教师档核流体相平衡、Monte Carlo、软物质与分子模拟。',[pri]]},'优先核 MIT 论文签署及 Suter 第二导师的本人自传可访问版本，Oxford 岗位原任命仍待查。');
relation(pan,'phd',rid,'advisor',rProof,[hist,cv,acs],pa);

const cat='https://www.catalog.caltech.edu/current/trustees-administration-faculty/officers-and-faculty/', cal='https://thesis.caltech.edu/9832/';
const cProof='Caltech 当前教师目录列 2011 博士及同年起本校助理教授，2017 起教授，2022 起 工程与应用科学学部副主任；所阅未单列博士后岗位。';
note(min,'- 核查边界：',web('Caltech 原教师目录',cat)+'。'+cProof+' '+web('Caltech 论文档案',cal)+'列 Minnich 指导 Chengyun Hua，属于反向关系资料。');
note(min,'- 院系／机构：',web('Caltech 原教师目录',cat)+'核机械工程、应用物理教授。');
changeRow(min,null,'2011 博士毕业同年任教；现有原履历未单列博士后',web('Caltech 教师目录',cat));
audit(min,{postdoc:['no_postdoc_documented',cProof,[cat]],affiliation:['confirmed','Caltech 当前教师档核机械工程及应用物理教授，兼 工程与应用科学学部副主任。',[cat]]},'核 2011 学位与 Caltech 起聘月份之间是否有独立短期岗位；MIT 原学位导师记录保留。');

const az='https://appliedmath.arizona.edu/person/m-gregory-forest', unc='https://forest.web.unc.edu/';
const mProof='Arizona 授位项目本人档明确列 Advisor: David McLaughlin。';
const fProof='Arizona 授位项目本人档明确列 Co-Advisor: Hermann Flaschka。';
note(forest,'- 核查边界：',web('Arizona 学位项目原档',az)+'明列论文《Multiple Phase Averaging of Periodic Soliton Equations》。UNC 旧 CV 工具不可读，博士后职位及导师仍待核。');
note(forest,'- 院系／机构：',web('UNC 本人实验室原档',unc)+'交叉核数学、应用物理科学与生物医学工程。');
changeRow(forest,null,null,web('Arizona 论文和导师原档',az));
const fa=audit(forest,{phd:['confirmed_advisor',mProof+' '+fProof+' 档案另列博士论文题名。',[az]],postdoc:['unresolved','UNC 历史 CV 本轮不可读，Arizona 毕业生本人档未列博后。',[az,unc]]},'寻找 UNC 其他本人 CV 版本或早期教职记录核毕业后岗位。');
relation(forest,'phd',mc,'advisor',mProof,[az],fa);
relation(forest,'phd',fl,'advisor',fProof,[az],fa);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_博士档案与博后分段';
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
