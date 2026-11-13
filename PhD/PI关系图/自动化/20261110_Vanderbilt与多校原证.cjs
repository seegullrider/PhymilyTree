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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0834';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0834_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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




const van='08306a21', sin='fe864663', rui='05956802', brad='e5755be3', dan='ba0da93c', frank='082dd662', ken='0bf18cb0', lewis='fe74aee4';
const jo='人员 - MIT - John D. Joannopoulos — 纪念条目 - cbedf46d', lou='人员 - UC Berkeley - Steven Louie（荣休） - 3253eda8', tay='师承人物 - Antoinette J. Taylor', suo='人员 - Harvard - Zhigang Suo - 7a1a04af', neil='师承人物 - Neil Harrison', df='人员 - MIT - Danna Freedman - b5c07133';
const th='https://www.physics.rutgers.edu/~dhv/pubs/local_preprint/dv_thesis.pdf', vc='https://www.physics.rutgers.edu/~dhv/cv.html', vp='https://www.physics.rutgers.edu/~dhv/pubs/pub_list.html', vl='https://journals.aps.org/prb/abstract/10.1103/PhysRevB.29.7099';
const nd='https://ee.nd.edu/faculty/ranjan-singh/', nt='https://web.spms.ntu.edu.sg/~ranjans/prof.html', st='https://ceat.okstate.edu/labs/utol/site_files/site_files/documents/phd-theses/11_ranjan_thesis.pdf', cint='https://cint.lanl.gov/meet-cint/meet-cint-antoinette-taylor.shtml', opt='https://opg.optica.org/abstract.cfm?uri=QELS-2011-QTuD2';
const aam='https://www.aamech.org/wp-content/uploads/2017/10/Rui-Huang.pdf', ut='https://ae.utexas.edu/person/rui-huang/', suoCV='https://suo.seas.harvard.edu/people/zhigang-suo', rPaper='https://suo.seas.harvard.edu/sites/g/files/omnuum4271/files/suo/files/120.pdf';
const corn='https://as.cornell.edu/people/brad-ramshaw', ramcv='https://chill.lassp.cornell.edu/sites/chill/files/CV_2026.pdf', nh='https://nationalmaglab.org/staff/?name=NeilHarrison', aps='https://meetings-archive.aps.org/mar/2015/b9/14/';
const nw='https://news.northwestern.edu/stories/2020/12/in-new-step-toward-quantum-tech-scientists-synthesize-bright-quantum-bits', chi='https://chemistry.uchicago.edu/daniel-laorenza', mit='https://chemistry.mit.edu/chemistry-news/graduate-student-spotlight-dan-laorenza/';
const wcv='https://web.mit.edu/~csuggs/www/wilczek_cv_17_oct_05.pdf', aip='https://history.aip.org/catalog/icos/44536.html', ias='https://www.ias.edu/scholars/frank-wilczek', fw='https://physics.mit.edu/faculty/frank-wilczek/';
const kt='https://thesis.caltech.edu/4301/', kcv='https://sites.utexas.edu/cmssm/faculty/liechti/cv/', kem='https://ae.utexas.edu/person/kenneth-m-liechti/';
const har='https://seas.harvard.edu/news/2013/01/jennifer-lewis-pioneer-3d-printing-and-bioinspired-materials-joins-harvard-faculty', wy='https://wyss.harvard.edu/team/core-faculty/jennifer-lewis/';
function relProof(file,prefix,target,proof,newPrefix){
 editLine(file,l=>l.startsWith(prefix)&&l.includes('[['+target+'|'),l=>l.slice(0,l.lastIndexOf(']]。')+3).replace(prefix,newPrefix)+proof);
}
function reverseCandidate(target,id,proof){
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- 博士后候选研究者：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}
const ve='本人 Rutgers 学术站点托管的 MIT 1981 年博士论文扫描题页列 David Hamilton Vanderbilt。Certified by 项签署 John D. Joannopoulos，下印 Thesis Supervisor；George F. Koster 另为系委员会主席。';
const vt=web('本人博士论文签署页，第 1 页',th)+'。'+ve;
relProof(fn(local(van)),'- 博士候选关系：',jo,vt,'- 博士导师：');
relProof(fn(jo),'- 博士候选研究者：',local(van),vt,'- 博士生：');
const vi='- [['+local(van)+'|David Vanderbilt]] → ';
relProof(idx,vi+'博士候选关系：',jo,vt,vi+'博士导师：');
const vlEvidence='本人 Rutgers CV 列 1981 年博士后赴 Berkeley 任三年 Miller Fellow；1984 年 6 月 APS 论文同列 Steven G. Louie 与 UC Berkeley 物理系署名。低可信博后指导候选。';
const vlt=web('本人 CV',vc)+' · '+web('1984 年 APS 原论文',vl)+'。'+vlEvidence;
addEdge(van,'博士后导师候选',lou,'Steven G. Louie',vlt,null,true);
reverseCandidate(lou,van,vlt);
editLine(fn(local(van)),l=>l.startsWith('- 核查边界：'),l=>'- 核查边界：'+web('本人 Rutgers CV',vc)+'核 Berkeley 约 1981–1984 Miller 博士后，个人指导者待查。MIT 博士题页已核。');
changeRow(van,'John D. Joannopoulos（MIT 博士论文签署页）','Berkeley Miller Fellow；Steven G. Louie 为低可信候选',web('博士论文签署页',th)+' · '+web('本人 CV',vc));
const va=audit(van,{phd:['confirmed_advisor',ve,[th,vc,vp]],postdoc:['group_or_candidate',vlEvidence,[vc,vl,vp]],affiliation:['confirmed','Rutgers 本人 CV 确认物理与天文系教授。',[vc]],research:['confirmed','本人 Rutgers 履历核电子结构、铁电材料、拓扑绝缘体和 Wannier/Berry 方法。',[vc]]},'查 1981 年 Miller 任命档的 host／advisor 字段，区分同期合作。');
relation(van,'phd',jo,'advisor',ve,[th,vc,vp],va,false);
relation(van,'postdoc',lou,'candidate',vlEvidence,[vc,vl,vp],va);

const se='本人 NTU 历史履历列 2009–2013 Los Alamos 博后；2011 Optica 原会议论文把 Singh、Antoinette J. Taylor 和 Hou-Tong Chen 同列 LANL MPA-CINT。Taylor 的 LANL 本人履历核其曾任 CINT 主任和 MPA 部门负责人。Taylor 仅列低可信候选，Chen 为同期合作追查线索。';
const sp=web('NTU 本人履历',nt)+' · '+web('同期 Optica 原文',opt)+' · '+web('CINT Taylor 本人档',cint)+'。'+se;
addEdge(sin,'博士后导师候选',tay,'Antoinette J. Taylor',sp,null,true);
reverseCandidate(tay,sin,sp);
enrich(sin,'phd','师承人物 - Weili Zhang','博士生',web('Oklahoma State 博士论文',st)+'致谢明确写 adviser 并称由 Weili Zhang 接收为博士生。');
editLine(fn(local(sin)),l=>l==='- [[院校 - NTU|NTU]]',l=>l+'\n- [[院校 - University of Notre Dame|University of Notre Dame]]（现任电气工程教授，'+web('院系原档',nd)+'）');
editLine(path.join(root,'院校与机构','院校 - University of Notre Dame.md'),l=>l==='## 已核实人物',l=>l+'\n\n- [['+local(sin)+'|Ranjan Singh]]：Electrical Engineering 教授，太赫兹光子学、超材料与量子材料。NTU 为历史校属条目，兼任或休假关系待核。'+web('Notre Dame 电气工程系',nd)+'。');
changeRow(sin,'Weili Zhang（本人论文致谢与签署）','Los Alamos 2009–2013；Antoinette J. Taylor 为低可信候选',web('Notre Dame 现任教师档',nd)+' · '+web('同期 Optica 原文',opt));
editLine(path.join(root,'NTU逐人复核记录.md'),l=>l.startsWith('| [['+local(sin)+'|'),l=>l.replace('| 物理与数学科学学院；','| 物理与数学科学学院（NTU 历史记录）；现见 Notre Dame 电气工程系；'));
const sa=audit(sin,{phd:['confirmed_advisor','本人 2009 Oklahoma State 博士论文明确称 Weili Zhang 为 adviser，亦列签署。',[st]],postdoc:['group_or_candidate',se,[nt,opt,cint]],affiliation:['confirmed','Notre Dame 电气工程系原档确认现任教授，NTU 历史组档确认 2013 创立 TeraX Labs。NTU 双聘或休假状态待查。',[nd,nt]],research:['confirmed','Notre Dame 原档列太赫兹光子与超材料、量子及拓扑材料。',[nd,nt]]},'查 LANL 2009–2013 fellowship 个人 sponsor 或 mentor，并核 NTU 当前关联。');
relation(sin,'phd','师承人物 - Weili Zhang','advisor','本人 Oklahoma State 博士论文称 Weili Zhang 为 adviser，并有签署。',[st],sa,false);
relation(sin,'postdoc',tay,'candidate',se,[nt,opt,cint],sa);

const re='本人供 AAM 提名的履历列 Princeton Research Associate (Postdoc) 2000-12–2002-08。2002 年原论文列 Rui Huang Princeton 土木与环境工程系、Zhigang Suo Princeton 机械与航天工程系／材料研究所，同校同期合作。Suo 只作博后候选，博士毕业年与博后起始月相交，保留两种原载日期。';
const rt=web('AAM 提名附本人履历',aam)+' · '+web('Princeton 同期原论文',rPaper)+' · '+web('Suo 原履历',suoCV)+'。'+re;
addEdge(rui,'博士后导师候选',suo,'Zhigang Suo',rt,null,true);
reverseCandidate(suo,rui,rt);
editLine(fn(local(rui)),l=>l.startsWith('- 核查边界：'),l=>l.replace('博士后经历与导师待查，不把毕业后共同作者当作博导。','Princeton 博士后履历已核，具体指导人按候选保留。'));
changeRow(rui,null,'Princeton 2000-12–2002-08 博后；Zhigang Suo 为低可信候选',web('AAM 提名履历',aam)+' · '+web('同期原论文',rPaper));
const ra=audit(rui,{postdoc:['group_or_candidate',re,[aam,rPaper,suoCV]],affiliation:['confirmed','UT Austin 航空航天工程与工程力学系官方本人页列教授，2002-09 入校。',[ut]],research:['confirmed','学校页列薄膜与二维材料、微纳力学、软材料及多尺度模拟。',[ut]]},'找 Princeton 2000–2002 Research Associate 任命或 Suo 组同期名册，查个人指导人与日期。');
relation(rui,'postdoc',suo,'candidate',re,[aam,rPaper,suoCV],ra);

const be='Cornell 原档分列 LANL/NHMFL 2012–2015 博后与 2015–2016 staff。2015 年 APS 会议原档同列 Ramshaw 与 Neil Harrison 的 LANL 单位及高场超导研究。MagLab 原档核 Harrison 在脉冲场设施任职；仅作低可信博后导师候选。';
const bt=web('Cornell 原档',corn)+' · '+web('APS 2015 原会议',aps)+' · '+web('MagLab Harrison 人员页',nh)+'。'+be;
addEdge(brad,'博士后导师候选',neil,'Neil Harrison',bt,null,true);
newMentor(neil,'Neil Harrison',web('MagLab 原人员档',nh)+'列 LANL Pulsed Field Facility，方向为高场凝聚态。',brad,'博士后候选研究者',bt);
changeRow(brad,null,'LANL／NHMFL 2012–2015 博后；Neil Harrison 为低可信候选',web('APS 原会议档',aps)+' · '+web('MagLab 人员档',nh));
const ba=audit(brad,{postdoc:['group_or_candidate',be,[corn,ramcv,aps,nh]],affiliation:['confirmed','Cornell Arts & Sciences 原档列物理副教授兼 LASSP 主任。',[corn]],research:['confirmed','学校原档列高磁场量子材料实验、拓扑超导和输运。',[corn]]},'查 Director’s Fellowship 原任命中的接收团队及个人指导者；保留 Bonn 和 Hardy 的不同博士角色。');
relation(brad,'postdoc',neil,'candidate',be,[corn,aps,nh],ba);

const de='Northwestern 2020 原报道直接称 Laorenza 是 Freedman 实验室研究生，MIT 本人访谈确认博士期间的组属。保留指导线索，标博士课题组负责人；论文正式导师字段待核。';
const dt=' '+web('Northwestern 2020 同期原报道',nw)+'明确研究生组属。';
replaceNoteLabel(dan,'博士研究师长','博士阶段课题组负责人',df,dt);
replaceInverseLabel(df,dan,'博士阶段研究者','博士阶段课题组成员',dt);
replaceIndexLabel(dan,df,'博士研究师长','博士阶段课题组负责人',dt);
editLine(fn(local(dan)),l=>l.startsWith('- 核查边界：'),l=>l.replace('博士阶段 Harvard 报道称 working with Freedman，按博士研究师长标注','博士阶段 Northwestern 原报道明确在 Freedman 实验室做研究，按博士课题组负责人标注'));
changeRow(dan,'Danna Freedman（博士课题组负责人）',null,web('Northwestern 2020 原报道',nw));
const da=audit(dan,{phd:['group_or_candidate',de,[nw,mit,chi]],affiliation:['confirmed','Chicago 化学系原档列助理教授，研究与量子材料交叉。',[chi]],research:['confirmed','Chicago 原档列分子自旋、量子信息、无机材料。',[chi,nw]]},'以 Daniel William Laorenza 和 Molecular Color Centers 追查正式论文签署；MIT 馆藏主机退避期内不重试。');
relation(dan,'phd',df,'group_leader',de,[nw,mit,chi],da,false);

const we='MIT 本人 CV 列 1974 年 Princeton Instructor 与 Assistant Professor，其后 1976–1977 在 IAS 任 Visiting Fellow；IAS 档另写 Member (1976–78)。AIP 本人口述史档案确认读博后立即加入 Princeton 教师。所阅履历未列独立博士后，保留 IAS 年份差异。';
note(frank,'- 核查边界：',web('MIT 本人 CV',wcv)+' · '+web('AIP 口述史档',aip)+' · '+web('IAS 人员原档',ias)+'。'+we);
changeRow(frank,null,'毕业转 Princeton 教职；IAS 另为 Visiting Fellow，所阅未列独立博后',web('MIT 本人 CV',wcv)+' · '+web('IAS 历史档',ias));
audit(frank,{postdoc:['no_postdoc_documented',we,[wcv,aip,ias]]},'保留 IAS Visiting Fellow／Member 名称和年份差异，若发现同期任命原档再核。');

const ke='UT Austin 本人中心 CV 分列 1980 年 Caltech 博士、1980–1982 General Dynamics Research Scientist 与 1982 起 UT Austin 教职；所阅履历未列独立博士后。院系原档列荣休。';
note(ken,'- 核查边界：',web('UT Austin 中心 CV',kcv)+' · '+web('院系现任原档',kem)+'。'+ke);
changeRow(ken,null,'General Dynamics 研究科学家，所阅未列独立博后',web('UT Austin 中心 CV',kcv));
editLine(path.join(root,'UT Austin逐人复核记录.md'),l=>l.startsWith('| [['+local(ken)+'|'),l=>l.replace('航空航天工程与工程力学系；','航空航天工程与工程力学系（荣休）；'));
audit(ken,{postdoc:['no_postdoc_documented',ke,[kcv,kem]],affiliation:['confirmed','UT Austin 院系原档列航空航天工程与工程力学荣休教授。',[kem]],research:['confirmed','院系原档列多层材料变形、失效及界面力学。',[kem]]},'若有独立博后聘任或项目资料再核；保留 Caltech 博士原证。');

const le='Harvard 2013 任命原文写 Lewis 于 1990 年在 UIUC 开始其职业生涯，后任材料科学与工程教授及 MRL 主任。现有 MIT 学位记录为 1991，记录两者的时间交叠，UIUC 初任岗位性质及是否有独立博士后仍待核。';
note(lewis,'- 核查边界：',web('Harvard 任命原文',har)+'。'+le);
changeRow(lewis,null,'Harvard 原档列 1990 起在 UIUC 任职，初任岗位及是否有博后待核',web('Harvard 2013 任命',har));
audit(lewis,{postdoc:['unresolved',le,[har]],affiliation:['confirmed','Harvard Wyss 本人原档列 SEAS 教授、Wyss 核心教师、Harvard MRSEC 主任。',[wy,har]],research:['confirmed','Harvard 原档核功能软材料、多材料增材制造和多尺度加工。',[wy,har]]},'查 UIUC 1990–1991 原人事职位及直接去向，分开 MIT 学位年月。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Vanderbilt与多校原证';
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
