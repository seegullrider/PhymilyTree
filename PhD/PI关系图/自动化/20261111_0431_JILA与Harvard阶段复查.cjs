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
 orig.audit_id='pi_archive_20261111_0431_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0431_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"ht":"https://jila-pfc.colorado.edu/sites/default/files/2019-04/LohThesis.pdf","hc":"https://lohlab.quantumlah.org/wp-content/uploads/2023/01/CVLoh_2022.pdf","hd":"https://fitzpatrick.duke.edu/faculty/huanqian-loh","hq":"https://www.cqt.sg/highlight/2017-09-loh-huanqian-travis-nicholson/","hm":"https://cua.mit.edu/people/huanqian-loh","lt":"https://kni.faculty.chemistry.harvard.edu/sites/g/files/omnuum11346/files/kni/files/dissertation-leeliu2019.pdf","lp":"https://www.chem.purdue.edu/people/profile/liu4198","lj":"https://www.colorado.edu/jila/2023/08/17/new-spin-ergodicity-breaking","la":"https://jila-pfc.colorado.edu/sites/default/files/2025-12/Aeppli_thesis_final%20Aug%202025.pdf","ot":"https://edoc.ub.uni-muenchen.de/27832/1/Darkwah_Oppong_Nelson.pdf","oc":"https://www.darkwah-oppong-lab.com/people/nelson-darkwah-oppong","op":"https://www.pma.caltech.edu/people/nelson-darkwah-oppong","oh":"https://www.humboldt-foundation.de/en/connect/explore-the-humboldt-network/singleview/1225474/dr-nelson-darkwah-oppong","om":"https://pure.mpg.de/pubman/item/item_3389159_1/component/file_3389160/Darkwah_Oppong_Nelson.pdf"};
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




const h='b84c9c64', l='753ed215', o='160e8b98';
const yc='师承人物 - Jun Ye', ec='师承人物 - Eric Cornell', dm='师承人物 - Dzmitry Matsukevich', mz='人员 - MIT - Martin Zwierlein - 9b749439';
const hn='Huanqian Loh';
const hp='本人 CV 第 1 页具名 Eric Cornell 为 2013 年 Colorado Boulder 物理博士论文导师；原论文另具名 Jun Ye 为共同导师。CV 在 2006 年 MIT 本科论文条目具名 Vladan Vuletić。';
const hpd='本人 CV 第 1 页把 2013–2014 年博士后列为 NUS CQT Matsukevich 组，把 2015–2017 年列为 NUS CQT 与 MIT Zwierlein 组。CQT 与 CUA 分别支持组属。博士后阶段正式导师称谓待核。';
const hpl=src(['本人 CV 第 1 页','hc'],['本人博士论文','ht']);
const hd1='本人 CV 列 2013–2014 年 NUS CQT 博士后，具名 Matsukevich 组。CQT 2017 介绍对应分子离子研究。课题组关系可信度高。';
const hd2='本人 CV 列 2015–2017 年 NUS CQT 与 MIT 博士后，具名 Zwierlein 组；CUA 成员页确认 MIT 博士后组属。课题组关系可信度高。';
updateEdge(h,hn,ec,'Eric Cornell','博士导师','博士生','博士导师','博士生',hp,hpl);
updateEdge(h,hn,yc,'Jun Ye','博士导师（共同指导）','博士阶段研究者（共同指导）','博士导师（共同指导）','博士生（共同指导）','博士论文致谢称 Jun Ye 为 co-advisor，签字页亦列其姓名。关系类型可信度高。',src(['本人博士论文','ht']));
updateEdge(h,hn,dm,'Dzmitry Matsukevich','博士后课题组负责人','博士后阶段课题组成员','博士后课题组负责人','博士后课题组成员',hd1,src(['本人 CV 第 1 页','hc'],['CQT 同期介绍','hq']));
updateEdge(h,hn,mz,'Martin Zwierlein','博士后课题组负责人','博士后课题组成员','博士后课题组负责人','博士后课题组成员',hd2,src(['本人 CV 第 1 页','hc'],['CUA 成员页','hm']));
rewrite(pf(h),x=>x.startsWith(boundary),()=>boundary+hp+' '+hpd+' '+hpl+' · '+src(['CQT 同期介绍','hq'],['CUA 成员页','hm']));
rewrite(pf(h),x=>x.startsWith('- [MIT 超冷原子中心]')&&x.includes('旧 CV 本轮不可访问'),()=>'- 旧 CV 已恢复读取并核对两段博士后任期。Duke 官方资料核其 ECE 和物理系双聘，研究可编程中性原子阵列及量子信息。 '+src(['本人 CV','hc'],['Duke 官方档案','hd']));
cell(h,3,'Dzmitry Matsukevich（2013–2014 NUS CQT 博士后课题组）、Martin Zwierlein（2015–2017 NUS CQT／MIT 博士后课题组）');
schoolWith(h,src(['本人 CV 第 1 页','hc'],['Duke 官方档案','hd']));
const ha=audit(h,[a('identity','本人 CV、Duke 官方档及原论文身份匹配。',['hc','hd','ht'],'confirmed'),
 a('affiliation','Duke ECE 与物理系助理教授。',['hd'],'confirmed'),
 a('research','可编程中性原子阵列、量子计算与模拟。',['hd'],'confirmed'),
 a('phd',hp,['ht','hc'],'confirmed_advisor'),a('postdoc',hpd,['hc','hq','hm'],'group_or_candidate')
],'依两段任期分别追 NUS CQT 与 MIT 具名博士后导师称谓。');
relation(h,ha,'phd',ec,'advisor',hp,ids('ht','hc'),'cornell');
relation(h,ha,'postdoc',dm,'group_leader',hd1,ids('hc','hq'),'matsukevich');
relation(h,ha,'postdoc',mz,'group_leader',hd2,ids('hc','hm'),'zwierlein');

const ln='Lee Liu', ni='人员 - Harvard - Kang-Kuen Ni - 668139e9';
const lph='本人 2019 年 Harvard 物理博士论文署 Lee Richard Liu，摘要页的 Dissertation Advisor 栏及致谢均明确具名 Kang-Kuen Ni。关系类型可信度高。';
const lpd='Purdue 化学系与 JILA 2023 年同期报道分别确认 JILA 博士后任用；同组 Aeppli 的论文具名此人并明确组属。Jun Ye 按博士后课题组负责人，个人导师称谓待核。';
const lls=src(['Harvard 博士论文原卷','lt'],['Purdue 化学系','lp']);
updateEdge(l,ln,ni,'Kang-Kuen Ni','博士导师','博士生','博士导师','博士生',lph,lls);
rewrite(pf(l),x=>x.startsWith(boundary),()=>boundary+lph+' '+lpd+' '+lls+' · '+src(['JILA 同期报道','lj'],['Aeppli 论文','la']));
cell(l,2,'Kang-Kuen Ni（2019 Harvard 物理博士论文导师）');
schoolWith(l,lls+' · '+src(['JILA 同期报道','lj']));
const lia=audit(l,[a('identity','原论文全名 Lee Richard Liu，对应 Purdue 物理化学教师 Lee R. Liu，学历、研究与 JILA 时段相符。',['lt','lp','lj'],'confirmed'),
 a('affiliation','Purdue 化学系物理化学助理教授。',['lp'],'confirmed'),
 a('research','超冷分子、量子态分辨分子光谱与非线性光学。',['lp','lj'],'confirmed'),
 a('phd',lph,['lt'],'confirmed_advisor'),a('postdoc',lpd,['lp','lj','la'],'group_or_candidate')
],'追 JILA 博士后准确任期及具名正式导师。');
relation(l,lia,'phd',ni,'advisor',lph,ids('lt','lp'),'ni');
relation(l,lia,'postdoc',yc,'group_leader',lpd,ids('lp','lj','la'),'ye_group');

const on='Nelson Darkwah Oppong', ob='师承人物 - Immanuel Bloch', of='师承人物 - Simon Fölling';
const o1='LMU 2021 论文的致谢明确 Immanuel Bloch 指导论文，签署页列其为第一评审。本人履历具名 Bloch 和 Fölling 为博士导师。关系类型可信度高。';
const o2='本人履历明确列 Simon Fölling 为博士导师之一；LMU 论文致谢进一步注明其指导镱实验。关系类型可信度高。';
const o3='本人履历将 LMU 2021–2022 博士后导师列为 Monika Aidelsburger，将 JILA 2022–2025 博士后导师列为 Adam Kaufman。Caltech 和 Humboldt 将 Jun Ye 列为 2022–2024 fellowship host；本人履历另明列 Ye 为早期硕士论文导师，LMU 博士论文致谢记他是 IMPRS-QST 论文咨询委员会成员。';
const ol=src(['LMU 博士论文原卷','ot'],['本人履历','oc']);
updateEdge(o,on,ob,'Immanuel Bloch','博士导师','博士生','博士导师','博士生',o1,ol);
updateEdge(o,on,of,'Simon Fölling','博士导师','博士生','博士导师','博士生',o2,ol);
rewrite(pf(o),x=>x.startsWith(boundary),()=>boundary+o3+' '+ol+' · '+src(['Caltech PMA','op'],['Humboldt 资助档案','oh']));
schoolWith(o,ol+' · '+src(['Caltech PMA','op'],['Humboldt 资助档案','oh']));
const oa=audit(o,[a('identity','LMU 2021 博士论文、本人履历、Caltech PMA 及 Humboldt 资助档身份相符。',['ot','oc','op','oh'],'confirmed'),
 a('affiliation','2025 年起 Caltech 物理助理教授，2023–2025 为 Visiting Associate。',['op','oc'],'confirmed'),
 a('research','可编程中性原子阵列、原子钟、精密量子测量及多体动力学。',['op'],'confirmed'),
 a('phd',o1+' '+o2,['ot','oc'],'confirmed_advisor'),a('postdoc',o3,['oc','op','oh','ot'],'confirmed_advisor')
],'已核两阶段具名导师及其他接待和咨询关系。');
audits.at(-1).followup_required=false;
relation(o,oa,'phd',ob,'advisor',o1,ids('ot','oc'),'bloch');
relation(o,oa,'phd',of,'advisor',o2,ids('ot','oc'),'foelling');

const pages=[
 [h,'hc','CV p. 1: 2013–2014 NUS CQT postdoctoral fellow in Matsukevich group; 2015–2017 CQT and MIT postdoctoral fellow in Zwierlein group; 2013 Colorado PhD advisor Eric Cornell; 2006 MIT SB advisor Vladan Vuletić.','区分两段博士后组属、博士导师及本科论文指导。'],
 [h,'hd','Duke ECE and Physics assistant professor, programmable neutral atom arrays and quantum information.','复核现任和研究。'],
 [l,'lt','2019 Physics PhD, Harvard University, Lee Richard Liu. Abstract header: Dissertation Advisor: Professor Kang-Kuen Ni.','恢复正文读取，明示博士论文导师。'],
 [l,'lp','Purdue Chemistry, Assistant Professor Physical Chemistry, Harvard Physics PhD 2019, JILA postdoctoral research associate, 2024.','核院系、训练、研究。'],
 [l,'lj','August 2023 JILA news identifies Lee Liu as a postdoctoral researcher and lead author of a project led by Jun Ye.','核博士后角色，组属另据 Aeppli 论文。'],
 [o,'ot','LMU 2021 PhD dissertation. Acknowledgements explicitly credit Immanuel Bloch for supervising the thesis and Simon Fölling for overseeing the ytterbium experiment. Jun Ye was on the IMPRS-QST thesis advisory board.','复核博士论文及不同指导角色。'],
 [o,'oc','Lab biography October 31, 2026 lists Bloch and Fölling as PhD advisors, Aidelsburger and Kaufman as the postdoctoral advisors, and Ye as the JILA master thesis advisor.','核导师阶段。'],
 [o,'op','Caltech PMA lists Assistant Professor of Physics since 2025, research on neutral atoms and quantum precision, and Jun Ye as host for 2022–2024 Humboldt fellowship.','核现职、研究与资助 host。'],
 [o,'oh','Humboldt Feodor Lynen 2022 postdoc fellowship lists Jun Ye as host during sponsorship.','核资助期间的接待人。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:o,url:u.om,error:'403 Forbidden; official LMU repository alternative PDF read successfully. Avoid repeat requests to this copy.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0431_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0431_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0431_JILA与Harvard学位回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
