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
 a.audit_id='20261110_'+id+'_roles_1027';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_roles_1027_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const lau='39b8f1a3', yang='87d4ebbd', ron='c06d56dc', lee='c0bc22b5', christos='ecf381c4';
const ls='https://www.sutd.edu.sg/profile/lau-chit-siong-aaron', la='https://research.a-star.edu.sg/researcher/aaron-lau/';
const lE='SUTD 教师原档列 Oxford 材料 DPhil、2017 年回 A*STAR IMRE，A*STAR 人物页列 Q.InC／IMRE 量子器件负责人及 SUTD 兼任助理教授。所阅任职简历未明列独立博后。既有 Oxford 论文三位博士导师保留，论文地址本轮 403。';
const lP=web('SUTD 教师档',ls)+' · '+web('A*STAR 人物档',la)+'。'+lE;
note(lau,'- 核查边界：',lP);
changeRow(lau,null,'2017 年回 A*STAR IMRE；所阅履历未列独立博后',lP);
audit(lau,{affiliation:['confirmed',lE,[ls,la]],research:['confirmed','二维量子材料、量子输运和单分子电子学。',[ls,la]],postdoc:['no_postdoc_documented',lE,[ls,la]]},'查 A*STAR 2017 初任聘书；继续核论文致谢中 Wang Shi Jie 和 Andrew Wee 的身份。');

const yP='https://research.polyu.edu.hk/en/persons/shengyuan-yang/', yN='https://www.polyu.edu.hk/fs/publication/e-newsletter/issue-7/promotions-and-new-appointments/';
const yT='https://english-icqd.ustc.edu.cn/2026/0608/c9268a743793/page.htm', yG='https://rlqm.cloud/';
const yE='USTC 2026 年讲座原档分列 2011–2013 CGG 地球物理岗位、2013 起 SUTD、2023–2025 澳门大学、2025 起香港理工。香港理工 2025 新聘公告、现任教师库和本人实验室现址交叉核实 PolyU 物理与材料教授。SUTD 留作历史任职，澳门大学旧署名按发表时单位保留。所阅履历未分列独立博后。';
const yProof=web('香港理工新聘公告',yN)+' · '+web('香港理工现任教师库',yP)+' · '+web('USTC 2026 讲座履历',yT)+' · '+web('本人课题组',yG)+'。'+yE;
editLine(fn(local(yang)),l=>l.startsWith('- 拓扑量子材料和二维凝聚态理论；'),()=>'- 拓扑量子材料和二维凝聚态理论。'+yProof);
editLine(fn(local(yang)),l=>l.startsWith('- SUTD 图书馆历史教师资料'),()=>'- SUTD 图书馆旧档记录 Engineering Product Development 历史任职，现任香港理工物理与材料教授。'+web('SUTD 旧档','https://mylibrary.sutd.edu.sg/yang-shengyuan-0')+' · '+web('香港理工现任教师库',yP));
note(yang,'- 核查边界：',yProof);
changeRow(yang,null,'2011–2013 CGG；所阅履历未列独立博后',yProof);
audit(yang,{identity:['confirmed',yE,[yP,yN,yT,yG]],affiliation:['confirmed',yE,[yP,yN,yT,yG]],research:['confirmed','USTC 原始讲座履历列拓扑材料、二维材料、输运与非线性响应。',[yT,yG]],postdoc:['no_postdoc_documented',yE,[yT]]},'保留 SUTD 历史节点及原文件名。查 UT Austin 原始学位签署或馆藏元数据，保留既有本人 CV 的 Qian Niu 博士导师。');

const rn='https://digital.sandiego.edu/dissertations/954/', rd='https://che.engineering.ucdavis.edu/news/che-celebrates-careers-marjorie-longo-ronald-phillips-and-robert-powell';
const rE='University of San Diego 论文原目录列 Ronald Phillips 2022 护理博士。UC Davis 退休原档核本记录 Ronald J. Phillips 是 MIT 化工博士及 Davis 荣休教授，研究聚合物溶液、胶体和悬浮液传输。所阅原档未列独立博士后。Deen 维持博士课题组候选，MIT 论文原件待查。';
note(ron,'- 核查边界：',web('UC Davis 退休原档',rd)+' · '+web('USD 同名排除原档',rn)+'。'+rE);
changeRow(ron,null,'MIT 博士后返 UC Davis 任教；所阅未列独立博士后',web('UC Davis 退休原档',rd));
const ra=audit(ron,{identity:['confirmed',rE,[rd,rn]],postdoc:['no_postdoc_documented',rE,[rd]],affiliation:['confirmed','UC Davis 化工系荣休。',[rd]],research:['confirmed','胶体、非牛顿流体、悬浮液与传输。',[rd]]},'查 MIT 论文签署与年份差异，补核赴 Davis 任教前的任职。');

const lc='https://chemistry.cornell.edu/stephen-lee', lm='https://www.macfound.org/fellows/class-of-1993/stephen-lee';
const lp='https://deepblue.lib.umich.edu/bitstream/handle/2027.42/71102/JCPSA6-90-5-2732-1.pdf?sequence=2';
const lb='https://electronicsandbooks.com/edt/manual/Magazine/C/Chemistry%20-%20An%20Asian%20Journal/2007%20all/10/01.pdf';
const lw='https://aces.onlinelibrary.wiley.com/doi/10.1002/asia.200700088';
const lu='https://people.cs.pitt.edu/~stl86/docs/cv.pdf';
const le='Stephen Lee 1989 年本人论文致谢列 NATO 博后项目资助并感谢 Rouxel、Jeitschko、Burdett，2007 年本人合著论文作者简介将三位列为训练师长。与 Chicago 1985 博士和 Burdett 既有博士资料比对，Rouxel 与 Jeitschko 仅为低可信博士后阶段候选，阶段日期、单位和正式角色未明。Pittsburgh 计算机系 2019 UMass 博士属于另一人。';
const lpf=web('1989 本人论文致谢',lp)+' · '+web('2007 论文作者简介全文镜像',lb)+' · '+web('原出版记录',lw)+'。'+le;
for(const m of ['Jean Rouxel','Wolfgang Jeitschko']){
 const tgt='师承人物 - '+m;
 addEdge(lee,'博士后导师候选',tgt,m,lpf,null,true);
 newMentor(tgt,m,'固体化学。'+web('早期训练原文',lb),lee,'博士后候选研究者',lpf);
}
note(lee,'- 核查边界：',web('Cornell 系档',lc)+'。'+lpf);
changeRow(lee,null,'NATO 博后项目资助有原证；Jean Rouxel、Wolfgang Jeitschko（低可信候选）',lpf);
const leA=audit(lee,{identity:['confirmed',le,[lc,lm,lu]],affiliation:['confirmed','Cornell 化学与化学生物学系。',[lc]],research:['confirmed','固态化学、电子结构、金属间化合物。',[lc,lm,lp]],postdoc:['group_or_candidate',le,[lp,lb,lw]]},'查 NATO／Humboldt 博后获资助单位、Münster 和 Nantes 早期聘任原档；核 Chicago 学位签署页。');
for(const m of ['Jean Rouxel','Wolfgang Jeitschko'])relation(lee,'postdoc','师承人物 - '+m,'candidate',le,[lp,lb,lw],leA);

const cf='https://www.fleet.org.au/fleet_public/wp-content/uploads/2020/03/SEMINAR_Christos-Panagopoulos.pdf';
const ce='Panagopoulos 在 FLEET 讲座第一人称简介列 1997 Cambridge Trinity College 博士，之后任 Trinity College Junior Research Fellow 与 Royal Society University Fellow。原文分别列两个职称，未逐一标注任期、个人指导者或正式博士后称谓。';
note(christos,'- 核查边界：',web('FLEET 本人讲座履历',cf)+'。'+ce);
changeRow(christos,'1997 Cambridge 博士；导师待核','其后 Cambridge 两项 fellowship；个人指导待核',web('FLEET 本人讲座履历',cf));
audit(christos,{phd:['unresolved',ce,[cf]],postdoc:['unresolved',ce,[cf]]},'查 Cambridge 1997 学位档及 Trinity College JRF 任命，分清本人师长和他指导的研究人员。');

const excluded=[
 {page_id:'a3a367b75d79d8f9483c87e9',record_id:ron,url:rn,audit_id:ra,external_subject:'Ronald Phillips（University of San Diego 2022 护理博士）',evidence:rE},
 {page_id:'e5fcfe7cd95b7a86e20a5406',record_id:lee,url:lu,audit_id:leA,external_subject:'Stephen Lee（University of Pittsburgh 计算机科学教师）',evidence:le}
];


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_SUTDLeePhillips原档复核';
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
 const excludedFile=stamp+'_同名排除.json';
 fs.writeFileSync(excludedFile,JSON.stringify(excluded,null,2)+'\n','utf8');
 console.log(execFileSync(process.execPath,['--no-warnings','人物网页身份纠偏.cjs',excludedFile],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
