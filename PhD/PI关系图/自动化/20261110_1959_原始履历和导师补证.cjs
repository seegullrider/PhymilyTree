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
  "asu": "https://catalog.asu.edu/files/shared/archives/Faculty_List_2008_2009_Final.pdf",
  "ornl": "https://www.osti.gov/servlets/purl/6047469",
  "sak": "https://www.wpi-aimr.tohoku.ac.jp/en/topics/pdf/AIMR_News_vol1.pdf",
  "conference": "https://panitz.unm.edu/home/Publications_files/Ultramicroscopy%204%2C%20367%20%281979%29.pdf",
  "ru": "https://www.pa.ucla.edu/faculty-websites/rudnick.html",
  "rk": "https://link.springer.com/chapter/10.1007/978-3-642-55609-8_75",
  "rt": "https://journals.aps.org/prb/abstract/10.1103/PhysRevB.11.363",
  "ly": "https://physics.yale.edu/profile/leonid-glazman",
  "lf": "https://cse.umn.edu/ftpi/leonid-glazman",
  "la": "https://higherlogicdownload.s3.amazonaws.com/APS/34f4d6ec-fa04-44c6-9efe-2eb9b39408d2/UploadedImages/Newsletters/summer2002.pdf",
  "lyn": "https://physics.yale.edu/sites/default/files/files/Physics07F4.pdf",
  "v1": "https://www.roma1.infn.it/~vanheckb/cv.pdf",
  "v2": "https://web.uniroma1.it/trasparenza/sites/default/files/008-Allegato_B_cv_Bernard_van_Heck_AI_FINI_DELLA_PUBBLICAZIONE.pdf",
  "gu": "https://www.materials.ucsb.edu/news/new-faculty-profile-associate-professor-daniel-s-gianola",
  "gn": "https://news.ucsb.edu/2026/022683/imperfections-perfect-materials-platform",
  "gk": "https://www.intl.kit.edu/iforscher/16783.php",
  "pc": "https://chemistry.uchicago.edu/faculty/philippe-guyot-sionnest",
  "hps": "https://science.psu.edu/frontiers/bryce-gadway-and-danielle-hickey",
  "ac": "https://www.physics.ucsc.edu/news-events/newsletter/ucsc-physics-newsletter-2022-final.pdf"
};

const c='e264961e', r='2f6e78e7', l='2e3b5830', g='1a532b7f', p='3163a074', h='250ba448', a='83725183';
const evidence = {
 culbertson: 'ASU 教师档列全名 Robert John Culbertson、Pennsylvania State University 1979 博士。ORNL 当年研究书目列 Applications of magnetic-sector atom-probe field-ion microscopy、Culbertson, R. J., Jr.、1979、UMI 8010043，为待核学位原文的题名和索书线索。东北大学托管 Sakurai CV 显示其 1977–1981 任 Penn State 物理教师，同期原文列两人原子探针场离子显微合著。Toshio Sakurai 仅为低可信博士导师候选，正式导师待论文签署页。',
 rudnick: 'UCLA 原档确认 1970 年 UC San Diego 博士。Rudnick 在 Springer 出版的本人回忆中说 1965 年开始 UCSD 研究生阶段，在读期间与 Walter Kohn 工作并自称其学生。博士阶段研究师长证据充分，正式学位论文导师仍待签署页。',
 earlyRudnick: '1975 年 APS 原稿列 Joseph Rudnick 的 Technion 物理系署名及 Case Western Reserve 现址；原稿于 1974 年收到。两处是博士后职业史的机构线索，不能由署名判断任用类别、任期或个人指导关系。',
 glazman: 'APS 2002 年档列 Glazman 的 1979 Kharkov State University 物理硕士、1982 年乌克兰低温物理与工程研究所博士、1986–1990 年 USSR Academy of Sciences Institute of Microelectronics Technology 固体理论部科学研究员及高级研究员。1982–1986 年经历未列，1986–1990 年岗位原称研究员，仍待早期任用材料。',
 yale: 'Yale 当前物理系原档列物理和应用物理教授及 Yale Quantum Institute 成员，研究介观低维电子、超导量子比特和冷原子流体。Yale 同期原档列 2007 年 7 月开始任教，Minnesota FTPI 历史原档列 1990–2008，任期衔接以两校各自口径记录。',
 gianola: 'UCSB 同期入职报道核 Gianola 在 2009 入 Penn 前为 KIT Humboldt Postdoctoral Research Fellow。KIT 和 UCSB 另列 2026 年访问及资深研究奖励，系另一阶段。早期 KIT 的个人指导者待原始 fellowship 档或本人早期履历，JHU Hemker 组属保留。',
 hickey: 'Penn State 2026 讲座原档核 Penn 化学博士的半导体纳米晶合成与表征及 Minnesota 化工与材料博士后用校正扫描透射电镜研究拓扑绝缘体。IGERT 项目搜索线索点名 Murray，两个 IGERT 项目原页和 Penn 组档未取到正文，保留候选；Minnesota Mkhoyan 组属原有记录保留。',
 guyot: 'Chicago 化学系原档核化学教授与物理联合任用、1987 Berkeley 博士，以及 1991 Paris-Sud Orsay Research Scientist。研究为胶体半导体量子点限域、载流子动力学和中红外探测与发光。Orsay 原称研究科学家，1987–1991 年任用和独立博后指导者待核。',
 aris: 'UCSC 物理系同期刊物核实 Princeton 博士、Illinois 博后和拓扑材料理论，未列正式导师或 Illinois 起止月。Yale 奖学金、Glazman 候选及既有 Fradkin 阶段关系保留。',
};
const personPath=id=>path.join(notes,records.get(id).filename+'.md');
const mentorPath=name=>path.join(notes,name+'.md');
const label=(id,name)=> '[['+records.get(id).filename+'|'+name+']]';
const wiki=(file,name)=> '[['+file+'|'+name+']]';
const boundary='- 核查边界：';
function body(file) { return updates.get(file)??fs.readFileSync(file,'utf8'); }
function addAfter(file,prefix,entry) {
 const current=body(file);
 if(current.includes(entry)) return;
 const nl=current.includes('\r\n')?'\r\n':'\n';
 const rows=current.split(/\r?\n/);
 const matches=rows.map((row,i)=>row.startsWith(prefix)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected unique '+prefix+' got '+matches.length);
 rows.splice(matches[0]+1,0,entry);
 updates.set(file,rows.join(nl));
}
function addNote(name,content) {
 const file=mentorPath(name);
 if(fs.existsSync(file)&&body(file)!==content) throw Error('已有不同内容 '+file);
 updates.set(file,content);
}
function newAudit(id,changes,next) {
 const original=JSON.parse(last.get(id).details_json);
 original.audit_id='pi_archive_20261110_1959_'+id;
 original.followup_required=true;
 original.next_step=next;
 for(const [key,note,sources,status] of changes){
  const aspect=original.aspects[key];
  original.aspects[key]={...aspect,note,status:status??aspect.status,sources:[...new Set([...sources,...aspect.sources])]};
 }
 audits.push(original);
 return original.audit_id;
}
function addRelation(id,auditId,key,stage,mentor_filename,kind,evidence,sources) {
 relations.push({event_id:'pi_archive_20261110_1959_'+id+'_'+key,record_id:id,stage,mentor_filename,kind,source_audit_id:auditId,evidence,sources});
}

const sak='师承人物 - Toshio Sakurai';
const sakLinks=[source('ASU 教师原档',u.asu),source('ORNL 论文书目',u.ornl),source('东北大学本人履历',u.sak),source('同期原论文',u.conference)].join(' · ');
const sakEntry='- 博士导师候选：'+wiki(sak,'Toshio Sakurai')+'。'+evidence.culbertson+' '+sakLinks;
addAfter(personPath(c),'## 师承','\n'+sakEntry);
addNote(sak,'# Toshio Sakurai\n\n> [!info] 师承扩展人物\n> 东北大学原始履历记载其 1974 年获 Penn State 物理博士，1977–1981 年在 Penn State 物理系任助理教授及副教授，后任东北大学材料研究所教授。研究原子尺度表界面。 '+source('东北大学本人履历',u.sak)+'\n\n## 师承\n\n- 博士阶段候选关系：'+label(c,'Robert Culbertson')+'。'+evidence.culbertson+' '+sakLinks+'\n');
const ci='- '+label(c,'Robert Culbertson')+' → 博士导师候选：'+wiki(sak,'Toshio Sakurai')+'。'+evidence.culbertson+' '+sakLinks;
const indexEntry=body(index).split(/\r?\n/).find(row=>row.startsWith('- '+label(c,'Robert Culbertson')+' → 博士后导师候选：'));
if(!indexEntry)throw Error('Culbertson 索引锚点缺失');
addAfter(index,indexEntry,ci);
const candidateIndex=path.join(root,'师承候选线索索引.md');
const candText=body(candidateIndex);
if(!candText.includes(ci)){
 const nl=candText.includes('\r\n')?'\r\n':'\n';
 updates.set(candidateIndex,candText.trimEnd()+nl+nl+'## Penn State 原子探针博士候选（2026-11-10）'+nl+nl+ci+nl);
}
const cRecord=records.get(c), cSchool=path.join(root,cRecord.unit+'逐人复核记录.md');
const cTable=body(cSchool);
const cLine=cTable.split(/\r?\n/).find(row=>row.startsWith('| [['+cRecord.filename+'|'));
if(!cLine.includes('Toshio Sakurai（候选）')){
 const from=' | 博士导师待核 | ',to=' | Toshio Sakurai（Penn State 博士候选） | ';
 if(!cLine.includes(from))throw Error('Culbertson 校表阶段已变');
 updates.set(cSchool,cTable.replace(cLine,cLine.replace(from,to)));
}
schoolSource(c,' · '+source('ASU 学位原档',u.asu)+' · '+source('ORNL 书目 UMI 8010043',u.ornl)+' · '+source('Sakurai 原履历',u.sak));
const ca=newAudit(c,[['phd',evidence.culbertson,[u.asu,u.ornl,u.sak,u.conference],'group_or_candidate']], '按 UMI 8010043 或原题名查 Penn State 签署页，继续查 Bell Labs 任用导师。');
addRelation(c,ca,'sakurai','phd',sak,'candidate',evidence.culbertson,[u.asu,u.ornl,u.sak,u.conference]);

const rdEvidence=' '+evidence.rudnick+' '+source('Springer 本人原文',u.rk)+' · '+source('UCLA 本人院系原档',u.ru);
personLine(r,'- 博士阶段研究师长：',rdEvidence);
line(mentorPath('师承人物 - Walter Kohn'),row=>row.startsWith('- 博士阶段研究成员：'+label(r,'Joseph Rudnick')),rdEvidence);
line(index,row=>row.startsWith('- '+label(r,'Joseph Rudnick')+' → 博士阶段研究师长：'),rdEvidence);
personLine(r,boundary,' '+evidence.earlyRudnick+' '+source('APS 1975 原论文',u.rt));
schoolSource(r,' · '+source('本人回忆出版原页',u.rk)+' · '+source('1975 APS 署名单位',u.rt));
const ra=newAudit(r,[['phd',evidence.rudnick,[u.rk,u.ru]],['postdoc',evidence.earlyRudnick,[u.rt]]], '查 UC San Diego 1970 博士档和 Technion、Case Western Reserve 1970 年代岗位记录。');
addRelation(r,ra,'kohn','phd','师承人物 - Walter Kohn','stage_mentor',evidence.rudnick,[u.rk,u.ru]);

personLine(l,boundary,' '+evidence.glazman+' '+evidence.yale+' '+source('APS 原履历',u.la)+' · '+source('Yale 同期原刊',u.lyn)+' · '+source('Minnesota FTPI 历史目录',u.lf));
schoolSource(l,' · '+source('APS 原履历',u.la)+' · '+source('Yale 2007 任用原刊',u.lyn)+' · '+source('Minnesota FTPI 历史目录',u.lf));
newAudit(l,[['affiliation',evidence.yale,[u.ly,u.lyn,u.lf]],['phd','1982 年乌克兰低温物理与工程研究所博士，现有原档均未列导师。',[u.la,u.ly,u.lf]],['postdoc',evidence.glazman,[u.la]]], '查 1982 年博士原档和 1982–1986 年研究任用。另存其已核学生和博士后反链。');

const van='师承人物 - Bernard van Heck', carlo='师承人物 - Carlo W. J. Beenakker', anton='师承人物 - Anton R. Akhmerov', tjerk='师承人物 - Tjerk H. Oosterkamp';
const vLink=wiki(van,'Bernard van Heck'), lLink=label(l,'Leonid Glazman');
const vSources=source('本人 CV',u.v1)+' · '+source('Sapienza 托管本人履历',u.v2);
const vYale='Yale 2015 年 10 月至 2017 年 5 月博士后。本人两个版本的履历均明确列 Leonid Glazman 为 advisor。关系类型可信度：高。 '+vSources;
addNote(van,'# Bernard van Heck\n\n> [!info] 师承扩展人物\n> 本人 CV 列 2025 年起 Sapienza Università di Roma 物理系副教授，研究介观物理、拓扑物态、超导量子器件。Yale 是历史博士后单位。 '+vSources+'\n\n## 师承\n\n- 博士导师：'+wiki(carlo,'Carlo W. J. Beenakker')+'。2015 Leiden 物理博士，本人 CV 明列主导师。 '+vSources+'\n- 博士共同导师：'+wiki(anton,'Anton R. Akhmerov')+'。本人 CV 列 PhD co-advisor，所属 TU Delft。 '+source('本人 CV',u.v1)+'\n- 博士后导师：'+lLink+'。'+vYale+'\n- 博士后课题组负责人：'+wiki(tjerk,'Tjerk H. Oosterkamp')+'。本人 CV 列 2021 年 10 月至 2022 年 9 月 Leiden 博后，并在叙述中写加入 Oosterkamp 实验团队。正式导师称谓待查。 '+source('本人 CV',u.v1)+'\n');
addNote(carlo,'# Carlo W. J. Beenakker\n\n> [!info] 师承扩展人物\n> Leiden 凝聚态理论研究者。此条为 Bernard van Heck 的博士主导师记录。\n\n## 师承\n\n- 博士生：'+vLink+'。2015 Leiden 物理博士，本人 CV 列 Beenakker 为 PhD advisor。 '+vSources+'\n');
addNote(anton,'# Anton R. Akhmerov\n\n> [!info] 师承扩展人物\n> van Heck 本人 CV 将 Akhmerov 的博士共同指导列在 TU Delft。\n\n## 师承\n\n- 共同指导博士生：'+vLink+'。本人 CV 列 PhD co-advisor。 '+source('本人 CV',u.v1)+'\n');
addNote(tjerk,'# Tjerk H. Oosterkamp\n\n> [!info] 师承扩展人物\n> van Heck 本人 CV 记其领导 Leiden 的低温磁共振力显微实验团队。\n\n## 师承\n\n- 博士后组员：'+vLink+'。2021 年 10 月至 2022 年 9 月在 Leiden 做博士后并加入该组，正式导师称谓待核。 '+source('本人 CV',u.v1)+'\n');
addAfter(personPath(l),'## 师承','\n- 博士后受指导者：'+vLink+'。'+vYale);
const extension='- '+vLink+' → 博士后导师：'+lLink+'。'+vYale;
if(!body(index).includes(extension)){
 const current=body(index), nl=current.includes('\r\n')?'\r\n':'\n';
 updates.set(index,current.trimEnd()+nl+nl+'## Yale 博士后扩展人物（2026-11-10）'+nl+nl+extension+nl);
}

personLine(g,'- 博士后经历：',' '+evidence.gianola+' '+source('UCSB 同期原档',u.gu)+' · '+source('KIT 2026 任用',u.gk)+' · '+source('UCSB 2026 奖项',u.gn));
schoolSource(g,' · '+source('KIT 2026 访问任用（与早期博后分列）',u.gk));
newAudit(g,[['postdoc',evidence.gianola,[u.gu,u.gn,u.gk]]], '查 2007–2009 Karlsruhe Humboldt 博后接收人及原任用。另查 JHU 正式论文导师。');

personLine(h,'- 博士导师候选：',' '+evidence.hickey+' '+source('Penn State 2026 讲者原档',u.hps));
schoolSource(h,' · '+source('Penn State 讲者原档',u.hps));
newAudit(h,[['phd',evidence.hickey,[u.hps],'group_or_candidate'],['postdoc',evidence.hickey,[u.hps]]], 'IGERT 项目原页到期后复查，或用 Penn 学位目录和 Murray 组档核对。Minnesota 正式博后导师待任用材料。');

personLine(p,boundary,' '+evidence.guyot+' '+source('Chicago 化学系原档',u.pc));
schoolSource(p,' · '+source('Chicago 化学系原档',u.pc));
newAudit(p,[['affiliation',evidence.guyot,[u.pc]],['postdoc',evidence.guyot,[u.pc]]], '查 1987–1991 Berkeley 与 Orsay 任用及博后指导者。');

personLine(a,boundary,' '+evidence.aris+' '+source('UCSC 物理系同期原刊',u.ac));
schoolSource(a,' · '+source('UCSC 物理系同期原刊',u.ac));
newAudit(a,[['postdoc',evidence.aris,[u.ac]]], '补 Princeton 学位原档，并查 Yale 任用指导人及 Illinois 博后日期。');

if(process.argv[2]!=='apply') {
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length}));
 process.exit(0);
}
function call(script,file) { execFileSync(process.execPath,['--no-warnings',script,'record',file],{stdio:'inherit'}); }
for(const event of audits){
 const file='20261110_1959_人工_'+event.record_id+'.json';
 fs.writeFileSync(file,JSON.stringify(event,null,2),'utf8');
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const relationFile='20261110_1959_结构化回执.json';
fs.writeFileSync(relationFile,JSON.stringify(relations,null,2),'utf8');
call('结构化师承关系.cjs',relationFile);
