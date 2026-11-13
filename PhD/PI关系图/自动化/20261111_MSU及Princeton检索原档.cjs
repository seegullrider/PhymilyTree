
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const batch = '20261111_MSU及Princeton检索原档';
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
 event.audit_id = 'pi_archive_20261111_msu_princeton_' + id;
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


{
 const id='2c2eff5d',p=record.get(id),file=fileFor(p.filename);
 const u='https://directory.natsci.msu.edu/Directory/Profiles/Person_Embed/102082?group=1124&org=34';
 const nl='https://www.physics.wisc.edu/newsletter/Phys_Nwsltr_Vol_14.pdf';
 const msunl='https://pa.msu.edu/sites/_pa/assets/File/newsletter/nl10.pdf';
 const lsu='https://repository.lsu.edu/gradschool_dissertations/4559/';
 const msk='https://www.mskcc.org/profile/pengpeng-zhang-01';
 const site='https://web.pa.msu.edu/people/zhang/';
 const ref=link('MSU 自然科学学院个人原档',u);
 const sameName='MSU 院档列 Wisconsin 2006 物理博士，并列北师大本科及硕士。LSU 机械与工业工程同名博士的论文为多智能体编队控制，MSK 同名医学物理师持 Case Western Reserve 生医工程博士。两条同名资料均排除为本人物师承证据。';
 const phd='Wisconsin 物理系 2007 通讯的 August 2006 博士名单列纳米 SOI 膜结构与输运论文并括注 Lagally，学校同期报道列其为 Lagally 实验室研究助理。博士组属保留，论文署名角色继续核实。';
 const post='MSU 系刊跨页连读列 Penn State 博后与 Paul Weiss、Dave Allara 共事，保留两位阶段研究师长。';
 append(file,line=>line.startsWith('- Michigan State 物理教授，'),'现行个人原档确认物理与天文学系教授，以及扫描探针、低维电子材料和表界面工程。 '+ref);
 append(file,starts('核查边界'),sameName+' '+ref+' · '+link('LSU 同名学位原档',lsu)+' · '+link('MSK 同名机构档',msk));
 school(p,line=>line,ref+'（复核现任、方向及 Wisconsin 2006 学位）');
 review(id,[
  ['identity',sameName,[u,lsu,msk,nl]],
  ['phd',phd,[nl,'https://news.wisc.edu/study-explains-unexpected-conductivity-of-nanoscale-silicon/']],
  ['postdoc',post,[msunl]],
  ['affiliation','MSU 自然科学学院个人档明确 Professor, Department of Physics & Astronomy。',[u]],
  ['research','MSU 个人档列低维电子、光伏材料，扫描探针显微、表界面工程和二维 TMD 异质结构。',[u]]
 ],'继续用 2006 Wisconsin 物理学位论文题名追 Lagally 正式签署，及 Penn State 博后任命原档。');
 original(id,u,'MSU 自然科学学院教师档核物理与天文学系教授、Wisconsin 2006 博士、北师大本科和硕士；研究含二维 TMD、扫描探针和界面工程。');
 original(id,nl,'Wisconsin 物理系通讯的 August 2006 New PhD’s 列 Zhang 的 SOI 膜论文题名、括注 Lagally 及 Penn State 博后去向。');
 original(id,msunl,'MSU 2010 系刊跨页列 Pengpeng Zhang 的 Penn State 博后与 Paul Weiss、Dave Allara 共事。');
 pages.push({record_id:id,url:site,error:'返回浏览器验证框，未取得实验室正文。保留自然科学学院可读原档，停止自动重试此地址。'});
 pages.push({record_id:'801002ae',url:'https://dataspace.princeton.edu/simple-search?query=Sigillito',error:'Princeton DataSpace 检索页本轮网页工具不可访问，仓储首页另返回 HTTP 401。'});
 pages.push({record_id:'67ee8048',url:'https://catalog.princeton.edu/catalog?q=Daniel+Wasserman&search_field=all_fields',error:'Princeton 图书馆目录的作者查询本轮网页工具不可访问，未取得书目正文。'});
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
 if(relations.length)run('结构化师承关系.cjs','record',persist('关系',relations));
 run('检索流程.cjs','ingest-reviewed-pages',persist('原档',pages));
}
