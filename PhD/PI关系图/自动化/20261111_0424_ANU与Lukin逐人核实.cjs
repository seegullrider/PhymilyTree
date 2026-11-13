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
 orig.audit_id='pi_archive_20261111_0424_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0424_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"an":"https://openresearch-repository.anu.edu.au/bitstreams/bba7c673-56a7-43a7-a811-d12882bbb610/download","ac":"https://openresearch-repository.anu.edu.au/items/c01fbd82-80af-411e-887b-eadd8340d017","uc":"https://samueli.ucla.edu/people/artur-davoyan/","at":"https://atwater.caltech.edu/team-member/artur-davoyan","pe":"https://penntoday.upenn.edu/news/different-wavelength-nader-engheta-leads-community-light","lu":"https://www.physics.harvard.edu/sites/g/files/omnuum6476/files/2025-06/Lukin_CV.pdf#page=4","nt":"https://www.colorado.edu/jila/media/1355","ng":"https://www.colorado.edu/jila/ye-group-theses","nc":"https://www.colorado.edu/registrar/sites/default/files/attached-files/spring2015commencement_program.pdf#page=18","nl":"https://nicholsonlabs.org/group-leader/","nd":"https://pratt.duke.edu/people/travis-nicholson/","lb":"https://www.bu.edu/physics/profile/christopher-laumann/","lc":"https://www.bu.edu/physics/files/2021/05/Laumann_CV.pdf","ls":"https://sachdev.physics.harvard.edu/people-all","jc":"https://cua.mit.edu/people/javier-sanchez-yamagishi","jp":"https://cua.mit.edu/groups/park-group","ji":"https://www.physics.uci.edu/node/14096","jm":"https://news.mit.edu/2015/probing-graphene-physics-javier-sanchez-yamagishi-0519","ab":"https://eqi.cnsi.ucsb.edu/people/faculty/ania-bleszynski-jayich","av":"https://www.10-9lab.com/wordpress/wp-content/uploads/2017/05/Jayich_CV_May2017.pdf"};
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




const d='6c61989c', n='9cb22c34', l='30f4f9ac', j='2e53c358', y='9dae1af6';
const luk='人员 - Harvard - Mikhail Lukin - 310298e3', park='人员 - Harvard - Hongkun Park - abdc86e2', ye='师承人物 - Jun Ye';
const thesis=src(['ANU 博士论文原卷第 3、9 页','an'],['ANU 馆藏','ac']);
const ds=['Yuri S. Kivshar','Ilya V. Shadrivov','Andrey A. Sukhorukov'];
const dph='2011 年澳大利亚国立大学博士论文第 3 页为本人签署的声明，逐一具名 Yuri S. Kivshar、Ilya V. Shadrivov 和 Andrey A. Sukhorukov 三位博士导师；第 9 页致谢再次具名。关系类型可信度高。';
const dpd='Penn 校方记 Engheta 组博士后，Caltech Atwater 组档记 2015–2018 Resnick／KNI 博士后。两段按博士后课题组记录。';
for(const name of ds){
 updateEdge(d,'Artur Davoyan','师承人物 - '+name,name,'博士导师候选','博士生候选','博士导师','博士生',dph,thesis);
}
rewrite(pf(d),x=>x.startsWith(boundary),()=>boundary+dph+' '+dpd+' '+thesis+' · '+src(['Penn 校方','pe'],['Caltech Atwater 组档','at']));
cell(d,2,ds.join('、')+'（ANU 2011 论文具名）');
cell(d,3,'Nader Engheta（Penn 博士后课题组）、Harry Atwater（Caltech 2015–2018 博士后课题组）');
schoolWith(d,thesis+' · '+src(['UCLA 教师页','uc'],['Caltech 组档','at']));
const da=audit(d,[
 a('identity','ANU 馆藏及论文原卷、Atwater 组档和 UCLA 教员页相符。',['an','ac','at','uc'],'confirmed'),
 a('affiliation','UCLA Mechanical and Aerospace Engineering 副教授。',['uc'],'confirmed'),
 a('research','纳米和二维材料、等离激元、超材料、超表面与光子器件。',['uc'],'confirmed'),
 a('phd',dph,['an','ac'],'confirmed_advisor'),a('postdoc',dpd,['pe','at'],'group_or_candidate')
],'追 Penn 与 Caltech 两段博士后任用记录及明确具名指导。');
ds.forEach((name,i)=>relation(d,da,'phd','师承人物 - '+name,'advisor',dph,ids('an','ac'),'anu_advisor_'+i));

const nph='2015 年 Colorado Boulder 物理博士论文第 3 页明确署 Jun Ye 为论文导师，第 2 页有 Ye 与 Deborah Jin 两位审阅人。春季毕业名册列 Travis Lee Nicholson 及同名论文。关系类型可信度高。';
const npd='Lukin 本人 Harvard CV 第 4 页具名 Travis Nicholson（Duke）为其博士后指导对象，本人实验室记在 MIT 期间分别在 Vuletić 组及 Lukin 组研究。关系类型可信度高。';
const npl=src(['2015 博士论文原卷','nt'],['Colorado 毕业名册','nc']);
const npost=src(['Lukin 本人 CV 第 4 页','lu'],['Nicholson 本人组页','nl']);
updateEdge(n,'Travis L. Nicholson',ye,'Jun Ye','博士阶段课题组负责人','博士阶段课题组成员','博士导师','博士生',nph,npl);
updateEdge(n,'Travis L. Nicholson',luk,'Mikhail Lukin','博士后课题组负责人','博士后课题组成员','博士后导师','博士后研究者',npd,npost);
rewrite(pf(n),x=>x.startsWith(boundary),()=>boundary+'Colorado Boulder 2015 物理博士论文指名 Jun Ye；MIT 博士后阶段 Lukin 本人履历明确列为指导对象，Vladan Vuletić 保留博士后课题组负责人。本人组页记团队于 2024 年从 NUS 转到 Duke。 '+npl+' · '+npost);
rewrite(pf(n),x=>x.startsWith('- [本人实验室]')&&x.includes('均保留为课题组关系'),()=>'- Duke 现任物理系与 ECE 助理教授，研究超冷原子、光学晶格、量子信息和精密原子钟。 '+src(['Duke Pratt 教师页','nd']));
cell(n,2,'Jun Ye（Colorado Boulder 2015 物理博士导师）');
cell(n,3,'Mikhail Lukin（博士后导师）、Vladan Vuletić（博士后课题组负责人）');
schoolWith(n,npl+' · '+npost+' · '+src(['Duke Pratt','nd']));
const na=audit(n,[
 a('identity','Colorado Boulder 2015 年毕业名册全名 Travis Lee Nicholson，与原论文、Duke 教员页和本人实验室一致。',['nt','nc','nd','nl'],'confirmed'),
 a('affiliation','Duke 物理系与电气及计算机工程系助理教授。',['nd'],'confirmed'),
 a('research','超冷原子实验、光学势阱、原子钟、量子信息与量子计量。',['nd'],'confirmed'),
 a('phd',nph,['nt','nc','ng'],'confirmed_advisor'),a('postdoc',npd,['lu','nl'],'confirmed_advisor')
],'追 MIT 博后具名 Vuletić 指导及任期，保留既有组属证据。');
relation(n,na,'phd',ye,'advisor',nph,ids('nt','nc','ng'),'ye');
relation(n,na,'postdoc',luk,'advisor',npd,ids('lu','nl'),'lukin');

const lpd='Lukin 本人 Harvard CV 第 4 页博士后导师栏列 Chris Laumann（Boston Univ.）；本人 CV 核 Harvard Gollub／ITAMP 博士后 2010–2013。关系类型可信度高。';
const ll=src(['Lukin 本人 CV 第 4 页','lu'],['Laumann 本人 CV','lc'],['BU 物理系','lb']);
edge(l,'Christopher Laumann',luk,'Mikhail Lukin','博士后导师','博士后研究者',lpd,ll);
rewrite(pf(l),x=>x.startsWith(boundary),()=>boundary+'Lukin 本人 CV 确认 Harvard 2010–2013 阶段的具名指导，Sachdev 组属来源另存。本人 CV 另列 2013 年秋 Perimeter 访问博后，该阶段指导待核。 '+ll+' · '+src(['Sachdev Harvard 研究主页','ls']));
cell(l,3,'Mikhail Lukin（Harvard 博士后导师）、Subir Sachdev（博士后课题组关系）；Perimeter 访问博后指导待核');
schoolWith(l,ll);
const la=audit(l,[
 a('identity','Lukin 所列 Chris Laumann 与 BU 物理系 Christopher Laumann 及本人 CV 相符。',['lu','lb','lc'],'confirmed'),
 a('affiliation','Boston University 物理系副教授。',['lb'],'confirmed'),
 a('research','凝聚态理论、量子多体、量子信息与固态缺陷传感。',['lb'],'confirmed'),
 a('postdoc',lpd+' Sachdev 组属另保留；Perimeter 访问任期仍待具名指导。',['lu','lc','ls'],'confirmed_advisor')
],'追 Perimeter 2013 年访问博后任用及导师，另追 Harvard Sachdev 指导称谓。');
relation(l,la,'postdoc',luk,'advisor',lpd,ids('lu','lc','lb'),'lukin');

const jpd='Lukin 本人 Harvard CV 第 4 页博士后导师栏具名 Javier Sanchez-Yamagishi（UC Irvine）。MIT–Harvard CUA 记录其 Harvard 博士后归入 Lukin 与 Park 两组。关系类型可信度高。';
const jgp='MIT–Harvard CUA 将此人列为 Harvard 博士后并链接 Park Group，组页具名 Hongkun Park 为负责人。课题组关系可信度高。';
const jl=src(['Lukin 本人 CV 第 4 页','lu'],['MIT–Harvard CUA 成员页','jc'],['UCI 物理与天文系','ji']);
const jgl=src(['CUA 成员页','jc'],['CUA Park 组','jp']);
updateEdge(j,'Javier Sanchez-Yamagishi',luk,'Mikhail Lukin','博士后阶段研究师长','博士后阶段研究者','博士后导师','博士后研究者',jpd,jl);
edge(j,'Javier Sanchez-Yamagishi',park,'Hongkun Park','博士后课题组负责人','博士后课题组成员',jgp,jgl);
rewrite(pf(j),x=>x.startsWith(boundary),()=>boundary+'MIT 毕业后先在 Jarillo-Herrero 组任博士后，其后在 Harvard Quantum Optics Center 任博士后。后段确认 Lukin 的导师称谓并保留 Park 组属，两个时段分别记录。 '+jl+' · '+src(['MIT 2015 同期报道','jm'],['CUA Park 组','jp']));
cell(j,3,'Mikhail Lukin（Harvard 博士后导师）、Hongkun Park（Harvard 博士后课题组负责人）、Pablo Jarillo-Herrero（MIT 博士后课题组负责人）');
schoolWith(j,jl+' · '+src(['CUA Park 组','jp']));
const ja=audit(j,[
 a('identity','CUA Harvard 博后、Lukin CV 的 UC Irvine 任职标识和 UCI 物理与天文系档相符。',['jc','lu','ji'],'confirmed'),
 a('affiliation','UC Irvine Physics and Astronomy，自 2018 年任职。',['ji'],'confirmed'),
 a('research','二维材料量子电子现象、堆叠异质结构的拓扑和关联。',['ji'],'confirmed'),
 a('postdoc',jpd+' 另保留早期 MIT Jarillo-Herrero 博后组属和 Harvard Park 博后组属。',['lu','jc','ji','jm','jp'],'confirmed_advisor')
],'追 MIT 早期博士后与 Harvard Park 具名指导称谓及准确日期。');
relation(j,ja,'postdoc',luk,'advisor',jpd,ids('lu','jc','ji'),'lukin');
relation(j,ja,'postdoc',park,'group_leader',jgp,ids('jc','jp'),'park');

const ypd='Lukin 本人 Harvard CV 第 4 页博士后导师栏列 Ania Jayich（UC Santa Barbara）。UCSB 简介指出她入职前的 NV 色心与纳米机械项目由 Misha Lukin 和 Jack Harris 共同监督。关系类型可信度高，项目范围已注明。';
const yl=src(['Lukin 本人 CV 第 4 页','lu'],['UCSB 量子中心','ab'],['Jayich 本人 CV','av']);
updateEdge(y,'Ania Bleszynski Jayich',luk,'Mikhail Lukin','博士后阶段研究师长','博士后阶段研究者','博士后导师','博士后研究者',ypd,yl);
rewrite(pf(y),x=>x.startsWith(boundary),()=>boundary+'Yale 博士后由 Jack Harris 指导，入职 UCSB 前的 NV 色心项目另有 Lukin 共同指导，Lukin 本人 CV 具名确认。已核博士后任用单位为 Yale，Harvard 记为共同导师所在单位。 '+yl);
cell(y,3,'Jack Harris（Yale 博士后导师）、Mikhail Lukin（博士后 NV 项目共同指导，Lukin CV 明列）');
schoolWith(y,yl);
const ya=audit(y,[
 a('identity','UCSB 个人档 Ania Bleszynski Jayich 与 Lukin CV Ania Jayich（UC Santa Barbara）、本人 CV 相符。',['ab','lu','av'],'confirmed'),
 a('affiliation','UCSB Department of Physics 教授。',['ab'],'confirmed'),
 a('research','金刚石 NV 色心量子磁测、固态自旋、纳米机械与自旋光子耦合。',['ab'],'confirmed'),
 a('postdoc',ypd+' 本人 CV 单独明确 Yale 的 Jack Harris 为博士后导师。',['lu','ab','av'],'confirmed_advisor')
],'如能取得同期履历，补 NV 项目的准确合作起止时间。');
relation(y,ya,'postdoc',luk,'advisor',ypd,ids('lu','ab','av'),'lukin');

const pages=[
 [d,'an','2011 ANU thesis, 117 pp. Signed statement on PDF p. 3 names Yuri S. Kivshar, Ilya V. Shadrivov and Andrey A. Sukhorukov as doctoral supervisors. Acknowledgements PDF p. 9 name all three. Visually verified both scans. SHA-256 fd6fec2e58a0be39b925f84c85540a9eb5f436e4506e37edc6a505570910f0a2.','三位博士导师均由签字声明明示。'],
 [d,'uc','UCLA Mechanical and Aerospace Engineering, Associate Professor; nanoscale and two-dimensional materials, metamaterials, plasmonics, metasurfaces, and photonic devices.','核 UCLA 任职及方向。'],
 [d,'at','Artur Davoyan, Resnick Sustainability Institute and Kavli Nanoscience Institute postdoctoral fellow for the Atwater group, 2015–2018.','核 Caltech 博后时段及组属。'],
 [n,'nt','2015 University of Colorado Department of Physics thesis, A new record in atomic clock performance, Travis L. Nicholson. PDF p. 3: Thesis directed by Dr. Jun Ye. PDF p. 2 lists Jun Ye and Deborah Jin as signatories. SHA-256 f768ee7212d133a233d519b4d31f770e3ae38a87dfb22adb6dd4d41973b0287f.','原论文具名博士导师。'],
 [n,'nc','Spring 2015 commencement PDF p. 18, Travis Lee Nicholson, Physics, A New Record in Atomic Clock Performance.','核姓名、学科、年份和题名。'],
 [n,'nd','Assistant Professor of Physics and Assistant Professor in the Department of Electrical and Computer Engineering; research on ultracold atoms and quantum metrology.','核 Duke 两个任职及研究。'],
 [n,'lu','Postdoctoral advisor (p. 4): Travis Nicholson, Duke.','核博士后导师。'],
 [n,'nl','Nicholson lab biography: JILA graduate work in Jun Ye group; postdoctoral work in groups of Vladan Vuletić and Mikhail Lukin.','核阶段、组属及身份。'],
 [l,'lu','Postdoctoral advisor (p. 4): Chris Laumann, Boston Univ.','核 Harvard 博士后导师。'],
 [l,'lc','Christopher R. Laumann CV lists Princeton PhD 2005–2010, Harvard Gollub/ITAMP Fellow 2010–2013 and Perimeter visiting postdoctoral fellow Fall 2013.','核两段博士后任职。'],
 [l,'lb','Christopher Laumann, Associate Professor, BU Physics, quantum many-body systems, quantum computing and solid-state defect sensing.','核现任及研究。'],
 [j,'lu','Postdoctoral advisor (p. 4): Javier Sanchez-Yamagishi, UC Irvine.','核 Harvard 博士后导师。'],
 [j,'jc','Javier Sanchez-Yamagishi, Harvard, Postdoctoral Fellow; Research Groups: Park Group and Lukin Group.','核 Harvard 博后双组属。'],
 [j,'jp','Park Group, Hongkun Park, Harvard Chemistry and Chemical Biology and Physics.','核 Park 组负责人。'],
 [j,'ji','UC Irvine Physics & Astronomy confirms MIT PhD, Harvard Quantum Optics Center postdoctoral fellow, UCI since 2018; quantum electronic phenomena in 2D materials.','核博士后单位、现任与研究。'],
 [y,'lu','Postdoctoral advisor (p. 4): Ania Jayich, UC Santa Barbara.','核 Lukin 博士后指导。'],
 [y,'ab','UCSB Physics professor; postdoc in Jack Harris group at Yale; pre-UCSB NV centers and nanomechanical project co-supervised by Misha Lukin at Harvard and Jack Harris.','核任用及共同指导范围。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key].split('#')[0],raw,excerpt}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0424_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0424_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0424_ANU与Lukin原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
