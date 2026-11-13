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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0809';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0809_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

function addEdge(id,label,target,name,proof,after,candidate=false){
 const r=records.get(id);
 const line='- '+label+'：[['+target+'|'+name+']]。'+proof;
 editLine(fn(r.filename),l=>l.startsWith('- 核查边界：'),l=>line+'\n'+l);
 const file=candidate?path.join(root,'师承候选线索索引.md'):idx;
 editLine(file,l=>candidate?l==='# 师承候选线索索引':l.startsWith('- [['+r.filename+'|')&&l.includes('[['+after+'|'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+line.slice(2));
}
function newMentor(target,name,bio,student,reverse,proof){
 if(fs.existsSync(fn(target))||fs.existsSync(path.join(root,'师承人物',target+'.md')))throw Error('existing mentor '+target);
 const r=records.get(student);
 graph.set(fn(target),'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n\n- '+reverse+'：[['+r.filename+'|'+r.name+']]。'+proof+'\n');
}




const pop='9f3e5309', cooper='f74dc3fd', ning='f8db1341', chi='f8f1c94d';
const stiles='师承人物 - Phillip J. Stiles', bao='人员 - Stanford - Zhenan Bao - d573a8f0';
const brown='https://library.brown.edu/theses/theses.php?task=search&advisorid=1197', fsu='https://physics.fsu.edu/person/dragana-popovic', mag='https://nationalmaglab.org/staff/?name=DraganaPopovic', aps='https://journals.aps.org/prb/abstract/10.1103/PhysRevB.42.1759';
const stan='https://cheme.stanford.edu/events/phd-thesis-defense/christopher-cooper-phd-thesis-defense', wash='https://engineering.washu.edu/faculty/Christopher-Cooper.html', washNews='https://engineering.washu.edu/news/2023/Ten-new-faculty-to-join-McKelvey-Engineering-in-2023-24.html';
const sit='https://www.singaporetech.edu.sg/directory/faculty/ning-xiang', pur='https://docs.lib.purdue.edu/open_access_dissertations/1660/';
const davis='https://physics.ucdavis.edu/people/faculty/shirley-chiang', sym='https://wu.mse.berkeley.edu/ems/pastfliers/1986.pdf', lbl='https://escholarship.org/uc/item/5vf1p0nj';
const pProof='Brown 学位目录明确列 Advisor: Stiles, Phillip J.。1990 年原论文列 Dragana Popović 与 Phillip J. Stiles、Brown 物理系和相同的二维电子气局域化课题，与 FSU 本人履历吻合。Brown 目录学位年为 1990，FSU 与 MagLab 履历为 1989，年份差异保留。';
const pText=web('Brown 学位目录',brown)+'明确列博士导师。'+web('1990 年原论文',aps)+'核对姓名、Brown 物理系、Stiles 和二维电子气局域化方向。'+web('FSU 本人履历',fsu)+'记 1989 年，Brown 目录记 1990 年。';
function cutoff(s){return s.slice(0,s.indexOf(']]。')+3)}
editLine(fn(local(pop)),s=>s.startsWith('- 博士导师候选：')&&s.includes(stiles),s=>cutoff(s).replace('博士导师候选','博士导师')+pText);
editLine(fn(stiles),s=>s.startsWith('- 博士导师候选对应：')&&s.includes(local(pop)),s=>cutoff(s).replace('博士导师候选对应','博士生')+pText);
editLine(idx,s=>s.startsWith('- [['+local(pop)+'|')&&s.includes(' → 博士导师候选：'),s=>s.slice(0,s.lastIndexOf(']]。')+3).replace(' → 博士导师候选：',' → 博士导师：')+pText);
editLine(fn(local(pop)),s=>s.startsWith('- 核查边界：'),s=>'- 核查边界：'+web('MagLab 本人履历',mag)+'列 Brown 博士后（1989–1990 年 3 月）及 IBM Watson 博士后（1990 年 4 月–1993），均未具名指导者。Stiles、Fowler、Washburn 共同署名仅作博后追查线索。学位年份见博士导师条目。');
changeRow(pop,'Phillip J. Stiles（Brown 学位目录明确列导师；学位年有差异）','Brown 及 IBM Watson 两段博后，导师待核',web('1990 年 APS 原论文',aps)+' · '+web('MagLab 本人履历',mag));
const p=audit(pop,{identity:['confirmed','同期 APS 论文列 Dragana Popović、Brown 物理系、Stiles 与二维电子气局域化课题；与 FSU/MagLab 本人履历相符。',[brown,aps,fsu,mag]],phd:['confirmed_advisor',pProof,[brown,aps,fsu,mag]],postdoc:['unresolved','MagLab 履历列 Brown 1989–1990 年 3 月、IBM Watson 1990 年 4 月–1993 两段博后，未列导师。',[mag,fsu]],affiliation:['confirmed','FSU 官方教师页列物理系及国家强磁场实验室。',[fsu,mag]],research:['confirmed','FSU 与 MagLab 履历列无序二维电子体系、电子输运和强关联。',[fsu,mag]]},'查 Brown 论文签署与学位生效日期，并分别追查 Brown 和 IBM Watson 博士后导师。');
relation(pop,'phd',stiles,'advisor',pProof,[brown,aps,fsu,mag],p,false);
editLine(fn(local(cooper)),s=>s.startsWith('- 核查边界：'),s=>s.replace('博士后经历及导师尚未确认。',web('WashU 任职公告',washNews)+'与本人履历确认 NIST 的 NRC 博士后研究及聚合物升级回收方向，未具名指导者。'));
changeRow(cooper,null,'NIST NRC 博后，导师待核',web('WashU 任职公告',washNews));
const c=audit(cooper,{phd:['confirmed_advisor','Stanford 2023 博士答辩列 Academic advisor: Zhenan Bao；WashU 本人履历明确 Stanford 博士由 Bao 指导。',[stan,wash]],postdoc:['unresolved','WashU 本人履历与任职公告确认 NIST NRC 博后，研究聚合物升级回收，未具名指导者。',[wash,washNews]],affiliation:['confirmed','WashU 本人履历列 Energy, Environmental and Chemical Engineering 与 Mechanical Engineering and Materials Science。',[wash]],research:['confirmed','WashU 原档列软材料、高分子和自修复材料。',[wash,washNews]]},'查 NIST NRC 项目或聘任记录中的具名 adviser，并区分博士、硕士和本科指导。');
relation(cooper,'phd',bao,'advisor','Stanford 2023 博士答辩明确列 Academic advisor: Zhenan Bao，WashU 本人履历印证。',[stan,wash],c);
note(ning,'- 核查边界：',web('Purdue 馆藏',pur)+'的同名作者做多肽与脂质膜课题，学位单位与 SIT 本人履历不符，单独排除。');
changeRow(ning,null,null,web('Purdue 同名作者原档（排除）',pur));
audit(ning,{identity:['confirmed','SIT 原档核光子学工作与 Tampere、大连化物所学位。Purdue 馆藏的多肽与脂质膜论文作者为另一人。',[sit,pur]],phd:['unresolved','SIT 原档列 Tampere 技术物理 D Tech、大连化物所物理化学 PhD，均未具名导师。',[sit]],postdoc:['unresolved','SIT 原档无可确认的博士后指导者。',[sit]],affiliation:['confirmed','SIT 官方工程教师档确认历史任职和领域，当前招生资格仍需查。',[sit]],research:['confirmed','SIT 本人页列半导体激光、纳米光子学与光子器件。',[sit]]},'分开查 Tampere 与大连化物所学位原档，继续核 SIT 在岗及招生状态。');
note(chi,'- 核查边界：',web('Berkeley 1986 研讨会履历',sym)+'写博士阶段研究吸附分子红外谱，1983 年加入 IBM San Jose 研究团队。Berkeley 馆藏索引提示论文为 LBL-16151，原档待主机退避结束后核读。');
changeRow(chi,'UC Berkeley（1983），导师待核','1983 IBM 研究职位，是否有独立博后经历待核',web('Berkeley 1986 研讨会履历',sym)+' · '+web('LBL-16151 馆藏索引线索',lbl));
audit(chi,{phd:['unresolved','UC Davis 正式履历列 1983 Berkeley 博士，Berkeley 1986 活动原档确认学生期间研究吸附分子红外谱。LBL-16151 为待核索引，未读原件。',[davis,sym]],postdoc:['unresolved','Berkeley 1986 研讨会履历确认 1983 年进入 IBM San Jose 研究团队，未标注博士后。',[sym,davis]],affiliation:['confirmed','UC Davis 物理系教师档确认荣休及物理系归属。',[davis]],research:['confirmed','UC Davis 教师档列固体表面成像和表面科学，Berkeley 活动资料核实博士阶段红外谱。',[davis,sym]]},'等 escholarship.org 退避结束后读 LBL-16151（qt5vf1p0nj）签署页和致谢；另查 IBM 正式职位性质。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Brown与三校原证';
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
