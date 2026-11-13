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
 orig.audit_id='pi_archive_20261111_0304_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0304_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"jia":"https://stacks.stanford.edu/file/cf041xr2428/mainthesis%20%282%29-augmented.pdf","jp":"https://purl.stanford.edu/cf041xr2428","jc":"https://searchworks.stanford.edu/view/10608120","jcv":"https://web.stanford.edu/~chunjing/","li":"https://stacks.stanford.edu/file/zg142pp6616/thesis-augmented.pdf","lp":"https://purl.stanford.edu/zg142pp6616","lc":"https://searchworks.stanford.edu/view/11849306","lg":"https://sites.google.com/umich.edu/li-research-group/members"};
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




const j='43e55cbe', jn='Chunjing Jia', dev='人员 - Stanford - Thomas Devereaux - 4eedb35a', shen='人员 - Stanford - Zhi-Xun Shen - 177eaec9';
const jd='Stanford 2014 博士论文第 iii 页明确列 Thomas Devereaux 为 Primary Adviser。第 vii 页致谢亦明称其为 research advisor。可信度高。';
const js='Stanford 2014 博士论文第 iii 页明确列 Zhi-Xun Shen 为 Co-Adviser；第 vii 页致谢说明其共同指导。Stanford 书目原将两人均列 primary，角色采用论文签署页。可信度高。';
const jl=src(['Stanford 论文原件','jia'],['Stanford 仓储','jp']);
updateEdge(j,jn,dev,'Thomas Devereaux','博士导师','博士生','博士导师','博士生',jd,jl);
updateEdge(j,jn,shen,'Zhi-Xun Shen','博士导师','博士生','博士导师','博士生',js,jl);
rewrite(pf(j),x=>x.startsWith(boundary),()=>boundary+'第 iii 页确立主导师 Thomas Devereaux 与共同导师 Zhi-Xun Shen。Xiaoliang Qi 为审阅签署人，致谢还列其为答辩委员。本人 Stanford 履历将 2015 年 2 月起与 Devereaux 工作的博士后阶段单列，正式博士后导师职衔待核。 '+jl+' · '+src(['本人 Stanford 履历','jcv']));
cell(j,2,'Thomas Devereaux（论文主导师）、Zhi-Xun Shen（共同导师）；Xiaoliang Qi（审阅签署人、答辩委员）');
schoolWith(j,jl);
const je=audit(j,[a('phd',jd+' '+js+' Xiaoliang Qi 为审阅签署人及答辩委员。',['jia','jp','jc'],'confirmed_advisor')],'博士论文导师及审阅角色已按签署页区分；继续查 Stanford 博士后正式任用指导。');
relation(j,je,'phd',dev,'advisor',jd,ids('jia','jp'),'devereaux');
relation(j,je,'phd',shen,'advisor',js,ids('jia','jp'),'shen');

const l='73a5677d', ln='Yiyang Li', ch='人员 - Stanford - William Chueh - 3f3ae1fa', cui='师承人物 - Yi Cui';
const lch='Stanford 2016 博士论文第 iii 页明确列 William Chueh 为 Primary Adviser，致谢亦明称其为 adviser。可信度高。';
const lyi='博士论文第 vii 页致谢明确称 Yi Cui 为 mentor，记录博士阶段研究师长。第 iii 页与致谢另确认 Yi Cui 是论文审阅委员。';
const ll=src(['Stanford 论文原件','li'],['Stanford 仓储','lp']);
updateEdge(l,ln,ch,'William Chueh','博士导师','博士生','博士导师','博士生',lch,ll);
edge(l,ln,cui,'Yi Cui','博士阶段研究师长','博士阶段受指导者',lyi,ll);
rewrite(pf(l),x=>x.startsWith(boundary),()=>boundary+'签署页列 Chueh 为博士论文主导师，Yi Cui 与 Alberto Salleo 为审阅签署人。第 vii 页致谢确认 Cui 另提供研究指导，Salleo 亦参加口试；Paul McIntyre 为学业导师。Alec Talin 保留 Sandia 博后阶段研究师长，正式任用指导待核。注意 Notre Dame 同名者。 '+ll);
cell(l,2,'William Chueh（论文主导师）；Yi Cui（研究师长、审阅委员）；Alberto Salleo（审阅及口试委员）');
schoolWith(l,ll);
const le=audit(l,[a('phd',lch+' '+lyi+' Alberto Salleo 为审阅及口试委员；Paul McIntyre 负责学业指导。',['li','lp','lc'],'confirmed_advisor')],'继续查 Sandia Truman Fellowship 博后任用的具名个人指导。');
relation(l,le,'phd',ch,'advisor',lch,ids('li','lp'),'chueh');
relation(l,le,'phd',cui,'stage_mentor',lyi,ids('li','lp'),'cui');

const pages=[
 {record_id:j,url:u.jia,raw:'Stanford PhD 2014, Chunjing Jia, Numerical Studies of Inelastic Light Scattering in Correlated Materials. PDF p.3 (iii): Thomas Devereaux, Primary Adviser; Zhi-Xun Shen, Co-Adviser; Xiaoliang Qi reading certification. PDF p.7 acknowledges Qi on defense committee and Shen coadvising. SHA-256 b1b345f98412c09291dfbcc2d66e345cb8988d33ede46ddeb47ec609adee6475.',excerpt:'直接核读论文签署页及致谢；修正目录双 primary 字段。'},
 {record_id:l,url:u.li,raw:'Stanford PhD 2016, Yiyang Li, Nanoscale Reaction, Transport, and Phase Transformation in LixFePO4 Battery Electrodes. PDF p.3 (iii): William Chueh, Primary Adviser; Yi Cui and Alberto Salleo reading certifications. PDF p.7: Yi Cui mentor and reader, Alberto Salleo oral and reading committee, Paul McIntyre academic adviser. SHA-256 ca6b0bda5b8b107e657eb5df5acdbd5451cffcb030812d17ccfa90697822664e.',excerpt:'直接核读论文签署页及致谢；明确一般 advisor 字段的角色。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0304_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0304_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0304_Jia与Li论文签署页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
