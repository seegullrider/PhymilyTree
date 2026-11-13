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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0819';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0819_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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




const koh='fac9352c', cheng='e2ebf9d2', wang='fb2c7051', ellen='fe5068e6', kieffer='fb3a4353', tim='41c1e5a1', kap='fb3670d3', stone='f996c949';
const cahill='人员 - UIUC - David G. Cahill - 6d81f0c4', cer='师承人物 - Michele Ceriotti', preskill='人员 - Caltech - John Preskill - b904154d';
const park='师承人物 - Robert L. Park', jia='师承人物 - Quanxi Jia', angell='师承人物 - C. Austen Angell';
const wein='师承人物 - William Henry Weinberg', reich='人员 - Columbia - David R. Reichman - 38d42d59', chan='人员 - Caltech - Garnet K.-L. Chan - 9a4a4057';
const kohCv='https://bpb-us-w2.wpmucdn.com/blog.nus.edu.sg/dist/1/8507/files/2017/08/Yee-Kan-KOH-_CV-1na2ljg.pdf', kohNus='https://cde.nus.edu.sg/me/staff/koh-yee-kan-2/', cahillCv='https://cahill.matse.illinois.edu/files/2025/12/cv25.pdf';
const ista='https://ista.ac.at/en/research/cheng-group/', bk='https://vcresearch.berkeley.edu/faculty/bingqing-cheng', epfl='https://www.epfl.ch/education/phd/edmx-materials-science-and-engineering/edmx-published-theses/';
const wangCv='https://studylib.net/doc/18774829/curriculum-vitae---college-of-engineering', jiaCv='https://www.buffalo.edu/content/dam/engineering/materials-design-innovation/faculty/cv/Cv_Jia_2023.pdf', jiaUb='https://www.buffalo.edu/ubnow/stories/2016/09/quanxi-jia-cmi.html', lanlPaper='https://arxiv.org/abs/cond-mat/0406087', nlm='https://pubmed.ncbi.nlm.nih.gov/15170180/';
const pnas='https://www.pnas.org/doi/10.1073/pnas.0809617105', thesisE='https://thesis.caltech.edu/3840/';
const um='https://lsa.umich.edu/appliedphysics/people/faculty/kieffer.html', cmu='https://www.cmu.edu/engineering/materials/news_and_events/departmental_seminar_series/documents/2009/fall/kieffer_announcement.pdf', asu='https://asu.elsevierpure.com/en/publications/generation-of-fractal-structures-by-negative-pressure-rupturing-o/';
const stan='https://chemistry.stanford.edu/events/dr-timothy-berkelbach-princeton-university', reichLab='https://reichmangroup.chem.columbia.edu/directory', pcts='https://pcts.princeton.edu/people/past-postdocs', chanLab='https://www.chan-lab.caltech.edu/former-members';
const kth='https://thesis.caltech.edu/10356/', ias='https://www.ias.edu/scholars/anton-kapustin', kapOwn='https://antonkapustin.caltech.edu/general-info';
const uiNews='https://physics.illinois.edu/news/34304', ui='https://icmt.illinois.edu/people/m-stone5', xin='https://www.ideals.illinois.edu/items/92801/bitstreams/302264/data.pdf';
const nProof=web('Cahill 本人 CV',cahillCv)+'列 2010 年 7 月完成博士及随后任 NUS 机械工程助理教授。';
enrich(koh,'phd',cahill,'博士生',nProof);
editLine(fn(local(koh)),s=>s.startsWith('- 博士后关系证据：'),s=>'- 博士后履历：'+web('本人 CV',kohCv)+'列 2010 年 7 月结束 UIUC 学生研究助理、同月开始任 NUS 助理教授。'+nProof+' 所阅履历未单列博士后。');
editLine(fn(local(koh)),s=>s.startsWith('- 核查边界：'),s=>'- 核查边界：两份履历均显示从博士直接转入 NUS 教职。未发现单列的博士后经历，短期访问或重叠任职待另有原档时复核。');
changeRow(koh,'David G. Cahill（本人 CV 明列博士论文导师）','2010 年 7 月转入 NUS 教职，所阅未列博后',web('导师 CV',cahillCv));
const ka=audit(koh,{phd:['confirmed_advisor','本人 CV 明列 Dissertation Advisor: Prof. David G. Cahill；两份 CV 同列论文题名和毕业时间。',[kohCv,cahillCv]],postdoc:['no_postdoc_documented','本人 CV 显示 2010 年 7 月 UIUC 学生研究助理结束、同月开始 NUS 助理教授；Cahill CV 也列直接入 NUS 机械工程教职。所阅未列独立博士后。',[kohCv,cahillCv,kohNus]],affiliation:['confirmed','NUS 机械工程系原教师档列 Thermal Systems 方向副教授。',[kohNus]],research:['confirmed','院系原档确认声子、纳米材料和二维材料界面热输运、超快热反射。',[kohNus,kohCv]]},'博士后按履历未列保留，若有其他任职档或论文签署页则复核。');
relation(koh,'phd',cahill,'advisor','Koh 本人 CV 明列 Dissertation Advisor，Cahill CV 独立对应论文题名、学位完成时间及毕业去向。',[kohCv,cahillCv],ka,false);
note(cheng,'- 核查边界：',web('ISTA 原履历',ista)+'分列 2019 Trinity College Junior Research Fellow 和 2020–2021 Cambridge Departmental Early Career Fellow，并列 2018 SNSF Early Postdoc.Mobility Fellowship。各阶段个人指导者待查。');
changeRow(cheng,null,'Cambridge 两项研究 fellowship，个人导师待核',web('ISTA 研究组履历',ista)+' · '+web('Berkeley 教师档',bk));
audit(cheng,{postdoc:['unresolved','ISTA 机构履历列 2019 Cambridge Trinity Junior Research Fellow、2020–2021 Departmental Early Career Fellow，及 2018 SNSF Early Postdoc.Mobility。未具名导师。',[ista]],affiliation:['confirmed','Berkeley 官方教师档列化学系助理教授，ISTA 同列 Berkeley 教职和 ISTA 访问教授。',[bk,ista]],research:['confirmed','Berkeley 研究档列计算材料、机器学习原子势、增强采样、路径积分分子动力学。',[bk,ista]]},'查 SNSF P2ELP2-184408 接收单位和 Cambridge 两项 fellowship 的 host 或 mentor 字段。');
const wEvidence='Wang 本人 CV 副本在任职栏分列 2003–2004 LANL Director Funded Postdoctoral Fellow 与 2005 Technical Staff Member；奖项栏写 2002–2004。Jia 本人 CV 列 1997–2009 LANL Superconductivity Technology Center Team Leader；2004 同期论文列两人同中心合作。个人指导只列低可信候选。';
const wProof=web('Wang 本人 CV 副本',wangCv)+' · '+web('Jia 本人 CV',jiaCv)+' · '+web('2004 年原稿',lanlPaper)+' · '+web('期刊馆藏作者与单位',nlm)+'。'+wEvidence;
addEdge(wang,'博士后导师候选',jia,'Quanxi Jia',wProof,null,true);
newMentor(jia,'Quanxi Jia',web('University at Buffalo 机构履历',jiaUb)+'列材料设计与创新系及 LANL 经历。'+web('本人 CV',jiaCv)+'列 1997–2009 LANL 超导中心 Team Leader。',wang,'博士后候选研究者',wProof);
changeRow(wang,null,'LANL 2003–2004；Quanxi Jia 为低可信候选',web('Wang CV 副本',wangCv)+' · '+web('Jia CV',jiaCv));
note(wang,'- 核查边界：','LANL 的 2003–2004 任职栏和 2002–2004 奖项栏口径有差异。2005 技术职员另列；同组个人导师仍待原任命。');
const wa=audit(wang,{postdoc:['group_or_candidate',wEvidence,[wangCv,jiaCv,lanlPaper,nlm]]},'查 LANL Director Funded Fellowship 的个人 sponsor 或 mentor；另核 2002/2003 起始日期和同期其他项目负责人。');
relation(wang,'postdoc',jia,'candidate',wEvidence,[wangCv,jiaCv,lanlPaper,nlm],wa);
const eEvidence='PNAS 本人访谈档将 1981 Caltech 博士毕业、Maryland 博士后 fellowship 与在 Robert L. Park 实验室研究表面相变连续记载。该原文支持博后课题组负责人，未注明个人正式 advisor。';
const eProof=web('PNAS 本人访谈档',pnas)+'。'+eEvidence;
addEdge(ellen,'博士后课题组负责人',park,'Robert L. Park',eProof,wein);
newMentor(park,'Robert L. Park',web('PNAS 本人访谈档',pnas)+'核 Maryland College Park 表面物理实验室。',ellen,'博士后阶段课题组成员',eProof);
note(ellen,'- 博士研究导师：',web('PNAS 本人访谈档',pnas)+'称 Weinberg 为 thesis advisor，馆藏列 Harry B. Gray 的具体职责继续核对。');
editLine(fn(local(ellen)),s=>s.startsWith('- 核查边界：'),s=>s.replace('未确认 Williams 自己的博士后导师。','博后 Park 实验室已核，个人正式导师待查。'));
changeRow(ellen,null,'Robert L. Park（Maryland 博后课题组负责人）',web('PNAS 本人访谈档',pnas));
const ea=audit(ellen,{postdoc:['group_or_candidate',eEvidence,[pnas]],research:['confirmed','PNAS 原访谈确认从表面相变、硅表面与扫描探针发展至纳米电子。',[pnas]]},'查 Maryland 博后原任命是否列个人导师。区分 Caltech 论文致谢 Weinberg 的研究指导与馆藏 Gray 的行政／共同指导角色。');
relation(ellen,'postdoc',park,'group_leader',eEvidence,[pnas],ea);
const kEvidence='Carnegie Mellon 2009 讲座原档确认 Purdue 物理化学博士后经历；ASU 原研究目录列 Kieffer 与 Angell 1988 年玻璃结构研究。低可信同期合作候选。ASU 岗位性质及各阶段导师待原聘任。';
const kProof=web('Carnegie Mellon 讲座原档',cmu)+' · '+web('ASU 原研究目录',asu)+'。'+kEvidence;
addEdge(kieffer,'博士后导师候选',angell,'C. Austen Angell',kProof,null,true);
newMentor(angell,'C. Austen Angell',web('ASU 研究目录',asu)+'列本人玻璃结构研究与同期 Kieffer 合作。',kieffer,'博士后候选研究者',kProof);
changeRow(kieffer,'Clausthal（1985），论文导师待核','Purdue 博后，C. Austen Angell 为低可信候选；Arizona State 岗位性质待核',web('Michigan 应用物理档',um)+' · '+web('ASU 研究目录',asu));
const kia=audit(kieffer,{phd:['unresolved','Michigan 应用物理原档确认 1985 Clausthal 材料科学博士，未列导师。',[um,cmu]],postdoc:['group_or_candidate',kEvidence,[cmu,asu]],affiliation:['confirmed','Michigan 应用物理原档列材料科学与工程教授及应用物理项目。',[um]],research:['confirmed','Michigan 原档列材料模拟、电子结构与分子动力学，CMU 讲座确认玻璃及非晶材料。',[um,cmu]]},'查 Clausthal 博士学位目录；查 Purdue 人事／课题组档和 Arizona State 岗位性质。');
relation(kieffer,'postdoc',angell,'candidate',kEvidence,[cmu,asu],kia);
const timProof=web('Stanford 2014 本人讲座',stan)+'明确称 Princeton PCTS 岗位为 independent postdoctoral fellow；Chan 组校友表支持组关系，个人正式导师称谓待核。';
note(tim,'- 博士阶段课题组负责人：',web('Reichman 本人组档',reichLab)+'给出论文题名 *Microscopic theories of excitons and their dynamics*，链接的 ProQuest 原档本轮不可读。');
note(tim,'- 博士后课题组负责人：',timProof);
mentorLine(chan,tim,'- 博士后',timProof);
indexLine(tim,chan,'博士后课题组负责人',timProof);
changeRow(tim,null,'Princeton 独立博士后 fellow；Garnet K.-L. Chan（课题组）',web('Stanford 2014 讲座原档',stan));
const ta=audit(tim,{postdoc:['group_or_candidate','Stanford 2014 讲座称 PCTS independent postdoctoral fellow，Chan 组校友表列其 2014–2016 博后。个人 advisor 字段待原档。',[stan,chanLab,pcts]],phd:['group_or_candidate','Reichman 原组档给出博士论文题名及 2009–2014 博士阶段；Stanford 本人讲座列 Columbia 化学物理博士及与 Reichman 研究。ProQuest 签署页待查。',[reichLab,stan]]},'沿论文题名找 Columbia 论文签署或作者 CV，继续查独立 fellow 的原任命是否列 host。');
relation(tim,'postdoc',chan,'group_leader','Chan 组校友档列 2014–2016 PCTS 博士后。同期 Stanford 履历说明职位为 independent postdoctoral fellow。',[chanLab,pcts,stan],ta,false);
enrich(kap,'phd',preskill,'博士生',web('Caltech 本人学位论文记录',kth)+'直接列 John P. Preskill 为 Advisor。');
note(kap,'- 核查边界：',web('IAS 本人历任档',ias)+'列 1997 年 9 月至 2001 年 9 月，校属资料保留原导师待核。');
changeRow(kap,'John P. Preskill（本人论文档直接列 Advisor）','IAS 1997–2001，个人导师待核',web('Caltech 学位记录',kth)+' · '+web('IAS 档',ias));
const apa=audit(kap,{phd:['confirmed_advisor','Caltech 本人论文目录 Topics in Heavy Quark Physics 直接列 Advisor: Preskill, John P.。',[kth]],postdoc:['unresolved','IAS 历任档确认 1997 年 9 月至 2001 年 9 月任职。未具名个人导师。',[ias]],research:['confirmed','本人 Caltech 原档列数学凝聚态、拓扑物态、输运和流体动力学。',[kapOwn]]},'继续查 IAS 年报任命和同期档案，区分合作与正式指导。');
relation(kap,'phd',preskill,'advisor','Caltech 学位馆藏本人论文原记录直接列 Advisor: Preskill, John P.。',[kth],apa,false);
note(stone,'- 核查边界：',web('Illinois 物理系原报道',uiNews)+'明确 University of Illinois 博后 1980–1981，另在 Southampton 和 Cambridge 做量子场论博后。'+web('Xianhao Xin 本人论文',xin)+'确认 Stone 是 Xin 的导师，供反向溯源。');
changeRow(stone,'Cambridge DAMTP（1976），论文导师待核','Southampton、Cambridge、UIUC（1980–1981），指导者待核',web('Illinois 物理系历任原档',uiNews));
audit(stone,{phd:['unresolved','Illinois 物理系原报道与凝聚态理论中心档确认 1976 Cambridge DAMTP 博士，未列导师。',[uiNews,ui]],postdoc:['unresolved','Illinois 物理系原报道确认 Southampton、Cambridge 后到 UIUC 博后，最后阶段 1980–1981。未具名指导者。',[uiNews]]},'按 Cambridge DAMTP 1976 学位及三项任职的历史名录续查；Xianhao Xin 论文证据只用于反向学生关系。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_八校阶段证据续核';
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
