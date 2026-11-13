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
 orig.audit_id='pi_archive_20261111_0641_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0641_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"zcv":"https://faculty.eng.umd.edu/clark/download/3242#page=1","zcvAlt":"https://faculty.eng.umd.edu/clark/download/3226#page=1","zu":"https://mse.umd.edu/clark/faculty/1395/you-zhou","zlab":"https://www.youzhou.org/you-zhou","zcvNow":"https://www.youzhou.org/files/You_Zhou_CV.pdf#page=1","park":"https://hongkunparklab.com/alumni","parkpub":"https://hongkunparklab.com/publications","dong":"https://physics.ucdavis.edu/people/faculty/dong-yu","dongdoi":"https://doi.org/10.1021/ja0625071","high":"https://pme.uchicago.edu/directory/alex-high","highlab":"https://highlab.uchicago.edu/GroupMembers.html","butov":"https://butovgroup.ucsd.edu/group.php","clerk":"https://pme.uchicago.edu/directory/aashish-clerk","stone":"https://www.eng.yale.edu/stonegroup/members.html","clerkArch":"https://rmc.library.cornell.edu/EAD/htmldocs/RMA04461.html","npr":"https://ece.princeton.edu/people/nathalie-de-leon","nsta":"https://qfarm.stanford.edu/events/q-farm-seminar/nathalie-de-leon-princeton-university","nsb":"https://www.stonybrook.edu/commcms/iqss/2021_agenda_speakers/Nathalie_de_Leon","nth":"https://www.proquest.com/dissertations-theses/engineering-confined-electrons-photons-at/docview/877967609/se-2","br":"https://physics.osu.edu/people/bockrath.31","bpub":"https://faculty.ucr.edu/~marcbock/publications/pdf/shellfill.pdf","bcal":"https://campuspubs.library.caltech.edu/3048/1/newfac.pdf","dl":"https://chemistry.uchicago.edu/faculty/daniel-laorenza","dlmit":"https://chemistry.mit.edu/chemistry-news/graduate-students-receive-degrees-at-the-2023-advanced-degree-conferral-ceremony/","dlha":"https://www.chemistry.harvard.edu/news/two-ccb-postdocs-awarded-2024-beckman-postdoctoral-fellowships","tt":"https://www.eng.yale.edu/stonegroup/test-page/publications/HakanThesis.pdf#page=18","tcover":"https://www.eng.yale.edu/stonegroup/test-page/publications/HakanThesis.pdf#page=2","tc":"https://fas.yale.edu/news-announcements/faculty-retirement-and-memorial-tributes/faculty-retirement-tributes-2008/richard-k-chang","tp":"https://ece.princeton.edu/people/hakan-tureci","tl":"https://turecigroup.princeton.edu/people/hakan-e-t%C3%BCreci","mv":"https://www.physics.wisc.edu/wp-content/uploads/2019/12/vavilov_cv.pdf","mvphy":"https://www.physics.wisc.edu/directory/vavilov-maxim-g/","mvold":"https://home.physics.wisc.edu/~vavilov/pdfs/CV-MV.pdf"};
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




const pages=[];
function read(record_id,k,raw){pages.push({record_id,url:u[k],raw,excerpt:raw});}
function fail(record_id,k,error){pages.push({record_id,url:u[k],error});}
const z='7eaa6c11',dy='47d737ac',ah='1dc2be50',ac='7d5250b1',nd='06baa456',mb='9e0cef27',dl='ba0da93c',ht='f9febc7d',mv='d1fdd774';
const park='人员 - Harvard - Hongkun Park - abdc86e2', stone='人员 - Yale - A. Douglas Stone - 6775fd5d';
const zh='本人 CV 第 1 页把 Harvard 2015–2020 Postdoctoral Fellow 的 advisor 具名列为 Hongkun Park，并把 2015 应用物理博士的 advisor 单列为 Shriram Ramanathan。两份校方托管版本内容一致。导师关系可信度高。';
const zs=src(['Maryland 托管本人 CV 第 1 页','zcv'],['另一校方托管版','zcvAlt'],['本人履历','zlab']);
updateEdge(z,'You Zhou',park,'Hongkun Park','博士后阶段研究师长','博士后阶段研究者','博士后导师','博士后研究者',zh,zs);
rewrite(pf(z),x=>x.startsWith(boundary),()=>boundary+'Harvard 博士导师 Ramanathan 和博士后导师 Park 均见本人 CV。本人现任材料系，兼 ECE、物理及量子材料中心，与 UNC Charlotte 同名记录的学校、学位及研究方向不同。 '+zs);
cell(z,3,'Hongkun Park（Harvard 2015–2020 博士后导师）');
schoolWith(z,zs);
const za=audit(z,[a('identity','本人 Maryland 院系档、组页及 Harvard 博士与博士后经历一致。',['zu','zcv','zlab'],'confirmed'),a('affiliation','Maryland 材料科学与工程系副教授，兼 ECE、物理、量子材料中心。',['zu','zlab'],'confirmed'),a('research','低维量子材料、光电子学、相关电子材料。',['zu','zlab'],'confirmed'),a('phd','校方托管 CV 第 1 页明确列 2015 Harvard 应用物理 PhD advisor Shriram Ramanathan。',['zcv','zcvAlt'],'confirmed_advisor'),a('postdoc',zh,['zcv','zcvAlt','zlab'],'confirmed_advisor')],'两阶段已核，后续按新原档增量更新。');
audits.at(-1).followup_required=false;
relation(z,za,'postdoc',park,'advisor',zh,ids('zcv','zcvAlt','zlab'),'park');
read(z,'zcv',zh);
read(z,'zcvAlt','另一校方托管 CV 第 1 页同列两阶段具名 advisor。');
read(z,'zu','Maryland 材料科学与工程系原档，二维量子材料和光电子学。');
read(z,'zcvNow','现行短版 CV 另列升任副教授和 2015–2020 Harvard 博后；具名导师见校方托管长版。');
const dn='Park 实验室原校友名录明确链接 UC Davis 本人，校方履历列唯一 Harvard 岗位为 2005–2008 博士后。Park 组的同期发表原档列 2006 与 2008 年同一研究者在相变材料上连续共事。合并证据支持博士后课题组关系，正式导师职衔待任用档。';
const dlinks=src(['Harvard Park 校友原档','park'],['UC Davis 物理系履历','dong'],['Park 组同期发表原档','parkpub']);
updateEdge(dy,'Dong Yu',park,'Hongkun Park','博士后导师候选','博士后研究者候选','博士后课题组负责人','博士后课题组成员',dn,dlinks);
rewrite(pf(dy),x=>x.startsWith('- 博士后候选证据：'),()=>'- 博士后关系证据：'+dn+' '+dlinks);
rewrite(pf(dy),x=>x.startsWith(boundary),()=>boundary+'Chicago 2005 博士导师 Philippe Guyot-Sionnest 维持候选。Harvard 2005–2008 Park 组属由原档交叉核对，正式导师待核。Braun 名录中的 Dong-Guk Yu 另有同期 Illinois 博后与不同去向，已排除。 '+dlinks);
cell(dy,3,'Hongkun Park（Harvard 2005–2008 博后课题组负责人；正式导师待核）');
schoolWith(dy,dlinks);
const da=audit(dy,[a('postdoc',dn,['park','dong','parkpub'],'group_or_candidate')],'查 Chicago 2005 学位原卷及 Harvard 任用文件中的正式 advisor。');
relation(dy,da,'postdoc',park,'group_leader',dn,ids('park','dong','parkpub'),'park');
read(dy,'park','原校友表具名 Dong Yu，链接 UC Davis 物理系同一人，表未按过去职衔分组。');
read(dy,'parkpub','Harvard Park 本人组发表原档列 2006 与 2008 Dong Yu 的同期合作，研究主题对应 UC Davis 履历。');
read(dy,'dong','院系原履历明列 2005 Chicago 物理博士、2005–2008 Harvard 博后、2008 UC Davis 教职。');
const an='本人 Chicago 组页列 2012 UC San Diego 物理博士及 2012–2017 Harvard 博后。Park 原组校友页核同一 Chicago 去向，保留已核博士后组属。Butov 博士阶段组属保持，其他学生的学位论文致谢不当作 Alex High 的导师证据。';
const al=src(['High 本人组页','highlab'],['Chicago 院系','high'],['Park 原组校友','park']);
pl(ah,'- 博士后课题组：',an+' '+al);
cell(ah,3,'Hongkun Park（2012–2017 Harvard 博后课题组，正式导师待核）');
schoolWith(ah,al);
audit(ah,[a('affiliation','Chicago Pritzker School of Molecular Engineering，High Lab。',['high','highlab'],'confirmed'),a('research','凝聚态量子材料、光物质相互作用及量子光子技术。',['high'],'confirmed'),a('postdoc',an,['highlab','park','high'],'group_or_candidate')],'查 UCSD 学位原卷与 Harvard 博后具名任用。');
read(ah,'highlab','本人组档分列 UC San Diego 物理博士 2012 及 Harvard 博后 2012–2017。');
read(ah,'park','Harvard Park 组原校友名录链接至同一 Alex High 的 Chicago 实验室。');
const cn='Chicago 院系确证 2001 Cornell 物理博士，随后为 Yale 博士后至 2004。Stone 组原档将 Clerk 列为 former member，未注明其组内职务或时段，保留阶段组属候选。Cornell 旧馆藏入口已跳转通用页面，需新馆藏索引或原论文。';
pl(ac,boundary,cn+' '+src(['Chicago 院系履历','clerk'],['Yale 组原档','stone']));
cell(ac,3,'Yale 博士后至 2004；A. Douglas Stone（前组员，组内任职与导师职衔待核）');
schoolWith(ac,src(['Chicago 院系履历','clerk'],['Yale 组原档','stone']));
audit(ac,[a('affiliation','Chicago Pritzker School of Molecular Engineering 教授。',['clerk'],'confirmed'),a('research','开放驱动量子体系、理论凝聚态、量子光学及信息。',['clerk'],'confirmed'),a('postdoc',cn,['clerk','stone'],'group_or_candidate')],'以 Aspects of Andreev scattering and Kondo physics in mesoscopic systems 题名线索查 Cornell 馆藏；旧档入口已跳转，保留 Ambegaokar 候选。另查 Yale 博士后任用。');
read(ac,'clerk','Chicago 院系列 Cornell 2001 物理博士、Yale 博士后至 2004，后入 McGill。');
read(ac,'stone','Yale Stone 组前组员名录列 Aashish Clerk 与 Cornell 2001 博士，前组员无职称。');
fail(ac,'clerkArch','Cornell 历史馆藏入口已跳转通用 Finding Aids 页，原记录正文此次未取得。');
const nn='Stanford、Stony Brook 校方讲座档均分列 2011 Harvard 化学物理博士在 Hongkun Park 组，及 Harvard 物理系博士后由 Park 和 Lukin 共同指导。博士论文正式导师字段仍待原卷。';
const nl=src(['Stanford 讲座原档','nsta'],['Stony Brook 讲座原档','nsb'],['Princeton ECE','npr']);
pl(nd,boundary,nn+' '+nl);
schoolWith(nd,nl);
audit(nd,[a('affiliation','Princeton 电气与计算机工程系。',['npr'],'confirmed'),a('research','固态色心与量子网络、量子材料与器件。',['npr'],'confirmed'),a('phd','2011 Harvard 化学物理博士，组属 Park；论文目录直达本轮未取得，保持博士组属。',['nsta','nsb'],'group_or_candidate'),a('postdoc',nn,['nsta','nsb'],'confirmed_advisor')],'按 Engineering confined Electrons and Photons at the Nanoscale 和 ProQuest 877967609 查 Harvard 学位原件及正式导师字段。');
read(nd,'nsta',nn);
read(nd,'nsb','Stony Brook 机构讲者原档分列 2011 Harvard 博士组属与两名博士后共同导师。');
read(nd,'npr','Princeton ECE 本人现任及固态色心量子技术方向。');
fail(nd,'nth','ProQuest 877967609 原档当前工具不可访问，题名仅作馆藏线索。');
const bn='2002 本人旧校托管论文第 1 页列 Bockrath、Liang、Park 同属 Harvard CCB，末页另记 Bockrath 部分由 Harvard 物理系支持。Park 组原档无任期，既有 Caltech 任用材料与 1999 论文分列 Harvard 博后及早期 Berkeley 共事。个人指导及该段具体组属仍保留候选。';
pl(mb,boundary,bn+' '+src(['本人旧校托管原论文','bpub'],['Park 组原档','park'],['Ohio State 院系','br']));
cell(mb,3,'Harvard 博后；Hongkun Park（同期合作及校友名录线索，组属和指导待核）');
schoolWith(mb,src(['本人旧校托管原论文','bpub'],['Park 组原档','park']));
audit(mb,[a('affiliation','Ohio State 物理系教授。',['br'],'confirmed'),a('postdoc',bn,['bpub','park'],'group_or_candidate')],'核 Harvard 2000 年前后博士后任用及 CCB、物理系指导职衔。');
read(mb,'bpub','2002 原论文第 1 页列三人 Harvard CCB 同一单位，第 4 页写 Bockrath 部分受 Harvard 物理系支持。');
read(mb,'park','Park 实验室原档列 Marc Bockrath，去向 Ohio State，未注明任用阶段。');
const ln='Chicago 化学系现列 Daniel Laorenza 助理教授，2023 MIT 化学博士、Harvard 博后至 2026。MIT 2023 典礼相册把同人照片注作 PhD 22，Harvard 与现任院系均列 2023，保留时间口径差异。Danna Freedman 博士组属、Jarad Mason 博后导师沿用。';
pl(dl,boundary,ln+' '+src(['Chicago 化学系','dl'],['MIT 典礼原档','dlmit'],['Harvard CCB','dlha']));
cell(dl,1,'化学系助理教授；分子自旋、量子材料、材料物理化学');
schoolWith(dl,src(['Chicago 化学系','dl'],['MIT 典礼原档','dlmit']));
audit(dl,[a('affiliation','Chicago 化学系助理教授。',['dl'],'confirmed'),a('research','分子自旋与功能材料、量子信息、声子和热输运及光学动力学。',['dl'],'confirmed'),a('phd',ln,['dl','dlmit','dlha'],'group_or_candidate')],'继续查 MIT 本人论文原卷确定正式导师、答辩与授位年月。');
read(dl,'dl','Chicago 化学系列助理教授、MIT 化学博士 2023、Harvard 博后至 2026。');
read(dl,'dlmit','MIT 2023 学位典礼相册同人照片说明 PhD 22，另一机构履历列 2023。');
const th='Yale 2003 本人论文第 18 页称 Douglas Stone 为 my advisor，并具名 Richard Chang 是 mentor 和 collaborator。Yale 原教师档核 Richard K. Chang 为应用物理及电气工程教授，研究光学微腔及激光。';
const ts=src(['Yale 博士论文第 18 页','tt'],['Yale Chang 原档','tc'],['Princeton ECE','tp']);
const ch='师承人物 - Richard K. Chang';
mentor(ch,'Richard K. Chang','Yale 应用物理与电气工程教授，研究光学微腔与激光。',src(['Yale 教员原档','tc']));
edge(ht,'Hakan E. Türeci',ch,'Richard K. Chang','博士阶段研究师长','博士阶段研究者',th,ts);
pl(ht,'- 博士导师：',th+' '+ts);
pl(ht,boundary,'论文致谢另写毕业后计划继续与 Stone 合作一年，现有来源未把这项合作具名为博士后导师。 '+ts);
cell(ht,2,'A. Douglas Stone（正式博士导师）；Richard K. Chang（博士阶段研究师长）');
schoolWith(ht,ts);
const ta=audit(ht,[a('affiliation','Princeton 电气与计算机工程系。',['tp'],'confirmed'),a('research','超导电路量子电动力学、量子计算及光学。',['tp','tl'],'confirmed'),a('phd',th,['tt','tcover','tc'],'confirmed_advisor')],'查 Yale 与 ETH 两段博士后任用；博士论文中的计划合作与正式博士后指导职衔分开。');
relation(ht,ta,'phd',stone,'advisor',th,ids('tt','tcover','tc'),'stone');
relation(ht,ta,'phd',ch,'stage_mentor',th,ids('tt','tc','tp'),'chang');
read(ht,'tt','第 18 页致谢具名 Douglas Stone 为博士 advisor，Richard Chang 为 mentor 和 collaborator。');
read(ht,'tcover','论文题页为 Hakan E. Türeci，Yale University，2003 年 5 月。');
read(ht,'tc','Yale 教师回顾列 Richard K. Chang 为应用物理及电气工程教授，光学领域。');
const mn='Wisconsin 托管本人 CV 明确 2001-09 至 2003-08 Minnesota 理论物理研究所、2003-09 至 2004-08 MIT RLE 与物理系、2004-09 至 2006-08 Yale Applied Physics W.M. Keck 博士后三段。Stone 组名录确属前组员，未注明博士后阶段任用或指导者；三个具名导师候选不变。';
const ms=src(['Wisconsin 托管 CV','mv'],['Yale Stone 组原档','stone'],['Wisconsin 物理系','mvphy']);
pl(mv,'- 博士后经历：',mn+' '+ms);
cell(mv,3,'Minnesota 2001–2003、MIT 2003–2004、Yale 2004–2006；Larkin、Levitov、Stone 分别待具名指导档');
schoolWith(mv,ms);
audit(mv,[a('affiliation','Wisconsin–Madison 物理系教授及本科事务副系主任。',['mvphy','mv'],'confirmed'),a('research','理论凝聚态、非平衡量子输运及量子计算。',['mv','mvphy'],'confirmed'),a('postdoc',mn,['mv','stone'],'group_or_candidate')],'按月份向三个机构的博士后及 fellowship 档查个人指导；旧长版 CV 原页仍不可达。');
read(mv,'mv',mn);
read(mv,'stone','Yale Stone 组原前组员条目列 Maxim Vavilov，PhD Cornell 2001，未列前组属时间。');
fail(mv,'mvold','早期长版履历原网址当前工具不可访问，保留搜索线索及阶段候选。');
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0641_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0641_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0641_Park与Stone及Yale学位原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
