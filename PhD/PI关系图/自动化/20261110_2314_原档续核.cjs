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
 orig.audit_id='pi_archive_20261110_2314_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2314_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"hth":"https://ceder.berkeley.edu/theses/2011_Geoffroy_Hautier_Thesis.pdf","hri":"https://profiles.rice.edu/faculty/geoffroy-hautier","hda":"https://engineering.dartmouth.edu/community/faculty/geoffroy-hautier","hdan":"https://engineering.dartmouth.edu/news/geoffroy-hautier-joins-dartmouth-engineering-faculty","huc":"https://nanoengineering.ucsd.edu/seminars/seminar-geoffroy-hautier","hxl":"https://perso.uclouvain.be/xavier.gonze/people/","hpub":"https://thermoelectrics.matsci.northwestern.edu/publications/pdf/Zeier_et_al-2016-Angewandte_Chemie_Color.pdf","hrsc":"https://pubs.rsc.org/en/content/articlehtml/2017/tc/c7tc90083j","oth":"https://ceder.berkeley.edu/theses/2011_Shyue_Ping_Ong_Thesis.pdf","ouc":"https://jacobsschool.ucsd.edu/faculty/profile?id=358","onu":"https://cde.nus.edu.sg/mse/staff/shyue-ping-ong/","ocn":"https://cne.ucsd.edu/node/923","tnu":"https://nusgs.nus.edu.sg/thesis-advisors/chmtanz","ttu":"https://tum-asia.edu.sg/faculty/tan-zhi-kuang/","tca":"https://www.repository.cam.ac.uk/bitstream/1810/245616/1/Tan%20et%20al.pdf","rsc":"https://researchconnect.stonybrook.edu/en/persons/balaji-raghothamachar/","rmd":"https://www.nanocenter.umd.edu/events/wbg/program/WBG%202014%20Program.pdf","rsy":"https://www.stonybrook.edu/bulletin-archives/_media/spring2024-grad.pdf","rla":"https://you.stonybrook.edu/xraycharacterization/people/"};
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
const [h,on,oc,t,r]=['4f515130','4da906da','49d2b03d','4e7cb7a5','4f7d5801'];
const ceder='师承人物 - Gerbrand Ceder', gonze='师承人物 - Xavier Gonze';
const hd='MIT 2011 年材料科学与工程博士论文签署页列 Gerbrand Ceder 为 Thesis Supervisor，致谢称 advisor。可信度高。';
const hp='2014 年 UC San Diego 讲座履历称 Hautier 当时在 UCLouvain 与 Xavier Gonze 做 FNRS／Marie Curie 博后。Hautier 署名的期刊作者传记和 Gonze 组原名录互证，作者传记列 2014 年转任 UCLouvain 助理教授。明确为博士后课题组，正式 advisor 称谓待核。Dartmouth 入职报道另列 MIT 博后，具体时段与指导人待任用档。';
const hl=src(['MIT 博士论文','hth'],['Rice 院系','hri'],['Dartmouth 兼任','hda']);
const hpl=src(['2014 UCSD 讲座','huc'],['本人作者履历','hpub'],['Gonze 组名录','hxl'],['Dartmouth 入职报道','hdan']);
const ha=audit(h,[a('phd',hd,['hth'],'confirmed_advisor'),a('postdoc',hp,['huc','hpub','hxl','hdan'],'group_or_candidate'),a('affiliation','Rice 材料科学与纳米工程主聘，Dartmouth 工学院兼任。',['hri','hda']),a('research','高通量计算材料设计、光电材料与量子信息材料。',['hri'])],'查 MIT 博后任用时间和具体指导，以及 UCLouvain 正式导师职衔。');
relation(h,ha,'phd',ceder,'advisor',hd,ids('hth'),'Ceder');
relation(h,ha,'postdoc',gonze,'group_leader',hp,ids('huc','hpub','hxl','hdan'),'Gonze');
updateEdge(h,'Geoffroy Hautier',gonze,'Xavier Gonze','博士后课题组负责人','博士后课题组成员','博士后课题组负责人','博士后课题组成员',hp,hpl);
rewrite(pf(h),x=>x.startsWith(boundary),()=>boundary+hp+' '+hl+' · '+hpl);
cell(h,1,'Rice 材料科学与纳米工程主聘、Dartmouth 工学院兼任；高通量计算材料与光电材料');
cell(h,2,'Gerbrand Ceder（MIT 2011 博士论文导师）');
cell(h,3,'Xavier Gonze（UCLouvain 博后课题组负责人，2014 在组）；MIT 博后另待任用档核时段及导师');
cell(h,4,hl+' · '+hpl);

const od='MIT 2011 年材料科学与工程博士论文签署页和致谢分别明确列 Gerbrand Ceder 为 Thesis Supervisor 和 thesis advisor。NUS 与 UCSD 记录为同一人。';
const op='UC San Diego 工学院原档列 2011 年在 MIT 取得博士学位后，受聘 MIT Senior Research Associate；单列该研究职务。博士后聘任和导师待核。';
const ol=src(['MIT 博士论文','oth'],['UCSD 工学院履历','ouc'],['NUS 材料系','onu'],['UCSD 化学与纳米工程系','ocn']);
for(const id of [on,oc]){
 pl(id,boundary,op+' '+ol);
 cell(id,3,'MIT Senior Research Associate（取得博士学位后的研究职务）；博士后聘任及导师待核');
 schoolWith(id,src(['MIT 博士论文','oth'],['UCSD 工学院履历','ouc']));
 const event=audit(id,[a('phd',od,['oth'],'confirmed_advisor'),a('postdoc',op,['ouc']),a('affiliation',id===on?'NUS 材料科学与工程 Provost’s Chair Professor，UC San Diego 化学与纳米工程 Adjunct Professor。':'UC San Diego 化学与纳米工程 Adjunct Professor；NUS 材料科学与工程 Provost’s Chair Professor。',['onu','ocn']),a('research','材料信息学、机器学习原子间势、第一性原理计算及储能材料。',['onu','ouc'])],'追 MIT Senior Research Associate 原始聘用起止、接收组和是否另有博士后聘任。');
 if(id===oc)relation(id,event,'phd',ceder,'advisor',od,ids('oth','onu','ocn'),'Ceder');
}

const td='TUM Asia 任教履历和 NUS 研究生院核 Cambridge 物理博士、NUS 化学系及钙钛矿半导体研究。Cambridge 原始机构库的 2014 年论文列 Tan 和通讯作者 Richard H. Friend 同署 Cavendish Laboratory。合著只支持低可信博士导师候选，签署页及博士后原档待查。';
const tl=src(['NUS 研究生院','tnu'],['TUM Asia 履历','ttu'],['Cambridge 同期论文','tca']);
edge(t,'Zhi Kuang Tan','师承人物 - Richard H. Friend','Richard H. Friend','博士导师候选','博士候选学生',td,tl);
rewrite(pf(t),x=>x.startsWith(boundary),()=>boundary+td+' 本人组网页返回 502，Cambridge 博后线索暂未从可访问原始网页核实。 '+tl);
cell(t,1,'NUS 化学系副教授、太阳能研究所兼任；钙钛矿半导体、光电子器件、量子点');
cell(t,2,'Richard H. Friend（低可信候选，待学位论文）');
cell(t,4,tl);
const ta=audit(t,[a('phd',td,['tnu','ttu','tca'],'group_or_candidate'),a('affiliation','NUS 研究生院列化学系副教授和 Solar Energy Research Institute of Singapore 兼任。',['tnu']),a('research','钙钛矿半导体、发光器件、光电子器件与量子点。',['ttu','tnu'])],'本人组网页退避后复读；追 Cambridge 博士论文签署页和博士后任命。');
relation(t,ta,'phd','师承人物 - Richard H. Friend','candidate',td,ids('tnu','ttu','tca'),'Friend');

const rd='Stony Brook 机构档列材料科学与工程 Senior Research Scientist 及 SiC 生长中心 CoPI。Maryland 托管 2014 年报告者履历列 Stony Brook 2001 年毕业，时任与 Michael Dudley 共事的 Senior Research Scientist 及 BNL 束线研究员。该履历与当前课题支持低可信博士导师候选，博士论文签署页待查；2014 年任职另列研究岗位，博士后经历待查。';
const rl=src(['Stony Brook ResearchConnect','rsc'],['Maryland 托管 2014 报告者履历','rmd']);
const dud=records.get('84e2b85a').filename;
edge(r,'Balaji Raghothamachar',dud,'Michael Dudley','博士导师候选','博士候选学生',rd,rl);
rewrite(pf(r),x=>x.startsWith(boundary),x=>x+' '+rd+' '+rl);
cell(r,1,'Stony Brook ResearchConnect 列 MSE 高级研究员、SiC 生长中心 CoPI；同步辐射 X 射线形貌与半导体晶体缺陷');
cell(r,2,'Michael Dudley（低可信候选，待 2001 学位论文）');
cell(r,4,rl);
const ra=audit(r,[a('phd',rd,['rsc','rmd'],'group_or_candidate'),a('affiliation','Stony Brook ResearchConnect 列 MSE Senior Research Scientist、SiC 晶体生长中心 CoPI；2014 履历另列 BNL 束线任职。',['rsc','rmd']),a('research','同步辐射 X 射线形貌、宽禁带半导体晶体生长及缺陷。',['rmd','rsc'])],'按论文题名查 Stony Brook 2001 论文原卷；待实验室页恢复后读毕业生分类并追博士后任命。');
relation(r,ra,'phd',dud,'candidate',rd,ids('rsc','rmd'),'Dudley');

const pages=[
 [h,'hth','2011 MIT thesis: Certified by Gerbrand Ceder, Thesis Supervisor; acknowledgments also name Ceder as advisor.',hd],
 [h,'huc','2014 UCSD seminar biosketch: FNRS and Marie Curie postdoctoral fellow with Professor Xavier Gonze at UCLouvain.',hp],
 [h,'hpub','2016 coauthored article: FNRS postdoctoral researcher and Marie Curie fellow in Prof. Gonze’s group; appointed Assistant Professor at UCL in 2014.',hp],
 [h,'hxl','Xavier Gonze research group people page lists Geoffroy Hautier among former postdocs.',hp],
 [h,'hri','Rice faculty profile: Trustee Professor, Materials Science and NanoEngineering. PhD MIT 2011 followed by postdoc and faculty appointment at UCLouvain.',hd],
 [oc,'oth','Thesis title and signature page: Shyue Ping Ong, MIT 2011, Gerbrand Ceder, Thesis Supervisor; acknowledgments name thesis advisor.',od],
 [on,'oth','Thesis title and signature page: Shyue Ping Ong, MIT 2011, Gerbrand Ceder, Thesis Supervisor; acknowledgments name thesis advisor.',od],
 [oc,'ouc','UCSD faculty capsule: MIT PhD 2011, subsequently appointed MIT Senior Research Associate.',op],
 [on,'ouc','UCSD faculty capsule: MIT PhD 2011, subsequently appointed MIT Senior Research Associate.',op],
 [t,'tnu','NUSGS: Chemistry associate professor, adjunct researcher appointment at Solar Energy Research Institute of Singapore, PhD University of Cambridge.',td],
 [t,'ttu','TUM Asia faculty biography: Cambridge PhD in Physics; NUS Chemistry group investigates perovskite semiconductor luminescence and optoelectronics.',td],
 [t,'tca','Cambridge institutional copy of 2014 paper: Zhi-Kuang Tan and Richard H. Friend share Cavendish Laboratory address.',td],
 [r,'rmd','2014 Maryland Nanocenter program: Balaji Raghothamachar, Stony Brook graduate 2001 and Senior Research Scientist with Michael Dudley, and BNL beamline scientist.',rd],
].map(([record_id,k,raw,excerpt])=>({record_id,url:u[k],raw,excerpt}));
pages.push({record_id:r,url:u.rla,error:'HTTP 502 Bad Gateway'}, {record_id:h,url:u.hrsc,error:'HTTP 403 Forbidden'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2314_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2314_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2314_学位与任职网页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
