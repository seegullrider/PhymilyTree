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
 a.audit_id='20261110_'+id+'_ideals_original_0906';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_ideals_original_0906_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const y='386f97e0', k='8551310f', j='b66fe393', g='32fcee46', p='2dab8ba9', w='4ae6722b', n='3e4d951e', l='00df85d9', a='dff565f5', s='8f4c75ba', m='7add9bad';
const gil='人员 - UIUC - Matthew Gilbert - a6602068', abb='人员 - UIUC - Peter Abbamonte - c6c288cb', jin='师承人物 - Jian-Ming Jin', sei='师承人物 - David N. Seidman', ell='师承人物 - Stephen R. Elliott';
const native=handle=>'https://www.ideals.illinois.edu/oai-pmh?verb=GetRecord&metadataPrefix=native&identifier='+encodeURIComponent('oai:www.ideals.illinois.edu:'+handle);
const yi=native('2142/101471'), ki=native('2142/89271'), ji=native('2142/80732');
const yt='https://www.ideals.illinois.edu/items/107568/bitstreams/351001/data.pdf', yo='https://ece.osu.edu/people/kim.10017', yp='https://physics.osu.edu/people/kim.10017';
const ku='https://www.pa.ucla.edu/faculty-websites/kogar.html', ka='https://abbamonte.physics.illinois.edu/people-2/', ju='https://ece.utexas.edu/events/fast-solvers-electromagnetics-and-multiphysics-based-analysis-and-design-integrated-circuits';
const go='https://www.stonybrook.edu/mechanical-engineering/people/jie_gao_profile.html', gi='https://www.apam.columbia.edu/physics-math/about/resources/dissertation-index', gm='https://mst.elsevierpure.com/en/persons/jie-gao/', gq='https://cicasp.ehub.kyoto-u.ac.jp/sites/default/files/profile/files/CV_GAO%20Jie_202204_0.pdf';
const pc='https://sites.engineering.ucsb.edu/~petroff/Petroff_CV.html', pd='https://www.materials.ucsb.edu/people/directory', pr='https://www.osti.gov/servlets/purl/6635741', pn='https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/seidman-david.html';
const wc='https://www.physics.uci.edu/~wilsonho/CV/Wilson%20Ho-CV-1Jan2025.pdf';
const nu='https://phy.asu.edu/sites/g/files/litvpz476/files/2021-08/Fall%202021%20Colloquia%20Flyer-Nemanich.pdf', ns='https://www.chm.bris.ac.uk/pt/diamond/other-theses/Sun_asu_0010E_13547.pdf';
const lu='https://www.sutd.edu.sg/profile/desmond-loke/', li='https://www.sutd.edu.sg/technical-release-listing/how-curiosity-sparked-pioneering-research/', lp='https://api.repository.cam.ac.uk/server/api/core/bitstreams/53ee8a4b-33d4-4a18-8ab4-0f81c91ac33e/content';
const au='https://nusgs.nus.edu.sg/thesis-advisors/aavsar', ae='https://actu.epfl.ch/news/a-new-2d-magnet-draws-future-devices-closer/';
const sc='https://lapt.ece.northwestern.edu/selim/shahriar_cv.pdf', sf='https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/shahriar-selim.html', sp='https://physics.northwestern.edu/people/faculty/affiliated-faculty/selim-shahriar.html';
const mc='https://engineering.nyu.edu/sites/default/files/2026-04/Mananga_CV_2026_APS.pdf', mu='https://engineering.nyu.edu/faculty/eugene-stephane-mananga';
const ok=(e,urls)=>['confirmed',e,urls];
function promote(id,mentor,oldForward,oldReverse,evidence,source){
 const proof=web('Illinois 学位原生元数据',source)+'。'+evidence;
 const rewrite=(line,oldLabel,newLabel)=>line.slice(0,line.lastIndexOf(']]。')+3).replace(oldLabel+'：',newLabel+'：')+proof;
 editLine(fn(local(id)),line=>line.startsWith('- '+oldForward+'：')&&line.includes('[['+mentor+'|'),line=>rewrite(line,oldForward,'博士导师'));
 editLine(fn(mentor),line=>line.startsWith('- '+oldReverse+'：')&&line.includes('[['+local(id)+'|'),line=>rewrite(line,oldReverse,'博士生'));
 editLine(idx,line=>line.startsWith('- [['+local(id)+'|')&&line.includes(' → '+oldForward+'：')&&line.includes('[['+mentor+'|'),line=>rewrite(line,oldForward,'博士导师'));
}
function addCandidate(id,stage,target,name,evidence,links,auditId,bio=null){
 const post=stage==='postdoc', reverse=post?'博士后候选研究者':'博士候选研究者';
 const proof=links.map(([title,url])=>web(title,url)).join(' · ')+'。'+evidence;
 addEdge(id,post?'博士后导师候选':'博士导师候选',target,name,proof,null,true);
 if(bio){
   newMentor(target,name,bio,id,reverse,proof);
 } else {
   editLine(fn(target),line=>/^## (师承|博士阶段师承|已核实关系)$/.test(line),line=>line+'\n\n- '+reverse+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
 }
 relation(id,stage,target,'candidate',evidence,links.map(([,url])=>url),auditId);
}
const ye='UIUC 2018 年电气与计算机工程博士档明确 Matthew J. Gilbert 同时位于 advisor 与 committeeChair 两个独立字段。论文致谢核其指导与组属。Ohio State 教师档学位及 IBM 经历相符。';
promote(y,gil,'博士候选课题组负责人及论文委员会主席','博士阶段课题组成员候选',ye,yi);
editLine(fn(local(y)),line=>line.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('本人博士论文原件',yt)+'与'+web('Illinois 馆藏原生字段',yi)+'核实身份和博士导师。'+web('Ohio State 院系原档',yo)+'列毕业后 IBM Research Staff Member，博后任命及个人指导者尚未查明。');
changeRow(y,'Matthew J. Gilbert（博士导师及委员会主席）','IBM Research Staff Member；独立博后待查',web('UIUC 原生学位记录',yi));
const ya=audit(y,{identity:ok('Ohio State 个人档与 Illinois 论文对应学位院系和研究方向，IBM 机构资料与后续经历一致。',[yo,yt,yi]),phd:['confirmed_advisor',ye,[yi,yt,yo]],postdoc:['unresolved','Ohio State 院系原档列 IBM 技术研究职务，未给出独立博后聘任。',[yo]],affiliation:ok('Ohio State ECE 原档列助理教授，物理系另有个人档。',[yo,yp]),research:ok('Ohio State ECE 原档列量子硬件与算法、器件噪声及纠错。',[yo])},'查 IBM 任职起止及毕业后的独立博后任命。');
relation(y,'phd',gil,'advisor',ye,[yi,yt,yo],ya,false);

const ke='UIUC 原生馆藏在 2015 年 M-EELS 论文记录中将 Peter M. Abbamonte 列为 advisor，S. Lance Cooper 另列 committeeChair。UCLA 院系明确 Kogar 的 Illinois 博士及同题研究。';
promote(k,abb,'博士阶段课题组负责人','博士阶段课题组成员',ke,ki);
editLine(fn(local(k)),line=>line.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('Illinois 原生馆藏',ki)+'核博士导师为 Abbamonte。'+web('UCLA 院系',ku)+'核 MIT 2016–2019 Gedik 组博后，个人正式导师待查。');
changeRow(k,'Peter M. Abbamonte（Illinois 原生学位记录）',null,web('Illinois 原生学位记录',ki));
const kaid=audit(k,{phd:['confirmed_advisor',ke,[ki,ku,ka]],postdoc:['group_or_candidate','UCLA 院系原档明确 Kogar 2016–2019 在 MIT Nuh Gedik 组开展博士后研究。',[ku]],affiliation:ok('UCLA 物理与天文原档核其自 2019 年任教。',[ku]),research:ok('UCLA 原档核 M-EELS、激子凝聚、电荷密度波和超快电子衍射。',[ku])},'继续查 MIT 博后任命或本人 CV 是否列 Gedik 为正式个人指导者。');
relation(k,'phd',abb,'advisor',ke,[ki,ku,ka],kaid,false);

const je='Illinois 2001 年电磁学论文原生记录指名 Jianming Jin 为 committeeChair。该记录未提供 advisor 字段。本人博士阶段组属及论文监督线索见 Jin 履历，继续保留组负责人标签。';
const jt=web('Illinois 学位原生记录',ji)+'。'+je;
editLine(fn(local(j)),line=>line.startsWith('- 博士阶段课题组负责人：'),line=>line+' '+jt);
mentorLine(jin,j,'- 博士阶段课题组成员：',jt);
indexLine(j,jin,'博士阶段课题组负责人',jt);
changeRow(j,'Jian-Ming Jin（博士课题组负责人及委员会主席）',null,web('Illinois 原生学位记录',ji));
const ja=audit(j,{phd:['group_or_candidate',je,[ji,ju]],postdoc:['no_postdoc_documented','UT Austin 系讲座列 2001 博士后直入 Intel CAD，2005 转 Purdue 教职。所阅履历未列独立博士后。',[ju]],affiliation:ok('UT Austin ECE 活动原档确认 Purdue ECE 任教。',[ju]),research:ok('该原档确认计算电磁、多物理、先进封装和高频集成电路。',[ju])},'查题页、致谢或学院签署档能否独立明确 advisor。');
relation(j,'phd',jin,'group_leader',je,[ji,ju,'https://jin.ece.illinois.edu/files/CV_JIN_2018.pdf'],ja,false);

note(g,'- 核查边界：',web('Kyoto 同名 CV',gq)+'涉及灵长类认知、中文名高洁，已核为不同人。'+web('Missouri S&T 原人事档',gm)+'确认本人的 Columbia 应用物理硕博及光子学。');
changeRow(g,null,null,web('Missouri S&T 历史院系档',gm));
audit(g,{identity:ok('Stony Brook、Missouri S&T 与 Columbia 学位题名、方向对应。Kyoto 同名 CV 属灵长类认知研究者高洁。',[go,gi,gm,gq]),affiliation:ok('Stony Brook 机械工程系原档与其 Missouri S&T 历史原档可交叉识别。',[go,gm]),research:ok('Stony Brook 原档列二维材料、光学纳米结构、光机与量子光学。',[go,gm])},'Columbia 论文目录明确 Wong／Osgood，论文旧 Handle cache miss；继续核 Osgood 全名与个人博后经历。');

const pe='UCSB 本人 CV 列 Cornell 材料系 1969–1971 博后。Seidman 的 Cornell DOE 报告书目列两人 1971 年及 1973 年合著，报告另载 Seidman 在 Cornell 材料系的单位。只登记 David N. Seidman 为低可信博后候选。';
const pa=audit(p,{postdoc:['group_or_candidate',pe,[pc,pr,pn]],affiliation:ok('UCSB 材料系名录列 Materials 与 ECE 双系荣休教授。',[pd,pc]),research:ok('本人 CV 列 III-V 分子束外延、自组装量子点及光谱表征。',[pc])},'查 Cornell 1969–1971 项目及聘任，Berkeley 论文待馆藏退避后追查。');
note(p,'- 核查边界：',web('UCSB 荣休原档',pd)+'确认 Materials 与 ECE。');
addCandidate(p,'postdoc',sei,'David N. Seidman',pe,[['UCSB 本人 CV',pc],['Cornell DOE 原报告',pr]],pa,web('Northwestern 本人院系档',pn)+'。Cornell DOE 报告记录其材料系研究与场离子显微。');
changeRow(p,null,'Cornell 1969–1971 博后；David N. Seidman 为低可信候选',web('UCSB 本人 CV',pc)+' · '+web('Cornell DOE 原报告',pr));

const we='UCI 2025 本人 CV 分列 Caltech 硕士论文导师 W. Henry Weinberg、Penn 物理博士论文导师 E. Ward Plummer、1979–1980 Bell Labs Member of Technical Staff 与 1980 起 Cornell 教职。已阅履历未列独立博后岗位。';
enrich(w,'phd','师承人物 - E. Ward Plummer','博士生',web('UCI 本人 2025 CV',wc)+'的博士栏再次核实导师。');
note(w,'- 核查边界：',web('UCI 本人 2025 CV',wc)+'。'+we);
changeRow(w,'E. Ward Plummer（Penn 博士论文）','Bell Labs 1979–1980 技术岗；所阅 CV 未列独立博士后',web('UCI 本人 2025 CV',wc));
audit(w,{phd:['confirmed_advisor','UCI 2025 CV 明列 E. Ward Plummer 为 Penn 博士论文导师，Weinberg 另属硕士。',[wc]],postdoc:['no_postdoc_documented',we,[wc]],affiliation:ok('CV 列 UCI Physics & Astronomy 与 Chemistry Distinguished Professor。',[wc])},'已有博士论文导师确证；若发现 Bell Labs 另行博后聘任资料再核。');

const ne='Tianyin Sun 的 ASU 2013 论文封面列 Robert Nemanich 为其委员会主席，致谢明称其 advisor。关系方向为 Nemanich 指导 Sun；Nemanich 本人的芝加哥博士导师仍待查。';
note(n,'- 核查边界：',web('Tianyin Sun 博士论文原件',ns)+'。'+ne);
changeRow(n,null,null,web('ASU 物理讲座履历',nu));
audit(n,{affiliation:ok('ASU 官方讲座原档列物理系 Regents’ Professor。',[nu]),research:ok('该讲座和所指导论文核电子材料、宽禁带半导体、表面及金刚石材料研究。',[nu,ns])},'保留 1976／1977 芝加哥博士日期差异；待本人学位档及 Xerox 首任岗位原件，Sun 论文不能作本人的师承。');

const le='SUTD 原人事档核 Loke 2008–2012 在 NUS ECE 和 Cambridge 化学系读博，列其 2012 年与 Stephen R. Elliott 合著；Cambridge 馆藏原文核两人同署 Cambridge 化学系的相变研究。Elliott 仅列 Cambridge 阶段低可信博士候选。';
const la=audit(l,{phd:['group_or_candidate',le,[lu,lp]],postdoc:['unresolved','SUTD 原人事档列 2013 SUTD/MIT 独立博士后资助，原访谈中本人明确在 MIT Koch Institute 做博后。另列 2014 Harvard 研究经历，性质与导师待核。',[lu,li]],affiliation:ok('SUTD 本人档列 Science, Mathematics and Technology 教职。',[lu]),research:ok('SUTD 本人档核相变材料、存储器件和神经形态计算。',[lu,li])},'按 NUS ECE 论文目录及 Cambridge 访学或联合培养档核博士导师；补 SUTD–MIT 资助接收单位及 Harvard 2014 任命。');
note(l,'- 核查边界：',web('SUTD 本人访谈',li)+'明确 MIT Koch Institute 博后。'+web('SUTD 人事原档',lu)+'分列独立博后资助及 Harvard 研究经历。');
addCandidate(l,'phd',ell,'Stephen R. Elliott',le,[['SUTD 原人事档',lu],['Cambridge 论文原稿',lp]],la);
changeRow(l,'NUS ECE、Cambridge 化学系博士阶段；Stephen R. Elliott 为 Cambridge 低可信候选','SUTD/MIT 独立博后、MIT Koch Institute；个人导师待查',web('SUTD 原访谈',li));

const ave='NUS 研究生院原档列 2016–2020 EPFL Fellow。EPFL 同期报道指名 Avsar 为 Andras Kis 实验室博士后；同一报道中 Yazyev 是联合成果的另一组负责人，不能据此记为 Avsar 导师。';
note(a,'- 核查边界：',web('EPFL 原报道',ae)+'。'+ave);
changeRow(a,null,'Andras Kis（EPFL 2016–2020 博后课题组负责人）',web('EPFL 原报道',ae));
audit(a,{postdoc:['group_or_candidate',ave,[au,ae]],affiliation:ok('NUS 研究生院列 MSE 助理教授及 NRF Fellow。',[au]),research:ok('NUS 官方档列二维材料、层状量子材料、磁性与自旋电子。',[au,ae])},'继续追查 NUS 博士论文或答辩原档，保留 Özyilmaz 候选。');

const se='Northwestern 本人 CV 分列 MIT 1989 硕士与 1992 博士，合作者栏称 Shaoul Ezekiel 为 Thesis Supervisor，未注明哪一学位。MIT RLE 档本轮超过网页读取尺寸上限，未取得上下文。';
note(s,'- 论文题名复核',web('本人 CV',sc)+'已直接核读分开的教育与合作者栏目。'+se);
changeRow(s,null,null,web('Northwestern 物理系原档',sp));
audit(s,{phd:['group_or_candidate',se,[sc]],affiliation:ok('Northwestern 物理系当前原档列 Professor / Joint with Electrical Engineering；本人 CV 旧任期字段分开保留。',[sp,sf,sc]),research:ok('Northwestern 工程档列量子光学、量子信息和原子精密测量。',[sf])},'查 MIT 博士签署以及硕士论文角色；主库退避期间用已知题名向其他原始档追查。');

const me='本人 2026 CV 合并列 Scientific Collaborations and Postdoctoral Supervisors，未逐名标明谁是合作人或正式博后导师。博士 Greenbaum 独立标在 Ph.D. Supervisor 栏。不能按该合并栏目直接提升 Cross、El Fakhri 或 Charpentier。';
note(m,'- 博士后阶段经历：',web('2026 本人 CV 第 11 页',mc)+'。'+me);
changeRow(m,null,null,web('本人 CV 第 11 页',mc+'#page=11'));
audit(m,{phd:['confirmed_advisor','本人 CV 独立列 Steven Greenbaum 为 Ph.D. Supervisor；NYU 人事档对应 CUNY 物理博士。',[mc,mu]],postdoc:['group_or_candidate',me,[mc,mu]],affiliation:ok('NYU Tandon 原档列应用物理兼职，并区分 CUNY 及 Brookhaven 职务。',[mu]),research:ok('NYU 本人档列凝聚态、材料、核磁与计算研究。',[mu,mc])},'逐段查 MagLab、CEA、Harvard／MGH 的明确个人指导原证，并区分后来 DOE 访问项目。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_IDEALS导师与多校核查';
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
