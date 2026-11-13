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
 orig.audit_id='pi_archive_20261111_0131_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0131_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"zit":"https://chemistry.mit.edu/chemistry-news/graduate-student-spotlight-julia-zhao/","zyale":"https://zhongpolylab.yale.edu/people/dr-mingjiang-zhong","zeng":"https://engineering.yale.edu/research-and-faculty/faculty-directory/mingjiang-zhong","jl":"https://web.mit.edu/johnsongroup/","lsrf":"https://lsrf.org/alumni-fellows/","bw":"https://artsci.washu.edu/faculty-staff/jonathan-barnes","bn":"https://source.washu.edu/2017/10/barnes-named-packard-fellow/","ucv":"https://www.yumpu.com/en/document/view/11017382/ctirad-uher-international-thermoelectric-society","ual":"https://sites.lsa.umich.edu/uher-lab/alumni/","ti":"https://research.physics.unc.edu/ftsui/mbe/papers/IEEE%20JQuantumElectronics%2018%283%29%201100.pdf","td":"https://research.physics.illinois.edu/Publications/Theses/PhDsThrough2006.htm","tp":"https://research.physics.illinois.edu/Publications/lists/1993.htm","ws":"https://cheme.stanford.edu/events/chemical-engineering-colloquium/rui-wang","tideals":"https://www.ideals.illinois.edu/search?q=Novel%20magnetic%20behavior%20in%20heavy%20rare%20earth%20superlattices","tprl":"https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.72.3084"};
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




const z='69f2a21a', j='71033140', o='9f39f275', b='f1b7f760', t='4df8c19f', h='daaa0cb4', w='6166fb33';
const jf=records.get(j).filename, of=records.get(o).filename, hf=records.get(h).filename;
const zName='Mingjiang Zhong', jName='Jeremiah A. Johnson', oName='Bradley D. Olsen', tName='Frank Tsui', bName='Jonathan Barnes';
const zText='MIT 化学系采访与两组共事的 Julia Zhao，明确说当时的 MIT 博士后 Mingjiang Zhong 由 Bradley D. Olsen 和 Jeremiah A. Johnson 共同指导。本人 Yale 履历给出 2013 年 10 月至 2016 年 6 月的 MIT 博后任期和两位姓名。关系类型可信度：高。';
const zRefs=src(['MIT 化学系访谈原文','zit'],['Yale 本人履历','zyale'],['MIT 课题组档案','jl']);
updateEdge(z,zName,jf,jName,'博士后阶段研究师长','博士后阶段研究者','博士后导师','博士后受指导者',zText,zRefs);
updateEdge(z,zName,of,oName,'博士后阶段研究师长','博士后阶段研究者','博士后导师','博士后受指导者',zText,zRefs);
rewrite(pf(z),x=>x.startsWith(boundary),()=>boundary+'CMU 学位目录列两位博士导师。Yale 本人履历与 MIT 化学系原文核定两位共同博士后导师和具体任期。 '+zRefs);
cell(z,3,'Jeremiah A. Johnson、Bradley D. Olsen（MIT 共同博士后导师，2013.10–2016.06）');
schoolWith(z,src(['MIT 化学系原文','zit'],['Yale 本人履历','zyale']));
const za=audit(z,[
 a('identity','MIT 化学系访谈中的在读者回忆同一个 MIT 博士后及后任 Yale 助理教授经历，Yale 本人履历列同期两位指导者。',['zit','zyale'],'confirmed'),
 a('affiliation','Yale 化学与环境工程、化学及材料科学兼任，2024 年 7 月起 Associate Professor。',['zyale','zeng'],'confirmed'),
 a('research','Yale 本人组及工学院方向为高分子物理、聚合物材料与纳米碳材料。',['zeng'],'confirmed'),
 a('postdoc',zText,['zit','zyale','jl'],'confirmed_advisor')
],'两位博士导师及两位共同博士后导师已核；后续可查当期 MIT 共同任用文件以补充原档。');
relation(z,za,'postdoc',jf,'advisor',zText,ids('zit','zyale','jl'),'johnson');
relation(z,za,'postdoc',of,'advisor',zText,ids('zit','zyale','jl'),'olsen');

const oldJ='师承人物 - Jeremiah Johnson';
const bText='Life Sciences Research Foundation 2014 年 fellowship 名录明确列 Jeremiah Johnson 为 Postdoc Mentor。MIT 课题组公告及原名录核定 Barnes 在该组 2014–2016 博士后，离组后就职 WashU。已确认 fellowship 研究指导；正式 advisor 职衔待核。关系类型可信度：高。';
const bRefs=src(['LSRF 资助机构名录','lsrf'],['MIT 同期公告与课题组名录','jl'],['WashU 教师档','bw']);
const bFrom=who(b,bName);
const newJ=wiki(jf,jName);
rewrite(pf(b),x=>x.startsWith('- 博士后阶段研究师长：')&&x.includes(oldJ),()=>'- 博士后阶段研究师长：'+newJ+'。'+bText+' '+bRefs);
rewrite(index,x=>x.startsWith('- '+bFrom+' → 博士后阶段研究师长：')&&x.includes(oldJ),()=>'- '+bFrom+' → 博士后阶段研究师长：'+newJ+'。'+bText+' '+bRefs);
rewrite(mf(oldJ),x=>x.startsWith('- 博士后阶段受指导者：')&&x.includes(records.get(b).filename),()=>'- 原节点与 '+newJ+' 为同一人，Barnes 的双向关系、任期和原始来源已归入该校属人物页。 '+bRefs);
insertAfter(mf(jf),'## 师承','\n- 博士后阶段受指导者：'+bFrom+'。'+bText+' '+bRefs);
rewrite(pf(b),x=>x.startsWith(boundary),()=>boundary+'WashU 原档确认化学副教授、刺激响应聚合物及超分子组装方向。WashU 校刊称 Fraser Stoddart 为 Northwestern 博士导师。MIT 博后阶段研究师长及任期见上。 '+src(['WashU 教师档','bw'],['WashU 校刊','bn'],['MIT 课题组档案','jl']));
cell(b,3,'Jeremiah A. Johnson（MIT 博士后阶段研究师长，2014–2016）');
rewrite(sl(b),x=>x.startsWith('| [['+records.get(b).filename+'|'),x=>x.replace(/ \| \[WashU\]\(https:\/\/source\.washu\.edu\/2017\/10\/barnes-named-packard-fellow\/\).* \|$/,' | '+src(['WashU 教师档','bw'],['WashU 博士导师来源','bn'],['LSRF 名录','lsrf'],['MIT 课题组档案','jl'])+' |'));
const ba=audit(b,[
 a('identity','MIT 名录明确 2014–2016 博后与随后 WashU 化学教职；LSRF fellow 的学校和邮箱与 WashU 教师档相符。',['jl','lsrf','bw'],'confirmed'),
 a('affiliation','WashU 化学系副教授。',['bw'],'confirmed'),
 a('research','聚合物合成、超分子化学、纳米材料及交联材料设计。',['bw'],'confirmed'),
 a('postdoc',bText,['lsrf','jl','bw'],'group_or_candidate')
],'本人 CV 或 MIT 当期任用文书如使用 advisor/supervisor，可据原文复核角色。');
relation(b,ba,'postdoc',jf,'stage_mentor',bText,ids('lsrf','jl','bw'),'johnson');

const uText='Ctirad Uher 的履历在 Postdoctoral Mentoring 一栏列 F. Tsui，1992–1995 年，去向为北卡罗来纳大学教授。Michigan 原组名录列同一时间与去向。Frank Tsui 的 UNC 托管 IEEE 作者简介独立确认 Michigan Sokol 博后及 1995 年入职 UNC。博士后阶段研究指导可信度高，正式 advisor 职衔待核。';
const uRefs=src(['Uher 本人履历','ucv'],['Michigan 课题组原名录','ual'],['UNC 托管 IEEE 作者简介','ti']);
const tPhd='Illinois 学位目录把 Tien Fang Tsui 的 1992 博士导师列为 C. P. Flynn。Frank Tsui 的 UNC 托管作者简介确认同校 1987 硕士及 1992 博士；Illinois 当期论文目录列 F. Tsui 与 Flynn 的稀土超晶格论文。资料高度吻合，仍待直接连接两个署名的身份材料。';
edge(t,tName,hf,'Ctirad Uher','博士后阶段研究师长','博士后阶段受指导者',uText,uRefs);
rewrite(pf(t),x=>x.startsWith(boundary),()=>boundary+tPhd+' '+uText+' '+src(['Illinois 论文目录','td'],['Illinois 同期文献目录','tp'])+' · '+uRefs);
cell(t,3,'Ctirad Uher（Michigan 博士后阶段研究师长，1992–1995，Sokol Fellow）');
schoolWith(t,uRefs);
const ta=audit(t,[
 a('identity','Frank Tsui 的 UNC 托管 IEEE 作者简介列完整教育轨迹、Sokol fellowship 及现职；学位目录署名 Tien Fang Tsui，直接别名桥接待核。',['ti','td','tp'],'confirmed'),
 a('affiliation','UNC Chapel Hill 物理与天文系；IEEE 作者简介列 1995 入职。',['ti'],'confirmed'),
 a('research','纳米磁性薄膜、磁性异质结构与组合分子束外延。',['ti'],'confirmed'),
 a('phd',tPhd,['td','ti','tp'],'group_or_candidate'),
 a('postdoc',uText,['ucv','ual','ti'],'group_or_candidate')
],'按 Illinois 馆藏论文题名及论文号 1377 追公开原件、首篇文章作者全名或校友 CV 别名，继续追 Michigan Sokol 文件中正式指导称谓。');
relation(t,ta,'postdoc',hf,'stage_mentor',uText,ids('ucv','ual','ti'),'uher');
relation(t,ta,'phd','师承人物 - C. Peter Flynn','candidate',tPhd,ids('td','ti','tp'),'flynn');
const wText='Stanford 化工系报告人履历列 2015–2018 年 MIT 博后期间与 Bradley Olsen、Jeremiah Johnson 共事；Johnson 组记录 Rui Wang、Olsen、Johnson 与 Alfredo Alexander-Katz 的聚合物网络论文。本人 AIChE 摘要仍支持三位博士后合作研究关系；正式 advisor 待具名原档。';
pl(w,boundary,wText+' '+src(['Stanford 化工系报告','ws'],['MIT Johnson 组当期记录','jl']));
schoolWith(w,src(['Stanford 化工系报告','ws']));
audit(w,[a('postdoc',wText,['ws','jl'],'group_or_candidate')],'追 MIT 2015–2018 任用、本人 CV 及具名 sponsor/advisor 的 fellowship 或项目材料。');
const pages=[
 [z,'zit','MIT Chemistry interview with Julia Zhao describes postdoc Mingjiang Zhong as jointly advised by Bradley Olsen and Jeremiah Johnson.','明确两位共同博士后导师。'],
 [z,'zyale','Zhong’s Yale lab biography names the same two people in the October 2013–June 2016 MIT postdoc entry and lists Yale joint appointments.','交叉核实博士后任期、现职和院系。'],
 [z,'jl','MIT Johnson lab lists Zhong as a 2013–2016 postdoc.','复核任期。'],
 [b,'lsrf','LSRF 2014 fellow Jonathan Barnes, Washington University, lists Jeremiah Johnson in the Postdoc Mentor field.','资助方明列博士后研究师长。'],
 [b,'jl','MIT Johnson group archive announced Barnes as a new postdoctoral scholar in February 2014, lists PD 2014–2016, and announced his departure to WashU.','核任期及 MIT 校属导师节点。'],
 [b,'bw','WashU profile lists an associate professorship in chemistry, MIT postdoctoral fellowship, Northwestern PhD, and polymer and supramolecular research.','核对身份、院系及方向。'],
 [t,'ual','University of Michigan Uher alumni roster lists F. Tsui as a 1992–1995 postdoc who went to the University of North Carolina.','独立核组属和任期。'],
 [t,'ucv','Ctirad Uher CV lists F. Tsui under postdoctoral mentoring, 1992–1995, later professor at the University of North Carolina.','核博士后研究指导。'],
 [t,'ti','Frank Tsui’s UNC-hosted IEEE biography reports UIUC physics degrees in 1987 and 1992, a Michigan Sokol postdoctoral fellowship, and a 1995 UNC appointment.','核姓名、学位年份、博后、院系和方向。'],
 [t,'td','Illinois Physics thesis index lists Tien Fang Tsui, physics MS 1987 and PhD 1992, thesis no. 1377, C. P. Flynn as advisor.','博士候选关系保留，别名待核。'],
 [t,'tp','Illinois departmental bibliography lists F. Tsui and C. P. Flynn on rare-earth multilayer work.','提供学位论文主题与缩写署名的追查线索。'],
 [w,'ws','Stanford Chemical Engineering seminar biography dates Rui Wang’s MIT postdoctoral scholarship to 2015–2018 with Bradley Olsen and Jeremiah Johnson.','补博士后合作任期。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:t,url:u.tideals,error:'Web cache miss for IDEALS thesis search; Illinois Physics thesis index was read. The thesis full text and direct link between name variants remain unverified.'});
pages.push({record_id:t,url:u.tprl,error:'Web cache miss for APS publisher abstract; Illinois department contemporary bibliography was read. Authorship remains corroborating context only.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0131_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0131_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0131_MIT与Michigan博士后原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
