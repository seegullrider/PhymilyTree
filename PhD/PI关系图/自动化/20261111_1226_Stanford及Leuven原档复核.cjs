const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const batch = '20261111_1226';
const files = new Map(), audits = [], edges = [], pages = [];
const getRecord = db.prepare('SELECT name,unit,filename FROM records WHERE id=?');
const getAudit = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const person = filename => '../人物/' + filename + '.md';
const index = '../师承关系索引.md';
const roster = 'https://nanoheat.stanford.edu/alumni/';
const link = (label,url) => '[' + label + '](' + url + ')';
const read = file => files.get(file) ?? fs.readFileSync(file,'utf8');

function change(file, predicate, replace) {
 const old = read(file);
 const nl = old.includes('\r\n') ? '\r\n' : '\n';
 const lines = old.split(/\r?\n/);
 const at = lines.flatMap((line,i) => predicate(line) ? [i] : []);
 if (at.length !== 1) throw Error(file + ' matched ' + at.length);
 lines[at[0]] = replace(lines[at[0]],nl);
 files.set(file,lines.join(nl));
}
function append(file, predicate, addition) {
 change(file,predicate,line => line.includes(addition) ? line : line + ' ' + addition);
}
function addSectionLine(file, addition) {
 if (read(file).includes(addition)) return;
 change(file,line => line === '## 师承',(line,nl) => line + nl + nl + addition);
}
function school(record, sources, oldText, newText) {
 change('../' + record.unit + '逐人复核记录.md',line => line.startsWith('| [[' + record.filename + '|'),line => {
  const first = line.indexOf(']]') + 2;
  const tail = line.slice(first,-2).split(' | ');
  if (tail.length !== 5 || !line.endsWith(' |')) throw Error('Invalid school row ' + record.name);
  if (oldText) {
   if (tail[3] !== oldText && tail[3] !== newText) throw Error('Unexpected stage cell ' + tail[3]);
   tail[3] = newText;
  }
  if (!tail[4].includes(sources)) tail[4] += ' · ' + sources;
  return line.slice(0,first) + tail.join(' | ') + ' |';
 });
}
function audit(id, rows, next) {
 const event = JSON.parse(getAudit.get(id).details_json);
 event.audit_id = 'pi_archive_' + batch + '_' + id;
 for (const [key,status,note,sources] of rows) {
  const prior = event.aspects[key];
  event.aspects[key] = { ...prior,status,note,sources:[...new Set([...sources,...prior.sources])] };
 }
 if (next) event.next_step = next;
 event.followup_required = true;
 audits.push(event);
 return event;
}
function edge(event, stage, kind, mentor, evidence, sources, suffix) {
 edges.push({event_id:event.audit_id + '_' + suffix,record_id:event.record_id,stage,kind,mentor_filename:mentor,source_audit_id:event.audit_id,evidence,sources});
}
function page(record_id,url,raw) { pages.push({record_id,url,raw,excerpt:raw}); }

{
 const id='b9337ebc',p=getRecord.get(id);
 const ku='https://www.mech.kuleuven.be/en/tme/doctorates';
 const lib='https://lirias.kuleuven.be/3018132';
 const lab='https://s-pack.org/people/dr-tiwei-wei/';
 const d1='KU Leuven 院系论文目录的 2020 Tiwei Wei 条目明确列 Martine Baelmans 为 supervisor，仓储题名、作者及日期一致。';
 const d2='KU Leuven 2020 论文元数据另具名 Herman Oprins，本人组页直接列 Baelmans 和 Oprins 两位博士指导者。系论文目录的明示 supervisor 为 Baelmans，Oprins 的原卷签署称谓待查。';
 const post='本人实验室原档具名 2020–2022 在 Stanford NanoHeat 做博士后并与 Goodson、Asheghi 工作，Stanford 校友档核其所在分类，个人 advisor 任用原件待查。';
 const event=audit(id,[['phd','confirmed_advisor',d1+' '+d2,[ku,lib,lab]],['postdoc','group_or_candidate',post,[lab,roster]]],'查 Stanford 博后正式个人导师和 KU Leuven 原卷签署。论文下载要求学校认证。');
 for (const [name,detail,urls,suffix] of [
   ['Martine Baelmans',d1,[ku,lib,lab],'baelmans'],
   ['Herman Oprins',d2,[lib,lab,ku],'oprins'],
 ]) {
  const mentor='师承人物 - '+name;
  const evidence=detail+' '+link('KU Leuven 院系论文目录',ku)+' · '+link('KU Leuven 学位仓储',lib);
  append(person(p.filename),line => line.startsWith('- 博士导师：') && line.includes('[['+mentor+'|'),evidence);
  append(person(mentor),line => line.startsWith('- 博士生：') && line.includes(p.filename),evidence);
  append(index,line => line.includes(p.filename+'|') && line.includes('→ 博士导师：[['+mentor+'|'),evidence);
  edge(event,'phd','advisor',mentor,detail,urls,suffix);
 }
 edge(event,'postdoc','stage_mentor','师承人物 - Kenneth E. Goodson',post,[lab,roster],'goodson');
 edge(event,'postdoc','stage_mentor','师承人物 - Mehdi Asheghi',post,[lab,roster],'asheghi');
 school(p,link('KU Leuven 学位仓储',lib));
 page(id,ku,d1);
 page(id,lib,'学位仓储具名作者 Tiwei Wei，日期 2020-09-08，另列 Martine Baelmans 与 Herman Oprins。');
 page(id,roster,'Stanford NanoHeat 校友名录的 Tiwei Wei 条目列在 Research Associate and Post-Doctoral Scholar 栏。');
 pages.push({record_id:id,url:'https://lirias.kuleuven.be/retrieve/a2b8d188-fe0c-41b8-b238-c04cbe073f83',error:'学位全文下载转入 KU Leuven Shibboleth 校方登录，网页工具标为不可重试。'});
}
{
 const id='246b84a2',p=getRecord.get(id);
 const lab='https://nanoheat.stanford.edu/people/prof-kaustav-banerjee/';
 const cv='https://nrl.ece.ucsb.edu/sites/default/files/2022-07/NRL-CV_KB_2021.pdf';
 const dept='https://iee.ucsb.edu/people/faculty/kaustav-banerjee';
 const detail='Stanford NanoHeat 校友个人页将其归入合列的 Research Associate and Post-Doctoral Scholar 栏。UCSB 本人履历和 IEE 档明确其 1999–2001 具体为 Stanford Center for Integrated Systems Research Associate，兼 EE 与 ME Thermosciences。个人博后任用及导师未证。';
 const refs=link('Stanford NanoHeat 校友页',lab)+' · '+link('UCSB 本人履历',cv)+' · '+link('UCSB IEE',dept);
 addSectionLine(person(p.filename),'- Stanford 毕业后工作经历：'+detail+' '+refs);
 school(p,refs,'待核','Stanford 1999–2001 Research Associate，个人博后指导待核');
 audit(id,[['postdoc','unresolved',detail,[lab,cv,dept]]],'继续查 Stanford 1999–2001 当期任用及是否有单列博士后。当前确认 NanoHeat 组属和 Research Associate，个人导师未证。');
 page(id,lab,'Kaustav Banerjee 被列在合并分类 Research Associate and Post-Doctoral Scholar。');
 page(id,cv,'UCSB 本人 CV 具名 Berkeley 1999 博士，Stanford Center for Integrated Systems Research Associate，后赴 UCSB。');
}
{
 const id='cef8660f',p=getRecord.get(id);
 const cv='https://galileo.phys.virginia.edu/research/groups/nextlab/member/SHL_CV_2021.pdf';
 const detail='Stanford NanoHeat 校友表的 Seung Jae Lee 为访客类别，姓名按 Seung-Hun Lee 的首尾词匹配到 UVA。UVA 本人履历及中子散射经历均指 Seung-Hun Lee，现有原档不支持 Stanford 访客属于本条记录，排除自动归属。';
 const prior=JSON.parse(getAudit.get(id).details_json).aspects.identity.note;
 audit(id,[['identity','confirmed',prior.includes(detail)?prior:prior+' '+detail,[roster,cv]]]);
 addSectionLine(person(p.filename),'- 名录姓名消歧。'+detail+' '+link('Stanford 校友表',roster)+' · '+link('UVA 本人履历',cv));
 page(id,roster,detail);
 pages.push({record_id:id,url:'https://nanoheat.stanford.edu/people/seung-jae-lee/',error:'Failed to fetch https://nanoheat.stanford.edu/people/seung-jae-lee/: (400) Timeout fetching'});
}
{
 const id='95e43ad9',p=getRecord.get(id);
 const cv='https://mae.princeton.edu/sites/g/files/toruqf7696/files/documents/Sood_CV_01282024_web.pdf';
 const later='https://chuehlab.stanford.edu/people/aditya-sood';
 const slac='https://www6.slac.stanford.edu/news/2021-10-14-aditya-sood-receives-2021-lcls-young-investigator-award-work-intersection-materials';
 const early='https://engineering.stanford.edu/news/how-can-we-design-electronic-devices-dont-overheat';
 const oldMRS='https://www.mrs.org/publications-digital-content/news/press-room/press-release/2022/04/20/mattia-biesuz-and-aditya-sood-to-receive-mrs-postdoctoral-awards';
 const phd='Stanford NanoHeat 校友档列 Aditya Sood 为博士毕业生，SLAC 官方回顾列 2017 Stanford 博士在 Goodson 实验室。原有 MRS 博士导师标签保留，该原页本轮读取缓存未命中。';
 const post='本人 CV 第 1 页分列 2018 年 Stanford EE 短期 Postdoctoral Scholar 与 2018–2022 SIMES Postdoctoral Fellow & Research Scientist。Stanford 工学院核前段与 Goodson 及 Pop 工作；Chueh 组和 SLAC 核 2018 年 9 月开始的后段联合博后属 Chueh 与 Lindenberg 两组。两个任用阶段和后续 Research Scientist 职称分别保留，正式个人导师待查。';
 const ev=audit(id,[['phd','group_or_candidate',phd,[roster,slac,cv]],['postdoc','group_or_candidate',post,[cv,early,later,slac]]],'复核 2017 博士论文签署和两段博士后正式任用字段，后段另查 Research Scientist 起月。');
 addSectionLine(person(p.filename),'- 博士后时段与职称复核。'+post+' '+link('本人 CV',cv)+' · '+link('联合组原档',later));
 edge(ev,'postdoc','stage_mentor','师承人物 - Kenneth Goodson',post,[cv,early],'goodson');
 edge(ev,'postdoc','stage_mentor','人员 - Stanford - Eric Pop - d2d595fb',post,[cv,early],'pop');
 edge(ev,'postdoc','group_leader','人员 - Stanford - Aaron Lindenberg - b85b2726',post,[cv,later,slac],'lindenberg');
 page(id,cv,'本人 CV 第 1 页分列 2018 Stanford EE Postdoctoral Scholar 与 2018–2022 SIMES Postdoctoral Fellow & Research Scientist。');
 page(id,roster,'Stanford NanoHeat 校友档列 Aditya Sood 为 PhD Graduates。');
 pages.push({record_id:id,url:oldMRS,error:'MRS 颁奖原页 Cache miss'});
}
{
 const id='cd03ec07',p=getRecord.get(id);
 const early='https://web.mit.edu/~enwang/www/ENW%202007%20CV%20.pdf';
 const late='https://bpb-us-e1.wpmucdn.com/sites.mit.edu/dist/d/1787/files/2020/08/ENW_CV_2019.pdf';
 const cis='https://cis.mit.edu/our-people/evelyn-n-wang';
 const post='本人 2007 CV 列 2006 年 2 月起 Bell Laboratories Postdoctoral Researcher，2019 CV 概述任期 2006–2007 并列 2007 年加入 MIT 教职。两份未具名博后个人导师，结束月份仍待查。';
 const next='查 Stanford 论文签署及 Bell Labs 2006–2007 博后任用档个人指导者和离任月份。MIT 2025 年副校长任用已核。';
 const refs=link('MIT 托管 2019 本人 CV',late)+' · '+link('早期本人 CV',early);
 change(person(p.filename),line=>line.startsWith('- 博士后经历：'),()=>'- 博士后经历：'+post+' '+refs);
 change(person(p.filename),line=>line.startsWith('- 核查边界：'),()=>'- 核查边界：'+next);
 append(person(p.filename),line=>line.startsWith('- MIT 机械工程教授及 Device Research Lab PI'),'MIT CIS 另列其为 Ford Professor of Engineering，2025 年 1 月起任 MIT Vice President for Energy and Climate。 '+link('MIT 现任履历',cis));
 school(p,refs,'Bell Labs 博后，个人导师待核','Bell Labs 2006–2007 博后，个人导师待核');
 audit(id,[['postdoc','unresolved',post,[late,early,cis]],['affiliation','confirmed','MIT 机械工程教授及 Device Research Lab PI。MIT CIS 另列 Ford Professor of Engineering 和 2025 年 1 月起的 Vice President for Energy and Climate。',[cis]]],next);
 page(id,late,'本人 2019 CV 第 1 页明确 Bell Laboratories 博后 2006–2007、2007 进入 MIT。');
 page(id,cis,'MIT CIS 官方履历列 Ford Professor of Engineering、2025 年 1 月起 Vice President for Energy and Climate，确认此前 Bell Labs 博后。');
}
db.close();
console.log(JSON.stringify({files:files.size,audits:audits.length,edges:edges.length,pages:pages.length}));
if(process.argv[2]==='apply'){
 function persist(label,value){const f=batch+'_'+label+'.json';fs.writeFileSync(f,JSON.stringify(value,null,2)+'\n','utf8');return f;}
 function run(script,...args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
 for(const event of audits)run('人工核查台账.cjs','record',persist('人工_'+event.record_id,event));
 for(const [file,content] of files)fs.writeFileSync(file,content,'utf8');
 run('结构化师承关系.cjs','record',persist('Stanford及Leuven结构化',edges));
 run('检索流程.cjs','ingest-reviewed-pages',persist('Stanford及Leuven原档回执',pages));
}
