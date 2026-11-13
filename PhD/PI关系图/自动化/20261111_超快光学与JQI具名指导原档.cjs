
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_超快光学与JQI具名指导原档';
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
 event.audit_id = 'pi_archive_20261111_jila_jqi_' + id;
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



const kcv='https://experts.colorado.edu/vitas/115334.pdf';
const prev=id=>JSON.parse(priorAudit.get(id).details_json);
function copyReview(id, changes, next) {
 const prior=prev(id);
 const e=review(id,changes,next??prior.next_step);
 e.followup_required=prior.followup_required;
 return e;
}
const iLine=(p,role,mentor)=>line=>line.startsWith('- [['+p.filename+'|')&&line.includes(' → '+role+'：')&&line.includes(mentor);
{
 const id='8f7f4bb3',p=record.get(id),f=fileFor(p.filename), m='师承人物 - Kartik Srinivasan';
 const cmu='https://ece.cmu.edu/directory/bios/li-qing.html';
 const cmut='https://bpb-us-e1.wpmucdn.com/sites.gatech.edu/dist/f/423/files/2013/11/LI-DISSERTATION-2013.pdf?bid=423';
 const cv='https://hub.jqi.umd.edu/sites/default/files/2022-08/KS_CV_Mar2020.pdf';
 const nist='https://www.nist.gov/awards/2020-paul-f-forman-team-engineering-excellence-award';
 const same='Kapteyn CV 中的 2011 年 Colorado 物理博士 Qing Li 与本条为不同人。CMU 院系及 Georgia Tech 论文原卷列本条为 2013 年 Georgia Tech 电气与计算机工程博士，研究集成光子学。';
 const role='Srinivasan 本人 CV 第 3 页在 Group Members Advised 的 Postdoctoral Scholar 栏逐人列 Qing Li、2013–2018、集成量子频率转换与微梳，并列 Carnegie Mellon 去向。CMU ECE 明确 NIST CNST/UMD 博后，NIST 具名同期研究岗位。';
 const refs=link('Srinivasan 本人 CV 第 3 页',cv)+' · '+link('CMU ECE 原档',cmu)+' · '+link('NIST 同期任用',nist);
 const upgrade=(line,a,b)=>line.replace(a,b).split('。')[0]+'。'+role+' '+refs;
 edit(f,starts('博士后阶段研究师长',m),line=>upgrade(line,'博士后阶段研究师长：','博士后导师：'));
 edit(fileFor(m),starts('博士后阶段受指导者',p.filename),line=>upgrade(line,'博士后阶段受指导者：','博士后研究者：'));
 edit(index,iLine(p,'博士后阶段研究师长',m),line=>upgrade(line,' → 博士后阶段研究师长：',' → 博士后导师：'));
 edit(f,starts('核查边界'),(line,nl)=>line.replace('博士后 CV 明确有指导，但未见聘任文件，标阶段研究师长。','博士后个人指导已由导师本人履历的逐人指导栏确认。')+nl+'- 学位名录同名核对：'+same+' '+link('Kapteyn CV',kcv)+' · '+link('CMU ECE 原档',cmu));
 school(p,line=>line.replace('Kartik Srinivasan（博士后阶段研究师长）','Kartik Srinivasan（2013–2018 NIST 博士后导师）'),refs);
 const old=prev(id);
 const e=copyReview(id,[['identity',old.aspects.identity.note+' '+same,[cmu,cmut,kcv]],['affiliation','CMU 电气与计算机工程系副教授。',[cmu]],['research','集成光子、芯片级量子器件和非线性光学。',[cmu]],['postdoc',role,[cv,cmu,nist]]],'NIST 博后具体任用原件可继续补，保留 CV 具名指导。');
 e.aspects.postdoc.status='confirmed_advisor';
 evidence(e,'postdoc','advisor',m,role,[cv,cmu,nist],'postdoc');
 original(id,cmu,same);
 original(id,cv,role);
 original(id,nist,'NIST 的 2020 获奖团队原档分别将 Srinivasan 列项目负责人、Qing Li 列 2016–2018 Research Associate；此为该项目期间的称谓和时间。');
}
{
 const id='bf735e62',p=record.get(id),f=fileFor(p.filename),m='人员 - Colorado Boulder - Henry Kapteyn - cfb6903b';
 const erc='https://erc-history.erc-assoc.org/erc-history/chapter-10-major-impacts-on-academic-engineering/';
 const uci='https://faculty.uci.edu/profile/?facultyId=6158';
 const note='EUV ERC 项目原档明确 Dollar 在 JILA 的博士后研究阶段由 Murnane 与 Kapteyn 两人提供指导，UCI 核联合组任用。Kapteyn 记具名阶段研究师长，UCI 本人访谈的明确 postdoctoral advisor 为 Murnane。';
 const refs=link('EUV ERC 项目原档',erc)+' · '+link('UCI 院系',uci);
 const upgrade=(line,a,b)=>line.replace(a,b).split('。')[0]+'。'+note+' '+refs;
 edit(f,starts('博士后课题组负责人',m),line=>upgrade(line,'博士后课题组负责人：','博士后阶段研究师长：'));
 edit(fileFor(m),starts('博士后课题组成员',p.filename),line=>upgrade(line,'博士后课题组成员：','博士后阶段受指导者：'));
 edit(index,iLine(p,'博士后课题组负责人',m),line=>upgrade(line,' → 博士后课题组负责人：',' → 博士后阶段研究师长：'));
 school(p,line=>line.replace('Henry Kapteyn（博士后课题组负责人）','Henry Kapteyn（博士后阶段研究师长）'),refs);
 const old=prev(id);
 const e=copyReview(id,[['postdoc',old.aspects.postdoc.note+' '+note,[erc,uci]]]);
 evidence(e,'postdoc','stage_mentor',m,note,[erc,uci],'postdoc_kapteyn');
 original(id,erc,note);
 original(id,'https://www.physics.uci.edu/node/14341','Dollar 本人采访具名 JILA 博后导师 Margaret Murnane 及 Michigan 论文导师 Karl Krushelnick。');
 original(id,uci,'UCI 物理与天文学系教授和研究生教育副院长，2012 Michigan 应用物理博士；JILA 任用为 2012–2014 Research Associate、2014–2015 Senior Research Associate。');
}
{
 const id='cfb6903b',p=record.get(id),m='师承人物 - Roger W. Falcone',th='https://jila.colorado.edu/~kapteyn/Research/Thesis%20formatted.pdf';
 const note='本人托管论文《Photoionization-Pumped Short-Wavelength Lasers》的致谢第 v 页明确称 Roger Falcone 为 thesis advisor，CV 的 1989 Berkeley 博士栏互证。';
 const refs=link('Kapteyn 博士论文原卷',th);
 append(fileFor(p.filename),starts('博士导师',m),note+' '+refs);
 append(fileFor(m),starts('博士生',p.filename),note+' '+refs);
 append(index,iLine(p,'博士导师',m),note+' '+refs);
 school(p,line=>line.replace('Roger W. Falcone | 待核','Roger W. Falcone | 1989–1990 Berkeley 博后，导师待核'),refs);
 const old=prev(id);
 const e=copyReview(id,[['phd',old.aspects.phd.note+' '+note,[th,kcv]]]);
 evidence(e,'phd','advisor',m,note,[th,kcv],'phd');
 original(id,th,note);
}
{
 const id='fd08ed01',p=record.get(id),m='师承人物 - Roger W. Falcone';
 const talk='https://www.colorado.edu/researchinnovation/2021/03/18/buff-innovator-insights-podcast-dr-margaret-murnane-jila-physics-strobe';
 const nas='https://pmc.ncbi.nlm.nih.gov/articles/PMC1569154/';
 const note='Colorado 本人访谈确认她与 Kapteyn 在 Berkeley 同为该实验室早期研究生。NAS 人物原文具名 Roger Falcone 并明确该组为其博士研究所在。签署页尚未读到，保留博士组属；1989–1990 PPFP 导师名字异文继续查。';
 const refs=link('Colorado 本人访谈',talk)+' · '+link('NAS 人物原文',nas);
 append(fileFor(p.filename),starts('博士课题组负责人',m),note+' '+refs);
 append(fileFor(m),starts('博士课题组成员',p.filename),note+' '+refs);
 append(index,iLine(p,'博士课题组负责人',m),note+' '+refs);
 school(p,line=>line,refs);
 const old=prev(id);
 const e=copyReview(id,[['phd',old.aspects.phd.note+' '+note,[talk,nas]]]);
 evidence(e,'phd','group_leader',m,note,[talk,nas],'phd');
 original(id,talk,note);
}
{
 const id='945105b9',p=record.get(id),th='https://jila.colorado.edu/sites/default/files/2019-04/hogle_thesis_20140718_0.pdf';
 const fac='https://www.physics.ucsd.edu/research/condensed-matter-physics';
 const u='https://profiles.ucsd.edu/tenio.popmintchev';
 const title='Tunable Ultrafast Coherent Light in the Soft and Hard X-ray Regions of the Spectrum: Phase Matching of Extreme High-Order Harmonic Generation';
 const note='JILA 托管 Hogle 学位论文的参考文献列其博士论文《'+title+'》及 2009；UCSD 本人履历的学位栏为 2010。论文全文转载入口返回 502，原卷及共同导师签署待核。';
 const refs=link('JILA 论文书目原文',th)+' · '+link('UCSD 物理系方向页',fac);
 append(fileFor(p.filename),starts('核查边界'),note+' '+refs);
 school(p,line=>line,refs);
 const old=prev(id);
 copyReview(id,[['phd',old.aspects.phd.note+' '+note,[th,u]],['affiliation','UCSD 物理系教师目录及本人档列 Assistant Professor；物理系列入 AMO 及凝聚态方向。',[u,fac]],['research','超快光学、相干 X 射线与面向材料的超快成像。',[u,fac]]]);
 original(id,th,note);
 original(id,fac,'UCSD 物理系凝聚态方向教师名录列 Tenio Popmintchev。');
 pages.push({record_id:id,url:'https://www.academia.edu/28990020/Tunable_Ultrafast_Coherent_Light_in_the_Soft_and_Hard_X_ray_Regions_of_the_Spectrum_Phase_Matching_of_Extreme_High_Order_Harmonic_Generation',error:'网页工具 HTTP 502，未取得论文原件内容。检索索引转写只作线索。'});
}
for(const [id,url,note] of [
 ['328a2596','https://thesis.caltech.edu/1816/','CaltechTHESIS 2006 应用物理博士记录具名 Oskar J. Painter 为 Advisor。'],
 ['328a2596','https://jqi.umd.edu/people/kartik-srinivasan','JQI 院档列 Adjunct Professor、JQI Co-Director、Caltech 博后与集成量子光子学。'],
 ['1fff70c0','https://physics.berkeley.edu/people/faculty/roger-falcone','UC Berkeley 物理系 Graduate School 荣休教授，关联 Applied Science and Technology 与 Energy and Resources。Stanford 1979 电气工程博士、1980–1983 Marvin Chodorow Fellow。'],
 ['1fff70c0','https://physics.berkeley.edu/research-faculty/roger-falcone-research-group/curriculum-vitae','本人组 CV 区分 Stanford 学位与 fellowship，后任 Berkeley 1983 起；两阶段未具名个人导师。']
]) original(id,url,note);

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
