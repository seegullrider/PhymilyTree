
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_新加坡及Stanford原档';
const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const files = new Map();
const audits = [];
const relations = [];
const pages = [];
const record = db.prepare('SELECT name, unit, filename FROM records WHERE id=?');
const priorAudit = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const fileFor = filename => '../人物/' + filename + '.md';
const link = (label,url) => '[' + label + '](' + url + ')';
const roster = 'https://vahala.caltech.edu/alumni';
const vahala = '人员 - Caltech - Kerry Vahala - 20861ff7';
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
 event.audit_id = 'pi_archive_20261111_nus_stanford_' + id;
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
function school(p,change,refs) {
 const lineKey = '| [['+p.filename+'|';
 edit('../'+p.unit+'逐人复核记录.md',line=>line.startsWith(lineKey),line=>change(line).trimEnd().slice(0,-1).trimEnd()+' · '+refs+' |');
}
const bro='https://brongersma.stanford.edu/alumni/';
const mark='人员 - Stanford - Mark Brongersma - 2026ea79';
const starts = (label,filename) => line=>line.startsWith('- '+label+'：')&&(!filename||line.includes(filename));
const idx = (p,label) => line=>line.includes(p.filename+'|')&&line.includes(' → '+label+'：');
{
 const id='972ae77b', p=record.get(id);
 const cu='https://research.cuhk.edu.hk/en/persons/ady-suwardi/';
 const cv='https://site-5csged2g.wsecdn1.websitecdn.com/uploads/b286986fbd9e477d939b2f6362262183.pdf?v=250707122319';
 const old='https://site-5csged2g.websitecdn.com/uploads/692f8946405f4e53834409d053790cf6.pdf?v=221901010724';
 const a='https://research.a-star.edu.sg/researcher/ady-suwardi/';
 const nus='https://cde.nus.edu.sg/mse/news/cde-researchers-honoured-among-regions-rising-young-scientists/';
 const affiliation='CUHK 机构档明列现任电子工程 Vice-Chancellor Assistant Professor；较新本人 CV 记 2024 年 3 月开始 CUHK、2021 年 5 月至 2025 年 4 月 NUS 材料兼职、2018–2024 A*STAR IMRE Senior Scientist 和组长。2024 年 NUS 机构新闻独立核对当时的兼职。';
 const post='本人较新 CV 从 2018 年 10 月 Cambridge 材料博士接到 2018–2024 A*STAR IMRE Scientist／组长任用，早期 CV 记 Scientist 从 2017 年 10 月起，A*STAR 简介称获博士学位后加入 IMRE。保留年份差异。两版 CV 及机构履历未发现单列博士后经历，IMRE 初聘细项待核。';
 const next='继续查 2017–2018 IMRE 初聘原档和 Cambridge 学位原卷的共同指导署名。';
 const refs=link('CUHK 本人原档',cu)+' · '+link('较新本人 CV',cv)+' · '+link('NUS 任用历史原档',nus);
 edit(fileFor(p.filename),line=>line.startsWith('- 本人履历列 2018–2024 年'),()=>'- '+affiliation+' '+refs);
 append(fileFor(p.filename),starts('核查边界'),post+' '+next+' '+link('早期 CV',old)+' · '+refs);
 school(p,line=>line.replace('材料研究与工程研究所（历史任职）；','材料研究与工程研究所（历史）、NUS 材料兼职（至 2025 年 4 月）、现 CUHK 电子工程；').replace('博士后经历与指导待核','履历未见单列博士后，IMRE 初聘待核'),refs);
 const e=review(id,[['affiliation',affiliation,[cu,cv,nus,a]],['research','CUHK 机构档核热电材料与器件、热管理和能源材料，A*STAR 原档核固态电子与热输运。',[cu,a]],['postdoc',post,[cv,old,a,cu]]],next);
 if(e.aspects.postdoc.status==='unresolved')e.aspects.postdoc.status='no_postdoc_documented';
 original(id,cv,'较新本人 CV 同列 2018 年 10 月 Cambridge PhD、2018–2024 IMRE、2021 年 5 月至 2025 年 4 月 NUS 兼职、2024 年 3 月起 CUHK。');
 original(id,old,'较早本人 CV 将 A*STAR Scientist 列为 2017 年 10 月起、NUS 任用从 2021 年 5 月起。');
 original(id,cu,'CUHK 官方人物页列电子工程助理教授、2018 Cambridge 学位和热电材料与器件研究。');
 original(id,nus,'NUS 2024 年原报道列同一 Ady Suwardi 为材料科学与工程系兼职助理教授。');
 pages.push({record_id:id,url:'https://www.ee.cuhk.edu.hk/en-gb/people/academic-staff/professors/1228-prof-suwardi-ady',error:'网页工具超时，改用 CUHK 官方研究档及本人履历。'});
}
{
 const id='db3c5103',p=record.get(id);
 const interview='https://rafflespress.com/2023/04/22/women-in-stem-how-its-going/';
 const self='https://ho-pin.weebly.com/about.html';
 const official='https://www.sutd.edu.sg/profile/ho-pin';
 const mentor='人员 - MIT - Caroline A. Ross - dda4a28b';
 const statement='本人访谈回忆由 A*STAR fellowship 支持与 Caroline Ross 在 MIT 共事；本人履历明确 Ross Research Group 博后，SUTD 记 2016 入职 A*STAR 前在 MIT 任 Research Associate。组负责人有交叉证据，正式任用的个人导师职衔及离任日期待核。';
 const detail=statement+' '+link('Ho Pin 本人访谈',interview);
 append(fileFor(p.filename),starts('博士后课题组负责人',mentor),detail);
 append(fileFor(mentor),starts('博士后课题组成员',p.filename),detail);
 append(index,idx(p,'博士后课题组负责人'),detail);
 school(p,line=>line,link('Ho Pin 本人访谈',interview));
 const e=review(id,[['postdoc',statement,[interview,self,official]]],'查 NUS 学位原件，Jingsheng Chen 原教学页人机验证保持。继续查 MIT 与 A*STAR 博后正式任命及日期。');
 evidence(e,'postdoc','group_leader',mentor,statement,[interview,self,official],'ross');
 original(id,interview,'2023 本人采访明确 Ho Pin 获 A*STAR fellowship 到 MIT 并与 Caroline Ross 共事。');
}
{
 const id='e2ac7533',p=record.get(id);
 const asu='https://labs.engineering.asu.edu/celano/people';
 const official='https://search.asu.edu/profile/4356780';
 const day='https://nano.web.uniroma1.it/en/nanoday-2019';
 const note='Stanford Brongersma 组原校友名录明确 Celano 为 Visiting Scholar；既有 ASU 原档记 2018 年赴 Stanford GLAM 访问。Sapienza 2019 校友活动的索引另有访问科学家线索，原页本轮未能取得。已核为访问，其他博士后经历及个人指导待查。';
 const refs=link('Stanford 原校友名录',bro);
 append(fileFor(p.filename),starts('核查边界'),note+' '+refs);
 school(p,line=>line.replace(' | 待核 | ',' | Stanford 访问科学家，博士后经历及导师待核 | '),refs);
 review(id,[['postdoc',note,[bro,official]],['research','本人 ASU 组页核半导体材料和器件的纳米计量、表征、凝聚态与纳米电子学。',[asu]]],'追查 imec 2015 后的初聘及是否有单列博士后；Stanford 已明确访问类别。');
 original(id,bro,'Stanford Brongersma Alumni 列 Umberto Celano 为 Visiting Scholar。');
 original(id,asu,'ASU 课题组本人页核纳米电子、凝聚态、半导体技术和材料分析。');
 pages.push({record_id:id,url:day,error:'网页工具返回 cache miss。Sapienza 索引保留为线索，采用可读的 Stanford 原始名录。'});
 pages.push({record_id:id,url:'https://brongersma.stanford.edu/news/',error:'网页工具返回 403，改用可读的官方校友原页。'});
}
{
 const id='727a3ce1',p=record.get(id);
 const ucsb='https://www.ece.ucsb.edu/people/faculty/jon-schuller';
 const lab='https://schuller.cnsi.ucsb.edu/people/jon-schuller';
 const note='Stanford Brongersma 组官方名录具名 Jon Schuller 为 PhD Student，UCSB 本人组档核 2009 Stanford 博士和现任教授。博士阶段研究师长有既有本人履历，学位正式签署待查。';
 const detail=note+' '+link('Stanford 组原名录',bro)+' · '+link('UCSB 本人组档',lab);
 append(fileFor(p.filename),starts('博士阶段研究师长',mark),detail);
 append(fileFor(mark),starts('博士阶段研究者',p.filename),detail);
 append(index,idx(p,'博士阶段研究师长'),detail);
 school(p,line=>line,link('Stanford 组原名录',bro));
 const e=review(id,[['phd',note,[bro,lab,ucsb]]],'追查 Stanford 博士论文签署及 Columbia Energy Frontier Research Center 博后的个人任用资料。');
 evidence(e,'phd','stage_mentor',mark,note,[bro,lab,ucsb],'brongersma');
 original(id,bro,'Stanford Brongersma Alumni 将 Jon Schuller 列为 PhD Student。');
 pages.push({record_id:id,url:'https://searchworks.stanford.edu/?q=%22Jon+Schuller%22&search_field=search',error:'目录查询页无法访问，本轮不重复请求。'});
}
{
 const id='7c505fb7',p=record.get(id);
 const dept='https://ece.gatech.edu/directory/wenshan-cai';
 const bio='https://biox.stanford.edu/highlight/plasmonics-intensifies-novel-nanoscale-light-source-stanford-engineers-find';
 const note='Stanford Brongersma 官方校友页具名 Wenshan Cai 为 PostDoc，Stanford Bio-X 同期稿明列在该组任博后。Georgia Tech ECE 原档核 2012 入职前 Stanford 博后及 ECE 主聘、材料联聘。正式个人导师称谓待核。';
 const detail=note+' '+link('Stanford 组原名录',bro)+' · '+link('Georgia Tech ECE 原档',dept);
 append(fileFor(p.filename),starts('博士后课题组负责人',mark),detail);
 append(fileFor(mark),starts('博士后课题组成员',p.filename),detail);
 append(index,idx(p,'博士后课题组负责人'),detail);
 school(p,line=>line,link('Stanford 组原名录',bro));
 const e=review(id,[['postdoc',note,[bro,bio,dept]],['affiliation','Georgia Tech ECE 正教授，材料科学与工程联聘。',[dept]],['research','Georgia Tech ECE 原档列纳米光子材料与器件、二维材料及等离激元。',[dept]]],'查 Stanford 博后正式个人任用或导师 CV，并继续追 Purdue 2008 学位原卷。');
 evidence(e,'postdoc','group_leader',mark,note,[bro,bio,dept],'brongersma');
 original(id,bro,'Stanford Brongersma Alumni 具名 Wenshan Cai 为 PostDoc。');
}
{
 const id='4b258809',p=record.get(id);
 const rice='https://profiles.rice.edu/faculty/xiang-zhang';
 const uw='https://pm.polyu.edu.hk/taowu/group/members.html';
 const phd='https://repository.rice.edu/bitstreams/f798c086-6aea-412b-8e07-88e46c0ae2a7/download';
 const note='PolyU Wu 组校友名录另列 ZHANG Xiang 为曾在该组博后、去向上海交通大学副教授。Rice 机构履历和本人学位证据确认本记录的 2018 Rice 学位及 Ajayan 组博后；PolyU 名录缺少可连接两人经历的资料，排除本次自动匹配，未增加 Wu 组博后关系。';
 append(fileFor(p.filename),starts('核查边界'),note+' '+link('PolyU 组原档',uw)+' · '+link('Rice 教师原档',rice));
 school(p,line=>line,link('同名消歧 PolyU 原档',uw));
 review(id,[['identity',note,[rice,phd,uw]]],'核 Rice 本人 Ajayan 组博后正式称谓；PolyU 同名条目保持排除，若取得具体履历再交叉核。');
 original(id,rice,'Rice 官方人物页核该记录为 Rice 博士且博士毕业后继续在 Ajayan 组开展博士后研究。');
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
