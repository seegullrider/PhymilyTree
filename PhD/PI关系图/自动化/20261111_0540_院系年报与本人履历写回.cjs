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
 orig.audit_id='pi_archive_20261111_0540_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0540_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"mtl":"https://mtlsites.mit.edu/annual_reports/2015/faculty.pdf#page=39","staff":"https://profiles.stanford.edu/kunal-mukherjee","kLab":"https://crystal.stanford.edu/people/kunal-mukherjee","mrs":"https://www.mrs.org/meetings-events/annual-meetings/archive/meeting/presentations/view/2014-mrs-fall-meeting/2014-mrs-fall-meeting-2038621","cv":"https://gorodetskygroup.org/wp-content/uploads/2022/11/Gorodetsky_NIH_Style_CV_11_05_2022.pdf","cal":"https://www.its.caltech.edu/~ccediv/genlist.pdf#page=4","tese":"https://thesis.caltech.edu/5261/","col":"https://www.columbia.edu/cu/chemistry/groups/newsletter/n1/newsletter1/soccer.html","uci":"https://engineering.uci.edu/directory/gorodetsky_alon.php","lab":"https://gorodetskygroup.org/members/"};
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




const k='a9d1ffad', h='师承人物 - Harry L. Tuller';
const kp='2015 年 MIT MTL 年报印刷页 209 的 Tuller 人员档在 Postdoctoral Associates 栏具名 Kunal Mukherjee，直接核实 MIT 博后课题组。Stanford 人物档分别列 2015 MIT 及 2016 IBM Watson 博士后。原 CV 将 MIT 任期标 2014，保留来源年份差异。组属可信度高，MIT 与 IBM 的正式指导职衔均待核。';
const kLinks=src(['MIT MTL 2015 年报印刷页 209','mtl'],['Stanford 人物档','staff'],['本人实验室','kLab']);
for(const [file,match] of [[pf(k),x=>x.startsWith('- 博士后课题组负责人：')&&x.includes(h)],[mf(h),x=>x.startsWith('- 博士后课题组成员：')&&x.includes(k)],[index,x=>x.startsWith('- '+who(k,'Kunal Mukherjee')+' → 博士后课题组负责人：')&&x.includes(h)]])
 line(file,match,' '+kp+' '+kLinks);
pl(k,boundary,'MIT MTL 2015 同期名录核实 Tuller 组的 Postdoctoral Associate 身份。Stanford 人物档核 IBM Watson 博后为 2016 年。 '+kLinks);
cell(k,3,'Harry L. Tuller（MIT 博士后课题组负责人，2015 同期名录）；IBM Watson（2016，导师待核）');
schoolWith(k,kLinks);
const ka=audit(k,[
 a('identity','Stanford 本人组页及官方人物档对应 MIT 2014 材料博士与 NTU、NUS 教育经历，核实其后两处博士后。',['kLab','staff','mtl'],'confirmed'),
 a('affiliation','Stanford 材料科学与工程系助理教授。',['kLab','staff'],'confirmed'),
 a('research','化合物半导体异质外延和缺陷科学，服务电子、光学及量子材料。',['kLab','staff'],'confirmed'),
 a('phd','沿用同期博士论文致谢的 Fitzgerald 组属线索，2014 MRS 条目正文未读；本人博士论文与正式导师字段待核。',['kLab'],'group_or_candidate'),
 a('postdoc',kp,['mtl','staff','kLab'],'group_or_candidate')
],'继续按 2014 MIT 材料系博士档追论文，并查 IBM Watson 2016 博后项目的正式指导。');
relation(k,ka,'postdoc',h,'group_leader',kp,ids('mtl','staff','kLab'),'tuller');
const g='da7c8513', b='师承人物 - Jacqueline K. Barton', n='师承人物 - Colin Nuckolls';
const gPhd='Caltech 2006 年同期名录将 Alon Gorodetsky 列为化学研究生并具名 Barton，CaltechTHESIS 独立列 Jacqueline K. Barton 为 Research Advisor，档案区分 2008 年答辩与 2009 年学位。博士导师可信度高。';
const gPost='本人 CV 列 Caltech 化学博士于 2009 年 6 月完成，Columbia 博士后于 2011 年 9 月完成。CV 说明博士后为化学与电气工程联合 NSF ACC fellowship，2010 Columbia 化学系通讯具名 Nuckolls 组。组属可信度高，正式指导职衔待核。';
const gLinks=src(['本人 CV 第 1 页','cv'],['Columbia 2010 系刊','col'],['本人实验室','lab']);
for(const [file,match] of [[pf(g),x=>x.startsWith('- 博士后课题组负责人：')&&x.includes(n)],[mf(n),x=>x.startsWith('- 博士后课题组成员：')&&x.includes(g)],[index,x=>x.startsWith('- '+who(g,'Alon Gorodetsky')+' → 博士后课题组负责人：')&&x.includes(n)]])
 line(file,match,' '+gPost+' '+gLinks);
pl(g,'- 博士导师：',gPhd+' '+src(['Caltech 2006 名录第 4 页','cal']));
pl(g,boundary,'本人 CV 核 2009–2011 Columbia 化学与电气工程博士后阶段。 '+gLinks);
cell(g,3,'Colin Nuckolls（2009–2011 Columbia 博士后课题组负责人，正式指导待核）');
schoolWith(g,gLinks+' · '+src(['Caltech 学位档','tese'],['Caltech 2006 名录第 4 页','cal']));
const ga=audit(g,[
 a('identity','同期 Caltech 名录、Caltech 学位档、本人 CV 与 UCI 人物档一致。',['cal','tese','cv','uci'],'confirmed'),
 a('affiliation','UCI Chemical and Biomolecular Engineering 副教授，组页另列 Materials Science and Engineering 及 ChAMP。本人 2022 CV 另列材料和化学 0% joint appointment。',['uci','lab','cv'],'confirmed'),
 a('research','仿生自适应光学材料、红外伪装与生物电子。',['uci','lab','cv'],'confirmed'),
 a('phd',gPhd,['cal','tese','cv'],'confirmed_advisor'),
 a('postdoc',gPost,['cv','col','lab'],'group_or_candidate')
],'查 Columbia 化学、电气工程 2009–2011 NSF ACC fellowship 具名指导或任用资料。');
relation(g,ga,'phd',b,'advisor',gPhd,ids('cal','tese','cv'),'barton');
relation(g,ga,'postdoc',n,'group_leader',gPost,ids('cv','col','lab'),'nuckolls');
const pages=[
 [k,'mtl','Harry L. Tuller faculty profile, 2015 MTL research report printed page 209, lists Kunal Mukherjee under Postdoctoral Associates.','以同期原册核 MIT 博后组属。'],
 [k,'staff','Stanford faculty profile lists postdocs at MIT (2015) and IBM TJ Watson (2016) after MIT PhD 2014.','核两处博士后顺序与院系、方向。'],
 [k,'kLab','Stanford lab bio confirms MIT and IBM postdocs and the semiconductor defect/heteroepitaxy research.','核身份与任职。'],
 [g,'cv','Alon A. Gorodetsky CV lists Caltech PhD completion 06/2009, Columbia Chemistry postdoc completion 09/2011 and Chemistry/EE NSF ACC fellowship.','补博士后时间和跨院系。'],
 [g,'tese','CaltechTHESIS names Jacqueline K. Barton as Research Advisor.','区分论文导师与委员会主席。'],
 [g,'cal','The October 2006 CCE listing places Gorodetsky, Alon in Chemistry as a graduate student, with Barton in the Advisor/Supervisor column.','同期博士组属独立补证。'],
 [g,'col','Columbia 2010 chemistry newsletter identifies Alon Gorodetsky as a Nuckolls Group postdoc.','同期组属证据。'],
 [g,'lab','Official laboratory bio identifies UCI CBE and MSE affiliations and Columbia NSF ACC fellowship.','核当前院系及历史博士后。'],
 [g,'uci','UCI Engineering directory identifies Chemical and Biomolecular Engineering associate professor and adaptive materials, camouflage and bioelectronics.','核现任与研究。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:k,url:u.mrs,error:'MRS 会议条目 cache miss，搜索结果仅留作线索。'});
pages.push({record_id:k,url:'https://mtlsites.mit.edu/annual_reports/2015/ar2015.pdf',error:'本地 CLI DNS 无法解析 mtlsites.mit.edu；已核读官方 faculty.pdf 分册原文，第 39 页。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0540_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0540_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0540_MIT年报名册与Columbia博后原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
