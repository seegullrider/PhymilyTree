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
 a.audit_id='20261110_'+id+'_program_and_identity_0852';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_program_and_identity_0852_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const ga='27209b2d', ki='2a2415ac', sh='2c21826b', mm='a2b4730f';
const boy='师承人物 - Robert W. Boyd', co='师承人物 - E. G. D. Cohen', zh='人员 - NTU - Nikolay Zheludev（访问职位） - cbad1857';
const gc='https://www.engineering.columbia.edu/sites/default/files/2025-07/gaeta_cv_4_25.pdf', gp='https://journals.aps.org/pra/abstract/10.1103/PhysRevA.44.3205', go='https://www.optica.org/about/leadership_and_volunteers/election_for_2026_offices/vice_president/alexander_gaeta/';
const kc='https://www.physics.umd.edu/people/faculty/cv/KirkpatrickCV.pdf', ku='https://www.umdphysics.umd.edu/directory/faculty/emeritus/tedkirkp.html', kn='https://scholars.unh.edu/dissertation/1413/', kp='https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.42.862', kr='https://www.rockefeller.edu/news/20705-statistical-physicist-rockefeller-professor-emeritus-e-g-d-eddie-cohen-dies-94/';
const ss='https://shen-lab.mystrikingly.com/', sp='https://multiply.astonphotonics.uk/', sn='https://www.ntu.edu.sg/spms/about-us/physics/people/research-staff', sl='https://repository.lsu.edu/gradschool_dissertations/1000/';
const mt='https://physics.gatech.edu/event/school-physics-fall-colloquium-series-dr-michael-j-manfra', mq='https://quantum.research.purdue.edu/directory/michael-manfra/', mg='https://www.bu.edu/stem/files/2014/10/Goldberg-CV-STEM.pdf';
function cand(id,stage,mentor,name,evidence,sources,auditId){
 const post=stage==='postdoc';
 const proof=sources.map(([label,url])=>web(label,url)).join(' · ')+'。'+evidence;
 addEdge(id,post?'博士后导师候选':'博士导师候选',mentor,name,proof,null,true);
 editLine(fn(mentor),l=>l==='## 师承',l=>l+'\n\n- '+(post?'博士后候选研究者':'博士候选研究者')+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
 relation(id,stage,mentor,'candidate',evidence,sources.map(([,url])=>url),auditId);
}

const ge='Columbia 本人 CV 在教育栏明确 Rochester 1991 年光学博士论文导师为 R. W. Boyd，另列 Rochester Institute of Optics 1990–1992 Postdoctoral Associate。博士年份与所列博后时段相交。1991 年 APS 论文列 Gaeta、Boyd 同机构合作，Boyd 暂为低可信博士后候选。';
const gaid=audit(ga,{phd:['confirmed_advisor','Columbia 本人 CV 明列 1991 年博士论文 Advisor R. W. Boyd。',[gc]],postdoc:['group_or_candidate',ge,[gc,gp]],affiliation:['confirmed','Columbia 本人 CV 和 Optica 候选人官方履历确认 Columbia 教职及应用物理、材料科学方向。',[gc,go]],research:['confirmed','Optica 公开本人履历列量子光子学和非线性光子学。',[go,gc]]},'查 Rochester 1990–1992 原聘任档的实际起止月、指导人及博士年份交叠。');
note(ga,'- 核查边界：',web('本人 Columbia CV',gc)+'复核教育和任职分列。');
cand(ga,'postdoc',boy,'Robert W. Boyd',ge,[['本人 Columbia CV',gc],['1991 APS 原文',gp]],gaid);
changeRow(ga,null,'Rochester 1990–1992 博后（与 1991 博士年份相交）；Boyd 为低可信候选',web('本人 Columbia CV',gc));

const ke='Maryland 本人 CV 列 Rockefeller 1981 年理论物理博士。1979 年 APS 原文列 T. Kirkpatrick 和 E. G. D. Cohen 的同期 Rockefeller 合作，Cohen 的 Rockefeller 校方档案佐证研究方向及任职。Cohen 暂列低可信博士候选。';
const kiid=audit(ki,{identity:['confirmed','Maryland 本人 CV 确认 Theodore Ross Kirkpatrick、Rockefeller 1981 理论物理博士。UNH 论文属 John Theodore Kirkpatrick、1983 刑事暴力研究，身份不同。',[kc,kn]],phd:['group_or_candidate',ke,[kc,kp,kr]],postdoc:['unresolved','Maryland 本人 CV 列 1981–1983 理论统计力学 Research Associate，后转助理教授。原 CV 未列个人指导者，亦未给出 postdoctoral 职称。',[kc]],affiliation:['confirmed','Maryland 原档列物理荣休；历史本人 CV 确认 IPST 和物理与天文学。',[ku,kc]],research:['confirmed','Maryland 院系核实低温强关联、无序电子和相变。',[ku,kc]]},'查 Rockefeller 1981 年学位和答辩档、Maryland 1981 年 Research Associate 聘任或项目指导者。');
note(ki,'- 核查边界：',web('Maryland 本人 CV',kc)+'列 1981–1983 IPST Research Associate，职位是否属博士后及具体指导者待核。'+web('UNH 误配学位档',kn)+'为 John Theodore Kirkpatrick 的刑事研究，已排除。');
cand(ki,'phd',co,'E. G. D. Cohen',ke,[['本人 Maryland CV',kc],['1979 APS 原文',kp],['Rockefeller 原档',kr]],kiid);
changeRow(ki,'Rockefeller 1981 博士；E. G. D. Cohen 为低可信候选','Maryland IPST 1981–1983 Research Associate；职位性质及指导者待核',web('本人 Maryland CV',kc));

const se='Shen 本人履历将 Southampton Marie Curie Senior Research Fellow 链至 MULTIPLY，并明确写 Nikolay I. Zheludev 组。MULTIPLY 原页在官方博士后项目介绍及 fellows 名单列 Yijie Shen。支持博士后训练及组属，个人正式指导关系尚待任命档。';
const sha=audit(sh,{identity:['confirmed','NTU 本人实验室履历列华南理工 2015 年本科及清华 2019 年光学工程博士；LSU 同名者 2014 年完成多孔介质孔隙流动研究博士论文，学位与方向不符。',[ss,sl,sn]],postdoc:['group_or_candidate',se,[ss,sp]],affiliation:['confirmed','本人档列 NTU SPMS、EEE 与 CDPT，NTU 学校页确认该组 PI。',[ss,sn]],research:['confirmed','NTU 本人实验室原档核结构光、拓扑光子学、超表面。',[ss,sn]]},'查清华 2019 光学工程论文正式导师，以及 Southampton 聘任中的个人指导人；保留 Marie Curie 的正式岗位称谓。');
const proof=web('本人实验室履历',ss)+' · '+web('MULTIPLY 项目原档',sp)+'。'+se;
editLine(fn(local(sh)),l=>l.startsWith('- 博士毕业后研究课题组负责人（职位性质待核）：')&&l.includes('[['+zh+'|'),l=>l.slice(0,l.lastIndexOf(']]。')+3).replace('博士毕业后研究课题组负责人（职位性质待核）','博士后阶段课题组负责人')+proof);
editLine(fn(zh),l=>l.startsWith('- 博士毕业后研究课题组成员（职位性质待核）：')&&l.includes('[['+local(sh)+'|'),l=>l.slice(0,l.lastIndexOf(']]。')+3).replace('博士毕业后研究课题组成员（职位性质待核）','博士后阶段课题组成员')+proof);
editLine(idx,l=>l.startsWith('- [['+local(sh)+'|')&&l.includes('博士毕业后研究课题组负责人（职位性质待核）：'),l=>l.slice(0,l.lastIndexOf(']]。')+3).replace('博士毕业后研究课题组负责人（职位性质待核）','博士后阶段课题组负责人')+proof);
editLine(fn(local(sh)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+proof+' 清华博士导师待查。'+web('LSU 同名学位档',sl)+'列 2014 年多孔介质论文，已核为误配。');
changeRow(sh,null,'Southampton MULTIPLY 博后项目；Nikolay Zheludev（课题组负责人）',web('MULTIPLY 项目原档',sp));
relation(sh,'postdoc',zh,'group_leader',se,[ss,sp],sha,false);

const mpe='Georgia Tech 物理讲座原档列 1998–2000 Bell Labs Postdoctoral Member of Technical Staff 及 2001 转技术人员，未列导师。Goldberg 的 BU PDF 当前重定向到一般教学中心主页；既有论文条目候选保留。';
note(mm,'- 博士后经历：',web('Georgia Tech 原档',mt)+'再次确认两项职称。Goldberg 的旧 PDF 重定向至教学中心通用页，未获可核原文。');
changeRow(mm,null,null,web('Georgia Tech 讲座原档',mt));
audit(mm,{postdoc:['unresolved',mpe,[mt]],affiliation:['confirmed','Purdue 量子所本人档列物理与天文学、电气与计算机工程、材料工程。',[mq]],research:['confirmed','Purdue 原档和 Georgia Tech 讲座确认低维半导体、量子输运、拓扑物态。',[mq,mt]]},'查 BU 量子霍尔论文导师字段与 Bell Labs 博后任命；避免将旧 CV 清单当作正式指导证据。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_博后项目与学位身份核查';
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
