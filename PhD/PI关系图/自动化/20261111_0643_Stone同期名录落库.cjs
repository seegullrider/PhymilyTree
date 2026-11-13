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
 orig.audit_id='pi_archive_20261111_0643_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0643_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"old":"https://www.eng.yale.edu/stonegroup/test-page/members.html","newer":"https://www.eng.yale.edu/stonegroup/members.html","clerk":"https://pme.uchicago.edu/directory/aashish-clerk","tureci":"https://turecigroup.princeton.edu/people/hakan-e-t%C3%BCreci","thesis":"https://www.eng.yale.edu/stonegroup/test-page/publications/HakanThesis.pdf#page=18"};
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




const pages=[];
const stone='人员 - Yale - A. Douglas Stone - 6775fd5d', cl='7d5250b1', ht='f9febc7d';
function read(record_id,key,raw){pages.push({record_id,url:u[key],raw,excerpt:raw});}
const cs=src(['Yale 同期旧组名录','old'],['Yale 后期组名录','newer'],['Chicago 院系履历','clerk']);
const ce='Yale 旧组页 Current Members 栏将已获博士的 Aashish Clerk 列在 A. Douglas Stone 组；后期组页将同人列为 Cornell 2001 博士及前组员。Chicago 原履历核 Cornell 2001 毕业后在 Yale 做博士后至 2004。组属有原档交叉支持，正式指导职衔未写。';
updateEdge(cl,'Aashish Clerk',stone,'A. Douglas Stone','博士后课题组候选','博士后课题组候选','博士后课题组负责人','博士后课题组成员',ce,cs);
rewrite(pf(cl),x=>x.startsWith(boundary),()=>boundary+'Cornell 博士导师 Ambegaokar 保留候选，旧馆藏入口已跳转。Yale 博后在 Stone 课题组由同阶段旧原档与校方履历交叉核对，正式博士后导师职衔待查。 '+cs);
cell(cl,3,'A. Douglas Stone（Yale 博后课题组，至 2004；正式导师职衔待核）');
schoolWith(cl,cs);
const ca=audit(cl,[a('postdoc',ce,['old','newer','clerk'],'group_or_candidate')],'查 Cornell 2001 博士论文和 Yale 博后任用档，保留博士候选与博后组属。');
relation(cl,ca,'postdoc',stone,'group_leader',ce,ids('old','newer','clerk'),'stone');
read(cl,'old','旧 Yale Stone 组页 Current Members 栏列 Aashish Clerk (Ph. D.)，与另一原档的 Cornell 2001 PhD 和 Chicago Yale 博后履历交叉对应。');
const htL=src(['Yale 同期旧组名录','old'],['本人 Yale 博士论文致谢','thesis'],['本人 Princeton 组履历','tureci']);
const hte='Yale 旧组页把已获博士的 Hakan E. Türeci 列为 Stone 组 Current Member。本人 2003 学位论文致谢写将继续与 Stone 合作一年，Princeton 本人组页明确先在 Yale 后在 ETH 做博士后。原档共同支持 Yale 博后组属。两校的正式博士后指导职衔待核。';
edge(ht,'Hakan E. Türeci',stone,'A. Douglas Stone','博士后课题组负责人','博士后课题组成员',hte,htL);
pl(ht,boundary,hte+' '+htL);
cell(ht,3,'A. Douglas Stone（Yale 博士后课题组）；ETH 博后指导待核');
schoolWith(ht,htL);
const ha=audit(ht,[a('postdoc',hte,['old','thesis','tureci'],'group_or_candidate')],'核 Yale 与 ETH 博后正式指导文件；已分列博士导师和 Yale 博后课题组。');
relation(ht,ha,'postdoc',stone,'group_leader',hte,ids('old','thesis','tureci'),'stone');
read(ht,'old','Yale Stone 旧组 Current Members 列 Hakan E. Tureci (Ph. D.)；论文致谢与本人 Yale 后接 ETH 博后履历交叉支持分段。');
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0643_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0643_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0643_Stone同期名录原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
