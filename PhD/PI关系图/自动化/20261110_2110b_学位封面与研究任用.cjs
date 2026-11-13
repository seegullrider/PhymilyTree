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
 orig.audit_id='pi_archive_20261110_2110b_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2110b_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}




const [d,m,k,f]=['3c2b12a2','3c58fe7f','3c5bcd72','a2b4730f'];
const u={
 dd:'https://sdas-research.group/publications/',
 df:'https://engineering.purdue.edu/ECE/News/2011/graduate-student-saptarshi-das-receives-2011-ibm-phd-fellowship',
 dp:'https://par.nsf.gov/servlets/purl/10313950',
 du:'https://nanoscience.ucf.edu/news/events/promise-of-2d-materials/',
 dm:'https://www.matse.psu.edu/directory/saptarshi-das',
 dn:'https://www.mri.psu.edu/news/news/new-mri-appointments-aim-build-research-impact-and-collaboration',
 dl:'https://www.mri.psu.edu/news/lab-spotlight-series/saptarshi-das-research-group',
 ds:'https://s3-eu-west-1.amazonaws.com/pstorage-acs-6854636/3934888/nl5009037_si_001.pdf',
 dc:'https://cnm.anl.gov/people/leadership',
 dx:'https://www.matse.psu.edu/sites/matse/files/Saptarshi%20Das%20-%20CV%20-%20Full.docx',
 dw:'https://www.purdue.edu/discoverypark/nanotechnology/membership/Appenzeller/group.html',
 mf:'https://engineering.wisc.edu/directory/profile/dane-morgan/',
 mb:'https://books.google.com/books?id=rA5NAQAAMAAJ',
 mt:'https://thesis.library.caltech.edu/7810/1/JAMunoz_thesis.pdf',
 ma:'https://journals.aps.org/prb/abstract/10.1103/PhysRevB.56.R5705',
 md:'https://mse.berkeley.edu/2021/11/didier-de-fontaine-a-pioneer-in-the-field-of-first-principles-materials-science-and-emeritus-professor-of-materials-science-and-engineering-passes-away/',
 mi:'https://www.cambridge.org/core/services/aop-cambridge-core/content/view/4DDA16B3B93C616EBAE618445488A09B/S0883769400011702a.pdf/materials_informatics.pdf',
 mm:'https://news.mit.edu/2006/materials',
 mp:'https://ceder.berkeley.edu/publications/msmse-8-295-2000.pdf',
 mx:'https://www.sciencedirect.com/science/article/pii/S0927025697000244',
 kt:'https://bpb-us-w2.wpmucdn.com/campuspress.yale.edu/dist/2/3627/files/2021/07/ArchanaThesis_Nonreciprocity-in-active-Josephson-junction-circuits.pdf',
 kn:'https://physics.northwestern.edu/people/faculty/core-faculty/archana-kamal.html',
 kc:'https://sites.google.com/site/kamalarchana/EDUCATION',
 kr:'https://ora.ox.ac.uk/objects/uuid%3A089655cf-210f-490e-8cf7-80a2d39381a2/files/m6a5dc73323729de3fc2e52c8ea4fa4fc',
 ka:'https://meetings-archive.aps.org/mar/2016/r48/12/',
 fg:'https://www.bu.edu/stem/files/2014/10/Goldberg-CV-STEM.pdf',
 fb:'https://www.bu.edu/physics/2016/04/22/bu-physics-alum-leads-microsoft-quantum-computing-team/',
 fa:'https://arxiv.org/pdf/cond-mat/9809373',
 fp:'https://manfragroup.org/wp-content/uploads/2025/11/Absorption-spectroscopy-in-electron-double-layers-evidence-for-broken-symmetry-states.pdf',
 ft:'https://physics.gatech.edu/event/school-physics-fall-colloquium-series-dr-michael-j-manfra',
 fc:'https://magazine.engineering.columbia.edu/faculty/aron-pinczuk',
 fq:'https://quantum.research.purdue.edu/directory/michael-manfra/'
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


const dn='Saptarshi Das', dm='师承人物 - Anirudha V. Sumant', da=records.get('05b1b951').filename;
const dp='Das 本人课题组出版列表列 2013 Purdue 论文《Novel nano materials for high performance logic and memory devices》，UCF 主办页的第一人称履历列 Purdue ECE 2013 年 5 月博士。Purdue 2011 IBM 博士奖单篇公告直接写 Joerg Appenzeller 为其 advisor，维持已明确博士导师。';
const dps=src(['本人组论文目录','dd'],['Purdue 同期博士奖公告','df'],['UCF 本人报告履历','du']);
const dpost='本人署名 RSC 作者简介列 Argonne 2013–2015 Postdoctoral Research Scholar、2015–2016 Assistant Research Scientist。UCF 当时讲座自述为 Argonne CNM 与 Purdue Birck 联合博后研究人员。2014 ACS 原件将 Das 与 Anirudha V. Sumant 同列 Argonne CNM 通讯作者，CNM 原档可核 Sumant 身份。当前组负责人头衔没有用于反推当年的正式导师，Sumant 保留为低可信候选。';
const dposts=src(['本人署名 RSC 原刊','dp'],['UCF 本人讲座履历','du'],['2014 ACS 原始附录','ds'],['Argonne CNM 原档','dc']);
const daf='Penn State MRI 2026-09-30 任命原档列 ESM 教授及 Nanofab 科学主任，MatSE 目录注明跨学院材料研究生项目 IGDP 关联。MRI 组页核二维材料、纳米器件与神经形态计算。';
const dafs=src(['Penn State MRI 任命','dn'],['MatSE 跨学院项目页','dm'],['MRI 课题组档','dl']);
mentor(dm,'Anirudha V. Sumant','Argonne CNM 纳米制造与器件课题组现任负责人，曾在该中心开展二维材料器件研究。',src(['Argonne CNM 原档','dc'],['2014 ACS 原始附录','ds']));
edge(d,dn,dm,'Anirudha V. Sumant','博士后导师候选','博士后候选研究者',dpost,dposts);
const appendOwn=(id,role,mFile,note,links)=>line(pf(id),x=>x.startsWith('- '+role+'：')&&x.includes(mFile),' '+note+' '+links);
appendOwn(d,'博士导师',da,dp,dps);
line(mf(da),x=>x.startsWith('- 博士生：')&&x.includes(records.get(d).filename),' '+dp+' '+dps);
line(index,x=>x.startsWith('- '+who(d,dn)+' → 博士导师：'),' '+dp+' '+dps);
unit(d,dn,'纳米制造实验室（科学主任）','MRI 2026-09-30 任命。',src(['MRI 任命原档','dn']));
unit(d,dn,'材料科学与工程跨学院研究生项目（关联）','MatSE 页面明确列 IGDP 关联。',src(['MatSE 原档','dm']));
pl(d,'- 研究方向：',daf+' '+dafs);
pl(d,boundary,dp+' '+dpost+' '+dps+' · '+dposts);
cell(d,1,'工程科学与力学系、Nanofab、材料科学与工程跨学院研究生项目（关联）；二维材料、纳米电子学、神经形态计算');
cell(d,2,'Joerg Appenzeller（Purdue 2011 同期原档明示 advisor）');
cell(d,3,'Argonne 2013–2015 博后研究员，2015–2016 Assistant Research Scientist，Sumant 为低可信候选');
schoolWith(d,dps+' · '+dposts+' · '+dafs);
const ad=audit(d,[a('affiliation',daf,['dn','dm','dl']),a('research',daf,['dl','dn']),a('phd',dp,['dd','df','du'],'confirmed_advisor'),a('postdoc',dpost,['dp','du','ds','dc'],'group_or_candidate')],'按论文题名查 Purdue 馆藏原件。继续查 Argonne CNM 当年组织档、本人可读 CV 及具名聘任，并区分 Purdue 联合岗位。');
relation(d,ad,'phd',da,'advisor',dp,[u.dd,u.df,u.du],'appenzeller');
relation(d,ad,'postdoc',dm,'candidate',dpost,[u.dp,u.du,u.ds,u.dc],'sumant');

const mn='Dane Morgan', md='师承人物 - Didier de Fontaine', mc='师承人物 - Gerbrand Ceder';
const mPhd='加州大学馆藏扫描元数据列 Dane David Morgan、UC Berkeley、1998 及《Computational Studies of Alloy Phase Stability》，Caltech 论文书目独立核题名与学位。1997 APS 论文中 Morgan 和 Didier de Fontaine 同属 Berkeley 材料系，研究内容与学位工作一致。Berkeley 系档确认 de Fontaine 的身份。该阶段合著仅支持低可信博士导师候选，论文签署页和致谢未取得。';
const mPhds=src(['加州大学原卷扫描书目','mb'],['Caltech 论文书目','mt'],['1997 APS 原刊','ma'],['Berkeley 材料系档','md']);
const mPost='本人参与署名的 2006 MRS 原刊作者简历区分 1998 Berkeley 物理博士、MIT Postdoctoral Researcher 及 Research Associate，2004 赴 Wisconsin。MIT 原刊列 Morgan 为 Ceder 团队前 Postdoctoral Associate，2000 期刊原件证两人同 MIT 材料系。正式指导仍待查，Ceder 维持博士后课题组负责人。';
const mPosts=src(['2006 MRS 作者原档','mi'],['MIT 原报道','mm'],['2000 同期论文','mp']);
const mAff='Wisconsin 工程学院核 Materials Science and Engineering 主聘，Nuclear Engineering & Engineering Physics 为 affiliated department，研究计算材料、从头算电子结构、多尺度热动力学和电化学材料。';
edge(m,mn,md,'Didier de Fontaine','博士导师候选','博士生候选',mPhd,mPhds);
appendOwn(m,'博士后课题组负责人',mc,mPost,mPosts);
line(mf(mc),x=>x.startsWith('- 博士后课题组成员：')&&x.includes(records.get(m).filename),' '+mPost+' '+mPosts);
line(index,x=>x.startsWith('- '+who(m,mn)+' → 博士后课题组负责人：'),' '+mPost+' '+mPosts);
pl(m,'- 院系／机构：',mAff+' '+src(['Wisconsin 工程学院原档','mf']));
rewrite(pf(m),x=>x.startsWith(boundary),()=>boundary+mPhd+' '+mPost+' '+mPhds+' · '+mPosts);
cell(m,2,'Berkeley 1998 物理博士，Didier de Fontaine 为低可信候选');
cell(m,3,'MIT 博后及其后 Research Associate（至 2004），Gerbrand Ceder 为博士后课题组负责人');
schoolWith(m,mPhds+' · '+mPosts);
const am=audit(m,[a('affiliation',mAff,['mf']),a('research',mAff,['mf']),a('phd',mPhd,['mb','mt','ma','md'],'group_or_candidate'),a('postdoc',mPost,['mi','mm','mp'],'group_or_candidate')],'查 Berkeley 1998 纸本、可读签署页或致谢，核 de Fontaine 的具体角色，以及二手索引列出的 Daniel S. Rokhsar 的角色。继续核 MIT 博后与 RA 切换日期及具名指导。');
relation(m,am,'phd',md,'candidate',mPhd,[u.mb,u.mt,u.ma,u.md],'defontaine');
relation(m,am,'postdoc',mc,'group_leader',mPost,[u.mi,u.mm,u.mp],'ceder');

const kn='Archana Kamal', kd=records.get('a3ddcf1b').filename;
const kPhd='Yale 本人博士论文《Nonreciprocity in active Josephson junction circuits》封面 2013-03-11 列 Dissertation Director: Prof. Michel H. Devoret，致谢直接称其 advisor。致谢另称 John Clarke 为合作者，未列共同导师。保留已核 Yale 名录学位日记法。';
const kPhds=src(['Yale 博士论文封面及致谢','kt']);
const kPost='本人 QUEST 履历分列 MIT 2013–2016 Postdoctoral Research Associate 及 2016–2018 Visiting Scientist。Oxford 馆藏的 2015 APS 原刊将 Kamal、William D. Oliver、Terry P. Orlando 同列 MIT RLE，2016 APS 同期报告亦同时具名。二人仅列低可信指导候选，尚无个人导师或正式组属档。';
const kPosts=src(['本人 QUEST 履历','kc'],['2015 APS 原刊 Oxford 馆藏','kr'],['2016 APS 报告','ka']);
const kAff='Northwestern 物理与天文系现档列副教授，QUEST 研究超导量子电路、工程化开放量子系统、量子光学与非平衡动力学。';
appendOwn(k,'博士导师',kd,kPhd,kPhds);
line(mf(kd),x=>x.startsWith('- 博士生：')&&x.includes(records.get(k).filename),' '+kPhd+' '+kPhds);
line(index,x=>x.startsWith('- '+who(k,kn)+' → 博士导师：'),' '+kPhd+' '+kPhds);
rewrite(pf(k),x=>x.startsWith(boundary),()=>boundary+kPhd+' '+kPost+' '+kPhds+' · '+kPosts);
pl(k,'- 院系／机构：',kAff+' '+src(['Northwestern 物理系原档','kn']));
cell(k,2,'Michel H. Devoret（Yale 2013 博士论文 Dissertation Director）');
cell(k,3,'MIT 2013–2016 博后，Oliver 与 Orlando 为低可信候选；2016–2018 Visiting Scientist 另列');
schoolWith(k,kPhds+' · '+kPosts);
const ak=audit(k,[a('affiliation',kAff,['kn','kc']),a('research',kAff,['kn']),a('phd',kPhd,['kt'],'confirmed_advisor'),a('postdoc',kPost,['kc','kr','ka'],'group_or_candidate')],'按 2013–2016 MIT RLE 追原始任用与人员名录，核两位同期合作者的个人指导或组属。');
relation(k,ak,'phd',kd,'advisor',kPhd,[u.kt],'devoret');
for(const [mentorId,name,suffix] of [['55dfd7e3','William D. Oliver','oliver'],['5582584f','Terry P. Orlando','orlando']]){
 const file=records.get(mentorId).filename;
 edge(k,kn,file,name,'博士后导师候选','博士后候选研究者',kPost,kPosts);
 relation(k,ak,'postdoc',file,'candidate',kPost,[u.kc,u.kr,u.ka],suffix);
}

const fn='Michael J. Manfra', fg=records.get('371d7c6e').filename, fgn='Bennett Goldberg', fOther=records.get('a9f24c18').filename, fp=records.get('8eb883b6').filename;
const fPhd='Goldberg 本人 CV 的 Ph.D. Theses 一栏列 Michael Manfra、论文《Optical Investigations of Multicomponent Quantum Hall Systems》及 1998，该栏部分条目另列 co-advisor 或 second reader，Manfra 条目未列正式角色。1998 论文原件两人同属 BU 物理系，Manfra 现址脚注是 Bell Labs。BU 物理系及 Georgia Tech 履历写 1999 博士。保留年份口径和博士导师候选，签署待查。';
const fPhds=src(['Goldberg 本人 CV','fg'],['BU 校友原档','fb'],['1998 论文原件','fa'],['Georgia Tech 主办原档','ft']);
const fPost='Georgia Tech 讲者原档明确 Bell Labs 1998–2000 Postdoctoral Member of the Technical Staff，2001 转 Member of the Technical Staff。2000 本人组托管的 Physica E 原件中 Manfra、Aron Pinczuk 同属 Bell Labs，Pinczuk 另列 Columbia。Columbia 工学院原档核 Pinczuk 当期的 Bell Labs 资深研究职位及光谱方向。Pinczuk 仅为低可信博士后指导候选。';
const fPosts=src(['Georgia Tech 主办原档','ft'],['2000 Physica E 原刊','fp'],['Columbia 工学院原档','fc']);
const fAff='Purdue 量子研究所原档列物理与天文、ECE、材料工程三系，及 PQSEI 主任和学校首席量子官，研究拓扑量子相、分数量子霍尔和半导体–超导体异质结构。';
const fLink=who(f,fn);
const fTeacher=wiki(fg,fgn)+'（'+wiki(fOther,'Northwestern 同一人记录')+'）';
rewrite(pf(f),x=>x.startsWith('- 博士导师候选：'),()=>'- 博士导师候选：'+fTeacher+'。'+fPhd+' '+fPhds);
rewrite(index,x=>x.startsWith('- '+fLink+' → 博士导师候选：'),()=>'- '+fLink+' → 博士导师候选：'+fTeacher+'。'+fPhd+' '+fPhds);
for(const mentorFile of [fg,fOther])rewrite(mf(mentorFile),x=>x.startsWith('- 博士论文相关人员（导师候选）：')&&x.includes(records.get(f).filename),()=>'- 博士论文相关人员（导师候选）：'+fLink+'。'+fPhd+' '+fPhds);
edge(f,fn,fp,'Aron Pinczuk','博士后导师候选','博士后候选研究者',fPost,fPosts);
unit(f,fn,'量子科学与工程研究所（主任）','PQSEI 现档列 Director。',src(['Purdue PQSEI 原档','fq']));
pl(f,'- 研究方向：',fAff+' '+src(['Purdue PQSEI 原档','fq']));
cell(f,1,'物理与天文学系、电气与计算机工程系、材料工程系、PQSEI；量子输运、拓扑量子相、半导体纳米结构');
cell(f,2,'Bennett Goldberg（博士导师候选，BU 博士档与 CV 年份口径待核）');
cell(f,3,'Bell Labs 1998–2000 博后技术岗，2001 转研究技术岗；Aron Pinczuk 为低可信候选');
schoolWith(f,fPhds+' · '+fPosts+' · '+src(['Purdue PQSEI 原档','fq']));
const af=audit(f,[a('affiliation',fAff,['fq']),a('research',fAff,['fq']),a('phd',fPhd,['fg','fb','fa','ft'],'group_or_candidate'),a('postdoc',fPost,['ft','fp','fc'],'group_or_candidate')],'查 BU 原学位卷或签署页以核正式指导及学位年份，继续追 Bell Labs 博后接收档，区分光谱合作和具名指导。');
relation(f,af,'phd',fg,'candidate',fPhd,[u.fg,u.fb,u.fa,u.ft],'goldberg');
relation(f,af,'postdoc',fp,'candidate',fPost,[u.ft,u.fp,u.fc],'pinczuk');
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,file){execFileSync(process.execPath,['--no-warnings',script,'record',file],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2110b_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261110_2110b_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_2110b_结构化回执.json');
