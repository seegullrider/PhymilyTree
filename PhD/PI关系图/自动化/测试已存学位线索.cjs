// 回归：检索中出现硕士或工程师论文时不能误加博士论文优先队列。
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const script=path.join(__dirname,'已存检索结果交叉论文线索.cjs');
const scan=spawnSync(process.execPath,['--no-warnings',script,'scan'],{encoding:'utf8'});assert.equal(scan.status,0,scan.stderr);
const report=JSON.parse(fs.readFileSync(path.join(__dirname,'已存检索结果交叉论文候选.json'),'utf8'));
const masters=report.candidates.find(x=>x.record_id==='32e8b6e6');assert.equal(masters?.level_hint,'非博士学位线索');
const engineer=report.candidates.find(x=>x.record_id==='33db0d42');assert.equal(engineer?.level_hint,'非博士学位线索');
const mfa=report.candidates.find(x=>x.record_id==='0859b195');assert.equal(mfa?.level_hint,'非博士学位线索');
const uiuc=report.candidates.filter(x=>x.record_id==='7f5fb57c');assert(uiuc.some(x=>x.level_hint==='博士线索')&&uiuc.some(x=>x.level_hint==='非博士学位线索'),'同一姓名的不同学位须区分');
assert(report.candidates.some(x=>x.record_id==='d3c23b2b'&&x.url.startsWith('https://ecommons.cornell.edu/')),'Cornell 馆藏线索应被识别');
assert(report.candidates.some(x=>x.record_id==='254ef078'&&x.url.startsWith('https://thesis.caltech.edu/')),'Caltech 同名仅是线索，仍须人工辨别');
const conflict=report.candidates.find(x=>x.record_id==='254ef078'&&x.url==='https://thesis.caltech.edu/4168/');assert.match(conflict?.identity_conflict?.reason||'',/身份冲突/,'已记录的同名冲突须出现在候选中');
assert(report.candidates.find(x=>x.record_id==='379c14bf'&&x.url==='https://www.ideals.illinois.edu/items/80024')?.identity_conflict,'不同学位学校须提示核身');
assert(report.candidates.some(x=>x.record_id==='60607f36'&&x.url==='https://escholarship.org/uc/item/28f1n9gq'),'UC 论文 PDF 应规范为稳定馆藏页，学位和身份仍待原文核实');
assert(report.candidates.some(x=>x.record_id==='8c2b41f5'&&x.url==='https://escholarship.org/uc/item/9490t693'),'应识别另一 UC 馆藏作者线索，不能自动确认导师');
const doctorate=report.candidates.find(x=>x.record_id==='38d347a1');assert.equal(doctorate?.level_hint,'博士线索');assert.equal(doctorate.already_queued,true);
const tmp=path.join(os.tmpdir(),`pi-thesis-reject-${process.pid}.json`);try{fs.writeFileSync(tmp,JSON.stringify([{record_id:masters.record_id,url:masters.url}]));let attempt=spawnSync(process.execPath,['--no-warnings',script,'enqueue',tmp],{encoding:'utf8'});assert.notEqual(attempt.status,0);assert.match(attempt.stderr,/并非博士/);fs.writeFileSync(tmp,JSON.stringify([{record_id:conflict.record_id,url:conflict.url}]));attempt=spawnSync(process.execPath,['--no-warnings',script,'enqueue',tmp],{encoding:'utf8'});assert.notEqual(attempt.status,0);assert.match(attempt.stderr,/身份冲突/)}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
console.log(JSON.stringify({candidates:report.candidates.length,tests:'多校馆藏、不同学位、非博士拒绝与排队状态通过'}));
