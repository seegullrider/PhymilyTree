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
function row(id,text,postdoc=null){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';return cells.join(' | ');
 });
}
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
 a.audit_id='20261110_'+id+'_fellowship_and_cv_0556';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0556_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

function addRelation(id,label,target,display,detail,inverseLabel){
 const r=records.get(id);
 editLine(fn(r.filename),l=>l==='## 师承',l=>l+'\n\n- '+label+'：[['+target+'|'+display+']]。'+detail);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- '+inverseLabel+'：[['+r.filename+'|'+r.name+']]。'+detail);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+label+'：[['+target+'|'+display+']]。'+detail);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

const ch='师承人物 - Yves Chabal', chcv='https://bpb-us-e2.wpmucdn.com/sites.utdallas.edu/dist/8/964/files/Chabal_CV-2017.pdf';
const hi='72d37491', hic='https://chemistry.cornell.edu/melissa-hines';
const hp='Chabal 本人 CV 第 57 个 PDF 页面在其指导的博士后栏列 Melissa Hines（Cornell）。Cornell 化学系履历确认 Hines 在 AT&T Bell Labs 做了两年博士后，1994 年到 Cornell，研究半导体表面化学。';
const hs=web('Chabal 本人 CV 第 57 页',chcv)+'的指导名册具名，'+web('Cornell 化学系履历',hic)+'确认 AT&T Bell Labs 博后两年及 1994 年入职。';
const ha=audit(hi,{postdoc:['confirmed_advisor',hp,[chcv,hic]],affiliation:['confirmed','Cornell 化学与化学生物学系现任个人档。',[hic]],research:['confirmed','Cornell 个人档列半导体表面化学、表面结构及动力学。',[hic]]},'已确认 AT&T Bell Labs 博士后导师。Stanford 学位档与 Cornell 履历的博士年份分别为 1991 与 1992，保留两种记载并追查签署页。');
addRelation(hi,'博士后导师',ch,'Yves Chabal',hs,'博士后研究者');
editLine(fn(local(hi)),l=>l.startsWith('- 核查边界：'),l=>l.replace(/校方资料确认 AT&T Bell Labs 博士后[，,]导师待核[。；]?\s*/u,'')+' AT&T Bell Labs 博士后由 Chabal 指导，见上方 CV 名册。');
changeRow(hi,null,'Yves Chabal（AT&T Bell Labs 博士后导师，Cornell 履历列两年、1994 年入校）',hs);
relation(hi,'postdoc',ch,'advisor',hp,[chcv,hic],ha);

const jr='683dfa06', jru='https://chem.umd.edu/people/janice-reutt-robey';
const jrp='Chabal 本人 CV 的博士后指导名册具名 Janice Reutt-Robey；Maryland 化学与生化系履历列 1988 年 AT&T Bell Laboratories 博后与 Yves Chabal。';
const jra=audit(jr,{postdoc:['confirmed_advisor',jrp,[chcv,jru]],affiliation:['confirmed','Maryland 化学与生化系教师档确认院系任职。',[jru]],research:['confirmed','校方原档列分子组装、表面形貌及扫描探针。',[jru]]},'已有具名博士后导师。查 Berkeley 博士学位签署区分 Yuan T. Lee 与 David A. Shirley 的角色，查 Bell Labs 博后完整起止。');
enrich(jr,'postdoc',ch,'博士后研究者',web('Maryland 院系履历',jru)+'列 1988 年 Bell Labs 博后，'+web('Chabal 博士后指导名册',chcv)+'交叉证实。');
changeRow(jr,null,'Yves Chabal（AT&T Bell Laboratories 博士后导师，Maryland 履历列 1988 年）',web('Chabal 本人 CV',chcv));
relation(jr,'postdoc',ch,'advisor',jrp,[chcv,jru],jra,false);

const pp85='https://ppfp.ucop.edu/info/fellowship-recipients/fellows-85-89.html';
const pp90='https://ppfp.ucop.edu/info/fellowship-recipients/fellows-90-95.html';
const lm='7e93bc88', rb=local('3af2083d'), ys=local('81347a28'), lu='https://mse.umd.edu/news/story/remembering-mse-professor-luz-martiacutenezmiranda';
const lp='Maryland 材料系纪念档在同一段具名 Robert Birgeneau 指导其 MIT 物理博士工作，并列论文题名及 1985 年毕业。';
const lq='UC PPFP 原名录列 1985–1987 Berkeley 博士后 fellowship 及 Mentor Yuen-Ron Shen。Maryland 系档另记她在 Berkeley 与 Shen 工作并于 1987 年到 Penn。';
const la=audit(lm,{phd:['confirmed_advisor',lp,[lu]],postdoc:['group_or_candidate',lq,[pp85,lu]],affiliation:['confirmed','Maryland 材料系纪念档列 1995 年到该校、1998 年升任副教授、2023 年升任教授。',[lu]],research:['confirmed','Maryland 材料系纪念档核对液晶、纳米复合材料及 X 射线散射研究。',[lu]]},'核 MIT 学位论文签署与 Berkeley 博后聘任的正式导师称谓。Shen 已有具名项目 Mentor。');
const ls=' '+web('Maryland 材料系纪念档',lu)+lp;
replaceNoteLabel(lm,'博士阶段研究师长','博士导师',rb,ls);
replaceInverseLabel(rb,lm,'博士阶段研究者','博士生',ls);
replaceIndexLabel(lm,rb,'博士阶段研究师长','博士导师',ls);
const ly=' '+web('UC PPFP 原名录',pp85)+lq;
replaceNoteLabel(lm,'博士后阶段研究师长','博士后阶段研究师长',ys,ly);
mentorLine(ys,lm,'- 博士后阶段研究者：',ly.trim());
indexLine(lm,ys,'博士后阶段研究师长',ly.trim());
editLine(fn(local(lm)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Maryland 材料系原档具名 Birgeneau 指导博士工作，MIT 论文签署仍待核。Shen 在奖助档列为项目 Mentor，博后聘任原件待核。纪念档用于历史任职。');
changeRow(lm,'Robert Birgeneau（1985 MIT 物理博士导师，Maryland 院系原档具名）','Yuen-Ron Shen（1985–1987 Berkeley PPFP 博士后项目研究师长）',web('Maryland 材料系原档',lu)+' · '+web('UC PPFP 原名录',pp85));
relation(lm,'phd',rb,'advisor',lp,[lu],la,false);
relation(lm,'postdoc',ys,'stage_mentor',lq,[pp85,lu],la,false);

const mu='fd08ed01', rf='师承人物 - Roger W. Falcone', ap='https://www.aps.org/apsnews/1997/04/physicists-to-be-honored-at-1997-spring-meeting', rg='https://physics.berkeley.edu/research-faculty/roger-falcone-research-group/people';
const mp='UC PPFP 原名录列 Murnane 的 1989–1990 Berkeley 物理博士后 fellowship，APS 获奖档独立确认 Berkeley 博士毕业后留校一年、1990 年转任 WSU。PPFP 原档 Mentor 写 Robert Falcone；Berkeley 的 Roger W. Falcone 组名单未区分她的博士与博士后阶段。两处名字和阶段未核对前不归并。';
const md=web('UC PPFP 原名录',pp85)+' · '+web('APS 获奖档',ap)+' · '+web('Roger Falcone 组名单',rg);
audit(mu,{postdoc:['unresolved',mp,[pp85,ap,rg]]},'已确认 1989–1990 Berkeley 博后，查本人履历、项目或档案馆原件，核 Robert 与 Roger 的记录冲突及学位论文正式导师。');
note(mu,'- 核查边界：',mp+' '+md);
changeRow(mu,null,'1989–1990 Berkeley PPFP 博士后。档案 Mentor 写 Robert Falcone，姓名与阶段待核',md);

const sk='3e98cbe3', sc='https://faculty.washington.edu/slkeller/Keller%20CV%20Dec2025.pdf', sg=local('0087ede3'), sz='师承人物 - Joseph A. Zasadzinski', hm='师承人物 - Harden M. McConnell';
const sx='Keller 本人 2025 CV 列 May 1995 Princeton 物理博士，Mentor Sol M. Gruner。';
const sy='Keller 本人 CV 分列 1995–1997 年 8 月 UCSB 博士后 Mentor Joseph Zasadzinski、1997 年 8 月至 2000 年 3 月 Stanford 博士后 Mentor Harden McConnell。UC PPFP 原名录独立确认前一阶段。';
const sa=audit(sk,{phd:['group_or_candidate',sx,[sc]],postdoc:['group_or_candidate',sy,[sc,pp90]]},'已取得本人 CV 的三个阶段 Mentor 栏。核 Princeton 学位签署和两个博后聘任中的正式角色。');
for (const [stage,target,label,ev,sources] of [
 ['phd',sg,'博士阶段研究师长',sx,[sc]],
 ['postdoc',sz,'UCSB 博士后阶段研究师长','本人 CV 列 1995 至 1997 年 8 月 UCSB 博士后 Mentor，UC PPFP 原名录交叉确认。',[sc,pp90]],
 ['postdoc',hm,'Stanford 博士后阶段研究师长','本人 CV 列 1997 年 8 月至 2000 年 3 月 Stanford 博士后 Mentor。',[sc]]
]){
 const role=stage==='phd'?'博士阶段':'博士后阶段';
 const s=web('Keller 本人 CV',sc)+ev+(target===sz?' '+web('UC PPFP 原名录',pp90):'');
 replaceNoteLabel(sk,role+'研究师长',role+'研究师长',target,' '+s);
 mentorLine(target,sk,'- '+role+'研究者：',s);
 indexLine(sk,target,label,s);
 relation(sk,stage,target,'stage_mentor',ev,sources,sa,false);
}
changeRow(sk,'Sol M. Gruner（1995 Princeton 博士阶段研究师长）','Joseph A. Zasadzinski（1995–1997 UCSB 博后阶段研究师长）；Harden M. McConnell（1997–2000 Stanford 博后阶段研究师长）',web('Keller 本人 CV',sc)+' · '+web('UC PPFP 原名录',pp90));

const ky='2cfbf811', kc='https://asianpacificfund.org/wp-content/uploads/2021/06/Ka-Yee-C.-Lee-CV.pdf';
const kx='旧版本人 CV 记录 Stanford 1992–1995 博后 Supervisor Harden McConnell 及 UCSB 1995–1998 博后 Supervisor Joseph Zasadzinski。UC PPFP 官方档独立确认 Zasadzinski 为 1995–1996 UCSB 奖项导师，奖项区间和历史岗位区间分列。';
const ka=audit(ky,{postdoc:['confirmed_advisor',kx,[pp90,kc]]},'PPFP 奖项导师已核实。本人旧 CV 链接本次 404，追查新存档并保留已录原文证据。');
enrich(ky,'postdoc',sz,'博士后研究者',web('UC PPFP 原名录',pp90)+'交叉核对 1995–1996 UCSB fellowship Mentor，该区间是奖项名录记载。旧版本人 CV 所列 UCSB 博后聘期为 1995–1998。');
changeRow(ky,null,'Harden M. McConnell（1992–1995 Stanford 博后导师）；Joseph A. Zasadzinski（1995–1998 UCSB 博后导师，PPFP 奖项档单列 1995–1996）',web('UC PPFP 原名录',pp90));
relation(ky,'postdoc',sz,'advisor',kx,[pp90,kc],ka,false);
relation(ky,'postdoc',hm,'advisor','既有本人 CV 记录 Stanford 1992–1995 博后 Supervisor Harden McConnell。本轮旧链接 404，保留既有证据。',[kc],ka,false);

const pe='3dcc612f', pn='https://news.stonybrook.edu/newsroom/press-release/general/peterwstephens/';
const ps='Stony Brook 的 AAAS 获奖原档列 MIT PhD 及 1978–1980 MIT Chaim Weizmann Postdoctoral Fellow，并核对固态材料 X 射线粉末衍射。UC PPFP 另列同名、同一 Stony Brook 职位，却写 1993–1995 UCLA Mathematics 和 Bruce Rothschild，暂列档案字段冲突。';
const px=web('Stony Brook AAAS 获奖原档',pn)+' · '+web('UC PPFP 原名录',pp90);
audit(pe,{phd:['unresolved','Stony Brook 获奖档确认 MIT 博士，导师未具名。',[pn]],postdoc:['unresolved',ps,[pn,pp90]],research:['confirmed','Stony Brook 获奖档核实固态物理与化学的高分辨粉末衍射。',[pn]]},'查 MIT 学位签署与 Chaim Weizmann fellowship 档，核对 PPFP 跨学科条目和 1993–1995 时间冲突。');
note(pe,'- 核查边界：',ps+' '+px);
changeRow(pe,null,'MIT Chaim Weizmann Postdoctoral Fellow（1978–1980，导师待核）；UC PPFP 同名条目存在单位、专业与年代疑点',px);

function align(id, entries, changes, next, school){
 const aid=audit(id,changes,next);
 for (const [stage,target,proof,sources] of entries){
  enrich(id,stage,target,stage==='phd'?'博士生':'博士后研究者',web('核对原页',sources[0])+proof);
  relation(id,stage,target,'advisor',proof,sources,aid,false);
 }
 changeRow(id,...school);
}

const vy='3097d1da', vcv='https://physics.umd.edu/~yakovenk/personal_data/BriefCV.html', vdir='https://www.umdphysics.umd.edu/directory/faculty/current/yakovenk.html';
const vp="本人 CV 列 1987 Landau Institute 理论物理博士 Supervisor Lev Gor’kov。早先 Moscow M.S. 导师 Brazovskii 属硕士阶段。";
const vq='本人 CV 列 1991–1993 Rutgers Research Associate Supervisor Elihu Abrahams，Maryland 物理系档确认是博士后；早先 USSR 研究员任职和 1990 年访问另列。';
align(vy,[['phd',"师承人物 - Lev Gor'kov",vp,[vcv]],['postdoc','师承人物 - Elihu Abrahams',vq,[vcv,vdir]]],{phd:['confirmed_advisor',vp,[vcv]],postdoc:['confirmed_advisor',vq,[vcv,vdir]]},'两阶段导师已有具名原件；核对 Maryland 现任或退休状态。',['Lev Gor’kov（1987 Landau Institute 博士导师）','Elihu Abrahams（1991–1993 Rutgers 博士后导师）',web('本人 CV',vcv)+' · '+web('Maryland 物理系履历',vdir)]);

const ak='80c4b172', ac='https://uni-koeln.de/en/research/international/uoc-global/global-faculty/former-members-of-the-global-faculty/prof-alex-kamenev';
const aq='科隆大学教师履历明确 1996 年 Weizmann 固体物理博士由 Yuval Gefen 指导。';
const at='同一教师履历明确 1996–1999 UCSB 物理系和 Institute for Theoretical Physics 的博后由 Walter Kohn 指导。';
align(ak,[['phd','师承人物 - Yuval Gefen',aq,[ac]],['postdoc','师承人物 - Walter Kohn',at,[ac]]],{phd:['confirmed_advisor',aq,[ac]],postdoc:['confirmed_advisor',at,[ac]]},'查 Weizmann 学位和 UCSB 任命原件补充年份与署名；两阶段具名导师已核。',['Yuval Gefen（1996 Weizmann 固体物理博士导师）','Walter Kohn（1996–1999 UCSB 博士后导师）',web('科隆大学官方履历',ac)]);

const xw='a4b82fcd', xl='https://mnttl.umn.edu/group';
const xq='Minnesota 本人实验室主页明确 UIUC 材料科学与工程系博士后研究在 David G. Cahill 指导下，2014 年 3 月入 Minnesota；Georgia Tech 博士另列。';
align(xw,[['postdoc',local('6d81f0c4'),xq,[xl]]],{postdoc:['confirmed_advisor',xq,[xl]]},'博士论文已具名且博后有本人组档；核 UIUC 博后确切起始。',[null,'David G. Cahill（UIUC 材料科学与工程系博后导师，2014 年 3 月前）',web('Minnesota 本人实验室履历',xl)]);

const mb='03066e1c', mc='https://www.cmu.edu/nanotechnology-forum/Forum_19/USA_Bio/UKFN%202025_Biography_MikaelBacklund.pdf';
const mq='CMU 托管会议履历明确 Backlund 于 2016–2020 在 Harvard–Smithsonian Center for Astrophysics 做博士后，受 Ron Walsworth 指导。';
align(mb,[['postdoc','师承人物 - Ronald Walsworth',mq,[mc]]],{postdoc:['confirmed_advisor',mq,[mc]]},'已有博士后指名证据，继续查 Stanford 论文签署区分 Moerner 博士阶段正式角色。',[null,'Ronald Walsworth（2016–2020 Harvard–Smithsonian 博后导师）',web('CMU 会议原档',mc)]);

const py='https://www.physics.wisc.edu/wp-content/uploads/2023/02/YUANPING_CV_Feb-24-2023-1.pdf', pw='https://engineering.wisc.edu/news/focus-on-new-faculty-yuan-ping-creates-powerful-tools-to-study-quantum-materials/', puc='https://campusdirectory.ucsc.edu/cd_detail?uid=yuanping';
const pq='本人 Wisconsin 托管 CV 第 1 页列 2013–2016 Caltech JCAP 材料博士后，明确受 William A. Goddard III 指导；UCSC 目录同样具名并标 Caltech／LBNL 联合中心。';
for (const id of ['0ed2e1ff','9e117e10']){
 const current=id==='0ed2e1ff';
 const job=current?'Wisconsin 材料系自 2023 年 7 月聘任，附属物理与化学。':'本人 CV 将 UCSC 化学与生化 2016 年 7 月至 2023 年 7 月教职及物理 2017 年 7 月至 2023 年 7 月附属任职列为历史；2023 年 7 月起转 Wisconsin。';
 align(id,[['postdoc',local('ea39607c'),pq,[py,puc]]],{postdoc:['confirmed_advisor',pq,[py,puc]],affiliation:['confirmed',job,[py,pw]],research:['confirmed','Wisconsin 本人 CV 及工程学院原页核对第一性原理量子材料、自旋动力学、量子缺陷及多体理论。',[py,pw]]},'已核实两阶段导师以及 Wisconsin 与 UCSC 的主聘和历史附属区间。',[null,'William A. Goddard III（2013–2016 Caltech JCAP 材料博后导师）',job+' '+web('Wisconsin 托管本人 CV',py)]);
 audits.at(-1).followup_required=false;
 if(!current)editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：与 Wisconsin–Madison 校属记录为同一人。'+job+' '+web('本人 CV',py));
}

const th='57bd5c0a', tg='https://grainger.illinois.edu/about/directory/faculty/hughest';
const tq='Illinois 工程学院教师履历明确 Hughes 于 Illinois 博后在 Eduardo Fradkin 指导下工作。独立保留与 Jeffrey Teo 的合作线索，核其具体阶段和方向。';
align(th,[['postdoc',local('ebda96c0'),tq,[tg]]],{postdoc:['confirmed_advisor',tq,[tg]]},'查 Illinois 博后准确起止及 Teo 候选关系的时间和方向；博士导师保留既有来源。',[null,'Eduardo H. Fradkin（Illinois 博士后导师）',web('Illinois 工程学院教师档',tg)]);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0556';
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


