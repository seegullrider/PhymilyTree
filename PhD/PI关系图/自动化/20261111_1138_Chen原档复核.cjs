const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const batch='20261111_1138';
const files=new Map(), audits=new Map(), edges=[], pages=[];
const cv='https://meche.mit.edu/sites/default/files/cv/CV-2023P.pdf';
const cv2016='https://web.mit.edu/nanoengineering/people/Chen-CV-Web2016_0.pdf';
const mitgroup='https://web.mit.edu/nanoengineering/people/past.shtml';
const mentor='师承人物 - Gang Chen';
const record=db.prepare('SELECT name,unit,filename FROM records WHERE id=?');
const latest=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const get=file=>files.get(file)??fs.readFileSync(file,'utf8');
const person=filename=>path.join('..','人物',filename+'.md');
const wiki=(name,label)=>'[['+name+'|'+label+']]';
const link=(label,url)=>'['+label+']('+url+')';
const refs=(rows)=>rows.map(([name,url])=>link(name,url)).join(' · ');
const index='../师承关系索引.md';

function changeLine(file, match, fn) {
  const content=get(file);
  const nl=content.includes('\r\n')?'\r\n':'\n';
  const lines=content.split(/\r?\n/);
  const matches=lines.flatMap((x,i)=>match(x)?[i]:[]);
  if(matches.length!==1)throw Error(file+' expected one matching line, got '+matches.length);
  lines[matches[0]]=fn(lines[matches[0]],nl);
  files.set(file,lines.join(nl));
}
function appendAfter(file, section, line) {
  if(get(file).split(/\r?\n/).includes(line))return;
  changeLine(file,x=>x===section,(x,nl)=>x+nl+line);
}
function school(id, updates, source) {
  const p=record.get(id);
  changeLine('../'+p.unit+'逐人复核记录.md',x=>x.startsWith('| [['+p.filename+'|'),line=>{
    const end=line.indexOf(']]')+2;
    const cells=line.slice(end,-2).split(' | ');
    if(cells.length!==5||!line.endsWith(' |'))throw Error('malformed school row '+id);
    for(const [slot,value] of updates)cells[slot]=value;
    if(source&&!cells[4].includes(source))cells[4]+=' · '+source;
    return line.slice(0,end)+cells.join(' | ')+' |';
  });
}
function audit(id, stageChanges, next) {
  const auditId='pi_archive_'+batch+'_'+id;
  const entry=JSON.parse(latest.get(id).details_json);
  if(entry.audit_id!==auditId){
    entry.audit_id=auditId;
    if(next){entry.next_step=next;entry.followup_required=true;}
    for(const [k,status,note,urls] of stageChanges){
      const old=entry.aspects[k];
      entry.aspects[k]={...old,status,note,sources:[...new Set([...urls,...old.sources])]};
    }
  }
  audits.set(id,entry);
  return auditId;
}
function edge(id,stage,kind,desc,urls){
  const a=audits.get(id);
  edges.push({event_id:a.audit_id+'_'+stage+'_chen',record_id:id,stage,kind,mentor_filename:mentor,
    source_audit_id:a.audit_id,evidence:desc,sources:urls});
}
function evidencePage(id,url,note){pages.push({record_id:id,url,raw:note,excerpt:note});}
function postdoc({id,detail,sources,next,newCell,indexPrefix,formatIndex,boundary,extra}) {
  const p=record.get(id),who=wiki(p.filename,p.name),to=wiki(mentor,'Gang Chen');
  const src=refs(sources);
  const suffix='。'+detail+' '+src;
  const updates=[[ 'postdoc','group_or_candidate',detail,sources.map(x=>x[1]) ]];
  audit(id,updates,next);
  const pp=person(p.filename);
  changeLine(pp,x=>x.includes(to)&&/^- 博士后(?:课题组负责人|阶段研究师长)：/.test(x),()=>'- 博士后阶段研究师长：'+to+suffix);
  changeLine(person(mentor),x=>x.includes(p.filename)&&/^- 博士后(?:课题组成员|阶段研究者)：/.test(x),()=>'- 博士后阶段研究者：'+who+suffix);
  const newIndex='- '+who+' → 博士后阶段研究师长：'+to+suffix;
  if(!get(index).split(/\r?\n/).includes(newIndex)){
    changeLine(index,x=>x.startsWith('- '+who+' → '+indexPrefix)&&x.includes(to),
      (x,nl)=>formatIndex?formatIndex(x,nl,newIndex):newIndex);
  }
  if(boundary)changeLine(pp,x=>x.startsWith('- 核查边界：'),()=>'- 核查边界：'+boundary+' '+src);
  if(extra)appendAfter(pp,'## 师承',extra);
  school(id,[[3,newCell]],src);
  edge(id,'postdoc','stage_mentor',detail,sources.map(x=>x[1]));
  evidencePage(id,cv,detail);
}
const yuancv='https://www.engineering.columbia.edu/sites/default/files/2025-08/CV_Yuan_Yang_07262025-chronological.pdf';
const yuanold='https://apam.columbia.edu/files/seasdepts/applied-physics-and-applied-math/cv-yangy.pdf';
postdoc({
  id:'4d823e31',
  detail:'Gang Chen 本人 MIT CV 在研究人员监督名录第 37 条明确列 Yuan Yang 于 2012 年 7 月至 2015 年 6 月随其做 MIT 博士后。Columbia 本人两版 CV 的任期一致，旧版另列 Gang Chen Group。记具名阶段研究师长，正式 advisor 字段待查。',
  sources:[['Gang Chen 监督履历',cv],['Yuan Yang 2025 CV',yuancv],['Yuan Yang 旧版 CV',yuanold]],
  next:'查 MIT 2012–2015 博后任用或本人明确 advisor 字段。Stanford 博士导师 Yi Cui 的原记录保留。',
  newCell:'Gang Chen（MIT 2012 年 7 月至 2015 年 6 月博士后阶段研究师长）',
  indexPrefix:'博士导师：',
  formatIndex:(old,nl,newline)=>old.replace(/；博士后(?:课题组负责人|阶段研究师长)：.*$/,'。'+link('本人履历',yuanold)+' 明确博士 Advisor 为 Yi Cui。')+nl+newline,
});
const ucv='https://www.uh.edu/uh-energy/research/faculty-cv/chen_shuo_cv.pdf';
const eel='https://web.mit.edu/~eel/people.html';
const nmit='https://news.mit.edu/2008/fuel-cell-1002';
postdoc({
  id:'63cfd334',
  detail:'Gang Chen 2016 CV 的 Post-Doc Supervised 条目 13 列 Shuo Chen 从 2009 年 7 月起，2023 CV 同项称其 2009–2011 随其博后。本人 Houston CV 区分 2006–2009 Electrochemical Energy Laboratory 与 2009–2011 Nanoengineering 两段。Gang Chen 标阶段研究师长，Yang Shao-Horn 保留前段课题组关系。正式个人导师称谓待核。',
  sources:[['Gang Chen 2023 CV',cv],['Gang Chen 2016 CV',cv2016],['Shuo Chen 本人履历',ucv],['MIT 组档',eel]],
  next:'查两段 MIT 博后正式导师称谓及 Boston College 2011–2012 任用原档，核 Research Assistant Professor 与回忆 CV 所称 postdoc 的差异。',
  newCell:'Yang Shao-Horn（MIT 2006–2009 课题组负责人）、Gang Chen（MIT 2009–2011 阶段研究师长）',
  indexPrefix:'博士后课题组负责人：',
  formatIndex:(old,nl,newline)=>old.replace(/（2006–2009）及.*$/,'（2006–2009）。'+refs([['本人履历',ucv],['MIT 组档',eel],['MIT 同期报道',nmit]]))+nl+newline,
  extra:'- Boston College 后续任用：本人 CV 列 2011–2012 为 Research Assistant Professor。Gang Chen 2016 CV 回顾写 2011 秋另赴 BC 做博士后，两个职称分别保存，暂未认定为第三段正式博后。 '+refs([['本人履历',ucv],['Gang Chen 2016 CV',cv2016]])
});
const osu='https://mae.osu.edu/events/2014/04/seminar-building-energy-systems-nanoscale-conversion-storage-and-thermal-management';
const hulab='https://hu.seas.ucla.edu/people/index.html';
postdoc({
  id:'5b27be94',
  detail:'Gang Chen 2023 CV 指导名录第 32 条列 Yongjie Hu 从 2011 年 5 月至 2014 年 8 月随其做 MIT 博后，Harvard 博士背景一致。Ohio State 2014 年同期活动明确 Hu 与 Gang Chen 和 Mildred Dresselhaus 开展博后研究。两人均记阶段研究师长，正式任用称谓待查。',
  sources:[['Gang Chen 指导履历',cv],['Ohio State 同期讲座',osu],['UCLA 本人组档',hulab]],
  next:'核 Harvard 博士论文 Lieber 和 Marcus 的正式头衔及 MIT 博后任用。Gang Chen 的监督名单与 Ohio State 同期资料已核。',
  newCell:'Gang Chen、Mildred Dresselhaus（MIT 博士后阶段研究师长）',
  indexPrefix:'博士后课题组负责人：',
  boundary:'Harvard 博士阶段与 Lieber、Marcus 工作，两人的论文登记角色待核。MIT 博后有 Gang Chen 和 Mildred Dresselhaus 具名指导证据，个人正式称谓待查。'
});

{
  const id='24d34e4e',p=record.get(id);
  const umd='https://me.umd.edu/news/story/yang-promoted-to-professor';
  const umd2='https://me.umd.edu/news/story/dr-bao-yang-promoted-to-associate-professor';
  const phd='Gang Chen 两版 CV 的 Doctoral Theses, Supervisor 栏明列 Bao Yang、UCLA 机械工程 2003 博士论文及题目。Maryland 校方另核 1998 年中科大物理博士，该段指导者待查。';
  const post='Maryland 任用档称其 2003 年入职前任 MIT Visiting Research Assistant。校方 2009 年档分别列 1998 中科大和 2003 UCLA 博士，现未见独立博士后聘任。';
  audit(id,[['phd','confirmed_advisor',phd,[cv,cv2016,umd2]],['postdoc','no_postdoc_documented',post,[umd,umd2]]],
    '继续查 1998 中科大论文正式导师，以及 MIT 访问助研的任用时段和是否有另列博士后。');
  const src=refs([['Gang Chen 2023 CV',cv],['Maryland 任用档',umd]]);
  appendAfter(person(p.filename),'## 师承','- 任用履历复核。'+post+' '+src);
  changeLine(person(p.filename),x=>x.startsWith('- 核查边界：'),()=>'- 核查边界：UCLA 导师已核。1998 年中科大导师及独立博后任用继续查证。');
  school(id,[[3,'MIT Visiting Research Assistant，未见单列博后']],src);
  edge(id,'phd','advisor',phd,[cv,cv2016,umd2]);
  evidencePage(id,umd,post);
}
{
  const id='d412a632';
  const thesis='https://dspace.mit.edu/entities/publication/b5f151fa-1cce-4138-929b-531f17149273';
  const bio='https://www.tealab-liao.com/team';
  const note='Gang Chen 本人 2023 CV 的 Doctoral Theses, Supervisor 第 33 条明列 Bolin Liao 的 2016 MIT 学位论文、学位单位和主题。既有 MIT 馆藏及本人组档同指 Gang Chen。';
  audit(id,[['phd','confirmed_advisor',note,[cv,thesis,bio]]],'保留 Caltech 博后阶段接待教授 Ahmed Zewail，继续查正式指导称谓、任期及 2016 年后的指导衔接。');
  edge(id,'phd','advisor',note,[cv,thesis,bio]);
  evidencePage(id,cv,note);
}
for(const [id,url,detail] of [
 ['070d0f17','https://cse.umn.edu/physics/jian-ping-wang','CV 的 Jian Jian Wang 是 MIT 博士并于 2015–2016 继续在 MIT 做博后。Minnesota 的 Jian-Ping Wang 是 1995 年中科院物理所博士、1996 NUS 博后，排除误配。'],
 ['becc32e1','https://nusgs.nus.edu.sg/thesis-advisors/phywjs','CV 的 Jian Jian Wang 是 MIT 博士并于 2015–2016 继续在 MIT 做博后。NUS 的 Jian-Sheng Wang 是 1987 年 Carnegie Mellon 博士，随后 Rutgers 与 Jülich 博后，排除误配。']
]){
 const p=record.get(id);
 const a=JSON.parse(latest.get(id).details_json);
 const prior=a.audit_id==='pi_archive_'+batch+'_'+id?a.aspects.identity.note:a.aspects.identity.note+' '+detail;
 audit(id,[['identity','confirmed',prior,[cv,url]]]);
 appendAfter(person(p.filename),'## 师承','- 姓名消歧。'+detail+' '+refs([['Gang Chen CV',cv],['本校履历',url]]));
 evidencePage(id,url,detail);
}
evidencePage('4d823e31',yuancv,'2025 Columbia CV 第 1 页列 2012 年 7 月至 2015 年 6 月 MIT Mechanical Engineering Postdoctoral Associate。');
evidencePage('63cfd334',ucv,'Houston 本人 CV 第 1 页列两段 MIT 博后与 2011–2012 Boston College Research Assistant Professor。');
evidencePage('5b27be94',osu,'Ohio State 2014 同期讲座明确 Hu 的 MIT 博后阶段与 Gang Chen 和 Mildred Dresselhaus 工作。');
evidencePage('24d34e4e',cv,'Gang Chen 2023 CV 的 Doctoral Theses, Supervisor 栏具名 Bao Yang、UCLA 机械工程 2003 博士。');

console.log(JSON.stringify({files:files.size,audits:audits.size,edges:edges.length,pages:pages.length}));
db.close();
if(process.argv[2]==='apply'){
  function persist(suffix,value){
    const name=batch+'_'+suffix+'.json';
    fs.writeFileSync(name,JSON.stringify(value,null,2)+'\n','utf8');
    return name;
  }
  function run(file,...args){execFileSync(process.execPath,['--no-warnings',file,...args],{stdio:'inherit'});}
  for(const [id,a] of audits)run('人工核查台账.cjs','record',persist('人工_'+id,a));
  for(const [file,contents] of files)fs.writeFileSync(file,contents,'utf8');
  run('结构化师承关系.cjs','record',persist('Chen指导档结构化',edges));
  run('检索流程.cjs','ingest-reviewed-pages',persist('Chen指导档原页回执',pages));
}
