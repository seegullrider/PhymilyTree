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
 orig.audit_id='pi_archive_20261111_0218_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0218_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"bc":"https://searchworks.stanford.edu/view/5686690","br":"https://profiles.rice.edu/faculty/sibani-lisa-biswal","kc":"https://searchworks.stanford.edu/view/13680839","kp":"https://stacks.stanford.edu/file/pw546wk6881/Dissertation_Keene_Final_Final-augmented.pdf","kr":"https://profiles.rice.edu/faculty/scott-keene","rc":"https://spiral.imperial.ac.uk/entities/publication/0afc16df-2239-45d8-8569-b934824a6df1","rp":"https://spiral.imperial.ac.uk/bitstreams/657a9cdd-5e07-481a-9e60-1295f30f0822/download","yr":"https://physics.yale.edu/profile/nicholas-read","ec":"https://searchworks.stanford.edu/view/2180701","er":"https://engineering.wisc.edu/directory/profile/chang-beom-eom/","oh":"https://www.diva-portal.org/smash/resultList.jsf?searchType=SIMPLE&query=Vidvuds+Ozolins"};
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




const b='5fe4dc83',bn='Sibani Lisa Biswal',gast='师承人物 - Alice Gast';
const bText='Stanford University Libraries 学位目录（5686690）列 2004 年 Chemical Engineering PhD、作者全名与论文 Exploring novel structure formation and mechanics of linked chains of magnetic colloidal particles and their application in microfluidics，并将 Alice P. Gast 具名列为 primary advisor。Rice 教师履历核同一学位和本人身份。关系类型可信度高。';
const bSource=src(['Stanford 博士学位目录','bc'],['Rice 教师档','br']);
updateEdge(b,bn,gast,'Alice Gast','博士候选关系','博士候选研究者','博士导师','博士生',bText,bSource);
rewrite(pf(b),x=>x.startsWith(boundary),()=>boundary+'Stanford 馆藏已明确 Alice Gast 为博士主导师。Rice 教师档核 Berkeley Mechanical Engineering 2004–2006 博后，Arun Majumdar 继续为待核候选。 '+bSource);
cell(b,2,'Alice P. Gast（Stanford 博士 primary advisor）');
schoolWith(b,bSource);
const be=audit(b,[
 a('identity','Stanford 2004 Chemical Engineering PhD、姓名及题名与 Rice 任职和教育履历对应。',['bc','br'],'confirmed'),
 a('affiliation','Rice Chemical and Biomolecular Engineering 系主任与教授，并任 Materials Science and NanoEngineering 教授。',['br'],'confirmed'),
 a('research','磁性胶体、软物质、微流体和胶体界面物理。',['br'],'confirmed'),
 a('phd',bText,['bc','br'],'confirmed_advisor'),
 a('postdoc','Rice 原档确认 2004–2006 Berkeley Mechanical Engineering 博后，Majumdar 的具名个人指导继续追查。',['br'],'group_or_candidate')
],'核 Berkeley Mechanical Engineering 2004–2006 博后项目、人事档或本人 CV，以追查 Majumdar 候选。');
relation(b,be,'phd',gast,'advisor',bText,ids('bc','br'),'gast');

const k='67a130a4',kn='Scott Keene',salleo=records.get('fb1eaf13').filename;
const kText='Stanford 博士学位目录（13680839）列 Scott Tom Keene、2020 年 Materials Science and Engineering 博士及论文 Utilizing the electrochemical properties of organic mixed conductors for bioelectronic devices，将 Alberto Salleo 具名列为 degree supervisor。Appel 与 Bao 的角色分别为 degree committee member。Rice 本人档同列 2020 博士。关系可信度高。';
const kSource=src(['Stanford 博士学位目录','kc'],['Rice 本人履历','kr']);
updateEdge(k,kn,salleo,'Alberto Salleo','博士阶段研究师长','博士阶段研究者','博士导师','博士生',kText,kSource);
rewrite(pf(k),x=>x.startsWith(boundary),()=>boundary+'Stanford 学位目录及 Rice 本人档均列 2020 年博士；此前 2021 毕业典礼册的同题名记录保留。Salleo 为 degree supervisor，Appel 和 Bao 列 degree committee member。两位 Cambridge 博后导师沿用原证，MSCA 资助区间与全部任用月份分别核查。 '+kSource);
cell(k,2,'Alberto Salleo（2020 Stanford 博士 degree supervisor）');
schoolWith(k,kSource);
const ke=audit(k,[
 a('identity','Stanford 学位目录全名 Scott Tom Keene 与 Rice Scott Keene 同题名、同年学位及有机电子方向匹配。',['kc','kr'],'confirmed'),
 a('affiliation','Rice Materials Science and NanoEngineering 助理教授，2024 年 7 月入职。',['kr'],'confirmed'),
 a('research','有机离子电子混合导体、生物电子与神经形态记忆器件。',['kr','kc'],'confirmed'),
 a('phd',kText,['kc','kr'],'confirmed_advisor')
],'查 Cambridge 全部博后任用起止月份；保留正式导师与两位委员会成员的角色差异。');
relation(k,ke,'phd',salleo,'advisor',kText,ids('kc','kr'),'salleo');

const r='23673c4c';
const rText='Imperial College London Spiral 原始书目列 Nicholas Read 的博士论文 Low temperature properties of models for mixed-valence compounds，1986 年发表及授位，授予 Doctor of Philosophy，Department of Mathematics，列入 University of London awarded theses - Imperial authors。Yale 原档列 London University 1986 PhD。书目未给指导人，PDF 页面需安全验证，Newns 保留博士候选。';
pl(r,boundary,'本轮在 Imperial Spiral 核到 1986 博士论文题名和授位，下载原件遇安全验证。 '+src(['Imperial 学位原档','rc'])+' 正式导师仍待论文前页。');
cell(r,2,'Dennis M. Newns（博士候选）；1986 Imperial 论文题名及授位已核');
schoolWith(r,src(['Imperial 博士原档','rc'],['Yale 物理系','yr']));
audit(r,[
 a('identity','Imperial 原档为 Nicholas Read、1986 数学博士、混合价模型方向；Yale 原档同列 London 1986 博士及凝聚态理论。',['rc','yr'],'confirmed'),
 a('phd',rText,['rc','yr'],'group_or_candidate'),
 a('research','凝聚态理论；博士论文为混合价模型低温性质。',['rc','yr'],'confirmed')
],'论文原件公开下载遇安全验证，保存入口后暂停该文件自动访问；继续从其他原档核 Newns，追 Brown 和 MIT 博后指导。');

const e='ee4791b0';
const eText='Stanford Libraries 学位原档（2180701）列 Chang-Beom Eom 的 1991 年材料科学与工程博士论文 Synthesis and properties of high Tc superconducting thin films and multilayers grown in situ by 90° off-axis sputtering，索书号 3781 1991 E。书目作者及年代与 Wisconsin 本人档一致，当前目录未列个人导师。';
pl(e,boundary,'已核读 Stanford 博士论文题名和学位目录，目录缺个人导师字段。 '+src(['Stanford 学位目录','ec']));
cell(e,2,'Stanford 1991 博士论文题名及学科已核；个人指导待签署页');
schoolWith(e,src(['Stanford 学位原档','ec'],['Wisconsin 工程学院','er']));
audit(e,[
 a('identity','Stanford 1991 学位目录的作者与 Wisconsin 教师教育履历及氧化物薄膜方向一致。',['ec','er'],'confirmed'),
 a('affiliation','Wisconsin–Madison Materials Science and Engineering，Theodore H. Geballe Professor。',['er'],'confirmed'),
 a('research','复杂氧化物外延薄膜、异质结构、纳米结构和铁电多铁材料。',['er'],'confirmed'),
 a('phd',eText,['ec','er'],'unresolved')
],'追查索书号 3781 1991 E 的论文签署或 DAI 原刊导师栏；既有旧 KGB 网址 404，保留该失败，另追 Bell Labs 博后指导。');

const pages=[
 [b,'bc','Stanford Libraries 5686690, author Sibani Lisa Biswal, 2004 PhD Chemical Engineering. Alice P. Gast is explicitly primary advisor.','浏览器核读原始书目明确主导师。'],
 [b,'br','Rice identifies Biswal’s Chemical and Biomolecular Engineering chair and joint Materials Science and NanoEngineering appointment, Stanford 2004 PhD and Berkeley 2004–2006 Mechanical Engineering postdoc.','核同人、两院系、研究及博后。'],
 [k,'kc','Stanford Libraries 13680839 identifies Alberto Salleo as degree supervisor; Eric Appel and Zhenan Bao as degree committee members; Scott Tom Keene 2020 PhD.','逐项区分导师与委员。'],
 [k,'kr','Rice biography records Scott Keene’s 2020 Stanford PhD, Cambridge Marie Curie postdoc and July 2024 Rice faculty appointment.','核 2020 学位、博后及现任。'],
 [r,'rc','Low temperature properties of models for mixed-valence compounds, Nicholas Read. Doctoral, PhD, Department of Mathematics, Imperial College London. Date issued and date awarded 1986.','浏览器核原始书目，无导师字段。'],
 [r,'yr','Yale Physics lists Read’s London University 1986 PhD and condensed matter theory research.','校方独立核学位和研究身份。'],
 [e,'ec','Stanford Libraries 2180701, author Chang-Beom Eom, PhD 1991, Department of Materials Science and Engineering. Call number 3781 1991 E.','浏览器核博士原档题名与学位，无导师字段。'],
 [e,'er','Wisconsin Engineering identifies Eom’s materials science faculty appointment, oxide heteroepitaxy research and Stanford 1991 PhD.','身份院系与研究核验。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:r,url:u.rp,error:'浏览器显示 Let’s confirm you are human / Complete the security check；需要人机验证，停止自动访问该下载文件。'});
pages.push({record_id:'6f9f046d',url:u.oh,error:'浏览器显示 Making sure you’re not a bot! / Protected by Anubis；需要人机验证，停止自动访问该目录。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0218_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0218_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0218_Stanford及Imperial学位目录回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
