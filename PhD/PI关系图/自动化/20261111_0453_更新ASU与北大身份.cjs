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
 orig.audit_id='pi_archive_20261111_0453_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0453_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"ieee":"https://ewh.ieee.org/r6/phoenix/wad/Abstracts05/Chamberlin.042805.pdf","ralph":"https://asu.elsevierpure.com/en/persons/ralph-chamberlin/","originalR":"https://search.asu.edu/profile/22577","book":"https://libguides.asu.edu/asudissertations/getacopy","keep":"https://keep.lib.asu.edu/collections/149053","cat":"https://search.lib.asu.edu/","ivan":"https://engineering.asu.edu/news/thirty-new-engineering-faculty-2019-2020/","ece":"https://ecee.engineering.asu.edu/2023/06/21/a-rising-star-among-us/","ivanlab":"https://faculty.engineering.asu.edu/isesqueda/research/","torino":"https://wiki.to.infn.it/_media/vlsi/theses/archive/phd/ennio_monteil_phd_thesis.pdf","originalI":"https://provost.asu.edu/sites/default/files/page/2268/ecee-self-study-2021-22-final.pdf","k":"https://faculty.thecollege.asu.edu/kouvetakis","kcv":"https://search.asu.edu/profile/221697/cv","oral":"https://digital.sciencehistory.org/works/x633f188n","qing":"https://qinglab.physics.asu.edu/media/cv/CV_QQing_202504.pdf","ccs":"https://www.chemsoc.org.cn/member/fellow/133761.html","zh":"https://www.whxb.pku.edu.cn/CN/abstract/abstract27303.shtml","qinglib":"https://www.lib.pku.edu.cn/portal/cn/jy/gcjs/xueweilunwenjiansuo","tree":"https://academictree-staging.thetransmitter.org/chemistry/inst.php?locid=231","qingpaper":"https://citeseerx.ist.psu.edu/document?doi=60534ca17d64aef0e89f4fae8e906acdda28746c&repid=rep1&type=pdf","qcatalog":"https://thesis.lib.pku.edu.cn/","conicet":"https://ri.conicet.gov.ar/bitstream/handle/11336/28329/CONICET_Digital_Nro.2b18f5ea-0bf3-4529-aee2-fd78d443e457_A.pdf?sequence=2","qthesis":"https://bdt.semi.ac.cn/download/0.20205642638526766.pdf","h":"https://news.engineering.asu.edu/welcome/josh-hihath/","htao":"https://pmc.ncbi.nlm.nih.gov/articles/PMC7718722/","hn":"https://www.nature.com/articles/s41565-020-0686-5","hdata":"https://www.researchgate.net/publication/253040912_Methods_and_applications_in_single_molecule_electronics"};
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




const R='9e54984b', I='84993a8a', K='ccdc67f2', Q='cd12c287', H='a18ed0a3';
const rl=src(['ASU 公开研究档','ralph'],['IEEE 报告原册','ieee']);
pl(R,boundary,'IEEE 2005 年报告原册第 1 页的讲者履历分别核定 UCLA 1984 年随 Orbach 做自旋玻璃，以及 UPenn 随 Chaikin 研究低维超导体。原册所列 ASU Physics and Astronomy 与校方研究档相符。 '+rl);
for(const [f,m] of [['博士阶段研究师长','师承人物 - Ray Orbach'],['博士后阶段研究师长','人员 - NYU - Paul Chaikin - 9527487c']]){
 const evidence=' [IEEE 报告原册]('+u.ieee+')独立印证该阶段研究与身份。';
 line(pf(R),x=>x.startsWith('- '+f+'：')&&x.includes(m),evidence);
 line(index,x=>x.startsWith('- '+who(R,'Ralph Chamberlin')+' → '+f+'：')&&x.includes(m),evidence);
 line(mf(m),x=>x.startsWith('- 博士')&&x.includes(records.get(R).filename),evidence);
}
schoolWith(R,rl);
audit(R,[a('identity','IEEE 讲者履历使用 Ralph V. Chamberlin，ASU 研究档列 Physics，姓名、方向和单位吻合。',['ieee','ralph']),a('phd','IEEE 报告履历列 UCLA 1984、随 Ray Orbach 研究自旋玻璃，印证原博士阶段指导。论文签署待核。',['ieee','originalR']),a('postdoc','IEEE 报告履历列宾大博士后随 Paul Chaikin 研究低维超导。保留阶段师长，正式职衔待核。',['ieee','originalR'])],'沿 UCLA 纸本学位目录追查博士论文，并核 UPenn 博后任用及指导称谓。');
const il=src(['ASU 入职档','ivan'],['ASU 电气工程系研究报道','ece'],['ASU 学位馆藏获取说明','book']);
pl(I,'- 博士论文追查：','已再次核读参考文献第 48 条。ASU 学位总藏访问出现人机验证，公开馆藏检索入口返回 403。 '+src(['ASU 馆藏说明','book']));
pl(I,boundary,'ASU 2019 年入职档确认 2011 EE 博士及随后 USC 的研究科学家任用，2011 年短期 ASU 博后仍用原自评材料记载。ASU 电气工程系档补证自旋电子学及记忆器件方向。 '+il);
schoolWith(I,il);
audit(I,[a('identity','ASU 2019 入职档确认同名 ECEE 纳米电子学教师、ASU 2011 EE 博士及 USC 任用。',['ivan','ece']),a('affiliation','ASU 电气工程系 2023 官方档和本人实验室核实在该系任职。',['ece','ivanlab']),a('research','电气工程系档补证自旋电子学及记忆器件，实验室原页列二维材料纳米片场效应晶体管等项目。',['ece','ivanlab']),a('phd','ASU 入职档确认 2011 EE 博士；CONICET 托管原文第 48 条复核题名。ASU 库人机验证，馆藏检索返回 403，Barnaby 保留低可信候选。',['ivan','conicet','book']),a('postdoc','ASU 2019 入职档将 USC 阶段列研究科学家，2011 ASU 博后另按院系自评档保留；博后主管待核。',['ivan','originalI'])],'通过其他公开馆藏继续按全论文题名查 2011 ASU 签署页，并追查 2011 博后岗位原档。');
const kl=src(['ASU 本人组履历','k'],['Brewer 口述史原录','oral']);
pl(K,boundary,'本人实验室履历独立核实 Berkeley 1988 固态化学博士与 IBM 1988–1989 博后。该履历将随后 Raychem 任期起年列为 1990，本人 CV 列 1989，月份待核。 '+kl);
schoolWith(K,kl);
audit(K,[a('phd','本人实验室履历复核 1988 Berkeley 固态化学博士，Brewer 口述史称 John 为自己的学生，CV 具名两个 Research Advisors。签署字段待核。',['k','kcv','oral']),a('postdoc','本人实验室与 CV 均列 IBM 1988–1989 博后，CV 明确主管 Bruce Scott；后续 Raychem 任期起年在两份履历中分别为 1990 与 1989。',['k','kcv'])],'继续从 Berkeley 纸本书目检索本人论文。若有原卷，核实 Brewer 和 Bartlett 的签署角色。');
const qe='中国化学会刘忠范本人档列卿泉为 2007 年同一纳电子材料获奖项目成员。期刊参考文献用 Qing Q. 和卿泉标同一作者，本人 CV 记同年同类获奖及 2001–2006 北大物化博士。与原学术树和同期论文共同支持身份、合作与查档线索，刘忠范保留博士导师候选，论文导师字段待核。';
const ql=src(['中国化学会会士档','ccs'],['物理化学学报中英文作者对照','zh'],['本人 CV','qing'],['早期论文原件','qingpaper'],['北大学术树检索线索','tree']);
updateEdge(Q,'Quan Qing','师承人物 - Zhongfan Liu','Zhongfan Liu（刘忠范）','博士导师候选','博士生候选（待核）','博士导师候选','博士生候选（待核）',qe,ql);
pl(Q,boundary,'已核中文姓名卿泉，北大学位库本次访问超时，后续可用中文作者及年份交叉追查。 '+src(['北大学位论文馆藏说明','qinglib'],['姓名核对来源','zh']));
cell(Q,2,'Zhongfan Liu（候选；中文名卿泉已核，同期项目与论文线索）');
schoolWith(Q,ql);
const qa=audit(Q,[a('identity','本人 CV 的奖项类别、年度与中国化学会会士档吻合。物理化学学报同一参考文献并列 Qing Q. 和卿泉，中文名及北大纳米研究身份核实。',['qing','ccs','zh']),a('phd',qe,['qing','ccs','zh','qinglib','tree','qingpaper'])],'按卿泉及 2006 年检索北大中文学位目录，并核查 Lieber 组个人博士后指导证明。');
relation(Q,qa,'phd','师承人物 - Zhongfan Liu','candidate',qe,ids('qing','ccs','zh','tree','qingpaper'),'p1');
const hl=src(['Hihath 与 Lindsay 的出版商预览','hn'],['合著纪念论文原文','htao'],['ASU 工程学院','h']);
pl(H,boundary,'已核纪念论文全文的共同献辞及另一篇出版商公开预览。献辞称 Tao 为 mentor，但无作者逐人及阶段对应。ASU 纸本学位馆藏指引已核，公开检索入口返回 403。 '+hl+' · '+src(['ASU 馆藏获取说明','book']));
schoolWith(H,hl);
audit(H,[a('phd','原纪念论文共同献辞支持进一步查 Tao 指导，未对 Hihath 单独分阶段。ASU 2008 EE 博士已核，论文题名原线索保留，纸本检索入口 403。',['htao','hn','h','book','hdata']),a('postdoc','ASU 工程学院确认本校博士后与随后实验室经理、研究教授是先后任用。同期 Tao 组属保留，个人指导职衔待核。',['h','htao'])],'继续按本人题名和 2008 年查纸本目录与 ProQuest 公共题录，分开核博士导师和博士后任期。');
const page=(record_id,key,excerpt)=>({record_id,url:u[key],raw:excerpt,excerpt});
const fail=(record_id,key,error)=>({record_id,url:u[key],error});
const pages=[
page(R,'ieee','第 1 页讲者履历：Ralph V. Chamberlin，ASU Physics and Astronomy，UCLA 1984 博士随 Orbach 研究自旋玻璃，UPenn 博后随 Chaikin 研究低维超导。'),
page(R,'ralph','Ralph Chamberlin，Professor in Physics and Core Facilities。研究关键词包含自旋玻璃及低温。'),
page(I,'ivan','2019 ASU 入职档，第 401 至 420 行 Ivan Sanchez Esqueda，2011 ASU EE PhD，之后 USC 研究科学家，研究方向纳米电子。'),
page(I,'ece','电气工程系 2023 年页面确认任用与 spintronics、spin-orbitronics、spin-based memory 研究。'),
page(I,'conicet','CONICET 托管论文第 9 页参考文献第 48 条复核 2011 ASU 博士论文题名。'),
fail(I,'torino','预期 PDF 地址返回 Oh noes! HTML，未读到原卷。'),
page(I,'book','ASU Library 指引列馆藏和 ProQuest，其中 ASU 电子学位论文 2011 年起；旧论文可查纸本。'),
fail(I,'keep','ASU 学位总藏返回 JavaScript 人机验证，未取得论文目录。'),
fail(I,'cat','ASU Library Catalog 访问返回 403 Forbidden，未取得题录。'),
page(K,'k','ASU 本人组页 14–17 行列 Raychem 1990–1992、IBM 博后 1988–1989、Berkeley 固态化学 PhD 1988。'),
page(K,'oral','口述史原转录第 24 页，Leo Brewer 称 John Kouvetakis 是自己的学生。'),
page(Q,'ccs','中国化学会档第 185 行列刘忠范、张锦等人与卿泉同获 2007 高校科学技术自然科学一等奖。'),
page(Q,'zh','物理化学学报原页参考文献第 25 条将 Qing Q. 与卿泉列在同一中英文文献的相同作者序位。'),
page(Q,'qing','本人 CV 第 1 页列 2001–2006 北大物理化学博士，2006–2012 Harvard 博后及 2007 教育部自然科学一等奖。'),
page(Q,'qinglib','北京大学图书馆原页提供学位论文的馆藏与检索办法，未取得个人题录。'),
fail(Q,'qcatalog','北大图书馆指向的电子学位库访问超时。'),
fail(Q,'qthesis','中科院半导体所托管 PDF 抓取超时，未读取正文。标题索引显示可能为另一作者论文。'),
page(H,'htao','ACS Nano 全文献辞将 Tao 称为共同作者的 mentor，没有逐人或按训练阶段指派。'),
page(H,'hn','出版商公开预览核为 Joshua Hihath 和 Stuart Lindsay 合写的 Tao 纪念稿，余文需订阅，公开内容未具名学位指导。'),
page(H,'book','ASU Library 指引列 1938–2010 年旧论文为纸本馆藏及 ProQuest 检索范围。'),
fail(H,'cat','ASU Library Catalog 访问返回 403 Forbidden，2008 年论文目录未取得。')
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0453_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0453_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0453_ASU与北大身份原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
