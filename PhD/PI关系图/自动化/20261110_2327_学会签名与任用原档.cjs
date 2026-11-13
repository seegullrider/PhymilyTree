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
 orig.audit_id='pi_archive_20261110_2327_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2327_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"sd":"https://ceder.berkeley.edu/theses/Wenhao_Sun_2016.pdf","sp":"https://eta.lbl.gov/news/mining-data-quantify-thermodynamics","sm":"https://lsa.umich.edu/appliedphysics/people/faculty/whsun.html","jc":"https://www.duffield.cornell.edu/people/julia-dshemuchadse/","jd":"https://dgk-home.de/wp-content/uploads/2012/02/Heft-45-ONLINE1.pdf","ji":"https://dgk-home.de/meet-the-people-julia-dshemuchadse/","jg":"https://glotzerlab.engin.umich.edu/people/alumni/","jt":"https://doi.org/10.3929/ethz-a-009795588","jl":"https://capecrystal.mse.cornell.edu/group/julia-dshemuchadse/","ye":"https://physics.emory.edu/people/bios/wang-yao.html","yd":"https://web.stanford.edu/group/photontheory/personnel.html","yp":"https://www.mph-quantum.mpg.de/12380/mphq-exchanges","yv":"https://scienceweb.clemson.edu/yaowang/wp-content/uploads/sites/9/2021/12/CV-Yao-Wang.pdf","yk":"https://www.kcl.ac.uk/people/yao-wang","mc":"https://www.cmu.edu/physics/people/faculty/documents/majetich_cv.pdf","mq":"https://www.pqi.org/people/sara-majetich"};
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
const [s,j,y,m]=['c71c408d','42b6e9e2','52cfd31c','0370fa14'];
const ceder='师承人物 - Gerbrand Ceder';
const sd='MIT 2016 博士论文签署页与致谢具名 Gerbrand Ceder 为 Thesis Supervisor 及 advisor。论文研究晶体材料合成中的亚稳相。可信度高。';
const sp='LBL 同期原报道明确记 Sun 是在 Gerbrand Ceder 处研究的博士后。Michigan Applied Physics 履历将 2016–2018 LBL 博后和 2019 Staff Scientist 分列。保留博士后阶段研究师长，正式任用指导称谓待核。';
const slinks=src(['MIT 博士论文','sd'],['Berkeley Lab 同期报道','sp'],['Michigan Applied Physics 履历','sm']);
updateEdge(s,'Wenhao Sun',ceder,'Gerbrand Ceder','博士导师','博士生','博士导师','博士生',sd,src(['MIT 博士论文','sd']));
updateEdge(s,'Wenhao Sun',ceder,'Gerbrand Ceder','博士后研究师长','博士后阶段研究成员','博士后阶段研究师长','博士后阶段研究成员',sp,slinks);
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+sd+' '+sp+' '+slinks);
cell(s,2,'Gerbrand Ceder（MIT 2016 博士论文导师）');
cell(s,3,'Gerbrand Ceder（LBL 2016–2018 博士后阶段研究师长）；2019 Staff Scientist 单列');
schoolWith(s,slinks);
const sa=audit(s,[a('phd',sd,['sd'],'confirmed_advisor'),a('postdoc',sp,['sp','sm'],'group_or_candidate'),a('affiliation','Michigan 工学院材料科学与工程，参与 Applied Physics 项目。',['sm']),a('research','计算材料科学、无机材料合成、亚稳晶体与热力学。',['sm','sd'])],'查 LBL 博后聘任原件和个人指导角色。');
relation(s,sa,'phd',ceder,'advisor',sd,ids('sd'),'Ceder_PhD');
relation(s,sa,'postdoc',ceder,'stage_mentor',sp,ids('sp','sm'),'Ceder_Postdoc');

const ws='师承人物 - Walter Steurer';
const jd='Steurer 在 2015 德国晶体学会授奖致辞署名明确说 Julia Dshemuchadse 的 ETH 晶体学实验室博士论文由自己指导（unter meiner Leitung），2013 年完成。该文把 TU Dresden Diplomarbeit 与博士分列，Dirk C. Meyer 和 Tilmann Leisegang 对应更早学位。可信度高。';
const jp='Steurer 同一署名致辞记其获博士学位后继续在自己研究所任博士后两年，研究金属间化合物，保留 ETH 博士后阶段研究师长。Cornell 工程学院和 DGK 访谈核其后赴 Michigan 的 SNSF 博后。Glotzer 组原有归属保留，本轮组页 403，正式博后指导尚待原始任命。';
const jl=src(['Walter Steurer 署名授奖致辞，第 62–63 页','jd'],['Cornell 工程学院','jc'],['德国晶体学会本人访谈','ji']);
updateEdge(j,'Julia Dshemuchadse',ws,'Walter Steurer','博士导师','博士生','博士导师','博士生',jd,jl);
updateEdge(j,'Julia Dshemuchadse',ws,'Walter Steurer','博士后研究师长','博士后阶段研究者','博士后阶段研究师长','博士后阶段研究者',jp,jl);
rewrite(pf(j),x=>x.startsWith(boundary),()=>boundary+jd+' '+jp+' '+jl);
cell(j,2,'Walter Steurer（ETH 2013 博士论文导师）');
cell(j,3,'Walter Steurer（ETH 约两年博后阶段研究师长）；Sharon Glotzer（Michigan 博后组属）');
schoolWith(j,jl);
const ja=audit(j,[a('phd',jd,['jd','jc'],'confirmed_advisor'),a('postdoc',jp,['jd','jc','ji'],'group_or_candidate'),a('affiliation','Cornell 材料科学与工程副教授。',['jc']),a('research','复杂晶体、软凝聚态、自组装与计算材料。',['jc','ji'])],'核 ETH 和 Michigan 博后任用时段及正式个人指导称谓，ETH 论文馆藏回读。');
relation(j,ja,'phd',ws,'advisor',jd,ids('jd','jc'),'Steurer_PhD');
relation(j,ja,'postdoc',ws,'stage_mentor',jp,ids('jd','jc','ji'),'Steurer_Postdoc');

const dt=records.get('4eedb35a').filename,ed=records.get('d37c6cf8').filename;
const yId='King’s College London 工程系同名者正在进行 Marco Di Renzo 指导的博士研究，方向为无线通信。Emory 的 Yao Wang 2017 年已获 Stanford 应用物理博士，曾任 Clemson 物理与天文学教师，后任 Emory 化学系副教授及物理研究生项目成员。二者为不同人。';
const yd='Stanford Devereaux 组原名录列 Yao Wang 为 former graduate student，去向 Clemson；本人 Clemson CV 与 Emory 系档核同一人 2017 Stanford 应用物理博士。记博士课题组负责人，正式论文导师职衔待核。';
const yp='Emory 档和本人 Clemson CV 核 2017–2020 Harvard MPHQ 博后。MPHQ 原交流记录明确称其为 Eugene Demler 组 Fellow。记博士后课题组负责人，正式个人指导职衔待核。';
const yl=src(['Emory 物理项目','ye'],['本人 Clemson CV','yv'],['Stanford Devereaux 组','yd'],['Max Planck–Harvard 原档','yp']);
updateEdge(y,'Yao Wang',dt,'Thomas Devereaux','博士课题组负责人','博士课题组成员','博士课题组负责人','博士课题组成员',yd,yl);
updateEdge(y,'Yao Wang',ed,'Eugene Demler','博士后课题组负责人','博士后课题组成员','博士后课题组负责人','博士后课题组成员',yp,yl);
pl(y,boundary,yId+' '+src(['KCL 同名者原档','yk'],['Emory 本人档','ye']));
schoolWith(y,yl);
const ya=audit(y,[a('identity',yId,['yk','ye','yv']),a('phd',yd,['yd','ye','yv'],'group_or_candidate'),a('postdoc',yp,['yp','ye','yv'],'group_or_candidate'),a('affiliation','Emory 化学系副教授及物理研究生项目成员。',['ye']),a('research','凝聚态理论、量子多体、光谱与量子材料。',['ye','yd'])],'查 Stanford 论文签署页和 Harvard 博后个人任命。KCL 同名网页从该记录退出。');
relation(y,ya,'phd',dt,'group_leader',yd,ids('yd','ye','yv'),'Devereaux');
relation(y,ya,'postdoc',ed,'group_leader',yp,ids('yp','ye','yv'),'Demler');

const mp='本人 CMU CV 将 1987 年 11 月至 1988 年 6 月 Cornell Postdoctoral Associate 与 1988 年 6 月至 1990 年 6 月 Research Associate 分列，另核 1987 年 9 月 University of Georgia 博士。Cornell 个人指导者待原档。';
const ml=src(['本人 CMU CV','mc']);
pl(m,boundary,mp+' '+ml);
cell(m,3,'Cornell Postdoctoral Associate（1987-11 至 1988-06）；Cornell Research Associate（1988-06 至 1990-06）；导师待核');
schoolWith(m,ml);
audit(m,[a('postdoc',mp,['mc']),a('affiliation','CMU 物理主聘，电气与计算机工程及材料科学与工程 courtesy 任用。',['mc'])],'查 University of Georgia 学位档和 Cornell 1987–1988 博士后任用指导。');

const pages=[
 [s,'sd','MIT Wenhao Sun 2016 PhD thesis lists Gerbrand Ceder as Thesis Supervisor on signature page and advisor in acknowledgements.',sd],
 [s,'sp','Berkeley Lab article identifies Wenhao Sun as a postdoctoral fellow working with Gerbrand Ceder.',sp],
 [s,'sm','U-M lists 2016–2018 LBL postdoc, 2019 LBL Staff Scientist, and 2016 MIT PhD.',sp],
 [j,'jd','2015 DGK-Mitteilungen 45, pp. 62–63, Walter Steurer signs the statement that he directed her ETH doctorate, then she held two further years as a postdoc at his institute.',jd+' '+jp],
 [j,'jc','Cornell Engineering lists MSE appointment, ETH doctorate on complex intermetallics, and SNSF postdoctoral research at Michigan.',jp],
 [j,'ji','DGK interview describes ETH doctoral work in crystallography and Michigan Chemical Engineering/Biointerfaces SNSF postdoctoral work.',jp],
 [y,'ye','Emory Physics graduate program lists Yao Wang as Chemistry Associate Professor and Harvard MPHQ postdoctoral fellow in 2017–2020.',yp],
 [y,'yd','Devereaux group roster identifies Yao Wang as former graduate student with later Clemson affiliation.',yd],
 [y,'yp','MPHQ exchange report identifies Yao Wang as a Fellow in Eugene Demler’s group.',yp],
 [y,'yv','Clemson-hosted CV lists 2017 Stanford Applied Physics PhD, Harvard Physics postdoctoral appointment and Clemson faculty role.',yd],
 [m,'mc','CMU CV p. 1 lists 1987–88 Cornell Postdoctoral Associate, 1988–90 Cornell Research Associate, 1987 Georgia PhD.',mp]
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:j,url:u.jl,error:'HTTP 502 Bad Gateway'},{record_id:j,url:u.jg,error:'HTTP 403 Forbidden'},{record_id:j,url:u.jt,error:'URL not accessible via web tool'});
const exclusions=[{page_id:'b6ca23091d886f5baf5e900c',record_id:y,audit_id:ya,url:u.yk,external_subject:'Yao Wang（King’s College London 工程系在读博士）',evidence:yId}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length,exclusions:exclusions.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2327_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2327_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const ex='20261110_2327_KCL同名网页归属纠偏.json';
persist(ex,exclusions);
call('人物网页身份纠偏.cjs',[ex]);
const receipt='20261110_2327_学会签名与任用回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
