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
 orig.audit_id='pi_archive_20261111_0945_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0945_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const m='b1363da8', c='37f0ccb2', jo='c9a479ce';
const cm='https://mse.engineering.cmu.edu/directory/bios/skowronski-marek.html';
const n1='https://ntrs.nasa.gov/api/citations/19850022622/downloads/19850022622.pdf';
const n2='https://ntrs.nasa.gov/api/citations/19860018524/downloads/19860018524.pdf?attachment=true';
const aps='https://journals.aps.org/prb/abstract/10.1103/PhysRevB.32.4264';
const gat='https://cdn.libraries.mit.edu/dissemination/diponline/AC0069_NewReleases/NewsRelease_1960/AC0069_1962/AC0069_196203_001.pdf';
const au='https://thesis.caltech.edu/10694/1/Au_YS_2006.pdf';
const chap='https://chapmanlabs.gatech.edu/papers/Chapman%201996%20Kimble%20single%20atom%20cqed%20optlet96.pdf';
const gtp='https://physics.gatech.edu/user/michael-chapman';
const kd='师承人物 - H. Jeff Kimble';
const k=wiki(kd,'H. Jeff Kimble');
const cme=who(c,'Michael S. Chapman');
const advisorIndex=path.join(root,'师承候选线索索引.md');
const cmu=y=>'https://www.cmu.edu/engineering/materials/graduate/recent_doctoral_dissertations/'+y+'.html';
const mproof='CMU 履历确认 Warsaw 1982 年博士和随后 MIT 博士后。1984–1986 MIT 提交 NASA 的 GaAs 项目年度报告署 Harry C. Gatos、Jacek Lagowski，并将 Skowronski 合著工作列作项目成果。1985 APS 原刊列三人同署 MIT 物理系。按同期项目线索保留两位为低可信候选，具名指导待任用原件。';
const ml=source('CMU 本人档',cm)+' · '+source('MIT 1984–1985 年报',n1)+' · '+source('MIT 1985–1986 年报',n2)+' · '+source('APS 原刊',aps);
const ma=audit(m,[['postdoc',mproof,[cm,n1,n2,aps],'group_or_candidate']],
 '查 MIT 当期教职或博士后人员档以明确组属和个人指导；Warsaw 1982 论文原件待查。');
function append(file,entry){
 const t=get(file);
 if(!t.includes(entry)){
  const nl=t.includes('\r\n')?'\r\n':'\n';
  updates.set(file,t.trimEnd()+nl+entry+nl);
 }
}
for(const [name,bio,urls,slug] of [
 ['Harry C. Gatos','MIT 原任命文件列冶金与电气工程双聘；参与 GaAs 缺陷与晶体生长研究。 '+source('MIT 任命原档',gat),[cm,n1,n2,aps,gat],'gatos'],
 ['Jacek Lagowski','MIT 材料系 GaAs 项目年度报告的具名提交者。 '+source('MIT／NASA 原年报',n2),[cm,n1,n2,aps],'lagowski']
]){
 const stem='师承人物 - '+name;
 const file=mf(stem);
 if(!fs.existsSync(file))updates.set(file,'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n');
 const forward='博士后导师候选：'+wiki(stem,name)+'。'+mproof+' '+ml;
 insertAfter(pf(m),'## 师承','- '+forward);
 insertAfter(file,'## 师承','- 博士后研究者候选（待核）：'+who(m,'Marek Skowronski')+'。'+mproof+' '+ml);
 const entry='- '+who(m,'Marek Skowronski')+' → '+forward;
 append(index,entry);
 append(advisorIndex,entry);
 relation(m,ma,'postdoc',stem,'candidate',mproof,urls,slug);
}
school(m,'MIT 博后，导师待核','MIT 博后，Harry C. Gatos、Jacek Lagowski（博士后导师候选）');
schoolSource(m,' · '+source('MIT／NASA 当期年报',n2)+' · '+source('APS 同期论文',aps));
const cproof='Caltech 馆藏 Au 学位原卷第 2.1 节明确称 Michael Chapman 在 Kimble 组任博士后时制作腔镜支架，并在同节提及其 Georgia Tech 研究组。1996 同期原刊列 Chapman 与 Kimble 同署 Caltech 并记 Chapman 获 Millikan Fellowship。课题组归属可信度高，正式导师称谓待任用或本人履历。';
const cp='- 博士后课题组负责人：'+k+'。'+cproof+' '+source('Caltech 学位原卷',au)+' · '+source('1996 同期原刊',chap);
rewrite(pf(c),x=>x.startsWith('- 博士后候选关系：'+k)||x.startsWith('- 博士后课题组负责人：'+k),()=>cp);
rewrite(pf(c),x=>x.startsWith('- 博士后经历：'),()=>'- 博士后经历：Caltech Kimble 组。1996 论文记 Millikan Fellowship 支持，任用起止待查。 '+source('Caltech 学位原卷',au)+' · '+source('1996 同期原刊',chap));
rewrite(pf(c),x=>x.startsWith(boundary),()=>boundary+'MIT 学位库仍按退避窗口，正式博士导师待签署页。Caltech Kimble 博后组属由学位原卷核实，个人正式指导及任用起止待查。');
rewrite(mf(kd),x=>x.includes(cme)&&(x.startsWith('- 博士后研究者候选')||x.startsWith('- 博士后课题组成员')),()=>'- 博士后课题组成员：'+cme+'。'+cproof+' '+source('Caltech 学位原卷',au)+' · '+source('1996 同期原刊',chap));
rewrite(index,x=>x.startsWith('- '+cme+' → 博士后')&&x.includes(k),()=>'- '+cme+' → '+cp.slice(2));
school(c,'H. Jeff Kimble（博士后候选关系）','H. Jeff Kimble（Caltech 博士后课题组负责人）');
schoolSource(c,' · '+source('Caltech 博士学位原卷',au));
const ca=audit(c,[['identity','Georgia Tech 物理系明确 MIT 1995 博士。CMU 2016 论文目录同名 Michael Chapman 的材料相变论文及年份均与此人轨迹不符，排除同名。',[gtp,cmu(2016)],'confirmed'],
 ['postdoc',cproof,[au,chap],'group_or_candidate']],
 'MIT 1995 博士论文签署页、Caltech 个人博士后指导及起止待查。');
relation(c,ca,'postdoc',kd,'group_leader',cproof,[au,chap],'kimble');
const identities=[
 ['020a5d71','Fang Liu','https://flgroup.emorychem.science/wp-content/uploads/2025/07/CV-FangLiu-July2025.pdf',2012,'Stanford 化学博士（2017），本人 2025 CV 与 CMU 2012 材料学位记录的 Fang Liu 学位和时间不同。'],
 ['ae019d16','Fang Liu','https://chemistry.stanford.edu/people/fang-liu-0',2012,'Stanford 化学系列 Penn 化学博士（2015），与 CMU 2012 材料学位记录的 Fang Liu 学位和时间不同。'],
 ['b9b5a5fe','Wei Wu','https://viterbi.usc.edu/directory/cv/wu_wei_cv.pdf',2014,'USC 托管本人 CV 列 Princeton 电气工程博士（2003），与 CMU 2014 材料学位记录的 Wei Wu 学位和时间不同。'],
 ['bed8f3b6','Han Wang','https://ieeenano.org/2019/ntc-2019-award-winners/',2020,'IEEE Nanotechnology Council 获奖原档列 USC ECE Han Wang 为 MIT 2013 博士，2013–2014 任职 IBM。CMU 2020 论文目录的电池研究同名者学位和经历不同。']
];
for(const [id,name,url,year,proof] of identities){
 const previous=JSON.parse(last.get(id).details_json);
 const note=previous.aspects.identity.note;
 audit(id,[['identity',note.includes(proof)?note:note+' '+proof,[url,cmu(year)],'confirmed']],previous.next_step);
 audits.at(-1).followup_required=previous.followup_required;
 const line='- 同名排除（CMU 材料博士名录）：'+proof+' '+source('本人或正式机构档',url)+' · '+source('CMU 论文名录',cmu(year));
 insertAfter(pf(id),'## 师承',line);
 schoolSource(id,' · '+source('CMU 同名排除',cmu(year)));
}
const ju='https://faculty.sites.iastate.edu/canfield/files/inline-files/Jo_iastate_0097E_17941.pdf';
const pages=[
 {record_id:m,url:n1,raw:'MIT’s 1984–1985 NASA report is signed by Harry C. Gatos and Jacek Lagowski and lists research co-authored by Skowronski.',excerpt:'两位博后导师候选的当期项目来源。'},
 {record_id:m,url:n2,raw:'MIT’s 1985–1986 NASA report is signed by Gatos and Lagowski and lists the Skowronski papers on GaAs EL2 among the project outputs.',excerpt:'交叉核原项目和年份。'},
 {record_id:m,url:aps,raw:'APS lists Skowronski, Lagowski and Gatos on the 1985 GaAs EL2 paper, with MIT Physics affiliation.',excerpt:'核在 MIT 同期合作。'},
 {record_id:c,url:au,raw:'Caltech’s Au thesis, chapter 2, identifies Michael Chapman as a postdoc in the Kimble group when he built the mirror mount, and mentions his group at Georgia Tech.',excerpt:'Caltech Kimble 博后组属具名证据。'},
 {record_id:jo,url:ju,error:'Iowa State Canfield group thesis link was not accessible via the web tool in this attempt.'},
 {record_id:'bed8f3b6',url:identities[3][2],raw:'IEEE 2019 award biography lists the MIT PhD in 2013 and IBM nanoscale science group in 2013–2014.',excerpt:'核 USC Han Wang 身份、博士年代及 IBM 时段。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0945_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0945_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0945_CMU与Caltech原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
