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
 orig.audit_id='pi_archive_20261111_0044_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0044_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"t":"https://www.ece.nus.edu.sg/stfpage/elecsj/teaching.html","sg":"https://links.sgx.com/FileOpen/MetaOptics%20-%20Annual%20Report%202025.ashx?App=Announcement&FileID=880526","im":"https://research.a-star.edu.sg/researcher/jinghua-teng/","nu":"https://cde.nus.edu.sg/ece/about-us/people/adjunct-staff/","y":"https://live-sas-physics.pantheon.sas.upenn.edu/sites/default/files/2021-02/Yodh%20CV_0.pdf","y2":"https://live-sas-physics.pantheon.sas.upenn.edu/sites/default/files/2022-08/Yodh%20CV_0.pdf","da":"https://www.physics.ucsb.edu/people/zvonimir-dogic","tum":"https://www.ias.tum.de/en/ias/dogic-zvonimir/","hu":"https://www.humboldt-foundation.de/en/connect/explore-the-humboldt-network/singleview/1070607/dr-zvonimir-dogic","dh":"https://www.fz-juelich.de/profile/dhont_j.k.g","fr":"https://www.fradenlab.com/people/","bm":"https://www.brandeis.edu/magazine/2017/summer/featured-stories/mrsec.html","wc":"https://faculty.college.emory.edu/sites/weeks/weeks-cv.pdf","we":"https://physics.emory.edu/people/bios/weeks-eric.html","wl":"https://weitzlab.seas.harvard.edu/2025/06/24/alumni/","cv":"https://www.seas.upenn.edu/~jcrocker/JCC2006.short.pdf","pm":"https://www.med.upenn.edu/pmi/people/john-c-crocker-ph-d/","pt":"https://penntoday.upenn.edu/news/penn-engineers-overcome-hurdle-growing-revolutionary-optical-metamaterial"};
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




const [t,d,w,c]=['153a5ad8','5f4c8631','9017323b','33c37585'];
const [tn,dn,wn,cn]=['Jinghua Teng','Zvonimir Dogic','Eric Weeks','John C. Crocker'];
const [ch,dh,fr,y,we,gr]=['师承人物 - Soo Jin Chua','师承人物 - Jan Dhont','师承人物 - Seth Fraden','人员 - UPenn - Arjun G. Yodh - ce45d684','人员 - Harvard - David A. Weitz - 6d11ec29','人员 - NYU - David G. Grier - bc1df89d'];
const te='Soo Jin Chua 在 NUS 本人教学档的 Postgraduate Students Supervised 之下逐项列出已毕业博士生，第 9 项具名 Teng Jing Hua 及学位论文题名 Study of Impurity Free Quantum Well Intermixing and Its Application in Photonic Integrated Circuit。Chua 的博士指导关系有本人机构档明示，可信度高。该名单记 2003 年 9 月，SGX 披露资料记 2003 年 11 月授位，主副指导分工及两个月份的口径待学位档。';
const tl=src(['Chua 的 NUS 已毕业博士指导名单','t'],['SGX 2025 年报履历','sg']);
const taft='SGX 披露履历列 2000 年 7 月起任 A*STAR IMRE Research Associate，2002 年 1 月至 2010 年 3 月任 Scientist，跨越 2003 年授位。已核材料未见单列博士后岗位。';
updateEdge(t,tn,ch,'Soo Jin Chua','博士阶段研究师长','博士阶段受指导者','博士导师','博士生',te,tl);
rewrite(pf(t),x=>x.startsWith('- 博士关系证据：'),()=>'- 博士论文：Study of Impurity Free Quantum Well Intermixing and Its Application in Photonic Integrated Circuit。'+tl);
rewrite(pf(t),x=>x.startsWith(boundary),()=>boundary+te+' '+taft+' '+tl+' · '+src(['A*STAR 本人档','im'],['NUS ECE 兼职名录','nu']));
cell(t,2,'Soo Jin Chua（NUS 博士导师，2003；授位月与共同指导待核）');
cell(t,3,'2002–2010 A*STAR IMRE Scientist；已核资料未见博士后任用');
schoolWith(t,tl+' · '+src(['NUS ECE 兼职名录','nu']));
const at=audit(t,[
 a('identity','NUS 导师本人毕业名录及 SGX 履历核对同一 2003 年 NUS 博士。',['t','sg','im'],'confirmed'),
 a('affiliation','A*STAR IMRE Senior Principal Scientist、NUS Electrical and Computer Engineering Adjunct Professor。',['im','nu','sg'],'confirmed'),
 a('research','二维光电子、纳米光学、超表面、等离激元、太赫兹及半导体器件。',['im'],'confirmed'),
 a('phd',te,['t','sg'],'confirmed_advisor'),
 a('postdoc',taft,['sg','im'],'no_postdoc_documented')
],'按博士论文全题查 NUS 学位原卷，补 2003 年 9 月／11 月口径及是否另有共同导师。');
relation(t,at,'phd',ch,'advisor',te,ids('t','sg'),'chua');

const de='Yodh 本人两版 Penn CV 将 Zvonimir Dogic（在 Penn 最后一年 2003）直接列在 POST-DOCTORAL ASSOCIATE SUPERVISION／POST-DOC ADVISEES。UCSB 与 TUM IAS 履历独立核为 Dogic 的 Penn 2002–2003 博士后。关系可信度高。';
const dhE='Humboldt 基金会项目原档将 Jan K. G. Dhont 具名为 Jülich fellowship 的 Host during sponsorship，起始 2001-04-01。TUM IAS 履历核 2001–2002 为博士后。正式指导人名册未见，按博士后阶段研究师长标注。接待指导关系可信度高。';
const dLinks=src(['Yodh 本人 Penn CV（2021）','y'],['Yodh 本人 Penn CV（2022）','y2'],['TUM IAS 原档','tum']);
const dhL=src(['Humboldt 基金会项目原档','hu'],['TUM IAS 履历','tum'],['Dhont 的 Jülich 机构档','dh']);
edge(d,dn,y,'Arjun G. Yodh','博士后导师','博士后研究者',de,dLinks);
edge(d,dn,dh,'Jan K. G. Dhont','博士后阶段研究师长','博士后阶段研究者',dhE,dhL);
rewrite(pf(d),x=>x.startsWith(boundary),()=>boundary+'Brandeis 校刊和 Fraden 组名录核其博士阶段受 Seth Fraden 指导，论文正式签署字段待查。Jülich Humboldt 2001–2002 主持人 Dhont 与 Penn 2002–2003 博士后导师 Yodh 分列。2003–2007 Harvard Rowland 为 Research Fellow，另记其后任职。 '+src(['UCSB 物理系','da'],['TUM IAS 履历','tum'],['Humboldt 原档','hu'],['Yodh 本人 CV','y']));
cell(d,3,'Jan K. G. Dhont（Jülich 2001–2002 博士后阶段研究师长）；Arjun G. Yodh（Penn 2002–2003 博士后导师）');
schoolWith(d,dLinks+' · '+src(['Humboldt 基金会项目原档','hu']));
const ad=audit(d,[
 a('identity','UCSB、TUM、Humboldt、Yodh 履历交叉核对同一物理学者及两个阶段。',['da','tum','hu','y'],'confirmed'),
 a('affiliation','UCSB 物理系教授。',['da','tum'],'confirmed'),
 a('research','软凝聚态、自组装和非平衡活性物质。',['da','tum'],'confirmed'),
 a('phd','Brandeis 校刊称其为 Fraden 的研究生，Fraden 组名录核其本科与研究生组属。正式学位导师签署字段待查。',['bm','fr','tum'],'group_or_candidate'),
 a('postdoc',de+' '+dhE,['y','y2','tum','hu','dh'],'confirmed_advisor')
],'查 Brandeis 论文签署页与 Jülich 任用的正式指导职衔，Rowland Research Fellow 任用单列。');
relation(d,ad,'postdoc',y,'advisor',de,ids('y','y2','tum'),'yodh');
relation(d,ad,'postdoc',dh,'stage_mentor',dhE,ids('hu','tum','dh'),'dhont');

const weE='Yodh 本人 CV 的 POST-DOC ADVISEES 名单列 Eric Weeks 在 Penn 最后一年 1999。Weeks 本人 CV 确认 1998 年 1 月至 1999 年 8 月在 Penn 博后并与 Yodh、Weitz 共事。Yodh 在 Penn 的博后指导可信度高。';
const weL=src(['Yodh 本人 Penn CV','y'],['Weeks 本人 CV','wc']);
updateEdge(w,wn,y,'Arjun G. Yodh','博士后合作及导师候选','博士后合作及导师候选','博士后导师','博士后研究者',weE,weL);
rewrite(pf(w),x=>x.startsWith(boundary),()=>boundary+'本人 CV 明确 1997 UT Austin 博士导师 Harry L. Swinney。Penn 1998–1999 博后导师 Yodh 由 Yodh 本人指导名册确认；Weitz 在 Penn 和其后 Harvard 1999–2000 共事，保留候选待正式监督档。 '+weL);
cell(w,3,'Arjun G. Yodh（Penn 1998–1999 博士后导师）；David A. Weitz（Penn、Harvard 博士后候选）');
schoolWith(w,weL);
const aw=audit(w,[
 a('identity','Emory 本人 CV 与 Emory Physics、Yodh Penn 监督档核同一软物质研究者。',['wc','we','y'],'confirmed'),
 a('affiliation','Emory 物理系 Samuel Candler Dobbs Professor。',['we','wc'],'confirmed'),
 a('research','实验软凝聚态、胶体玻璃、复杂流体与颗粒材料。',['we'],'confirmed'),
 a('postdoc',weE+' 继续追 Weitz 在 Penn／Harvard 两段的正式指导职衔。',['y','wc'],'confirmed_advisor')
],'查 Weitz 的 Penn 或 Harvard 博士后指导记录；保留本人履历已确认的两段时间。');
relation(w,aw,'postdoc',y,'advisor',weE,ids('y','wc'),'yodh');

const cph='Crocker 本人 Penn CV 第 1 页的 1996 Chicago 物理博士条目将 David G. Grier 列为 Advisor，并列论文 Probing Colloidal Interactions with Digital Video Microscopy and Blinking Optical Tweezers。可信度高。';
const cpo='Crocker 本人 Penn CV 第 1 页的宾大 Physics and Astronomy Postdoctoral Fellow 条目明确列 Supervisors 为 Arjun Yodh 与 David Weitz。视觉核对 CV 两列排版，该项为 1996–1999，其后 2000–2001 Caltech 助理教授。Yodh CV 亦列 Crocker 为本人博士后指导对象，但末年写 2000，日期按原件并列。两位指导人可信度高。';
const cpl=src(['Crocker 本人 Penn CV','cv'],['Yodh 本人指导档','y']);
updateEdge(c,cn,gr,'David G. Grier','博士阶段研究师长','博士阶段研究者','博士导师','博士生',cph,src(['Crocker 本人 Penn CV','cv']));
updateEdge(c,cn,y,'Arjun G. Yodh','博士后课题组','博士后课题组成员','博士后导师','博士后研究者',cpo,cpl);
updateEdge(c,cn,we,'David A. Weitz','博士后师长候选','博士后研究者候选','博士后导师','博士后研究者',cpo,cpl);
rewrite(pf(c),x=>x.startsWith(boundary),()=>boundary+'Crocker 本人 Penn CV 分列 Chicago 博士导师和 Penn 两位博士后导师。本人 CV 记博士后 1996–1999，Yodh CV 的 Penn 末年 2000。Caltech 2000–2001 岗位为 Assistant Professor。 '+cpl);
cell(c,2,'David G. Grier（Chicago 1996 博士导师）');
cell(c,3,'Arjun G. Yodh、David A. Weitz（Penn 博士后导师；本人 CV 为 1996–1999，Yodh 档末年 2000）');
schoolWith(c,cpl+' · '+src(['Pennsylvania Muscle Institute','pm']));
const ac=audit(c,[
 a('identity','Penn CV、校方报道和 PMI 人员档核姓名、任用、实验领域。',['cv','pm','pt'],'confirmed'),
 a('affiliation','Penn Chemical and Biomolecular Engineering；Pennsylvania Muscle Institute 人员。',['cv','pm','pt'],'confirmed'),
 a('research','实验软凝聚态、胶体、自组装及细胞力学。',['cv','pm','pt'],'confirmed'),
 a('phd',cph,['cv'],'confirmed_advisor'),
 a('postdoc',cpo,['cv','y'],'confirmed_advisor')
],'两阶段指导人均已明确。可继续用 Penn 原始任用档核 1999／2000 末年差异。');
relation(c,ac,'phd',gr,'advisor',cph,ids('cv'),'grier');
relation(c,ac,'postdoc',y,'advisor',cpo,ids('cv','y'),'yodh');
relation(c,ac,'postdoc',we,'advisor',cpo,ids('cv','y'),'weitz');

const pages=[
 [t,'t','Soo Jin Chua’s NUS personal teaching page lists Teng Jing Hua with a PhD thesis title under completed postgraduate supervisions.','确认导师本人明示指导的博士生与论文。'],
 [t,'sg','The annual report identifies Teng Jinghua as a 2003 NUS PhD and records his IMRE Research Associate and Scientist roles.','核对学位及跨授位时点的 IMRE 任用，已核资料未见博士后。'],
 [t,'im','A*STAR lists IMRE and NUS ECE appointments and nanophotonics research.','核机构、院系及研究方向。'],
 [t,'nu','NUS ECE lists Teng Jinghua from IMRE as an Adjunct Professor.','核对兼任。'],
 [d,'y','Yodh lists Zvonimir Dogic with Penn final year 2003 in the postdoctoral associate supervision roster.','确认 Penn 博士后导师。'],
 [d,'y2','The later version of Yodh’s CV independently retains Dogic in its postdoctoral advisees section.','核对导师称谓。'],
 [d,'hu','Humboldt records Jan K. G. Dhont as Dogic’s host at Forschungszentrum Jülich.','核对 Jülich 博士后阶段接待与研究师长。'],
 [d,'dh','Jülich profile identifies Jan K. G. Dhont and his directorship in the same institute.','核对主持人身份。'],
 [d,'da','UCSB Physics lists Dogic as professor and describes Jülich and Penn training.','核任职和研究方向。'],
 [d,'tum','TUM IAS lists Humboldt Jülich 2001–02, Penn 2002–03, and Rowland Junior Fellow 2003–07.','核对任期及岗位边界。'],
 [d,'fr','Seth Fraden lab names Dogic among its former graduate and undergraduate researchers.','复核博士阶段组属。'],
 [w,'y','Yodh lists Eric Weeks under postdoctoral associate supervision, with Penn final year 1999.','确认 Penn 博士后导师。'],
 [w,'wc','Weeks’s own CV records Penn 1998–1999 with Weitz and Yodh, then Harvard 1999–2000 with Weitz.','核任期、两地和未明确的另一位指导称谓。'],
 [w,'we','Emory lists current professorship and soft condensed matter research.','核院系和研究。'],
 [c,'cv','Crocker’s first CV page names David G. Grier as Chicago PhD advisor and Arjun Yodh and David Weitz as Penn postdoctoral supervisors. The screenshot places the Penn fellowship in 1996–1999.','两阶段导师及任期核定。'],
 [c,'y','Yodh’s Penn CV lists John Crocker among his postdoctoral advisees, with 2000 as the final year.','独立佐证关系，保留末年差异。'],
 [c,'pm','Pennsylvania Muscle Institute lists Crocker and his research in cell mechanics.','复核身份及研究。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:w,url:u.wl,error:'502 Bad Gateway; the current alumni page could not be read'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0044_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0044_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0044_Penn与NUS原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
