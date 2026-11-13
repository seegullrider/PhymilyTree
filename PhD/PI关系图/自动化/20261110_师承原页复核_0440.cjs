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
 a.audit_id='20261110_'+id+'_named_training_records';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id){
 typed.push({event_id:'20261110_named_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new:true});
}
const girsh='e7414d1f', rebane='师承人物 - Ljubov A. Rebane';
const girshBio='https://girsh.rutgers.edu/index.php/about/';
const girshFac='https://physics.rutgers.edu/people/faculty-list/faculty-profile/blumberg-girsh';
const girshCV='https://www.etis.ee/CV/Girsh_Blumberg';
const girshWiki='https://en.wikipedia.org/wiki/Girsh_Blumberg';
const girshPost='Rutgers 本人实验室传记列 1987 年 Estonian Academy of Sciences 物理与数学博士、1981 年起在该机构任研究助理及高级研究助理、1992 年起 UIUC 访问助理教授、1998 年起 Bell Labs Member of Technical Staff；已读履历未单列博士后。';
let aid=audit(girsh,{
 phd:['group_or_candidate','本人组传记确认 1987 年 Estonian Academy of Sciences 物理与数学博士。ETIS 公开原页仅显示姓名和脚本提示；Rebane 仍是二手来源候选。',[girshBio,girshCV,girshWiki]],
 postdoc:['no_postdoc_documented',girshPost,[girshBio,girshFac]]
},'检索 1987 年学位论文或授位档核对 Rebane；继续追查历史研究岗位的性质。');
note(girsh,'- 核查边界：',girshPost+' '+web('Rutgers 实验室传记',girshBio));
row(girsh,web('Rutgers 教师页',girshFac)+' · '+web('本人实验室传记',girshBio),'已阅履历未单列博士后');
relation(girsh,'phd',rebane,'candidate','1987 年 Estonian Academy of Sciences 物理与数学博士已由 Rutgers 实验室传记确认；Rebane 的姓名来自二手人物条目，原始导师记录待核。',[girshBio,girshWiki],aid);

const erich='d72fb6d2', ho='师承人物 - Tin-Lun Ho';
const erichBio='https://as.cornell.edu/people/erich-mueller';
const gold='https://muellergroup.lassp.cornell.edu/thesis/Goldbaum_Thesis_12-1.pdf';
const erichText='Cornell 学院履历确认 Ohio State 物理博后为 2001–2003 年；Goldbaum 博士论文自传记载当时与 Jason Ho 共事。正式个人导师字段待核。';
audit(erich,{postdoc:['group_or_candidate',erichText,[erichBio,gold]]},'查 Ohio State 2001–2003 年任命档和 Tin-Lun Jason Ho 的受指导人员名单。');
const erichLink=web('Cornell 学院履历',erichBio)+' 确认 2001–2003 Ohio State 物理博后。';
note(erich,'- 博士后研究合作者：',erichLink);
mentorLine(ho,erich,'- 博士后研究合作者：',erichLink);
indexLine(erich,ho,'博士后研究合作者',erichLink);
row(erich,web('Cornell 学院履历',erichBio)+' · '+web('Goldbaum 论文自传',gold),'Tin-Lun Ho（2001–2003 Ohio State 博后研究合作，正式导师待核）');

const tim='41c1e5a1', reich=local('38d42d59'), chan=local('9a4a4057');
const princ='https://pcts.princeton.edu/people/past-postdocs';
const colOld='https://www.columbia.edu/cu/chemistry/fac-bios/reichman/group/dir.html';
const colChem='https://www.chem.columbia.edu/content/timothy-c-berkelbach';
const chanLab='https://www.chan-lab.caltech.edu/former-members';
audit(tim,{
 affiliation:['confirmed','Columbia 化学系本人页确认本系任职，组页列 Flatiron 联合任职。',[colChem]],
 phd:['group_or_candidate','Columbia 化学系同期旧目录列 Timothy Charles Berkelbach 为 Reichman 组研究生，和本人 DOE 读博介绍及 2009–2014 组校友名录一致。论文导师字段未见。',[colOld]],
 postdoc:['group_or_candidate','Princeton 理论科学中心历任博后名单与 Chan 组档相符；组档列 2014–2016 PCTS fellow。未见个人 advisor 字段。',[princ,chanLab]]
},'按 Columbia 化学物理博士姓名及毕业年查纸本学位目录，追查 Princeton 博后任命原件。');
const timPhd=web('Columbia 同期组档',colOld)+'另列 Timothy Charles Berkelbach 为该组研究生。';
const timPost=web('Princeton 理论科学中心',princ)+'确认其 PCTS 博后身份。';
note(tim,'- 博士阶段课题组负责人：',timPhd);
note(tim,'- 博士后课题组负责人：',timPost);
mentorLine(reich,tim,'- 博士阶段课题组成员：',timPhd);
mentorLine(chan,tim,'- 博士后课题组成员：',timPost);
indexLine(tim,reich,'博士阶段课题组负责人',timPhd);
indexLine(tim,chan,'博士后课题组负责人',timPost);
row(tim,web('Columbia 化学系',colChem)+' · '+web('Princeton 博士后档案',princ));

const cui='50c332ba';
const cuiOwn='https://www.zhcui.com/people/';
const cuiAward='https://blavatnikawards.org/honorees/profile/zhihao-cui/';
const cuiPhd='本人组履历和 Blavatnik 获奖档明确列 2017–2023 Caltech PhD advisor Garnet Chan。';
aid=audit(cui,{
 phd:['confirmed_advisor',cuiPhd,[cuiOwn,cuiAward]],
 postdoc:['confirmed_advisor','本人履历分列 2023–2026 Columbia 博后及与 David Reichman、Andrew Millis 的研究，获奖档明确两人为博士后 advisors。',[cuiOwn,cuiAward]]
},'现有两阶段导师具名，继续留存 Caltech 学位档案索引及后续任职更新。');
audits.at(-1).followup_required=false;
const cuiLink=web('Blavatnik 获奖履历',cuiAward)+'也分列博士导师 Chan 与两位博士后导师。';
note(cui,'- 博士导师：',cuiLink);
mentorLine(chan,cui,'- 博士生：',cuiLink);
indexLine(cui,chan,'博士导师',cuiLink);
row(cui,cuiLink);
relation(cui,'phd',chan,'advisor',cuiPhd,[cuiOwn,cuiAward],aid);

const norah='4b681f7d', neepa='师承人物 - Neepa Maitra', rubio='师承人物 - Ángel Rubio';
const maitCv='https://sites.rutgers.edu/maitra-group/wp-content/uploads/sites/354/2021/07/Maitra_Neepa-Nov2025.pdf';
const norahCol='https://news.columbia.edu/news/lights-camera-quantum-theoretical-quantum-physicist-day-and-actor-night-postdoc-norah-hoffmann';
const norahPhd='Maitra 本人 CV 将 MPI-Hamburg 博士生 Norah Hoffmann 列为与 Ángel Rubio 共同指导，Columbia 本人访谈亦确认 Maitra 为共同导师。';
const norahPost='Columbia 本人访谈明确其曾在 Columbia 化学系取得与 Timothy Berkelbach 共事的博士后职位，另列 Flatiron guest scientist。个人正式导师称谓待核。';
aid=audit(norah,{phd:['confirmed_advisor',norahPhd,[maitCv,norahCol]],postdoc:['group_or_candidate',norahPost,[norahCol]]},'查 Hamburg 博士论文签署与 Columbia 博后指导文件；Flatiron guest scientist 单列。');
const norahLink=web('Columbia 本人访谈',norahCol)+'另明确列 Flatiron guest scientist，为另一项身份。';
note(norah,'- 博士后阶段研究师长：',norahLink);
mentorLine(local(tim),norah,'- 博士后阶段研究成员：',norahLink);
indexLine(norah,local(tim),'博士后阶段研究师长',norahLink);
row(norah,web('Maitra CV',maitCv)+' · '+web('Columbia 本人访谈',norahCol));
relation(norah,'phd',neepa,'advisor',norahPhd,[maitCv,norahCol],aid);
relation(norah,'phd',rubio,'advisor',norahPhd,[maitCv,norahCol],aid);
relation(norah,'postdoc',local(tim),'stage_mentor',norahPost,[norahCol],aid);

const zgid='b3ef77a3', noo='师承人物 - Marcel Nooijen';
const zgidDef='https://bulletin.uwaterloo.ca/2008/mar/13th.html';
const zgidThesis='https://uwspace.uwaterloo.ca/items/ac65926b-650c-49ce-8987-dabb5b6a13c9';
const zgidOwn='https://sites.lsa.umich.edu/zgid/dominika/';
const zgidPhd='Waterloo 2008 化学博士答辩公告列 Dominika K. Zgid 的 Supervisor 为 M. Nooijen；官方学位目录的姓名、题目和年份吻合。';
const zgidPost='本人 Michigan 组页分列 2009–2011 Cornell 化学与化学生物学及 2011–2012 Columbia 物理博士后；Chan 组校友页只支持前一段组属，未见个人导师字段。';
aid=audit(zgid,{phd:['confirmed_advisor',zgidPhd,[zgidDef,zgidThesis]],postdoc:['group_or_candidate',zgidPost,[zgidOwn,chanLab]]},'追查 2011–2012 Columbia 物理博后个人指导及 Cornell 任命记录。');
const zgidLink=web('Waterloo 论文目录',zgidThesis)+'核对 2008 年作者及论文题目。';
const zgidPostLink=web('本人 Michigan 履历',zgidOwn)+'分列 Cornell 2009–2011 与 Columbia 2011–2012 博后。Chan 组名册所列为前一段。';
note(zgid,'- 博士导师：',zgidLink);
note(zgid,'- 博士后课题组负责人：',zgidPostLink);
mentorLine(noo,zgid,'- 博士生：',zgidLink);
mentorLine(chan,zgid,'- 博士后课题组成员：',zgidPostLink);
indexLine(zgid,noo,'博士导师',zgidLink);
indexLine(zgid,chan,'博士后课题组负责人',zgidPostLink);
row(zgid,web('Waterloo 论文目录',zgidThesis)+' · '+web('本人 Michigan 履历',zgidOwn),'Garnet K.-L. Chan（Cornell 2009–2011 课题组负责人）；Columbia 2011–2012 指导待核');
relation(zgid,'phd',noo,'advisor',zgidPhd,[zgidDef,zgidThesis],aid);
relation(zgid,'postdoc',chan,'group_leader',zgidPost,[zgidOwn,chanLab],aid);

const wang='c5860d2c', schaefer='师承人物 - Henry F. Schaefer III', valeev='师承人物 - Edward Valeev';
const wangVT='https://vt-chemical-theory.github.io/website/_posts/alumni/xiao_wang.html';
const wangSF='https://www.simonsfoundation.org/people/xiao-wang/';
const wangOwn='https://www.wangtheorylab.com/';
const wangNews='https://valeevgroup.github.io/News/';
const wangPhd='Virginia Tech 课题组档明确列 UGA 2012–2016 PhD Supervisor Henry F. Schaefer III，Simons 与本人组页确认 UGA 2016 年博士。';
const wangPost='本人组页分列 2016–2018 Virginia Tech 博后和 2019–2022 Flatiron Research Fellow；Simons 履历确认前者与 Edward Valeev、后者与 Timothy Berkelbach 合作，Valeev 组公告称 Flatiron fellow under Berkelbach。';
aid=audit(wang,{phd:['confirmed_advisor',wangPhd,[wangVT,wangOwn]],postdoc:['group_or_candidate',wangPost,[wangOwn,wangSF,wangVT,wangNews]]},'追查 Virginia Tech 正式博后指导和 Flatiron fellowship 的任命角色。');
const wangVTLink=web('本人 UCSC 组页',wangOwn)+'列 Virginia Tech 博后为 2016–2018。';
const wangSFLink=web('Simons 履历',wangSF)+'确认 Flatiron Research Fellow 于 2019 年开始，并在该阶段与 Berkelbach 研究激子。';
note(wang,'- 博士后课题组负责人：',wangVTLink);
note(wang,'- 博士后阶段研究师长：',wangSFLink);
mentorLine(valeev,wang,'- 博士后课题组成员：',wangVTLink);
mentorLine(local(tim),wang,'- 博士后阶段研究者：',wangSFLink);
indexLine(wang,valeev,'博士后课题组负责人',wangVTLink);
indexLine(wang,local(tim),'博士后阶段研究师长',wangSFLink);
row(wang,web('本人 UCSC 组页',wangOwn)+' · '+web('Simons 履历',wangSF),'Edward Valeev（Virginia Tech 博后课题组负责人）；Timothy Berkelbach（Flatiron fellowship 研究师长）');
relation(wang,'phd',schaefer,'advisor',wangPhd,[wangVT,wangOwn],aid);
relation(wang,'postdoc',valeev,'group_leader',wangPost,[wangVT,wangOwn,wangSF],aid);
relation(wang,'postdoc',local(tim),'stage_mentor',wangPost,[wangNews,wangSF,wangOwn],aid);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0440';
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

