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
 orig.audit_id='pi_archive_20261111_0152_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0152_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"oBook":"https://books.google.com/books?id=zMlEAQAAIAAJ&focus=searchwithinvolume&q=%22To+my+advisor+Mac+Beasley%22","oMIT":"https://equs.mit.edu/terry-p-orlando/","mooij":"https://qutech.nl/wp-content/uploads/2022/05/Hans-Mooij-QT.pdf","jBook":"https://books.google.com/books?id=340vAQAAIAAJ&focus=searchwithinvolume&q=%22A+new+theoretical+approach+for+autoionizing+states%22","jTAMU":"https://engineering.tamu.edu/chemical/profiles/jseminario.html","sECE":"https://ece.engin.umich.edu/stories/duncan-steel-retires-leaving-a-quantumly-inspired-legacy","sBoard":"https://regents.umich.edu/files/meetings/05-23/2023-05-VI-Steel.pdf","mBook":"https://books.google.com/books?id=rA5NAQAAMAAJ&focus=searchwithinvolume&q=Fontaine","mWI":"https://engineering.wisc.edu/directory/profile/dane-morgan/","rok":"https://physics.berkeley.edu/people/faculty/daniel-rokhsar","aPDF":"https://deepblue.lib.umich.edu/bitstream/2027.42/113343/1/aburgers_1.pdf","aMeta":"https://deepblue.lib.umich.edu/handle/2027.42/113343","aLSA":"https://lsa.umich.edu/appliedphysics/people/faculty/aburgers.html","aECE":"https://ece.engin.umich.edu/wp-content/uploads/sites/4/2022/11/ECE-Magazine-2022.pdf"};
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




const o='5582584f', j='268a1836', s='9462a2bb', m='3c58fe7f', b='34647215';
const on='Terry P. Orlando', jn='Jorge Seminario', sn='Duncan Steel', mn='Dane Morgan', bn='Alexander Burgers';
const of='师承人物 - Malcolm R. Beasley', jf='师承人物 - Frank Clarence Sanders', sf=records.get(s).filename;
const bach='师承人物 - David Bach', dud='师承人物 - James Duderstadt', mfnt='师承人物 - Didier de Fontaine', r='师承人物 - Daniel S. Rokhsar';

const oText='Orlando 本人 Stanford 学位论文 Part I. Upper Critical Fields and Spin States in A-15 Superconductors: Part II. Vortices in Two-dimensional Superconductors 第 vii 页致谢原件明确称 Mac Beasley 为自己的 advisor。MIT 教师档核 Stanford 1981 物理博士，Mooij 当期回忆核同一导师姓名。关系类型可信度：高。';
const oSources=src(['本人博士论文第 vii 页扫描','oBook'],['MIT EECS 课题组教师档','oMIT'],['Mooij 本人回忆','mooij']);
updateEdge(o,on,of,'Malcolm R.（Mac）Beasley','博士阶段研究师长','博士阶段研究者','博士导师','博士生',oText,oSources);
rewrite(pf(o),x=>x.startsWith(boundary),()=>boundary+'本人 Stanford 论文致谢确认博士导师 Malcolm R. Beasley。MIT 履历列 1981 年博士及同年开始 MIT 教职，当前所阅履历未见单列博士后。 '+oSources);
cell(o,2,'Malcolm R.（Mac）Beasley（1981 Stanford 物理博士导师，论文致谢）');
cell(o,3,'MIT 履历列 1981 起任教；目前未见单列博士后任用');
schoolWith(o,src(['本人论文致谢扫描','oBook']));
const oa=audit(o,[
 a('identity','Stanford 论文扫描书目及 MIT 本人档身份相符，致谢 Mac Beasley 与同期合作者回忆一致。',['oBook','oMIT','mooij'],'confirmed'),
 a('affiliation','MIT EECS Post-tenure Professor of Electrical Engineering。',['oMIT'],'confirmed'),
 a('research','超导电路量子计算和经典到量子跨越区的非线性动力学。',['oMIT'],'confirmed'),
 a('phd',oText,['oBook','oMIT','mooij'],'confirmed_advisor'),
 a('postdoc','MIT 教师档记 1981 年 Stanford 博士，同年起任 MIT 教职。所阅履历未单列博士后经历。',['oMIT'],'no_postdoc_documented')
],'如有独立短期任用的同期证据则补录；从原 CV 或学校任用档核查具体任职日期。');
relation(o,oa,'phd',of,'advisor',oText,ids('oBook','oMIT','mooij'),'beasley');

const jText='University Microfilms 1989 年 Dissertation Abstracts International B 第 2698 页原刊扫描列 Jorge Manuel Seminario、Southern Illinois University at Carbondale 1988 博士，论文 A new theoretical approach for autoionizing states，Major Professor 明列 Frank C. Sanders。Texas A&M 教师档独立核博士学校和年份。关系类型可信度：高。';
const jSources=src(['DAI 第 2698 页扫描','jBook'],['Texas A&M 化工系','jTAMU']);
updateEdge(j,jn,jf,'Frank Clarence Sanders','博士导师候选','博士候选研究者','博士导师','博士生',jText,jSources);
rewrite(pf(j),x=>x.startsWith(boundary),()=>boundary+'DAI 原刊核博士导师 Frank C. Sanders；Texas A&M 化工系原档核院系、方向和 1988 Southern Illinois 博士。博士后经历与指导仍待核。 '+jSources);
cell(j,2,'Frank Clarence Sanders（1988 Southern Illinois University at Carbondale 博士导师，DAI Major Professor）');
schoolWith(j,src(['DAI 第 2698 页扫描','jBook']));
const ja=audit(j,[
 a('identity','DAI 的完整作者名、Southern Illinois Carbondale 和 1988 学位与 Texas A&M 本人档相符。',['jBook','jTAMU'],'confirmed'),
 a('affiliation','Texas A&M Chemical Engineering Professor。',['jTAMU'],'confirmed'),
 a('research','分子电子学、纳米尺度材料模拟、分子器件与纳米传感。',['jTAMU'],'confirmed'),
 a('phd',jText,['jBook','jTAMU'],'confirmed_advisor')
],'追毕业后任用原档、CV 和博士后指导；现有 Texas A&M 履历未具名。');
relation(j,ja,'phd',jf,'advisor',jText,ids('jBook','jTAMU'),'sanders');

const sText='University of Michigan EECS 退休报道正文分别称 David Bach 为 Steel 的博士研究 advisor，称 James Duderstadt 为 co-thesis advisor。校董会原档核 1976 Michigan 核与电科学博士。两条博士指导关系可信度：高。';
const sSources=src(['Michigan EECS 退休报道原文','sECE'],['校董会退休原档','sBoard']);
updateEdge(s,sn,bach,'David Bach','博士导师候选','博士生候选','博士导师','博士生',sText,sSources);
updateEdge(s,sn,dud,'James Duderstadt','博士导师候选','博士生候选','博士导师','博士生',sText,sSources);
personLine(s,'- Hughes 任职：',' 校董会原档与院系退休报道核两位博士导师及早期任用见上。 '+sSources);
cell(s,2,'David Bach（博士导师）、James Duderstadt（博士论文共同导师）；1976 Michigan 核与电科学');
schoolWith(s,src(['Michigan EECS 退休报道原文','sECE']));
const sa=audit(s,[
 a('identity','Michigan EECS 本人访谈及校董会正式退休记录核人名、学历、Hughes 与入职时间。',['sECE','sBoard'],'confirmed'),
 a('affiliation','Michigan 工程学院 EECS 与文理学院物理教授，2023 年 5 月 31 日结束现役教职。',['sBoard'],'confirmed'),
 a('research','半导体量子光学、相干非线性激光光谱、量子信息。',['sBoard','sECE'],'confirmed'),
 a('phd',sText,['sECE','sBoard'],'confirmed_advisor'),
 a('postdoc','校董会列 1975–1985 Hughes Research Laboratories 技术人员，Michigan 1985 起教职。所阅资料未发现单列博士后聘任。',['sBoard','sECE'],'no_postdoc_documented')
],'两位博士指导称谓已核，后续如获论文签署页或 Hughes 细分任用档再补；现有任用没有单列博士后。');
relation(s,sa,'phd',bach,'advisor',sText,ids('sECE','sBoard'),'bach');
relation(s,sa,'phd',dud,'advisor',sText,ids('sECE','sBoard'),'duderstadt');

const mText='Berkeley 1998 博士论文 Computational Studies of Alloy Phase Stability 原件第 iii 页致谢明确称 Didier de Fontaine 为自己的 advisor。Wisconsin 工程学院原档核 Berkeley 博士及计算材料方向。关系类型可信度：高。';
const rText='同一博士论文第 iii 页致谢称 Daniel Rokhsar 分担指导研究的部分工作，确认为博士阶段研究师长。原页未将其称作正式共同导师。关系类型可信度：高。';
const mSources=src(['Berkeley 本人论文第 iii–iv 页扫描','mBook'],['Wisconsin 工程学院','mWI']);
const rSources=src(['Berkeley 本人论文第 iii 页扫描','mBook'],['Berkeley Rokhsar 物理系档','rok']);
updateEdge(m,mn,mfnt,'Didier de Fontaine','博士导师候选','博士生候选','博士导师','博士生',mText,mSources);
edge(m,mn,r,'Daniel S. Rokhsar','博士阶段研究师长','博士阶段受指导者',rText,rSources);
rewrite(pf(m),x=>x.startsWith(boundary),(line)=>{
 const at=line.indexOf('本人参与署名的 2006 MRS');
 if(at<0)throw Error('missing confirmed postdoc evidence');
 return boundary+'本人博士论文第 iii–iv 页证实两位博士阶段研究指导及各自角色。 '+mSources+' '+rSources+' '+line.slice(at);
});
cell(m,2,'Didier de Fontaine（Berkeley 1998 博士导师）；Daniel S. Rokhsar（博士阶段研究师长）');
schoolWith(m,src(['本人论文致谢扫描','mBook']));
const ma=audit(m,[
 a('identity','Berkeley 论文扫描完整作者 Dane David Morgan、年份与 Wisconsin 教师档相符。',['mBook','mWI'],'confirmed'),
 a('affiliation','Wisconsin 材料科学与工程主聘，Nuclear Engineering & Engineering Physics 为附属部门。',['mWI'],'confirmed'),
 a('research','计算材料、从头算电子结构、多尺度热动力学及电化学材料。',['mWI'],'confirmed'),
 a('phd',mText+' '+rText,['mBook','mWI','rok'],'confirmed_advisor')
],'Gerbrand Ceder 的 MIT 博士后组属已核，继续查具名指导职衔与 Postdoctoral Researcher／Research Associate 分界。');
relation(m,ma,'phd',mfnt,'advisor',mText,ids('mBook','mWI'),'defontaine');
relation(m,ma,'phd',r,'stage_mentor',rText,ids('mBook','rok'),'rokhsar');

const bText='Michigan 2015 年物理博士论文原件首页列 Duncan G. Steel 为博士委员会主席，致谢明确称其为 adviser。Michigan EECS 的退休报道也称 Steel 是 Burgers 的前导师。关系类型可信度：高。';
const bSources=src(['本人 Michigan 博士论文','aPDF'],['Michigan EECS 退休报道','sECE'],['Michigan 工程学院履历','aECE']);
updateEdge(b,bn,sf,sn,'博士阶段研究师长','博士阶段研究成员','博士导师','博士生',bText,bSources);
rewrite(pf(b),x=>x.startsWith(boundary),()=>boundary+'本人论文扉页与致谢确认 Steel 为博士导师。Michigan 工程学院履历分列 Caltech 在 H. Jeff Kimble 组做博士后及 Princeton 与 Jeffrey Thompson 共事，继续按各阶段的原证标注。 '+bSources);
cell(b,2,'Duncan G. Steel（2015 Michigan 物理博士导师、论文委员会主席）');
schoolWith(b,src(['本人博士论文扉页与致谢','aPDF']));
const ba=audit(b,[
 a('identity','原论文完整作者 Alexander Peter Burgers、2015 Michigan 物理博士与应用物理及 EECS 校档相符。',['aPDF','aLSA','aECE'],'confirmed'),
 a('affiliation','Michigan EECS Assistant Professor，学校 Applied Physics Program 名录收录。',['aLSA'],'confirmed'),
 a('research','量子光学、冷原子、量子信息；博士论文量子点与光子干涉，后续履历研究冷原子与集成光子结构。',['aPDF','aECE'],'confirmed'),
 a('phd',bText,['aPDF','sECE','aECE'],'confirmed_advisor')
],'Caltech Kimble 组与 Princeton Thompson 两段已核，继续核正式博士后指导称谓。');
relation(b,ba,'phd',sf,'advisor',bText,ids('aPDF','sECE','aECE'),'steel');

const pages=[
 [o,'oBook','Read Orlando’s Stanford dissertation scan p. vii. In the acknowledgments Orlando names Mac Beasley as his advisor.','学位论文致谢直接确认。'],
 [o,'oMIT','MIT group faculty profile lists Stanford Physics PhD and the start of MIT faculty employment in 1981, plus superconducting circuits research.','核身份、院系、方向及任用时间。'],
 [j,'jBook','Read Dissertation Abstracts International B, 1989, p. 2698. Jorge Manuel Seminario, Southern Illinois University at Carbondale, 1988. A new theoretical approach for autoionizing states. Frank C. Sanders is the major professor.','印刷原页确认具名导师。'],
 [j,'jTAMU','Texas A&M chemical engineering faculty profile confirms Southern Illinois PhD in 1988 and nanoscale materials and molecular electronics work.','核身份、院系和方向。'],
 [s,'sECE','Read the full Michigan EECS retirement feature in a browser. It describes David Bach as Duncan Steel’s advisor and Jim Duderstadt as a co-thesis advisor.','原文核主导师与共同导师。'],
 [s,'sBoard','Michigan Regents retirement memoir lists a 1976 PhD in nuclear and electrical science, technical staff at Hughes 1975–1985, and Michigan faculty appointments in EECS and physics.','核学位、职业阶段及院系。'],
 [m,'mBook','Read Morgan’s 1998 Berkeley dissertation scan, pp. iii–iv. Morgan names Didier de Fontaine as his advisor and states Daniel Rokhsar shared some supervisory work.','区别明确导师与阶段研究师长。'],
 [m,'mWI','Wisconsin engineering directory lists a Berkeley PhD in 1998, Materials Science and Engineering, a Nuclear Engineering and Engineering Physics affiliation, and computational materials research.','核学位、院系及方向。'],
 [m,'rok','Berkeley Physics identifies Daniel Rokhsar and describes research in quantum fluids and other collective phenomena.','确认论文致谢中的导师节点身份。'],
 [b,'aPDF','Michigan 2015 dissertation title page names Duncan G. Steel as committee chair. The acknowledgments call Duncan Steel Burgers’s adviser.','学位论文签署信息及本人致谢交叉确认。'],
 [b,'aLSA','Michigan Applied Physics profile identifies Burgers as Assistant Professor of Electrical Engineering and Computer Science.','核任用及项目目录。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:b,url:u.aMeta,error:'403 Forbidden on the repository landing page. The university-hosted dissertation PDF was read directly.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0152_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0152_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0152_学位致谢及Michigan任用回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
