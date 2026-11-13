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
 a.audit_id='20261110_'+id+'_washington_original_1141';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_washington_original_1141_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const a=["https://mse.washington.edu/facultyfinder/arthur-barnard","https://dunham.ece.uw.edu/pubs/thesis_baruch.pdf","https://mse.washington.edu/facultyfinder/charles-m-marcus","https://chem.washington.edu/news/2022/06/29/douglas-reed-join-faculty","https://mse.washington.edu/facultyfinder/juan-carlos-idrobo","https://www.ece.uw.edu/people/m-p-anant-anantram/","https://sites.google.com/uw.edu/rudner/","https://www.mtl.mit.edu/news/mtl-2018-fall-doctoral-dissertation-seminar-dds-dr-sara-mouradian","https://research-hub.nlr.gov/en/persons/steven-spurgeon/","https://mse.washington.edu/files/news/docs/04-25-18Special-Cao.pdf"],b=["https://ggg.stanford.edu/alumni","https://sites.uw.edu/anantmp/","https://bpb-us-e1.wpmucdn.com/sites.uw.edu/dist/b/1731/files/2024/10/2005-Ballistic_transport_and_electrostatics_in_metallic_carbon_nanotubes.pdf","https://nbia.nbi.ku.dk/annual-reports/nbia-annual-report-2015.pdf","https://orise.orau.gov/icpostdoc/profiles/past-cohort/sara-mouradian.html","https://engineering.jhu.edu/dcg/alumni-highlights/","https://physics.ucdavis.edu/alumni/phd-recipients","https://www.cpsjournals.cn/en/article/doi/10.1088/1674-1056/ad8ece","https://heinz.stanford.edu/people/former-members","https://people.ece.uw.edu/feldman_baruch/"],c=["https://people.ece.uw.edu/anant/","https://www.ece.uw.edu/wp-content/uploads/2016/03/TheIntegrator-Spring2009.pdf","https://journals.aps.org/prb/abstract/10.1103/PhysRevB.48.15132","https://mse.washington.edu/people/faculty/adjunct","https://dunham.ece.uw.edu/groupframe.html","https://cua.mit.edu/people/mark-rudner","https://www.demlergroup.com/people.html","https://iqim.caltech.edu/people/alumni/"],d=["https://mse.washington.edu/facultyfinder/ting-cao","https://people.ece.uw.edu/mouradian_sara/index.html","https://news.harvard.edu/gazette/story/2000/10/the-familiar-becomes-strange-in-charles-marcus-world-you-can-be-in-two-places-at-once/","https://academictree-staging.thetransmitter.org/physics/peopleinfo.php?pid=349249"];
const [ba,fe,mc,dr,id,an,ru,mo,sp,ca]=["e6ad4c6e","1312196e","f0a0179f","846fb3cf","ef9e55e0","a8bb9f1c","fd22425d","f377a735","88d0cb96","e8db1830"];
const u=(label,url)=>web(label,url)+'。';
const append=(id,field,status,proof,src)=>{
 const old=JSON.parse(latest.get(id).details_json).aspects[field];
 return [status||old.status,old.note+' '+proof,src];
};
function review(id,proof,phd,post,changes,next){
 note(id,'- 核查边界：',proof);
 changeRow(id,phd,post,proof);
 return audit(id,changes,next);
}
const baF='UW 材料档核材料科学与工程和物理双聘、2015 Cornell 应用物理博士，以及量子材料和纳米力学；Stanford Goldhaber-Gordon 组明确在前博士后名单列 Arthur Barnard。';
const baa=review(ba,u('UW 材料档',a[0])+u('Stanford 组档',b[0])+baF,null,'Stanford David Goldhaber-Gordon（博士后课题组负责人）',{
 affiliation:['confirmed',baF,[a[0]]],research:['confirmed',baF,[a[0]]],
 phd:append(ba,'phd',null,'UW 材料档核 Cornell 2015 博士；保留已有论文导师原证。',[a[0]]),
 postdoc:append(ba,'postdoc',null,baF,[b[0]])
},'Cornell 主机退避后重读本人博士论文；查 Stanford 博后的个人指导职衔。');
relation(ba,'postdoc',local('b27bbdf1'),'group_leader',baF,[a[0],b[0]],baa,false);
const feD='本人 2008 年 UW 物理学位论文 Simulating Causes of Conductivity Degradation in Nanoscale Metal Wires 签字页列 Scott T. Dunham 为指导委员会主席，致谢明确感谢其对本人博士研究的指导。John Rehr、Anton Andreev 只列审阅委员会成员。';
const feP='UW Dunham 组旧档核博士为 2008-09，离组去 Tyndall National Institute；旧本人履历列 Tyndall、Weizmann 两段博士后，本轮本人档不可访问，保留既有阶段研究师长。';
const fea=review(fe,u('本人博士论文签字页与致谢',a[1])+u('UW Dunham 组旧档',c[4])+feD+feP,null,'Tyndall Jim Greer、Weizmann Leeor Kronik（博士后阶段研究师长）',{
 phd:['confirmed_advisor',feD,[a[1],c[4]]],postdoc:append(fe,'postdoc',null,feP,[c[4]]),
 research:append(fe,'research',null,'本人论文核纳米金属线导电及输运建模。',[a[1]])
},'查 Tyndall 和 Weizmann 两段博后的任命起止、个人指导职衔，以及 UW affiliate 现状。');
enrich(fe,'phd',local('671cdc09'),'博士生',u('本人博士论文签字页与致谢',a[1])+feD);
relation(fe,'phd',local('671cdc09'),'advisor',feD,[a[1],c[4]],fea,false);
const mcD='Harvard Gazette 原文明确 Robert Westervelt 在 Marcus 的 Harvard 博士与博士后两阶段均指导；UW 履历核 1990 Harvard 物理博士，1990–1992 Harvard IBM 博后。';
const mcF='UW 材料档列物理教授、材料荣休及 PNNL affiliate 条目，UW 材料荣休名单独立核材料荣休。研究量子相干电子学、拓扑凝聚态及量子比特。';
const mca=review(mc,u('Harvard Gazette',d[2])+u('UW 材料履历',a[2])+u('UW 材料荣休名单',c[3])+mcD+mcF,'Robert Westervelt（1990 Harvard 博士）','Robert Westervelt（1990–1992 Harvard IBM 博后）',{
 phd:['confirmed_advisor',mcD,[d[2],a[2]]],postdoc:['confirmed_advisor',mcD,[d[2],a[2]]],
 affiliation:['confirmed',mcF,[a[2],c[3]]],research:['confirmed',mcF,[a[2],c[3]]]
},'两阶段导师已核；若有新增资料，核最新 PNNL affiliate 与 Copenhagen 任职时间。');
for(const [stage,reverse] of [['phd','博士生'],['postdoc','博士后研究者']]){
 enrich(mc,stage,local('1f1887f8'),reverse,u('Harvard Gazette',d[2])+u('UW 材料履历',a[2])+mcD);
 relation(mc,stage,local('1f1887f8'),'advisor',mcD,[d[2],a[2]],mca,false);
}
const drF='UW 化学系录用公告明确 2018 Berkeley 化学博士 under the direction of Jeff Long，Columbia Nano Initiative 博后与 Colin Nuckolls、Xavier Roy 工作，随后在 UW 化学先任 Research Scientist、2022-07 开始教职。研究多孔金属有机框架、分子电子与半导体团簇。';
const dra=review(dr,u('UW 化学系录用原档',a[3])+drF,null,'Columbia Nano Initiative 博后，Colin P. Nuckolls、Xavier Roy（博士后阶段研究师长）',{
 phd:['confirmed_advisor',drF,[a[3]]],postdoc:['group_or_candidate',drF,[a[3]]],
 affiliation:['confirmed',drF,[a[3]]],research:['confirmed',drF,[a[3]]]
},'核 Columbia 两位博后指导的正式职衔及 Berkeley 博士论文。');
relation(dr,'phd',local('dcbb0150'),'advisor',drF,[a[3]],dra,false);
const idF='UW 材料系个人档列系主任及副教授，研究 STEM 与电子能量损失谱以及结构、拓扑和磁性材料。UC Davis 按导师列出的原始博士名录在 Warren Pickett 项下列 2004 博士题目，毕业后的首个职位列 UIC Research Assistant Professor。该职位与后续 ORNL 博后线索分别记载。';
const ida=review(id,u('UW 材料院档',a[4])+u('UC Davis 物理博士名录',b[6])+idF,null,null,{
 affiliation:['confirmed',idF,[a[4],b[6]]],research:['confirmed',idF,[a[4],b[6]]],
 phd:['confirmed_advisor',idF,[a[4],b[6]]],postdoc:append(id,'postdoc',null,idF,[b[6]])
},'查 UIC 和 ORNL 任命起止、在 Pennycook 合作组中博士后阶段的正式指导。');
relation(id,'phd',local('f6ef9106'),'advisor',idF,[a[4],b[6]],ida,false);
const anD='本人 2005 IEEE 作者履历核 1995 Purdue 电气工程博士；UW ECE 本人院档亦核 Purdue 博士。1993 APS 原论文列 Anantram 与 Supriyo Datta 同在 Purdue 电气工程合作；配合已定位的学术树线索，保留 Datta 为低可信博士导师候选。正式导师须以本人学位档或导师原档核实。';
const anP='本人 2005 IEEE 作者履历明确 1997 NASA Ames 入职以前做 Purdue／UCLA 博士后 fellowship。两地各自任期及个人指导待核。NASA 是后续任职，UW 2009 院刊另核 Waterloo 教职后加入 UW ECE。';
const anF='UW ECE 本人档核电气与计算机工程教授，研究量子输运、纳米材料及器件理论，早期院刊核 2009 年冬入职。';
const ana=review(an,u('UW ECE 本人档',c[0])+u('UW 2009 院刊',c[1])+u('本人 2005 IEEE 作者履历',b[2])+u('APS 1993 原论文',c[2])+anD+anP+anF,'1995 Purdue 博士；Supriyo Datta（低可信候选）','Purdue／UCLA 博后 fellowship，个人导师待核',{
 phd:['group_or_candidate',anD,[b[2],c[0],c[2]]],postdoc:['unresolved',anP,[b[2],c[1]]],
 affiliation:['confirmed',anF,[c[0],c[1]]],research:['confirmed',anF,[c[0],b[2]]]
},'定位 Purdue 1995 学位论文及导师登记，分别核 Purdue 与 UCLA 博后聘任；Purdue 工程域名退避结束后查原档。');
const datta=local('5d54f243'),anProof=u('APS 1993 原论文',c[2])+u('本人 2005 IEEE 作者履历',b[2])+anD;
addEdge(an,'博士导师候选',datta,'Supriyo Datta',anProof,null,true);
inverse(an,datta,'博士候选研究者',anProof);
relation(an,'phd',datta,'candidate',anD,[c[2],b[2],c[0]],ana);
const ruF='本人 UW 组档核物理系及量子动力学、拓扑凝聚态方向。MIT–Harvard CUA 旧档明确 Harvard 凝聚态理论组博士后，Demler 组原页链接该本人主页；Caltech IQIM 明确另段 IQIM 博后，离组年份 2012、Research Group 栏 Refael。两个课题组分别标记。';
const rua=review(ru,u('本人 UW 组档',a[6])+u('MIT–Harvard CUA 旧档',c[5])+u('Demler 组旧档',c[6])+u('Caltech IQIM 校友档',c[7])+ruF,null,'Harvard Eugene Demler、Caltech Gil Refael（各自博士后课题组负责人）',{
 affiliation:['confirmed',ruF,[a[6]]],research:['confirmed',ruF,[a[6]]],
 postdoc:['group_or_candidate',ruF,[c[5],c[6],c[7]]]
},'查 Harvard 和 Caltech 博后起止与个人指导的原始任用，保留 MIT 学位档中的 Levitov 导师。');
for(const mentor of ['d37c6cf8','5407d29a'])relation(ru,'postdoc',local(mentor),'group_leader',ruF,[a[6],c[5],c[6],c[7]],rua,false);
const moD='MIT 2018 博士论文报告原档明确在 Dirk Englund 指导下完成博士，研究金刚石色心和量子集成光子学。';
const moP='ORISE 博后项目管理方明确 Berkeley 物理离子阱组 fellowship，称 Hartmut Häffner 为 mentor 并指出其指导离子阱传感研究。';
const moa=review(mo,u('MIT MTL 博士报告',a[7])+u('ORISE 博后项目档',b[4])+u('UW ECE 本人档',d[1])+moD+moP,null,'Berkeley 离子阱组，Hartmut Häffner（博士后阶段研究师长）',{
 phd:['confirmed_advisor',moD,[a[7]]],postdoc:['group_or_candidate',moP,[b[4]]],
 affiliation:['confirmed','UW ECE 本人档核电气与计算机工程系助理教授。',[d[1]]],
 research:['confirmed','UW ECE 原档及 MIT MTL 博士报告核离子阱量子工程和量子光子。',[d[1],a[7],b[4]]]
},'查 MIT 学位论文原件及伯克利聘任记录，核阶段 mentor 的正式称谓。');
relation(mo,'phd',local('546bc028'),'advisor',moD,[a[7]],moa,false);
relation(mo,'postdoc','师承人物 - Hartmut Häffner','stage_mentor',moP,[b[4]],moa,false);
const spF='NLR 本人履历明确 2015–2017 PNNL 博士后、2017–2022 PNNL 材料科研、2021–2024 UW 物理 affiliate，2025 起另任 Colorado School of Mines 联合教员。Taheri 课题组将 Spurgeon 列为 2014 Drexel 毕业的前博士生并注明 STEM 及磁电耦合论文。NLR 方向核材料数据科学与电子显微。';
const spa=review(sp,u('NLR 本人履历',a[8])+u('Taheri 组博士生原档',b[5])+spF,null,'PNNL 2015–2017，Scott Chambers（博士后阶段研究师长）',{
 affiliation:['confirmed',spF,[a[8]]],research:['confirmed',spF,[a[8],b[5]]],
 phd:append(sp,'phd','confirmed_advisor',spF,[a[8],b[5]]),postdoc:append(sp,'postdoc',null,spF,[a[8]])
},'查 Drexel 学位论文、PNNL 博后聘任与 UW 兼职是否续任。保留最新 NLR 履历的时间边界。');
relation(sp,'phd',local('8937b929'),'advisor','Drexel 院系既有 advisor 原证；Taheri 本人组原档独立核 Spurgeon 为前博士生，2014 Drexel 毕业。',[b[5],'https://drexel.edu/engineering/news-events/news/archive/2012/April/phd-student-kristy-jost-receives-dod-national-defense-science-and-engineering-graduate-fellowship/'],spa,false);
const caF='UW 当前材料档核材料副教授与研究计算基础设施 Associate Vice Provost，研究低维材料、激发态与光物质作用，2018 Berkeley 物理博士及 Stanford GLAM 博后。Heinz 组明确列博士后。2018 答辩前报告档以 doctoral candidate 标识 Cao，称论文研究受 Steven G. Louie 指导；保留阶段师长至学位论文原证可读。';
const caa=review(ca,u('UW 材料当前档',d[0])+u('UW 2018 报告档',a[9])+u('Stanford Heinz 组旧档',b[8])+caF,null,'Stanford GLAM，Tony F. Heinz（博士后课题组负责人）',{
 affiliation:['confirmed',caF,[d[0]]],research:['confirmed',caF,[d[0],a[9]]],
 phd:['group_or_candidate',caF,[a[9],d[0]]],postdoc:['group_or_candidate',caF,[b[8],d[0]]]
},'待 eScholarship 主机退避结束再查本人 Berkeley 学位论文原档，另核 Stanford GLAM 具体指导职称。');
relation(ca,'phd',local('3253eda8'),'stage_mentor',caF,[a[9],d[0]],caa,false);
relation(ca,'postdoc',local('d6fdab44'),'group_leader',caF,[b[8],d[0]],caa,false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Washington论文与阶段原证';
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
