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
 rewrite(file,x=>x===prefix,(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261110_2104_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2104_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}




const [s,r,b,m,g]=['3a52fbdf','3a7cdb2f','3af2083d','9e21f506','c46c36ec'];
const u={
 sc:'https://jscholarship.library.jhu.edu/bitstream/handle/1774.2/36833/commencement1991.pdf?sequence=1',
 sn:'https://ntrs.nasa.gov/api/citations/19920005572/downloads/19920005572.pdf?attachment=true',
 sj:'https://engineering.jhu.edu/doctor-of-engineering/faculty/james-spicer/',
 sg:'https://engineering.jhu.edu/materials/research/research-groups/',
 sw:'https://engineering.jhu.edu/magazine-archive/2007/01/engineer-helm-emory/',
 sp:'https://ntrs.nasa.gov/citations/19930034642',
 rd:'https://www.mpq.mpg.de/6466145/MPQ-246.pdf',
 rt:'https://mediatum.ub.tum.de/doc/1197648/1197648.pdf',
 rv:'https://mediatum.ub.tum.de/doc/602903/602903.pdf',
 rp:'https://nano-optics.colorado.edu/wp-content/uploads/2021/01/raschke_apb99.pdf',
 ru:'https://optics.unm.edu/news-events/2024-12-05-dr-markus-raschke.html',
 rg:'https://physics.uccs.edu/sites/default/files/2026-01/01_30_Raschke.pdf',
 rs:'https://www.osti.gov/servlets/purl/836810',
 rx:'https://chem.xmu.edu.cn/virtual_attach_file.vsb?afc=ZLNLbsMRNYL4v8nEzNbM8M2LR-DMzne7UNC4olLYnNlaU8L0gihFp2hmCIa0MYysU1yYMYysnm9sU4LZU8M2oz9Do7-ZL4LZMNLDMR98UNWFolrfL7-ZUzAFMR9DnRGJv2nto4Osnm9sU4LZU8M2oz9Do7-ZL4LZMNLDMR98UNWFolrfL7-ZUzAFMR9DnRGJv2nto4xmq2rxgDTJQty0Lz-sMSy8MmLYgtA8pUycc&e=.pdf&nid=4632&oid=1582043906&tid=1275',
 bf:'https://physics.berkeley.edu/people/faculty/robert-birgeneau',
 bc:'https://gspp.berkeley.edu/assets/uploads/faculty/cv/Birgeneau_CV_10-1-21.pdf',
 bo:'https://digicoll.lib.berkeley.edu/nanna/record/222040/files/birgeneau_robert_2021_web.pdf?registerDownload=1&version=1&withMetadata=0&withWatermark=0',
 ba:'https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.26.718',
 bch:'https://chancellor.berkeley.edu/node/68',
 mi:'https://www.imperial.ac.uk/news/11154/london-centre-nanotechnology-appoints-co-director/',
 mo:'https://cemas.osu.edu/people/mccomb.29',
 mq:'https://quantum.osu.edu/faculty',
 ma:'https://www.academia.edu/90079440/A_study_of_silicon_ELNES_in_nesosilicates',
 mw:'https://www.robertwolkow.com/team',
 mm:'https://www.cambridge.org/core/journals/mrs-bulletin/article/cryogenic-transmission-electron-microscopy-for-materials-research/32F7FBFE92490D593F272DA0A4856016',
 gr:'https://pubs.rsc.org/en/content/articlehtml/2020/mh/d0mh90070b',
 gb:'https://www.colorado.edu/rasei/2023/06/03/profile-garry-rumbles',
 gc:'https://www.colorado.edu/chemistry/garry-rumbles'
};
const src=(...xs)=>xs.map(([label,key])=>source(label,u[key])).join(' · ');
const pl=(id,prefix,evidence)=>personLine(id,prefix,' '+evidence);
const schoolWith=(id,evidence)=>schoolSource(id,' · '+evidence);
const a=(key,note,sources,status)=>[key,note,sources.map(k=>u[k]),status];
function cell(id,n,value){
 const prefix='| [['+records.get(id).filename+'|';
 rewrite(sl(id),x=>x.startsWith(prefix),x=>{
  const end=x.indexOf(']]'), cells=x.slice(end+2).split(' | ');
  if(end<0||cells.length<4)throw Error('missing school cells '+id);
  cells[n]=value;
  return x.slice(0,end+2)+cells.join(' | ');
 });
}
function mentor(file,name,desc,links){
 if(fs.existsSync(mf(file)))return;
 updates.set(mf(file),['# '+name,'','- 类型：师承扩展人物','- '+desc+' '+links,'','## 师承',''].join('\n'));
}
function edge(id,name,mFile,mName,fLabel,bLabel,note,links){
 if(!links)throw Error('edge requires sources '+id);
 const from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 insertAfter(pf(id),'## 师承','\n- '+fLabel+'：'+to+after);
 insertAfter(mf(mFile),'## 师承','\n- '+bLabel+'：'+from+after);
 insertAfter(index,'# 师承关系与候选线索索引','\n- '+from+' → '+fLabel+'：'+to+after);
}
function updateEdge(id,name,mFile,mName,oldForward,oldBack,newForward,newBack,note,links){
 const rec=records.get(id),from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 rewrite(pf(id),x=>x.startsWith('- '+oldForward+'：')&&x.includes(mFile),()=>'- '+newForward+'：'+to+after);
 rewrite(mf(mFile),x=>x.startsWith('- '+oldBack+'：')&&x.includes(rec.filename),()=>'- '+newBack+'：'+from+after);
 rewrite(index,x=>x.startsWith('- '+from+' → '+oldForward+'：')&&x.includes(mFile),()=>'- '+from+' → '+newForward+'：'+to+after);
}
function unit(id,name,label,detail,links){
 const schoolName=records.get(id).unit, node='已核实单位 - '+schoolName+' - '+label;
 const file=path.join(root,'已核实院系',node+'.md');
 const line='- '+who(id,name)+' — '+detail+' '+links;
 const header='[[院校 - '+schoolName+'|返回学校]]';
 if(!fs.existsSync(file)&&!updates.has(file))updates.set(file,['# '+schoolName+'：'+label,'',header,'','## 已核实人物','',line,''].join('\n'));
 else if(!get(file).includes(records.get(id).filename)){
  const contents=get(file), nl=contents.includes('\r\n')?'\r\n':'\n';
  updates.set(file,contents.trimEnd()+nl+line+nl);
 }
 rewrite(pf(id),x=>x.startsWith('- 院系／机构：'),x=>x.includes(node)?x:x.replace(/。$/,'')+' · '+wiki(node,label)+'。');
}

const sn='James B. Spicer', sw='师承人物 - James W. Wagner';
const sd='JHU 1991 典礼册列 James Brian Spicer 材料科学与工程博士及论文《Laser Ultrasonics in Finite Structures: Comprehensive Modelling with Supporting Experiment》。NASA 托管同期论文致谢在 JHU 研究段称 Jim Spicer 为 Jim Wagner 的 graduate student；作者自己的导师另列 Robert E. Green Jr.。结合 Wagner 1984 起 JHU 工程任教及 1992 同题署名，确认博士研究组属，正式导师职衔待 Spicer 论文签署。';
const ss=src(['JHU 1991 典礼册','sc'],['NASA 托管同期论文致谢','sn'],['JHU 工学院 Wagner 原档','sw'],['NASA 同期论文书目','sp']);
const sa='JHU 工学院和材料系原档核材料主聘、APL 联合任用与激光材料相互作用、光声及激光超声。';
const sas=src(['JHU 工学院原档','sj'],['材料系课题组名录','sg']);
mentor(sw,'James W. Wagner','1984 年获 JHU 材料科学与工程博士，随后在 Whiting 工学院任教并曾任材料系主任。',src(['JHU 工学院原档','sw']));
edge(s,sn,sw,'James W. Wagner','博士阶段课题组负责人','博士阶段课题组成员',sd,ss);
unit(s,sn,'应用物理实验室（联合任用）','JHU 工学院原档列 APL secondary appointment。',sas);
pl(s,'- 研究方向：',sa+' '+sas);
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+sd+' 所阅 JHU 履历未明列独立博后。NASA 1992 文章书目同时列 JHU 和 NASA 机构，未说明个人职位。 '+ss);
cell(s,1,'材料科学与工程系、应用物理实验室（联合任用）；激光与材料相互作用、材料光学、超声');
cell(s,2,'James W. Wagner（博士阶段课题组负责人，论文签署待核）');
cell(s,3,'所阅未列独立博后，NASA 同期署名的职位待核');
schoolWith(s,ss+' · '+sas);
const as=audit(s,[a('identity','典礼册全名、材料系及原题，与 JHU 现档和 NASA 署名相合。',['sc','sj','sp']),a('affiliation',sa,['sj','sg']),a('research',sa,['sj','sg']),a('phd',sd,['sc','sn','sw','sp'],'group_or_candidate'),a('postdoc','所阅 JHU 履历未明列独立博后；NASA 1992 文章书目列合作单位，早期聘任待查。',['sj','sp'])],'查 JHU 1991 论文原件或学位档具名导师、早期聘任与 NASA 合作单位是否有正式博后。');
relation(s,as,'phd',sw,'group_leader',sd,[u.sc,u.sn,u.sw,u.sp],'wagner');

const rn='Markus Raschke', rh='师承人物 - Ulrich Höfer', rs=records.get('81347a28').filename;
const rd='MPQ-246 公开手稿和 TUM 学位年表核论文题名《Optical Second-Harmonic Investigations of the Kinetics of Elementary Surface Reactions on Si(001) and Si(111)》。TUM 1999-03-16 条目列 Gutachter Dietrich Menzel 与 Martin Stutzmann，两人按原称为论文评审。Voelkmann 的 TUM 博士论文致谢称 Höfer 为自己导师，并列 Raschke 为同组研究者。与 Raschke 1998–1999 MPQ/TUM 同期组内研究相合，Höfer 升为博士阶段课题组负责人，个人正式指导仍待核。本人履历及学位档记 1999，UNM 与 UCCS 讲者简介写 2000，保留两种记载。';
const rds=src(['MPQ-246 原件','rd'],['TUM 学位档','rt'],['Voelkmann 博士论文致谢','rv'],['同期原刊','rp'],['UNM 讲座履历','ru']);
const rp='本人履历列 Berkeley 物理系 1999–2001 Feodor-Lynen Postdoc Fellow。Berkeley 同期博士论文致谢在 Shen 组段落明确称 Humboldt 博后项目带来 Raschke，交叉核为 Yuen-Ron Shen 组博后。基金会索引仍待读正式 host 栏，保留组负责人。履历另列 2002–2006 Berlin Max Born Postdoc/Staff，UCCS 2026 报告履历称 research group leader，原职称并列，具体起止及个人导师待核。';
const rps=src(['本人履历','rx'],['Berkeley 博士论文致谢','rs'],['UCCS 讲座履历','rg']);
updateEdge(r,rn,rh,'Ulrich Höfer','博士导师候选','博士导师候选对应人物','博士阶段课题组负责人','博士阶段课题组成员',rd,rds);
updateEdge(r,rn,rs,'Yuen-Ron Shen','博士后课题组负责人','博士后课题组成员','博士后课题组负责人','博士后课题组成员',rp,rps);
rewrite(pf(r),x=>x.startsWith(boundary),()=>boundary+rd+' '+rp+' '+rds+' · '+rps);
pl(r,'- 院系／机构：','UNM 和 UCCS 报告原档列 Boulder 物理系和 JILA，2015 本人履历另列化学系。 '+src(['UNM 原档','ru'],['本人履历','rx']));
cell(r,2,'Ulrich Höfer（博士阶段课题组负责人）；TUM 评审 Dietrich Menzel、Martin Stutzmann，正式导师待核');
cell(r,3,'Berkeley 1999–2001 博后 Yuen-Ron Shen 组；Max Born 2002–2006 职称有差异，个人指导待核');
schoolWith(r,rds+' · '+rps);
const ar=audit(r,[a('affiliation','本人 CV 列物理、化学及 JILA，2024 与 2026 讲座核物理及 JILA。',['rx','ru','rg']),a('research','UNM 原讲座核超快非线性纳米光谱及量子材料成像。',['ru']),a('phd',rd,['rd','rt','rv','rp','ru'],'group_or_candidate'),a('postdoc',rp,['rx','rs','rg'],'group_or_candidate')],'查 TUM 正式导师登记、Höfer 组历史档及 Max Born 原始聘任。Humboldt 基金会搜索索引需可读的档案正文。');
relation(r,ar,'phd',rh,'group_leader',rd,[u.rd,u.rt,u.rv,u.rp],'hoefer');
relation(r,ar,'postdoc',rs,'group_leader',rp,[u.rx,u.rs,u.rg],'shen');

const bn='Robert Birgeneau（荣休）', bh='师承人物 - Michael T. Hutchings', bw='师承人物 - Werner P. Wolf';
const bAff='Berkeley 物理系及校长办公室均列物理、材料科学与工程、公共政策三方向任职，物理系列 Professor Emeritus 和 Professor of the Graduate School，研究量子磁体及超导体，用散射与 ARPES。';
const bas=src(['Berkeley 物理系原档','bf'],['校长办公室原档','bch']);
const bpd='本人 CV 的就业栏明确列 Werner P. Wolf 为 Yale Supervisor，并列博士论文题名《Magnetic Interactions in Rare Earth Insulators》及 1966；Yale 校友目录记 1967 年 5 月。CV 另列 1966–1967 Yale 工程与应用科学 Instructor，学位日期差异保留。';
const bpe='本人 CV 列 1967–1968 Oxford Rutherford Memorial Postdoctoral Fellow。本人 Berkeley 口述档称主要研究在 Harwell 与 Mike Hutchings 合作，另外为 Oxford Clarendon 的 Michael Baker 组学生分析数据，最初拟加入的光谱组未加入。1971 APS 署名将 M. T. Hutchings 与 Harwell 对应，Hutchings 记为已核主要合作者、低可信指导候选。Bell Labs 是随后正式研究岗，Peter Wolff 为该阶段组负责人。';
const bps=src(['本人 CV','bc'],['Berkeley 口述史原档','bo'],['APS 原刊','ba']);
mentor(bh,'Michael T. Hutchings','磁性及中子散射研究者，APS 原刊将其与英国 Harwell Atomic Energy Research Establishment 对应。',src(['APS 原刊','ba']));
edge(b,bn,bh,'Michael T. Hutchings','博士后候选关系（主要合作者）','博士后候选研究者（合作）',bpe,bps);
unit(b,bn,'公共政策（交叉任职）','校长办公室与物理系履历列该交叉任职。',bas);
pl(b,'- 研究方向：',bAff+' '+bas);
pl(b,boundary,bpd+' '+bpe+' '+bps);
line(mf(bw),x=>x.startsWith('- 博士生：')&&x.includes(records.get(b).filename),' '+bpd+' '+src(['Birgeneau 本人 CV','bc']));
cell(b,1,'物理系（荣休）、材料科学与工程系（荣休）、公共政策（交叉任职）；凝聚态物理、量子磁性、非常规超导');
cell(b,3,'Oxford Rutherford Memorial 博后 1967–1968；Harwell 主要合作者 Michael T. Hutchings，指导待核');
schoolWith(b,bps+' · '+bas);
const ab=audit(b,[a('affiliation',bAff,['bf','bch']),a('research',bAff,['bf']),a('phd',bpd,['bc','bf'],'confirmed_advisor'),a('postdoc',bpe,['bc','bo','ba'],'group_or_candidate')],'查 Yale 学位馆藏原件区分论文完成与学位授予，查 Rutherford Fellowship 的正式接收者和 Oxford/Harwell 任用。');
relation(b,ab,'postdoc',bh,'candidate',bpe,[u.bc,u.bo,u.ba],'hutchings');

const mn='David McComb', mh='师承人物 - Archie Howie';
const ma='Ohio State CEMAS 和跨院系量子师资原档列材料系教授、CEMAS 创始主任、材料与制造研究所副主任，并核高分辨 STEM/EELS、氧化物局域磁序与声子及磁振子研究。';
const mas=src(['Ohio State CEMAS 原档','mo'],['Ohio State 量子师资','mq']);
const mp='Imperial 原档分列 1990 年获 Cambridge 博士学位后继续研究的两项 fellowship、Ottawa NRC Senior Research Associate 与后续 McMaster。1991 McComb 署名原论文的可读副本列 Cavendish Microstructural Physics Group、McComb 获 1851 Commission 资助，并致谢 Howie、Mick Brown 和 Phil Gaskell 的讨论。结合 Howie 的已核博士监督，仅列 Cambridge 博士后阶段低可信候选，资助项目未列个人导师。Wolkow 名册的 1994 RA 继续独立记载。';
const mps=src(['Imperial 任用原档','mi'],['1991 原刊可读副本','ma'],['Wolkow 实验室组档','mw']);
edge(m,mn,mh,'Archie Howie','博士后导师候选','博士后候选研究者',mp,mps);
unit(m,mn,'材料与制造研究所','CEMAS 履历列该所 Associate Director。',mas);
unit(m,mn,'电子显微与分析中心 CEMAS','CEMAS 履历列创始主任。',mas);
pl(m,'- 研究方向：',ma+' '+mas);
cell(m,1,'材料科学与工程系、CEMAS、材料与制造研究所；STEM/EELS、氧化物局域磁序、声子及磁振子');
cell(m,3,'Cambridge 两项毕业后 fellowship，Archie Howie 为低可信指导候选；Ottawa 研究岗另列');
schoolWith(m,mas+' · '+mps);
const am=audit(m,[a('affiliation',ma,['mo','mq']),a('research',ma,['mo','mq']),a('phd','Imperial 任命原档明确 Cavendish 1990 博士研究由 Archie Howie 监督，2019 本人署名原刊履历核 1990 学位。',['mi','mm'],'confirmed_advisor'),a('postdoc',mp,['mi','ma','mw'],'group_or_candidate')],'查 1851 Commission 与 Corpus Christi fellowship 的个人指导和实际任期，查 McMaster 任用。');
relation(m,am,'postdoc',mh,'candidate',mp,[u.mi,u.ma,u.mw],'howie');

const gn='Garry Rumbles', gm='师承人物 - David Phillips';
const gd='RSC 出版的具名作者简介将 David Phillips 的 supervision 明确对应 Rumbles 1984 University of London 博士，在 Royal Institution 的 Davy Faraday Research Laboratory 开展。Rumbles 本人访谈也确认从本科毕业后在该实验室随 Phillips 做激光研究。按明确博士指导标博士导师，论文题名和签署页待查。';
const gs=src(['RSC 作者介绍原刊','gr'],['Boulder 本人访谈','gb']);
const gp='Boulder 化学系履历按年份分列 George Atkinson（Arizona 1984–1985）、Edward K. C. Lee（UC Irvine 1985–1987）、David Phillips（Davy Faraday 1987–1989）。三条博后阶段研究师长继续保留。';
updateEdge(g,gn,gm,'David Phillips','博士阶段研究师长','博士阶段研究者','博士导师','博士生',gd,gs);
rewrite(pf(g),x=>x.startsWith(boundary),(x)=>boundary+gd+' '+gp+' '+gs+' · '+src(['Boulder 化学系履历','gc'])+' · [NREL 荣休公告](https://www.nlr.gov/news/detail/program/2025/how-nrel-researcher-garry-rumbles-has-advanced-science-through-mentorship)');
cell(g,2,'David Phillips（明确博士指导，University of London 1984；签署页待查）');
schoolWith(g,gs);
const ag=audit(g,[a('phd',gd,['gr','gb'],'confirmed_advisor'),a('postdoc',gp,['gc'],'group_or_candidate')],'追查 University of London 1984 学位登记及三段博士后岗位的具体指导职衔。');
relation(g,ag,'phd',gm,'advisor',gd,[u.gr,u.gb],'phillips');

if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,file){execFileSync(process.execPath,['--no-warnings',script,'record',file],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2104_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261110_2104_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_2104_结构化回执.json');
