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
 orig.audit_id='pi_archive_20261111_0006_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0006_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"sun":"https://www.rfsuny.org/media/rfsuny/documents/Program-Book.pdf","law":"https://www.lassp.cornell.edu/people/michael-lawler","bing":"https://www.binghamton.edu/apps/directory/person/profile/mlawler","ut":"https://www.physics.utoronto.ca/members/department_groups/qcmp/","aru":"https://www.physics.utoronto.ca/~arunp/Homepage/CV_files/CV2010.pdf","fr":"https://research.physics.illinois.edu/Publications/theses/copies/Lawler_Michael.pdf","wei":"https://www.stonybrook.edu/physics/people/_profiles/weit.html","mrl":"https://mrl.illinois.edu/news/new-theory-explains-enhanced-superconductivity-nanowires","bora":"https://goldbart.gatech.edu/PostScript/PhD_Theses/Bora_F/bora_thesis.pdf","gold":"https://you.stonybrook.edu/pmgoldbart/research-group-past-and-present-members/","iqc":"https://uwaterloo.ca/institute-for-quantum-computing/news/iqc-researchers-investigate-boson-problems","ubc":"https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.106.070501","wph":"https://bpb-us-e1.wpmucdn.com/you.stonybrook.edu/dist/0/6755/files/2024/07/Thesis-Tzu-Chieh-Wei.pdf","kw":"https://news.illinois.edu/superdense-coding-gets-denser/","mao":"https://sites.lsa.umich.edu/xiaoming-mao/members/","rock":"https://physics.gatech.edu/user/2100","kic":"https://www.kicnano.cornell.edu/people","rprb":"https://journals.aps.org/prb/abstract/10.1103/PhysRevB.88.165417","ide":"https://www.ideals.illinois.edu/search?q=Marks%2C+David+G.&start=0","mit":"https://research.shanghai.nyu.edu/centers-and-institutes/physics/people/aditi-mitra","ny":"https://quantuminstitute.nyu.edu/research/condensed-matter-theory","mprl":"https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.97.236808","mitth":"https://central.bac-lac.gc.ca/.item?app=Library&id=TC-OTU-17299&oclc_number=1033008384&op=pdf","kor":"https://www.stonybrook.edu/physics/people/_profiles/korepinv.html","kcv":"https://www.stonybrook.edu/commcms/physics/people/_profiles/_cvs/korepinv_08292024.pdf","iacs":"https://iacs.stonybrook.edu/people/_affiliates/vladimir-korepin.php"};
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


const [l,w,r,m,k]=['98b9cdf2','f461e32a','2813baec','7c7f0b01','3da13268'];
const law='Michael Lawler（附属）', wei='Tzu-Chieh Wei', rock='D. Zeb Rocklin', mit='Aditi Mitra', kor='Vladimir Korepin';
const ar='师承人物 - Arun Paramekanti', yb='师承人物 - Yong Baek Kim', hk='师承人物 - Hae-Young Kee';
const pg='人员 - Stony Brook - Paul Goldbart - 45436224', xm='人员 - University of Michigan, Ann Arbor - Xiaoming Mao - 87e20260';
const lf='师承人物 - Ludwig D. Faddeev';
const lawE='Lawler 本人在 SUNY 原档明确将 Yong Baek Kim、Hae-Young Kee 和 Arun Paramekanti 三人称为 Toronto 博士后的 supervisors；Cornell LASSP 列任期 2006–2008。关系类型可信度高。';
const lawL=src(['SUNY 本人履历','sun'],['Cornell LASSP','law']);
const toronto=src(['Toronto 物理系量子凝聚态名单','ut']);
mentor(yb,'Yong Baek Kim','University of Toronto 物理系教授，量子凝聚态与材料物理。',toronto);
mentor(hk,'Hae-Young Kee','University of Toronto 物理系教授，量子凝聚态与材料物理。',toronto);
updateEdge(l,law,ar,'Arun Paramekanti','博士后研究师长','博士后阶段受指导者','博士后导师','博士后研究者',lawE,lawL+' · '+src(['Paramekanti CV','aru']));
edge(l,law,yb,'Yong Baek Kim','博士后导师','博士后研究者',lawE,lawL+' · '+toronto);
edge(l,law,hk,'Hae-Young Kee','博士后导师','博士后研究者',lawE,lawL+' · '+toronto);
rewrite(pf(l),x=>x.startsWith(boundary),()=>boundary+'Cornell LASSP 列 Cornell 物理附属身份、Binghamton 物理主聘及 Toronto 2006–2008 博士后。Binghamton 正式院系为 Physics, Applied Physics and Astronomy。研究为强关联电子、量子磁体和自旋液体。三位 Toronto 导师来自本人具名说明。 '+src(['Cornell','law'],['Binghamton','bing'],['SUNY','sun']));
cell(l,1,'Cornell Physics 附属；Binghamton Physics, Applied Physics and Astronomy 主聘；强关联电子、量子磁体、自旋液体');
cell(l,3,'Yong Baek Kim、Hae-Young Kee、Arun Paramekanti（Toronto 2006–2008 博士后导师）');
schoolWith(l,lawL+' · '+src(['Binghamton 系页','bing']));
const al=audit(l,[
 a('affiliation','Cornell LASSP 附属与 Binghamton Physics, Applied Physics and Astronomy 主聘。',['law','bing'],'confirmed'),
 a('research','强关联电子材料、受挫量子磁性及量子自旋液体。',['law','bing','sun'],'confirmed'),
 a('phd','Illinois 博士论文列 Eduardo Fradkin 为 adviser；本人 SUNY 履历再次确认。',['fr','sun'],'confirmed_advisor'),
 a('postdoc',lawE,['sun','law','aru','ut'],'confirmed_advisor')
],'已核对博士、博士后指导和两校任用，后续可随官方履历更新。');
audits.at(-1).followup_required=false;
for(const [file,suffix] of [[yb,'kim'],[hk,'kee'],[ar,'paramekanti']])relation(l,al,'postdoc',file,'advisor',lawE,ids('sun','law','ut'),suffix);

const weiE='Illinois MRL 2006 年报道区分 Bezryadin 和 Goldbart 两组，称 Wei 为 Goldbart 团队的博士后研究者。可信度高（课题组）。';
const weiL=src(['Illinois MRL 同期报道','mrl'],['Illinois 学位论文','bora']);
edge(w,wei,pg,'Paul Goldbart','博士后课题组负责人','博士后课题组成员',weiE,weiL);
rewrite(pf(w),x=>x.startsWith(boundary),()=>boundary+'Illinois 的 Goldbart 课题组关系有同期校方报道。Kwiat 的博士后合作候选单独保留。Waterloo IQC 2010 年称 Wei 为前研究员，并列与 Michele Mosca、Ashwin Nayak 的项目合作。SUNY 列 UBC 博士后及后续研究职位，2011 年 UBC 论文列与 Ian Affleck、Robert Raussendorf 同单位合作。Waterloo、UBC 的具体指导人仍待核。 '+src(['Illinois MRL','mrl'],['Waterloo IQC','iqc'],['SUNY 履历','sun'],['UBC 阶段论文','ubc'],['现任物理系','wei']));
cell(w,2,'Paul Goldbart（博士导师）；Paul G. Kwiat（博士阶段研究师长）');
cell(w,3,'Paul Goldbart（Illinois 博士后课题组负责人）；Paul G. Kwiat（候选）；Waterloo 与 UBC 的具体指导人待核');
schoolWith(w,src(['Illinois MRL 同期报道','mrl'],['Waterloo IQC','iqc'],['UBC 阶段论文','ubc']));
const aw=audit(w,[a('postdoc',weiE+' Waterloo 与 UBC 合作及任职为后续线索，Kwiat 的同期 Illinois 合作仍为候选。',['mrl','bora','iqc','ubc','sun','kw'],'group_or_candidate')],'追 Waterloo 与 UBC 的博士后任用档、研究计划和各阶段明确指导。');
relation(w,aw,'postdoc',pg,'group_leader',weiE,ids('mrl','bora'),'goldbart');

const rockE='Michigan Xiaoming Mao 实验室的校友名单明确列 D. Zeb Rocklin 为 2013–2016 博士后。可信度高（课题组）。';
edge(r,rock,xm,'Xiaoming Mao','博士后课题组负责人','博士后课题组成员',rockE,src(['Michigan Mao 实验室','mao'],['Georgia Tech 物理系','rock']));
pl(r,'- 博士阶段课题组关系候选：','Bora 的 Illinois 论文致谢还把 Rocklin 列入 Goldbart 组成员和同学的合并名单，且 2013 年同年有 Illinois 博士与共同论文。指导身份仍待看 Rocklin 的论文签署页。 '+src(['Bora 论文致谢','bora'],['2013 APS 论文','rprb'],['Georgia Tech 履历','rock']));
insertAfter(pf(r),'## 师承','\n- Cornell 阶段：Kavli 名单列 2016 年博士后，Georgia Tech 简介列 Bethe／KIC Fellow。Cornell 该阶段具体指导人待核。 '+src(['Cornell KIC','kic'],['Georgia Tech 物理系','rock']));
cell(r,3,'Xiaoming Mao（Michigan 2013–2016 博士后课题组负责人）；Cornell 2016 博后指导待核');
schoolWith(r,src(['Michigan 组页','mao'],['Cornell KIC','kic'],['Bora 学位论文','bora']));
const rr=audit(r,[
 a('affiliation','Georgia Tech School of Physics 副教授。',['rock'],'confirmed'),
 a('research','软凝聚态、统计物理、拓扑力学与机械超材料。',['rock'],'confirmed'),
 a('phd','Georgia Tech 列 Illinois 2013 博士；Bora 论文并列 Goldbart 组成员及同学，2013 同期论文为线索，Rocklin 本人签署页仍未读。',['rock','bora','rprb'],'group_or_candidate'),
 a('postdoc',rockE+' Cornell 2016 Bethe／KIC 博士后身份已核，具体指导待核。',['mao','rock','kic'],'group_or_candidate')
],'定位 Rocklin 本人 Illinois 学位论文签署页与 Cornell 博士后任用或导师名册。');
relation(r,rr,'postdoc',xm,'group_leader',rockE,ids('mao','rock'),'mao');

const mitE='NYU 个人档确认 Toronto 博士后，2006 年 APS 论文列 Mitra 与 Kim 同为 Toronto Physics，并共同研究非平衡量子临界。导师身份待核，可信度低（候选）。';
const mitL=src(['NYU 个人档','mit'],['APS 论文单位','mprl'],['Toronto 物理系','ut']);
edge(m,mit,yb,'Yong Baek Kim','博士后导师候选','博士后指导对象候选',mitE,mitL);
insertAfter(path.join(root,'师承候选线索索引.md'),'## 博士后阶段候选','\n- '+who(m,mit)+' → Toronto 博士后导师候选：'+wiki(yb,'Yong Baek Kim')+'。'+mitE+' '+mitL);
rewrite(pf(m),x=>x.startsWith(boundary),x=>x.replace('Toronto 博士后导师待查。','Toronto 阶段的同单位合作目前仅支持 Yong Baek Kim 为追查线索。'));
cell(m,3,'Andrew J. Millis（Columbia 博士后候选，表格待核）；Yong Baek Kim（Toronto 博士后候选，同期合作）');
schoolWith(m,mitL);
const mm=audit(m,[a('postdoc',mitE+' Columbia 的 Millis 仍按旧档候选保留。',['mit','mprl','ut'],'group_or_candidate')],'寻找 Columbia 校友表清晰原件及 Toronto 博士后任用或个人履历的明示指导关系。');
relation(m,mm,'postdoc',yb,'candidate',mitE,ids('mit','mprl','ut'),'toronto');

const korE='既有本人 CV 摘录明称 Faddeev 为博士后 adviser。SUNY 原档独立确认指导，并将 1978–1984 记为 Steklov。IACS 对同一时段列 Illinois，机构记录冲突待核。关系类型可信度高。';
const korL=src(['SUNY 原档','sun'],['原 CV 链接，现 404','kcv'],['IACS 履历','iacs']);
updateEdge(k,kor,lf,'Ludwig D. Faddeev','博士后导师','博士后研究者','博士后导师','博士后研究者',korE,korL);
rewrite(pf(k),x=>x.startsWith(boundary),()=>boundary+'SUNY 将授位年份写作 1977，物理系个人档写作 1979。SUNY 将 1978–1984 博士后记为 Steklov，并明确 Faddeev 指导；IACS 同一时段记 Illinois。保留两个来源的机构及授位年份差异。 '+src(['SUNY','sun'],['Stony Brook 物理系','kor'],['IACS','iacs']));
cell(k,3,'Ludwig D. Faddeev（博士后导师；SUNY 记 Steklov，IACS 同期记 Illinois）');
schoolWith(k,src(['SUNY 原档','sun']));
const kk=audit(k,[a('phd','物理系明确 Faddeev 指导；物理系写 1979，SUNY 写 1977，授位年份待核。',['kor','sun'],'confirmed_advisor'),a('postdoc',korE,['sun','iacs','kcv'],'confirmed_advisor')],'追 Steklov 及 Illinois 人事档，厘清 1978–1984 两个机构记载以及博士授位年份。');
relation(k,kk,'postdoc',lf,'advisor',korE,ids('sun','kcv','iacs'),'faddeev');

const pages=[
 [l,'sun','First-person career overview calls Fradkin PhD adviser and Kim, Kee and Paramekanti Toronto postdoc supervisors.','SUNY 本人履历明确三位博士后导师及博士导师。'],
 [l,'law','Cornell LASSP confirms Toronto postdoctoral fellow 2006–2008 and current Cornell adjunct.','核对 Toronto 博后任期及 Cornell 附属身份。'],
 [l,'bing','Binghamton directory identifies Lawler in Physics, Applied Physics and Astronomy.','核对 Binghamton 主聘和理论方向。'],
 [l,'ut','Toronto physics lists all three supervisors in its quantum condensed matter group.','核对三位导师的 Toronto 身份。'],
 [w,'mrl','Illinois MRL identifies Wei as a postdoctoral researcher on Goldbart’s team in a 2006 article.','确认 Illinois 博士后课题组。'],
 [w,'iqc','Waterloo IQC news identifies Wei as a former postdoctoral fellow and names researchers on a project.','确认 Waterloo 阶段，合作仅作为线索。'],
 [w,'ubc','APS identifies Wei at UBC with Affleck and Raussendorf in 2011.','同单位共同研究作为阶段线索。'],
 [r,'mao','Mao lab alumni list Rocklin as a postdoc 2013–2016.','确认 Michigan 博后课题组。'],
 [r,'rock','Georgia Tech lists 2013 Illinois physics PhD, 2016 Bethe/KIC fellowship and current research.','核对学位、院系及研究方向。'],
 [r,'kic','Cornell KIC lists Rocklin as former KIC Postdoctoral Fellow (2016).','确认 Cornell 博后身份。'],
 [r,'rprb','APS lists Rocklin at Illinois and Goldbart at Georgia Tech in a 2013 article.','博士阶段同期合作线索。'],
 [m,'mprl','APS lists Mitra, Takei and Kim as Toronto Physics, Millis as Columbia Physics.','Toronto 阶段同单位合作，指导待核。'],
 [k,'sun','SUNY booklet explicitly reports Faddeev supervised the Steklov 1978–1984 postdoctoral stage.','博士后导师和机构履历原档。'],
 [k,'iacs','IACS lists Illinois postdoctoral appointment for the same 1978–1984 period.','与 SUNY 的机构记载冲突。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:r,url:u.gold,error:'HTTP 502; do not infer mentor from search index'},
 {record_id:r,url:u.ide,error:'Cache miss; cannot retrieve dissertation catalogue handle'},
 {record_id:m,url:u.mitth,error:'Library and Archives Canada PDF fetch failed'},
 {record_id:k,url:u.kcv,error:'HTTP 404; prior CV evidence retained; independently confirmed by SUNY'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0006_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0006_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0006_SUNY与Goldbart原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
