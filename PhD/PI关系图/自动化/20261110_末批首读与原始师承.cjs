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
 a.audit_id='20261110_'+id+'_final_initial_sources_1308';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_final_initial_sources_1308_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const items=[["edf99e82","https://www.bu.edu/eng/profile/chuanhua-duan-ph-d/","Professor (ME, MSE), Associate Chair for Mechanical Engineering Undergradaute Program","BU 工程院档确认机械工程与材料科学任职。","纳米流体及热质传递。","本人组页分列 Berkeley 2009 博士与 LBNL 博后，后者明确两位指导者；继续查博士论文签署。",["https://www.bu.edu/neft/people/pi/","In 2009, he received his Ph.D. in Mechanical Engineering at the University of California, Berkeley"]],["fc55449e","https://www.bu.edu/eng/profile/michelle-sander/","Professor (ECE, BME, MSE)","BU 原档核 ECE、BME 和 MSE。","超快光子学、激光及光谱。","保留论文明确的 Ippen 和 Kärtner 两位博士导师。独立博后经历待核。"],["ecf49197","https://www.msonlab.com/people","Postdoc, University of Wisconsin-Madison (2020−2023)","本人实验室列 BU 化学任职和 Wisconsin 2020–2023 博后。","超快光谱、分子与材料光物理。","MIT 化学档交叉确认毕业与研究，既有 Schlau-Cohen 和 Zanni 保留。",["https://chemistry.mit.edu/chemistry-news/minjung-son-wins-2021-justin-jankunas-award/","Minjung Son wins 2021 Justin Jankunas Award"]],["ff6644b0","https://www.bu.edu/chemistry/profile/xi-ling/","Associate Professor","BU 化学原档及 MIT 博后介绍核身份。","二维纳米材料、拉曼及光电子。","MIT 介绍列两位博士与两位博士后指导，沿用现有阶段研究师长标签，正式论文字段待核。",["https://risingstars-eecs.mit.edu/participants/xi-ling/","under the supervision of Professors Mildred Dresselhaus and Jing Kong"]],["43213a03","https://engineering.cmu.edu/directory/bios/krause-amanda.html","Amanda R. Krause is an associate professor in the Materials Science and Engineering Department at Carnegie Mellon University.","CMU 原档核 MSE、Brown 博士及 Lehigh 博后。","陶瓷、晶界、界面与烧结。","Padture 原导师记录保留；Harmer 仍作项目候选。"],["e027fa17","https://www.cmu.edu/chemistry/people/faculty/yaron.html","Ph.D., Harvard University, 1990","CMU 化学院档核任职和 Harvard 博士，Silbey 组档确认博后。","计算化学、有机材料与电子结构。","Klemperer 博士候选保留；Robert Silbey 仍标 MIT 博后课题组。",["https://web.mit.edu/robertsilbey/students/postdocs.html","David Yaron"]],["fcd97f7e","https://mse.engineering.cmu.edu/directory/bios/mchenry-michael.html","Professor Emeritus, Materials Science and Engineering","CMU 材料系确认荣休及 1988 MIT 学位。","磁性纳米复合材料及软磁材料。","继续核 LANL 博后个人指导，保留 O’Handley 博士。"],["e4db4ae6","https://www.cmu.edu/physics/people/faculty/suter.html","Emeritus Professor of Physics / Professor of Materials Science & Engineering (Courtesy)","CMU 原档确认物理荣休、材料 courtesy 任职及 Clark 博士。","同步辐射、凝聚态实验与多晶微结构。","保留 Hohenemser 博士和 IBM Horn 博后原证。",["https://www.cmu.edu/physics/people/faculty/documents/suter_cv.pdf","Advisor: P.M. Horn / Advisor: C. Hohenemser"]],["fc5f143a","https://chemistry.emory.edu/research/physical.html","Francesco Evangelista","Emory 化学物理方向原档核院系。","理论化学、电子结构和量子计算。","Schaefer、Gauss 和 Tully 的既有分阶段证据保留，追现行本人 CV。"],["ea963b27","https://phys-acs.org/postdocs/2018.html","Ph.D Adviser: Prof. Kieron Burke / Current Position: Postdoc, Yuen-Zhou group at UCSD","ACS 奖项原档核身份与两个阶段；Emory 化学物理目录确认现任。","分子光谱、量子化学和极化激元。","Kieron Burke 明确博士导师，Yuen-Zhou 标 UCSD 博后课题组。",["https://chemistry.emory.edu/research/physical.html","Raphael Ribeiro"]],["e6be006d","https://seas.harvard.edu/person/kiyoul-yang","Assistant Professor of Electrical Engineering","Harvard SEAS 院档确认 EE 任职。","量子光子学和光学器件。","Harvard 本人采访明列 Vahala 和 Vučković。Caltech 博后短期的日期和指导待查。",["https://www.hqi-blog.com/community/faculty-interviews/meet-kiyoul-yang","my PhD and postdoc advisors, Profs. Kerry Vahala and Jelena Vučković"]],["fcd680b6","https://boulderschool.yale.edu/sites/default/files/files/PhDgreiner.pdf","Markus Greiner","LMU 学位原件核姓名和论文，Harvard 现任沿用校档。","冷原子、光晶格与量子模拟。","保留 Hänsch 博士和 Deborah Jin 的博后组属，继续核正式博后职衔。",["https://cua.mit.edu/events/quantum-science-what-is-it-and-why-is-everyone-talking-about-it","Markus Greiner"]],["bc997297","https://chemistry.jhu.edu/directory/art-bragg/","Ph.D. (Chemistry) UC Berkeley 2004","Johns Hopkins 化学系档案和本人 CV 核任职。","超快光谱、化学动力学及有机半导体。","本人 CV 直接确认 Neumark 博士导师及 Schwartz 博后导师。",["https://krieger.jhu.edu/chem/wp-content/uploads/sites/72/2023/11/Arthur-Bragg-Chemistry-CV-Jan2015-1.pdf","Graduate advisor: Professor Daniel M. Neumark / Postdoctoral advisor: Professor Benjamin J. Schwartz"]],["09d3c44c","https://krieger.jhu.edu/physics/wp-content/uploads/sites/11/2013/02/PeterCV22_tagged.pdf","photoemission, Advisor: Z.-X. Shen","本人 JHU CV 核物理与天文系及 Stanford 博士。","太赫兹光谱、强关联和量子磁性。","保留 Shen 博士导师、UCLA Grüner 与 Geneva van der Marel 两段组属；继续查前段起始时间。"],["51a30d8b","https://energyinstitute.jhu.edu/people/s-m-koohpayeh/","Associate Research Professor, Departments of Physics & Materials Science and Engineering","JHU 原档核物理与材料科学。","晶体生长、磁性及量子材料。","Birmingham 学位目录与本人组档交叉核 Abell、Fort，两个阶段分列。",["https://etheses.bham.ac.uk/view/supervisors/Abell%3D3AJ%3D2E_S%3D2E%3D3A%3D3A.html","Koohpayeh, Seyed Mojtaba (2007). Crystal growth of functional oxides using an image furnace."],["https://sites.google.com/view/koohpayehgroup/people","S.M. Koohpayeh"]],["e081933b","https://krieger.jhu.edu/chem/wp-content/uploads/sites/72/2016/03/Thoi_CV_20260410-website-2.pdf","Ph.D. Chemistry, Prof. Christopher J. Chang, University of California, Berkeley, 2008-2013","本人 2026 CV 核 Hopkins 化学与材料科学次聘。","多孔材料、金属有机框架与电化学。","CV 博士项并列 Chang、博后项并列 Haile，保留阶段与课题组标签，继续找明确论文职衔。"],["0e13580b","https://isn.mit.edu/people/dr-ashwin-gopinath","Ashwin Gopinath was an Assistant Professor at MIT","MIT ISN 现行页用过去时描述 MIT 教职，保留历史记录。","纳米加工、自组装与光子器件。","ISN 将 Caltech 经历概括为 research scientist，保留本人履历和组档中的博士后阶段；继续核两种描述的时间。"],["f711ffd2","https://news.mit.edu/2021/james-swan-associate-professor-dies-1109","The recently tenured professor, who joined the MIT faculty in 2013, studied the structure and dynamics of soft matter.","MIT 纪念档核化工历史任职及去世。","软凝聚态、高分子和流变。","保留 Brady 博士导师和 Furst 博士后阶段研究师长。"],["e7ec9195","https://dmse.mit.edu/people/faculty/rafael-gomez-bombarelli/","followed by postdoctoral work at Heriot-Watt University in Scotland","MIT 材料系原档核院系及两处博士后履历。","数据驱动材料建模和计算物理。","区分 Heriot-Watt 与 Harvard 两段，保留旧有各自来源和称谓，继续查本人 CV。"],["fd6dc671","https://physics.northwestern.edu/people/faculty/core-faculty/jens-koch.html","Jens Koch’s research interests in theoretical condensed matter physics include strongly correlated quantum systems","Northwestern 物理系院档核任职。","理论凝聚态、超导电路及量子信息。","FU Berlin 原论文前置页明确 von Oppen 指导。Girvin 仍为 Yale 博后组。",["https://refubium.fu-berlin.de/bitstream/handle/fub188/7563/00_title.pdf?isAllowed=y&sequence=1","supervision of Prof. Felix von Oppen, PhD."]],["4f0e566c","https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/rogers-john.html","John Rogers","Northwestern 工程院档核材料、生物医学及其关联任职。","柔性电子、生物集成器件和微纳加工。","MIT Nelson 组原名录核博士组属；Harvard Whitesides 的正式导师字段仍待。",["https://web.mit.edu/nelsongroup/thegroup/_formergroupmembers.shtml","John Rogers"]],["52905b46","https://physicstoday.aip.org/obituaries/adilet-imambekov","A rising star in the field of quantum many-body physics, Adilet Imambekov died on 18 July 2012","学会纪念文核 Rice 历史任职与研究。","一维量子多体和冷原子。","Harvard 学位名录和 Demler、Glazman 共同纪念文复核既有关系。",["https://www.physics.harvard.edu/academics/phds","Adilet Imambekov"]],["e24c73b8","https://profiles.rice.edu/faculty/evelyn-tang","Assistant Professor, Physics and Astronomy","Rice 院档核物理与天文学及理论生物物理中心。","统计物理、活性物质和拓扑。","宾大 Africk 博后保留 Bassett 组属；其后 Max Planck 组长单列。"],["f90a12a9","https://www.sutd.edu.sg/profile/dong-zhaogang","He also holds a 25% joint appointment as a Principal Scientist at the Quantum Innovation Centre","SUTD 原档核 SMT 与 A*STAR Q.InC 联聘。","纳米光子、纳米加工与量子器件。","NTU EEE 博士导师未见具名，A*STAR scientist 任职分列；追 NTU 学位原档。"],["ed927ac7","https://physics.berkeley.edu/people/faculty/ehud-altman","Professor Ehud Altman received his Ph.D. from the Technion, Haifa in 2002.","Berkeley 物理系确认 2002 Technion 博士、三年 Harvard 博后及现任。","凝聚态理论和非平衡多体。","保留 Lukin 共同指导和 Demler 组属；Auerbach 仍是博士候选。",["https://www.demlergroup.com/people.html","E. Altman"]],["f82bd0f2","https://chemistry.berkeley.edu/people/eran-rabani","Prof. Rabani's research involves the development of theoretical and computational tools to investigate fundamental properties of nanostructures.","Berkeley 化学原档核历史任职及方向，沿用荣休标记。","纳米结构理论、电子结构和动力学。","保留 Levine 与 Columbia 两位研究合作者，追正式博后职衔。"],["83f4aeb0","https://neuscammanlab.com/wp-content/uploads/2020/03/eric_neuscamman_cv.pdf","Advisor Garnet Kin-Lic Chan","本人 CV 与 Berkeley 化学院档复核身份、院系和博士。","理论化学、电子结构与激发态。","Berkeley 与 LLNL 的 fellowship host 分列，正式指导待核。",["https://chemistry.berkeley.edu/people/eric-neuscamman","Eric Neuscamman"]],["ee64600a","https://murch.physics.wustl.edu/index.php?id=3","After a short postdoc in the Stamper-Kurn Group, Kater joined Irfan Siddiqi's group","WashU 本人课题组与 Berkeley 学位目录核历史训练身份。","量子测量、超导电路和冷原子。","两段 Berkeley 博后组属分列；原论文 PDF 超时，维持博士阶段研究师长。",["https://ultracold.physics.berkeley.edu/publications/theses/","Kater W. Murch / Cavity Quantum Optomechanics with Ultracold Atoms"]],["e5cb17a6","https://che.engineering.ucdavis.edu/people/adam-moule","Dr. Moulé is interested in the solution processing and patterning of organic electronic materials","UC Davis 化工原档核任职。","有机半导体、光伏和功能材料。","保留 Pines 与 Meerholz 阶段研究师长，追 Berkeley 论文原件。"],["f19c3312","https://physics.ucdavis.edu/people/faculty/alex-thomson","She earned her Ph.D. in Physics in 2018 from Harvard University under the guidance of Professor Subir Sachdev.","UC Davis 原档核物理系、Harvard 博士和研究领域。","凝聚态理论、二维与强关联量子材料。","保留 Alicea 和 Refael 博后组属，待站点解除访问限制再核。"],["fb9c0287","https://pubs.rsc.org/en/content/getauthorversionpdf/C5EE01434D","After completing postdoctoral training with Prof. Richard H. Holm","本人论文作者履历确认 Oldenburg 博士期与 Harvard 博后；保留 UC Davis 化学原档历史记录。","光催化、无机纳米材料及能源材料。","原文分别用 working with 和 training with，维持 Pohl 与 Holm 阶段研究师长。"],["f6ef9106","https://pickett.physics.ucdavis.edu/biosketch.html","complete his PhD in theoretical condensed matter physics in 1975","UC Davis 托管本人简历核 1975 Stony Brook 博士与随后三处博后。","计算凝聚态、电子结构与超导。","继续按学位目录与 Bristol、Berkeley、Northwestern 的任用查三段指导。"],["f60a624a","https://www.physics.ucsb.edu/people/andreas-ludwig","Andreas Ludwig / Professor / Condensed Matter Theory","UCSB 物理系原档核现职和研究。","理论凝聚态和多体量子物理。","追 UCSB 学位原档及毕业后的各岗位。"],["ed867ccc","https://www.cpos.ucsb.edu/people/faculty/guillermo-bazan","Professor Emeritus, Chemistry & Biochemistry","UCSB 机构档确认荣休历史记录。","有机半导体和共轭材料。","本人组页再证 Schrock 博士导师及 Bercaw 博后导师。",["https://bazan.chem.ucsb.edu/gui-bazan","Ph.D. from the Massachusetts Institute of Technology under the advisement of Professor Richard R. Schrock"]],["f258daea","https://www.physics.ucsb.edu/people/m-cristina-marchetti","She has been a member of the Physics faculty at UCSB since","UCSB 院系原档核现职、Florida 博士，旧 Syracuse 本人 CV 分列三段博后。","主动软物质、非平衡统计物理。","Dufty 博士证据保留；继续核三段博后各自个人指导。",["https://artsandsciences.syracuse.edu/media/documents/marchetti-cristina-cv.pdf","1984-1985 The Rockefeller University Postdoctoral Research Associate"]],["fe1b5cd7","https://viterbischool.usc.edu/news/2024/02/wade-hsu-wins-ieee-photonics-societys-2024-young-investigator-award/","Chia Wei “Wade” Hsu, an assistant professor of electrical and computer engineering","USC 2024 工程新闻核 ECE 历史任职；保留已故状态。","纳米光子、连续域束缚态与电磁学。","Harvard 两位博士导师不变，Yale 两条博后指导仅候选。"],["e60da069","https://dornsife.usc.edu/chemistry/faculty/stephen-e-bradforth/","Ph.D., 1992, University of California, Berkeley","USC 化学院档核任职及 1992 Berkeley 博士。","超快光谱、凝聚态化学动力学。","保留 Neumark 博士组属与 Fleming 博后阶段指导，继续追本人论文及聘任。",["https://dornsife.usc.edu/stephen-bradforth/about/","Stephen Bradforth"]],["eea56a11","https://physics.utexas.edu/directory/antonios-alvertis","Antonios Alvertis received his Ph.D. from the Physics Department of the University of Cambridge","UT 原档核物理与 Oden 关联、Cambridge 博士和量子材料研究。","计算凝聚态、激子与电子声子耦合。","Cambridge 两位指导与 Berkeley 访学关系分列，Neaton 博后组属仍保留。",["https://sites.google.com/lbl.gov/neaton-group/people","Antonios Alvertis"]],["f2931090","https://ece.utexas.edu/people/faculty/cheng-guo","After graduation, he continued as a postdoctoral researcher at Stanford University","UT ECE 原档核 Stanford 博士及同校博士后。","纳米光子、拓扑材料与热辐射。","Shanhui Fan 的博士关系明确，博后仍列阶段指导。"],["e84e72be","https://physics.utexas.edu/directory/feliciano-giustino","Feliciano Giustino is Professor of Physics at The University of Texas at Austin","UT 物理院档核物理及 Moncrief 讲席。","计算量子材料、电子声子耦合。","保留 EPFL Pasquarello 博士导师和 Berkeley Louie 博后课题组。"],["f9d407eb","https://me.utexas.edu/person/yaguo-wang/","Ph.D., Mechanical Engineering, Purdue University, 2011","UT 机械工程院档核职位及 Purdue 博士与后续阶段。","超快光谱、声子及热输运。","保留 Xu 博士导师；Purdue 工程主机仍退避，博后候选保留。"],["f3036bd0","https://engineering.uconn.edu/faculty/ece/ali-gokirmak/","Electrical and Computer Engineering","UConn 工程院档核 ECE 及器件研究。","纳米电子、相变存储和热电输运。","Cornell 博士论文旧证保留，eCommons 退避，博后个人指导继续追查。"],["f930f903","https://materials-science.institute.uconn.edu/person/gregory-sotzing/","Postdoctoral Fellow, California Institute of Technology, 1997-99","UConn 材料所原档核化学、Florida 博士及 Caltech 1997–1999 博后。","导电聚合物、电致变色和介电材料。","保留 Grubbs 博后组属。Florida 博士导师继续按学位资料追查。"],["e3da7893","https://physics.uconn.edu/person/menka-jain/","2005-2008: Director’s funded Postdoctoral Fellow, Materials Physics and Applications Division, Los Alamos National Laboratory","UConn 物理系核 UPR 博士及 Los Alamos 2005–2008 博后。","多铁材料、功能氧化物及异质结构。","CV PDF 仍 502；UPR 访问和 LANL 博后按不同经历处理，正式导师待核。",["https://natsci.uprrp.edu/speclab/people/","Menka Jain"]],["f1ce40fc","https://www.physics.wisc.edu/2024/10/17/welcome-professor-ben-woods/","Condensed matter theorist Ben Woods joined the department as an assistant professor this fall.","Wisconsin 物理系原档核现任及研究。","半导体量子点、拓扑超导和量子信息。","WVU 委员会主席 Stanescu、Wisconsin 博后阶段师长 Friesen 继续分列。",["https://researchrepository.wvu.edu/etd/8241/","Tudor Stanescu"]],["f02e8b4f","https://engineering.wisc.edu/directory/profile/dawei-feng/","Y. Austin Chang Associate Professor","Wisconsin 工程院档核材料系讲席。","杂化固体、金属有机框架和储能。","保留 Zhou 博士导师及 Stanford Bao 博后课题组。"],["95d5ad74","https://lsmagazine.wisc.edu/issues/spring-2023/unlocking-the-potential-of-quantum-computers/","Micheline Soley, assistant professor of chemistry and affiliate of the physics department","Wisconsin 校方刊物核化学及物理关联任职。","量子动力学、量子计算与超冷化学。","Heller 博士确证保留；Batista、Girvin 与 Stone 现有不同类别关系分列。"],["f50590ae","https://www.physics.wisc.edu/directory/bergmann-uwe/ubergmann_cv.pdf","Ph.D. Peter Stephens, Stony Brook University, Jerry Hastings, NSLS","本人 CV 核物理学系、SLAC 访问与 Stony Brook 博士。","超快 X 射线、同步辐射光谱和材料。","CV 的 Advisors 栏分列两位博士与两位博后导师，保留原证。"],["4b57e796","https://escholarship.org/content/qt9xf3p117/qt9xf3p117.pdf","Professor David Saintillan, Chair","UC Davis 化工目录与本人 2015 学位论文匹配身份。","软物质、流体力学及生物物理。","博士论文复读确认委员会主席 Saintillan，致谢明确研究指导。维持结构化阶段研究师长，人物旧正式标签差异仍待明确 advisor 原证。",["https://che.engineering.ucdavis.edu/directory/harishankar-manikantan","Harishankar Manikantan"]]];
const aids=new Map();
const br='bc997297', ri='ea963b27', ma='4b57e796';
const brSrc=items.find(x=>x[0]===br)[6][0], riSrc=items.find(x=>x[0]===ri)[1], maSrc=items.find(x=>x[0]===ma)[1];
const maEv='2015 博士论文签署页及摘要列 Professor David Saintillan, Chair；致谢第 xi 页明确感谢 Saintillan 的科研指导，确认博士阶段研究师长，正式称谓待核。';
const complete=new Set(['ecf49197','e4db4ae6','bc997297','51a30d8b','52905b46','ed867ccc','f50590ae']);
const pd={
 'f6ef9106':'Bristol、Berkeley、Northwestern 三段博士后，个人导师待核',
 'e3da7893':'Los Alamos 2005–2008 博后，个人导师待核；UPR Katiyar 仍为旧候选，时间及身份继续核对',
 'f258daea':'Maryland、Rockefeller、Florida 三段博士后，个人导师待核'
};
const preserveNotes=new Set(['fcd680b6','fb9c0287','ee64600a']);
for(const [id,src,_raw,aff,topic,next,...extra] of items){
 const a=JSON.parse(latest.get(id).details_json);
 const sources=[src,...extra.map(([url])=>url)];
 const msg=sources.map((u,i)=>web(i?'补充原证':'原始资料',u)).join(' · ')+'。'+aff+' '+next;
 const c={
  affiliation:[a.aspects.affiliation.status,preserveNotes.has(id)?a.aspects.affiliation.note+' '+aff:aff,sources],
  research:[a.aspects.research.status,topic,sources]
 };
 if(id===ma)c.phd=['group_or_candidate',maEv,[maSrc]];
 if(id==='e3da7893')c.postdoc=['group_or_candidate','UConn 明确列 Los Alamos 2005–2008 Director’s funded Postdoctoral Fellow。UPR 组名单另列 2004 Menka Jain 访问，不能把二者合并为同一段。具体博后导师待核。',sources];
 if(id==='f6ef9106')c.postdoc=['unresolved','本人 vitae 确认三处博后并列，未具名个人导师。',sources];
 if(id==='f258daea')c.postdoc=['unresolved','本人 CV 分列三段博士后，但未具名个人指导。',sources];
 const aid=audit(id,c,next);aids.set(id,aid);
 if(complete.has(id))audits.at(-1).followup_required=false;
 const f=fn(local(id)), bound=l=>l.startsWith('- 核查边界：');
 if(fs.readFileSync(f,'utf8').split(/\r?\n/).some(bound))note(id,'- 核查边界：',msg);
 else editLine(f,l=>l==='<!-- PI-AUTO-SEARCH:START -->',l=>'- 本轮原档复核：'+msg+'\n\n'+l);
 changeRow(id,null,pd[id],msg);
}
for(const [stage,target,src,ev] of [
 ['phd','师承人物 - Daniel M. Neumark',brSrc,'本人 JHU CV 第 3 页 Graduate and Postdoctoral Advisors 栏明确列 Daniel M. Neumark 为 Graduate advisor。'],
 ['postdoc',local('482067d5'),brSrc,'本人 JHU CV 第 3 页明确列 Benjamin J. Schwartz 为 Postdoctoral advisor。']
]){
 enrich(br,stage,target,stage==='phd'?'博士生':'博士后研究者',web('本人 CV 第 3 页',src+'#page=3')+'。'+ev);
 relation(br,stage,target,'advisor',ev,[src],aids.get(br),false);
}
const burke=local('4d83240e');
const rEv='ACS 物理化学部奖项档具名列 Raphael Florentino Ribeiro 的 Ph.D Adviser 为 Kieron Burke。';
enrich(ri,'phd',burke,'博士生',web('ACS 原始获奖档',riSrc)+'。'+rEv);
relation(ri,'phd',burke,'advisor',rEv,[riSrc],aids.get(ri),false);
relation(ma,'phd','师承人物 - David Saintillan','stage_mentor',maEv,[maSrc],aids.get(ma),false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_末批首读与原始师承';
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
