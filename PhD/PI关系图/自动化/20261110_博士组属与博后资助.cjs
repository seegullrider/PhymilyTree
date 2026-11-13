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
 a.audit_id='20261110_'+id+'_group_fellowship_1435';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_group_fellowship_1435_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const link=(label,url)=>web(label,url)+'。';
const write=(id,msg,ph=null,pd=null)=>{note(id,'- 核查边界：',msg);changeRow(id,ph,pd,msg);};
const old=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,ev,urls)=>[old(id,k).status,old(id,k).note+' '+ev,urls];

const b='0b85dddc', bh='人员 - University of Michigan, Ann Arbor - Pallab Bhattacharya — 荣休 - 8f264b17';
const mi='https://cse.engin.umich.edu/wp-content/uploads/sites/3/2019/09/EECSNewsFW05.pdf';
const osu='https://clas.osu.edu/people/berger.143';
const bEv='Michigan EECS 系刊第 11 页明确 Ohio State 的 Paul Berger 是 Pallab Bhattacharya 组成员，并为该组 1988 年量子点工作做实验，位于其 Michigan 研究生阶段。可确认博士时期组属；正式论文导师仍待签署原档。';
const bp=bEv+' '+link('Michigan EECS 系刊原文',mi);
replaceNoteLabel(b,'博士导师候选','博士阶段课题组负责人',bh,' '+bp);
replaceInverseLabel(bh,b,'博士生候选','博士阶段课题组成员',' '+bp);
replaceIndexLabel(b,bh,'博士导师候选','博士阶段课题组负责人',' '+bp);
write(b,bp+' '+link('Ohio State ECE 职务原档',osu),'Pallab K. Bhattacharya（Michigan 博士阶段课题组负责人；正式导师待核）');
const ba=audit(b,{
 phd:['group_or_candidate',bEv,[mi]],
 affiliation:keep(b,'affiliation','Ohio State 原档核 ECE 教授。',[osu]),
 research:keep(b,'research','Michigan EECS 回顾核其早期量子点实验。',[mi])
},'追 Michigan 1990 学位论文及 Bell Labs 1990–1992 任用职称。');
relation(b,'phd',bh,'group_leader',bEv,[mi,osu],ba,false);

const y='199ec1d1', ra='师承人物 - Akshay Rao';
const rgrp='https://rao.oe.phy.cam.ac.uk/team/';
const yh='https://fas.yale.edu/news-announcements/new-faculty-announcements/new-ladder-faculty-and-professors-2021-22/mengxia-liu';
const yd='https://engineering.yale.edu/research-and-faculty/faculty-directory/mengxia-liu';
const cp='https://api.repository.cam.ac.uk/server/api/core/bitstreams/2d398632-b3bf-403d-856c-e9ad358a280d/content';
const yEv='Rao 课题组校友原档直接列 Mengxia Liu 及 Yale 教职。Yale 聘任公告确认同一人当时为 Cambridge Cavendish 博后，结合同期实验室论文，确认博士后课题组归属；个人正式导师字段待查。';
const yp=yEv+' '+link('Cambridge Rao 组校友原档',rgrp)+' '+link('Yale 聘任原档',yh);
replaceNoteLabel(y,'博士后导师候选','博士后课题组负责人',ra,' '+yp);
replaceInverseLabel(ra,y,'博士后指导候选','博士后课题组成员',' '+yp);
replaceIndexLabel(y,ra,'博士后导师候选','博士后课题组负责人',' '+yp);
editLine(fn(local(y)),x=>x.startsWith('- 核查边界：'),x=>x.replace('Cambridge 博士后导师仍待核，Rao 的论文合著仅作候选线索。','Cambridge 博后任用及课题组归属已核，个人导师正式称谓仍待原档。'));
write(y,yp,null,'Akshay Rao（Cambridge Cavendish 博士后课题组负责人）');
const ya=audit(y,{
 postdoc:['group_or_candidate',yEv,[rgrp,yh,cp]],
 affiliation:keep(y,'affiliation','Yale 工程学院原档列 ECE 助理教授。',[yd]),
 research:keep(y,'research','Yale 聘任原档核量子点与纳米结构半导体光电材料。',[yh,yd])
},'核 Cambridge 博后任用起止及个人 advisor 字段。');
relation(y,'postdoc',ra,'group_leader',yEv,[rgrp,yh,cp],ya,false);

const k='67a130a4', km='师承人物 - George Malliaras';
const uci='https://engineering.uci.edu/events/2025/10/eecs-seminar-mixed-conductors-bioelectronics';
const grant='https://cordis.europa.eu/project/id/101022365';
const paper='https://link.springer.com/article/10.1557/s43579-023-00511-6';
const rice='https://profiles.rice.edu/faculty/scott-keene';
const kEv='UCI 2025 讲者资料独立核 Cambridge 电气工程及物理两部门由 George Malliaras、Akshay Rao 共同指导。Keene 署名论文将本人关联 MSCA 项目 101022365；CORDIS 核资助 2021-05-10 至 2023-05-09。此为资助区间，Cambridge 全部任用起止月待核。';
const kp=kEv+' '+link('UCI 讲座原档',uci)+' '+link('EU 资助原档',grant)+' '+link('本人论文经费声明',paper);
for(const m of [km,ra]){
 replaceNoteLabel(k,'博士后导师','博士后导师',m,' '+kp);
 mentorLine(m,k,'- 博士后研究者：',kp);
 indexLine(k,m,'博士后导师',kp);
}
write(k,kp,null,'George Malliaras、Akshay Rao（Cambridge 博士后导师；MSCA 资助 2021-05 至 2023-05）');
const ka=audit(k,{
 postdoc:['confirmed_advisor',kEv,[uci,grant,paper]],
 phd:keep(k,'phd','UCI 讲者原档独立核 Stanford Salleo 组及 2020 博士。',[uci,rice]),
 affiliation:keep(k,'affiliation','Rice 原档列 2024-07 入职材料科学与纳米工程系。',[rice,uci]),
 research:keep(k,'research','UCI 原档列有机混合导体、神经形态器件和生物电子。',[uci,rice])
},'继续按论文题名追 Stanford 签署原件，并查 Cambridge 全部任用月。');
for(const m of [km,ra])relation(k,'postdoc',m,'advisor',kEv,[uci,grant,paper],ka,false);

const s='9172baa3';
const sd='https://www-library.desy.de/diss13.html', sc='https://www.duffield.cornell.edu/people/andrej-singer/';
const sEv='DESY 原目录列 Andrej Singer 的 Hamburg 博士论文及报告号 DESY-THESIS-2013-023。目录的 2013 年 6 月为报告日期，Cornell 原档列 2012 年授予博士。下载跳转未取到正文，现有博士阶段指导和博后阶段研究师长关系保留。';
write(s,sEv+' '+link('DESY 原始书目',sd)+' '+link('Cornell 院系原档',sc));
audit(s,{
 phd:keep(s,'phd',sEv,[sd,sc]),
 affiliation:keep(s,'affiliation','Cornell 工程学院原档同时列 MSE 及 Physics 研究生领域。',[sc])
},'用 DESY 号找可访问的完整论文及签署页，核评阅人与正式指导职衔。');

const z='5822368e';
const zcv='https://sites.bu.edu/xinzhang-lab/files/2026/05/Short-CV-Xin-Zhang-Boston-University.pdf';
const zEv='2026 年 BU 本人短 CV 把 MIT EECS 博后列在教育训练，把 2000–2001 MIT EECS Research Scientist 单列在任用。现有 S. Mark Spearing 仍为博后指导候选。';
write(z,zEv+' '+link('2026 本人 CV',zcv),null,'MIT EECS 博后；2000–2001 MIT Research Scientist 单列；S. Mark Spearing（候选）');
audit(z,{
 postdoc:keep(z,'postdoc',zEv,[zcv]),
 affiliation:keep(z,'affiliation','2026 本人 CV 复核 BU 教授任职。',[zcv])
},'按已知题名追 HKUST 博士签署原件；分别追 MIT EECS 博后任用与科研岗指导人。');


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_博士组属与博后资助';
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

