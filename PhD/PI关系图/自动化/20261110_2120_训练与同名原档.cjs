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
 orig.audit_id='pi_archive_20261110_2120_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2120_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}




const [g,p,n,b]=['3cfffe71','3dcc612f','3e4d951e','d5ffd5f5'];
const u={
 gc:'https://terpconnect.umd.edu/~galitski/cv_galitski.pdf',
 gf:'https://umdphysics.umd.edu/directory/faculty/current/galitski.html',
 gi:'https://www.physics.umd.edu/cmtc/intro.html',
 gp:'https://arxiv.org/pdf/cond-mat/0301196',
 gr:'https://www.physics.umd.edu/cmtc/formermembers.html',
 gs:'https://math.phys.msu.ru/Staff/Employees/Sokolov_Dmitryi_Dmitrievich/show_archive_page-2025_2026',
 gm:'https://www.phys.msu.ru/rus/research/reports/PUBLICATIONS/sp_publ_1998.pdf',
 ga:'https://arxiv.org/abs/1203.6195',
 pa:'https://news.stonybrook.edu/newsroom/press-release/general/peterwstephens/',
 ps:'https://dspace.sunyconnect.suny.edu/server/api/core/bitstreams/eb1185c7-d011-4ace-b11f-e7a6d68fc103/content',
 pp:'https://electronicsandbooks.com/edt/manual/Magazine/P/Physical%20Review%20Letters/Physical%20Review%20Letters%201982-1986/root/data/PhysRevLett%201982-1986/pdf/PRL/v51/i17/PRL_v51_i17_p1538_1.pdf',
 pk:'https://news.mit.edu/2014/professor-emeritus-john-king-dies',
 po:'https://history.aip.org/catalog/icos/33499.html',
 pt:'https://www.aip.org/history-programs/niels-bohr-library/oral-histories/33499',
 pr:'https://studylib.net/doc/11128886/personnel-jonathan-allen-prof.-john--g.-king',
 px:'https://www.bu.edu/lancet-commission-essential-medicines-policies/meet-the-commission/peter-stephens/',
 nc:'https://studylib.net/doc/18575720/cv-full-nemanich---arizona-state-university',
 np:'https://nemanich.physics.asu.edu/publications?page=10',
 na:'https://news.asu.edu/20170216-discoveries-asu-physicist-robert-nemanich-harnesses-power-diamonds?page=2',
 bn:'https://orbit.dtu.dk/en/publications/integrated-optics-components-utilizing-long-range-surface-plasmon/',
 bp:'https://backend.orbit.dtu.dk/ws/files/3895292/Boltasseva2.pdf',
 bc:'https://backend.orbit.dtu.dk/ws/files/3893982/Boltasseva.pdf',
 bt:'https://backend.orbit.dtu.dk/ws/portalfiles/portal/2546725/Alexandra-Boltasseva-PhD-Thesis_2006.pdf',
 bo:'https://www.optica.org/History/Biographies/bios/Alexandra_Boltasseva'
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


const gn='Victor Galitski', gm='人员 - University of Maryland, College Park - Sankar Das Sarma - e784c715', dm='师承人物 - D. Sokoloff';
const gd='本人 CV 列 1999 年 MEPhI 应用数学论文 Spectrum of Parker’s equations 及导师 D. Sokoloff，并列 2002 年 Minnesota 物理论文 Quantum Fluctuations in Superconductors 及导师 Anatoly Larkin。莫斯科国立大学物理系数学教研室履历、1998 年成果册的同期 Galitsky–Kuzanyan–Sokoloff 合作、以及 2012 年同机构发电机理论论文共同核对 D. Sokoloff 的全名为 Dmitry Dmitrievich Sokoloff（Дмитрий Дмитриевич Соколов）。';
const ge='本人 CV 明列 2002-09 至 2004-08 Maryland CMTC 博后；CMTC 官方沿革确认 Das Sarma 自 2002 年成立时任主任，2003 原论文署名两人同属 CMTC。此为任期重合和合作线索，列低可信候选，个人导师关系待核。';
const gl=src(['本人 CV','gc'],['Maryland CMTC 沿革','gi'],['2003 原论文','gp']);
const ds=src(['本人 CV','gc'],['莫斯科国立大学履历','gs'],['1998 年校成果册','gm'],['原论文署名','ga']);
updateEdge(g,gn,dm,'Dmitry Dmitrievich Sokoloff','博士导师','博士生','博士导师','博士生',gd,ds);
insertAfter(mf(dm),'# D. Sokoloff','\n- 全名 Dmitry Dmitrievich Sokoloff（Дмитрий Дмитриевич Соколов）。'+ds);
edge(g,gn,gm,'Sankar Das Sarma','博士后导师候选','博士后候选研究者',ge,gl);
pl(g,boundary,'CV 另列 2005–2006 Virginia 助理教授，Maryland 物理系记 2006 加入该系教职。'+src(['本人 CV','gc'],['Maryland 物理系','gf']));
cell(g,2,'Anatoly Larkin、Dmitry Dmitrievich Sokoloff');
cell(g,3,'2002–2004 Maryland CMTC 博后，Sankar Das Sarma 为低可信导师候选；2004–2005 KITP Research Fellow，个人指导者待核');
schoolWith(g,gl+' · '+ds);
const ag=audit(g,[a('identity',gd,['gc','gs','gm','ga'],'confirmed'),a('phd',gd,['gc','gf','gs','gm','ga'],'confirmed_advisor'),a('postdoc',ge+' 本人 CV 另列 2004-09 至 2005-08 KITP Research Fellow。',['gc','gi','gp'],'group_or_candidate'),a('affiliation','Maryland 物理系教授及 JQI Fellow，系档记 2006 加入教职。',['gc','gf'],'confirmed'),a('research','理论凝聚态、超导涨落及低维量子多体。',['gc','gf','gp'],'confirmed')],'查 2002–2004 CMTC 博后接收或个人指导档，及 2004–2005 KITP fellowship 原始任用档。');
relation(g,ag,'phd',dm,'advisor',gd,['gc','gs','gm','ga'].map(k=>u[k]),'sokoloff');
relation(g,ag,'postdoc',gm,'candidate',ge,['gc','gi','gp'].map(k=>u[k]),'dassarma');

const pn='Peter Stephens',pm='师承人物 - John G. King';
const pd='Stony Brook 研究生目录列 Peter W. Stephens 于 1978 获 MIT 博士。1983 原论文共同署名 MIT，Stephens 现址脚注为 Stony Brook，致谢其本人在 1973–1976 所获 Compton Fellowship；King 本人口述史的馆藏条目也记与 Stephens 的低温实验。博士阶段的低可信候选，论文签署页与正式称谓待查。';
const pe='Stony Brook 原档列 1978–1980 MIT Chaim Weizmann 博后，RLE 人员表转载原件列 Peter W. Stephens 为 Postdoctoral Fellow。King 担任 MIT Molecular Beams Laboratory 负责人，两人合作低温实验的具体年份未在所阅原件确认。King 仅列低可信博后候选。';
const px='BU 托管的 Lancet 委员会人物为 IMS Health 药政研究者，2015 Utrecht 药政博士；Stony Brook 官方目录及获奖档的 Peter W. Stephens 为 1978 MIT 物理博士、1980 起 Stony Brook 物理教职。两者的学历、任职与方向均不同。';
const pdL=src(['Stony Brook 目录','ps'],['1983 原论文扫描','pp'],['AIP 口述史馆藏','po'],['Stony Brook 履历','pa']);
const peL=src(['Stony Brook 履历','pa'],['MIT RLE 人员表转载','pr'],['MIT King 原档','pk'],['AIP 口述史馆藏','po']);
mentor(pm,'John G. King','MIT 物理学教授，曾任 RLE Molecular Beams Laboratory 负责人。',src(['MIT 纪念档','pk']));
edge(p,pn,pm,'John G. King','博士导师候选','博士生候选',pd,pdL);
edge(p,pn,pm,'John G. King','博士后导师候选','博士后候选研究者',pe,peL);
pl(p,boundary,px+' '+src(['已排除的同名网页','px'],['Stony Brook 目录','ps']));
cell(p,2,'1978 MIT 博士；John G. King 为低可信博士导师候选');
cell(p,3,'1978–1980 MIT Chaim Weizmann Postdoctoral Fellow；John G. King 为低可信博后导师候选；UC PPFP 同名档案字段冲突待核');
schoolWith(p,pdL+' · '+peL);
const ap=audit(p,[a('identity',px,['px','ps','pa'],'confirmed'),a('affiliation','Stony Brook 物理与天文学系，研究生目录和获奖原档互证。',['ps','pa'],'confirmed'),a('research','实验凝聚态及高分辨 X 射线粉末衍射。',['ps','pa'],'confirmed'),a('phd',pd,['ps','pp','po','pa'],'group_or_candidate'),a('postdoc',pe,['pa','pr','pk','po'],'group_or_candidate')],'查 1978 MIT 博士论文和 1978–1980 RLE Molecule/Molecular Beams 项目卷及 King 口述史全文，分别确认两阶段角色。');
relation(p,ap,'phd',pm,'candidate',pd,['ps','pp','po','pa'].map(k=>u[k]),'king_phd');
relation(p,ap,'postdoc',pm,'candidate',pe,['pa','pr','pk','po'].map(k=>u[k]),'king_pd');

const nt='所阅本人 CV 转载正文分列 Xerox PARC 1976–1982 General Sciences Laboratory 研究员、1982–1985 Integrated Circuit Laboratory 项目负责人、1985–1986 高级研究员及代理负责人，1986 起 North Carolina State 物理系教职。现有履历未单列博后任用，保留 ASU 档 1976 与 CV 1977 学位年份冲突。';
const nl=src(['本人 CV 转载正文','nc'],['ASU 原报道','na'],['实验室论文目录','np']);
pl(n,boundary,nt+' '+nl);
cell(n,3,'现有履历列 1976 起 Xerox PARC 正式研究岗，未查到独立博后任用');
schoolWith(n,nl);
audit(n,[a('phd','CV 转载与实验室原目录分别列学位年份及 Solin 1975–1977 同期研究，Solin 保留低可信候选，原学位档未取得。',['nc','np'],'group_or_candidate'),a('postdoc',nt,['nc','na'],'no_postdoc_documented'),a('research','ASU 原报道核金刚石材料、高功率半导体及薄膜生长，原组目录核表界面光谱。',['na','np'],'confirmed')],'通过芝加哥馆藏索引按 Robert John Nemanich、1976 或 1977 和非晶硫系半导体光散射题名关键词定位论文，核对 Solin 角色及学位年份。');

const bt='DTU 馆藏目录明确论文题名 Integrated-Optics Components Utilizing Long-Range Surface Plasmon Polaritons 和出版年 2004，附加 PDF 文件名含 2006。此前已核的两位博士导师维持。';
const be='2006 论文本人简介明确 DTU COM 博后，此前任职 Micro Managed Photons 与 Alight Technologies。2005-06 投稿的另一篇原论文显示 Boltasseva 署 DTU COM/Nano DTU，旧博士导师 Bozhevolnyi 则署 Aalborg University，保持跨校合作；个人博后导师仍待具名来源。';
const bl=src(['DTU 学位论文目录','bn'],['DTU 2006 作者简介','bp'],['2005 投稿原论文','bc'],['Optica 获奖档','bo']);
pl(b,'- 博士论文复查：',bt+' '+src(['DTU 学位论文目录','bn']));
pl(b,'- 博士后经历：',be+' '+bl);
schoolWith(b,bl);
audit(b,[a('phd',bt,['bn','bt'],'confirmed_advisor'),a('postdoc',be,['bp','bc'],'unresolved'),a('affiliation','Optica 履历确认 Purdue ECE 教授及 Materials Engineering courtesy appointment。',['bo'],'confirmed'),a('research','Optica 履历核纳米、量子光子学、纳米加工与光学材料。',['bo','bn'],'confirmed')],'查 DTU 2005–2007 COM 博后聘任和 Talent Project 授予原档，继续区分合作、课题组及个人导师。');

const reviewed=(id,k,raw,excerpt)=>({record_id:id,url:u[k],raw,excerpt});
const fail=(id,k,error)=>({record_id:id,url:u[k],error});
const pages=[
 reviewed(g,'gc','本人 CV 封面及第二页列两个博士题名、各自导师和 Maryland/KITP/Virginia 任期。','两位博士导师复核，2002–2004 Maryland 博后和 2004–2005 KITP fellow。'),
 reviewed(g,'gf','Maryland 物理系简介列 Minnesota 在 Larkin 指导下获博士，2006 加入系任助理教授。','院系原档确认 Minnesota 博士导师与 Maryland 教职。'),
 reviewed(g,'gi','CMTC 原档列中心于 2002 年成立并任命 Sankar Das Sarma 为 permanent Director。','中心层级领导，个人博后导师待查。'),
 reviewed(g,'gp','2003 作者原稿封面两人署名 CMTC、Center for Superconductivity Research、Maryland Physics。','博后期间同中心合作线索。'),
 reviewed(g,'gs','莫斯科国立大学数学教研室明确俄文全名及发电机理论研究。','核 Dmitry Dmitrievich Sokoloff 全名。'),
 reviewed(g,'gm','1998 年校成果册列 Galitsky V.M.、Kuzanyan K.M. 与 Sokoloff D.D. 的发电机合作。','同阶段原始成果表补全名匹配。'),
 reviewed(g,'ga','原论文作者名单列 Dmitry Sokoloff 及 Moscow University，主题为 turbulent dynamo。','补英文署名及机构。'),
 fail(g,'gr','Failed to fetch UMD CMTC former group members: (400) Timeout fetching'),
 reviewed(p,'pa','Stony Brook 获奖原档列 MIT 学位、1973–1976 Compton、1978–1980 Chaim Weizmann 博后和 1980 入 Stony Brook。','核物理学者身份、博后时段和方向。'),
 reviewed(p,'ps','Stony Brook 研究生目录列 1978 MIT Ph.D.，Experimental condensed matter physics。','核博士年份及领域。'),
 reviewed(p,'pp','1983 PRL 署名 MIT Physics/RLE，脚注指 Stephens 现址 Stony Brook；致谢本人所获 Compton Fellowship。','King 与 Stephens 同单位合作，可供分阶段追查。'),
 reviewed(p,'pk','MIT 原档列 King 为物理教授和 RLE Molecular Beams Laboratory 长期负责人。','核实验室负责人身份。'),
 reviewed(p,'po','AIP 馆藏描述列 King 回顾与 Peter Stephens 和 Dan Oates 的低温实验。','原访谈馆藏简介可读，完整访谈另查。'),
 reviewed(p,'pr','MIT RLE 人员原表转载，Peter W. Stephens 在 Postdoctoral Fellows 栏。','补 MIT 博后身份，表未指定导师。'),
 fail(p,'pt','Failed to fetch AIP oral history transcript: (403) Error fetching'),
 reviewed(n,'nc','可读的本人 CV 转载列 Chicago 1977、1976 起 Xerox PARC 三种正式研究岗位、1986 North Carolina State。','核研究任用分类，保留学位年份冲突。'),
 reviewed(n,'np','本人 ASU 实验室清单列 1977 本人单独论文、与 Solin 共同的 Raman–Brillouin 研究。','研究相关线索，原论文签署未确认。'),
 reviewed(n,'na','ASU 原报道列 Regents Professor 与金刚石半导体材料研究。','核方向。'),
 reviewed(b,'bn','DTU 馆藏条目列论文题名、2004 出版年，附件文件名含 2006。','博士论文题名及出版年已核。'),
 reviewed(b,'bp','同期作者简介列 DTU 2004 PhD、DTU COM Postdoctoral Fellow 与此前两个工业机构。','博后机构明确，个人指导者未列。'),
 reviewed(b,'bc','2005 投稿 IEEE 原文，Boltasseva 署 COM DTU / Nano DTU，Bozhevolnyi 署 Aalborg University。','记录原署名，未据此确定导师。'),
 reviewed(b,'bo','Optica 会员获奖档列 Purdue ECE 教授与 Materials Engineering courtesy appointment。','核双院系和光子学方向。')
];
const excluded=[{page_id:'d72dc8775c1a84b314e257a5',url:u.px,record_id:p,external_subject:'Peter Stephens（IMS Health / Utrecht 药政研究）',audit_id:ap,evidence:px}];

if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length,identityExclusions:excluded.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2120_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2120_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const xf='20261110_2120_同名纠偏.json';
persist(xf,excluded);
call('人物网页身份纠偏.cjs',[xf]);
const pfReceipt='20261110_2120_训练与同名网页回执.json';
persist(pfReceipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',pfReceipt]);
