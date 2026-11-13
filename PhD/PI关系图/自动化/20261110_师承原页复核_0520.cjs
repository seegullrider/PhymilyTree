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
function row(id,text,postdoc=null){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';return cells.join(' | ');
 });
}
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
 a.audit_id='20261110_'+id+'_directory_and_sources_0520';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_stages_0516_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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
function replaceNoteLabel(id,label,replacement,target,extra=''){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceInverseLabel(target,id,label,replacement,extra=''){
 editLine(fn(target),l=>l.startsWith('- '+label+'：')&&l.includes('[['+local(id)+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceIndexLabel(id,target,label,replacement,extra=''){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace(' → '+label+'：',' → '+replacement+'：')+extra);
}

function addRelation(id,label,target,display,detail,inverseLabel){
 const r=records.get(id);
 editLine(fn(r.filename),l=>l==='## 师承',l=>l+'\n\n- '+label+'：[['+target+'|'+display+']]。'+detail);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- '+inverseLabel+'：[['+r.filename+'|'+r.name+']]。'+detail);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+label+'：[['+target+'|'+display+']]。'+detail);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);
}


const man='a2b4730f';
const oldBu='https://www.bu.edu/eng/2025/11/05/david-bishop-wins-prestigious-award-for-his-contributions-to-understanding-superfluids/';
const bu='https://www.bu.edu/physics/category/news/page/8/';
const pu='https://wwwdev.physics.purdue.edu/news/2025/michael-manfra-receives-2026-aps-oliver-e-buckley-condensed-matter-physics-prize.html';
const cn='https://www.cnfusers.cornell.edu/announcements_archive';
const gold='https://www.bu.edu/stem/files/2014/10/Goldberg-CV-STEM.pdf';
audit(man,{
 phd:['group_or_candidate','BU 物理系原公告及 Cornell 讲座确认 BU 1999 博士；Goldberg 本人 CV 的 Ph.D. Theses 一节列 Manfra 及题名（1998），未写他的角色，同节其他论文角色不同。Goldberg 仍是候选。BU 工程学院另一旧报道的原网页未取得正文。',[bu,cn,gold]],
 affiliation:['confirmed','既有 Purdue 量子所页面列物理、材料、电气计算机工程三系。Purdue 物理系的 2026 获奖报道另列首席量子官与 PQSEI 主任。',[pu]]
},'查 BU 论文签署页与 Goldberg 角色；追查 Bell Labs 1998–2000 博后项目和具名指导。');
editLine(fn(local(man)),l=>l.startsWith('- 博士后经历：'),l=>l.replace(web('BU 工程学院',oldBu)+'明确 1999 BU 物理博士。',web('BU 物理系公告',bu)+'确认 1999 BU 博士。'));
note(man,'- 院系／机构：',web('Purdue 物理系获奖公告',pu)+'另列首席量子官及 Purdue Quantum Science and Engineering Institute 主任。');
editLine(path.join(root,'Purdue逐人复核记录.md'),l=>l.startsWith('| [['+local(man)+'|'),l=>l.replace(web('BU 授位学校',oldBu),web('BU 物理系公告',bu)+' · '+web('Purdue 现任职务',pu)));
const g='e860ee24', gd='https://dornsife.usc.edu/profile/christopher-gould/', gt='https://today.usc.edu/profile/christopher-gould/';
audit(g,{
 identity:['confirmed','USC Dornsife 与 USC Today 指向同一 Christopher Gould，超低温实验物理。',[gd,gt]],
 phd:['unresolved','USC Dornsife 分别列 Cornell 物理硕士及博士，均为 1979 年 1 月，未注明博士导师。',[gd]],
 postdoc:['unresolved','USC 履历从 1981 年助理教授起列教职，1979–1981 履历尚缺，未注明博士后身份或导师。',[gd]],
 research:['confirmed','USC Dornsife 本人档列与 Hans Bozler 共同领导超低温物理组，研究超流氦-3及量子流体。',[gd]]
},'Cornell 主机退避期满后查 1979 学位目录和签署页；查 1979–1981 过渡阶段原履历。');
note(g,'- 核查边界：',web('USC Dornsife',gd)+'分列同月 Cornell 物理硕士及博士，1981 年起 USC 助理教授，1979–1981 阶段待查。与 Hans Bozler 共同领导的 USC 课题组另列为现职。');
changeRow(g,'1979-01 Cornell 物理博士，导师待核','1979–1981 履历待核，已阅 USC 档未列博后',web('USC Today',gt));
const y='e7f31bc7', yc='https://www.ntu.edu.sg/cceb/about-us/faculty-and-staff/faculty', yp='https://www.ntu.edu.sg/spms/about-us/physics/people/faculty';
audit(y,{
 affiliation:['confirmed','NTU CCEB 当前全体教师名录列副教授，另见 SPMS 物理系目录；双目录已读，跨聘正式职衔待院校档。',[yc,yp]],
 research:['confirmed','CCEB 名录列材料化学和聚合物物理、纳米技术、光致器件及生物化学。',[yc]],
 phd:['unresolved','SPMS 物理系名录列 Melbourne 博士，未列授位时间或导师。',['https://www.ntu.edu.sg/spms/about-us/physics/people/faculty']]
},'查 University of Melbourne 化学学位馆藏、Photophysics Laboratory 历史名单与本人博士后履历。');
note(y,'- 核查边界：',web('NTU CCEB 教师名录',yc)+'现列副教授及材料化学、聚合物物理和光致器件，与 SPMS 名录对应。');
changeRow(y,'Melbourne 博士，导师及授位时间待核',null,web('CCEB 教师名录',yc));
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0520';
fs.writeFileSync(stamp+'_人工.json',JSON.stringify(audits,null,2)+'\n','utf8');

for(const [file,content] of graph)fs.writeFileSync(file,content,'utf8');
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.review-'));
const temp=path.join(tmp,'audit.json');
try{
 for(const a of audits){
  fs.writeFileSync(temp,JSON.stringify(a),'utf8');
  console.log(execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',temp],{encoding:'utf8'}).trim());
 }

}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
