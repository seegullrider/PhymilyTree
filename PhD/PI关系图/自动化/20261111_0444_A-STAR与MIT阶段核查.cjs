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
 orig.audit_id='pi_archive_20261111_0444_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0444_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"gd":"https://mems.duke.edu/people/michela-geri/","gc":"https://criticalminerals.duke.edu/team/","gp":"https://pratt.duke.edu/news/michela-geri-developing-particulate-systems-for-environmental-and-sustainability-endeavors/","gt":"https://tasan.mit.edu/team/","ga":"https://proceedings.aiche.org/conferences/aiche-annual-meeting/2021/proceeding/paper/4bw-thermo-mechanics-energy-and-environmental-applications","ja":"https://research.a-star.edu.sg/researcher/james-lourembam/","jo":"https://orcid.org/0000-0003-2606-8073","japi":"https://pub.orcid.org/v3.0/0000-0003-2606-8073/record","je":"https://cordis.europa.eu/project/id/891778","jn":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10097601/","dh":"https://www.a-star.edu.sg/docs/librariesprovider16/events-documents/astar-mini-symposium-on-quantum-scitech-booklet-7-mar-2023-(final_v2).pdf#page=11","dp":"https://ece.princeton.edu/news/graduate-commencement-celebrates-critical-contributions-doctoral-and-masters-students","dg":"https://sites.google.com/view/deleonlab/people/alumni","xa":"https://research.a-star.edu.sg/researcher/xuezhi-ma/","xl":"https://lan.engr.tamu.edu/team/","sac":"https://meche-dev.mit.edu/sites/default/files/cv/McKinley_CV_2017_Summary.pdf#page=3","sad":"https://www.meche.engineering.cmu.edu/directory/bios/anna-shelley.html","sab":"https://ptacts.uspto.gov/ptacts/public-informations/petitions/1463862/download-documents?artifactId=T1RZ7UVvraLGDlEV7FSz9ZWnyFOWCwtwd5Yf-Ai1GZ3XTbNkxZsR1SE","ws":"https://electronic.seu.edu.cn/wj2/list.htm","wa":"https://research.a-star.edu.sg/researcher/jing-wu/","wp":"https://www.nature.com/articles/ncomms7485","db":"https://www.bu.edu/eng/profile/luca-dal-negro/","dd":"https://tesidottorato.depositolegale.it/handle/20.500.14242/257641","du":"https://www.bu.edu/nano/people/","av":"https://graphene.nus.edu.sg/event-details?title=423","pin":"https://research.nus.edu.sg/jingshengchen/teaching/","pins":"https://www.sutd.edu.sg/profile/ho-pin","ta":"https://www.cambridge.org/core/journals/mrs-bulletin/article/meet-our-authors/3385F3DDB315D27FB28590B34C705272","tu":"https://che.engin.umich.edu/people/tuteja-anish/"};
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




const g='3a13407d', j='569f0600', d='b3f015ee', x='8c2b41f5', s='f7ff1244', w='75970cd9', t='e76f344b';
const ts='师承人物 - Cem Taşan', sf='师承人物 - Gareth H. McKinley';
const gpd='MIT Taşan 组原始成员档在 Postdoctoral Scholars 标题下具名 Michela Geri，并列下一任职 Duke MEMS。Duke 入职公告称其 2023 年仍在 MIT 任博士后，Duke 任用自 2024 年 1 月开始。组属可信度高，具名正式指导仍待核。';
const gl=src(['MIT Taşan 实验室原页','gt'],['Duke 入职公告','gp'],['本人 AIChE 简介','ga']);
updateEdge(g,'Michela Geri',ts,'Cem Taşan','博士后合作及导师候选','博士后合作及导师候选','博士后课题组负责人','博士后课题组成员',gpd,gl);
rewrite(pf(g),v=>v.startsWith(boundary),()=>boundary+'MIT 学位馆藏具名 Gareth H. McKinley 为博士导师。'+gpd+' '+gl);
cell(g,3,'Cem Taşan（MIT 博士后课题组负责人，正式称谓待核）');
schoolWith(g,gl+' · '+src(['Duke 跨院系任用','gc']));
const ga=audit(g,[a('identity','Taşan 实验室博士后名录列后续 Duke MEMS 助理教授，与 Duke 官方档匹配。',['gt','gd','gp'],'confirmed'),
 a('affiliation','Duke 机械工程与材料科学系助理教授，兼任土木与环境工程系。',['gd','gc'],'confirmed'),
 a('research','多相材料力学、软物质、复杂流体和流变学。',['gd','gc'],'confirmed'),
 a('postdoc',gpd,['gt','gp','ga'],'group_or_candidate')],'继续查 MIT 博士后起月、任用文件与 Taşan 正式指导称谓。');
relation(g,ga,'postdoc',ts,'group_leader',gpd,ids('gt','gp','ga'),'tasan_group');

const jpd='本人 ORCID 公共履历将 Manchester Physics and Astronomy／National Graphene Institute 的 Marie Skłodowska-Curie Individual Fellow 任期列为 2021 年 8 月至 2022 年 12 月。CORDIS 的项目日期与任用月份分列。论文具名的项目监督者保持个人指导候选。';
const jph='本人 ORCID 列 2011 年 8 月至 2015 年 11 月在 NTU 物理与应用物理读博，A*STAR 档将学位年列 2016。Tom Wu 的博士组属依据实验室档，正式学位导师待核。';
pl(j,boundary,jph+' '+jpd+' '+src(['本人 ORCID','jo'],['ORCID 原始履历','japi'],['A*STAR 档','ja'],['CORDIS 项目日期','je']));
cell(j,2,'Tom Wu（博士课题组负责人）；本人登记 2011–2015 在读，A*STAR 记 NTU 博士 2016');
cell(j,3,'Manchester 2021-08 至 2022-12 Marie Skłodowska-Curie 博士后；Berdyugin、Geim、Ponomarenko 为项目监督者及个人导师候选');
schoolWith(j,src(['本人 ORCID','jo'],['A*STAR 原档','ja']));
audit(j,[a('identity','ORCID 本人登记 A*STAR IMRE 与 Manchester 身份，同 A*STAR 及论文资助号匹配。',['japi','ja','jn'],'confirmed'),
 a('affiliation','A*STAR IMRE Senior Scientist，SpEED 团队 PI。',['ja','japi'],'confirmed'),
 a('research','自旋电子、量子磁性材料及相关器件。',['ja','je','jn'],'confirmed'),
 a('phd',jph,['japi','ja'],'group_or_candidate'),a('postdoc',jpd,['japi','je','jn'],'group_or_candidate')],'查 NTU 学位授予日期及正式导师，核 Manchester 任用指导与项目接收教师。');

const dh='A*STAR 2023 会议原册第 11 页称 Ding Huang 于 2021 年获 Princeton 博士并加入 A*STAR IMRE，列 2023 Scientist I。de Leon 组校友档记前博士生、后来 A*STAR IMRE 研究员。现有公开资料未单列博士后任用，2021 初聘职称仍需人事原档。';
const dp='Princeton ECE 将 Ding Huang 列 2021–2022 学年毕业生并明确 Nathalie de Leon 为学位论文导师；A*STAR 原册所载博士时间为 2021。';
pl(d,boundary,dh+' '+src(['A*STAR 会议原册第 11 页','dh'],['导师实验室校友档','dg']));
cell(d,3,'2021 年获博士并加入 A*STAR IMRE，2023 年列 Scientist I；目前未见单列博士后任用');
schoolWith(d,src(['A*STAR 会议原册第 11 页','dh'],['Princeton ECE','dp'],['导师组校友','dg']));
audit(d,[a('identity','Princeton ECE 的量子网络博士、de Leon 组校友与 A*STAR IMRE Scientist I 匹配。',['dp','dg','dh'],'confirmed'),
 a('affiliation','A*STAR IMRE 科学家。',['dh','dg'],'confirmed'),
 a('research','二维范德华材料量子器件、超导电路及金刚石缺陷量子网络。',['dh','dp'],'confirmed'),
 a('phd',dp,['dp','dh'],'confirmed_advisor'),a('postdoc',dh,['dh','dg'],'no_postdoc_documented')],'继续核实 2021 A*STAR 初聘职称与有无短期博士后，保留学位时间与典礼学年。');

const xd='A*STAR 本人档具名 2019 UC Riverside 电气工程博士及 Texas A&M 机械工程系博士后；Lan 本人团队原档列 2019 年 11 月至 2021 年 11 月为博士后组员，离组后赴 A*STAR。组属可信度高，正式导师称谓仍待核。';
pl(x,boundary,xd+' '+src(['A*STAR 本人原档','xa'],['Lan 实验室名录','xl']));
cell(x,3,'Shoufeng Lan（Texas A&M 机械工程博士后课题组负责人，2019-11 至 2021-11）');
schoolWith(x,src(['A*STAR 本人原档','xa'],['Lan 实验室名录','xl']));
audit(x,[a('identity','A*STAR 及 Texas A&M 实验室履历中的学位、博后去向与研究匹配。',['xa','xl'],'confirmed'),
 a('affiliation','A*STAR IMRE Scientist；高校任用未获新证。',['xa'],'confirmed'),
 a('research','量子光学、极化激元、近场与超快光学、二维材料激子及光子器件。',['xa'],'confirmed'),
 a('postdoc',xd,['xa','xl'],'group_or_candidate')],'查 Texas A&M 任用中的个人指导称谓；待既有站点退避结束后复核 UC Riverside 学位原卷。');

const sp='MIT 机械系所存 McKinley 本人 2017 CV 第 3 页将 Shelley L. Anna 列在 Graduate Students 栏；本人履历确认 Harvard 2000 工程科学博士和论文题名。该栏目证实博士阶段组属，正式论文导师继续待原学位档。';
const spl=src(['MIT 原载 McKinley CV 第 3 页','sac'],['Anna 本人 CV','sab']);
updateEdge(s,'Shelley Anna',sf,'Gareth H. McKinley','博士阶段课题组负责人','博士阶段课题组成员','博士阶段课题组负责人','博士阶段课题组成员',sp,spl);
pl(s,boundary,sp+' '+spl);
schoolWith(s,spl);
const sa=audit(s,[a('identity','McKinley CV 的 Shelley L. Anna 与本人学位 CV 及 CMU 教师档匹配。',['sac','sab','sad'],'confirmed'),
 a('phd',sp,['sac','sab'],'group_or_candidate')],'从 Harvard 学位馆藏或授权论文封面确认正式博士导师，保留 Howard Stone 博士后导师的既有明确证据。');
relation(s,sa,'phd',sf,'group_leader',sp,ids('sac','sab'),'mckinley_group');

const wp='东南大学本人履历明确 2010–2015 NUS 凝聚态物理博士、2014–2015 CA2DM 研究助理。2015 年原刊同列 NUS 物理系、CA2DM 和 NanoCore，研究主题及同期履历吻合，Özyilmaz 保留为博士导师候选。';
const wpd='东南大学履历直接列 2015–2016 NUS ECE 博士后；本轮未获具名个人指导。';
pl(w,boundary,wp+' '+wpd+' '+src(['东南大学院系原档','ws'],['A*STAR 历史履历','wa'],['同期 Nature Communications 原刊','wp']));
cell(w,2,'NUS 2015 凝聚态物理博士；Barbaros Özyilmaz（同期同机构合著候选）');
schoolWith(w,src(['东南大学院系','ws'],['A*STAR 历史履历','wa'],['同期原刊','wp']));
audit(w,[a('identity','东南大学院档明确中文姓名吴靖，浙江本科、NUS 博士、A*STAR NETT 与 NUS MSE 兼职时间相合。',['ws','wa'],'confirmed'),
 a('affiliation','2024 年起东南大学电子科学与工程学院教授、研究员，属微电子学与固体电子学系。A*STAR IMRE 与 NUS MSE 为历史任用。',['ws','wa'],'confirmed'),
 a('research','二维量子材料的热、声子、热电及电荷输运，散射物理及相关电子器件。',['ws','wa','wp'],'confirmed'),
 a('phd',wp,['ws','wa','wp'],'group_or_candidate'),a('postdoc',wpd,['ws'],'unresolved')],'用吴靖／Jing Wu 和 NUS Physics 2010–2015 检索学位论文，再以 2015–2016 ECE 追博士后任用及导师。');

const tp='Tuteja 作者简介明确 2006–2009 年为 MIT Postdoctoral Associate，与 Robert E. Cohen 和 Gareth H. McKinley 共事；Michigan 化工履历另列 MIT 化工博后。现有两位博士后阶段研究师长的证据成立，正式任用指导头衔待核。';
pl(t,boundary,tp+' '+src(['MRS Bulletin 作者简介原页','ta'],['Michigan 化工原档','tu']));
cell(t,3,'Robert E. Cohen、Gareth H. McKinley（MIT 2006–2009 博士后阶段研究师长）');
schoolWith(t,src(['MRS Bulletin 作者简介','ta'],['Michigan 化工','tu']));
audit(t,[a('affiliation','Michigan 材料系任用及化工系 courtesy 由系档确认。',['tu'],'confirmed'),
 a('research','超疏液界面、膜与液液分离、高分子纳米复合材料。',['tu','ta'],'confirmed'),
 a('postdoc',tp,['ta','tu','sac'],'group_or_candidate')],'追 Michigan State 2006 博士论文和 MIT 两位博后研究师长的正式任用指导称谓。');

const pages=[
 [g,'gt','Downloaded original MIT Taşan Group HTML, HTTP 200, SHA-256 9d4b656730004e67d62038b5ef1116bf7fdeb0a44d06f948d22c1981712b5318. Heading Postdoctoral Scholars; Michela Geri; topic chemo-mechanics of solid state batteries and hydrogen embrittlement in alloys; moved to Duke MEMS assistant professor.','核博士后组属和身份。'],
 [g,'gp','Duke October 25, 2023 report identifies Geri as then MIT postdoctoral associate; Duke MEMS appointment starts January 1, 2024.','核时间界限。'],
 [g,'gc','Duke project biography lists Duke MEMS assistant professor with CEE courtesy, studies rheology, mechanics, transport and particulate systems.','核现任及研究。'],
 [j,'japi','HTTP 200 ORCID public record. Self-asserted education NTU Physics and Applied Physics PhD 2011-08 to 2015-11. Manchester Physics and Astronomy / NGI Marie Sklodowska-Curie Individual Fellow 2021-08 to 2022-12. IMRE Scientist since 2018-06.','核个人任用日期、学籍月份与职位。'],
 [j,'ja','A*STAR profile lists James Lourembam, IMRE, NTU PhD and Manchester Marie Sklodowska-Curie postdoctoral stage.','核身份、任用和研究。'],
 [d,'dh','A*STAR 2023 program p. 11: Ding Huang Scientist I, IMRE, PhD Princeton 2021, joined IMRE A*STAR 2021; quantum devices with 2D materials.','博士与入职同年，未见独立博士后任用。'],
 [d,'dp','Princeton ECE 2022 commencement: Ding Huang, Ph.D.; Adviser Nathalie de Leon; thesis on neutral silicon vacancy centers in diamond.','核正式博士导师与典礼学年。'],
 [x,'xa','Xuezhi Ma, Scientist at A*STAR IMRE; previously postdoc at Department of Mechanical Engineering, Texas A&M; PhD in Electrical Engineering at UC Riverside in 2019.','核博后任用院系、学位与研究。'],
 [s,'sac','MIT-hosted McKinley CV, p. 3, Graduate Students list includes Shelley L. Anna.','核博士阶段组属。'],
 [w,'ws','Southeast University lists 吴靖/Wu Jing, NUS 2010–2015 condensed matter PhD, 2014–2015 CA2DM research assistant, 2015–2016 NUS ECE postdoc, 2024–present SEU electronic science and engineering.','核中文姓名、任职时间及研究。'],
 [w,'wa','A*STAR Research lists Jing Wu as NETT group leader at IMRE and NUS adjunct assistant professor; research on low-dimensional thermal and thermoelectric transport.','交叉确认历史任用及训练。'],
 [t,'ta','Anish Tuteja biography: 2006 chemical engineering PhD at MSU; MIT postdoctoral associate with Robert E. Cohen and Gareth H. McKinley from 2006 to 2009.','核两位具名研究师长及博士后时段。'],
 ['e0fc6317','db','Boston University College of Engineering identifies Luca Dal Negro as professor in ECE, Materials Science and Engineering, and Physics.','复核院系和纳米光子学研究。'],
 ['db3c5103','pins','SUTD profile lists NUS MSE doctorate in 2013, MIT research associate on A*STAR fellowship before 2016 IMRE hire.','核本人学位与博士后时序。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key].split('#')[0],raw,excerpt}));
pages.push(
 {record_id:'e0fc6317',url:u.dd,error:'503 Service Unavailable from official catalogue; search indexing retained as a lead, existing advisor label preserved pending original field.'},
 {record_id:'dff565f5',url:u.av,error:'502 Bad Gateway in web reader; direct DNS resolution failed. Indexed text retained as a lead; no relationship upgrade from search result.'},
 {record_id:'db3c5103',url:u.pin,error:'Browser tool redirect loop; direct HTTP returned a human verification interstitial without page content. Preserve candidate and stop automated attempts to this page.'}
);
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0444_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0444_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0444_新加坡及MIT阶段原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
