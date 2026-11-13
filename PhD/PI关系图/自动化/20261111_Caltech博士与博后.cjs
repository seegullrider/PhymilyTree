
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_Caltech博士与博后';
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
 event.audit_id = 'pi_archive_20261111_caltech_' + id;
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
{
 const id = 'e6be006d';
 const p = record.get(id);
 const self = 'https://kiyoul.seas.harvard.edu/index.html';
 const thesis = 'https://thesis.caltech.edu/10483/';
 const interview = 'https://www.hqi-blog.com/community/faculty-interviews/meet-kiyoul-yang';
 const department = 'https://seas.harvard.edu/person/kiyoul-yang';
 const jelena = '人员 - Stanford - Jelena Vučković (Vuckovic) - 1fe868ab';
 const group = '本人履历列 2017–2018 Caltech 博士后。Vahala 组原名录将 Kiyoul Yang 列为 2018 博士后研究者并注明任 Harvard。组属明确，任命的确切月份与正式个人导师待查。';
 const doctoral = 'Caltech 学位馆藏与本人履历均列 2018 电气工程博士，馆藏明确列 Kerry J. Vahala 为 Advisor。组名录把博士阶段列作 2017。';
 const stanford = 'Harvard Quantum Initiative 本人访谈明确称 Jelena Vučković 为其 Stanford 博士后 advisor。本人履历分列 Stanford 2018–2021 博士后和 2021–2022 Research Scientist。';
 const next = '查 Caltech 2017–2018 博后个人任用原档、精确月份及 2022 年 Max Planck Research Fellow 的具体任用和接待导师。';
 const suffix = group + ' ' + link('Vahala 组原名录',roster) + ' · ' + link('本人履历',self);
 const person = '[[' + p.filename + '|' + p.name + ']]';
 const groupLine = '博士后课题组负责人：[[' + vahala + '|Kerry Vahala]]。' + suffix;
 edit(fileFor(p.filename),line => line.startsWith('- 另有博士后经历：'),(line,nl) => '- ' + groupLine + nl + '- 其他研究任用：Stanford 2021–2022 Research Scientist，Max Planck Institute for the Science of Light 2022 Research Fellow。' + link('本人履历',self));
 edit(fileFor(p.filename),line => line.startsWith('- 核查边界：'),() => '- 核查边界：' + doctoral + ' ' + next + ' ' + link('学位目录',thesis) + ' · ' + link('校方任用',department));
 append(fileFor(p.filename),line => line.startsWith('- 博士后导师：'),'本人履历列 Stanford 博后为 2018–2021。' + link('本人履历',self));
 append(fileFor(jelena),line => line.startsWith('- 博士后研究者：') && line.includes(p.filename),'本人履历列 Stanford 博后为 2018–2021。' + link('本人履历',self));
 edit(fileFor(vahala),line => line.startsWith('- 博士生：') && line.includes(p.filename),(line,nl) => line + nl + '- 博士后课题组成员：' + person + '。' + suffix);
 edit(index,line => line.startsWith('- ' + person + ' → 博士后导师：'),(line,nl) => line.replace('；本人主页另列 Caltech 博后阶段，指导者与时间待核。','。本人履历列 Stanford 博后为 2018–2021。' + link('本人履历',self)) + nl + '- ' + person + ' → ' + groupLine);
 edit('../Harvard逐人复核记录.md',line => line.startsWith('| ' + person + ' |'),line => line.replace('Caltech 2017–2018 博后指导者及时间待核','Kerry Vahala（Caltech 2017–2018 博后课题组负责人，正式个人指导待查）').replace('Caltech 博后短期的日期和指导待查。','Stanford 2018–2021 博后与 2021–2022 Research Scientist 分列。 ' + link('Vahala 组原名录',roster)));
 const e = review(id,[['phd',doctoral,[thesis,self,roster]],['postdoc',stanford+' '+group,[interview,self,roster]],['research','Harvard SEAS 列 EE 与应用物理交叉的光子学；院档报道核集成光子、逆向设计硅氮化物元件和量子工程。',[department]]],next);
 evidence(e,'postdoc','group_leader',vahala,group,[roster,self],'vahala');
 evidence(e,'postdoc','advisor',jelena,stanford,[interview,self],'vuckovic');
 original(id,roster,'Vahala 组校友条目列 Kiyoul Yang 的 2017 Ph.D. 和 2018 博后研究者，并注明现任 Harvard。');
 original(id,self,'本人 Harvard 履历分列 Caltech 2017–2018 博后、Stanford 2018–2021 博后和 2021–2022 Research Scientist、2022 Max Planck Research Fellow，列 2018 EE PhD。');
}
{
 const id = '365a11b4';
 const p = record.get(id);
 const cv = 'https://armani.usc.edu/files/2021/10/CV_Armani_2021.pdf';
 const ceremony = 'https://campuspubs.library.caltech.edu/2145/1/Commencement_2007.pdf';
 const deniz = 'https://thesis.caltech.edu/2146/';
 const interview = 'https://www.engineergirl.org/3040/Andrea-Armani';
 const report = 'https://thisis.caltech.edu/news/physicists-devise-new-technique-detecting-heavy-water-1160';
 const department = 'https://viterbi.usc.edu/directory/faculty/Armani/Andrea';
 const doctoral = 'Caltech 2007 毕业典礼原册印刷页 30 列 Andrea Martin Armani 与光学微腔论文题名。本人 CV 列 2007 年 6 月应用物理博士，组名录列 2006。2006 校方报道确认 Kerry Vahala 的论文研究组属，正式签署导师待查。2005 论文 2146 的作者为 Deniz Karapetian Armani，组名录将两人分列。';
 const postdoc = '本人 CV 明列 2006–2008 Caltech Clare Boothe Luce 博后项下的 Richard Flagan 与 Scott Fraser，本人访谈明确称两人为博士后导师。保留此前 2007 校方原报道支持的 Vahala 博后课题组关系。';
 const next = '追查 2007 博士论文的 Caltech 原卷与签署。本人 CV 同时列 2006 年起博后与 2007 年 6 月授位，确切起聘月份待查。';
 const ref = link('Caltech 2007 毕业典礼原册',ceremony) + ' · ' + link('本人 CV',cv);
 const person = '[[' + p.filename + '|' + p.name + ']]';
 append(fileFor(p.filename),line => line.startsWith('- 博士阶段课题组负责人：'),doctoral + ' ' + ref + ' · ' + link('Deniz 独立学位记录',deniz));
 append(fileFor(p.filename),line => line.startsWith('- 博士后导师：'),postdoc + ' ' + link('本人 CV',cv));
 for (const mentor of ['Scott E. Fraser','Richard C. Flagan']) {
  const name = '师承人物 - ' + mentor;
  append(fileFor(name),line => line.startsWith('- 博士后研究者：') && line.includes(p.filename),'本人 CV 亦将两人列于 2006–2008 Caltech 博士后项下。' + link('本人 CV',cv));
 }
 append(index,line => line.startsWith('- ' + person + ' → 博士后导师：'),'本人 CV 将两人列于 2006–2008 Caltech 博士后项下。' + link('本人 CV',cv));
 append(index,line => line.startsWith('- ' + person + ' → 博士阶段课题组负责人：'),doctoral + ' ' + ref);
 append(fileFor(vahala),line => line.startsWith('- 博士阶段课题组成员：') && line.includes(p.filename),doctoral + ' ' + ref);
 edit('../USC逐人复核记录.md',line => line.startsWith('| ' + person + ' |'),line => line.trimEnd().slice(0,-1).trimEnd() + ' · ' + ref + '。博士授位按毕业册和本人 CV 记 2007 年，博后履历列 2006–2008。 |');
 const e = review(id,[['identity','2007 Caltech 毕业册、本人 CV 和 USC Viterbi 教师档姓名学历一致。Deniz 的论文编号 2146 与组档属于另一人。',[ceremony,cv,department,deniz]],['phd',doctoral,[ceremony,cv,report,roster,deniz]],['postdoc',postdoc,[cv,interview]]],next);
 evidence(e,'phd','group_leader',vahala,doctoral,[ceremony,cv,report,roster,deniz],'vahala_phd');
 for(const [mentor,key] of [['Scott E. Fraser','fraser'],['Richard C. Flagan','flagan']]) evidence(e,'postdoc','advisor','师承人物 - '+mentor,postdoc,[cv,interview],key);
 original(id,ceremony,'Caltech 2007 毕业典礼原册印刷页 30 列 Andrea Martin Armani，应用物理及生物学，题为 Chemical and Biological Sensing with Ultra-high-Q Microresonators。');
 original(id,cv,'本人 USC CV 印刷页 1 列 2007 年 6 月 Caltech 应用物理博士，2006–2008 Caltech 博士后项下具名 Richard Flagan 和 Scott Fraser。');
 original(id,deniz,'CaltechTHESIS 2146 列 2005 年电气工程博士 Deniz Karapetian Armani，导师为 Kerry J. Vahala。与 Andrea 另有独立学位信息。');
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
