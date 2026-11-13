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
const u={
  "uci": "https://faculty.uci.edu/profile/?facultyId=4957",
  "lbl": "https://history.lbl.gov/Publications/Currents/Archive/Aug-11-2000.html",
  "ibm": "https://www.physics.uci.edu/~collinsp/pubs/07.Collins.pdf",
  "brunel": "https://www.brunel.ac.uk/people/philip-collins/teaching",
  "cmu": "https://energy.cmu.edu/directory/bios/towe-elias.html",
  "nap": "https://www.nationalacademies.org/read/13540/chapter/5",
  "rle": "https://citeseerx.ist.psu.edu/document?doi=fa12540ae6578a8e2dbd6891bba83bde1b6375f8&repid=rep1&type=pdf",
  "lou": "https://louie.berkeley.edu/wp-content/uploads/sites/8/2019/05/Louie-short-CV-5-2019.pdf",
  "hk": "https://ias.hkust.edu.hk/people/ias-members/visitors/prof-steven-louie",
  "doe": "https://www.osti.gov/servlets/purl/1533024",
  "ber": "https://thesis.caltech.edu/8175/",
  "duke": "https://trinity.duke.edu/news/natures-pathways-future-clean-energy-technologies",
  "ia": "https://iaqms.org/members/beratan.php",
  "rice": "https://profiles.rice.edu/faculty/xuedan-ma",
  "lanl": "https://lanlexperts.elsevierpure.com/en/clippings/gia-wei-chern-and-xuedan-ma-receive-postdoc-distinguished-perform-13/",
  "prem": "https://appliedphysics.northwestern.edu/people/faculty/prem-kumar.html"
};

const c='321232ac', t='32316ba4', l='3253eda8', j='87da0275', b='32a4e448', m='3264edbd', k='e4fdb338';
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mf=name=>path.join(notes,name+'.md');
const sl=id=>path.join(root,records.get(id).unit+'逐人复核记录.md');
const wiki=(name,display)=>'[['+name+'|'+display+']]';
const who=(id,display)=>wiki(records.get(id).filename,display);
const get=file=>updates.get(file)??fs.readFileSync(file,'utf8');
const boundary='- 核查边界：';
function rewrite(file,test,fn) {
 const content=get(file);
 const nl=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const indexes=rows.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(indexes.length!==1)throw Error(file+' expected one matching row, found '+indexes.length);
 const i=indexes[0];
 rows[i]=fn(rows[i],nl);
 updates.set(file,rows.join(nl));
}
function school(id,oldField,newField) {
 const r=records.get(id);
 rewrite(sl(id),x=>x.startsWith('| [['+r.filename+'|'),x=>{
  if(x.includes(newField))return x;
  if(!x.includes(oldField))throw Error('missing school field '+id);
  return x.replace(oldField,newField);
 });
}
function insertAfter(file,prefix,entry){
 if(get(file).includes(entry))return;
 rewrite(file,x=>x.startsWith(prefix),(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261110_2007_'+id;
 orig.followup_required=true;
 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261110_2007_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}
const evidenceCollins='UCI 本人原档列 1998 Berkeley 物理博士、1998–1999 LBNL、1999–2001 IBM Watson；2000 年 Berkeley Lab 原刊称 Collins 曾在材料科学部任物理研究人员，当时在 IBM。两档均未明确岗位是博士后。';
const evidenceName='Brunel 另一位 Philip Collins 为土木与环境工程 Reader，教学方向为地貌及岩土工程。UCI 的 Philip G. Collins 为物理与天文系纳米电子学研究者。已排除该 Brunel 教学页误配。';
const evidenceAvouris='2000 年二人署名原稿将 Collins 和 Avouris 同列 IBM Watson 纳米管研究人员，并具名 Avouris 为 IBM 纳米科学组主管。仅作为 IBM 早期研究阶段的低可信候选，Collins 的聘任性质、个人指导和明确组属仍待核。';
const csrc=source('UCI 本人原档',u.uci)+' · '+source('Berkeley Lab 同期原刊',u.lbl);
const asrc=source('本人同期原稿',u.ibm);
const av='师承人物 - Phaedon Avouris', al=wiki(av,'Phaedon Avouris');
rewrite(pf(c),x=>x.startsWith('- 博士后：')||x.startsWith('- 博士后经历待核。'),()=>'- 博士后经历待核。'+evidenceCollins+' '+csrc);
insertAfter(pf(c),'- 博士后经历待核。','- 博士后阶段导师候选：'+al+'。'+evidenceAvouris+' '+csrc+' · '+asrc);
insertAfter(pf(c),'- 博士后阶段导师候选：','- 同名消歧：'+evidenceName+' '+source('Brunel 同名者教学档',u.brunel)+' · '+source('UCI 本人原档',u.uci));
insertAfter(mf(av),'## 研究指导','\n- 博士后阶段候选关联：'+who(c,'Philip Collins')+'。'+evidenceAvouris+' '+csrc+' · '+asrc);
const ci='- '+who(c,'Philip Collins')+' → 博士后阶段导师候选：'+al+'。'+evidenceAvouris+' '+csrc+' · '+asrc;
const ciAnchor=get(index).split(/\r?\n/).find(x=>x.startsWith('- '+who(c,'Philip Collins')+' → 博士阶段课题组负责人：'));
if(ciAnchor)insertAfter(index,ciAnchor,ci);
else {
 const old=get(index);
 if(!old.includes(ci))updates.set(index,old.trimEnd()+'\n\n## UCI IBM 阶段候选补证（2026-11-10）\n\n'+ci+'\n');
}
const cand=path.join(root,'师承候选线索索引.md'), cd=get(cand);
if(!cd.includes(ci))updates.set(cand,cd.trimEnd()+'\n\n## UCI IBM 阶段候选补证（2026-11-10）\n\n'+ci+'\n');
school(c,' | 待核；IBM 工作不自动视为博士后 | ',' | LBNL 1998–1999、IBM 1999–2001 任用类别待核，Avouris（IBM 指导候选） | ');
schoolSource(c,' · '+csrc+' · '+asrc);
const ca=audit(c,[['identity',evidenceName,[u.uci,u.brunel]],['phd','UCI 院系原档核 1998 Berkeley 物理博士。原有 Zettl 组属保留，正式论文导师待核。',[u.uci]],['postdoc',evidenceCollins+' '+evidenceAvouris,[u.uci,u.lbl,u.ibm],'group_or_candidate']], '查 Berkeley 1998 论文签署，LBNL 与 IBM 的聘任档案及具名导师。');
relation(c,ca,'postdoc',av,'candidate',evidenceAvouris,[u.uci,u.lbl,u.ibm],'avouris');

const tc='CMU 原档核 ECE 与 MSE 双任、MIT 1987 EECS 博士及量子点和量子光子器件方向。RLE 同期报告在同一量子阱激光阵列项目列 Towe 与 Clifton G. Fonstad Jr.，但未标导师，保留原候选。';
const tp='NAS 原讲者简介列 MIT 后到 UVA 的 ECE 与工程物理任教，后任 DARPA 项目主管，2001 年入 CMU。未分列独立博后，毕业至首任教职之间仍待查。';
personLine(t,'- 博士导师候选：',' '+tc+' '+source('MIT RLE 同期原报告',u.rle));
personLine(t,boundary,' '+tp+' '+source('NAS 原讲者档案',u.nap));
schoolSource(t,' · '+source('CMU ECE／MSE 双任原档',u.cmu)+' · '+source('MIT RLE 同期原报告',u.rle)+' · '+source('NAS 原履历',u.nap));
audit(t,[['phd',tc,[u.cmu,u.rle]],['postdoc',tp,[u.nap,u.cmu]]], 'MIT DSpace 退避结束后取 1987 论文签署页，查 UVA 首聘与间隔经历。');

const lp='本人 Berkeley CV 分列 1976 UC Berkeley NSF 博后、1977–1979 IBM Watson 博后、1979 Bell Labs 访问科学家、1979–1980 Penn 物理助理教授。前两段个人导师均待查。HKUST 2011–2021 Senior Visiting Fellow 为后期访问任用。';
personLine(l,boundary,' '+lp+' '+source('本人 Berkeley CV',u.lou)+' · '+source('HKUST 访问任用档',u.hk));
school(l,' | 待核 | ',' | 1976 Berkeley NSF 博后、1977–1979 IBM 博后，个人导师待核 | ');
schoolSource(l,' · '+source('本人 Berkeley CV',u.lou)+' · '+source('HKUST 访问任用档',u.hk));
audit(l,[['postdoc',lp,[u.lou,u.hk]]], '分别查 Berkeley 1976 NSF fellowship 档与 IBM Watson 1977–1979 指导关系。保留 Cohen 博士阶段师长。');

const jp='Jian Li 本人合著原稿的作者简介列 2005 年 USC 化学博士、2006 年 ASU School of Materials 助理教授及 2012 年升任副教授。将待核空档缩至 2005 年毕业至 2006 年赴 ASU 之间。文中 2011–2015 年 ASU 博后所指为另一作者 Guijie Li，勿串入 Jian Li 履历。';
rewrite(pf(j),x=>x.startsWith('- 学位阶段：'),x=>x.includes(jp)?x:x.replace('2005–2009 年的经历和博士后指导者仍待核。','')+' '+jp+' '+source('本人共同署名原稿',u.doe));
school(j,'2009–2010 ASU 名册列助理教授；2005–2009 经历及博士后导师待核','本人原稿列 2006 入 ASU 任助理教授；2005–2006 经历及博士后导师待核');
schoolSource(j,' · '+source('本人共同署名原稿',u.doe));
audit(j,[['postdoc',jp,[u.doe]]], '查 2005–2006 岗位及 USC 原论文导师。保留 Thompson 博士组属。');

const ma='师承人物 - Rudolph A. Marcus', ho='师承人物 - John J. Hopfield';
const bm='Caltech 原目录列 Rudolph A. Marcus 为 Research Advisor 及论文委员会主席。论文 1985 年答辩，目录所载学位年份为 1986。关系类型可信度：高。';
const bh='本人学位论文致谢明确称 John J. Hopfield 多年指导，并称在 Hopfield–Dervan 组工作。Duke 本人采访称 Hopfield 为博士导师；Caltech 论文目录将 Hopfield 列为委员会成员。图谱分列研究指导与论文目录登记职衔，保留本人原称谓。关系类型可信度：高。';
const bp='IAQMS 成员原档将 JPL NRC Resident Research Associate 列为 1985–1987，与 1986 授予学位年份同时保留。NASA 名单的 1985-07-08 至 1986-07-07 是其中一段，导师仍待核。';
const bmLine=wiki(ma,'Rudolph A. Marcus')+'。'+bm+' '+source('Caltech 学位原档',u.ber);
const bhLine=wiki(ho,'John J. Hopfield')+'。'+bh+' '+source('学位论文致谢及目录',u.ber)+' · '+source('Duke 本人采访',u.duke);
const bw=who(b,'David N. Beratan');
for(const [mentor,label,rev,evidenceText,main] of [[ma,'博士导师','博士生',bm,bmLine],[ho,'博士阶段研究师长','博士阶段研究者',bh,bhLine]]){
 const target='[['+mentor+'|';
 rewrite(pf(b),x=>x.startsWith('- 博士导师（来源表述存在差异）：'+target)||x.startsWith('- '+label+'：'+target),()=>'- '+label+'：'+main);
 rewrite(index,x=>x.startsWith('- '+bw+' → 博士导师（来源表述存在差异）：'+target)||x.startsWith('- '+bw+' → '+label+'：'+target),()=>'- '+bw+' → '+label+'：'+main);
 rewrite(mf(mentor),x=>x.startsWith('- 博士生（来源表述存在差异）：'+bw)||x.startsWith('- '+rev+'：'+bw),()=>'- '+rev+'：'+bw+'。'+evidenceText+' '+source('Caltech 学位原档',u.ber)+(mentor===ho?' · '+source('Duke 本人采访',u.duke):''));
}
rewrite(pf(b),x=>x.startsWith(boundary),()=>boundary+'Caltech 论文目录的正式导师和本人回忆中的博士研究指导已分列。'+bp+' '+source('IAQMS 成员档案',u.ia));
school(b,'Rudolph A. Marcus（论文库）、John J. Hopfield（本人称导师）；来源表述差异待核','Rudolph A. Marcus（论文导师）、John J. Hopfield（博士研究师长，本人称导师）');
school(b,'JPL 博士后，导师待核','JPL NRC 1985–1987 博士后，导师待核');
schoolSource(b,' · '+source('Caltech 论文原档',u.ber)+' · '+source('IAQMS JPL 任用档',u.ia));
const ba=audit(b,[['phd',bm+' '+bh,[u.ber,u.duke],'confirmed_advisor'],['postdoc',bp,[u.ia]]], '追查 JPL 1985–1987 NRC 原接收项目和具名指导者。');
relation(b,ba,'phd',ma,'advisor',bm,[u.ber],'marcus');
relation(b,ba,'phd',ho,'stage_mentor',bh,[u.ber,u.duke],'hopfield');

const mp='LANL 原刊明确 2015 年 4 月 Ma 为 CINT–Sandia 博后。Rice 本人档列 2016 年开始 Argonne CNM 研究岗、2021 年晋升 RD3、2017–2024 Chicago CASE 与 Northwestern NAISE 两项关联，2024 年 7 月入 Rice。博后开始日期和具名导师仍待查，Htoon 与 Doorn 两位获奖提名人保留候选。';
personLine(m,boundary,' '+mp+' '+source('Rice 本人原档',u.rice)+' · '+source('LANL 2015 同期原刊',u.lanl));
schoolSource(m,' · '+source('LANL 2015 同期原刊',u.lanl)+' · '+source('UCI 2026 讲座原档','https://engineering.uci.edu/files/xuedan_ma_flyer.pdf'));
audit(m,[['postdoc',mp,[u.rice,u.lanl],'group_or_candidate']], '查 LANL／Sandia CINT 任用及项目原档中的博后导师。');

const kp='Northwestern 应用物理原档确认 ECE 及物理与天文学教授，1980 SUNY Buffalo 博士，现研究光子通信、计算和量子光学。Brink 博士候选保留，USC 研究科学家是否属于博后任用仍待核。';
personLine(k,boundary,' '+kp+' '+source('Northwestern 应用物理原档',u.prem));
schoolSource(k,' · '+source('Northwestern 应用物理原档',u.prem));
audit(k,[['affiliation',kp,[u.prem]]], '查 1980 年 Buffalo 学位论文和 USC Center for Laser Studies 的 1980–1981 任用原档。');

const wrong=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(c,u.brunel);
if(!wrong)throw Error('缺少已读同名页');
const exclusions=[{page_id:wrong.id,url:u.brunel,record_id:c,audit_id:ca,external_subject:'Brunel 土木与环境工程 Reader Philip Collins',evidence:evidenceName}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,exclusions:exclusions.length}));
 process.exit(0);
}
function persist(file,data) {fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,file) {execFileSync(process.execPath,['--no-warnings',script,...(script==='人物网页身份纠偏.cjs'?[]:['record']),file],{stdio:'inherit'});}
for(const event of audits) {
 const file='20261110_2007_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261110_2007_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_2007_结构化回执.json');
persist('20261110_2007_同名排除.json',exclusions);
call('人物网页身份纠偏.cjs','20261110_2007_同名排除.json');
