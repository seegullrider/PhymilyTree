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
 orig.audit_id='pi_archive_20261111_0024_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0024_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"o":"https://www.bnl.gov/staff/ocko","b":"https://www.bnl.gov/bnlweb/pubaf/bulletin/files/2008/20080926.pdf","gc":"https://www.engineering.columbia.edu/sites/default/files/2024-04/Oleg_CV.pdf","g":"https://www.bnl.gov/staff/ogang","pc":"https://liquids.seas.harvard.edu/sxnspeterindex.html","gp":"https://citeseerx.ist.psu.edu/document?doi=bd9f8f53d8801a65f6fd44c6b0e00d936f6b29a5&repid=rep1&type=pdf","la":"https://www.lassp.cornell.edu/people/john-reppy","aip":"https://history.aip.org/phn/11608026.html","uc":"https://physics.uconn.edu/wp-content/uploads/sites/2234/2018/10/Physics-Newsletter-2004.pdf","aps":"https://journals.aps.org/pr/abstract/10.1103/PhysRev.140.A106","mem":"https://www.annualreviews.org/content/journals/10.1146/annurev-conmatphys-031620-105045","doi":"https://doi.org/10.1146/annurev-conmatphys-031620-105045","ec":"https://xray.engr.wisc.edu/resources/Evans%20short%20CV%202-4-07.pdf","ew":"https://engineering.wisc.edu/directory/profile/paul-evans/","ep":"https://xray.engr.wisc.edu/publications/1042.pdf","et":"https://www.researchgate.net/profile/Paul-Evans-5/3","eh":"https://doi.org/10.1063/1.1315335"};
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


const [g,r,e]=['09de1be5','86d6ff76','ad3e3626'];
const gang='Oleg Gang', reppy='John Reppy（荣休）', evans='Paul Evans';
const ocko='师承人物 - Benjamin M. Ocko', lane='师承人物 - C. T. Lane';
const gol='师承人物 - Jene A. Golovchenko', isa='师承人物 - Eric D. Isaacs';
const pershan='人员 - Harvard - Peter S. Pershan - f4e438b4';
const gEvidence='Ocko 的 Brookhaven 官方履历在 Post-docs supervised 一栏直接列 Oleg Gang；2008 年实验室 Bulletin 对应 2002 年入选 Goldhaber 的 Oleg Gang 并具名 Ocko 为研究指导者；Gang 本人 CV 列 2002–2004。关系类型可信度高。';
const gLinks=src(['Ocko 的 Brookhaven 官方履历','o'],['Brookhaven 原始 Bulletin','b'],['Gang 本人 CV','gc']);
mentor(ocko,'Benjamin M. Ocko','Brookhaven National Laboratory 软凝聚态与界面 X 射线散射研究者。本人实验室档用 Benjamin Ocko，Bulletin 拼作 Benjamen Ocko。',src(['BNL 人员原档','o']));
edge(g,gang,ocko,'Benjamin M. Ocko','博士后导师','博士后研究者',gEvidence,gLinks);
const gEarly='Pershan 本人回忆称 Gang 在其处做 Harvard 博后（1999–2002），Shpyrko 学位论文致谢独立核为 Pershan 同组。Gang 本人 CV 列 2000–2002 Rothschild Fellow。两种起年均保留。Brookhaven Goldhaber 另有 Ocko 指导。';
updateEdge(g,gang,pershan,'Peter S. Pershan','博士后阶段研究师长','博士后阶段研究者','博士后阶段研究师长','博士后阶段研究者',gEarly,src(['Pershan 本人回忆','pc'],['Shpyrko 论文致谢','gp'],['Gang 本人 CV','gc'],['Brookhaven 博后名单','o']));
rewrite(pf(g),x=>x.startsWith(boundary),()=>boundary+'本人 CV 及 Brookhaven 教育档核 2000 Bar-Ilan 博士与论文题名 Surface Ordering in Chain Molecules。Harvard 博后起年 1999／2000 分列。Brookhaven 2002–2004 Goldhaber 博后具名 Ocko。博士正式签署字段和 Harvard 个人正式指导称谓待追。 '+src(['Gang 本人 CV','gc'],['Brookhaven 教育档','g'],['Pershan 本人回忆','pc'],['Brookhaven Bulletin','b']));
cell(g,3,'Peter S. Pershan（Harvard 博士后阶段研究师长，起年 1999／2000）；Benjamin M. Ocko（Brookhaven 2002–2004 博士后导师）');
schoolWith(g,gLinks);
const ga=audit(g,[
 a('affiliation','Columbia Chemical Engineering、Applied Physics and Applied Mathematics 双聘，并任 BNL Center for Functional Nanomaterials 软物质与生物材料团队负责人。',['g','gc'],'confirmed'),
 a('research','软凝聚态、界面与纳米材料自组装。',['g','gc'],'confirmed'),
 a('postdoc',gEvidence+' Harvard Pershan 保留为博士后阶段研究师长，起年 1999／2000 分列。',['o','b','gc','pc','gp'],'confirmed_advisor')
],'查 Bar-Ilan 学位原卷中 Deutsch 正式指导字段及 Harvard Rothschild 博后任用档。');
relation(g,ga,'postdoc',ocko,'advisor',gEvidence,ids('o','b','gc'),'ocko');
relation(g,ga,'postdoc',pershan,'stage_mentor',gEarly,ids('pc','gp','gc'),'pershan');

const rEvidence='AIP Physics History Network 的 Advisors & Collaborators 档明确列 Cecil Taverner Lane 为 Yale 博士导师并对应论文 Behavior of Rotating Liquid Helium；Cornell 履历和 AIP 均列博士授予 1961 年。关系类型可信度高。';
const rLinks=src(['AIP 物理史档案','aip'],['Cornell LASSP','la'],['UConn 旧简报','uc']);
updateEdge(r,reppy,lane,'Cecil Taverner Lane','博士阶段研究师长','博士阶段受指导者','博士导师','博士生',rEvidence,rLinks);
rewrite(pf(r),x=>x.startsWith(boundary),()=>boundary+'AIP 物理史档具名 Yale 博士导师 Lane。AIP 与 Cornell 列 1961 年博士，UConn 旧简报写 1962，保留来源差异。AIP 列 1961–1962 Oxford NSF fellowship，Cornell 列同年 NSF Postdoctoral Fellow；Kurti 继续列候选，回忆正文未读到。 '+src(['AIP 原档','aip'],['Cornell LASSP','la'],['UConn 旧简报','uc'],['本人回忆发表页','mem']));
cell(r,2,'Cecil Taverner Lane（Yale 博士导师；AIP 与 Cornell 记 1961，UConn 旧稿记 1962）');
cell(r,3,'Oxford NSF 1961–1962 博士后；Nicholas Kurti（候选，正式指导待核）');
schoolWith(r,rLinks+' · '+src(['本人回忆发表页','mem']));
const ra=audit(r,[
 a('affiliation','Cornell 物理系 John L. Wetherill 荣休教授。',['la'],'confirmed'),
 a('research','低温物理、超流氦、低维量子流体与临界现象。',['la'],'confirmed'),
 a('phd',rEvidence+' UConn 旧简报列 1962，保留分歧。',['aip','la','uc','aps'],'confirmed_advisor'),
 a('postdoc','AIP 明列 Oxford 1961–1962 NSF Fellow，Cornell 明列同年 NSF Postdoctoral Fellow。Kurti 为先前候选，出版页无可读全文核对。',['aip','la','mem'],'group_or_candidate')
],'查本人回忆可读正文或 Oxford Clarendon 任用档以核 Kurti，继续寻找 Yale 授位原卷。');
relation(r,ra,'phd',lane,'advisor',rEvidence,ids('aip','la','uc'),'lane');

const ePhd='Paul G. Evans 的 Wisconsin 托管本人 CV 同一页列 Harvard 2000 Applied Physics 博士，并明确列 Graduate Advisor: Jene A. Golovchenko。关系类型可信度高。';
const ePost='Evans 本人 CV 明列 Bell Labs 2000–2002 博士后岗位及 Postdoctoral Advisor: Eric D. Isaacs。CV 在导师姓名后列其编制时 Argonne 职衔；2002 年原论文署名两人当时均为 Bell Labs。关系类型可信度高。';
const eLinks=src(['Evans 本人 CV','ec'],['Wisconsin 工学院','ew']);
if(!get(mf(gol)).includes('## 师承')){
 rewrite(mf(gol),x=>x==='## 待核关系',(x,nl)=>'## 师承'+nl+nl+x);
}
edge(e,evans,gol,'Jene A. Golovchenko','博士导师','博士生',ePhd,eLinks);
edge(e,evans,isa,'Eric D. Isaacs','博士后导师','博士后研究者',ePost,eLinks+' · '+src(['2002 Science 原论文','ep']));
rewrite(pf(e),x=>x.startsWith(boundary),()=>boundary+'Wisconsin 工学院确认现任材料科学与工程教授。本人 CV 确认 Harvard 2000 博士、Bell Labs 2000–2002 博士后及两阶段具名导师。Harvard 论文题名 Studies of light emission and epitaxial growth on crystal surfaces 见本人文献列表，论文签署页尚待定位。排除 Manchester 同名的管理学博士。 '+src(['本人 CV','ec'],['现任工学院','ew'],['本人论文书目','et'],['Bell Labs 阶段论文','ep']));
cell(e,1,'Materials Science and Engineering 教授；X 射线散射、氧化物薄膜、铁电材料');
cell(e,2,'Jene A. Golovchenko（Harvard 应用物理 2000 博士导师）');
cell(e,3,'Eric D. Isaacs（Bell Labs 2000–2002 博士后导师）');
schoolWith(e,eLinks+' · '+src(['2002 Science 原论文','ep']));
const ea=audit(e,[
 a('identity','本人 CV、Wisconsin 工学院与 Bell Labs 同期论文对得上，Manchester 管理学同名者排除。',['ec','ew','ep'],'confirmed'),
 a('affiliation','Wisconsin–Madison Materials Science and Engineering 教授。',['ew'],'confirmed'),
 a('research','X 射线散射、外延氧化物薄膜、铁电材料。',['ew'],'confirmed'),
 a('phd',ePhd,['ec','ew'],'confirmed_advisor'),
 a('postdoc',ePost,['ec','ep'],'confirmed_advisor')
],'两阶段导师与院系均核定，可按论文题名补录 Harvard 签署页作独立佐证。');
audits.at(-1).followup_required=false;
relation(e,ea,'phd',gol,'advisor',ePhd,ids('ec','ew'),'golovchenko');
relation(e,ea,'postdoc',isa,'advisor',ePost,ids('ec','ep'),'isaacs');

const pages=[
 [g,'o','BNL profile lists Oleg Gang under Ocko’s supervised postdoctoral researchers.','确认 Ocko 为 BNL 博士后导师。'],
 [g,'b','Goldhaber Symposium 2008 Bulletin lists Oleg Gang as a 2002 fellow with mentor Benjamen Ocko.','项目原档独立核对同一阶段。'],
 [g,'gc','Columbia CV lists Oleg Gang at BNL 2002–2004 and Harvard 2000–2002.','分别核对两个阶段的任期与现任院系。'],
 [g,'gp','Shpyrko’s Harvard dissertation names Pershan as thesis advisor and lists Oleg Gang among his group members.','独立核对 Harvard 博士后组属。'],
 [r,'aip','AIP Physics History Network identifies Cecil Taverner Lane as John Reppy’s Yale PhD advisor and lists Oxford NSF Fellowship.','博士导师及 Oxford 任用可核。'],
 [r,'la','Cornell LASSP lists Yale 1961, NSF Postdoctoral Fellow 1961–1962, and emeritus professorship.','核对学位年、博后职衔及现任。'],
 [r,'mem','Annual Reviews landing page identifies Reppy as author of the autobiographical article; full text is unavailable in this result.','候选原文未读到，不能确证 Kurti。'],
 [e,'ec','Paul Evans lists his Harvard PhD and Bell Labs 2000–2002 postdoc, and names Jene A. Golovchenko and Eric D. Isaacs as advisors for the two stages.','两阶段导师由本人 CV 具名。'],
 [e,'ew','Wisconsin Engineering confirms Harvard PhD in 2000 and Materials Science & Engineering professorship.','院系、身份与研究方向核对。'],
 [e,'ep','Published 2002 Science paper shows Evans and Isaacs with the same Bell Labs affiliation.','核对正式导师关系所在阶段的单位。'],
 [e,'et','Paul Gregory Evans’s own profile lists his Harvard applied physics dissertation title and publication date.','论文题名用于继续寻找签署页。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:r,url:u.doi,error:'Cache miss; publisher landing page exposes abstract and bibliography only'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0024_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0024_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0024_BNL与AIP原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
