const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root = '..';
const notes = path.join(root,'人物');
const index = path.join(root,'师承关系索引.md');
const records = db.prepare('SELECT id,filename,unit FROM records WHERE id=?');
const last = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const updates = new Map(), audits = [], relations = [];
function line(file, match, suffix) {
 const text = updates.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = text.includes('\r\n') ? '\r\n' : '\n';
 const rows = text.split(/\r?\n/);
 const matches = rows.map((row,i) => match(row) ? i : -1).filter(i=>i>=0);
 if (matches.length !== 1) throw Error(file+' expected one line, found '+matches.length);
 const i = matches[0];
 if (!rows[i].includes(suffix)) rows[i] += suffix;
 updates.set(file, rows.join(newline));
}
function source(label,url) { return '['+label+']('+url+')'; }
function personLine(id,prefix,suffix) {
 const record = records.get(id);
 line(path.join(notes,record.filename+'.md'),x=>x.startsWith(prefix),suffix);
}
function schoolSource(id,suffix) {
 const record=records.get(id);
 const file=path.join(root,record.unit+'逐人复核记录.md');
 const contents=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=contents.includes('\r\n')?'\r\n':'\n';
 const rows=contents.split(/\r?\n/);
 const i=rows.findIndex(x=>x.startsWith('| [['+record.filename+'|'));
 if(i<0||!rows[i].endsWith(' |'))throw Error('missing school row '+id);
 if(!rows[i].includes(suffix))rows[i]=rows[i].slice(0,-2)+suffix+' |';
 updates.set(file,rows.join(newline));
}
function audit(id,changes,next) {
 const original=JSON.parse(last.get(id).details_json);
 original.audit_id='pi_archive_20261110_1914_'+id;
 original.followup_required=true;
 original.next_step=next;
 for(const [key,note,sources] of changes){
  const aspect=original.aspects[key];
  original.aspects[key]={...aspect,note,sources:[...new Set([...sources,...aspect.sources])]};
 }
 audits.push(original);
 return original.audit_id;
}
const p='2531bba0',w='e33ef9f9',h='250ba448',c='65606257';
const harv='https://www.physics.harvard.edu/sites/g/files/omnuum6476/files/physics/files/newsletter_fall_2019.pdf';
const yale='https://proberlab.yale.edu/sites/default/files/nanobolometers_for_thz_photon_detection.pdf';
const pPhd='Harvard 物理系 2019 秋季原刊在 Daniel Prober 的 Ph.D. 条目明确并列 M. Beasley 与 M. Tinkham 为 Advisors。';
const pPost='Prober 本人署名论文的作者简介列 1975 Harvard 物理博士，同年开始 Yale 助理教授任期。已核履历未见独立博士后任用。';
const pAudit=audit(p,[['phd',pPhd,[harv]],['postdoc',pPost,[yale]]],'找 Harvard 1975 博士论文签署页，另查首次到 Yale 前是否有独立短期博士后任用。');
audits.at(-1).aspects.phd.status='confirmed_advisor';
audits.at(-1).aspects.postdoc.status='no_postdoc_documented';
for(const mentor of ['师承人物 - Malcolm Beasley','师承人物 - Michael Tinkham']){
 const add=' '+pPhd+' '+source('Harvard 原刊',harv);
 const record=records.get(p);
 line(path.join(notes,record.filename+'.md'),x=>x.startsWith('- 博士导师：')&&x.includes('[['+mentor+'|'),add);
 line(path.join(notes,mentor+'.md'),x=>x.startsWith('- 博士生：')&&x.includes('[['+record.filename+'|'),add);
 line(index,x=>x.startsWith('- [['+record.filename+'|')&&x.includes(' → 博士导师：[['+mentor+'|'),add);
 relations.push({event_id:'pi_archive_20261110_1914_'+p+'_'+relations.length,record_id:p,stage:'phd',mentor_filename:mentor,kind:'advisor',source_audit_id:pAudit,evidence:pPhd,sources:[harv,yale]});
}
personLine(p,'- 核查边界：',' '+pPost+' '+source('本人署名论文履历',yale));
schoolSource(p,' · '+source('Harvard 具名导师原刊',harv)+' · '+source('1975 Yale 任用',yale));
function updateSchoolPost(id, text) {
 const record=records.get(id);
 const file=path.join(root,record.unit+'逐人复核记录.md');
 const contents=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=contents.includes('\r\n')?'\r\n':'\n';
 const rows=contents.split(/\r?\n/);
 const i=rows.findIndex(x=>x.startsWith('| [['+record.filename+'|'));
 if(i<0)throw Error('missing school row '+id);
 const cells=rows[i].split(' | ');
 if(cells.length<5||cells[3]!=='待核')throw Error('expected pending postdoc '+id);
 cells[3]=text;rows[i]=cells.join(' | ');
 updates.set(file,rows.join(newline));
}
updateSchoolPost(p,'已核履历未见独立博士后任用');
const nus='https://cde.nus.edu.sg/deans-message-012023-faculty-staff-news/';
const sweden='https://www.miun.se/en/Research/research-centers/stc/news-from-stc-research-center-eng/News-archive/2024-8/meet-mengfei--new-phd-student-in-electronics/';
const tor='https://light.utoronto.ca/alumni_category/academic-and-research-professionals/page/5/';
const work='https://light.utoronto.ca/wp-content/uploads/2023/01/acs.nanolett.1c03696.pdf';
const wuIdentity='NUS 2023 招聘原档确认 MIT 2018 电气工程博士、Toronto 2019 Banting 博后及 NUS 材料系与 A*STAR IMRE 联合任职。Mid Sweden University 原档为 2024 年在读的智能轴承博士生，先前就读中国科学院大学机电工程，二者履历与领域不同。';
const wp='Toronto Sargent 组原档列 Dr. Mengfei Wu 为 Alumna。NUS 招聘档列 2019 Toronto Banting 博后。本人论文的贡献栏说明 Sargent 与 Kuznetsov 共同指导该项目，致谢列 Wu 的 Banting。保留 Sargent 为博士后组属候选，校友条目未列阶段或日期，正式导师待核。';
const wAudit=audit(w,[['identity',wuIdentity,[nus,sweden]],['affiliation','NUS 2023 年 1 月材料科学与工程系助理教授，联合 IMRE 并领导 Excitonics Group。',[nus]],['postdoc',wp,[nus,tor,work]]],'查 Banting 正式 host 与组内任期。MIT 学位原页不可读，保留既有博士关系。');
audits.at(-1).aspects.postdoc.status='group_or_candidate';
const wrec=records.get(w);
const sargent='人员 - Northwestern - Ted Sargent - c2879202';
const ws=' '+source('Toronto 原始组档',tor)+' · '+source('NUS 任用原档',nus);
personLine(w,'- 核查边界：',' '+wuIdentity+' '+source('NUS 招聘原档',nus)+' · '+source('瑞典同名者原档',sweden));
personLine(w,'- 博士后课题组负责人候选：',ws);
line(path.join(notes,sargent+'.md'),x=>x.startsWith('- 博士后课题组成员候选：')&&x.includes('[['+wrec.filename+'|'),ws);
line(index,x=>x.startsWith('- [['+wrec.filename+'|')&&x.includes(' → 博士后课题组负责人候选：'),ws);
updateSchoolPost(w,'Ted Sargent（Toronto 博士后组属候选）');
schoolSource(w,' · '+source('Toronto 组档',tor)+' · '+source('NUS 招聘',nus));
relations.push({event_id:'pi_archive_20261110_1914_'+w+'_postdoc',record_id:w,stage:'postdoc',mentor_filename:sargent,kind:'candidate',source_audit_id:wAudit,evidence:wp,sources:[nus,tor,work]});
const penn='https://almanac.upenn.edu/archive/volumes/v57/n02/pdf_n02/090710.pdf';
const psu='https://www.matse.psu.edu/directory/danielle-reifsnyder-hickey';
const hp='Penn 2010 年 Almanac 在 Lindau 名单列 Danielle Reifsnyder 为化学博士三年级。与 Penn State 本人教育经历相符。此页未列导师，保留 Murray 候选，继续核论文题页。';
audit(h,[['affiliation','Penn State 材料科学与工程系原档确认化学和材料科学与工程的联合任用。',[psu]],['phd',hp,[penn]]],'查 Penn 博士论文及正式 Advisor 字段；Minnesota 博后组属已核，仍查个人指导原档。');
personLine(h,'- 核查边界：',' '+hp+' '+source('Penn 同期校刊',penn));
schoolSource(h,' · '+source('Penn State 材料系',psu)+' · '+source('Penn 同期校刊',penn));
const wisc='https://home.physics.wisc.edu/gilbert/wp-content/uploads/sites/3/2017/08/news01-2.pdf';
const cp='UW 物理系同期招聘原刊列 1983 Cornell 博士、1995 年 Chicago 物理教授及 2001 年 8 月加入 UW。现由 UW 列为荣休。';
audit(c,[['affiliation',cp,[wisc]],['identity',cp,[wisc]]],'继续追 Cornell 论文题页及 Brookhaven、Bell 两段正式博后指导。');
personLine(c,'- 核查边界：',' '+cp+' '+source('UW 2001 年任用原档',wisc));
schoolSource(c,' · '+source('UW 2001 年任用原档',wisc));
const mismatch=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(w,sweden);
if(!mismatch)throw Error('未保存同名者原页');
const exclusion=[{page_id:mismatch.id,url:sweden,record_id:w,audit_id:wAudit,external_subject:'Mid Sweden University 智能轴承博士生 Mengfei Wu',evidence:wuIdentity}];
db.close();

if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,exclusions:exclusion.length}));
 process.exit(0);
}
function persist(file,data) {
 fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');
}
function call(script,file) { execFileSync(process.execPath,['--no-warnings',script,...(script==='人物网页身份纠偏.cjs' ? [] : ['record']),file],{stdio:'inherit'}); }
for(const event of audits) {
 const file='20261110_1914_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates) fs.writeFileSync(file,contents,'utf8');
persist('20261110_1914_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_1914_结构化回执.json');
persist('20261110_1914_同名排除.json',exclusion);
call('人物网页身份纠偏.cjs','20261110_1914_同名排除.json');

