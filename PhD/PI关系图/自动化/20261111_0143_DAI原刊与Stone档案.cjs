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
 orig.audit_id='pi_archive_20261111_0143_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0143_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"kbook":"https://books.google.com/books?id=uCZUAAAAYAAJ&focus=searchwithinvolume&q=Kingon","kbrown":"https://engineering.brown.edu/people/angus-kingon","kbio":"https://vivo.brown.edu/display/aikingon","kcv":"https://vivo.brown.edu/docs/a/aikingon_cv.pdf?dt=251910191","kpaper":"https://ceramics.onlinelibrary.wiley.com/doi/10.1111/j.1151-2916.1983.tb10564.x","kitc":"https://www.usitc.gov/intellectual_property/documents/pub2964.pdf","dbook":"https://books.google.com/books?id=-YQvAQAAIAAJ&focus=searchwithinvolume&q=Chrzan","dlbl":"https://materialssciences.lbl.gov/profile/dcchrzan/","dpeople":"https://digital.library.unt.edu/ark%3A/67531/metadc1205254/m2/1/high_res_d/6421936.pdf","dfree":"https://site.physics.georgetown.edu/~jkf/publications/phd_thesis.pdf","dw":"https://curricularconnections.berkeley.edu/wp-content/uploads/2023/09/FSS_Brochure_Spring_2008.pdf","stone":"https://collaborate.princeton.edu/en/publications/interfaces-in-fluid-mechanics-and-across-disciplines/","wjfi":"https://jamesfranckinstitute.uchicago.edu/people/profile/wendy-zhang/","wch":"https://chronicle.uchicago.edu/060316/sloan.shtml","waps":"https://physics.aps.org/story/v4/st9"};
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




const k='f999ab1f', d='1b58446a', w='7cc33b57', s='419add8c';
const kn='Angus I. Kingon', dn='Daryl Chrzan', wn='Wendy Zhang';
const sch='师承人物 - Casper Jan Hendrik Schutte', fal='师承人物 - Leo M. Falicov', sf=records.get(s).filename;
const kText='University Microfilms 出版的 Dissertation Abstracts International B（1984）第 2518 页原刊扫描，列完整作者 Angus Ian Kingon、University of South Africa 及题名 Studies in the Preparation and Characterization of Selected Ferroelectric Materials，Promoter 栏具名 Professor C. J. H. Schutte。原刊列 1982 年，Kingon 1983 年同期论文参考文献和 USITC 原档列 1981 年。保留两种年份。关系类型可信度：高。';
const kSources=src(['DAI 第 2518 页扫描','kbook'],['1983 论文与参考文献','kpaper'],['USITC 原案卷','kitc']);
updateEdge(k,kn,sch,'Casper Jan Hendrik Schutte','博士候选关系','博士候选研究者','博士导师','博士生',kText,kSources);
rewrite(pf(k),x=>x.startsWith(boundary),(line)=>line.replace('1981 年获 University of South Africa 物理化学博士；Schutte 保留候选，待核论文原件。','University of South Africa 物理化学博士。原刊 Promoter 已核为 Schutte。').replace('Schutte 仍列候选，目录或论文签署页待查。','原刊学位条目列 1982，1981／1982 保留待论文签署页和大学学位登记核日期。')+' '+kSources);
cell(k,2,'Casper Jan Hendrik Schutte（University of South Africa 博士导师，DAI Promoter；1981／1982 年份差异待核）');
schoolWith(k,src(['DAI 第 2518 页扫描','kbook']));
const ka=audit(k,[
 a('identity','DAI 的完整人名、学校、论文题名与 Kingon 自引及 Brown 工程学院档对应。',['kbook','kpaper','kbrown'],'confirmed'),
 a('affiliation','Brown 工程学院任用及学术履历可由本人档复核。',['kbrown','kbio'],'confirmed'),
 a('research','既有铁电材料、功能氧化物及电子薄膜方向与本人履历和铁电体原论文相符。',['kpaper','kcv'],'confirmed'),
 a('phd',kText,['kbook','kpaper','kitc'],'confirmed_advisor')
],'以 University of South Africa 毕业册或论文签署页查 1981／1982 年差异，继续分开追 Penn State 与 NC State 两段博士后任期和指导。');
relation(k,ka,'phd',sch,'advisor',kText,ids('kbook','kpaper','kitc'),'schutte');

const dText='University Microfilms 的 Dissertation Abstracts International B（1990）第 2432 页原刊扫描，将 Magnetic properties of surfaces and interfaces 列于 Daryl Christofer Chrzan、University of California, Berkeley, 1989，并具名 L. M. Falicov 为 Chair。LBL 同期项目档与 Freericks 本人博士论文致谢独立确认 Chrzan 在 Falicov 博士课题组。以学位委员会主席作为正式博士指导记录，关系类型可信度：高。';
const dSources=src(['DAI 第 2432 页扫描','dbook'],['LBL 项目档','dpeople'],['Freericks 博士论文','dfree']);
updateEdge(d,dn,fal,'Leo M. Falicov','博士阶段课题组负责人','博士课题组成员','博士导师','博士生',dText,dSources);
rewrite(pf(d),x=>x.startsWith(boundary),(line)=>line.replace('博士导师和是否有博士后尚需追查。','论文委员会主席已核，是否有单列博士后尚需追查。').replace('博士论文候选题名为《Magnetic properties of surfaces and interfaces》。二手索引提示 Falicov 为 Chair，DAI 原卷与 Berkeley 目录链接未读取，保留为检索线索。LBL 同期报告原件将 Chrzan 和 Falicov 均列 UC Berkeley 物理系及 LBL，既有课题组证据保留，论文签署及正式指导待核。','DAI 原刊扫描核对论文题名及 Falicov 的 Chair 称谓；原先的 LBL 组属及 Freericks 论文证据仍可交叉核对。')+' '+dSources);
cell(d,2,'Leo M. Falicov（博士论文委员会主席，1989 Berkeley 物理）');
schoolWith(d,src(['DAI 第 2432 页扫描','dbook']));
const da=audit(d,[
 a('identity','DAI 完整作者名、Berkeley 学位年份及题名与 LBNL 人物档的 1989 凝聚态理论博士履历对应。',['dbook','dlbl'],'confirmed'),
 a('affiliation','Berkeley 材料科学与工程教授、LBNL 联合任用，Electronic Materials Program。',['dlbl'],'confirmed'),
 a('research','凝聚态理论及计算材料科学，方向见 LBNL 本人简介及学校材料档案。',['dlbl'],'confirmed'),
 a('phd',dText,['dbook','dpeople','dfree','dlbl'],'confirmed_advisor')
],'追 Sandia 1989–1990 任命原档及是否单列博士后；1990–1995 Senior Member of the Technical Staff 履历继续保留。');
relation(d,da,'phd',fal,'advisor',dText,ids('dbook','dpeople','dfree','dlbl'),'falicov');

const wText='Howard A. Stone 本人回顾论文致谢将 Wendy Zhang 列入自己的学生，并把博士后另列。Chicago 校刊核其 Harvard 工程科学博士，1999 年 APS 同期报道核其当时在 Harvard 研究液滴断裂。记录博士阶段研究指导；学位论文正式导师字段待查。关系类型可信度：高。';
const wSources=src(['Stone 回顾论文原致谢','stone'],['Chicago 校刊','wch'],['APS 同期报道','waps']);
edge(w,wn,sf,'Howard A. Stone','博士阶段研究师长','博士阶段受指导者',wText,wSources);
pl(w,boundary,wText+' '+wSources+' '+src(['Chicago JFI 教师档','wjfi']));
cell(w,2,'Howard A. Stone（Harvard 博士阶段研究师长，论文导师字段待核）');
schoolWith(w,src(['Stone 论文原致谢','stone'],['Chicago JFI 人物档','wjfi']));
const wa=audit(w,[
 a('identity','Chicago 教师档、校刊与 APS 当期 Harvard 报道将同一流体理论研究者的姓名、阶段和方向交叉核对。',['wch','wjfi','waps'],'confirmed'),
 a('affiliation','University of Chicago 物理系 Associate Professor，James Franck Institute。',['wjfi'],'confirmed'),
 a('research','用理论及模拟研究软凝聚态、液滴冲击、复杂流体和颗粒流。',['wjfi'],'confirmed'),
 a('phd',wText,['stone','wch','waps'],'group_or_candidate'),
 a('postdoc','Chicago 校刊区分 JFI 与 UT Austin Center for Nonlinear Dynamics 博士后；各自具名指导待查。',['wch'],'unresolved')
],'找 Harvard 论文题名、签署页以及 Chicago 和 UT Austin 两段博士后任用或同组自述。');
relation(w,wa,'phd',sf,'stage_mentor',wText,ids('stone','wch','waps'),'stone');

const pages=[
 [k,'kbook','Manually read the published 1984 Dissertation Abstracts International B scan, p. 2518. The entry for Angus Ian Kingon and Studies in the Preparation and Characterization of Selected Ferroelectric Materials records University of South Africa, 1982, and Professor C. J. H. Schutte as promoter.','原刊扫描核博士导师，并保留校档和自引的 1981 日期。'],
 [k,'kbrown','Brown School of Engineering faculty profile identifies Angus Kingon.','核学校身份。'],
 [d,'dbook','Manually read the published 1990 Dissertation Abstracts International B scan, p. 2432. Magnetic properties of surfaces and interfaces is by Daryl Christofer Chrzan, University of California, Berkeley, 1989. L. M. Falicov is named as chair.','原刊扫描核 Berkeley 学位论文的委员会主席。'],
 [d,'dlbl','LBNL profile records Daryl C. Chrzan’s 1989 UC Berkeley physics PhD, post-degree Sandia Computational Materials Science Group position, Berkeley faculty and LBNL joint appointment.','核姓名、学位、任用和方向。'],
 [w,'stone','Stone’s first-person article acknowledges Wendy Zhang among his students and lists postdoctoral scholars separately.','博士阶段研究指导，与博后名单分开。'],
 [w,'wch','UChicago Chronicle identifies Wendy Zhang as a Harvard Engineering Sciences PhD and former JFI and UT Austin postdoctoral fellow.','核博士及两个博士后阶段。'],
 [w,'wjfi','James Franck Institute lists Wendy Zhang as an associate professor of physics studying far-from-equilibrium fluid flow, soft condensed matter and geophysical systems.','核院系和研究方向。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0143_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0143_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0143_DAI原刊与Stone原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
