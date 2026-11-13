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
 orig.audit_id='pi_archive_20261110_2128_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2128_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}





const [g,l,e,s,q,k]=['4fd675f0','2e3b5830','1e5a80fe','401d11fb','3f0212d1','f5a0922e'];
const u={
 gh:'https://www.physics.rutgers.edu/grad/redbook08/Red-www-faculty.html',
 gc:'https://catalogs.rutgers.edu/nb-ug/03-05/nbfull.pdf',
 gn:'https://www.physics.rutgers.edu/physicsnews/news.shtml',
 gj:'https://jetp.ras.ru/cgi-bin/dn/e_059_02_0442.pdf',
 lh:'https://ias.tau.ac.il/Shaoul-Past-Fellows',
 lj:'https://www.jetp.ras.ru/cgi-bin/dn/e_067_10_2134.pdf',
 li:'https://ilt.kharkiv.ua/bvi/general/history_e.html',
 eu:'https://mtsm.che.wisc.edu/wp-content/uploads/sites/1151/2025/05/OralAbstracts.pdf',
 ew:'https://minds.wisconsin.edu/bitstream/1793/9882/1/file_1.pdf',
 ep:'https://www.annualreviews.org/content/journals/10.1146/annurev.physchem.50.1.377',
 eg:'https://escobedo-group.cbe.cornell.edu/people/',
 sc:'https://spaepen.seas.harvard.edu/biocv/cv',
 sh:'https://seas.harvard.edu/person/frans-spaepen',
 sp:'https://spaepen.seas.harvard.edu/publications',
 sm:'https://www.cambridge.org/core/services/aop-cambridge-core/content/view/D6B275D348F82AC2A30CB9C1DF359476/S0883769400017024a.pdf/div-class-title-solid-liquid-interfaces-molecular-structure-thermodynamics-and-crystallization-div.pdf',
 sa:'https://assets.cambridge.org/97811074/05592/excerpt/9781107405592_excerpt.pdf',
 sw:'https://onlinelibrary.wiley.com/doi/abs/10.1002/polc.5070630120',
 qf:'https://physics.berkeley.edu/people/faculty/zi-qiang-qiu',
 qt:'https://jscholarship.library.jhu.edu/bitstream/handle/1774.2/36833/commencement1991.pdf?sequence=1',
 qi:'https://inis.iaea.org/search/search.aspx?orig_q=RN:23057539',
 qp:'https://www.osti.gov/servlets/purl/6838651',
 qa:'https://higherlogicdownload.s3.amazonaws.com/APS/70c2182e-c5da-4c3b-9ee5-c1880622ed90/UploadedImages/Newsletter/may1996.pdf',
 kw:'https://source.washu.edu/2007/11/making-stronger-connections-2/',
 ka:'https://www.cambridge.org/core/services/aop-cambridge-core/content/view/S0883769400007855',
 kp:'https://www.academia.edu/54338186/Kinetics_of_structural_relaxation_in_several_metallic_glasses_observed_by_changes_in_electrical_resistivity',
 ki:'https://physics.washu.edu/news/memory-kenneth-kelton'
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



const gd='Rutgers 2008–2009 研究生手册列 Michael E. Gershenson 在 Moscow Institute of Radio Engineering and Electronics 获 1982 博士，2003–2005 校目录另列 MIPT 硕士。';
const gp='1984 JETP 原件的 1983-07 投稿列 M. E. Gershenzon 与 E. M. Gershenzon 等，单位栏为 Moscow State Pedagogic Institute；它与 Rutgers 学位目录记载的博士授予机构不同。署名只能追查博士后时期的合作，具体任用与个人指导仍待档案。';
const gl=src(['Rutgers 研究生手册','gh'],['Rutgers 校目录','gc'],['1984 JETP 原件','gj'],['Rutgers 系刊','gn']);
pl(g,boundary,gd+' '+gp+' '+gl);
cell(g,2,'1982 Moscow Institute of Radio Engineering and Electronics 博士，导师待核');
cell(g,3,'1983 投稿原刊署 Moscow State Pedagogic Institute；具体任用和导师待核');
schoolWith(g,gl);
audit(g,[a('identity','Rutgers 历史目录匹配 Michael E. Gershenson、学历与实验凝聚态，2001 院系原刊确认同一教授晋升。',['gh','gc','gn'],'confirmed'),a('affiliation','Rutgers 物理与天文学系旧手册及院系晋升档。',['gh','gn'],'confirmed'),a('research','Rutgers 同期原刊列低维无序系统量子输运与退相干。',['gh','gn'],'confirmed'),a('phd',gd,['gh','gc'],'unresolved'),a('postdoc',gp,['gj'],'unresolved')],'按 Michael E. Gershenson、М. Е. Гершензон 与 1982 年查 IRE 学位和早期聘任原件，区分 Moscow State Pedagogic Institute 的合作。');

const lt='Tel Aviv University Shaoul fellowship 原履历确认 Kharkov 学位后在莫斯科苏联科学院作 researcher，并把 Minnesota 1990 副教授与 Yale 2007 分列。1988 JETP 原论文列 Glazman、Itskovitch、Kulik、Shekhter 及苏联科学院微电子与超纯材料技术研究所，和既有 1986–1990 研究员阶段相合。1982–1986 任用、正式博后与个人指导未明。';
const ll=src(['Tel Aviv 大学原履历','lh'],['1988 JETP 原论文','lj'],['低温研究所沿革','li']);
pl(l,boundary,lt+' '+ll);
cell(l,2,'1982 乌克兰科学院低温物理与工程研究所博士，导师待核');
cell(l,3,'1986–1990 苏联科学院微电子技术研究所研究员／高级研究员；1982–1986 任用及博后导师待核');
schoolWith(l,ll);
audit(l,[a('postdoc',lt,['lh','lj'],'unresolved'),a('phd','Tel Aviv 原履历再次确认博士授予研究所。1988 论文与学位相隔六年，未据其合著确定学位指导。',['lh','li','lj'],'unresolved'),a('affiliation','Tel Aviv fellowship 原档列 Yale 物理与应用物理、Yale Quantum Institute 自 2014。',['lh'],'confirmed'),a('research','同档列介观凝聚态，原论文核点接触谱相关理论。',['lh','lj'],'confirmed')],'查 Kharkov 低温所的 1982 年学位答辩、实验室年报及 1982–1986 原聘任。');

const et='Wisconsin 2025 会议原册独立核 Wisconsin–Madison 1997 博士和 Cornell 1998 年底入职。Wisconsin 馆藏 1995 原稿列与 de Pablo 同署 Wisconsin 化工，1999 Annual Reviews 原刊显示合作仍在持续且列 Cornell 与 Wisconsin 两处署名。两端证据明确，1997–1998 任命及是否有博后仍待聘任原档。';
const el=src(['Wisconsin 会议原册','eu'],['Wisconsin 馆藏原稿','ew'],['1999 原刊','ep']);
pl(e,boundary,et+' '+el);
schoolWith(e,el);
audit(e,[a('phd','保留报告组织者明确的 Juan de Pablo 指导原证；Wisconsin 本校会议档核 1997 学位，馆藏 1995 原稿核同校阶段。',['eu','ew'],'confirmed_advisor'),a('postdoc',et,['eu','ep'],'unresolved'),a('research','Wisconsin 原册报告摘要核软材料相行为和晶化，Annual Reviews 原刊核流体相变模拟。',['eu','ep'],'confirmed')],'查 Wisconsin 1997 学位论文目录、论文签署与 1997–1998 任用表，分开记录博士后和合作。');

const st='本人 Harvard 组履历与署名 MRS 作者简介分别列 Harvard 1975 应用物理博士和 1977 应用科学部助理教授。Harvard 出版目录列两年间与 Turnbull 合作。1978 Wiley 原刊检索索引所示 IBM Postdoctoral Fellow 1975–1977 待取原刊正文确认，本轮原页返回 403。';
const slinks=src(['本人 CV','sc'],['MRS 作者履历','sm'],['Harvard 出版目录','sp']);
pl(s,boundary,st+' '+slinks);
cell(s,3,'1975–1977 早期任用待核；IBM Postdoctoral Fellow 仅有原刊索引线索');
schoolWith(s,slinks+' · '+src(['Harvard SEAS','sh']));
audit(s,[a('postdoc',st,['sc','sm','sp','sw'],'unresolved'),a('affiliation','Harvard SEAS 原页列应用物理教授及材料科学与机械工程本科项目主任。',['sh','sc'],'confirmed'),a('research','Harvard SEAS 及署名 MRS 履历列材料界面、非晶金属、薄膜及软物质。',['sh','sm'],'confirmed')],'查 IBM fellowship / Harvard 1975–1977 人事目录及 Wiley 原件，确认任期与 Turnbull 在博后阶段的角色。');

const qn='Zi Qiang Qiu', qm='师承人物 - Samuel D. Bader';
const qd='Johns Hopkins 1991 毕业典礼原册列 Ziqiang Qiu，论文 Investigations of Magnetic Thin Films and High Tc Superconductivity，毕业册未列导师。Walker 维持候选，INIS 原入口未读到。';
const qe='Berkeley 物理系原档列 Johns Hopkins 1991 博士后到 Argonne Materials Science Division 进行博后研究、1993 转 Berkeley；OSTI 1992 年原论文三人同署 Argonne，APS 会务档核 S. D. Bader 全名及单位。Samuel D. Bader 保留低可信博后候选，个人指导待核。';
const ql=src(['Berkeley 物理系','qf'],['1992 Argonne 原稿','qp'],['APS 会务档','qa']);
mentor(qm,'Samuel D. Bader','APS 会务档列 Argonne Materials Science Division，1992 原稿从事薄膜磁性。',src(['APS 会务档','qa'],['Argonne 原稿','qp']));
edge(q,qn,qm,'Samuel D. Bader','博士后导师候选','博士后候选研究者',qe,ql);
pl(q,boundary,qd+' '+src(['JHU 毕业原册','qt']));
cell(q,2,'1991 Johns Hopkins 博士；James Calvin Walker 为低可信导师候选');
cell(q,3,'Argonne Materials Science Division 博后；Samuel D. Bader 为低可信导师候选');
schoolWith(q,ql+' · '+src(['JHU 毕业原册','qt']));
const aq=audit(q,[a('phd',qd,['qt','qf'],'group_or_candidate'),a('postdoc',qe,['qf','qp','qa'],'group_or_candidate'),a('affiliation','Berkeley 物理系教授。',['qf'],'confirmed'),a('research','磁性纳米结构和超薄膜磁性。',['qf','qp'],'confirmed')],'以 JHU 题名及 1991 级纸本卷核 Walker；查 Argonne 1991–1993 博后任用或项目负责人。');
relation(q,aq,'postdoc',qm,'candidate',qe,['qf','qp','qa'].map(x=>u[x]),'bader');

const kn='Kenneth Kelton', km=records.get(s).filename;
const ke='WashU 校刊明确其 1985 年秋入职前在 Harvard 完成两年博士后，MRS 本人署名作者履历列 1983 Harvard 博士。同期原论文可读重刊列 Kelton 与 Frans Spaepen 同署 Harvard 应用科学部，正式博士后指导待核，列低可信候选。';
const kl=src(['WashU 校刊','kw'],['MRS 作者原履历','ka'],['同期原论文转载','kp']);
edge(k,kn,km,'Frans Spaepen','博士后导师候选','博士后候选研究者',ke,kl);
pl(k,boundary,ke+' '+kl);
cell(k,3,'约 1983–1985 Harvard 博后；Frans Spaepen 为低可信导师候选');
schoolWith(k,kl);
const ak=audit(k,[a('postdoc',ke,['kw','ka','kp'],'group_or_candidate'),a('phd','MRS 本人署名原刊核 Harvard 1983 学位；Arkansas Tech 索引线索已留，原页无法访问，博士指导仍是候选。',['ka','ki'],'group_or_candidate'),a('research','WashU 校刊和系档核材料物理、金属玻璃、准晶、时间相关成核。',['kw','ki'],'confirmed')],'按已定位题名查 Harvard 1983 学位原卷，查 Harvard 两年博后任用以核 Spaepen 具体角色。');
relation(k,ak,'postdoc',km,'candidate',ke,['kw','ka','kp'].map(x=>u[x]),'spaepen');

const read=(id,key,excerpt)=>({record_id:id,url:u[key],raw:excerpt,excerpt});
const error=(id,key,error)=>({record_id:id,url:u[key],error});
const pages=[
 read(g,'gh',gd), read(g,'gc','Rutgers 校目录列 MIPT 硕士、Moscow IRE 博士。'), read(g,'gn','Rutgers 原刊核 2001 晋升和低维无序电子系统量子输运。'), read(g,'gj',gp),
 read(l,'lh','Tel Aviv fellowship 原档列博士机构，莫斯科 research 任用及 Yale 物理／应用物理。'), read(l,'lj','1988 JETP 原件核 Institute of Problems in Microelectronic and Ultrapure Materials Technology 及同期合著者。'), read(l,'li','Kharkov 低温所沿革核机构与点接触谱研究团队。'),
 read(e,'eu','Wisconsin 2025 会议册核 Wisconsin 1997 博士、Cornell 1998 年底及早期硕士。'), read(e,'ew','1995 Wisconsin 馆藏原刊核 Escobedo 与 de Pablo 同系署名。'), read(e,'ep','1999 Annual Reviews 原刊核 Escobedo、de Pablo、Yan 及 Wisconsin、Cornell 署名。'), error(e,'eg','Failed to fetch Cornell laboratory people: (502) Bad Gateway'),
 read(s,'sc','本人 CV 核 Harvard 1975 应用物理博士、1977 助理教授和后续任用。'), read(s,'sh','SEAS 现档核应用物理教授和材料、机械工程项目主任。'), read(s,'sp','Harvard 出版清单列 1976–1978 与 Turnbull 合作。'), read(s,'sm','MRS 署名履历核 1975 学位、1977 入职及非晶金属、材料界面研究。'), read(s,'sa','Cambridge 出版 Turnbull 自传提及 Spaepen 与 Meyer 界面研究。'), error(s,'sw','Failed to fetch Wiley author note: (403) Forbidden'),
 read(q,'qt',qd), error(q,'qi','INIS legacy record 23057539 inaccessible via web reader'), read(q,'qp','1992 OSTI 原件列 Qiu、Pearson、Bader 同署 Argonne Materials Science Division。'), read(q,'qa','APS 会务原档列 Samuel D. Bader 全名及 Argonne 同一分部。'),
 read(k,'kw','WashU 校刊明确 1985 年秋入职前 Harvard 博后两年。'), read(k,'ka','MRS 原履历确认 1983 Harvard 博士及 1985 WashU 任用。'), read(k,'kp','可读原刊转载列 Kelton、Spaepen 的 Harvard Division of Applied Sciences 署名。'), read(k,'ki','WashU 院系纪念原档核院系、研究和材料所历史任职。')
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2128_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2128_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2128_博士题名与任用网页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
