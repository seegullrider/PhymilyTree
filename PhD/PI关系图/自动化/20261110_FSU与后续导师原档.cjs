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
 a.audit_id='20261110_'+id+'_fsu_original_1202';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fsu_original_1202_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const [de,wi,ma,ka,ke,kw,hi,si,gu]=["950508a0","4a50faeb","f5749425","f375116d","e464b754","ebf64379","f651ad11","f469c612","f4f35401"], ba='e6ad4c6e', le='cef8660f';
const f=["https://quantum.fsu.edu/people/faculty/highlights/eugene-deprince","https://quantummaterials.weebly.com/prof-chris-wiebe.html","https://www.physics.fsu.edu/person/efstratios-manousakis","https://eng.famu.fsu.edu/mae/people/kametani","https://www.kennemurgroup.com/justin-g-kennemur","https://digitalcommons.usf.edu/etd/6049/","https://fs.magnet.fsu.edu/~shill/cv.html","https://eng.famu.fsu.edu/cbe/people/siegrist","https://web1.eng.famu.fsu.edu/~wguo/Guo_PandT_Vita_2021-11-17.pdf"], x=["https://ecommons.cornell.edu/server/api/core/bitstreams/e4c3dcbe-6edb-4083-9b7d-048f4f0ff13a/content","https://repository.kulib.kyoto-u.ac.jp/items/e6958296-ab5d-477a-9b6c-bf77200c6e84","https://mazziotti.uchicago.edu/members/past_members/","https://news.uchicago.edu/story/chemist-tames-longstanding-electron-computation-problem","https://vergil.chemistry.gatech.edu/sherrill-cv.pdf","https://maglabweb.magnet.fsu.edu/research/research-groups/baumbach-lab/members/","https://opda.fsu.edu/mentors/drs-theo-siegrist-kaya-wei","https://quantum.fsu.edu/people/faculty/highlights/wei-guo","https://maglabweb.magnet.fsu.edu/careers/meet-our-scientist-staff/scientist-spotlight-emr-director-stephen-hill/","https://www.chem.fsu.edu/person/dr-a-eugene-deprince-iii/"], m=["https://mceuengroup.lassp.cornell.edu/sites/mceuen/files/publications/2014%20Arthur%20Barnard%20Thesis_0.pdf","https://mceuengroup.lassp.cornell.edu/publications/theses","https://www.t.kyoto-u.ac.jp/publicity/no45/activity/doctorsdegree","https://doi.org/10.1088/0953-2048/18/12/011","https://public.magnet.fsu.edu/AToth/AR/2012/2012%20Annual%20Report.pdf"], y=["https://www.physics.columbia.edu/sites/www.physics.columbia.edu/files/content/Uemura%20Biographical%20Sketches%20for%202024%20v2.pdf","https://research.physics.illinois.edu/Publications/Theses/PhDsThrough2006.htm","https://www.jstage.jst.go.jp/article/jcsj/50/5/50_214/_pdf","https://www.uwinnipeg.ca/chemistry/faculty/chris-wiebe.html"], z=["https://par.nsf.gov/servlets/purl/10093546","https://pubs.acs.org/doi/10.1021/acs.inorgchem.4c04370","https://www.chem.fsu.edu/~latturner/WebCV2014Sept.pdf","https://www.chem.fsu.edu/~latturner/CV2010March.pdf","https://www.jstage.jst.go.jp/article/jcsj/50/5/50_214/_article","https://www.asemfl.org/dashboard/directory/member/621"];
const ill='https://www.ideals.illinois.edu/items/25441', mag='https://nationalmaglab.org/staff/?name=KayaWei';
const leeCV='https://galileo.phys.virginia.edu/research/groups/nextlab/member/SHL_CV_2021.pdf', lynnCV='https://umdphysics.umd.edu/images/CV/lynn_cv.pdf', leeUVA='https://as.virginia.edu/node/12136', leeGroup='https://qclab.korea.ac.kr/main/Lee,_Seung-Hun';
const u=(label,url)=>web(label,url)+'。';
const old=(id,stage,evidence,src)=>[JSON.parse(latest.get(id).details_json).aspects[stage].status,evidence,src];
const C='confirmed', A='confirmed_advisor', G='group_or_candidate', U='unresolved';
function save(id,proof,phd,post,checks,next){
 note(id,'- 核查边界：',proof);
 changeRow(id,phd,post,proof);
 return audit(id,checks,next);
}
function stage(id,target,label,reverse,proof){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+proof);
 mentorLine(target,id,'- '+reverse+'：',proof);
 indexLine(id,target,label,proof);
}
const dep='FSU 本人访谈列 2009 Chicago 博士、2010–2011 Argonne 计算博后、2011–2013 Georgia Tech NSF 博后。Sherrill 本人 CV 第 40 页把该人同期列为 Research Scientist（2011-09–2013-07）。两份履历职称分开保留。';
save(de,u('FSU 本人访谈',f[0])+u('Sherrill 本人履历第 40 页',x[4])+u('FSU 院系原档',x[9])+dep,null,null,{
 phd:old(de,'phd','FSU 本人访谈及 Mazziotti 组校友档支持博士阶段共同工作。旧本人 CV 所记正式导师保留。',[f[0],x[2],x[3]]),
 postdoc:old(de,'postdoc',dep+'旧本人 CV 的 Gray 与 Sherrill 个人指导记录保留。',[f[0],x[4]]),
 affiliation:[C,'FSU 化学与生物化学系个人原档及校内量子项目名录。',[f[0],x[9]]],
 research:[C,'系页和校内访谈核理论量子化学、电子结构及计算方法。',[x[9],f[0]]]
},'找 2009 Chicago 论文及可读旧 CV 或 Argonne、Georgia Tech 的任用原件，核两次正式指导及同期职称差异。');

const wph='本人 CV 的 Education 将 1998–2002 McMaster 物理博士的 Supervisor 明列 John E. Greedan。1995–1998 硕士另列 Bruce D. Gaulin。';
const wpd='Uemura 本人 Columbia CV 第 2 页在 Postdoctoral Advisees 下列 Christopher Wiebe 2003–2004。Winnipeg 院档记 2002–2004 Columbia 博后。';
const wa=save(wi,u('本人课题组履历',f[1])+u('Uemura 本人 CV 第 2 页',y[0])+u('Winnipeg 院档',y[3])+wph+wpd,null,'Yasutomo J. Uemura（明确博士后导师，2003–2004）',{
 phd:[A,wph,[f[1]]],postdoc:[A,wpd,[y[0],y[3]]],
 affiliation:[C,'本人履历列 Winnipeg 化学和 McMaster 物理与天文兼任，FSU 物理及 MagLab 为历史任职。',[f[1],y[3]]],
 research:[C,'院档和组页列量子材料、磁性与散射实验。',[f[1],y[3]]]
},'核 McMaster／Columbia 博后早段的岗位安排及其他个人指导。');
for(const [s,t,b,p,refs] of [['phd','师承人物 - John E. Greedan','博士生',wph,[f[1]]],['postdoc',local('1362d9c7'),'博士后研究者',wpd,[y[0],y[3]]]]){
 enrich(wi,s,t,b,p);
 relation(wi,s,t,'advisor',p,refs,wa,false);
}

const map='Illinois 物理系档列论文 No. 1124 的 Advisor V. R. Pandharipande。IDEALS 1985 馆藏题名 On the microscopic theory of liquid ⁴He，列该人为委员会主席，正文限校内访问。';
const mad='FSU 物理系原档列 1985–1987 MIT 理论物理中心与 1987–1988 Supercomputer Computational Research Institute 的博士后研究，之后加入物理系。两段个人指导待查。';
const maRef=u('Illinois 学位馆藏',ill)+u('FSU 物理系原档',f[2]);
const maa=save(ma,maRef+map+mad,null,'1985–1987 MIT CTP、1987–1988 SCRI 博士后研究，个人导师待查',{
 phd:[A,map,[ill,y[1]]],postdoc:[U,mad,[f[2]]],affiliation:[C,'Florida State 物理系 Donald Robson Professor。',[f[2]]],
 research:[C,'原系档列凝聚态理论、强关联量子多体、超流、拓扑与超导。',[f[2]]]
},'追 MIT 理论物理中心及 FSU SCRI 1985–1988 年报和正式指导关系。');
enrich(ma,'phd','师承人物 - Vijay R. Pandharipande','博士生',u('Illinois 学位馆藏',ill)+map);
relation(ma,'phd','师承人物 - Vijay R. Pandharipande','advisor',map,[ill,y[1]],maa,false);

const kap='京都工学院博士授位名录列亀谷文健的银包套超导带材论文及审查人员长村光造、牧正志、落合庄治郎。维持旧记录的长村光造博士阶段研究师长角色，审查名单只证明审查关系。';
const kaa=save(ka,u('京都大学工学院授位档',m[2])+u('FAMU–FSU 工程院系',f[3])+kap,null,null,{
 phd:[G,kap,[m[2]]],postdoc:[U,'FAMU–FSU 个人档列京都博士，未分列博士后。',[f[3]]],
 affiliation:[C,'FAMU–FSU 机械与航空航天工程和材料科学与工程。',[f[3]]],
 research:[C,'应用超导微结构、透射电子显微及电子能损谱。',[f[3]]]
},'核京都原论文签署或课题组指导档，另查 MagLab 早期岗位和是否有博士后。');
stage(ka,'师承人物 - Kozo Osamura','博士阶段研究师长','博士阶段受指导者',u('京都工学院授位档',m[2])+kap);
relation(ka,'phd','师承人物 - Kozo Osamura','stage_mentor',kap,[m[2],x[1],y[2]],kaa,false);

const kep='本人课题组履历明确 NC State 博士研究受 Bruce M. Novak 指导，2011–2014 Minnesota 博后由 Marc A. Hillmyer 与 Frank S. Bates 共同指导。';
const kea=save(ke,u('Kennemur 本人履历',f[4])+kep,null,'Marc A. Hillmyer、Frank S. Bates（2011–2014 Minnesota 共同导师）',{
 phd:[A,kep,[f[4]]],postdoc:[A,kep,[f[4]]],affiliation:[C,'本人课题组履历列 FSU 化学与生物化学教授。',[f[4]]],
 research:[C,'聚合物分子设计、合成、嵌段聚合物及材料性质。',[f[4]]]
},'两阶段个人指导与现有研究方向已核；后续随任职及研究更新复查。');
audits.at(-1).followup_required=false;
for(const [s,t,b] of [['phd','师承人物 - Bruce M. Novak','博士生'],['postdoc',local('c9fa4f7d'),'博士后研究者'],['postdoc',local('f5d72779'),'博士后研究者']]){
 enrich(ke,s,t,b,kep);
 relation(ke,s,t,'advisor',kep,[f[4]],kea,false);
}

const kwp='USF 2015 物理博士馆藏将 George S. Nolas 明列 Major Professor，论文题为 Investigation of Low Thermal Conductivity Materials with Potential for Thermoelectric Applications。';
const kwd='Baumbach 原组档列 Kaya Wei 为前博士后。FSU 博后办公室另列 Wei 和 Theo Siegrist 同为一项招募的拟指导人；该页涉及招募对象的指导。';
const kwa=save(kw,u('USF 学位馆藏',f[5])+u('MagLab 人事原档',mag)+kwp+' MagLab 现列 Research Faculty I，Condensed Matter Science／DC Field。',null,null,{
 phd:[A,kwp,[f[5]]],postdoc:[G,kwd,[x[5],x[6]]],
 affiliation:[C,'MagLab 当前人事页列 Research Faculty I，Condensed Matter Science／DC Field。',[mag]],
 research:[C,'FSU 招募原档描述热电材料、晶体生长、高场表征与凝聚态实验。',[x[6],mag]]
},'追 USF 博后个人指导，以及 MagLab 博后正式 adviser 和起止日期。');
enrich(kw,'phd','师承人物 - George S. Nolas','博士生',kwp);
relation(kw,'phd','师承人物 - George S. Nolas','advisor',kwp,[f[5]],kwa,false);

const hip='本人访谈明述 Singleton 邀他成为研究生并延续指导，本人 CV 将 John Singleton 列为 Oxford graduate mentor。';
const hid='本人旧版 HTML CV 列 1994 Oxford DPhil、1995 年 2–8 月 Boston University 博后、1995 年 8 月至 1997 年 8 月 NHMFL 博后，并列 J. S. Brooks 为两处阶段 mentor。1995 年授位的另一版本保留。';
save(hi,u('本人 HTML CV',f[6])+u('MagLab 本人访谈',x[8])+hip+hid,null,null,{
 phd:[G,hip,[x[8],f[6]]],postdoc:[G,hid,[f[6],x[8]]],
 affiliation:[C,'MagLab 访谈核 FSU Physics 与国家强磁场实验室的 EMR 工作。',[x[8],f[6]]],
 research:[C,'电子磁共振、高场凝聚态与分子磁体。',[x[8],f[6]]]
},'查 Oxford DPhil 学位目录的授位年和导师字段；核 BU 与 NHMFL 当期岗位正式指导。');

const sip='FAMU–FSU 个人档分列 1983–1984 IBM T. J. Watson 博后与 1985–1986 加拿大 NRC Research Associate。ASEMFL 个人档支持 1982 ETH 固态物理博士。';
save(si,u('FAMU–FSU 工程原档',f[7])+u('ASEMFL 个人档',z[5])+sip,null,'1983–1984 IBM 博后，个人导师待查；1985–1986 加拿大 NRC Research Associate 另列',{
 phd:[G,'1982 ETH 博士已有履历，F. Hulliger 维持博士低可信候选。',[f[7],z[5]]],postdoc:[U,sip,[f[7]]],
 affiliation:[C,'FAMU–FSU 化学与生物医学工程、材料科学与工程及 MagLab。',[f[7],z[5]]],
 research:[C,'固态材料、超导、晶体合成及结构。',[f[7],z[5]]]
},'找 ETH 学位题名与签署，追 IBM 当期实验室和个人指导。');

const gup='本人 CV 教育栏明确 2008 Brown 博士 Supervisor H. J. Maris，并另列同一导师的硕士学位。';
const gud='本人 CV 将 2008–2010 Yale 博后与 2010–2012 Associate Research Scientist 分列，合计为 2008–2012 与 Daniel McKinsey 工作。FSU 本人原档也记 Yale 博后与 McKinsey。';
const gua=save(gu,u('本人任职与晋升 CV',f[8])+u('FSU 本人原档',x[7])+gup+gud,null,'Daniel N. McKinsey（2008–2010 Yale 博后课题组负责人）；2010–2012 同组科研岗位另列',{
 phd:[A,gup,[f[8]]],postdoc:[G,gud,[f[8],x[7]]],
 affiliation:[C,'FAMU–FSU 工程与国家强磁场实验室。',[f[8],x[7]]],research:[C,'量子流体、超流氦和低温湍流。',[f[8],x[7]]]
},'追 Yale 2008–2010 当期博后任用或正式导师表。');
enrich(gu,'phd','师承人物 - Humphrey J. Maris','博士生',gup);
stage(gu,'师承人物 - Daniel N. McKinsey','博士后课题组负责人','博士后课题组成员',u('Guo 本人 CV',f[8])+gud);
relation(gu,'phd','师承人物 - Humphrey J. Maris','advisor',gup,[f[8]],gua,false);
relation(gu,'postdoc','师承人物 - Daniel N. McKinsey','group_leader',gud,[f[8],x[7]],gua,false);

const bab='McEuen 组论文目录列 Barnard 的 2015 年论文 Microtweezers for Studying Vibrating Carbon Nanotubes。Cornell 馆藏 PDF 及组内 PDF 本轮未能取回正文，保留既有核读和导师标签。';
const baa=save(ba,u('McEuen 组论文目录',m[1])+bab,null,null,{
 phd:old(ba,'phd',bab,[m[1],x[0]])
},'找学位论文可读副本，继续核 Stanford 博后个人指导职衔。');
enrich(ba,'phd',local('e235f5d3'),'博士生',u('McEuen 组论文目录',m[1])+bab);
relation(ba,'phd',local('e235f5d3'),'advisor',bab,[m[1],x[0]],baa,false);

const lynn='师承人物 - Jeffrey W. Lynn';
const lee='Lynn 本人 CV 第 53 页的 Postdoctoral Fellows 栏列 Seung-Hun Lee（1996–2000），第 54 页另列 U. Maryland Research Scientist（2000–2002）。Lee 本人 CV 将 1996–2002 合列 NIST Instrument Scientist，2002–2005 列 Staff Physicist。保留并列职称及起止，Lynn 暂列博士后阶段研究师长，正式任命及 advisor 职衔待核。';
const leProof=u('Maryland 托管 Lynn 本人履历第 53–54 页',lynnCV)+u('UVA 托管 Lee 本人履历',leeCV)+lee;
editLine(fn(local(le)),l=>l.startsWith('- 博士后经历及导师：'),()=>'- 博士后阶段研究师长：[['+lynn+'|Jeffrey W. Lynn]]。'+leProof);
editLine(fn(local(le)),l=>l.startsWith('- 核查边界：'),l=>l.replace('后续检查是否另有博士后经历，以及 Majkrzak、Shirane 名字对应关系。','核对 Lynn 履历所列 1996–2000 博后经历、U. Maryland 后续岗位及 Majkrzak、Shirane 名字对应关系。'));
inverse(le,lynn,'博士后阶段受指导者',leProof);
editLine(idx,l=>l.startsWith('- [['+local(le)+'|')&&l.includes(' → NIST 工作阶段师长：'),l=>l+'\n- [['+local(le)+'|Seung-Hun Lee]] → 博士后阶段研究师长：[['+lynn+'|Jeffrey W. Lynn]]。'+leProof);
changeRow(le,null,'Jeffrey W. Lynn（1996–2000 博士后阶段研究师长；同期 NIST 聘称并记）',leProof+u('UVA 物理任职',leeUVA));
const lea=audit(le,{
 postdoc:[G,lee,[lynnCV,leeCV]],affiliation:[C,'UVA 原院档核 Commonwealth Professor of Physics。',[leeUVA,leeCV]],
 research:[C,'本人 CV 与原 QCLab 核量子磁性、受挫磁性及中子散射。',[leeGroup,leeCV]]
},'查 NIST/UMD 1996–2000 博后任命及正式 adviser，区分工作阶段的三位 mentors 与 Lynn 的经历记录。');
relation(le,'postdoc',lynn,'stage_mentor',lee,[lynnCV,leeCV],lea);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_FSU与后续导师原档';
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
