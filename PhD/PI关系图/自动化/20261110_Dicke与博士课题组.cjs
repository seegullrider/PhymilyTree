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
 a.audit_id='20261110_'+id+'_dicke_gross_jhu_1831';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_dicke_gross_jhu_1831_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const m='20e4af6b';
const aps='https://physics.aps.org/articles/pdf/10.1103/Physics.3.83';
const mit='https://web.mit.edu/annualreports/pres06/11.06.pdf';
const ucsd='https://mcgreevy.physics.ucsd.edu/';
const wrong='https://berkleycenter.georgetown.edu/people/john-mcgreevy';
const mp='APS 本人署名文章随附作者履历列 Princeton Dicke Fellow 与随后 Stanford research scientist。MIT 2005–2006 年报确认入职 MIT 前在 Stanford 做 research scientist。两个职位按原称分列，Princeton 个人指导者待查。';
note(m,'- 核查边界：',mp+' '+web('APS 作者履历',aps)+' · '+web('MIT 年报',mit));
changeRow(m,null,'Princeton Dicke Fellow；随后 Stanford Research Scientist，指导者待核',web('APS 作者履历',aps)+' · '+web('MIT 年报',mit));
audit(m,{postdoc:['unresolved',mp,[aps,mit]],identity:['confirmed','UCSD 物理学家与 Georgetown 页面介绍的 Notre Dame 历史学家 John T. McGreevy 为不同人物。误配来源已在网页队列排除并保存原档。',[ucsd,wrong]]},'查 Princeton Dicke Fellowship 原任用与导师或 sponsor 字段；分开核 Stanford research scientist 的职责。');

const a='20c99ef8', gross='师承人物 - David Gross';
const r='https://sites.rutgers.edu/natan-andrei/about/';
const rw='https://sites.rutgers.edu/natan-andrei/group/';
const ae='Rutgers 本人组履历明确 1979 Princeton 物理博士 under the supervision of David J. Gross，并列现职、可积性、强关联量子系统和非微扰方法。博士后经历待追。';
changeRow(a,'David J. Gross（Princeton 博士导师）',null,web('本人 Rutgers 组履历',r));
const aid=audit(a,{phd:['confirmed_advisor',ae,[r]],research:['confirmed','Rutgers 本人组履历核实可积性、强关联量子系统及非微扰方法。',[r,rw]]},'查 Princeton 1979 博士学位原件及随后研究任用，核博士后经历和个人指导者。');
relation(a,'phd',gross,'advisor',ae,[r],aid);

const g='df7a6c3f', som='师承人物 - Gabor A. Somorjai';
const jlab='https://graciaslab.johnshopkins.edu/people/';
const jhu='https://engineering.jhu.edu/faculty/david-gracias/';
const bio='https://pmc.ncbi.nlm.nih.gov/articles/PMC3078552/';
const ge='本人 Hopkins 组履历把 Berkeley 博士与 Harvard 博后分别连到 Somorjai 与 Whitesides 两个实验室。作者传记分别以 with 写 Berkeley 博士与 Harvard 博后具名关系。Somorjai 标博士课题组负责人，Whitesides 既有博后研究关联保留，两者正式导师职衔继续核。';
const proof=' '+ge+' '+web('本人 Hopkins 组履历',jlab);
replaceNoteLabel(g,'博士阶段导师候选','博士课题组负责人',som,proof);
replaceInverseLabel(som,g,'博士生候选','博士课题组成员',proof);
replaceIndexLabel(g,som,'博士阶段导师候选','博士课题组负责人',proof);
editLine(fn(local(g)),l=>l.startsWith('- 核查边界：'),l=>'- 核查边界：'+ge+' '+web('作者传记',bio)+' · '+web('本人组履历',jlab)+'。Hopkins 工学院通用简介省略 respectively，分阶段以本人组履历与作者传记为准。'+web('工学院简介',jhu));
changeRow(g,'Gabor A. Somorjai（Berkeley 博士课题组负责人）',null,web('本人组履历',jlab)+' · '+web('作者传记',bio));
const gid=audit(g,{phd:['group_or_candidate',ge,[jlab,bio]],postdoc:['group_or_candidate',ge,[jlab,bio]]},'核 Berkeley 学位论文签署和 Harvard 博后任命具名指导。两阶段与两个实验室分别保留。');
relation(g,'phd',som,'group_leader',ge,[jlab,bio],gid,false);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Dicke与博士课题组';
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

