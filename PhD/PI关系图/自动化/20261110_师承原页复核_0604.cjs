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

const lu='bee5428b', tin='师承人物 - Michael Tinkham', mc=local('e235f5d3');
const ppf='https://ppfp.ucop.edu/info/fellowship-recipients/fellows-1997/fellows-1997-name/', dp='https://dornsife.usc.edu/profile/grace-lu/', ece='https://minghsiehece.usc.edu/directory/faculty/profile/?fname=Grace&lname=Lu', mse='https://chems.usc.edu/people/affiliated-faculty/';
const lp='UC PPFP 1997 年度档明确将 Michael Tinkham 列为 Jia Grace Lu 的 Thesis Advisor，USC ECE 和物理履历交叉确认 1997 Harvard 应用物理博士及课题组。';
const lq='UC PPFP 1997 年度档列 Paul McEuen 为项目 Mentor，USC 物理履历明确 Berkeley 博后奖项的 1997–1998 任期。';
const la=audit(lu,{identity:['confirmed','USC Dornsife 标题 Grace Lu，履历用 Jia Grace Lu，与 UC 奖助档姓名和学位相符。',[dp,ppf]],phd:['confirmed_advisor',lp,[ppf,dp,ece]],postdoc:['group_or_candidate',lq,[ppf,dp,ece]],affiliation:['confirmed','USC Dornsife、ECE 和 Mork 院系目录交叉核对物理、电气工程与化工材料关联。',[dp,ece,mse]],research:['confirmed','USC 本人及 ECE 档列低维纳米材料、电荷与自旋输运及器件。',[dp,ece]]},'查 Berkeley 博后聘任或本人履历的正式 advisor 称谓；已有具名项目 Mentor。');
enrich(lu,'phd',tin,'博士生',web('UC PPFP 1997 年度原档',ppf)+'列 Thesis Advisor，'+web('USC ECE 本人履历',ece)+'复核博士单位、年份与研究主题。');
const ls=' '+web('UC PPFP 1997 年度原档',ppf)+'列为项目 Mentor，'+web('USC 物理履历',dp)+'列 1997–1998 Berkeley fellowship。';
replaceNoteLabel(lu,'博士后导师','博士后阶段研究师长',mc,ls);
replaceInverseLabel(mc,lu,'博士后研究者','博士后阶段研究者',ls);
replaceIndexLabel(lu,mc,'博士后导师','博士后阶段研究师长',ls);
note(lu,'- 核查边界：',web('USC Mork 附属教师目录',mse)+'确认化工与材料科学列名；McEuen 的正式任命称谓待核。');
changeRow(lu,'Michael Tinkham（1997 Harvard 应用物理博士导师）','Paul McEuen（1997–1998 Berkeley PPFP 博士后项目师长）',web('UC PPFP 1997 年度原档',ppf)+' · '+web('USC Mork 附属教师目录',mse));
relation(lu,'phd',tin,'advisor',lp,[ppf,dp,ece],la,false);
relation(lu,'postdoc',mc,'stage_mentor',lq,[ppf,dp,ece],la,false);

const xu='eaf4348d', wu=local('9e0468d5'), sw='师承人物 - Brian Swingle';
const tam='https://artsci.tamu.edu/physics-astronomy/contact/profiles/shenglong-xu.html', aps='https://journals.aps.org/prb/staff', prx='https://physics.aps.org/featured-article-pdf/10.1103/PhysRevX.9.031048', cvsw='https://umdphysics.umd.edu/images/CV/swingle_cv.pdf', br='https://www.brandeis.edu/physics/people/profiles/swingle-brian.html', cm='https://physics.umd.edu/cmtc/people.html';
const wcv='https://wucj.lab.westlake.edu.cn/Appl/Wu_CV_2025_Dec.pdf';
const xp='Wu 本人 CV 博士生栏具名 Shenglong Xu 并匹配 Texas A&M 身份。本人 Texas A&M 履历与 APS 编辑介绍均写 UCSD 2017 博士，Wu 旧档写 2016，保留差异和博士阶段师长。';
const xq='Texas A&M 本人履历与 APS 编辑介绍确认 Maryland CMTC 博后，2019 PRX 原论文确认同期与 Brian Swingle 同单位合作；Swingle 本人 CV 记录自 2017 年 7 月任 Maryland 教职。候选线索低可信，合作未给出指导或组属。';
const xa=audit(xu,{phd:['group_or_candidate',xp,[wcv,tam,aps]],postdoc:['group_or_candidate',xq,[tam,aps,prx,cvsw,cm]],affiliation:['confirmed','Texas A&M 物理与天文系和 APS 编辑履历匹配。',[tam,aps]],research:['confirmed','Texas A&M 本人履历列凝聚态理论、量子多体物理，PRX 原作研究算符增长。',[tam,prx]]},'eScholarship 退避结束后核 UCSD 学位签署和 2016／2017 差异；查 CMTC 任命、资助或本人履历核 Swingle 与其他指导者。');
const xs=web('APS 编辑档',aps)+'确认 Maryland CMTC 博后。'+web('2019 PRX 同期论文',prx)+'和'+web('Swingle 本人 CV',cvsw)+'核对同单位合作与时段。候选为低可信，指导与组属待核。';
const xr=records.get(xu);
editLine(fn(xr.filename),l=>l.startsWith('- 核查边界：'),l=>'- 博士后导师候选：[['+sw+'|Brian Swingle]]。'+xs+'\n'+l);
if(fs.existsSync(fn(sw))||fs.existsSync(path.join(root,'师承人物',sw+'.md')))throw Error('existing Swingle node');
graph.set(fn(sw),'# Brian Swingle\n\n> [!info] 师承扩展人物\n> Brandeis 物理系教师，研究量子多体系统、量子信息与引力。'+web('Brandeis 物理系档',br)+'。\n\n## 师承\n\n- 博士后阶段候选关联人物：[['+xr.filename+'|'+xr.name+']]。'+xs+'\n');
const candidateIndex=path.join(root,'师承候选线索索引.md');
editLine(candidateIndex,l=>l==='# 师承候选线索索引',l=>l+'\n\n- [['+xr.filename+'|'+xr.name+']] → 博士后导师候选：[['+sw+'|Brian Swingle]]。'+xs);
changeRow(xu,'Congjun Wu（UCSD 博士阶段研究师长，学位年份待核）','Maryland CMTC 博士后；Brian Swingle（同期合作，导师候选，低可信）',web('APS 编辑档',aps)+' · '+web('2019 PRX 原论文',prx));
relation(xu,'phd',wu,'stage_mentor',xp,[wcv,tam,aps],xa);
relation(xu,'postdoc',sw,'candidate',xq,[tam,aps,prx,cvsw,cm],xa);

function align(id,entries,changes,next,school){
 const aid=audit(id,changes,next);
 for(const [stage,target,proof,sources] of entries){
  enrich(id,stage,target,stage==='phd'?'博士生':'博士后研究者',web('核对原页',sources[0])+proof);
  relation(id,stage,target,'advisor',proof,sources,aid,false);
 }
 changeRow(id,...school);
}

const ba='ee059f9c', bc='https://cjbartel.github.io/assets/files/cv/200601_cv.pdf', bg='https://bartel.cems.umn.edu/people/group-members', co='https://www.colorado.edu/lab/musgrave-research-group/chris-bartel';
const bp='Bartel 本人 CV 首页列 2014–2018 Colorado Boulder 化工博士和研究指导 Charles Musgrave、Alan Weimer，末页逐一标为 PhD Advisor。';
const bq='本人 CV 首页明确 Berkeley 材料系博士后起于 2019 年 5 月，Gerbrand Ceder 为 Advisor，末页再次列 Postdoctoral Advisor。Colorado 组档独立确认该阶段指导。';
align(ba,[['phd','师承人物 - Charles Musgrave',bp,[bc,co]],['phd','师承人物 - Al Weimer',bp,[bc,co]],['postdoc','师承人物 - Gerbrand Ceder',bq,[bc,co]]],{phd:['confirmed_advisor',bp,[bc,co]],postdoc:['confirmed_advisor',bq,[bc,co]],affiliation:['confirmed','Minnesota 本人组档列化工与材料系、Chemical Physics graduate faculty、Data Science Initiative affiliate。',[bg]],research:['confirmed','本人 CV 的论文和课题题目核实计算材料、热化学和材料机器学习。',[bc,bg]]},'确认两阶段全部具名导师，核 Berkeley 博后结束时间。',['Charles Musgrave、Alan Weimer（2018 Colorado Boulder 化工博士导师）','Gerbrand Ceder（2019 年 5 月起 Berkeley 博士后导师，结束时间待核）',web('本人 CV',bc)+' · '+web('Minnesota 组档',bg)]);

const md='62557402', ma=local('c2c28f2e'), nc='https://ocr.lib.ncsu.edu/ocr/LD/LD3928-A23-2008-fall/LD3928-A23-2008-fall.pdf', gt='https://www.mse.gatech.edu/people/mark-losego', bu='https://braun.matse.illinois.edu/alumni/postdoctoral-researchers/';
const mp='NC State 2008 Fall Commencement 校方档将 Mark Daniel Losego 的材料博士论文 Interfacing Epitaxial Oxides to Gallium Nitride 列为受 Jon Paul Maria 指导，与博士论文已有原文记录及 Georgia Tech 履历一致。';
const mq='Georgia Tech 教师页证 Illinois 博后，Braun 组原名册列 2008 年 9 月至 2011 年 9 月博后。个人正式导师角色仍待核。';
align(md,[['phd',ma,mp,[nc,gt]]],{phd:['confirmed_advisor',mp,[nc,gt]],postdoc:['group_or_candidate',mq,[gt,bu]],affiliation:['confirmed','Georgia Tech 教师档核材料科学与工程系。',[gt]],research:['confirmed','Georgia Tech 教师档核有机–无机界面、功能氧化物和气相薄膜。',[gt]]},'博士导师已由博士论文记录及毕业典礼档交叉确认，签署页待查；追查 Illinois 博后任命中 Braun 的正式称谓。',['Jon-Paul Maria（2008 NC State 材料博士导师）','Paul V. Braun（2008-09 至 2011-09 Illinois 博士后课题组负责人）',web('NC State 2008 毕业典礼原档',nc)+' · '+web('Braun 组原档',bu)]);

const gh='0ae05a57', swg=local('45e69f97');
const us='https://www.chem.ucsb.edu/news/welcome-our-new-associate-professor-grace-han', po='https://chem.postech.ac.kr/bbs/board.php?bo_table=sub7_1&page=3&wr_id=384';
const gp='POSTECH 化学系校友档明确称 Han 在 Timothy Swager 指导下取得 MIT 博士学位；UCSB 化学与生化系介绍独立说明 Swager 指导化学博士及有机光伏发色团研究。';
const gq='UCSB 院系介绍确认 MIT 材料系博后与 Jeffrey Grossman 工作，POSTECH 明确为其研究室。沿用组负责人，正式指导待核。';
align(gh,[['phd',swg,gp,[po,us]]],{phd:['confirmed_advisor',gp,[po,us]],postdoc:['group_or_candidate',gq,[po,us]],affiliation:['confirmed','UCSB 院系档列化学与生化副教授。',[us]],research:['confirmed','UCSB 及 POSTECH 院系档列光控有机材料、太阳能热储存、光控相变与材料回收。',[us,po]]},'补查 MIT 学位签署页和 Grossman 博后聘任的正式导师称谓。',['Timothy Manning Swager（MIT 化学博士导师）','Jeffrey Grossman（MIT 材料系博士后课题组负责人）',web('UCSB 院系档',us)+' · '+web('POSTECH 校友档',po)]);

const fz='d27e367c', pk=local('be1d4c3b'), fc='https://www.umdphysics.umd.edu/images/CV/2025_26/2025_CV_Frank_Zhao.pdf';
const fp='Maryland 托管本人 CV 列 Philip Kim 为 2014–2021 Harvard 博士阶段 Research Advisor，2012–2014 Columbia 硕士阶段同一指导者单列。';
const fq='本人 CV 列 2021–2025 MIT 物理系 Postdoctoral Associate，具名 Joseph G. Checkelsky 为 Research Advisor。';
align(fz,[['phd',pk,fp,[fc]]],{phd:['confirmed_advisor',fp,[fc]],postdoc:['confirmed_advisor',fq,[fc]],affiliation:['confirmed','Maryland 托管本人 CV 列自 2025 年物理系与 Quantum Materials Center 聘任。',[fc]],research:['confirmed','本人 CV 的论文研究包括低维凝聚态、超导与量子材料。',[fc]]},'两阶段具名指导与聘期已核；如取得 Harvard 学位签署页可补档。',['Philip Kim（2014–2021 Harvard 博士导师；先前 Columbia 硕士指导另列）','Joseph G. Checkelsky（2021–2025 MIT 博士后导师）',web('Maryland 托管本人 CV',fc)]);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0604';
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




