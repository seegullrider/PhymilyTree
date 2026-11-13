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
 a.audit_id='20261110_'+id+'_faculty_and_training_0612';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0612_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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
function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

function align(id,entries,changes,next,school,followup=true){
 const aid=audit(id,changes,next);
 audits.at(-1).followup_required=followup;
 for(const [stage,target,proof,sources] of entries){
  enrich(id,stage,target,stage==='phd'?'博士生':'博士后研究者',web('核对原页',sources[0])+proof);
  relation(id,stage,target,'advisor',proof,sources,aid,false);
 }
 changeRow(id,...school);
}

const ma='a4653159', vin='师承人物 - Sergei A. Vinogradov', mi='师承人物 - John R. Miller';
const mvc='https://www.unibo.it/it/ateneo/amministrazione-trasparente/consulenti-e-collaboratori/tabella-incarichi-scaduti/2024?format=cv&id=40965', mu='https://mani.chem.uconn.edu/tomo_mani/', mb='https://www.bnl.gov/newsroom/news.php?a=111880';
const mp='Vinogradov 本人 CV 第 4 个 PDF 页面明确将 Tomoyasu Mani 列在 2009–2013 的 PhD advisor 项下，UConn 本人履历核对 Penn 生物化学与分子生物物理博士。';
const mq='Brookhaven 2016 机构报道直接称 John R. Miller 是 Mani 在该实验室的 former advisor，UConn 本人履历列 2014–2016 Goldhaber Fellow。';
align(ma,[['phd',vin,mp,[mvc,mu]],['postdoc',mi,mq,[mb,mu]]],{
 phd:['confirmed_advisor',mp,[mvc,mu]],postdoc:['confirmed_advisor',mq,[mb,mu]],
 affiliation:['confirmed','UConn 本人履历任职栏列 2016–2023 化学系助理教授、2023 起副教授。Brookhaven 2016 年原报道已说明 Mani 当年秋在 UConn 任教并领导新组，本人简介正文写 2026 年开组，与前两者冲突。',[mu,mb]],
 research:['confirmed','本人履历及 Brookhaven 原报道核对光物理、分子电荷和能量转移、自旋动力学。',[mu,mb]]
},'两阶段导师已有明确原件。保留本人页正文与 2016 年同期任职证据的年份差异。',['Sergei A. Vinogradov（2009–2013 Penn 博士导师）','John R. Miller（2014–2016 Brookhaven Goldhaber 博士后导师）',web('Vinogradov 本人 CV',mvc)+' · '+web('Brookhaven 2016 原档',mb)],false);
note(ma,'- 核查边界：',web('Brookhaven 2016 同期报道',mb)+'说明他在当年秋季已在 UConn 授课并领导新组，与本人页面任职栏的 2016 起聘一致，正文的 2026 记载单独保留。');

const mh='de334fa6', way='师承人物 - Robert M. Waymouth';
const he='https://www.hertzfoundation.org/people/mahesh-mahanthappa/', bat='https://bates.cems.umn.edu/people/alumni';
const m1='Hertz Foundation 的本人获奖人档明确 Mahanthappa 在 Stanford 的博士研究受 Robert M. Waymouth 指导，2003 年完成博士。';
const m2='Bates 原组档在 2003–2006 Minnesota 博后名下明确 Co-advised by Marc Hillmyer。Hertz 原档称同时与 Frank Bates 工作，Bates 的个人正式指导称谓待核。';
align(mh,[['phd',way,m1,[he]]],{
 phd:['confirmed_advisor',m1,[he]],postdoc:['confirmed_advisor',m2,[bat,he]],
 affiliation:['confirmed','Hertz 原档列 Minnesota 化工与材料科学系教授、化学研究生附属师资，Wisconsin 为历史任职。',[he]],
 research:['confirmed','获奖人原档核实嵌段共聚物及溶致液晶自组装。',[he]]
},'补 Stanford 博士论文签署与 Minnesota 博后任命原档中的 Bates 角色。',['Robert M. Waymouth（2003 Stanford 化学博士导师）','Marc Hillmyer（2003–2006 Minnesota 共同博士后导师）；Frank Bates（同阶段研究师长）',web('Hertz 本人档',he)+' · '+web('Bates 组原名册',bat)]);

const pb='56e5bbad', ra=local('35af1b59'), ch=local('3fbbd387');
const lb='https://foundry.lbl.gov/2024/04/03/piush-behera-uc-berkeley/', uc='https://www.samueli.ucla.edu/new-faculty-2023-2026/', mt='https://courses.csail.mit.edu/6.9970/', es='https://escholarship.org/uc/item/8523936j', yl='https://engineering.yale.edu/news-and-events/events/ferroelectric-microelectronics-designing-functional-dielectrics-for-energy-efficient-electronics-piush-behera';
const pp='先前已核的 Yale 讲座履历直接指名 Ramesh 指导 Berkeley 材料博士研究。Berkeley 论文来源保留；本轮在 Berkeley Lab 2024 同期活动档复核其 Ramesh 组即将毕业博士生身份。';
const pq='MIT 学术求职档明确列 Suraj Cheema 为 Behera 的 Current Advisor；UCLA 任命档交叉确认此前 MIT 博后。';
align(pb,[['phd',ra,pp,[lb,yl,es]],['postdoc',ch,pq,[mt,uc]]],{
 phd:['confirmed_advisor',pp,[lb,yl,es]],postdoc:['confirmed_advisor',pq,[mt,uc]],
 affiliation:['confirmed','UCLA Samueli 新教师档列材料科学与工程系助理教授，正式公告起聘日期 2026-11-01。',[uc]],
 research:['confirmed','UCLA 新教师档列功能电介质、半导体与金属的生长表征，Berkeley Lab 同期报告列铁电薄膜、极化纹理。',[uc,lb]]
},'博士及博后已有具名原件，继续补 Berkeley 学位签署页和 UCLA 单独教师档的上岗状态。',['Ramamoorthy Ramesh（Berkeley 材料博士导师）','Suraj Cheema（MIT 博士后导师）',web('Berkeley Lab 同期履历',lb)+' · '+web('MIT 求职原档',mt)]);

const ko='3da13268', fa='师承人物 - Ludwig D. Faddeev', sb='https://www.stonybrook.edu/physics/people/_profiles/korepinv.html', si='https://iacs.stonybrook.edu/people/_affiliates/vladimir-korepin.php';
const kp='Stony Brook 物理系档直接称 Korepin 的博士学位受 Ludwig D. Faddeev 指导，原档写 1979。其他校方生平资料载 1977，保留分歧。';
const kq='Stony Brook 物理系记在数学研究所做博士后，校内 IACS 履历另列 1978–1984 Illinois Postdoctoral Associate；可能对应不同阶段，起止和对应关系待核。旧 CV 记录 Faddeev 为 Post Doctoral adviser，本轮旧 PDF 路径不可访问。';
align(ko,[['phd',fa,kp,[sb]]],{
 phd:['confirmed_advisor',kp,[sb]],postdoc:['confirmed_advisor',kq,[sb,si]],
 affiliation:['confirmed','Stony Brook 现行系档列物理与天文学系和 C. N. Yang Institute 杰出教授。',[sb]],
 research:['confirmed','Stony Brook 物理系档核实一维强关联、可积模型、量子信息。',[sb]]
},'博士导师已核实，继续查博士授位档、本人 CV 可读版本和两处博后聘任档。',['Ludwig D. Faddeev（博士导师，授位年份 1977／1979 待核）','Ludwig D. Faddeev（既有 CV 的博士后 adviser，任职地点及各段待核）',web('Stony Brook 物理系',sb)+' · '+web('IACS 历史履历',si)]);
note(ko,'- 核查边界：',web('IACS 历史履历',si)+'明确列 1978–1984 Illinois 博后职务，与物理系记载的数学研究所阶段分别保留。');

const ku='7e5810a9', ne='师承人物 - Daniel M. Neumark', al=local('33be9f81');
const pr='https://chemistry.princeton.edu/news/alice-kunin-joins-princeton-chemistry-faculty/', pm='https://materials.princeton.edu/symposium-2025/speakers';
const ap='Princeton 化学系教师公告明确 2019 Berkeley 博士由 Daniel Neumark 指导。此前直接核读的学位论文单列他为委员会主席，致谢确认组属。';
const aq='Princeton 材料研究所本人介绍明确 Stony Brook 博后在 Thomas Allison 组，用时间分辨动量显微研究二维量子材料，2024 年 1 月转 Princeton。';
const ka=audit(ku,{
 phd:['confirmed_advisor',ap,[pr,pm]],postdoc:['group_or_candidate',aq,[pr,pm]],
 affiliation:['confirmed','Princeton 化学系公告及材料研究所报告确认其化学系教职。',[pr,pm]],
 research:['confirmed','两个 Princeton 原档核对超快材料光谱、二维材料与表面光化学。',[pr,pm]]
},'补 Berkeley 正式签署字段，查 Stony Brook 博后聘任的具体导师称谓与起止。');
enrich(ku,'phd',ne,'博士生',web('Princeton 化学系',pr)+ap);
replaceNoteLabel(ku,'博士后阶段课题组负责人','博士后阶段课题组负责人',al,' '+web('Princeton 材料研究所',pm)+aq);
mentorLine(al,ku,'- 博士后课题组成员：',web('Princeton 材料研究所',pm)+aq);
indexLine(ku,al,'博士后课题组',web('Princeton 材料研究所',pm)+aq);
changeRow(ku,'Daniel M. Neumark（2019 Berkeley 博士导师；论文委员会主席）','Thomas Allison（Stony Brook 博士后课题组负责人）',web('Princeton 两原档',pm)+' · '+web('化学系公告',pr));
relation(ku,'phd',ne,'advisor',ap,[pr,pm],ka,false);
relation(ku,'postdoc',al,'group_leader',aq,[pr,pm],ka);

const fl='ae019d16', le='师承人物 - Marsha I. Lester';
const st='https://chemistry.stanford.edu/news/new-faculty-member-fang-liu-join-chemistry-department', sp='https://profiles.stanford.edu/239074';
const fp='Stanford 化学系聘任原报道明确 2010 起 Penn 博士研究由 Marsha Lester 指导，本人 Stanford 档列 Penn 2015 化学博士。';
const fq='Stanford 化学系聘任原报道明确 Columbia 先后 MRSEC 和 DOE 博后 fellowship，后者在 Xiaoyang Zhu 组。既有 Penn 2016 Lester 组博士后阶段另列，两个实验室正式个人导师职衔未确认。';
align(fl,[['phd',le,fp,[st,sp]]],{
 identity:['confirmed','Stanford 此 Fang Liu 为 Penn 2015 博士及 Columbia 博后，区别于 Stanford 博士、MIT 博后的 Emory 同名教师。',[st,sp]],
 phd:['confirmed_advisor',fp,[st,sp]],postdoc:['group_or_candidate',fq,[st,sp]],
 affiliation:['confirmed','Stanford 化学系入职公告和本人院系履历确认 Stanford 化学任职。',[st,sp]],
 research:['confirmed','Stanford 院系与本人档核对二维半导体光学、超快光谱。',[st,sp]]
},'补 Penn 论文签署及 Penn／Columbia 博后正式导师职衔和聘期。',['Marsha I. Lester（2015 Penn 化学博士导师）','Penn Lester 组；Columbia Xiaoyang Zhu 组（两段博后分别记录）',web('Stanford 化学系聘任档',st)]);

const ro='5b4e9f1a', so=local('f996c949'), lh='https://physics.cas.lehigh.edu/events/physics-colloquium-phases-geometric-topological-localized';
const rp='Lehigh 物理系报告人履历明确 Roy 的 2007 年 Illinois 博士学位受 Michael Stone 指导。';
const rq='Lehigh 院系履历分列 McMaster 与 Kallin、Berlinsky，Oxford 与 Simon、Chalker 的两段博后；正式 supervisor 称谓沿用旧 CV 记载。本轮 UCLA 旧 CV 再次超时。';
align(ro,[['phd',so,rp,[lh]]],{phd:['confirmed_advisor',rp,[lh]],postdoc:['confirmed_advisor',rq,[lh]],research:['confirmed','Lehigh 物理系报告人档核对拓扑凝聚态方向。',[lh]]},'核 McMaster 与 Oxford 两段正式 supervisor 原件及准确聘期。',['Michael Stone（2007 Illinois 博士导师）','McMaster：Catherine Kallin、John Berlinsky；Oxford：Steve Simon、John Chalker（沿用旧 CV 所列导师）',web('Lehigh 物理系原档',lh)]);

const hh='eb228b25', nov='师承人物 - Lukas Novotny';
const eo='https://physics.emory.edu/people/bios/harutyunyan-hayk.html', ul='https://www.mae.ucla.edu/upcoming-events/seminar-4-29-1000am-engineering-iv-37-124-dr-hayk-harutyunyan-efficient-nonlinearities-in-meta-surfaces-enabled-by-bound-states-in-the-continuum/', pi='https://etd.adm.unipi.it/theses/browse/by_author/h.html', ar='https://harvest.aps.org/v2/journals/articles/10.1103/PhysRevLett.108.217403/fulltext';
const hp='Pisa 作者档确认 2009 博士论文题名 Excited State Dynamics of Individual Single-Walled Carbon Nanotubes。论文详情本轮不可访问，保留人物页此前的 Allegrini、Hartschuh 指名记录，台账待核原档。';
const hq='UCLA 讲座履历明确 2014 入 Emory 前有 Rochester 与 Argonne 两段博后，Emory 现职档明列 2012 Argonne CNM Distinguished Postdoctoral Fellow。2012 APS 原论文证实 Rochester 与 Novotny 同单位合作，指导仅为候选。';
const ha=audit(hh,{phd:['unresolved',hp,[pi,eo]],postdoc:['group_or_candidate',hq,[eo,ul,ar]],affiliation:['confirmed','Emory 物理系原档列 Professor，UCLA 2024 讲座中的 Associate Professor 是历史职称。',[eo,ul]],research:['confirmed','Emory 系档和 UCLA 讲座核对超快及非线性纳米光学、超表面与等离激元。',[eo,ul]]},'复读 Pisa 论文详情导师栏，查 Rochester 正式指导与 Argonne CNM 博后聘任文件。');
const hs=web('UCLA 讲座原档',ul)+'与'+web('Emory 院系档',eo)+'分列 Rochester 与 Argonne 博后。'+web('2012 APS 原论文',ar)+'只支持 Rochester 同期合作。';
replaceNoteLabel(hh,'博士后导师候选','博士后导师候选',nov,' '+hs);
mentorLine(nov,hh,'- 博士后候选：',hs);
indexLine(hh,nov,'博士后导师候选',hs);
note(hh,'- 核查边界：',web('UCLA 讲座履历',ul)+'分列 Rochester、Argonne 博后，'+web('Emory 现职档',eo)+'确认 2012 Argonne CNM fellowship。Argonne 指导者未具名。');
changeRow(hh,null,'Rochester：Lukas Novotny（同期合作及导师候选）；Argonne CNM：2012 Distinguished Fellow，导师待核',web('Emory 原档',eo)+' · '+web('UCLA 讲座履历',ul));
relation(hh,'postdoc',nov,'candidate',hq,[eo,ul,ar],ha);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0612';
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






