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
 orig.audit_id='pi_archive_20261110_2058_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2058_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}



const r='862bed8a', b='3747d1d4', o='37ba13e3', t='3820c6d8', d='38ce23a3', w='39865432', q='7464b0a0';
const x='02479264', xu='3dc79514', cob='144c5aa8', pj='0eae5986', west='1f1887f8';
const u={
 rs:'https://chemistry.as.miami.edu/_assets/pdf/turro_spectruminterview.pdf',
 rc:'https://www.ameslab.gov/sites/default/files/inline-files/Tijana%20Rajh%20CV-public.pdf',
 rb:'https://api.pageplace.de/preview/DT0400.9781498708630_A38593885/preview-9781498708630_A38593885.pdf',
 bt:'https://openscience.ub.uni-mainz.de/server/api/core/bitstreams/1bda6aea-ec66-45e6-8533-e4924f771f81/content',
 bc:'https://www.cmu.edu/engineering/materials/people/faculty/bios/bockstaller-cv-2015_up15may15.pdf',
 be:'https://energy.cmu.edu/directory/bios/bockstaller-michael.html',
 ba:'https://elt.engr.tamu.edu/members/alumni/',
 oc:'https://lsa.umich.edu/cscs/people/affiliated-faculty/orr.html',
 od:'https://conservancy.umn.edu/bitstream/handle/11299/154950/GraduateSchool_1985_Fall.pdf?sequence=1',
 op:'https://sites.lsa.umich.edu/wp-content/uploads/sites/130/2015/05/2015-Nextprof-Science-Speakers.pdf',
 td:'https://www.physics.harvard.edu/academics/phds1971-2000',
 tw:'https://onlinelibrary.wiley.com/doi/book/10.1002/9783527628674',
 tg:'https://meso.seas.harvard.edu/people.html',
 tp:'https://meso.seas.harvard.edu/publications.html',
 tu:'https://scholars.duke.edu/person/teitso',
 dc:'https://news.uchicago.edu/story/juan-de-pablo-elected-national-academy-engineering',
 ds:'https://www.cscs.ch/fileadmin/user_upload/contents_publications/annual_reports/Annual_Report_1992.pdf',
 de:'https://www.ethistory.ethz.ch/materialien/professoren/listen/alle_profs/',
 dn:'https://engineering.nyu.edu/faculty/juan-de-pablo',
 wt:'https://digital.lib.washington.edu/bitstreams/ecb63eb0-3bdb-4f22-99e2-47c7fac7894a/download',
 wc:'https://www.cei.washington.edu/cei-graduate-fellow-earns-mit-pappalardo-fellowship-in-physics/',
 wp:'https://phy.princeton.edu/people/sanfeng-wu',
 wm:'https://physics.mit.edu/research/pappalardo-fellowships-in-physics/',
 wg:'https://jarillo-herrero.mit.edu/team/',
 qa:'https://meetings-archive.aps.org/mar/2018/s11/5/',
 qp:'https://cpb.iphy.ac.cn/fileCPB/journal/article/cpb/html/2015/cpb_24_11_117902.html',
 qf:'https://english-icqd.ustc.edu.cn/2013/0423/c9256a219115/page.htm',
 qu:'https://engineering.uci.edu/files/10-9-2025_qi_song_flyer_0.pdf',
 qe:'https://eqi.uci.edu/qi-song/'
};
const src=(...items)=>items.map(([label,key])=>source(label,u[key])).join(' · ');
const addIndex=entry=>insertAfter(index,'# 师承关系与候选线索索引','\n'+entry);
const pl=(id,prefix,entry)=>personLine(id,prefix,' '+entry);
const phase=(id,oldField,newField)=>school(id,' | '+oldField+' | ',' | '+newField+' | ');
const graphEdge=(id,name,mentorFile,mentorName,forward,backward,evidence,sources)=>{
 const a=who(id,name), m=wiki(mentorFile,mentorName);
 insertAfter(pf(id),'## 师承','\n- '+forward+'：'+m+'。'+evidence+' '+sources);
 insertAfter(mf(mentorFile),'## 师承','\n- '+backward+'：'+a+'。'+evidence+' '+sources);
 addIndex('- '+a+' → '+forward+'：'+m+'。'+evidence+' '+sources);
};
const rm='师承人物 - Olga I. Micic', rl=who(r,'Tijana Rajh'), ml=wiki(rm,'Olga I. Micic');
const re='《The Spectrum》2004 年原刊的 Rajh 作者简介把 O. Micic 与 1986 年 Belgrade 物理化学博士在 Vinča 的研究明确相连，表述为博士期间与她一起开展研究。与学位目录及本人 CV 相合，记博士阶段研究师长。论文正式导师字段仍待签署页，早期 Argonne 报道的候选证据继续保留在原台账。';
const rp='本人 CV 列 Hebrew University 化学系 1986–1987 Postdoctoral Appointment。本人参与著作的作者简介另记 1987 年在该校以 Visiting Scientist 研究半导体颗粒生长初期的量子化效应。保留两个原称谓，个人博后指导者待核。';
const rS=src(['2004 原刊作者简介','rs'],['本人 CV','rc']);
const rP=src(['本人 CV','rc'],['本人著作作者简介','rb']);
rewrite(pf(r),line=>line.startsWith('- 博士导师候选：')&&line.includes(rm),()=>'- 博士阶段研究师长：'+ml+'。'+re+' '+rS);
rewrite(mf(rm),line=>line.startsWith('- 博士导师候选对应人物：')&&line.includes(records.get(r).filename),()=>'- 博士阶段受指导者：'+rl+'。'+re+' '+rS);
rewrite(index,line=>line.startsWith('- '+rl+' → 博士导师候选：'),()=>'- '+rl+' → 博士阶段研究师长：'+ml+'。'+re+' '+rS);
rewrite(pf(r),line=>line.startsWith('- 博士论文追查：'),line=>line.replace('Olga I. Micic 保留候选，待可读原档确认正式博士导师。','新读 2004 作者简介已核 Micic 的博士阶段研究关系，正式论文导师继续查签署页。'));
pl(r,'- 博士后核查：',rp+' '+rP);
phase(r,'Olga I. Micic（同期合作及报道线索，正式导师待核）','Olga I. Micic（博士阶段研究师长，正式论文导师待核）');
schoolSource(r,' · '+rS+' · '+rP);
const ar=audit(r,[['affiliation','本人 CV 分列 Arizona State 分子科学学院与历史 Argonne CNM 任职。',[u.rc]],['research','本人 CV 和原刊核半导体胶体、量子点、纳米光化学研究。',[u.rc,u.rs]],['phd',re,[u.rs,u.rc],'group_or_candidate'],['postdoc',rp,[u.rc,u.rb],'unresolved']],'沿已知论文题名取得 Vinča 或 Belgrade 学位签署页。查 Hebrew University 1986–1987 聘任和项目；1991 年与 Rabani 合著是后续追查线索。');
relation(r,ar,'phd',rm,'stage_mentor',re,[u.rs,u.rc],'micic');

const be='Mainz 馆藏另一份博士论文的书目列 Bockstaller 的 2000 年博士论文《Strukturen kettensteifer Polyelektrolyte in wässriger Lösung am Beispiel von Poly(para-phenylen)sulfonaten》。CMU 当前履历同为 2000，本人 2015 CV 培训栏写 2000–2005，与该年及 CV 另列 2000-07 博后入职不一致，保留差异。原论文未取得，Wegner 为博士导师候选。';
const bp='本人 2015 CV 明列 2000-07 至 2004-02 任 MIT 材料系 Postdoctoral Associate，2004-03 至 2005-03 在 RWTH Aachen 任 Emmy Noether 研究组负责人。Thomas 组名录所列 2000–2004 博后组属保留，个人正式导师称谓待查。';
const bS=src(['Mainz 馆藏论文的参考文献','bt'],['CMU 本人 CV','bc'],['CMU 能源研究所','be']);
const bP=src(['CMU 本人 CV','bc'],['Thomas 实验室校友档','ba']);
pl(b,boundary,be+' '+bS);
pl(b,'- 博士后课题组负责人：',bp+' '+bP);
phase(b,'Gerhard Wegner（候选）','Gerhard Wegner（候选，Mainz 2000 博士论文题名已核）');
phase(b,'Edwin “Ned” Thomas（MIT 博后课题组；正式导师待核）','Edwin “Ned” Thomas（MIT 2000-07 至 2004-02 博后课题组；正式导师待核）');
schoolSource(b,' · '+bS+' · '+bP);
audit(b,[['affiliation','CMU 能源研究所原档列材料科学与工程、化学礼聘。',[u.be,u.bc]],['research','CMU 原档核聚合物纳米复合材料光学、热输运和结构性质。',[u.be]],['phd',be,[u.bt,u.bc,u.be],'group_or_candidate'],['postdoc',bp,[u.bc,u.ba],'group_or_candidate']],'按 Mainz 论文全题名继续查原件、签署页，并查 Humboldt Feodor Lynen 同期任用中的具名接收或指导。');

const oe='Minnesota 1985 年毕业册列 Bradford Grant Orr 博士论文《Electrical Transport Properties of Ultra-Thin Metallic Films: Percolation, Localization and Superconductivity》，Major Adviser A. M. Goldman。';
const oo='Michigan 2015 NextProf 校方原刊在 Bradford Orr 标题下列 Minnesota 物理学历、随后在 IBM Thomas J. Watson Research Center 做博士后、1987 入 Michigan。正文首句把名字误写为 Bradley，但同条的系主任职务、学位及研究方向与 Michigan 现档相合。具体任期月份、部门及个人导师待核。';
const oa='Michigan 物理教授，列为 Center for the Study of Complex Systems 关联教师。主要方向包括表界面、扫描探针显微、半导体超晶格及纳米颗粒。';
const oS=src(['Minnesota 毕业册','od'],['Michigan NextProf 原档','op'],['Michigan 复杂系统中心','oc']);
const ol=who(o,'Bradford Orr');
const org='已核实单位 - University of Michigan, Ann Arbor - 复杂系统';
rewrite(pf(o),line=>line.startsWith('- 院系／机构：'),line=>line.replace(/。$/,'')+' · '+wiki(org,'复杂系统中心（关联）')+'。 '+src(['中心原档','oc']));
insertAfter(path.join(root,'已核实院系',org+'.md'),'仅收录','\n- '+ol+' — '+src(['中心原档','oc']));
pl(o,'- 博士导师：',oe+' '+src(['Minnesota 毕业册','od']));
insertAfter(pf(o),'- 博士导师：','\n- 博士后经历：'+oo+' '+src(['Michigan NextProf 原档','op']));
phase(o,'待核','IBM Thomas J. Watson 博后（1987 入 Michigan 前），导师待核');
school(o,'物理系；凝聚态实验、表面物理、扫描探针显微学','物理系、复杂系统中心（关联）；凝聚态实验、表面物理、扫描探针显微学');
schoolSource(o,' · '+oS);
const ao=audit(o,[['affiliation',oa,[u.oc]],['research',oa,[u.oc]],['phd',oe,[u.od],'confirmed_advisor'],['postdoc',oo,[u.op,u.oc],'unresolved']],'查 1985–1987 IBM Watson 的博后录用、研究团队和个人指导者。');
relation(o,ao,'phd','师承人物 - Allen M. Goldman','advisor',oe,[u.od],'goldman');

const te='Harvard 物理系博士论文目录的 1986 年组列《Non-Linear Dynamics of Electrical Conduction in Extrinsic Photoconductors》，括号标 Westervelt。Duke 履历与 Westervelt 课题组历史名录交叉核 1986。';
const tp='本人合著专著的 Wiley 作者履历明确 Harvard 1986 物理博士后亦在 Harvard 开展博士后研究。Westervelt 组把 Teitsworth 列为 1986 届既往成员，1989 组发表档列共同署名的锗空间电荷畴论文。同期合作支持继续查 Westervelt 是否在博后阶段指导，具体聘期和关系均为低可信候选。';
const tS=src(['Harvard 论文目录','td'],['Duke 个人原档','tu'],['Westervelt 组名录','tg']);
const tP=src(['Wiley 作者简介','tw'],['Westervelt 组名录','tg'],['Westervelt 组发表档','tp']);
pl(t,'- 博士导师：',te+' '+tS);
pl(t,boundary,tp+' '+tP);
graphEdge(t,'Stephen W. Teitsworth',records.get(west).filename,'Robert Westervelt','博士后导师候选','博士后研究者候选',tp,tP);
phase(t,'待核','Harvard 博士后研究（Wiley 作者履历）；Robert Westervelt 为低可信指导候选');
schoolSource(t,' · '+tS+' · '+tP);
const ta='Duke 物理系原档核非平衡随机动力学、耦合电子电路及离子阱加热，历史重点含半导体超晶格。';
const at=audit(t,[['affiliation',ta,[u.tu]],['research',ta,[u.tu,u.tw]],['phd',te,[u.td,u.tu,u.tg],'confirmed_advisor'],['postdoc',tp,[u.tw,u.tg,u.tp],'group_or_candidate']],'查 Harvard 1986–1990 博后任用与 1989 锗项目原稿，核项目时任单位及个人导师。');
relation(t,at,'phd',records.get(west).filename,'advisor',te,[u.td,u.tu],'westervelt');
relation(t,at,'postdoc',records.get(west).filename,'candidate',tp,[u.tw,u.tg,u.tp],'westervelt_postdoc');

const ds='Chicago 2016 原刊确认 Berkeley 化工博士 1990、随后 ETH Zürich 博后。CSCS 1992 年报的 ETH 聚合物所项目报告将 J. J. de Pablo 和 U. W. Suter 列为共同研究者，列 1992 年合著，并注明当时 de Pablo 已赴 Wisconsin。ETH 校史确认 Suter 在该时段任高分子化学教授。由此列低可信博后导师候选，具体任期和个人指导仍待核。';
const dS=src(['Chicago 2016 原刊','dc'],['CSCS 1992 年报','ds'],['ETH 教员校史','de']);
graphEdge(d,'Juan de Pablo','师承人物 - Ulrich W. Suter','Ulrich W. Suter','博士后导师候选','博士后研究者候选',ds,dS);
phase(d,'待核','ETH Zürich 博后；Ulrich W. Suter 为低可信指导候选');
schoolSource(d,' · '+dS);
const ad=audit(d,[['postdoc',ds,[u.dc,u.ds,u.de],'group_or_candidate']],'查 ETH 聚合物所 1990–1992 博后任用、组长和个人导师档。Chicago 2012 历史岗位与当前 NYU 记录分开。');
relation(d,ad,'postdoc','师承人物 - Ulrich W. Suter','candidate',ds,[u.dc,u.ds,u.de],'suter');

const wl=who(w,'Sanfeng Wu'), xl=who(x,'Xiaodong Xu');
const we='本人 University of Washington 2016 物理论文《Device Physics of Two-Dimensional Crystalline Materials》在致谢明确称 Xiaodong Xu 为 Ph.D. advisor，封面及摘要亦列其为论文委员会主席。';
const ce='同一论文致谢明确称 David Henry Cobden 为博士研究中的 second advisor，并叙述在其组的日常实验训练，封面列其为论文委员会成员。按本人称谓记录第二导师，委员会主席仍为 Xu。';
const wp='MIT Pappalardo 原档列其 2016–2019 博后 fellowship，Jarillo-Herrero 组原页的博士后校友栏目列 Sanfeng Wu。Pablo Jarillo-Herrero 是课题组负责人，个人正式博士后指导职衔待核。';
const wa='Princeton 物理系原档核物理副教授，另列 Princeton Materials Institute 和 Princeton Quantum Initiative 关联。研究二维量子物态和器件、量子输运。';
const wS=src(['本人学位论文封面与致谢','wt'],['UW 同期项目档','wc']);
const wP=src(['MIT fellowship 原档','wm'],['Jarillo-Herrero 组校友原档','wg']);
rewrite(pf(w),line=>line.startsWith('- 博士阶段研究师长：')&&line.includes(records.get(x).filename),()=>'- 博士导师：'+xl+'。'+we+' '+wS);
rewrite(pf(x),line=>line.startsWith('- 博士阶段研究者：')&&line.includes(records.get(w).filename),()=>'- 博士生：'+wl+'。'+we+' '+wS);
insertAfter(pf(xu),'## 师承','\n- 博士生：'+wl+'。'+we+' '+wS);
rewrite(index,line=>line.startsWith('- '+wl+' → 博士阶段研究师长：'),()=>'- '+wl+' → 博士导师：'+xl+'。'+we+' '+wS);
rewrite(pf(w),line=>line.startsWith(boundary),()=>boundary+'博士原论文封面与致谢均可读。Xu 当时任 UW，后转 Stanford。'+wp+' '+wS+' · '+wP);
const units=['Princeton Materials Institute','Princeton Quantum Initiative'].map(name=>['已核实单位 - Princeton - '+name,name]);
rewrite(pf(w),line=>line.startsWith('- 院系／机构：'),line=>line.replace(/。$/,'')+' · '+units.map(([node,name])=>wiki(node,name+'（关联）')).join(' · ')+'。 '+wa+' '+src(['Princeton 物理系原档','wp']));
for(const [node] of units)insertAfter(path.join(root,'已核实院系',node+'.md'),'仅收录','\n- '+wl+' — '+src(['Princeton 物理系原档','wp']));
graphEdge(w,'Sanfeng Wu',records.get(cob).filename,'David Henry Cobden','博士共同导师','博士生',ce,wS);
graphEdge(w,'Sanfeng Wu',records.get(pj).filename,'Pablo Jarillo-Herrero','博士后课题组负责人','博士后课题组成员',wp,wP);
phase(w,'Xiaodong Xu（博士阶段研究师长）','Xiaodong Xu（论文导师、委员会主席）、David Henry Cobden（论文致谢明确为第二导师）');
phase(w,'待核','MIT 2016–2019 Pappalardo；Pablo Jarillo-Herrero（课题组负责人，正式导师待核）');
school(w,'物理系；二维量子材料、拓扑物态、量子输运','物理系、Princeton Materials Institute 和 Princeton Quantum Initiative（关联）；二维量子材料、拓扑物态、量子输运');
schoolSource(w,' · '+wS+' · '+wP+' · '+src(['Princeton 物理系原档','wp']));
const aw=audit(w,[['affiliation',wa,[u.wp]],['research',wa,[u.wp]],['phd',we+' '+ce,[u.wt,u.wc],'confirmed_advisor'],['postdoc',wp,[u.wm,u.wg],'group_or_candidate']],'查 Pappalardo 2016–2019 任命或 fellow 本人履历中的具名导师。');
relation(w,aw,'phd',records.get(x).filename,'advisor',we,[u.wt,u.wc],'xu');
relation(w,aw,'phd',records.get(cob).filename,'advisor',ce,[u.wt],'cobden');
relation(w,aw,'postdoc',records.get(pj).filename,'group_leader',wp,[u.wm,u.wg],'jarillo');

const qname='师承人物 - Donglai Feng';
const qd='APS 2018 原会议档列 Qi Song 为 FeSe/SrTiO3 报告人，双单位为复旦与 MIT，合作者 Donglai Feng 为复旦物理系。Feng 参与署名的 2015 年原综述致谢点名 Song 参与同方向的生长和谱学测量；其 2013 年科大讲者档核当时任复旦博士生导师。列低可信博士导师候选，仍须复旦论文或名册具名确认。';
const qS=src(['APS 2018 本人报告','qa'],['2015 原论文致谢','qp'],['封东来同期科大履历','qf']);
const qa='UCI Eddleman Quantum Institute 原档核材料科学与工程助理教授及低维量子材料、分子束外延、超导与量子磁性。院系报告区分复旦博士期间 MIT 访学、Harvard 物理系博后与 2020 年起 Cornell 材料系博后。';
const qA=src(['UCI 量子研究所原档','qe'],['UCI 2025 报告人履历','qu']);
if(!fs.existsSync(mf(qname)))updates.set(mf(qname),['# Donglai Feng（封东来）','','- 类型：师承扩展人物','- 2013 年任复旦大学物理系教授、博士生导师和应用表面物理国家重点实验室主任，研究超导、氧化物薄膜和谱学。 '+src(['科大同期讲者原档','qf']),'','## 师承',''].join('\n'));
graphEdge(q,'Qi Song',qname,'Donglai Feng（封东来）','博士导师候选','博士生候选',qd,qS);
pl(q,'- 院系／机构：',qa+' '+qA);
phase(q,'复旦物理博士，导师待核','复旦物理博士；封东来为低可信导师候选');
schoolSource(q,' · '+qS+' · '+qA);
const aq=audit(q,[['affiliation',qa,[u.qe,u.qu]],['research',qa,[u.qe]],['phd',qd,[u.qa,u.qp,u.qf,u.qu],'group_or_candidate']],'查复旦物理博士论文和旧实验室名册，继续核 Harvard 及 Cornell 的具名个人指导和对应聘任。');
relation(q,aq,'phd',qname,'candidate',qd,[u.qa,u.qp,u.qf],'feng');

if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,file){execFileSync(process.execPath,['--no-warnings',script,'record',file],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2058_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261110_2058_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_2058_结构化回执.json');
