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
 orig.audit_id='pi_archive_20261111_0958_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0958_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const ga='0488afe8', ng='a383ba70', yu='b71d2411';
const g='https://rsl.yale.edu/sites/default/files/2024-08/2018-RSL-Thesis-Yvonne%20Gao.pdf';
const gr='https://rsl.yale.edu/theses';
const gD='https://rsl.yale.edu/media/416/download?inline=';
const y='https://physics.yale.edu/earlier-alumni';
const gc='https://www.cqt.sg/groups/yvonne-gao/';
const n='https://thesis.caltech.edu/5281/1/Thesis_NHK.pdf';
const nm='https://thesis.caltech.edu/5281/';
const nh='https://bpb-us-w2.wpmucdn.com/blog.nus.edu.sg/dist/9/17084/files/2025/08/CV-NHK-1page-1.pdf';
const nc='https://www.cqt.sg/groups/ng-hui-khoon/';
const nf='https://www.physics.nus.edu.sg/faculty/ng-hui-khoon/';
const ne='https://www.physics.nus.edu.sg/faculty/berthold-georg-berge-englert/';
const e='师承人物 - Berthold-Georg Englert';
const rs='人员 - Yale - Robert J. Schoelkopf - f170a4a7';
const jp='人员 - Caltech - John Preskill - b904154d';
const yp='https://www.duffield.cornell.edu/people/qiuming-yu/';
const nj='https://www.jpl.nasa.gov/site/research/snikzad/';
const ya='https://authors.library.caltech.edu/records/k6pz4-8am30';
const yi='https://www.imagesensors.org/Past%20Workshops/1997%20Workshop/1997%20Papers/41%20Nikzad%20et%20al.pdf';
const ym='已核实单位 - Cornell - 材料科学与工程研究生领域';
const nk='师承人物 - Shouleh Nikzad';
const findMentor=(id,file,title,phd,sourceLinks)=>{
 const target=wiki(file,title), person=who(id,id===ga?'Yvonne Y. Gao':'Hui Khoon Ng');
 const label='- 博士导师：'+target+'。'+phd+' '+sourceLinks;
 rewrite(pf(id),x=>x.startsWith('- 博士导师：'+target),()=>label);
 rewrite(mf(file),x=>x.startsWith('- 博士生：'+person),()=>'- 博士生：'+person+'。'+phd+' '+sourceLinks);
 rewrite(index,x=>x.startsWith('- '+person+' → 博士导师：'+target),()=>'- '+person+' → '+label.slice(2));
};
function append(file,entry){
 const t=get(file);
 if(!t.includes(entry)){const nl=t.includes('\r\n')?'\r\n':'\n';updates.set(file,t.trimEnd()+nl+entry+nl);}
}
const gp='Yale 本人 2018 年博士论文题名页将 Robert J. Schoelkopf 列为 Dissertation director，致谢再次明确 advisor。致谢提到与 Michel Devoret 共事及学术启发；共同指导线索尚无具名职衔原件。关系可信度高。';
const gl=source('博士论文题名页',g+'#page=3')+' · '+source('本人致谢',g+'#page=14')+' · '+source('Yale 校友档',y)+' · '+source('CQT 本人组档',gc);
findMentor(ga,rs,'Robert J. Schoelkopf',gp,gl);
schoolSource(ga,' · '+source('Yale 博士论文题名页',g+'#page=3'));
const gav=audit(ga,[
 ['identity','本人学位原件列 Yvonne Y. Gao，版权署 Yvonne Yuan Gao。课题为电路量子电动力学。Schoelkopf 组目录与 CQT 现任档对应。检索命中的 Microwave Beamsplitters 由 Stijn J. de Graaf 撰写，排除为本人的学位来源。',[g,gr,gc,gD],'confirmed'],
 ['phd',gp,[g+'#page=3',g+'#page=14',gr,y],'confirmed_advisor']
],'博士论文题名页及导师已核。若要追共同指导的正式职衔，继续查当年任用或委员会档。独立博士后阶段仍按本人访谈，追返新加坡国家实验室任用。');
relation(ga,gav,'phd',rs,'advisor',gp,[g+'#page=3',g+'#page=14',y],'schoelkopf');
const np='本人学位原件封面列 2010，并明确写于 2009 年 8 月 28 日答辩。致谢具名 John Preskill 为 advisor，Caltech 馆藏元数据核同。本人 CV 与 NUS 系页列博士学习截至 2009 年。';
const nl=source('Caltech 博士论文封面',n+'#page=1')+' · '+source('本人致谢',n+'#page=5')+' · '+source('Caltech 馆藏',nm)+' · '+source('本人 CV',nh);
findMentor(ng,jp,'John Preskill',np,nl);
const ngme=who(ng,'Hui Khoon Ng');
const ngp='CQT 本人组页明确她从 Caltech 毕业回新加坡后在 Berge Englert 组做研究。本人 CV 明列 2010 年 4 月至 2013 年 6 月 CQT Research Fellow（联合任用），与 DSO 2009 年 10 月至 2013 年 6 月 Senior Member of Technical Staff 并行。组属可信度高；正式博士后任用和个人导师职衔待原聘任档。';
const nlinks=source('本人 CV',nh)+' · '+source('CQT 本人组档',nc)+' · '+source('Englert 院系档',ne);
const forward='- 博士后课题组负责人：'+wiki(e,'Berthold-Georg Englert')+'。'+ngp+' '+nlinks;
insertAfter(pf(ng),'## 师承',forward);
insertAfter(mf(e),'## 师承','- 博士后课题组成员：'+ngme+'。'+ngp+' '+nlinks);
append(index,'- '+ngme+' → '+forward.slice(2));
rewrite(pf(ng),x=>x.startsWith('- 博士后经历：'),()=>'- 博士毕业后经历：DSO Senior Member of Technical Staff（2009 年 10 月至 2013 年 6 月），CQT Research Fellow 联合任用（2010 年 4 月至 2013 年 6 月），2013 年 7 月起 Yale-NUS 教职。 '+source('本人 CV',nh)+' · '+source('CQT 本人组档',nc));
rewrite(pf(ng),x=>x.startsWith(boundary),()=>boundary+'博士论文封面年份与答辩日已分列。CQT 联合研究职位的组属和任期已核，独立博士后正式职衔与具名指导仍待人事原件。');
school(ng,'John Preskill（博士导师）','John Preskill（博士导师，2009 答辩／2010 论文）');
school(ng,'DSO 任用及 CQT Englert 组 Research Fellow，岗位性质待核','DSO 任用并行 CQT Englert 组 Research Fellow（2010–2013，联合任用）；正式博士后职衔待核');
schoolSource(ng,' · '+source('本人学位原件',n+'#page=1')+' · '+source('本人 CV',nh));
const ngv=audit(ng,[
 ['identity','Caltech 原件、NUS 系页、本人 CV 与 CQT 组页学位、姓名及量子纠错研究一致。',[n,nf,nh,nc],'confirmed'],
 ['phd',np,[n+'#page=1',n+'#page=5',nm,nh,nf],'confirmed_advisor'],
 ['postdoc',ngp,[nh,nc,ne],'group_or_candidate']
],'继续核 CQT 联合 Research Fellow 的人事性质及个人正式指导称谓。');
relation(ng,ngv,'phd',jp,'advisor',np,[n+'#page=1',n+'#page=5',nm],'preskill');
relation(ng,ngv,'postdoc',e,'group_leader',ngp,[nh,nc,ne],'englert');
const yptext='Cornell 本人档确认 1995–1996 NASA JPL Microdevices 博士后。1997 学术会议原文与 1998 Caltech 馆藏原刊均列 Yu 和 Shouleh Nikzad 同署 JPL 的 CCD 研究，发表日晚于所载任期。JPL 人物档列 Nikzad 1996 Technical Group Leader。保留低可信个人博士后导师候选，指导与组属仍待当期任用原件。';
const yl=source('Cornell 本人档',yp)+' · '+source('1997 当期会议原文',yi)+' · '+source('Caltech 机构馆藏',ya)+' · '+source('JPL Nikzad 履历',nj);
const yuMe=who(yu,'Qiuming Yu');
if(!fs.existsSync(mf(nk)))updates.set(mf(nk),'# Shouleh Nikzad\n\n> [!info] 师承扩展人物\n> Caltech 应用物理博士，JPL 半导体探测器研究者。 '+source('JPL 人物原档',nj)+'\n\n## 师承\n');
const yuForward='- 博士后导师候选：'+wiki(nk,'Shouleh Nikzad')+'。'+yptext+' '+yl;
insertAfter(pf(yu),'## 师承',yuForward);
insertAfter(mf(nk),'## 师承','- 博士后研究者候选（待核）：'+yuMe+'。'+yptext+' '+yl);
append(index,'- '+yuMe+' → '+yuForward.slice(2));
append(path.join(root,'师承候选线索索引.md'),'- '+yuMe+' → '+yuForward.slice(2));
personLine(yu,'- 院系／机构：',' · '+wiki(ym,'Cornell 材料科学与工程研究生领域')+'。 '+source('Cornell 研究生领域字段',yp));
const un=path.join(root,'已核实院系',ym+'.md');
append(un,'- '+yuMe+' — '+source('Cornell 教师原档',yp)+'列 Materials Science and Engineering 研究生领域。');
school(yu,'化学与生物分子工程学院；等离激元','化学与生物分子工程学院、材料科学与工程研究生领域；等离激元');
school(yu,'1995–1996 NASA JPL 博后具名指导待核','1995–1996 NASA JPL 博后，Shouleh Nikzad（候选）');
schoolSource(yu,' · '+source('Caltech 同期项目论文馆藏',ya)+' · '+source('JPL Nikzad 履历',nj));
const yv=audit(yu,[
 ['affiliation','Cornell 化学与生物分子工程教授，Cornell 原档另列材料科学与工程研究生领域；Washington 化工系 Affiliate Professor。',[yp,'https://www.cheme.washington.edu/facultyfinder/qiuming-yu'],'confirmed'],
 ['postdoc',JSON.parse(last.get(yu).details_json).aspects.postdoc.note+' '+yptext,[yp,yi,ya,nj],'group_or_candidate']
],'继续追 Cornell 1995 学位导师和 1995–1996 JPL Microdevices 具名指导，区分 Washington 研究指导。');
relation(yu,yv,'postdoc',nk,'candidate',yptext,[yp,yi,ya,nj],'nikzad');
const pages=[
 {record_id:ga,url:g,raw:'Local text extraction from Yale-hosted 193-page 2018 dissertation. PDF page 3 names Yvonne Y. Gao and Robert J. Schoelkopf as Dissertation director. Page 14 identifies him as advisor.',excerpt:'本人学位原件核正式导师，CV 与校友档一致。'},
 {record_id:ga,url:gr,raw:'Schoelkopf lab thesis index lists Yvonne Y. Gao, 2018, and the dissertation Multi-Cavity Operations in Circuit Quantum Electrodynamics.',excerpt:'校内原页将链接与本人对应。'},
 {record_id:ng,url:n,raw:'Caltech cover lists Hui Khoon Ng, 2010, and defense on August 28, 2009. Acknowledgments explicitly identify John Preskill as advisor.',excerpt:'分列答辩和论文年份。'},
 {record_id:ng,url:nh,raw:'Ng’s CV lists DSO Senior Member of Technical Staff October 2009 to June 2013 and CQT joint Research Fellow April 2010 to June 2013.',excerpt:'分列并行任用。'},
 {record_id:ng,url:nc,raw:'CQT biography says Ng worked in Berge Englert’s group after her Caltech PhD alongside her DSO appointment.',excerpt:'核毕业后组属。'},
 {record_id:ng,url:'https://www.yale-nus.edu.sg/wp-content/uploads/2021/11/CV-NHK-1page_Hui-Khoon-Ng-1.pdf',error:'Failed to fetch https://www.yale-nus.edu.sg/wp-content/uploads/2021/11/CV-NHK-1page_Hui-Khoon-Ng-1.pdf: (404) Not Found'},
 {record_id:yu,url:ya,raw:'CaltechAUTHORS records the 1998 article with Nikzad and Yu, both affiliated with JPL and the same delta-doped detector project.',excerpt:'后续发表原刊支持同项目候选。'},
 {record_id:yu,url:yi,raw:'The 1997 image sensor workshop proceedings identify Qiuming Yu and Shouleh Nikzad among JPL CCD coauthors.',excerpt:'后续同项目原文。'},
 {record_id:yu,url:nj,raw:'JPL’s profile lists Shouleh Nikzad as Member of Technical Staff in 1992 and Technical Group Leader in 1996, among later leadership roles.',excerpt:'候选的职衔与机构。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0958_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0958_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0958_YaleCaltech与JPL原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
