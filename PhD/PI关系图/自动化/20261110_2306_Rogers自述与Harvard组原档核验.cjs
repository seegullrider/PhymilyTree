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
 orig.audit_id='pi_archive_20261110_2306_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2306_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"doc":"https://www.linkedin.com/posts/profjohnarogers_it-was-wonderful-to-have-a-chance-yesterday-activity-7249777439483047937-q_cA","post":"https://www.linkedin.com/posts/profjohnarogers_special-moments-with-special-people-barbara-activity-7339257930715697152-c4yL","post2":"https://www.linkedin.com/posts/profjohnarogers_check-out-our-paper-on-skin-interfaced-microfluidic-activity-7237877619466063872-zkPb","nwm":"https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/rogers-john.html","sig":"https://www.sigmaxi.org/programs/prizes-awards/william-procter/award-winner/john-a.-rogers","nel":"https://web.mit.edu/nelsongroup/thegroup/_formergroupmembers.shtml","gmw":"https://www.gmwgroup.harvard.edu/resources","teria":"https://inchemistry.acs.org/acs-and-you/eminent-scientist-teri-odom.html","teric":"https://www.odomgroup.northwestern.edu/wp-content/uploads/2020/04/Odom-CV-April-2020.pdf","teriI":"https://publications.iupac.org/news/prize/2001/odom.html","terig":"https://www.rsc.org/standards-and-recognition/prizes/winners/professor-teri-odom","dg":"https://graciaslab.johnshopkins.edu/people/","dgc":"https://pmc.ncbi.nlm.nih.gov/articles/PMC3078552/","ari":"https://www.physics.nus.edu.sg/faculty/ariando/","arit":"https://research.utwente.nl/files/277802637/thesis_Ariando.pdf","arip":"https://www.cells.es/en/public/events/the-rise-of-a-new-superconducting-era-the-nickel-age","arid":"https://commencement.ufl.edu/media/commencementufledu/past-commencement-pdf/past-commencement-programs/commencement-pdf/Doctoral-Fall-22.pdf","nur":"https://vivo.brown.edu/docs/drrb/1106970197.pdf","nurb":"https://vivo.brown.edu/display/anurmikk","cl":"https://engineering.msu.edu/directory/faculty/trclark","clp":"https://web.ece.ucsb.edu/Faculty/Klamkin/Klamkin_MP_Paper_6.pdf","br":"https://www.ntu.edu.sg/erian/about-us/our-people/cluster-directors/annalisa-bruno","brc":"https://www3.ntu.edu.sg/CorpComms2/Documents/2020/07_Jul/Consul%20Press_270720_solar.pdf","brp":"https://advanced.onlinelibrary.wiley.com/doi/10.1002/adfm.201000477","haq":"https://profiles.imperial.ac.uk/s.a.haque","brt":"https://spiral.imperial.ac.uk/entities/publication/422428c5-94bf-40fd-973a-94feb80e2662"};
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
const [r,o,g,ar,n,c,b]=['4f0e566c','305258c1','df7a6c3f','4b7afdfb','24e523b0','e68d360a','df30ec91'];
const rogers='John A. Rogers',odom='Teri Odom',gracias='David Gracias',bruno='Annalisa Bruno';
const keith=records.get('a92c9bbe').filename,ws='师承人物 - George M. Whitesides',lieber='师承人物 - Charles M. Lieber',haque='师承人物 - Saif A. Haque';
const mainR=who(r,rogers);
const dr='Rogers 本人在 2024 年发布的回顾中明确称 MIT 的 Keith Nelson 为自己的 PhD advisor。MIT Nelson 组毕业生名录列 John Rogers、Ph.D. 1995；Sigma Xi 颁奖履历核 1995 MIT 物理化学博士及 Nelson 指导。可信度高。';
const pr='Rogers 两篇本人署名的回顾明确称 George M. Whitesides 为自己的 postdoctoral advisor，阶段为 1995–1997 Harvard Society of Fellows Junior Fellow。Whitesides 实验室原名录列 1995-09-01 至 1997-08-31 Postdoctoral Fellow。可信度高。';
const drL=src(['Rogers 本人回顾（博士）','doc'],['MIT Nelson 组名录','nel'],['Sigma Xi 获奖档','sig']);
const prL=src(['Rogers 本人回顾（博后）','post'],['本人 RSC 论文献辞说明','post2'],['Harvard Whitesides 组名录','gmw']);
rewrite(pf(r),x=>x.startsWith('- 博士课题组负责人、正式博士导师候选：')&&x.includes(keith),()=>'- 博士导师：'+wiki(keith,'Keith A. Nelson')+'。'+dr+' '+drL);
rewrite(mf(keith),x=>x.startsWith('- 博士课题组成员：')&&x.includes(mainR),()=>'- 博士生：'+mainR+'。'+dr+' '+drL);
rewrite(index,x=>x.startsWith('- '+mainR+' → 博士课题组负责人、正式导师候选：')&&x.includes(keith),()=>'- '+mainR+' → 博士导师：'+wiki(keith,'Keith A. Nelson')+'。'+dr+' '+drL);
updateEdge(r,rogers,ws,'George M. Whitesides','博士后阶段研究师长','博士后阶段研究者','博士后导师','博士后研究者',pr,prL);
rewrite(pf(r),x=>x.startsWith('> 此节点保留原文件名及既有反向链接；'),()=>'> Northwestern 院系、研究方向与两阶段导师均有原始来源。');
cell(r,2,'Keith A. Nelson（MIT 1995 博士导师）');
cell(r,3,'George M. Whitesides（Harvard 1995–1997 博士后导师）');
cell(r,4,src(['Northwestern 工程学院','nwm'],['Sigma Xi 获奖档','sig'])+' · '+drL+' · '+prL);
const rEvent=audit(r,[a('phd',dr,['doc','nel','sig'],'confirmed_advisor'),a('postdoc',pr,['post','post2','gmw'],'confirmed_advisor'),a('affiliation','Northwestern 工程学院及 Sigma Xi 获奖档列材料科学与工程、生物医学工程、神经外科和关联任职。',['nwm','sig']),a('research','柔性电子、软材料、微纳加工及光电子器件。',['nwm','sig'])],'两阶段导师由本人具名并经独立机构互证，已更新人物页和反向链接。');
audits.at(-1).followup_required=false;
relation(r,rEvent,'phd',keith,'advisor',dr,ids('doc','nel','sig'),'Nelson');
relation(r,rEvent,'postdoc',ws,'advisor',pr,ids('post','post2','gmw'),'Whitesides');
const od='ACS 本人访谈报道明确将 Teri Odom 2001 年 Harvard 化学物理博士学位与 Charles M. Lieber 的指导相连。本人履历核 2001 学位和同校博士后。既有 Chicago ACS 简报亦记博士指导。可信度高。';
const op='Harvard Whitesides 原组名录把 Odom 列为 2000 年 12 月至 2002 年 11 月 Postdoctoral Fellow。本人 CV 在 2001 年分别列化学物理博士和 Harvard 博后。组名册起始早于 CV 学位年，两个来源分别保留，正式导师职衔和聘用起算待核。';
const odl=src(['ACS 原访谈报道','teria'],['本人 CV','teric']);
const opl=src(['本人 CV','teric'],['Whitesides 组名录','gmw']);
updateEdge(o,odom,lieber,'Charles M. Lieber','博士阶段研究师长','博士阶段研究成员','博士导师','博士生',od,odl);
rewrite(pf(o),x=>x.startsWith(boundary),()=>boundary+od+' '+op+' '+odl+' · '+opl);
cell(o,2,'Charles M. Lieber（ACS 采访明确为 Harvard 博士学位指导）');
cell(o,3,'George M. Whitesides（Harvard 博士后阶段研究师长）；任期起算待查');
schoolWith(o,odl+' · '+opl);
const oEvent=audit(o,[a('phd',od,['teria','teric'],'confirmed_advisor'),a('postdoc',op,['teric','gmw'])],'追 Harvard 博士论文签署页及博后任用日期和正式指导职衔。');
relation(o,oEvent,'phd',lieber,'advisor',od,ids('teria','teric'),'Lieber');
const gd='Johns Hopkins 本人实验室将 Berkeley 博士和 Harvard 博后分别对应 Somorjai 和 Whitesides 两组；Harvard Whitesides 组名录列同一 David Gracias 为 1999 年 6 月至 2002 年 5 月 Postdoctoral Fellow，后赴 Johns Hopkins。博士后课题组归属可信度高，正式个人职衔待核。';
const gl=src(['Johns Hopkins 本人实验室','dg'],['Harvard Whitesides 组名录','gmw'],['既有作者传记','dgc']);
updateEdge(g,gracias,ws,'George M. Whitesides','博士后阶段研究关联者','博士后阶段研究关联者','博士后课题组负责人','博士后课题组成员',gd,gl);
rewrite(pf(g),x=>x.startsWith(boundary),()=>boundary+gd+' Berkeley 博士课题组关系保留，论文正式导师仍待原档。 '+gl);
cell(g,3,'George M. Whitesides（Harvard 博士后课题组负责人，1999–2002）');
schoolWith(g,gl);
const gEvent=audit(g,[a('postdoc',gd,['dg','gmw','dgc'],'group_or_candidate')],'追 Berkeley 论文签署页和 Harvard 博后任用原件。');
relation(g,gEvent,'postdoc',ws,'group_leader',gd,ids('dg','gmw','dgc'),'Whitesides');
const aD='Twente 2005 学位论文扉页列 Horst Rogalla 和 Hans Hilgenkamp 为两位 promotor；NUS 本人档核 Twente 2005 物理博士、NUS 物理系任职与量子材料研究。';
const aP='ALBA 主办方讲者原页核获 Twente 博士学位后在荷兰 NanoNed 项目担任博士后，2008 加入 NUS，个人指导仍待项目任命原件。';
const aMismatch='Florida 2022 博士典礼原册所列 David Joseph Ariando 为电气与计算机工程博士；NUS 物理系 Ariando 由 Twente 2005 论文及 NUS 校方档确认不同身份。';
const aL=src(['Twente 博士论文','arit'],['NUS 物理系原档','ari'],['ALBA 本人讲者履历','arip'],['Florida 2022 名录（误配）','arid']);
pl(ar,boundary,aP+' '+aMismatch+' '+aL);
schoolWith(ar,aL);
const arEvent=audit(ar,[a('identity',aMismatch,['ari','arit','arid']),a('phd',aD,['ari','arit'],'confirmed_advisor'),a('postdoc',aP,['arip','ari'])],'查 NanoNed 录用原档、具体博士后课题组和个人指导。');
const nD='Brown 托管本人历次 CV 区分 Hebrew University 物理系 Postdoctoral Fellow 与 1972–1975 MIT 电气工程系 Research Associate。Brown 现行简介把两段概括为博士后训练。已按原任用头衔分列，具体指导人未具名。';
const nL=src(['Brown 托管本人 CV','nur'],['Brown 教师履历','nurb']);
pl(n,boundary,nD+' '+nL);
cell(n,3,'Hebrew University 物理系 Postdoctoral Fellow；MIT 电气工程 Research Associate（1972–1975）；指导者待核');
schoolWith(n,nL);
audit(n,[a('postdoc',nD,['nur','nurb']),a('affiliation','Brown 工程与物理、跨学科神经工程及纳米光子学。',['nurb','nur']),a('research','纳米光子学、半导体光源及神经工程。',['nurb','nur'])],'追 Hebrew University 博后接收组档及 MIT Research Associate 原始聘用信息。');
const cN='Whitesides 组名录列同名 Thomas Clark 1998–2001 Harvard 博士后并连到 Naval Research Laboratory。MSU 本人院系档和论文作者传记列 Thomas R. Clark 1998–2000 为 NRL 光学部 Research Physicist、2000 转 Dorsal Networks。两套任用时间重叠，组名录的身份仍需全名或任用档确认，暂作同名线索。';
const cL=src(['Whitesides 组名录同名线索','gmw'],['MSU 本人原档','cl'],['同期作者履历','clp']);
pl(c,boundary,cN+' '+cL);
schoolWith(c,cL);
audit(c,[a('postdoc',cN,['gmw','cl','clp']),a('research','MSU 本人原档列微波、毫米波光子学与光子集成电路。',['cl'])],'以 NRL 光学部和 Harvard 化学系任用原件判定同名、重叠身份与阶段。');
const bp='NTU ERI 原档确证其 Imperial 博后。NTU 托管的意大利领馆履历分列 Naples 化工研究、Imperial 化学研究和后续长期访问；2010 期刊原页显示 Bruno 与 Haque 同署 Imperial 化学系并研究有机光伏。Haque 暂列博士后导师低可信候选，具体接收组和指导未具名。';
const bl=src(['NTU ERI 本人档','br'],['NTU 托管意大利领馆履历','brc'],['2010 出版方原页','brp'],['Imperial Haque 本人档','haq']);
mentor(haque,'Saif A. Haque','Imperial College London 化学教授，研究杂化半导体和光伏材料。',src(['Imperial 本人档','haq']));
edge(b,bruno,haque,'Saif A. Haque','博士后导师候选','博士后候选研究者',bp,bl);
pl(b,boundary,bp+' '+bl);
cell(b,3,'Naples 及 Imperial 博后；Saif A. Haque（Imperial 博士后导师低可信候选）');
schoolWith(b,bl);
const bEvent=audit(b,[a('postdoc',bp,['br','brc','brp','haq'],'group_or_candidate'),a('affiliation','NTU ERI 原档列物理与数学科学学院、材料科学与工程学院。',['br','brc']),a('research','钙钛矿光伏、半导体光物理和光电子应用。',['br','brc'])],'追 Naples 正式论文目录及 Imperial 化学系博士后任用原件。');
relation(b,bEvent,'postdoc',haque,'candidate',bp,ids('br','brc','brp','haq'),'Haque');

const pages=[["r","doc","It was wonderful to have a chance yesterday to host a visit of my PhD advisor, Professor Keith Nelson (Massachusetts Institute of Technology), to our labs here at QSIB. We all enjoyed many… | John Rogers (https://www.linkedin.com/posts/profjohnarogers_it-was-wonderful-to-have-a-chance-yesterday-activity-7249777439483047937-q_cA)\nciteturn41119view0 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"turn41118search3\",\"pattern\":\"my PhD advisor\"}); Total lines: 105\nL20: It was wonderful to have a chance yesterday to host a visit of my PhD advisor, Professor Keith Nelson (【12†Massachusetts Institute of Technology】), to our labs here at QSIB.","Rogers 第一人称明确 Keith Nelson 是其 PhD advisor。"],["r","post","Special moments with special people – Barbara Whitesides, George Whitesides and Ralph Nuzzo on the porch of the Whitesides home near Cambridge, Massachusetts. Yesterday I flew to Boston and back… | John Rogers (https://www.linkedin.com/posts/profjohnarogers_special-moments-with-special-people-barbara-activity-7339257930715697152-c4yL)\nciteturn41117view0 [wordlim: 200] Crawled: 3 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"turn41116search0\",\"pattern\":\"my postdoctoral advisor\"}); Total lines: 140\nserving as my postdoctoral advisor during my two years as a Junior Fellow in the 【15†Harvard University】 Society of Fellows from 1995-1997","Rogers 署名回顾具名 Whitesides 为 1995–1997 Harvard 博后导师。"],["r","post2","Check out our paper on skin-interfaced microfluidic devices for colorimetric evaluation of ketones in sweat, published this week in Lab on a Chip. The key findings are that simple, commercial assays… | John Rogers (https://www.linkedin.com/posts/profjohnarogers_check-out-our-paper-on-skin-interfaced-microfluidic-activity-7237877619466063872-zkPb)\nciteturn41117view1 [wordlim: 200] Crawled: 4 months ago; Content type: text/html; Source: find({\"ref_id\":\"turn41116search3\",\"pattern\":\"my postdoctoral advisor\"}); Total lines: 184\nL24: This paper represents our contribution to a cross journal themed collection dedicated to the 85th birthday of 【22†George Whitesides】, my postdoctoral advisor, ","Rogers 在 RSC 论文献辞说明中再次具名其博士后导师。"],["r","nel","The Keith Nelson Group - Former Group Members (https://web.mit.edu/nelsongroup/thegroup/_formergroupmembers.shtml)\nciteturn41127view0 [wordlim: 200] Crawled: last week; Content type: text/html; Source: find({\"ref_id\":\"turn41121view1\",\"pattern\":\"John Rogers\"}); Total lines: 170\nL108: John Rogers\nL109: Ph.D. 1995","MIT Nelson 组名录核 John Rogers 1995 博士。"],["r","sig","John A. Rogers (https://www.sigmaxi.org/programs/prizes-awards/william-procter/award-winner/john-a.-rogers)\nciteturn41127view1 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"turn41125search0\",\"pattern\":\"Nelson\"}); Total lines: 362\nL286: Rogers is on the faculty at Northwestern University, where he is the Louis Simpson and Kimberly Querrey Professor of Materials Science and Engineering, Biomedical Engineering and Neurological Surgery, with affiliate appointments in Mechanical Engineering, Electrical and Computer Engineering and Chemistry. He obtained BA and BS degrees in chemistry and in physics from the University of Texas, Austin, in 1989.  From MIT, he received SM degrees in physics and in chemistry in 1992 and the PhD degree in physical chemistry in 1995, under the mentorhip of Prof.\nL287: K.A. Nelson in research on ultrafast laser systems and spectroscopic methods.  From 1995 to 1997, Rogers was a Junior Fellow in the Harvard University Society of Fellows, working with Prof. G.M.","Sigma Xi 颁奖档核 MIT 博士 Nelson 指导及 Harvard Junior Fellow。"],["r","nwm","Rogers, John | Faculty | Northwestern Engineering (https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/rogers-john.html)\nciteturn41136view2 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"turn41119view1\",\"pattern\":\"Physical Chemistry\"}); Total lines: 200\nL111: Louis Simpson and Kimberly Querrey Professor of Materials Science and Engineering, Biomedical Engineering and Neurological Surgery (and by courtesy Electrical and Computer Engineering, Mechanical Engineering, Chemistry and Dermatology)\nL139: 【52†Materials Science and Engineering】\nL150: Ph.D. in Physical Chemistry, Massachusetts Institute of Technology (MIT), Cambridge, Massachusetts","Northwestern 工程院本人档核现任及 MIT Physical Chemistry PhD。"],["r","gmw","Harvard Whitesides Research Group Alumni, row 482\nJohn Rogers | Postdoctoral Fellow | 9/1/1995-8/31/1997","Harvard Whitesides 组名录列 John Rogers 1995-09-01 至 1997-08-31 博后。"],["o","teria","Eminent Scientist Teri Odom Talks about Her Journey to the Brilliant Science of Thinking Small - inChemistry (https://inchemistry.acs.org/acs-and-you/eminent-scientist-teri-odom.html)\nciteturn41130view0 [wordlim: 200] Crawled: 6 days ago; Content type: text/html; Source: find({\"ref_id\":\"turn41129search0\",\"pattern\":\"Lieber\"}); Total lines: 64\nShe went on to earn a Ph.D. in chemical physics from Harvard University in 2001 under the guidance of Charles M. Lieber. ","ACS 采访原页明确 Odom 在 Lieber 指导下获 2001 Harvard 化学物理博士。"],["o","teric","TERI W. ODOM  (https://www.odomgroup.northwestern.edu/wp-content/uploads/2020/04/Odom-CV-April-2020.pdf)\nciteturn41128view2 [wordlim: 200] Crawled: 1.4 years ago; Content type: application/pdf; Source: open({\"ref_id\":\"turn41127view2\",\"lineno\":40}); Total lines: 3599\nL37: 2002 – 2007  Assistant Professor of Chemistry, Northwestern University\nL38: 2001\nL39:  Postdoctoral Fellow, Harvard University\nL40: 2001\nL41:  Ph.D. Chemical Physics, Harvard University","Teri Odom 本人 CV 分列 2001 Harvard 化学物理博士与 Harvard 博后。"],["o","gmw","Harvard Whitesides Research Group Alumni, row 435\nTeri Odom | Postdoctoral Fellow | 12/1/2000-11/30/2002","Whitesides 组名录核 Teri Odom 的 2000 年末至 2002 年博后组属。"],["g","gmw","Harvard Whitesides Research Group Alumni, row 231\nDavid Gracias | Postdoctoral Fellow | 6/1/1999-5/31/2002","Whitesides 组名录核 David Gracias 的 Harvard 1999–2002 博后组属。"],["g","dg","People – Gracias Laboratory (https://graciaslab.johnshopkins.edu/people/)\nciteturn41134view1 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"turn41133view1\",\"pattern\":\"Somorjai\"}); Total lines: 657\nL15: Prof. Gracias has a primary appointment in the Johns Hopkins School of Engineering, and secondary appointments in Johns Hopkins Medicine and the School of Arts and Sciences. His academic training includes undergraduate studies at the highly selective Indian Institute of Technology (IIT), a Ph.D. from UC Berkeley, and a post-doctoral fellowship at Harvard University in the labs of two scientific greats, Gabor Somorjai and George Whitesides, respectively.","本人组页区分博士与博后在 Somorjai 和 Whitesides 两组。"],["ar","arit","Josephson Junction Arrays (https://research.utwente.nl/files/277802637/thesis_Ariando.pdf)\nciteturn41128view3 [wordlim: 200] Crawled: 1.1 years ago; Content type: application/pdf; Source: open({\"ref_id\":\"turn41097view0\",\"lineno\":44}); Total lines: 6766\nL39: in het openbaar te verdedigen\nL40: op donderdag 12 Mei 2005 om 15.00 uur\nL42: Ariando\nL47: prof.dr. H. Rogalla\nL48: prof.dr. H. Hilgenkamp","Twente 论文扉页具名两位 Promotor。"],["ar","ari","Ariando, Deputy Head (Research & Graduate Studies), Provost’s Chair Professor (2024-2027) | NUS Physics (https://www.physics.nus.edu.sg/faculty/ariando/)\nciteturn41134view0 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"turn41133view0\",\"pattern\":\"Twente\"}); Total lines: 154\nL117: PhD, University of Twente, The Netherlands (2005)","NUS 物理系原档确认 Twente 2005 学位。"],["ar","arip","The Rise of A New Superconducting Era \"The Nickel Age\" - NEW DATE - ALBA Synchrotron (https://www.cells.es/en/public/events/the-rise-of-a-new-superconducting-era-the-nickel-age)\nciteturn41128view0 [wordlim: 200] Crawled: last month; Content type: text/html; Source: open({\"ref_id\":\"turn41103search1\",\"lineno\":null}); Total lines: 159\nL112: He then took a post-doctoral position under the Dutch Nanoscience Research Network (NanoNed) and joined the National University of Singapore as a Faculty member in 2008.","ALBA 讲者档列 NanoNed 博后和 2008 NUS 入职。"],["n","nur","CURRICULUM VITAE UPDATE: 1987-1996 (https://vivo.brown.edu/docs/drrb/1106970197.pdf)\nciteturn41128view1 [wordlim: 200] Crawled: 13.6 years ago; Content type: application/pdf; Source: open({\"ref_id\":\"turn41101view0\",\"lineno\":18}); Total lines: 975\nL2: Arto Veikko Nurmikko\nL14: Professional Experience\nL15: - Postdoctoral Fellow, Physics Department, Hebrew University of Jerusalem,\nL16: - Research Associate, Electrical Engineering Department, M.I.T., 1972-1975.","Nurmikko 本人旧 CV 分列 Hebrew University 博后与 MIT Research Associate。"],["n","nurb","Nurmikko, Arto (https://vivo.brown.edu/display/anurmikk)\nciteturn41136view0 [wordlim: 200] Crawled: yesterday; Content type: text/html; Source: find({\"ref_id\":\"turn41100search1\",\"pattern\":\"postdoctoral work\"}); Total lines: 381\nL14: Arto V. Nurmikko, a native of Finland, is a L. Herbert Ballou University Professor of Engineering and Physics at Brown. He recived his degrees from University of California, Berkeley, and did postdoctoral work at the Hebrew University (Jerusalem) and MIT. Professor Nurmikko conducts research in neuroengineering, photonics, microelectronics, nanosciences, and the translation of device research to new technologies in physical and life science applications.","Brown 现行本人档确认工程和物理任职、两段博后研究经历及方向。"],["c","gmw","Harvard Whitesides Research Group Alumni, row 149\nThomas Clark | Postdoctoral Fellow | 10/1/1998 - 9/30/2001","组名录中的同名 Thomas Clark 任期与本人的 NRL 和 Dorsal 履历重叠，作为身份待查。"],["c","cl","Thomas Clark | College of Engineering | Michigan State University (https://engineering.msu.edu/directory/faculty/trclark)\nciteturn41123view0 [wordlim: 200] Crawled: 4 days ago; Content type: text/html; Source: find({\"ref_id\":\"turn41122view0\",\"pattern\":\"Naval Research Laboratory\"}); Total lines: 64\nL28: His principal technology areas include millimeter wave and microwave photonic systems and photonic integrated circuits for microwave photonics with an emphasis on efficiently realizing agile, reconfigurable and multifunctional systems. Additional interests are creating enabling subsystems for emerging applications such as quantum computing and sensing, and autonomy and artificial intelligence.\nL30: Dr. Clark was previously a member of the Principal Professional Staff at The Johns Hopkins University Applied Physics Laboratory from 2003 to 2024. During this time he was in the Air and Missile Defense Sector and served on the leadership team from 2012 to 2024 as the Program Area Manager for Advanced Concepts, the Supervisor of the Optics and Photonics Group and the Supervisor of the Microwave and Millimeter Wave Photonics Section.\nL31: He has also worked in government, at the Naval Research Laboratory, and in the telecommunications industry at a start-up company prior to joining the Johns Hopkins University Applied Physics Laboratory in 2003.\nL37:   * Ph.D. University of Maryland College Park, 1998","MSU 院系原档核 Thomas R. Clark 的 Maryland 博士、NRL 与 JHU APL 履历。"],["c","clp","untitled (https://web.ece.ucsb.edu/Faculty/Klamkin/Klamkin_MP_Paper_6.pdf)\nciteturn41125view0 [wordlim: 200] Crawled: 2 weeks ago; Content type: application/pdf; Number of pages: 7; Source: find({\"ref_id\":\"turn41124view0\",\"pattern\":\"Research Physicist\"}); Total lines: 492\nL457@P6: MD, USA. From 1998 to 2000, he was a Research Physicist in the Optical\nL458@P6: Sciences Division at the Naval Research Laboratory, Washington, DC, USA,\nL459@P6: where his research interests include the fields of low-noise lasers and microwave\nL460@P6: photonics. In 2000, he joined the venture-backed Dorsal Networks, Columbia,","本人作者传记列 1998–2000 NRL Research Physicist 及 2000 Dorsal Networks。"],["b","br","Annalisa Bruno | Energy Research Institute @ NTU | NTU Singapore (https://www.ntu.edu.sg/erian/about-us/our-people/cluster-directors/annalisa-bruno)\nciteturn41134view3 [wordlim: 200] Crawled: 5 days ago; Content type: text/html; Source: find({\"ref_id\":\"turn41133view3\",\"pattern\":\"Imperial College\"}); Total lines: 167\nL125: Annalisa Bruno is an Associate Professor at the School of Physical and Mathematical Sciences (SPMS) and Materials Science and Engineering (MSE) at Nanyang Technological University.\nL126: Previously, she held positions as principal scientist at the ERI@N, tenured senior scientist at ENEA (Italian National Agency for New Technologies, Energy and Sustainable Economic Development), and post-doctoral researcher at Imperial College London. Annalisa Bruno obtained Bachelor of Science (B.Sc.), Master of Science (M.Sc.), and Doctor of Philosophy (Ph.D.) degrees in Physics at the University of Naples Federico II, Italy.","NTU ERI 记录 Annalisa Bruno 的 Naples 物理博士、Imperial 博后及 NTU 双院系。"],["b","brc","**Breve biografia:** (https://www3.ntu.edu.sg/CorpComms2/Documents/2020/07_Jul/Consul%20Press_270720_solar.pdf)\nciteturn41135view1 [wordlim: 200] Crawled: 6.3 years ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn41132view1\",\"pattern\":\"Breve biografia\"}); Total lines: 55\nL49: Breve biografia: La dottoressa Annalisa Bruno è ricercatrice Senior presso l’Energy Research Institute. Laureata in Fisica con lode e tesi pubblicata, con il dottorato ‘Fisica fondamentale ed applicata’ presso l’Università di Napoli Federico II, dove ha anche lavorato come ricercatrice presso il Dipartimento di Ingegneria Chimica. Successivamente ha lavorato come ricercatrice al dipartimento di Chimica dell’Imperial College London.","NTU 托管领馆履历核 Naples 化工和 Imperial 化学研究顺序。"],["b","brp","Triplet Formation in Fullerene Multi‐Adduct Blends for Organic Solar Cells and Its Influence on Device Performance - Dyer‐Smith - 2010 - Advanced Functional Materials - Wiley Online Library (https://advanced.onlinelibrary.wiley.com/doi/10.1002/adfm.201000477)\nciteturn41132view2 [wordlim: 200] Crawled: last month; Content type: text/html; Source: open({\"ref_id\":\"turn41129search4\",\"lineno\":null}); Total lines: 467\nL49: Annalisa Bruno\nL51: Department of Chemistry, Imperial College London, South Kensington Campus, London, SW7 2AZ (UK)\nL64: Saif A. Haque\nL66: Department of Chemistry, Imperial College London, South Kensington Campus, London, SW7 2AZ (UK)","2010 Wiley 原页列 Bruno 和 Haque 同署 Imperial 化学系，支持候选追查。"],["b","haq","Saif Haque | About | Imperial College London (https://profiles.imperial.ac.uk/s.a.haque)\nciteturn41136view1 [wordlim: 200] Crawled: 2 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"turn41135search0\",\"pattern\":\"Professor of Chemistry\"}); Total lines: 84\nL5: Professor of Chemistry\nL46: Saif Haque is a Professor of Chemistry at Imperial College London. He is a physical chemist with a particular interest in nanomaterials, molecular electronic materials and photochemistry. His group's research activities include the function and development of solar cells based upon liquid processable hybrid inorganic / organic semiconducting materials and all-inorganic structures.","Imperial 官方档核 Saif Haque 化学及杂化半导体光伏研究。"]].map(([id,key,raw,excerpt])=>({record_id:({r,o,g,ar,n,c,b})[id],url:u[key],raw,excerpt}));
pages.push({record_id:o,url:u.teriI,error:'IUPAC 2001 prize page returned HTTP 403; ACS interview and Odom CV directly read.'},{record_id:b,url:u.brt,error:'Imperial dissertation repository original entry returned cache miss; no supervisor relation inferred.'});
const exclusions=[{page_id:'260110538bef1e1b98ca1f95',record_id:ar,audit_id:arEvent,url:u.arid,external_subject:'David Joseph Ariando（University of Florida 2022 电气与计算机工程博士）',evidence:aMismatch}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length,exclusions:exclusions.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2306_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2306_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const ex='20261110_2306_Ariando网页归属纠偏.json';
persist(ex,exclusions);
call('人物网页身份纠偏.cjs',[ex]);
const receipt='20261110_2306_Rogers自述与Harvard组原档网页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
