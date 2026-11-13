
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_GeorgiaTech材料目录及任用原档';
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
 event.audit_id = 'pi_archive_20261111_gatech_mse_' + id;
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


const mse='https://www.mse.gatech.edu/graduate/thesis_titles';
function recordMatch(id, stage, mentor, reverseRole, detail, refs) {
 const p=record.get(id),file=fileFor(p.filename);
 const label=stage==='phd'?'博士导师':'博士后导师';
 append(file,starts(label,mentor),detail+' '+refs);
 append(fileFor(mentor),starts(reverseRole,p.filename),detail+' '+refs);
 append(index,line=>line.startsWith('- [['+p.filename+'|')&&line.includes(' → '+label+'：')&&line.includes(mentor),detail+' '+refs);
 return p;
}
{
 const id='ecd83c0d',p=record.get(id),file=fileFor(p.filename);
 const edition='https://comptes-rendus.academie-sciences.fr/physique/item/10.5802/crphys.sp.3.pdf';
 const gt='https://physics.gatech.edu/user/carlos-sa-de-melo';
 const abr='师承人物 - Alexei Abrikosov';
 const don='师承人物 - Sebastian Doniach';
 const ref=link('法国科学院期刊专号编者简介',edition);
 const phd='Sá de Melo 任编者的 Comptes Rendus Physique 专号简介具名 1991 Stanford 理论物理博士、Sebastian Doniach 指导。';
 const post='该专号编者简介在 Illinois Science and Technology Center for Superconductivity 的博士后条目直接具名 Alexei Abrikosov 为 mentor；清华讲座原档亦明确此博后阶段由 Abrikosov 指导。';
 const recordPost=starts('博士后阶段研究师长',abr);
 edit(file,recordPost,line=>line.replace('- 博士后阶段研究师长：','- 博士后导师：')+' '+post+' '+ref);
 edit(fileFor(abr),starts('博士后阶段研究者',p.filename),line=>line.replace('- 博士后阶段研究者：','- 博士后研究者：')+' '+post+' '+ref);
 edit(index,line=>line.startsWith('- [['+p.filename+'|')&&line.includes(' → 博士后阶段研究师长：')&&line.includes(abr),line=>line.replace(' → 博士后阶段研究师长：',' → 博士后导师：')+' '+post+' '+ref);
 recordMatch(id,'phd',don,'博士生',phd,ref);
 edit(file,starts('核查边界'),()=>'- 核查依据：Georgia Tech 物理系核现任教授和 1991 Stanford 博士；法国科学院原刊分列 Stanford 博士指导与 Illinois 博后，后者保留原文称谓 mentor。Illinois 任用月份和 Stanford 学位论文题名继续查。 '+ref+' · '+link('Georgia Tech 物理系',gt));
 school(p,line=>line.replace('Alexei Abrikosov（博士后阶段研究师长）','Alexei Abrikosov（Illinois 博士后导师，原文 mentor）').replace('Illinois Abrikosov 博后阶段研究师长。','Illinois Abrikosov 博后具名指导。'),ref);
 const e=review(id,[
  ['identity','Georgia Tech 物理系和法国科学院专号编者履历均列 Stanford 1991 博士和现任 Georgia Tech 物理教授。',[gt,edition]],
  ['affiliation','Georgia Tech 物理系 Professor。',[gt]],
  ['research','原刊编者简介列量子多体、超流体 BCS–BEC 跨越、超冷费米原子。',[edition,gt]],
  ['phd',phd,[edition,gt]],['postdoc',post,[edition]]
 ],'继续查 Stanford 学位卷册题名和 Illinois 博后正式任用日期。');
 e.aspects.phd.status='confirmed_advisor';
 e.aspects.postdoc.status='confirmed_advisor';
 evidence(e,'phd','advisor',don,phd,[edition,gt],'doniach');
 evidence(e,'postdoc','advisor',abr,post,[edition],'abrikosov');
 original(id,edition,'法国科学院 Comptes Rendus Physique 专号编者简介同时具名 1991 Stanford PhD supervisor Sebastian Doniach 和 Illinois 超导中心 postdoctoral mentor Alexei Abrikosov。');
 original(id,gt,'Georgia Tech 物理系确认 Carlos Sá de Melo 现任教授及 1991 Stanford 博士。');
}
{
 const id='09f1bebc',p=record.get(id),file=fileFor(p.filename);
 const diss='https://lsa.umich.edu/appliedphysics/research/dissertations.html';
 const aps='https://www.aps.org/apsnews/1998/08/damop-thesis-award';
 const gt='https://physics.gatech.edu/user/1478';
 const xu='https://www.rle.mit.edu/cua_pub/ketterle_group/Theses/Xu_Kaiwen_thesis_kwxu.pdf';
 const title='Rydberg Wave Packets and Half-Cycle Electromagnetic Pulses';
 const note='Michigan 应用物理学位目录明确全名 Chandra Shekar Raman、1997 及论文《'+title+'》。Bucksbaum 本人 CV 使用委员会主席或主要导师合并栏目，保留候选，论文原卷签署待查。';
 const post='Kaiwen Xu 的 MIT 学位论文致谢明确说明 2000 年加入 Ketterle 组时，Chandra Raman 是组内博士后之一，与既有 MIT 实验室组档相符。';
 const refs=link('Michigan 论文目录',diss)+' · '+link('Kaiwen Xu 的 MIT 论文致谢',xu);
 append(file,starts('博士导师候选'),note+' '+link('Michigan 论文目录',diss));
 append(file,starts('博士后课题组负责人'),post+' '+link('MIT 论文致谢',xu));
 append(file,starts('核查边界'),'已核博士论文题名和 2000 年 MIT 同期组属。 '+refs);
 append(fileFor('人员 - Stanford - Philip Bucksbaum - 44788e46'),starts('博士生候选',p.filename),note+' '+link('Michigan 论文目录',diss));
 append(fileFor('人员 - MIT - Wolfgang Ketterle - c6a09de1'),starts('博士后课题组成员',p.filename),post+' '+link('MIT 论文致谢',xu));
 append(index,line=>line.startsWith('- [['+p.filename+'|')&&line.includes(' → 博士导师候选：'),note+' '+link('Michigan 论文目录',diss));
 append(index,line=>line.startsWith('- [['+p.filename+'|')&&line.includes(' → 博士后课题组负责人：'),post+' '+link('MIT 论文致谢',xu));
 school(p,line=>line,refs);
 review(id,[['identity','Michigan 原目录列全名和学位，Georgia Tech 原档列教授及 1997 Michigan 博士。',[diss,gt]],['phd',note,[diss]],['postdoc',post,[xu]],['affiliation','Georgia Tech 物理系教授。',[gt]],['research','Georgia Tech 原档列超冷原子、量子传感和量子多体研究。',[gt]]],'沿完整论文题名追 Michigan 学位原卷的导师签署，MIT 个人博后指导称谓待核。');
 original(id,diss,'Michigan 应用物理学位目录列 Chandra Shekar Raman、1997 及论文 Rydberg Wave Packets and Half-Cycle Electromagnetic Pulses。');
 original(id,xu,'Kaiwen Xu 的 MIT 学位论文致谢中列其 2000 年进 Ketterle 组时，Chandra Raman 为组内博士后。');
 original(id,gt,'Georgia Tech 物理系原档列 Chandra Raman 教授和 1997 Michigan 博士。');
}
{
 const thesis='https://repository.gatech.edu/bitstreams/61ebb22c-93e6-4eb7-9394-39fa121a1303/download';
 const stan='https://profiles.stanford.edu/sheng-xu';
 const ucsd='https://jacobsschool.ucsd.edu/people/profile/sheng-xu';
 const wang='师承人物 - Zhong Lin Wang';
 const note='Georgia Tech 原论文《Oxide Nanowire Arrays for Energy Sciences》批准页明确列 Zhong Lin Wang 为 Advisor，批准日 2010-10-29，封面 2010-12；MSE 目录列 Fall 2010，Stanford 个人档学历栏列 2011。将论文批准、目录学期和个人档年份分别保存。';
 const ref=link('Georgia Tech 学位原卷',thesis)+' · '+link('MSE 学位目录',mse)+' · '+link('Stanford 个人档',stan);
 for (const id of ['2a66e08b','3caf9ac9']) {
  const p=recordMatch(id,'phd',wang,'博士生',note,ref);
  append(fileFor(p.filename),starts('核查边界'),note+' '+ref);
  school(p,line=>line,ref);
  const e=review(id,[
   ['identity','Stanford 原档列 Peking 本科、Georgia Tech 材料博士、UIUC 材料实验室博后、UCSD 任教十年、2025 起 Stanford，与 UCSD 旧院档及 Georgia Tech 学位原卷相符。',[stan,ucsd,thesis]],
   ['phd',note,[thesis,mse,stan]],
   ['research','Stanford 教师档列软电子材料与制造，UCSD 档案对应柔性电子。',[stan,ucsd]]
  ],'继续查实际授位日期和 UIUC 博士后正式具名任用。');
  e.aspects.phd.status='confirmed_advisor';
  evidence(e,'phd','advisor',wang,note,[thesis,mse,stan],'wang');
  original(id,mse,'Georgia Tech MSE 学位目录列 Sheng Xu、Fall 2010、ZL Wang 及 Oxide Nanowire Arrays for Energy Sciences。');
  original(id,thesis,'Georgia Tech 论文封面 2010-12，批准页列 2010-10-29 与 Zhong Lin Wang, Advisor。');
  original(id,stan,'Stanford 原档列 2011 Georgia Tech 材料科学与工程 PhD；主聘麻醉学并列 EE 和 MSE courtesy，研究软电子材料与制造。');
 }
}
{
 const id='cae0bacb';
 const booklet='https://repository.gatech.edu/bitstreams/5341df37-20eb-4913-b966-a8c9b20bf360/download';
 const chi='https://pme.uchicago.edu/directory/sihong-wang';
 const group='https://baogroup.stanford.edu/people/alumni/postdoctoral-scholars-alumni';
 const wang='师承人物 - Zhong Lin Wang';
 const note='Georgia Tech MSE 博士目录列 Sihong Wang 的 2014 春博士论文题名 Nanogenerator for Energy Harvesting and its Hybridization with Li-ION Battery。学校典礼原册材料学博士栏明列 Advisor Dr. Zhong L. Wang，Bao 组校友档以全名 Zhong Lin Wang 交叉确认。';
 const ref=link('Georgia Tech 学位目录',mse)+' · '+link('Georgia Tech 典礼原册',booklet);
 const p=recordMatch(id,'phd',wang,'博士生',note,ref);
 append(fileFor(p.filename),starts('核查边界'),note+' '+ref);
 school(p,line=>line,ref);
 const e=review(id,[
  ['identity','Georgia Tech 学位目录与 Chicago PME、Stanford Bao 组博士后校友档的博士及后续任用一致。',[mse,chi,group]],
  ['phd',note,[mse,booklet,group]],['affiliation','UChicago Pritzker School of Molecular Engineering 分子工程副教授。',[chi]],
  ['research','院系档列软电子、功能高分子、有机电子和能量采集。',[chi]]
 ],'继续追 Georgia Tech 和 Stanford 两段博士后具名任命或导师原文。');
 e.aspects.phd.status='confirmed_advisor';
 evidence(e,'phd','advisor',wang,note,[mse,booklet,group],'wang');
 original(id,mse,'Georgia Tech MSE 博士目录列 Sihong Wang Spring 2014、ZL Wang 和论文题名。');
 original(id,booklet,'Georgia Tech 典礼原册博士候选材料学条目明列 Sihong Wang 和 Advisor Dr. Zhong L. Wang。');
 original(id,chi,'UChicago PME 核分子工程副教授，研究功能高分子、软电子、能量采集及有机电子。');
}
{
 const excludes=[
  ['a66d9ce2','https://physics-astronomy.jhu.edu/directory/yi-li/','Georgia Tech 的 Yi Li 为 2021 春材料博士，目录列 Losego，方向为气相改性的纤维素材料。JHU 个人档列 2013 UC San Diego 物理博士及 2016 年入职。排除本次姓名命中。'],
  ['10754714','https://science.psu.edu/physics/people/yxl15','Georgia Tech 的 Ying Liu 为 2014 夏材料博士，目录列 ZL Wang，论文为 Piezo-Phototronics: From Experiments to Theory。Penn State 原档列 1991 Minnesota 物理博士。排除本次姓名命中。'],
  ['cef8660f','https://galileo.phys.virginia.edu/research/groups/nextlab/member/SHL_CV_2021.pdf','Georgia Tech 的 Seung Geol Lee 为 2011 夏材料博士，研究水凝胶的分子动力学，学校目录列 Bucknall/Jang。UVA Seung-Hun Lee 的本人 CV 列 Johns Hopkins 1996 物理博士、Collin Broholm 指导。排除本次近似姓名命中。'],
  ['c079ed2b','https://tarheels.live/zhanggroup/wp-content/uploads/sites/6762/2026/01/Wei_Zhang_CV_2026.pdf','Georgia Tech 的 Wei Zhang 为 2011 春材料博士，目录列 Yao，论文研究聚合物共连续体系的微孔结构。UNC 本人 CV 列 Washington 2013 材料博士及 Argonne 博后。排除本次姓名命中。'],
  ['412600ca','https://www.colorado.edu/chemistry/media/658','Georgia Tech 的 Wei Zhang 为 2011 春材料博士，目录列 Yao。原 CU Boulder 化学系 Wei Zhang 本人 CV 列 UIUC 2005 化学博士及 Jeffrey S. Moore 指导。排除本次姓名命中。']
 ];
 for (const [id,url,note] of excludes) {
  const p=record.get(id),file=fileFor(p.filename);
  const refs=link('Georgia Tech MSE 目录同名核对',mse)+' · '+link('本人物原档',url);
  const prior=JSON.parse(priorAudit.get(id).details_json);
  edit(file,starts('核查边界'),(line,nl)=>line+nl+'- 学位目录同名核对：'+note+' '+refs);
  school(p,line=>line,refs);
  const e=review(id,[['identity',prior.aspects.identity.note+' '+note,[url,mse]]],prior.next_step);
  e.followup_required=prior.followup_required;
 }
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
