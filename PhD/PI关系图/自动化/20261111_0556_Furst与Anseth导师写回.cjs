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
 orig.audit_id='pi_archive_20261111_0556_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0556_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"furstphd":"https://cbe.udel.edu/wp-content/uploads/2019/06/Furst.E_cv.pdf#page=19","furstpost":"https://cbe.udel.edu/wp-content/uploads/2019/06/Furst.E_cv.pdf#page=21","anseth":"https://experts.colorado.edu/vitas/103471.pdf#page=83","wagner":"https://cbe.udel.edu/wp-content/uploads/2020/02/Wagner.N_cv.pdf#page=22","tirrell":"https://tirrell-lab.caltech.edu/Alumni","tirbio":"https://www.icb.ucsb.edu/people/researchers/david-tirrell","kelly":"https://polymers.centers.purdue.edu/research/participants.html","kelud":"https://cbe.udel.edu/news/2015/04/28/engineering-role-models/","ansal":"https://www.colorado.edu/ansethgroup/alumni","swan":"https://news.mit.edu/2021/james-swan-associate-professor-dies-1109","st":"https://thesis.caltech.edu/5845/","falu":"https://lem.che.udel.edu/wiki/index.php?n=Main.FurstGroupAlumni","luo":"https://luogroup.research.yale.edu/people/yimin-luo","lyale":"https://engineering.yale.edu/research-and-faculty/faculty-directory/yimin-luo","lt":"https://calendar.utk.edu/event/cbe_seminar_yimin_luo_university_of_delaware","rheo":"https://www.societyofrheology.org/awards/jeffrey-richards-2026-metzner-awardee","nw":"https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/richards-jeffrey.html","jj":"https://chemistry.mit.edu/profile/jeremiah-a-johnson/","jcv":"https://web.mit.edu/johnsongroup/jj_060111_CV_v16_FOR%20WEBPAGE.pdf","umreg":"https://regents.umich.edu/files/meetings/03-25/2025-03-IV-1.pdf#page=37","um":"https://mse.engin.umich.edu/people/jinsang/","ol":"https://olsenlab.mit.edu/wp-content/uploads/sites/45/2016/08/bdoCV_july16.pdf#page=1","olp":"https://oge.mit.edu/profiles/bradley-olsen/","qi":"https://science.psu.edu/physics/people/qil1","qiaip":"https://physicstoday.aip.org/news/q-a-xiaoxing-xi-on-the-wrongful-arrest-that-upended-his-research-and-his-life"};
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




const furst='师承人物 - Eric M. Furst', ans='师承人物 - Kristi Anseth', wagner='师承人物 - Norman J. Wagner';
const advisor='confirmed_advisor', group='group_or_candidate', confirmed='confirmed';
function support(id,name,mFile,fLabel,bLabel,evidence,links) {
 const addition=' '+evidence+' '+links;
 line(pf(id),x=>x.startsWith('- '+fLabel+'：')&&x.includes(mFile),addition);
 line(mf(mFile),x=>x.startsWith('- '+bLabel+'：')&&x.includes(records.get(id).filename),addition);
 line(index,x=>x.startsWith('- '+who(id,name)+' → '+fLabel+'：')&&x.includes(mFile),addition);
 schoolWith(id,links);
}
const noteBoundary=(id,value)=>rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+value);
const done=()=>{audits.at(-1).followup_required=false;};
const k='bd9c958f';
const kp='Furst 本人 CV 第 19 页明确列 Kelly M. Schultz 于 Delaware 2011 年完成其指导的博士论文，原题 High-Throughput Microrheological Characterization of Biocompatible Hydrogelators。Delaware 院系人物原档另称她是 Furst 的博士生。关系可信度高。';
const ka='Anseth 本人 CV 第 83 页的博士后指导专栏列 Kelly Schultz 的 Colorado Boulder 任期为 2011 年 5 月至 2013 年 7 月。独立的 Anseth 组校友档列同一任期及 Purdue 去向。关系可信度高。';
const kpl=src(['Furst 本人 CV 第 19 页','furstphd'],['Delaware 化工系人物原档','kelud']);
const kal=src(['Anseth 本人 CV 第 83 页','anseth'],['Colorado 组校友档','ansal'],['Purdue 高分子研究所','kelly']);
updateEdge(k,'Kelly Schultz',furst,'Eric M. Furst','博士阶段研究师长','博士阶段研究者','博士导师','博士生',kp,kpl);
updateEdge(k,'Kelly Schultz',ans,'Kristi S. Anseth','博士后课题组负责人','博士后课题组成员','博士后导师','博士后研究者',ka,kal);
noteBoundary(k,'Delaware 论文指导与 Colorado 博后指导分别见两位导师的 CV。Delaware 院系报道中 Kristi Kiick 记为博士期间科研合作者。 '+kpl+' · '+kal);
cell(k,2,'Eric M. Furst（Delaware 博士导师）');
cell(k,3,'Kristi S. Anseth（Colorado Boulder 博士后导师，2011.05–2013.07）');
schoolWith(k,kpl+' · '+kal);
const ke=audit(k,[
 a('identity','两位导师 CV 和 Delaware 校方原页相合，Anseth CV 及 Purdue 高分子研究所对应现任 Purdue。',['furstphd','anseth','kelud','kelly'],confirmed),
 a('affiliation','Purdue 化学工程系教授。',['kelly','anseth'],confirmed),
 a('research','软物质及聚合物水凝胶，重点为微流变及材料表征。',['kelly','kelud'],confirmed),
 a('phd',kp,['furstphd','kelud'],advisor),
 a('postdoc',ka,['anseth','ansal','kelly'],advisor)
],'博士与博士后均有各自导师的具名 CV 证据。后续增量可补 Delaware 论文签署页。');
done();
relation(k,ke,'phd',furst,'advisor',kp,ids('furstphd','kelud'),'furst');
relation(k,ke,'postdoc',ans,'advisor',ka,ids('anseth','ansal','kelly'),'anseth');
const s='f711ffd2', sd='James Swan — 已故';
const sp='Furst 本人 CV 第 20–21 页博士后指导专栏具名 James W. Swan，任期 2011–2013。MIT 纪念文核实 Delaware 博后、2013 年入职 MIT 化学工程系及其软物质研究，组校友档任期相同。关系可信度高。';
const slinks=src(['Furst 本人 CV 第 21 页','furstpost'],['MIT 纪念原档','swan'],['Furst 组校友档','falu']);
updateEdge(s,sd,furst,'Eric M. Furst','博士后阶段研究师长','博士后阶段研究者','博士后导师','博士后研究者',sp,slinks);
noteBoundary(s,'Caltech 论文明确 John F. Brady 为博士导师，Delaware 博后指导见 Furst 本人 CV。MIT 为历史教职，2021 年去世。 '+src(['Caltech 学位档','st'])+' · '+slinks);
cell(s,3,'Eric M. Furst（Delaware 博士后导师，2011–2013）');
schoolWith(s,slinks);
const se=audit(s,[
 a('identity','Caltech James W. Swan 学位档、Furst CV 博后栏目、MIT 纪念原文一致。',['st','furstpost','swan'],confirmed),
 a('affiliation','MIT 化学工程系历史任职，2013 入职，2021 年去世。',['swan'],confirmed),
 a('research','软凝聚态及胶体结构和动力学。',['swan','st'],confirmed),
 a('phd','Caltech 2010 化学工程博士论文目录 Advisor 列 John F. Brady。',['st'],advisor),
 a('postdoc',sp,['furstpost','swan','falu'],advisor)
],'两阶段具名导师及历史教职已核定。');
done();
relation(s,se,'postdoc',furst,'advisor',sp,ids('furstpost','swan','falu'),'furst');
const l='f5b85505';
const lf='Furst 本人 CV 博士后指导专栏具名 2018–2020 Delaware 博士后 Yimin Luo。同一行注明与 Norman Wagner；Yale 本人组页、Tennessee 同期讲者档核共同组属及两段任用。Furst 的个人指导可信度高。';
const lw='Wagner 本人 CV 第 22 页将 Luo 2018–2020 列在博士后指导人员名录，原栏目为 Postdoctoral Students Mentored。Furst 的指导名单与 Luo 本人明确 Delaware 的 joint postdoc，按博士后阶段研究师长记 Wagner 的个人指导，正式职衔待核。';
const lfLinks=src(['Furst 本人 CV 第 21 页','furstpost'],['Yale 本人履历','luo'],['Tennessee 同期讲者档','lt']);
const lwLinks=src(['Wagner 本人 CV 第 22 页','wagner'],['Furst 本人 CV 第 21 页','furstpost'],['Yale 本人履历','luo']);
updateEdge(l,'Yimin Luo',furst,'Eric M. Furst','博士后课题组','博士后课题组成员','博士后导师','博士后研究者',lf,lfLinks);
updateEdge(l,'Yimin Luo',wagner,'Norman J. Wagner','博士后课题组','博士后课题组成员','博士后阶段研究师长','博士后阶段研究者',lw,lwLinks);
noteBoundary(l,'Penn 博士具名指导为 Kathleen J. Stebe。Delaware 2018–2020 两位个人指导已分别由 CV 佐证。UCSB 2020–2022 的 Valentine 和 Helgeson 继续按共同组属记录，待查个人指导。 '+lfLinks+' · '+lwLinks);
cell(l,3,'Delaware 2018–2020：Eric M. Furst（博士后导师）、Norman J. Wagner（博士后阶段研究师长）；UCSB 2020–2022：Megan T. Valentine、Matthew E. Helgeson（博士后课题组）');
schoolWith(l,lfLinks+' · '+src(['Wagner 本人 CV','wagner'],['Yale 院系','lyale']));
const le=audit(l,[
 a('identity','Yale 本人组页和 Tennessee 2020 讲者档核 Penn 2018 博士、Delaware 2018–2020 及 UCSB 2020–2022 两段博后。',['luo','lt','lyale'],confirmed),
 a('affiliation','Yale 机械工程系助理教授，既有院系关联记录保留。',['lyale','luo'],confirmed),
 a('research','软凝聚态、胶体自组装、液晶和流变学。',['lyale','luo','lt'],confirmed),
 a('phd','Tennessee 化工系同期讲者档明确 Penn 博士 under supervision of Kathleen J. Stebe。',['lt','luo'],advisor),
 a('postdoc',lf+' '+lw+' UCSB 的两位组负责人保留。',['furstpost','wagner','luo','lt'],advisor)
],'核 UCSB 2020–2022 联合博后两位负责人的指导职衔及 Delaware Wagner 的正式岗位关系。');
relation(l,le,'postdoc',furst,'advisor',lf,ids('furstpost','luo','lt'),'furst');
relation(l,le,'postdoc',wagner,'stage_mentor',lw,ids('wagner','furstpost','luo'),'wagner');
const j='8d18a545', nw='师承人物 - Norman Wagner';
const jp='Wagner 本人 CV 第 22 页列 Jeffrey Richards 为 2014 年起的具名博士后指导对象，注明 NRC/NIST 及后任 Northwestern。流变学会原档确认 2014 Washington 博士、Delaware 与 NIST 两地研究及 2018 Northwestern 入职。Wagner 的阶段研究指导可信度高；Hipp 继续标合作，NIST 专门指导人待查。';
const jl=src(['Wagner 本人 CV 第 22 页','wagner'],['流变学会原档','rheo'],['Northwestern 院系','nw']);
support(j,'Jeffrey Richards',nw,'博士后研究师长','博士后阶段研究成员',jp,jl);
noteBoundary(j,jp+' Pozzo 的博士导师证据沿用已归档组谱，待 Washington 学位原件交叉确认。 '+jl);
cell(j,3,'Norman Wagner（博士后阶段研究师长）；Julie Hipp（博士后合作）；NIST 个人导师待核');
const je=audit(j,[
 a('identity','Wagner CV 及流变学会获奖原档对应 Washington 化工博士和 Northwestern 2018 入职的 Jeffrey Richards。',['wagner','rheo','nw'],confirmed),
 a('affiliation','Northwestern 化学与生物工程系副教授。',['nw','rheo'],confirmed),
 a('research','软材料流变、电荷输运及电化学储能材料。',['nw','rheo'],confirmed),
 a('postdoc',jp,['wagner','rheo','nw'],group)
],'找 NIST NCNR 的具名指导或 NRC fellowship 记录，以及 Washington 本人博士原档。');
relation(j,je,'postdoc',nw,'stage_mentor',jp,ids('wagner','rheo','nw'),'wagner');
const tr='师承人物 - David A. Tirrell', trShort='师承人物 - David Tirrell';
const ol='9f39f275', jj='71033140', kim='8a942f83';
const trl=src(['Caltech Tirrell 组校友原档','tirrell']);
const op='Tirrell 组原档列 Olsen 2008–2009 博士后，与 Olsen 本人 CV 的 Caltech Beckman fellowship 及三组任职一致。Tirrell 组属与历史共同研究关系获独立确认。';
support(ol,'Bradley D. Olsen',tr,'博士后阶段研究关联者','博士后阶段研究关联者',op,trl);
pl(ol,boundary,op+' '+trl);
audit(ol,[a('postdoc',op+' Kornfield 的正式博士后导师关系沿用 MIT 本人访谈，Tirrell 与 Wang 个人指导职衔继续待核。',['tirrell','ol','olp'],advisor)],'核 Tirrell 与 Wang 正式指导职衔。');
const jjp='Caltech Tirrell 组原档列 Johnson 2009–2011 博士后，MIT 化学系人物原档核其转任 MIT，沿用本人 CV 对 Tirrell 和 Grubbs 两位博后导师的具名证据。';
support(jj,'Jeremiah A. Johnson',tr,'博士后导师','博士后研究者',jjp,trl);
audit(jj,[
 a('affiliation','MIT 化学系 A. Thomas Guertin Professor of Chemistry。',['jj'],confirmed),
 a('postdoc',jjp,['tirrell','jcv','jj'],advisor)
],'既有博士与博后导师均保留。Tirrell 组原档补核 Caltech 任期。');
audits.at(-1).followup_required=JSON.parse(last.get(jj).details_json).followup_required;
const kip='Caltech Tirrell 组校友原档列 Jinsang Kim 2001–2003 博后，去向 University of Michigan。UMich Regents 2025 任用原档核同一人及三个院系。原 Michigan 系页所列 Tirrell 博后导师沿用。';
support(kim,'Jinsang Kim',trShort,'博士后导师','博士后研究者',kip,trl);
pl(kim,boundary,kip+' '+trl+' · '+src(['Michigan 任用原档第 37 页','umreg']));
const trBio=src(['Caltech 组档','tirrell'],['ICB 人物档','tirbio']);
insertAfter(mf(trShort),'## 师承','\n- 同一导师的另一份人物页：'+wiki(tr,'David A. Tirrell')+'。 '+trBio);
insertAfter(mf(tr),'## 师承','\n- 同一导师的另一份人物页：'+wiki(trShort,'David Tirrell')+'。 '+trBio);
audit(kim,[
 a('identity','Caltech 组档及 UMich Regents 2025 任用档对应 MIT 材料博士、Caltech 博后及 2003 Michigan 入职的 Jinsang Kim。',['tirrell','umreg'],confirmed),
 a('affiliation','Michigan 材料科学与工程系，兼大分子科学与工程、化学。2025 任用档另列 Raoul Kopelman Collegiate Professor。',['umreg'],confirmed),
 a('research','有机光电材料、高性能聚合物及仿生软物质。',['umreg'],confirmed),
 a('postdoc',kip,['tirrell','umreg','um'],advisor)
],'继续以 MIT 论文或本人早期 CV 查 Rubner 的共同博士指导；Tirrell 正式关系和别名页交叉记录。');
const q='de716208';
const qevidence='Furst 与 Wagner CV 的 Qi Li 条目是 Delaware 流变博士后，Furst 名录给出 GSK 去向。Penn State 凝聚态物理教授 Qi Li 的原校档和北京大学、Karlsruhe 履历是不同人。排除本次姓名匹配。';
pl(q,boundary,qevidence+' '+src(['Penn State 物理系','qi'],['Furst 本人 CV 第 21 页','furstpost'],['Wagner 本人 CV 第 22 页','wagner']));
audit(q,[
 a('identity',qevidence,['qi','qiaip','furstpost','wagner'],confirmed)
],'按 Penn State 本人的北京大学与 Karlsruhe 履历查学位原档及研究任用。');
const pages=[
 [k,'furstphd','Furst lists Kelly M. Schultz’s 2011 Delaware dissertation under Ph.D. theses supervised.','确认博士导师。'],
 [k,'anseth','Anseth lists Kelly Schultz May 2011–July 2013 under Postdoctoral Associates Supervised.','确认博后导师和任期。'],
 [k,'kelud','Delaware engineering records Kelly Schultz’s 2011 doctorate and identifies her as a student of Eric Furst.','核同一人及学位。'],
 [k,'kelly','Purdue’s polymer institute lists Kelly Schultz, polymeric hydrogels, School of Chemical Engineering.','核院系与研究。'],
 [s,'furstpost','Furst’s postdoctoral supervision section lists James W. Swan, 2011–2013, later MIT Chemical Engineering.','确认博后导师。'],
 [s,'st','CaltechTHESIS lists John F. Brady as advisor of James Swan’s 2010 PhD.','核博士导师。'],
 [s,'swan','MIT obituary describes Swan’s Delaware work in Eric Furst’s lab and historical MIT chemical engineering appointment.','核身份与阶段。'],
 [l,'furstpost','Furst lists Yimin Luo 2018–2020 in his postdoctoral supervision section, with Norman Wagner.','确认 Furst 具名指导。'],
 [l,'wagner','Wagner lists Yimin Luo 2018–2020 in Postdoctoral Students Mentored.','核 Wagner 阶段研究指导。'],
 [l,'luo','Yale lab CV records joint postdocs at Delaware 2018–2020 and UCSB 2020–2022 with named groups.','核两段博士后。'],
 [l,'lt','The 2020 Tennessee seminar lists Delaware joint postdoc and Penn PhD under Kathleen J. Stebe.','区分博士及 Delaware 博后。'],
 [j,'wagner','Wagner lists Jeffrey Richards (2014, NRC NIST, 2018 Assistant Professor, Northwestern U.) under postdoctoral mentees.','独立核博士后阶段研究师长。'],
 [j,'rheo','Rheology Society records Delaware and NIST postdoctoral research, as well as research collaboration with Wagner and Hipp.','核分阶段与合作。'],
 [ol,'tirrell','Tirrell Lab lists Bradley D. Olsen as Postdoctoral Scholar, 2008–2009, MIT.','核 Caltech 组属。'],
 [jj,'tirrell','Tirrell Lab lists Jeremiah Johnson as Postdoctoral Scholar, 2009–2011, MIT.','同期校友档核任期。'],
 [kim,'tirrell','Tirrell Lab lists Jinsang Kim as Postdoctoral Scholar, 2001–2003, University of Michigan.','核博士后任期和身份。'],
 [kim,'umreg','2025 Michigan regents appointment records Jinsang Kim in Materials Science, Macromolecular Science and Chemistry.','核现任院系。'],
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:kim,url:u.um,error:'(403) Forbidden；保留已有学校导师证据，使用 Regents 人事档和 Caltech 校友原档。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0556_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0556_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0556_Furst与Anseth及Wagner原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
