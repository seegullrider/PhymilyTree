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
 orig.audit_id='pi_archive_20261110_2348_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2348_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"pap":"https://physics.mit.edu/research/pappalardo-fellowships-in-physics/","ann":"https://physics.mit.edu/wp-content/uploads/2021/01/physicsatmit_10_pappa10th.pdf","dcv":"https://live-sas-physics.pantheon.sas.upenn.edu/sites/default/files/2012_cv_drndic_marija.pdf","dhar":"https://www.physics.harvard.edu/academics/phds1971-2000","dp":"https://penntoday.upenn.edu/news/beyond-topological-insulators","dl":"https://web.sas.upenn.edu/drndicgroup/","db":"https://nanocluster.mit.edu/publications","um":"https://physics.mit.edu/research/pappalardo-fellowships-in-physics/aviram-uri/","ug":"https://jarillo-herrero.mit.edu/team/","up":"https://phy.princeton.edu/people/aviram-uri","ua":"https://www.princeton.edu/news/2025/01/22/board-approves-2-new-faculty-appointments","uz":"https://www.weizmann.ac.il/wsos/sites/feinberg/files/uploads/files/feinberg-e-2020-march.pdf","yc":"https://www.afylab.com/s/Full_CV_and_Publist.pdf","ya":"https://physics.mit.edu/news/faculty-highlight-raymond-ashoori/","yn":"https://news.mit.edu/2015/probing-graphene-physics-javier-sanchez-yamagishi-0519","yi":"https://www.sciencenews.org/article/andrea-young-sn-10-scientists-to-watch","yu":"https://science.ucsb.edu/people/andrea-young","gc":"https://chronicle.uchicago.edu/040429/sloan.shtml","go":"https://physics.osu.edu/people/gruzberg.1","gk":"https://www.on.kitp.ucsb.edu/online/hydrot00/si-directory.html","fc":"https://fogler.physics.ucsd.edu/Fogler.htm","f8":"https://www.ias.edu/sites/default/files/library/pdfs/ar/reportforacademi1998inst.pdf","f9":"https://www.ias.edu/sites/default/files/library/pdfs/ar/reportforacademic1999inst.pdf"};
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

const [d,r,y,g,f]=['c05717d1','c45a1199','7e327ad5','1d1e873d','88a1529a'];
const [k,w,b,z,j,ash]=['c6a09de1','1f1887f8','c8ddd180',null,'0eae5986','19e85b35'].map(id=>id?records.get(id).filename:'师承人物 - Eli Zeldov');
const kast=records.get('65a0d30e').filename;
const dName='Marija Drndić',rName='Aviram Uri',yName='Andrea Young';
const forward='博士后课题组负责人',reverse='博士后课题组成员';
const dp='本人 CV 在 MIT 2000–2003 博士后研究条目中明列 2000 年 8–11 月在 Wolfgang Ketterle 组研究一维玻色–爱因斯坦凝聚。关系类型可信度高（组属）。该条未列正式个人导师职衔。';
const dc='本人 CV 明列 2000 年 11 月至 2003 年 7 月与 MIT 物理系 Marc Kastner 及化学系 Moungi Bawendi 合作研究纳米晶和电输运，组论文清单佐证合作。正式指导关系仍待核，保留低可信候选。';
const dph='Penn 托管本人 CV 明列 1996–2000 Harvard 博士研究 Adviser Robert M. Westervelt，Harvard 博士论文名录列同一人。';
const dl=src(['Penn 托管本人 CV，第 1–2 页','dcv'],['MIT Pappalardo 项目档','pap']);
const dcl=dl+' · '+src(['Bawendi 原组论文表','db']);
edge(d,dName,k,'Wolfgang Ketterle',forward,reverse,dp,dl);
for(const [mentor,name] of [[kast,'Marc A. Kastner'],[b,'Moungi G. Bawendi']]){
 const line='- '+who(d,dName)+' → 博士后导师候选：'+wiki(mentor,name)+'。'+dc+' '+dcl;
 rewrite(path.join(root,'师承候选线索索引.md'),x=>x.startsWith('- '+who(d,dName)+' →')&&x.includes(mentor),()=>line);
 rewrite(pf(d),x=>x.startsWith('- 博士后导师候选：')&&x.includes(mentor),()=>'- 博士后导师候选：'+wiki(mentor,name)+'。'+dc+' '+dcl);
 rewrite(mf(mentor),x=>x.startsWith('- 博士后候选关联人物：')&&x.includes(records.get(d).filename),()=>'- 博士后候选关联人物：'+who(d,dName)+'。'+dc+' '+dcl);
}
rewrite(pf(d),x=>x.startsWith(boundary),()=>boundary+' '+dph+' CV 同期把与 Tinkham 组及 Robert Westervelt 的活动分别标为合作。博士后条目明确 Ketterle 组与 Kastner、Bawendi 合作，正式博后指导职衔待核。 '+dcl);
pl(d,'- 研究方向：','Penn 原档核纳米结构、原子级薄器件与纳米孔。 '+src(['Penn Today','dp']));
cell(d,3,'MIT Pappalardo Fellow 2000–2003；Wolfgang Ketterle（2000 年 8–11 月博士后课题组负责人）；Marc A. Kastner、Moungi G. Bawendi（2000 年 11 月至 2003 年 7 月合作候选）');
cell(d,4,src(['Penn 托管本人 CV','dcv'],['Harvard 博士名录','dhar'],['MIT Pappalardo 原档','pap'],['Bawendi 实验室论文表','db'],['Penn 院系与研究','dp']));
const da=audit(d,[a('phd',dph,['dcv','dhar']),a('postdoc',dp+' '+dc,['dcv','pap','db'],'group_or_candidate'),a('affiliation','Penn 物理与天文学系 Langberg 讲席。',['dp']),a('research','实验纳米结构、原子级薄器件、纳米孔与二维磁性材料。',['dp','dcv'])],'继续追 MIT 任用原档和与各合作组的个人正式指导职衔。');
relation(d,da,'postdoc',k,'group_leader',dp,ids('dcv','pap'),'Ketterle');
relation(d,da,'postdoc',kast,'candidate',dc,ids('dcv','pap','db'),'Kastner');
relation(d,da,'postdoc',b,'candidate',dc,ids('dcv','pap','db'),'Bawendi');

const rd='MIT Pappalardo 个人履历明确 MSc 和 PhD 均由 Eli Zeldov 指导；Princeton 原系档列 2021 Weizmann 博士。关系类型可信度高。';
const rp='MIT 个人履历分列 2021–2023 CHE Fellow 与 2023–2025 Pappalardo Fellow，Jarillo-Herrero 组原校友名单在 Postdocs 下列 Uri。关系类型可信度高（组属），两阶段的正式个人指导职衔待核。';
const rdlinks=src(['MIT Pappalardo 个人履历','um'],['Weizmann 研究生院原档','uz'],['Princeton 物理系','up']);
const rplinks=src(['MIT 组博后校友名录','ug'],['MIT 博后项目个人原档','um']);
updateEdge(r,rName,z,'Eli Zeldov','博士导师','博士生','博士导师','博士生',rd,rdlinks);
for(const [file,oldLabel,match,label,link] of [
 [pf(r),'- 博士后阶段课题组负责人：',j,'- '+forward+'：',wiki(j,'Pablo Jarillo-Herrero')],
 [mf(j),'- '+reverse+'：',records.get(r).filename,'- '+reverse+'：',who(r,rName)],
 [index,'- '+who(r,rName)+' → 博士后课题组：',j,'- '+who(r,rName)+' → '+forward+'：',wiki(j,'Pablo Jarillo-Herrero')]
]){
 rewrite(file,x=>x.startsWith(oldLabel)&&x.includes(match),()=>label+link+'。'+rp+' '+rplinks);
}
rewrite(pf(r),x=>x.startsWith(boundary),()=>boundary+' Princeton 院系页仍留有 MIT 当前 fellow 的旧句；Princeton 董事会公告明确 2025 年 9 月加入物理系，MIT 组校友表已列 Princeton 物理助理教授。 '+src(['Princeton 2025 任用公告','ua'],['Princeton 物理系','up'],['MIT 组博后校友名录','ug']));
cell(r,3,'Pablo Jarillo-Herrero（MIT 博士后课题组负责人）；CHE Fellow 2021–2023，Pappalardo Fellow 2023–2025，正式指导职衔待核');
schoolWith(r,rdlinks+' · '+rplinks+' · '+src(['Princeton 任用公告','ua']));
const ra=audit(r,[a('phd',rd,['um','uz','up']),a('postdoc',rp,['ug','um'],'group_or_candidate'),a('affiliation','Princeton 董事会公告明确 2025 年 9 月加入物理系；院系简介保留旧 MIT 任用句。',['ua','up','ug']),a('research','二维材料、拓扑量子相、输运及扫描纳米 SQUID 磁测量。',['up','um'])],'查 MIT 两段 fellowship 的任用指导字段，保留课题组关系。');
relation(r,ra,'phd',z,'advisor',rd,ids('um','uz','up'),'Zeldov');
relation(r,ra,'postdoc',j,'group_leader',rp,ids('ug','um'),'Jarillo');

const yp='MIT 同期校方报道明确 Young 为 Ashoori 组 Pappalardo Fellow，Ashoori 受访亦说 Young 在其组做博后。组属可信度高，正式导师职衔待核。';
const yj='MIT Jarillo-Herrero 组原名单在 Group Alumni → Postdocs 下列 Andrea Young（UC Santa Barbara 物理教授），与 MIT 同期校方记载的 Ashoori 组属并存。组属可信度高，具体组属日期与正式指导职衔待核。';
const yb='本人 CV 列 MIT Pappalardo Fellow 2012 年 1 月至 2014 年 12 月，MIT 项目届别列 2011–2014。Weizmann 2014 年 10 月至 2015 年 3 月是 Visiting Scientist，时间与 MIT 任用部分重叠。';
const yl=src(['MIT 同期原报道','yn'],['MIT Ashoori 组报道','ya'],['Ashoori 本人受访','yi'],['Andrea Young 本人 CV','yc']);
const yjl=src(['MIT Jarillo-Herrero 组博后校友表','ug'],['Andrea Young 本人 CV','yc']);
updateEdge(y,yName,ash,'Raymond Ashoori',forward,reverse,forward,reverse,yp,yl);
edge(y,yName,j,'Pablo Jarillo-Herrero',forward,reverse,yj,yjl);
rewrite(pf(y),x=>x.startsWith(boundary),()=>boundary+' '+yb+' '+src(['本人 CV','yc'],['MIT 项目档','pap']));
cell(y,3,'Raymond Ashoori、Pablo Jarillo-Herrero（MIT 博士后课题组负责人）；本人 CV 任用 2012–2014，Weizmann 为访问科学家');
schoolWith(y,yl+' · '+yjl+' · '+src(['UCSB 院系讲席','yu'],['MIT 项目档','pap']));
const ya=audit(y,[a('phd','本人 CV 明列 Columbia 2012 年物理博士 Thesis advisor Philip Kim。',['yc']),a('postdoc',yp+' '+yj+' '+yb,['yn','ya','yi','ug','yc','pap'],'group_or_candidate'),a('affiliation','UCSB 物理系实验物理 Worster 讲席。',['yu','yc']),a('research','二维与范德华材料及拓扑量子输运。',['yc','yn'])],'查 MIT 博后两组具体时间和个人指导任用文件，保留两组出处。');
relation(y,ya,'postdoc',ash,'group_leader',yp,ids('yn','ya','yi','yc'),'Ashoori');
relation(y,ya,'postdoc',j,'group_leader',yj,ids('ug','yc'),'Jarillo');

const gp='UChicago 2004 原档明确 Yale 1998 博士之后在 UC Santa Barbara 做博士后，随后为 MIT Pappalardo Fellow，2002 年加入 Chicago。MIT 项目十周年刊载 2001–2002，并载 Gruzberg 本人回忆做了一年。两段指导人待查。';
const gl=src(['UChicago 2004 机构履历','gc'],['MIT 项目十周年本人回忆','ann']);
pl(g,boundary,gp+' '+gl);
cell(g,3,'UC Santa Barbara ITP 博后；MIT Pappalardo 2001–2002；两段个人指导待核');
schoolWith(g,gl);
audit(g,[a('postdoc',gp,['gc','ann'],'unresolved'),a('affiliation','Ohio State 物理系教授。',['go']),a('research','经典统计和凝聚态物理、无序系统与量子霍尔跃迁。',['go'])],'追 UCSB ITP 博后任用及 MIT fellowship 的个人指导档案。旧 ITP 目录本次 502，暂不复发。');

const fp='IAS 1998 与 1999 年报均具名列 Fogler 为自然科学学院成员，佐证本人 1997–2000 IAS 博后。MIT 项目 2000–2003 与本人 2000–2002 的终年差异保留，个人指导待查。';
const fl=src(['IAS 1998 年报','f8'],['IAS 1999 年报','f9'],['Fogler 本人履历','fc'],['MIT 十周年原档','ann']);
pl(f,boundary,fp+' '+fl);
cell(f,3,'IAS 1997–2000 Postdoctoral Member；MIT Pappalardo 2000–2002（本人）／2000–2003（项目原档）；个人指导待核');
schoolWith(f,fl);
audit(f,[a('postdoc',fp,['fc','f8','f9','ann'],'unresolved'),a('affiliation','UC San Diego 物理系。',['fc']),a('research','凝聚态理论，量子霍尔效应和低维电子系统。',['fc'])],'追 IAS 两段原任用材料及 MIT 项目个人指导档案；保留两种 MIT 终年。');

const pages=[
 [d,'dcv','Penn-hosted CV places work in the Ketterle group in August–November 2000 and separately dates collaboration with Kastner and Bawendi.',dp+' '+dc],
 [d,'dp','Penn identifies Drndić as Langberg Professor of Physics in Physics and Astronomy and describes atomically thin devices and nanopores.','Penn 院系与方向原档。'],
 [r,'um','MIT Pappalardo individual profile explicitly identifies Eli Zeldov as MSc and PhD supervisor and describes the fellowships.',rd+' '+rp],
 [r,'ug','MIT Jarillo-Herrero lab lists Uri under Group Alumni, Postdocs, at Princeton.',rp],
 [r,'up','Princeton Physics names Aviram Uri assistant professor, Weizmann PhD 2021, and scanning nano-SQUID magnetometry.',rd],
 [r,'ua','Princeton Board announcement dates entry to Physics faculty September 2025.','Princeton 校方日期。'],
 [y,'yc','Young CV lists Columbia 2012 thesis advisor Philip Kim, Pappalardo fellowship Jan 2012–Dec 2014, Weizmann Visiting Scientist Oct 2014–Mar 2015.',yb],
 [y,'ug','Jarillo-Herrero MIT Group Alumni, Postdocs, lists Andrea Young as UCSB Physics professor.',yj],
 [y,'yn','MIT News identifies Andrea Young and Ben Hunt as from Raymond Ashoori’s group.',yp],
 [y,'yi','Raymond Ashoori recalls Andrea Young’s time as a postdoc in his laboratory.',yp],
 [y,'yu','UCSB appoints Young as Worster Professor of Experimental Physics.','UCSB 实验物理院系讲席。'],
 [g,'gc','2004 UChicago report explicitly lists UCSB postdoctoral assignment before MIT Pappalardo and the 2002 Chicago faculty appointment.',gp],
 [g,'ann','MIT annual gives Gruzberg 2001–2002 and quotes him describing one year as a fellow.',gp],
 [g,'go','OSU Physics identifies Gruzberg as professor and describes disordered systems and quantum Hall transition research.','核 Ohio State 物理系及方向。'],
 [f,'f8','1998 IAS annual reports Michael Fogler, School of Natural Sciences.',fp],
 [f,'f9','1999 IAS annual lists Michael Fogler under School of Natural Sciences Members and Visitors.',fp],
 [f,'ann','MIT Physics annual anniversary list identifies Michael M. Fogler, 2000–2003 fellow.',fp]
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:d,url:u.dl,error:'HTTP 502 Bad Gateway'}, {record_id:g,url:u.gk,error:'HTTP 502 Bad Gateway'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2348_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2348_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2348_Pappalardo与IAS原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
