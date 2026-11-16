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
 a.audit_id='20261110_'+id+'_cornell_col_tex_ucsd_1301';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_cornell_col_tex_ucsd_1301_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const items=[["f246a98d","https://jila.colorado.edu/sites/default/files/group-files/2023-05/CVRey053123_0.pdf","Postdoctoral Advisor: Charles W. Clark (2004–2005) / Postdoctoral Advisor: Mikhail Lukin (2005–2008)","JILA 本人 CV 与院档核 Colorado Boulder 物理、JILA 及 NIST 任职。","量子多体、冷原子与量子模拟。","本人 CV 的 Mentors 栏明确两段博士后导师；论文封面列 Theodore R. Kirkpatrick 和 Charles W. Clark 为博士导师。",["https://jila.colorado.edu/~arey/papers/thesis.pdf","Prof. Theodore R. Kirkpatrick, Chairman/Advisor / Dr. Charles W. Clark, Advisor"],["https://www.colorado.edu/jila/ana-maria-rey","Adjoint Professor, Department of Physics, University of Colorado Boulder"]],["f2ec53c8","https://www.colorado.edu/aerospace/sites/default/files/attached-files/husseinmi_cv_2019_10_16-web_0.pdf","PhD Co-Advisors: Gregory M. Hulbert and Richard A. Scott / Postdoctoral Advisors: Vikram S. Deshpande","CU 本人 CV 和现行院档核航空航天、物理兼任及超材料。","声子、弹性波和热输运。","CV 分列 Michigan 两位博士导师、Michigan 博后 Hulbert 与 Cambridge 博后 Deshpande。",["https://www.colorado.edu/aerospace/mahmoud-hussein","Alvah and Harriet Hovlid Professor"]],["aeceb8fd","https://experts.colorado.edu/vitas/105896.pdf","Dissertation advisor: Andreas Acrivos / Research supervisors: Professor G. K. Batchelor and Dr. E. J. Hinch","CU 托管本人履历核化学与生物工程讲席。","胶体、悬浮液、流体力学及软物质。","CV 分列 1982 博士、1983 典礼与 1982–1983 Cambridge 博后，明确原有三位指导者。"],["ee2c0ec6","https://experts.colorado.edu/vitas/174294.pdf","Advised by Mikhail Lukin and Ignacio Cirac.","CU 本人 CV 及院系档核物理任职。","量子多体、量子信息和机器学习。","CV 再次确认 Harvard 与 MPHQ 同一博士后条目列 Lukin 及 Cirac 两人。",["https://www.colorado.edu/physics/xun-gao","Assistant Professor"]],["fe72b0d0","https://www.chess.cornell.edu/about/staff-directory/carl-franck","1978 - 1982: Postdoctoral Research Associate; Physics, Univ. of Virginia","Cornell CHESS 原档确认物理任职、Princeton 1978 学位论文全名及 UVA 1978–1982 博士后。","X 射线光谱、凝聚态实验及软物质。","按题名继续查 Princeton 论文指导；Schnatterly 仅为 UVA 阶段同期合著候选。"],["fa1329e3","https://chemistry.cornell.edu/david-b-zax","Professor Zax's research looks to study novel materials via solid state NMR","Cornell 院系核化学与化学生物学任职。","固体核磁、无序及聚合物材料。","Pines 自述的博士与博后混合名单列 Zax。保留旧记录的博士阶段研究师长和博士后合作者，追具体任用及论文。",["https://pines.berkeley.edu/sites/default/files/news/solid_state_nmr_some_personal_recollections_-_1996.pdf","Lyndon Emsley Antoine Llor Ago Samoson David Zax"]],["feae524a","https://cohengroup.ccmr.cornell.edu/file/289/download","Postdoctoral Researcher in Dr. David Weitz’s lab / Graduate Research Assistant in Dr. Sidney Nagel’s lab","Cornell 托管本人 CV 及物理院档核院系。","软凝聚态、胶体、复杂流体及生物物理。","CV 分列 1996–2001 Nagel 组研究生、2002–2005 Weitz 组博后；续查正式指导。",["https://physics.cornell.edu/itai-cohen","Josephson Family Professor"],["https://nagelgroup.uchicago.edu/Nagel-Group/members.html","Itai Cohen (Present address: Cornell University)"]],["ed85df09","https://thesis.caltech.edu/6256/","Advisor: Weitekamp, Daniel P.","Caltech 学位馆与 Cornell 本人组档核化学博士及 Cornell 化学与化学生物学任职。","纳米磁共振、扫描探针及薄膜。","Caltech 目录正式列 Daniel Weitekamp，博士后三名研究合作者按本人表述保留。",["https://marohn.chem.cornell.edu/pages/3-PI.html","John joined the department of Chemistry and Chemical Biology at Cornell University in 1999"]],["f2ff6a6a","https://www.duffield.cornell.edu/people/sarah-hormozi/","Sarah Hormozi received her M.Sc. in Mathematics and her Ph.D. in Mechanical Engineering from the University of British Columbia in 2011.","Cornell 现行原档确认化学与生物分子工程。","复杂流体、流变和软凝聚态。","加拿大两份学位论文下载均 cache miss，既有关系保留；继续核博士原件。Ward CV 明列博士后指导。",["https://personal.math.ubc.ca/~ward/newbio.pdf","Sarah Hormozi (summer 2013-2014)"]],["ebdac480","https://enmed.tamu.edu/wp-content/uploads/2025/05/Biosketch_Jiho-Shin_050125.pdf","Assistant Professor, Department of Chemical Engineering, Texas A&M University","Texas A&M 本人 biosketch 与院档核化工、Illinois 博士与 MIT 博后。","无机半导体、可穿戴电子与器件。","保留 Rogers 与 Kim，继续核 MIT 不同岗位精确时间。",["https://engineering.tamu.edu/chemical/profiles/shin-jiho.html","Jiho Shin"]],["f28248f3","https://artsci.tamu.edu/physics-astronomy/contact/profiles/joaquin-rodriguez-nieva.html","Postdoctoral Fellow, Harvard University (2016-2019) / Postdoctoral Fellow, Stanford University (2019-2022)","Texas A&M 现行物理院档核 MIT 2016 博士和两段博士后。","非平衡量子多体、低维电子体系及量子动力学。","Lukin 本人 CV 核 Harvard 共同指导；追其他 Harvard 与 Stanford 指导者。",["https://www.physics.harvard.edu/sites/g/files/omnuum6476/files/2025-06/Lukin_CV.pdf","Joaquin Rodriguez-Nieva*, TAMU."]],["eb812fc6","https://today.tamu.edu/expert/jodie-lutkenhaus/","Dr. Jodie Lutkenhaus explores innovative polymer materials that enable durable and sustainable energy storage.","Texas A&M 学校与高分子中心原档核化工任职。","高分子电解质、薄膜及储能。","保留 Hammond 博士和 Russell 博后原 CV 证据，继续查院校托管原件。",["https://ptc.tamu.edu/profile-jodie-l-luktenhaus/","Dr. Lutkenhaus's research interests focus on designing organic thin films and nanostructures"]],["dff04ef5","https://www.tamus.edu/research/wp-content/uploads/sites/23/2025/09/Elabd-VCR-Bio-Sept-2025.pdf","National Research Council Postdoctoral Fellow at the U.S. Army Research Laboratory","A&M System 2025 原档核科研副校长与 Texas A&M 化工讲席。","聚合物、储能和离子输运。","A&M 原档核 Johns Hopkins 博士与 Army Research Lab 博后。保留 Barbari 和 Sloan 已有导师证据，原 CV 404。",["https://ptc.tamu.edu/profile-yossef-elabd/","2001-2003 U.S. Army Research Laboratory"]],["e35f1666","https://people.tamu.edu/~feng/QIAN_Xiaofeng_CV.pdf","Advisor: Sidney Yip / 08/2011 – 06/2014 Postdoctoral Associate, Department of Nuclear Science and Engineering","Texas A&M 托管本人履历核材料科学与工程、MIT 早期岗位。","计算材料与二维量子材料。","CV 区分 MIT 2008–2011、2011–2014 两段博后及 2014 Research Scientist；保持已有 Li 与 Marzari 证据类别。"],["ec833f2d","https://physics.gatech.edu/user/chunhui-du","Associate Professor / Postdoctoral Fellow, Harvard University, 2015 – 2019","Georgia Tech 物理原档列副教授，UCSD 校属保留为历史。","量子传感、凝聚态实验、自旋输运。","原院档核 Ohio State 博士和 Harvard 博后，保留本人 CV 的 Hammel 与 Yacoby。"],["e7a37bb6","https://zhaoresearchgroup.com/people/","Distinguished Postdoctoral Fellow at Princeton University","本人组档核 UCSD 任职、MIT 博士和 Princeton 博后。","软凝聚态、相分离及活性物质。","本人页具名三位 Princeton 阶段指导关联，已有 Datta 本人 CV 的共同指导原证保留。"],["8d652467","https://quantum.ucsd.edu/wp-content/uploads/sites/10/2014/03/barreiro.pdf","PhD physics. Advisor: P. G. Kwiat. / 2009-2011 Marie-Curie postdoctoral fellow, Universit¨at Innsbruck, Austria. PI: R. Blatt","UCSD 托管本人 CV 和实验室核物理岗位。","量子模拟、超冷原子和量子信息。","CV 分列两段博士后 PI，仍按课题组；保留本人 CV 与论文题名差异。",["https://barreirolab.com/","Quantum Science"]],["3d06b9bd","https://excitonic.mit.edu/events/indirect-excitonics/","Advisor Gerhard Abstreiter. / Advisor Vladimir Kulakovskii","MIT 研讨会主办档与 UCSD 课题组核物理任职。","间接激子、量子阱和激子器件。","研讨会履历再确认 Kulakovskii 博士、Abstreiter 博后导师。",["https://butovgroup.ucsd.edu/openings.php","Butov Group"]],["f1f06c72","https://guava.physics.ucsd.edu/~nigel/Resume.html","Advisor: Prof. Sir Sam Edwards, FRS / 1982-1985 Postdoc, Insititute for Theoretical Physics, Santa Barbara","本人 UCSD 履历列物理与 MAE、Bioengineering 和 HDSI 关联。","非平衡统计物理和复杂系统。","本人履历明确博士导师 Sam Edwards 与 1982–1985 ITP 博后，继续追个人指导。"],["efcab0f7","https://www.colorado.edu/faculty/juliet-gopinath/juliet-gopinath","Alfred T. and Betty E. Endowed Professor, Department of Electrical, Computer and Energy Engineering and Department of Physics","CU 本人原档核 ECEE、物理双聘及材料相关任职。","非线性光学、激光和集成光子器件。","保留原 MIT 学位论文 Ippen；Lincoln Laboratory 为技术岗位，继续核是否另有博后。"],["f1c1e931","https://www.engineering.ucsb.edu/news/arthur-c-gossard-1935-2022","Gossard received his BA in physics from Harvard University in 1956 and a PhD in physics from UC Berkeley in 1960.","UCSB 工学院原档核材料与 ECE 历史双聘及已故状态。","分子束外延、半导体异质结构与量子器件。","UCSB 原档分列 Berkeley 博士及 1960–1987 Bell Labs 技术任职；Berkeley 校方 Portis 纪念文未明确列 Gossard，保留候选。",["https://senate.universityofcalifornia.edu/_files/inmemoriam/html/alanportis.html","join the UC physics faculty in 1957"]]];
const aidById=new Map();
const complete=new Set(['f246a98d','f2ec53c8','aeceb8fd','ee2c0ec6','ec833f2d','e7a37bb6','3d06b9bd']);
const itai='feae524a', rey='f246a98d';
const icv=items.find(a=>a[0]===itai)[1], rcv=items.find(a=>a[0]===rey)[1];
const thesis='https://jila.colorado.edu/~arey/papers/thesis.pdf';
const groups=[
 ['phd',local('334d75ce'),'博士课题组','博士课题组成员','本人 CV 分列 1996–2001 Sidney Nagel 组 Graduate Research Assistant；组档交叉确认身份。'],
 ['postdoc',local('6d11ec29'),'博士后课题组','博士后课题组成员','本人 CV 列 2002–2005 David Weitz 组 Postdoctoral Researcher。']
];
for(const [id,src,raw,aff,topic,next,...more] of items){
 const a=JSON.parse(latest.get(id).details_json), sources=[src,...more.map(([url])=>url)];
 const proof=sources.map((u,i)=>web(i?'相关原证':'原始资料',u)).join(' · ')+'。';
 const msg=proof+aff+' '+next;
 const c={affiliation:[a.aspects.affiliation.status,aff,sources],research:[a.aspects.research.status,topic,sources]};
 if(id===itai){
  c.phd=['group_or_candidate',groups[0][4],sources];
  c.postdoc=['group_or_candidate',groups[1][4],sources];
 }
 if(id===rey){
  c.phd=['confirmed_advisor','本人博士论文封面明确列 Theodore R. Kirkpatrick 为 Chairman/Advisor、Charles W. Clark 为 Advisor。',[thesis]];
  c.postdoc=['confirmed_advisor','本人 2023 CV Mentors 栏分别明确列 2004–2005 NIST/UMD 博后 Advisor Charles W. Clark、2005–2008 ITAMP/Harvard 博后 Advisor Mikhail Lukin。',[rcv]];
 }
 if(id==='fe72b0d0'){
  c.phd=['unresolved','Cornell CHESS 正文明确 1978 Princeton 博士与题名 An Inelastic Electron Scattering Investigation of the Complete 4d Shell；未注明 advisor。',[src]];
  c.postdoc=['group_or_candidate','Cornell CHESS 正文明确 1978–1982 UVA Postdoctoral Research Associate；Schnatterly 仍仅为此前合著候选。',[src]];
 }
 if(id==='f1f06c72')c.postdoc=['unresolved','本人履历确证 1982–1985 Santa Barbara ITP 博士后，未列个人指导。',[src]];
 if(id==='f1c1e931')c.postdoc=['unresolved','UCSB 工学院原档明确 1960–1987 Bell Labs 技术岗位；独立博士后待核。',[src]];
 const aid=audit(id,c,next);
 aidById.set(id,aid);
 if(complete.has(id))audits.at(-1).followup_required=false;
 const file=fn(local(id)), bound=l=>l.startsWith('- 核查边界：');
 if(fs.readFileSync(file,'utf8').split(/\r?\n/).some(bound))note(id,'- 核查边界：',msg);
 else editLine(file,l=>l==='<!-- PI-AUTO-SEARCH:START -->',l=>'- 本轮原档复核：'+msg+'\n\n'+l);
 const phd=id==='fe72b0d0'?'Princeton 1978，已核论文题名，导师待核':null;
 const post=id==='fe72b0d0'?'UVA 1978–1982 博后，S. E. Schnatterly（同期合著候选）':null;
 changeRow(id,phd,post,msg);
}
for(const [stage,target,label,reverse,ev] of groups){
 const detail=' '+web('本人 CV 第 1 页',icv)+'。'+ev;
 editLine(fn(local(itai)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+detail);
 mentorLine(target,itai,'- '+reverse+'：',detail);
 indexLine(itai,target,label,detail);
 relation(itai,stage,target,'group_leader',ev,[icv],aidById.get(itai),false);
}
for(const [stage,target,reverse,src,ev] of [
 ['phd','师承人物 - Charles W. Clark','博士生',thesis,'本人博士论文封面列 Charles W. Clark 为 Advisor。'],
 ['phd',local('2a2415ac'),'博士生',thesis,'本人博士论文封面列 Theodore R. Kirkpatrick 为 Chairman/Advisor。'],
 ['postdoc','师承人物 - Charles W. Clark','博士后研究者',rcv,'本人 CV Mentors 栏列 NIST/UMD 2004–2005 Postdoctoral Advisor Charles W. Clark。'],
 ['postdoc',local('310298e3'),'博士后研究者',rcv,'本人 CV Mentors 栏列 ITAMP-Harvard 2005–2008 Postdoctoral Advisor Mikhail Lukin。']
]){
 enrich(rey,stage,target,reverse,web(stage==='phd'?'博士论文封面':'2023 本人 CV 第 3 页',src+(stage==='phd'?'#page=1':'#page=3'))+'。'+ev);
 relation(rey,stage,target,'advisor',ev,[src],aidById.get(rey),false);
}

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_CornellColoradoTexasUCSD原档';
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
