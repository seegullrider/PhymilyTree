
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_FranceDelft原档';
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
 event.audit_id = 'pi_archive_20261111_fr_delft_' + id;
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
const abesUrl="https://theses.fr/api/v1/theses/recherche/?q=status%3A(soutenue)%20AND%20(auteursNP%3A(%22Abdoulaye%20Ndao%22%20OR%20%22Ndao%20Abdoulaye%22)%20OR%20auteursNP%3A(%22Sylvie%20Rangan%22%20OR%20%22Rangan%20Sylvie%22)%20OR%20auteursNP%3A(%22Luis%20Balicas%22%20OR%20%22Balicas%20Luis%22)%20OR%20auteursNP%3A(%22Alexey%20Bezryadin%22%20OR%20%22Alexei%20Bezryadin%22%20OR%20%22Aleksei%20Bezryadin%22))&nombre=16";
const webAbes='https://theses.fr/api/v1/theses/recherche/?q=auteursNP%3A(%22Abdoulaye%20Ndao%22%20OR%20%22Ndao%20Abdoulaye%22)%20AND%20status%3Asoutenue&nombre=8';
{
 const b='https://indexation.univ-fcomte.fr/nuxeo/site/esupversions/4a7dc635-7381-442b-a042-08801c81c4ee';
 const femto='https://www.femto-st.fr/en/femto-people/fadibaida';
 const ucsd='https://matsci.ucsd.edu/faculty/abdoulaye-ndao';
 const title='Métamatériaux métalliques à transmission exaltée à base d’ouvertures annulaires sub-longueur d’ondes : Excitation du mode TEM';
 const note='Franche-Comté 馆藏另一篇原论文第 124 印刷页参考文献第 139 项，具名 Abdoulaye Ndao、SPIM、2013 年并给出完整论文题名《'+title+'》。FEMTO-ST 的 JNOG 2013 原目录交叉核同一 TEM 课题三人合著。保留候选，2013 参考文献与 2014 BU 履历仍需原卷消解。';
 const refs=link('Franche-Comté 馆藏参考文献第 139 项',b)+' · '+link('FEMTO-ST 原研究目录',femto);
 const next='按完整题名向 Franche-Comté 学位馆藏追作者原卷、答辩日期及正式导师，继续核 UCSD／Berkeley 博后正式指导。ABES 公开接口本轮连接超时。';
 const names=[['师承人物 - Fadi I. Baida','baida'],['师承人物 - Jérôme Salvi','salvi']];
 const members=['6a8f7424','447fe930'];
 for(const id of members){
  const p=record.get(id);
  append(fileFor(p.filename),starts('博士导师候选'),note+' '+refs);
  school(p,line=>line.replace('候选；合著线索，论文及年份待核','候选；已核完整论文题名，学位年份和正式指导待核'),refs);
  const e=review(id,[['phd',note,[b,femto,ucsd]]],next);
  if(e.aspects.phd.status==='unresolved')e.aspects.phd.status='group_or_candidate';
  for(const [mentor,key] of names)evidence(e,'phd','candidate',mentor,note,[b,femto,ucsd],key);
  original(id,b,'Franche-Comté 馆藏另一学位论文参考文献第 139 项列 Ndao、SPIM、2013 和完整法语论文题名。');
  original(id,femto,'FEMTO-ST 原档列 2013 JNOG 论文，作者 Abdoulaye Ndao、Jérôme Salvi 与 Fadi Baida，主题为环形孔中 TEM 导模激发。');
  pages.push({record_id:id,url:abesUrl,error:'ABES 公开元数据检索请求在本机连接超时，未取得目录正文。'});
 }
 pages.push({record_id:members[0],url:webAbes,error:'网页工具不支持读取该 ABES 公开 JSON 查询，未取得返回正文。'});
 pages.push({record_id:members[0],url:'https://teams.femto-st.fr/NLO/en',error:'网页工具返回 403，采用可读 FEMTO-ST 人员发表目录。'});
 const first=record.get(members[0]);
 append(index,line=>line.startsWith('- [['+first.filename+'|')&&line.includes(' → 博士导师候选：'),note+' '+refs);
 for(const [mentor] of names)append(fileFor(mentor),starts('博士生候选',first.filename),note+' '+refs);
}
{
 const id='e197f725',p=record.get(id);
 const uiuc='https://physics.illinois.edu/people/directory/profile/bezryadi';
 const dekker='https://ceesdekkerlab.nl/people/';
 const harvard='https://news.harvard.edu/gazette/story/2000/04/thinnest-wires-probe-superconductivity/';
 const paper='https://homes.nano.aau.dk/lg/MolElec2009_files/Porath_Nature_DNA.pdf';
 const mentor='师承人物 - Cees Dekker';
 const note='Dekker 实验室历届成员原名录在 1995 项列 Alexey Bezryadin 及 Illinois 正教授去向。Illinois 院系原档明确 Delft 博后、随后 Harvard 1997–2000 博后。Nature 论文列 Delft 署名并标 Harvard 为 Bezryadin 的现地址。核 Delft 博后组属，个人正式导师及 Delft 的精确月份待查。';
 const refs=link('Dekker 组原名录',dekker)+' · '+link('Illinois 物理系原档',uiuc)+' · '+link('Nature 原刊',paper);
 const pair='[['+mentor+'|Cees Dekker]]';
 const person='[['+p.filename+'|'+p.name+']]';
 edit(fileFor(p.filename),starts('博士后导师候选',mentor),()=>'- 博士后课题组负责人：'+pair+'（Delft）。'+note+' '+refs);
 edit(fileFor(mentor),starts('博士后候选研究者',p.filename),()=>'- 博士后课题组成员：'+person+'（Delft）。'+note+' '+refs);
 edit(index,line=>line.startsWith('- '+person+' → 博士后导师候选：')&&line.includes(mentor),()=>'- '+person+' → 博士后课题组负责人：'+pair+'（Delft）。'+note+' '+refs);
 edit(fileFor(p.filename),starts('核查边界'),()=>'- 核查边界：1995 年 Joseph Fourier University 博士及 Bernard Pannetier 博士课题组沿用，正式导师待查。Delft 博后组属已核。Illinois 与 Harvard 校报核 Harvard 1997–2000 博后，校报称曾与 Tinkham 共事，Harvard 个人指导仍按候选。 '+refs+' · '+link('Harvard 同期校报',harvard));
 school(p,line=>line.replace('Delft、Harvard 博后；Cees Dekker、Michael Tinkham（候选）','Delft Cees Dekker（博后课题组负责人）；Harvard 1997–2000 Michael Tinkham（候选）'),refs);
 const e=review(id,[['postdoc',note+' Harvard 1997–2000 博后与 Tinkham 合作可核，正式个人角色待查。',[dekker,uiuc,paper,harvard]],['research','Illinois 物理系核纳米器件、量子效应、超导纳米线与薄膜，以及量子比特方向。',[uiuc]]],'追查 Joseph Fourier University 博士学位签署，及 Delft 和 Harvard 个人具名任用。');
 e.aspects.postdoc.status='group_or_candidate';
 evidence(e,'postdoc','group_leader',mentor,note,[dekker,uiuc,paper],'dekker');
 original(id,dekker,'Dekker 实验室历届成员原名录列 Alexey Bezryadin 及 Illinois 正教授去向，条目年 1995。');
 original(id,uiuc,'Illinois 物理系原档列 1995 Joseph Fourier University PhD、Delft 博后、1997–2000 Harvard 博后。');
 original(id,paper,'Aalborg University 托管 Nature 原刊，署名列 Bezryadin 在 Delft，作者地址注注明已到 Harvard。');
 pages.push({record_id:id,url:'https://www.nature.com/articles/35001029',error:'原刊入口转认证，采用 Aalborg University 托管的公开原刊 PDF。'});
}
{
 const id='b0f5cba9',p=record.get(id);
 const baylor='https://physics.artsandsciences.baylor.edu/person/dr-luis-balicas';
 const f='https://physics.fsu.edu/person/luis-molinuevo-balicas';
 const hal='https://cv.hal.science/denis-jerome?langChosen=fr';
 const reviewPaper='https://arxiv.org/pdf/cond-mat/9701174';
 const mentor='师承人物 - Denis Jérome';
 const refs=link('Baylor 教师档',baylor)+' · '+link('HAL 研究记录',hal)+' · '+link('Lederer 原稿第 18 页',reviewPaper+'#page=18');
 const note='Baylor 机构履历列 Paris-Sud Orsay LPS 1992–1995 固态物理博士。Lederer 原稿图 1 将高压测量装置示意归于 Luis Balicas 1995 年学位论文，HAL 记录核博士阶段与 Denis Jérome 的同题合作。候选可信度低，追查原卷导师字段。';
 const person='[['+p.filename+'|'+p.name+']]';
 const mentorLink='[['+mentor+'|Denis Jérome]]';
 const candidate='博士导师候选：'+mentorLink+'。'+note+' '+refs;
 edit(fileFor(p.filename),starts('核查边界'),(line,nl)=>'- '+candidate+nl+nl+'- 核查边界：Baylor 原档分列 1992–1995 Orsay 固态物理博士、1995–1996 同校高压实验室博士后及 2026 年 Baylor 物理与材料任用。博后正式指导待查，FSU 现兼任待核。 '+link('Baylor 教师档',baylor));
 const mentorFile=fileFor(mentor);
 if(fs.existsSync(mentorFile))throw Error('Unexpected existing mentor note '+mentorFile);
 files.set(mentorFile,'# Denis Jérome\n\n> [!info] 师承扩展人物\n> 研究有机导体及超导。 '+link('本人 HAL 研究记录',hal)+'\n\n## 师承\n\n- 博士生候选：'+person+'。'+note+' '+refs+'\n');
 edit(index,line=>line.includes(p.filename+'|')&&line.includes('→ 博士导师候选：')&&line.includes('Daniel Rhodes'),(line,nl)=>line+nl+'- '+person+' → '+candidate);
 school(p,line=>line.replace(' | 待核 | 待核 | ',' | Denis Jérome（博士候选）；Orsay 1995 论文出处线索 | Orsay 高压实验室 1995–1996 博后，导师待核 | '),refs);
 const e=review(id,[['phd',note,[baylor,hal,reviewPaper]],['postdoc','Baylor 教师档明确 1995–1996 年 Paris-Sud Orsay 高压实验室博士后；未具名个人指导。',[baylor]],['affiliation','Baylor 2026 年 Physics and Astronomy 及 Materials Science & Engineering Initiative 教授；FSU 既有任用档继续保留历史身份。',[baylor,f]]],'按 Orsay 1995 博士论文与高压实验室名录追正式指导；FSU 兼任仍待核。');
 if(e.aspects.phd.status==='unresolved')e.aspects.phd.status='group_or_candidate';
 evidence(e,'phd','candidate',mentor,note,[baylor,hal,reviewPaper],'jerome');
 original(id,reviewPaper,'Lederer 原稿第 18 页的图 1 图注归材料于 Luis Balicas 1995 年学位论文。');
 original(id,hal,'HAL 研究记录列 1994 和 1995 年的多篇 Balicas 与 Denis Jérome 同署名有机导体研究。');
 original(id,baylor,'Baylor 院档分列 1992–1995 Paris-Sud 博士、1995–1996 高压实验室博士后及 2026 Baylor 教职。');
}
{
 const id='62c4df3b',p=record.get(id);
 const award='https://www.colloidssurfaces.org/about/history/';
 const chem='https://www.cheme.engineering.cmu.edu/alumni/alumni-academia.html';
 const jhu='https://engineering.jhu.edu/chembe/faculty/michael-bevan/';
 const note='ACS 胶体与表面科学分会原获奖史表列 Michael Bevan 为 Carnegie Mellon 的 1998 Graduate Fellowship 获奖者；Carnegie Mellon 化工校友表具名 Johns Hopkins 去向。继续查 1999 学位原卷及正式指导。';
 const refs=link('ACS 博士阶段获奖档',award)+' · '+link('CMU 化工博士校友档',chem);
 append(fileFor(p.filename),starts('核查边界'),note+' '+refs);
 school(p,line=>line,refs);
 const e=review(id,[['identity',note,[award,chem,jhu]]],'查 CMU 学位纸本与 Melbourne 博后任用。Prieve 的博士候选和 UIUC 两条已核组属继续保留。');
 original(id,award,'ACS 分会 Graduate Fellowship 1998 年表列 Michael Bevan、Carnegie Mellon。');
 original(id,chem,'Carnegie Mellon 化工博士学术校友名单列 Michael Bevan、Johns Hopkins。');
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
