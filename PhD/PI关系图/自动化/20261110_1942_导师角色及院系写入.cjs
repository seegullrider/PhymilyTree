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
 original.audit_id='pi_archive_20261110_1942_'+id;
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
function appendAfter(file,match,entry){
 edit(file,match,(row,nl)=>{
  const full=updates.get(file)??fs.readFileSync(file,'utf8');
  return full.includes(entry)?row:row+nl+entry;
 });
}
function addRelation(id,auditId,key,stage,mentor_filename,kind,evidence,sources) {
 relations.push({event_id:'pi_archive_20261110_1942_'+id+'_'+key,record_id:id,stage,mentor_filename,kind,source_audit_id:auditId,evidence,sources});
}

const isHeading=row=>row==='## 师承';
const label=(id,name)=>'[['+records.get(id).filename+'|'+name+']]';
const target=(node,name)=>'[['+node+'|'+name+']]';
function addIndex(file,heading,lineText) {
 const body=updates.get(file)??fs.readFileSync(file,'utf8');
 if(body.includes(lineText))return;
 const nl=body.includes('\r\n')?'\r\n':'\n';
 const marker=nl+'## '+heading+nl;
 if(body.includes(marker)) throw Error('已存在索引标题：'+heading);
 updates.set(file,body.trimEnd()+nl+nl+'## '+heading+nl+nl+lineText.replaceAll('\n',nl)+nl);
}
function putEdge({id,name,mentor,mentorName,role,reverse,details}) {
 const from=label(id,name),to=target(mentor,mentorName);
 appendAfter(pf(id),isHeading,'\n- '+role+'：'+to+'。 '+details);
 appendAfter(mentorFile(mentor),isHeading,'\n- '+reverse+'：'+from+'。 '+details);
 return '- '+from+' → '+role+'：'+to+'。 '+details;
}

const h='621d3072',c='d4abe130',a='2be92847',t='da4f01d2',n='eb77eba7',f='2c0d9567';
const penn='https://www.psu.edu/news/academics/story/materials-science-and-engineering-postdoc-researcher-receives-mrs-award';
const hcv='https://mesomod.weebly.com/uploads/9/3/4/0/93403436/cv_jiamian_hu-1pagewebsitedec72025.pdf';
const hw='https://engineering.wisc.edu/news/focus-new-faculty-jiamian-hu-using-computer-models-improve-materials-many-applications/';
const arxiv='https://arxiv.org/pdf/1012.0088';
const tsing='https://www.mse.tsinghua.edu.cn/mseen/info/1018/1281.htm';
const chen='人员 - Penn State - Long-Qing Chen - d4abe130',nan='师承人物 - Ce-Wen Nan';
const hpost='Penn State 2015 年同期报道明称 Long-Qing Chen 为 Jiamian Hu 的 postdoctoral adviser，并区分 Hu 博士期间赴 Penn State 访学和 2013 年博士毕业后受聘。本人 CV 将 2013–2015 博后和 2015 年 5 月至 2017 年 12 月 Research Associate 分列。';
const hp='本人 CV 核清华 2013 材料科学与工程博士。2010 年本人论文作者单位列 Jia-Mian Hu 同属清华与 Penn State，Ce-Wen Nan 为清华合著者，Long-Qing Chen 为 Penn State 合著者。清华院档核 Nan 的多铁材料方向。南策文仅作低可信博士导师候选，待学位原件。';
const ha=audit(h,[['affiliation','Wisconsin 材料科学与工程系副教授。',[hcv,hw]],['research','相场模拟、磁电和铁电材料及量子体系。',[hcv,hw]],['phd',hp,[hcv,arxiv,tsing]],['postdoc',hpost,[penn,hcv]]],'查清华博士学位目录、论文及正式导师字段。');
audits.at(-1).aspects.phd.status='group_or_candidate';
audits.at(-1).aspects.postdoc.status='confirmed_advisor';
addRelation(h,ha,'chen','postdoc',chen,'advisor',hpost,[penn,hcv]);
addRelation(h,ha,'nan','phd',nan,'candidate',hp,[hcv,arxiv,tsing]);
const ps=source('Penn State 同期原档',penn)+' · '+source('本人 CV',hcv)+'。'+hpost;
const hpLine=target(chen,'Long-Qing Chen')+'。 '+ps;
edit(pf(h),row=>row.startsWith('- 博士后课题组负责人：')||row.startsWith('- 博士后导师：'+target(chen,'Long-Qing Chen')),()=>'- 博士后导师：'+hpLine);
edit(mentorFile(chen),row=>who(h,'博士后课题组成员')(row)||who(h,'博士后研究者')(row),()=>'- 博士后研究者：'+label(h,'Jiamian Hu')+'。 '+ps);
edit(index,row=>indexed(h,'博士后课题组负责人',chen)(row)||indexed(h,'博士后导师',chen)(row),()=>'- '+label(h,'Jiamian Hu')+' → 博士后导师：'+hpLine);
edit(pf(h),row=>row.startsWith('- 核查边界：'),()=>'- 核查边界：清华博士论文和正式导师字段待查。Penn State 访学、博士后及后续 Research Associate 依原始履历分列。');
const nfile=mentorFile(nan);
if(!fs.existsSync(nfile))updates.set(nfile,'# Ce-Wen Nan（南策文）\n\n> [!info] 师承扩展人物\n> 清华大学材料学院教授，研究多铁材料及功能复合材料。 '+source('清华院系原档',tsing)+'\n\n## 师承\n');
const hn=putEdge({id:h,name:'Jiamian Hu',mentor:nan,mentorName:'Ce-Wen Nan（南策文）',role:'博士导师候选',reverse:'博士阶段候选关系',details:source('博士同期原论文',arxiv)+' · '+source('清华院系原档',tsing)+'。'+hp});
addIndex(path.join(root,'师承候选线索索引.md'),'清华博士阶段候选（2026-11-10）',hn);
schoolReplace(h,'| 待核 | Long-Qing Chen（博士后课题组负责人） |','| 清华 2013；南策文（低可信候选） | Long-Qing Chen（Penn State 2013–2015 明确博士后导师） |');
schoolSource(h,' · '+source('Penn State 同期任用档',penn)+' · '+source('博士同期原论文',arxiv));

const cms='https://www.matse.psu.edu/directory/long-qing-chen';
const caudit='Penn State 原档分列材料科学与工程、工程科学与力学、物理、数学教授，研究介观量子和功能材料的结构及电子相变。';
audit(c,[['affiliation',caudit,[cms]],['research',caudit,[cms]]],'MIT 论文馆藏本轮不可读，继续追签署页与 Kalonji 的论文指导证据，保留 Khachaturyan 博后阶段研究师长。');
personLine(c,'- 核查边界：',' 本轮 MIT 馆藏链接未取得正文，继续保留博士候选。');

const msu='https://pa.msu.edu/sites/_pa/assets/File/newsletter/nl12.pdf';
const umn='https://cse.umn.edu/ftpi/alumni';
const av='https://www.physics.wisc.edu/directory/levchenko-alex/';
const am='人员 - University of Minnesota - Alex Kamenev - 80c4b172';
const ap='Minnesota FTPI 毕业名录列 Oleksandr Levchenko（2009）、导师 Alex Kamenev 及论文《Transport properties of low-dimensional mesoscopic conductors: interplay of disorder, interaction and fluctuation effects》，并链接 Wisconsin 本人页。';
const ax='MSU 2012 新聘原刊确认 Levchenko 博士毕业后在 Argonne 材料科学部从事博士后研究，工作包括欠掺杂铜氧化物及纳米尺度输运。报道未列个人指导，任期月份和导师待核。';
const aa=audit(a,[['identity',ap,[umn,av]],['research','Wisconsin 物理系核量子动力学、非平衡、超导和拓扑材料。',[av]],['phd',ap,[umn]],['postdoc',ax,[msu]]],'找 Argonne 2009–2011 年任用和个人导师原档。Minnesota 论文 PDF 本轮 403，馆藏毕业名录已读。');
addRelation(a,aa,'kamenev','phd',am,'advisor',ap,[umn,av]);
const aph=' '+source('Minnesota 毕业名录',umn)+'。'+ap;
personLine(a,'- 博士导师：',aph);
line(mentorFile(am),who(a,'博士生'),aph);
line(index,indexed(a,'博士导师',am),aph);
edit(pf(a),row=>row.startsWith('- 核查边界：'),()=>'- 博士后：'+ax+' '+source('Michigan State 招聘原刊',msu));
schoolReplace(a,'| Alex Kamenev | 待核 |','| Alex Kamenev | Argonne 材料科学部博后，个人导师待核 |');
schoolSource(a,' · '+source('Michigan State 招聘原刊',msu));

const tee='https://www.eecs.mit.edu/people/tess-smidt/';
const lb='https://biosciences.lbl.gov/2020/10/20/chasing-their-tails-but-getting-somewhere-reimagining-the-shape-of-noise-leads-to-improved-molecular-models/';
const tx='Berkeley Lab 2020 年同期报道明确 Tess Smidt 为 Computational Research Division 博后；本人 CV 列 2018–2021 Alvarez 博后。两份原档未列博后导师，既有博士导师仍为 Jeffrey Neaton。';
audit(t,[['affiliation','MIT EECS 原档列电气工程方向副教授。',[tee]],['research','MIT EECS 原档列面向物理科学的人工智能和机器学习。',[tee]],['postdoc',tx,[lb]]],'查 Berkeley Lab Alvarez 2018 任用及导师字段，继续区分博士和博后导师。');
personLine(t,'- 核查边界：',' '+source('Berkeley Lab 2020 原报道',lb)+'。'+tx);
schoolSource(t,' · '+source('MIT EECS 现任档',tee)+' · '+source('Berkeley Lab 2020 原报道',lb));

const pen='https://www.pem.cam.ac.uk/college/master-and-fellows/list-fellows/professor-andriy-nevidomskyy';
const rice='https://chemistry.rice.edu/sites/g/files/bxs3986/files/inline-files/CHEM%20UG%20Advising%20Booklet%2025-26_1.pdf';
const nd='已核实单位 - Rice - Chemistry';
const nx='Rice 化学系 2025–2026 教学手册 Joint Faculty 栏明确列 Andriy Nevidomskyy。Cambridge Pembroke 履历核 Rice 物理与化学教授，以及 2025 年起 Brookhaven 双聘。';
audit(n,[['affiliation',nx,[rice,pen]],['identity','Pembroke 学院直接确认 Cambridge 2005 物理博士和两段博后顺序。',[pen]]],'查 Cambridge 2005 博士论文正式指导字段，核 Rutgers 与 Sherbrooke 个人导师和任期。');
edit(pf(n),row=>row.startsWith('- 院系／机构：'),row=>row.includes(target(nd,'化学系（联合任职）'))?row:row.replace(/。$/,'')+' · '+target(nd,'化学系（联合任职）')+'。 '+source('Rice 化学系联合教师原档',rice));
const ndfile=path.join(root,'已核实院系',nd+'.md');
const ntext=fs.readFileSync(ndfile,'utf8');
if(!ntext.includes(label(n,'Andriy Nevidomskyy'))){const nl=ntext.includes('\r\n')?'\r\n':'\n';updates.set(ndfile,ntext.trimEnd()+nl+'- '+label(n,'Andriy Nevidomskyy')+' — '+source('化学系联合教师原档',rice)+nl);}
schoolReplace(n,'| Physics and Astronomy；强关联','| Physics and Astronomy、Chemistry（联合任职）；强关联');
schoolSource(n,' · '+source('Rice 化学系联合教师原档',rice)+' · '+source('Cambridge Pembroke 原档',pen));

const fb='https://physics.brown.edu/news/2024-10-04/feldman-aps-fellow';
const fx='Brown 物理系 2024 原报道确认物理教授 Dmitri Feldman，获 APS 凝聚态 Fellow，方向包括无序磁体、超导和分数量子霍尔。';
audit(f,[['affiliation','Brown 物理系教授。',[fb]],['research',fx,[fb]]],'追 Weizmann 1999–2001 和 Argonne 2001–2003 的具名博士后指导者。');
schoolSource(f,' · '+source('Brown 物理系原档',fb));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length}));
 process.exit(0);
}
function persist(file,data) {
 fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');
}
function call(script,file) { execFileSync(process.execPath,['--no-warnings',script,...(script==='人物网页身份纠偏.cjs' ? [] : ['record']),file],{stdio:'inherit'}); }
for(const event of audits) {
 const file='20261110_1942_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates) fs.writeFileSync(file,contents,'utf8');
persist('20261110_1942_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_1942_结构化回执.json');



