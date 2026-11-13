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
 a.audit_id='20261110_'+id+'_vitae_and_disambig_1741';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_vitae_and_disambig_1741_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const carman='a0e87d41', reif='师承人物 - Kenneth L. Reifsnider';
const vtech='https://vtechworks.lib.vt.edu/server/api/core/bitstreams/51ab52f5-37d0-4e8d-8692-f059545292b6/content';
const ucla='https://samueli.ucla.edu/people/gregory-carman/';
const hopkins='https://cismms.jhu.edu/wp-content/uploads/2016/10/Carman-seminar-Nov4th-2016-flyer.pdf';
const academy='https://www.nationalacademies.org/read/11664/chapter/15';
const carmanPhd='Virginia Tech 1991 论文原件将 Kenneth L. Reifsnider 列为 Chairman，致谢单独感谢其信任并另列四名委员会成员。保留博士导师候选，正式指导职衔待查。';
const carmanPost='JHU 讲座原档列 Virginia Tech 1991 博士并于同年加入 UCLA 机械与航空航天工程系，美国国家科学院委员会简介将加入 UCLA 记为 1992。已核履历未见独立博士后，保留任职年份差异。';
const carmanEvidence=carmanPhd+' '+web('学位原件',vtech);
editLine(fn(local(carman)),l=>l.startsWith('- 博士导师候选：'),l=>l.split(' 证据边界：')[0]+' '+carmanEvidence);
editLine(fn(reif),l=>l.startsWith('- 博士生候选：')&&l.includes(local(carman)),l=>l.split(' 证据边界：')[0]+' '+carmanEvidence);
editLine(idx,l=>l.startsWith('- [['+local(carman)+'|')&&l.includes(' → 博士导师候选：'),l=>l.split(' 证据边界：')[0]+' '+carmanEvidence);
editLine(fn(local(carman)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+carmanPost+' '+web('JHU 讲座原档',hopkins)+' · '+web('国家科学院原档',academy));
changeRow(carman,'Kenneth L. Reifsnider（候选，学位原件列主席）','可读履历未见独立博士后，UCLA 入职有 1991 与 1992 两种记载',web('学位原件',vtech)+' · '+web('JHU 原档',hopkins)+' · '+web('国家科学院原档',academy));
let aid=audit(carman,{phd:['group_or_candidate',carmanPhd,[vtech,ucla]],postdoc:['no_postdoc_documented',carmanPost,[hopkins,academy,ucla]]},'追查 Virginia Tech 学位目录或导师档案中的正式指导职衔。若发现 UCLA 早期任用原件，核实是否有独立博后及实际入职年。');
relation(carman,'phd',reif,'candidate',carmanPhd,[vtech],aid);

const martin='1f1764c8',ramesh='人员 - UC Berkeley - Ramamoorthy Ramesh - 35af1b59';
const rice='https://profiles.rice.edu/faculty/lane-martin',riceNews='https://news.rice.edu/news/2023/rice-selects-lane-martin-lead-new-advanced-materials-institute';
const mcv='https://prometheus.berkeley.edu/lane.html',ucf='https://stars.library.ucf.edu/etd/4602/';
const citing='https://escholarship.org/content/qt7zr7w5dw/qt7zr7w5dw_noSplash_367aded553966983b5a3e6a6ebd7d935.pdf';
const mt='Berkeley 馆藏的另一篇学位论文书目将 Lane Wyatt Martin 2008 博士论文列为 Engineering Multiferroic Materials and New Functionalities in Materials。';
const md='Rice 任用公告引述 Ramesh 本人明确指导 Berkeley 博士阶段的 Lane W. Martin。正式论文导师职衔待原件。';
const mp='本人 Berkeley 组档与 Rice 人员页一致列 2008–2009 Berkeley Lab Materials Sciences Division 的 Quantum Materials Group 博后。未列具名指导。';
const identity='Rice 档案对应 2008 Berkeley 材料博士 Lane Wyatt Martin。UCF 档案的同名 Lane Martin 是 2014 光学博士，研究无序光子晶格，不能挂接到本人物。';
note(martin,'- 博士阶段研究师长、正式导师候选：',mt+' '+web('Berkeley 馆藏书目',citing));
editLine(fn(local(martin)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+mp+' '+identity+' '+web('本人 Berkeley 组档',mcv)+' · '+web('Rice 人员页',rice)+' · '+web('UCF 同名学位原档',ucf));
changeRow(martin,null,'Berkeley Lab Quantum Materials Group 博后 2008–2009，具名指导待核',web('本人 Berkeley 组档',mcv)+' · '+web('博士论文书目',citing));
aid=audit(martin,{identity:['confirmed',identity,[rice,ucf]],phd:['group_or_candidate',md+' '+mt,[riceNews,citing]],postdoc:['unresolved',mp,[mcv,rice]]},'以已知论文全名查询 Berkeley 学位馆藏或学位封面。寻找 Berkeley Lab 2008–2009 项目或博后安排原件。');
relation(martin,'phd',ramesh,'stage_mentor',md,[riceNews,rice],aid);
const laneAudit=aid;

const rana='2e1c4bad';
const cornell='https://www.duffield.cornell.edu/people/farhan-rana/';
const ieee='https://people.ece.cornell.edu/rana/papers/paper8.pdf';
const interview='https://www.cornellsun.com/article/2004/03/prof-snags-400k';
const ranaPost='2004 年同期访谈中，Rana 本人称完成 MIT 博士论文后即赴 Ithaca，Cornell 工程原档与本人 2007 年原刊简介均列 2003 年开始 Cornell 任教。IBM 研究在读博前，已核履历未见独立博士后。';
note(rana,'- 核查边界：',ranaPost+' '+web('同期本人采访',interview));
changeRow(rana,null,'已核履历未见独立博士后，2003 年 MIT 授位后赴 Cornell',web('同期本人采访',interview));
audit(rana,{postdoc:['no_postdoc_documented',ranaPost,[interview,cornell,ieee]]},'等 MIT 学位站点退避到期，再核半导体激光噪声与动力学论文的正式导师栏。Rajeev Ram 现为博士阶段课题组负责人。');

const novo='1f2aa706',geim='师承人物 - Andre Geim';
const nusCV='https://ifim.nus.edu.sg/professor-sir-konstantin-kostya-s-novoselov-frs-curriculum-vitae/';
const nus='https://cde.nus.edu.sg/mse/staff/novoselov-konstantin-sergeevich/';
const geimLecture='https://www-web.nottingham.ac.uk/~ppzmh/mywebsite/Publications/Nobel%20Lecture_Andre%20Geim.pdf';
const novoInterview='https://www.dagospia.com/cronache/premio-nobel-novoselov-grafene-cambiato-tutto-resta-misterioso-in-futuro-185598';
const nv='Novoselov 本人受访称 Geim 在博士尚未完成时邀请他到 Manchester 做博后。Geim 的 Nobel 讲稿称该聘用为其组的 research fellow，Novoselov 直到 2004 年答辩仍在 Nijmegen 注册为博士生。NUS 本人 CV 列 Manchester Researcher 2001–2005、Leverhulme Research Fellow 2005–2006。将 Geim 单列为 Manchester 早期研究聘用阶段的课题组负责人，正式博后导师职衔和 Leverhulme 阶段的指导待核。';
const nvProof=nv+' '+web('本人采访转载',novoInterview)+' · '+web('Geim 本人讲稿',geimLecture)+' · '+web('NUS 本人 CV',nusCV);
editLine(fn(local(novo)),l=>l.startsWith('- 核查边界：'),l=>'- 博士后课题组负责人：[['+geim+'|Andre Geim]]。'+nvProof+'\n'+l.replace('博士后经历与导师仍待核，不能由博士后继续合作推断。','Manchester 与 Nijmegen 时间重叠见上，授位档中的正式博后指导仍待追查。'));
editLine(fn(geim),l=>l.startsWith('- 博士生：')&&l.includes(local(novo)),l=>l+'\n- 博士后课题组成员：[['+local(novo)+'|Konstantin Novoselov]]。'+nvProof);
editLine(idx,l=>l.startsWith('- [['+local(novo)+'|')&&l.includes(' → 博士导师：')&&l.includes(geim+'|'),l=>l+'\n- [['+local(novo)+'|Konstantin Novoselov]] → 博士后课题组负责人：[['+geim+'|Andre Geim]]。'+nvProof);
note(novo,'- NUS 材料科学与工程教授', 'NUS 本人 CV 另列 2021 年起任 Institute for Functional Intelligent Materials 主任。 '+web('NUS 本人 CV',nusCV));
changeRow(novo,null,'Andre Geim（Manchester 早期课题组负责人，2004 授位前已入组）；Leverhulme 阶段指导待核',web('本人采访转载',novoInterview)+' · '+web('Geim 讲稿',geimLecture)+' · '+web('NUS CV',nusCV));
aid=audit(novo,{affiliation:['confirmed','NUS 材料科学与工程系教职。NUS 本人 CV 另列 2021 年起任功能智能材料研究所主任。',[nus,nusCV]],postdoc:['group_or_candidate',nv,[novoInterview,geimLecture,nusCV]]},'核 Manchester 研究聘任正式名称及导师安排，查 Leverhulme fellowship 原档，继续核 Radboud 学位论文原件。');
relation(novo,'postdoc',geim,'group_leader',nv,[novoInterview,geimLecture,nusCV],aid);

const brun='1720e13b',basile='师承人物 - Basile Audoly',ribe='师承人物 - Neil Ribe',francois='师承人物 - François Gallaire',reis='师承人物 - Pedro Miguel Reis';
const brunCV='https://scienceido.com/ptbrun/wp-content/uploads/2013/11/resume.pdf';
const epfl='https://people.epfl.ch/228982?lang=en';
const pri='https://mae.princeton.edu/sites/g/files/toruqf7696/files/Brun%2C%20announcement.pdf';
const gallaire='https://people.epfl.ch/189938?lang=en';
const aps='https://journals.aps.org/pre/abstract/10.1103/PhysRevE.88.043009';
const reisCV='https://meche.mit.edu/sites/default/files/cv/Pedro_Reis_CV_12Apr2016.pdf';
const bd='本人 CV 的 Université Pierre et Marie Curie 2009–2012 力学博士论文栏明确写在 Basile Audoly 和 Neil Ribe 指导下。EPFL 本人书目与 Princeton 讲座档交叉核对论文主题和学位。';
const bp='本人 CV 将 2012 年起的 EPFL LFMI 博士后独立列出。Gallaire 本人 EPFL 档列 2009 年创办 LFMI，2013 年原刊核两人同署 LFMI，仍保留为个人指导候选。Reis 的 MIT CV 单列 Brun 自 2014 年 9 月 1 日在其指导下为 Postdoctoral Associate，Princeton 另记同阶段 Instructor 任用。';
const gProof='本人 CV 明列 2012 年起 EPFL LFMI 博士后，2013 年 APS 原刊两人同署 LFMI，进一步确认同期实验室与合作。正式个人指导待核。 '+web('本人 CV',brunCV)+' · '+web('APS 原刊',aps);
const rProof='Reis 的 MIT CV 在其指导的 Postdoctoral Associates 中列 Brun 自 2014 年 9 月 1 日起，Princeton 档另列同期 Instructor。 '+web('MIT CV',reisCV)+' · '+web('Princeton 讲座档',pri);
for(const target of [basile,ribe]){
 editLine(fn(local(brun)),l=>l.startsWith('- 博士导师：')&&l.includes('[['+target+'|'),l=>l+' '+bd+' '+web('EPFL 论文书目',epfl));
 mentorLine(target,brun,'- 博士生：',bd+' '+web('EPFL 论文书目',epfl));
 indexLine(brun,target,'博士导师',bd+' '+web('EPFL 论文书目',epfl));
}
note(brun,'- 博士后导师：',rProof);
mentorLine(reis,brun,'- 博士后研究者：',rProof);
indexLine(brun,reis,'博士后导师',rProof);
note(brun,'- 博士后导师候选：',gProof);
mentorLine(francois,brun,'- 博士后候选研究者：',gProof);
indexLine(brun,francois,'博士后导师候选',gProof);
changeRow(brun,'Basile Audoly、Neil Ribe（本人 CV 明列论文指导）','EPFL LFMI 自 2012 年，Gallaire（个人指导候选）；MIT Reis（本人 CV 核自 2014 年 9 月正式指导）',web('Brun 本人 CV',brunCV)+' · '+web('Reis 本人 CV',reisCV)+' · '+web('APS 原刊',aps));
aid=audit(brun,{phd:['confirmed_advisor',bd,[brunCV,epfl,pri]],postdoc:['confirmed_advisor',bp,[brunCV,gallaire,aps,reisCV,pri]]},'查 EPFL LFMI 历史任用档或项目原档，分辨 Gallaire 是否是具名导师。查 HAL 或学校馆藏学位原件以补足两位博士导师的法文职衔。');
for(const target of [basile,ribe])relation(brun,'phd',target,'advisor',bd,[brunCV,epfl,pri],aid);
relation(brun,'postdoc',francois,'candidate',bp,[brunCV,gallaire,aps],aid,false);
relation(brun,'postdoc',reis,'advisor',bp,[reisCV,pri],aid,false);
if(process.argv[2]==='apply')fs.writeFileSync('20261110_1741_同名排除.json',JSON.stringify([{page_id:'9aa1e94a28eaa2c407381ba3',record_id:martin,url:ucf,audit_id:laneAudit,external_subject:'Lane Martin（UCF 2014 年光学博士）',evidence:identity+' UCF 论文原档列指导 Bahaa Saleh，与 Rice 与 Berkeley 的氧化物材料学者训练履历不同。'}],null,2)+'\n');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Brun与跨阶段履历复核';
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

