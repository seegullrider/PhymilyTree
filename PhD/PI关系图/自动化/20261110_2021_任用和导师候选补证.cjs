const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root = '..';
const notes = path.join(root,'人物');
const index = path.join(root,'师承关系索引.md');
const records = db.prepare('SELECT id,filename,unit FROM records WHERE id=?');
const last = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const updates = new Map(), audits = [], relations = [];
function line(file, match, suffix) {
 const text = updates.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = text.includes('\r\n') ? '\r\n' : '\n';
 const rows = text.split(/\r?\n/);
 const matches = rows.map((row,i) => match(row) ? i : -1).filter(i=>i>=0);
 if (matches.length !== 1) throw Error(file+' expected one line, found '+matches.length);
 const i = matches[0];
 if (!rows[i].includes(suffix)) rows[i] += suffix;
 updates.set(file, rows.join(newline));
}
function source(label,url) { return '['+label+']('+url+')'; }
function personLine(id,prefix,suffix) {
 const record = records.get(id);
 line(path.join(notes,record.filename+'.md'),x=>x.startsWith(prefix),suffix);
}
function schoolSource(id,suffix) {
 const record=records.get(id);
 const file=path.join(root,record.unit+'逐人复核记录.md');
 const contents=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=contents.includes('\r\n')?'\r\n':'\n';
 const rows=contents.split(/\r?\n/);
 const i=rows.findIndex(x=>x.startsWith('| [['+record.filename+'|'));
 if(i<0||!rows[i].endsWith(' |'))throw Error('missing school row '+id);
 if(!rows[i].includes(suffix))rows[i]=rows[i].slice(0,-2)+suffix+' |';
 updates.set(file,rows.join(newline));
}
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mf=name=>path.join(notes,name+'.md');
const sl=id=>path.join(root,records.get(id).unit+'逐人复核记录.md');
const wiki=(name,display)=>'[['+name+'|'+display+']]';
const who=(id,display)=>wiki(records.get(id).filename,display);
const get=file=>updates.get(file)??fs.readFileSync(file,'utf8');
const boundary='- 核查边界：';
function rewrite(file,test,fn) {
 const content=get(file);
 const nl=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const indexes=rows.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(indexes.length!==1)throw Error(file+' expected one matching row, found '+indexes.length);
 const i=indexes[0];
 rows[i]=fn(rows[i],nl);
 updates.set(file,rows.join(nl));
}
function school(id,oldField,newField) {
 const r=records.get(id);
 rewrite(sl(id),x=>x.startsWith('| [['+r.filename+'|'),x=>{
  if(x.includes(newField))return x;
  if(!x.includes(oldField))throw Error('missing school field '+id);
  return x.replace(oldField,newField);
 });
}
function insertAfter(file,prefix,entry){
 if(get(file).includes(entry))return;
 rewrite(file,x=>x.startsWith(prefix),(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261110_2021_'+id;
 orig.followup_required=true;
 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261110_2021_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}

const g='32faeaab', j='32fcee46', v='33134455', r='862bed8a', d='33d4d05c', m='33db0d42', t='4abf014b';
const u={
  g:'https://www.colorado.edu/chemistry/steven-m-george',
  gb:'https://www.colorado.edu/lab/georgegroup/publications',
  kcl:'https://www.kcl.ac.uk/people/steven-george',
  reading:'https://research.reading.ac.uk/meteorology/people/steven-george/',
  col:'https://www.apam.columbia.edu/physics-math/about/resources/dissertation-index',
  alumni:'https://www.apam.columbia.edu/physics-math/alumni/alumni-reports',
  handle:'https://hdl.handle.net/10022/AC%3AP%3A12160',
  sb:'https://www.stonybrook.edu/mechanical-engineering/people/jie_gao_profile.html',
  gg:'https://www.gla.ac.uk/pgrs/jiegao/',
  olin:'https://www.olin.edu/bios/venkatesh-narayanamurti',
  hv:'https://bpb-us-e1.wpmucdn.com/sites.harvard.edu/dist/c/828/files/2025/01/Biography_Narayanamurti-2005.pdf',
  aip:'https://history.aip.org/catalog/icos/46686.html',
  aipArticle:'https://www.aip.org/library/ex-libris-universum/south-asian-scientists-part-2-cultivating-transregional-excellence',
  pohl:'https://www.lassp.cornell.edu/people/robert-pohl',
  aps:'https://journals.aps.org/rmp/abstract/10.1103/RevModPhys.42.201',
  arg:'https://www.anl.gov/article/argonne-chemist-wins-awis-innovator-award-for-nanoparticle-research',
  rm:'https://www.nanotech-now.com/news.cgi?story_id=33970',
  cv:'https://www.ameslab.gov/sites/default/files/inline-files/Tijana%20Rajh%20CV-public.pdf',
  leh:'https://engineering.lehigh.edu/matsci/news/seminar-series/shen-dillon',
  leho:'https://engineering.lehigh.edu/sites/engineering.lehigh.edu/files/Resolve%20Magazine%2C%202007%2C%20Volume%202.pdf',
  lep:'https://news.lehigh.edu/news/engineering-student-research-competition-sets-standard-university-research-event',
  ill:'https://grainger.illinois.edu/news/stories/2013-07-02-dillon-receives-career-award-study-light-absorbing-photocatalysts',
  cmu:'https://www.cmu.edu/engineering/materials/news_and_events/newsletter/files/pdf/2008-fall-mse-news.pdf',
  pmi:'https://materials.princeton.edu/people/mansour-shayegan',
  md:'https://history.aip.org/catalog/icos/47221.html',
  ut:'https://muri.engr.utexas.edu/members.html',
  ack:'https://citeseerx.ist.psu.edu/document?doi=452d9772b10d4c8f6cee398c3c54e2c57c75a413&repid=rep1&type=pdf'
};
const src=(...items)=>items.map(([label,key])=>source(label,u[key])).join(' · ');
const addIndex=entry=>insertAfter(index,'# 师承关系与候选线索索引','\n'+entry);
const sameKcl='King’s College London 同名者 Steven S. George 是英语文学博士，在历史相关项目从事博士后研究。';
const sameReading='Reading 气象系同名者 Steven E. George 是 NCAS 气候模型研究人员，主页列格陵兰冰盖及环流模型。';
const geo='Colorado 本人化学系档确认 1983 年 3 月 Berkeley 化学博士及表面化学、材料和纳米技术方向。本人课题组论文目录显示 1982–1984 年与 C. B. Harris 有皮秒光谱系列合作，与 LBNL 项目记录一致。Harris 的正式论文导师职衔仍待查。';
personLine(g,boundary,' '+geo+' '+src(['Colorado 化学系档','g'],['本人论文目录','gb']));
insertAfter(pf(g),boundary,'- 同名消歧：'+sameKcl+' '+sameReading+' '+src(['KCL','kcl'],['Reading','reading'],['Colorado 本人档','g']));
schoolSource(g,' · '+src(['Colorado 化学系档','g']));
const ga=audit(g,[['identity',sameKcl+' '+sameReading+' Colorado 原档复核本人的博士年份及化学身份。',[u.g,u.kcl,u.reading]],['phd',geo,[u.g,u.gb],'group_or_candidate']], '查 Berkeley 论文答辩或校方导师字段，并查 1983–84 Caltech 研究人员任用原档。');

const sameGla='Glasgow 同名者 Jie Gao 为英语语言教育与 TESOL 方向博士生，区别于 Stony Brook 机械工程系光子学 PI。';
const jph='Columbia 目录第 243 行明列 2012 年博士论文《Chip-scale Photonic Devices for Light-matter Interactions and Quantum Information Processing》，Advisor 为 Wong / Osgood。论文持久链接本轮未能打开，保留 Osgood 全名待核。';
const jpo='Columbia 校友原档明确 2012 应用物理博士、Missouri S&T 机械与航天工程助理教授。该档与 Stony Brook 机械工程原档互相核对，仍需更细的任用档案核实是否另有博士后。';
personLine(j,boundary,' '+jph+' '+jpo+' '+src(['Columbia 学位目录','col'],['Columbia 校友原档','alumni'],['论文持久链接（暂未读到正文）','handle']));
insertAfter(pf(j),boundary,'- 同名消歧：'+sameGla+' '+src(['Glasgow 同名者档','gg'],['Stony Brook 本人档','sb']));
school(j,' | 待核 | ',' | Columbia 校友档记 Missouri S&T 助理教授，博士后另待核 | ');
schoolSource(j,' · '+src(['Columbia 校友原档','alumni']));
const ja=audit(j,[['identity',sameGla,[u.gg,u.sb]],['phd',jph,[u.col,u.sb],'confirmed_advisor'],['postdoc',jpo,[u.alumni,u.sb],'unresolved']], '按 10022/AC:P:12160 查可读论文原件并查 Missouri S&T 首次任命日期，核实 Osgood 全名及是否另有博后。');

const p='师承人物 - Robert O. Pohl', pl=wiki(p,'Robert O. Pohl');
const vp='AIP 口述史检索索引把 Cornell 晶体缺陷研究与 Robert Pohl 指导联系起来，访谈正文目前返回 403。Harvard 原履历列 1965 Cornell 物理博士、论文研究固体缺陷的转动和隧穿态；APS 合作论文及 Cornell 教师原档可核领域和身份。Pohl 暂列低可信博士导师候选。';
const vpo='Harvard 原履历列 1968 入职 Bell Labs，Olin 本人档列 Bell 1968–1987、Sandia 1987–1992、UCSB 1992–1998。1965–1968 的博士后聘任及个人导师均待核。';
const vps=src(['AIP 访谈目录线索','aip'],['AIP 图书馆访谈入口','aipArticle'],['Harvard 原履历','hv'],['APS 同期研究综述','aps'],['Cornell 导师候选人档','pohl']);
insertAfter(pf(v),'## 师承','\n- 博士导师候选：'+pl+'。'+vp+' '+vps);
personLine(v,boundary,' '+vpo+' '+src(['Harvard 原履历','hv'],['Olin 本人档','olin']));
insertAfter(mf(p),'## 师承','\n- 博士生候选：'+who(v,'Venkatesh Narayanamurti')+'。'+vp+' '+vps);
addIndex('- '+who(v,'Venkatesh Narayanamurti')+' → 博士导师候选：'+pl+'。'+vp+' '+vps);
school(v,' | 待核 | 待核 | ',' | Robert O. Pohl（低可信候选，访谈正文待核） | 1965–1968 任用待核 | ');
schoolSource(v,' · '+src(['Harvard 原履历','hv'],['Olin 本人档','olin']));
const va=audit(v,[['phd',vp,[u.hv,u.pohl,u.aps,u.aipArticle,u.aip],'group_or_candidate'],['postdoc',vpo,[u.hv,u.olin],'unresolved']], '查 Cornell 1965 学位论文签署栏或 AIP 可读访谈本，补 1965–1968 任用。');
relation(v,va,'phd',p,'candidate',vp,[u.hv,u.pohl,u.aps,u.aipArticle,u.aip],'pohl');

const re='2009 Argonne 原新闻返回 403，两个转载页面本轮无正文。Olga I. Micic 保留候选，待可读原档确认正式博士导师。';
personLine(r,'- 博士论文追查：',' '+re+' '+src(['Argonne 原发布页','arg'],['转载候补','rm']));
schoolSource(r,' · '+src(['Argonne 原发布页（403）','arg']));
audit(r,[['phd',re,[u.arg,u.rm],'group_or_candidate']], '查 Belgrade 学位论文导师栏及 1986–1987 Hebrew University 化学系博后项目原档。');

const har='师承人物 - Martin P. Harmer';
const dh='Lehigh 2007 工程院原刊明确称 Dillon 是 Harmer 的学生，所述氧化铝晶界课题与同时期竞赛 Advisor 条目吻合。保留博士阶段研究师长，正式论文导师栏待核。';
const dp='Illinois 原刊区分 2007 年后 CMU Research Associate、Lehigh Visiting Professor 与 MIT Visiting Scientist 三种任用，2009 年入 Illinois。CMU 同期院系原刊确认 Dillon 对 Rollett 领衔的三维微结构项目有贡献，并列 Rohrer 为主要贡献者，未给 Dillon 本人的聘任导师。';
personLine(d,'- 博士阶段研究师长：',' '+dh+' '+src(['Lehigh 2007 工程院原刊','leho']));
personLine(d,boundary,' '+dp+' '+src(['Illinois 原刊','ill'],['CMU 同期院系原刊','cmu']));
line(mf(har),x=>x.startsWith('- 博士阶段研究生：')&&x.includes(records.get(d).filename),' '+src(['Lehigh 2007 工程院原刊','leho']));
line(index,x=>x.startsWith('- '+who(d,'Shen Dillon')+' → 博士阶段研究师长：'),' '+src(['Lehigh 2007 工程院原刊','leho']));
school(d,' | 待核 | ',' | CMU 研究助理、Lehigh 访问教授及 MIT 访问研究人员；正式博士后及导师待核 | ');
schoolSource(d,' · '+src(['Lehigh 2007 工程院原刊','leho'],['Illinois 原刊','ill'],['CMU 同期院系原刊','cmu']));
const da=audit(d,[['phd',dh,[u.leho,u.lep],'group_or_candidate'],['postdoc',dp,[u.leh,u.ill,u.cmu],'unresolved']], '查 Lehigh 博士论文签署页，及 CMU／MIT 任用档和博后导师原始履历。');
relation(d,da,'phd',har,'stage_mentor',dh,[u.leho,u.lep],'harmer');

const mp='Princeton Materials Institute 原档确认 ECE 教授、MIT 1983 博士，研究涉及应用物理、量子材料、器件与量子信息。';
personLine(m,boundary,' '+mp+' '+src(['Princeton Materials Institute','pmi']));
schoolSource(m,' · '+src(['Princeton Materials Institute','pmi']));
const ma=audit(m,[['affiliation',mp,[u.pmi]],['research',mp,[u.pmi]]], '查 1983 MIT 博士论文（与 1981 工程师学位区分），及 Maryland 博后任用与个人指导。');
const me='AIP 口述史称 Mildred S. Dresselhaus 为研究生 advisor，并说明对 dissertation 研究的指导；1983 博士论文正式 advisor 尚待核。';
relation(m,ma,'phd','师承人物 - Mildred S. Dresselhaus','stage_mentor',me,[u.md,u.pmi],'dresselhaus');

const tp='Princeton 同期博士论文致谢直接称 Emanuel Tutuc 在 Shayegan 组。保留博士阶段课题组关系和正式导师候选的区别，2005 年在 Princeton 的任用性质另待核。';
const tb='UT Austin 官方项目原档明确 Tutuc 在 IBM T. J. Watson 任博士后，个人导师未具名。';
const tw=who(t,'Emanuel Tutuc');
const tx=tp+' '+src(['Princeton 同期论文致谢','ack']);
line(pf(t),x=>x.startsWith('- 博士导师候选：'),' '+tx);
line(pf(t),x=>x.startsWith('- 博士后经历：'),' '+src(['UT 项目原档','ut']));
line(pf(m),x=>x.startsWith('- 博士生候选：')&&x.includes(records.get(t).filename),' '+tx);
line(index,x=>x.startsWith('- '+tw+' → 博士导师候选：'),' '+tx);
insertAfter(pf(t),'- 博士导师候选：','- 博士阶段课题组负责人：'+who(m,'Mansour Shayegan')+'。'+tx);
insertAfter(pf(m),'- 博士阶段受指导者：','- 博士阶段课题组成员：'+tw+'。'+tx);
addIndex('- '+tw+' → 博士阶段课题组负责人：'+who(m,'Mansour Shayegan')+'。'+tx);
school(t,'Mansour Shayegan（博士导师候选）','Mansour Shayegan（博士阶段课题组负责人、正式导师候选）');
schoolSource(t,' · '+src(['Princeton 同期论文致谢','ack'],['UT 项目原档','ut']));
const ta=audit(t,[['phd',tp,[u.ack],'group_or_candidate'],['postdoc',tb,[u.ut],'unresolved']], '以本人论文题名追查 Princeton 学位档及 IBM Watson 博后组。');
relation(t,ta,'phd',records.get(m).filename,'group_leader',tp,[u.ack],'shayegan');

const exclusions=[
  ['76617997756a28912d444563',u.kcl,g,ga,'KCL 英语文学与历史研究者 Steven S. George',sameKcl],
  ['aa9c694ad6f690d0cc8064ec',u.reading,g,ga,'Reading NCAS 气候模型研究者 Steven E. George',sameReading],
  ['d2665edb83031033b02fa946',u.gg,j,ja,'Glasgow 英语语言教育与 TESOL 博士生 Jie Gao',sameGla]
].map(([page_id,url,record_id,audit_id,external_subject,evidence])=>({page_id,url,record_id,audit_id,external_subject,evidence}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,exclusions:exclusions.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,file){execFileSync(process.execPath,['--no-warnings',script,...(script==='人物网页身份纠偏.cjs'?[]:['record']),file],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2021_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261110_2021_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_2021_结构化回执.json');
persist('20261110_2021_同名排除.json',exclusions);
call('人物网页身份纠偏.cjs','20261110_2021_同名排除.json');
