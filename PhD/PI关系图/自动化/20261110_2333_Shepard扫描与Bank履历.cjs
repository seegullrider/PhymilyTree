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
 orig.audit_id='pi_archive_20261110_2333_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2333_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"sd":"https://snow.stanford.edu/thesis/Shepard.pdf","s7":"https://snow.stanford.edu/thesis/Shepard.pdf#page=7","sc":"https://www.engineering.columbia.edu/sites/default/files/2024-07/shepard-ken_cv-102019.pdf","sf":"https://cnec.columbia.edu/people/kenneth-shepard","si":"https://bioee.ee.columbia.edu/wp-content/uploads/2013/01/06374269.pdf","hg":"https://www-ee.stanford.edu/~harris/formerstudents.html","bd":"https://snow.stanford.edu/thesis/Bank.pdf","bc":"https://ptacts.uspto.gov/ptacts/public-informations/petitions/1518815/download-documents?artifactId=T_CLB8Iorvcbihvrx00C4RsdJFk3PW5_CMtiHP_1rMio0WvFOo8y_IU","bc2":"https://ptacts.uspto.gov/ptacts/public-informations/petitions/1518815/download-documents?artifactId=3L-ds_k5DqfHgFvQvzWfBC3hrQJLLRMRDSQ44mlwW5mVqK7QZn8zh9M","bu":"https://ece.utexas.edu/people/faculty/seth-bank"};
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
const [s,b]=['4b08f7ad','ddc04679'];
const h=records.get('5d4109a9').filename,roukes=records.get('62ba1cc8').filename;
const sd='Stanford 托管博士论文扫描原卷 PDF 第 5 页为 Stanford 电气工程博士扉页（Kenneth Lyle Shepard，1992 年 6 月）。人工查看 PDF 第 7 页（印刷页 iii）签署栏，Michael L. Roukes 标 Principal Adviser，James S. Harris, Jr. 标 Co-adviser，R. Fabian Pease 列为论文审阅签署人。Harris 组博士论文名录独立匹配题名和日期。可信度高。';
const sp='Columbia 学校履历与本人署名论文作者简介均列 1992–1997 IBM T. J. Watson VLSI Design Research Staff Member and Manager。公开履历未列独立博士后聘任或导师，暂按原岗位记录。';
const slk=src(['Stanford 论文签署页','s7'],['本人 Columbia CV','sc'],['Stanford Harris 组博士名录','hg']);
const spl=src(['Columbia 任职履历','sf'],['Columbia 托管本人作者履历','si']);
edge(s,'Kenneth L. Shepard',roukes,'Michael L. Roukes','博士导师','博士生',sd,slk);
edge(s,'Kenneth L. Shepard',h,'James S. Harris Jr.','博士共同导师','博士生',sd,slk);
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+sd+' '+sp+' '+slk+' · '+spl);
cell(s,2,'Michael L. Roukes（主要导师）、James S. Harris Jr.（共同导师），Stanford 1992');
cell(s,3,'1992–1997 IBM VLSI Research Staff Member and Manager；未发现独立博士后聘任，待复核');
cell(s,4,slk+' · '+spl);
const sa=audit(s,[a('identity','论文和本人 CV 将 Kenneth Lyle Shepard 对应为 1992 Stanford 电气工程博士及 Columbia EE/BME 教师。',['sd','sc','sf']),a('phd',sd,['sd','sc','hg'],'confirmed_advisor'),a('postdoc',sp,['sf','si','sc'],'no_postdoc_documented'),a('affiliation','Columbia 电气工程及生物医学工程。',['sc','sf']),a('research','集成电路、纳米电子与生物传感，博士研究介观电子输运。',['sf','sc','sd'])],'两位博士导师核清，早期 IBM 任用已核，继续查是否有 CV 未列的独立博士后或岗位指导。');
relation(s,sa,'phd',roukes,'advisor',sd,ids('sd','sc'),'Roukes');
relation(s,sa,'phd',h,'advisor',sd,ids('sd','hg'),'Harris');

const bd='Bank 本人 2018 CV 的 Stanford Graduate Research Assistant 栏明确列 Advisor James Harris，与 2006 学位论文 Principal Adviser 既有原件一致。';
const bp='Bank 本人履历在 UCSB 材料与电气／计算机工程系 2006 年 2–12 月 Postdoctoral Scholar 条目下直接列 Supervisors Arthur Gossard 和 Mark Rodwell。两个 USPTO 档案版本及 UT Austin ECE 的 UCSB 博后履历一致。可信度高。';
const bdl=src(['本人 CV','bc'],['Stanford 博士论文','bd']);
const bpl=src(['本人 CV，USPTO 案卷','bc'],['同案另一 PDF','bc2'],['UT Austin ECE 本人档','bu']);
for(const [file,name] of [['师承人物 - Arthur C. Gossard','Arthur C. Gossard'],['师承人物 - Mark J. W. Rodwell','Mark J. W. Rodwell']]){
 updateEdge(b,'Seth Bank',file,name,'博士后导师候选','博士后候选研究者','博士后导师','博士后研究者',bp,bpl);
}
pl(b,'- 博士导师：',bd+' '+bdl);
rewrite(pf(b),x=>x.startsWith(boundary),()=>boundary+bd+' '+bp+' '+bdl+' · '+bpl);
cell(b,2,'James S. Harris（Stanford 博士导师）');
cell(b,3,'Arthur C. Gossard、Mark J. W. Rodwell（UCSB 2006-02 至 2006-12 博士后导师）');
schoolWith(b,bdl+' · '+bpl);
const ba=audit(b,[a('phd',bd,['bc','bd'],'confirmed_advisor'),a('postdoc',bp,['bc','bc2','bu'],'confirmed_advisor'),a('affiliation','UT Austin 电气与计算机工程。',['bu']),a('research','半导体外延和异质结构、纳米光电子、半导体器件。',['bu','bc'])],'博士及博士后导师、当前任职和研究方向均已具源核对。');
audits.at(-1).followup_required=false;
relation(b,ba,'phd',h,'advisor',bd,ids('bc','bd'),'Harris');
relation(b,ba,'postdoc','师承人物 - Arthur C. Gossard','advisor',bp,ids('bc','bc2','bu'),'Gossard');
relation(b,ba,'postdoc','师承人物 - Mark J. W. Rodwell','advisor',bp,ids('bc','bc2','bu'),'Rodwell');

const pages=[
 [s,'sd','Visually inspected PDF p. 5: Kenneth Lyle Shepard, Stanford Electrical Engineering PhD, June 1992. PDF p. 7 (printed iii): Michael L. Roukes, Principal Adviser; James S. Harris, Jr., Co-adviser; R. Fabian Pease, other signing reader.',sd],
 [s,'sc','Columbia CV lists Stanford PhD June 1992, thesis Electron Transport in Mesoscopic Conductors, EE appointments and research experience.',sd],
 [s,'sf','Columbia profile confirms Stanford 1992 PhD and 1992–97 IBM VLSI Research Staff Member and Manager.',sp],
 [s,'si','Columbia-hosted IEEE article author biography confirms IBM VLSI Research Staff Member and Manager from 1992 to 1997.',sp],
 [s,'hg','Stanford Harris PhD students and theses roster #23: Ken L. Shepard, Electron Transport in Mesoscopic Conductors, June 1992.',sd],
 [b,'bc','Bank curriculum vitae lists UCSB Postdoctoral Scholar 02/2006–12/2006, Supervisors Arthur Gossard and Mark Rodwell; Stanford Graduate Research Assistant advisor James Harris.',bd+' '+bp],
 [b,'bc2','Second version of the USPTO exhibit lists UCSB Postdoctoral Scholar and Gossard and Rodwell as supervisors.',bp],
 [b,'bu','UT Austin ECE official appointment profile confirms 2006 UCSB postdoctoral scholar and current ECE appointment.',bp]
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2333_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2333_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2333_论文扫描与博后导师回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
