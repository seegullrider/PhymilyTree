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
 a.audit_id='20261110_'+id+'_penn_washu_original_1151';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_penn_washu_original_1151_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const p=["https://curf.upenn.edu/profile/andrea-liu","https://www.viper.upenn.edu/people/andrew-m-rappe","https://almanac.upenn.edu/articles/bo-zhen-2026-optica-fellow","https://live-sas-physics.pantheon.sas.upenn.edu/sites/default/files/2023-07/KatiforiCV2023.pdf","https://curf.upenn.edu/profile/liang-wu","https://physics.gatech.edu/event/school-physics-fall-colloquium-series-dr-paulo-arratia","https://viest.upenn.edu/people/samantha-mcbride","https://viest.upenn.edu/people/saurabh-nath","https://viest.upenn.edu/people/thomas-e-mallouk","https://bpb-us-w2.wpmucdn.com/web.sas.upenn.edu/dist/e/1030/files/2026/02/CV-2026-02-Home-page.pdf"], w=["https://chemistry.washu.edu/people/bryce-sadtler","https://mcss.washu.edu/people/chong-zu","https://physics.washu.edu/people/chuanwei-zhang","https://www.jiaogroup.org/_files/ugd/32209b_be6873725f834fdbbee34af3687c30a7.pdf","https://source.washu.edu/2017/10/barnes-named-packard-fellow/","https://physics.washu.edu/news/memory-kenneth-kelton","https://engineering.washu.edu/faculty/Mark-Lawrence.html","https://engineering.washu.edu/faculty/Srikanth-Singamaneni.html","https://physics.washu.edu/people/stuart-solin-0","https://physics.washu.edu/people/zohar-nussinov"], x=["https://web.sas.upenn.edu/katifori/people/bio/","https://mtlsites.mit.edu/sites/default/files/media/documents/2023/marc2023.pdf","https://web.sas.upenn.edu/mallouk-lab/files/2019/11/c7cs00290d.pdf","https://www.smcbridelab.com/team","https://www.hajim.rochester.edu/optics/news-events/colloquia/2017/2017-01-04_bo-zhen.html","https://repository.gatech.edu/server/api/core/bitstreams/3d108165-915b-4dc0-84a0-05e55336c379/content","https://chemistry.washu.edu/media/1845/download?attachment=","https://iiis.tsinghua.edu.cn/info/1044/1712.htm","https://lsrf.org/alumni-fellows/","https://www.physics.purdue.edu/alumni/distalum/solin.html","https://homes.lorentz.leidenuniv.nl/~saarloos/People/formers%2Bp.html","https://live-sas-physics.pantheon.sas.upenn.edu/sites/default/files/2022-09/CV_LiangWu_Upenn%20copy.pdf","https://www.hajim.rochester.edu/optics/news-events/colloquia/archives/2017/2017-01-04_bo-zhen.html","https://physics.berkeley.edu/node/2498"], y=["https://repository.gatech.edu/bitstreams/3d108165-915b-4dc0-84a0-05e55336c379/download","https://bpb-us-w2.wpmucdn.com/web.sas.upenn.edu/dist/2/579/files/2019/11/c7cs00290d.pdf","https://datascience.sas.upenn.edu/people/eleni-katifori","https://sur.rockefeller.edu/laboratory-members/","https://varanasi.mit.edu/user/saurabhn/","https://fluids.brown.edu/seminars/past-seminars","https://cbe.rpi.edu/sites/default/files/speaker-files/2023/2.15.23%20Samantha%20McBride.pdf","https://profiles.utdallas.edu/chuanwei.zhang","https://raizenlab.ph.utexas.edu/people/former_members.html"], z=["https://www.mtl.mit.edu/sites/default/files/media/documents/2023/marc2023.pdf","https://mtlsites.mit.edu/sites/default/files/media/documents/2025/marc2025_0.pdf","https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=9853&profileversion=full","https://profiles.stanford.edu/steven-kivelson?tab=bio","https://news.mit.edu/2016/faculty-highlight-alexie-kolpak-0406","https://physics.washu.edu/people/kelton_kenneth-f"], q=["https://www.mtu.edu/epssi/seminar/2025/","https://www.ece.uw.edu/colloquia/nanophotonics-in-systems-of-large-sizes/","https://repository.gatech.edu/server/api/core/bitstreams/3d108165-915b-4dc0-84a0-05e55336c379","https://engineering.washu.edu/news/magazine/2016-fall/The-power-of-small.html","https://siteman.washu.edu/providers/srikanth-singamaneni/"], s=["https://materials.physics.wustl.edu/Kelton/","https://spaepen.seas.harvard.edu/publications","https://www.atualumni.com/s/978/bp24/interior.aspx?gid=1&pgid=1801&sid=978","https://chemistry.washu.edu/people/jonathan-barnes","https://publichealth.washu.edu/faculty/feng-jiao/","https://curf.upenn.edu/profile/eleni-katifori"];
const [and,rap,bo,kat,li,arr,mc,na,ma,lia,sa,zu,zh,ji,ba,ke,la,si,so,nu]=["32a7d0bd","87442b04","b91f4744","1523d404","e19c3e62","f533311d","7a330761","56391320","e1c06c4e","4d827cba","e9c4444e","7aa15385","f9b2de2c","cb1ae655","f1b7f760","f5a0922e","63f13ad1","fc6df0c2","a714921d","56ad1b94"];
const u=(label,url)=>web(label,url)+'。';
function previous(id,field,proof,urls){
 const a=JSON.parse(latest.get(id).details_json).aspects[field];
 return [a.status,a.note+' '+proof,urls];
}
function save(id,proof,phd,post,aspects,next){
 note(id,'- 核查边界：',proof);
 changeRow(id,phd,post,proof);
 return audit(id,aspects,next);
}
function rowAffiliation(id,old,newText){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  if(!l.includes(old))throw Error('affiliation not found '+id);
  return l.replace(old,newText);
 });
}
const andF='Penn CURF 院档核物理与天文项目的 Hepburn 物理教授及软物质、生命物理与 AI 交叉。既有 Cornell Fisher 博士及 Safran、Fredrickson 两段博后导师保留本人 CV 原证。';
save(and,u('Penn CURF 人物档',p[0])+andF,null,null,{
 affiliation:['confirmed',andF,[p[0]]],research:['confirmed',andF,[p[0]]]
},'待个人 CV 可读后复核 Exxon 及 UCSB 两段的起止和共同指导。');

const rapF='Penn VIPER 核化学、材料科学与工程双聘及铁电氧化物、表界面与催化。MIT 校刊核 1992 博士在 Joannopoulos 指导下完成，Berkeley Louie 实验室名单核 1992–1994 前博士后组属。';
const ra=save(rap,u('Penn VIPER 原档',p[1])+u('MIT 校刊',z[4])+u('Berkeley Louie 组原档',x[13])+rapF,null,'Berkeley 1992–1994，Steven G. Louie（博士后课题组负责人）',{
 affiliation:['confirmed',rapF,[p[1]]],research:['confirmed',rapF,[p[1]]],
 phd:previous(rap,'phd',rapF,[p[1],z[4]]),postdoc:['group_or_candidate',rapF,[p[1],x[13]]]
},'待 MIT DSpace 退避后核本人论文登记，查 Berkeley 博后本人指导职衔。');
relation(rap,'phd',local('cbedf46d'),'advisor','既有 MIT 学位目录列 advisor，MIT 校刊独立确认 Rappe 在 Joannopoulos 指导下完成 1992 博士。',[z[4],'https://dspace.mit.edu/entities/publication/5b22d598-c30c-4a93-8b23-54b7afbbcc2a'],ra,false);
relation(rap,'postdoc',local('3253eda8'),'group_leader','Berkeley Louie 组历任博后名单列 Andrew M. Rappe 1992–1994，Penn 履历独立确认机构和日期。',[p[1],x[13]],ra,false);

const boF='Penn 2026 校刊核物理与天文学副教授和拓扑光子、纳米光物质相互作用。Rochester 与 UW 的 2017 讲者档核 2014 MIT 物理博士，分别列 MIT Soljačić 与 Technion Segev 联合博士后。两组关系沿用本人履历，论文和正式指导字段待核。';
const boa=save(bo,u('Penn Almanac 校档',p[2])+u('Rochester 讲者原档',x[12])+u('UW 同期讲者原档',q[1])+boF,null,null,{
 affiliation:['confirmed',boF,[p[2]]],research:['confirmed',boF,[p[2],x[12]]],
 phd:previous(bo,'phd','两份 2017 报告核 2014 MIT 物理博士。',[x[12],q[1]]),postdoc:['group_or_candidate',boF,[x[12],q[1]]]
},'查 MIT 2014 物理论文及联合博士后正式指导职衔，保留早期 Hudson 组与后期 Soljačić 组。');
for(const mentor of [local('2141d845'),'师承人物 - Mordechai Segev'])
 relation(bo,'postdoc',mentor,'group_leader',boF,[x[12],q[1]],boa,false);

const katF='Penn Data Driven Discovery Initiative 原档核物理与天文学系。Rockefeller Magnasco 实验室原始名录将 2009–2010 客座研究与 2011 Sackler Fellow 分列，佐证 Rockefeller 博后阶段的组关联；既有本人 CV 的 2008–2012 任期与 David Nelson 博士导师保留。';
save(kat,u('Penn 校方项目档',y[2])+u('Rockefeller 实验室档',y[3])+katF,null,null,{
 affiliation:['confirmed',katF,[y[2]]],postdoc:previous(kat,'postdoc',katF,[y[3]])
},'继续核 Harvard 学位记录及 Rockefeller 的博士后任命、阶段个人指导。');

const liF='Penn CURF 本人院档核物理与天文学副教授。既有本人 CV 分列 N. Peter Armitage 博士导师和 Joseph W. Orenstein 博后导师，旧 CV 原址本轮不可读。';
save(li,u('Penn CURF 人物档',p[4])+liF,null,null,{affiliation:['confirmed',liF,[p[4]]]},'追 Johns Hopkins 原学位档及 Berkeley 原聘任，现有人物 CV 的分阶段标签保留。');

const arrF='Georgia Tech 物理系本人讲座档明确 Rutgers 2003 博士、Haverford 物理系 2003–2005 博后及 Penn 2005–2007 博后，核 Penn 机械工程与应用力学、化学与生物分子工程双聘，以及黏弹性流动、胶体和活性流体。';
save(arr,u('Georgia Tech 物理讲座原档',p[5])+arrF,null,'Haverford 2003–2005、Penn 2005–2007；Gollub、Durian 按原 CV 分别标博士后研究师长',{
 affiliation:['confirmed',arrF,[p[5]]],research:['confirmed',arrF,[p[5]]],
 phd:previous(arr,'phd',arrF,[p[5]]),postdoc:previous(arr,'postdoc',arrF,[p[5]])
},'查 Rutgers 论文以核两份 CV 的共同博士导师字段，查两段博后具体个人指导职衔。');

const mcF='Penn Vagelos 原档核机械工程，研究软物质流体与界面；本人组页核 MIT 机械博士、Princeton Presidential Postdoctoral Fellow、2024 Penn 入职。此前 Stone 的项目 advisor 和组属保留；博士正式论文栏待核。';
save(mc,u('Penn Vagelos 院档',p[6])+u('本人实验室履历',x[3])+mcF,null,'Princeton Presidential Postdoctoral Fellow；Howard A. Stone（课题组负责人及项目指导）',{
 affiliation:['confirmed',mcF,[p[6],x[3]]],research:['confirmed',mcF,[p[6],x[3]]],
 phd:previous(mc,'phd',mcF,[x[3]]),postdoc:previous(mc,'postdoc',mcF,[x[3]])
},'查 MIT 论文与 Princeton fellowship 任命原件，分别核 Varanasi、Stone 的正式职衔。');

const naF='Penn Vagelos 院档核物理助理教授和液滴、冰、复杂界面与软凝聚态。MIT 会议年册检索定位 Varanasi 指导条目，PDF 两个原址均超工具限额，旧 Brown 页本轮缺正文；维持既有两位博士后阶段师长，待取得直接原件。';
save(na,u('Penn Vagelos 原档',p[7])+naF,null,null,{
 affiliation:['confirmed',naF,[p[7]]],research:['confirmed',naF,[p[7]]]
},'定位 MIT MARC 2023 或 2025 会议摘要的单页可访问原件，分辨 Varanasi 博后监督和 Bush 阶段合作。');

const md='Mallouk 本人合著论文的作者简介明确 Berkeley 博士受 Neil Bartlett 指导，且将 MIT 与 Mark Wrighton 的博士后 fellowship 单列。博士关系按本人署名履历确定，博后原措辞为 with，保持阶段研究师长。';
const mf='Penn Vagelos 原档核化学系系主任、Vagelos 能源教授，研究无机纳米材料、半导体光电化学和能源转化。';
for(const id of [ma,'9e68c961']){
 const proof=u('本人合著 RSC 论文作者简介，第 2 页',y[1])+md;
 const maA=save(id,proof+u('Penn Vagelos 当前档',p[8])+mf,'Neil Bartlett（博士导师）','Mark S. Wrighton（MIT 博士后阶段研究师长）',{
  phd:['confirmed_advisor',md,[y[1]]],postdoc:['group_or_candidate',md,[y[1]]],
  affiliation:previous(id,'affiliation',mf,[p[8]]),research:previous(id,'research',mf,[p[8],y[1]])
 },'两校记录是同一人。查 Berkeley 论文原件与 MIT 博后具体起止和正式指导职衔。');
 const mentor='师承人物 - Neil Bartlett';
 replaceNoteLabel(id,'博士阶段研究师长','博士导师',mentor,' '+proof);
 replaceInverseLabel(mentor,id,'博士阶段研究者','博士生',' '+proof);
 replaceIndexLabel(id,mentor,'博士阶段研究师长','博士导师',' '+proof);
 for(const f of [fn(local(id)),fn(mentor),idx]){
  editLine(f,l=>l.includes('under the direction of Neil Bartlett；按阶段研究师长表述。')&&(f===fn(local(id))?l.startsWith('- 博士导师：'):l.includes('[['+local(id)+'|')),l=>l.replace('；按阶段研究师长表述。','。'));
 }
 editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),l=>l
  .replace('分别标博士和博士后阶段研究师长。','现分别标博士导师和博士后阶段研究师长。')
  .replace('分别标博士和博士后研究师长。','现分别标博士导师和博士后阶段研究师长。'));
 relation(id,'phd',mentor,'advisor',md,[y[1]],maA,false);
}

const ld='本人 2026 CV 第 1 页列 Penn 1993-12 物理化学博士，博士条目明确 Advisor Robin M. Hochstrasser。';
const lp='同页列 Berkeley 化学和 Lawrence Berkeley National Laboratory 1994-01–1996-07 博士后，明确 Advisor Charles B. Harris。另列 2025-09-01 加入 Penn 化学，Emory 历史任职按原 CV 保留。';
for(const id of [lia,'adff73f5']){
 const sa=save(id,u('本人 2026 CV 第 1 页',p[9])+ld+lp,'Robin M. Hochstrasser（Penn 1993 博士）','Charles B. Harris（Berkeley／LBNL 1994–1996 博后）',{
  phd:['confirmed_advisor',ld,[p[9]]],postdoc:['confirmed_advisor',lp,[p[9]]],
  affiliation:previous(id,'affiliation',lp,[p[9]]),
  research:['confirmed','本人 CV 核界面物理化学、纳米材料超快动力学和界面电子转移。',[p[9]]]
 },'本人与 Emory 和 Penn 两条为同人，两个阶段已具本人 CV 原证。后续仅在新增原档出现时复核任职及并行指导。');
 audits.at(-1).followup_required=false;
 for(const [stage,name,rev,proof] of [['phd','Robin M. Hochstrasser','博士生',ld],['postdoc','Charles B. Harris','博士后研究者',lp]]){
  const t='师承人物 - '+name;
  enrich(id,stage,t,rev,u('本人 2026 CV 第 1 页',p[9])+proof);
  relation(id,stage,t,'advisor',proof,[p[9]],sa,false);
 }
}

const sd='本人 2024 CV 第 1 页明列 2009 Berkeley 物理化学博士 Advisor A. Paul Alivisatos。';
const sp='同页将 Caltech 2009–2014 博后总经历的 Advisor 明列 Nathan S. Lewis，期间分列 Postdoctoral Scholar、Beckman Institute Scholar 及 Senior Scholar。';
const sf='WashU 化学原档核化学副教授，研究无机纳米结构的光驱动过程与成像。';
const sad=save(sa,u('本人 2024 CV',x[6])+u('WashU 化学档',w[0])+sd+sp+sf,null,null,{
 phd:['confirmed_advisor',sd,[x[6]]],postdoc:['confirmed_advisor',sp,[x[6]]],
 affiliation:['confirmed',sf,[w[0]]],research:['confirmed',sf,[w[0]]]
},'两个阶段导师均有本人 CV 原证。仅在有其他可靠原件时增量核共同指导。');
audits.at(-1).followup_required=false;
relation(sa,'phd',local('9209cf4f'),'advisor',sd,[x[6]],sad,false);
relation(sa,'postdoc','师承人物 - Nathan S. Lewis','advisor',sp,[x[6]],sad,false);

const zd='清华交叉信息研究院 2017 原始讲座档明确 2016 物理博士由 Luming Duan 指导，研究光子及 NV 色心。';
const zp='WashU 原档明列 Berkeley Norman Yao 组博后、2021 夏 WashU 物理入职，研究量子传感、量子多体及固态缺陷。';
const za=save(zu,u('清华交叉院原档',x[7])+u('WashU 机构档',w[1])+zd+zp,null,null,{
 phd:['confirmed_advisor',zd+' Fellowship 项目 supervisor 线索另列。',[x[7]]],postdoc:['group_or_candidate',zp,[w[1]]],
 affiliation:['confirmed',zp,[w[1]]],research:['confirmed',zp,[w[1],x[7]]]
},'查 Berkeley 博后聘任的个人指导职衔及 fellowship 项目导师角色。');
relation(zu,'phd','师承人物 - Luming Duan','advisor',zd,[x[7],w[1]],za,false);

const zhF='WashU 物理系及 UT Dallas 人事档核 2005 UT Austin 博士、Maryland 2006–2008 博后、WashU 2024 起任物理教授。Raizen 组校友表明确博士组属；Niu 与 Das Sarma 保持候选。研究超冷原子、拓扑材料与量子信息。';
save(zh,u('WashU 物理院档',w[2])+u('UT Dallas 人事原档',y[7])+u('Raizen 组校友档',y[8])+zhF,null,'Maryland 2006–2008 博后；Sankar Das Sarma（候选）',{
 affiliation:['confirmed',zhF,[w[2],y[7]]],research:['confirmed',zhF,[w[2],y[7]]],
 phd:previous(zh,'phd',zhF,[y[8],w[2]]),postdoc:previous(zh,'postdoc',zhF,[w[2],y[7]])
},'查 UT Austin 论文原件及 Maryland 人事指导原档，分别核 Niu 和 Raizen 博士角色与 Das Sarma 博后指导。');

const jd='本人 CV 第 1 页列 2004-01–2008-01 St Andrews 化学博士及 Advisor Peter G. Bruce。';
const jp='同一 CV 第 2 页列 2008-01–2010-08 LBNL 博士后及 Supervisor Heinz Frei。';
const jf='本人 CV 与公共卫生学院档核 WashU 能源、环境及化工主聘和公共卫生兼聘，研究电化学转化、能源储存和催化材料。';
const ja=save(ji,u('本人 CV 第 1–2 页',w[3])+u('WashU 公共卫生学院档',s[4])+jd+jp+jf,null,null,{
 phd:['confirmed_advisor',jd,[w[3]]],postdoc:['confirmed_advisor',jp,[w[3]]],
 affiliation:['confirmed',jf,[w[3],s[4]]],research:['confirmed',jf,[w[3],s[4]]]
},'两个阶段均有本人 CV 的直接称谓，院系已核；只做后续增量核对。');
audits.at(-1).followup_required=false;
relation(ji,'phd','师承人物 - Peter G. Bruce','advisor',jd,[w[3]],ja,false);
relation(ji,'postdoc','师承人物 - Heinz Frei','advisor',jp,[w[3]],ja,false);

const bf='WashU 当前院系档核化学副教授、刺激响应聚合物、水凝胶和超分子组装。WashU 原报道明称 Northwestern 的 Fraser Stoddart 为 doctoral adviser，后任 MIT fellow；保留 LSRF 既有 Jeremiah Johnson 博后 mentor，原名录本轮超时。';
const ban=save(ba,u('WashU 化学档',s[3])+u('WashU 原始报道',w[4])+bf,null,null,{
 affiliation:['confirmed',bf,[s[3]]],research:['confirmed',bf,[s[3],w[4]]],
 phd:['confirmed_advisor',bf,[w[4]]],postdoc:previous(ba,'postdoc',bf,[w[4],s[3]])
},'查 Northwestern 本人论文与 MIT 任命，核 Johnson 正式职衔。');
relation(ba,'phd','师承人物 - J. Fraser Stoddart','advisor','WashU 原始报道明确称 Northwestern 的 Fraser Stoddart 是 Barnes 的 doctoral adviser。',[w[4]],ban,false);

const kf='WashU 纪念档核 1985 入职、2025-10-28 去世、曾任物理系主任和材料所创始主任，研究准晶、金属玻璃、非晶相与成核。Harvard Spaepen 实验室出版原档核与 Kelton 的多篇同期合作，Arkansas Tech 校友原页跳转登录，博士导师继续标候选。';
save(ke,u('WashU 物理纪念档',w[5])+u('Harvard Spaepen 组出版档',s[1])+kf,null,null,{
 affiliation:['confirmed',kf,[w[5]]],research:['confirmed',kf,[w[5]]],
 phd:previous(ke,'phd',kf,[w[5],s[1]])
},'查 Harvard 1983 学位档及 1985 前博士后任命，复核学位及指导候选。');
rowAffiliation(ke,' | Physics；',' | Physics（历史，已故）；');

const lf='WashU 工学院原档明确 Birmingham 物理博士在 Shuang Zhang 指导下，Stanford 博后在 Jennifer Dionne 组；核 ESE 及纳米光子、超表面与光学器件。';
const lfa=save(la,u('WashU 工学院人物档',w[6])+lf,null,'Stanford Jennifer Dionne（博士后课题组负责人）',{
 phd:['confirmed_advisor',lf,[w[6]]],postdoc:['group_or_candidate',lf,[w[6]]],
 affiliation:['confirmed',lf,[w[6]]],research:['confirmed',lf,[w[6]]]
},'查 Stanford 博后正式指导称谓与 Birmingham 学位档。');
relation(la,'phd','师承人物 - Shuang Zhang','advisor',lf,[w[6]],lfa,false);
relation(la,'postdoc',local('fb3c4c3e'),'group_leader',lf,[w[6]],lfa,false);

const sif='WashU 工学院核机械工程与材料科学、表面增强 Raman 和纳米材料研究，2009 Georgia Tech 博士及 2010-01 WashU 入职。校刊称其博士阶段受 Tsukruk 指导；学位论文索引已定位，多个原地址不可读。Siteman 原档明确 2009–2010 Georgia Tech 博士后，个人指导与起止待核。';
save(si,u('WashU 工学院人物档',w[7])+u('WashU 校刊',q[3])+u('Siteman 履历',q[4])+sif,null,'Georgia Tech 2009–2010 博后；个人导师待核',{
 affiliation:['confirmed',sif,[w[7]]],research:['confirmed',sif,[w[7]]],
 phd:previous(si,'phd',sif,[q[3],w[7]]),postdoc:['unresolved',sif,[q[4],w[7]]]
},'找到可直接核读的 Georgia Tech 2009 学位签字页或权威元数据，核 Georgia Tech 博后个人指导及与 2010-01 入职衔接。');

const sof='WashU 物理院档核荣休和有序、无序固体与晶体 Raman；Purdue 原提名明确 1969 物理博士毕业即赴 Chicago 物理及 James Franck Institute 任助理教授，并明确跳过常规博士后。Ramdas 署名提名及旧合著支持候选追查，未明确博士导师。';
save(so,u('WashU 物理院档',w[8])+u('Purdue 提名原档',x[9])+sof,null,'1969 博士毕业即任 Chicago 助理教授；Purdue 原档明确未做常规博后',{
 affiliation:['confirmed',sof,[w[8],x[9]]],research:['confirmed',sof,[w[8],x[9]]],
 phd:previous(so,'phd',sof,[w[8],x[9]]),postdoc:['no_postdoc_documented',sof,[x[9]]]
},'查 Purdue 1969 学位论文签署页以确认 Ramdas 候选。');

const nf='WashU 物理院档核 UCLA 博士和凝聚态理论、玻璃、量子临界。Kivelson 本人 Stanford 档把 Nussinov 列在 Past Graduate Students，van Saarloos 原档另记 2000 UCLA 博士与 Kivelson、随后 Leiden 在 Zaanen 与 van Saarloos 两组，再赴 Los Alamos 博后。';
const nax=save(nu,u('WashU 物理院档',w[9])+u('Kivelson 本人 Stanford 档',z[3])+u('van Saarloos 原始历任成员页',x[10])+nf,null,'Leiden Jan Zaanen、Wim van Saarloos（博士后课题组负责人）；Los Alamos 博后个人待核',{
 phd:previous(nu,'phd',nf,[z[3],x[10]]),postdoc:previous(nu,'postdoc',nf,[x[10]]),
 affiliation:['confirmed',nf,[w[9]]],research:['confirmed',nf,[w[9],x[10]]]
},'查 UCLA 2000 论文或正式导师登记，查 Los Alamos 博后正式指导人。');
relation(nu,'phd',local('bc8048c4'),'stage_mentor',nf,[w[9],z[3],x[10]],nax,false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Penn与WashU院系和指导原档';
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
