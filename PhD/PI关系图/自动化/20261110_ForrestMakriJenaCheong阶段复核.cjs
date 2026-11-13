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
 a.audit_id='20261110_'+id+'_forrest_makri_jena_cheong_1047';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_forrest_makri_jena_cheong_1047_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const f='55b7c653', m='dfca11b5', j='dea9d7f4', ch='8b27ad0d', at='e118c47d', t='e0a4cfb5';
const fZ='https://ericzorn.com/2026/03/21/jens-c-zorn-celebration-of-life/';
const fU='https://lsa.umich.edu/appliedphysics/people/faculty/stevefor.html';
const fE='Forrest 本人署名纪念讲话在 Michigan 研究生经历中称 Mike Sanders 为自己的 advisor，Michigan 校档核 1979 年物理博士并列 Bell Labs 技术研究。其他 Michigan 纪念报道原页本轮未读取，论文签署页与正式角色待独立确认。';
const fP=web('Michigan 应用物理原档',fU)+'。'+fE;
note(f,'- 博士阶段导师：',fP);
mentorLine('师承人物 - T. Michael Sanders',f,'- 博士阶段研究者：',fP);
indexLine(f,'师承人物 - T. Michael Sanders','博士阶段导师',fP);
changeRow(f,null,'Bell Labs 技术研究岗位；所阅校档未列独立博后',web('Michigan 应用物理原档',fU));
const fa=audit(f,{phd:['group_or_candidate',fE,[fZ,fU]],postdoc:['no_postdoc_documented','Michigan 应用物理官方履历列 1979 年物理博士，Bell Labs 光探测技术研究，1985 转 USC 教职，所阅未列独立博士后。',[fU]],affiliation:['confirmed','Michigan 应用物理档核 EECS、材料、物理相关教研任职。',[fU]],research:['confirmed','Michigan 原档核有机半导体、光电子、光探测和光伏方向。',[fU]]},'核 1979 年 Michigan 论文签署页或可直接读取的校方引语，区分博士研究指导与论文导师称谓。');
relation(f,'phd','师承人物 - T. Michael Sanders','stage_mentor',fE,[fZ,fU],fa,false);

const mC='https://makri.scs.illinois.edu/wp-content/uploads/2021/02/Makri-CV-short-2021.pdf';
const mT='https://escholarship.org/content/qt8bm12450/qt8bm12450.pdf';
const mF='https://socfell.fas.harvard.edu/past-junior-fellows-chemistry';
const mE='Illinois 托管 2021 CV 第 1 页分列 Harvard Junior Fellow（1989–1991）和 1990 夏 AT&T Bell Labs Visiting Scientist；Harvard 名录 1989–1992 的差异保留。学位论文报告 LBL-27938 封面核 Berkeley 1989 博士题名，签署页未核，Miller 仍列博士阶段研究师长。';
note(m,'- 核查边界：',web('本人 2021 CV 第 1 页',mC)+' · '+web('LBL 论文封面',mT)+'。'+mE);
changeRow(m,null,'Harvard Junior Fellow，导师与结束日期待核；1990 夏 Bell Labs Visiting Scientist 单列',web('本人 2021 CV',mC));
audit(m,{postdoc:['unresolved',mE,[mC,mF]],affiliation:['confirmed','本人 Illinois CV 列化学、物理任职。',[mC]]},'eScholarship 主机退避到期后查论文前置页和致谢，另查 Harvard 任期记录和 Bell Labs 短访接待组，区分两阶段。');

const jU='https://www.duffield.cornell.edu/people/debdeep-jena/';
const jN='https://archives.nd.edu/ndr/NDR-33/NDR-2003-09-26.pdf';
const jM='https://my.ece.ucsb.edu/Mishra/biography.htm';
const jE='Cornell 教师原档明确 ECE 与材料系双聘，并列应用与工程物理研究生领域成员；列 UCSB 2003 博士及同年 8 月 Notre Dame 入职。Notre Dame 2003 年档案列其 8 月提案，所阅履历未分列独立博士后。';
const jD='已核实单位 - Cornell - 应用与工程物理学院';
editLine(fn(local(j)),l=>l.startsWith('- 院系／机构：'),l=>l.slice(0,-1)+' · [['+jD+'|应用与工程物理（研究生领域成员）]]。');
const jfile=path.join(root,'已核实院系',jD+'.md'), jbody=fs.readFileSync(jfile,'utf8'), jnl=jbody.includes('\r\n')?'\r\n':'\n';
if(jbody.includes('[['+local(j)+'|'))throw Error('existing AEP inverse link');
graph.set(jfile,jbody.trimEnd()+jnl+'- [['+local(j)+'|Debdeep Jena]]（研究生领域成员） — '+web('Cornell 教师原档',jU)+jnl);
note(j,'- 核查边界：',web('Cornell 教师原档',jU)+' · '+web('Notre Dame 同期校档',jN)+'。'+jE);
const jr=records.get(j);
editLine(path.join(root,jr.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+jr.filename+'|'),l=>l.replace('材料科学与工程系；','材料科学与工程系、应用与工程物理（研究生领域成员）；'));
changeRow(j,null,'2003-08 入 Notre Dame 教职；所阅履历未分列独立博士后',web('Cornell 教师原档',jU)+' · '+web('Notre Dame 同期校档',jN));
audit(j,{postdoc:['no_postdoc_documented',jE,[jU,jN]],affiliation:['confirmed',jE,[jU]],research:['confirmed','Cornell 原档核半导体器件与二维电子、光子和量子材料研究。',[jU]]},'本人博士论文的原有证据保留；如有毕业至 2003-08 入职之间的具体聘任档，再查是否存在短期独立博后。');

const cV='https://rcem.rutgers.edu/images/People/Cheong_CV_5_2010.pdf';
const cG='https://www.pa.ucla.edu/faculty-websites/gruner_publications.pdf';
const cP='https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.66.104';
const cB='https://history.aip.org/catalog/icos/46801.html';
const gr=local('f45bcfeb'), ba='师承人物 - Bertram Batlogg';
const cD='Rutgers 托管本人 CV 核 UCLA 1989 物理博士；Grüner 的 UCLA 原始书目列两人在 1980 年代末的同主题合作，结合既有学术谱系线索，保留低可信博士导师候选。';
const cE='本人 CV 列 AT&T Bell Labs 1989–1991 Postdoctoral Member，1991 年转 Member of Technical Staff。1991 年 APS 原始论文中 Cheong 与 Bertram Batlogg 均列 Bell Labs，AIP 口述史档核 Batlogg 的 Bell Labs 科研和管理经历。仅作低可信博士后候选。';
const cDP=web('本人 Rutgers CV',cV)+' · '+web('Grüner 的 UCLA 书目',cG)+'。'+cD;
const cEP=web('本人 Rutgers CV',cV)+' · '+web('1991 APS 原文',cP)+' · '+web('AIP 口述史档',cB)+'。'+cE;
addEdge(ch,'博士导师候选',gr,'George Grüner',cDP,null,true);
inverse(ch,gr,'博士候选研究者',cDP);
addEdge(ch,'博士后导师候选',ba,'Bertram Batlogg',cEP,null,true);
newMentor(ba,'Bertram Batlogg','ETH Zürich 荣休，曾在 Bell Labs 从事固态物理和超导研究。'+web('AIP 口述史档',cB)+'。',ch,'博士后候选研究者',cEP);
note(ch,'- 核查边界：',cEP);
changeRow(ch,'George Grüner（低可信候选）','AT&T Bell Labs 1989–1991 博后；Bertram Batlogg（低可信候选）',web('本人 Rutgers CV',cV)+' · '+web('UCLA 书目',cG)+' · '+web('1991 APS 原文',cP));
const cA=audit(ch,{phd:['group_or_candidate',cD,[cV,cG]],postdoc:['group_or_candidate',cE,[cV,cP,cB]]},'查 UCLA 博士原档与 Bell Labs 当年博后任命、部门或个人指导证明，勿以同期合著确证。');
relation(ch,'phd',gr,'candidate',cD,[cV,cG],cA);
relation(ch,'postdoc',ba,'candidate',cE,[cV,cP,cB],cA);

const aU='https://atwater.caltech.edu/team-member/harry-atwater?back_url=%2Fteam-member';
const aE='Caltech 本人课题组原档明列 Harvard 1987–1988 IBM Postdoctoral Fellowship 及自 1988 年 Caltech 教职，未指名个人指导。';
note(at,'- 核查边界：',web('本人 Caltech 课题组履历',aU)+'。'+aE);
changeRow(at,null,'Harvard 1987–1988 IBM 博士后 fellowship，个人指导待核',web('本人 Caltech 课题组履历',aU));
audit(at,{postdoc:['unresolved',aE,[aU]],affiliation:['confirmed','本人 Caltech 课题组原档核应用物理和材料科学双领域任职。',[aU]],research:['confirmed','本人 Caltech 课题组原档核量子纳米光子、二维材料、超表面及光伏。',[aU]]},'查 Harvard 1987–1988 IBM fellowship 资助或聘任档；Zahler 博士论文系 Atwater 指导别人的反向证据。');

const tU='https://www.cambridge.org/core/journals/mrs-bulletin/article/troliermckinstry-leads-mrs-board-of-directors-for-2017/03A05F2C774C06EE9D2218E7AA75C52F';
const tE='MRS 原始人物档列 1992 Penn State 陶瓷科学博士并自该年任该校教职，所阅未分列独立博士后。陶瓷科学与工程、电气工程任职和铁电／压电薄膜方向同见该档。';
note(t,'- 核查边界：',web('MRS 人物档原文',tU)+'。'+tE);
changeRow(t,null,'1992 年 Penn State 博士及同年教职；所阅未分列独立博士后',web('MRS 人物档原文',tU));
audit(t,{postdoc:['no_postdoc_documented',tE,[tU]],affiliation:['confirmed',tE,[tU]],research:['confirmed',tE,[tU]]},'核 1992 年博士至入职是否有单独短期岗位；既有 Newnham 博士指导依据保留。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_ForrestMakriJenaCheong阶段复核';
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
