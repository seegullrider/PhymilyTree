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
 original.audit_id='pi_archive_20261110_1922_'+id;
 original.followup_required=true;
 original.next_step=next;
 for(const [key,note,sources] of changes){
  const aspect=original.aspects[key];
  original.aspects[key]={...aspect,note,sources:[...new Set([...sources,...aspect.sources])]};
 }
 audits.push(original);
 return original.audit_id;
}

function edit(file,match,replacement){
 const content=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const matches=rows.map((row,i)=>match(row)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected one line, found '+matches.length);
 const i=matches[0];
 rows[i]=replacement(rows[i],newline);
 updates.set(file,rows.join(newline));
}
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mentorFile=name=>path.join(notes,name+'.md');
const who=(id,role)=>row=>row.startsWith('- '+role+'：')&&row.includes('[['+records.get(id).filename+'|');
const indexed=(id,role,mentor)=>row=>row.startsWith('- [['+records.get(id).filename+'|')&&row.includes('→ '+role+'：[['+mentor+'|');
function schoolReplace(id,from,to){
 const record=records.get(id);
 edit(path.join(root,record.unit+'逐人复核记录.md'),row=>row.startsWith('| [['+record.filename+'|'),row=>{
  if(row.includes(to))return row;
  if(!row.includes(from))throw Error(id+' 校表字段已变');
  return row.replace(from,to);
 });
}
function changeRole(id,oldRole,newRole,mentor,addition) {
 const forward=row=>row.includes('[['+mentor+'|') && (row.startsWith('- '+oldRole+'：') || row.startsWith('- '+newRole+'：'));
 const replaceRole=row=>row.replace(oldRole+'：',newRole+'：')+(row.includes(addition)?'':addition);
 edit(pf(id),forward,replaceRole);
 edit(mentorFile(mentor),row=>who(id,oldRole)(row)||who(id,newRole)(row),replaceRole);
 edit(index,row=>indexed(id,oldRole,mentor)(row)||indexed(id,newRole,mentor)(row),replaceRole);
}
function appendAfter(file,match,entry){
 edit(file,match,(row,nl)=>{
  const full=updates.get(file)??fs.readFileSync(file,'utf8');
  return full.includes(entry)?row:row+nl+entry;
 });
}
function addRelation(id,auditId,key,stage,mentor_filename,kind,evidence,sources) {
 relations.push({event_id:'pi_archive_20261110_1922_'+id+'_'+key,record_id:id,stage,mentor_filename,kind,source_audit_id:auditId,evidence,sources});
}
const m='85018063',r='26350631',k='86ff937f',h='e42a8426',e='186f1527',t='28f78d3f';
const mitM='https://dspace.mit.edu/entities/publication/288e5405-d4fa-4890-8120-83f9bad81cb9';
const stan='https://profiles.stanford.edu/monika-schleier-smith?tab=bio';
const lmu='https://edoc.ub.uni-muenchen.de/19686/7/Li_Tracy.pdf';
const doyle='https://news.mit.edu/2011/hertz-foundation-thesis-prize';
const vladan='师承人物 - Vladan Vuletić',bloch='师承人物 - Immanuel Bloch';
const mp='MIT 学位原档在 2011 年物理博士论文《Cavity-enabled spin squeezing for a quantum-enhanced atomic clock》的 Advisor(s) 栏列 Vladan Vuletić。John M. Doyle 的博士阶段师长记录另列。';
const mb='Stanford 履历列 LMU Munich 和 MPQ 博士后。Tracy Li 的 LMU 博士论文致谢称 Schleier-Smith 是其组中两年的博士后，并称该组为 Bloch group。';
const ma=audit(m,[['identity','MIT 论文作者全名为 Monika Helene Schleier-Smith，Stanford 履历列同年同领域学位。',[mitM,stan]],['affiliation','Stanford Profiles 列物理系副教授。',[stan]],['research','用激光冷却原子研究多体量子态，侧重量子模拟与量子计量。',[stan]],['phd',mp,[mitM,doyle]],['postdoc',mb+' 正式任用导师职衔待核。',[stan,lmu]]],'查 LMU 或 MPQ 的博士后正式指导及任用月份。');
audits.at(-1).aspects.phd.status='confirmed_advisor';
addRelation(m,ma,'vuletic','phd',vladan,'advisor',mp,[mitM]);
addRelation(m,ma,'bloch','postdoc',bloch,'group_leader',mb+' 保留博士后课题组身份。',[stan,lmu]);
const ms=' 证据：'+mp;
const mbs=' '+source('Stanford 履历',stan)+' · '+source('LMU 博士论文致谢',lmu)+'。'+mb;
personLine(m,'- 博士导师：',ms);
line(mentorFile(vladan),who(m,'博士生'),ms);
line(index,indexed(m,'博士导师',vladan),ms);
personLine(m,'- 博士后课题组负责人：',mbs);
line(mentorFile(bloch),who(m,'博士后课题组成员'),mbs);
line(index,indexed(m,'博士后课题组负责人',bloch),mbs);
edit(pf(m),row=>row.startsWith('- 核查边界：'),()=>'- 核查边界：原档分别确认 MIT 论文导师、博士阶段研究师长及 LMU／MPQ 博后组属。博后正式个人导师职衔与任用月份待查。');
edit(pf(m),row=>row.startsWith('- 物理教授，利用冷原子模拟'),()=>'- Stanford 物理系副教授，研究冷原子多体态、量子模拟与量子计量。 '+source('Stanford Profiles',stan));
schoolSource(m,' · '+source('MIT 学位原档',mitM)+' · '+source('LMU 博士论文致谢',lmu));

const ucsb='https://www.engineering.ucsb.edu/news/UC-Bowers-Lifetime-Achievement-Award';
const ece='https://www.ece.ucsb.edu/people/faculty/richard-mirin';
const nist='https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=903834';
const bowers='人员 - UC Santa Barbara - John Bowers（荣休） - c51c1961';
const rp='UCSB 工学院称 Richard Mirin 为 Bowers 的博士生，并称 Bowers 为其昔日导师。本人署名论文履历列 UCSB 1996 电气工程博士。';
const rr='本人署名论文履历列 1996 年获 UCSB 电气工程博士后即加入 NIST 光电子学部。已核履历未分列独立博士后；首任职衔及是否为博士后待核。';
const ra=audit(r,[['affiliation','UCSB 工学院列 Electrical and Computer Engineering 教授。',[ece]],['research','UCSB ECE 资料列 III–V 半导体外延与器件、激光、量子点和单光子源与探测。',[ece]],['phd',rp,[ucsb,nist]],['postdoc',rr,[nist,ucsb]]],'查 NIST 1996 年首任职位及 UCSB 论文原档。');
audits.at(-1).aspects.postdoc.status='no_postdoc_documented';
addRelation(r,ra,'bowers','phd',bowers,'advisor',rp,[ucsb,nist]);
const rs=' '+source('NIST 存档本人论文履历',nist)+' 确认 1996 年 UCSB 电气工程博士。';
personLine(r,'- 博士导师：',rs);
line(mentorFile(bowers),who(r,'博士生'),rs);
line(index,indexed(r,'博士导师',bowers),rs);
edit(pf(r),row=>row.startsWith('- 核查边界：'),()=>'- 博士后：'+rr+' '+source('NIST 存档本人论文履历',nist));
edit(pf(r),row=>row.startsWith('- EE 教授，研究超导单光子探测'),()=>'- UCSB 电气与计算机工程教授，曾在 NIST 任职。现研究半导体激光、量子点、纳米光子与单光子器件。 '+source('学校教师页','https://engineering.ucsb.edu/node/4187'));
schoolReplace(r,'| John Bowers（荣休） | 待核 |','| John Bowers（荣休） | 1996 博士毕业即入 NIST，首任职衔及博士后身份待核 |');
schoolSource(r,' · '+source('UCSB 原报道',ucsb)+' · '+source('NIST 存档本人论文履历',nist));

const mitK='https://dspace.mit.edu/entities/publication/ca3613d8-e91d-43d6-aac7-796c8541e9e0';
const duke='https://mems.duke.edu/people/bavand-keshavarz/';
const ai='https://proceedings.aiche.org/conferences/aiche-annual-meeting/2021/proceeding/paper/4ao-mechanics-bio-inspired-soft-responsive-coatings';
const mitX='https://api.mitxonline.mit.edu/courses/course-v1%3AMITxT%2B2.25.2x/';
const gareth='师承人物 - Gareth H. McKinley',niels='师承人物 - Niels Holten-Andersen';
const kp='MIT 学位档案 Advisor(s) 栏列 Gareth H. McKinley，Duke 履历核 Bavand Keshavarz 于 2017 年获 MIT 博士。';
const kpost='本人在 AIChE 会议原稿的 Postdoctoral Project 一栏称两位教授指导 MIT 与 L’Oréal 的博士后水凝胶项目。MIT 课程资料独立确认博士后讲师身份。按博士后阶段研究师长记录，正式任用文件和指导范围待查。';
const ka=audit(k,[['identity',kp,[duke,mitK]],['affiliation','Duke 机械工程与材料科学系助理教授。',[duke]],['research','Duke 研究原档列软材料力学、复杂流体、流变和仿生水凝胶。',[duke]],['phd',kp,[mitK,ai]],['postdoc',kpost,[ai,mitX]]],'查两组正式任用、日期和导师职衔，保留项目级指导说明。');
audits.at(-1).aspects.phd.status='confirmed_advisor';
addRelation(k,ka,'mckinley_phd','phd',gareth,'advisor',kp,[mitK,duke]);
addRelation(k,ka,'mckinley_post','postdoc',gareth,'stage_mentor',kpost,[ai,mitX]);
addRelation(k,ka,'holten_post','postdoc',niels,'stage_mentor',kpost,[ai,mitX]);
const ks=' '+source('MIT 学位原档',mitK)+'。'+kp;
personLine(k,'- 博士导师：',ks);
line(mentorFile(gareth),who(k,'博士生'),ks);
line(index,indexed(k,'博士导师',gareth),ks);
const kps=' '+kpost+' '+source('MIT 课程履历',mitX);
changeRole(k,'博士后阶段研究合作者','博士后阶段研究师长',gareth,kps);
changeRole(k,'博士后阶段研究合作者','博士后阶段研究师长',niels,kps);
edit(pf(k),row=>row.startsWith('- 核查边界：'),()=>'- 核查边界：MIT 原档列 McKinley 为博士导师。本人在 2021 年 AIChE 原稿列两位博士后项目指导者，岗位正式导师称谓待核。');
edit(pf(k),row=>row.startsWith('- [MIT 新闻]'),row=>row.replace('原论文链接本轮超时，原有博士导师记录保留等待重读。','2026-11-10 已重读 MIT 学位库原档。'));
schoolReplace(k,'Gareth H. McKinley（旧论文来源本轮超时，待重读） | Gareth H. McKinley、Niels Holten-Andersen（旧博士后研究合作者记录待重读）','Gareth H. McKinley（MIT 学位原档） | Gareth H. McKinley、Niels Holten-Andersen（博后项目指导）');
schoolSource(k,' · '+source('MIT 学位原档',mitK)+' · '+source('本人 AIChE 博后项目',ai));

const hu='https://ethw.org/First-Hand:IEEE_Award_Recipient_Series:Evelyn_L._Hu';
const wu='师承人物 - Chien-Shiung Wu';
const hp='Evelyn Hu 在 IEEE 口述史原文明确称吴健雄为 graduate advisor，与已有 Columbia 博士阶段来源一致。';
const hq='本人 IEEE 口述史称第一份工作在 AT&T Bell Laboratories。已核档案未分列独立博士后，Bell Labs 起始岗位职衔待核。';
const ha=audit(h,[['phd',hp,[hu]],['postdoc',hq,[hu]]],'查 Columbia 博士学位签署页和 Bell Labs 首任职位的正式称谓。');
audits.at(-1).aspects.postdoc.status='no_postdoc_documented';
addRelation(h,ha,'wu','phd',wu,'advisor',hp,[hu,...audits.at(-1).aspects.phd.sources.filter(x=>x!==hu)]);
const hs=' '+source('IEEE 本人口述',hu)+'。'+hp;
personLine(h,'- 博士导师：',hs);
line(mentorFile(wu),who(h,'博士生'),hs);
line(index,indexed(h,'博士导师',wu),hs);
edit(pf(h),row=>row.startsWith('- 核查边界：'),()=>'- 博士后：'+hq+' '+source('IEEE 本人口述',hu));
schoolReplace(h,'| 待核 |','| 第一份工作为 Bell Labs，独立博士后待核 |');
schoolSource(h,' · '+source('IEEE 本人口述',hu));

const cv='https://scholar.harvard.edu/files/efthimios_kaxiras/files/e_kaxirascv.pdf';
const ep='本人 Harvard CV 将 1987–1989 IBM T. J. Watson 博后研究助理与 1989–1991 NRL 顾问分列。IBM 博后个人导师待查。';
audit(e,[['identity','本人 Harvard CV 载 MIT 1987 物理博士，并与现有 Harvard 研究组原档相符。',[cv]],['postdoc',ep,[cv]]],'查 MIT 学位论文原件及 IBM 博后具名导师，MIT Primo 本轮未提供正文。');
personLine(e,'- 核查边界：',' '+source('本人 Harvard CV 第 1 页',cv)+'。'+ep);
schoolSource(e,' · '+source('本人 Harvard CV',cv));

const nus='https://cde.nus.edu.sg/ece/staff/teo-kie-leong/';
const osti='https://www.osti.gov/servlets/purl/788068';
const yu='人员 - UC Berkeley - Peter Yu - 7827abdd';
const tp='Colton 的 Berkeley 2000 博士论文致谢称在 Peter Yu 实验室开始研究时与 Teo 密切共事。NUS 原档分列 Teo 1995–1996 Berkeley 访学与 1997–1998 博后。由于共事日期与个人指导称谓未列，Peter Yu 暂为博士后候选，低可信。';
const ta=audit(t,[['identity','NUS ECE 原档确认 1997 年 NUS 电气工程博士，Berkeley 访学与博士后为两段。',[nus]],['affiliation','NUS 电气与计算机工程教授兼 College of Design and Engineering 院长。',[nus]],['research','NUS ECE 资料核纳米磁性、半导体器件与自旋电子学。',[nus]],['phd','NUS ECE 原档核 1997 年电气工程博士，导师待学位原件。',[nus]],['postdoc',tp,[osti,nus]]],'查 NUS 1997 学位原件及 Berkeley/LBNL 1997–1998 具名聘任记录。');
audits.at(-1).aspects.postdoc.status='group_or_candidate';
addRelation(t,ta,'yu','postdoc',yu,'candidate',tp,[osti,nus]);
const ts='。 '+source('Colton 博士论文致谢',osti)+' · '+source('NUS ECE 原档',nus)+'。'+tp;
const tf='[[人员 - NUS - Kie Leong Teo - 28f78d3f|Kie Leong Teo]]';
const yl='[['+yu+'|Peter Yu]]';
appendAfter(pf(t),row=>row==='## 师承','\n- 博士后导师候选：'+yl+ts);
appendAfter(mentorFile(yu),row=>row==='## 师承','\n- 博士后阶段候选关系：'+tf+ts);
const candidate=path.join(root,'师承候选线索索引.md');
const cbody=updates.get(candidate)??fs.readFileSync(candidate,'utf8');
const cn=cbody.includes('\r\n')?'\r\n':'\n';
if(!cbody.includes(tf+' → 博士后导师候选：'+yl))updates.set(candidate,cbody.trimEnd()+cn+cn+'- '+tf+' → 博士后导师候选：'+yl+ts+cn);
schoolReplace(t,'| 待核 | 待核 |','| NUS 1997 电气工程博士，导师待核 | Berkeley/LBNL 1997–1998 博后；Peter Yu（低可信候选） |');
schoolSource(t,' · '+source('NUS ECE 原档',nus)+' · '+source('Colton 博士论文致谢',osti));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length}));
 process.exit(0);
}
function persist(file,data) {
 fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');
}
function call(script,file) { execFileSync(process.execPath,['--no-warnings',script,...(script==='人物网页身份纠偏.cjs' ? [] : ['record']),file],{stdio:'inherit'}); }
for(const event of audits) {
 const file='20261110_1922_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates) fs.writeFileSync(file,contents,'utf8');
persist('20261110_1922_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_1922_结构化回执.json');
