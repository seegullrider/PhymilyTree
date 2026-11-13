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
 a.audit_id='20261110_'+id+'_michigan_original_1131';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_michigan_original_1131_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const orig=["https://che.engin.umich.edu/people/tuteja-anish/","https://lsa.umich.edu/physics/people/faculty/kurdak.html","https://kioupakisgroup.engin.umich.edu/pi","https://lsa.umich.edu/appliedphysics/people/faculty/guo.html","https://micde.umich.edu/member/liang-qi/","https://lsa.umich.edu/appliedphysics/people/faculty/mackkira.html","https://d-nb.info/107248594X/34","https://che.engin.umich.edu/people/ziff-robert/","https://regents.umich.edu/files/meetings/11-25/2025-11-VI-Merlin.pdf","https://mse.engin.umich.edu/people/smy/","https://che.engin.umich.edu/people/thomas-truskett/"];
const x=["https://lsa.umich.edu/appliedphysics/people/faculty/smy.html","https://ieeeaccess.ieee.org/editorial-team/guo-l-jay/","https://lsa.umich.edu/physics/people/faculty/merlin.html","https://jphysplus.wordpress.com/2016/10/21/i-most-like-problems-that-have-a-very-clear-answer-an-interview-with-professor-robert-ziff/","https://www.humboldt-foundation.de/en/connect/explore-the-humboldt-network/singleview/1207066","https://mie.uic.edu/events/novel-ice-shedding-surfaces/","https://truskettgroup.engin.umich.edu/wp-content/uploads/sites/699/2025/08/cv_truskett-full-1.pdf","https://acadsci.fi/wp-content/uploads/2016/05/mk_stenholm.pdf"];
const y=["https://archives.upenn.edu/wp-content/uploads/2018/04/commencement-program-1986.pdf","https://qstl.engin.umich.edu/people/","https://ece.engin.umich.edu/research/research-areas/optics-photonics/","https://www.humboldt-foundation.de/en/connect/explore-the-humboldt-network/singleview/1207066/%7B%7Bhref%7D%7D","https://case.fiu.edu/physics/seminars/_assets/seminar-flyers/cagliyan-kurdak-10092015-fiu-physics-colloquium.pdf"];
const z=["https://regents.umich.edu/files/meetings/05-25/2025-05-IV-1.pdf","https://deepblue.lib.umich.edu/bitstream/handle/2027.42/55959/495_ftp.pdf","https://news.engin.umich.edu/2025/09/nano-switch-achieves-first-directed-gated-flow-of-excitons/","https://news.engin.umich.edu/2023/11/nextgen-computing-hard-to-move-quasiparticles-glide-up-pyramid-edges/","https://www.academia.edu/113160557/Report_of_the_2014_NSF_CyberBridges_Workshop_on_Developing_the_Next_Generation_of_Cyberinfrastructure_Faculty_for_Computational_and_Data_enabled_Science_and_Engineering"];
const [tu,ku,ki,gu,qi,ka,fl,zi,me,ya,tr]=["e76f344b","ec648d7a","e4e0cf24","edded3c8","7d2e48ab","e973fa54","aa00e35a","e0afe5fd","f84c5ba6","ef253dfe","d3d4fa57"];
const u=(label,url)=>web(label,url)+'。';
const append=(id,field,status,proof,src)=>{
 const a=JSON.parse(latest.get(id).details_json).aspects[field];
 return [status||a.status,a.note+' '+proof,src];
};
function review(id,proof,phd,post,changes,next){
 note(id,'- 核查边界：',proof);
 changeRow(id,phd,post,proof);
 return audit(id,changes,next);
}
function enrichRole(id,target,label,reverse,proof){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+proof);
 mentorLine(target,id,'- '+reverse+'：',proof);
 indexLine(id,target,label,proof);
}
function affiliationLink(id,label,url,as){
 const target='已核实单位 - University of Michigan, Ann Arbor - '+label;
 note(id,'- 院系／机构：','[['+target+'|'+as+']]。');
 const file=path.join(root,'已核实院系',target+'.md');
 const r=records.get(id);
 editLine(file,l=>l.startsWith('仅收录已按'),l=>l+'\n- [['+r.filename+'|'+r.name+']] — '+web('来源',url)+(as===label?'':'（'+as+'）'));
}
const tuD='UIC 报告人原档明确 2006 Michigan State 化工与材料博士阶段与 Michael E. Mackay 工作。';
const tuP='UIC 原档明确博士后在 MIT 的 Robert E. Cohen 化工实验室和 Gareth H. McKinley 机械实验室研究；Michigan 院档也列 MIT 化工博士后任职。';
const tuF='Michigan 化工档列化工 courtesy，UIC 讲座档同时列材料、化工与高分子科学工程；研究拒油、拒冰界面与高分子纳米复合材料。';
const ta=review(tu,u('Michigan 化工档',orig[0])+u('UIC 报告人原档',x[5])+tuD+tuP+tuF,null,null,{
 phd:['group_or_candidate',tuD+' 原页称 working with，沿用博士阶段研究师长。',[x[5],orig[0]]],
 postdoc:['group_or_candidate',tuP+' 沿用博士后研究师长。',[x[5],orig[0]]],
 affiliation:['confirmed',tuF,[orig[0],x[5]]],
 research:['confirmed',tuF,[orig[0],x[5]]]
},'查 Michigan State 2006 学位论文签署页及 MIT 博后聘任原件，分开核实三位指导者的正式职衔。');
for(const [stage,target,label,reverse,proof] of [
 ['phd','师承人物 - Michael E. Mackay','博士阶段研究师长','博士阶段研究成员',tuD],
 ['postdoc','师承人物 - Robert E. Cohen','博士后研究师长','博士后阶段研究成员',tuP],
 ['postdoc','师承人物 - Gareth H. McKinley','博士后研究师长','博士后阶段研究成员',tuP]
]){
 enrichRole(tu,target,label,reverse,u('UIC 报告人原档',x[5])+proof);
 relation(tu,stage,target,'stage_mentor',proof,[x[5],orig[0]],ta,false);
}
const kuD='FIU 物理系报告原档核 1995 Princeton 电气工程博士、在 Berkeley 物理系任博士后、1998 入职 Michigan。Michigan 院档核低维输运与介观器件。';
review(ku,u('Michigan 物理档',orig[1])+u('FIU 物理系报告原档',y[4])+kuD,null,'UC Berkeley 物理系博后；John Clarke（博士后课题组负责人）',{
 phd:append(ku,'phd',null,kuD,[orig[1],y[4]]),
 postdoc:append(ku,'postdoc',null,kuD,[y[4]]),
 affiliation:append(ku,'affiliation',null,kuD,[orig[1],y[4]]),
 research:['confirmed',kuD,[orig[1],y[4]]]
},'继续查 Princeton 1995 论文签署页；待 eScholarship 退避后复核 Berkeley 同组论文。');
const kiD='本人组档分列 2008 Berkeley 物理博士（Louie group）、2008–2011 UCSB 材料博士后（Van de Walle group）及 2024–2025 EPFL 访问教授，Michigan 材料教授为现列主聘。';
const kia=review(ki,u('Michigan 本人组档',orig[2])+kiD,null,null,{
 phd:append(ki,'phd',null,kiD,[orig[2]]),postdoc:append(ki,'postdoc',null,kiD,[orig[2]]),
 affiliation:append(ki,'affiliation',null,kiD,[orig[2]])
},'查 Berkeley 2008 学位论文、本人 CV 及 UCSB 博后聘任。个人 advisor 与已证实的组属分开。');
const vdw=local('6a28e8b5');
enrichRole(ki,vdw,'博士后课题组负责人','博士后课题组成员',u('Michigan 本人组档',orig[2])+kiD);
relation(ki,'postdoc',vdw,'group_leader',kiD,[orig[2],'https://vandewalle.materials.ucsb.edu/people'],kia,false);
const guF='Michigan 应用物理档核 EECS 主聘，机械工程、高分子科学与工程、应用物理三处兼任；研究纳米光子、等离激元、光电子及纳米压印。校董文书另核 1997 Minnesota 电气工程博士，后任 Princeton Research Associate，1999 加入 Michigan，2025 任高分子项目主任。';
const guOld='https://ieeeaccess.ieee.org/editorial-team/guo-l-jay/';
for(const [dir,names] of [['已核实院系',['应用物理','机械工程系','电气工程与计算机科学系','高分子科学与工程'].map(n=>'已核实单位 - University of Michigan, Ann Arbor - '+n)],['已核实方向',['光电子学','纳米光子学','纳米制造'].map(n=>'已核实方向 - '+n)]]){
 for(const n of names)editLine(path.join(root,dir,n+'.md'),l=>l.includes('[['+local(gu)+'|')&&l.includes(guOld),l=>l.replace(guOld,orig[3]));
}
editLine(fn(local(gu)),l=>l.includes(guOld),l=>l.replaceAll(guOld,orig[3]));
editLine(path.join(root,records.get(gu).unit+'逐人复核记录.md'),l=>l.startsWith('| [['+local(gu)+'|'),l=>l.replace(guOld,orig[3]));
review(gu,u('Michigan 应用物理档',orig[3])+u('Michigan 校董文书',z[0])+guF,null,'Princeton Research Associate；是否为正式博士后聘任及个人指导待核',{
 phd:append(gu,'phd',null,guF,[z[0]]),postdoc:['unresolved','校董文书只列 Princeton Research Associate；正式聘任类别与个人指导待核。',[z[0]]],
 affiliation:['confirmed',guF,[orig[3],z[0]]],research:['confirmed',guF,[orig[3],z[0]]]
},'查 1997 Minnesota 论文题名及签署页，再查 Princeton Research Associate 的原始职衔及指导安排。');
const qiF='Michigan 计算研究所原档核材料科学与工程系副教授，研究合金变形缺陷、界面、相变与化学退化，使用第一性原理、原子模拟及多尺度建模。Ju Li 在两阶段的既有明确记录保留。';
review(qi,u('Michigan 计算研究所',orig[4])+qiF,null,null,{
 affiliation:['confirmed',qiF,[orig[4]]],research:['confirmed',qiF,[orig[4]]]
},'如有新增材料，区分 Penn 与 MIT 博后具体分段；保留 Ju Li 本人 CV 的两阶段角色。');
const kaF='Michigan 原档列 EECS 与物理教授及应用物理项目、1996 Helsinki University of Technology 博士；芬兰科学院原刊明确 Kira 是 Stenholm 的博士论文学生，列 1995。继续保留两种年份。';
const kaa=review(ka,u('Michigan 应用物理档',orig[5])+u('芬兰科学院原刊 pp.147–148',x[7])+kaF,null,null,{
 affiliation:['confirmed',kaF,[orig[5]]],research:['confirmed','Michigan 原档核半导体量子光学、凝聚态理论、多体效应及太赫兹。',[orig[5]]],
 phd:append(ka,'phd','confirmed_advisor',kaF,[x[7],orig[5]])
},'定位 Helsinki University of Technology 学位档案核对答辩与授位年份，并查 Koch 博士后阶段的原始任命。');
relation(ka,'phd','师承人物 - Stig Stenholm','advisor',kaF,[x[7],orig[5]],kaa,false);
const flD='德国国家图书馆 2015 H 06 卷印刷第 36 页明列 2014 Bremen 论文“Licht-Materie-Wechselwirkung in Halbleiter-Nanostrukturen zur Erzeugung nichtklassischen Lichts und stimulierter Emission”，Frank Jahnke 同时为审阅人与 Betreuer。Tim Wehling 单列审阅人。';
const flF='Michigan 工程校刊在 2023 年及 2025 年两次明确 Florian 为 EECS 电气与计算机工程 Research Investigator，2023 年报道明确在 Kira 领导下研究。基金会博士后接待记录另列，2025 年以后现任职及独立 PI 资格尚待核。';
affiliationLink(fl,'电气工程与计算机科学系',z[2],'电气工程与计算机科学系（Research Investigator，校刊核至 2025）');
editLine(path.join(root,records.get(fl).unit+'逐人复核记录.md'),l=>l.startsWith('| [['+local(fl)+'|'),l=>l.replace('电气工程与计算机科学系（历史博士后）','电气工程与计算机科学系（历史博士后；Research Investigator 核至 2025）'));
const fla=review(fl,u('德国国家图书馆第 36 页',orig[6])+u('Michigan 2023 校刊',z[3])+u('Michigan 2025 校刊',z[2])+flD+flF,null,null,{
 affiliation:['confirmed',flF,[z[3],z[2]]],research:append(fl,'research','confirmed','Michigan 原刊核半导体激子输运、光电开关。',[z[3],z[2]]),
 phd:['confirmed_advisor',flD,[orig[6]]],postdoc:append(fl,'postdoc','group_or_candidate',flF,[z[3],z[2]])
},'找 2021 博士后资助档案可读替代地址，分开核实 Kira 接待关系与 Research Investigator 阶段负责人，查现任机构和独立资格。');
enrich(fl,'phd','师承人物 - Frank Jahnke','博士生',u('德国国家图书馆第 36 页',orig[6])+flD);
relation(fl,'phd','师承人物 - Frank Jahnke','advisor',flD,[orig[6]],fla,false);
const ziF='Michigan 化工档核 1976 Rockefeller 统计物理博士；1976–1978 Los Alamos 低温物理实验室博后及 1978–1982 Stony Brook 机械工程和化学博后分列。本人访谈明确后一段与 George Stell 工作。Michigan 化工、高分子及复杂系统任职与统计物理、渗流方向均获核。';
const zia=review(zi,u('Michigan 化工档',orig[7])+u('Ziff 本人访谈',x[3])+ziF,null,'1976–1978 Los Alamos（个人待核）；1978–1982 Stony Brook，George Stell（博士后研究师长）',{
 phd:append(zi,'phd',null,'本人访谈列与 Uhlenbeck、Kac、Cohen 共同研究。',[x[3],orig[7]]),postdoc:append(zi,'postdoc',null,ziF,[x[3],orig[7]]),
 affiliation:['confirmed',ziF,[orig[7]]],research:['confirmed',ziF,[orig[7],x[3]]]
},'查 Rockefeller 博士论文签署页、Los Alamos 低温实验室 1976–1978 年报和 Stony Brook 博后档案。');
relation(zi,'postdoc','师承人物 - George Stell','stage_mentor',ziF,[x[3],orig[7]],zia,false);
const meF='Michigan 校董会 2025 年文书授予物理荣休称号，另核 1978 Stuttgart 博士、毕业后 UIUC 博后直至 1980 年加入 Michigan，2000 年 EECS 另聘。荣休文书并未另列 EECS 现职称号。';
review(me,u('Michigan 校董会荣休文书',orig[8])+meF,null,'UIUC 1978–1980，Miles V. Klein（博士后课题组负责人）',{
 affiliation:['confirmed',meF,[orig[8]]],research:append(me,'research','confirmed','校董文书核凝聚态及光学、负折射率介质和受激 Raman。',[orig[8]]),
 phd:append(me,'phd',null,meF,[orig[8]]),postdoc:append(me,'postdoc',null,meF,[orig[8]])
},'保留物理院档既有 Cardona 博士导师、Klein 博士后组记录；待查原论文及 UIUC 职位原证。');
editLine(path.join(root,records.get(me).unit+'逐人复核记录.md'),l=>l.startsWith('| [['+local(me)+'|'),l=>l.replace(' | 物理系、电气工程与计算机科学系；',' | 物理系（荣休）、电气工程与计算机科学系（历史兼聘）；'));
const yaF='Michigan 应用物理项目师资页确认材料系教授，研究表面界面、外延薄膜和超快激光，明确 1987–1989 AT&T Bell Laboratories 博后。该页仍列 Penn 材料博士 1983，和既有 1986 左右线索冲突；1986 Penn 毕业典礼原档本轮超时。';
affiliationLink(ya,'应用物理',x[0],'应用物理（项目师资）');
review(ya,u('Michigan 应用物理师资原档',x[0])+yaF,null,'AT&T Bell Laboratories 1987–1989；Raymond T. Tung（博士后导师候选）',{
 affiliation:['confirmed',yaF,[x[0]]],research:['confirmed',yaF,[x[0]]],
 phd:append(ya,'phd',null,yaF,[x[0]]),postdoc:append(ya,'postdoc',null,yaF,[x[0]])
},'查 Penn 1986 毕业典礼及学位论文目录；查 1987–1989 Bell Labs 任命原件，区分合作与指导。');
editLine(path.join(root,records.get(ya).unit+'逐人复核记录.md'),l=>l.startsWith('| [['+local(ya)+'|'),l=>l.replace('材料科学与工程系、超快光学科学中心；','材料科学与工程系、应用物理（项目师资）、超快光学科学中心；'));
const trF='Michigan 化工原档核 2001 Princeton 化工博士、2001–2002 UCSF 生物物理组 Postdoctoral Fellow，2025 年开始 Michigan 化工教授，UT 全职化工与物理教授条目在 2025 年结束。既有 UT 兼职校历线索另保留。研究为软凝聚态统计力学、胶体和分子流体。';
review(tr,u('Michigan 化工原档',orig[10])+trF,null,'UCSF 生物物理组 2001–2002；Kenneth A. Dill（博士后课题组负责人）',{
 affiliation:['confirmed',trF,[orig[10]]],research:['confirmed',trF,[orig[10]]],
 phd:append(tr,'phd',null,trF,[orig[10]]),postdoc:append(tr,'postdoc',null,trF,[orig[10]])
},'查 Princeton 原学位档或 Debenedetti 本人文章完整可读副本，核两条校属记录的博士关系标签。再核 Dill 博后个人指导。');
const mar='921d9b34',marUrl='https://www.faculty.uci.edu/profile/?facultyId=2716';
const marF='UCI 本人履历核 Bristol 1957 博士，随后四年在 Maryland 先后任博士后和助理研究教授，继而五年 Westinghouse，1965 入职 UCI。Maryland 两岗位分界和个人指导待核。';
review(mar,u('UCI 本人原履历',marUrl)+marF,null,'Maryland 博士后；后任助理研究教授，个人导师待核',{
 phd:append(mar,'phd',null,marF,[marUrl]),postdoc:append(mar,'postdoc',null,marF,[marUrl]),
 affiliation:append(mar,'affiliation',null,marF,[marUrl])
},'查 Bristol 1957 学位目录及 Maryland 早期聘任档案。');
const stone='f996c949',wrong='https://econ.uconn.edu/2010/07/05/michael-stone-defends-thesis-and-heads-to-quinnipiac-university/';
const stoneF='UConn 2010 原报道核同名经济学博士的论文题为 Three Essays on the Economics of Tort Law，导师 Thomas Miceli，去向 Quinnipiac。Illinois 物理系档所记本库人物为 1976 Cambridge 物理博士。两人排除同一身份。';
const sta=review(stone,u('UConn 同名者原页',wrong)+stoneF,null,null,{
 affiliation:append(stone,'affiliation',null,stoneF,['https://physics.illinois.edu/news/34304'])
},'按 Illinois 原档核 Cambridge 1976 学位及 Southampton、Cambridge、Illinois 三段博士后。排除 UConn 经济学同名结果。');
const excluded=[{page_id:'a9905614435bc8eeb34d92c0',record_id:stone,audit_id:sta,url:wrong,external_subject:'Michael Stone，UConn 经济学博士，后任 Quinnipiac 教职',evidence:stoneF}];

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Michigan院系与阶段原档';
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

const identityFile=stamp+'_身份排除.json';
fs.writeFileSync(identityFile,JSON.stringify(excluded,null,2)+'\n','utf8');
console.log(execFileSync(process.execPath,['--no-warnings','人物网页身份纠偏.cjs',identityFile],{encoding:'utf8'}).trim());
