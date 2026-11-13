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
 orig.audit_id='pi_archive_20261111_0407_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0407_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"rb":"https://reichmangroup.chem.columbia.edu/directory/david-r-reichman","ry":"https://chem.yale.edu/events/2025-10-21-anomalous-low-temperature-behavior-of-glasses","ro":"https://reichmangroup.chem.columbia.edu/directory","rv":"https://chemistry.uchicago.edu/news/the-enduring-legacy-of-gregory-voth-a-beacon-of-innovation-and-mentorship-in-theoretical","gp":"https://liquids.seas.harvard.edu/sxnspeterindex.html","gb":"https://www.bnl.gov/staff/ogang","gc":"https://www.engineering.columbia.edu/sites/default/files/2024-04/Oleg_CV.pdf","go":"https://cheme.columbia.edu/files/seas/content/oleg_gang_shortcv_march2020.pdf","gn":"https://www.bnl.gov/newsroom/news.php?a=22203","ocko":"https://www.bnl.gov/staff/ocko","bnl":"https://www.bnl.gov/bnlweb/pubaf/bulletin/files/2008/20080926.pdf","cv":"https://oleg.ucsd.edu/Oleg_Shpyrko_CV.pdf","ucsd":"https://physics.ucsd.edu/people/profile/453","cr":"https://cmrr.ucsd.edu/_files/research-review/2014-fa-rr.pdf","cf":"https://www.duffield.cornell.edu/people/andrej-singer/","ds":"https://www-library.desy.de/diss13.html","df":"https://www-library.desy.de/cgi-bin/showprep.pl?desy-thesis-13-023=","ku":"https://cmrr.ucsd.edu/_files/research-highlights/report-42.pdf","kc":"https://research.engineering.ucdavis.edu/ultrafastdynamics/wp-content/uploads/sites/90/2024/04/2024_CV_Rkukreja_short.pdf","kd":"https://mse.engineering.ucdavis.edu/people/roopali-kukreja","kt":"https://www-ssrl.slac.stanford.edu/stohr/roopali-thesis.pdf","kp":"https://purl.stanford.edu/dm019dp8418","ks":"https://www6.slac.stanford.edu/news/2015-09-17-roopali-kukreja-wins-2015-klein-award-x-ray-work","ko":"https://www.physics.colostate.edu/wp-content/uploads/sites/14/2022/03/kukreja-roopali-colloquium-04112022.pdf","al":"https://ultrafast.stanford.edu/people/aaron-lindenberg","hd":"https://www.uu.se/en/contact-and-organisation/staff?query=N17-2307","slac":"https://www-ssrl.slac.stanford.edu/stohrgroup/Alumni/alumni.html"};
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








const ids=(...keys)=>keys.map(k=>u[k]);
const r='38d42d59', g='09de1be5', s='2d2d30ae', i='9172baa3', k='43c39a5e';
const pershan='人员 - Harvard - Peter S. Pershan - f4e438b4', shpyrko=records.get(s).filename;
const rlinks=src(['Columbia 本人组页','rb'],['Yale 化学系讲座履历','ry'],['旧组目录','ro']);
const rph='本人履历具名 Robert Silbey 指导 MIT 1997 年化学博士研究。';
const rpd='Columbia 本人履历明确 1997–1999 年 Utah NIH Postdoctoral Fellow 期间由 Gregory A. Voth 指导。Yale 讲座履历刊有相同表述。可信度高。';
updateEdge(r,'David R. Reichman','师承人物 - Gregory A. Voth','Gregory A. Voth','博士后阶段研究师长','博士后阶段受指导者','博士后导师','博士后研究者',rpd,rlinks);
rewrite(pf(r),x=>x.startsWith(boundary),()=>boundary+rph+rpd+' 学位签署页和当期博后任用原件仍待补档。 '+rlinks+' · '+src(['Chicago 化学系专题','rv']));
cell(r,3,'Gregory A. Voth（1997–1999 Utah NIH 博士后导师）');
rewrite(sl(r),x=>x.startsWith('| [['+records.get(r).filename+'|'),x=>x.slice(0,x.lastIndexOf(' | ',x.length-4))+' | '+rlinks+' · '+src(['Chicago 化学系专题','rv'])+' |');
const ra=audit(r,[
 a('identity','Columbia 本人履历列 MIT 1997 化学博士、Utah 1997–1999 NIH 博后和 Columbia 现任。',['rb','ry'],'confirmed'),
 a('affiliation','Columbia 化学系 Centennial Professor of Chemistry。',['rb'],'confirmed'),
 a('research','凝聚态化学物理、统计力学及玻璃低温动力学，近期讲座核低温玻璃隧穿缺陷。',['rb','ry'],'confirmed'),
 a('phd',rph,['rb','ry'],'confirmed_advisor'),a('postdoc',rpd,['rb','ry'],'confirmed_advisor')
],'等 MIT 档案退避期后补学位签署页，另查当期 Utah NIH fellowship 原任用记录。');
relation(r,ra,'postdoc','师承人物 - Gregory A. Voth','advisor',rpd,ids('rb','ry'),'voth');

const glinks=src(['Peter Pershan 本人回忆','gp'],['Brookhaven 学位与论文题名','gb'],['Gang 本人 2024 CV','gc'],['本人早期 CV','go'],['BNL 人员报道','gn']);
const gph='Pershan 本人说明 Deutsch 送其博士生 Gang 来 Harvard 做博士后，并具名 Gang 在 Bar-Ilan 由 Deutsch 指导获博士。Gang 本人 CV 列 2000 年博士，Brookhaven 分列博士论文 Surface Ordering in Chain Molecules 与硕士论文。可信度高。';
const gpd='Harvard 博后阶段研究师长为 Peter S. Pershan，回忆与本人 CV 所记开始年份分别为 1999 和 2000，结束年份均为 2002。Brookhaven 2002–2004 Goldhaber 博士后导师为 Benjamin M. Ocko。';
updateEdge(g,'Oleg Gang','师承人物 - Moshe Deutsch','Moshe Deutsch','博士阶段研究师长','博士阶段研究成员','博士导师','博士生',gph,glinks);
rewrite(pf(g),x=>x.startsWith(boundary),()=>boundary+gph+' '+gpd+' Harvard 正式指导职衔待核，Bar-Ilan 学位签署页待补。 '+glinks+' · '+src(['Ocko 官方履历','ocko'],['Brookhaven Bulletin','bnl']));
cell(g,2,'Moshe Deutsch（Bar-Ilan 2000 博士导师；论文 Surface Ordering in Chain Molecules）');
schoolWith(g,src(['Pershan 当事人记述博士阶段','gp'],['2000 博士与 2000–2002 Harvard 本人 CV','gc']));
const ga=audit(g,[
 a('identity','Bar-Ilan 博士、Harvard 博后、BNL Goldhaber 与后续任职的时间及领域交叉一致，Harvard 起年存 1999／2000 差异。',['gp','gb','gc'],'confirmed'),
 a('affiliation','Columbia 化学工程系、应用物理与应用数学系，兼 Brookhaven CFN。',['gb','gc'],'confirmed'),
 a('research','软凝聚态、DNA 可编程自组装、纳米材料。',['gb','gc'],'confirmed'),
 a('phd',gph,['gp','gb','gc'],'confirmed_advisor'),a('postdoc',gpd,['gp','gc','ocko','bnl'],'confirmed_advisor')
],'补 Bar-Ilan 学位签署原卷；追 Harvard fellowship 正式指导称谓与 1999／2000 起年差异。');
relation(g,ga,'phd','师承人物 - Moshe Deutsch','advisor',gph,ids('gp','gb','gc'),'deutsch');

const ilinks=src(['UC San Diego 2014 CMRR Research Review 第 10 页','cr'],['Cornell 院系履历','cf']);
const ipd='UC San Diego 同期会议手册把物理系博士后 Andrej Singer 的 Advisor 具名为 Oleg Shpyrko。Cornell 院系履历核博士后阶段及其后任职。可信度高。';
updateEdge(i,'Andrej Singer',shpyrko,'Oleg Shpyrko','博士后研究师长','博士后阶段研究者','博士后导师','博士后研究者',ipd,ilinks);
rewrite(pf(i),x=>x.startsWith(boundary),()=>boundary+'Cornell 履历列 2012 Hamburg 博士研究由 Edgar Weckert 与 Ivan Vartanyants 指导。DESY 列学位论文及 2013 年出版报告，论文文件跳转仍不可读，正式论文指导分工待核。'+ipd+' '+ilinks+' · '+src(['DESY 原论文书目','ds']));
cell(i,3,'Oleg Shpyrko（UC San Diego 博士后导师）');
rewrite(sl(i),x=>x.startsWith('| [['+records.get(i).filename+'|'),x=>x.slice(0,x.lastIndexOf(' | ',x.length-4))+' | '+ilinks+' · '+src(['DESY 论文目录','ds'])+' 论文正文暂不可读，博士指导分工待核。 |');
const ia=audit(i,[
 a('identity','UCSD 2014 CMRR 活动和 Cornell 履历的同名、阶段、方向相符。',['cr','cf'],'confirmed'),
 a('affiliation','Cornell 材料科学与工程系，保留已核的物理学研究生领域。',['cf'],'confirmed'),
 a('research','原位相干 X 射线成像和衍射，研究能源纳米材料及量子材料。',['cf'],'confirmed'),
 a('phd','Cornell 记 2012 年 Hamburg 博士研究由 Weckert 和 Vartanyants 指导。DESY 书目确认论文；下载跳转未取正文，待分辨正式指导分工。',['cf','ds'],'group_or_candidate'),
 a('postdoc',ipd,['cr','cf'],'confirmed_advisor')
],'从 Hamburg 院系学位档与 DESY 论文电子原件追查签署页或本人致谢，核两名博士阶段指导者的具体分工。');
relation(i,ia,'postdoc',shpyrko,'advisor',ipd,ids('cr','cf'),'shpyrko');

const slinks=src(['Shpyrko 本人 CV 第 1 页','cv'],['UC San Diego 物理系','ucsd']);
const sp='本人 CV 具名 Harvard 2004 年物理博士的 PhD Advisor 为 Peter S. Pershan。';
const spd='本人 CV 分列 Harvard 2004–2005 博士后 Advisor Peter S. Pershan，以及 Argonne 2005–2007 CNM Distinguished Postdoctoral Fellow 的 Advisor Eric D. Isaacs。';
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+sp+spd+' 当前 UC San Diego 物理系教授及系主任，研究凝聚态材料的相干 X 射线散射及纳米尺度动力学。 '+slinks);
cell(s,2,'Peter S. Pershan（Harvard 2004 物理博士导师）');
cell(s,3,'Peter S. Pershan（Harvard 2004–2005 博士后导师）；Eric D. Isaacs（Argonne 2005–2007 博士后导师）');
schoolWith(s,src(['UC San Diego 物理系现任与方向','ucsd']));
audit(s,[
 a('identity','本人 CV 的早期任职、研究方向与现任物理系原档相符。',['cv','ucsd'],'confirmed'),
 a('affiliation','UC San Diego 物理系教授、系主任。',['ucsd'],'confirmed'),
 a('research','凝聚态实验，发展相干 X 射线散射研究软物质和电子、磁性材料的纳米尺度结构与动力学。',['ucsd'],'confirmed'),
 a('phd',sp,['cv'],'confirmed_advisor'),a('postdoc',spd,['cv'],'confirmed_advisor')
],'两段博后及博士导师均有本人明确履历。后续随院系任职增量更新。');
audits[audits.length-1].followup_required=false;

const kName='Roopali Kukreja', stohr='师承人物 - Joachim Stöhr', linden='人员 - Stanford - Aaron Lindenberg - b85b2726';
const durr='师承人物 - Hermann Dürr', dejong='师承人物 - Sanne de Jong';
const fullerton='人员 - UC San Diego - Eric Fullerton - 48e0d021';
const ktlinks=src(['Stanford 2014 论文原文第 3 页','kt'],['Stanford 永久书目','kp'],['SLAC 论文指导报道','ks']);
const kalinks=src(['Stanford 2014 论文原文第 3 页','kt'],['Stanford PULSE 人员档','al']);
const kdlinks=src(['Stanford 2014 论文原文致谢第 6 页','kt'],['Uppsala 院系','hd'],['SLAC 历史组档','slac']);
const kjlinks=src(['Stanford 2014 论文原文致谢第 6 页','kt'],['SLAC 历史组档','slac']);
const kplinks=src(['UC San Diego CMRR 2014 秋季原报第 4 页','ku'],['本人 2024 CV 第 1 页','kc'],['Colorado State 讲座履历','ko']);
const kph='2014 Stanford 材料科学与工程博士。论文第 3 页签署栏将 Joachim Stöhr 列为 Primary Adviser，Aaron Lindenberg 列为 Co-Adviser。可信度高。';
const kdh='本人论文致谢具名 Hermann Dürr 为 co-advisor。按博士阶段研究师长标注，签署页的 Co-Adviser 另署 Aaron Lindenberg。';
const ksj='本人论文致谢具名 Sanne de Jong 为 magnetite 项目的日常指导者，按博士阶段研究师长标注。';
const kpd='UC San Diego CMRR 同期任用通讯明确 Fullerton 自 2014-10-15 监督其博士后研究，并具名 Fullerton 与 Shpyrko 共同监督。本人 CV 列 CMRR／物理系博后 2014–2016。可信度高。';
mentor(durr,'Hermann Dürr','Uppsala University 物理与天文学系教授，研究超快凝聚态。',src(['Uppsala 人员档','hd']));
mentor(dejong,'Sanne de Jong','SLAC Stöhr–Dürr 课题组历史档所列 Research Associate，参与磁铁矿超快研究。',src(['SLAC 历史组档','slac']));
updateEdge(k,kName,stohr,'Joachim Stöhr','博士阶段研究师长','博士阶段受指导者','博士导师','博士生',kph,ktlinks);
edge(k,kName,linden,'Aaron Lindenberg','博士导师','博士生',kph,kalinks);
edge(k,kName,durr,'Hermann Dürr','博士阶段研究师长','博士阶段受指导者',kdh,kdlinks);
edge(k,kName,dejong,'Sanne de Jong','博士阶段研究师长','博士阶段受指导者',ksj,kjlinks);
updateEdge(k,kName,fullerton,'Eric Fullerton','博士后阶段研究师长','博士后阶段研究人员','博士后导师','博士后研究者',kpd,kplinks);
updateEdge(k,kName,shpyrko,'Oleg Shpyrko','博士后阶段研究师长','博士后阶段研究人员','博士后导师','博士后研究者',kpd,kplinks);
rewrite(pf(k),x=>x.startsWith('- 博士关系证据：'),()=>'- 博士关系证据：'+kph+' '+kdh+' '+ksj+' '+ktlinks);
rewrite(pf(k),x=>x.startsWith('- 博士后关系证据：'),()=>'- 博士后关系证据：'+kpd+' '+kplinks);
rewrite(pf(k),x=>x.startsWith(boundary),()=>boundary+'博士阶段依论文签署页与致谢记录个人角色。博士后阶段依 UC San Diego 当期任用通讯与本人 CV 记共同指导。现任 UC Davis 材料科学与工程系副教授，研究磁性及电子材料超快动力学。 '+src(['博士论文','kt'],['CMRR 2014 通讯','ku'],['UC Davis 院系','kd']));
cell(k,2,'Joachim Stöhr（首席博士导师）；Aaron Lindenberg（共同博士导师）；Hermann Dürr、Sanne de Jong（博士阶段研究师长）');
cell(k,3,'Eric Fullerton、Oleg Shpyrko（UC San Diego 2014–2016 博士后导师）');
schoolWith(k,ktlinks+' · '+kplinks);
const ka=audit(k,[
 a('identity','2014 Stanford 学位论文、UC San Diego 任用通讯与本人 2024 CV 的姓名、学位和项目对上。',['kt','ku','kc','kd'],'confirmed'),
 a('affiliation','UC Davis 材料科学与工程系副教授。',['kd','kc'],'confirmed'),
 a('research','磁性和电子材料的超快调控，时间分辨 X 射线与薄膜。',['kd'],'confirmed'),
 a('phd',kph+' '+kdh+' '+ksj,['kt','kp','ks','al','hd','slac'],'confirmed_advisor'),
 a('postdoc',kpd,['ku','kc','ko'],'confirmed_advisor')
],'两阶段与个人指导角色已核。后续随院系任职增量更新。');
audits[audits.length-1].followup_required=false;
relation(k,ka,'phd',stohr,'advisor',kph,ids('kt','ks'),'stohr');
relation(k,ka,'phd',linden,'advisor',kph,ids('kt','al'),'lindenberg');
relation(k,ka,'phd',durr,'stage_mentor',kdh,ids('kt','hd','slac'),'durr');
relation(k,ka,'phd',dejong,'stage_mentor',ksj,ids('kt','slac'),'dejong');
relation(k,ka,'postdoc',fullerton,'advisor',kpd,ids('ku','kc','ko'),'fullerton');
relation(k,ka,'postdoc',shpyrko,'advisor',kpd,ids('ku','kc','ko'),'shpyrko');

const pages=[
 [r,'rb','Columbia personal bio names Robert Silbey in MIT doctoral training and Greg Voth as director of Utah NIH postdoctoral work.','两阶段具名指导，核 Columbia 化学系。'],
 [r,'ry','Yale seminar publishes the same training dates and reports on low-temperature glass dynamics.','复核分段履历及理论玻璃研究。'],
 [g,'gp','Pershan identifies Gang as Deutsch’s own graduate student and describes the Bar-Ilan doctorate before Harvard postdoctoral work.','确认博士导师，保留 Harvard 博后起年差异。'],
 [g,'gc','CV page 1: 2000 Bar-Ilan PhD, 2000–2002 Harvard, 2002–2004 Goldhaber at BNL; Columbia chemical engineering and APAM from 2016.','核身份、阶段及任职。'],
 [g,'gb','Brookhaven profile lists distinct MS and PhD theses and both Columbia appointments.','确认博士题名和方向。'],
 [i,'cr','2014 Fall CMRR booklet printed page 10 lists Singer as postdoc and Oleg Shpyrko as Advisor.','同期机构原文确认博后导师。'],
 [i,'cf','Cornell profile gives Hamburg physics PhD in 2012, postdoctoral work at UCSD and Cornell materials appointment.','核教育、院系及方向。'],
 [i,'ds','DESY list includes Andrej Singer thesis DESY-THESIS-2013-023, published June 2013.','报告出版与 2012 授予分别记。'],
 [s,'cv','Page 1 names Pershan as 2004 PhD advisor and 2004–2005 postdoctoral advisor; Isaacs as Argonne postdoctoral advisor in 2005–2007.','明确博士与两段博后。'],
 [s,'ucsd','UCSD Physics profile lists department chair and professor, coherent X-ray scattering on condensed matter.','核现任及研究。'],
 [k,'kt','PDF page 3: Joachim Stohr, Primary Adviser; Aaron Lindenberg, Co-Adviser. Page 6 acknowledges Hermann Dürr and project mentor Sanne de Jong. SHA-256 d1e0ec68988578db4d413276bfbb4988ab0b52db04a4b2ebf8e8fb931280086e.','本地原件文本层核论文签署与致谢。'],
 [k,'ku','Fall 2014, issue 42, p. 4. CMRR reports postdoctoral supervision by Eric Fullerton and Oleg Shpyrko.','核博后共同指导。'],
 [k,'kc','CV page 1 records 2014 Stanford PhD, 2014–2016 UCSD CMRR/Physics postdoc and UC Davis Associate Professor since 2022.','核学位与任职时间。'],
 [k,'kd','UC Davis Materials Science and Engineering department profiles Kukreja’s ultrafast X-ray research and associate professor position.','核现任与方向。'],
 [k,'al','Stanford PULSE lists Aaron Lindenberg, professor of Materials Science and Engineering and Photon Science.','核共同博士导师身份。'],
 [k,'hd','Uppsala lists Hermann Dürr as professor in Physics and Astronomy and describes ultrafast condensed matter research.','核论文所谢研究师长身份。'],
 [k,'slac','SLAC group archive lists both Kukreja and former research associate Sanne de Jong.','结合论文致谢核项目指导者身份。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:i,url:u.df,error:'DESY original download link returned cache miss; catalog was read, no thesis text acquired.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0407_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0407_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0407_学位与博后原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
