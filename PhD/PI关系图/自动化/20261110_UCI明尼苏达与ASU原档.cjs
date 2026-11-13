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
 a.audit_id='20261110_'+id+'_uci_mn_asu_1225';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_uci_mn_asu_1225_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const data=[["f232f519","https://www.faculty.uci.edu/profile/?facultyId=5442","Ph.D., University of California, Berkeley, 1971, Chemistry","UCI 院档列化学与生物分子工程、生物医学工程荣休；Michigan 材料院档也列荣休。","高分子、复合材料与微纳图案化。","核 1971 Berkeley 化学博士；论文致谢所记 George Jura 保留博士阶段研究师长。现有资料未确定独立博后。","查 Berkeley 学位签署、学位后岗位以及两校荣休任用的历史。"],["ff988990","https://eqi.uci.edu/sasha-chernyshev/","Professor of Physics & Astronomy","UCI 物理与天文学，电子量子材料研究所。","量子磁性、强关联磁性量子材料。","UCI 研究所原页确认身份和研究，保留 1995 博士信息，两阶段个人指导待查。","追俄罗斯科学院半导体物理研究所学位档和随后研究任职。"],["cd0f125d","https://cpb-us-e2.wpmucdn.com/faculty.sites.uci.edu/dist/f/680/files/2017/08/KW-CV-UCI-June-2017.pdf","Supervisor Professor Sir Eric A. Ash","UCI 现工程院档列电气工程与计算机科学荣休。2017 本人履历另列化工材料和生医岗位，按历史兼聘保留。","扫描探针显微、纳米尺度测量与近场光学。","本人履历明确 UCL 博士论文 Supervisor Sir Eric A. Ash；既有本人叙述明确 Rudi Kompfner 和 Cal Quate 博后导师。","进一步查两位博后指导的各自任期和机构。"],["f01e204d","https://bpb-us-e2.wpmucdn.com/sites.uci.edu/dist/e/1492/files/2024/01/Ragan.Regina.CV_-bca9fc458cf10e6e.pdf","Professor of Material Science and Engineering; Professor of Chemical and Biomolecular Engineering","本人 CV 确认 UCI 材料科学与工程及化学与生物分子工程。","自组装纳米材料、材料生长与光子器件。","Caltech 学位原档明确 Harry Albert Atwater；本人 CV 列 2002–2004 HP 研究任用，课题组旧主页称博后，个人指导待查。","追 HP Information & Quantum Systems Laboratory 的任用原档和博后导师。"],["e491e468","https://mukamel.ps.uci.edu/bio.html","2016-present Professor of Physics and Astronomy, University of California at Irvine","本人实验室履历核 UCI 化学与物理天文双聘。","非线性光谱、超快动力学、量子相干。","本人组档列 1976 Tel Aviv 博士及 1976–1977 MIT Research Associate。原本人自传的 MIT 博后与 Oppenheim、Ross 阶段研究师长分别保留。","查 Tel Aviv 论文签署及 MIT 聘任正式个人指导。"],["4b16000c","https://cpb-us-e2.wpmucdn.com/faculty.sites.uci.edu/dist/b/631/files/2016/11/grantcv.pdf","Thesis advisors: Professors John W. Wilkins and Kenneth G. Wilson; Supervisor: Douglas J. Scalapino","UCI 物理与天文学。","DMRG、张量网络、强关联量子多体。","本人 CV 第 1 页明列 Wilkins、Wilson 两位博士论文导师；分列 1987-09 Cornell 完成与 1988-01 授位，1987-10–1989-08 UCSB 博后 Supervisor Douglas J. Scalapino。","两阶段个人指导与日期已有明确原证。随任职与研究更新复查。"],["f6689256","https://engineering.uci.edu/directory/nam_sungwoo.php","SungWoo Nam","UCI 机械与航空航天工程。","低维范德华材料、应变与器件。","本人 CV 记 Harvard PhD 2011-03；Harvard Ham 组明确 Lieber 与 Ham 共同指导，Berkeley BSAC 明确 Luke P. Lee 为博后 Advisor。保留论文 2010 与授位 2011 的记录差异。","追 Harvard 博士论文提交和授位时间原档。"],["5586b23e","https://www.chem.uci.edu/people/william-j-evans","Distinguished Professor Emeritus","UCI 化学系明确荣休。","稀土和有机金属、分子磁性及量子信息材料。","ACS 获奖原档支持 Hawthorne 博士导师及 Cornell 与 Muetterties 的博后阶段关系。保留两种标签。","查 Cornell 博后任用原件或本人履历的正式指导职衔。"],["ab8c58db","https://scale.cems.umn.edu/people","C. Daniel Frisbie","Minnesota 化学工程与材料科学。","有机半导体、分子电子和薄膜器件。","学校 SCALE 项目核姓名和任职。Mark S. Wrighton 与 Charles M. Lieber 保留候选和合作线索，个人关系待学位与聘任证据。","MIT 馆藏退避结束后按队列核博士论文；追 Harvard 博后机构档。"],["f5d72779","https://cse.umn.edu/cems/frank-bates","Frank Bates","Minnesota 化学工程与材料科学，Regents Professor。","聚合物相行为、散射与动力学。","院档支持高分子方向和 Bell Labs 研究经历。Robert E. Cohen 保留博士候选；独立博士后及导师未确认。","MIT 学位馆藏退避结束后追论文签署；核 Bell Labs 初始岗位。"],["fc37087a","https://cse.umn.edu/chem/jihye-park","Postdoctoral Fellow: Stanford University, 2016 - 2019","Minnesota 化学系，2026 年由 Colorado Boulder 转任。","多孔电子材料、金属有机框架、纳米材料。","本人组档和 Bao 组原档复核 Hong-Cai Zhou 博士导师，Stanford 2016–2019 在 Zhenan Bao 实验室。","追 Stanford 个人博后指导正式称谓。"],["fbbf8618","https://cse.umn.edu/physics/jorge-vinals","Jorge Viñals","Minnesota 物理与天文学及健康信息研究所研究关联。","非平衡现象、软凝聚态及介观理论。","Minnesota 院所档核 1983 Barcelona 博士及 FSU、McGill、Minnesota 历任机构，两个阶段指导待原证。","追 Barcelona 学位题名与后续岗位，Gunton 仍为阶段未明线索。"],["fa1a7d3b","https://cse.umn.edu/chem/kade-head-marsden","PhD: Chemistry, University of Chicago, 2019; Postdoctorate: Harvard University, 2019-2022","Minnesota 化学，2022–2024 WashU 助理教授经历另列。","开放量子系统、量子动力学和电子结构计算。","院档核 2019 Chicago 博士及 2019–2022 Harvard 博后；Mazziotti 博士导师、Narang 博后组负责人保留。","查 Harvard 博后正式个人导师称谓。"],["e2f1dca4","https://cse.umn.edu/physics/ke-wang","Postdoctoral Fellow, Harvard University, 2014-2017","Minnesota 物理与天文学。","二维量子材料、电子输运及低维量子器件。","原页核 2014 Princeton 博士与 2014–2017 Harvard 博后。论文镜像再读仍 cache miss，Petta 和 Kim 保留阶段研究师长。","追 Princeton 学位原档及 Harvard 博后正式指导。"],["fb475ef0","https://stoerzinger.cems.umn.edu/people","Linus Pauling Postdoctoral Fellow, Pacific Northwest National Laboratory, 2016 - 2018","Minnesota 化学工程与材料科学。","电催化、氧化物表界面与原位光谱。","PNNL 原报道明确博士受 Yang Shao-Horn 指导，2016–2018 PNNL 博后与后续科研岗位分开。报道的 Teri Odom 和 Andrew Jardine 分别对应本科与硕士阶段。","追 PNNL 2016–2018 个人博后指导和聘任原档。"],["f8cbc819","https://ferry.cems.umn.edu/people/vivian-ferry","Postdoc, Lawrence Berkeley National Laboratory and University of California, Berkeley, 2011-2014","Minnesota 化学工程与材料科学。","纳米光学、材料结构与光伏。","本人组档核 2011 Caltech 博士、2011–2014 LBNL／Berkeley 博后；保留 Atwater 博士导师、Alivisatos 博后阶段研究师长。","查两机构博后正式个人导师字段。"],["fd488d82","https://engineering.asu.edu/faculty/","Alexandra Navrotsky, Regents Professors","ASU 工学院名录列 Regents Professor；UC Davis 原档另核历史任职。","固态材料、陶瓷及矿物热力学。","保留 Kleppa 博士导师、Schmalzried 的 Clausthal 博后导师；Penn State 后续阶段继续查。","查 Penn State 早期任用和个人指导，区分 ASU 现任及 Davis 历史关系。"],["eb5d441a","https://provost.asu.edu/sites/g/files/litvpz671/files/capc/1731/clas_physics_ba_physics.pdf","Professor Jeff Drucker, Ph.D.","ASU 教务处院系材料核物理教授旧记录，当前荣休沿用已有记录。","原档核材料物理和纳米科学，原有纳米结构生长方向保留。","历史院系记录确认身份。Hansma 博士候选、MIDAS 项目两位博士后候选保留。","等 ASU 个人资料站退避，核现职及 1987–1991 任期。继续追 UCSB 学位档和 MIDAS 正式指导。"],["754a6fd3","https://www.public.asu.edu/~msukhare/CV.pdf","Advisor: Professor Mikhail V. Fedorov; Co-advisor: Professor Vladimir P. Krainov","ASU Applied Sciences and Arts，物理研究生及工程研究生指导资格。","纳米光学、光物质相互作用、等离激元与相干控制。","本人 CV 第 1 页确认 Fedorov、Krainov 两位博士导师；2001–2003 Orsay 与 2003–2008 Northwestern 两段博后分别核日期。组负责人标签保留。","核两段博后指导人正式职衔及 2003 年两段之间的任职衔接。"],["ff96a893","https://news.engineering.asu.edu/2026/09/honoring-a-legacy-of-research-and-mentorship/","He joined ASU as a postdoctoral researcher in 2003","ASU 电气、计算机与能源工程历史任职，2026 校方纪念文确认已故。","半导体与微电子材料、器件和界面。","纪念文和院系自评分别核 RWTH 博士、Jülich 2001–2003 和 2005–2007、ASU 2003–2005 博后；原 Thornton 组及 Vescan 候选保留。","追 RWTH 学位原件、Jülich 两段个人指导及 ASU 博后正式职衔。"],["ffb517c7","https://physics.asu.edu/node/2200","Nicholas Matlis, Lasers, electrons and X-rays at CXFEL","ASU 物理系在 CXFEL 项目列研究与指导角色。","超快激光、THz 和材料动力学。","Downer 组原页明确 Nicholas Hill Matlis 2006 博士及 LBNL 博后 supervisor Wim Leemans，保留两阶段明确指导。","按现任与项目变化增量复核。"],["e9e398a6","https://asu.elsevierpure.com/en/persons/trevor-thornton/","Professor, Solid State Electronics Research Center","ASU 电气工程及固态电子研究中心。","纳米结构、SOI MESFET、分子电子与传感。","ASU 年度教学档核 Cambridge 1987 博士，保留 Pepper 候选和 Roukes 组关系。Cavendish 与 Bell 岗位类型和任期仍待正式任用档对照。","等受限个人资料站退避后对照日期，追 Cambridge 学位与两处聘任原档。"],["09fe5903","https://experts.azregents.edu/en/persons/hugh-barnaby/","Professor, Arizona State University, Electrical Engineering","ASU 电气工程与固态电子研究。","半导体器件、材料及辐射效应。","ASU 自评与董事会院档核 Vanderbilt 2002 博士，保留本人 CV 所列 Ronald D. Schrimpf 导师。所阅未独立列博后。","追 Vanderbilt 学位签署页，核工业、研究助理和教职之间的阶段。"],["26110049","https://rolston.lab.asu.edu/people/","Ph.D. Stanford University, Applied Physics (2020)","ASU 电气、计算机与能源工程。","钙钛矿光伏、薄膜器件力学、半导体物理。","本人组档及 Stanford Dauskardt 组核 2020 应用物理博士和组联系。现有博士导师、博士阶段研究师长及博后组负责人角色分开。","追 Stanford 博后正式指导档。"]];
const extra={"26110049":[["https://dauskardt.stanford.edu/people/nick-rolston","Ph.D. Stanford University, Applied Physics, 2020","Stanford Dauskardt 组人物原档核身份。"]],"f232f519":[["https://mse.engin.umich.edu/people/afyee/","Professor Emeritus","Michigan 材料系核该校荣休任职。"],["https://engineering.uci.edu/dept/cbe/people/emeritus.php","Professor Emeritus of Chemical and Biomolecular Engineering; Biomedical Engineering","UCI 院档核化工和生医荣休。"]],"f01e204d":[["https://thesis.caltech.edu/632/","Direct Energy Bandgap Group IV Alloys and Nanostructures","Caltech 博士论文原档明确 Harry Albert Atwater。"]],"4b16000c":[["https://scholarconnect.uci.edu/srwhite","Distinguished Professor of Physics","学校档并列 1987 和 1988；本人 CV 区分完成与授位。"]],"f6689256":[["https://people.seas.harvard.edu/~donhee/people.htm","Co-advised by Prof. Charles Lieber and Donhee Ham","Harvard Ham 组直接明确共同指导。"],["https://bsac.berkeley.edu/people/sungwoo-nam","Professor Luke P. Lee (Advisor)","Berkeley BSAC 明确博后 Advisor。"],["https://swnam.web.engr.illinois.edu/CV_SungWooNam.pdf","Ph.D. 2011","本人 CV 核 2011-03 Harvard 博士及 Berkeley 博后履历。"]],"5586b23e":[["https://scalacs.org/magazine/2015-05.pdf","Ph.D. degree from UCLA under the direction of Professor M. Frederick Hawthorne","ACS 南加州分会获奖原档核两阶段。"]],"fc37087a":[["https://park.chem.umn.edu/the-team","under the guidance of Prof. Hong-Cai Zhou","本人组档核博士指导、Stanford 组及 Minnesota 入职。"],["https://baogroup.stanford.edu/people/jihye-park","PhD Advisor: Prof. Hong-Cai Zhou","Bao 本人组校友档核博士导师与 Stanford 博后组。"]],"fbbf8618":[["https://healthinformatics.umn.edu/staff/jorge-vinals","Ph.D. in Physics, University of Barcelona, 1983","院所原档核学位及历任。"]],"fb475ef0":[["https://www.pnnl.gov/news-media/rational-design-more-active-catalysts-kelsey-stoerzinger","Advised by Yang Shao-Horn","PNNL 原报道核 MIT 博士导师，并核 2016–2018 本机构博后。"]],"fd488d82":[["https://chemistry.ucdavis.edu/people/alexandra-navrotsky","mineral and materials thermodynamics","UC Davis 原档核任职轨迹和学术方向。"]],"ff96a893":[["https://provost.asu.edu/sites/g/files/litvpz671/files/page/2268/ecee-self-study-2021-22-final.pdf","Post-doctoral Research Associate, 2003-2005; Research Centre Jülich, 2005-2007 and 2001-2003","院系自评逐段列 Jülich 与 ASU 博后。"]],"ffb517c7":[["https://web2.ph.utexas.edu/~femtosec/people.html","Nicholas Hill Matlis, Ph.D. 2006; Postdoc supervisor: Wim Leemans","UT Austin Downer 原组档分列博士和博士后指导证据。"]],"e9e398a6":[["https://catalog.asu.edu/sites/g/files/litvpz4586/files/2023-03/2018-19_faculty_archive_list.pdf","Thornton, Trevor; PhD; University of Cambridge; 1987","ASU 2018–2019 教员原册核 Cambridge 博士。"]],"09fe5903":[["https://provost.asu.edu/sites/g/files/litvpz671/files/page/2268/ecee-self-study-2021-22-final.pdf","Ph.D., Electrical Engineering, Vanderbilt University, 2002","ASU 自评核 Vanderbilt 学位、工程岗位与方向。"]],"cd0f125d":[["https://engineering.uci.edu/directory/wickramasinghe_kumar.php","Distinguished Professor Emeritus","UCI 现工程院档核电气工程与计算机科学荣休。"]]};
const u=(label,url)=>web(label,url)+'。';
const white='4b16000c', yee='f232f519', wick='cd0f125d', rag='f01e204d', evans='5586b23e', mat='ffb517c7';
const byId=new Map(data.map(x=>[x[0],x]));
const aid=new Map(), plain=new Set([yee,'e9e398a6','09fe5903']);
function setAffRow(id, label){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');
  if(cells.length!==5)throw Error('malformed school row '+id);
  cells[1]=label;return cells.join(' | ');
 });
}
for(const [id,src,raw,aff,topic,ev,next] of data){
 const related=extra[id]??[], refs=[src,...related.map(x=>x[0])];
 const proof=u('原始资料',src)+related.map(x=>u('交叉来源',x[0])).join('')+ev;
 if(id===white)editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+proof);
 else if(plain.has(id))editLine(fn(local(id)),l=>l==='## 师承',l=>l+'\n\n- 本轮核查原档：'+proof);
 else note(id,'- 核查边界：',proof);
 const phd=id===white?'John W. Wilkins、Kenneth G. Wilson（本人 CV 明确博士论文导师）':null;
 const pd=id===white?'Douglas J. Scalapino（本人 CV 明确 UCSB 博后 Supervisor）':id===rag?'HP 2002–2004（本人履历及组档）；导师待查':null;
 changeRow(id,phd,pd,proof);
 if(id===yee)setAffRow(id,'化学与生物分子工程、生物医学工程（UCI 荣休）、材料科学与工程（Michigan 荣休）；高分子和复合材料');
 if(id===wick)setAffRow(id,'电气工程与计算机科学（UCI 荣休）；化工材料、生医（2017 本人 CV 所列）；扫描探针及近场显微');
 if(id===evans)setAffRow(id,'化学系（荣休）；稀土金属化学、量子信息科学、无机与有机金属化学');
 const a=JSON.parse(latest.get(id).details_json);
 const record=audit(id,{
  phd:[id===white?'confirmed_advisor':a.aspects.phd.status,id===white||id===wick||id===rag?ev:a.aspects.phd.note,refs],
  postdoc:[id===white?'confirmed_advisor':a.aspects.postdoc.status,id===white||id===rag||id==='fb475ef0'||id==='ff96a893'?ev:a.aspects.postdoc.note,refs],
  affiliation:['confirmed',aff,refs],research:['confirmed',topic,refs]
 },next);
 if(id===white||id===mat)audits.at(-1).followup_required=false;
 aid.set(id,record);
}
const wCV=byId.get(white)[1];
const ps='本人 CV 第 1 页列 Cornell 物理博士 1987-09 完成、1988-01 授位，论文导师为 John W. Wilkins 与 Kenneth G. Wilson。';
const pos='本人 CV 第 1 页将 1987-10–1989-08 UCSB Postdoctoral research associate and IBM Fellow 的 Supervisor 明列 Douglas J. Scalapino。';
for(const [stage,target,personLabel,inverseLabel,indexLabel,newLabel,newInverse,ev] of [
 ['phd','师承人物 - Kenneth G. Wilson','博士阶段研究师长','博士阶段研究者','博士阶段研究师长','博士导师','博士生',ps],
 ['phd','师承人物 - John W. Wilkins','博士阶段研究师长及正式博士导师候选','博士阶段研究者及正式博士生候选','博士阶段研究师长及博士导师候选','博士导师','博士生',ps],
 ['postdoc','师承人物 - Douglas Scalapino','博士后阶段研究师长','博士后阶段研究者','博士后阶段研究师长','博士后导师','博士后研究者',pos]
]){
 const labelProof=u('UCI 托管本人 CV 第 1 页',wCV)+ev;
 editLine(fn(local(white)),l=>l.startsWith('- '+personLabel+'：')&&l.includes('[['+target+'|'),l=>l.slice(0,l.indexOf(']]')+2).replace('- '+personLabel+'：','- '+newLabel+'：')+'。'+labelProof);
 editLine(fn(target),l=>l.startsWith('- '+inverseLabel+'：')&&l.includes('[['+local(white)+'|'),l=>l.slice(0,l.indexOf(']]')+2).replace('- '+inverseLabel+'：','- '+newInverse+'：')+'。'+labelProof);
 editLine(idx,l=>l.startsWith('- [['+local(white)+'|')&&l.includes(' → '+indexLabel+'：')&&l.includes('[['+target+'|'),l=>l.slice(0,l.indexOf(']]',l.indexOf(' → '))+2).replace(' → '+indexLabel+'：',' → '+newLabel+'：')+'。'+labelProof);
 relation(white,stage,target,'advisor',ev,[wCV],aid.get(white),false);
}
const wproof='本人履历将 1970–1974 UCL 博士论文 Supervisor 列为 Sir Eric A. Ash。';
enrich(wick,'phd','师承人物 - Eric Ash','博士生',u('本人 CV',byId.get(wick)[1])+wproof);
relation(wick,'phd','师承人物 - Eric Ash','advisor',wproof,[byId.get(wick)[1]],aid.get(wick),false);
const rproof='Caltech 学位库 2002 博士论文目录明确列 Advisor Harry Albert Atwater。';
enrich(rag,'phd',local('e118c47d'),'博士生',u('Caltech 学位原档',extra[rag][0][0])+rproof);
relation(rag,'phd',local('e118c47d'),'advisor',rproof,[extra[rag][0][0]],aid.get(rag),false);
const mproof='UT Austin Downer 本人组校友页将 Nicholas Hill Matlis 列为 2006 年博士，并明确 LBNL 博后 supervisor Wim Leemans。';
enrich(mat,'postdoc','师承人物 - Wim Leemans','博士后研究者',u('UT Austin 原组档',extra[mat][0][0])+mproof);
relation(mat,'postdoc','师承人物 - Wim Leemans','advisor',mproof,[extra[mat][0][0]],aid.get(mat),false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_UCI明尼苏达与ASU原档';
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
