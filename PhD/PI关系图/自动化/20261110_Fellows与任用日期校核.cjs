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
 const i=matches[0];lines[i]=edit(lines[i]).replace(/\r?\n/g,end);
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
 a.audit_id='20261110_'+id+'_fellowship_and_appointments_1856';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_and_appointments_1856_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.replace(/ \|\s*$/,'').split(' | ');if(cells.length<5)throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  const source=cells.splice(4).join('。 ');cells.push(source+' '+text+' |');
  return cells.join(' | ');
 });
}
function replaceNoteLabel(id,label,replacement,target,extra=''){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceInverseLabel(target,id,label,replacement,extra=''){
 editLine(fn(target),l=>l.startsWith('- '+label+'：')&&l.includes('[['+local(id)+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceIndexLabel(id,target,label,replacement,extra=''){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace(' → '+label+'：',' → '+replacement+'：')+extra);
}



const g='1a532b7f';
const ucsb='https://materials.ucsb.edu/news/new-faculty-profile-associate-professor-daniel-s-gianola';
const lab='https://labs.materials.ucsb.edu/gianola/dan/news';
const summary='UCSB 2015 年 11 月任用报道与本人实验室记录均列 2015 年 11 月 1 日加入 UCSB，原 UCSB 2018 会议简历写 early 2016。采用同期任用原档，保留两种日期来源。';
editLine(fn(local(g)),l=>l.includes('2016 年由 University of Pennsylvania 转入'),l=>l.replace('2016 年由 University of Pennsylvania 转入','2015 年 11 月 1 日由 University of Pennsylvania 转入')+' '+summary+' '+web('UCSB 当期任用',ucsb)+' · '+web('本人组新闻',lab));
changeRow(g,null,null,web('UCSB 当期任用',ucsb));
audit(g,{affiliation:['confirmed',summary,[ucsb,lab]]},'补 Johns Hopkins 博士论文签署和 JHU、Karlsruhe 博后起止及个人指导。');

const t='233102a4', h='https://socfell.fas.harvard.edu/2000-2009', ts='https://iiis.tsinghua.edu.cn/en/info/1044/1933.htm';
const tp='Harvard Society of Fellows 原始名录在本人姓名及物理学科下列 Junior Fellow 2003–2006。清华讲座履历称该为博士后的 fellowship，且列同一 Harvard 学位与 UCLA 任用。具体个人指导者待查。';
note(t,'- 核查边界：',tp+' '+web('Harvard Fellows 原始名录',h)+' · '+web('清华讲座档',ts));
changeRow(t,null,'Harvard Junior Fellow（2003–2006）；个人指导待查',web('Harvard Fellows 原档',h));
audit(t,{postdoc:['unresolved',tp,[h,ts]]},'核 Harvard Society of Fellows 任用档及博士后课题个人指导。博士导师已有授位机构证据。');

const d='d6d9173f', u='https://www.tcsuh.com/people/prininv/deng_liangzi/';
const dp='UH 超导中心现任原档列 TcSUH Welch Professor、Physics，研究超导、磁性与拓扑量子材料。ORCID 任用接口未返回可读正文，2015–2018 仍待原聘任或 CV。';
editLine(fn(local(d)),l=>l.startsWith('- 院系：'),l=>l+' UH 超导中心档列 TcSUH Welch Professor。'+web('超导中心原档',u));
changeRow(d,null,null,web('现任 Welch Professor',u));
audit(d,{affiliation:['confirmed',dp,[u]],research:['confirmed','超导中心原档列实验凝聚态物理、超导、磁性和拓扑。',[u]]},'查 Houston 2015–2018 博后任用原档或可读 CV 与具名指导。ORCID 搜索线索保留。');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Fellows与任用日期校核';
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
 if(typed.length)console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}

