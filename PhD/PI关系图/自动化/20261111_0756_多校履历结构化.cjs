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
 orig.audit_id='pi_archive_20261111_0756_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0756_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"don":"https://phantomsnet.archivephantomsnet.net/EUPHONON/RegEPH/CV/Member_7_CV_donadio.pdf","ud":"https://lettersandsciencemag.ucdavis.edu/news-noteworthy/davide-donadio-named-american-physical-society-fellow-contributions-materials","sg":"https://softmaterials.utk.edu/doc/Sangoro-CV-September-2013.pdf","na":"https://natelson.rice.edu/cv_070122_full_nofunding.pdf","zu":"https://www.zuerchlab.org/wp-content/uploads/2024/02/cv_zuerch-01-2024.pdf"};
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




const d='d23a3101',pa='师承人物 - Michele Parrinello',old='师承人物 - M. Parrinello',ga=records.get('15cdaae3').filename;
const display='Davide Donadio', title=records.get(d).filename;
const ep='本人 CV 列 2003–2006 ETH Zürich 的 M. Parrinello 组博士后；UC Davis 本人采访具名 Michele Parrinello，核对缩写、机构及阶段。组属已核，正式指导称谓待查。';
const dp='本人 CV 以 2007–2008 为 UC Davis Galli 组博士后、2008–2009 为 UC Davis Staff Scientist；UC Davis 访谈概括为后来加入 Galli Group 的 staff scientist。保留两项职务和博士后组属。';
const links=src(['本人 2014 CV','don'],['UC Davis 本人访谈','ud']);
const edgeFrom=who(d,display),oldLink=wiki(old,'M. Parrinello'),newLink=wiki(pa,'Michele Parrinello');
rewrite(pf(d),x=>x.startsWith('- 博士后课题组负责人：')&&x.includes(old),()=>'- 博士后课题组负责人：'+newLink+'。'+ep+' '+links);
rewrite(index,x=>x.startsWith('- '+edgeFrom+' → 博士后课题组负责人：')&&x.includes(old),()=>'- '+edgeFrom+' → 博士后课题组负责人：'+newLink+'。'+ep+' '+links);
rewrite(mf(old),x=>x.startsWith('- 博士后课题组成员：')&&x.includes(title),()=>'- 同一人：'+newLink+'。UC Davis 本人访谈以全名确认 ETH Zürich 博士后组负责人。既有师承见全名页。 '+links);
insertAfter(mf(pa),'## 师承','\n- 博士后课题组成员：'+edgeFrom+'。'+ep+' '+links);
updateEdge(d,display,ga,'Giulia Galli','博士后课题组负责人','博士后课题组成员','博士后课题组负责人','博士后课题组成员',dp,links);
pl(d,boundary,ep+' '+dp+' '+links);
cell(d,3,'Michele Parrinello（ETH Zürich 2003–2006 博士后组）；Giulia Galli（UC Davis 2007–2008 博士后组，2008–2009 另列 Staff Scientist）');
schoolWith(d,links);
const da=audit(d,[a('identity','2003 Milan 材料科学博士、ETH Zürich 组和 UC Davis 本人访谈与 CV 相符。',['don','ud'],'confirmed'),a('affiliation','UC Davis Chemistry。',['ud'],'confirmed'),a('research','原子模拟、结晶、纳米热输运及凝聚相材料。',['ud'],'confirmed'),a('postdoc',ep+' '+dp,['don','ud'],'group_or_candidate')],'查 ETH 与 UC Davis 当期任用中的具体指导称谓，保留两段组属。');
relation(d,da,'postdoc',pa,'group_leader',ep,ids('don','ud'),'parrinello');
relation(d,da,'postdoc',ga,'group_leader',dp,ids('don','ud'),'galli');

for(const [id,mentorFile,kind,key,note,suffix] of [
 ['cdc7dc4f','师承人物 - Friedrich Kremer','stage_mentor','sg','本人 CV 将 Leipzig 2010-05 至 2012-02 列为 Postdoctoral research scientist with Friedrich Kremer，与上方本人博士导师条目分列。','kremer'],
 ['cdc7dc4f','师承人物 - Alexei Sokolov','stage_mentor','sg','本人 CV 将 2012-03 至 2013-07 的 ORNL／UTK 博士后列为 with Alexei Sokolov，另列重叠的 Feodor Lynen 博士后奖助 hosted by Sokolov。','sokolov'],
 ['c969fcac','师承人物 - R. L. Willett','stage_mentor','na','本人 CV 列 1998-10 至 2000-08 Bell Laboratories 的 Postdoctoral Member of Technical Staff with R. L. Willett，确认阶段研究关系。','willett'],
 ['1947e3ef','师承人物 - Christian Spielmann','group_leader','zu','本人 CV 明列 Jena 2014–2015 博士后属于 Christian Spielmann 组，与 2014 博士导师条目分列。','spielmann'],
 ['1947e3ef','师承人物 - Daniel M. Neumark','group_leader','zu','本人 CV 明列 Berkeley 2015–2017 博士后任用在 Daniel M. Neumark 和 Stephen R. Leone 两组。','neumark'],
 ['1947e3ef','人员 - UC Berkeley - Stephen Leone - 9194ca79','group_leader','zu','本人 CV 明列 Berkeley 2015–2017 博士后任用在 Stephen R. Leone 和 Daniel M. Neumark 两组。','leone'],
]){
 const orig=JSON.parse(last.get(id).details_json);
 relation(id,orig.audit_id,'postdoc',mentorFile,kind,note,ids(key),suffix);
}
const pages=[
 [d,'don','Donadio’s own CV lists G. Benedek and M. Bernasconi as the 2003 doctorate supervisors, 2003–2006 ETH postdoctoral fellow in the Parrinello group, 2007–2008 UC Davis postdoctoral fellow in the Galli group and 2008–2009 staff scientist.','学位与博士后组属分列，保留 UC Davis 职务沿革。'],
 [d,'ud','UC Davis interview names Michele Parrinello for ETH Zürich postdoctoral work and describes later work in the Galli group at UC Davis.','全名与旧缩写指向同一人。'],
 ['cdc7dc4f','sg','Sangoro’s CV identifies Friedrich Kremer as doctoral advisor and lists postdoctoral research with Kremer and with Alexei Sokolov in separate entries.','学位和两个博士后阶段分列。'],
 ['c969fcac','na','Natelson’s CV lists PhD advisor D. D. Osheroff and postdoctoral Bell Laboratories research with R. L. Willett.','博士导师和博士后研究师长分列。'],
 ['1947e3ef','zu','Zuerch’s CV distinguishes 2014 doctoral adviser Christian Spielmann, Jena postdoctoral group, and 2015–2017 Berkeley postdoctoral affiliations with the Neumark and Leone groups.','一段学位、两段博士后，分组关系。'],
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
const doctoral=JSON.parse(fs.readFileSync('20261111_0754_既有博士导师结构化.json','utf8'));
for(const x of doctoral){
 if(!pages.some(p=>p.record_id===x.record_id&&p.url===x.sources[0]))pages.push({record_id:x.record_id,url:x.sources[0],raw:x.evidence,excerpt:'既有博士导师原证重核，详细证据见关系事件。'});
}
pages.push({record_id:"d7022134",url:"https://repository.gatech.edu/bitstreams/1963c094-f7a3-4323-9a6a-2c9a8bd5532e/download",error:'403 Forbidden on previously cited Georgia Tech dissertation download; existing relationship was preserved.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0756_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0756_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0756_多校履历结构化复核回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
