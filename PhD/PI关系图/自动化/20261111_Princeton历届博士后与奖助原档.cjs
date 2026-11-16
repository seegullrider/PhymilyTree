
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_Princeton历届博士后与奖助原档';
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
 event.audit_id = 'pi_archive_20261111_pcts_pccm_' + id;
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



const pccm='https://pccm.princeton.edu/people/alumni';
const pcts='https://pcts.princeton.edu/people/past-postdocs';
const pctsBook='https://pcts.princeton.edu/sites/g/files/toruqf1126/files/documents/FINAL%20MASTER%20-PRINTEDPCTS--program--LMC--5-3-16-LMC.pdf';
const prev=id=>JSON.parse(priorAudit.get(id).details_json);
function phaseReceipt(id,description,refs,urls) {
 const p=record.get(id), file=fileFor(p.filename), prior=prev(id);
 edit(file,starts('核查边界'),(line,nl)=>line+nl+'- 博士后任用核对：'+description+' '+refs);
 school(p,line=>line,refs);
 const e=review(id,[['postdoc',prior.aspects.postdoc.note+' '+description,urls]],prior.next_step);
 e.followup_required=prior.followup_required;
 original(id,urls[0],description);
}
for(const [id,years] of [
 ['afcac2e1','2008–2011'],['0785a294','2006–2009'],
 ['f8570b4c','2009–2012'],['41c1e5a1','2014–2016'],
 ['cff12e56','2014–2016'],['0c560aa5','2015–2018'],
 ['bdc589a4','2015–2018'],['a66d9ce2','2013–2016'],
 ['375e1de6','2013–2016'],['a66f333a','2012–2015'],
 ['98da4d54','2011–2014'],
]){
 const detail='Princeton PCTS 十周年原册与历届人员页列为博士后 Fellow，原册所列任期 '+years+'。该任用原册未列个人导师。';
 const urls=[pctsBook,pcts];
 if(id==='98da4d54')urls.push('https://pcts.princeton.edu/document/2246');
 const refs=link('Princeton PCTS 十周年原册',pctsBook)+(urls.length>2?' · '+link('2012 年同期名册',urls[2]):'');
 phaseReceipt(id,detail,refs,urls);
}
for(const [id,detail] of [
 ['70c0251a','Princeton PCTS 历届人员页独立核为 Postdoctoral Fellow。本人 Rice 履历的 2020–2023 任期保留。'],
 ['5d4ae163','Princeton PCTS 历届人员页独立核为 Postdoctoral Fellow。Bernevig 组档中 2017–2020 的旧组员与博士后合作者混合名单继续作为候选线索。']
]) phaseReceipt(id,detail,link('Princeton PCTS 历届名录',pcts),[pcts]);
for(const [id,years] of [
 ['a9177c60','2015–2017'],['5c17c174','2017–2019'],['af67bf6b','2019–2023'],
 ['bc7d318e','2020–2023'],['6d67251e','2021–2024'],['763e78d4','2014–2016'],
]) phaseReceipt(id,'Princeton PCCM 校友原档核 '+years+' 年的 PCCM 博士后任用。导师角色沿用对应具名证据。',link('Princeton PCCM 校友档',pccm),[pccm]);
{
 const id='24363548',pccmPerson='https://pccm.princeton.edu/people/stevan-nadj-perg',caltech='https://www.caltech.edu/about/news/new-cohort-of-moore-experimental-physics-investigators-includes-stevan-nadj-perge';
 phaseReceipt(id,'PCCM 历届名录将姓名缩为 Stevan Nadj-Perg。个人页照片标全名，列 2012–2014 任用并链接 Caltech 本人实验室，与 Caltech 现职及量子材料方向吻合。Yazdani 保留博后课题组角色。',link('PCCM 本人页',pccmPerson)+' · '+link('Caltech 任职档',caltech),[pccmPerson,caltech]);
}
{
 const id='85880155',p=record.get(id),m='师承人物 - Pablo Debenedetti',yale='https://haji-akbari.yale.edu/profile/amir-haji-akbari';
 const note='Yale 本人组档明确列 Princeton PCCM 博后所属 Pablo Debenedetti 组。PCCM 校友档的任期为 2012–2016，Yale 本人档列 2017 年入 Yale、2025 年晋升化学与环境工程副教授。个人导师称谓仍待查。';
 const refs=link('Yale 本人组档',yale)+' · '+link('Princeton PCCM 校友档',pccm);
 append(fileFor(p.filename),starts('博士后课题组',m),note+' '+refs);
 append(fileFor(m),starts('博士后课题组成员',p.filename),note+' '+refs);
 append(index,line=>line.startsWith('- [['+p.filename+'|')&&line.includes(' → 博士后课题组：')&&line.includes(m),note+' '+refs);
 school(p,line=>line.replace('Pablo Debenedetti（课题组）','Pablo Debenedetti（2012–2016 Princeton 博士后课题组）'),refs);
 const old=prev(id);
 const e=review(id,[['postdoc',note,[yale,pccm]],['affiliation','Yale 化学与环境工程系有终身教职副教授，2025 年起。',[yale]],['research','计算软物质和生物系统的相变热力学、动力学及统计物理。',[yale]]],old.next_step);
 evidence(e,'postdoc','group_leader',m,note,[yale,pccm],'postdoc');
 original(id,yale,note);
}
{
 const id='f1b7f760',p=record.get(id),m='人员 - MIT - Jeremiah A. Johnson - 71033140';
 const lsrf='https://lsrf.org/alumni-fellows/', mit='https://web.mit.edu/johnsongroup/', wash='https://artsci.washu.edu/faculty-staff/jonathan-barnes';
 const note='LSRF 2014 奖助原档在 Jonathan Barnes 条目具名 Jeremiah Johnson 为 Postdoc Mentor。MIT 课题组原档核 2014–2016 博士后阶段，WashU 核该奖项、MIT 博后与现任化学副教授。';
 const refs=link('LSRF 奖助原档',lsrf)+' · '+link('MIT 课题组档案',mit)+' · '+link('WashU 教师档',wash);
 const update=line=>line.split('。Life Sciences Research Foundation')[0]+'。'+note+' '+refs;
 edit(fileFor(p.filename),starts('博士后阶段研究师长',m),line=>update(line.replace('博士后阶段研究师长：','博士后导师：')));
 edit(fileFor(p.filename),starts('核查边界'),line=>line.replace('MIT 博后阶段研究师长及任期见上。','MIT 博后导师与任期见上。'));
 edit(fileFor(m),starts('博士后阶段受指导者',p.filename),line=>update(line.replace('博士后阶段受指导者：','博士后研究者：')));
 edit(index,line=>line.startsWith('- [['+p.filename+'|')&&line.includes(' → 博士后阶段研究师长：')&&line.includes(m),line=>update(line.replace(' → 博士后阶段研究师长：',' → 博士后导师：')));
 school(p,line=>line.replace('MIT 博士后阶段研究师长，2014–2016','MIT 博士后导师，2014–2016'),refs);
 const old=prev(id);
 const e=review(id,[['postdoc',note,[lsrf,mit,wash]]],old.next_step);
 e.aspects.postdoc.status='confirmed_advisor';
 e.followup_required=old.followup_required;
 evidence(e,'postdoc','advisor',m,note,[lsrf,mit,wash],'postdoc');
 original(id,lsrf,note);
}
{
 const id='abc5d1b8',p=record.get(id),pp='https://cbe.princeton.edu/people/pablo-debenedetti';
 const m='师承人物 - Pablo Debenedetti';
 const refs=link('Princeton 院系原档',pp);
 const other='[[人员 - Princeton - Pablo G. Debenedetti - abc5d1b8|Pablo G. Debenedetti · Princeton]]';
 edit(fileFor(p.filename),starts('同人节点'),line=>line+' 另见 [['+m+'|原简称节点]]。'+refs);
 edit(fileFor(m),line=>line.startsWith('[建立节点的来源]'),(line,nl)=>'- 同人校属页：'+other+'。保留既有指导反链。'+refs+nl+line);
 const schoolPage='../院校与机构/院校 - Princeton.md';
 edit(schoolPage,line=>line==='- [[人员 - Princeton - Pablo G. Debenedetti - abc5d1b8|Pablo G. Debenedetti]]',line=>line+'（荣休）');
 school(p,line=>line.replace('化学与生物工程系；','化学与生物工程系（荣休）；'),refs);
 original(id,pp,'Princeton 化学与生物工程荣休教授，研究复杂液体的分子热力学及相变，教育栏列 1985 年 MIT 博士。');
 original(id,'https://journals.flvc.org/cee/article/view/122145/121102','Chemical Engineering Education 本人专访称其博士阶段导师为 Bob Reid。');
}
for(const [id,url,note] of [
 ['67c0e0e0','https://presse.uni-mainz.de/files/2023/01/diesacademicus2016.pdf','Mainz 校方原册列 2015 年 10 月博士，论文 Betreuer der Dissertation 为 Kurt Binder。'],
 ['67c0e0e0','https://press.uni-mainz.de/files/2023/01/MAINZ_brochure2014.pdf','MAINZ 研究生项目名录编号 60 列 Antonia Statt 的项目与 Main supervisor Prof. Virnau。'],
 ['67c0e0e0','https://mrl.illinois.edu/directory/profile/statt','UIUC 材料及化工联聘，Princeton 2016 年 4 月至 2019 年 11 月博后，研究高分子及胶体结晶。'],
 ['e922865e','https://cse.umn.edu/me/meera-ramaswamy','Minnesota 机械工程助理教授，Cornell 2022 物理博士，Princeton PCCM 2022 年 6 月至 2025 年 6 月博后。研究主动悬浮液和软材料力学。'],
 ['e922865e','https://cohengroup.ccmr.cornell.edu/file/289/download','Itai Cohen CV 在 Graduate Students Supervised 中列 2014–2022 Meera Ramaswamy。'],
 ['e922865e','https://cbe.princeton.edu/sites/g/files/toruqf1386/files/documents/Datta%20CV.pdf','Datta 本人 CV 在 Mentoring 下列 Meera Ramaswamy 为 2022 年 6 月起的博士后。'],
 ['62a8fc8c','https://experts.colorado.edu/vitas/172688.pdf','Bay CV 第 1 页列 Alfred J. Crosby 为 2020 年 UMass Amherst 博士论文导师，Sujit S. Datta 为 2020 年 7 月至 2022 年 6 月 Princeton 博后 Research Advisor。另列 Colorado 现任与材料项目联聘。'],
 ['62a8fc8c','https://www.colorado.edu/chbe/r-konane-bay','Colorado 化学与生物工程助理教授，获 Princeton Presidential Postdoctoral Fellowship，学位来自 UMass Amherst。']
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
