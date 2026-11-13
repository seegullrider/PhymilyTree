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
 orig.audit_id='pi_archive_20261111_0906_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0906_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const b='ab6cb11a',c='ab9a602b',l='abe3e413';
const ph='https://www.physics.harvard.edu/academics/phds1971-2000';
const df='https://cap.stanford.edu/profiles/viewCV?facultyId=8594&name=Daniel_Fisher';
const cu='https://www.colorado.edu/lab/betterton/people/meredith-betterton';
const ny='https://cims.nyu.edu/bulletin/archive/fall_02.html';
const ci='https://cims.nyu.edu/newsletters/Spring2011.pdf#page=6';
const j='https://www.pks.mpg.de/fileadmin/user_upload/MPIPKS/group_pages/BiologicalPhysics/juelicher/publications/2000-2003/AMTMIOTHUOD03.pdf';
const jp='https://www.pks.mpg.de/biological-physics/frank-juelicher/publications';
const dc='https://www.cense.iisc.ac.in/icee/docs/Invited_Speakers/David.pdf';
const gt='https://ece.gatech.edu/directory/david-s-citrin';
const la='https://appliedphysics.northwestern.edu/people/faculty/lin-x-chen.html';
const lc='https://chemistry.northwestern.edu/people/faculty/profiles/lin-chen.html';
const lx='https://biologicalsciences.uchicago.edu/faculty/lin-chen-0';
const lacs='https://chicagoacs.starchapter.com/images/downloads/Chemical_Bulletin/2005_03_chembull.pdf';
const bphd='Harvard 博士目录明确论文指导姓 Fisher。Daniel S. Fisher 本人 CV 载 1990–2007 年 Harvard 物理系教授，任期覆盖 Betterton 的 2000 年博士。仍待本人论文签署页或完整姓名，保留原姓氏导师节点并列身份候选。';
const bpd='NYU Courant 2002 年 Instructor Day 公告将 Meredith Betterton 列为报告人，NYU 系刊明确 Courant Instructorship 属博士后任用。2003 年 Betterton 和 Frank Jülicher 的原论文首页把 Betterton 列 Courant Institute 与 Institut Curie，Jülicher 列 Curie 与 Dresden。将 Jülicher 列为博士后阶段候选，正式指导及 Paris 任用类型待查。';
const bp=source('Harvard 博士名录',ph)+' · '+source('Daniel S. Fisher 本人 CV',df);
const bq=source('NYU 2002 Courant 公告',ny)+' · '+source('NYU Instructorship 原档',ci)+' · '+source('Max Planck 托管同期论文',j);
const be=audit(b,[
 ['identity','Harvard 名录给全名 Meredith Diane Betterton，Princeton 1994 学士与本人 Colorado 学术履历吻合；Courant 讲座与 2003 原论文同名和研究方向吻合。',[ph,cu,ny,j],'confirmed'],
 ['phd',bphd,[ph,df,cu],'confirmed_advisor'],
 ['postdoc',bpd,[ny,ci,j],'group_or_candidate']
],'追 Harvard 博士签署页的 Fisher 全名；查 Courant Instructorship 任命书及 Curie 访学或博士后任用，核个人指导。');
const bx=path.join(root,'师承候选线索索引.md');
const fn='师承人物 - Daniel S. Fisher';
const fj='师承人物 - Frank Jülicher';
if(!fs.existsSync(mf(fj)))updates.set(mf(fj),'# Frank Jülicher\n\n> [!info] 师承扩展人物\n> Max Planck Institute for the Physics of Complex Systems 生物物理研究者。 '+source('Max Planck 本人出版目录',jp)+'\n\n## 师承\n');
for(const [stage,target,label,evidence,links,urls,suffix] of [
 ['phd',fn,'Daniel S. Fisher',bphd,bp,[ph,df],'fisher'],
 ['postdoc',fj,'Frank Jülicher',bpd,bq,[ny,ci,j],'juelicher']
]){
 const person=who(b,'Meredith Betterton'), mentor=wiki(target,label);
 const role=stage==='phd'?'博士导师候选':'博士后导师候选';
 const reverse=stage==='phd'?'博士阶段研究者候选（待核）':'博士后阶段研究者候选（待核）';
 const edge='- '+role+'：'+mentor+'。'+evidence+' '+links;
 insertAfter(pf(b),'## 师承',edge);
 insertAfter(mf(target),'## 师承','- '+reverse+'：'+person+'。'+evidence+' '+links);
 const line='- '+person+' → '+edge.slice(2);
 if(!get(bx).includes(line))updates.set(bx,get(bx).trimEnd()+'\n'+line+'\n');
 relation(b,be,stage,target,'candidate',evidence,urls,suffix);
}
rewrite(pf(b),x=>x.startsWith(boundary),()=>boundary+'Harvard 名录所载 Fisher 全名待学位签署页。NYU 原档已补 2002 年 Courant 关联及其职位性质，Paris 任用、指导与起止待核。 '+bp+' · '+bq);
personLine(b,'- 博士后阶段追查线索：',' 本轮另取得 Courant 2002 原公告和同期论文。');
school(b,' | Fisher（Harvard 名录明确列为博士导师；全名及身份待核） | 待核 | ',' | Fisher（Harvard 博士导师，完整身份待核）；Daniel S. Fisher（身份候选） | NYU Courant Instructorship 线索；Frank Jülicher（博士后导师候选） | ');
schoolSource(b,' · '+bp+' · '+bq);
const ce='IISc 会议托管的本人履历在任用栏分别列 Stuttgart Max Planck Institute for Solid State Research 1992–1993 Post-doctoral Fellow、Michigan Center for Ultrafast Optical Science 1993–1995 Center Fellow，Georgia Tech ECE 履历两项相同。两段任用按原职衔保存，个人导师均未列。';
const cp=source('IISc 托管本人履历',dc)+' · '+source('Georgia Tech ECE',gt);
const ca=audit(c,[
 ['affiliation','Georgia Tech School of Electrical and Computer Engineering 教授，另与 Georgia Tech Europe 和 CNRS 实验室有关联。',[gt,dc],'confirmed'],
 ['research','半导体低维结构光学、太赫兹光子学和超快光学。',[gt,dc],'confirmed'],
 ['postdoc',ce,[dc,gt],'unresolved']
],'追 Stuttgart 固体研究所原课题组与任用，及 Michigan CUOS Center Fellow 具名接收或指导原件。');
personLine(c,boundary,' '+ce+' '+cp);
school(c,' | Yia-Chung Chang（博士 advisor） | 待核 | ',' | Yia-Chung Chang（博士 advisor） | Stuttgart 博士后 1992–1993；Michigan CUOS Center Fellow 1993–1995，个人指导待核 | ');
schoolSource(c,' · '+cp);
const ln='已核查另一同名者。University of Chicago 公共卫生学原档列 Lin Chen 为 2008 Washington 生物统计博士、Fred Hutchinson 博后。Northwestern 应用物理和化学系的 Lin X. Chen 是 Northwestern／Argonne 光谱研究者，ACS 履历列 Chicago 1987 物理化学博士与 Berkeley 博后。';
const ll=audit(l,[
 ['identity',ln,[la,lc,lacs,lx],'confirmed'],
 ['affiliation','Northwestern 化学系教授、应用物理研究生项目教师、Argonne 国家实验室高级化学家。',[la,lc],'confirmed'],
 ['research','超快光谱、时间分辨 X 射线吸收、光激发态和电荷转移动力学。',[la,lc],'confirmed']
],'继续查 Berkeley 两位博士后阶段研究师长在任用原档的具体指导职衔。');
const lSource=source('Northwestern 应用物理项目',la);
const af='已核实单位 - Northwestern - 应用物理';
rewrite(pf(l),x=>x.startsWith('- 院系／机构：'),x=>x.replace(/。$/,'')+' · '+wiki(af,'应用物理研究生项目')+'。 '+lSource);
const dept=path.join(root,'已核实院系',af+'.md');
const pLine='- '+who(l,'Lin Chen')+' — 应用物理研究生项目教师。 '+lSource;
if(!get(dept).includes(records.get(l).filename))updates.set(dept,get(dept).trimEnd()+'\n'+pLine+'\n');
personLine(l,boundary,' '+ln+' '+source('Chicago 同名教师档',lx)+' · '+lSource);
school(l,' | 化学系、Argonne 国家实验室；',' | 化学系、应用物理研究生项目、Argonne 国家实验室；');
schoolSource(l,' · '+lSource);
const exclusions=[{page_id:'b78e6444a7aa172626fe8ad5',url:lx,record_id:l,audit_id:ll,external_subject:'Lin Chen，芝加哥大学公共卫生学统计基因组教授',evidence:ln}];
const pages=[
 {record_id:b,url:ny,raw:'The fall 2002 NYU Courant Weekly Bulletin names Meredith Betterton at its Courant Instructor Day.',excerpt:'确证 Courant 历史关联，追任命书。'},
 {record_id:b,url:ci,raw:'NYU’s 2011 institute newsletter defines Courant Instructorship as a postdoctoral appointment for recent PhDs.',excerpt:'核 Instructorship 的任用性质。'},
 {record_id:b,url:j,raw:'The 2003 original lists M.D. Betterton at Institut Curie and NYU Courant, and Frank Jülicher at Institut Curie and MPI Dresden.',excerpt:'核博士后阶段同期同单位合作，仅候选。'},
 {record_id:b,url:df,raw:'Daniel S. Fisher’s Stanford-hosted CV lists Harvard physics professor from 1990 to 2007.',excerpt:'核候选人学术任职时段。'},
 {record_id:c,url:dc,raw:'Citrin’s CV lists Max Planck Stuttgart Post-doctoral Fellow, 1992–1993, then University of Michigan CUOS Center Fellow, 1993–1995.',excerpt:'分列博士后和 Center Fellow 任用原职衔。'},
 {record_id:c,url:gt,raw:'Georgia Tech ECE faculty record independently lists Stuttgart 1992–1993 and Michigan 1993–1995, along with semiconductor optics and current faculty affiliation.',excerpt:'交叉核任期、方向和教职。'},
 {record_id:c,url:'https://journals.aps.org/prb/abstract/10.1103/PhysRevB.48.2535',error:'APS direct open returned 403 Forbidden.'},
 {record_id:c,url:'https://deepblue.lib.umich.edu/bitstream/handle/2027.42/71327/APPLAB-66-8-994-1.pdf',error:'Michigan hosted original returned 403 Forbidden.'},
 {record_id:l,url:lc,raw:'Northwestern Chemistry lists Lin X. Chen and experimental research in ultrafast and x-ray spectroscopy.',excerpt:'核现任化学系和研究方向。'},
 {record_id:l,url:la,raw:'Northwestern Applied Physics profile lists Lin X. Chen as Chemistry professor and Senior Chemist at Argonne.',excerpt:'补应用物理研究生项目和身份消歧。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0906_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0906_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0906_CourantGeorgiaTechNorthwestern原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);

const xf='20261111_0906_LinChen同名排除.json';
persist(xf,exclusions);
call('人物网页身份纠偏.cjs',[xf]);
call('检索流程.cjs',['report']);
