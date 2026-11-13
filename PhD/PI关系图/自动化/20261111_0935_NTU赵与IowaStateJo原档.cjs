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
 orig.audit_id='pi_archive_20261111_0935_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0935_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const z='972b25fe', j='c9a479ce';
const zcv='https://personal.ntu.edu.sg/zhaoyang/CV.html';
const zfac='https://www.ntu.edu.sg/mse/about-us/our-people/faculty-staff';
const za='https://www.ncnr.nist.gov/AnnualReport/FY2010/AR_2010_large.pdf#page=81';
const zf='https://www.ntu.edu.sg/docs/librariesprovider121/news-events-folder/mse-faculty-seminars/seminar_by_assoc_prof_zhao_yang.pdf';
const kl='师承人物 - Katja Lindenberg';
const zz=who(z,'Yang Zhao');
const zl=wiki(kl,'Katja Lindenberg');
const zs='[NTU 托管的本人 CV]('+zcv+')';
const cat=path.join(root,'师承候选线索索引.md');
const t='https://www.graduation.iastate.edu/files/documents/s19/Commencement.Program-Spring.2019.pdf#page=19';
const ca='https://faculty.sites.iastate.edu/canfield/theses';
const mich='https://lsa.umich.edu/physics/people/faculty/nhjo.html';
const als='https://als.lbl.gov/na-hyun-jo-materials-sciences-postdoc/';
const rt='https://regents.umich.edu/files/meetings/09-22/2022-09-IV-1.pdf';
rewrite(pf(z),x=>x.startsWith('- 博士导师候选：'+zl)||x.startsWith('- 博士导师：'+zl),()=>'- 博士导师：'+zl+'。本人 CV 的博士经历明确列 Katja Lindenberg 为导师，并在 Education 栏列 UC San Diego 物理学博士（1994）。关系可信度：高。 '+zs);
rewrite(pf(z),x=>x.startsWith('- 博士导师候选：')&&x.includes('David W. Brown'),x=>x.replace('两人仅为追查对象，正式论文导师字段待查。','本人 CV 明确列 Lindenberg 为博士导师。Brown 保留为早期合著线索，是否另有指导角色待原学位文件核对。')+ (x.includes(zs) ? '' : ' · '+zs));
personLine(z,boundary,' 本人 CV 明确 Rochester 理论中心的负责人是 Joseph Eberly，并称与 Mukamel 和 Knox 共事，继续按博士后研究师长保留两人的关系。 '+zs);
personLine(z,'- 同名排除：',' 2010 年 NIST 中子研究中心年报在 BT-7 仪器名录中也列该同名人员。 [NIST 2010 年原报]('+za+')');
personLine(z,'- NTU 材料科学副教授，',' · [NTU 材料学院现任目录]('+zfac+')');
rewrite(path.join(root,'师承人物',kl+'.md'),x=>x.startsWith('- 博士阶段指导对象候选：'+zz)||x.startsWith('- 博士阶段指导对象：'+zz),()=>'- 博士阶段指导对象：'+zz+'。本人 CV 明确列 Lindenberg 为其 1994 年 UC San Diego 博士导师。 '+zs);
const anchor='- '+zz+' → 博士后阶段研究师长：[[师承人物 - Shaul Mukamel|Shaul Mukamel]]。[来源](https://www.irb.hr/content/download/34753/1640514)';
insertAfter(index,anchor,'- '+zz+' → 博士导师：'+zl+'。本人 CV 明确列其为 UC San Diego 1994 年物理学博士导师。 '+zs);
rewrite(cat,x=>x.startsWith('- '+zz+' → 博士导师候选：'),()=>'- '+zz+' → 博士导师候选：[[师承人物 - David W. Brown|David W. Brown]]。同期合著为追查线索；Katja Lindenberg 已由本人 CV 确认，见师承关系索引。 [本人论文](https://arxiv.org/pdf/cond-mat/9609189) · '+zs);
school(z,'1994 UC San Diego；Brown、Lindenberg 为候选，正式导师待核','Katja Lindenberg（1994 UC San Diego 博士导师）；David W. Brown（博士导师候选）');
schoolSource(z,' · '+zs+' · [NTU 材料学院目录]('+zfac+') · [NIST 2010 年原报]('+za+')');
const az=audit(z,[
 ['identity','本人 CV 的 UC San Diego 博士年份和 NTU 材料学院主页身份对应；2010 NIST 年报 BT-7 名录与 Broholm CV 中去 NIST 的 2008–2010 博后指向另一同名人员。',[zcv,zfac,za],'confirmed'],
 ['affiliation','NTU 材料科学与工程学院目录列 Zhao Yang 为该学院副教授。',[zfac],'confirmed'],
 ['phd','NTU 托管的本人 CV 明列 UC San Diego 1994 物理学博士由 Katja Lindenberg 指导，关系可信度高。David W. Brown 继续保留为同期合著线索，待核是否另有指导角色。',[zcv],'confirmed_advisor'],
 ['postdoc','本人 CV 区分 Trieste 短期停留与 Rochester Theory Center 博士后。Joseph Eberly 为中心负责人，Shaul Mukamel 和 Robert Knox 是本人所列研究合作对象，保留为阶段研究师长。',[zcv]]
],'查 UC San Diego 论文原件以复核其他签署角色；查 Rochester 博后正式导师和 Trieste 职衔。');
relation(z,az,'phd',kl,'advisor','NTU 托管本人 CV 在 UC San Diego 1994 博士经历明确以 advised by 具名 Katja Lindenberg。',[zcv],'lindenberg');
personLine(j,'- 博士阶段课题组负责人：',' Iowa State 2019 春季毕业册将 Jo 列在凝聚态物理专业，论文题名与 Canfield 组档相同。 [Iowa State 毕业册]('+t+')');
personLine(j,boundary,' Iowa State 2019 毕业册与 Canfield 论文目录题名一致。Berkeley Lab 访谈将建议她到 ALS 的博士导师与她随后联系的 Rotenberg 分开叙述，导师姓名仍待论文原件。 [毕业册]('+t+') · [本人 ALS 访谈]('+als+')');
schoolSource(j,' · [Iowa State 毕业册原档]('+t+') · [Michigan 物理系]('+mich+') · [本人 ALS 访谈]('+als+')');
audit(j,[
 ['identity','Michigan 物理系原页的 Iowa State 2019 博士与 Iowa State 典礼册中的姓名和凝聚态论文对应。',[mich,t],'confirmed'],
 ['affiliation','Michigan 物理系原页列 Norman M. Leff Assistant Professor of Physics。保留原应用物理项目归属。',[mich],'confirmed'],
 ['research','Michigan 物理系原页核实验凝聚态和关联拓扑材料。',[mich],'confirmed'],
 ['phd','Iowa State 2019 春季毕业册的凝聚态物理项列出本人论文题名，与 Canfield 组论文目录相符。保留 Canfield 博士阶段组负责人及 Bud\'ko 导师候选。',[t,ca]],
 ['postdoc','本人在 Berkeley Lab ALS 访谈中描述了其博士导师推荐 ALS，随后本人联系 Eli Rotenberg 获得岗位。保留 Rotenberg 博后阶段研究师长。',[als]]
],'找 Iowa State 学位论文封面、Major Professor 栏或致谢，以及 Berkeley Lab 具名博后任用档。Michigan 校董会当前链接 403。');
const pages=[
 {record_id:z,url:zcv,raw:'Zhao’s own NTU-hosted CV explicitly names Katja Lindenberg as his UC San Diego PhD advisor, and lists a 1994 physics PhD. It distinguishes a stay at ICTP from a Rochester postdoc.',excerpt:'明确博士导师，分列 Rochester 博后及 ICTP 停留。'},
 {record_id:z,url:zfac,raw:'NTU Materials Science and Engineering faculty directory lists Zhao Yang as Associate Professor in the school.',excerpt:'复核现任。'},
 {record_id:z,url:zf,error:'Failed to fetch '+zf+': Cache miss'},
 {record_id:j,url:t,raw:'Iowa State spring 2019 commencement, page 19, lists Na Hyun Jo in Condensed Matter Physics and identifies the layered materials dissertation.',excerpt:'核学位、题名与专业；无个人导师字段。'},
 {record_id:j,url:ca,raw:'Canfield’s Iowa State theses page lists Na Hyun Jo and the dissertation Tuning of layered materials, in 2019.',excerpt:'核对同一博士论文。'},
 {record_id:j,url:mich,raw:'U-M Physics names Na Hyun Jo as Norman M. Leff Assistant Professor of Physics; Iowa State PhD 2019; studies correlated topological materials.',excerpt:'核对现任、方向和学位。'},
 {record_id:j,url:als,raw:'Jo’s ALS interview distinguishes the PhD advisor who recommended ALS from Eli Rotenberg, whom she then contacted for a postdoctoral position.',excerpt:'保留研究师长阶段，待具名博后任用原件。'},
 {record_id:j,url:rt,error:'Failed to fetch '+rt+': (403) Forbidden'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0935_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0935_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0935_NTU赵与IowaStateJo原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
