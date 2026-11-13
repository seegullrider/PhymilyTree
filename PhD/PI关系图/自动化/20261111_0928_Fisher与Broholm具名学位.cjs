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
 orig.audit_id='pi_archive_20261111_0928_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0928_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const i='acc54713', b='ad6d7920';
const ic='https://nlp.stanford.edu/projects/mimir/cv/Fisher%2C%20ian.pdf';
const st='https://mse.stanford.edu/people/ian-fisher';
const cop='https://www.qm.phy.cam.ac.uk/staff/prof-john-r-cooper';
const pc='https://www.ameslab.gov/directory/paul-canfield';
const th='https://backend.orbit.dtu.dk/ws/portalfiles/portal/104322664/ris_m_2731.pdf#page=59';
const tc='https://backend.orbit.dtu.dk/ws/portalfiles/portal/104322664/ris_m_2731.pdf#page=2';
const jhu='https://physics-astronomy.jhu.edu/directory/collin-l-broholm/';
const jMat='https://engineering.jhu.edu/materials/people/matsci-affiliates/associated-faculty/';
const jcv='https://krieger.jhu.edu/physics/wp-content/uploads/sites/11/2013/02/curriculum_2024.pdf#page=1';
const nbi='https://nbi.ku.dk/moed-os/niels_bohr_lectures/2024/collin-broholm/';
const psi='https://www.psi.ch/de/cps/people/gabriel-aeppli';
const cTitle='师承人物 - John R. Cooper', pTitle='师承人物 - Paul C. Canfield';
const kTitle='师承人物 - Jørgen Kjems', mTitle='师承人物 - A. R. Mackintosh', aTitle='师承人物 - Gabriel Aeppli';
const phd='Stanford 托管的 Fisher 2006 本人 CV 在 Cambridge 1993–1996 博士条目明确列 J. R. Cooper 为 Thesis advisor。Cambridge 量子物质组院档具名 John Cooper，对应 J. R. Cooper。关系可信度高。';
const pd='本人 CV 在 Ames Laboratory／Iowa State 1997–2000 Post-doctoral Research Associate 条目明确列 P. C. Canfield 为 Research advisor。Ames 教师原档核姓名与单位。关系可信度高。';
const iP=source('Stanford 托管本人 CV',ic)+' · '+source('Cambridge Cooper 院档',cop);
const iD=source('Stanford 托管本人 CV',ic)+' · '+source('Ames Canfield 原档',pc);
const iMe=who(i,'Ian Fisher');
const iOther='本人 CV 另列 1993 年 New Zealand Institute for Industrial Research 研究助理及该任用的研究指导 J. L. Tallon。';
const iA=audit(i,[
 ['identity','Stanford 托管的本人 CV 及当前系页的姓名、Stanford 教职和量子材料研究一致。',[ic,st],'confirmed'],
 ['affiliation','Stanford 应用物理系教授，材料科学与工程系兼任。',[st],'confirmed'],
 ['research','量子材料、非常规超导、电子向列性和强关联电子。',[st],'confirmed'],
 ['phd',phd,[ic,cop],'confirmed_advisor'],
 ['postdoc',pd,[ic,pc],'confirmed_advisor']
],'两阶段导师已核；补 Cambridge 学位馆藏论文题名和签署页。');
function addEdge(id,name,file,title,stage,kind,proof,links,urls,event,key,description,reverseExists=false){
 if(!fs.existsSync(mf(file))&&!updates.has(mf(file)))updates.set(mf(file),'# '+title+'\n\n> [!info] 师承扩展人物\n> '+description+'\n\n## 师承\n');
 const forward=stage==='postdoc'?'博士后导师':kind==='stage_mentor'?'博士阶段研究师长':'博士导师';
 const reverse=stage==='postdoc'?'博士后研究者':kind==='stage_mentor'?'博士阶段受指导者':'博士生';
 const from=who(id,name), to=wiki(file,title);
 const edge='- '+forward+'：'+to+'。'+proof+' '+links;
 insertAfter(pf(id),'## 师承',edge);
 const back='- '+reverse+'：'+from+'。'+proof+' '+links;
 if(reverseExists)rewrite(mf(file),x=>x.startsWith('- '+from+'：博士后阶段候选'),()=>back);
 else insertAfter(mf(file),'## 师承',back);
 const idx='- '+from+' → '+edge.slice(2);
 if(!get(index).includes(idx))updates.set(index,get(index).trimEnd()+'\n'+idx+'\n');
 relation(id,event,stage,file,kind,proof,urls,key);
}
addEdge(i,'Ian Fisher',cTitle,'John R. Cooper','phd','advisor',phd,iP,[ic,cop],iA,'cooper','Cambridge 量子物质组的超导研究者。 '+source('Cambridge 原档',cop));
addEdge(i,'Ian Fisher',pTitle,'Paul C. Canfield','postdoc','advisor',pd,iD,[ic,pc],iA,'canfield','Ames National Laboratory 物理学者。',true);
rewrite(pf(i),x=>x.startsWith(boundary),()=>boundary+'Cambridge 博士与 Ames／Iowa State 博士后已由本人 CV 分别确认导师。'+iOther+' '+source('本人 CV',ic));
const cand=path.join(root,'师承候选线索索引.md');
rewrite(cand,x=>x.startsWith('- '+iMe+' → 待查 ')&&x.includes(pTitle),(line)=>'- '+iMe+' → '+wiki(pTitle,'Paul C. Canfield')+'（博士后导师已核）。'+pd+' '+iD);
school(i,' | 待核 | 待核 | ',' | John R. Cooper（博士导师） | Paul C. Canfield（Ames／Iowa State 博士后导师） | ');
schoolSource(i,' · '+iP+' · '+iD);
const kProof='Risø 托管的 Broholm 1988 博士论文致谢第 59 个 PDF 页面明确称 Jørgen Kjems 为 primary supervisor。该原卷封面与 Copenhagen 院档及本人 CV 的姓名、学位时段和中子散射研究相符。关系可信度高。';
const mProof='同一论文致谢明确称 A. R. Mackintosh 为 second supervisor，并说明其协助办理博士研究正式手续。按具名博士共同指导保留。关系可信度高。';
const aProof='同一论文致谢明述在博士论文期间访问 AT&T Bell Laboratories，并具名 Gabriel Aeppli 为当时 Bell 的 supervisor。本人 CV 将 1987 年 Bell Visiting Scientist 与 1988–1990 年 Postdoctoral Member of Technical Staff 分列。此条对应博士期间访问研究指导。';
const bPD='本人 CV 与 Niels Bohr Institute 履历确认 1988–1990 AT&T Bell Laboratories 博士后。1988 博士原卷的 Bell supervisor 句在博士期间访问段，博士后具名指导待后续任用档。';
const bs=source('博士论文致谢',th)+' · '+source('Copenhagen 履历',nbi);
const bsa=source('博士论文致谢',th)+' · '+source('JHU 本人 CV',jcv);
const bA=audit(b,[
 ['identity','DTU 托管原论文作者 Collin Leslie Broholm 与 JHU CV、Niels Bohr Institute 讲者履历的姓名、Copenhagen 博士及凝聚态研究对应。',[tc,jcv,nbi],'confirmed'],
 ['affiliation','Johns Hopkins 物理与天文学系教授，材料科学与工程系关联教师。',[jhu,jMat],'confirmed'],
 ['research','量子磁性、中子散射和强关联材料。',[jhu,nbi],'confirmed'],
 ['phd',kProof+' '+mProof+' '+aProof,[th,tc,jcv,nbi],'confirmed_advisor'],
 ['postdoc',bPD,[jcv,nbi,th],'unresolved']
],'继续查 1988–1990 Bell Labs 博士后任用原档；博士期间 1987 Bell 访问指导已单列。');
addEdge(b,'Collin Broholm',kTitle,'Jørgen Kjems','phd','advisor',kProof,bs,[th,tc,nbi],bA,'kjems','Risø 中子散射研究者，以 Broholm 学位论文具名身份为准。 '+source('博士论文致谢',th));
addEdge(b,'Collin Broholm',mTitle,'A. R. Mackintosh','phd','advisor',mProof,bs,[th,tc,nbi],bA,'mackintosh','Broholm 哥本哈根博士阶段的第二指导人。 '+source('博士论文致谢',th));
addEdge(b,'Collin Broholm',aTitle,'Gabriel Aeppli','phd','stage_mentor',aProof,bsa,[th,jcv,psi],bA,'aeppli','Bell Laboratories 历史任用与博士期间访问指导见学位原卷。 '+source('PSI 教师原档',psi));
rewrite(pf(b),x=>x.startsWith(boundary),()=>boundary+'Copenhagen 博士两名指导人已具名，1987 Bell 博士访问与 1988–1990 Bell 博士后分列，后者个人导师继续查。 '+bsa);
school(b,' | 待核 | 待核 | ',' | Jørgen Kjems、A. R. Mackintosh（博士导师）；Gabriel Aeppli（博士期间 Bell 访问研究指导） | Bell Labs 1988–1990 博士后，个人指导待核 | ');
schoolSource(b,' · '+bs+' · '+source('JHU 本人 CV',jcv));
personLine(b,'- 院系／机构：',' 材料科学与工程系官网列为关联教师。 '+source('材料系关联教师名录',jMat));
schoolSource(b,' · '+source('材料系关联教师名录',jMat));
const pages=[
 {record_id:i,url:ic,raw:'Ian Fisher’s 2006 CV explicitly names J. R. Cooper as Cambridge thesis advisor and P. C. Canfield as Ames/Iowa State postdoctoral research advisor. J. L. Tallon is attached to a separate 1993 research assistantship.',excerpt:'具名区分博士与博士后指导。'},
 {record_id:i,url:st,raw:'Stanford MSE lists Ian Fisher as Professor of Applied Physics and by courtesy of Materials Science and Engineering.',excerpt:'核现任与兼任。'},
 {record_id:i,url:cop,raw:'Cambridge Quantum Matter lists Prof. John Cooper in its faculty profile.',excerpt:'交叉核 Cooper 身份。'},
 {record_id:i,url:pc,raw:'Ames Laboratory lists Paul Canfield in its institutional directory.',excerpt:'核 Ames 指导人姓名和单位。'},
 {record_id:b,url:th,raw:'The 1988 thesis acknowledgments name Jørgen Kjems as primary supervisor and A. R. Mackintosh as second supervisor. Gabriel Aeppli supervised the Bell Laboratories visit during doctoral work.',excerpt:'确证两位博士导师与博士阶段访问指导。'},
 {record_id:b,url:tc,raw:'The Risø thesis title page names Collin Leslie Broholm.',excerpt:'核博士原卷身份。'},
 {record_id:b,url:jcv,raw:'The JHU-hosted CV separates Bell Labs Visiting Scientist in 1987 from Postdoctoral Member of Technical Staff in 1988–1990.',excerpt:'分列博士访问与博士后任用。'},
 {record_id:b,url:nbi,raw:'Niels Bohr Institute’s 2024 lecture identifies the Copenhagen PhD in 1988 and AT&T Bell Labs postdoc in 1988–1990.',excerpt:'交叉核学位、博后与现任。'},
 {record_id:b,url:jMat,raw:'Johns Hopkins Materials Science and Engineering lists Collin Broholm as associated faculty with a professorship in Physics and Astronomy.',excerpt:'核材料系的关联教师身份。'},
 {record_id:b,url:'https://orbit.dtu.dk/files/104322664/ris_m_2731.pdf',error:'Repository short route returned 403. DTU backend-hosted primary thesis successfully read.'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0928_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0928_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0928_Fisher与Broholm具名学位原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
