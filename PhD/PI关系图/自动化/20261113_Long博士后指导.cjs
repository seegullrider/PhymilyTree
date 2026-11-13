const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), {readOnly:true});
const source = 'https://www.chemistry.harvard.edu/sites/g/files/omnuum7776/files/2026-07/Jeffrey%20R.%20Long%20CV%202026.pdf#page=10';
const mentor = '人员 - UC Berkeley - Jeffrey R. Long - dcbb0150';
const people = [
  {id:'a82898b7', name:'Zachary P. Smith', unit:'MIT', years:'2014–2016'},
  {id:'ba1ad8f2', name:'Michael Nippe', unit:'Texas A&M', years:'2011–2014'}
];
const changes = new Map();
function edit(file, fn) { const p=path.join(root,file); const old=changes.has(p)?changes.get(p):fs.readFileSync(p,'utf8'); const out=fn(old); if(out===old) throw Error('未匹配 '+file); changes.set(p,out); }
const edges=[]; const audits=[];
for(const person of people) {
 const file=`人员 - ${person.unit} - ${person.name} - ${person.id}`;
 const proof=`Long 本人 Harvard 履历第 10 页的“Postdoctoral Scholars Supervised”明确列 ${person.name}（${person.years}），支持其博士后指导关系。 [导师本人履历](${source})`;
 const prior=JSON.parse(db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(person.id).details_json);
 prior.audit_id=`pi_20261113_long_cv_${person.id}`;
 prior.aspects.postdoc={status:'confirmed_advisor',note:proof,sources:[source,...prior.aspects.postdoc.sources]};
 prior.next_step=person.id==='ba1ad8f2'?'继续核 Christopher Chang、Kenneth Raymond 的具体指导职衔及 Berkeley/LBNL 任期。':'继续核 UT Austin 论文签署页细分两位博士导师的正式职衔。';
 audits.push(prior);
 edges.push({event_id:prior.audit_id+'_postdoc',record_id:person.id,stage:'postdoc',mentor_filename:mentor,kind:'advisor',source_audit_id:prior.audit_id,evidence:proof,sources:[source]});
 edit(`人物/${file}.md`,s=>s.replace(/^- 博士后阶段研究师长：\[\[人员 - UC Berkeley - Jeffrey R\. Long[^\n]+/m,`- 博士后导师：[[${mentor}|Jeffrey R. Long]]。${proof}`));
 edit(`人物/${mentor}.md`,s=>s.replace(new RegExp(`^- 博士后阶段研究者：\\[\\[${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[^\\n]+`,'m'),`- 博士后研究者：[[${file}|${person.name}]]。${proof}`));
 edit('师承关系索引.md',s=>s.replace(new RegExp(`^- \\[\\[${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[^\\n]*博士后阶段研究师长：\\[\\[人员 - UC Berkeley - Jeffrey R\\. Long[^\\n]+`,'m'),`- [[${file}|${person.name}]] → 博士后导师：[[${mentor}|Jeffrey R. Long]]。${proof}`));
 edit(`${person.unit}逐人复核记录.md`,s=>s.replace(new RegExp(`^\\| \\[\\[${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[^\\n]+`,'m'),line=>line.replace(person.id==='ba1ad8f2'?'Jeffrey R. Long、Kenneth N. Raymond（阶段研究师长）':'Jeffrey R. Long（博士后研究指导）',person.id==='ba1ad8f2'?'Jeffrey R. Long（博士后导师）、Kenneth N. Raymond（阶段研究师长）':'Jeffrey R. Long（博士后导师）').replace(/ \|$/,` · [Long 本人履历](${source}) |`)));
}
for(const [p,s] of changes) fs.writeFileSync(p,s,'utf8');
for(const a of audits){const p=path.join(__dirname,`${a.audit_id}.json`);fs.writeFileSync(p,JSON.stringify(a,null,2));execFileSync(process.execPath,['--no-warnings',path.join(__dirname,'人工核查台账.cjs'),'record',p],{stdio:'inherit'});}
const ep=path.join(__dirname,'结构化-20261113-Long博士后.json'); fs.writeFileSync(ep,JSON.stringify(edges,null,2));
execFileSync(process.execPath,['--no-warnings',path.join(__dirname,'结构化师承关系.cjs'),'record',ep],{stdio:'inherit'});
console.log(JSON.stringify({people:people.length,files:changes.size}));
