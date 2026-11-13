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
 orig.audit_id='pi_archive_20261110_2043_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2043_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}



const g='35e6a0c1', rb='35af1b59', rr='5f9c9300', sf='142f9ae4', jm='1742f9e4', c='e61be6c6', bb='371d7c6e', bn='a9f24c18', f='8ab55175', z='f4daaa65';
const u={
 gcv:'https://users.ece.northwestern.edu/~mgrayson/Vitae/GraysonRESUME.pdf',
 gn:'https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/grayson-matthew.html',
 kv:'https://www.mpg.de/421275/solid-state-research-von-klitzing',
 rcv:'https://physics.umd.edu/people/faculty/cv/RameshCV.pdf',
 rlab:'https://rameshlab.lbl.gov/about-us',
 ber:'https://mse.berkeley.edu/people_new/ramesh/',
 rice:'https://msne.rice.edu/people/faculty',
 scv:'https://www.cuny.edu/wp-content/uploads/sites/4/page-assets/about/trustees/meetings-of-the-board/CFSAAgenda050321-1.pdf',
 bnl:'https://www.bnl.gov/newsroom/news.php?a=212878',
 bproj:'https://www.bnl.gov/ldrd/files/pdf/LDRD-ProgramActivities-FY2007.pdf',
 bpaper:'https://harvest.aps.org/v2/journals/articles/10.1103/PhysRevLett.101.196405/fulltext',
 mist:'https://www.bnl.gov/staff/misewich',
 gt:'https://www.mse.gatech.edu/people/matthew-sfeir',
 cc:'https://capolino.eng.uci.edu/CapolinoCV_for%20webpage.pdf',
 ci:'https://engineering.uci.edu/directory/capolino_filippo.php',
 cp:'https://link.springer.com/chapter/10.1007/978-3-662-07221-9_8',
 gc:'https://www.bu.edu/stem/files/2014/10/Goldberg-CV-STEM.pdf',
 nu:'https://www.northwestern.edu/programevaluationcore/our-team/bennett-goldberg.html',
 bu:'https://www.bu.edu/physics/profile/bennett-goldberg/',
 fr:'https://web.physics.rutgers.edu/physicsnews/news.shtml',
 fc:'https://www.engineering.cornell.edu/sites/default/files/departments/main%20area/Magazine/pdf%20archives/CEM-Fall13.pdf',
 fm:'https://www.macfound.org/fellows/class-of-2013/craig-fennie',
 zc:'https://vivo.brown.edu/docs/drrb/1106970157.pdf'
};
const src=(...items)=>items.map(([label,key])=>source(label,u[key])).join(' · ');
const addIndex=entry=>insertAfter(index,'# 师承关系与候选线索索引','\n'+entry);
const affLine=(id,evidence)=>personLine(id,'- 院系／机构：',' '+evidence);
const phase=(id,oldField,newField)=>school(id,' | '+oldField+' | ',' | '+newField+' | ');
const gl=who(g,'Matthew Grayson'), ts='师承人物 - Daniel C. Tsui';
const tlink=wiki(ts,'Daniel C. Tsui');
const gd='Northwestern 托管的本人 CV 在 GRADUATE ADVISOR 栏明确列 Daniel C. Tsui，学位条目列 1998 年 Princeton 电气工程博士。可信度高。';
const gp='本人 CV 的 POST-DOCTORAL SPONSORS 栏分别具名 Maryland、TUM 与 MPI-Stuttgart 三家接收机构的 sponsor。任职栏分别列博后研究助理、Humboldt Fellow 与 Research Scientist，后两段另有重叠的 TUM Habilitation Researcher 任职。各段的个人正式博后指导关系继续待核。';
const gS=src(['Northwestern 托管的本人 CV','gcv']);
const ga='Northwestern 工程教师原档列 ECE 与 Applied Physics，研究半导体量子输运、低维载流子和热电材料。';
const gaS=src(['Northwestern 工程教师原档','gn']);
rewrite(pf(g),x=>x.startsWith('- 博士阶段研究师长：')&&x.includes(ts),()=>'- 博士导师：'+tlink+'。'+gd+' '+gS);
rewrite(mf(ts),x=>x.startsWith('- 博士阶段研究成员：')&&x.includes(records.get(g).filename),()=>'- 博士生：'+gl+'。'+gd+' '+gS);
rewrite(index,x=>x.startsWith('- '+gl+' → 博士阶段研究师长：'),()=>'- '+gl+' → 博士导师：'+tlink+'。'+gd+' '+gS);
rewrite(pf(g),x=>x.startsWith(boundary),()=>boundary+gp+' '+gS);
affLine(g,ga+' '+gaS);
phase(g,'Daniel C. Tsui（博士阶段研究师长）','Daniel C. Tsui（1998 Princeton 博士，CV 明列导师）');
phase(g,'H. Dennis Drew（博士后导师候选）','H. Dennis Drew、Gerhard Abstreiter、Klaus von Klitzing（本人 CV 具名 sponsor，正式导师待核）');
schoolSource(g,' · '+gS);
const gr=audit(g,[['affiliation',ga,[u.gn]],['research',ga,[u.gn]],['phd',gd,[u.gcv,u.gn],'confirmed_advisor'],['postdoc',gp,[u.gcv],'group_or_candidate']],'按机构查 Maryland 1998–2001 个人指导、TUM 2001–2003 Humboldt Fellow 的接收档和 MPI Stuttgart 2003 年 Research Scientist 任用性质及指导关系。');
relation(g,gr,'phd',ts,'advisor',gd,[u.gcv,u.gn],'tsui');
const sponsors=[
 ['H. Dennis Drew','Maryland', '1998 年 1 月至 2001 年 4 月 Post-doctoral Research Associate','drew'],
 ['Gerhard Abstreiter','TUM', '2001 年 5 月至 2003 年 8 月 Humboldt Fellow，另列 2003 年 1 月至 2007 年 2 月 Habilitation Researcher','abstreiter'],
 ['Klaus von Klitzing','MPI Stuttgart', '2003 年 9–12 月 Research Scientist，任用类别与个人博后指导关系继续待核','klitzing']
];
for(const [name,place,role,suffix] of sponsors){
 const mentor='师承人物 - '+name, ml=wiki(mentor,name);
 const ev='本人 CV 具名为 '+place+' 的 post-doctoral sponsor。CV 任用栏列 '+role+'。sponsor 角色有原文，个人正式博后导师称谓待核。';
 const forward='- 博士后导师候选：'+ml+'。'+ev+' '+gS;
 const back='- 博士后研究者候选：'+gl+'。'+ev+' '+gS;
 const edge='- '+gl+' → 博士后导师候选：'+ml+'。'+ev+' '+gS;
 if(suffix==='drew'){
  rewrite(pf(g),x=>x.startsWith('- 博士后导师候选：')&&x.includes(mentor),()=>forward);
  rewrite(mf(mentor),x=>x.startsWith('- 博士后研究者候选：')&&x.includes(records.get(g).filename),()=>back);
  rewrite(index,x=>x.startsWith('- '+gl+' → 博士后导师候选：')&&x.includes(mentor),()=>edge);
 }else{
  insertAfter(pf(g),'- 博士导师：','\n'+forward);
  if(suffix==='klitzing'&&!fs.existsSync(mf(mentor)))updates.set(mf(mentor),[
   '# '+name,'','- 类型：师承扩展人物','- Max Planck Institute for Solid State Research，半导体量子输运与量子霍尔效应。 '+src(['Max Planck 人物原档','kv']),'','## 师承','',back,''
  ].join('\n'));
  else insertAfter(mf(mentor),'## 师承','\n'+back);
  addIndex(edge);
 }
 relation(g,gr,'postdoc',mentor,'candidate',ev,[u.gcv],suffix);
}

const re='本人 Maryland 任职时期 CV 明列 1987 年 9 月至 1988 年 12 月任 Lawrence Berkeley Laboratory 的 National Center for Electron Microscopy Postdoctoral Associate。CV 另列 1988 年 1 月至 1995 年 1 月任 Bell Communications Research 技术职员，日期部分重叠。本人现组履历把 Bellcore 起点记为 1989 年。两版任用起点保留，个人博后导师未具名。';
const rs=src(['Maryland 托管本人 CV','rcv'],['本人 Berkeley Lab 组履历','rlab']);
for(const [id,key,desc] of [[rb,'ber','Berkeley 材料系与物理系任用，研究复杂氧化物和铁电、多铁材料。'],[rr,'rice','Rice MSNE 教师目录列兼职任用，保留该校属记录。']]){
 insertAfter(pf(id),'- 博士阶段课题组负责人：','\n- 博士后经历：'+re+' '+rs);
 rewrite(pf(id),x=>x.startsWith(boundary),x=>x.replace('独立博后岗位和指导人继续待核。','独立博后任用由本人 CV 确认，个人指导者及 Bellcore 入职月份继续待核。'));
 phase(id,'1989–1995 Bellcore 技术职员；独立博后经历待核','1987–1988 LBL/NCEM 博后，导师待核；另有 Bellcore 技术岗，起始年有异');
 rewrite(sl(id),x=>x.startsWith('| [['+records.get(id).filename+'|'),x=>x.replace('独立博后岗位和指导人继续待核。','本人 CV 已核独立博后任用，指导者仍待核。'));
 schoolSource(id,' · '+rs);
 audit(id,[['affiliation',desc,[u[key],u.rlab]],['postdoc',re,[u.rcv,u.rlab],'unresolved']],'查 Berkeley LBL-24552 论文签署页，并查 NCEM 1987–1988 个人博后任用或培训档。中心主任任期和博后指导关系须分开。');
}

const sfe='CUNY 董事会材料中的本人 CV 列 2005 年 8 月 Columbia 化学物理博士、2005 年 11 月至 2009 年 2 月在 Brookhaven CMPMS 任 Postdoctoral Research Associate，2009 年 3 月转 CFN Assistant Scientist。Brookhaven 任用原刊与 CV 相合，CUNY 附件前段摘要将 Assistant Scientist 起始年误列为 2005。';
const jme='Brookhaven FY2007 LDRD 项目 06-047 将 Christie Nelson 列为项目负责人、James A. Misewich 列为共同研究者、Matt Sfeir 列为合作人员。同阶段 2008 年 APS 论文将两人列为 Brookhaven 同单位合著者。这些原档可确定同项目联系，个人博后指导关系为低可信候选。';
const sfS=src(['CUNY 董事会材料内的本人 CV','scv'],['Brookhaven 任用原刊','bnl']);
const jmS=src(['Brookhaven FY2007 LDRD 项目原档','bproj'],['APS 同期论文','bpaper'],['Brookhaven Misewich 人物档','mist']);
const sfl=who(sf,'Matthew Sfeir'), jml=who(jm,'James A. Misewich');
insertAfter(pf(sf),'- 博士阶段课题组负责人：','\n- 博士后经历：'+sfe+' '+sfS+'\n- 博士后导师候选：'+jml+'。'+jme+' '+jmS);
insertAfter(pf(jm),'## 师承','\n- 博士后研究者候选：'+sfl+'。'+jme+' '+jmS);
addIndex('- '+sfl+' → 博士后导师候选：'+jml+'。'+jme+' '+jmS);
phase(sf,'Brookhaven 2005 起任博后，2009 转 CFN 助理科学家；导师待核','Brookhaven CMPMS 2005-11 至 2009-02 博后；James A. Misewich 为低可信候选；2009-03 转 CFN 助理科学家');
schoolSource(sf,' · '+sfS+' · '+jmS);
const sr=audit(sf,[['affiliation','Georgia Tech 材料院官方档列材料科学与工程、化学与生物化学双聘。',[u.gt]],['research','Georgia Tech 原档列超快光谱及光电子材料，Brookhaven 原档列纳米材料光物理。',[u.gt,u.bnl]],['postdoc',sfe+' '+jme,[u.scv,u.bnl,u.bproj,u.bpaper,u.mist],'group_or_candidate']],'查 2005–2009 CMPMS 博后聘书或具名指导的正式履历，并查 Columbia 博士论文签署页。');
relation(sf,sr,'postdoc',records.get(jm).filename,'candidate',jme,[u.bproj,u.bpaper,u.mist],'misewich');

const ce='UCI 托管的本人 CV 分列 Siena 1997-09 至 1999-02、Boston University 1998-09 至 1999-03 博后，另列 1997-08 至 1998-01 Fulbright 访问及 Houston 的 Visiting Research Assistant Professor 聘任。Felsen 是 Siena 项目指导的候选关系，两个博后机构的个人导师待核。';
const ca='UCI 工程院官方教师档列 EECS Dean’s Professor、Florence 1997 电气工程博士，研究人工电磁材料、纳米光子学和等离激元。';
const cs=src(['UCI 工程院原档','ci'],['UCI 本人 CV','cc']);
affLine(c,ca+' '+cs);
insertAfter(pf(c),'- 博士：','\n- 博士后经历：'+ce+' '+cs);
school(c,'Houston 职位线索待核','Houston 为访问研究助理教授');
schoolSource(c,' · '+cs);
audit(c,[['affiliation',ca,[u.ci]],['research',ca,[u.ci]],['phd','UCI 本人 CV 列 1997 年 7 月 Florence 电气工程博士，正式导师未具名。',[u.cc,u.ci]],['postdoc',ce,[u.cc,u.cp],'group_or_candidate']],'查 Florence 1997 论文导师及 Siena、BU 博后任用信，分别核对 Felsen 的指导范围。');

const be='BU 托管本人 CV 列 1987 Brown 物理博士、1986–1988 MIT Bantrell Postdoctoral Fellow，Brown Research Assistant 一栏截至 1986。Northwestern 原档列 1986–1989 MIT Francis Bitter National Magnet Laboratory 博后。保留时间重叠与终年差异，博后导师待核。';
const bs=src(['BU 托管本人 CV','gc'],['Northwestern 院内履历','nu']);
for(const [id,key,desc] of [[bb,'bu','BU 物理系历史任用与荣休状态保留。'],[bn,'nu','Northwestern 院内履历确认 2016 年入职物理与天文学系并承担教学中心职务。']]){
 personLine(id,boundary,' '+be+' '+bs);
 phase(id,'待核（MIT/Bitter 博后）','MIT Bitter 博后，导师待核（本人 CV 1986–1988，Northwestern 履历 1986–1989）');
 schoolSource(id,' · '+bs);
 audit(id,[['affiliation',desc,[u[key]]],['postdoc',be,[u.gc,u.nu],'unresolved']],'查 MIT Francis Bitter 实验室 1986–1989 Bantrell Fellows 名册、1986 入职及具名个人指导。');
}

const fe='Rutgers 同期论文奖原档确认在 Karin M. Rabe 指导下完成博士研究，并列 Argonne Nicholas Metropolis Fellow。Cornell 原刊明确奖项全名 Nicholas Metropolis Distinguished Postdoctoral Fellowship，MacArthur 原档列 2006–2008 Argonne 博后。个人博后导师未具名。';
const fsources=src(['Rutgers 同期原档','fr'],['Cornell 原刊','fc'],['MacArthur 原档','fm']);
personLine(f,boundary,' '+fe+' '+fsources);
phase(f,'待核','2006–2008 Argonne Nicholas Metropolis 博后，导师待核');
schoolSource(f,' · '+fsources);
audit(f,[['phd',fe,[u.fr,u.fc],'confirmed_advisor'],['postdoc',fe,[u.fr,u.fc,u.fm],'unresolved']],'查 Argonne Nicholas Metropolis 2006 届获奖、计算材料任用及个人指导档。');

const ze='Brown 托管本人 CV 列 1985 Columbia 光化学博士及两部分论文内容，分别涉及取代环烷酮衍生的三重态双自由基与二苄酮衍生自由基对。CV 未列论文导师签署人。保留已有 Turro 和 Fayer 标签。';
const zs=src(['Brown 托管本人 CV','zc']);
personLine(z,boundary,' '+ze+' '+zs);
schoolSource(z,' · '+zs);
audit(z,[['phd',ze,[u.zc]]],'用 CV 两部分题名查 Columbia 论文原件与 Turro 签署，同时补 CHIMIA 可读原刊。');

if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,file){execFileSync(process.execPath,['--no-warnings',script,'record',file],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2043_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261110_2043_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_2043_结构化回执.json');
