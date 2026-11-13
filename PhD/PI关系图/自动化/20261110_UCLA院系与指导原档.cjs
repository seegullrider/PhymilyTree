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
 a.audit_id='20261110_'+id+'_ucla_original_1206';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_ucla_original_1206_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const p={"bal":"https://samueli.ucla.edu/people/alexander-balandin/","balCV":"https://bpb-us-w2.wpmucdn.com/research.seas.ucla.edu/dist/f/65/files/2025/08/Balandin-CV-2025.pdf","gut":"https://physicalsciences.ucla.edu/person/christopher-gutierrez/","gutCV":"https://gutierrezartsci.files.wordpress.com/2018/08/cgutierrez_cv1.pdf","gru":"https://www.pa.ucla.edu/faculty-websites/gruner.html","gruMTA":"https://mta.hu/data/dokumentumok/magyar_tudomanyossag_kulfoldon/MTA_MTK_Eb_hirlevel_2020_12_15.pdf","hol":"https://www.pa.ucla.edu/faculty-websites/holczer.html","holMTA":"https://real.mtak.hu/188603/1/Holczer_Karoly_MTA_MTKEB_hirlevel_2023_10_15.pdf","kan":"https://samueli.ucla.edu/people/richard-kaner/","kanGroup":"https://kaner.chem.ucla.edu/current-group-members/","mas":"https://www.chemistry.ucla.edu/directory/mason-thomas-g/","masLab":"https://www.chem.ucla.edu/dept/Faculty/mason/Research/microrheology/microrheology.html","masAR":"https://www.pa.ucla.edu/annual-reports/annualreport_0304.pdf","masAIP":"https://history.aip.org/catalog/icos/47230.html","cam":"https://campbellgroup.physics.ucla.edu/papers/Wesley_Campbell_standard_CV.pdf","camJQI":"https://jqi.umd.edu/news/jqi-alumnus-wes-campbell-elected-aps-damop-leadership","camAR":"https://www.pa.ucla.edu/annual-reports/annualreport-2011-2012.pdf","rub":"https://www.chemistry.ucla.edu/directory/rubin-yves-f/","rubCV":"https://rubingroup.org/home/yves-rubin/bibliography-cv/","yang":"https://samueli.ucla.edu/people/yang-yang/","yangCV":"https://yylab.seas.ucla.edu/YY%202%20page-CV.pdf"};
const b='f7e92dea',g='f4046c22',gr='f45bcfeb',h='f8059d5e',k='eaa1364f',m='31d41b1c',c='e40400b9',r='ed5f2d22',y='71c8ac33';
const u=(label,url)=>web(label,url)+'。';
const old=(id,key,proof,sources)=>[JSON.parse(latest.get(id).details_json).aspects[key].status,proof,sources];
const C='confirmed', A='confirmed_advisor', G='group_or_candidate', U='unresolved';
function save(id,proof,phd,post,checks,next){
 note(id,'- 核查边界：',proof);
 changeRow(id,phd,post,proof);
 return audit(id,checks,next);
}
function stage(id,target,label,reverse,proof){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+proof);
 mentorLine(target,id,'- '+reverse+'：',proof);
 indexLine(id,target,label,proof);
}

const bp='2025 本人 CV 在训练栏列 1997–1999 UCLA Postdoctoral Research，任职栏另称同期 UCLA EE Research Engineer；UCLA 工学院核当前材料科学与工程、量子材料与热输运。CV 和工学院列 Notre Dame 电气工程博士 1996，典礼册的 1997 年记法继续保留。';
save(b,u('UCLA 工学院',p.bal)+u('2025 本人 CV',p.balCV)+bp,null,null,{
 phd:old(b,'phd','本人 CV 核 Notre Dame 电气工程博士；保留典礼册所列 Supriyo Bandyopadhyay 与年份差异。',[p.balCV,p.bal]),
 postdoc:[G,bp+' Kang L. Wang 保留低可信候选。',[p.balCV]],
 affiliation:[C,'UCLA 材料科学与工程。',[p.bal,p.balCV]],research:[C,'低维量子材料、声子输运与光电。',[p.bal,p.balCV]]
},'查 Notre Dame 授位登记、UCLA 工程聘任原档与可读课题组历史。');

const gp='本人 CV 分列 2010–2015 Columbia 博士 Abhay N. Pasupathy、2015–2017 NIST 博后 Joseph A. Stroscio、UBC Prize Postdoctoral Fellow 的 Andrea Damascelli，分别有明确 advisor 字段。UCLA 物理学院补证两个博后机构和 2020 入职。';
const ga=save(g,u('本人 CV',p.gutCV)+u('UCLA 物理学院',p.gut)+gp,null,null,{
 phd:[A,gp,[p.gutCV,p.gut]],postdoc:[A,gp,[p.gutCV,p.gut]],affiliation:[C,'UCLA 物理与天文学系。',[p.gut]],
 research:[C,'量子材料、原子尺度显微和新电子态。',[p.gut,p.gutCV]]
},'两段博后及博士指导已从本人 CV 核实，随任职和研究更新复查。');
audits.at(-1).followup_required=false;
for(const [s,t,ev] of [['phd',local('bd81ed25'),'Columbia 博士阶段 Doctoral advisor 字段。'],['postdoc','师承人物 - Joseph A. Stroscio','NIST 博后 Post-doctoral advisor 字段。'],['postdoc','师承人物 - Andrea Damascelli','UBC 博后 Post-doctoral advisor 字段。']]){
 relation(g,s,t,'advisor',ev,[p.gutCV,p.gut],ga,false);
}

const grp='UCLA 系档将 1972–1973 Imperial College 职位写作 Visiting Scientist；MTA 传记称 Postdoctoral Associate，并另列 1973 年 kandidátus。UCLA 的 Ph.D. 1977 与 MTA 的学位写法分别保留。MTA 记 Grüner 毕业后加入 Zawadowski 的 KFKI 组，博士指导仍为候选。';
editLine(fn(local(gr)),l=>l.startsWith('- 核查边界：'),l=>l.replace('UCLA 履历称 1972–1973 Imperial College 博士后，具体指导者未核实。','MTA 传记称 1972–1973 Imperial College 博士后，UCLA 系档称访问科研人员；个人指导待核。'));
save(gr,u('UCLA 物理系履历',p.gru)+u('匈牙利科学院人物档',p.gruMTA)+grp,null,'1972–1973 Imperial College（MTA 称博士后，UCLA 称访问科研人员），个人指导待核',{
 phd:[G,grp,[p.gru,p.gruMTA]],postdoc:[U,grp,[p.gru,p.gruMTA]],
 affiliation:[C,'UCLA 物理与天文原人物档。',[p.gru]],
 research:[C,'固态集体电子态、光谱、纳米材料。',[p.gru,p.gruMTA]]
},'查匈牙利学位级别及注册记录、Imperial 当期任命和个人指导。');

const hp='UCLA 物理原档列 Central Research Institute for Physics 博士及 Budapest 1977、1974 经历。MTA 人物档明确 1977 university doctoral degree，并述在 Zawadowski 的 KFKI 学派工作，1989 赴 UCLA 后先任助理教授；法国访问及 1992–1993 CNRS 研究职称待核。';
save(h,u('UCLA 物理系',p.hol)+u('MTA 人物档',p.holMTA)+hp,null,null,{
 phd:[G,hp,[p.hol,p.holMTA]],postdoc:[U,'MTA 履历列法国访问与 CNRS 研究经历，独立博士后任用及个人指导未明。',[p.holMTA]],
 affiliation:[C,'UCLA 物理与天文学。',[p.hol]],research:[C,'有机导体、超导和电子顺磁共振。',[p.hol,p.holMTA]]
},'查 1977 年学位登记及法国访问岗位文件，核具体阶段与导师职衔。');

const kp='UCLA 工学院正式履历核 1984 Penn 无机化学博士、Berkeley 博后及化学与材料双聘。招生页与该课题组同一人，师承沿用主记录，主记录 Bartlett 博后导师与博士阶段师长各自保留。';
save(k,u('UCLA 工学院',p.kan)+u('Kaner 课题组',p.kanGroup)+kp,null,null,{
 phd:old(k,'phd',kp,[p.kan]),postdoc:old(k,'postdoc',kp,[p.kan]),
 affiliation:[C,'UCLA 化学与生物化学、材料科学与工程双聘。',[p.kan,p.kanGroup]],research:[C,'固态化学、导电聚合物和材料合成。',[p.kan,p.kanGroup]]
},'同一人由 Kaner 主记录继续查 Penn 学位资料与博士个人导师，不另增关系。');

const mt=local('6d11ec29');
const mp='Mason 本人 UCLA 实验室的微流变原页明确把 1993 年研究生时期合作的 D. A. Weitz 称为 his advisor，UCLA 物理系年报独立明确该指导对应 1995 年 Princeton 博士论文研究。';
const md='AIP 口述史馆藏与 UCLA 原档支持法国和 Johns Hopkins 两段博后，Bibette、Kuo 保留研究合作角色。ExxonMobil 的 Staff Scientist 自 1997 年另列。';
const me=u('Mason 课题组原页',p.masLab)+u('UCLA 物理系年报',p.masAR)+mp;
const oldLabel='博士阶段研究师长';
editLine(fn(local(m)),l=>l.startsWith('- '+oldLabel+'：')&&l.includes('[['+mt+'|'),l=>l.replace('- '+oldLabel+'：','- 博士导师：').replace('原文未明确正式 thesis advisor 称谓。','')+' '+me+' 论文签署页待查。');
editLine(fn(mt),l=>l.startsWith('- 博士阶段受指导研究者：')&&l.includes('[['+local(m)+'|'),l=>l.replace('- 博士阶段受指导研究者：','- 博士生：').replace('正式学位导师称谓待核。','')+' '+me);
editLine(idx,l=>l.startsWith('- [['+local(m)+'|')&&l.includes(' → '+oldLabel+'：')&&l.includes('[['+mt+'|'),l=>l.replace(' → '+oldLabel+'：',' → 博士导师：').replace('原文未明确正式 thesis advisor 称谓。','')+' '+me);
editLine(fn(local(m)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+me+u('AIP 口述史馆藏',p.masAIP)+md);
changeRow(m,'David A. Weitz（本人组档明确博士阶段 advisor）',null,u('UCLA 化学系',p.mas)+me+u('AIP 口述史馆藏',p.masAIP));
const ma=audit(m,{
 phd:[A,mp,[p.masLab,p.masAR]],postdoc:[G,md,[p.masAIP,p.mas]],
 affiliation:[C,'UCLA 化学与生物化学及物理双聘原系档。',[p.mas]],research:[C,'软凝聚态、微流变及胶体乳化。',[p.mas,p.masLab]]
},'继续找 Princeton 博士论文签署页及法国、Johns Hopkins 博后指导原件。');
relation(m,'phd',mt,'advisor',mp,[p.masLab,p.masAR],ma,false);

const cp='Campbell 本人 CV 第 1 页明确 2008 Harvard 博士 Thesis Advisor John M. Doyle，分列 JQI 博后 2008–2011 与 Assistant Research Scientist 2011–2012。UCLA 2011–2012 年报另明确在 Harvard ACME 项目有短期博后，个人待核。JQI 原档支持 Christopher Monroe 阶段指导。';
const ca=save(c,u('本人 CV',p.cam)+u('UCLA 年报',p.camAR)+u('JQI 原档',p.camJQI)+cp,null,'Harvard ACME 短期博后；JQI Christopher Monroe（博士后阶段研究师长，博后 2008–2011）',{
 phd:[A,cp,[p.cam]],postdoc:[G,cp,[p.cam,p.camJQI,p.camAR]],
 affiliation:[C,'UCLA 物理与天文学。',[p.cam,p.camAR]],research:[C,'AMO、超冷分子、俘获离子与量子信息。',[p.cam,p.camJQI]]
},'查 Harvard ACME 当期个人指导，及 Monroe 正式博后指导称谓。');
relation(c,'phd','师承人物 - John M. Doyle','advisor',cp,[p.cam],ca,false);
relation(c,'postdoc',local('c806f638'),'stage_mentor',cp,[p.cam,p.camJQI,p.camAR],ca,false);

const rp='本人组 CV 分别在 1987–1991 UCLA PhD、1991–1992 Columbia Postdoctoral Research 下明列 Research Advisor François Diederich 与 Ronald Breslow。院系原档同时确认 Diederich 的博士指导及 Breslow 实验室。';
const ra=save(r,u('本人组 CV',p.rubCV)+u('UCLA 化学系',p.rub)+rp,null,null,{
 phd:[A,rp,[p.rubCV,p.rub]],postdoc:[A,rp,[p.rubCV,p.rub]],
 affiliation:[C,'UCLA 化学与生物化学。',[p.rub]],research:[C,'碳纳米结构与有机材料。',[p.rub]]
},'已有分阶段 Research Advisor 的本人原证，继续找 UCLA 论文签署页。');
for(const [s,t,lab,rev] of [['phd','师承人物 - François Diederich','博士研究导师','博士研究生'],['postdoc','师承人物 - Ronald Breslow','博士后研究导师','博士后研究人员']]){
 stage(r,t,lab,rev,u('UCLA 化学系',p.rub)+rp);
 relation(r,s,t,'advisor',rp,[p.rubCV,p.rub],ra,false);
}

const yp='UCLA Samueli 核现材料科学与工程和 UMass Lowell 1992 博士；本人短 CV 分列 1991–1992 UCR 化学博后及其后工业岗位。博士年份与博后起点交叠保留，原博士个人导师和 UCR 组关系不变。';
editLine(fn(local(y)),l=>l.startsWith('- 年份差异：'),l=>l+' '+u('本人短 CV',p.yangCV)+yp);
changeRow(y,null,null,u('UCLA 工学院',p.yang)+u('本人短 CV',p.yangCV)+yp);
audit(y,{
 phd:old(y,'phd',yp,[p.yang]),postdoc:old(y,'postdoc',yp,[p.yangCV]),
 affiliation:[C,'UCLA 材料科学与工程。',[p.yang,p.yangCV]],
 research:[C,'有机与混合钙钛矿光伏、器件物理、材料制备与界面。',[p.yang,p.yangCV]]
},'追 UMass Lowell 学位授予日期与 UCR 当期个人指导原档，厘清 1991–1992 重叠。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_UCLA院系与指导原档';
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
