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
 a.audit_id='20261110_'+id+'_six_school_first_1254';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_six_school_first_1254_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const items=[["fdd93f57","https://chem.rutgers.edu/eric-garfunkel-biographical","Ph.D. 1983, California (Berkeley)","Rutgers 化学与化学生物学系本人资料核 1983 Berkeley 化学博士。","表面化学、纳米电子界面与能源材料。","UC Davis 主办档列 Paris-Sud 和 Fudan 两处博士后，继续追博士论文及两处个人指导。",["https://globalaffairs.ucdavis.edu/international-conference/speakers/18/speakers18/garfunkel","he was a postdoctoral fellow at University of Paris-Sud in Paris, France and at Fudan University in Shanghai, China"]],["f30c943f","https://www.physics.rutgers.edu/grad/redbook10/Red-www-faculty.html","Kojima, Haruo / Ph.D., University of California, Los Angeles, 1972.","Rutgers 历史目录核物理与天文系和 1972 UCLA 博士。","低温实验、超流氦和声学。","Rudnick 的学生回忆列 Kojima 为前学生，且有 1971 UCLA 研究证据，先列博士阶段研究师长。查 UCLA 学位档及博后经历。",["https://acousticstoday.org/wp-content/uploads/2017/12/12-Acoustics-Today-Winter-2017-Isadore-Rudnick-1917-1997-Acoustics-in-the-Service-of-Physics-Steven-L.-Garrett.pdf","one of Izzy’s former students, Haruo Kojima"],["https://www.nasonline.org/wp-content/uploads/2024/06/rudnick-isadore.pdf","one of Izzy’s former students, Haruo Kojima"]],["ed3f7fd9","https://physics.rutgers.edu/people/faculty-list/faculty-profile/chakhalian-jak","Claud Lovelace Endowed Professor of Physics","Rutgers 物理与天文系现行档确认讲席。","量子材料、过渡金属氧化物及异质结构。","保留 Kiefl 博士导师和 Keimer 博后阶段资料，继续追 Max Planck 与 TRIUMF 的正式角色。"],["0f6dd201","https://richard-remsing-4rs9.squarespace.com/s/Remsing_CV.pdf","2015– Postdoctoral Fellow, Advisor: Michael L. Klein / 2013–2015 Postdoctoral Fellow, Advisor: Amish J. Patel","本人 CV 复核 Maryland 博士及两段博士后；Rutgers 任职沿用其现行院档。","统计力学、溶液和界面分子模拟。","本人 CV 明列博士阶段 John D. Weeks，以及两段博士后的 Amish J. Patel 和 Michael L. Klein。"],["3472510b","https://sas.rutgers.edu/about/news/research/research-news-detail/once-a-dream-of-science-fiction-a-laser-tweezer-helps-a-rutgers-biophysicist-boldly-go-where-molecules-move","Sang-Hyuk Lee, of the Department of Physics and Astronomy","Rutgers 科研原档核物理与天文系，保留现有阶段导师原证。","光镊、先进显微和单分子生物物理。","继续核博士后分段和原任用记录。"],["e4ff3ad1","https://gupolylab.com/about-yuwei/","Weinberg Family Postdoctoral Fellow & Postdoctoral Associate","本人组档核 Rutgers 化学与化学生物学及 2019–2022 Northwestern 博士后。","聚合物自组装、材料和拓扑网络。","Mirkin 属博士后课题组，继续追 advisor 职衔。"],["fad0a4b1","https://campusdirectory.ucsc.edu/cd_detail?uid=aayzner","Postdoctoral Scholar, Stanford University / SLAC National Accelerator Laboratory","UCSC 本人学校档核化学与生物化学、UCLA 博士和 Stanford／SLAC 博后。","有机半导体、激子及光捕获。","保留 Benjamin J. Schwartz、Michael F. Toney 及 Zhenan Bao 既有不同关系标签。"],["5203d141","https://campusdirectory.ucsc.edu/cd_detail?guid=G001707423","1989-92 Postdoctoral Research Fellow, University of California, Berkeley","UCSC 化学与生物化学档核 Washington 1989 博士和 1989–1992 Berkeley 博后。","量子点、纳米材料及超快光谱。","本人 CV 原网址 502；Dan G. Imre、Charles B. Harris 保留候选。"],["fd936ca2","https://campusdirectory.prd.idm.aws.ucsc.edu/cd_detail?guid=G113804092","under supervision of Prof. Annabella Selloni","UCSC 化学与生物化学档明确 Princeton 博士指导 Annabella Selloni。","计算材料、分子模拟和机器学习。","追 LLNL 博后任用及个别指导。"],["f3b229d6","https://news.ucsc.edu/2023/12/kobayashi-nai/","Kobayashi joined the Baskin School of Engineering in 2008","UCSC 原档核 ECE 任职、USC 博士及之后企业和实验室履历。","半导体纳米结构和光电器件。","查 USC 学位专业字段，HP、LLNL 与 Agilent 职位各自保留，未查到独立博后导师。"],["ebfe7a89","https://campusdirectory.ucsc.edu/cd_detail?uid=onarayan","Professor","UCSC 人员档核物理系，校方旧新闻确认 Harvard Junior Fellow 至 1995。","非平衡凝聚态理论和统计物理。","续查博士及 Harvard 的个人指导，Daniel Fisher 仍作线索。",["https://news.ucsc.edu/1995/04/sloan-foundation-recognizes-uc-santa-cruz-physicist/","Narayan, age 30, currently is a junior fellow at Harvard University."]],["698251c8","https://www.physastro.iastate.edu/event/2026/colloquium-ryan-e-baumbach-ucsc","Director's Funded Postdoctoral Fellowship at Los Alamos National Laboratory (2011–2014) working with Dr. Eric Bauer.","Iowa State 讲座原档核现 UCSC 物理任职及 UC San Diego、Los Alamos 两段博士后。","强关联量子材料合成、晶体生长。","Eric Bauer 现读来源仅记 with，维持阶段研究师长；继续追 UCSD 指导及两校历史记录的标签来源。"],["5c8d45ee","https://chem.unc.edu/wp-content/uploads/2020/12/moran_cv.pdf","Chemistry (Advisor: Norbert Scherer) / of Chemistry (Advisor: Kenneth Spears) / Shaul Mukamel","UNC 托管本人履历列化学系及 Kansas State 2002 博士。","超快、非线性光谱及凝聚态分子光物理。","本人 CV 明确 Rochester 2002–2003 Shaul Mukamel、Northwestern 2003–2004 Kenneth Spears、Chicago 2004–2007 Norbert Scherer。"],["9d272b4c","https://assets.cambridge.org/97805215/30187/frontmatter/9780521530187_frontmatter.pdf","did his Ph.D. in physical chemistry at Princeton University with Professor A. V. Tobolsky in 1969","Cambridge 著者档核本人博士论文历史及 UNC 化学背景，保留荣休。","液晶、高分子物理及软物质。","继续查 Princeton 授位原件和 Tobolsky、Wade 的正式职衔。"],["eddcf6cb","https://chem.unc.edu/wp-content/uploads/2020/12/atkin_cv.pdf","Research advisor: Prof. Markus Raschke. / Research advisor: Prof. Tony Heinz.","本人 2016 CV 确认 UNC 历史任职；N.C. A&T 研究页面补核后续岗位与方向。","纳米光学、近场光谱及量子材料。","Columbia 博士 Tony Heinz，Washington 与 Colorado 两处博士后均为 Markus Raschke；继续核 UNC 是否兼任。",["https://www.ncat.edu/cost/departments/physics/research/condensed-matter.php","Dr. Joanna Atkin develops and uses novel optical spectroscopy tools"]],["fbca40ad","https://drut.web.unc.edu/about-me/","From March 2008 to September 2010, I was a Postdoctoral Researcher in the Nuclear Theory group","本人组档核 UNC 物理与天文系教授，分列 Ohio State 2008–2010 和 Los Alamos 2010–2012 博后。","计算量子多体、超冷费米原子及核理论。","继续追 Washington 学位档和两段博后指导，既有候选保留。"],["f1bfd22c","https://www.mengenwang.com/team","Postdoc training: University of California, Santa Barbara, 2019 - 2022","本人课题组核 Binghamton 历史与 UNC 现任，分列 2014–2019 博士及 2019–2022 博后。","计算材料、量子缺陷和宽禁带半导体。","Brookhaven 原档与既有博士阶段研究师长一致，UCSB 仍按课题组。",["https://www.bnl.gov/newsroom/news.php?a=215550","Wang and Akter Win 2019 Chasman Award"]],["e3f03b12","https://pines.berkeley.edu/sites/default/files/news/solid_state_nmr_some_personal_recollections_-_1996.pdf","Richard Eckman Young Lee Ryong Ryoo Yue Wu","UNC 物理院档暂沿用；Pines 本人回忆中出现 Yue Wu。","固态核磁和材料自旋共振。","回忆名录未逐一标任职阶段，维持 Pines 博后候选及 André Stesmans 博士候选。"],["4ba1c5ec","https://www.uh.edu/nsm/physics/people/profiles/michal-papaj/","Gordon and Betty Moore Foundation Postdoctoral Fellowship, University of California, Berkeley","Houston 物理院档确认 MIT 博士及 Berkeley 博士后。","理论凝聚态、超导和拓扑量子材料。","保留 Liang Fu 论文指导，续查 Joel Moore 候选。"],["a665704f","https://www.uh.edu/nsm/physics/people/profiles/pavan-hosur/","Associate Professor","Houston 物理院档核现任及研究；旧 CV 本轮下载类型不支持。","理论凝聚态、拓扑量子物态。","保留 Vishwanath 博士导师、Kivelson 博士后阶段研究师长；追 Stanford 正式指导。"],["a1d7ed21","https://facnewsletter.nsm.uh.edu/issues/august-2023/articles/new-faculty","Dr. Mondaini is a physicist focused on the study of quantum many-body systems.","Houston 校刊核 2023 物理聘任及研究。","量子多体、强关联、计算凝聚态。","保留 Thereza Paiva 和 Rigol、Scalettar 的原有分阶段证据，追后两位正式职衔。"],["63cfd334","https://www.tcsuh.com/people/prininv/chen_shuo/","Shuo Chen","Houston 超导中心院档核物理与材料方向，MIT 实验室档核原组归属。","热电与电化学纳米材料。","Houston 旧 CV 404，TcSUH 旧 CV 返回不可抽取类型；两段 MIT 博后课题组及博士导师原记录保留。",["https://web.mit.edu/~eel/people.html","Shuo Chen / Assistant Professor of Physics"]],["7d58c9d8","https://www.ee.uh.edu/faculty/yao-yan","Postdoctoral Scholar (2010-2012), Department of Materials Science and Engineering, Stanford University","Houston ECE 原档核 2008 UCLA 博士及 2010–2012 Stanford 博后。","有机半导体、固态电池和电化学功能材料。","追 Stanford 博后正式指导，保留 Yi Cui 阶段关系。"],["aa9bff54","https://fan.egr.uh.edu/2023/07/222/","Fan research lab is directed by Dr. Zheng Fan and located in the Department of Engineering Technology","本人组档及 Houston 院档核工程技术系。","原位纳米结构、能源材料与储能。","保留本人 CV 的博士后 Advisor Xiangfeng Duan，追 MSU 博士论文正式字段。",["https://www.et.uh.edu/faculty/fan-zheng","Zheng Fan, Ph.D."]],["e007514b","https://faculty.eng.umd.edu/clark/download/1741","Postdoctoral Associate | Advisor: Prof. Juejun Hu / Postdoctoral Research Assistant in Chalcogenide Photonics | Advisor: Prof. Harish Bhaskaran","本人 CV 与 Maryland 原院档核材料、IREAP 和 ECE 相关任职。","相变材料、集成光子与光计算。","两段博后分别为 Oxford 2017 年 2–10 月 Harish Bhaskaran 和 MIT 2018 年 2 月至 2021 年 7 月 Juejun Hu。Oxford 博后起始早于 CV 所列 2017 年 7 月授位，保留原日期。",["https://mse.umd.edu/clark/faculty/1486/Carlos-A-Rios-Ocampo","Carlos A. Rios Ocampo joined the Department of Materials Science and Engineering and IREAP as an assistant professor"]],["12a598b3","https://faculty.eng.umd.edu/clark/download/152","Advisors: T. Venkatesan and Chris Lobb / Advisors: P. G. Schultz and X.-D. Xiang","Maryland 托管本人履历核材料与相关双聘。","功能氧化物、组合材料探索、薄膜。","本人 CV 再次明确 Maryland 博士与 Berkeley 博后各两位 Advisor。"],["eac2b25a","https://ireap.umd.edu/clark/faculty/805/Kevin-Daniels","Kevin M. Daniels is an Associate Professor in the Department of Electrical and Computer Engineering","Maryland IREAP 原档核 ECE 联聘，CV 核 2014 博士及 2014–2017 NRL 博后。","二维材料、石墨烯与半导体器件。","维持 Myers-Ward 阶段师长，追 NRL 原任用或本人正式导师字段。",["https://bpb-us-e1.wpmucdn.com/blog.umd.edu/dist/b/496/files/2023/08/Daniels-CV-F_.pdf","National Research Council Postdoctoral Fellow, U.S. Naval Research Laboratory"]],["f4261ccd","https://chbe.umd.edu/clark/faculty/159","followed by two years as a postdoctoral associate in MIT’s Department of Chemical Engineering","Maryland 化工院档确认系主任、MIT 高分子博士及同校化工两年博士后。","功能高分子、复合材料与电解质。","追 MIT 化工博士后指导者。"],["fc250357","https://quics.umd.edu/people/saikat-guha","Clark Distinguished Chair Professor of Electrical and Computer Engineering at the University of Maryland, College Park","QuICS 现行名录核 Maryland ECE、Arizona 兼职及 MIT EECS 兼职。","光量子通信和量子信息。","尊重 MIT 学位站退避；保留原博士证据，核博士后经历是否独立存在。"],["f4897a29","https://api.drum.lib.umd.edu/server/api/core/bitstreams/afc83223-6f40-4645-bc75-72dae28a6bff/content","Professor Manfred Wuttig, Chair/Advisor","Maryland 学位原件与能源研究所现任原档核材料系教授。","多铁材料、自组装与功能纳米材料。","学位论文明确 Manfred Wuttig。继续查 MIT Gradečak 组具体博士后任职和指导。",["https://energy.umd.edu/clark/faculty/1833/Shenqiang-Ren","Ren, Shenqiang / Professor"]],["ef0ab105","https://lynnlab.yale.edu/sites/default/files/files/Lynn_CV(5).pdf","James S. McDonnell Postdoctoral Fellow, City University of New York & Princeton University 9/20 – 12/23","本人新版履历与 Yale 物理院档核物理、Wu Tsai 和定量生物。","统计物理、复杂系统和生物物理。","明确 CUNY／Princeton 博后 2020 年 9 月至 2023 年 12 月，三位合作研究者保留原标签。",["https://physics.yale.edu/profile/christopher-lynn","Chris Lynn joined Yale as an Assistant Professor of Physics"]],["fa520ffb","https://www.lgwrightlab.com/_files/ugd/6a16d8_6122a33e33e8439bb35f2bd434ded873.pdf","Advisors: Peter L. McMahon and Yoshihisa Yamamoto / Advisors: Hideo Mabuchi and Yoshihisa Yamamoto","Yale 工学院和本人 CV 核应用物理任职。","非线性光学、光计算与物理机器学习。","本人 CV 确认 Frank Wise 博士导师，Stanford 与 Cornell／NTT 两段博士后各两位导师，Yamamoto 跨两段。",["https://engineering.yale.edu/research-and-faculty/faculty-directory/logan-wright","Assistant Professor of Applied Physics"]],["fcfd6e75","https://fas.yale.edu/news-announcements/faculty-retirement-and-memorial-tributes/faculty-retirement-tributes-2021/memoriam-mark-reed","Mark Reed B.S. and Ph.D. Syracuse University, faculty member at Yale beginning in 1990","Yale 院档核 Syracuse 博士、Yale ECE 与应用物理历史任职及去世信息。","量子点、半导体和分子电子。","院档区分 Texas Instruments 产业任职；继续查 Syracuse 原始论文及独立博士后经历。"],["f170a4a7","https://proberlab.yale.edu/alumtheses","Postdoctoral Advisees / R.J. Schoelkopf","Prober 原组档的 Postdoctoral Advisees 栏列 Schoelkopf；Yale 工程院档核现职。","超导量子电路、腔量子电动力学与量子计算。","已记录的博士导师和 Prober 博后导师保留，追其他共同指导。",["https://engineering.yale.edu/research-and-faculty/faculty-directory/robert-j-schoelkopf","Sterling Professor of Applied Physics"]],["f62ea51a","https://engineering.yale.edu/research-and-faculty/faculty-directory/simon-g-mochrie","Professor of Applied Physics","Yale 工程院档核应用物理及 MIT 博士。","软凝聚态、X 射线散射与生物物理。","SSRL 原报告下载超限，保留已有论文名录证据及导师标签。续查正式学位论文和博士后经历。"],["feb34e79","https://www.eng.yale.edu/nanomechanics/CV%20Udo%20Schwarz%20-%202024%2011%2007.pdf","Research Advisor: Prof. Dr. H.-J. Güntherodt.","本人 CV 复核 Yale 机械与材料科学、Basel 博士与 Hamburg 任职。","表面物理、扫描探针与纳米摩擦。","分开 1993 年 Wiesendanger 组博士后与之后 staff scientist，保留博后课题组称谓。",["https://engineering.yale.edu/research-and-faculty/faculty-directory/udo-d-schwarz","Professor of Mechanical Engineering"]]];
const aidById=new Map();
const cvM=items.find(x=>x[0]==='5c8d45ee')[1], cvC=items.find(x=>x[0]==='e007514b')[1];
const k=items.find(x=>x[0]==='f30c943f'), kSources=[k[1],...k.slice(6).map(a=>a[0])];
const g=items.find(x=>x[0]==='fdd93f57');
const mEv='本人 CV 第 1 页明确列 2002–2003 Rochester 博士后 Advisor Shaul Mukamel、2003–2004 Northwestern 博士后 Advisor Kenneth Spears、2004–2007 Chicago 博士后 Advisor Norbert Scherer。';
const cEv='本人 CV 第 1 页明确列 Oxford 2017 年 2–10 月 Postdoctoral Research Assistant Advisor Harish Bhaskaran，MIT 2018 年 2 月至 2021 年 7 月 Postdoctoral Associate Advisor Juejun Hu。Oxford 博后起始早于所列授位日期，保留履历原口径。';
const kEv='Rutgers 历史目录列 UCLA 1972 年博士，Garrett 在美国声学学会的研究回忆与 NAS 传记中称 Kojima 为 Rudnick 的前学生，并列 UCLA 超流氦研究。先标博士阶段研究师长，正式论文导师待 UCLA 原档。';
const special={
 '5c8d45ee':{postdoc:['confirmed_advisor',mEv,[cvM]]},
 'e007514b':{postdoc:['confirmed_advisor',cEv,[cvC]]},
 'f30c943f':{phd:['group_or_candidate',kEv,kSources]},
 'fdd93f57':{postdoc:['unresolved','UC Davis 主办档具名 Paris-Sud 和 Fudan 两处博后，未列各自指导者。',[g[6][0]]]},
 'ef0ab105':{postdoc:['group_or_candidate','新版本人 CV 明确 Princeton/CUNY 2020 年 9 月至 2023 年 12 月博士后。维持三位合作研究者，具体指导职衔未明。',['https://lynnlab.yale.edu/sites/default/files/files/Lynn_CV(5).pdf']]}
};
const phRows={'f30c943f':'Isadore Rudnick（博士阶段研究师长，正式导师待核）'};
const pdRows={
 '5c8d45ee':'Shaul Mukamel（Rochester，2002–2003）、Kenneth Spears（Northwestern，2003–2004）、Norbert Scherer（Chicago，2004–2007），均明确导师',
 'e007514b':'Harish Bhaskaran（Oxford，2017 年 2–10 月）、Juejun Hu（MIT，2018–2021），均明确导师',
 'fdd93f57':'Paris-Sud 与 Fudan 两处博士后，个人指导待核'
};
const replaceBounds=new Set(['5c8d45ee','e007514b','f30c943f','fdd93f57']);
const bothRechecked=new Set(['5c8d45ee','e007514b','0f6dd201','12a598b3','fa520ffb']);
for(const [id,src,raw,aff,topic,next,...more] of items){
 const a=JSON.parse(latest.get(id).details_json);
 const srcs=[src,...more.map(([url])=>url)];
 const proof=srcs.map((u,i)=>web(i?'相关原证':'原始资料',u)).join(' · ')+'。';
 const msg=proof+aff+' '+next;
 const changes={
  affiliation:[a.aspects.affiliation.status,aff,srcs],
  research:[a.aspects.research.status,topic,srcs],
  ...(special[id]??{})
 };
 // 若证据仅核过去岗位，保留既有院系和方向说明。
 if(['e3f03b12','0f6dd201','12a598b3','698251c8'].includes(id)){
  changes.affiliation[1]=a.aspects.affiliation.note+' '+aff;
 }
 const aid=audit(id,changes,next);
 aidById.set(id,aid);
 if(bothRechecked.has(id))audits.at(-1).followup_required=false;
 const file=fn(local(id));
 const bound=l=>l.startsWith('- 核查边界：');
 const content=fs.readFileSync(file,'utf8');
 if(content.split(/\r?\n/).some(bound)){
  if(replaceBounds.has(id))editLine(file,bound,()=>'- 核查边界：'+msg);
  else note(id,'- 核查边界：',msg);
 }else editLine(file,l=>l==='<!-- PI-AUTO-SEARCH:START -->',l=>'- 本轮原档复核：'+msg+'\n\n'+l);
 changeRow(id,phRows[id],pdRows[id],msg);
}
function stageUpgrade(id,target,src,ev) {
 const p=' '+web('本人 CV 第 1 页',src)+'。'+ev;
 replaceNoteLabel(id,'博士后阶段研究师长','博士后导师',target,p);
 replaceInverseLabel(target,id,'博士后阶段研究者','博士后研究者',p);
 replaceIndexLabel(id,target,'博士后阶段研究师长','博士后导师',p);
 relation(id,'postdoc',target,'advisor',ev,[src],aidById.get(id),false);
}
const moran='5c8d45ee', carlos='e007514b';
for(const [target,ev] of [
 [local('e491e468'),'2002–2003 Rochester Postdoctoral Research Associate 的 Advisor 为 Shaul Mukamel。'],
 ['师承人物 - Kenneth Spears','2003–2004 Northwestern Postdoctoral Research Associate 的 Advisor 为 Kenneth Spears。'],
 ['师承人物 - Norbert Scherer','2004–2007 University of Chicago Postdoctoral Research Associate 的 Advisor 为 Norbert Scherer。']
])stageUpgrade(moran,target,cvM,ev);
const hu=local('8aa2a759'), bh='师承人物 - Harish Bhaskaran';
stageUpgrade(carlos,hu,cvC,'2018 年 2 月至 2021 年 7 月 MIT Postdoctoral Associate 的 Advisor 为 Juejun Hu。');
const bhEv='Oxford Postdoctoral Research Assistant 的 Advisor 为 Harish Bhaskaran。履历列 2017 年 2–10 月，起始早于同页的 2017 年 7 月授位。';
const bhProof=web('本人 CV 第 1 页',cvC)+'。'+bhEv;
addEdge(carlos,'博士后导师',bh,'Harish Bhaskaran',bhProof,hu);
inverse(carlos,bh,'博士后研究者',bhProof);
relation(carlos,'postdoc',bh,'advisor',bhEv,[cvC],aidById.get(carlos),false);

const koj='f30c943f', rud='师承人物 - Isadore Rudnick';
const rudProof=web('美国声学学会原文',k[6][0])+' · '+web('NAS 原传记',k[7][0])+' · '+web('Rutgers 院系档',k[1])+'。'+kEv;
const rudLine='- 博士阶段研究师长：[['+rud+'|Isadore Rudnick]]。'+rudProof;
editLine(fn(local(koj)),l=>l.startsWith('- 核查边界：'),l=>rudLine+'\n'+l);
editLine(idx,l=>l==='# 师承关系与候选线索索引',l=>l+'\n\n- [['+local(koj)+'|Haruo Kojima]] → '+rudLine.slice(2));
newMentor(rud,'Isadore Rudnick','UCLA 物理学家，研究超流氦与物理声学。'+web('NAS 原传记',k[7][0]),koj,'博士阶段研究者',rudProof);
relation(koj,'phd',rud,'stage_mentor',kEv,kSources,aidById.get(koj),false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_六校首读与两段导师核查';
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
