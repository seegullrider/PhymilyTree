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
 a.audit_id='20261110_'+id+'_nyu_four_school_1240';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_nyu_four_school_1240_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const items=[["7c7f0b01","https://quantuminstitute.nyu.edu/people","Professor, Physics","NYU 物理系教授，凝聚态理论。","原始研究页具体列入凝聚态理论方向。","追 Columbia、Toronto 两段博士后的任用和指导。","https://quantuminstitute.nyu.edu/research/condensed-matter-theory"],["f4d67924","https://www.tgu-enm.sci.waseda.ac.jp/wordpress/wp-content/uploads/2022/05/Profile_Bart%E5%85%88%E7%94%9F.pdf","Postdoctoral Associate, Yale University","Waseda 研讨资料列 NYU 化学系任职、Princeton 博士及 Yale 博士后。","晶体光学、晶体生长与表征。","重读原会议 CV 的 PhD 栏；Yale 现有 McBride 组关系待查正式职衔。"],["120da522","https://alpaca-piano.squarespace.com/s/Avalos_CV_2022.pdf","2014 - 2015, Postdoctoral Fellow; Advisor: Professor Alexander Pines","NYU Quantum 名录列化学系助理教授。","固态核磁、动态核极化、金刚石缺陷自旋与光伏材料。","两阶段导师及两段博后均已读本人 CV。","https://quantuminstitute.nyu.edu/people"],["e301c4e7","https://physics.nyu.edu/pine/cvPine.pdf","David J. Pine","本人 CV 核 Cornell 博士及 Pittsburgh 与 NYU 任职历程；沿用 NYU 物理与化学和生物分子工程的现行院档。","软凝聚态与胶体。","追 Cornell 博士论文及 Pittsburgh 博后任用。Walter I. Goldburg 仅候选。"],["f01735e9","https://hockygroup.com/members/glen.html","Glen Hocky","本人课题组简介核 NYU 化学系任职。","理论与计算化学、分子模拟及软物质。","博士及两位博士后导师均已复核。"],["e9a69643","https://equs.mit.edu/joel-wang/","under Prof. Pablo Jarillo-Herrero","MIT EQuS 原档与 NYU Quantum 名录核 Harvard SEAS 学位、在 MIT 开展博士研究、现 NYU 物理任职。","超导量子器件及量子信息。","追 Harvard 学位论文署名及 MIT EQuS 博后任用原件。","https://quantuminstitute.nyu.edu/people"],["35dfbad6","https://quantuminstitute.nyu.edu/people","Mark Tuckerman Professor, Chemistry & Mathematics","NYU Quantum 名录列化学和数学。","维持现有研究方向记录及原有来源。","核 Columbia 学位论文 advisor 字段、IBM 与 Penn 博后职衔。","https://www.columbia.edu/cu/chemistry/groups/berne/alumni.html"],["f7ebe0da","https://chemistry.osu.edu/people/thomas.3877","Jonas C. Peters","OSU 化学与生物化学系简介同时确认 2006 Caltech 博士及随后 Texas A&M 博后。","无机与有机金属化学、协同催化。","博士及两位博士后指导者均已复核。"],["fb235fe6","https://www.asc.ohio-state.edu/herbert.44/jmh_cv.pdf","John M. Herbert — October 2026","本人 2026 年 10 月履历确认 OSU 化学与生物化学。","理论化学、电子结构与计算方法。","两段博士后与博士导师均已复核。"],["4b0f1ee7","https://physics.osu.edu/sites/default/files/2023-09/hammelcv.pdf#page=1","Advisor: R.C. Richardson","OSU 物理现行页面列 Emeritus Professor；本人 CV 确认 1984 Cornell 博士，随后 MIT 博士后。","实验凝聚态、磁性和磁共振力显微学。","追 MIT Waugh 博后正式指导称谓。","https://physics.osu.edu/people/hammel.7"],["e313351a","https://people.engineering.osu.edu/people/reano.1","Professor, Electrical and Computer Engineering","OSU 工学院页面核 ECE、Michigan 2004 博士。","纳米光子器件与集成光学。","核 Michigan 博士论文正式指导分工及 Pang 博后职衔。","https://opticalscience.osu.edu/sites/spectroscopy.osu.edu/files/CV_Reano.pdf"],["f3d5c4d8","https://physics.osu.edu/people/lu.1435","Boston College","OSU 物理原档核 2011 Boston College 博士。","理论凝聚态及量子多体。","核 LBNL 2011–2014 博后指导者的正式职衔。"],["ac7b25a6","https://mse.osu.edu/people/ji.730","postdoctoral scholar (2019-2021)","OSU 材料系及本人 CV 均分列 2019–2021 Penn State 博后与 2021–2023 助理研究教授。","计算材料学与微结构演化。","追 Penn State 博后原任用资料，保留 Chen 候选。","https://people.engineering.osu.edu/media/document/2024-02-05/yanzhouji_cv_deptweb.pdf"],["f93ba010","https://chemistry.osu.edu/people/wu.531","Peidong Yang","OSU 化学与生物化学系原档确认 2003 Berkeley 博士及随后 UCSB 博士后。","固态化学、光电化学与功能材料。","继续核 Berkeley 学位记录及 UCSB 博士后正式 advisor。"],["ec418ece","https://www.chem.purdue.edu/people/profile/awasser","Rutgers University","Purdue 化学系和 Rutgers 论文原文核 2005 博士、Harvard 博后及化学系任职。","密度泛函理论和量子化学。","追 Harvard 博后正式指导及 Purdue 是否现仍兼聘物理。","https://dft.uci.edu/theses/adam.pdf"],["ed2022ef","https://www.physics.purdue.edu/nlo/publications/vitae.Nolte.pdf","David D. Nolte","Purdue 本人 CV 核 1988 Berkeley 博士、1988–1989 Bell Labs 博士后。","光学、生物光子学及光谱表征。","追 Berkeley 学位论文正式导师字段，区分 Berkeley Lab research assistant 职衔。"],["e681be46","https://www.physics.purdue.edu/people/faculty/csathy.php","Department Head","现行 Purdue 物理与天文系原档列教授兼系主任；院系任职档核 Penn State 博士。","二维电子、分数量子霍尔与低维固体相。","追 Penn State 学位档和 Princeton 职位类型，保留 Chan 候选与 Tsui 组。","https://www.physics.purdue.edu/docs/interactions/PhysicsInteractions_2006.pdf"],["e9b987c0","https://quantum.research.purdue.edu/directory/tyler-ellison/","Assistant Professor of Physics and Astronomy","Purdue Quantum 名录核物理与天文系。","量子物态启发的容错量子纠错。","Yale 本人大会档复核 Meng Cheng；另查 Perimeter 博后指导。","https://www.colorado.edu/conference/bss/tyler-ellison"],["e4b06ce7","https://www.chem.purdue.edu/people/profile/vwalther.html","Valentin Walther","Purdue 化学系原档与 Harvard ITAMP 个人页核岗位及培训时间。","理论原子分子光物理与里德堡系统。","分别核 Dresden 颁授、Aarhus 研究地点及 Harvard ITAMP 指导。","https://lweb.cfa.harvard.edu/itamp-people/valentin-walther"],["fd419157","https://cbe.rpi.edu/sites/default/files/speaker-files/2021/12.1.21%20You-Yeon%20Won.pdf","You-Yeon Won","RPI 报告者机构原档确认 Purdue 化学工程、Minnesota 2000 博士、MIT 2000–2001 及 Harvard 2001–2003 两段博后。","高分子物理、胶体自组装与功能纳米材料。","Purdue 工程主机退避，保留旧记录，另追正式博士和两段博后指导原件。"],["fedc3720","https://web.ics.purdue.edu/~chen658/Web%20CV_Zhihong%20Chen_050122.pdf","Zhihong Chen","Purdue 本人 CV 核 ECE 与 Birck、Florida 博士及 IBM 博后与后续技术岗位。","纳米电子、碳基电子器件。","追 IBM 2004–2006 博士后具体指导。"],["f7564d45","https://www.bnl.gov/staff/frenkel","Post-Doctoral Fellow (Physics), University of Washington","BNL 原档核 2026 年起 SBU 材料科学与化学工程系主任兼 BNL Senior Chemist。","功能纳米材料、同步辐射谱学及原位催化。","博士及博士后导师均已复核。"],["ef189e20","https://www.stonybrook.edu/matsci-chemeng/faculty/david_sprouster.html","Ph.D. in Physics from The Australian National University in 2010","SBU 材料与化工原档确认 2010 ANU 物理博士，并另列后来 SBU 和 MIT 联合研究职位。","同步辐射及中子多模态表征、核材料。","追 ANU 博士论文原件与博士后任用，保留两位博士导师候选。"],["f1e14bea","https://www.stonybrook.edu/matsci-chemeng/faculty/dilip_gersappe.html","Ph.D. Department of Materials Science and Engineering, 1992","SBU 原档核材料科学与化学工程、Northwestern 1992 博士及 Johns Hopkins 博后；2026 BNL 原档将系主任列为 Frenkel。","高分子模拟、纳米复合材料与膜。","Olvera de la Cruz 本人 CV 的历届研究生名单具名列 1992 年论文及学位。续查签署页或正式指导字段，以及 Johns Hopkins、Pittsburgh 两处经历。","https://www.bnl.gov/staff/frenkel","https://aztec.tech.northwestern.edu/pdf%20files/pi/Olvera_CV_7.10.2025%20copy.pdf#page=1"],["e9867d8e","https://sites.google.com/view/han-ma","Han Ma","本人履历及 Perimeter 现行名录列 CNRS，École Polytechnique CPHT 研究组亦列本人。SBU 2025–2026 任期保留为历史，SBU 网页仍列助理教授，是否还有兼任待核。","理论凝聚态、拓扑序及量子多体。","Perimeter 基金档案核 2019 年 5 月至 2024 年 5 月独立博后 fellowship，Sung-Sik Lee 仅合作线索。追导师与是否有 SBU 兼任。","https://www.stonybrook.edu/physics/people/_profiles/mah.html","https://perimeterinstitute.ca/people/han-ma","https://portail.polytechnique.edu/cpht/en/research/condensed-matter","https://perimeterinstitute.ca/named-postdoctoral-fellowships"],["ff24fe45","https://mengkun.weebly.com/uploads/3/9/6/5/39652852/curriculum_vitae_mengkun_full.pdf","Broadband infrared near-field microscopy and spectroscopy","本人 CV 核 SBU 物理任职履历和训练机构。","关联电子材料、红外近场及超快谱学。","UCSB 既有原档确认 Averitt 博士导师和 Basov 博后组；继续核博士后正式导师。"],["833f08e5","https://www.stonybrook.edu/matsci-chemeng/faculty/tadanori_koga.html","Post-Doctoral Research Fellow, SUNY at Stony Brook (Prof. B. Chu), 1998- 2000.","SBU 材料科学与化工原档分列 1998 Kyushu 博士、1998–2000 SBU 博后及其后研究员。","高分子薄膜、界面与散射。","原院系条目仅给 Prof. B. Chu，保持博后候选直至全名及正式职衔复核。"],["f461e32a","https://bpb-us-e1.wpmucdn.com/you.stonybrook.edu/dist/0/6755/files/2024/07/Thesis-Tzu-Chieh-Wei.pdf","my advisor, Prof. Paul Goldbart","SBU 物理原档核任职与 Illinois、Waterloo、UBC 博士后或研究经历。","量子信息、量子纠缠及多体系统。","论文致谢确证 Goldbart，明确称 Kwiat 为 mentor。续查三段博士后或研究岗位各自指导。","https://www.stonybrook.edu/physics/people/_profiles/weit.html"],["ef622c13","https://www.ices.utexas.edu/news-and-events/news/james-chelikowsky-retirement/","Marvin Cohen","2026 UT Oden 退休访谈核物理、化工及 Oden 任职历史，分列 Berkeley 博士和随后 Bell Labs 博士后。","计算材料、电子结构及硅表面。","查 Bell Labs 博士后岗位负责人；保留 Berkeley Marvin Cohen 博士导师。"],["efa243d8","https://experts.utexas.edu/sanjay_banerjee","Member of Technical Staff","UT Experts 核 ECE、1983 UIUC 博士及 Texas Instruments 1983–1987 技术岗位。","半导体、纳米电子和微电子。","UIUC 既有原档确证 Streetman；UT 履历未单列博后，保留阶段待核。"]];
const stampId='20261110_NYU与四校续查';
const proofs=new Map();
const updates={
 '120da522':{phd:['confirmed_advisor','本人 CV 明确 2014 UC Berkeley 化学博士的 Advisor 为 Alexander Pines。'],postdoc:['confirmed_advisor','本人 CV 分列 2014–2015 Lawrence Berkeley Lab 博后 Advisor Alexander Pines、2016–2020 EPFL 博后 Advisor Lyndon Emsley；2020–2021 EPFL Staff Scientist 另列。']},
 'e9a69643':{phd:['confirmed_advisor','旧本人任职公告明确称 thesis advisor。MIT EQuS 官方简介独立明确博士研究在 MIT 由 Pablo Jarillo-Herrero 指导，学位为 Harvard SEAS。']},
 '35dfbad6':{phd:['group_or_candidate','本人著作序言说 Bruce Berne 在 Columbia 博士阶段 mentoring；Berne 组校友档辅助核身份。正式论文导师字段待查。'],postdoc:['group_or_candidate','本人著作序言分别确认 Michele Parrinello（IBM）和 Michael L. Klein（Penn）的 mentoring，正式职位称谓待核。']},
 'f1e14bea':{phd:['group_or_candidate','导师候选本人履历的历届研究生及授位名单列 1992 年 4 月 PhD 和论文 Statistics and Dynamics of Polymers in Topologically Restricted Environments；维持博士课题组。']},
 'e9867d8e':{postdoc:['group_or_candidate','Perimeter 官方 fellowship 名单明确 2019 年 5 月至 2024 年 5 月，合著及年报交流线索不足以确认 Sung-Sik Lee 为正式导师。']},
 'f461e32a':{phd:['confirmed_advisor','2004 年 Illinois 学位论文致谢明确 Paul Goldbart 为 advisor；随后另称 Paul Kwiat 为 mentor。']},
 'ef622c13':{postdoc:['unresolved','UT Oden 2026 退休访谈独立确认 Berkeley 博士后进入 Bell Labs 做博士后，未具名个人导师。']},
 'efa243d8':{postdoc:['unresolved','UT Experts 列 1983–1987 为 Texas Instruments 技术岗位，未单列博士后。保留是否有博士后待核。']}
};
const clear=new Set(['120da522','f01735e9','f7ebe0da','fb235fe6','f7564d45']);
for (const [id,src,raw,aff,topic,next,...more] of items) {
 const a=JSON.parse(latest.get(id).details_json);
 const srcs=[src,...more];
 const proof=srcs.map((url,i)=>web(i===0?'原始资料':'相关原证',url)).join(' · ')+'。';
 const evidence=proof+aff+' '+next;
 const stages=updates[id]??{};
 const c={
  affiliation:[a.aspects.affiliation.status,aff,srcs],
  research:[id==='35dfbad6'?a.aspects.research.status:'confirmed',id==='35dfbad6'?a.aspects.research.note:topic,srcs],
 };
 for (const [stage,[status,description]] of Object.entries(stages))c[stage]=[status,description,srcs];
 const aid=audit(id,c,next);
 if(clear.has(id))audits.at(-1).followup_required=false;
 proofs.set(id,{proof,aid,src});
 if(id==='120da522'||id==='e9a69643'){
  editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+evidence);
 }else note(id,'- 核查边界：',evidence);
 const phd=id==='120da522'?'Alexander Pines（明确导师）':null;
 const post=id==='120da522'?'Alexander Pines（2014–2015 Lawrence Berkeley Lab）、Lyndon Emsley（2016–2020 EPFL），均为明确导师':
  id==='4b0f1ee7'?'John S. Waugh（MIT 博士后阶段研究师长）':null;
 changeRow(id,phd,post,evidence);
}
const aval='120da522';
const avalPines='师承人物 - Alexander Pines', avalEmsley='师承人物 - Lyndon Emsley';
const {proof:avp,aid:ava,src:avurl}=proofs.get(aval);
const avproof=web('本人 CV 第 1 页',avurl)+'。';
const pPhD=avproof+'2014 UC Berkeley 化学博士条目明确 Advisor 为 Alexander Pines。';
const pPD=avproof+'2014–2015 Lawrence Berkeley Lab 博士后条目明确 Advisor 为 Alexander Pines。';
const ePD=avproof+'2016–2020 EPFL 博士后条目明确 Advisor 为 Lyndon Emsley。';
for(const [stage,target,oldLabel,oldReverse,newLabel,newReverse,detail] of [
 ['phd',avalPines,'博士阶段研究师长','博士阶段研究成员','博士导师','博士生',pPhD],
 ['postdoc',avalEmsley,'博士后阶段研究师长','博士后阶段研究成员','博士后导师','博士后研究者',ePD]
]){
 replaceNoteLabel(aval,oldLabel,newLabel,target,' '+detail);
 replaceInverseLabel(target,aval,oldReverse,newReverse,' '+detail);
 replaceIndexLabel(aval,target,oldLabel,newLabel,' '+detail);
 relation(aval,stage,target,'advisor',detail,[avurl],ava,false);
}
addEdge(aval,'博士后导师',avalPines,'Alexander Pines',pPD,avalEmsley);
inverse(aval,avalPines,'博士后研究者',pPD);
relation(aval,'postdoc',avalPines,'advisor',pPD,[avurl],ava,false);
const joel='e9a69643', jo=proofs.get(joel), mentor=local('0eae5986');
const joProof=web('MIT EQuS 本人介绍',jo.src)+'。在 Harvard SEAS 获学位，博士研究在 MIT 由 Pablo Jarillo-Herrero 指导。';
enrich(joel,'phd',mentor,'博士生',joProof);
relation(joel,'phd',mentor,'advisor',joProof,[jo.src],jo.aid,false);
const wei='f461e32a', w=proofs.get(wei);
const weiProof=web('Illinois 学位论文可读原文',w.src)+'。致谢明确称 Paul Goldbart 为其 advisor，并说明博士课题指导。';
enrich(wei,'phd',local('45436224'),'博士生',weiProof);
relation(wei,'phd',local('45436224'),'advisor',weiProof,[w.src],w.aid,false);
const han='e9867d8e';
const hanSources=items.find(x=>x[0]===han);
const affHan=web('本人履历',hanSources[1])+'、'+web('Perimeter 现行名录',hanSources[7])+'及'+web('CPHT 凝聚态组',hanSources[8])+'均支持现为法国 CNRS／École Polytechnique。保留 Stony Brook 2025–2026 历史任期，SBU 页面仍列任职，兼任或招生状态待核。';
editLine(fn(local(han)),l=>l.startsWith('- [Stony Brook 教师页]'),()=>'- '+affHan);
editLine(path.join(root,'Stony Brook逐人复核记录.md'),l=>l.startsWith('| [['+local(han)+'|'),l=>l.replace('Physics and Astronomy；','Physics and Astronomy（2025–2026 历史任期）；'));

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_NYU与四校续查';
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
