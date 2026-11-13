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
 a.audit_id='20261110_'+id+'_chen_sturm_dimitrakopoulos_1042';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_chen_sturm_dimitrakopoulos_1042_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const zj='26346ebd', chen='d4abe130', st='dd901917', zy='8624f6d1', dim='380462ff', sd='ddbf35d2', su='ddb9cf4b';
const zh='https://chemistry.gatech.edu/people/z-john-zhang';
const zE='Georgia Tech 化学与生物化学系本人页列 Fudan 1984 本科、Wisconsin–Madison 1993 博士、Harvard 博士后，未列个人导师。该页研究栏核磁性纳米材料与尺寸相关磁性质、固态化学和磁光谱。';
note(zj,'- 核查边界：',web('Georgia Tech 院系原页',zh)+'。'+zE);
changeRow(zj,'Wisconsin–Madison 1993 博士，导师待核','Harvard 博士后，导师待核',web('Georgia Tech 院系原页',zh));
audit(zj,{phd:['unresolved',zE,[zh]],postdoc:['unresolved',zE,[zh]],affiliation:['confirmed',zE,[zh]],research:['confirmed',zE,[zh]]},'用 Fudan 1984、Wisconsin 1993 与磁性纳米材料排除 Wharton 等同名者，追查 Wisconsin 纸本博士目录与 Harvard 博后组档。');

const cF='https://www.matse.psu.edu/directory/long-qing-chen';
const cV='https://mse.zju.edu.cn/_upload/article/files/ab/62/8fc61aca4905a4800cc5a8432cb2/8cffe7d4-3ba5-4fff-a000-dffe6e3ad7fe.pdf';
const cB='https://www.grafiati.com/en/literature-selections/grain-boundaries-molecular-dynamics/';
const cT='https://hdl.handle.net/1721.1/128799';
const cP='https://pure.psu.edu/en/publications/structure-and-dynamic-properties-of-twist-boundaries-in-nacl-thro';
const kh='师承人物 - Armen G. Khachaturyan', ka='师承人物 - Gretchen Kalonji';
const cE='Penn State 院系原页称 Rutgers 两年博士后 with Armen G. Khachaturyan；Zhejiang 托管履历明列 1990–1992 Rutgers 博后。保留博士后阶段研究师长。';
const cPh='Penn State 原始成果档载 1989 年陈与 Kalonji 合作的 NaCl 晶界分子动力学论文，列 Kalonji 的项目资助。外部书目给出 1990 MIT 博士论文题名 Molecular dynamics study of ionic grain boundaries 和馆藏号 1721.1/128799。合著、资助和题名对应仅支持已有低可信候选；MIT 原页受站点退避，导师栏未读取。';
const cProof=web('Penn State 同期成果原档',cP)+' · '+web('书目所指 MIT 论文馆藏（待读）',cT)+'。'+cPh;
editLine(fn(local(chen)),l=>l.startsWith('- 博士导师候选：')&&l.includes('[['+ka+'|'),l=>l+' '+cProof);
mentorLine(ka,chen,'- 博士生候选：',cProof);
indexLine(chen,ka,'博士导师候选',cProof);
const cPost=web('Zhejiang 托管履历',cV)+'。'+cE;
note(chen,'- 博士后阶段研究师长：',cPost);
mentorLine(kh,chen,'- 博士后阶段研究者：',cPost);
indexLine(chen,kh,'博士后阶段研究师长',cPost);
changeRow(chen,'Gretchen Kalonji（低可信候选）；MIT 论文馆藏待读','Armen G. Khachaturyan（Rutgers 1990–1992 博士后阶段研究师长）',web('Penn State 同期成果档',cP)+' · '+web('MIT 论文馆藏（待读）',cT)+' · '+web('Zhejiang 托管履历',cV));
const ca=audit(chen,{phd:['group_or_candidate',cPh,[cP,cB]],postdoc:['group_or_candidate',cE,[cF,cV]],affiliation:['confirmed','Penn State 系档列材料科学与工程、工程科学与力学、物理和数学。',[cF]],research:['confirmed','Penn State 系档列介观量子与功能材料、相变和相场模型。',[cF]]},'MIT 主机退避到期后查馆藏 1721.1/128799 的题名与签署页，区分 Kalonji 的项目资助与论文指导。');
relation(chen,'phd',ka,'candidate',cPh,[cP,cB],ca,false);
relation(chen,'postdoc',kh,'stage_mentor',cE,[cF,cV],ca,false);

const sB='https://sturm.scholar.princeton.edu/sites/g/files/toruqf3826/files/sturm/files/jp.181.pdf';
const sA='https://sturm.scholar.princeton.edu/document/703';
const sF='https://ece.princeton.edu/people/james-sturm';
const sP='https://academictree-staging.thetransmitter.org/etree/peopleinfo.php?pid=178217';
const pl=local('88655d8b');
const sE='Sturm 本人 2010 年论文作者简介列 1985 Stanford 博士及 1986 Princeton EE 教职。1985 年 APL 原文列 Sturm、James D. Plummer、James F. Gibbons 同在 Stanford Electronics Laboratories。Plummer 有额外第三方研究生索引线索，原页读取失败，仅留低可信候选。';
const sProof=web('1985 APL 原文',sA)+' · '+web('本人作者简介末页',sB)+'。'+sE;
addEdge(st,'博士导师候选',pl,'James D. Plummer',sProof,null,true);
inverse(st,pl,'博士候选研究者',sProof);
editLine(fn(local(st)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('本人 2010 年论文作者简介',sB)+'列 1985 Stanford 博士、1986 Princeton EE 入职。这篇文章记录本人履历和他指导的其他人。1985–1986 独立博士后或其他聘任待查。');
changeRow(st,'James D. Plummer（低可信候选）','1985 Stanford 博士至 1986 Princeton 教职间的聘任待核',web('本人作者简介',sB)+' · '+web('1985 APL 原文',sA));
const sa=audit(st,{phd:['group_or_candidate',sE,[sB,sA,sP]],postdoc:['unresolved','1985 Stanford 博士至 1986 Princeton 教职之间的岗位未注明。',[sB]],affiliation:['confirmed','Princeton ECE 校属及本人实验室原档交叉核。',[sF,sB]],research:['confirmed','Princeton ECE 原档及作者简介核硅基异质结、薄膜电子及光电器件。',[sF,sB]]},'用 Stanford Electronics Laboratories 及 1985 硅/绝缘体界面研究追查论文馆藏和签署页；查 1985–1986 任命档。');
relation(st,'phd',pl,'candidate',sE,[sB,sA,sP],sa);

const yR='https://profiles.rice.edu/faculty/yuji-zhao';
const yA='https://ecee.engineering.asu.edu/wp-content/uploads/sites/40/2019/06/ecee-annual-report-2013-2014.pdf';
const yP='https://www.ssleec.ucsb.edu/nakamura/publications';
const na=local('6bc5b510');
const yE='Rice 现任教师原档明确 Shuji Nakamura 指导其 UCSB 2012 博士。ASU 2013–2014 年度报告列 UCSB Materials/SSLEC Assistant Project Scientist 与 2014 ASU 入职；UCSB 原始发表目录记 2014 年与 Nakamura、DenBaars 合作。保留项目科学家任职，独立博后聘任与个人指导者待查。';
enrich(zy,'phd',na,'博士生',web('Rice 教师原档',yR)+'复核 2012 博士指导。');
note(zy,'- 核查边界：',web('ASU 同期院系年报',yA)+' · '+web('UCSB 同期发表档',yP)+'。'+yE);
changeRow(zy,null,null,web('ASU 同期院系年报',yA)+' · '+web('UCSB 同期发表档',yP));
const ya=audit(zy,{phd:['confirmed_advisor',yE,[yR]],postdoc:['unresolved',yE,[yA,yP]],affiliation:['confirmed','Rice 人物档列 ECE 教授与 WIDE 实验室负责人。',[yR]],research:['confirmed','Rice 原档列宽禁带半导体、功率与 RF 电子、量子光子学。',[yR]]},'沿 UCSB 项目科学家岗位的聘任和 SSLEC 名录找指导者，单独确认是否存在正式博后聘任。');
relation(zy,'phd',na,'advisor',yE,[yR],ya,false);

const dU='https://eng.umd.edu/clark/faculty/312/Panagiotis-Panos-Dimitrakopoulos';
const dH='https://user.eng.umd.edu/~dimitrak/pd-phd-research.html';
const dP='https://user.eng.umd.edu/~dimitrak/Papers/PD_2001_PRE_Linear_Stress.pdf';
const dB='https://bradygroup.caltech.edu/publications';
const dE='Maryland 院系履历列 Caltech 化工博士后及 2001 年。2001 年本人托管 PRE 原文首页列 Dimitrakopoulos、John F. Brady、Zhen-Gang Wang 同属 Caltech 化学与化工，Brady 组原档也列该文。两位合作人员分别列低可信候选，具体指导者未明。';
const dProof=web('Maryland 院系原档',dU)+' · '+web('2001 PRE 原文',dP)+' · '+web('Brady 课题组书目',dB)+'。'+dE;
const dm=[[local('bafbf57a'),'John F. Brady'],[local('8d3bba96'),'Zhen-Gang Wang']];
for(const [target,name] of dm){addEdge(dim,'博士后导师候选',target,name,dProof,null,true);inverse(dim,target,'博士后候选研究者',dProof);}
note(dim,'- 核查边界：',dProof);
changeRow(dim,null,'Caltech 化工博士后；John F. Brady、Zhen-Gang Wang（低可信候选）',web('2001 PRE 原文',dP)+' · '+web('Brady 课题组书目',dB));
const da=audit(dim,{phd:['confirmed_advisor','本人 UIUC 1998 博士研究总结明确 Jonathan J. L. Higdon, Advisor。',[dH]],postdoc:['group_or_candidate',dE,[dU,dP,dB]],affiliation:['confirmed','Maryland 院系原页核化学与生物分子工程与 BioFluid Dynamics Computational Laboratory。',[dU]],research:['confirmed','Maryland 院系原页核微流、液滴、聚合物动力学和计算流体。',[dU,dP]]},'查 Caltech 1998–2001 博后名录或任用项目，区分两位同期合作人员的实际指导职责。');
for(const [target] of dm)relation(dim,'postdoc',target,'candidate',dE,[dU,dP,dB],da);

const kC='https://www.umdphysics.umd.edu/images/CV/2023/Sardashti_CV.pdf';
const kL='https://www.labeq.org/publications';
const kE='本人 7 页 CV 第 1 页明确 Duke 机械工程与材料科学 Postdoctoral Associate 为 2017-01 至 2017-12。NYU CQP 分两段列 Research Scientist，FIT 与 Clemson 分列助理教授；Maryland Physics 和 LPS 自 2024-03 列于履历。Duke 博后指导者未列。';
note(sd,'- 核查边界：',web('本人另一校方托管 CV 第 1 页',kC)+'。'+kE);
changeRow(sd,null,'Duke 机械工程与材料科学 2017-01–12 博后，导师待核；NYU 为研究科学家',web('本人校方托管 CV 第 1 页',kC));
audit(sd,{postdoc:['unresolved',kE,[kC]],affiliation:['confirmed','本人 CV 核 Maryland Physics 和 LPS 任职；既有材料关联另据原资料保留。',[kC]],research:['confirmed','本人实验室书目核超导量子器件、半导体界面和量子材料。',[kL,kC]]},'核 Duke 2017 实验室与项目档，查 UCSD 2016 论文签署页区分 Kummel 正式导师与组属。');

const nL='https://www.suruilab.com/team';
const nF='https://www.ntu.edu.sg/eee/about-us/our-people';
const nR='https://www.ntu.edu.sg/spms/news-events/news/detail/realising-polariton-condensate-in-a-synthetic-moir%C3%A9-superlattice';
const nH='https://www.suruilab.com/';
const nE='本人课题组成员原页将 Rui Su 列为 Nanyang Assistant Professor，分别列物理与数学科学学院和电气与电子工程学院；EEE 名录及 SPMS 研究报道交叉核实。本人组史写 2022-05 开组，先前研究员的聘任类别与导师待核。';
const eee='已核实单位 - NTU - 电气与电子工程学院';
editLine(fn(local(su)),l=>l.startsWith('- 院系／机构：'),l=>l.slice(0,-1)+' · [['+eee+'|电气与电子工程学院]]。');
note(su,'- NTU 物理助理教授，',web('本人课题组双聘原档',nL)+'。'+nE);
const efile=path.join(root,'已核实院系',eee+'.md');
const ebody=fs.readFileSync(efile,'utf8');
if(ebody.includes('[['+local(su)+'|'))throw Error('existing EEE inverse link');
const newline=ebody.includes('\r\n')?'\r\n':'\n';
graph.set(efile,ebody.trimEnd()+newline+'- [['+local(su)+'|Rui Su]] — '+web('本人课题组双聘原档',nL)+newline);
const sr=records.get(su);
editLine(path.join(root,sr.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+sr.filename+'|'),l=>l.replace('物理与数学科学学院；','物理与数学科学学院、电气与电子工程学院；'));
changeRow(su,null,'2022-05 起独立课题组；此前研究员聘任类别及个人指导待核',web('本人课题组双聘原档',nL)+' · '+web('NTU EEE 名录',nF));
audit(su,{affiliation:['confirmed',nE,[nL,nF,nR,nH]],research:['confirmed','NTU SPMS 研究报道与本人组原页核半导体微腔、钙钛矿激子极化激元、拓扑与量子光子。',[nR,nH]],postdoc:['unresolved',nE,[nL,nH]]},'查 DR-NTU 本人博士论文及 2019–2022 原始任命；EEE 与 SPMS 双聘已核，不将同期合作认作指导。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_ZhangChenSturmDimitrakopoulos原证';
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
