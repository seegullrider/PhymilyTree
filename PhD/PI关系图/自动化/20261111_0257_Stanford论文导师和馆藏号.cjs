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
 orig.audit_id='pi_archive_20261111_0257_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0257_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"673854":"https://searchworks.stanford.edu/view/673854","2841338":"https://searchworks.stanford.edu/view/2841338","2956092":"https://searchworks.stanford.edu/view/2956092","3048948":"https://searchworks.stanford.edu/view/3048948","3090579":"https://searchworks.stanford.edu/view/3090579","3399617":"https://searchworks.stanford.edu/view/3399617","3788043":"https://searchworks.stanford.edu/view/3788043","5510338":"https://searchworks.stanford.edu/view/5510338","6310200":"https://searchworks.stanford.edu/view/6310200","7203683":"https://searchworks.stanford.edu/view/7203683","10608120":"https://searchworks.stanford.edu/view/10608120","11849306":"https://searchworks.stanford.edu/view/11849306","jia":"https://phys.ufl.edu/people/faculty/chunjing-jia/","jcv":"https://web.stanford.edu/~chunjing/","jgrp":"https://devereauxgroup.stanford.edu/personnel/former","al":"https://oden.utexas.edu/people/directory/Narayana-Aluru/","alg":"https://eil.stanford.edu/people","cao":"https://engineering.yale.edu/research-and-faculty/faculty-directory/hui-cao","caoph":"https://physics.yale.edu/condensed-matter-physics-experimental","caocv":"https://www.eng.yale.edu/caolab/CV_Cao.pdf","caointer":"https://www.eng.yale.edu/caolab/papers/LFW16.pdf","caog":"https://yoshihisa.people.stanford.edu/people","ahn":"https://engineering.yale.edu/research-and-faculty/faculty-directory/charles-ahn","ol":"https://news.mit.edu/2017/william-oliver-appointed-lincoln-laboratory-fellow-rle-associate-director-0302","li":"https://sites.google.com/umich.edu/li-research-group/members","lig":"https://chuehlab.stanford.edu/theses","lirsc":"https://pubs.rsc.org/en/content/articlehtml/2024/mh/d4mh90040e","liden":"https://www.mse.engin.umich.edu/people/fac/yiyangli","zia":"https://engineering.brown.edu/people/rashid-zia","ziacv":"https://zia-lab.com/sites/default/files/Rashid_Zia_CV_January_2016_1.pdf","ziag":"https://brongersma.stanford.edu/alumni/","archer":"https://www.duffield.cornell.edu/people/lynden-a-archer/","archi":"https://engineering.stanford.edu/spotlight/lynden-archer","vlas":"https://seas.harvard.edu/person/joost-vlassak","vdoe":"https://www.osti.gov/servlets/purl/833870","mitzi":"https://mems.duke.edu/people/david-mitzi/","mitzig":"https://kapitulnik.stanford.edu/people","huf":"https://engineering.jhu.edu/faculty/todd-hufnagel/","hufref":"https://www.slac.stanford.edu/pubs/slacreports/reports08/slac-r-598.pdf","fid":"https://phys.washington.edu/people/lukasz-fidkowski","fida":"https://arxiv.org/abs/hep-th/0406086"};
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




const dev='人员 - Stanford - Thomas Devereaux - 4eedb35a', shen='人员 - Stanford - Zhi-Xun Shen - 177eaec9', yama='师承人物 - Yoshihisa Yamamoto';
const chueh='人员 - Stanford - William Chueh - 3f3ae1fa', brong='人员 - Stanford - Mark Brongersma - 2026ea79', fuller='人员 - Stanford - Gerald Fuller - bcffe1c3';
const cat=k=>src(['Stanford 学位目录',k]);
const pages=[];
function remember(id,key,raw,excerpt) {pages.push({record_id:id,url:u[key],raw,excerpt});}
function graduate(d){
 const {id,name,key,title,year,current,affiliation,research,links=[],phase,next,mentors=[],additional=[],status,phdCell,tail}=d;
 const evidence=year+' 年 Stanford 博士论文《'+title+'》。'+phase;
 const refs=cat(key)+' · '+src(['现任机构原档',current],...links);
 const auditId=audit(id,[
  a('identity',year+' Stanford 博士书目题名、作者与其现单位或教育履历吻合。',[key,current],'confirmed'),
  a('affiliation',affiliation,[current],'confirmed'),
  a('research',research,[current,key],'confirmed'),
  a('phd',evidence,[key,...links.map(([,k])=>k)],status??(mentors.length?'confirmed_advisor':'group_or_candidate')),
  ...additional
 ],next);
 for(const [file,display,oldForward,oldBack,suffix] of mentors){
  if(oldForward)updateEdge(id,name,file,display,oldForward,oldBack,'博士导师','博士生',evidence,refs);
  else edge(id,name,file,display,'博士导师','博士生',evidence,refs);
  relation(id,auditId,'phd',file,'advisor',evidence,ids(key,current,...links.map(([,k])=>k)),suffix);
 }
 if(tail){
   if(d.append)pl(id,boundary,tail+' '+cat(key));
   else rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+tail+' '+refs);
 }
 if(phdCell)cell(id,2,phdCell);
 schoolWith(id,refs);
 remember(id,key,d.raw??(name+' — '+title+'; Stanford PhD '+year+'. '+phase),'浏览器直接核读学位书目。');
 return auditId;
}

graduate({
 id:'43e55cbe',name:'Chunjing Jia',key:'10608120',title:'Numerical studies of inelastic light scattering in correlated materials',year:2014,
 current:'jia',affiliation:'University of Florida 物理系与 Quantum Theory Project。',research:'强关联量子材料、计算凝聚态及非弹性光散射。',
 links:[['本人 Stanford 履历','jcv'],['Devereaux 组校友','jgrp']],
 mentors:[[dev,'Thomas Devereaux','博士课题组负责人','博士课题组成员','devereaux'],[shen,'Zhi-Xun Shen',null,null,'shen']],
 phase:'Thomas Peter Devereaux 与 Zhi-Xun Shen 都明确列为 primary advisor，可信度高。Xiaoliang Qi 仅列一般 advisor 字段，具体角色待签署页。',
 phdCell:'Thomas Devereaux、Zhi-Xun Shen（学位目录均列主导师）',
 tail:'2014 Stanford 应用物理博士书目确认两位主导师。Xiaoliang Qi 的一般 advisor 字段待签署页。本人 Stanford 履历区分 2008–2014 博士阶段研究助理和 2015 年 2 月开始的 Postdoctoral Research Fellow with Prof. Thomas Devereaux，后者保留博士后阶段研究师长。',
 next:'查学位签署页中 Qi 的角色及 Stanford 博士后任用是否具名 advisor。'
});
remember('43e55cbe','jcv','Stanford, Sep 2008–Sep 2014; Research Assistant for Prof. Thomas Devereaux, Sep 2008–Oct 2014; Postdoctoral Research Fellow with Prof. Thomas Devereaux, from Feb 2015.','本人旧站区分两个阶段。');

const hc='55b5f8d9';
rewrite(pf(hc),x=>x.startsWith('- 博士阶段研究师长、正式论文导师候选：')&&x.includes(yama),x=>x.replace('博士阶段研究师长、正式论文导师候选','博士阶段研究师长'));
graduate({
 id:hc,name:'Hui Cao',key:'3788043',title:'Semiconductor cavity QED and related devices',year:1997,
 current:'cao',affiliation:'Yale Applied Physics、Physics、Electrical Engineering（后两项见 Yale Physics 目录）。',research:'纳米光子学、随机激光、介观物理和复杂介质光传播。',
 links:[['Yale 物理系','caoph'],['本人 CV','caocv'],['Yamamoto 校友档','caog']],
 mentors:[[yama,'Yoshihisa Yamamoto','博士阶段研究师长','博士阶段研究者','yamamoto']],
 phase:'学位目录明确列 Yoshihisa Yamamoto 为 primary advisor。题名、应用物理方向及 1997 年份与 Yale 本人履历相符，可信度高。',
 phdCell:'Yoshihisa Yamamoto（Stanford 学位论文主导师）',
 tail:'已核 Stanford 1997 应用物理博士论文的主导师。本人 CV 和访谈显示毕业后直接于 1997 年 9 月赴 Northwestern 任助理教授，现有任用档未列独立博士后。Stanford 2002 石油工程同名者、HKUST 的 NUS 有机化学博士同名者为不同人。 '+src(['本人访谈','caointer'])+' · [Stanford 2002 石油工程同名论文](https://pangea.stanford.edu/ERE/pdf/pereports/PhD/Cao02.pdf) · [HKUST 同名档](https://researchportal.hkust.edu.hk/en/persons/hui-cao/)',
 next:'保留 1997 年毕业后直接赴教职记录。如遇独立博士后任用资料再核。'
});

graduate({
 id:'55dfd7e3',name:'William Oliver',key:'5510338',title:'The generation and detection of electron entanglement',year:2003,
 current:'ol',affiliation:'MIT Electrical Engineering and Computer Science、Physics 及 Lincoln Laboratory（沿用既有 MIT 院系核验）。',research:'超导量子比特、量子工程、低温集成电路。',
 mentors:[[yama,'Yoshihisa Yamamoto','博士阶段研究师长','博士阶段研究者','yamamoto']],
 phase:'书目明确列 Yoshihisa Yamamoto 为 primary advisor。MIT 履历核 Stanford EE 及电子纠缠研究。可信度高。',
 phdCell:'Yoshihisa Yamamoto（Stanford 学位论文主导师）',
 tail:'MIT 履历列 2003 年起加入 Lincoln Laboratory，与 Stanford 2003 学位同年，所阅未分列独立博士后。MIT 硕士研究的 Tod Machover 不并入博士师承。',
 next:'继续核 2003 年 Lincoln Laboratory 的具体初任岗位，以及是否另有未列博士后。'
});
cell('55dfd7e3',3,'MIT 履历列 2003 年加入 Lincoln Laboratory；独立博士后任用待核');
remember('55dfd7e3','ol','MIT News, William D. Oliver joined Lincoln Laboratory in 2003; Stanford Electrical Engineering PhD for research on quantum noise and electron entanglement with Yoshihisa Yamamoto.','核单位、研究和离校时点。');

graduate({
 id:'73a5677d',name:'Yiyang Li',key:'11849306',title:'Nanoscale reaction, transport, and phase transformation in LixFePO4 battery electrodes',year:2016,
 current:'li',affiliation:'Michigan Materials Science and Engineering；既有 Applied Physics 关联保留。',research:'电化学材料、固态离子学、离子电子器件及能量存储。',
 links:[['Chueh 组论文书目','lig']],
 mentors:[[chueh,'William Chueh','博士阶段课题组负责人','博士阶段课题组成员','chueh']],
 phase:'书目明确列 William Chueh 为 primary advisor，可信度高。Yi Cui 和 Alberto Salleo 的一般 advisor 字段待具体角色。',
 phdCell:'William Chueh（Stanford 学位论文主导师）',
 tail:'Stanford 2016 论文书目确认 Chueh 主导师。Yi Cui 与 Alberto Salleo 的一般 advisor 角色待签署页。Alec Talin 的 Sandia 博后指导按此前本人履历保留博士后阶段研究师长，正式任用职衔待核。材料副教授由当前实验室原档确认；注意 Notre Dame 同名研究者。',
 next:'查 Stanford 签署页上的其他论文角色及 Sandia Truman Fellowship 的具名指导。'
});
remember('73a5677d','li','Yiyang Li, Associate Professor of Materials Science and Engineering. Stanford PhD in Materials Science and Engineering; research bridges electrochemistry with microelectronics. Sandia Truman Fellowship is listed.','核现任、方向和本人身份。');
pages.push({record_id:'73a5677d',url:u.lirsc,error:'出版方网站返回 HTTP 403，未读取 Yiyang Li 访谈正文。'});
pages.push({record_id:'73a5677d',url:u.liden,error:'网页工具返回 HTTP 403。已核本人 Michigan 实验室的替代机构来源。'});

graduate({
 id:'692978e9',name:'Rashid Zia',key:'6310200',title:'Guided polariton optics: a combined numerical, analytical, and expertimental [sic] investigation of surface plasmon waveguides',year:2006,
 current:'zia',affiliation:'Brown Engineering 与 Physics。',research:'纳米光子学、量子发射体与光物质相互作用。',
 links:[['本人 CV','ziacv'],['Stanford 组校友','ziag']],
 mentors:[[brong,'Mark Brongersma','博士课题组负责人','博士课题组成员','brongersma']],
 phase:'书目明确列 Mark L. Brongersma 为 primary advisor。Stanford 书目与本人 CV 均记 2006，Brown VIVO 既有 2005 年份记录保留。题名拼写照目录。可信度高（导师）。',
 phdCell:'Mark Brongersma（Stanford 2006 论文主导师；Brown VIVO 既有 2005 年记载）',
 tail:'Stanford 学位论文和本人 CV 均记 2006，Brown VIVO 的 2005 年仍作为来源差异。CV 将 2005 年 Bourgogne 报告与 2006 年 Université de Bourgogne 博士后任用分列，指导人未列。',
 next:'查 2006 年 Bourgogne 博士后正式指导，以及 Brown VIVO 学位年份字段。'
});

graduate({
 id:'9fc56c92',name:'Lynden A. Archer',key:'2841338',title:'Orientation and dynamics of polymeric materials studied by polarization-modulated laser Raman scattering',year:1994,
 current:'archer',affiliation:'Cornell Chemical and Biomolecular Engineering。',research:'高分子物理、电解质及界面材料。',
 links:[['Stanford 本人访谈','archi']],
 mentors:[[fuller,'Gerald Fuller','博士阶段研究师长','博士阶段研究受指导者','fuller']],
 phase:'学位目录明确列 Gerald G. Fuller 为 primary advisor。Stanford 书目列 1994，Cornell 官方履历列 1993，保留两项。主导师可信度高。',
 phdCell:'Gerald Fuller（Stanford 论文主导师；学位书目 1994、Cornell 履历 1993）',
 tail:'Fuller 主导师由 Stanford 学位书目确认。该书目记 1994，Cornell 现任履历记 1993 并列 1993–1994 AT&T Bell Labs 博后。本人 Stanford 采访称博后与 Ronald G. Larson 共事，维持候选。',
 next:'核 Stanford 论文与正式授位年份差异，找 Bell Labs 任用或 Larson 原档的具名导师。'
});
remember('9fc56c92','archer','Cornell Engineering profile: Stanford Chemical Engineering doctorate in 1993; postdoctoral member of technical staff at AT&T Bell Laboratories in 1993–94.','核记录的另一授位年份及独立博后阶段。');

const nf='1c69a0d3', fn='Lukasz Fidkowski', fmentor='师承人物 - Stephen Shenker';
const fidText='Stanford 2008 博士论文《Singularity resolution in string theory and new quantum condensed matter phases》书目具名 Stephen Hart Shenker 为 advisor / Thesis advisor；书目无 primary 或 degree supervisor 字段。博士论文研究指导有原档，主导师或其他签署角色待学位签署页。';
const fidLinks=cat('7203683')+' · '+src(['UW 物理系','fid'],['博士阶段原论文线索','fida']);
const fa=graduate({
 id:nf,name:fn,key:'7203683',title:'Singularity resolution in string theory and new quantum condensed matter phases',year:2008,
 current:'fid',affiliation:'University of Washington Physics。',research:'拓扑量子物态、分数量子 Hall、强关联理论、量子信息。',
 phase:fidText,status:'group_or_candidate',
 phdCell:'Stephen Shenker（学位书目 Thesis advisor；具体签署角色待核）',
 tail:'Stanford 书目确认 Stephen Shenker 具名 thesis advisor 字段，先按博士阶段研究师长。Caltech Preskill、Refael 与 Berkeley Vishwanath 的博士后课题组阶段仍分别保留。',
 next:'查 Stanford 3781 2008 F 的签署页并继续查 Caltech、Berkeley 博后各段的个人指导。'
});
updateEdge(nf,fn,fmentor,'Stephen Shenker','博士导师候选','博士生候选','博士阶段研究师长','博士阶段受指导者',fidText,fidLinks);
relation(nf,fa,'phd',fmentor,'stage_mentor',fidText,ids('7203683','fid','fida'),'shenker');

const unc=[
 {id:'20f76257',name:'Narayana Aluru',key:'3048948',title:'Parallel and stabilized finite element methods for the hydrodynamic transport model of semiconductor devices',year:1995,current:'al',affiliation:'UT Austin Walker Mechanical Engineering 与 Oden Institute。',research:'计算材料、纳米流体与多尺度模拟。',phase:'馆藏号 3781 1995 A。未列具名导师，Kincho H. Law 的组属照此前来源保留。',phdCell:'Kincho H. Law（博士课题组负责人）；Stanford 馆藏 3781 1995 A 未列导师',next:'按 3781 1995 A 查学位签署页，另查 MIT 1995–1997 博后导师。'},
 {id:'05926326',name:'Charles Ahn',key:'3399617',title:'Growth and properties of epitaxial complex oxides',year:1996,current:'ahn',affiliation:'Yale Applied Physics、Materials Science 与 Physics（既有关联记录）。',research:'外延复杂氧化物、薄膜生长及量子材料界面物理。',phase:'馆藏号 3781 1996 A。该书目未列具名导师；保留 Malcolm R. Beasley 候选，Geneva 博后指导不变。',phdCell:'Malcolm R. Beasley（候选）；Stanford 馆藏 3781 1996 A 未列导师',next:'按 3781 1996 A 查学位签署页或本人 CV；继续核 Geneva 博后指导职衔。'},
 {id:'45b1161f',name:'Joost Vlassak',key:'2956092',title:'New experimental techniques and analysis methods for the study of the mechanical properties of materials in small volumes',year:1994,current:'vlas',affiliation:'Harvard Materials Science and Mechanical Engineering。',research:'小尺度材料力学、薄膜、软材料与高分子。',phase:'馆藏号 3781 1994 V。原书目题名对应本人 2003 论文自引，DOE 项目报告题名另有异文；目录未列具名导师。',phdCell:'William D. Nix（候选）；Stanford 馆藏 3781 1994 V 未列导师',next:'按 3781 1994 V 查原论文签署页，追查正式博士后任用。'},
 {id:'b4ea6398',name:'David Mitzi',key:'673854',title:'Growth and properties of oxygen and ion doped Bi₂Sr₂CaCu₂O₈₊δ single crystals',year:1990,current:'mitzi',affiliation:'Duke Mechanical Engineering and Materials Science，兼 Chemistry。',research:'卤化物钙钛矿、低维半导体材料和新型光伏。',phase:'馆藏号 3781 1990 M。未列具名导师，Aharon Kapitulnik 的博士课题组关系照前证保留。',phdCell:'Aharon Kapitulnik（博士课题组负责人）；Stanford 馆藏 3781 1990 M 未列导师',next:'按 3781 1990 M 查签署页，区分 1990–1991 时段和后续 IBM 岗位。'},
 {id:'2e13fc84',name:'Todd Hufnagel',key:'3090579',title:'Structural and magnetic anisotropy in amorphous terbium-iron thin films',year:1995,current:'huf',affiliation:'Johns Hopkins Materials Science and Engineering；既有 Mechanical Engineering 关联保留。',research:'结构材料、纳米材料、非晶材料和 X 射线散射。',phase:'馆藏号 3781 1995 H。目录未列具名导师。此前 Bruce M. Clemens 组校友与阶段证据保留为候选。',phdCell:'Bruce M. Clemens（候选）；Stanford 馆藏 3781 1995 H 未列导师',next:'按 3781 1995 H 查学位签署页；后续职位继续区分 acting assistant professor 与博士后。'}
];
for(const d of unc)graduate({...d,append:true,tail:d.phase});
rewrite(pf('05926326'),x=>x.startsWith('- 博士导师候选：')&&x.includes('Malcolm R. Beasley'),x=>x.replace('正式导师和论文题名均须独立核实。','正式导师须独立核实；论文题名现由 Stanford 学位目录核定。')+' '+cat('3399617'));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0257_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0257_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0257_Stanford论文导师和馆藏号回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
