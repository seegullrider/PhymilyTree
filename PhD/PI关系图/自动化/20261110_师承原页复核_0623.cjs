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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0623';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0623_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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
const pp=(y)=>'https://ppfp.ucop.edu/info/fellowship-recipients/fellows-'+y+'/fellows-'+y+'-name/';

const at='882aaa41', py=local('67716191'), mo='师承人物 - Daniel Morse', tao='https://atao.ucsd.edu/?page_id=171', yang='https://nanowires.berkeley.edu/people/';
const ap='UC PPFP 2007 年度档明确列 Andrea Rae Tao 的 Thesis Advisor 为 Peidong Yang，Tao 本人组档和 Yang 博士校友名录交叉核对 Berkeley 博士和 UC San Diego 去向。';
const aq='同一年度档列 Daniel Morse 为 UCSB 项目 Mentor，本人组档核实在 Morse 组做博后研究及 2009 年履历，保留阶段研究师长。';
const aa=audit(at,{phd:['confirmed_advisor',ap,[pp(2007),tao,yang]],postdoc:['group_or_candidate',aq,[pp(2007),tao]],affiliation:['confirmed','UC San Diego NanoEngineering 教师和本人课题组。',[pp(2007),tao]],research:['confirmed','本人组档核对纳米晶自组装及光学性质。',[tao]]},'查 Berkeley 学位签署和 Morse 阶段正式博后指导称谓。');
const a1=' '+web('UC PPFP 2007 年度档',pp(2007))+ap;
replaceNoteLabel(at,'博士阶段研究师长','博士导师',py,a1);
replaceInverseLabel(py,at,'博士阶段研究者','博士生',a1);
replaceIndexLabel(at,py,'博士阶段研究师长','博士导师',a1);
const a2=' '+web('UC PPFP 2007 年度档',pp(2007))+aq;
replaceNoteLabel(at,'博士后课题组负责人','博士后阶段研究师长',mo,a2);
replaceInverseLabel(mo,at,'博士后课题组成员','博士后阶段研究者',a2);
replaceIndexLabel(at,mo,'博士后课题组负责人','博士后阶段研究师长',a2);
editLine(fn(local(at)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：UC PPFP 明确列 Yang 为 Thesis Advisor，Morse 为 UCSB 项目 Mentor。Berkeley 论文签署和 UCSB 正式岗位导师称谓待核。');
changeRow(at,'Peidong Yang（Berkeley 化学博士导师）','Daniel Morse（UCSB 博士后项目师长）',web('UC PPFP 2007 年度档',pp(2007)));
relation(at,'phd',py,'advisor',ap,[pp(2007),tao,yang],aa);
relation(at,'postdoc',mo,'stage_mentor',aq,[pp(2007),tao],aa);

const lc='57eb37d8', hk=local('78be8f5b'), cg='师承人物 - Dennis O. Clegg';
const cl='https://labs.mcdb.ucsb.edu/clegg/dennis/alumni', ic='https://www.icb.ucsb.edu/people/researchers/dennis-clegg', cb='https://www.somoscampos.org/luis-m-campos.html';
const cp='UC PPFP 2008 年度档在博士后 Mentor 栏并列 Craig Hawker 与 Dennis O. Clegg。Clegg 组档列 Campos 于 2007–2010 在组、与 Hawker 共同指导。档案归入研究生栏的冲突保留，以奖助原档确认 Clegg 的博后项目师长角色。Hawker 另有本人传记的博士后指导记录。';
const cs=web('UC PPFP 2008 年度档',pp(2008))+'明确并列 Hawker 与 Clegg 为博士后项目 Mentors。'+web('Clegg 组校友档',cl)+'记录共同指导，正式个人 advisor 字段仍待核。';
const ca=audit(lc,{postdoc:['confirmed_advisor',cp,[pp(2008),cl,cb]],affiliation:['confirmed','项目档现任 Columbia 化学，Clegg 组档亦列 Columbia 去向。',[pp(2008),cl]]},'Clegg 的博士后项目共同指导有直接证据，继续查岗位起止及正式个人 advisor 字段。');
addEdge(lc,'博士后阶段研究师长',cg,'Dennis O. Clegg',cs,hk);
newMentor(cg,'Dennis O. Clegg','UCSB 生物科学与工程相关教师，'+web('UCSB ICB 教师页',ic)+'。',lc,'博士后阶段研究者',cs);
note(lc,'- 核查边界：',web('UC PPFP 年度原档',pp(2008))+'明确 Clegg 属博士后项目共同师长。');
changeRow(lc,null,'Craig Hawker（UCSB 博士后导师）；Dennis O. Clegg（PPFP 项目共同研究师长）',web('UC PPFP 2008 年度档',pp(2008)));
relation(lc,'postdoc',cg,'stage_mentor',cp,[pp(2008),cl,ic],ca);

const jv='52b1ad60', jl=local('34c8ba54'), cm=local('d0d635fd');
const jc='https://bpb-us-e1.wpmucdn.com/sites.ucsc.edu/dist/5/235/files/2025/01/Full-CV-01-06-25.pdf', cmg='https://physics.berkeley.edu/research-faculty/crommie-group/members';
const jp='Velasco 本人 2025 CV 首页明确 UC Riverside 2012 物理博士 Advisor 为 Chun Ning (Jeanie) Lau，UC PPFP 年度档的 Thesis Advisor 栏一致。';
const jq='本人 CV 列 2012–2015 Berkeley PPFP 博后及 Host Crommie，UC PPFP 2012 年度档明确 Mentor。Crommie 组档确认博后身份；同一人同阶段标项目师长，并保留 Host 和组属证据。';
const ja=audit(jv,{phd:['confirmed_advisor',jp,[jc,pp(2012)]],postdoc:['group_or_candidate',jq,[jc,pp(2012),cmg]],affiliation:['confirmed','本人 CV 首页列 UCSC 物理系教职，Berkeley 组档去向相符。',[jc,cmg]]},'已确证项目导师，查 Berkeley 博后正式个人 advisor 或 supervisor 原件。');
enrich(jv,'phd',jl,'博士生',web('UC PPFP 2012 年度档',pp(2012))+'与本人 CV 的 Thesis Advisor 相符。');
const js=' '+web('UC PPFP 2012 年度档',pp(2012))+jq;
replaceNoteLabel(jv,'博士后课题组负责人','博士后阶段研究师长',cm,js);
replaceInverseLabel(cm,jv,'博士后组员','博士后阶段研究者',js);
replaceIndexLabel(jv,cm,'博士后课题组负责人','博士后阶段研究师长',js);
note(jv,'- 核查边界：',web('UC PPFP 2012 年度档',pp(2012))+'另具名项目 Mentor。');
changeRow(jv,'Chun Ning (Jeanie) Lau（2012 UC Riverside 博士导师）','Michael F. Crommie（2012–2015 Berkeley PPFP 项目师长、本人 CV 列 Host）',web('UC PPFP 原档',pp(2012)));
relation(jv,'phd',jl,'advisor',jp,[jc,pp(2012)],ja);
relation(jv,'postdoc',cm,'stage_mentor',jq,[jc,pp(2012),cmg],ja);

const ju='eb122f99', rr=local('35af1b59');
const juq='UC PPFP 2015 年度档和个人档分别列 Ramesh 为 Berkeley 博后项目 Mentor，年度与 Cornell 学位授予时间分列。';
const jua=audit(ju,{postdoc:['group_or_candidate',juq,[pp(2015),'https://ppfp.ucop.edu/info/fellowship-recipients/fellows-pages/mundy-julia-a.html']]},'核 Berkeley 具体起止和个人正式岗位导师字段；Cornell 两位论文导师按既有证据保存。');
const jus=web('UC PPFP 2015 年度档',pp(2015))+'交叉证实项目 Mentor。年度档与实际岗位时间分列。';
note(ju,'- 博士后阶段研究师长：',jus);
mentorLine(rr,ju,'- 博士后阶段受指导者：',jus);
indexLine(ju,rr,'博士后阶段研究师长',jus);
changeRow(ju,null,'Ramamoorthy Ramesh（Berkeley 博后项目师长）',web('UC PPFP 年度档',pp(2015)));
relation(ju,'postdoc',rr,'stage_mentor',juq,[pp(2015),'https://ppfp.ucop.edu/info/fellowship-recipients/fellows-pages/mundy-julia-a.html'],jua,false);

const bg='007db192', am='师承人物 - Andrew P. Mackenzie', kb=local('48f924c4');
const bs='https://schmidtsciencefellows.org/fellow/berit-goodge/', bcor='https://www.duffield.cornell.edu/people/berit-goodge/', mba='https://max-planck-quantum-alliance.mpg.de/quantum-materials/', mpg='https://www.cpfs.mpg.de/3459797/goodge', car='https://digitalcommons.carleton.edu/phys_students/index.2.html';
const bp='Schmidt 本人项目档明确 Placement Institution 为 Mackenzie Group, Max Planck Institute。Max Planck 机构页证实 Andrew Mackenzie 负责量子材料部门，并独立列 Goodge 的研究组；保留 fellowship 接收组，与独立 Minerva 组长职务分开。';
const bq=web('Schmidt Fellowship 本人档',bs)+'列 Max Planck Mackenzie Group 为项目接收组，'+web('Max Planck 机构档',mba)+'核对负责人身份。'+web('Goodge 原组页',mpg)+'另记她为组长。个人正式导师称谓及角色过渡日期待核。';
const ba=audit(bg,{identity:['confirmed','Carleton 物理系本人本科项目目录列 Berit Hansen Goodge 2016，符合 Cornell 教育栏；Cornell 传记写 2012 保留来源差异。',[car,bcor]],postdoc:['group_or_candidate','UC Berkeley PPFP 的 Bediako、Neaton 阶段师长保留。'+bp,[bs,mba,mpg,bcor]],affiliation:['confirmed','Cornell AEP 教师档列现职，Max Planck 组档另有 Guest Group Leader，奖助与任职分开。',[bcor,mpg]],research:['confirmed','Cornell 与 Max Planck 资料确认量子材料合成、电子显微表征、镍酸盐超导。',[bcor,mpg]]},'查 Berkeley 的正式博后称谓和 Schmidt 接收组起止，区分 Minerva 组长独立任期。');
addEdge(bg,'博士后项目接收课题组负责人',am,'Andrew P. Mackenzie',bq,kb);
newMentor(am,'Andrew P. Mackenzie','Max Planck Institute for Chemical Physics of Solids 量子材料研究部负责人，研究强关联金属与超导。'+web('Max Planck Quantum Alliance',mba)+'。',bg,'博士后课题组成员（项目接收）',bq);
note(bg,'- 核查边界：',web('Carleton 物理本科项目目录',car)+'列 2016，与 Cornell 教育栏一致。Schmidt 接收组与 Minerva 独立组长经历分别记录。');
changeRow(bg,null,'Berkeley PPFP：Kwabena Bediako、Jeffrey Neaton（项目师长）；Max Planck Schmidt：Andrew P. Mackenzie（项目接收组负责人）',web('Schmidt 原档',bs)+' · '+web('Max Planck 原组页',mpg));
relation(bg,'postdoc',am,'group_leader',bp,[bs,mba,mpg,bcor],ba);

const sg='eb2c4405', me='师承人物 - Robert B. Meyer';
const gc='https://www.cmu.edu/physics/people/faculty/documents/garoff_cv1.pdf', gb='https://www.cmu.edu/biolphys-garof/Steve%20CV.html';
const gp='CMU 两版本人 CV 均明确 Harvard 1977 应用物理博士论文 Ferroelectric Liquid Crystals，Advisor Robert B. Meyer。';
const gq='本人 CV 任职栏明列 1977–1986 Exxon Research Scientist，接续 Schlumberger-Doll 与 Carnegie Mellon，所读履历没有单列博士后岗位。';
const ga=audit(sg,{phd:['confirmed_advisor',gp,[gc,gb]],postdoc:['no_postdoc_documented',gq,[gc,gb]],research:['confirmed','本人 CV 核实铁电液晶、流体润湿与界面研究。',[gc,gb]]},'博士导师及毕业后第一段岗位已有两版本人履历。若取得同期任命档，可补产业研究员岗位的细节。');
audits.at(-1).followup_required=false;
enrich(sg,'phd',me,'博士生',web('CMU 本人 PDF CV',gc)+gp);
note(sg,'- 核查边界：',web('CMU 本人履历',gb)+'明确 1977–1986 为 Exxon Research Scientist，所读履历未单列博士后。');
changeRow(sg,'Robert B. Meyer（1977 Harvard 应用物理博士导师）','本人 CV 列毕业后直接入 Exxon 作研究科学家（1977–1986），未发现单列博士后任职',web('CMU 两版本人履历',gb));
relation(sg,'phd',me,'advisor',gp,[gc,gb],ga,false);

const zj='eb59e41a', ve=local('0feace50'), pk=local('be1d4c3b'), hs='师承人物 - Horst Stormer';
const zc='https://bpb-us-e1.wpmucdn.com/sites.gatech.edu/dist/d/4604/files/2025/02/CV_Jiang.pdf', zf='https://people.research.gatech.edu/zhigang-jiang', za0='https://arxiv.org/pdf/0705.1102', zn='https://physics.northwestern.edu/documents/dimensions/dimensions-spring2014.pdf';
const zp='Georgia Tech 本人 CV 确认 Northwestern 2005 博士；此前 Northwestern 系刊证据支持 Chandrasekhar 博士阶段指导，原档本轮超过网页工具大小，继续核论文签署。';
const zq='本人 CV 和 Georgia Tech 履历确认 2005–2008 Columbia、Princeton 和 NHMFL 联合博后。2007 石墨烯原稿具名同机构合作者 Philip Kim 和 Horst Stormer，保留为低可信候选，未获得任命或指导原件。';
const zz=audit(zj,{phd:['group_or_candidate',zp,[zc,zf,zn]],postdoc:['group_or_candidate',zq,[zc,zf,za0]],affiliation:['confirmed','Georgia Tech 本人 CV 列 2021 起教授，院校研究资料确认身份。',[zc,zf]],research:['confirmed','Georgia Tech 机构档核对低维凝聚态的量子输运、红外光学。',[zf,za0]]},'查 Northwestern 学位签署和 Columbia／Princeton／NHMFL 个人任命或奖助导师字段。');
const zs=web('本人 CV',zc)+'与'+web('2007 同期论文原稿',za0)+'核对联合博后期间的 Columbia 合作。低可信候选，指导关系待核。';
for (const [target,name] of [[pk,'Philip Kim'],[hs,'Horst L. Stormer']]){
 addEdge(zj,'博士后导师候选',target,name,zs,null,true);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- 博士后候选：[['+local(zj)+'|Zhigang Jiang]]。'+zs);
 relation(zj,'postdoc',target,'candidate',zq,[zc,zf,za0],zz);
}
relation(zj,'phd',ve,'stage_mentor',zp,[zc,zf,zn],zz);
note(zj,'- 核查边界：',web('本人 CV',zc)+'确认三机构联合博后，Kim 与 Stormer 仅保留同期合作候选。');
changeRow(zj,null,'2005–2008 Columbia／Princeton／NHMFL 联合博后；Philip Kim、Horst Stormer 为 Columbia 同期低可信候选',web('本人 CV',zc)+' · '+web('2007 原稿',za0));

const fl='d750f0c9', kl='师承人物 - Robert F. Klie';
const fw='https://engineering.washu.edu/faculty/Francisco-Lagunas-Vargas.html', fu='https://phys.uic.edu/news-stories/francisco-lagunas/', fp='https://www.avsconferences.org/AVS2025/Sessions/Schedule/83943';
const fq='UIC 原系档列 2023 年 5 月起在 Argonne 博后，WashU 现任原档确认曾从事新能源材料与离子传感器研究。AVS 会议档列与 Zachary Hood 等人的 Argonne 薄膜合作；项目报告不列导师，保留研究合作线索。';
audit(fl,{postdoc:['unresolved',fq,[fw,fu,fp]],affiliation:['confirmed','WashU 教师档列机械工程与材料科学系助理教授及材料研究所关联。',[fw]],research:['confirmed','WashU 教师档核对 STEM、材料原子结构、电化学与催化。',[fw,fu]]},'查 Argonne 任命起止和个人导师，Hood 等仅为待追查的项目合作者。');
note(fl,'- 博士后经历：',web('WashU 现任教师档',fw)+'补实机械工程与材料科学任职。'+web('AVS Argonne 共同报告',fp)+'可追查项目合作方，未具名博后导师。');
changeRow(fl,null,'Argonne 博后，2023 年 5 月起，结束及导师待核',web('WashU 教师档',fw)+' · '+web('UIC 原系档',fu));
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0623';
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








