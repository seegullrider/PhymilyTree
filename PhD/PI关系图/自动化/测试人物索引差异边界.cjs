// 以当前只读记录为回归样例；检查脚本只刷新候选报告，不写人物或索引。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const run=spawnSync(process.execPath,['--no-warnings',path.join(__dirname,'人物与索引缺边检查.cjs')],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'人物与索引缺边待核.json'),'utf8'));
const absent=(id,mentor)=>!data.missingPerson.some(x=>x.id===id&&x.mentor===mentor);
assert(absent('8469ec6f','人员 - Harvard - Eugene Demler — 学校任职信息冲突 - d37c6cf8'),'长标签不能漏掉 Demler 候选');
assert(absent('8469ec6f','人员 - Harvard - David R. Nelson - 4c312119'),'长标签不能漏掉 Nelson 候选');
assert(absent('0d4f9aed','师承人物 - Harold G. Craighead'),'博士后课题组候选应识别');
assert(absent('0d4f9aed','人员 - Cornell - Jeevak Parpia - 407d7343'),'博士后课题组候选应识别');
assert(absent('614fbb10','师承人物 - Guy Deutscher'),'单独博士候选章节应识别');
assert(absent('614fbb10','人员 - UC Santa Barbara - Alan J. Heeger - b645ff67'),'单独博士后候选章节应识别');
assert(absent('bb3d457a','师承人物 - Henryk Temkin'),'分号连接的共同候选应识别');
assert(absent('72a18dbd','人员 - Harvard - Bertrand Halperin - a4b7e1f4'),'按年份分列的博士后导师应识别');
assert(!data.missingIndex.some(x=>x.id==='614fbb10'&&x.mentor.includes('Kathryn Moler')),'候选章节中的反向研究者不能被当作本人导师');
assert(!data.missingPerson.some(x=>x.id==='bbf1dd04'&&x.mentor==='师承人物 - K. Schierbaum'),'已撤回的评阅人不应继续作为导师候选');
assert(absent('a9d1ffad','师承候选线索索引'),'证据句尾的候选索引不能当作导师');
assert(!data.missingIndex.some(x=>x.id==='9946ebed'&&x.mentor==='人员 - Duke - David Mitzi - b4ea6398'),'已写入候选索引的关系不应被报为缺边');
console.log(JSON.stringify({records:data.records,missingIndex:data.missingIndex.length,missingPerson:data.missingPerson.length,tests:'通过'}));
