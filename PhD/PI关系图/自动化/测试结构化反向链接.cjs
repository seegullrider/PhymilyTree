// 验证自动检索块之后的人工反链仍参与检查，且各阶段的候选标记可见。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),people=path.join(root,'人物'),read=n=>fs.readFileSync(path.join(people,n+'.md'),'utf8');
const kane=read('人员 - UPenn - Charles L. Kane - 104a1223'),marker=kane.indexOf('<!-- PI-AUTO-SEARCH:END -->'),teo=kane.indexOf('人员 - University of Virginia - Chi Yan Jeffrey Teo - f4e7bfab');
assert(marker>=0&&teo>marker,'Teo 反链是自动块后的人工内容，不可截断');
for(const n of ['师承人物 - Martin Head-Gordon','师承人物 - Eric Schwegler']){const l=read(n).split(/\r?\n/).find(x=>x.includes('83f4aeb0'));assert(l&&/博士后/.test(l)&&/候选/.test(l),n)}
const run=spawnSync(process.execPath,['--no-warnings',path.join(__dirname,'检查结构化关系反向链接.cjs')],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const stats=JSON.parse(run.stdout);assert(stats.relations>0&&stats.linkFound===stats.relations&&stats.stageMentioned===stats.relations);assert.equal(stats.candidateMarked,stats.candidates);
console.log(JSON.stringify({relations:stats.relations,candidates:stats.candidates,tests:'自动块后内容、阶段与候选反链通过'}));
