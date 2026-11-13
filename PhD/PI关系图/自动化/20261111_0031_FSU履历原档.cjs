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
 orig.audit_id='pi_archive_20261111_0031_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0031_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"cv":"https://www.chem.fsu.edu/~mattoussi/documents/Mattoussi%20CV.pdf","c22":"https://www.chem.fsu.edu/~mattoussi/documents/Mattoussi%20CV%20Sept%202022.pdf","fsu":"https://www.chem.fsu.edu/person/dr-hedi-mattoussi/","per":"https://www.persee.fr/authority/1655931","bcv":"https://www.chem.cmu.edu/groups/Berry/gcbcv.pdf","cmu":"https://www.chem.cmu.edu/groups/Berry/","um":"https://www.pse.umass.edu/~fkarasz/"};
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



const m='b1e35665', name='Hedi Mattoussi';
const dg='师承人物 - Pierre-Gilles de Gennes', fe='师承人物 - Frank E. Karasz', gb='师承人物 - Guy C. Berry';
const old=src(['本人早期 CV','cv']);
const phd='本人早期 CV 的博士阶段列 P. G. de Gennes 与 M. Veyssie 为 research advisors。法国书目明确将论文指导署为 Madeleine Veyssié，de Gennes 按 CV 记博士阶段研究师长。研究指导的可信度高。';
const mass='本人早期 CV 将 UMass Amherst 1987–1988 职务列为 Postdoctoral Research Associate，明示与 F. E. Karasz 共事；2022 版履历及系页核对任期。博士后阶段研究关系可信度高，正式导师职衔未见。';
const cm='本人早期 CV 记 1989–1992 在 Carnegie Mellon 与 G. C. Berry 工作，职衔 Research Scientist；2022 版 CV 与 FSU 系页列为 Postdoctoral Research Associate。Berry 本人 CV 将 Hedi Mattoussi 列在其博士后名录。按博士后课题组负责人标注，组属可信度高，原件职衔差异保留。';
mentor(fe,'Frank E. Karasz','UMass Amherst 高分子科学与工程教授，Hedi Mattoussi 在博士后任职期的具名合作者。',old);
mentor(gb,'Guy C. Berry','Carnegie Mellon University 化学系的高分子研究者。',src(['Berry 的 Carnegie Mellon 实验室','cmu']));
edge(m,name,dg,'Pierre-Gilles de Gennes','博士阶段研究师长','博士阶段受指导者',phd,old+' · '+src(['法国 Persée 书目','per']));
edge(m,name,fe,'Frank E. Karasz','博士后阶段研究师长','博士后阶段研究者',mass,old+' · '+src(['本人 2022 CV','c22'],['FSU 系页','fsu']));
edge(m,name,gb,'Guy C. Berry','博士后课题组负责人','博士后课题组成员',cm,old+' · '+src(['Berry 本人 CV','bcv'],['本人 2022 CV','c22']));
rewrite(pf(m),x=>x.startsWith(boundary),()=>boundary+'法国 Persée 列 Madeleine Veyssié 正式指导 1987 年论文。本人早期 CV 具名博士阶段研究师长 de Gennes，并列 UMass 与 Karasz、Carnegie Mellon 与 Berry 工作。Berry 本人 CV 核实组属，两个博士后阶段的正式导师职衔待核。 '+src(['Persée','per'],['本人早期 CV','cv'],['本人 2022 CV','c22'],['Berry 本人 CV','bcv']));
insertAfter(pf(m),'## 2026-11-05 再核查','\n- 后续核读取得早期 CV 正文，三人的具体阶段及角色见上方师承。');
cell(m,2,'Madeleine Veyssié（博士导师）；Pierre-Gilles de Gennes（博士阶段研究师长）');
cell(m,3,'Frank E. Karasz（UMass Amherst 博士后阶段研究师长）；Guy C. Berry（Carnegie Mellon 博士后课题组负责人）');
schoolWith(m,old+' · '+src(['Berry 本人 CV','bcv']));
const ma=audit(m,[
 a('identity','两版本人 CV 的教育、任用经历与 FSU 系页对上。',['cv','c22','fsu'],'confirmed'),
 a('affiliation','Florida State University 化学与生物化学系 Distinguished Research Professor。',['fsu'],'confirmed'),
 a('research','胶体无机量子点和纳米材料，表面化学及成像应用。',['fsu'],'confirmed'),
 a('phd',phd,['cv','per'],'confirmed_advisor'),
 a('postdoc',mass+' '+cm,['cv','c22','fsu','bcv'],'group_or_candidate')
],'追 UMass 和 Carnegie Mellon 当期任用文件或项目人员档中具名的正式指导职衔。');
relation(m,ma,'phd',dg,'stage_mentor',phd,ids('cv','per'),'degennes');
relation(m,ma,'postdoc',fe,'stage_mentor',mass,ids('cv','c22','fsu'),'karasz');
relation(m,ma,'postdoc',gb,'group_leader',cm,ids('cv','c22','fsu','bcv'),'berry');
const pages=[
 [m,'cv','Mattoussi’s CV lists P. G. de Gennes and M. Veyssie as doctoral research advisors, and describes work with F. E. Karasz and G. C. Berry during subsequent appointments.','核定博士研究指导及两个博士后阶段的具名工作关系。'],
 [m,'c22','Mattoussi’s 2022 CV lists UMass Amherst and Carnegie Mellon postdoctoral appointments.','用两版履历对照任期和职衔。'],
 [m,'fsu','Florida State’s departmental biography records chemistry faculty appointment, previous postdoctoral appointments, and colloidal inorganic quantum-dot research.','核定院系、研究及两个博士后任用。'],
 [m,'bcv','Guy C. Berry’s CV includes Hedi Mattoussi in the list of postdoctoral associates.','Carnegie Mellon 博士后课题组关系得到独立佐证。'],
 [m,'cmu','Carnegie Mellon archival site identifies Guy C. Berry and his research group.','核对博士后阶段组负责人身份。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:m,url:u.um,error:'502 Bad Gateway; original FSU CV was read and provides phase evidence.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0031_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0031_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0031_FSU履历原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
