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
 a.audit_id='20261110_'+id+'_pelz_and_industry_1533';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_pelz_and_industry_1533_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const s=JSON.parse(fs.readFileSync('20261110_1533_博士论文与工业博后原页回执.json','utf8'));
const url=(id,fragment)=>s.find(x=>x.record_id===id&&x.url.includes(fragment)).url;
const link=(label,u)=>web(label,u);
const p='12daaa82',y='12745a88',w='8d3bba96',k='cb695ed3';
const pelDept='https://physics.osu.edu/people/pelz.2', dis=url(p,'escholarship'), news=url(p,'news.osu'), ibm=url(p,'research.ibm.com/publications/tip');
const cl='人员 - UC Berkeley - John Clarke - 1c042385', ko='师承人物 - R. H. Koch（IBM）';
const pd='Berkeley 论文 LBL-24568 题名页列 Jonathan Philipps Pelz、1987 年 12 月和 Flicker (1/f) Noise in Copper Films due to Radiation-Induced Defects。致谢明确称 John Clarke 为 research advisor。';
const pdSource=link('Berkeley 论文致谢',dis+'#page=7');
const pe='Ohio State 校方报道确认 IBM 博士后聘任，并于 1990 年 9 月加入 Ohio State。IBM 出版原档列 1990 年同期论文作者 J. P. Pelz 与 R. H. Koch，作为低可信指导候选。具名指导及准确聘期仍待查。';
const peSource=link('Ohio State 校方报道',news)+' · '+link('IBM 出版原档',ibm);
const pFile=fn(local(p));
const select=(file,start,target,edit)=>editLine(file,l=>l.startsWith(start)&&l.includes('[['+target+'|'),edit);
select(pFile,'- 博士导师候选',cl,()=>'- 博士导师：[['+cl+'|John Clarke]]。'+pd+' '+pdSource);
select(fn(cl),'- 博士导师候选关联者',local(p),()=>'- 博士生：[['+local(p)+'|Jonathan Pelz]]。'+pd+' '+pdSource);
select(idx,'- [['+local(p)+'|',cl,l=>l.split(' → ')[0]+' → 博士导师：[['+cl+'|John Clarke]]。'+pd+' '+pdSource);
editLine(pFile,l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+pd+' 同系凝聚态目录的 1988 条目与论文日期分开留存。 '+pdSource+' · '+link('同系凝聚态实验目录','https://physics.osu.edu/research/condensed-matter/condensed-matter-experiment')+' '+pe+' '+peSource);
const kl='[['+ko+'|R. H. Koch]]';
editLine(pFile,l=>l.startsWith('- 核查边界：'),l=>'- 博士后导师候选：'+kl+'。'+pe+' 关系类型可信度：低。 '+peSource+'\n'+l);
if(fs.existsSync(fn(ko)))throw Error('Koch 节点已存在，需核对');
graph.set(fn(ko),'# R. H. Koch（IBM）\n\nIBM 原始出版档的作者名为 R. H. Koch。\n\n## 师承\n\n- 博士后导师候选关联者（低可信）：[['+local(p)+'|Jonathan Pelz]]。'+pe+' '+peSource+'\n');
select(idx,'- [['+local(p)+'|',cl,l=>l+'\n- [['+local(p)+'|Jonathan Pelz]] → 博士后导师候选：'+kl+'。'+pe+' '+peSource);
changeRow(p,'John Clarke（明确博士导师，Berkeley 1987 年论文致谢）','IBM 博士后已确认；R. H. Koch（低可信导师候选）',pdSource+' · '+peSource);
const ap=audit(p,{identity:['confirmed',pd,[dis,pelDept]],affiliation:['confirmed','Ohio State 物理系荣休教授。',[pelDept,news]],research:['confirmed','校方档案核凝聚态实验、扫描隧道显微及半导体界面。',[pelDept,news]],phd:['confirmed_advisor',pd,[dis]],postdoc:['group_or_candidate',pe,[news,ibm]]},'沿 IBM 旧研究组名录、任用记录或本人材料核 Koch 候选和准确聘期。');
relation(p,'phd',cl,'advisor',pd,[dis],ap,false);relation(p,'postdoc',ko,'candidate',pe,[news,ibm],ap,false);

const cv=url(y,'CV.pdf'), pref=url(y,'morawa.at'), eng=url(y,'engineering.princeton'), cow='师承人物 - John M. Cowley', and='已核实单位 - Princeton - Andlinger Center for Energy and the Environment';
const yp='本人合编原书题献和署名前言将 Cowley 称为研究生阶段的 advisor。本人 CV 列 1990 年 Arizona State 应用物理与电子显微博士，以及此前 Idaho State 物理硕士。据时间与研究方向记 Cowley 为博士阶段研究师长，正式论文导师字段待核。';
const ypSrc=link('原书题献与前言',pref)+' · '+link('本人 CV',cv);
const ypd='本人 CV 分列 1990–1991 Shell Visiting Staff Scientist 和 1991–1993 ExxonMobil Post-doctoral Fellow。博后指导者未列。';
const ya='Princeton 材料所实践教授、成像分析中心主任，Andlinger Center Associated Faculty。';
const yy='中山大学同名人是 2002 Kobe 植物病理学博士，与本人 CV 所列 ASU 1990 电子显微博士不同。';
const yyurl='https://lifesciences.sysu.edu.cn/en/teacher/1570';
select(fn(local(y)),'- 博士阶段研究师长候选',cow,()=>'- 博士阶段研究师长：[['+cow+'|John M. Cowley]]。'+yp+' 关系类型可信度：高。 '+ypSrc);
select(fn(cow),'- 博士阶段受指导者候选',local(y),()=>'- 博士阶段受指导者：[['+local(y)+'|Nan Yao]]。'+yp+' '+ypSrc);
select(idx,'- [['+local(y)+'|',cow,l=>l.split(' → ')[0]+' → 博士阶段研究师长：[['+cow+'|John M. Cowley]]。'+yp+' '+ypSrc);
note(y,'- 院系／机构：','[['+and+'|Andlinger Center]]（Associated Faculty）。 '+link('本人 CV',cv));
editLine(path.join(root,'已核实院系',and+'.md'),l=>l.startsWith('- [[人员 - Princeton - Barry P. Rand '),l=>l+'\n- [['+local(y)+'|Nan Yao]] — Associated Faculty。 '+link('本人 CV',cv));
note(y,'- 核查边界：',ypd+' '+yy+' '+ypSrc+' · '+link('中山大学同名原档',yyurl));
changeRow(y,'John M. Cowley（博士阶段研究师长，论文导师字段待核）','ExxonMobil 1991–1993 博后；指导者待核',ypSrc+' · '+link('工程学院档',eng));
editLine(path.join(root,'Princeton逐人复核记录.md'),l=>l.startsWith('| [['+local(y)+'|'),l=>l.replace('Princeton Materials Institute；','Princeton Materials Institute、Andlinger Center（关联教师）；'));
const ay=audit(y,{identity:['confirmed',yy,[cv,eng,yyurl]],affiliation:['confirmed',ya,[cv,eng]],research:['confirmed','工程学院教师档核先进成像、衍射、光谱与纳米材料表征。',[eng]],phd:['group_or_candidate',yp,[pref,cv]],postdoc:['unresolved',ypd,[cv]]},'追 Arizona State 1990 博士论文签署页，以及 ExxonMobil 项目、任用和具名指导。');
relation(y,'phd',cow,'stage_mentor',yp,[pref,cv],ay,false);

const ucsb=url(w,'materials.ucsb'), cal=url(w,'caltech.edu'), nw=url(w,'northwestern');
const wp='UCSB 材料系讲座原件列 Chicago 博士时与 Stuart Rice、Karl Freed 共事。Caltech 和 Northwestern 原档给出 1987 博士年份。正式论文导师字段待查。';
const wpd='UCSB 讲座原件列先赴 Exxon Research and Engineering 任博后，与 Samuel Safran、Thomas Witten 共事，再赴 UCLA 与 William Gelbart 共事。Northwestern 讲座档独立确认机构顺序。三人维持博后阶段研究合作者标签。';
const wLinks=link('UCSB 材料系原件',ucsb)+' · '+link('Northwestern 讲座档',nw);
const wpPeople=['师承人物 - Stuart A. Rice','师承人物 - Karl F. Freed'], wpdPeople=['师承人物 - Samuel A. Safran','人员 - University of Chicago - Thomas Witten - bd42a1b1','师承人物 - William M. Gelbart'];
for(const [stage,people] of [['phd',wpPeople],['postdoc',wpdPeople]]) {
 const proof=stage==='phd'?wp:wpd;
 for(const person of people){
  select(fn(local(w)),stage==='phd'?'- 博士研究师长：':'- 博士后研究合作者：',person,l=>l+' '+proof+' '+wLinks);
  select(fn(person),stage==='phd'?'- 博士阶段研究者：':'- 博士后研究合作者：',local(w),l=>l+' '+proof+' '+wLinks);
  select(idx,'- [['+local(w)+'|',person,l=>l+' '+proof+' '+wLinks);
 }
}
changeRow(w,null,'Exxon 博后与 Safran、Witten 合作；UCLA 博后与 Gelbart 合作',wLinks+' · '+link('Caltech 原档',cal));
note(w,'- 核查边界：',wp+' '+wpd+' '+wLinks);
const aw=audit(w,{identity:['confirmed','Caltech 原档核 1987 Chicago 博士、1991 起任 Caltech 教职。',[cal,nw]],affiliation:['confirmed','Caltech 化学工程讲席教授。',[cal]],research:['confirmed','Caltech 研究简介核聚合物、液晶与凝胶的相变、动力学及界面统计物理。',[cal]],phd:['group_or_candidate',wp,[ucsb,cal,nw]],postdoc:['group_or_candidate',wpd,[ucsb,nw]]},'查 Chicago 学位论文签署原件以及 Exxon、UCLA 两段博后的任用或正式指导。');
for(const person of wpPeople)relation(w,'phd',person,'stage_mentor',wp,[ucsb,cal,nw],aw,false);

const tech=url(k,'these-search'), av=url(k,'breakdown.pdf');
const kp='Technion 研究生院原档提供按作者、导师或题目查询的入口，本次未取得 Klich 的论文条目。Avron 与 Kons 1999 年论文致谢提及与 I Klich 的学术讨论，该出处作为寻访线索保留。';
const kLinks=link('Technion 论文检索',tech)+' · '+link('Avron 与 Kons 论文',av);
note(k,'- 博士阶段档案补证（2026-11-09）：',kp+' '+kLinks);
changeRow(k,'Technion 2004 博士；已核资格考试委员会线索，正式导师待核',null,kLinks);
audit(k,{phd:['unresolved',kp+' 既有 2001 资格考试委员会成员 Brustein 证据保留。',[tech,av]]},'用 Technion 学位库按作者查书目和导师，查 Caltech 2004–2007 奖学金或个人指导名录。');
if(process.argv[2]==='apply')fs.writeFileSync('20261110_中山NanYao同名排除回执.json',JSON.stringify([{page_id:'333755bfb681ca33cddf8a96',url:yyurl,record_id:y,audit_id:ay,external_subject:'Nan Yao（中山大学生命科学学院植物病理学研究者）',evidence:yy}],null,2)+'\n','utf8');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Pelz与跨院系履历复核';
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

