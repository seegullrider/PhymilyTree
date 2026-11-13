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
 orig.audit_id='pi_archive_20261110_2110_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2110_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}




const [ch,b,p,x,g,h,r,w]=['1b58446a','98d786e1','c06d56dc','ba89032c','39dc4c4e','05aee352','3a117fa6','39d5fad4'];
const u={
 ch:'https://materialssciences.lbl.gov/profile/dcchrzan/',
 ce:'https://www.osti.gov/servlets/purl/5947448',
 ct:'https://books.google.com/books?id=-YQvAQAAIAAJ',
 cb:'https://search.library.berkeley.edu/discovery/search?query=any,contains,Magnetic%20properties%20of%20surfaces%20and%20interfaces&vid=01UCS_BER:UCB',
 bc:'https://advancedstudies.cyu.fr/medias/fichier/nachtergaele-cv_1657973257640-pdf?ID_FICHE=2210&INLINE=FALSE',
 bd:'https://www.math.ucdavis.edu/application/files/7016/0996/2711/1996.pdf',
 pa:'https://web.mit.edu/wmdeen/www/alumni.html',
 pb:'https://faculty.engineering.ucdavis.edu/phillips/biography/',
 pr:'https://che.engineering.ucdavis.edu/news/che-celebrates-careers-marjorie-longo-ronald-phillips-and-robert-powell',
 xd:'https://www.physics.uci.edu/node/9170',
 xm:'https://regents.umich.edu/files/meetings/12-11/2011-12-IV-1-8.pdf',
 xr:'https://www.imr.cas.cn/gjjl/lxjzxl/lxjzj/lxjzjhjzl/200706/W020090709569362561728.pdf',
 xp:'https://ceramics.onlinelibrary.wiley.com/doi/10.1111/j.1151-2916.1996.tb07914.x',
 xj:'https://www.jsmc-phd.de/files/content/people/phds/pan_xiaoqing/JSMC_CV_Xiaoqing.pdf',
 ge:'https://ece.engin.umich.edu/stories/new-equation-could-advance-research-in-solar-cells',
 gt:'https://www.techbriefs.com/component/content/article/8680-new-equation-could-advance-research-in-solar-cells-and-oleds',
 gk:'https://repository.dl.itc.u-tokyo.ac.jp/record/2767/files/K-216761.pdf',
 gm:'https://regents.umich.edu/files/meetings/09-23/2023-09-IV-1.pdf',
 gp:'https://www.esm.psu.edu/academics/graduate/graduate-seminars-bios-and-abstracts/chris-giebink-bio-abstract.aspx',
 ga:'https://harvest.aps.org/v2/journals/articles/10.1103/PhysRevB.82.155305/fulltext',
 rc:'https://www.physics.wisc.edu/wp-content/uploads/2021/02/RzchowskiCV.pdf',
 rn:'https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=912113',
 rd:'https://www.physics.wisc.edu/2025/06/',
 rt:'https://journals.aps.org/prb/abstract/10.1103/PhysRevB.42.2041',
 rf:'https://physics.duke.edu/sites/physics.duke.edu/files/documents/Fairbank_publications.pdf',
 rl:'https://umdphysics.umd.edu/images/CV/Lobb_CV19.pdf',
 wc:'https://www.duffield.cornell.edu/people/frank-wise/',
 wi:'https://bitsavers.org/pdf/ibm/IBM_Journal_of_Research_and_Development/334/ibmrd3304D.pdf',
 wo:'https://www.optica.org/about/newsroom/obituaries/2022/chung_tang/',
 wp:'https://opg.optica.org/ol/abstract.cfm?uri=ol-13-2-129'
};
const src=(...items)=>items.map(([label,key])=>source(label,u[key])).join(' · ');
const pl=(id,prefix,entry)=>personLine(id,prefix,' '+entry);
const addIndex=entry=>insertAfter(index,'# 师承关系与候选线索索引','\n'+entry);
const graphEdge=(id,name,mentorFile,mentorName,forward,backward,evidence,sources)=>{
 if(!sources) throw Error('missing edge sources for '+id);
 const a=who(id,name), m=wiki(mentorFile,mentorName);
 insertAfter(pf(id),'## 师承','\n- '+forward+'：'+m+'。'+evidence+' '+sources);
 insertAfter(mf(mentorFile),'## 师承','\n- '+backward+'：'+a+'。'+evidence+' '+sources);
 addIndex('- '+a+' → '+forward+'：'+m+'。'+evidence+' '+sources);
};
function stageCell(id,field,value) {
 const file=sl(id), prefix='| [['+records.get(id).filename+'|';
 rewrite(file,x=>x.startsWith(prefix),x=>{
  const end=x.indexOf(']]');
  const cells=x.slice(end+2).split(' | ');
  if(end<0||cells.length<4) throw Error('bad school row '+id);
  cells[field]=value;
  return x.slice(0,end+2)+cells.join(' | ');
 });
}
const withSource=(id,evidence,sources)=>pl(id,boundary,evidence+' '+sources);
const schoolWith=(id,sources)=>schoolSource(id,' · '+sources);
function newMentor(filename,name,detail,sources){
 if(!fs.existsSync(mf(filename))) updates.set(mf(filename),['# '+name,'','- 类型：师承扩展人物','- '+detail+' '+sources,'','## 师承',''].join('\n'));
}
const chd='博士论文候选题名为《Magnetic properties of surfaces and interfaces》。二手索引提示 Falicov 为 Chair，DAI 原卷与 Berkeley 目录链接未读取，保留为检索线索。LBL 同期报告原件将 Chrzan 和 Falicov 均列 UC Berkeley 物理系及 LBL，既有课题组证据保留，论文签署及正式指导待核。';
const cha='LBNL 履历核其 1989 Berkeley 凝聚态理论博士，毕业即加入 Sandia Livermore 计算材料科学组，1995 年加入 Berkeley 材料系并关联 LBNL 电子材料项目。';
const chs=src(['LBNL 人物原档','ch'],['1989 LBL 报告','ce']);
withSource(ch,chd+' '+cha,chs+' · '+src(['DAI 目录线索','ct'],['Berkeley 目录检索入口','cb']));
pl(ch,'- 院系／机构：',cha+' '+chs);
schoolWith(ch,chs);
audit(ch,[['affiliation',cha,[u.ch]],['phd',chd,[u.ch,u.ce],'group_or_candidate']],'以论文题名和全名 Daryl Christofer Chrzan 查 Berkeley 纸本目录及签署页，并区分 Sandia 1989 初聘与 1990–1995 Senior MTS。');

const bp='本人 CV 列 Leuven I.I.K.W. researcher 1984–1988（与 1987 博士重叠）、Chile 物理系 Research Associate 1989–1990、Leuven Research Associate 1991、Princeton 物理系 Instructor 1991–1993，1993 年任助理教授。培训栏以 P Inst. 列同一 Princeton Instructor 时段。未找到独立博士后聘任或具名导师，需查机构原始聘任。';
const bs=src(['本人 CV','bc'],['UC Davis 数学系 1996 原档','bd']);
withSource(b,bp,bs);
stageCell(b,3,'1989–1990 Chile RA，1991 Leuven RA，1991–1993 Princeton Instructor，独立博后与指导待核');
schoolWith(b,bs);
audit(b,[['postdoc',bp,[u.bc,u.bd]],['research','UC Davis 1996 数学系原档列统计力学及量子自旋系统。',[u.bd]]],'查 KU Leuven 1987《Exakte Resultaten voor het Spin-Bosonmodel》学位原件及 Chile、Leuven、Princeton 任用档。');

const pn='Ronald Phillips — 荣休', pm='师承人物 - William M. Deen', pdn='William M. Deen';
const ps=src(['MIT Deen 课题组校友原档','pa'],['UC Davis 本人学位履历','pb'],['UC Davis 化工系退休原档','pr']);
const pe='MIT Deen 组的校友原档列 Ronald J. Phillips、化工博士及悬浮液和多孔介质的对应学位题名，和 UC Davis 原档所列 MIT 学位与研究身份相合，记为博士阶段课题组负责人。校友表写 1989，UC Davis 学位履历写 1990。MIT 学位馆藏定位为 1721.1/39031，退避期间未读取正式导师栏。';
const pentry='- 博士阶段课题组负责人：'+wiki(pm,pdn)+'。'+pe+' '+ps;
rewrite(pf(p),y=>y.startsWith('- 博士课题组负责人候选：'),()=>pentry);
rewrite(mf(pm),y=>y.startsWith('- 博士课题组成员候选：')&&y.includes(records.get(p).filename),()=>'- 博士阶段课题组成员：'+who(p,pn)+'。'+pe+' '+ps);
rewrite(index,y=>y.startsWith('- '+who(p,pn)+' → 博士课题组负责人候选：'),()=>'- '+who(p,pn)+' → '+pentry.slice(2));
const pp='UC Davis 化工系称 MIT 博士毕业后返校任教，研究悬浮颗粒流动及胶体传输。所阅履历未列独立博后。';
withSource(p,pp,ps);
stageCell(p,2,'William M. Deen（博士阶段课题组负责人，论文导师和年份差异待核）');
stageCell(p,3,'MIT 博士毕业后赴 UC Davis 任教，所阅履历未列独立博后');
schoolWith(p,ps);
const ap=audit(p,[['identity',pe,[u.pa,u.pb,u.pr]],['phd',pe,[u.pa,u.pb,u.pr],'group_or_candidate'],['postdoc',pp,[u.pr]]],'按 MIT DSpace 主机退避等候，恢复后核 1721.1/39031 原条目和论文签署页，厘清 1989 与 1990。');
relation(p,ap,'phd',pm,'group_leader',pe,[u.pa,u.pb,u.pr],'deen');

const xn='Xiaoqing Pan', xmf='师承人物 - Manfred Rühle', xmn='Manfred Rühle';
const xa='UCI 物理与天文系原页确认其材料系和物理系双任、IMRI 与 CCAM 主任，研究氧化物异质结构和四维扫描透射电子显微学。Michigan 人事原档明确其 1991 Saarland 固态物理博士，1991–1996 Stuttgart MPI Metallforschung 博士后。';
const xe='Michigan 人事原档列 1991–1996 Stuttgart 博后。Rühle 本人 CV 记其 1993–1996 任 Institut für Werkstoffwissenschaft 所长。1996 论文同列 Pan、Joachim Mayer 与 Rühle 属该分所，具名个人指导待聘任或本人档案证实，Rühle 为低可信候选。';
const xs=src(['Michigan 任用原档','xm'],['Rühle 本人 CV','xr'],['1996 Wiley 论文','xp']);
newMentor(xmf,xmn,'本人 CV 列 1989 年起 MPI Metallforschung 科学成员及所长，1993–1996 任下属 Institut für Werkstoffwissenschaft 所长。',src(['本人 CV','xr']));
graphEdge(x,xn,xmf,xmn,'博士后导师候选','博士后候选研究者',xe,xs);
pl(x,'- 院系／机构：',xa+' '+src(['UCI 院系原档','xd'],['Michigan 任用原档','xm']));
withSource(x,'已按年代和学科排除 Jena 生命科学同名博士生，其本人 CV 列 2018–2021 硕士。',src(['同名者本人 CV','xj']));
stageCell(x,2,'1991 Saarland 固态物理博士，导师待核');
stageCell(x,3,'1991–1996 Stuttgart MPI Metallforschung 博后，Manfred Rühle 为低可信候选');
schoolWith(x,xs);
const ax=audit(x,[['identity','UCI 现档和 Michigan 2011 任用的学历与职位相合，Jena 生命科学同名者按年代及领域排除。',[u.xd,u.xm,u.xj]],['affiliation',xa,[u.xd,u.xm]],['research',xa,[u.xd]],['phd',xa,[u.xm,u.xd]],['postdoc',xe,[u.xm,u.xr,u.xp],'group_or_candidate']],'查 Saarland 1991 博士论文与 Stuttgart 1991–1996 接收档，区分分所所长与实际博后指导。');
relation(x,ax,'postdoc',xmf,'candidate',xe,[u.xm,u.xr,u.xp],'ruehle');

const gn='Chris Giebink', gf=records.get('55b7c653').filename, fn='Stephen R. Forrest', gg='师承人物 - Gary P. Wiederrecht';
const gd='Michigan 2010 校方原报道由 Tech Briefs 全文重刊，直接称 Noel Giebink 为 Forrest 的博士生。Kanno 的东京大学博士论文致谢独立把 Giebink 列为 Forrest 课题组的研究生。两个校属记录同步为博士导师，Princeton 论文签署页待查。';
const gs=src(['Michigan 报道全文重刊','gt'],['Kanno 博士论文','gk'],['Michigan 原报道地址','ge']);
const gb='Michigan Regents 列 Argonne 博后 2009–2012、2012 年加入 Penn State。Penn State 旧讲座列 George Wells Beadle Fellowship、两年及 2011 年秋加入，日期差异保留。2010 APS 论文列 Giebink 与 Wiederrecht 同属 Argonne CNM 和 ANSER，作为低可信博后导师候选。';
const gbs=src(['Michigan Regents 2023 任用原档','gm'],['Penn State 旧讲座','gp'],['APS 同期原刊','ga']);
for(const id of [g,h]){
 const oldRole=id===g?'博士导师':'博士阶段课题组负责人';
 const oldReverse=id===g?'博士生':'博士阶段课题组成员';
 const forward='博士导师：'+wiki(gf,fn)+'。'+gd+' '+gs;
 const link=who(id,gn);
 rewrite(pf(id),y=>y.startsWith('- '+oldRole+'：')&&y.includes(gf),()=>'- '+forward);
 rewrite(mf(gf),y=>y.startsWith('- '+oldReverse+'：')&&y.includes(records.get(id).filename),()=>'- 博士生：'+link+'。'+gd+' '+gs);
 rewrite(index,y=>y.startsWith('- '+link+' → '+oldRole+'：'),()=>'- '+link+' → '+forward);
 rewrite(pf(id),y=>y.startsWith(boundary),()=>boundary+gd+' '+gb+' '+gs+' · '+gbs);
 graphEdge(id,gn,gg,'Gary P. Wiederrecht','博士后导师候选','博士后候选研究者',gb,gbs);
 stageCell(id,2,'Stephen R. Forrest（明确博士导师，Princeton 签署页待查）');
 stageCell(id,3,'Argonne George Wells Beadle 博后，Gary P. Wiederrecht 为低可信候选，任期记载有差异');
 schoolWith(id,gs+' · '+gbs);
 const ga=id===g?'Michigan Regents 原档列 EECS 教授并在物理系联合任职，研究光电材料与器件。':'Penn State 电气工程曾任，现任 Michigan EECS 与物理系，按学校保留历史记录。';
 pl(id,'- 院系／机构：',ga+' '+src(['Michigan 任用原档','gm'],['Penn State 旧讲座','gp']));
 const ag=audit(id,[['affiliation',ga,[u.gm,u.gp]],['phd',gd,[u.gt,u.gk],'confirmed_advisor'],['postdoc',gb,[u.gm,u.gp,u.ga],'group_or_candidate']],'追 Princeton 博士论文原件，核 Argonne Beadle fellowship 名录的具名指导及 Penn State 招聘和实际起任日期。');
 relation(id,ag,'phd',gf,'advisor',gd,[u.gt,u.gk],'forrest');
 relation(id,ag,'postdoc',gg,'candidate',gb,[u.gm,u.gp,u.ga],'wiederrecht');
}

const rn='Mark Rzchowski';
const rp='本人 CV 列 1988–1991 Harvard 物理系 Postdoctoral Fellow，随后入 Wisconsin。APS 1990 论文列 Rzchowski、Michael Tinkham、Christopher J. Lobb 同属 Harvard；Lobb 本人 CV 列后续同期论文，两人仅为低可信博后导师候选，需项目或履历的个人指导证据。';
const rs=src(['本人 CV','rc'],['1990 APS 原刊','rt'],['Lobb 本人 CV','rl']);
const ra='Wisconsin 物理系 2025 公告确认其荣休，保留 Physics 院系节点。本人 CV 与 NIST 托管作者简介核 1988 Stanford 应用物理博士及 Harvard 博后。Fairbank 档案博士论文清单列其 1988 论文《Electromagnetic probes of metal and ceramic surfaces at low temperature》（档案末词有排字错误），正式导师字段仍待签署页。';
const ras=src(['Wisconsin 物理系公告','rd'],['本人 CV','rc'],['NIST 原刊作者简介','rn'],['Fairbank 档案','rf']);
pl(r,'- 院系／机构：',ra+' '+ras);
rewrite(pf(r),y=>y.startsWith(boundary),()=>boundary+ra+' '+rp+' '+ras+' · '+rs);
const t='师承人物 - Michael Tinkham', l=records.get('5ec4f8e3').filename;
graphEdge(r,rn,t,'Michael Tinkham','博士后导师候选','博士后候选研究者',rp,rs);
graphEdge(r,rn,l,'Christopher J. Lobb','博士后导师候选','博士后候选研究者',rp,rs);
stageCell(r,1,'Physics（荣休）；氧化物异质结构、量子输运、磁性材料');
stageCell(r,3,'1988–1991 Harvard 物理系博后，Michael Tinkham 与 Christopher J. Lobb 为低可信候选');
schoolWith(r,ras+' · '+rs);
const ar=audit(r,[['affiliation',ra,[u.rd,u.rc,u.rn]],['phd',ra,[u.rf,u.rc],'group_or_candidate'],['postdoc',rp,[u.rc,u.rt,u.rl],'group_or_candidate']],'按 Fairbank Stanford 名册题名追原论文签署页，查 Harvard 博后接收或资助原档以区分两位同期合作者。');
relation(r,ar,'postdoc',t,'candidate',rp,[u.rc,u.rt,u.rl],'tinkham');
relation(r,ar,'postdoc',l,'candidate',rp,[u.rc,u.rt,u.rl],'lobb');

const wn='Frank Wise', wm='师承人物 - Chung Liang Tang';
const wp='Cornell 现档与 1989 IBM 原刊作者简历确认 1988 获 Cornell 应用物理博士，随后加入该校教职，Bell Labs 1982–1983 在博士前。IBM 原刊列 Walmsley 为博后，所阅 Wise 履历未列独立博后。';
const we='1988 Optica 原刊及 1989 IBM 原刊显示 Wise 与 Cornell EE 的 Chung Liang Tang 合作超快激光研究，时间与毕业节点相合，仅列低可信博士导师候选，正式指导待查论文或个人履历。';
const ws=src(['Cornell 人物原档','wc'],['IBM 原刊作者简介','wi'],['1988 Optica 原刊','wp'],['Optica 唐履历','wo']);
newMentor(wm,'Chung Liang Tang','Optica 纪念档列 Cornell 电气工程教授，从事非线性光学和超快激光。',src(['Optica 纪念档','wo'],['IBM 原刊作者简介','wi']));
graphEdge(w,wn,wm,'Chung Liang Tang','博士导师候选','博士生候选',we,ws);
withSource(w,wp,ws);
stageCell(w,2,'1988 Cornell 应用物理博士，Chung Liang Tang 为低可信导师候选');
stageCell(w,3,'博士毕业后直接入职 Cornell，所阅履历未列独立博后');
schoolWith(w,ws);
const aw=audit(w,[['affiliation','Cornell 原档确认应用与工程物理荣休教授。',[u.wc]],['research','Cornell 原档列超快光学、纳米结构与非线性光学。',[u.wc]],['phd',we,[u.wc,u.wi,u.wp,u.wo],'group_or_candidate'],['postdoc',wp,[u.wc,u.wi]]],'按 Frank William Wise、Cornell Applied Physics 1988 查询 Cornell 纸本和 UMI 学位论文签署页，核对 Tang 的具体角色。');
relation(w,aw,'phd',wm,'candidate',we,[u.wc,u.wi,u.wp,u.wo],'tang');

if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,file){execFileSync(process.execPath,['--no-warnings',script,'record',file],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2110_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261110_2110_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_2110_结构化回执.json');
