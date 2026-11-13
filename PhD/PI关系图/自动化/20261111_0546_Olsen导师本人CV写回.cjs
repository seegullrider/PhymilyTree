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
 orig.audit_id='pi_archive_20261111_0546_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0546_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"mentor":"https://olsenlab.mit.edu/wp-content/uploads/sites/45/2016/08/bdoCV_july16.pdf#page=12","olself":"https://olsenlab.mit.edu/wp-content/uploads/sites/45/2016/08/bdoCV_july16.pdf#page=1","olgrp":"https://olsenlab.mit.edu/alumni/","olmit":"https://cheme.mit.edu/profile/bradley-d-olsen/","oladv":"https://oge.mit.edu/profiles/bradley-olsen/","yan":"https://profiles.stanford.edu/yan-xia","yt":"https://thesis.caltech.edu/5818/","vt":"https://mii.vt.edu/content/dam/mii_vt_edu/past-technical-seminars/fall-2018-solvay-seminars/Yan%20Xia%20Solvay%20Seminar.pdf","mai":"https://profiles.stanford.edu/danielle-mai","maicv":"https://static1.squarespace.com/static/5b9051c1da02bcde83d8d7cb/t/683fc1874d0be6555f4564b4/1749008775503/djm%2BCV%2B202506.pdf","beck":"https://www.beckman-foundation.org/people/danielle-mai/","rui":"https://chemistry.berkeley.edu/people/rui-wang","rtalk":"https://cheme.stanford.edu/events/chemical-engineering-colloquium/rui-wang","rthesis":"https://thesis.caltech.edu/8738/","raiche":"https://proceedings.aiche.org/conferences/aiche-annual-meeting/2017/proceeding/paper/7db-theoretical-and-computational-study-soft-matter-systems-classical-challenges-rational-design-new","allie":"https://obermeyer.cheme.columbia.edu/principal-investigator","acv":"https://www.engineering.columbia.edu/sites/default/files/2026-09/2026_Obermeyer_CV.pdf","zhong":"https://zhongpolylab.yale.edu/people/dr-mingjiang-zhong","zmit":"https://chemistry.mit.edu/chemistry-news/graduate-student-spotlight-julia-zhao/","ft":"https://thesis.caltech.edu/6414/","fcal":"https://www.lmi.caltech.edu/people/alumni.html","fmin":"https://cse.umn.edu/cems/events/vivian-ferry-seminar","fal":"https://alivisatoslab.uchicago.edu/alumni/","cal2006":"https://www.its.caltech.edu/~ccediv/genlist.pdf#page=4"};
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




const o='9f39f275', oFile=records.get(o).filename, oName='Bradley D. Olsen';
const mentorSrc=src(['Olsen 本人 CV 第 12 页','mentor']);
const advisor='confirmed_advisor', group='group_or_candidate', confirmed='confirmed';
const put=(id,name,oldF,oldB,evidence,links)=>updateEdge(id,name,oFile,oName,oldF,oldB,'博士后导师','博士后研究者',evidence,links);
function support(id,name,mFile,fLabel,bLabel,evidence,links){
 const addition=' '+evidence+' '+links;
 line(pf(id),x=>x.startsWith('- '+fLabel+'：')&&x.includes(mFile),addition);
 line(mf(mFile),x=>x.startsWith('- '+bLabel+'：')&&x.includes(records.get(id).filename),addition);
 line(index,x=>x.startsWith('- '+who(id,name)+' → '+fLabel+'：')&&x.includes(mFile),addition);
 schoolWith(id,links);
}
function keepPriorFollowup(id){
 audits.at(-1).followup_required=JSON.parse(last.get(id).details_json).followup_required;
}
const y='a5846a36';
const yp='Olsen 2016 本人 CV 在 MIT 博士后指导栏具名 Yan Xia（2011–2012）。Virginia Tech 讲者档及 Olsen 组原页核 MIT 化工博士后身份，Stanford 履历核 Dow 和 MIT 先于 2013 入职。具名指导可信度高，具体月份待核。';
const yLinks=mentorSrc+' · '+src(['MIT 课题组校友档','olgrp'],['Virginia Tech 讲者档','vt'],['Stanford 履历','yan']);
put(y,'Yan Xia','博士后阶段研究师长','博士后阶段研究者',yp,yLinks);
rewrite(pf(y),x=>x.startsWith(boundary),()=>boundary+'Caltech 论文明确两位博士导师。Olsen 本人 CV 具名 MIT 博士后指导，任期按原档列 2011–2012，未见具体月份。 '+src(['Caltech 论文目录','yt'],['Olsen 本人 CV 第 12 页','mentor'],['Stanford 履历','yan']));
cell(y,3,'Bradley D. Olsen（MIT 博士后导师，2011–2012）');
schoolWith(y,yLinks+' · '+src(['Caltech 学位档','yt']));
const ya=audit(y,[
 a('identity','Caltech 学位档、Virginia Tech 讲者档和 Stanford 履历对上。',['yt','vt','yan','mentor'],confirmed),
 a('affiliation','Stanford 正式任用栏为化学系教授，2013 年加入该系。',['yan'],confirmed),
 a('research','聚合物合成、结构与物性，包括微孔聚合物与机械响应。',['yan','vt','yt'],confirmed),
 a('phd','2010 年 Caltech 化学博士论文 Advisors 栏列 Robert Grubbs 与 Julia Kornfield。',['yt','vt'],advisor),
 a('postdoc',yp,['mentor','olgrp','vt','yan'],advisor)
],'两阶段均有具名指导证据。补核 Dow 离任和 MIT 博后起讫月份。');
relation(y,ya,'postdoc',oFile,'advisor',yp,ids('mentor','olgrp','vt','yan'),'olsen');
const m='960b0023';
const mp='Olsen 2016 本人 CV 在 MIT 博士后指导栏具名 Danielle Mai。Mai 2025 CV 将同一 Olsen 组的职位列为 2016.09–2017.09 Postdoctoral Associate 与 2017.09–2019.11 Beckman Postdoctoral Fellow。第一段有具名指导确证，第二段基金会列其为 Faculty Mentor，页面原拼 Bradley Olson，本人 CV 核拼写。';
const mLinks=mentorSrc+' · '+src(['本人 2025 CV','maicv'],['Beckman 项目原档','beck'],['Stanford 人物档','mai']);
put(m,'Danielle Mai','博士后阶段研究师长','博士后阶段研究者',mp,mLinks);
rewrite(pf(m),x=>x.startsWith(boundary),()=>boundary+'UIUC 论文指导与 MIT 博士后分阶段。Olsen 具名指导 MIT 初期任用，随后仍在同组，基金会明确其 Beckman Faculty Mentor 角色。 '+mLinks);
cell(m,3,'Bradley D. Olsen（MIT 博士后导师，2016–2017；Beckman Faculty Mentor，2017–2019）');
schoolWith(m,mLinks);
const ma=audit(m,[
 a('identity','本人 2025 CV 核 2016 Illinois 化工博士、2016–2019 MIT 两段任用及 Stanford 2020 入职。',['maicv','mai','mentor'],confirmed),
 a('affiliation','Stanford 化学工程系，材料科学与工程系 courtesy 任用。',['maicv','mai'],confirmed),
 a('research','软物质与聚合物物理，聚合物材料的结构和动力学。',['mai','maicv'],confirmed),
 a('phd','本人 2025 CV 明列 Illinois 2016 博士导师 Charles M. Schroeder。',['maicv'],advisor),
 a('postdoc',mp,['mentor','maicv','beck','mai'],advisor)
],'已核两阶段具名指导及 MIT 两种任用的起讫月份。');
audits.at(-1).followup_required=false;
relation(m,ma,'postdoc',oFile,'advisor',mp,ids('mentor','maicv','beck','mai'),'olsen');
const r='6166fb33';
const rp='Olsen 本人 CV 在 MIT 博士后指导栏列 Rui Wang 自 2015 年起。Stanford 讲者档和 Berkeley 院系档核同一人 2015–2018 年在 MIT 做博后。Olsen 为已确认的博士后导师，Johnson 与 Alexander-Katz 的同期合作研究按原证据分别记录。';
const rLinks=mentorSrc+' · '+src(['Stanford 讲者档','rtalk'],['Berkeley 院系档','rui'],['本人 AIChE 研究报告','raiche']);
put(r,'Rui Wang','博士后合作研究者','博士后合作研究者',rp,rLinks);
rewrite(pf(r),x=>x.startsWith(boundary),()=>boundary+'Caltech 馆藏列 2015，Berkeley 履历及 Stanford 讲者档列 2014，待核授位与存档日期。Olsen 的本人 CV 具名博士后指导。Johnson、Alexander-Katz 的博士后合作仍保留，正式共同指导待核。区别 Westlake 同名学者。 '+rLinks+' · '+src(['Caltech 论文目录','rthesis']));
cell(r,3,'Bradley D. Olsen（MIT 博士后导师，2015–2018）；Jeremiah A. Johnson、Alfredo Alexander-Katz（博后合作研究）');
schoolWith(r,rLinks);
const ra=audit(r,[
 a('identity','Berkeley 与 Stanford 履历对上浙江大学教育、Caltech 化工博士及 2015–2018 MIT 博后，区别同名数学及材料研究者。',['rui','rtalk','rthesis'],confirmed),
 a('affiliation','UC Berkeley 化学与生物分子工程系，Stanford 讲者档另列 LBNL 材料科学部 Faculty Scientist。',['rui','rtalk'],confirmed),
 a('research','聚合物及软物质理论，界面静电与网络力学。',['rui','rtalk'],confirmed),
 a('phd','Caltech 学位档 Advisor 明列 Zhen-Gang Wang，2014／2015 来源差异仍留档。',['rthesis','rui','rtalk'],advisor),
 a('postdoc',rp,['mentor','rtalk','rui','raiche'],advisor)
],'追 Johnson 和 Alexander-Katz 是否有具名共同指导，核 Caltech 授位与馆藏年份。');
relation(r,ra,'postdoc',oFile,'advisor',rp,ids('mentor','rtalk','rui','raiche'),'olsen');
const aId='bb099b3c';
const aPost='Olsen 本人 2016 CV 的博士后指导栏目列 Allie Obermeyer 2014–2016，和本人组页及已归档的本人 CV 一致。';
support(aId,'Allie Obermeyer',oFile,'博士后导师','博士后研究者',aPost,mentorSrc);
audit(aId,[
 a('identity','Columbia 本人组页核 Berkeley 博士、MIT 博后与 Columbia 化工现任。',['allie','mentor'],confirmed),
 a('affiliation','Columbia 化学工程系副教授。',['allie'],confirmed),
 a('postdoc',aPost,['mentor','allie','acv'],advisor)
],'本人 CV 已分别明确两阶段导师。本轮新增指导者 CV 交叉佐证。');
keepPriorFollowup(aId);
const z='69f2a21a';
const zPost='Olsen 本人 CV 的博士后指导栏目列 Mingjiang Zhong 2013–2016，和 Yale 本人履历及 MIT 访谈所载共同指导一致。';
support(z,'Mingjiang Zhong',oFile,'博士后导师','博士后受指导者',zPost,mentorSrc);
audit(z,[
 a('identity','Yale 组页的 CMU 博士、MIT 博后及 Yale 任用与指导名录一致。',['zhong','mentor'],confirmed),
 a('affiliation','Yale 化学与环境工程副教授，兼化学和材料科学。',['zhong'],confirmed),
 a('postdoc',zPost+' MIT 共同导师为 Bradley D. Olsen 与 Jeremiah A. Johnson。',['mentor','zhong','zmit'],advisor)
],'两阶段已分开记录，指导者本人 CV 为额外同期证据。');
keepPriorFollowup(z);
const f='f8cbc819', al='人员 - University of Chicago - Paul Alivisatos - 9209cf4f';
const fpst='Caltech LMI–EFRC 原校友档列 Vivian Ferry 2014 年结束 LBL 博士后及后续 Minnesota 任用。Minnesota 讲者档明确她于 2011–2014 年在 LBNL 与 Paul Alivisatos 做博后。按阶段研究师长记录，正式职衔待核。';
const fLinks=src(['Caltech 项目校友原档','fcal'],['Minnesota 讲者档','fmin']);
support(f,'Vivian Ferry',al,'博士后阶段研究师长','博士后阶段研究者',fpst,fLinks);
pl(f,boundary,'Caltech 2006 名册为一年级研究生，当期未具名导师。2011 学位档明确 Atwater。 '+src(['Caltech 2006 名册第 4 页','cal2006'],['Caltech 学位档','ft']));
const fa=audit(f,[
 a('identity','Caltech 论文、LMI–EFRC 校友档与 Minnesota 履历对应同一人。',['ft','fcal','fmin'],confirmed),
 a('affiliation','Minnesota 化学工程与材料科学系副教授。',['fmin'],confirmed),
 a('research','纳米尺度光与物质相互作用、光伏光管理及可切换超材料。',['fmin'],confirmed),
 a('phd','Caltech 2011 论文列 Harry Albert Atwater 为 Advisor。2006 年名册为一年级研究生，尚无具名指导栏。',['ft','cal2006'],advisor),
 a('postdoc',fpst,['fcal','fmin'],group)
],'Alivisatos 组校友网页返回 502。查 LBNL 2011–2014 博后任用或具名个人指导原档。');
relation(f,fa,'postdoc',al,'stage_mentor',fpst,ids('fcal','fmin'),'alivisatos');
const op='本人 2016 CV 第 1 页把 Caltech 博士后任用列在 Tirrell、Wang、Kornfield 三人实验室下，并列 2008.01–2009.12 Beckman Institute fellowship。MIT 访谈具名 Kornfield 为一位博后导师，另两人的组属与阶段工作获本人 CV 佐证。';
const oLinks=src(['Olsen 本人 CV 第 1 页','olself'],['MIT 研究生教育办公室访谈','oladv'],['MIT 化工系','olmit']);
pl(o,boundary,op+' '+oLinks);
schoolWith(o,oLinks);
audit(o,[
 a('identity','本人 CV 与 MIT 化工系核 Berkeley 化工博士及 Caltech 博后。',['olself','olmit','oladv'],confirmed),
 a('affiliation','MIT 化学工程系 Kasser 教授。',['olmit'],confirmed),
 a('research','软凝聚态与高分子物理，嵌段共聚物结构和软材料。',['olmit','oladv'],confirmed),
 a('postdoc',op,['olself','oladv'],advisor)
],'查 Caltech fellowship 任用或指导人档核 Tirrell、Wang 的具体指导职衔。');
const summary=(record_id,key,raw,excerpt)=>({record_id,url:u[key],raw,excerpt});
const pages=[
 [y,'mentor','Postdoctoral Scholars Supervised (MIT): Yan Xia, 2011–2012, Stanford Chemistry.','具名 MIT 博士后指导。'],
 [y,'yt','CaltechTHESIS lists Robert H. Grubbs and Julia A. Kornfield as advisors of Yan Xia’s 2010 chemistry dissertation.','明确两位博士导师。'],
 [y,'yan','Stanford’s appointments section lists Professor of Chemistry and records work at Dow and MIT before joining in 2013.','核现任与履历。'],
 [m,'mentor','The MIT postdoctoral supervision section of Olsen’s July 2016 CV includes Danielle Mai.','核博士后阶段个人指导。'],
 [m,'maicv','Mai CV separates Sept. 2016–Sept. 2017 Postdoctoral Associate and Sept. 2017–Nov. 2019 Beckman Fellow, both in Bradley D. Olsen Group.','核任用月份和博士导师。'],
 [m,'beck','Beckman Foundation lists 2017 MIT faculty mentor as Bradley Olson.','由本人 CV 核正姓氏。'],
 [r,'mentor','The CV’s MIT postdoctoral supervision list includes Rui Wang, starting in 2015.','确认 Olsen 的博士后指导。'],
 [r,'rtalk','Stanford’s event biography records Caltech PhD under Zhen-Gang Wang and MIT postdoc with Olsen and Johnson, 2015–2018.','核身份、两阶段和 MIT 时段。'],
 [r,'rui','Berkeley Chemical and Biomolecular Engineering lists MIT Postdoctoral Associate 2015–2018 and theoretical polymer and soft materials.','核现任和方向。'],
 [aId,'mentor','Olsen’s MIT postdoctoral supervision list includes Allie Obermeyer 2014–2016.','既有两阶段的独立佐证。'],
 [aId,'allie','Columbia chemical engineering lab bio lists Berkeley doctoral work in Matthew Francis’s lab and MIT postdoctoral work in Bradley Olsen’s lab.','核身份和现任。'],
 [z,'mentor','Olsen lists Mingjiang Zhong 2013–2016 in the MIT postdoctoral supervision section.','复核一位共同博后导师。'],
 [z,'zhong','Yale lab bio lists two MIT postdoctoral mentors and chemical engineering, chemistry and materials science appointments.','核现任与任期。'],
 [f,'fcal','LMI–EFRC alumni list records Vivian Ferry as LBL postdoc through 2014 and later Minnesota faculty.','同期项目名录独立补证。'],
 [f,'fmin','Minnesota departmental seminar lists 2011–2014 LBNL postdoctoral fellowship with Paul Alivisatos.','保留阶段师长。'],
 [o,'olself','Olsen CV lists postdoctoral research in the Tirrell, Wang and Kornfield labs at Caltech, Jan. 2008–Dec. 2009.','核本人博士后组属与任期。']
].map(fields=>summary(...fields));
pages.push({record_id:f,url:u.fal,error:'(502) Bad Gateway. 原组校友页未读到正文，采用 Caltech 项目原页及 Minnesota 院系原档。'});
pages.push({record_id:aId,url:u.acv,error:'URL is not accessible via this tool. 本轮保留既有本人 CV 的可靠记录，并以 Olsen CV 补证。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0546_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0546_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0546_Olsen导师本人CV与项目原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
