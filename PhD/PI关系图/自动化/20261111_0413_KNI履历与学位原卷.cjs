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
 orig.audit_id='pi_archive_20261111_0413_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0413_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"wcv":"https://www.minnich.caltech.edu/_files/ugd/971bdd_78060b95f3c04e4b92fcc3cb307d7e79.pdf","ww":"https://www.the-wang-lab.com/members","wd":"https://pratt.duke.edu/people/haozhe-wang/","wc":"https://commencement.mit.edu/sites/default/files/MIT.Commencement.Program2021.pdf","wm":"https://dspace.mit.edu/entities/publication/5798f558-aaab-4395-b337-05a3546e6d04","wo":"https://www.minnich.caltech.edu/archived-news","wk":"https://www.kni.caltech.edu/people/postdoc-fellows/postdoc-alumni","wf":"https://necstlab.mit.edu/alumni/","han":"https://physics.anu.edu.au/research/qst/qoptics/_files/2012hosseini.pdf","hn":"https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/hosseini-mahdi.html","hm":"https://eapg.mit.edu/wp-content/uploads/2018/01/PhysRevLett.116.033602_Nondestrcutive_Photon_Detection.pdf","hb":"https://studylib.net/doc/11244448/quantum-state-reconstruction--and-tomography-aug--15","tc":"https://www.repository.cam.ac.uk/items/f7ac6291-da13-40f1-a263-7128aae53c2a","tcd":"https://www.repository.cam.ac.uk/bitstreams/6a6f2c24-d2b7-43bf-b6bc-acaf2d0d9ea2/download","tjd":"https://curk.wse.jhu.edu/mypapers/2016thesis_online.pdf","tp":"https://eprints.whiterose.ac.uk/197661/7/dubacheva-et-al-2023-determinants-of-superselectivity-practical-concepts-for-application-in-biology-and-medicine.pdf","ta":"https://asef.net/asef-mentors-and-tutors/tine-curk/","tn":"https://csml.northwestern.edu/people.html","tj":"https://engineering.jhu.edu/materials/faculty/tine-curk/","et":"https://thesis.caltech.edu/5530/","ea":"https://campuspubs.library.caltech.edu/2129/1/Commencement_2010a.pdf","ec":"https://www.colorado.edu/ecee/media/2524","ep":"https://www.colorado.edu/ecee/matt-eichenfield","el":"https://painterlab.caltech.edu/alumni/"};
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




const w='d6e5d1c7', h='2131f135', t='2fe7dc7a', e='d797c39e';
const wName='Haozhe（Harry）Wang', minnich='人员 - Caltech - Austin Minnich - f23e1d08';
const wp='MIT 毕业典礼名册列 2021 年 2 月授予 MIT EECS 博士，题名 Graphene-Metal Interactions beyond Van der Waals Forces，已核 MIT 论文目录原字段列 Jing Kong。Duke 简介用 2020 年表述完成博士训练，学校履历将 2020–2021 列为 MIT 博后任期。';
const wpd='Minnich 2024 年 5 月本人 CV 第 10 页的 Present Postdoctoral Scholar Advisees 栏具名 Haozhe Wang。Duke 履历列 2021–2023 Caltech KNI Prize Postdoctoral Fellow，Caltech KNI 历届名录列其 Duke ECE 去向。Caltech 博士后导师可信度高。';
const wlinks=src(['Minnich 本人 2024 CV 第 10 页','wcv'],['Duke 任用档','wd'],['Caltech KNI 校友原档','wk'],['旧组公告','wo']);
updateEdge(w,wName,minnich,'Austin Minnich','博士后课题组负责人','博士后课题组成员','博士后导师','博士后研究者',wpd,wlinks);
pl(w,'- 博士导师：', 'MIT 毕业名册具名列 2021 年 2 月授予博士并记论文题名。 '+src(['MIT 毕业名册印刷第 83 页','wc']));
rewrite(pf(w),x=>x.startsWith(boundary),()=>boundary+wp+' '+wpd+' MIT 2020–2021 AeroAstro 阶段保留 Wardle 课题组负责人，个人指导称谓待补原档。 '+src(['MIT 学位目录','wm'],['MIT 毕业名册','wc'],['本人履历','ww'],['Duke 任用档','wd'],['MIT 组校友','wf']));
cell(w,2,'Jing Kong（MIT EECS，2021 年 2 月授予博士）');
cell(w,3,'Brian L. Wardle（MIT 2020–2021 博士后课题组负责人）；Austin Minnich（Caltech 2021–2023 博士后导师）');
schoolWith(w,wlinks+' · '+src(['MIT 毕业名册','wc']));
const wa=audit(w,[
 a('identity','同名 Duke ECE 学者与 Caltech KNI 去向、MIT 论文题名及纳米材料研究一致。',['ww','wd','wk','wc'],'confirmed'),
 a('affiliation','Duke Pratt School 电气与计算机工程系助理教授。',['wd','ww'],'confirmed'),
 a('research','低维材料、原子层制造及半导体纳米器件。',['ww','wd'],'confirmed'),
 a('phd',wp,['wc','wm','ww'],'confirmed_advisor'),
 a('postdoc',wpd+' MIT AeroAstro 2020–2021 Wardle 组，个人指导称谓待核。',['wcv','wd','wk','wf'],'confirmed_advisor')
],'追 MIT AeroAstro 2020–2021 的任用、年度报告或正式个人指导说明。Caltech 博士后已确认。');
relation(w,wa,'postdoc',minnich,'advisor',wpd,['wcv','wd','wk'].map(k=>u[k]),'minnich');

const hp='ANU 2012 年博士论文第 1 页具名 Ping Koy Lam、Ben Buchler 为 Advisors，第 7 页致谢再具名为 supervisors。论文题名 Quantum Optical Storage and Processing Using Raman Gradient Echo Memory。';
const hpd='MIT 组托管 2016 年同期论文核 Hosseini 任职单位与 Vuletić 研究合作，本科论文把 Hosseini 列为 Vuletić 组博士后。个人正式指导待查。';
const hlinks=src(['ANU 原论文第 1、7 页','han'],['Northwestern ECE','hn'],['MIT 组托管同期论文','hm'],['MIT 本科论文副本','hb']);
rewrite(pf(h),x=>x.startsWith(boundary),()=>boundary+hp+' '+hpd+' Northwestern ECE 副教授，研究量子光学、纳米光子学与量子传感。 '+hlinks);
schoolWith(h,hlinks);
audit(h,[
 a('identity','ANU 论文、MIT 同期论文、Northwestern 现任档的姓名、时间及量子光学方向相符。',['han','hm','hn'],'confirmed'),
 a('affiliation','Northwestern 电气与计算机工程系副教授。保留既有应用物理和 Purdue 兼职来源。',['hn'],'confirmed'),
 a('research','量子光学、纳米光子学及传感中的光物质相互作用。',['hn'],'confirmed'),
 a('phd',hp,['han'],'confirmed_advisor'),a('postdoc',hpd,['hb','hm'],'group_or_candidate')
],'追 MIT 同期任用或 Vuletić 本人指导名录，核具体博后导师及任期。');

const tph='Cambridge 原书目 Advisors 栏列 Daan Frenkel，化学博士。本人署名论文履历与 JHU 系档核 2016 博士。';
const tpd='本人署名论文履历明列三段博士后。Maribor 2016–2017 的个人指导待查。CAS 2017–2018 的具名研究师长为 Jure Dobnikar，Northwestern 2019–2022 的具名研究师长为 Erik Luijten，ASEF 使用 mentorship。Luijten 原组档另核 2019 年 1 月入组。';
const tlinks=src(['本人署名论文履历','tp'],['ASEF 学者简介','ta'],['Northwestern 组档','tn'],['JHU 材料系','tj']);
rewrite(pf(t),x=>x.startsWith(boundary),()=>boundary+tph+' '+tpd+' Cambridge 下载当次 429 已留队列。 '+tlinks+' · '+src(['Cambridge 论文目录','tc']));
pl(t,'- 博士后阶段研究师长：[[人员 - Northwestern - Erik Luijten',' 本人署名履历核 2019–2022，课题组原页核 2019 年 1 月入组。 '+src(['本人署名论文','tp'],['Northwestern 课题组','tn']));
pl(t,'- 博士后阶段研究师长：[[师承人物 - Jure Dobnikar',' 本人署名履历核 CAS 2017–2018。 '+src(['本人署名论文','tp']));
cell(t,3,'Maribor 2016–2017（博士后指导待核）；Jure Dobnikar（CAS 2017–2018 阶段研究师长）；Erik Luijten（Northwestern 2019–2022 阶段研究师长）');
schoolWith(t,tlinks);
audit(t,[
 a('identity','Cambridge 学位、三段任用及 Johns Hopkins 现职相符。',['tc','tp','tj'],'confirmed'),
 a('affiliation','Johns Hopkins 材料科学与工程系助理教授，ASEF 同一人物档列兼物理与天文学系。',['tj','ta'],'confirmed'),
 a('research','软物质理论、分子模拟与统计力学。',['tj','tp'],'confirmed'),
 a('phd',tph,['tc','tp'],'confirmed_advisor'),a('postdoc',tpd,['tp','ta','tn'],'group_or_candidate')
],'查 Maribor 2016–2017 博士后任用及 CAS、Northwestern 当期具名正式导师资料。');

const eph='Caltech 2010 学位馆藏 Advisor 明列 Oskar J. Painter，毕业名册确认物理博士及同一论文题名。2009 年为研究生履历结束年份，2010 年为 CV 和校方记载的授予年份。';
const epd='本人 CV 与 Colorado 系档列 Caltech KNI 博士后及 2011–2014 Sandia Truman Fellow，Caltech KNI 与 Painter 组档明确前一段身份及组属，保留 Oskar Painter 课题组负责人。Caltech 个别日期在 CV 中作 2009–2011 或 2010–2011，个人指导及起月待核。Sandia 任用另查具名指导。';
const elinks=src(['Caltech 论文原档','et'],['Caltech 毕业名册','ea'],['本人 CV','ec'],['Colorado ECEE','ep'],['Painter 组档','el'],['KNI 历届名录','wk']);
rewrite(pf(e),x=>x.startsWith(boundary),()=>boundary+eph+' '+epd+' '+elinks);
pl(e,'- 博士导师：', 'Caltech 学位档的 Advisor 栏同样明确署 Painter。 '+src(['Caltech 学位档','et']));
cell(e,2,'Oskar Painter（Caltech 2010 物理博士导师）');
cell(e,3,'Oskar Painter（Caltech KNI 博士后课题组负责人）；Sandia 2011–2014 Truman Fellow 指导待核');
schoolWith(e,elinks);
audit(e,[
 a('identity','Caltech 学位论文作者 Matthew S. Eichenfield 与本人 CV、CU、KNI 的 Matt Eichenfield 相符。',['et','ec','ep','wk'],'confirmed'),
 a('affiliation','Colorado Boulder 电气、计算机与能源工程系量子工程讲席，兼 Sandia National Labs。',['ep','ec'],'confirmed'),
 a('research','光子、声子及电子微系统，量子光子学与光机械。',['ep','et'],'confirmed'),
 a('phd',eph,['et','ea','ec'],'confirmed_advisor'),a('postdoc',epd,['ec','ep','el','wk'],'group_or_candidate')
],'追 Caltech KNI 具名博后指导与起月，另核 Sandia Truman 任用性质和个人指导。');
const pages=[
 [w,'wcv','May 2024 CV p. 10, Present Postdoctoral Scholar Advisees lists Haozhe Wang.','具名 Caltech 博士后导师。'],
 [w,'wd','Duke Pratt profile lists MIT PhD 2021, MIT postdoc 2020–2021, Caltech KNI Prize postdoc 2021–2023.','分段日期与任职。'],
 [w,'ww','Wang lab says doctoral training at MIT EECS in 2020, MIT AeroAstro until 2021, KNI postdoc, Duke ECE since 2023.','核本人履历表述、研究和任职。'],
 [w,'wc','MIT commencement program names Haozhe Wang, February 2021, EECS doctorate and Graphene-Metal Interactions thesis.','确认授予年份与月份。'],
 [w,'wk','Caltech KNI former fellows names Haozhe Wang, Duke ECE.','核任用身份。'],
 [h,'han','PhD thesis, pp. 1 and 7, names Ping Koy Lam and Ben Buchler as advisors and supervisors. SHA-256 b1cf1a33db043f145e2cf09e39015481cba0bb663de5125c6c7cd79a8dcf711e.','回收早期因大小未读原件，核两位博士导师。'],
 [h,'hn','Northwestern ECE associate professor in quantum optics, photonics, communication and sensing.','核任用方向。'],
 [h,'hm','2016 original PRL lists Hosseini, Vuletić and colleagues at MIT Physics/RLE.','核同期单位及研究；合著未确证导师。'],
 [t,'tc','Cambridge PhD catalog lists Advisors: Frenkel, Daan.','核博士导师。'],
 [t,'tp','Author biography, postdoctoral Maribor 2016–2017, CAS 2017–2018, Northwestern 2019–2022, JHU 2023.','补三个博士后时段，个人指导仍区分。'],
 [t,'tn','Northwestern group member history dates entry January 2019 as postdoctoral researcher.','核 Northwestern 时段和组属。'],
 [t,'ta','ASEF distinguishes postdoctoral mentorship by Dobnikar at CAS and Luijten at Northwestern.','复核博士后阶段研究师长。'],
 [t,'tj','JHU MSE faculty profile records appointment, training and computational soft materials.','核院系、研究、训练。'],
 [e,'et','Caltech thesis, 2010, author Matthew S. Eichenfield, advisor Oskar J. Painter.','核论文题名与具名博士导师。'],
 [e,'ea','Caltech 2010 commencement lists Matt Eichenfield and matching PhD thesis.','核授予年份。'],
 [e,'ec','CU CV lists Painter as graduate advisor, 2010 PhD, KNI postdoc, Sandia Truman fellowship, Boulder and Sandia.','核具体角色与两段任用。'],
 [e,'ep','Colorado Boulder ECEE chair in quantum engineering and joint Sandia, photonic, phononic and electronic microsystems.','核院系、联合任职、方向。'],
 [e,'el','Painter alumni lists Matt Eichenfield as PhD graduate May 2010 and KNI postdoc.','核博后组归属。'],
 [e,'wk','KNI former fellows lists Matthew S. Eichenfield and historic Arizona/Sandia affiliations.','核 Caltech 博后，当前学校以 Colorado 系档为准。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:t,url:u.tcd,error:'429 Too Many Requests; Cambridge catalog was read directly. Respect host backoff.'},{record_id:t,url:u.tjd,error:'Direct public download returned 403 Forbidden. Retain Cambridge catalog evidence and avoid repeated download.'},{record_id:w,url:u.wf,error:'502 Bad Gateway on reread; historical reliable group archive retained.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0413_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0413_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0413_KNI履历与学位原卷回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
