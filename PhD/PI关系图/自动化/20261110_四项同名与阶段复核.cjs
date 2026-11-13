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
 a.audit_id='20261110_'+id+'_identity_and_departments_1005';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_identity_and_departments_1005_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const stein='ec1e35d8', wei='9c9be2a5', demir='a815dc5c', sills='987dbd8e', bren='41929a24', lin='abe3e413', wet='a9717297', wu='9e0468d5', sach='a4367696';
const phil='师承人物 - Philip W. Anderson', wee=local('d6ed5c69'), loh=local('97f3ca6a'), harris=local('5d4109a9'), miller='师承人物 - David A. B. Miller';
const nyu='https://math.nyu.edu/people/profiles/STEIN_Daniel.html', aps='https://www.aps.org/apsnews/2020/05/philip-anderson-19232020', alfred='https://www.alfred.edu/alfred_today/docs/fileauth.cfm?filename=36578_1.pdf';
const hms='https://bmiphd.hms.harvard.edu/people/daniel-stein', uncg='https://mathstats.uncg.edu/wei-chen-vivian-successfully-defended-her-ph-d-dissertation/';
const green='https://greenenergy.nus.edu.sg/our_team/academic-staff/wei-chen/', nus='https://nusgs.nus.edu.sg/thesis-advisors/chmcw', weiPub='https://chenweilab.com/publications';
const ds='https://volkan.bilkent.edu.tr/thesis.html', dbio='https://volkan.bilkent.edu.tr/biography.html', dp='https://repository.bilkent.edu.tr/bitstreams/df4d2959-e7d6-40b2-9653-c17185f326d4/download';
const sr='https://mse.rutgers.edu/ryan-sills', sg='https://micro.stanford.edu/wiki/Ryan_Sills', sGroup='https://micro.stanford.edu/mediawiki/index.php?redirect=no&title=Group_Members', iop='https://china.ioppublishing.org/news/msmse-qi-kan-gong-bu-2021-nian-qing-nian-ling-jun-ren-huo/';
const rb='https://www.rutchem.rutgers.edu/people/faculty/faculty-details/124-brennan-john', rbR='https://www.rutchem.rutgers.edu/research/faculty-research/125-brennan-john';
const uic='https://nlp.lab.uic.edu/news-stories/lin-chen-defends-his-phd-thesis-may-29-2014/', fl='https://sites.google.com/lbl.gov/fleming-group/group-members/alumni';
const cal='https://digitalcommons.calpoly.edu/theses/233/', wc='https://earth.yale.edu/sites/default/files/2024-07/Wettlaufer%20cv.pdf';
const wcv='https://wucj.lab.westlake.edu.cn/Appl/Wu_CV_2022_Feb.pdf', winst='https://its.westlake.edu.cn/info/1108/1260.htm';
const scv='https://sachdev.physics.harvard.edu/sites/g/files/omnuum12146/files/2026-05/cv_0.pdf', so='https://history.aip.org/catalog/icos/46897.html';

const si='Harvard 原始学生档为 2022 年进入生物信息学项目的 Daniel Stein，导师 Ilya Korsunsky；NYU 数学系与 Alfred 讲座履历核本人物是 1979 年 Princeton 物理博士、NYU 物理与数学教授。学位时期、院系与研究方向均不同。';
const st='APS 采访原文称 Daniel L. Stein 攻读博士时是 Anderson 的 protégé，NYU 原档确认其 1979 Princeton 物理博士。可明确博士阶段师长，学位论文登记的正式导师待核。';
const stProof=' '+web('APS 本人受访档',aps)+' · '+web('NYU 数学系原档',nyu)+'。'+st;
replaceNoteLabel(stein,'博士导师候选','博士阶段研究师长',phil,stProof);
replaceInverseLabel(phil,stein,'博士生候选','博士阶段研究者',stProof);
replaceIndexLabel(stein,phil,'博士导师候选','博士阶段研究师长',stProof);
note(stein,'- 核查边界：',web('APS 本人受访档',aps)+'。'+st+' '+web('Harvard 同名学生原档',hms)+'。'+si);
changeRow(stein,'Philip W. Anderson（APS 访谈核博士阶段师长）','Princeton 博士后经历或指导未明确',web('NYU 数学系原档',nyu)+' · '+web('APS 本人受访档',aps));
const sa=audit(stein,{identity:['confirmed',si,[nyu,alfred,hms]],phd:['group_or_candidate',st,[aps,nyu]],affiliation:['confirmed','NYU 数学系列物理及数学教授。',[nyu]],research:['confirmed','NYU 原档列理论凝聚态、统计物理、磁性材料与无序。',[nyu,alfred]]},'查 Princeton 1979 博士论文导师登记，以及 1979–1980 年间任职档。');
relation(stein,'phd',phil,'stage_mentor',st,[aps,nyu],sa,false);

const wi='UNCG 2018 院系答辩人为 Wei (Vivian) Chen，统计学论文研究随机过程的谱估计，导师为 Haimeng Zhang。NUS 本人 2004 化学博士，研究原子级界面工程，学位机构、年份及领域均不同。';
const wp='NUS 研究生院履历明列 2004–2006 物理系博士后、2006-07 至 2008-12 Lee Kuan Yew Research Fellow。本人实验室独立列 2004–2006 博后书目，同期多篇与 Andrew T. S. Wee 在界面方向合作。Wee 为低可信博后导师候选，任命或项目指导原档待查。';
const wProof=web('NUS 研究生院原档',nus)+' · '+web('本人按阶段书目',weiPub)+'。'+wp;
addEdge(wei,'博士后导师候选',wee,'Andrew Thye Shen Wee',wProof,null,true);
inverse(wei,wee,'博士后候选研究者',wProof);
note(wei,'- 核查边界：',wProof+' '+web('UNCG 同名答辩原档',uncg)+'。'+wi);
changeRow(wei,null,'NUS 物理系博后 2004–2006；Andrew T. S. Wee（低可信候选）；2006–2008 另有 Research Fellow',web('NUS 研究生院',nus)+' · '+web('本人分段书目',weiPub));
const wa=audit(wei,{identity:['confirmed',wi,[nus,green,uncg]],affiliation:['confirmed','NUS 化学及物理联聘。',[nus,green]],research:['confirmed','NUS 原档核二维材料与器件界面工程。',[nus,green]],postdoc:['group_or_candidate',wp,[nus,weiPub]]},'查物理系 2004–2006 博后任命与 Lee Kuan Yew fellowship 项目原档，单列指导者。');
relation(wei,'postdoc',wee,'candidate',wp,[nus,weiPub],wa);

const de='本人 Bilkent 学位页底部列 2004 年 8 月 Stanford 博士及两名 Co-advisors David A. B. Miller 与 James S. Harris, Jr.，与 2005 年 IEEE 作者简介交叉。本人 Bilkent 履历及同期作者简介列 2004 年 9 月起 Bilkent 教职，所阅未分列独立博士后。';
const dep=web('本人学位条目',ds)+' · '+web('IEEE 同期作者简介',dp)+'。'+de;
enrich(demir,'phd',miller,'博士生',dep);
enrich(demir,'phd',harris,'博士生',dep);
note(demir,'- 核查边界：',web('Bilkent 本人履历',dbio)+'。'+de);
changeRow(demir,'David A. B. Miller、James S. Harris Jr.（博士共同导师）','2004-09 起 Bilkent 教职；所阅未分列独立博后',web('本人学位条目',ds)+' · '+web('IEEE 同期作者简介',dp)+' · '+web('Bilkent 本人履历',dbio));
const da=audit(demir,{phd:['confirmed_advisor',de,[ds,dp]],postdoc:['no_postdoc_documented',de,[ds,dbio,dp]]},'查同年早期聘任及后续资助的任命性质；Bilkent 名录其余栏目是 Demir 指导的学位论文。');
relation(demir,'phd',miller,'advisor',de,[ds,dp],da,false);
relation(demir,'phd',harris,'advisor',de,[ds,dp],da,false);

const rE='Stanford Wei Cai 组个人页确认 2016 年 3 月机械工程博士，并链接 Rutgers；组名录确认前博士生。IOP 获奖者本人段列入职 Rutgers 前 9 年 Sandia Staff Member，职责包括工程、研究与项目 PI，所阅未分列博士后。该网页其他获奖者的博后说明不适用于 Sills。';
note(sills,'- 核查边界：',web('Stanford 个人页',sg)+' · '+web('IOP 本人条目',iop)+'。'+rE);
changeRow(sills,null,'Sandia 技术和科研岗位；所阅未分列独立博后',web('Stanford 课题组个人页',sg)+' · '+web('IOP 获奖人原页',iop));
audit(sills,{affiliation:['confirmed','Rutgers 材料科学与工程系副教授。',[sr]],research:['confirmed','Rutgers 现档核材料力学、多尺度模拟、位错介导塑性。',[sr]],phd:['group_or_candidate',rE,[sg,sGroup]],postdoc:['no_postdoc_documented',rE,[iop,sr]]},'查 Stanford 2016 博士论文登记，区分 Cai 的组负责人和正式学位论文导师；如有早期 Sandia 正式任命档再复核岗位。');

const be='Rutgers 化学系履历分列 1986 Berkeley 博士、1986–1987 NSF 博后及 1987–1989 Oxford E.P.A. Cephalosporin Junior Research Fellow。网页未指明 NSF 博后单位或两段指导者。Rutgers 研究页核无机材料、薄膜和纳米团簇方向。';
note(bren,'- 核查边界：',web('Rutgers 院系原档',rb)+'。'+be);
changeRow(bren,'Berkeley 1986；论文导师待核','1986–1987 NSF 博后（单位待核）；1987–1989 Oxford fellowship（指导待核）',web('Rutgers 院系原档',rb)+' · '+web('Rutgers 研究原档',rbR));
audit(bren,{phd:['unresolved',be,[rb]],postdoc:['unresolved',be,[rb]],affiliation:['confirmed','Rutgers 化学与化学生物学系。',[rb]],research:['confirmed','Rutgers 研究页核无机材料、薄膜、纳米团簇。',[rb,rbR]]},'查 Berkeley 论文馆藏、NSF 博后授予公报与 Oxford 任命档；Marquette 同名论文页本轮未取得原文。');

const li='UIC 计算机系 2014 博士答辩公告记 Lin Chen 为自然语言处理论文作者、导师 Barbara Di Eugenio；Fleming 原组名录明确 Northwestern／Argonne 的 Lin Chen 是 1983–1987 研究生，单位、学位时间与研究领域不同。';
note(lin,'- 核查边界：',web('UIC 同名答辩原档',uic)+' · '+web('Fleming 原组校友',fl)+'。'+li);
changeRow(lin,null,null,web('Fleming 原组校友',fl)+' · '+web('UIC 同名排查',uic));
const la=audit(lin,{identity:['confirmed',li,[fl,uic]]},'查 1987–1989 Berkeley 正式博后记录，区分 Strauss、Snyder 的指导职衔。');

const we='Cal Poly 目录中 Gabriel John Wettlaufer 是 2010 医疗设备报表验证方向硕士，Advisor Lily Laiho。Yale 本人 CV 对应 John S. Wettlaufer 1991 UW 博士，1991-09 至 2001-12 统列 UW 博后及后续教职，未分列博后结束时间及导师。';
note(wet,'- 核查边界：',web('Yale 本人 CV 第 1 页',wc)+' · '+web('Cal Poly 同名排查',cal)+'。'+we);
changeRow(wet,null,'1991-09 起 UW 博后，后转教职；博后指导待核',web('Yale 本人 CV 第 1 页',wc)+' · '+web('Cal Poly 同名排查',cal));
const xa=audit(wet,{identity:['confirmed',we,[wc,cal]],postdoc:['unresolved',we,[wc]]},'查 UW 1991 博士论文签署及 1991–2001 各段职位，三个博士候选保留。');

const wuE='Westlake 本人 2022 CV 分列 Stanford 博士导师 Zhang、此前 Illinois Advisor Fradkin、北大硕士 Advisor Zhao-Bin Su；2005-08 至 2007-06 UCSB KITP Postdoctoral Research Associate。2022 CV 该任期未列个人导师，保留旧版 CV 对 Fisher 与 Balents 的直接记录。Westlake 院系核目前全职物理及强关联、拓扑和冷原子研究。';
enrich(wu,'phd','师承人物 - Shou-Cheng Zhang','博士生',web('Westlake 本人 CV 第 1 页',wcv)+'。'+wuE);
note(wu,'- 核查边界：',web('本人 2022 CV',wcv)+' · '+web('Westlake 原档',winst)+'。'+wuE);
changeRow(wu,'Shou-Cheng Zhang（Stanford 博士）；Eduardo H. Fradkin（此前 Illinois 阶段）','Matthew Fisher、Leon Balents（旧本人 CV）；2005–2007 UCSB KITP',web('Westlake 本人 CV',wcv)+' · '+web('Westlake 原档',winst));
const wua=audit(wu,{phd:['confirmed_advisor',wuE,[wcv]],affiliation:['confirmed','UCSD 旧记录保留，2021 起 Westlake 物理全职。',[wcv,winst]],research:['confirmed','Westlake 院系核强关联、拓扑、冷原子与量子 Monte Carlo。',[winst]]},'保留旧 CV 指名的 KITP 双导师；可另查同期机构档；Westlake 不计入美国校属覆盖统计。');
relation(wu,'phd','师承人物 - Shou-Cheng Zhang','advisor',wuE,[wcv],wua,false);

const sch='Harvard 2026 本人 CV 明列 1985-09–1987-08 Bell Labs Postdoctoral Member of Technical Staff，Harvard 授位在 1985-11。AIP 访谈馆藏著录提及 Bert Halperin 的研究建议，未写 Bell Labs 博后指导身份。';
note(sach,'- 核查边界：',web('2026 本人 CV',scv)+' · '+web('AIP 访谈原始馆藏',so)+'。'+sch);
changeRow(sach,null,'1985-09–1987-08 Bell Labs 博后；指导者待核',web('2026 本人 CV',scv)+' · '+web('AIP 访谈馆藏',so));
audit(sach,{postdoc:['unresolved',sch,[scv,so]]},'查 Bell Labs 历史任命记录或完整本人访谈，区分个人研究建议与博后聘任导师。');

const excluded=[
 {page_id:'03b2671d4f9ead2f4d89415b',record_id:stein,url:hms,audit_id:sa,external_subject:'Daniel Stein（Harvard 生物信息学研究生）',evidence:si},
 {page_id:'69987829ab2572a06af63c2f',record_id:wei,url:uncg,audit_id:wa,external_subject:'Wei (Vivian) Chen（UNCG 统计学博士）',evidence:wi},
 {page_id:'e11767679218646b22e2d76f',record_id:lin,url:uic,audit_id:la,external_subject:'Lin Chen（UIC 自然语言处理博士）',evidence:li},
 {page_id:'93b15f2d0e77b2d265971a09',record_id:wet,url:cal,audit_id:xa,external_subject:'Gabriel John Wettlaufer（Cal Poly 医疗器械方向硕士）',evidence:we}
];


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_四项同名与阶段复核';
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
