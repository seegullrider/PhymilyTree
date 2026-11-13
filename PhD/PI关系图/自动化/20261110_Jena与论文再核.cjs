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
 a.audit_id='20261110_'+id+'_original_1339';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_original_1339_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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






function inverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}



const sc='95b54b8b', k='04f6da22', av='dff565f5', dl='047f6d7f', ka='bb5b0777', dy='dcc17369', br='98d786e1', y='ce45d684', pa='e0fc6317';
const u={
 schTh:'https://www.db-thueringen.de/servlets/MCRFileNodeServlet/dbt_derivate_00022346/Schleife/dissertation_andre_schleife.pdf',
 schCV:'https://schleife.matse.illinois.edu/wp-content/uploads/2020/12/cv_only.pdf',
 schSchool:'https://grainger.illinois.edu/about/directory/faculty/schleife',
 schLLNL:'https://www.llnl.gov/article/38451/pls-names-outstanding-postdocs',
 min:'https://cse.umn.edu/cems/satish-kumar',
 mass:'https://www.massey.ac.nz/massey/expertise/phd-student-profiles/doctoral-my-story.cfm?studid=H%2Bkva1rdwNQ%3D',
 hom:'https://www.me.washington.edu/files/research/faculty/homsy/homsy-cv.pdf',
 aps:'https://engage.aps.org/dfd/resources/newsletters/newsletter-archive/fall-2024',
 avSchool:'https://cde.nus.edu.sg/mse/staff/ahmet-avsar/',
 avTalk:'https://www.physics.nus.edu.sg/seminar-2023-mar-ahmet-avsar/',
 avSource:'https://publications.rwth-aachen.de/record/52855/files/3744.pdf',
 avKis:'https://actu.epfl.ch/news/a-new-2d-magnet-draws-future-devices-closer/',
 dlCV:'https://chemistry.illinois.edu/sites/default/files/cv/dlott_CV_0.pdf',
 dlSchool:'https://chemistry.illinois.edu/dlott',
 kaTh:'https://citeseerx.ist.psu.edu/document?doi=fc04a859fd9a1d65c39fbd2f1057dafe78474e0b&repid=rep1&type=pdf',
 kaSchool:'https://science.psu.edu/physics/people/rpk5594',
 kaGroup:'https://sachdev.physics.harvard.edu/people-all',
 dynTh:'https://macsphere.mcmaster.ca/handle/11375/17619',
 dynAps:'https://meetings-archive.aps.org/mar/2005/p7/1/',
 brPub:'https://www.math.ucdavis.edu/~bxn/pubn.pdf',
 brLeu:'https://fys.kuleuven.be/english/staff/christ/files/pdf/maphy5okt.pdf',
 yCV:'https://bpb-us-w2.wpmucdn.com/web.sas.upenn.edu/dist/b/502/files/2025/06/YODH-CV.06.09.25.pdf',
 paTh:'https://webapps.unitn.it/du/en/Persona/PER0003263/Tesi'
};
function specific(id,label,target,reverse,proof,indexLabel=label){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+proof);
 mentorLine(target,id,'- '+reverse+'：',proof);
 indexLine(id,target,indexLabel,proof);
}
const sPhD='本人 2010 年 Jena 博士论文末尾的作者声明明确将 Friedhelm Bechstedt 标为 betreuender Hochschullehrer。致谢与本人 CV 的 Ph.D. mentor 条目独立一致。';
const sProof=web('Jena 博士论文原文',u.schTh)+' '+sPhD;
const sA=audit(sc,{
 affiliation:['confirmed','Illinois Grainger 原档列 2025-09 起材料科学与工程教授、NCSA 与 MRL affiliated professor。',[u.schSchool]],
 research:['confirmed','凝聚态理论、计算材料科学和电子激发，当前院系和既有组档相符。',[u.schSchool,u.schCV]],
 phd:['confirmed_advisor',sPhD,[u.schTh,u.schCV]]
},'LLNL 两位导师已具名；继续找 Jena 2010-10 至 2011-01 独立博后阶段个人指导者。');
const bech='师承人物 - Friedhelm Bechstedt';
replaceNoteLabel(sc,'博士阶段研究师长','博士导师',bech,' '+sProof);
replaceInverseLabel(bech,sc,'博士阶段研究者','博士生',' '+sProof);
replaceIndexLabel(sc,bech,'博士阶段研究师长','博士导师',' '+sProof);
editLine(fn(local(sc)),l=>l.startsWith('- 核查边界：'),l=>l.replace('及 Bechstedt 的论文正式角色',''));
changeRow(sc,'Friedhelm Bechstedt（Jena 博士论文具名指导教师）',null,web('Jena 博士论文',u.schTh));
relation(sc,'phd',bech,'advisor',sPhD,[u.schTh,u.schCV],sA,false);

const hom='师承人物 - George M. Homsy';
const disamb='Minnesota 化工本人校页列 Stanford 1998 化工博士。Massey 同名者是 2001 年研究辐射松遗传性状的博士，监督人为 Dorian Garrick；学位、机构与方向均不同。';
const kPhD='Homsy 本人 CV 列与 Satish Kumar 在 Stanford 博士期间的 1996 流变研究合著。Kumar 与 Meiburg 署名 APS 纪念文介绍 Homsy 在 Stanford 的研究及指导，未具名 Kumar 自身为学生。仅据同期研究及身份资料保留低可信博士导师候选。';
const kA=audit(k,{
 identity:['confirmed',disamb,[u.min,u.mass]],
 affiliation:['confirmed','Minnesota 化学工程与材料科学教授。',[u.min]],
 research:['confirmed','复杂流体、胶体界面、流变和薄膜输运。',[u.min]],
 phd:['group_or_candidate',kPhD,[u.min,u.hom,u.aps]]
},'追查 Stanford 学位论文登记、正式指导栏和博士后任用档。');
const kProof=kPhD+' '+web('Minnesota 院系原档',u.min)+' '+web('Homsy 本人 CV',u.hom)+' '+web('Kumar 与 Meiburg 署名纪念文',u.aps);
note(k,'- 核查边界：',disamb+' '+web('Massey 同名者学位档',u.mass));
addEdge(k,'博士导师候选',hom,'George M. Homsy',kProof,null,true);
newMentor(hom,'George M. Homsy','流体力学与界面输运学者，曾任 Stanford 教员。'+web('本人 CV',u.hom),k,'博士导师候选反向链接',kProof);
changeRow(k,'George M. Homsy（同期研究支持的低可信博士导师候选）',null,web('Homsy 本人 CV',u.hom));
relation(k,'phd',hom,'candidate',kPhD,[u.min,u.hom,u.aps],kA);

const avP='RWTH 学位论文作者在致谢中将 Ahmet Avsar 具名列为 Özyilmaz 组成员，提供早期组属旁证；NUS 物理博士已核。NUS 2018 活动原址缓存失败，Özyilmaz 正式论文导师继续留候选。';
const avA=audit(av,{
 affiliation:['confirmed','NUS MSE 教员档列助理教授及 NRF Fellow，2022 年 9 月起任职，并列 Assistant Head for Research Events and Visibility。NUS 物理系是博士学位单位，现行兼任待单独核。',[u.avSchool,u.avTalk]],
 research:['confirmed','二维量子材料异质结构、自旋输运、磁性与量子器件。',[u.avSchool,u.avTalk]],
 phd:['group_or_candidate',avP,[u.avSource,u.avSchool]]
},'继续核对本人 NUS 学位论文以及早期 Research Fellow 起讫；EPFL Kis 的正式导师称谓待原档。');
const avProof=web('RWTH 学位论文致谢',u.avSource)+' '+avP;
specific(av,'博士导师候选',local('0e0562af'),'博士生候选',avProof);
note(av,'- 核查边界：','MSE 是官方现职，NUS 物理系为博士学位单位，当前物理兼任待核。 '+web('NUS MSE 教师原档',u.avSchool));
changeRow(av,'Barbaros Özyilmaz（候选；同组论文致谢补证，正式导师待核）',null,web('RWTH 同期论文致谢',u.avSource));
relation(av,'phd',local('0e0562af'),'candidate',avP,[u.avSource,u.avSchool],avA,false);

const kaEv='Harvard 同期博士生论文致谢明确将 Ribhu Kaul 称为 Subir 的博后；Sachdev 组原档及 Penn State 履历分别印证 2006–2008 Harvard 阶段组属。Station Q 阶段和正式导师待核。';
const kaProof=web('Harvard 同期博士论文原文',u.kaTh)+' '+kaEv;
const kaA=audit(ka,{postdoc:['group_or_candidate',kaEv,[u.kaTh,u.kaGroup,u.kaSchool]]},'继续查 Duke 学位论文和 UCSB Station Q 任用及个人指导者。');
specific(ka,'博士后阶段课题组负责人',local('a4367696'),'博士后课题组成员',kaProof,'博士后课题组负责人');
changeRow(ka,null,null,web('Harvard 同期博士论文',u.kaTh));
relation(ka,'postdoc',local('a4367696'),'group_leader',kaEv,[u.kaTh,u.kaGroup,u.kaSchool],kaA,false);

const dlEv='本人 CV 列 1979 年获 Stanford 化学博士、1979 年起任 Illinois 助理教授；院系原档列同年入职。未见独立博士后。';
audit(dl,{
 affiliation:['confirmed','Illinois 化学系 Lycan Professor Emeritus，且列 Chemistry、Materials Research Laboratory Research Professor。',[u.dlSchool]],
 research:['confirmed','凝聚态分子动力学、超快光谱、物理与材料化学。',[u.dlSchool]],
 postdoc:['no_postdoc_documented',dlEv,[u.dlCV,u.dlSchool]]
},'保留本人 CV 的 Michael Fayer 明确博士导师与原始履历，若有早期独立博士后任用原证再补。');
note(dl,'- 核查边界：',dlEv+' '+web('Illinois 化学系原档',u.dlSchool));
changeRow(dl,null,'CV 列 1979 年博士及同年入职；未发现独立博后',web('Illinois 化学系原档',u.dlSchool));

const dyP='McMaster 官方学位档列作者 Robert Carr Dynes、1968 年 5 月及本人论文 A Tunneling Investigation of the Mechanisms Determining Superconductivity in Simple Metals and Alloys。导师字段未显示；原 PDF 重定向无法读取，Colin K. Campbell 仍列候选。';
const dyQ='Dynes 在 APS 讲演摘要第一人称确认 McMaster 硕博及 Bell Labs 任职 22 年、五个职位，未列最初任用的博士后性质或导师。';
audit(dy,{phd:['group_or_candidate',dyP,[u.dynTh]],postdoc:['unresolved',dyQ,[u.dynAps]]},'保留论文馆藏号及原 PDF 访问失败；尝试查公开的学位索引或同期机构记录。');
note(dy,'- 核查边界：',dyP+' '+dyQ+' '+web('McMaster 学位目录',u.dynTh)+' '+web('本人 APS 报告',u.dynAps));
changeRow(dy,'Colin K. Campbell（候选；McMaster 正式导师字段待查）','本人核 Bell Labs 22 年，初任岗位性质和导师待核',web('McMaster 学位目录',u.dynTh)+' '+web('本人 APS 报告',u.dynAps));

const brEv='本人 UC Davis 发表目录明确列 1987 KU Leuven 博士论文 Exakte Resultaten voor het Spin-Bosonmodel。Leuven 学科史印证其为该校理论物理所培养的学生。Verbeure 是本人记载的读研准备期指导人，正式博士导师仍为候选。';
audit(br,{phd:['group_or_candidate',brEv,[u.brPub,u.brLeu]]},'按荷兰语论文题名追 KU Leuven 学位登记与 promotor 栏；Chile 与 Princeton 的阶段性质继续查。');
note(br,'- 核查边界：',brEv+' '+web('本人 UC Davis 发表目录',u.brPub)+' '+web('KU Leuven 学科史',u.brLeu));
changeRow(br,null,null,web('本人论文题名',u.brPub));

const yPhD='本人 2025 CV 列 1982–1986 Harvard Research Assistant with Thomas W. Mossberg，并列 1986 Harvard 博士，保持阶段研究师长。';
const yPost='本人 2025 CV 分列 Bell Labs 1986–1987 with Steven Chu 和 1987–1988 with Harry W. K. Tom，保留两段阶段研究师长。';
audit(y,{
 affiliation:['confirmed','本人 2025 CV 列 Penn Physics and Astronomy 教授、Radiation Oncology 关联教授及 2025–2028 Raman Research Institute Distinguished Visiting Professor。',[u.yCV]],
 phd:['group_or_candidate',yPhD,[u.yCV]],
 postdoc:['group_or_candidate',yPost,[u.yCV]]
},'继续查 Harvard 正式学位论文指导栏，以及 Bell Labs 博后任用记录。');
note(y,'- 核查边界：',yPhD+' '+yPost+' '+web('本人 2025 CV',u.yCV));
changeRow(y,null,null,web('本人 2025 CV',u.yCV));

const paEv='University of Trento 的 Pavesi 原档有分 Supervisor、Co-supervisor 和 Examiner 的论文入口，但本次仅返回动态页面框架，未列 Dal Negro。保留旧有导师记录和已经核实的实验室博士组属。';
audit(pa,{phd:['group_or_candidate',paEv,[u.paTh,'https://nanolab.physics.unitn.it/people.html']]},'尝试找到含具名导师字段的公开学位登记；意大利论文库先前 cache miss，不重复提交同一原网址。');
note(pa,'- 核查边界：',paEv+' '+web('Trento Pavesi 论文入口',u.paTh));
changeRow(pa,null,null,web('Trento Pavesi 论文入口（未取得记录）',u.paTh));

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Jena与论文再核';
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
