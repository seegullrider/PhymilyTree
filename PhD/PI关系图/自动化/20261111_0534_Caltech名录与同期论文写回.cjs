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
 orig.audit_id='pi_archive_20261111_0534_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0534_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"cal":"https://www.its.caltech.edu/~ccediv/genlist.pdf#page=4","news":"https://news.mit.edu/2016/faculty-profile-nuh-gedik-0411","mit":"https://physics.mit.edu/faculty/nuh-gedik/","thesis":"https://escholarship.org/content/qt13n8h3kq/qt13n8h3kq.pdf","acs":"https://cen.acs.org/articles/85/i52/Niche-Time.html","utor":"https://www.utoronto.ca/news/electrical-engineer-susanna-thon-harnesses-power-solar-energy","jhu":"https://engineering.jhu.edu/ece/faculty/susanna-thon/","sargent":"https://light.northwestern.edu/alumni/susanna-thon/","leiden":"https://qowiki.physics.leidenuniv.nl/_media/website/master-jeroen-zonneveld.pdf","tree":"https://academictree-staging.thetransmitter.org/physics/peopleinfo.php?pid=190598","lab":"https://web.physics.ucsb.edu/~quopt/bouwmeester.html","ast":"https://www.duffield.cornell.edu/people/dieter-ast/","paper":"https://woodall.ece.ucdavis.edu/wp-content/uploads/sites/84/2016/02/fitzgerald1988a.pdf#page=2","paper89":"https://research.engineering.ucdavis.edu/woodall/wp-content/uploads/sites/84/2016/02/fitzgerald1989.pdf","fitz":"https://mrl.mit.edu/node/346","report":"https://web.mit.edu/sma/about/overview/pdf/annual_report_pg50-80.pdf"};
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




const g='aaf9c934', z='师承人物 - Ahmed Zewail';
const gLinks=src(['Caltech 2006 年 10 月名录第 4 页','cal'],['MIT 本人采访','news'],['MIT 物理系','mit'],['ACS 同期报道','acs']);
const gPost='Caltech 化学与化工部 2006 年 10 月同期名录将 Gedik 列为 Chem pds，Advisor/Supervisor 栏具名 Zewail。MIT 的本人采访记 2004 年 Berkeley 博士毕业后在 Caltech 由 Ahmed Zewail 指导四年，2008 年入职 MIT。关系可信度高。';
updateEdge(g,'Nuh Gedik',z,'Ahmed Zewail','博士后课题组负责人','博士后课题组成员','博士后导师','博士后研究者',gPost,gLinks);
rewrite(pf(g),x=>x.startsWith(boundary),()=>boundary+'Berkeley 博士导师由既有论文证据支持。Caltech 博士后导师由同期名录和 MIT 本人采访确认。 '+gLinks);
cell(g,3,'Ahmed Zewail（Caltech 博士后导师）');
schoolWith(g,gLinks);
const ga=audit(g,[
 a('identity','Caltech 2006 年名录及 MIT 物理系教育任用记录与本人采访一致。',['cal','mit','news'],'confirmed'),
 a('affiliation','MIT 物理系 Donner Professor of Physics。',['mit'],'confirmed'),
 a('research','以时间分辨光学及电子光谱探查量子材料，包括高温超导体和层状材料。',['mit'],'confirmed'),
 a('phd','沿用已归档 Berkeley 本人学位论文证据，Orenstein 列为委员会主席并在致谢被本人称为研究导师。MIT 人物档独立核实 2004 Berkeley PhD，学位档仍在退避。',['thesis','mit'],'confirmed_advisor'),
 a('postdoc',gPost,['cal','news','mit','acs'],'confirmed_advisor')
],'两阶段均有具名来源。学位库退避结束后复取已归档的 Berkeley 论文供增量核对。');
audits.at(-1).followup_required=false;
relation(g,ga,'postdoc',z,'advisor',gPost,ids('cal','news','mit','acs'),'zewail');
const t='0015f853', s='人员 - Northwestern - Ted Sargent - c2879202', b='人员 - UC Santa Barbara - Dirk Bouwmeester - 0535ff74';
const tPost='Toronto 的本人访谈核在 Sargent 组开展胶体量子点太阳电池研究。该组正式校友档列 2011–2013 年 Postdoctoral Fellow。组属可信度高，个人指导职衔待核。';
const tPhd='Leiden 同期学位论文参考文献第 23 项给出 S. M. Thon 的 2010 年 UCSB 博士论文全题 Quantum Optics in Photonic Crystal Cavities，致谢也记其制作光子晶体器件。第三方谱系条目将 Bouwmeester 列为指导线索，UCSB 论文签署页待核。候选可信度低。';
const tPostLinks=src(['Toronto 本人访谈','utor'],['Sargent 组校友档','sargent']);
const tPhdLinks=src(['Leiden 同期论文参考文献第 23 项','leiden'],['第三方谱系线索','tree'],['JHU 院系','jhu']);
updateEdge(t,'Susanna Thon',s,'Ted Sargent','博士后课题组','博士后课题组成员','博士后课题组','博士后课题组成员',tPost,tPostLinks);
const tf=who(t,'Susanna Thon');
const candidateSuffix=' '+tPhd+' '+src(['Leiden 同期论文','leiden']);
pl(t,'- 博士导师候选：',tPhd+' '+src(['Leiden 同期论文','leiden']));
line(index,x=>x.startsWith('- '+tf+' → 博士导师候选：')&&x.includes(b),candidateSuffix);
line(mf(b),x=>x.includes(records.get(t).filename)&&x.includes('候选'),candidateSuffix);
rewrite(pf(t),x=>x.startsWith(boundary),()=>boundary+'UCSB 博士论文已定位全题，签署页及博士导师待核。Toronto 2011–2013 博士后组属获本人访谈及组档交叉支持，具名正式指导待核。 '+tPhdLinks+' · '+tPostLinks);
cell(t,2,'Dirk Bouwmeester（低可信候选，已定位论文全题，签署页待核）');
schoolWith(t,tPhdLinks+' · '+tPostLinks);
const ta=audit(t,[
 a('identity','JHU 系页及 Toronto 本人访谈核 UCSB 物理学位、Toronto 博后、2013 JHU 任用。',['jhu','utor','sargent'],'confirmed'),
 a('affiliation','JHU 电气与计算机工程系副教授。',['jhu'],'confirmed'),
 a('research','纳米光子及可规模化工艺，胶体量子点太阳电池和光电子器件。',['jhu','utor'],'confirmed'),
 a('phd',tPhd,['leiden','tree','jhu'],'group_or_candidate'),
 a('postdoc',tPost,['utor','sargent','jhu'],'group_or_candidate')
],'用论文全题及 Susanna M. Thon 查 UCSB 2010 年馆藏或 ProQuest 原卷。另查 Toronto 博后任用原档。');
relation(t,ta,'phd',b,'candidate',tPhd,ids('leiden','tree','jhu'),'bouwmeester');
relation(t,ta,'postdoc',s,'group_leader',tPost,ids('utor','sargent','jhu'),'sargent');
const f='8d685b12', d='师承人物 - Dieter Ast';
const fPhd='1988 年论文的 Cornell 材料系署名仅列 E. A. Fitzgerald 与 D. G. Ast，1989 年同主题论文再次列两人为同系作者。Cornell 院系确认 Dieter Ast 的材料系身份，MIT 履历给出 Fitzgerald 1989 Cornell 博士。依据同期同系合作列低可信候选，正式指导待学位原档。';
const fLinks=src(['1988 年论文原件第 2 页','paper'],['1989 年论文原件','paper89'],['Cornell 院系','ast'],['MIT 履历','fitz']);
mentor(d,'Dieter Ast','Cornell 材料科学与工程系荣休教授，研究薄膜电子与电子材料。',src(['Cornell 院系','ast']));
edge(f,'Eugene A. Fitzgerald',d,'Dieter Ast','博士导师候选','博士阶段学生候选',fPhd,fLinks);
pl(f,boundary,'同期 Cornell 合作线索指向 Dieter Ast，已列低可信博士候选。 '+fLinks);
cell(f,2,'Dieter Ast（Cornell 博士阶段低可信候选）');
schoolWith(f,fLinks);
const fa=audit(f,[
 a('identity','MIT MRL 人物档与 MIT–Singapore Alliance 年报核 Cornell 1989 博士及半导体外延领域，历史 1988／1989 差异在人物页保留。',['fitz','report','paper89'],'confirmed'),
 a('affiliation','MIT 材料科学与工程教授。',['fitz','report'],'confirmed'),
 a('research','晶格失配外延、应变硅和半导体界面缺陷。',['fitz','report','paper89'],'confirmed'),
 a('phd',fPhd,['paper','paper89','ast','fitz','report'],'group_or_candidate'),
 a('postdoc','MIT 履历列 AT&T Bell Labs 早期职业经历；1989 年论文作者附注将 Bell Labs 标为现址。任用性质及具名指导待核。',['fitz','paper89'],'unresolved')
],'按 Eugene A. Fitzgerald 与 1988–1989 区间追 Cornell 论文题名、签署页及 Bell Labs 任用类别。');
relation(f,fa,'phd',d,'candidate',fPhd,ids('paper','paper89','ast','fitz'),'ast');
const pages=[
 [g,'cal','October 1, 2006 division directory, page 4: Gedik, Nuh; Chem; pds; Zewail in Advisor/Supervisor column.','核 Caltech 博后具名指导。'],
 [g,'news','MIT interview says Gedik spent four years as a Caltech postdoc working under Ahmed Zewail after completing his doctorate at Berkeley in 2004.','独立核 Caltech 博后指导和阶段。'],
 [g,'mit','MIT Physics lists a 2004 Berkeley PhD, Caltech postdoctoral work until January 2008 and current physics appointment.','核院系、时间和研究方向。'],
 [t,'leiden','Reference 23 names S. M. Thon’s 2010 UCSB doctoral thesis Quantum Optics in Photonic Crystal Cavities.','定位论文全题，仍需本人签署页。'],
 [t,'utor','Thon discusses joining Ted Sargent’s group at Toronto to work in solar energy and starting at JHU in late 2013.','博士后组属获本人核实。'],
 [t,'sargent','Group alumni record lists 2011–2013, Postdoctoral Fellow.','核 Toronto 博士后组属与阶段。'],
 [t,'jhu','Johns Hopkins ECE lists Physics PhD at UC Santa Barbara and prior Toronto postdoctoral work.','核院系、研究方向和教育经历。'],
 [f,'paper','Article lists E. A. Fitzgerald and D. G. Ast under Cornell Materials Science and Engineering, with other authors at IBM.','同期合著提供博士候选线索。'],
 [f,'paper89','1989 paper lists Fitzgerald and Ast with Cornell and gives Fitzgerald’s present address as AT&T Bell Laboratories.','核实同期合作及后续单位线索。'],
 [f,'ast','Cornell Materials Science and Engineering profile lists Dieter Ast as Emeritus.','核候选人身份。'],
 [f,'fitz','MIT MRL records 1989 Cornell PhD and early experience at AT&T Bell Labs.','博士年份和任职时间线。'],
 [f,'report','MIT–Singapore Alliance annual report lists a 1989 Cornell doctorate in Materials Science and Engineering.','另一来源核学位时间和领域。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:t,url:u.lab,error:'原 UCSB 课题组内页以 Flash 为载体，本轮可访问 HTML 未返回可读组员内容。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0534_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0534_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0534_Caltech名录与同期论文回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
