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
 orig.audit_id='pi_archive_20261111_0224_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0224_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"jc":"https://searchworks.stanford.edu/view/6051959","jr":"https://vcresearch.berkeley.edu/faculty/ali-javey","jcv":"https://nano.eecs.berkeley.edu/Javey_CV.pdf","jold":"https://en.wikipedia.org/wiki/Ali_Javey","yc":"https://searchworks.stanford.edu/view/11849403","yr":"https://pme.uchicago.edu/directory/shuolong-yang","ygrp":"https://arpes.stanford.edu/our-people/previous-members","yk":"https://as.cornell.edu/people/kyle-shen","ykic":"https://www.kicnano.cornell.edu/people/shuolong-yang","cc":"https://searchworks.stanford.edu/view/12135013","cr":"https://web.sas.upenn.edu/claassengroup/people/","ccv":"https://live-sas-physics.pantheon.sas.upenn.edu/sites/default/files/2023-07/ClaassenCV2023.pdf","cgrp":"https://www6.slac.stanford.edu/news/2015-05-27-spiraling-laser-pulses-could-change-nature-graphene","sc":"https://searchworks.stanford.edu/view/11614105","sr":"https://mse.rutgers.edu/ryan-sills","sgrp":"https://micro.stanford.edu/wiki/Ryan_Sills","sio":"https://china.ioppublishing.org/news/msmse-qi-kan-gong-bu-2021-nian-qing-nian-ling-jun-ren-huo/","ac":"https://searchworks.stanford.edu/view/9806196","ar":"https://www.ee.caltech.edu/people/amarandi","alist":"https://web.stanford.edu/~rlbyer/ALL%20STUDENTS%20WITH%20THESIS%20AND%20YEARS.pdf","atu":"https://cfaed.tu-dresden.de/cfaed-seminar-series/half-harmonic-generation-enabling-photonic-solutions-for-molecular-sensing-and-non-classical-computing","mc":"https://searchworks.stanford.edu/view/3063590","mr":"https://physics.stanford.edu/people/kathryn-moler"};
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




const j='c65173eb', jn='Ali Javey', dai='师承人物 - Hongjie Dai';
const y='618aecd2', yn='Shuolong Yang', shen='人员 - Stanford - Zhi-Xun Shen - 177eaec9', reis='人员 - Stanford - David Reis - 1d6033f2', kyle='人员 - Cornell - Kyle Shen - 7ae93e88';
const c='c910a070', cn='Martin Claassen', dev='人员 - Stanford - Thomas Devereaux - 4eedb35a', don='师承人物 - Sebastian Doniach';
const s='987dbd8e', sn='Ryan B. Sills', cai='师承人物 - Wei Cai';
const z='a5840e08', zn='Alireza Marandi', byer='师承人物 - Robert L. Byer';
const m='f5d396d8', mn='Kathryn Moler';
const cat=k=>src(['Stanford 学位目录',k]);
const jtext='2005 年 Stanford 化学博士论文目录明确列 Hongjie Dai 为 primary advisor，论文题名按书目为《Electrical characterization and device applications of individual singled-wall carbon nanotubes》。可信度高。';
const jlinks=cat('jc');
rewrite(pf(j),x=>x.startsWith(boundary),()=>boundary+'Stanford 已核化学博士论文主导师。Harvard Junior Fellow 及 Lieber 组线索保留，具体阶段与正式指导职衔待独立来源。 '+src(['本人 CV','jcv'],['Berkeley 研究档','jr']));
rewrite(pf(j),x=>x.startsWith('- 待核 ')&&x.includes(dai),()=>'原博士候选已由学位书目核定，见上方师承关系。 '+jlinks);
rewrite(mf(dai),x=>x.startsWith('- '+who(j,jn))&&x.includes('博士阶段候选'),()=>'');
rewrite(index,x=>x.startsWith('- '+who(j,jn)+' → 博士导师候选：')&&x.includes(dai),()=>'');
const candidates=path.join(root,'师承候选线索索引.md');
rewrite(candidates,x=>x.startsWith('- '+who(j,jn)+' → 待查 ')&&x.includes(dai),()=>'');
edge(j,jn,dai,'Hongjie Dai','博士导师','博士生',jtext,jlinks);
cell(j,2,'Hongjie Dai（Stanford 化学博士论文主导师）');
schoolWith(j,jlinks+' · '+src(['Berkeley 研究档','jr']));
let eid=audit(j,[
 a('identity','Stanford 2005 化学博士，纳米管器件论文与 Berkeley 半导体研究档及本人履历相符。',['jc','jr','jcv'],'confirmed'),
 a('phd',jtext,['jc','jcv','jold'],'confirmed_advisor')
],'追查 Harvard Junior Fellow 任用项目、Lieber 组属时段和是否有明确博士后指导人。');
relation(j,eid,'phd',dai,'advisor',jtext,ids('jc','jcv'),'dai');

const ytext='2016 年 Stanford Applied Physics 博士论文《Revealing electron-phonon coupling in quantum materials using equilibrium and nonequilibrium photoemission spectroscopy》书目将 Zhi-Xun Shen 与 David A. Reis 两人均列为 primary advisor。可信度高。';
const ypost='Cornell 的 Kyle Shen 本人院系档在 Postdocs 下列 Shuolong Yang 为 Kavli Fellow，Chicago 分子工程档独立核其 Cornell 博后。确认课题组负责人，正式个人指导职衔待核。';
const ypostLinks=src(['Cornell Kyle Shen 院系档','yk'],['Chicago 本人档','yr'],['Cornell Kavli 本人档','ykic']);
updateEdge(y,yn,shen,'Zhi-Xun Shen','博士课题组负责人','博士课题组成员','博士导师','博士生',ytext,cat('yc')+' · '+src(['Shen 组校友档','ygrp']));
edge(y,yn,reis,'David A. Reis','博士导师','博士生',ytext,cat('yc'));
updateEdge(y,yn,kyle,'Kyle Shen','博士后课题组','博士后课题组成员','博士后课题组负责人','博士后课题组成员',ypost,ypostLinks);
rewrite(pf(y),x=>x.startsWith(boundary),()=>boundary+'博士目录另列 Thomas Peter Devereaux 的一般 advisor 字段，具体论文角色待签署页。Kyle Shen 的 Cornell 博后组属已核。Schlom 组阶段候选保留。Kavli 名录标 2016–2019，Chicago 校档记 2018 年入职，校档区分 fellowship 标注和已知入职日期。 '+cat('yc')+' · '+ypostLinks);
cell(y,2,'Zhi-Xun Shen 与 David A. Reis（Stanford 学位目录均列主导师）；Thomas Peter Devereaux（一般 advisor 字段，具体角色待核）');
cell(y,3,'Kyle Shen（Cornell 博后课题组负责人）；Darrell Schlom（组属阶段候选）');
schoolWith(y,cat('yc')+' · '+ypostLinks);
eid=audit(y,[
 a('identity','Stanford 2016 应用物理论文与 Chicago 本人学历、光电子能谱与量子材料研究匹配。',['yc','yr'],'confirmed'),
 a('affiliation','Chicago Pritzker School of Molecular Engineering。',['yr'],'confirmed'),
 a('research','实验凝聚态、量子材料工程、薄膜沉积、超快光电子能谱。',['yr','yc'],'confirmed'),
 a('phd',ytext+' Thomas Peter Devereaux 的一般 advisor 角色需学位签署页细分。',['yc','yr','ygrp'],'confirmed_advisor'),
 a('postdoc',ypost+' 保留 Schlom 组的阶段候选。Kavli 年份标 2016–2019，Chicago 记 2018 年入职。',['yk','ykic','yr'],'group_or_candidate')
],'查 Cornell fellowship 项目或本人 CV 中的具名指导及日期，核 Schlom 阶段和 Devereaux 学位角色。');
relation(y,eid,'phd',shen,'advisor',ytext,ids('yc','ygrp'),'shen');
relation(y,eid,'phd',reis,'advisor',ytext,ids('yc'),'reis');
relation(y,eid,'postdoc',kyle,'group_leader',ypost,ids('yk','yr','ykic'),'kyle');

const ctext='2017 年 Stanford Applied Physics 博士论文《Equilibrium and non-equilibrium realizations of topological states of matter》书目将 Thomas Devereaux 与 Sebastian Doniach 两人均列为 primary advisor。可信度高。';
updateEdge(c,cn,dev,'Thomas Devereaux','博士阶段课题组负责人','博士阶段课题组成员','博士导师','博士生',ctext,cat('cc')+' · '+src(['SLAC 当年报道','cgrp']));
edge(c,cn,don,'Sebastian Doniach','博士导师','博士生',ctext,cat('cc'));
rewrite(pf(c),x=>x.startsWith(boundary),()=>boundary+'学位目录另列 Xiaoliang Qi 的一般 advisor 字段，具体论文角色待签署页。Penn 托管本人 CV 列 2017 年 9 月至 2020 年 7 月 Flatiron CCQ Research Fellow，该任用的具体个人指导关系待核。 '+cat('cc')+' · '+src(['本人 CV','ccv'],['Penn 本人组页','cr']));
cell(c,2,'Thomas Devereaux 与 Sebastian Doniach（Stanford 学位目录均列主导师）；Xiaoliang Qi（一般 advisor 字段，具体角色待核）');
cell(c,3,'Flatiron CCQ Research Fellow（2017-09 至 2020-07）；个人指导待核');
schoolWith(c,cat('cc')+' · '+src(['本人 CV','ccv'],['Penn 本人组页','cr']));
eid=audit(c,[
 a('identity','Stanford 2017 应用物理博士学位书目与 Penn 本人 CV 的学历及量子材料理论方向一致。',['cc','ccv','cr'],'confirmed'),
 a('affiliation','Penn Physics and Astronomy；组档另列 Flatiron 访问学者。',['ccv','cr'],'confirmed'),
 a('research','凝聚态理论、非平衡量子动力学及量子材料中的强光物质耦合。',['cr','cc'],'confirmed'),
 a('phd',ctext+' Xiaoliang Qi 的一般 advisor 字段需学位签署页细分。',['cc','ccv','cgrp'],'confirmed_advisor'),
 a('postdoc','本人 CV 列 2017-09 至 2020-07 Flatiron CCQ Research Fellow。所阅履历未具名个人指导。',['ccv','cr'])
],'追查 Flatiron 的项目或任用介绍并核 Xiaoliang Qi 论文角色。');
relation(c,eid,'phd',dev,'advisor',ctext,ids('cc','cgrp'),'devereaux');
relation(c,eid,'phd',don,'advisor',ctext,ids('cc'),'doniach');

const stext='2016 年 Stanford 机械工程博士论文《Dislocation dynamics of face-centered cubic metals and alloys》书目明确列 Wei Cai 为 primary advisor。可信度高。';
updateEdge(s,sn,cai,'Wei Cai','博士阶段课题组负责人','博士阶段课题组成员','博士导师','博士生',stext,cat('sc')+' · '+src(['Stanford 个人页','sgrp']));
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+'目录还列 Dorian K. Balch、Adrian Lew、William D. Nix 的一般 advisor 字段，具体论文角色待签署页。Stanford 组档核 2016 年 3 月机械工程博士，Rutgers 校档核材料科学与工程及多尺度材料力学。IOP 记录入职 Rutgers 前任 Sandia Staff Member，所阅档案未分列博士后。 '+cat('sc')+' · '+src(['Stanford 个人页','sgrp'],['Rutgers 校档','sr'],['IOP 本人条目','sio']));
cell(s,2,'Wei Cai（Stanford 学位论文主导师）');
schoolWith(s,cat('sc'));
eid=audit(s,[
 a('identity','Stanford Ryan B. Sills 机械工程 2016 博士论文与 Stanford 组内个人页、Rutgers 材料科学与工程档相符。',['sc','sgrp','sr'],'confirmed'),
 a('affiliation','Rutgers Materials Science and Engineering。',['sr'],'confirmed'),
 a('research','材料力学、多尺度建模、位错介导塑性及断裂。',['sr','sc'],'confirmed'),
 a('phd',stext+' 其余三位的一般 advisor 字段待学位签署页细分。',['sc','sgrp','sr'],'confirmed_advisor')
],'继续核 Sandia 岗位是否存在独立的博士后任命，查 Stanford 签署页区分其他论文角色。');
relation(s,eid,'phd',cai,'advisor',stext,ids('sc','sgrp'),'cai');

const ztext='Stanford 电气工程博士论文《Sub-harmonic generation of frequency combs for spectroscopy and quantum optics》书目列 Robert L. Byer 为 primary advisor。书目及 Byer 清单标 2012，Caltech 教师履历记 2013 博士。可信度高（主导师）。';
updateEdge(z,zn,byer,'Robert L. Byer','博士阶段研究师长','博士阶段受指导者','博士导师','博士生',ztext,cat('ac')+' · '+src(['Byer 博士生清单','alist'],['Caltech 校档','ar']));
rewrite(pf(z),x=>x.startsWith(boundary),()=>boundary+'书目另列 Butrus T. Khuri-Yakub、Olav Solgaard 的一般 advisor 字段，具体论文角色待签署页。ETH 简介合列 Stanford 博后与日本 NII 同期访问期间的三位共事者，个人具体阶段和正式指导待核。TU Dresden 讲座档将两项任用分列。 '+cat('ac')+' · '+src(['TU Dresden 讲座履历','atu'],['Caltech 校档','ar']));
cell(z,2,'Robert L. Byer（Stanford 学位论文主导师；目录 2012，Caltech 履历 2013）');
schoolWith(z,cat('ac'));
eid=audit(z,[
 a('identity','Stanford 电气工程博士论文的作者、频率梳题名与 Caltech 电气工程及应用物理档匹配，保留 2012 与 2013 年份记载。',['ac','ar','alist'],'confirmed'),
 a('affiliation','Caltech Electrical Engineering and Applied Physics。',['ar'],'confirmed'),
 a('research','非线性光子学、量子光学、频率梳。',['ar','ac'],'confirmed'),
 a('phd',ztext+' Butrus T. Khuri-Yakub、Olav Solgaard 的一般 advisor 字段待学位签署页细分。',['ac','ar','alist'],'confirmed_advisor')
],'查授位日期与学位签署页，独立核 Stanford 博后与日本 NII 访问对应的个人指导。');
relation(z,eid,'phd',byer,'advisor',ztext,ids('ac','alist','ar'),'byer');

const mtext='Stanford 1995 物理博士论文《Specific heat of cuprate superconductors》，馆藏号 3781 1995 M。书目无具名导师字段，保留 Kapitulnik 博士课题组负责人。';
pl(m,boundary,mtext+' '+cat('mc'));
cell(m,2,'Aharon Kapitulnik（博士课题组负责人）；1995 Stanford 学位目录无具名导师');
schoolWith(m,cat('mc'));
audit(m,[
 a('identity','Stanford Physics 原始学位目录的 Kathryn A. Moler、1995 年博士论文与 Stanford 本人档匹配。',['mc','mr'],'confirmed'),
 a('affiliation','Stanford 应用物理、物理、能源科学与工程。',['mr'],'confirmed'),
 a('research','实验凝聚态物理、超导、扫描 SQUID、量子材料。',['mr','mc'],'confirmed'),
 a('phd',mtext,['mc'],'group_or_candidate')
],'循馆藏号 3781 1995 M 和论文原刊追查正式博士导师，继续查 Princeton Dicke 博后具名 sponsor。');

const pages=[
 [j,'jc','Ali Javey; PhD Chemistry 2005; Hongjie Dai, primary advisor. Thesis advisor. Electrical characterization and device applications of individual singled-wall carbon nanotubes.','核作者、学位、题名及主导师字段。'],
 [j,'jr','Berkeley Research identifies Ali Javey as an EECS professor and Lam Research Distinguished Chair in Semiconductor Processing; his research focuses on electronic materials and device structures.','核身份、任职和研究。'],
 [y,'yc','Shuolong Yang; PhD Applied Physics 2016; David A. Reis, primary advisor. Thesis advisor; Zhi-Xun Shen, primary advisor. Thesis advisor; Thomas Peter Devereaux, advisor. Thesis advisor.','原档两位主导师及第三位一般字段。'],
 [y,'yr','Molecular Engineering faculty; Stanford Applied Physics PhD; Kavli postdoctoral fellow at Cornell before joining UChicago in 2018.','核任职、方向及博士后阶段。'],
 [y,'yk','Kyle Shen Cornell profile, Postdocs: Shuolong Yang (Kavli Fellow), Pramita Mishra, Ludi Miao.','组属证据，未明示个人导师。'],
 [y,'ykic','Past KIC Postdoctoral Fellowship Recipient (2016-2019). Assistant Professor of Molecular Engineering, University of Chicago.','机构 fellowship 档，年份和入职分列。'],
 [c,'cc','Martin Claassen; PhD Applied Physics 2017; Thomas Devereaux and Sebastian Doniach as primary advisor. Thesis advisor; Xiaoliang Qi as advisor. Thesis advisor.','核两位主导师及第三位一般字段。'],
 [c,'ccv','Stanford Applied Physics PhD studies Sep 2010–Jul 2017; Flatiron Research Fellow, CCQ, Sep 2017–Jul 2020; University of Pennsylvania Physics and Astronomy from Aug 2020.','Penn 托管本人履历，核原任用名称及时间。'],
 [c,'cr','Penn group leader Martin Claassen, Physics and Astronomy; theoretical nonequilibrium dynamics and light–matter interactions in quantum materials.','现单位与方向。'],
 [s,'sc','Ryan B. Sills; PhD Mechanical Engineering 2016; Wei Cai, primary advisor. Thesis advisor; Dorian K. Balch, Adrian Lew, William D. Nix listed in general advisor fields.','核主导师，保留一般字段。'],
 [s,'sgrp','Ryan B. Sills, Ph.D. in Mechanical Engineering, Stanford University, March 2016; faculty at Rutgers MSE.','组档独立核同人及授位月份。'],
 [s,'sr','Rutgers Materials Science and Engineering; multiscale mechanical modeling, dislocation-mediated plasticity, fracture. Stanford Mechanical Engineering PhD.','核院系、研究和教育。'],
 [z,'ac','Alireza Marandi; PhD Electrical Engineering, Stanford catalogue 2012; Robert L. Byer primary advisor. Thesis advisor; Butrus T. Khuri-Yakub and Olav Solgaard general advisor fields.','核主导师、学位书目年份与其他字段。'],
 [z,'ar','Professor of Electrical Engineering and Applied Physics; Stanford PhD 2013; nonlinear optics, quantum optics, optical frequency combs.','核任职方向及履历年份。'],
 [m,'mc','Kathryn A. Moler. Specific heat of cuprate superconductors. PhD Physics Stanford, 1995; 3781 1995 M. No named advisor displayed.','核馆藏书目及待查字段。'],
 [m,'mr','Kathryn Moler, Stanford professor of Applied Physics, Physics, and Energy Science Engineering; Experimental Condensed Matter Physics.','核三项任用与方向。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0224_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0224_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0224_Stanford主导师原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
