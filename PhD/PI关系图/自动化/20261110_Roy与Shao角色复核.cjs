const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root='..', people=path.join(root,'人物'), idx=path.join(root,'师承关系索引.md');
const records=db.prepare('select id,name,unit,filename from records where id=?');
const latest=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1');
const graph=new Map(), audits=[], typed=[];
const local=id=>records.get(id).filename;
const fn=filename=>path.join(people,filename+'.md');
const web=(label,url)=>'['+label+']('+url+')';
function editLine(file,test,edit){
 const content=graph.get(file)??fs.readFileSync(file,'utf8');
 const end=content.includes('\r\n')?'\r\n':'\n';
 const lines=content.split(/\r?\n/);
 const matches=lines.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected 1 match, got '+matches.length);
 const i=matches[0];lines[i]=edit(lines[i]);
 graph.set(file,lines.join(end));
}
function note(id,prefix,text){editLine(fn(local(id)),line=>line.startsWith(prefix),line=>line+' '+text);}
function mentorLine(mentor,id,prefix,text){
 const f=fn(mentor), r=records.get(id);
 editLine(f,line=>line.startsWith(prefix)&&line.includes('[['+r.filename+'|'),l=>l+' '+text);
}
function indexLine(id,mentor,label,text){
 const r=records.get(id);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
}
function audit(id,changes,next){
 const a=JSON.parse(latest.get(id).details_json);
 a.audit_id='20261110_'+id+'_direct_supervisors_0840';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_direct_supervisors_0840_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';
  return cells.join(' | ');
 });
}

const roy='5b4e9f1a', shao='ee9d30dd';
const cv='https://cmt-roy.physics.ucla.edu/sites/default/files/Rahul-Roy-CV-160816.pdf';
const ucla='https://pa.ucla.edu/faculty.html';
const st='https://shaolab.stanford.edu/people/yanjie-shao';
const mit='https://www.mtl.mit.edu/sites/default/files/media/documents/2026/marc2026_4.pdf';
const da='人员 - MIT - Jesús del Alamo - 753cf50b';
const periods=[
 {names:['Catherine Kallin','John Berlinsky'],unit:'McMaster',period:'2007-08 至 2009-07'},
 {names:['Steve Simon','John Chalker'],unit:'Oxford',period:'2009-08 至 2011-12'}
];
const phd='UCLA 托管的本人履历教育栏明列 UIUC 物理博士论文题名及 Advisor Michael Stone。';
const rpost='UCLA 托管的本人履历聘任栏分别列 McMaster（2007-08 至 2009-07）及 Oxford（2009-08 至 2011-12）博士后和两位 Supervisors。';
const ra=audit(roy,{phd:['confirmed_advisor',phd,[cv]],postdoc:['confirmed_advisor',rpost,[cv]],affiliation:['confirmed','UCLA 物理与天文学系现任教授名录列 Rahul Roy。',[ucla]],research:['confirmed','UCLA 院系列为凝聚态，CV 的博士论文与讲座主题集中在拓扑凝聚态。',[ucla,cv]]},'两阶段及院系方向均已复核。');
audits.at(-1).followup_required=false;
for(const p of periods){
 for(const name of p.names){
  const mentor='师承人物 - '+name;
  const evidence='本人 UCLA 履历任职栏明确将 '+name+' 列为 '+p.unit+' 博士后（'+p.period+'）的 Supervisor。';
  const newProof=web('本人 UCLA CV，聘任栏',cv)+'。'+evidence;
  const refresh=line=>line.replace('既有正式 supervisor 标签另依据本人历史 CV，该 CV 本轮超时未重读。',newProof);
  editLine(fn(local(roy)),l=>l.startsWith('- 博士后导师：')&&l.includes('[['+mentor+'|'),refresh);
  editLine(fn(mentor),l=>l.startsWith('- 博士后研究者：')&&l.includes('[['+local(roy)+'|'),refresh);
  editLine(idx,l=>l.startsWith('- [['+local(roy)+'|')&&l.includes(' → 博士后导师：')&&l.includes('[['+mentor+'|'),refresh);
  relation(roy,'postdoc',mentor,'advisor',evidence,[cv],ra,false);
 }
}
changeRow(roy,null,'McMaster 2007–2009：Catherine Kallin、John Berlinsky；Oxford 2009–2011：Steve Simon、John Chalker（本人 CV 所列指导者）',web('本人 UCLA CV',cv));
const shaoPhd='Stanford 本人实验室主页明确列 MIT 电气工程博士研究由 Jesús del Alamo 指导。';
const shaoPost='MIT MARC 2026 官方摘要集 Shao 本人条目直接列其为受 Jesús del Alamo 监督的博士后研究员。Stanford 本人页另列与 Dimitri Antoniadis 共事。';
const sha=audit(shao,{phd:['confirmed_advisor',shaoPhd,[st]],postdoc:['confirmed_advisor',shaoPost,[mit,st]],affiliation:['confirmed','Stanford 本人实验室原档列 2026 年 8 月起任电气工程系助理教授。',[st]],research:['confirmed','Stanford 本人页核 CMOS 兼容半导体、三维电子、纳米输运及铁电器件。',[st]]},'Dimitri Antoniadis 的正式共同指导身份待查；保留与其博士后阶段研究关系。');
const sp=web('MIT 2026 原摘要集',mit)+'核本人条目监督措辞。'+web('Stanford 本人实验室履历',st)+'核博士和博士后阶段。';
editLine(fn(local(shao)),l=>l.startsWith('- 博士后导师：')&&l.includes('[['+da+'|'),l=>l+' '+sp);
mentorLine(da,shao,'- 博士后研究者：',sp);
indexLine(shao,da,'博士后导师',sp);
changeRow(shao,null,'Jesús del Alamo（MIT 2026 原档指名监督）、Dimitri A. Antoniadis（博士后合作）',web('MIT 2026 原档',mit));
relation(shao,'postdoc',da,'advisor',shaoPost,[mit,st],sha,false);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Roy与Shao角色复核';
fs.writeFileSync(stamp+'_人工.json',JSON.stringify(audits,null,2)+'\n','utf8');
fs.writeFileSync(stamp+'_结构化.json',JSON.stringify(typed,null,2)+'\n','utf8');
for(const [file,content] of graph)fs.writeFileSync(file,content,'utf8');
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.review-'));
const temp=path.join(tmp,'audit.json');
try{
 for(const a of audits){
  fs.writeFileSync(temp,JSON.stringify(a),'utf8');
  console.log(execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',temp],{encoding:'utf8'}).trim());
 }
 console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}


