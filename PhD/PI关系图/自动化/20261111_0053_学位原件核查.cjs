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
 orig.audit_id='pi_archive_20261111_0053_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0053_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"ant":"https://citeseerx.ist.psu.edu/document?doi=357e3aca46306652f25cf32b362f8eca9c6ad534&repid=rep1&type=pdf","colo":"https://www.colorado.edu/today/2000/02/07/two-cu-boulder-physics-professors-receive-560000-nsf-career-awards","uw":"https://phys.washington.edu/people/anton-andreev","bedcv":"https://bedzyk.mccormick.northwestern.edu/files/BedzykCV2018.pdf","iop":"https://www.iop.cas.cn/xshd/zgclt/202005/t20200514_5579906.html","desy":"https://www-library.desy.de/preparch/desy/int_rep/sr-84-012.pdf","mater":"https://www.desy.de/news/news/archive_before_2010/2003/desy_0601/index_eng.html","esrf":"https://www.esrf.fr/files/live/sites/www/files/news/ESRFNews/2013_12.pdf","nw":"https://physics.northwestern.edu/people/faculty/affiliated-faculty/michael-bedzyk.html","alb":"https://www.albany.edu/physics/graduate-programs/past-dissertations","epfl":"https://infoscience.epfl.ch/record/262816/files/EPFL_TH9183.pdf","epflDir":"https://www.epfl.ch/education/phd/edmx-materials-science-and-engineering/edmx-published-theses/","cer":"https://people.epfl.ch/michele.ceriotti/?lang=en","ista":"https://ist.ac.at/wp-content/uploads/2025/05/ISTA_Annual_Report_2024_EN_WEB_Final.pdf","ber":"https://chemistry.berkeley.edu/node/2526","cam":"https://www.admin.cam.ac.uk/reporter/2018-19/weekly/6535/section12.shtml","bu":"https://www.bu.edu/eng/profile/siddharth-ramachandran/","bur":"https://www.bu.edu/photonics/files/2014/01/BUPC-2009-2010-Annual-Report.pdf","bucv":"https://sites.bu.edu/ramachandranlab/files/2024/08/siddharth_CV.pdf","nus":"https://phyweb.physics.nus.edu.sg/~phyeda/members.html","nusnews":"https://news.nus.edu.sg/assoc-prof-goki-eda-beneath-the-2d-surface/"};
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




const ant='628a2d54', bed='61a1d1e2', cheng='e2ebf9d2', sid='60f28cf8', goki='6131eaf6';
const andreev='1996 年 MIT 物理博士论文 *Random Matrices, Quantum Chaos and Irreversible Classical Dynamics* 扉页签署栏具名 Boris Altshuler 为 Thesis Supervisor，摘要再次署其为导师。可信度：高。';
const sant=src(['MIT 论文扉页与摘要原件','ant']);
updateEdge(ant,'Anton Andreev','人员 - Columbia - Boris Altshuler - 8da135b8','Boris Altshuler','博士导师候选','博士生候选','博士导师','博士生',andreev,sant);
const antPost='Colorado 的任职档分别列 Princeton 的 NEC Research Institute visiting scientist 和 Santa Barbara Institute for Theoretical Physics postdoctoral fellow，且注明 1998 年 8 月加入 Colorado。Santa Barbara 的个人指导者待核。';
rewrite(pf(ant),x=>x.startsWith('- 阶段经历：'),()=>'- 博士后及访问经历：'+antPost+' '+src(['CU Boulder 校方档案','colo']));
rewrite(pf(ant),x=>x.startsWith(boundary),()=>boundary+'博士论文已核读。博士后指导者待查。');
cell(ant,2,'Boris Altshuler（博士导师）');
cell(ant,3,'Santa Barbara 理论物理研究所博士后；另有 Princeton NEC 访问，个人指导待核');
cell(ant,4,sant+' · '+src(['CU Boulder 任职档','colo'],['UW 物理系','uw'])+' |');
const aa=audit(ant,[
 a('identity','MIT 论文作者 Anton Valerievich Andreev 与 CU Boulder 履历所列的 1996 MIT 物理博士及 UW 教师档相符。',['ant','colo','uw'],'confirmed'),
 a('affiliation','University of Washington Seattle 物理系。',['uw'],'confirmed'),
 a('research','凝聚态理论，电子输运与拓扑量子材料。',['uw'],'confirmed'),
 a('phd',andreev,['ant','colo'],'confirmed_advisor'),
 a('postdoc',antPost,['colo'],'unresolved')
],'继续查 UCSB KITP 历史任职名单或个人 CV 中具名的博士后指导。');
relation(ant,aa,'phd','人员 - Columbia - Boris Altshuler - 8da135b8','advisor',andreev,ids('ant','colo'),'altshuler');

const bpost='本人 CV 列 1982–1984 DESY HASYLAB Research Associate，1984–1991 Cornell CHESS Staff Scientist。中科院物理所报告介绍将 DESY 任期明确称为博士后。';
const bcan='DESY 1984 年内部报告将 Bedzyk 与 Gerhard Materlik 同列 HASYLAB 的 X 射线驻波工作作者。ESRF 履历列 Materlik 1978–1985 年为 Research Associate，1986 年起任 HASYLAB 主任。仅记录博士后期间具名合作者线索，指导关系可信度低。';
const bsrc=src(['本人 CV','bedcv'],['中科院物理所报告档','iop'],['DESY 内部报告','desy'],['ESRF 履历','esrf']);
mentor('师承人物 - Gerhard Materlik','Gerhard Materlik','DESY 同步辐射研究人员，1986 年起任 HASYLAB 主任。',src(['DESY','mater'],['ESRF 履历','esrf']));
edge(bed,'Michael Bedzyk','师承人物 - Gerhard Materlik','Gerhard Materlik','博士后导师候选','博士后研究者候选',bcan,bsrc);
rewrite(pf(bed),x=>x.startsWith(boundary),()=>boundary+'Albany 物理系论文目录列 Walter Gibson 为博士导师。'+bpost+' DESY 正式指导者待查。 '+bsrc);
cell(bed,3,'DESY HASYLAB 博士后（1982–1984）；Gerhard Materlik（同期合作者，候选）');
schoolWith(bed,bsrc+' · '+src(['Northwestern 物理系','nw']));
const ba=audit(bed,[
 a('identity','本人 CV、Northwestern 教师档与中科院报告档一致，学位档另列 1982 年博士论文。',['bedcv','nw','iop','alb'],'confirmed'),
 a('affiliation','Northwestern 材料科学与工程系、物理与天文学系，应用物理项目。',['nw','bedcv','iop'],'confirmed'),
 a('research','以同步辐射 X 射线散射、驻波和成像研究界面、薄膜与纳米结构。',['nw','bedcv','iop'],'confirmed'),
 a('postdoc',bpost+' '+bcan,['bedcv','iop','desy','esrf'],'group_or_candidate')
],'查 HASYLAB 1982–1984 人事、项目组年报及本人履历其他版本，确认该博士后阶段具名指导者。');
relation(bed,ba,'postdoc','师承人物 - Gerhard Materlik','candidate',bcan,ids('bedcv','iop','desy','esrf'),'materlik');

const chphd='EPFL 2019 年博士论文第 9183 号 *Predicting homogeneous nucleation rate from atomistic simulations* 扉页将 M. Ceriotti 列为 directeur de thèse。EPFL 目录和导师校方名录核对全名。可信度：高。';
const chLinks=src(['EPFL 论文原件','epfl'],['EPFL 博士论文目录','epflDir'],['Ceriotti 的 EPFL 名录','cer'],['Berkeley 教师档','ber']);
updateEdge(cheng,'Bingqing Cheng','师承人物 - Michele Ceriotti','Michele Ceriotti','博士导师','博士生','博士导师','博士生',chphd,chLinks);
const chpost='ISTA 2024 年报分列 2019 Trinity College Junior Research Fellow、2020–2021 Cambridge Departmental Early Career Fellow，以及之后的 ISTA 助理教授任用。Cambridge 校方公告列 Trinity Title A Fellowship 2019-10-07 起，未指明个人指导。';
rewrite(pf(cheng),x=>x.startsWith(boundary),x=>x.replace('EPFL 论文下载为签名 CDN 重定向，本轮未取到原文。','EPFL 论文原件已从校库旧版稳定链接核读。')+' '+src(['EPFL 论文原件','epfl'],['ISTA 2024 年报','ista']));
schoolWith(cheng,src(['EPFL 论文原件','epfl'],['ISTA 2024 年报','ista']));
const ca=audit(cheng,[
 a('identity','EPFL 论文作者和年份与 ISTA 年报及 Berkeley 化学系教师页相符。',['epfl','ista','ber'],'confirmed'),
 a('affiliation','UC Berkeley 化学系，ISTA 年报同时记载 2024 年起有 ISTA 访问教授任用。',['ber','ista'],'confirmed'),
 a('research','基于机器学习的原子模拟、材料热力学与成核等。',['ber','epfl'],'confirmed'),
 a('phd',chphd,['epfl','epflDir','cer','ber'],'confirmed_advisor'),
 a('postdoc',chpost,['ista','cam'],'unresolved')
],'追 Cambridge 两项 fellowship 申请或研究档，核对有无具名 host 或导师。');

const sidpost='BU 光子学中心年报明确记载 1998 年获 Illinois 电气工程博士，并于同年 11 月以 Member of Technical Staff 身份加入 Bell Labs。既有本人履历也列该工业岗位，目前未发现博士后任用。';
const sidphd='BU 年报确认其在 Illinois 博士研究聚焦掺稀土硫系玻璃。同期 S. G. Bishop 合著仍是追查线索。Illinois 馆藏搜索中出现题名 Photoinduced Optical Integrated Circuits and Bulk Photonic Devices in Chalcogenide Glasses，待打开可核读的学位记录和签字页。';
rewrite(pf(sid),x=>x.startsWith(boundary),()=>boundary+sidphd+' '+sidpost+' '+src(['BU 光子学中心 2009–2010 年报','bur'],['本人 CV','bucv']));
cell(sid,3,'未见博士后任用；1998 年 11 月起 Bell Labs 技术人员');
schoolWith(sid,src(['BU 光子学中心 2009–2010 年报','bur'],['BU 工程学院','bu']));
audit(sid,[
 a('identity','BU 工程学院现任教师档及同期中心年报同列姓名、光子学研究与电气工程任职。',['bu','bur','bucv'],'confirmed'),
 a('affiliation','BU 电气与计算机工程系、物理系及材料科学与工程。',['bu'],'confirmed'),
 a('research','非线性、超快、量子光学与导波光学。',['bu'],'confirmed'),
 a('phd',sidphd,['bur','bucv'],'group_or_candidate'),
 a('postdoc',sidpost,['bur','bucv'],'no_postdoc_documented')
],'按完整题名追 Illinois 校馆原件或 ProQuest 学位论文的导师字段。');

const gpost='本人 NUS 组页列 2009 年 Rutgers 材料博士、随后 Imperial College London Royal Society Newton International Fellow，并于 2011 年加入 NUS。Newton Fellowship 的具名 host 待原档查证。';
rewrite(pf(goki),x=>x.startsWith('- 博士后导师：待核。'),()=>'- 博士后阶段经历：'+gpost+' '+src(['本人 NUS 课题组','nus'],['NUS 新闻','nusnews']));
cell(goki,3,'Imperial College London Newton International Fellow，指导者待核');
schoolWith(goki,src(['NUS 新闻','nusnews']));
audit(goki,[
 a('identity','NUS 本人课题组及 NUS 新闻同列 Rutgers 博士、Imperial Fellowship 和 NUS 任职。',['nus','nusnews'],'confirmed'),
 a('affiliation','NUS 物理系与化学系联合任职。',['nus','nusnews'],'confirmed'),
 a('research','二维半导体、量子材料及光电性质。',['nus','nusnews'],'confirmed'),
 a('postdoc',gpost,['nus','nusnews'],'unresolved')
],'继续找 Rutgers 学位论文签字页和 Imperial/Newton International Fellowship 原始档的具名 host。');

const pages=[
 [ant,'ant','The original 1996 MIT thesis title and abstract pages identify Anton Valerievich Andreev and Boris Altshuler, explicitly Thesis Supervisor.','确认正式博士导师和学位身份。'],
 [ant,'colo','The university profile records an MIT doctorate, a NEC visiting scientist role and a Santa Barbara Institute for Theoretical Physics postdoctoral fellowship before joining Colorado.','分别核实访问职位和博士后经历。'],
 [bed,'bedcv','The CV lists a 1982–1984 Research Associate appointment at HASYLAB, DESY and subsequent CHESS Staff Scientist employment.','核对职业时间和任用单位。'],
 [bed,'iop','The IOP seminar biography describes a postdoctoral fellowship at DESY until the end of 1984.','核实 DESY 博士后性质。'],
 [bed,'desy','The 1984 primary technical report identifies Bedzyk and Materlik as HASYLAB coauthors.','同期合作者候选，导师角色仍待查。'],
 [bed,'esrf','Materlik’s ESRF interview gives his research-associate and HASYLAB directorship dates.','确认当期任职，避免误记其后来的主任职位。'],
 [cheng,'epfl','EPFL doctoral thesis 9183 lists Bingqing Cheng and M. Ceriotti, directeur de thèse, on the front page.','论文原件补强已知正式博士导师。'],
 [cheng,'ista','The 2024 ISTA annual report separately lists the Trinity and Cambridge department fellowships, then ISTA and Berkeley appointments.','区分两个 fellowship 及后续任用。'],
 [cheng,'ber','Berkeley chemistry biography describes the EPFL PhD and computational statistical mechanics research.','核实院系、方向与身份。'],
 [sid,'bur','The Boston University annual report documents a 1998 Illinois PhD in electrical engineering and a Bell Labs Member of Technical Staff appointment starting in November 1998.','区分博士学位和工业任用。'],
 [sid,'bu','The engineering profile lists appointments in ECE, physics and materials, and photonics research.','核实院系和方向。'],
 [goki,'nus','The official NUS group profile records a 2009 Rutgers PhD, Imperial Newton International Fellowship and joint NUS appointment.','核实博士和博士后阶段，指导者待查。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0053_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0053_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0053_学位原件与DESY回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
