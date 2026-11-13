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
 a.audit_id='20261110_'+id+'_industrial_postdoc_0955';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_industrial_postdoc_0955_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const q='9946ebed', mitzi=local('b4ea6398'), rogers='师承人物 - John A. Rogers';
const sal='94c62b5f', datta=local('5d54f243');
const gros='9802f45e', steel='9462a2bb', tak='870b3aae';
const cv='https://qingcaolab.matse.illinois.edu/files/2018/10/CV_QingCao.pdf';
const cen='https://cen.acs.org/articles/90/i37/Finding-Chemistry-Postdoc-Position-Industry.html';
const mcv='https://www.choise-efrc.org/scientists/curricula-vitae';
const paper='https://qingcaolab.matse.illinois.edu/files/2018/08/Se_defects_AEM_2011.pdf';
const sD='https://docs.lib.purdue.edu/dissertations/AAI3307412/';
const sC='https://ptacts.uspto.gov/ptacts/public-informations/petitions/1558475/download-documents?artifactId=735o0B9PdTnWG5-7SONOJZ3Swr_o2wKWwTxNAwvnLdQrLjN2F6fDPIE';
const sA='https://meetings-archive.aps.org/mar/2008/d32/';
const sI='https://resourcecenter.eds.ieee.org/education/podcasts/eds_edu_pod_salahuddin_051926';
const sB='https://vcresearch.berkeley.edu/faculty/sayeef-salahuddin';
const gC='https://www.college-de-france.fr/sites/default/files/media/document/2023-12/Alexander%20Grosberg%20CV.pdf';
const dR='https://regents.umich.edu/files/meetings/05-23/2023-05-VI-Steel.pdf';
const dP='https://lsa.umich.edu/physics/people/emeritus/dst.html';
const tG='https://faculty.engineering.ucdavis.edu/takamura/publications/';

const qPh='本人实验室 CV 第 1 页明列 2009 年 1 月 Illinois 材料化学博士，Advisor: Prof. John A. Rogers，补足已有本人作者简介与 Rogers 的原证。';
enrich(q,'phd',rogers,'博士生',web('本人实验室 CV 第 1 页',cv)+'。'+qPh);
const qE='Cao 本人实验室 CV 第 1 页及 2012 年本人访谈分别列 IBM Watson 2009-02–2011-11 Postdoctoral Scientist，2011-11 转任 Research Staff Member。Cao 博后做 CIGS；Mitzi 履历列 2009–2014 在 IBM Watson 主持 CIGS 合作项目，同期原论文有同单位合著。个人指导职衔未见，仅保留低可信候选。';
const qP=[web('本人实验室 CV',cv),web('本人同期访谈',cen),web('Mitzi 项目履历',mcv),web('2011 年 IBM 原论文',paper)].join(' · ')+'。'+qE;
addEdge(q,'博士后导师候选',mitzi,'David B. Mitzi',qP,null,true);
inverse(q,mitzi,'博士后候选研究者',qP);
editLine(fn(local(q)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+qP);
note(q,'- 任期补证：','该版本的 Research Staff Member 统列起点与实验室 CV 的分段不同；本人 2012 年访谈明确 2011 年 11 月博后结束后转为 Research Staff Member。');
changeRow(q,'John A. Rogers（博士导师；本人 CV 明列）','IBM Watson 博后 2009-02–2011-11；David B. Mitzi（低可信候选）',web('本人实验室 CV',cv)+' · '+web('本人同期访谈',cen)+' · '+web('Mitzi 项目履历',mcv));
const qa=audit(q,{phd:['confirmed_advisor',qPh,[cv]],postdoc:['group_or_candidate',qE,[cv,cen,mcv,paper]]},'查 IBM 2009–2011 年博后聘任或带教原档，保留两个 CV 版本对技术岗起点的差异。');
relation(q,'phd',rogers,'advisor',qPh,[cv],qa,false);
relation(q,'postdoc',mitzi,'candidate',qE,[cv,cen,mcv,paper],qa);

const sPh='Purdue 博士馆藏 Advisors 栏写 Datta；IEEE EDS 本人访谈原页说明博士阶段在 Supriyo Datta 指导下。';
enrich(sal,'phd',datta,'博士生',web('IEEE EDS 本人访谈',sI)+'。'+sPh);
const sE='Salahuddin 本人 2025 CV 第 1 页分列 2007-12 Purdue 博士、2008 年 Purdue Post-doctoral research associate 与同年开始 Berkeley 教职。2008 年 3 月 APS 会议原档列本人及其博士导师 Supriyo Datta 同作 Purdue 自旋输运研究，个人博后指导者未明，列低可信候选。';
const sProof=web('本人 CV 第 1 页',sC)+' · '+web('2008 APS 会议原档',sA)+'。'+sE;
addEdge(sal,'博士后导师候选',datta,'Supriyo Datta',sProof,null,true);
inverse(sal,datta,'博士后候选研究者',sProof);
editLine(fn(local(sal)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+sProof);
changeRow(sal,'Supriyo Datta（博士导师）','Purdue 2008 年博后；Supriyo Datta（低可信候选）',web('Purdue 学位档',sD)+' · '+web('本人 CV 第 1 页',sC)+' · '+web('2008 APS 会议原档',sA));
const sa=audit(sal,{phd:['confirmed_advisor',sPh,[sD,sI]],postdoc:['group_or_candidate',sE,[sC,sA]],affiliation:['confirmed','Berkeley Research 原档与 2025 本人 CV 核 EECS 任职；既有材料任职信息保留。',[sB,sC]],research:['confirmed','Berkeley Research 原档核低功耗器件物理、自旋电子学和铁电负电容。',[sB]]},'查 Purdue 2008 年博后任命与研究组当年档案，区分博士指导与博士后指导。');
relation(sal,'phd',datta,'advisor',sPh,[sD,sI],sa,false);
relation(sal,'postdoc',datta,'candidate',sE,[sC,sA],sa);

const gE='本人 CV 第 1 页明列 1975 年 Ph.D. 的 Supervisor 为 Ilya Lifshitz。1972–1999 任俄罗斯科学院化学物理研究所研究员至分组负责人，履历未分列独立博士后任命。';
note(gros,'- 核查边界：',web('本人 CV 任职栏',gC)+'。'+gE);
changeRow(gros,'Ilya M. Lifshitz（博士导师；本人 CV 明列 Supervisor）','1972–1999 化学物理研究所研究职位；所阅履历未分列独立博士后',web('本人 CV',gC));
const ga=audit(gros,{phd:['confirmed_advisor',gE,[gC]],postdoc:['no_postdoc_documented',gE,[gC]]},'如有俄罗斯科学院早期任命档，可补核 1975 博士毕业前后的实际岗位与阶段指导。');
relation(gros,'phd','师承人物 - Ilya M. Lifshitz','advisor',gE,[gC],ga,false);

const dE='Michigan 校董会正式退休档列 1975–1985 Hughes Research Laboratories 技术人员、1976 博士、1985 Michigan 教职；所阅任职表未分列独立博士后。物理系荣休原档与校董会原档核物理及 EECS 任职、量子光学与半导体相干控制。两名博士候选保留，CUOS 退休报道直接读取失败。';
note(steel,'- Hughes 任职：',web('物理系荣休原档',dP)+'。'+dE);
changeRow(steel,null,'Hughes 1975–1985 技术岗位；所阅履历未分列独立博士后',web('物理系荣休原档',dP));
audit(steel,{postdoc:['no_postdoc_documented',dE,[dR,dP]],affiliation:['confirmed',dE,[dR,dP]],research:['confirmed',dE,[dR,dP]]},'沿原校目录、原始学位页或可访问的原校访谈正文查核两位博士导师候选。');

const tE='Takamura 实验室本人书目列 2002 年硅掺杂原论文作者 Takamura、Griffin 与 Plummer；2003 年原 PDF 此次返回 502，Stanford Plummer 原始发表档仍可核该文作者。二人维持博士候选。';
const tP=web('本人实验室同期发表目录',tG)+'。'+tE;
const tCand=path.join(root,'师承候选线索索引.md');
const tMentors=[local('88655d8b'),'师承人物 - Peter B. Griffin'];
for(const target of tMentors){
 editLine(fn(local(tak)),l=>l.startsWith('- 博士导师候选：')&&l.includes('[['+target+'|'),l=>l+' '+tP);
 mentorLine(target,tak,'- 博士候选研究者：',tP);
 editLine(tCand,l=>l.startsWith('- [['+local(tak)+'|')&&l.includes('[['+target+'|'),l=>l+' '+tP);
}
changeRow(tak,null,null,web('本人实验室同期发表目录',tG));
const tA=audit(tak,{phd:['group_or_candidate',tE,[tG]]},'查 Stanford 博士档签署页，并分辨 Plummer、Griffin 的角色与 CV 所列博后日期。');
for(const target of tMentors)relation(tak,'phd',target,'candidate',tE,[tG,'https://profiles.stanford.edu/jim-plummer?tab=publications'],tA,false);


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Cao及Salahuddin博后原证';
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
