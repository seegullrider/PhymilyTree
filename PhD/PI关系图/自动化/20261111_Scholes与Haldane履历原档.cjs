
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_Scholes与Haldane履历原档';
const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const files = new Map();
const audits = [];
const relations = [];
const pages = [];
const record = db.prepare('SELECT name, unit, filename FROM records WHERE id=?');
const priorAudit = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const fileFor = filename => '../人物/' + filename + '.md';
const link = (label,url) => '[' + label + '](' + url + ')';
const index = '../师承关系索引.md';
function edit(file, predicate, change) {
 const current = files.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = current.includes('\r\n') ? '\r\n' : '\n';
 const lines = current.split(/\r?\n/);
 const matches = lines.flatMap((line,i) => predicate(line) ? [i] : []);
 if (matches.length !== 1) throw new Error(file + ': ' + matches.length + ' matching lines');
 const i = matches[0];
 lines[i] = change(lines[i],newline);
 files.set(file,lines.join(newline));
}
function append(file,predicate,addition) {
 edit(file,predicate,line => line.includes(addition) ? line : line + ' ' + addition);
}
function review(id, changes, next) {
 const event = JSON.parse(priorAudit.get(id).details_json);
 event.audit_id = 'pi_archive_20261111_scholes_haldane_' + id;
 for (const [aspect,note,sources] of changes) {
  const old = event.aspects[aspect];
  event.aspects[aspect] = {...old,note,sources:[...new Set([...sources,...old.sources])]};
 }
 event.next_step = next;
 event.followup_required = true;
 audits.push(event);
 return event;
}
function evidence(event,stage,kind,mentor,note,sources,key) {
 relations.push({event_id:event.audit_id + '_' + key,record_id:event.record_id,stage,kind,mentor_filename:mentor,source_audit_id:event.audit_id,evidence:note,sources});
}
function original(id,url,raw) {
 pages.push({record_id:id,url,raw,excerpt:raw});
}

function school(p,transform,refs) {
 const prefix='| [['+p.filename+'|';
 edit('../'+p.unit+'逐人复核记录.md',line=>line.startsWith(prefix),line=>transform(line).trimEnd().slice(0,-1).trimEnd()+' · '+refs+' |');
}
const starts=(label,filename)=>line=>line.startsWith('- '+label+'：')&&(!filename||line.includes(filename));


{
 const id='4838b2cb',p=record.get(id),file=fileFor(p.filename),who='[['+p.filename+'|'+p.name+']]';
 const trust='https://www.soci.org/-/media/files/awards/ramsay-memorial-fellowship-trust/sciramsaytrustbrochure2020.ashx';
 const bio='https://macmillan.princeton.edu/wp-content/uploads/acs.accounts.2c00083.pdf';
 const chem='https://chemistry.princeton.edu/faculty-research/faculty/gregory-scholes/';
 const phd='本人署名的 Accounts of Chemical Research 文章作者简介明确列 Melbourne 1994 博士，由 Ken Ghiggino 指导。Scholes 的 Ramsay Trust 本人回顾也具名 Ghiggino。';
 const imperial='Ramsay Trust 印刷册在 Scholes 本人回顾栏列 Imperial College London 1995–1997 Ramsay Fellowship，Scholes 明确以 advisor 称 David Phillips。';
 const berkeley='Scholes 本人回顾说结束 Ramsay fellowship 后在 UC Berkeley 与 Graham Fleming 做博后，合著原文作者简介称在 Fleming 手下任 postdoctoral scholar。保留具名博士后研究师长，聘任文件中的 advisor 称谓及月份待查。';
 const trustRef=link('Ramsay Trust 本人回顾',trust);
 const bioRef=link('Scholes 署名原刊作者简介',bio);
 const refs=trustRef+' · '+bioRef;
 for(const [stage,oldLabel,label,reverseOld,reverse,mentor,name,note,reference,key] of [
  ['phd','博士导师','博士导师','博士生','博士生','师承人物 - Kenneth P. Ghiggino','Kenneth P. Ghiggino',phd,refs,'ghiggino'],
  ['postdoc','博士后研究师长','博士后导师','博士后阶段研究者','博士后研究者','师承人物 - David Phillips','David Phillips',imperial,trustRef,'phillips'],
  ['postdoc','博士后研究师长','博士后研究师长','博士后阶段研究者','博士后阶段研究者','人员 - UC Berkeley - Graham R. Fleming — 荣休 - 5b832ad4','Graham R. Fleming',berkeley,refs,'fleming']
 ]){
  const target='[['+mentor+'|'+name+']]';
  const detail=note+' '+reference+' 可信度：高。';
  const appendSources=line=>line+' '+detail;
  if(oldLabel===label) {
   append(file,starts(oldLabel,mentor),detail);
   append(fileFor(mentor),starts(reverseOld,p.filename),detail);
   append(index,line=>line.startsWith('- '+who+' → '+oldLabel+'：')&&line.includes(mentor),detail);
  } else {
   edit(file,starts(oldLabel,mentor),line=>appendSources(line.replace('- '+oldLabel+'：','- '+label+'：')));
   edit(fileFor(mentor),starts(reverseOld,p.filename),line=>appendSources(line.replace('- '+reverseOld+'：','- '+reverse+'：')));
   edit(index,line=>line.startsWith('- '+who+' → '+oldLabel+'：')&&line.includes(mentor),line=>appendSources(line.replace(' → '+oldLabel+'：',' → '+label+'：')));
  }
 }
 edit(file,starts('核查边界'),()=>'- 核查边界：Imperial 1995–1997 与后续 Berkeley 博后分列。Phillips 由本人以 advisor 具名。Berkeley 两份本人资料核实 Fleming 的指导关系，保留来源用词所支持的阶段研究师长。 '+refs);
 edit(file,line=>line.startsWith('- 化学教授；学术期刊人物介绍'),()=>'- Princeton 化学系 William S. Tod Professor，研究超快多维电子谱、激子材料、腔量子电动力学及分子中的相干动力学。 '+link('Princeton 化学系原档',chem));
 school(p,line=>line.replace(' | Kenneth P. Ghiggino | David Phillips（研究师长）、Graham R. Fleming（研究师长） | ',' | Kenneth P. Ghiggino（Melbourne 1994 博士导师） | David Phillips（Imperial 1995–1997 博士后导师）、Graham R. Fleming（后续 Berkeley 博士后研究师长） | '),refs);
 const e=review(id,[
  ['identity','本人回顾、本人署名文章的作者简介与 Princeton 院系原档一致，核 1994 Melbourne 博士、Imperial、Berkeley、Toronto 及 Princeton 化学任用。',[trust,bio,chem]],
  ['phd',phd,[bio,trust]],
  ['postdoc',imperial+' '+berkeley,[trust,bio]],
  ['affiliation','Princeton 化学系 William S. Tod Professor。',[chem]],
  ['research','超快多维电子谱、激子材料、腔量子电动力学与分子相干动力学。',[chem]]
 ],'追 Melbourne 学位论文原卷及 Berkeley 博后任命的具体月份和个人指导称谓。');
 e.aspects.phd.status='confirmed_advisor';
 e.aspects.postdoc.status='confirmed_advisor';
 evidence(e,'phd','advisor','师承人物 - Kenneth P. Ghiggino',phd,[bio,trust],'ghiggino');
 evidence(e,'postdoc','advisor','师承人物 - David Phillips',imperial,[trust],'phillips');
 evidence(e,'postdoc','stage_mentor','人员 - UC Berkeley - Graham R. Fleming — 荣休 - 5b832ad4',berkeley,[trust,bio],'fleming');
 original(id,trust,'Scholes 本人回顾确认 Imperial Ramsay fellowship 1995–1997，明确称 David Phillips 为 advisor，并分列后续 Berkeley 的 Graham Fleming 博后。');
 original(id,bio,'本人署名文章作者简介明确列 1994 Melbourne 博士由 Ken Ghiggino 指导，并列 Berkeley 博后 under Prof. Graham Fleming。');
 original(id,chem,'Princeton 化学系原页列 William S. Tod Professor，研究包括超快多维电子谱、激子材料及腔 QED。');
}
{
 const id='38bbd97d',p=record.get(id),file=fileFor(p.filename),who='[['+p.filename+'|'+p.name+']]';
 const apollo='https://www.repository.cam.ac.uk/items/dd3daeca-0658-48da-8727-4a87f8d83af6';
 const cavendish='https://www.phy.cam.ac.uk/wp-content/uploads/2025/03/cavmag-17.pdf';
 const ill='https://www.ill.eu/fileadmin/user_upload/ILL/2_News_Press_Events/News_Press-releases/2022/220624_Nozieres-Villain_Livre-des-50ans.pdf';
 const annual='https://www.ill.eu/media/old_files/user_upload/ILL/1_About_ILL/Documentation/Annual_report/AR-16/ILLS_2016.pdf';
 const yearbook='https://www.ill.eu/fileadmin/user_upload/ILL/1_About_ILL/Documentation/Annual_report/Previous_issues_from_2005/AR-1981.pdf';
 const phy='https://phy.princeton.edu/people/duncan-haldane';
 const princeton='https://www.princeton.edu/news/2016/10/04/good-day-great-ideas-princetons-haldane-wins-one-theoretical-physics';
 const interview='https://www.nims.go.jp/mana/ebulletin/feature/feature07.html';
 const phd='Cambridge 学位馆藏列全名及论文《An extension of the Anderson model as a model for mixed valence rare earth materials》。Cavendish 实验室原档确认 Phil Anderson 指导、1978 授位。Princeton 另列博士最后两学年以访问生身份完成。';
 const post='Nozières 在 ILL 五十周年回忆中说明接掌 Grenoble 理论组，并以 Haldane 为其引进的博后例子。ILL 年报核实 1977–1981 在组、1981 年名录列至 8 月。按理论组负责人登记，具名个人博士后导师称谓待查。';
 const refs=link('Nozières 与 Villain 的 ILL 原档',ill)+' · '+link('ILL 2016 年报',annual)+' · '+link('ILL 1981 成员表',yearbook);
 const phdRefs=link('Cambridge 论文馆藏',apollo)+' · '+link('Cavendish 原档',cavendish)+' · '+link('Princeton 学校报道',princeton);
 const anderson='师承人物 - Philip W. Anderson';
 const nozieres='师承人物 - Philippe Nozières';
 append(file,starts('博士导师',anderson),phd+' '+phdRefs);
 append(fileFor(anderson),starts('博士生',p.filename),phd+' '+phdRefs);
 append(index,line=>line.startsWith('- '+who+' → 博士导师：')&&line.includes(anderson),phd+' '+phdRefs);
 const target='[['+nozieres+'|Philippe Nozières]]';
 const postEntry='博士后课题组负责人：'+target+'（ILL Grenoble 理论组）。'+post+' '+refs;
 edit(file,starts('核查边界'),(line,nl)=>'- '+postEntry+nl+'- 核查边界：Cambridge 授位和 ILL 任期依各原档记载，ILL 到任早于正式授位年份，博士期在 Princeton 为访问生。个人博士后导师称谓待查。 '+link('Cambridge 学位馆藏',apollo)+' · '+link('本人访谈',interview));
 edit(file,line=>line.startsWith('- 物理教授；研究机构简介'),()=>'- Princeton 物理系 Eugene Higgins Professor，研究拓扑物态与凝聚态多体理论。 '+link('Princeton 物理系原档',phy));
 if(fs.existsSync(fileFor(nozieres)))throw Error('导师人物页已存在：'+nozieres);
 files.set(fileFor(nozieres),'# Philippe Nozières\n\n> [!info] 师承扩展人物\n> Grenoble Institut Laue-Langevin 理论组负责人，研究凝聚态多体理论。 '+link('ILL 原档',ill)+'\n\n## 师承\n\n- 博士后课题组成员：'+who+'（ILL Grenoble 理论组）。'+post+' '+refs+'\n');
 edit(index,line=>line.startsWith('- '+who+' → 博士导师：')&&line.includes(anderson),(line,nl)=>line+nl+'- '+who+' → '+postEntry);
 school(p,line=>line.replace(' | Philip W. Anderson | 待核 | ',' | Philip W. Anderson（Cambridge 1978 博士导师） | Philippe Nozières（ILL Grenoble 1977–1981 理论组负责人） | '),phdRefs+' · '+refs);
 const e=review(id,[
  ['identity','Cambridge 馆藏具名 Frederick Duncan Michael Haldane。Princeton 及 ILL 原档相符，阶段包括 Cambridge 学位、Princeton 博士期访问和 Grenoble ILL 博后。',[apollo,princeton,ill,annual]],
  ['phd',phd,[apollo,cavendish,princeton]],
  ['postdoc',post,[ill,annual,yearbook,interview]],
  ['affiliation','Princeton Physics 教授及 Eugene Higgins 冠名职衔，1990 年入职。',[phy]],
  ['research','Princeton 原档核拓扑相变和拓扑物态，校方报道与 ILL 年报核低维多体理论。',[phy,princeton,annual]]
 ],'Cambridge 导师已由 Cavendish 与学位馆藏交叉确认，继续查 ILL 个人博士后指导及入职月份。');
 e.aspects.phd.status='confirmed_advisor';
 e.aspects.postdoc.status='group_or_candidate';
 evidence(e,'phd','advisor',anderson,phd,[apollo,cavendish,princeton],'anderson');
 evidence(e,'postdoc','group_leader',nozieres,post,[ill,annual,yearbook,interview],'nozieres');
 original(id,apollo,'Cambridge Apollo 核全名、论文题名、University of Cambridge PhD。');
 original(id,cavendish,'Cambridge Cavendish 实验室刊物明确列 Phil Anderson 指导及 1978 授位。');
 original(id,ill,'Nozières 自述接管 ILL 理论组并以 Anderson 推荐 Haldane 入组做博后为例，Villain 交叉确认 Nozières 任组负责人。');
 original(id,annual,'ILL 2016 年报列 Haldane 在 ILL 的 1977–1981 年和与 Nozières、Villain 的合作。');
 original(id,yearbook,'ILL 1981 年报 Theory 组成员列 F.D.M. Haldane 至 8 月。');
 original(id,phy,'Princeton 物理系列现任物理教授、1978 Cambridge 博士及 1990 加入 Princeton。');
 original(id,princeton,'Princeton 2016 报道列 Haldane 博士最后两年为 Princeton visiting student。');
}
db.close();
console.log(JSON.stringify({files:files.size,audits:audits.length,relations:relations.length,pages:pages.length}));
if(process.argv[2]==='apply') {
 function persist(label,value) {
  const path = batch+'_'+label+'.json';
  fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n','utf8');
  return path;
 }
 function run(script,...args) { execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'}); }
 for(const [file,content] of files) fs.writeFileSync(file,content,'utf8');
 for(const event of audits) run('人工核查台账.cjs','record',persist('人工_'+event.record_id,event));
 run('结构化师承关系.cjs','record',persist('关系',relations));
 run('检索流程.cjs','ingest-reviewed-pages',persist('原档',pages));
}
