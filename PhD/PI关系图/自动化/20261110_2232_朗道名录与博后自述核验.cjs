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
 orig.audit_id='pi_archive_20261110_2232_'+id;
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
 relations.push({event_id:'pi_archive_20261110_2232_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"wland":"https://www.itp.ac.ru/ru/dissertation-council/thesis/","wbim":"https://www.bimsa.cn/detail/wiegmann.html","wuw":"https://www.washington.edu/regents/meetings/2010/september/items/acad/a-4.pdf","wpme":"https://pme.uchicago.edu/directory/pavel-wiegmann","kacs":"https://www.pittsburghacs.org/wp-content/uploads/2011/10/cruc_sep02.pdf","kps":"https://www.psu.edu/news/eberly-college-science/story/christine-keating-named-shapiro-professor-chemistry","kco":"https://pure.psu.edu/en/publications/protein-colloid-conjugates-for-surface-enhanced-raman-scattering-/","kw":"https://www.worldcat.org/oclc/299212522","kpw":"https://www.chemistry.ucla.edu/directory/weiss-paul-s/","dw":"https://wuli.iphy.ac.cn/cn/article/pdf/preview/10.7693/wl20150807.pdf","dh":"https://physics.hkust.edu.hk/people/xi-dai-daixi","dn":"https://physics.hkust.edu.hk/people/tai-kai-ng-wudaqi","db":"https://www.bc.edu/bc-web/offices/its/services/research-services/linux-cluster.html","dr":"https://cmt.rutgers.edu/alumni/","jla":"https://www.lassp.cornell.edu/people/chao-ming-jian","jc":"https://www.kitp.ucsb.edu/news/directors-letter-fall-2016","jcf":"https://www.kitp.ucsb.edu/news/directors-letter-fall-2019","jts":"https://www.tsinghua.edu.cn/info/1175/109734.htm","jts2":"https://www.tsinghua.org.cn/info/1014/42476.htm","jp":"https://arxiv.org/pdf/1710.04668","qw":"https://onlinelibrary.wiley.com/doi/10.1002/pssb.201300005","qpub":"https://d3qi0qp55mx5f5.cloudfront.net/physics/docs/PubList15.pdf?mtime=1762462564","qr":"https://cmt.rutgers.edu/alumni/","ke":"https://assumption.academia.edu/CKeating/CurriculumVitae","ka":"https://search.worldcat.org/en/title/299212522","sr":"https://www.fizmathim.com/mikroskopicheskie-raschety-dinamiki-reshetki-kristallov","sl":"https://cat.gpntb.ru/?id=EC%2FShowFull&irbDb=KATBW&mfn=1224837","qa":"https://harvest.aps.org/v2/journals/articles/10.1103/PhysRevB.44.4727/fulltext"};
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




const [w,k,d,j,q]=['4866a956','481ac589','b34b07a7','488c6abc','5c87b7d6'];
const wName='Pavel Wiegmann',kName='Christine Keating',dName='Xi Dai',jName='Chao-Ming Jian',qName='Qimiao Si';
const larkin='师承人物 - Anatoly Larkin',natan='师承人物 - Michael J. Natan',weiss=records.get('8f1a80f1').filename,kot=records.get('1c24065f').filename,ng='师承人物 - Tai-Kai Ng',wang='师承人物 - Ziqiang Wang',su='师承人物 - 苏肇冰',lev=records.get('2b43ee19').filename;
const ids=(...keys)=>keys.map(x=>u[x]);
const add=(id,event,stage,teacher,kind,evidence,suffix,...keys)=>relation(id,event,stage,teacher,kind,evidence,ids(...keys),suffix);
const bounds=(id,note,links)=>rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+note+' '+links);

const wD='朗道理论物理研究所答辩名录在 Pavel Borisovich Wiegmann 1978 年副博士论文《Некоторые особенности фазовых переходов в системах с низкой размерностью》（低维系统中相变的若干特征）下列 научный руководитель Ларкин А.И.。华盛顿大学校董会档案将同一学位列为 1978 年朗道所 PhD。关系可信度高。';
const wL=src(['朗道所答辩名录','wland'],['UW 校董会任用原档','wuw'],['BIMSA 本人简介','wbim']);
edge(w,wName,larkin,'Anatoly I. Larkin','博士导师','博士生',wD,wL);
const wP='1983 年另获 Doctor of Sciences，题为《Микроскопическая теория магнитных сплавов》（磁性合金的微观理论）。BIMSA 记后续 Landau 高级研究、1990–1992 Princeton 与 IAS 相近研究岗位，UW 任用档另列 2010 访问教授。已核资料中的独立博后任用及导师待人事原档。';
bounds(w,wP,wL);
cell(w,2,'Anatoly I. Larkin（朗道所 1978 博士论文导师）；1983 高等博士学位另列');
cell(w,3,'Landau 高级研究岗位；Princeton／IAS 1990–1992 研究岗位；独立博士后任用待核');
schoolWith(w,wL+' · '+src(['Chicago PME 目录','wpme']));
const wa=audit(w,[a('phd',wD,['wland','wuw','wbim'],'confirmed_advisor'),a('postdoc',wP,['wland','wbim','wuw'],'unresolved'),a('affiliation','Chicago Reneker Distinguished Service Professor of Physics；PME 名录收录，物理及既有研究所关系。',['wpme','wbim'],'confirmed'),a('research','拓扑凝聚态、低维量子多体、量子场论与可积模型。',['wpme','wbim'],'confirmed')],'继续追 Landau 1978–1983、Princeton 与 IAS 的具体任命及是否有独立博后。');
add(w,wa,'phd',larkin,'advisor',wD,'larkin','wland','wuw','wbim');

const kId='Assumption College 的 Christine C. Keating 是英语兼职教师，其公开履历列意识与变革研究。Penn State 的 Christine Dolan Keating 于 1997 年取得化学博士，研究纳米粒子与胶体。机构、学科及学位记录均不同。';
const kD='2002 年 ACS Pittsburgh 讲座原册将 Keating 的 Penn State 研究生工作明确置于 Michael Natan 的实验室，博士前方向为金属纳米粒子与表面增强拉曼。该册研究生段拼作 Nathan、博后段作 Natan，Penn State 论文档核同人拼写 Michael J. Natan。博士论文正式导师字段待学位原卷，记博士课题组负责人。';
const kP='ACS Pittsburgh 2002 年讲座原册具名 Keating 获博士后在 Paul Weiss 与 Michael Natan 两个实验室任 postdoctoral associate。Penn State 原档列任期 1997–1999，1999–2001 Research Assistant Professor 另列。UCLA 履历核 Paul S. Weiss 当时在 Penn State。博士后组属可信度高，个人正式指导待任用档。';
const kL=src(['ACS Pittsburgh 同期讲座原档','kacs'],['Penn State 官方任用史','kps'],['Penn State 作者档','kco'],['UCLA Weiss 履历','kpw']);
mentor(natan,'Michael J. Natan','Penn State 化学研究组负责人，研究胶体金属纳米粒子、表面增强拉曼及光谱。',src(['ACS Pittsburgh 讲座档','kacs'],['Penn State 原论文书目','kco']));
edge(k,kName,natan,'Michael J. Natan','博士课题组负责人','博士阶段课题组成员',kD,kL);
edge(k,kName,natan,'Michael J. Natan','博士后课题组负责人','博士后课题组成员',kP,kL);
edge(k,kName,weiss,'Paul S. Weiss','博士后课题组负责人','博士后课题组成员',kP,kL);
bounds(k,'Penn State 1997 化学博士，1997–1999 博后，1999–2001 Research Assistant Professor。两阶段组属已核，博士签署页及博后具名指导任用待查。已核 Assumption College 英语教师与 Ohio State 性别研究学者为另有履历的同名者。',kL);
cell(k,2,'Michael J. Natan（博士课题组负责人，论文正式导师待核）');
cell(k,3,'Paul S. Weiss、Michael J. Natan（Penn State 1997–1999 博后课题组负责人）');
schoolWith(k,kL);
const ka=audit(k,[a('identity',kId,['ke','kps','kacs'],'confirmed'),a('phd',kD,['kacs','kps','kco'],'group_or_candidate'),a('postdoc',kP,['kacs','kps','kco','kpw'],'group_or_candidate'),a('affiliation','Penn State Shapiro Professor of Chemistry。',['kps'],'confirmed'),a('research','胶体与界面化学、软物质自组装和可重构光学纳米材料。',['kps','kacs'],'confirmed')],'查 Penn State 1997 年博士签署页与 1997–1999 博后任命文件，核正式指导称谓。');
add(k,ka,'phd',natan,'group_leader',kD,'natan_phd','kacs','kps','kco');
add(k,ka,'postdoc',natan,'group_leader',kP,'natan_post','kacs','kps','kco');
add(k,ka,'postdoc',weiss,'group_leader',kP,'weiss','kacs','kps','kpw');
const exclusions=[{page_id:'53e004cae2a666225c0d4982',url:u.ke,record_id:k,audit_id:ka,external_subject:'Christine C. Keating（Assumption College 英语兼职教师）',evidence:kId}];

const dD='戴希在《物理》署名自述具名三段博后合作导师。HKUST 第一段为吴大琪，Boston College 为汪自强，Rutgers 为 Gabriel Kotliar。HKUST 教师档、各导师单位原页及 Rutgers 历届博士后名单核对身份与阶段。关系可信度高。';
const dN='戴希在《物理》自述明确称吴大琪是 1999 年博士毕业后赴 HKUST 第一期博后的合作导师。HKUST 原档核吴大琪（Tai-Kai Ng）身份和凝聚态理论方向。关系可信度高。';
const dB='戴希在《物理》自述在 Boston College 工作大半年，由当段合作导师汪自强推荐赴 Rutgers。Boston College 原档核汪自强（Ziqiang Wang）及其强关联研究。关系可信度高。';
const dR='戴希在《物理》自述明确称 Rutgers 阶段合作导师 Kotliar，并记其分配研究课题。Rutgers CMT 名册确认戴希为历届博士后，李政道研究所原履历所列 2002–2004 时段沿用。关系可信度高。';
const dL=src(['戴希《物理》自述','dw'],['HKUST 教师档','dh'],['Rutgers CMT 名册','dr']);
const dNL=dL+' · '+src(['HKUST 吴大琪','dn']);
const dBL=dL+' · '+src(['Boston College 汪自强','db']);
mentor(ng,'吴大琪（Tai-Kai Ng）','HKUST 物理系荣休教授，研究凝聚态理论。',src(['HKUST 原档','dn']));
edge(d,dName,ng,'吴大琪（Tai-Kai Ng）','博士后导师','博士后研究者',dN,dNL);
edge(d,dName,wang,'汪自强（Ziqiang Wang）','博士后导师','博士后研究者',dB,dBL);
updateEdge(d,dName,kot,'Gabriel Kotliar','博士后导师候选','博士后候选研究者','博士后导师','博士后研究者',dR,dL);
const dPh='《物理》本人自述在理论物理所博士段直接称苏肇冰为导师，并记 1999 年初夏通过答辩。';
pl(d,'- 博士导师：',dPh+' '+src(['戴希《物理》自述','dw']));
line(index,x=>x.startsWith('- '+who(d,dName)+' → 博士导师：')&&x.includes(su),' '+dPh+' '+src(['戴希《物理》自述','dw']));
line(mf(su),x=>x.startsWith('- 博士生：')&&x.includes(records.get(d).filename),' '+dPh+' '+src(['戴希《物理》自述','dw']));
bounds(d,'博士为苏肇冰指导。HKUST、Boston College 与 Rutgers 三段博后均由本人具名。香港大学 Research Assistant Professor 及张富春合作分列为之后阶段。HKUST 原档列 2017 年入物理系，UCSB 校属条目存历史关联。',dL);
cell(d,3,'HKUST 1999–2001：吴大琪；Boston College 2001–2002：汪自强；Rutgers 2002–2004：Gabriel Kotliar（均为本人具名博后合作导师）');
schoolWith(d,dNL+' · '+src(['Boston College 汪自强','db']));
const da=audit(d,[a('phd',dPh,['dw','dh'],'confirmed_advisor'),a('postdoc',dD,['dw','dh','dn','db','dr'],'confirmed_advisor'),a('affiliation','HKUST 物理讲座教授、Senior Fellow，UCSB 原记录为历史关联。',['dh'],'confirmed'),a('research','强关联、量子磁性、超导与计算材料。',['dh','dw'],'confirmed')],'博士和三段博后导师均有本人具名记录。若取得学位签署及任用原册，可补三个岗位的起止月份。');
add(d,da,'postdoc',ng,'advisor',dN,'ng','dw','dh','dn');
add(d,da,'postdoc',wang,'advisor',dB,'wang','dw','dh','db');
add(d,da,'postdoc',kot,'advisor',dR,'kotliar','dw','dh','dr');

const jD='Cornell LASSP 履历核 2016 Stanford 物理博士、2015 KITP Graduate Fellow，另列 KITP Moore Fellow 2016–2017 及 2018–2019 和 Microsoft Station Q 博后 2017–2018、2019–2020。KITP 主任当期通讯核入站与后续去向。';
const jL=src(['Cornell LASSP 履历','jla'],['KITP 2016 原档','jc'],['KITP 2019 原档','jcf'],['清华校友档','jts']);
pl(j,boundary,jD+' 清华核中文姓名简超明。2017 作者原稿同列 KITP 和 Station Q 两个署名，区分署名和任用时段。 '+jL+' · '+src(['2017 作者原稿','jp']));
unit(j,jName,'Laboratory of Atomic and Solid State Physics','Cornell LASSP 人员档列物理系教师',src(['Cornell LASSP 人员档','jla']));
cell(j,1,'物理系、Laboratory of Atomic and Solid State Physics；强关联量子多体、量子临界和纠缠动力学');
cell(j,3,'KITP 2016–2017、2018–2019；Microsoft Station Q 2017–2018、2019–2020；两处个人导师待核');
schoolWith(j,jL);
audit(j,[a('identity','清华校友档与 Cornell 原履历核简超明、Stanford、Cornell。',['jts','jla'],'confirmed'),a('postdoc',jD,['jla','jc','jcf','jp'],'unresolved'),a('affiliation','Cornell 物理系及 LASSP。',['jla'],'confirmed'),a('research','强关联量子多体、拓扑量子态、量子临界和纠缠动力学。',['jla','jc'],'confirmed')],'追 Stanford 博士签署页或 Qi 具名校友档，分别追 KITP 与 Station Q 两段任用的个人指导。');

const qD='Levin 本人发表目录列 1991 年与 Si 合作，保留 Chicago 1991 博士导师候选 Kathryn Levin。共同论文支持同期合作；Chicago 学位和正式指导者待论文或人事原档。';
const qP='Si 2013 年署名文章的作者履历明确将 Rutgers 与 UIUC 两段博后合计列为 1991–1995，1995 年赴 Rice。Rutgers CMT 原名单独立核博后身份。Rice 1994 年获教职、1995 年实际赴任的分列日期保留。';
const qL=src(['Levin 本人出版目录','qpub'],['Si 本人作者履历','qw'],['Rutgers CMT 名册','qr']);
updateEdge(q,qName,lev,'Kathryn Levin','博士候选关系','博士候选研究者','博士候选关系','博士候选研究者',qD,qL);
pl(q,boundary,qP+' '+qL);
cell(q,2,'Kathryn Levin（博士导师候选；本人目录核 1991 年合作，博士论文指导待查）');
schoolWith(q,qL);
const qa=audit(q,[a('phd',qD,['qpub','qw'],'group_or_candidate'),a('postdoc',qP+' Rutgers 个人候选 Kotliar 沿用，UIUC 导师待核。',['qw','qr'],'group_or_candidate'),a('research','强关联电子和凝聚态统计物理。',['qw'],'confirmed')],'追 Chicago 1991 年论文和两段博后人事原档。');
add(q,qa,'phd',lev,'candidate',qD,'levin','qpub','qw');
const raw={"wland":"Диссертации, подготовленные или защищенные в ИТФ им. Л.Д. Ландау (https://www.itp.ac.ru/ru/dissertation-council/thesis/)\nciteturn41016view0 [wordlim: 200] Crawled: today; Content type: text/html; Source: open({\"ref_id\":\"turn41014view0\",\"lineno\":1119}); Total lines: 1391\nL1118:   * 【445†Вигман Павел Борисович】, «Некоторые особенности фазовых переходов в системах с низкой размерностью»\nL1119: Кандидатская диссертация, научный руководитель: Ларкин А.И., 01.04.02 — теоретическая физика\nL1120: Дата защиты: 1978 г.\nL1000:   * 【445†Вигман Павел Борисович】, «Микроскопическая теория магнитных сплавов»\nL1001: Докторская диссертация, 01.04.02 — теоретическая физика\nL1002: Дата защиты: 1983 г.","wbim":"Pavel Wiegmann - BIMSA (https://www.bimsa.cn/detail/wiegmann.html)\nciteturn41029view2 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"https://www.bimsa.cn/detail/wiegmann.html\",\"pattern\":\"PhD\"}); Total lines: 151\nL126: ### Biography\nL127: Pavel Wiegmann received his PhD and Habilitation from the Landau Institute of Theoretical Physics in Moscow, where he worked as a Senior Researcher until 1994. Between 1990 and 1992, he held a similar position at Princeton University and the Institute for Advanced Study before joining the faculty at the University of Chicago, where he currently holds the title of Distinguished Service Professor at the Kadanoff Center for Theoretical Physics.\nL128: In 2004, he was an invited speaker at the International Congress of Mathematicians in Madrid. He received the Humboldt Prize (also known as the Humboldt Research Award) in 2002 and became a Fellow of the American Physical Society in 2003. That same year, he held the Kramers Chair at the Spinoza Institute in Utrecht, Netherlands, and in 2006, he held the Chaire Internationale Blaise Pascal in Île-de-France.\nL129: He was named a Simons Foundation Fellow in 2015 and received the Onsager Prize from the American Physical Society in 2017.","wuw":"UNIVERSITY OF WASHINGTON (https://www.washington.edu/regents/meetings/2010/september/items/acad/a-4.pdf ; rewritten summary of https://www.washington.edu/regents/meetings/minutes/2010/9sept.pdf#page=32)\nciteturn41024view2 [wordlim: 200] Crawled: 16.1 years ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn41023search12\",\"pattern\":\"Wiegmann, Pavel B.\"}); Redirected to URL: https://www.washington.edu/regents/meetings/minutes/2010/9sept.pdf#page=32; Total lines: 6345\nL1140: Department of Physics\nL1141: Wiegmann, Pavel B.\nL1142: Visiting Professor, Physics, effective 9/20/2010\nL1143: Prior Non-UW Appointment:\nL1144: Professor, Physics, University of Chicago\nL1145: Degrees:\nL1146: • PhD, 1978, Landau Institute (Russia)\nL1147: • MA, 1975, Moscow Institute of Physics & Technology (Russia)","wpme":"Pavel Wiegmann | PME | The University of Chicago (https://pme.uchicago.edu/directory/pavel-wiegmann)\nciteturn41009view1 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"https://pme.uchicago.edu/directory/pavel-wiegmann\",\"pattern\":\"Wiegmann\"}); Total lines: 34\nL24: # Pavel Wiegmann\nL26: Robert W. Reneker Distinguished Service Professor of Physics, UChicago\nL28: ## Research and Scholarly Interests\nL30: Condensed Matter Physics\nL32: Topological Physics","kacs":"september.indd (https://www.pittsburghacs.org/wp-content/uploads/2011/10/cruc_sep02.pdf)\nciteturn41027view3 [wordlim: 200] Crawled: 4 months ago; Content type: application/pdf; Number of pages: 12; Source: find({\"ref_id\":\"https://www.pittsburghacs.org/wp-content/uploads/2011/10/cruc_sep02.pdf\",\"pattern\":\"Professors Paul Weiss\"}); Total lines: 731\nL68@P0-1: before August 30.Christine Keating received her B.S. in Chemistry and Biology from St. Francis College in 1991. She attended graduate school at Penn State\nL69@P1: University, working in the laboratory of Professor Michael Nathan studying the application of metal nanoparticles in biological spectroscopy, with\nL70@P1: particular emphasis on protein surface-enhanced Raman scattering. For her efforts in this area, Keating was the recipient of the 1996 Henkel Fel\u0002lowship in Colloid and Surface Chemistry. After earning her Ph.D. in Chemistry in 1997, she worked as a postdoctoral associate in the laboratories\nL71@P1: of Professors Paul Weiss and Michael Natan and held a brief fixed-term assistant professorship in the Department of Chemistry at Penn State before\nL72@P1: beginning her current tenure-track appointment in that department in 2001. She has co-authored over 20 publications. Her research interests\nL73@P1: include synthesis, characterization, and application of functional nanostructures, including directed self-assembly of nanoparticles, amphiphiles,\nL74@P1: and/or biomacromolecules to form structures ranging from sensor architectures to models of biological cells.\nL120@P2: Handbook. He has initiated and edits the NHMFL ICR/Ion Trap Newsletter. In addition, he serves on the editorial boards of International Journal\nL121@P2: of Mass Spectrometry, Journal of American Society for Mass Spectrometry Reviews, and Encyclopedia of Mass Spectrometry.\nL122@P2: Most mass analysis relies on “nominal”mass accuracy (i.e., to within 1 Da). However, an increasing number of applications are\nL123@P2: based on much more accurate mass measurement. The Figure shows that mass spectrometric resolution (defined here as the spacing\nL124@P2: between resolved peaks) does not increase monotonically with increasing spectrometer resolv\u0002ing power for electrosprayed biomolecules. Rather, resolution improves by a series of steps.\nL125@P2: First, one must resolve different charge states. No additional peaks appear until adducts are\nL126@P2: resolved, then not again until isotopic peaks are resolved (unit mass resolution), and finally","kps":"Christine Keating named Shapiro Professor of Chemistry | Penn State University (https://www.psu.edu/news/eberly-college-science/story/christine-keating-named-shapiro-professor-chemistry)\nciteturn41027view2 [wordlim: 200] Crawled: 3 weeks ago; Content type: text/html; Source: find({\"ref_id\":\"https://www.psu.edu/news/eberly-college-science/story/christine-keating-named-shapiro-professor-chemistry\",\"pattern\":\"postdoctoral\"}); Total lines: 30\nL6: UNIVERSITY PARK, Pa. — Christine Keating, distinguished professor of chemistry at Penn State, has been named the Shapiro Professor of Chemistry. The professorship encourages new levels of achievement among promising faculty and provides resources to pursue new lines of research or innovative teaching methods. The professorship was established by the late Edward Shapiro, a 1937 alumnus of the department, and his wife Antoinette Post Shapiro, an alumnus of the College of the Liberal Arts.\nL7: Keating's research applies the approaches of colloid and interface chemistry — a science that seeks to understand the physical properties of various high surface-area materials such as emulsions and nanoparticles — to problems in biology and materials science. She is particularly interested in how the structural organization of materials dictates their physical and chemical properties.\nL8: Her lab builds artificial cells to model the internal organization of living cells using such methods as liquid-liquid phase separation and molecular self-assembly. By improving understanding of how and why subcellular compartmentalization occurs, Keating's research could result in new ways to target drugs, construct bioinspired materials, and perhaps even understand how the first cells arose.\nL9: Keating also studies assemblies of nonbiological materials such as inorganic nanospheres or nanowires, in which organization arises due to the interactions between particles or between particles and their surroundings. Her lab combines top-down and bottom-up approaches to direct the organization of particles, with a current emphasis on generating reconfigurable optical materials with functions ranging from imaging to lasers.\nL13: Keating earned bachelor's degrees in biology and chemistry at St. Francis College in Loretto, Pennsylvania, in 1991 and a doctoral degree in chemistry at Penn State in 1997. She was a postdoctoral associate in the Penn State Department of Chemistry from 1997 to 1999 and a research assistant professor in chemistry at Penn State from 1999 to 2001. Keating became an assistant professor of chemistry in 2001, was promoted to associate professor in 2007, and to professor in 2012.","dw":"2015年8期(copy) (https://wuli.iphy.ac.cn/cn/article/pdf/preview/10.7693/wl20150807.pdf)\nciteturn41041view1 [wordlim: 200] Crawled: 11.3 years ago; Content type: application/pdf; Source: open({\"ref_id\":\"turn41040view0\",\"lineno\":26}); Total lines: 58\nL20: 现在回想起来，在理论所攻读博士的3年，是我学术生涯中最关键的时期，为我今后的发展奠定了最重要的基础。我的导师苏肇冰先生，天生一副严峻的表情，初次见面的人特别是学生，对他总有些畏惧。不过熟了以后很快就发现，他是一位极有耐心的导师，很会带学生，特别擅于因材施教，注意培养学生的自信心和独立工作能力。这3年在科研上我真正感觉到了如鱼得水，畅快淋漓，成为我后来选择回到科学院工作最重要的原因。在此期间，苏老师对我的影响是巨大的。在博士阶段，导师不可能手把手教学生技术上的东西，这些自己看文献就行，能传给学生的主要是科学上的品位和对物理实质的深刻理解。除此之外，导师还应该用自己强大的人格力量和丰富的精神世界去影响学生，帮助他们建立自己的科学价值观和判断力。而这种价值观和判断力的传承，才是维系科学文明最重要的环节，在这个意义上导师的身教远远重于言传。我感到非常幸运的是，苏老师正是这样一位值得尊敬的科学家，他在科学上的严谨和深刻，是我终生努力到达的目标。直到现在，每当我向他介绍自己近期工作时，心里都不免有些惴惴不安，唯恐他看不上，而不管这些工作已经在哪里发表，已经得到了怎样的引用。\nL30: 1999年初夏，我顺利地通过博士论文答辩，从理论物理所毕业了。那时候的确非常留恋理论所良好的学术环境，如果各方面的条件允许，真想推迟一年毕业。之后我先到香港科技大学做第一期博士后，合作导师是吴大琪教授。大琪是我见过的理论物理学家中思维速度最快、跳跃程度最大的几个人之一，刚开始跟他讨论的时候，我总是竭尽全力才能勉强跟上他的思路，半天时间下来往往有“脑部缺氧”的感觉。后来明白，这种理论思维的快速程度跟两个因素有关，第一是知识的广博程度，也就是对文献的掌握程度；第二是平时想过、算过大量的问题，这些都“潜伏”在大脑深处，讨论的过程不过是把这些记忆调出来而已。在我的学术生涯中结识过许多国际一流的理论物理学家，他们有一个共同的特点，即想过的问题比算过的多，而算过的问题又比最后发表的多得多。换句话说就是，他们的强大不完全体现在文章发表和被引用程度上，越到职业生涯晚期这一点体现得越明显。我在香港科技大学的研究课题主要是介观物理和可能的量子玻璃态，特别是后者，是一个很疯狂的想法，主要是希望在路径积分的理论框架里探讨是否存在玻璃态的量子版本。我记得当初花了许多时间试图建立一个replica近似下的平均场理论，虽然最后没有成功，但从中学到了很多，包括经典玻璃理论和场论方法在无序系统中的应用等。有时候一个看似不成功的课题可能会带给你更多的意想不到的收获。\nL31: 在香港科技大学做完了第一期博士后，我得到了去美国继续研究工作的机会，先是在波士顿学院工作了大半年，又被合作导师汪自强教授推荐到新泽西的Rutgers大学，跟随鼎鼎大名的Gabi Kotliar教授做研究。他是当时凝聚态理论领域公认的几位天才科学家之一，在强关联体系电子结构研究和高温超导理论发展等几个关键的领域都做出了很突出的工作。如高温超导体的d波对称性、Hubbard模型的奴役波色子理论等，他到目前为止影响最大的科学贡献，要数跟法国科学家Antoine Georges一起发展的动力学平均场理论。这一理论框架的提出很大程度上开辟了强关联材料电子结构计算，这个重要的研究领域。我们到Rutgers大学时，正赶上将动力学平均场方法从模型研究推广到实际材料研究的热潮。当时的背景是这样的，动力学平均场方法自从80年代末被提出以来，经过90年代的发展，已经比较成熟，但这种成熟是对于较简单的模型体系而言的，一般涉及到的能带数目不超过两条，而要推广到实际材料的话，就将面对起码5、6条甚至十几条能带的复杂问题。因此当时Gabi给我的研究课题，就是开发真正能用于实际材料计算的量子杂质求解器。由于在博士期间就对动力学平均场方法非常感兴趣，自己动手写过简单的实现程序，所以我很快就进入了状态。在来Rutgers大学前，我的工作主要是以解析手段为主，基本没有涉及到大规模科学计算，所以在这期间我还经历了从解析研究到计算研究的转型。对解析研究而言，其具体过程相对独立性较强，合作者之间主要是讨论方法和结果，在具体过程中需要协作完成的情况较少。而对于像LDA+DMFT这样的科学计算，研究过程中不同研究者之间的协作至关重要，包括在他人已有程序基础上的二次开发改进、前后计算流程之间的衔接配合，以及数据结构的统一规范等。这就要求研究者必须具有很强的沟通能力、协调能力和快速学习能力，这三方面的能力决定了一个研究者是否能成为我们所谓的“Team worker”，即团队科学家。现在回想起\nL36: 来，在 Rutgers 大学工作的 2 年多时间，我在团队合作方面获益良多，特别是学会了如何与来自世界各地不同文化背景的科学家们协作展开研究。\nL37: 我在 Rutgers 大学工作期间的合作导师 Kotliar 教授，是一位非常有个性的科学家，他对学生和博士后的要求非常严格，而且耐心有限，所以跟他工作的学生和博士后们往往要经历一个比较痛苦的磨合期。我也不例外，不过我很快找到了和他讨论问题的正确方式，特别是当意见不一致的时候，不要试图用言语去说服他，用他的话说我们能想到的他 N 年前就想过许多遍了。于是，我尽量只用事实说话。记得刚到 Rutgers 不久，我们就在一个问题上爆发了争论，彼此都不能说服对方，并且双方都有了些火气，一度感觉很沮丧。好在后来我冷静下来，每次讨论前，都准备大量的计算结果，各种图表，在大量数据的基础上一步步证明了我的想法是对的。令我非常感动的是，问题搞清楚了以后，Gabi 特别开心，此后常常对别人提及此事，毫无掩饰地说自己一开始想错了，是“埃克赛”找到了正确的方式并说服了他。跟 Gabi 交往的时间越长就越喜欢他那种单纯而直爽的性格，随着年龄的增长，我对他的理解和敬重也愈发加深。理论物理学家出成绩的黄金期大概就在 30—50 岁之间，其实不长，所以人生苦短，采取直接的方式也许能使自己的职业生涯更加高效。\nL38: 在 Rutgers 工作期间，我还从同事 Sergey Savrasov 那里学到很多东西。Sergey（中文通译为谢尔盖）是国际上有名的密度泛函方面的专家，尤其是在 LMTO（线性 Mufftin 轨道近似）方法方面，我的密度泛函方面的本事一多半是他教会的。我们在工作中建立了深厚的友谊并一直保持密切的合作关系至今。谢尔盖原籍俄罗斯，大概属于伟大的俄罗斯物理学派培养的最后一代传人，可惜时运不济遇上苏联解体，只好漂流海外，先是在德国工作多年，最后在美国永久安顿下来。相似的经历和长期的合作使得我们之间惺惺相惜，情同手足。记得有一次在 Sergey 家开 party，来了许多“萨沙”、“伊戈尔”和“谢辽沙”们，大家一起回忆了许多俄罗斯物理学派的往事，如金兹堡组织的莫斯科学术讲座、郎道研究所的兴衰等，当然按照俄罗斯的传统，喝酒是免不了的，最后我都不记得自己是怎么回的酒店。\nL39: 在 Rutgers 工作期间，我第一次发表了在国际学术界产生较大影响的工作——利用 LDA 结合动力学平均场方法计算了金属 Pu 在 delta 和 epsilon 两个相的声子谱。金属钚是具有重大战略意义的核材料，同时也是最典型的强关联材料。所以当 LDA + DMFT 方法提出以后，能否预言典型的强关联材料如钚金属等的关键物性，就成为了这种方法是否可行的试金石。当我 2002 年加入这个课题组之前，Savrasov 和 Kotliar 等已经利用 LDA + DMFT 方法得到了大致可靠的电子结构，极大增强了大家的信心，下一个目标就是金属钚的力学性质，我正好在这个关键的时间节点加入进来，有幸作为主要成员之一与 Savrasov 和 Kotliar 一起完成了这项工作。更令人兴奋的是，在我们的理论计算发表后不久，美国 livermore 国家实验室的科学家就用中子散射实验验证了这一结果。这项工作产生了很大的国际影响，不但为钚金属的理论计算开辟了新的途径，而且表明 LDA + DMFT 不仅可以用来解决电子结构的问题，还可以应用在材料力学性能的计算上，为 LDA + DMFT 方法的应用开辟了一大片崭新的领域。\nL40: 2004 年初，当我在 Rutgers 的工作合同趋于结束的时候，面临着寻找永久性工作的问题，因为博士后毕竟是临时性的工作。当时我大致有三个选择：一是回国工作；二是在美国找 tenure track 的职位；三是继续留在 Kotliar 的研究团队做研究助理，但并不是永久性的职位。由于我的教育背景主要是在国内完成，对美国的高等教育体系并不熟悉，再加上我在美国物理学界认识的人也不多，这都决定了我不太可能在美国知名的研究型大学中找到教职，而由于我对中国科学院，特别是理论物理所和物理所等科研机构都非常了解，我觉得与其最后勉强在一所比较一般的美国大学找到工作，其研究环境和学术氛围都还远比不上科学院。所以当时从个人学术发展的角度看，最好的选择当然是回科学院工作，但当时国内研究员的待遇整体上还很低，再者我从科学院毕业已经 5 年了，对最新的情况不甚了解，最后折衷了一下，选择接受香港大学物理系的邀请担任研究助理教授。\nL41: 在香港大学我的主要合作者是张富春教授，富春是华人物理学界的又一个传奇，如果说在华人物理学界要找一个人来讲述励志故事，那么没有人比他更合适了。富春的青年时代正好迎面撞上“文革”，等一切结束时他已经 30 好几了，才开始读研究生，将近 40 岁时博士毕业。也许是命运对他的补偿，被推迟了整整 10 年的职业生涯却是一帆精彩，特别是他与 T.M. Rice 教授一起提出的“Zhang–Rice”单态的概念，成为了构建高温超导理论的重要出发点之一，影响了几代凝聚态理论研究者。富春的人生经历既折射出个人命运在时代大潮面前的渺小与无力，同时也体现了那一代华人科学家特有的异乎寻常的顽强","dh":"Xi DAI 戴希 | The Hong Kong University of Science and Technology (https://physics.hkust.edu.hk/people/xi-dai-daixi)\nciteturn41042view0 [wordlim: 200] Crawled: yesterday; Content type: text/html; Source: find({\"ref_id\":\"https://physics.hkust.edu.hk/people/xi-dai-daixi\",\"pattern\":\"Rutegrs University\"}); Total lines: 170\nL147: Professor Xi Dai obtained his Bachelor and Master’s degree (1993 &1996) from Zhejiang University and PhD (1999) from Institute of Theoretical Physics, CAS in China. After graduation, he did postdoctoral research in HKUST, Boston college and Rutegrs University. From 2007-2017, he worked in institute of physics, CAS as a professor in theory division. In September 2017, he joined HKUST as a professor in the Department of Physics.","dn":"Tai Kai NG 吳大琪 | The Hong Kong University of Science and Technology (https://physics.hkust.edu.hk/people/tai-kai-ng-wudaqi)\nciteturn41046view1 [wordlim: 200] Crawled: last month; Content type: text/html; Source: open({\"ref_id\":\"turn41042search0\",\"lineno\":null}); Total lines: 142\nL101: # Tai Kai NG 吳大琪\nL103: 【40†Image: Tai Kai NG 吳大琪】\nL106: Tai Kai\nL110: 吳大琪\nL114: Professor Emeritus\nL129:   * “Renormalization Group Approach to Anderson Impurity in the Bulk of TopologicalInsulators”, Igor Kuzmenko, Yshai Avishai and Tai Kai Ng, Phys. Rev. B 89, 035125 (2014).","db":"Linux HPC Cluster - Information Technology Services - Boston College (https://www.bc.edu/bc-web/offices/its/services/research-services/linux-cluster.html)\nciteturn41046view0 [wordlim: 200] Crawled: today; Content type: text/html; Source: open({\"ref_id\":\"turn41042search5\",\"lineno\":null}); Total lines: 524\nL402: ### Ziqiang Wang (Physics)\nL403: Our research group studies the fundamental physics of strongly correlated electronic materials with a special focus on that of the high temperature superconductors. Understanding the unconventional, complex, and emergent physical properties in these materials represents both the challenge and the vitality of condensed matter physics.","dr":"Alumni - Center for Materials Theory (https://cmt.rutgers.edu/alumni/)\nciteturn41046view4 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"https://cmt.rutgers.edu/alumni/\",\"pattern\":\"Xi Dai\"}); Total lines: 158\nL32: ### Past Postdocs\nL48: Xi Dai – HKUST, China","jla":"Chao-Ming Jian | Lab of Atomic of Solid State Physics (LASSP) (https://www.lassp.cornell.edu/people/chao-ming-jian)\nciteturn41048view4 [wordlim: 200] Crawled: last week; Content type: text/html; Source: find({\"ref_id\":\"https://www.lassp.cornell.edu/people/chao-ming-jian\",\"pattern\":\"Microsoft Station Q\"}); Total lines: 108\nL61:   * Assistant Professor, Physics, Cornell University, 2020-present\nL62:   * Postdoctoral Researcher, Microsoft Station Q, 2017-2018 and 2019-2020\nL63:   * Moore Foundation Fellow, Kavli Institute for Theoretical Physics, University of California, Santa Barbara, 2016-2017 and 2018-2019\nL65:   * Ph.D. in Physics, Stanford University, 2016\nL71: chao-ming.jian@cornell.edu\nL75: 【34†Jian Group website†jcmgroup.lassp.cornell.edu】","jc":"Director's Letter - Fall 2016 | KITP (https://www.kitp.ucsb.edu/news/directors-letter-fall-2016)\nciteturn41034view0 [wordlim: 200] Crawled: 2 months ago; Content type: text/html; Source: find({\"ref_id\":\"turn41025search0\",\"pattern\":\"Chao-Ming Jian\"}); Total lines: 38\nL17: Five new postdoctoral fellows arrived in September. Xiao Chen and Chao-Ming Jian are theoretical condensed matter physicists who respectively study entanglement and dynamics of many body quantum systems, and topological phases of matter and quantum information-theoretic studies of correlated matter.","jcf":"Director's Letter - Fall 2019 | Kavli Institute for Theoretical Physics (https://www.kitp.ucsb.edu/news/directors-letter-fall-2019)\nciteturn41034view1 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"turn41025search2\",\"pattern\":\"Chao-Ming Jian\"}); Total lines: 39\nL8: Fall is the time of change. Six postdoctoral scholars have moved on to new positions as others arrive. Xiao Chen will be an Assistant Professor at Boston University, while Chao-Ming Jian is at Station Q for one year and then will move to an Assistant Professor position at Cornell University.  Adam Jermyn will be a postdoctoral scholar at the Flatiron Institute, where Yan-Fei Jiang has just started as an Associate Research Scientist.","jts":"四位清华校友获得2024斯隆研究奖-清华大学 (https://www.tsinghua.edu.cn/info/1175/109734.htm)\nciteturn41028view0 [wordlim: 200] Crawled: last week; Content type: text/html; Source: find({\"ref_id\":\"turn41020search2\",\"pattern\":\"康奈尔大学助理教授简超明\"}); Total lines: 71\nL35:   * 清华新闻网2月22日电 2月21日，美国艾尔弗·斯隆基金会公布了2024年度斯隆研究奖（Sloan Research Fellowships）获奖名单，包括四位清华校友在内的126位杰出青年科学家获奖。伊利诺伊大学香槟分校助理教授姜楠（2007级自动化系）、威斯康星大学麦迪逊分校助理教授于向遥（2008级微纳电子系）获得计算机科学奖，宾夕法尼亚大学助理教授黄骄阳（2010级交叉信息研究院）获得数学奖，康奈尔大学助理教授简超明（2007级物理系）获得物理学奖。\nL37: 【20†Image: 20240221-斯隆奖-姜楠、于向遥、黄骄阳、简超明-网图-校友总会.jpg】\nL39: 姜楠、于向遥、黄骄阳、简超明（从左至右）","jts2":"薪火相传-清华校友总会 (https://www.tsinghua.org.cn/info/1014/42476.htm)\nciteturn41048view3 [wordlim: 200] Crawled: yesterday; Content type: text/html; Source: find({\"ref_id\":\"https://www.tsinghua.org.cn/info/1014/42476.htm\",\"pattern\":\"简超明（2007-2011\"}); Total lines: 361\nL86: 简超明（2007-2011 清华大学本科，现为康奈尔大学助理教授）：","jp":" (https://arxiv.org/pdf/1710.04668)\nciteturn41045view2 [wordlim: 200] Crawled: 2 weeks ago; Content type: application/pdf; Number of pages: 7; Source: find({\"ref_id\":\"https://arxiv.org/pdf/1710.04668\",\"pattern\":\"Department of Physics, University of California, Santa Barbara\"}); Total lines: 918\nL0@P0: Deconfined Quantum Critical Point on the Triangular Lattice\nL1@P0: Chao-Ming Jian,1, 2 Alex Thomson,3, 2 Alex Rasmussen,4 Zhen Bi,5 and Cenke Xu4\nL2@P0: 1 Station Q, Microsoft Research, Santa Barbara, California 93106-6105, USA\nL3@P0: 2Kavli Institute of Theoretical Physics, Santa Barbara, CA 93106, USA\nL4@P0: 3Department of Physics, Harvard University, Cambridge, MA 02138, USA\nL5@P0: 4Department of Physics, University of California, Santa Barbara, CA 93106, USA\nL6@P0: 5Department of Physics, Massachusetts Institute of Technology, Cambridge, Massachusetts 02139, USA\nL7@P0: (Dated: October 16, 2017)","qw":"Quantum phase transitions in heavy fermion metals and Kondo insulators - Si - 2013 - physica status solidi (b) - Wiley Online Library (https://onlinelibrary.wiley.com/doi/10.1002/pssb.201300005)\nciteturn41048view1 [wordlim: 200] Crawled: last week; Content type: text/html; Source: find({\"ref_id\":\"https://onlinelibrary.wiley.com/doi/10.1002/pssb.201300005\",\"pattern\":\"Qimiao Si obtained\"}); Total lines: 932\nL340: Qimiao Si obtained his B.S. (1986) degree from University of Science and Technology of China and Ph.D. (1991) degree from the University of Chicago. He did postdoctoral works (1991–1995) at Rutgers University and University of Illinois at Urbana-Champaign. In 1995 he joined the faculty of Rice University, where he is the Harry C. and Olga K. Wiess Professor of Physics. He is a theorist working on condensed matter and statistical physics, with an emphasis on strongly correlated electron systems.","qpub":" (https://d3qi0qp55mx5f5.cloudfront.net/physics/docs/PubList15.pdf?mtime=1762462564)\nciteturn41037view1 [wordlim: 200] Crawled: 2 weeks ago; Content type: application/pdf; Number of pages: 20; Source: find({\"ref_id\":\"https://d3qi0qp55mx5f5.cloudfront.net/physics/docs/PubList15.pdf?mtime=1762462564\",\"pattern\":\"Qimiao Si\"}); Total lines: 546\nL287@P10: 120. \"FrequencyEvolution of Neutron Peaks BelowTc: Commensurate and Incommen\u0002surate Structure in LaSrCuO and YBaCuO,\" Ying-Jer Kao, Qimiao Si, and Kathryn\nL366@P12: La2-xSrxCuO4,\" Yuyao Zha, K. Levin and Qimiao Si, Phys. Rev. B 47, 9124 (1993).\nL368@P12: Fermi-Surface Geometry,\" Qimiao Si, Yuyao Zha, K. Levin and J. P.Lu, Phys. Rev. B 47,\nL371@P13: Zha, Qimiao Si and K. Levin, Physica C 212, 413 (1993).\nL378@P13: Qimiao Si, Ju H. Kim, J. P.Lu, in \"Proceedings of the University of Miami Workshop on\nL386@P13: and K. Levin, Phys. Rev. B 44, 4727 (1991).\nL387@P13: 76. \"Normal State Properties in the Cuprates and Their Fermi Liquid Based Interpreta\u0002tion,\" (ReviewArticle) , K. Levin, Ju H. Kim, J. P.Lu, and Qimiao Si, Physica C 175,\nL390@P13: the Metallic Copper Oxides,\" J. P.Lu, Qimiao Si, Ju H. Kim and K. Levin, Physica C","qr":"Alumni - Center for Materials Theory (https://cmt.rutgers.edu/alumni/)\nciteturn41046view4 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"https://cmt.rutgers.edu/alumni/\",\"pattern\":\"Xi Dai\"}); Total lines: 158\nL32: ### Past Postdocs\nL36: Qimiao Si – Rice U.","kco":"      -  Penn State  (https://pure.psu.edu/en/publications/protein-colloid-conjugates-for-surface-enhanced-raman-scattering-/)\nciteturn41051view0 [wordlim: 200] Crawled: 4 months ago; Content type: text/html; Source: open({\"ref_id\":\"https://pure.psu.edu/en/publications/protein-colloid-conjugates-for-surface-enhanced-raman-scattering-/\",\"lineno\":null}); Total lines: 192\nL18:   * 【11†Christine Dolan Keating】\nL20:   * , Michael J. Natan\nL90: 【11†Keating, C. D.】, Kovaleski, K. M., & Natan, M. J. (1998). 【14†Protein: Colloid conjugates for surface enhanced raman scattering: Stability and control of protein orientation】. Journal of Physical Chemistry B, 102(47), 9404-9413. 【16†https://doi.org/10.1021/jp982723z†doi.org】\nL91: 【11†Keating, Christine Dolan】 ; Kovaleski, Kenneth M. ; Natan, Michael J. / 【14†Protein : Colloid conjugates for surface enhanced raman scattering: Stability and control of protein orientation】. In: Journal of Physical Chemistry B. 1998 ; Vol. 102, No. 47. pp. 9404-9413.\nL99: author = \"Keating, \\{Christine Dolan\\} and Kovaleski, \\{Kenneth M.\\} and Natan, \\{Michael J.\\}\",\nL124: 【11†Keating, CD】, Kovaleski, KM & Natan, MJ 1998, '【14†Protein: Colloid conjugates for surface enhanced raman scattering: Stability and control of protein orientation】', Journal of Physical Chemistry B, vol. 102, no. 47, pp. 9404-9413. 【16†https://doi.org/10.1021/jp982723z†doi.org】\nL125: 【14†Protein: Colloid conjugates for surface enhanced raman scattering: Stability and control of protein orientation.】 / 【11†Keating, Christine Dolan】; Kovaleski, Kenneth M.; Natan, Michael J.\nL136: AU - Keating, Christine Dolan","kpw":"Weiss, Paul S. – UCLA (https://www.chemistry.ucla.edu/directory/weiss-paul-s/)\nciteturn41051view1 [wordlim: 200] Crawled: today; Content type: text/html; Source: find({\"ref_id\":\"https://www.chemistry.ucla.edu/directory/weiss-paul-s/\",\"pattern\":\"Pennsylvania State University\"}); Total lines: 175\nL33: He served as the director of the California NanoSystems Institute and held the Fred Kavli Chair in NanoSystems Sciences at UCLA from 2009-14. Before coming to UCLA, he was a distinguished professor of chemistry and physics at the Pennsylvania State University, where he began his academic career in 1989. He has authored over 500 publications, holds over 40 patents, and has given over 1000 invited, plenary, keynote, and named lectures."};
const read=(id,key,excerpt)=>({record_id:id,url:u[key],raw:raw[key],excerpt});
const error=(id,key,error)=>({record_id:id,url:u[key],error});
const pages=[read(w,"wland","朗道所答辩名录核 1978 指导教师 Larkin 和另列 1983 高等学位。"),
read(w,"wbim","BIMSA 核 Landau、Princeton、IAS 研究岗位及 Chicago 教职。"),
read(w,"wuw","UW 人事原册核 1978 Landau PhD 及 2010 访问任用。"),
read(w,"wpme","Chicago PME 目录列 Reneker 物理教授、凝聚态及拓扑。"),
read(k,"kacs","2002 ACS 讲座原册核研究生 Natan 组及两段博后组属。"),
read(k,"kps","Penn State 核 1997 博士、1997–1999 博后及 1999–2001 科研教职。"),
read(k,"kco","Penn State 原论文记录核 Keating 与 Michael J. Natan 拼写。"),
read(k,"kpw","UCLA Weiss 本人履历核此前任 Penn State 化学及物理教授。"),
read(d,"dw","《物理》戴希自述明确苏肇冰及三段博后合作导师。"),
read(d,"dh","HKUST 系档核戴希三段博后及现任。"),
read(d,"dn","HKUST 原档核吴大琪身份。"),
read(d,"db","Boston College 原页核汪自强和凝聚态方向。"),
read(d,"dr","Rutgers CMT 历届博士后名册核戴希。"),
read(j,"jla","Cornell LASSP 按任用分列四段 KITP 与 Station Q。"),
read(j,"jc","KITP 2016 主任信列简超明为新博士后。"),
read(j,"jcf","KITP 2019 主任信确认 Station Q 及后续 Cornell。"),
read(j,"jts","清华原档核中文姓名简超明。"),
read(j,"jp","2017 作者原稿核 KITP／Station Q 双署名。"),
read(q,"qw","2013 作者履历核 1991 Chicago 博士、两校合计 1991–1995 博后。"),
read(q,"qpub","Levin 本人目录核 1991 及后续合作，未列指导。"),
read(q,"qr","Rutgers CMT 历届博士后原档核 Si。"),
error(k,'ka','WorldCat dissertation record cache miss; thesis supervisor field unavailable.'),
error('9cb8738a','sr','Thesis abstract web reader returned 502; single direct verification reported remote TLS certificate hostname mismatch.'),
error('9cb8738a','sl','Russian state technical library citation result was indexed but original page could not be read.'),
error(q,'qa','APS publisher PDF endpoint did not return usable body. Levin’s own publication list was inspected separately.')];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2232_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2232_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const exclusionFile='20261110_2232_Keating同名排除.json';
persist(exclusionFile,exclusions);
call('人物网页身份纠偏.cjs',[exclusionFile]);
const receipt='20261110_2232_朗道名录与博后自述网页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
