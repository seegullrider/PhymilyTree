const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const stamp = '20261111_1123';
const update = new Map();
const audits = [];
const p = (name) => '../人物/'+name+'.md';
const dates = 'UC Davis 系档明确列 2011–2013 Iowa State 博后，另列自 2013 年起 Ames Scientist，结束年份待核';
const newEvidence = '学位论文致谢具名 Paul Canfield 接收本人为博士后。Canfield 本人组档分别列 Taufour 为前博后和前研究人员，'+dates+'。Canfield 保留为 Iowa State 博后阶段研究师长，正式个人导师称谓仍待任用原档。';
const previous = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
function audit(id, change) {
  const a = JSON.parse(previous.get(id).details_json);
  const aid = 'pi_archive_'+stamp+'_'+id;
  if(a.audit_id!==aid) {
    a.audit_id=aid;
    change(a);
  }
  audits.push(a);
  return a;
}
function edit(file, before, after, expected) {
  const body = update.get(file)??fs.readFileSync(file,'utf8');
  const n = body.split(before).length-1;
  if(n!==expected){
    if(n===0&&body.includes(after))return;
    throw Error(file+' unexpected source-text count '+n);
  }
  update.set(file,body.replaceAll(before,after));
}
const t = audit('613eb6f7', a=>{
  a.aspects.postdoc.note=newEvidence;
  a.next_step='追查 Iowa State 2011–2013 博后任用中的具名导师称谓，并核对 2013 年开始的 Ames Scientist 任用结束日期。';
});
for(const [file,count] of [
  [p('人员 - UC Davis - Valentin Taufour - 613eb6f7'),2],
  [p('师承人物 - Paul C. Canfield'),1],
  ['../师承关系索引.md',1],
]){
  edit(file,'学位论文致谢具名 Paul Canfield 接收本人为博士后。Canfield 本人组档分别列 Taufour 为前博后和前研究人员，UC Davis 本人档列 2011–2013 Iowa State 博后、2013–2016 Ames Scientist，保留阶段研究师长。正式个人导师称谓仍待任用原档。',newEvidence,count);
}
edit('../UC Davis逐人复核记录.md','；2013–2016 Ames Scientist |','；2013 年起另列 Ames Scientist，截止待核 |',1);

const cv='https://sites.utexas.edu/chang/wp-content/uploads/sites/4922/2018/01/chichang_CV_full.pdf';
const zhang='https://xlab.hku.hk/alumni.html';
const mismatch='Zhang 组档列 Chih-wei Chang、2009 年博后、National Taiwan University 去向；UT Austin Chih-Hao Chang 本人 CV 明列 2008–2009 SMART Singapore、2009–2011 MIT 两段 Postdoctoral Associate。姓名中段、单位和履历均不同，排除此名录误配。';
audit('2a04fc29',a=>{
  const i=a.aspects.identity;
  i.note += ' '+mismatch;
  i.sources=[...new Set([...i.sources,cv,zhang])];
});
const name='人员 - UT Austin - Chih-Hao Chang - 2a04fc29';
const file=p(name);
const line='- 同名筛查：'+mismatch+' [UT Austin 托管本人 CV]('+cv+') · [Zhang 组原档]('+zhang+')';
if(!fs.readFileSync(file,'utf8').includes(line)){
  const boundary='- 核查边界：本人简历明确区分博士与博士后导师。';
  edit(file,boundary,boundary+'\r\n'+line,1);
}
db.close();
const rel=[{event_id:t.audit_id+'_postdoc_canfield',record_id:'613eb6f7',stage:'postdoc',mentor_filename:'师承人物 - Paul C. Canfield',
  kind:'stage_mentor',source_audit_id:t.audit_id,evidence:newEvidence,sources:t.aspects.postdoc.sources}];
function persist(suffix,data) {
  const file=stamp+'_'+suffix+'.json';
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n','utf8');
  return file;
}
function run(script,...args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
console.log(JSON.stringify({files:update.size,audits:audits.length,typed_updates:rel.length}));
if(process.argv[2]==='apply'){
  for(const a of audits)run('人工核查台账.cjs','record',persist('人工_'+a.record_id,a));
  for(const [file,body] of update)fs.writeFileSync(file,body,'utf8');
  run('结构化师承关系.cjs','record',persist('结构化',rel));
}
