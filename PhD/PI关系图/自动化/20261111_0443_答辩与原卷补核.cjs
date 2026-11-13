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
 orig.audit_id='pi_archive_20261111_0443_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0443_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"de":"https://ece.princeton.edu/events/building-quantum-network-nodes-based-neutral-silicon-vacancy-centers-diamond","dl":"https://sites.google.com/view/deleonlab","dp":"https://ece.princeton.edu/news/graduate-commencement-celebrates-critical-contributions-doctoral-and-masters-students","dh":"https://www.a-star.edu.sg/docs/librariesprovider16/events-documents/astar-mini-symposium-on-quantum-scitech-booklet-7-mar-2023-(final_v2).pdf","pt":"https://oaktrust.library.tamu.edu/server/api/core/bitstreams/e48a4db9-e7d2-497c-a745-1bce646e6e48/content","pa":"https://globalfutures.asu.edu/cnce/people/","pn":"https://news.mit.edu/2020/heated-face-mask-coronaviruses-1021","pd":"https://coe.northeastern.edu/event/materials-exhibiting-biomimetic-carbon-fixation-kinetic-analysis-mechanistic-insights-and-material-design/"};
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




const d='b3f015ee', p='c144d193', green='人员 - Texas A&M - Micah Green - 3fdd1d2c';
const dph='Princeton ECE 的 2021 年 7 月 28 日学位活动档及导师组同期新闻确认当天答辩，同一题名在 2022 年 5 月毕业典礼原档的 adviser 栏明列 Nathalie de Leon。A*STAR 会议原册将博士年份列 2021。关系类型可信度高。';
const dlinks=src(['Princeton ECE 学位活动原档','de'],['导师组同期新闻','dl'],['Princeton ECE 毕业名单','dp'],['A*STAR 原册','dh']);
updateEdge(d,'Ding Huang（研究机构组长，高校任职待核）','人员 - Princeton - Nathalie de Leon - 06baa456','Nathalie de Leon','博士导师','博士生','博士导师','博士生',dph,dlinks);
rewrite(pf(d),v=>v.startsWith(boundary),()=>boundary+'答辩日期 2021 年 7 月 28 日，Princeton ECE 典礼日期 2022 年 5 月，A*STAR 原册记 2021 年获博士并加入 IMRE。原册列 2023 Scientist I，尚未发现单列博士后经历，2021 初聘类别待核。草业与语言学的同名记录见既有排除依据。 '+dlinks);
cell(d,2,'Nathalie de Leon（博士导师）；2021-07-28 答辩，2022 年 5 月典礼');
schoolWith(d,src(['Princeton ECE 学位活动原档','de'],['导师组同期新闻','dl']));
const da=audit(d,[a('phd',dph,['de','dl','dp','dh'],'confirmed_advisor')],'继续核实 2021 A*STAR 初聘职称与有无短期博士后，保留答辩、学位和典礼日期口径。');
relation(d,da,'phd','人员 - Princeton - Nathalie de Leon - 06baa456','advisor',dph,ids('de','dl','dp','dh'),'deleon');

const pph='Texas A&M 2016 化学工程学位论文原卷首页署 Micah J. Green 为委员会主席，致谢明确称 Dr. Green 为 advisor 并记其对研究与职业的指导。关系类型可信度高。';
const pdoc='MIT 2020 年校方同期报道具名 Dorsa Parviz 为博士后，ASU 履历明列 Strano 组。继续按 MIT 博士后课题组关系记录。';
const plink=src(['Texas A&M 博士论文原卷','pt'],['Northeastern 本人讲座履历','pd']);
updateEdge(p,'Dorsa Parviz',green,'Micah Green','博士导师','博士生','博士导师','博士生',pph,plink);
rewrite(pf(p),v=>v.startsWith('- 博士关系证据：'),()=>'- 博士关系证据：'+pph+' '+plink);
pl(p,boundary,pdoc+' '+src(['MIT 2020 校方档','pn'],['ASU 研究中心','pa']));
cell(p,2,'Micah J. Green（Texas A&M 2016 化学工程博士论文导师）');
schoolWith(p,plink+' · '+src(['MIT 2020 校方档','pn']));
const pa=audit(p,[a('identity','Texas A&M 论文、Northeastern 履历和 MIT 任用来源均对应同一位化学工程师。',['pt','pn','pd'],'confirmed'),
 a('affiliation','ASU 物质传输与能源工程学院化学工程助理教授。',['pa'],'confirmed'),
 a('research','二维纳米材料、聚合物复合材料及界面物理化学。',['pa','pd','pt'],'confirmed'),
 a('phd',pph,['pt','pd'],'confirmed_advisor'),a('postdoc',pdoc,['pn','pa','pd'],'group_or_candidate')
],'追 MIT Strano 组正式导师称谓与博后起止日期。');
relation(p,pa,'phd',green,'advisor',pph,ids('pt','pd'),'green');
const pages=[
 [d,'de','Princeton ECE event: Building quantum network nodes based on neutral silicon vacancy centers in diamond, Ding Huang, July 28, 2021.','学位论文答辩日期及题名。'],
 [d,'dl','July 28, 2021 lab news: Ding Huang successfully defended the dissertation named in the ECE listing.','确认当天答辩。'],
 [p,'pt','2016 Texas A&M Chemical Engineering dissertation: Chair of Committee Micah J. Green. Acknowledgments identify Dr. Green as advisor.','核原卷及论文导师。'],
 [p,'pn','MIT News in 2020 identifies Dorsa Parviz as a postdoc.','固定博士后日期证据。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0443_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0443_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0443_答辩与原卷回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
