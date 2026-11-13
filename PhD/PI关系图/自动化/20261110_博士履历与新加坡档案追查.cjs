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
 a.audit_id='20261110_'+id+'_unsw_woodward_1723';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_unsw_woodward_1723_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const b='1e1256ac', w='1ed7deb5', u='9e0468d5', c='d6a628af', h='db3c5103', d='1845d91a', n='b95ea150';
const links=(...pairs)=>pairs.map(([label,url])=>' '+web(label,url)).join('');
const wl=(target,label)=>'[['+target+'|'+label+']]';
const wf='https://neutronscattering.org/wp-content/uploads/2014/12/CV_NSSA-elections_woodward.pdf', wo='https://chemistry.osu.edu/people/woodward.55', wa='https://doczz.net/doc/6715755/chemistry-alumni-news---department-of-chemistry', wd='师承人物 - Arthur Sleight', cx='师承人物 - Dave Cox';
const we='Woodward 本人 CV 的 1991–1996 Oregon State 化学研究助理条目明确列 Advisor Arthur Sleight，同段完成化学博士。Ohio State 系档核在 Sleight 指导的固态化学研究与 1996 年博士；Oregon State 校友刊的 Pat Woodward 条目在括号内列 A. Sleight、年份作 1997。年份差异留存。';
const wp='本人 CV 将 1996–1998 Brookhaven 物理博士后 Supervisor 写作 David Cox，Ohio State 系档也写由 Dave Cox 指导。';
const wsrc=links(['本人 CV',wf],['Ohio State 系档',wo],['Oregon State 校友刊镜像',wa]);
replaceNoteLabel(d,'博士阶段研究师长','博士导师',wd,' '+we+wsrc);
replaceInverseLabel(wd,d,'博士阶段研究者','博士生',' '+we+wsrc);
replaceIndexLabel(d,wd,'博士阶段研究师长','博士导师',' '+we+wsrc);
editLine(fn(local(d)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+we+' 学位原件待查。'+wsrc);
note(d,'- 博士后导师：',wp+links(['本人 CV',wf]));
mentorLine(cx,d,'- 博士后研究者：',wp+links(['本人 CV',wf]));
indexLine(d,cx,'博士后导师',wp+links(['本人 CV',wf]));
changeRow(d,'Arthur Sleight（博士导师）',null,web('本人 CV',wf)+links(['Oregon State 校友刊镜像',wa]));
const di=audit(d,{phd:['confirmed_advisor',we,[wf,wo,wa]],postdoc:['confirmed_advisor',wp,[wf,wo]]},'保留本人及现职档的 1996 与校友刊的 1997 两种记法，继续查 Oregon State 学位原件。');
relation(d,'phd',wd,'advisor',we,[wf,wo,wa],di,false);
relation(d,'postdoc',cx,'advisor',wp,[wf,wo],di,false);

const nc='https://www.chem.fsu.edu/~nienhaus/CV%20Nienhaus.pdf', nr='https://profiles.rice.edu/faculty/lea-nienhaus';
const nd='本人 CV 将 2010–2015 UIUC 物理化学博士的两位 Advisors 分列为化学系 Martin Gruebele 与电气工程 Joseph W. Lyding，博士题目是利用扫描隧道显微术进行室温单分子光吸收光谱。Rice 原档另具名 Gruebele。';
const np='本人 CV 的 MIT 2015–2018 博后条目明确列 Advisor Moungi G. Bawendi；Rice 现职档也写毕业后加入 Bawendi 组。';
const na='Rice 化学系原档核 2024 自 Florida State 转入，研究为钙钛矿、纳米光学、光子上转换及结合扫描探针与光谱。';
const ni=audit(n,{phd:['confirmed_advisor',nd,[nc,nr]],postdoc:['confirmed_advisor',np,[nc,nr]],research:['confirmed',na,[nr]]},'两阶段已据本人履历核具名导师。后续仅补 UIUC 学位原件及院系名录变更。');
for(const [stage,target,label,back,proof] of [
 ['phd','人员 - UIUC - Martin Gruebele - 21348745','博士导师','博士生',nd],
 ['phd','人员 - UIUC - Joseph W. Lyding - 9bb77673','博士导师','博士生',nd],
 ['postdoc','人员 - MIT - Moungi Bawendi - c8ddd180','博士后导师','博士后研究者',np]]){
 const extra=proof+links(['Rice 原档',nr]);
 editLine(fn(local(n)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+extra);
 mentorLine(target,n,'- '+back+'：',extra);
 indexLine(n,target,label,extra);
 relation(n,stage,target,'advisor',proof,[nc,nr],ni);
}
changeRow(n,null,null,web('本人 CV',nc));

const uq='https://wucj.physics.ucsd.edu/Appl/Wu_cv_0907.pdf', uw='https://wucj.lab.westlake.edu.cn/Appl/Wu_CV_2022_Feb.pdf';
const up='2009 年本人 CV 在 2005–2007 UCSB KITP Postdoctoral Research Associate 条目紧接着列 Supervisors Matthew P. A. Fisher 和 Leon Balents。新版 CV 核阶段和地点，仍以旧版明确称谓为依据。';
const uf='2009 年本人 CV 将 2000–2002 Illinois 的 Advisor Eduardo H. Fradkin 与 2002–2005 Stanford 学位导师 Shou-Cheng Zhang、北大硕士导师苏肇冰分列。Illinois 阶段关系标为研究师长。';
const ui=audit(u,{postdoc:['confirmed_advisor',up,[uq,uw]]},'Stanford 博士和 KITP 两位博后指导已核。补 Stanford 学位原件以及 UCSD 与 Westlake 任用档。');
for(const [stage,target,label,back,kind,proof] of [
 ['phd','人员 - UIUC - Eduardo H. Fradkin - ebda96c0','博士阶段研究师长','博士阶段研究者','stage_mentor',uf],
 ['postdoc','人员 - UC Santa Barbara - Matthew Fisher - e180d959','博士后导师','博士后研究者','advisor',up],
 ['postdoc','人员 - UC Santa Barbara - Leon Balents - 3ea11247','博士后导师','博士后研究者','advisor',up]]){
 const text=proof+links(['2009 本人 CV',uq]);
 editLine(fn(local(u)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+text);
 mentorLine(target,u,'- '+back+'：',text);
 indexLine(u,target,label,text);
 relation(u,stage,target,kind,proof,[uq,uw],ui);
}
changeRow(u,null,null,web('2009 本人 CV 具名 Supervisors',uq));

const bt='https://thesis.caltech.edu/11206/', bc='https://soft-living-matter.syr.edu/bowick-group/wp-content/uploads/sites/4/2015/05/bowick-mark-cv.pdf', bu='https://ift.phys.ufl.edu/ift-visitors/mark-bowick/';
const be='Caltech 学位档把 Pierre Ramond 列为 Research Advisor，Bowick 1983 论文致谢也直接称 my advisor Pierre Ramond。';
const bp='本人 CV 记 1983–1986 Yale Research Associate Physicist，1986–1988 MIT CTP 与 LNS Sponsored Research Staff。Florida IFT 与 KITP 履历称 MIT 阶段为博士后，Yale 为粒子理论组研究任用。本人 CV 中 MIT 最后一年与 Syracuse 1987 起教职重合。两段具名指导及日期口径待查。';
const bm='师承人物 - Pierre Ramond';
note(b,'- 博士导师：',be+links(['Caltech 学位档',bt]));
note(b,'- 核查边界：',bp+links(['本人 CV',bc],['Florida IFT 原档',bu]));
mentorLine(bm,b,'- 博士生：',be);
indexLine(b,bm,'博士导师',be);
changeRow(b,null,'Yale 1983–1986 研究任用；MIT 1986–1988 博后履历，个人指导待查',web('本人 CV',bc)+links(['Florida IFT 原档',bu]));
const bi=audit(b,{phd:['confirmed_advisor',be,[bt]],postdoc:['unresolved',bp,[bc,bu]]},'查 MIT CTP 同期任用和具名指导、Yale 研究岗位具体关系。');
relation(b,'phd',bm,'advisor',be,[bt],bi);

const ct='https://phy.lzu.edu.cn/info/1641/6094.htm', c0='https://www3.ntu.edu.sg/CorpComms2/ntunews/2000/ntunews0400.pdf', ch='https://cde.nus.edu.sg/mse/staff/chen-jingsheng/', ca='https://www.sciengine.com/doi/pdf/AA5104C61074437C96301F59BF4CF3B9';
const ce='兰州大学物理学院 1996 级博士生原始名录在粒子物理与原子核物理专业列陈景升。NUS 教师档及讲座档核 1999 年兰州大学授位。同期作者原稿列陈景升署兰州大学现代物理系，王学军等合作者署华东师大。合著及跨校信息作为追查线索，具名导师待核。';
const cp='NTU 2000 年校刊的入职栏把 Dr Chen Jingsheng 列为 Post Doctoral Fellow；NUS 历史履历核 1999–2001 NTU 电子电器工程学院博后。2001–2007 数据存储研究所为独立任用，博后指导仍待核。';
note(c,'- 博士阶段：',ce+links(['兰大博士生原档',ct],['同期论文原件',ca]));
note(c,'- 博士后阶段：',cp+links(['NTU 2000 校刊',c0]));
changeRow(c,null,null,web('兰大博士生原档',ct)+links(['NTU 校刊',c0]));
audit(c,{phd:['unresolved',ce,[ct,ch,ca]],postdoc:['unresolved',cp,[c0,ch]]},'按 1996 级粒子物理与原子核物理查兰大论文册、联合培养档；按 NTU 2000 校刊查 EEE 具名博后任用。');

const ha='https://research.a-star.edu.sg/researcher/ho-pin/', hh='https://ho-pin.weebly.com/about.html', hp='https://citeseerx.ist.psu.edu/document?doi=7c35cc982ef9a5bedfc727b0978a2184bc540d51&repid=rep1&type=pdf', hm='https://dspace.mit.edu/entities/publication/f09872ae-1d79-4bfc-9e49-63f72de1ff6c';
const he='Ho 本人主页明确 NUS 2013 年答辩与论文题目。2011 IEEE 原刊列 Ho 和 Jingsheng Chen 在同一垂直磁各向异性课题合作，作者单位含 NUS MSE 及 A*STAR DSI，和在读履历吻合。Chen 仍为博士候选，指导名单或论文导师页待核。';
const ht='2015 年 MIT 机构论文档确认 Ho 与 Ross 同期合作，结合本人履历对 Ross Research Group 博后任用的明示，保持课题组负责人。正式 advisor 职衔仍待查。';
const hn='人员 - MIT - Caroline A. Ross - dda4a28b', hj=local(c);
note(h,'- 博士导师候选：',he+links(['本人履历',hh],['2011 IEEE 原刊',hp]));
note(h,'- 博士后课题组负责人：',ht+links(['MIT 论文馆藏',hm]));
mentorLine(hj,h,'- 博士生候选：',he+links(['2011 IEEE 原刊',hp]));
mentorLine(hn,h,'- 博士后课题组成员：',ht+links(['MIT 论文馆藏',hm]));
indexLine(h,hj,'博士导师候选',he+links(['2011 IEEE 原刊',hp]));
indexLine(h,hn,'博士后课题组负责人',ht+links(['MIT 论文馆藏',hm]));
changeRow(h,null,null,web('2011 IEEE 原刊',hp)+links(['MIT 论文馆藏',hm]));
const hi=audit(h,{phd:['group_or_candidate',he,[hh,hp]],postdoc:['group_or_candidate',ht,[ha,hh,hm]]},'查 NUS 2013 论文原件及 Chen 具名指导档；查 MIT 正式指导和离任日期。');
relation(h,'phd',hj,'candidate',he,[hh,hp],hi,false);
relation(h,'postdoc',hn,'group_leader',ht,[ha,hh,hm],hi,false);

const wd0='https://newsroom.unsw.edu.au/sites/default/files/documents/Research_at_UNSW_0809.pdf', ww='https://www.weber-lab.com/group', west='https://science.westlake.edu.cn/en/EVENTS/202102/t20210222_8473.shtml';
const wph='UNSW 同期报告称 Bent Weber 是 CQCT 博士生，在 Atomic Fabrication Facility 工作，并将 Michelle Simmons 列为该设施主任和研究计划负责人。另一篇候选论文由其学生撰写，Weber 是共同导师。正式本人学位导师仍待核。';
const wpo='本人组档与 Westlake 原讲者档确认，UNSW 博士毕业后在 Monash MCATM 获 ARC DECRA fellowship。现有原档未注明正式博士后导师。';
const ws='师承人物 - Michelle Simmons';
note(w,'- 博士阶段课题组负责人：',wph+links(['UNSW 同期原档',wd0]));
note(w,'- 核查边界：',wpo+links(['本人组档',ww],['Westlake 原档',west]));
mentorLine(ws,w,'- 博士阶段课题组成员：',wph);
indexLine(w,ws,'博士阶段课题组负责人',wph);
changeRow(w,null,'Monash MCATM ARC DECRA fellow；个人指导待核',web('本人组档',ww)+links(['Westlake 原档',west]));
const wkey=audit(w,{phd:['group_or_candidate',wph,[wd0,ww]],postdoc:['unresolved',wpo,[ww,west]]},'继续核 UNSW Weber 自己的博士学位原件和 Monash Fellowship 任用档，Simmons 为博士阶段组负责人。');
relation(w,'phd',ws,'group_leader',wph,[wd0,ww],wkey);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_博士履历与新加坡档案追查';
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

