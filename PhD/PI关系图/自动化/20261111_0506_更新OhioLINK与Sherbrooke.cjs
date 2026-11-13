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
 orig.audit_id='pi_archive_20261111_0506_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0506_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"cv":"https://www.cpht.polytechnique.fr/cpht/lehur/CVKLH_August2017.pdf","cvp":"https://www.cpht.polytechnique.fr/cpht/lehur/CVKLH_August2017.pdf#page=16","oldcv":"https://www.cpht.polytechnique.fr/cpht/lehur/CV_complet_Fev2013.pdf","members":"https://www.cpht.polytechnique.fr/cpht/lehur/Members.pdf","bnl":"https://www.bnl.gov/staff/anevidoms","esdg":"https://vallico.net/casinoqmc/esdg-talk-archive/","et":"https://ethos.bl.uk/OrderDetails.do?uin=uk.bl.ethos.615061","aps":"https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.91.105502","rice":"https://profiles.rice.edu/faculty/andriy-nevidomskyy","cole":"https://www.physics.rutgers.edu/~coleman/mycv24.pdf","ert":"https://etd.ohiolink.edu/acprod/odb_etd/ws/send_file/send?accession=osu1376496346&disposition=inline","etc":"https://rave.ohiolink.edu/etdc/view?acc_num=osu1376496346","nt":"https://physics.osu.edu/sites/default/files/2019-10/nt-cv_2019.pdf","pk":"https://www.pks.mpg.de/~erten/","pks":"https://www.pks.mpg.de/de/condensed-matter/seminars-conferences/condensed-matter-group-seminar","mag":"https://nationalmaglab.org/news-events/events/maglab-calendar/seminar-by-onur-erten/","cmt":"https://cmt.rutgers.edu/alumni/","zju":"https://zimp.zju.edu.cn/2021/1117/c63739a2442627/page.htm","ql":"https://d3qi0qp55mx5f5.cloudfront.net/physics/docs/PubList15.pdf?mtime=1762462564","qf":"https://profiles.rice.edu/faculty/qimiao-si","qa":"https://onlinelibrary.wiley.com/doi/10.1002/pssb.201300005","bi":"https://birol.cems.umn.edu/people","bcv":"https://birol.cems.umn.edu/sites/birol.cems.umn.edu/files/files/media/birol_cv.pdf","bs":"https://indico.truba.gov.tr/event/47/timetable/?view=standard_inline_minutes","bprimary":"https://cse.umn.edu/cems/turan-birol"};
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




const N='eb77eba7', E='8de8d75e', Q='5c87b7d6', B='d321ab05';
const nE='2017 年 Karyn Le Hur 本人履历第 16 页在 Postdoctoral research fellows 栏列 2005–2006 年，并明确说她在 Sherbrooke 指导 Nevidomskyy 研究介观物理。BNL 与 Rice 履历独立确认 Sherbrooke 为博士后阶段。旧版履历亦记录这段指导。';
const nL=src(['Le Hur 本人 2017 CV 第 16 页','cvp'],['早期 CV','oldcv'],['BNL 原档','bnl'],['Rice 原档','rice']);
updateEdge(N,'Andriy Nevidomskyy','师承人物 - Karyn Le Hur','Karyn Le Hur','博士后阶段研究师长','博士后阶段研究者','博士后导师','博士后受指导者',nE,nL);
const es=src(['Cambridge TCM 同期讨论班档','esdg'],['APS 同期原论文','aps']);
pl(N,boundary,'2017 版本人指导者履历明确 Sherbrooke 博士后指导；Cambridge 讨论班档保留姓名拼写 Andrij 和 Andriy 两种及纳米管报告，便于馆藏核查。Payne 仍列博士候选，Coleman 仍列 Rutgers 博后课题组负责人。 '+nL+' · '+es);
cell(N,3,'Karyn Le Hur（Sherbrooke 2005–2006 博士后导师）；Piers Coleman（Rutgers 博后课题组负责人，个人指导待核）');
schoolWith(N,nL+' · '+es);
const nA=audit(N,[a('phd','Cambridge TCM 同期讨论班档用 Andrij 和 Andriy 两种拼写列此人，记录纳米管与密度泛函研究。Payne 为合作线索，待 2005 原学位档。',['esdg','aps','et','bnl']),a('postdoc',nE+' Rutgers 阶段 Coleman 仍为课题组负责人，个人指导待核。',['cv','bnl','rice','cole'],'confirmed_advisor')],'按完整题名和两种名拼写查 Cambridge 学位存档，另核 Rutgers 博后指导职衔。');
relation(N,nA,'postdoc','师承人物 - Karyn Le Hur','advisor',nE,ids('cvp','bnl','rice'),'pd1');
const rE='Ohio State 2013 物理博士论文题名页明确列 Mohit Randeria, Advisor，致谢重申主导师。论文题名为 Electronic and Magnetic Properties of Double Perovskites and Oxide Interfaces。';
const tE='Ohio State 2013 博士论文第 6 页致谢明确称 Nandini Trivedi 为 co-advisor。题名页另将她列在论文委员会，并明确 Randeria 为 Advisor。';
const eL=src(['OhioLINK 论文原件','ert'],['OhioLINK 书目','etc']);
updateEdge(E,'Onur Erten','人员 - Ohio State - Mohit Randeria - 667eeaa4','Mohit Randeria','博士导师','博士生','博士导师','博士生',rE,eL);
updateEdge(E,'Onur Erten','人员 - Ohio State - Nandini Trivedi - 22f94a5f','Nandini Trivedi','博士阶段研究师长','博士阶段研究者','博士共同导师','共同指导博士生',tE,eL+' · '+src(['Trivedi 本人 CV','nt']));
pl(E,'- 博士关系证据：','论文第 6 页另具名共同导师 Nandini Trivedi。 '+eL);
pl(E,boundary,'论文题名页及致谢分列 Randeria 与 Trivedi。本人 MPI-PKS 同期主页核 Max Planck 博后，所方记录 2016 年 11 月已在所内报告，MagLab 原档核后续 ASU 物理现职及方向。该阶段个人指导待具名任用档。 '+src(['MPI-PKS 本人主页','pk'],['MPI-PKS 2016 年研讨会','pks'],['MagLab 履历','mag']));
cell(E,2,'Mohit Randeria（论文主导师）；Nandini Trivedi（论文致谢具名共同导师）');
cell(E,3,'Piers Coleman（Rutgers 博士后课题组负责人）；MPI-PKS 2016 年已任博后，个人指导待核');
schoolWith(E,eL+' · '+src(['MPI-PKS 本人原档','pk'],['MPI-PKS 2016 年研讨会','pks'],['MagLab 履历','mag']));
const eA=audit(E,[a('affiliation','MagLab 讲者原档确认 Arizona State 现为副教授，所方旧主页核 MPI-PKS 为历史博士后单位。',['mag','pk']),a('research','MagLab 原档确认强关联电子、量子磁性、超导与量子材料拓扑相。论文原卷核博士方向为双钙钛矿与氧化物界面。',['mag','ert']),a('phd',rE+' '+tE,['ert','etc','nt'],'confirmed_advisor'),a('postdoc','MPI-PKS 本人旧主页自称该所博士后，所方 2016 年 11 月 3 日报告记录已列 MPIPKS 单位。Rutgers Coleman 关系仍核为博士后组负责人。个人指导待核。',['pk','pks','mag','cmt'])],'核 Rutgers 博后个人导师和 MPI-PKS 组属与任用月份。');
relation(E,eA,'phd','人员 - Ohio State - Mohit Randeria - 667eeaa4','advisor',rE,ids('ert','etc'),'p1');
relation(E,eA,'phd','人员 - Ohio State - Nandini Trivedi - 22f94a5f','advisor',tE,ids('ert','nt'),'p2');
const qE='浙江大学 2021 年 CUSPEA 讲座原页独立列 1991 年芝加哥大学博士。Levin 本人出版目录核同期合作，保留 Kathryn Levin 为博士导师候选，正式学位指导待原卷。';
const qL=src(['浙江大学讲座原档','zju'],['Levin 本人发表目录','ql'],['Si 本人作者履历','qa']);
updateEdge(Q,'Qimiao Si','人员 - University of Chicago - Kathryn Levin - 2b43ee19','Kathryn Levin','博士候选关系','博士候选研究者','博士候选关系','博士候选研究者',qE,qL);
pl(Q,boundary,'浙江大学原档给出本人中英文姓名、1991 学位及 Rutgers、UIUC 两段博后，未给个人指导。讲者资料所列 1994 入职对应 Rice 履历的教职年份，实际赴校 1995 另记。 '+src(['浙江大学讲座原档','zju'],['Rice 教师原档','qf']));
schoolWith(Q,qL);
const qA=audit(Q,[a('identity','浙江大学 2021 讲座原档列 Qimiao Si、斯其苗、Rice 量子材料中心及芝加哥学位，与 Rice 教师档一致。',['zju','qf']),a('phd',qE,['zju','ql','qf']),a('postdoc','浙大原档复核 Rutgers 与 UIUC 两段任用。Rice 原档进一步区分 1994 教职与 1995 到校，个人博后指导待核。',['zju','qf','cmt'])],'继续查 Chicago 1991 纸本学位题录或论文。核 Rutgers 与 UIUC 两段个人指导。');
relation(Q,qA,'phd','人员 - University of Chicago - Kathryn Levin - 2b43ee19','candidate',qE,ids('zju','ql','qf'),'p1');
const bL=src(['本人课题组','bi'],['2021 讲者原档','bs'],['Minnesota CEMS 原档','bprimary']);
pl(B,boundary,'本人课题组页列 Minnesota CEMS 及 Physics 研究生项目，2021 讲者履历独立核 2013 Cornell 博士、Rutgers CMT 博后及 2016 加入 Minnesota。Haule、Kotliar 仍列候选。 '+bL);
schoolWith(B,bL);
audit(B,[a('affiliation','本人课题组与 CEMS 院档均列 Minnesota 化工与材料科学和 Physics 研究生项目任职，2016 入职见讲者原档。',['bi','bs','bprimary']),a('postdoc','本人实验室和 2021 讲者履历均列 Rutgers CMT 博士后；CV 给出 2013–2016。同期两名合作者仍为候选。',['bi','bs','bcv','cmt'])],'追查 Rutgers 博士后任用资料或指导人履历，不凭同单位和论文合著升级。');
const page=(record_id,key,excerpt)=>({record_id,url:u[key],raw:excerpt,excerpt});
const fail=(record_id,key,error)=>({record_id,url:u[key],error});
const pages=[
 page(N,'cv','导师本人 CV 第 16 页 Postdoctoral research fellows：Andriy Nevidomskyy (2005/2006)，I have supervised Andriy Nevidomskyy at Sherbrooke on mesoscopic physics.'),
 fail(N,'oldcv','2013 版 CV 的公开链接转址后无法通过网页工具读取，本次已直接核读 2017 版。'),
 fail(N,'members','Supervision 名单重定向后未取得正文。'),
 page(N,'esdg','Electronic Structure Discussion Group 原档列 2002–2005 年 Andrij 或 Andriy Nevidomskyy TCM 报告，含碳掺杂氮化硼纳米管。'),
 page(E,'ert','OhioLINK 下载原卷第 1 页列 Advisor Mohit Randeria，第 6 页致谢列 co-advisor Nandini Trivedi。缓存 20261111_0503_Erten_OhioLINK_2013.pdf，SHA-256 a954bd9ac2563a83f13a19ea9e672af39abd3a83182f7445dd5a5316a141918c。'),
 page(E,'pk','本人同期 MPI-PKS 主页首段自称该所 postdoctoral fellow，研究理论凝聚态及强关联、磁性、超导。'),
 page(E,'pks','MPI-PKS 凝聚态组公开研讨档 2016-11-03 列 Onur Erten (MPIPKS) 报告。'),
 page(E,'mag','MagLab 讲者原档复核 Ohio State 博士、Rutgers 与 MPI-PKS 博后、ASU 现职及强关联、量子磁性和超导等方向。'),
 page(Q,'zju','浙江大学原页同时列 Qimiao Si 与斯其苗，1991 Chicago 博士，Rutgers 与 UIUC 两段博后，1994 Rice 教职。'),
 page(B,'bi','本人课题组原页列 Minnesota CEMS 副教授、物理研究生项目，及 Rutgers CMT 博后。'),
 page(B,'bs','TRUBA 2021 原讲者资料独立列 Turan Birol 2013 Cornell 物理博士，Rutgers CMT 博士后，2016 进入 Minnesota CEMS。')
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0506_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0506_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0506_OhioLINK与Sherbrooke原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
