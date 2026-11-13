
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_Princeton斜体原档';
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
 event.audit_id = 'pi_archive_20261111_princeton_format_' + id;
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

const shankarCv='https://sites.utexas.edu/shyamshankar/wp-content/uploads/sites/4614/2025/09/Shankar_CV_CSEformat_20250826.pdf';
const ece='https://ece.utexas.edu/people/faculty/shyam-shankar';
{
 const id='857ac7ad',p=record.get(id), file=fileFor(p.filename);
 const person='[['+p.filename+'|'+p.name+']]';
 const refs=link('CV 第 2 页斜体标注说明',shankarCv+'#page=2')+' · '+link('CV 第 4 页第 35、42 项',shankarCv+'#page=4');
 const dates='Princeton 电气工程博士 2010 年 9 月授位。Yale Postdoctoral Associate 为 2010 年 7 月至 2014 年 5 月，随后任研究科学家至 2019 年。';
 edit(file,line=>line.startsWith('- 已核博士论文题名：'),line=>line.replace('论文导师仍须其学位论文或可见格式的履历确认。','具名导师见下。'));
 edit(file,line=>line.startsWith('- 进一步核查（2026-11-04）：'),()=>'- 核对履历原件（2026-11-11）：'+dates+' '+link('CV 第 1 页教育及任职',shankarCv+'#page=1'));
 edit(file,starts('核查边界'),()=>'- 核查依据：本人 CV 第 2 页说明以斜体标示作为合著者的博士导师与博士后 mentor；核对原 PDF 第 4 页的标注和第 1 页任职时间。 '+refs);
 append(file,line=>line.startsWith('- UT Austin 电气与计算机工程助理教授，'),'院系教师档另列半导体量子器件与电路。 '+link('UT Austin ECE 教师档',ece));
 const e=review(id,[
  ['phd','本人 2025 CV 第 2 页解释斜体标注，第 4 页第 42 项斜体为 S. A. Lyon，对应 Princeton 硅电子自旋阶段。'+dates,[shankarCv]],
  ['postdoc','本人 2025 CV 第 2 页解释斜体标注，第 4 页第 35 项斜体为 M. H. Devoret，对应 Yale 阶段的 postdoctoral mentor。'+dates,[shankarCv]],
  ['affiliation','UT Austin ECE 原档列电气与计算机工程系助理教授和冠名 fellowship。',[ece]],
  ['research','UT Austin ECE 原档列超导和半导体量子器件与电路。',[ece]]
 ],'博士和博后具名指导由本人履历确认。');
 e.followup_required=false;
 e.aspects.phd.status='confirmed_advisor';
 e.aspects.postdoc.status='confirmed_advisor';
 for(const [stage,name,mentor,oldLabel,label,reverseOld,reverse,note] of [
  ['phd','Stephen A. Lyon','人员 - Princeton - Stephen A. Lyon - 60b542fc','博士阶段课题组负责人','博士导师','博士阶段课题组成员','博士生','本人 CV 第 4 页第 42 项将 S. A. Lyon 排为斜体，按第 2 页说明及第 1 页履历对应 Princeton 博士导师。'],
  ['postdoc','Michel Devoret','人员 - Yale - Michel Devoret — Yale 荣休 - a3ddcf1b','博士后课题组负责人','博士后导师','博士后课题组成员','博士后研究者','本人 CV 第 4 页第 35 项将 M. H. Devoret 排为斜体，按第 2 页说明及第 1 页履历对应 Yale 2010–2014 博士后；CV 原称 postdoctoral mentor。']
 ]){
  const target='[['+mentor+'|'+name+']]';
  const detail=note+' '+refs+' 可信度：高。';
  edit(file,starts(oldLabel,mentor),()=>'- '+label+'：'+target+'。'+detail);
  edit(fileFor(mentor),starts(reverseOld,p.filename),()=>'- '+reverse+'：'+person+'。'+detail);
  edit(index,line=>line.startsWith('- '+person+' → '+oldLabel+'：')&&line.includes(mentor),()=>'- '+person+' → '+label+'：'+target+'。'+detail);
  evidence(e,stage,'advisor',mentor,note,[shankarCv],stage);
 }
 edit('../UT Austin逐人复核记录.md',line=>line.startsWith('| '+person+' | '),()=> '| '+person+' | 电气与计算机工程系，超导及半导体量子器件、量子测量、量子纠错、量子信息 | Stephen A. Lyon（Princeton 博士导师） | Michel Devoret（Yale 博士后导师，CV 原称 postdoctoral mentor） | '+link('本人 2020 CV 博士论文题名','https://sites.utexas.edu/shyamshankar/files/2020/08/Shyam_cv.pdf')+' · '+refs+' · '+link('UT Austin ECE 教师档',ece)+' |');
 original(id,shankarCv,dates+' 核本机原件的第 2 页说明与第 4 页第 35、42 项斜体，确认 Devoret 和 Lyon。20261111_Shankar_CV_20250826核读.pdf，SHA256 97A8DC2184F8A6AF1F3CE420A1142C88FA815B70C792BFBE101AC76BDFF6A541。');
 original(id,ece,'UT Austin ECE 教师档列助理教授及冠名 fellowship、超导与半导体量子器件电路、Princeton 电气博士和 Yale 博后。');
}
{
 const id='801002ae',p=record.get(id);
 const penn='https://almanac.upenn.edu/volume-72-number-33';
 const lab='https://www.pennqubit.com/people';
 const princeton='https://phy.princeton.edu/home/anthony-sigillito';
 const event='https://ece.princeton.edu/events/electrical-manipulation-donor-spin-qubits-silicon-and-germanium';
 const note='Penn 校报与本人实验室确认 Penn 电气与系统工程助理教授及以半导体核自旋、电子自旋为基础的量子硬件。本人实验室列 2017 Princeton EE PhD。Princeton ECE 2017 年 3 月 9 日同名报告有本人、题名与摘要。Princeton 物理系原档将 Stephen Lyon 与 Jason Petta 分列在博士期与 2017 年春起 Dicke fellow 阶段，均用 working with。';
 const next='沿 Princeton ECE 同名报告追论文原卷与 Lyon 签署栏，查 Dicke fellow 个人指导任用，现有两阶段研究师长保留。';
 append(fileFor(p.filename),starts('核查边界'),'Princeton 物理系将 Dicke fellow 到任记为 2017 年春。Penn 院校报道确认本校职务和半导体自旋量子硬件。 '+link('Princeton 物理系履历',princeton)+' · '+link('Penn 校报',penn));
 school(p,line=>line,link('Princeton ECE 2017 报告',event));
 review(id,[['identity',note,[penn,lab,princeton,event]],['affiliation','Penn 校报与本人实验室均列 Penn Electrical and Systems Engineering 助理教授。',[penn,lab]],['research','Penn 校报列半导体核及电子自旋量子硬件，Princeton 两阶段研究档核施主自旋与硅锗量子点。',[penn,princeton,event]]],next);
 original(id,event,'Princeton ECE 2017-03-09 日程列 Anthony Sigillito 为报告者，主题为 Electrical Manipulation of Donor Spin Qubits in Silicon and Germanium，无导师字段。');
 original(id,princeton,'Princeton 物理系列 2017 春入系、Dicke fellow 与 Jason Petta 研究；此前 Princeton EE fellow 与 Stephen Lyon 工作。');
 original(id,lab,'本人实验室现任栏列 Penn ESE 助理教授，教育栏列 2017 Princeton Electrical Engineering PhD。');
 original(id,penn,'Penn 校报 2026 年教学奖条目确认其 ESE 助理教授及半导体核和电子自旋量子硬件。');
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
