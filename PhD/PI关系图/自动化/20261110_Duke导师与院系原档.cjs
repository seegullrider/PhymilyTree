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
 a.audit_id='20261110_'+id+'_duke_original_1112';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_duke_original_1112_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const du=["https://today.duke.edu/showcase/mmedia/features/newfaculty/chang.html","https://dmi.duke.edu/people/faculty/benjamin-wiley","https://schmidtlab.phy.duke.edu/people/","https://ece.duke.edu/people/crystal-noel/","https://dmi.duke.edu/people/faculty/joshua-socolar","https://fitzpatrick.duke.edu/faculty/kenneth-brown","https://medschool.duke.edu/profile/michael-j-therien","https://fitzpatrick.duke.edu/faculty/michael-rubinstein","https://mems.duke.edu/people/simon-divilov-ph-d/","https://mems.duke.edu/people/stefan-zauscher/","https://scholars.duke.edu/person/stefano.curtarolo","https://aims.pratt.duke.edu/volker-blum"], extra=["https://www.phys.sinica.edu.tw/~tywufund/download/camp/2010/cv/cv_camp2010_AlbertMChang.pdf","https://scholars.duke.edu/person/albert.chang","https://people.duke.edu/~bjw24/cv.pdf","https://depts.washington.edu/gemsec/publications/pdfs/Xia-Ag-JPCB-Feature-Article.pdf","https://zauscherlab.pratt.duke.edu/sites/zauscherlab.pratt.duke.edu/files/2024/Vitae_SZ_September_2024_w_research.pdf","https://schmidtlab.phy.duke.edu/files/2018/08/Schmidt_CV_website.pdf","https://chem.unc.edu/wp-content/uploads/2020/12/rubinstein_cv.pdf","https://iacs.stonybrook.edu/people/_alumni/Simon-Divilov","https://paulsteinhardt.org/wp-content/uploads/2020/10/QuasiPartII.pdf"], further=["https://www.degruyterbrill.com/document/doi/10.1515/9783110239546.233/pdf","https://repositorio.uam.es/bitstream/handle/10486/718338/memoria_ciencias_dfmc_2020.pdf?isAllowed=y&sequence=1","https://almanac.upenn.edu/archive/v49pdf/030401/040103.pdf","https://asset.library.wisc.edu/1711.dl/2STV22WKP2QPH8L/R/file-96aa7.pdf","https://fds.duke.edu/db/pratt/mems/faculty/zauscher/files/cv.pdf","https://pmc.ncbi.nlm.nih.gov/articles/PMC4317057/","https://journals.aps.org/prb/abstract/10.1103/PhysRevB.34.617","https://chem.duke.edu/people/benjamin-j-wiley"], third=["https://collaborate.princeton.edu/en/publications/electron-tunneling-in-cytochrome-c/","https://repositorio.uam.es/bitstream/handle/10486/703091/8972668ps.pdf?sequence=1","https://www.academia.edu/145035024/6_Current_Era","https://www.colorado.edu/faculty/zunger-matter-by-design/alumni","https://news.mit.edu/2003/datamining-1119","https://today.duke.edu/2008/12/curtarolo.html"];
const chang='c098ec44', wiley='eed3f231', schw='f2072b48', sch='000373bc', noel='fa3ea2fc', soc='ef5eb10a', brown='e1b045b8', ther='fc878b29', rub='e65d6842', div='89bf70a2', zaus='f5ba3a09', cur='edc6794c', blum='f5975e1f', br='6080cc82';
const replaceBoundary=(id,body)=>editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+body);
const u=(label,url)=>web(label,url)+'。';
function enrichStage(id,target,label,reverse,proof){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+proof);
 mentorLine(target,id,'- '+reverse+'：',proof);
 indexLine(id,target,label,proof);
}
const y=local('4a546812'), white='师承人物 - George M. Whitesides';
const wcv=extra[2], wprofile='https://scholars.duke.edu/person/benjamin.wiley';
const wph='本人 CV 第 1 页列 2007-06 Washington 化工博士，2003–2007 研究项目条目明确为 Younan Xia 指导，并给出本人博士论文题名。';
const wp='同页将 2007–2009 Harvard Postdoctoral Research Fellow 的 Advisor 明列 George M. Whitesides。';
const wref=u('Duke 托管本人 CV 第 1 页',wcv);
for(const [stage,target,old,now,revOld,revNow,proof] of [
 ['phd',y,'博士阶段研究师长','博士导师','博士阶段研究者','博士生',wph],
 ['postdoc',white,'博士后课题组负责人','博士后导师','博士后课题组成员','博士后研究者',wp]
]){
 replaceNoteLabel(wiley,old,now,target,' '+wref+proof);
 replaceInverseLabel(target,wiley,revOld,revNow,' '+wref+proof);
 replaceIndexLabel(wiley,target,old,now,' '+wref+proof);
}
const wf='Duke 当前校档列化学系教授、创新与创业研究生教育主管。2018 年本人 CV 另列机械工程与材料科学系曾为兼任，当前校档未列该兼任。';
replaceBoundary(wiley,wref+wph+wp+u('Duke 当前任职',wprofile)+wf);
changeRow(wiley,'Younan Xia（本人 CV 列博士 Advisor）','George M. Whitesides（2007–2009 Harvard，本人 CV 列 Advisor）',wref+u('Duke 当前任职',wprofile));
const wa=audit(wiley,{phd:['confirmed_advisor',wph,[wcv,extra[3]]],postdoc:['confirmed_advisor',wp,[wcv]],affiliation:['confirmed',wf,[wprofile,wcv]],research:['confirmed','Duke 材料原档核溶液合成纳米材料、等离激元及电子学。',[du[1],wprofile]]},'博士及博士后个人指导已有本人 CV 明确证据；若机械工程兼任更新，按当前校档增量核验。');
audits.at(-1).followup_required=false;
relation(wiley,'phd',y,'advisor',wph,[wcv],wa,false);
relation(wiley,'postdoc',white,'advisor',wp,[wcv],wa,false);

const austin='师承人物 - Robert H. Austin';
const ct='Duke 校刊称 Princeton 博士后在 Daniel Tsui 实验室，并与 Horst Störmer 密切工作。中研院托管履历列 1982–1984 年 Princeton 电气工程博后，Duke 学位档及中研院履历均列 1983 博士；校刊称毕业后任博后。起始年份交叠保留。';
const cap=u('Duke 校刊',du[0])+u('中研院托管履历',extra[0])+u('Duke 学位档',extra[1]);
const caustin='Princeton 出版原档列 Albert M. Chang 与 Robert H. Austin 共同发表 1982 年电子隧穿论文，时间在 1983 年授位前，也可能与所列博后起点重叠。暂作博士阶段低可信候选，具体阶段、组属及指导职衔待核。';
const caustP=u('Princeton 出版原档',third[0])+u('Duke 学位档',extra[1])+caustin;
addEdge(chang,'博士导师候选',austin,'Robert H. Austin',caustP,null,true);
newMentor(austin,'Robert H. Austin','Princeton 出版原档关联物理和材料研究所。'+u('原始出版档',third[0]),chang,'博士候选研究者',caustP);
replaceBoundary(chang,cap+ct+' '+caustin);
changeRow(chang,'Princeton 1983 博士；Robert H. Austin（低可信候选）','Princeton 电气工程博后，Daniel C. Tsui（课题组负责人）；起点待核',cap+u('1982 Princeton 出版原档',third[0]));
const ca=audit(chang,{phd:['group_or_candidate',caustin,[third[0],extra[1]]],postdoc:['group_or_candidate',ct,[du[0],extra[0],extra[1]]],research:['confirmed','Duke 校刊及中研院原履历核量子点、分数量子霍尔和低维量子输运。',[du[0],extra[0]]]},'查 Princeton 1983 博士论文与任命记录，区分出版年份、博后起点和正式个人指导。');
relation(chang,'phd',austin,'candidate',caustin,[third[0],extra[1]],ca);

const cvSch=extra[5], schtext='本人 CV 分列 TUM 1988–1989、Harvard 1989–1992、Rowland 1991–1992 三段有重叠的博士后任职，Harvard 1992–1993 Research Associate 另列。本人课题组列 Duke 物理、生物、BME、MEMS 任职。';
for(const id of [schw,sch]){
 const schproof=u('本人 CV',cvSch)+u('Duke 本人课题组',du[2])+schtext;
 note(id,'- 核查边界：',schproof);
 changeRow(id,null,id===schw?'TUM、Harvard、Rowland 博后；阶段合作者见同人主记录，个人导师待核':null,schproof);
 audit(id,{postdoc:['group_or_candidate',schtext+' 同一人物主记录保留 Göttingen 组传记所述四人阶段合作，个人正式导师待核。',[cvSch]],affiliation:['confirmed','本人 Duke 课题组 PI 栏列物理、生物、生物医学工程和机械工程与材料科学。',[du[2]]]},'复核三段职位的个人指导及重叠原因，保留两条校属记录的既有同一人判定。');
}

const ns='Duke ECE 原档明确电气与计算机工程助理教授、量子中心成员、2019 Berkeley 博士；研究离子阱量子计算及模拟、集成光子学与表面噪声。既有物理任职保留原依据，学位签署页待退避后复核。';
note(noel,'- 核查边界：',u('Duke ECE 原档',du[3])+ns);
changeRow(noel,null,null,u('Duke ECE 原档',du[3]));
audit(noel,{affiliation:['confirmed',ns,[du[3]]],research:['confirmed',ns,[du[3]]]},'待 eScholarship 主机退避后重读学位论文，另查 Monroe 博后正式指导措辞。');

const ss='Duke 材料院档列 1987 UPenn 博士和同年获 Harvard Society Junior Fellowship。1986 APS 原论文显示 Socolar 与 Steinhardt 均列 UPenn 物理系合作，保持既有博士阶段研究师长标签。Junior Fellow 的个人指导者待查。';
const sp=u('Duke 材料院档',du[4])+u('1986 APS 原论文',further[6]);
note(soc,'- 核查边界：',sp+ss);
changeRow(soc,null,'Harvard Junior Fellow（起于 1987）；岗位细分与个人导师待核',sp);
audit(soc,{postdoc:['unresolved',ss,[du[4]]],research:['confirmed','Duke 原档核准晶、胶体自组装、颗粒体系、机械晶格拓扑弹性。',[du[4]]]},'按博士论文题名追查 UPenn 学位原件，并查 Harvard Junior Fellow 任期研究记录和导师角色。');

const bs='Fitzpatrick 原档列 ECE、物理、化学教授及 Duke Quantum Center 主任，研究量子纠错、控制、体系结构和离子阱。';
note(brown,'- 核查边界：',u('Duke Fitzpatrick 原档',du[5])+bs);
changeRow(brown,null,null,u('Duke Fitzpatrick 原档',du[5]));
audit(brown,{affiliation:['confirmed',bs,[du[5]]],research:['confirmed',bs,[du[5]]]},'保留本人 CV 明列的博士及博士后导师，按最新原档增量核验现职。');
audits.at(-1).followup_required=false;

const tt='UPenn 校刊记 1987 年 UCSD 博士后赴 Caltech 三年任 NIH Postdoctoral Research Fellow；本人共同署名综述作者履历列 Gray 为该训练阶段研究师长，并将 UCSD 博士研究与 Trogler 并列。Duke 医学院档列化学教授及 Duke Cancer Institute 成员。';
const tp=u('UPenn 2003 校刊',further[2])+u('本人共同署名综述',further[5])+u('Duke 原档',du[6]);
enrichStage(ther,'师承人物 - Harry B. Gray','博士后阶段研究师长','博士后研究者',tp+tt);
note(ther,'- 核查边界：',tp+tt);
changeRow(ther,null,'Caltech NIH 博后约 1987–1990；Harry B. Gray（博士后阶段研究师长）',tp);
const ta=audit(ther,{postdoc:['group_or_candidate',tt,[further[2],further[5]]],affiliation:['confirmed','Duke 原档核化学教授及 Cancer Institute 成员。',[du[6]]],research:['confirmed','本人综述作者履历核分子与纳米尺度的光物理、电子转移、光谱及材料。',[further[5]]]},'查 UCSD 论文签署页及 Caltech 个人指导明确称谓；保留既有 Trogler 博士标签和来源。');
relation(ther,'postdoc','师承人物 - Harry B. Gray','stage_mentor',tt,[further[2],further[5]],ta,false);

const rt='本人 CV 第 1 页明确 1983 Harvard 物理博士 research advisor David R. Nelson，1983–1985 AT&T Bell Labs 博后，1985–1995 Kodak Research Scientist；未点名博后指导。Duke Fitzpatrick 原档核 MEMS、物理、化学及生医工程，研究高分子理论和模拟。';
const rp=u('本人 CV 第 1 页',extra[6])+u('Duke Fitzpatrick 原档',du[7])+rt;
enrich(rub,'phd',local('4c312119'),'博士生',rp);
note(rub,'- 核查边界：',rp);
changeRow(rub,null,'AT&T Bell Labs 博后（1983–1985）；Eugene Helfand（共事及候选）',rp);
const ra=audit(rub,{phd:['confirmed_advisor',rt,[extra[6]]],postdoc:['group_or_candidate',rt+' 原 RSC 共事线索保持候选。',[extra[6]]],affiliation:['confirmed',rt,[du[7]]],research:['confirmed',rt,[du[7]]]},'查 1983–1985 Bell Labs 项目档及本人叙述的个人指导，区分 1985 起 Kodak 岗位。');
relation(rub,'phd',local('4c312119'),'advisor',rt,[extra[6]],ra,false);

const sol='师承人物 - José María Soler Torroja';
const dst='UAM 凝聚态物理系 2020 年报第 27 页将 Divilov 列为 SIESTA-UAM 研究人员，Soler Torroja 列为项目负责人。UAM 保存的 2021 原论文作者单位亦相合。结合 Stony Brook 的 UAM 博后去向记录，列低可信博后导师候选；项目角色及合著均未明确个人指导。';
const dsp=u('UAM 2020 年报第 27 页',further[1])+u('UAM 原论文',third[1])+dst;
editLine(fn(local(div)),l=>l.startsWith('- 另一段博士后经历：'),l=>l+'\n- 博士后导师候选：[['+sol+'|José María Soler Torroja]]。'+dsp);
const cidx=path.join(root,'师承候选线索索引.md');
editLine(cidx,l=>l==='# 师承候选线索索引',l=>l+'\n- [['+local(div)+'|Simon Divilov]] → 博士后导师候选：[['+sol+'|José María Soler Torroja]]。'+dsp);
newMentor(sol,'José María Soler Torroja','UAM 凝聚态物理系年报列 SIESTA-UAM 项目负责人。'+u('UAM 年报',further[1]),div,'博士后候选研究者',dsp);
changeRow(div,null,'UAM Madrid 博后：José María Soler Torroja（低可信候选）；Duke 博后：Stefano Curtarolo（课题组负责人）',dsp+u('Duke MEMS 原档',du[8]));
const da=audit(div,{postdoc:['group_or_candidate',dst+' 保留 Duke Curtarolo 博后课题组关系。',[further[1],third[1]]],affiliation:['confirmed','Duke MEMS 原档列 Assistant Research Professor，个人独立招生资格仍待查。',[du[8]]]},'查 UAM 博后聘任及个人指导，核对 UAM 任期与 2021 Duke 阶段衔接。');
relation(div,'postdoc',sol,'candidate',dst,[further[1],third[1]],da);

const zt='本人 CV 列 2000 Wisconsin 材料博士，2000-09 起任 Duke 助理教授，所阅任职栏未分列独立博后。Wisconsin 校存论文的参考文献给出 Zauscher 2000 年论文题名 Polymer mediated surface interactions in pulp fiber suspension rheology。Daniel J. Klingenberg 为现有候选，签署页待查。';
const zp=u('本人 CV 前两页',extra[4])+u('Wisconsin 论文参考文献',further[3])+zt;
note(zaus,'- 核查边界：',zp);
changeRow(zaus,null,'2000-09 起 Duke 助理教授；所阅 CV 未分列独立博士后',zp);
audit(zaus,{phd:['group_or_candidate',zt,[extra[4],further[3],further[4]]],postdoc:['no_postdoc_documented',zt,[extra[4]]],affiliation:['confirmed','本人 CV 核 MEMS、化学及生物医学工程任职。',[extra[4]]]},'按已定位题名查 Wisconsin 学位馆藏与签署页，核对 Klingenberg 正式角色。');

const curt='2003 年 11 月 MIT 原报道已称 Curtarolo 为 Duke 助理教授，并列 MIT 博士同年；Duke 原报道与本校履历一致。现有资料未分列独立博后，明确把同一报道中的 MIT 博后职位留给该文所指的 Kristin Persson。';
const cup=u('MIT 2003 原报道',third[4])+u('Duke 历史资料',third[5])+u('Duke 现职原档',du[10])+curt;
note(cur,'- 核查边界：',cup);
changeRow(cur,null,'2003 同年 MIT 博士及 Duke 助理教授；所阅原档未分列独立博士后',cup);
audit(cur,{postdoc:['no_postdoc_documented',curt,[third[4],third[5]]],affiliation:['confirmed','Scholars@Duke 当前任职列 MEMS、ECE 与 Center for Extreme Materials。2008 历史资料另记当时物理任职。',[du[10],third[5]]],research:['confirmed','本校档核计算材料、AI 材料设计、高熵与无序材料。',[du[10]]]},'增量查本人最早任命档，若有单列独立博士后阶段，再按其原称谓和角色核实。');

const heinz='师承人物 - Klaus Heinz', zunger=local('23076914');
const bph='Fritz Haber Institute 历史章节 Theory Department 的可读镜像明确写 2001 Erlangen 物理博士及 adviser Klaus Heinz，Duke 本人组档独立确认授位单位和年份。';
const bpost='Zunger 本人组档的 Advised by Alex Zunger 栏列 Volker Blum；Duke 本人组档明确其 2002–2004 NREL Solid State Theory Group 为 Postdoctoral Researcher。2004 年后 FHI Scientist 另列。';
enrich(blum,'phd',heinz,'博士生',u('FHI 历史章节镜像',third[2])+bph);
enrich(blum,'postdoc',zunger,'博士后研究者',u('Colorado 本人组档',third[3])+u('Duke 本人组档',du[11])+bpost);
note(blum,'- 核查边界：',u('FHI 历史章节可读镜像',third[2])+u('Duke 本人组档',du[11]));
changeRow(blum,'Klaus Heinz（FHI 历史章节列 adviser）','Alex Zunger（NREL 2002–2004，指导者名单）',u('FHI 历史章节镜像',third[2])+u('Duke 本人组档',du[11])+u('Zunger 本人组档',third[3]));
const ba=audit(blum,{phd:['confirmed_advisor',bph,[third[2],du[11]]],postdoc:['confirmed_advisor',bpost,[third[3],du[11]]],affiliation:['confirmed','Duke 本人组档列 MEMS 主聘与化学兼任。',[du[11]]]},'已复核两阶段导师。可增量追查 Erlangen 学位签署页，以及与本人组档相符的原始任命时间。');
audits.at(-1).followup_required=false;
relation(blum,'phd',heinz,'advisor',bph,[third[2],du[11]],ba,false);
relation(blum,'postdoc',zunger,'advisor',bpost,[third[3],du[11]],ba,false);

const brid='https://exafs.ucsc.edu/people/';
const brt='本人组档列 UCSC Research Professor of Physics、1968 UC San Diego 博士、1976–1977 和 1979 Humboldt Fellowship；组档未说明这些 fellowship 是博士后。凝聚态实验研究使用先进 X 射线谱。';
note(br,'- 核查边界：',u('UCSC 本人组档',brid)+brt);
changeRow(br,'1968 UC San Diego 博士；个人导师待核','Humboldt Fellowship 1976–1977、1979；岗位性质与个人指导待核',u('UCSC 本人组档',brid)+brt);
audit(br,{affiliation:['confirmed',brt,[brid]],research:['confirmed',brt,[brid]],phd:['unresolved',brt,[brid]],postdoc:['unresolved',brt,[brid]]},'查 UCSD 1968 论文及早期任命，Humboldt fellowship 与独立博后分别核。');


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Duke导师与院系原档';
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
