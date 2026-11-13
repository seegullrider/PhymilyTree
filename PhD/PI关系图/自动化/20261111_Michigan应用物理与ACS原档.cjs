
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_Michigan应用物理与ACS原档';
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
 event.audit_id = 'pi_archive_20261111_michigan_acs_' + id;
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



const mse='https://lsa.umich.edu/appliedphysics/research/dissertations.html';
const acs='https://pmsedivision.org/graduate-research-award/';
const mi=JSON.parse(fs.readFileSync('20261111_Michigan应用物理学位目录比对.json','utf8'));
const titleFor=id=>mi.matches.find(x=>x.candidates.some(c=>c.id===id)).dissertation;
const oldEvent=id=>JSON.parse(priorAudit.get(id).details_json);
const matchIndex=(p,stage,mentor)=>line=>line.startsWith('- [['+p.filename+'|')&&line.includes(' → '+stage+'：')&&line.includes(mentor);
function phaseSource(id,mentor,description,refs,urls,detail) {
 const p=record.get(id), file=fileFor(p.filename), old=oldEvent(id);
 append(file,starts('博士导师',mentor),description+' '+refs);
 append(fileFor(mentor),starts('博士生',p.filename),description+' '+refs);
 append(index,matchIndex(p,'博士导师',mentor),description+' '+refs);
 school(p,line=>line,refs);
 const e=review(id,[['phd',old.aspects.phd.note+' '+description,urls],...detail],old.next_step);
 e.followup_required=old.followup_required;
 evidence(e,'phd','advisor',mentor,description,[...new Set([...urls,...old.aspects.phd.sources])],'phd');
 return e;
}
{
 const id='22f4808c', p=record.get(id), file=fileFor(p.filename), mentor='师承人物 - Stuart Cooper';
 const cv='https://cbe.princeton.edu/document/1171', department='https://cbe.princeton.edu/people/richard-register';
 const bio='https://materials.princeton.edu/symposium-2025/speakers';
 const refs=link('ACS 历届获奖与导师表',acs)+' · '+link('Princeton 托管本人 CV，第 1 页',cv);
 const phd='本人 CV 列 1989 Wisconsin–Madison 化学工程博士及 Stuart L. Cooper。ACS PMSE 名录的 1992 获奖行在 Advisor(s) 栏具名 Stuart Cooper。';
 const postdoc='本人 CV 从 1989 年博士列至 1990 年 1 月 Princeton 助理教授，履历未单列博后任用。';
 edit(file,starts('博士课题组',mentor),line=>line.replace('博士课题组：','博士导师：')+' '+phd+' '+refs);
 edit(file,starts('核查边界'),()=>'- 核查边界：'+postdoc+' 继续追查 Wisconsin 论文原卷和博士毕业后的同期履历。'+refs);
 edit(fileFor(mentor),starts('博士课题组成员',p.filename),line=>line.replace('博士课题组成员：','博士生：')+' '+phd+' '+refs);
 edit(index,matchIndex(p,'博士课题组',mentor),line=>line.replace(' → 博士课题组：',' → 博士导师：')+' '+phd+' '+refs);
 school(p,line=>line.replace('Stuart Cooper（课题组） | 待核','Stuart L. Cooper（1989 Wisconsin 化工博士导师） | 1990 年 1 月加入 Princeton，履历未单列博后'),refs);
 const e=review(id,[['phd',phd,[acs,cv,bio]],['postdoc',postdoc,[cv]],['affiliation','Princeton 化学与生物工程教授，Eugene Higgins 冠名教授与 Princeton Materials Institute 主任。',[department,cv]],['research','聚合物相变、缔合高分子流变、嵌段共聚物和软材料结构及性能。',[department,cv]]],'追查 Wisconsin 学位论文原卷及 1989–1990 同期职业记录。');
 e.aspects.phd.status='confirmed_advisor';
 e.aspects.postdoc.status='no_postdoc_documented';
 evidence(e,'phd','advisor',mentor,phd,[acs,cv,bio],'phd');
 original(id,acs,phd);
 original(id,cv,phd+' '+postdoc);
 original(id,department,'Richard A. Register，Princeton Eugene Higgins Professor of Chemical and Biological Engineering、Princeton Materials Institute 主任；教育栏列 1989 年 University of Wisconsin 博士。');
}
{
 const id='a3d068af', thesis='https://deepblue.lib.umich.edu/bitstream/handle/2027.42/63875/dkumah_1.pdf?isAllowed=y&sequence=1';
 const duke='https://scholars.duke.edu/person/divine.kumah';
 const phd='Michigan 2009 应用物理论文《'+titleFor(id).replace(/\.$/,'')+'》封面具名 Roy Clarke 为委员会主席，作者致谢明确称其为自己的导师。';
 phaseSource(id,'人员 - University of Michigan, Ann Arbor - Roy Clarke - 88a6c6df',phd,link('Michigan 学位论文原卷',thesis),[thesis,mse],[['affiliation','Duke 物理系 Charles H. Townes 副教授。',[duke]]]);
 original(id,thesis,phd);
}
{
 const id='c4061620', duke='https://mems.duke.edu/people/adrienne-stiff-roberts/';
 const ecs='https://www.electrochem.org/dl/interface/wtr/wtr06/wtr06_p23-27.pdf';
 const phd='Michigan 应用物理目录列 Adrienne Diarra Stiff-Roberts，2004，论文《'+titleFor(id).replace(/\.$/,'')+'》（目录题名）。原刊作者简介单独确认博士导师。';
 phaseSource(id,'人员 - University of Michigan, Ann Arbor - Pallab Bhattacharya — 荣休 - 8f264b17',phd,link('Michigan 应用物理目录',mse),[mse,ecs],[['affiliation','Duke 院系原档列电气与计算机工程与机械工程和材料科学相关任用及薄膜、量子点和光电方向。',[duke]]]);
 original(id,mse,phd);
}
{
 const id='2c7f42f4', qri='https://quantum.umich.edu/committees/';
 const phd='Michigan 应用物理目录列全名 Steven Thomas Cundiff，1992，论文研究量子阱无序对皮秒激子光学非线性的影响。目录有拼写异常，原卷题名待核。';
 phaseSource(id,'人员 - University of Michigan, Ann Arbor - Duncan Steel - 9462a2bb',phd,link('Michigan 应用物理目录',mse)+' · '+link('Michigan QRI',qri),[mse],[['affiliation','Michigan 量子研究所现行名录列物理系 Harrison M. Randall Collegiate Professor 和 EECS 教授。',[qri]]]);
 original(id,mse,phd);
 original(id,qri,'Michigan 量子研究所目录明确 Steven Cundiff 为物理和 EECS 教授。');
}
{
 const id='7290aded', p=record.get(id), file=fileFor(p.filename);
 const osu='https://ece.osu.edu/people/krishna.53', cv='https://ece.unm.edu/faculty-staff/electrical-and-computer/cvs/sanjay-krishna.pdf';
 const phd='Michigan 应用物理目录及 UNM 托管本人履历核 2001 应用物理博士，论文研究自组织量子点的量子限域能级及中红外光源与探测器。具名导师仍待签署页或本人履历。';
 const postdoc='Ohio State 院系原档列 2001 年获博士并同年加入 UNM tenure-track 教职，未发现单列博士后任用。';
 const refs=link('Ohio State ECE 原档',osu)+' · '+link('UNM 托管本人履历',cv);
 append(file,starts('核查边界'),phd+' '+postdoc+' '+refs);
 school(p,line=>line.replace(' | 待核 | ',' | 2001 年加入 UNM 教职，未见单列博后 | '),refs);
 const old=oldEvent(id);
 const e=review(id,[['phd',old.aspects.phd.note+' '+phd,[mse,cv]],['postdoc',postdoc,[osu,cv]],['affiliation','Ohio State 电气与计算机工程教授及 George R. Smith Chair。',[osu]],['research','红外探测器、探测阵列和成像，早期博士论文为半导体量子点限域能级。',[osu,mse]]],'以目录题名追 Michigan 论文原卷和签署字段，继续核 2001 任用原档。');
 e.aspects.postdoc.status='no_postdoc_documented';
 original(id,osu,'Ohio State ECE 教授和 George R. Smith Chair，研究红外探测器和阵列。'+postdoc);
 original(id,mse,phd);
}
{
 const id='d4abe130',p=record.get(id), file=fileFor(p.filename), psu='https://www.matse.psu.edu/directory/long-qing-chen';
 const old=oldEvent(id);
 const note='Michigan 目录的 Long Chen 是 2017 年应用物理学位，研究光子与微流控结构。Penn State 本人原档明确 Long-Qing Chen 为 1990 年 MIT 材料博士，两份学位记录对应不同身份。';
 const refs=link('Michigan 应用物理目录',mse)+' · '+link('Penn State 院系原档',psu);
 edit(file,starts('核查边界'),(line,nl)=>line+nl+'- 学位目录同名核对：'+note+' '+refs);
 school(p,line=>line,refs);
 const e=review(id,[['identity',old.aspects.identity.note+' '+note,[psu,mse]]],old.next_step);
 e.followup_required=old.followup_required;
 original(id,psu,note);
}
for(const [id,url,raw] of [
 ['37f72884','https://che.engin.umich.edu/people/kamcev-jovan/','Michigan 化学工程与高分子科学工程副教授。2016 年 12 月 UT Austin 化学工程博士的 Thesis Directors 为 Benny D. Freeman 和 Donald R. Paul。履历分别列 2016 年 11 月至 2017 年 5 月 UT Austin Postdoctoral Fellow 由两人指导研究，2017 至 2019 Berkeley 化学系 Postdoctoral Scholar 由 Jeffrey R. Long 指导研究。'],
 ['e9420673','https://www.zhukogroup.com/about-alex','本人组档列 2025 年起 UNC 化学系副教授，2016 MIT 化学博士并明称 Jeremiah A. Johnson 为 Ph.D. advisor，2016–2019 Berkeley 与 F. Dean Toste 做 LSRF Merck 博后。'],
 ['e9420673','https://www.zhukogroup.com/research','组页列高分子网络缠结拓扑与宏观力学、共轭高分子的合成和自组装及其纳米光子应用。']
]) original(id,url,raw);

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
