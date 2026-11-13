const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root = '..';
const notes = path.join(root,'人物');
const index = path.join(root,'师承关系索引.md');
const records = db.prepare('SELECT id,filename,unit FROM records WHERE id=?');
const last = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const updates = new Map(), audits = [], relations = [];
function line(file, match, suffix) {
 const text = updates.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = text.includes('\r\n') ? '\r\n' : '\n';
 const rows = text.split(/\r?\n/);
 const matches = rows.map((row,i) => match(row) ? i : -1).filter(i=>i>=0);
 if (matches.length !== 1) throw Error(file+' expected one line, found '+matches.length);
 const i = matches[0];
 if (!rows[i].includes(suffix)) rows[i] += suffix;
 updates.set(file, rows.join(newline));
}
function source(label,url) { return '['+label+']('+url+')'; }
function personLine(id,prefix,suffix) {
 const record = records.get(id);
 line(path.join(notes,record.filename+'.md'),x=>x.startsWith(prefix),suffix);
}
function schoolSource(id,suffix) {
 const record=records.get(id);
 const file=path.join(root,record.unit+'逐人复核记录.md');
 const contents=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=contents.includes('\r\n')?'\r\n':'\n';
 const rows=contents.split(/\r?\n/);
 const i=rows.findIndex(x=>x.startsWith('| [['+record.filename+'|'));
 if(i<0||!rows[i].endsWith(' |'))throw Error('missing school row '+id);
 if(!rows[i].includes(suffix))rows[i]=rows[i].slice(0,-2)+suffix+' |';
 updates.set(file,rows.join(newline));
}
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mf=name=>path.join(notes,name+'.md');
const sl=id=>path.join(root,records.get(id).unit+'逐人复核记录.md');
const wiki=(name,display)=>'[['+name+'|'+display+']]';
const who=(id,display)=>wiki(records.get(id).filename,display);
const get=file=>updates.get(file)??fs.readFileSync(file,'utf8');
const boundary='- 核查边界：';
function rewrite(file,test,fn) {
 const content=get(file);
 const nl=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const indexes=rows.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(indexes.length!==1)throw Error(file+' expected one matching row, found '+indexes.length);
 const i=indexes[0];
 rows[i]=fn(rows[i],nl);
 updates.set(file,rows.join(nl));
}
function school(id,oldField,newField) {
 const r=records.get(id);
 rewrite(sl(id),x=>x.startsWith('| [['+r.filename+'|'),x=>{
  if(x.includes(newField))return x;
  if(!x.includes(oldField))throw Error('missing school field '+id);
  return x.replace(oldField,newField);
 });
}
function insertAfter(file,prefix,entry){
 if(get(file).includes(entry))return;
 rewrite(file,x=>x===prefix,(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261111_0242_'+id;
 orig.followup_required=true;
 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261111_0242_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"4139074":"https://searchworks.stanford.edu/view/4139074","6822183":"https://searchworks.stanford.edu/view/6822183","6969502":"https://searchworks.stanford.edu/view/6969502","7139087":"https://searchworks.stanford.edu/view/7139087","11470050":"https://searchworks.stanford.edu/view/11470050","12136864":"https://searchworks.stanford.edu/view/12136864","13708114":"https://searchworks.stanford.edu/view/13708114","13876509":"https://searchworks.stanford.edu/view/13876509","uf":"https://phys.ufl.edu/directory/sudi-chen/","k":"https://kavli.berkeley.edu/sudi-chen","shengrp":"https://arpes.stanford.edu/our-people/previous-members","emory":"https://physics.emory.edu/people/bios/wang-yao.html","wcv":"https://scienceweb.clemson.edu/yaowang/wp-content/uploads/sites/9/2021/12/CV-Yao-Wang.pdf","wpost":"https://www.mph-quantum.mpg.de/12380/mphq-exchanges","wgrp":"https://web.stanford.edu/group/photontheory/personnel.html","wdig":"https://purl.stanford.edu/mb383cq6080","il":"https://chemistry.illinois.edu/mikaelb","bdig":"https://purl.stanford.edu/xm355cm5765","bpdf":"https://stacks.stanford.edu/file/xm355cm5765/MPB%20dissertation%20for%20submission-augmented.pdf","nu":"https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/barton-david.html","ngrp":"https://nano-optics.seas.harvard.edu/alumni","npost":"https://www.nationalacademies.org/cdn/materials/9fba0ab5-b1c4-42ae-b8e7-eb398327c017","nold":"https://sites.northwestern.edu/bartongroup/people/david-barton/","uw":"https://phys.washington.edu/people/kai-mei-fu","ygrp":"https://yoshihisa.people.stanford.edu/people","hp":"https://www.ece.uw.edu/spotlight/kai-mei-fu-honored-with-cottrell-scholar-award/","duke":"https://ece.duke.edu/people/jungsang-kim/","bell":"https://isr.umd.edu/event/8347","ktitle":"https://www.duffield.cornell.edu/events/ece-colloquium-jungsang-kim-duke/","jself":"https://www.seas.ucla.edu/~mjarrahi/publications.html","ucla":"https://www.ee.ucla.edu/professor-jarrahi-honored-for-terahertz-research/","jcal":"https://chic.caltech.edu/genealogy/mona-jarrahi/","lcal":"https://chic.caltech.edu/genealogy/tom-lee/","lee":"https://profiles.stanford.edu/thomas-lee","jpost":"https://bsac.berkeley.edu/alumni-list","cu":"https://www.colorado.edu/lab/cuk/tanja-cuk","fhi":"https://www.fhi.mpg.de/2139330/2025-10-09-Tanja-Cuk"};
const src=(...xs)=>xs.map(([label,key])=>source(label,u[key])).join(' · ');
const pl=(id,prefix,evidence)=>personLine(id,prefix,' '+evidence);
const schoolWith=(id,evidence)=>schoolSource(id,' · '+evidence);
const a=(key,note,sources,status)=>[key,note,sources.map(k=>u[k]),status];
function cell(id,n,value){
 const prefix='| [['+records.get(id).filename+'|';
 rewrite(sl(id),x=>x.startsWith(prefix),x=>{
  const end=x.indexOf(']]'), cells=x.slice(end+2).split(' | ');
  if(end<0||cells.length<4)throw Error('missing school cells '+id);
  cells[n]=value;
  return x.slice(0,end+2)+cells.join(' | ');
 });
}
function mentor(file,name,desc,links){
 if(fs.existsSync(mf(file)))return;
 updates.set(mf(file),['# '+name,'','- 类型：师承扩展人物','- '+desc+' '+links,'','## 师承',''].join('\n'));
}
function edge(id,name,mFile,mName,fLabel,bLabel,note,links){
 if(!links)throw Error('edge requires sources '+id);
 const from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 insertAfter(pf(id),'## 师承','\n- '+fLabel+'：'+to+after);
 insertAfter(mf(mFile),'## 师承','\n- '+bLabel+'：'+from+after);
 insertAfter(index,'# 师承关系与候选线索索引','\n- '+from+' → '+fLabel+'：'+to+after);
}
function updateEdge(id,name,mFile,mName,oldForward,oldBack,newForward,newBack,note,links){
 const rec=records.get(id),from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 rewrite(pf(id),x=>x.startsWith('- '+oldForward+'：')&&x.includes(mFile),()=>'- '+newForward+'：'+to+after);
 rewrite(mf(mFile),x=>x.startsWith('- '+oldBack+'：')&&x.includes(rec.filename),()=>'- '+newBack+'：'+from+after);
 rewrite(index,x=>x.startsWith('- '+from+' → '+oldForward+'：')&&x.includes(mFile),()=>'- '+from+' → '+newForward+'：'+to+after);
}
function unit(id,name,label,detail,links){
 const schoolName=records.get(id).unit, node='已核实单位 - '+schoolName+' - '+label;
 const file=path.join(root,'已核实院系',node+'.md');
 const line='- '+who(id,name)+' — '+detail+' '+links;
 const header='[[院校 - '+schoolName+'|返回学校]]';
 if(!fs.existsSync(file)&&!updates.has(file))updates.set(file,['# '+schoolName+'：'+label,'',header,'','## 已核实人物','',line,''].join('\n'));
 else if(!get(file).includes(records.get(id).filename)){
  const contents=get(file), nl=contents.includes('\r\n')?'\r\n':'\n';
  updates.set(file,contents.trimEnd()+nl+line+nl);
 }
 rewrite(pf(id),x=>x.startsWith('- 院系／机构：'),x=>x.includes(node)?x:x.replace(/。$/,'')+' · '+wiki(node,label)+'。');
}




const ids=(...keys)=>keys.map(k=>u[k]);




const shen='人员 - Stanford - Zhi-Xun Shen - 177eaec9';
const yamamoto='师承人物 - Yoshihisa Yamamoto';
const dev='人员 - Stanford - Thomas Devereaux - 4eedb35a';
const moerner='师承人物 - W. E. Moerner';
const dionne='人员 - Stanford - Jennifer Dionne - fb3c4c3e';
const lee='师承人物 - Thomas H. Lee';
const cat=k=>src(['Stanford 学位目录',k]);
const pages=[];
function remember(record_id,key,raw,excerpt){
 pages.push({record_id,url:u[key],raw,excerpt});
}
function reviewed({id,name,key,mentors,evidence,affiliation,research,current,boundaryText,degree,extra=[],prior=[],next,closed=false,raw}){
 const link=cat(key)+(prior.length?' · '+src(...prior):'');
 const auditId=audit(id,[
  a('identity',degree+'；姓名与现任机构原档及研究领域相符。',[key,current],'confirmed'),
  ...(affiliation?[a('affiliation',affiliation,[current],'confirmed')]:[]),
  ...(research?[a('research',research,[current,key],'confirmed')]:[]),
  a('phd',evidence,[key,...prior.map(([,k])=>k)],'confirmed_advisor'),
  ...extra
 ],next);
 if(closed) audits.at(-1).followup_required=false;
 for(const [file,display,oldForward,oldBack,suffix] of mentors){
  if(oldForward)updateEdge(id,name,file,display,oldForward,oldBack,'博士导师','博士生',evidence,link);
  else edge(id,name,file,display,'博士导师','博士生',evidence,link);
  relation(id,auditId,'phd',file,'advisor',evidence,ids(key,...prior.map(([,k])=>k)),suffix);
 }
 rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+boundaryText+' '+link);
 cell(id,2,mentors.map(([,display])=>display).join('、')+'（Stanford 学位论文'+(mentors.length>1?'共同主导师':'主导师')+'）');
 schoolWith(id,link);
 remember(id,key,raw,'直接核读学位目录中的作者、题名及导师职衔。');
 return auditId;
}

const sc='95701d41',scn='Sudi Chen';
reviewed({
 id:sc,name:scn,key:'13876509',mentors:[[shen,'Zhi-Xun Shen','博士课题组负责人','博士课题组成员','shen']],
 degree:'Stanford 应用物理博士，2021 年，Sudi Chen（组档 Su-Di Chen）',
 current:'uf',affiliation:'University of Florida Physics。',research:'非常规超导、强关联电子、ARPES 和太赫兹光谱。',
 evidence:'2021 年 Stanford 应用物理博士论文《High precision photoemission study of overdoped Bi2212 superconductors》的目录明确列 Zhi-Xun Shen 为 degree supervisor。Steven Kivelson 与 Young-Choon Lee 明列为 degree committee member。主导师可信度高。',
 boundaryText:'学位书目明确博士主导师和两位委员。Berkeley 2021–2023 Heising-Simmons Junior Fellowship 档明确 Feng Wang 为 Faculty Advisor，同时列 Wang 组博士后。保留该博士后项目指导职衔，另查是否有任用级的个人指导记录。 '+src(['Berkeley Kavli 任用原档','k'],['UF 物理系','uf']),
 prior:[['Stanford 课题组','shengrp'],['UF 物理系','uf']],
 next:'查 Berkeley 博后任用、项目履历及是否存在分段指导。现有项目指导与博士导师已各自记录。',
 raw:'Sudi Chen, High precision photoemission study of overdoped Bi2212 superconductors, 2021. Shen, Zhi-Xun: degree supervisor. Steven Kivelson and Young-Choon Lee: degree committee member. Stanford Digital Repository kr375dv3729.'
});
rewrite(sl(sc),x=>x.startsWith('- '+who(sc,scn)+'：Stanford 2021 毕业名册'),()=>'- '+who(sc,scn)+'：Stanford 2021 毕业名册列应用物理博士论文题名。'+cat('13876509')+'明确 Zhi-Xun Shen 为 degree supervisor，Steven Kivelson 与 Young-Choon Lee 为委员。');
remember(sc,'uf','UF Department of Physics identifies Sudi Chen as Assistant Professor; PhD in Applied Physics at Stanford in 2021; research on correlated materials, unconventional superconductivity, ARPES and terahertz spectroscopy.','核同人、学位、单位及方向。');
remember(sc,'k','2021–2023 Heising-Simmons Junior Fellow; Faculty Advisor: Professor Feng Wang; Postdoctoral Fellow, UCB, Wang Group.','项目指导角色和同组博后明确。');

const yw='52cfd31c';
reviewed({
 id:yw,name:'Yao Wang',key:'12136864',mentors:[[dev,'Thomas Devereaux','博士课题组负责人','博士课题组成员','devereaux'],[shen,'Zhi-Xun Shen',null,null,'shen']],
 degree:'Stanford Applied Physics 2017 年 PhD，论文关于量子物质的非平衡动力学和光谱',
 current:'emory',affiliation:'Emory 化学系副教授，Physics Graduate Program 成员。',research:'凝聚态理论、量子多体、量子材料及量子信息。',
 evidence:'2017 年 Stanford 应用物理博士论文《Nonequilibrium dynamics and spectroscopies in quantum matter》的书目明确将 Thomas Peter Devereaux 与 Zhi-Xun Shen 均列为 primary advisor。可信度高。',
 boundaryText:'原书目另列 Xiaoliang Qi 为一般 advisor，具体论文角色待签署页。Emory 履历及 MPHQ 交流档支持 Harvard 博后及 Eugene Demler 组归属，任用个人指导继续查。King’s College London 无线通信在读博士、NYU 视频工程教授为不同记录。 '+src(['本人 Clemson CV','wcv'],['Harvard–Max Planck 交流档','wpost']),
 prior:[['Emory 物理项目','emory'],['Stanford Devereaux 组','wgrp'],['Stanford 数字仓储','wdig']],
 next:'查 Stanford 学位签署页的 Qi 角色及 Harvard MPHQ 博后任用对个人指导的表述。',
 raw:'Yao Wang, Nonequilibrium dynamics and spectroscopies in quantum matter, Stanford PhD 2017. Thomas Peter Devereaux and Zhi-Xun Shen both primary advisor. Xiaoliang Qi general advisor field. Stanford Digital Repository mb383cq6080.'
});
remember(yw,'emory','Emory Yao Wang, Associate Professor of Chemistry and Physics Graduate Program Member; 2017 Stanford PhD, Harvard postdoctoral phase, quantum condensed matter and theory.','与 Clemson 和博士原档匹配。');

const mb='03066e1c';
reviewed({
 id:mb,name:'Mikael Backlund',key:'11470050',mentors:[[moerner,'W. E. Moerner','博士阶段课题组负责人','博士阶段课题组成员','moerner']],
 degree:'Stanford 化学博士书目 2015，Illinois 履历列博士 2016，仓储版权人为 Mikael Paul Backlund',
 current:'il',affiliation:'University of Illinois Urbana–Champaign Chemistry。',research:'光学显微、固态自旋量子传感和金刚石色心。',
 evidence:'Stanford 化学博士论文《Challenges, solutions, and biological applications of three-dimensional nanoscale spatial localization of single molecules》书目和原仓储都明确列 W. E. Moerner 为 primary advisor。书目及版权页标 2015，Illinois 本人履历记 2016 博士。导师可信度高。',
 boundaryText:'2015 论文目录与 Illinois 2016 博士履历并列。目录另列 Michael D. Fayer、Vijay Pande 为一般 advisor 字段，具体论文角色待查。Illinois 履历和本人会议简介核 2016–2020 在 Harvard–Smithsonian 与 Harvard 物理的 Ronald Walsworth 博后指导。',
 prior:[['Stanford 数字仓储','bdig'],['Illinois 化学系','il']],
 next:'核 Stanford 签署页中 Fayer 和 Pande 的具体角色及论文年份与正式授位时间。',
 raw:'Mikael Paul Backlund. Thesis (Ph.D.)--Stanford University, 2015. W. E. Moerner: primary advisor. Michael D. Fayer and Vijay Pande: advisor. Stanford Digital Repository xm355cm5765.'
});
remember(mb,'bdig','Mikael Paul Backlund, Stanford 2015 doctoral dissertation. W. E. Moerner explicitly Primary advisor. Fayer and Pande additional advisor fields.','以原仓储元数据交叉核实角色及论文日期。');
remember(mb,'il','Illinois Chemistry identifies Mikael Backlund as a faculty member and states that he received the PhD in Chemistry in 2016 before joining Ron Walsworth as a postdoctoral fellow.','核校属、年份差异及既有博后关系。');
pages.push({record_id:mb,url:u.bpdf,error:'网页工具无法打开 Stanford stacks 的公开 PDF 地址。已核 Stanford 学位目录与仓储元数据，具体签署页继续追查。'});

const dbid='7b10cad8', dbn='David Barton';
const postBarton='Harvard Lončar 实验室校友表在 Postdocs & Research Scientists 栏列 David Barton 2020 年 9 月至 2023 年 12 月，并链接 Northwestern。国家科学院任用介绍另核博士后身份，组负责人关系可信度高，正式个人指导职衔待核。';
const postBartonLinks=src(['Harvard 实验室校友档','ngrp'],['国家科学院履历','npost']);
const ba=reviewed({
 id:dbid,name:dbn,key:'13708114',mentors:[[dionne,'Jennifer Dionne','博士阶段研究师长','博士阶段研究成员','dionne']],
 degree:'Stanford 2020 博士论文研究纳米光子学和超表面，目录作者 David Barton',
 current:'nu',affiliation:'Northwestern Materials Science and Engineering；此前 Applied Physics 项目记录另保留。',research:'集成光子学、非线性纳米光学、超表面与量子光子器件。',
 evidence:'2020 年 Stanford 论文《High quality factor phase gradient metasurfaces for nonlinear and reconfigurable nanophotonics》明确列 Jennifer Anne Dionne 为 degree supervisor。Mark L. Brongersma、Jonathan Albert Fan 明列为 degree committee member。主导师可信度高。',
 boundaryText:'博士主导师及两位委员按学位书目记录。Harvard 组档核博士后组属日期，正式个人指导职衔待核。 '+postBartonLinks,
 prior:[['Northwestern 工学院','nu']],
 extra:[a('postdoc',postBarton,['ngrp','npost'],'group_or_candidate')],
 next:'查 Harvard 博士后任用或本人 CV 是否明确 Marko Lončar 的个人指导职衔。',
 raw:'David Barton. High quality factor phase gradient metasurfaces for nonlinear and reconfigurable nanophotonics. Stanford 2020. Jennifer Anne Dionne: degree supervisor. Mark L. Brongersma and Jonathan Albert Fan: degree committee member. Stanford Digital Repository gf033sv1572.'
});
const loncar='人员 - Harvard - Marko Lončar - a4c6b783';
updateEdge(dbid,dbn,loncar,'Marko Lončar','博士后课题组负责人','博士后课题组成员','博士后课题组负责人','博士后课题组成员',postBarton,postBartonLinks);
cell(dbid,3,'Marko Lončar（Harvard 博后课题组负责人，组档 2020-09 至 2023-12）');
schoolWith(dbid,postBartonLinks);
relation(dbid,ba,'postdoc',loncar,'group_leader',postBarton,ids('ngrp','npost'),'loncar');
remember(dbid,'ngrp','Harvard Laboratory for Nanoscale Optics alumni under Postdocs & Research Scientists: David Barton (September 2020–December 2023), Assistant Professor, Northwestern University.','归属及日期明确。');

const kf='41c97d5c';
reviewed({
 id:kf,name:'Kai-Mei Fu',key:'6969502',mentors:[[yamamoto,'Yoshihisa Yamamoto','博士阶段课题组负责人','博士阶段课题组成员','yamamoto']],
 degree:'Stanford 2007 年应用物理博士论文，研究 GaAs 中束缚电子自旋',
 current:'uw',affiliation:'UW Physics 与 Electrical and Computer Engineering；既有 PNNL 联合任用据原任用公告。',research:'晶体量子缺陷、固态自旋和光子器件。',
 evidence:'Stanford 2007 年论文《Optical manipulation of electron spins bound to neutral donors in GaAs》学位书目明确列 Yoshihisa Yamamoto 为 primary advisor。可信度高。',
 boundaryText:'Stanford 学位书目确认 Yamamoto。PPPL 资料所列 Nathaniel Fisch 对应 Princeton 本科论文。UW 档核 HP Labs 博士后，Raymond G. Beausoleil 保留低可信候选，待本人或机构任用明确说明个人指导。 '+src(['UW ECE 原档','hp']),
 prior:[['Yamamoto 校友名录','ygrp'],['UW 物理系','uw']],
 next:'查 HP Labs 博士后任用原档或本人履历中的具名指导。',
 raw:'Kai-Mei Fu, Optical manipulation of electron spins bound to neutral donors in GaAs. Thesis (Ph.D.) Stanford 2007. Yoshihisa Yamamoto, primary advisor.'
});
remember(kf,'uw','University of Washington identifies Kai-Mei Fu as Professor of Physics and ECE; research in crystal defects and quantum technologies.','核同人与院系研究。');

const jk='c34493f4';
reviewed({
 id:jk,name:'Jungsang Kim',key:'4139074',mentors:[[yamamoto,'Yoshihisa Yamamoto','博士阶段课题组负责人','博士阶段课题组成员','yamamoto']],
 degree:'Stanford 1999 物理学博士，论文研究单光子的产生和探测',
 current:'duke',affiliation:'Duke Electrical and Computer Engineering；物理等兼任沿用既有校档。',research:'离子阱量子信息、量子网络及量子光学器件。',
 evidence:'Stanford 1999 年物理论文《Single photonics: generation and detection of heralded single photons》目录明确列 Yoshihisa Yamamoto 为 primary advisor。可信度高。',
 boundaryText:'Stanford 书目确认博士导师。Cornell 讲座履历核 1999 年入 Bell Labs、2004 年入 Duke，Maryland 的本人讲座档明确 Bell Labs 职位为 Member of Technical Staff 与 Technical Manager。现有来源未分列博士后任用。 '+src(['Cornell 讲座履历','ktitle'],['Maryland 讲座履历','bell']),
 prior:[['Duke 院系档','duke'],['Yamamoto 校友名录','ygrp']],
 extra:[a('postdoc','1999–2004 Bell Laboratories；Maryland 机构档列 Member of Technical Staff 和 Technical Manager，Cornell 同期资料核时段。所阅履历未列独立博士后任用。',['bell','ktitle'])],
 next:'追查 Bell Labs 同期岗位档与个人 CV 是否分列独立博士后任用。',
 raw:'Jungsang Kim. Single photonics: generation and detection of heralded single photons. Thesis (Ph.D.) Stanford 1999. Yoshihisa Yamamoto, primary advisor.'
});
cell(jk,3,'1999–2004 Bell Labs 技术成员及技术经理；已读履历未分列博士后任用');
schoolWith(jk,src(['Cornell 讲座履历','ktitle'],['Maryland 讲座履历','bell']));
remember(jk,'bell','Jungsang Kim, Stanford Physics PhD 1999. Bell Laboratories Member of Technical Staff and Technical Manager before joining Duke ECE in 2004.','核 Bell Labs 职称和身份。');

const mj='19d5a026';
reviewed({
 id:mj,name:'Mona Jarrahi',key:'7139087',mentors:[[lee,'Thomas H. Lee','博士导师候选','博士生候选','lee']],
 degree:'Stanford 2007 电气工程博士，题名和 Jarrahi 本人 UCLA 论文目录一致',
 current:'ucla',affiliation:'UCLA Samueli Electrical and Computer Engineering。',research:'太赫兹光电子学及等离激元光学。',
 evidence:'Stanford 2007 年电气工程博士论文《Optical spatial quantization for higher performance analog to digital conversion》目录明确列 Thomas H. Lee 为 primary advisor。Caltech 电气工程学术师承项目将 Jarrahi 与 MIT 1990 Sc.D.、Stanford EE 的 Thomas H. Lee 相连。书目附带的 1923 生年标记保留为书目消歧问题，人物节点采用 Caltech 与 Stanford 校档对应的电路学者。主导师可信度高。',
 boundaryText:'Stanford 书目和 Caltech 双向师承档确认 Thomas H. Lee 的论文主导师角色。R. Fabian W. Pease 与 David A. B. Miller 仍为候选，待签署页区分角色。Berkeley 原校友档列 Albert P. Pisano 博后导师。',
 prior:[['Caltech Jarrahi 师承档','jcal'],['Caltech Lee 师承档','lcal'],['Stanford Lee 校档','lee'],['本人论文目录','jself']],
 next:'查 2007 Stanford 签署页及 Pease 和 Miller 的实际论文角色。保留书目生年标记待机构订正。',
 raw:'Mona Jarrahi. Optical spatial quantization for higher performance analog to digital conversion, Stanford 2007. Lee, Thomas H., 1923-: primary advisor. Caltech genealogy disambiguates the faculty member independently.'
});
cell(mj,2,'Thomas H. Lee（Stanford 学位论文主导师）；R. Fabian W. Pease、David A. B. Miller（论文角色候选）');
remember(mj,'ucla','UCLA Electrical and Computer Engineering identifies Professor Mona Jarrahi and her use of plasmonic technology and lasers to generate and detect terahertz waves.','核院系和研究方向。');
remember(mj,'jcal','Caltech EE Academic Genealogy Project: Mona Jarrahi THz Electronics Lab. The genealogy navigation leads directly to Thomas H. Lee.','浏览器核师承图的上游边。');
remember(mj,'lcal','Caltech EE Academic Genealogy Project: Thomas H. Lee, Stanford University, Sc.D. MIT 1990, joined Stanford EE in 1994. His genealogy lists Mona Jarrahi (UCLA).','用反向边及 Lee 的任职教育消歧。');

const tc='accdd77e';
reviewed({
 id:tc,name:'Tanja Ćuk',key:'6822183',mentors:[[shen,'Zhi-Xun Shen','博士阶段研究师长','博士阶段受指导者','shen']],
 degree:'Stanford 2007 年应用物理博士，学位书目拼写 Tanja Cuk',
 current:'cu',affiliation:'Colorado Boulder Chemistry，兼 Materials Science and Engineering 与能源研究机构，沿用既有核验。',research:'超快界面光谱、界面物理化学及量子材料。',
 evidence:'Stanford 2007 年应用物理博士论文《Investigation of the high-Tc phase diagram using optical spectroscopies and high pressures》的目录明确列 Zhi-Xun Shen 为 primary advisor。Fritz Haber Institute 原档独立核该博士阶段关系。可信度高。',
 boundaryText:'Zhi-Xun Shen 的博士导师由 Stanford 学位书目明确。Fritz Haber Institute 记 2010 年完成 Berkeley Miller 博后，明确 Heinz Frei 指导。2025 Fritz Haber 访问研究属于后续任用。 '+src(['Fritz Haber Institute','fhi']),
 prior:[['Fritz Haber Institute','fhi'],['Colorado 本人组页','cu']],
 next:'两阶段指导、院系与方向均有可核原档。本轮无待处理的具体师承线索。',
 closed:true,
 raw:'Tanja Cuk. Investigation of the high-Tc phase diagram using optical spectroscopies and high pressures. Thesis (Ph.D.) Stanford 2007. Zhi-Xun Shen, primary advisor.'
});
remember(tc,'fhi','Tanja Cuk obtained her Stanford Applied Physics PhD in 2007 under Zhi Xun Shen and completed a Berkeley Miller postdoctoral fellowship in 2010 under Heinz Frei.','核两个阶段及后续访问研究。');
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0242_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0242_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0242_Stanford博士论文目录与原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
