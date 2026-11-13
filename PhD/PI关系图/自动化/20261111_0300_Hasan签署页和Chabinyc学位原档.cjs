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
 orig.audit_id='pi_archive_20261111_0300_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0300_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"pdf":"https://www.osti.gov/servlets/purl/799074","osti":"https://www.osti.gov/biblio/799074","catalog":"https://searchworks.stanford.edu/view/11074749","slac":"https://www.slac.stanford.edu/pubs/slacreports/reports06/slac-r-589.pdf","pr":"https://phy.princeton.edu/people/m-zahid-hasan","cv":"https://zahidhasangroup.scholar.princeton.edu/sites/g/files/toruqf2986/files/documents/MZHasan-cv2026.pdf","appoint":"https://www.princeton.edu/news/2002/04/13/cornel-west-chang-rae-lee-appointed-senior-faculty-posts","group":"https://arpes.stanford.edu/our-people/previous-members","bienen":"https://ahro.slac.stanford.edu/resources/slac-history/faculty-and-staff-biographies/arthur-bienenstock","als":"https://als.lbl.gov/als-staff-honored-with-berkeley-lab-directors-awards/","cc":"https://searchworks.stanford.edu/view/4315741","ucsb":"https://www.materials.ucsb.edu/people/faculty/michael-chabinyc","mrl":"https://www.mrl.ucsb.edu/people/michael-chabinyc","acs":"https://www.organicdivision.org/fellowships/","gwm":"https://www.gmwgroup.harvard.edu/resources"};
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




const h='ad952bdf', hn='M. Zahid Hasan', shen='人员 - Stanford - Zhi-Xun Shen - 177eaec9', laugh='师承人物 - Robert B. Laughlin';
const bienen='师承人物 - Arthur I. Bienenstock', hussain='师承人物 - Zahid Hussain', doniach='师承人物 - Sebastian Doniach';
const thesis=src(['OSTI 论文原件，第 3 页','pdf']);
const shenText='Md-Zahid Hasan 的 Stanford 应用物理博士论文《Charge Dynamics in Low Dimensional Prototype Correlated Systems: A View with High-Energy X-Rays》签署页明确列 Zhi-Xun Shen 为 Principal Advisor。论文扉页 2001 年 11 月，Princeton 学位履历 2002 年。可信度高。';
const laughText='Hasan 的 Stanford 博士论文签署页明确列 Robert B. Laughlin 为 Co-Advisor。Douglas D. Osheroff 与 Eric D. Isaacs 另列审阅签署栏。可信度高。';
updateEdge(h,hn,shen,'Zhi-Xun Shen','博士课题组','博士课题组成员','博士导师','博士生',shenText,thesis+' · '+src(['Princeton 物理系','pr'],['Shen 组','group']));
updateEdge(h,hn,laugh,'Robert B. Laughlin','博士共同导师候选','博士生候选','博士导师','博士生',laughText,thesis);
const hGroup='博士论文第 5 页致谢称 Hasan 研究生初期与 Artie Bienenstock 工作并加入其组，随后进入 Shen 组。早期课题组归属可信度高。';
const hLab='博士论文第 6 页致谢称 Hasan 在 Berkeley Advanced Light Source 研究期间得到 Zahid Hussain 指导，称其在许多意义上是自己的 supervisor。记录博士阶段研究师长。';
const hDon='博士论文第 7 页致谢把 Seb Doniach 称为研究生时期的 mentor，并具体提到其就大分子研究提供帮助。记录博士阶段研究师长。';
mentor(hussain,'Zahid Hussain','Berkeley Lab Advanced Light Source 退休高级研究员，研究软 X 射线仪器。',src(['Berkeley Lab ALS','als']));
edge(h,hn,bienen,'Arthur I. Bienenstock','博士课题组负责人','博士课题组成员',hGroup,src(['OSTI 论文第 5 页','pdf'],['SLAC 人物档','bienen']));
edge(h,hn,hussain,'Zahid Hussain','博士阶段研究师长','博士阶段受指导者',hLab,src(['OSTI 论文第 6 页','pdf'],['Berkeley Lab ALS','als']));
edge(h,hn,doniach,'Sebastian Doniach','博士阶段研究师长','博士阶段受指导者',hDon,src(['OSTI 论文第 7 页','pdf']));
const timeline='本人 2026 CV 列 Princeton Robert H. Dicke Fellow（2002），Bell Laboratories Visiting Scientist（2002–2003）和 SLAC/Stanford Visiting Scientist（1997–2002）。Princeton 2002 聘任档称由校内 research staff 转任助理教授。Dicke 阶段的具名导师、具体任期及聘任类别待查。';
const official=src(['本人 Princeton CV','cv'],['Princeton 2002 聘任档','appoint']);
rewrite(pf(h),x=>x.startsWith(boundary),()=>boundary+'已核论文签署页和致谢，博士主导师、共同导师及其余阶段角色分别记录。'+timeline+' '+thesis+' · '+official);
cell(h,2,'Zhi-Xun Shen（论文主导师）、Robert B. Laughlin（共同导师）；早期组属与博士阶段研究师长见人物页');
cell(h,3,'Princeton 2002 Robert H. Dicke Fellow，个人指导及任用类别待核；Bell Labs 2002–2003 为 Visiting Scientist');
schoolWith(h,thesis+' · '+official);
const he=audit(h,[
 a('identity','论文署名 Md-Zahid Hasan；Stanford Applied Physics、SLAC 与 Princeton 2002 学位履历对应。',['pdf','pr','cv'],'confirmed'),
 a('affiliation','Princeton Physics，Eugene Higgins Professor。',['pr','cv'],'confirmed'),
 a('research','拓扑量子材料、凝聚态实验及 ARPES、X 射线等能谱。',['pr','pdf'],'confirmed'),
 a('phd',shenText+' '+laughText+' '+hGroup+' '+hLab+' '+hDon,['pdf','osti','catalog','slac','pr','bienen','als'],'confirmed_advisor'),
 a('postdoc',timeline,['cv','appoint'])
],'查 Princeton 2002 Dicke 研究任用的具体类别、任期及个人指导，Bell Labs 访问单列。');
relation(h,he,'phd',shen,'advisor',shenText,ids('pdf','pr','group'),'shen');
relation(h,he,'phd',laugh,'advisor',laughText,ids('pdf'),'laughlin');
relation(h,he,'phd',bienen,'group_leader',hGroup,ids('pdf','bienen'),'bienenstock');
relation(h,he,'phd',hussain,'stage_mentor',hLab,ids('pdf','als'),'hussain');
relation(h,he,'phd',doniach,'stage_mentor',hDon,ids('pdf'),'doniach');

const c='6395d9ed',cn='Michael Chabinyc',brau='师承人物 - John I. Brauman';
const ct='Stanford 1999 年化学博士论文《Intermediates in ionic gas phase reactions: hydrogen bonded complexes and tetrahedral intermediates》的目录明确列 John I. Brauman 为 primary advisor。1997 ACS fellowship 名单另核研究生阶段指导。可信度高。';
const cl=src(['Stanford 学位目录','cc'],['ACS fellowship','acs'],['UCSB 材料系','ucsb']);
updateEdge(c,cn,brau,'John I. Brauman','博士阶段研究师长','博士阶段研究者','博士导师','博士生',ct,cl);
rewrite(pf(c),x=>x.startsWith(boundary),()=>boundary+'Stanford 目录确认 John I. Brauman 为博士论文主导师。UCSB MRL 列 1999–2001 Harvard 博后，Whitesides 组档列 1999-09 至 2002-02，保留日期差异及博士后课题组关系。 '+cl+' · '+src(['UCSB 材料研究所','mrl'],['Whitesides 组校友','gwm']));
cell(c,2,'John I. Brauman（Stanford 学位论文主导师）');
schoolWith(c,cl);
const ce=audit(c,[
 a('identity','Stanford 1999 Chemistry 博士论文作者与 UCSB 本人履历一致。',['cc','ucsb','mrl'],'confirmed'),
 a('affiliation','UCSB Materials。',['ucsb'],'confirmed'),
 a('research','功能薄膜材料、有机半导体、柔性光电子和材料表征。',['ucsb'],'confirmed'),
 a('phd',ct,['cc','ucsb','acs'],'confirmed_advisor')
],'查 Harvard 具体任用记录与 Whitesides 个人指导职衔，继续区分 2001 与 2002 记载。');
relation(c,ce,'phd',brau,'advisor',ct,ids('cc','ucsb','acs'),'brauman');
const pages=[
 {record_id:h,url:u.pdf,raw:'SLAC-R-589, cover and title page: Md-Zahid Hasan, Stanford Applied Physics dissertation, November 2001. p.3: Zhi-Xun Shen (Principal Advisor); Robert B. Laughlin (Co-Advisor); Douglas D. Osheroff and Eric D. Isaacs are also listed on separate reading certifications. pp.5–7 acknowledgments: early membership in Artie Bienenstock group; Zahid Hussain supervised research at ALS; Sebastian Doniach a graduate-stage mentor. PDF SHA-256 D2A4AD7101313918C5D59CDD3A841D04E5FC16E8044475369B77ADE75658ED3F.',excerpt:'直接读 OSTI PDF 的原始签署页及致谢；导师角色与其他签署人明确区分。'},
 {record_id:h,url:u.osti,raw:'OSTI 799074. Hasan, Md-Zahid. Charge Dynamics in Low Dimensional Prototype Correlated Systems: A View with High-Energy X-rays. 20 March 2002. DOI 10.2172/799074. Original SLAC-R-589 report attached.',excerpt:'DOE 书目直接打开，核作者、题名、发布时间和全文入口。'},
 {record_id:h,url:u.catalog,raw:'Stanford SearchWorks 11074749: Md-Zahid Hasan, Charge Dynamics in Low Dimensional Prototype Correlated Systems: A View with High-Energy X-rays. SLAC-R-589, OSTI 799074, record date 03/20/2002.',excerpt:'Stanford 原始报告书目定位。'},
 {record_id:h,url:u.cv,raw:'M. Zahid Hasan CV page 1. Stanford and SLAC PhD 2002. Princeton Robert H. Dicke Fellow 2002. Visiting Scientist, Bell Laboratories 2002–03 and SLAC/Stanford 1997–2002. PDF SHA-256 2B80C00BD7ED6A7956C0A70FE792969001140FA7327CD9C8D78211E8E89B5CC3.',excerpt:'直接核本人 CV 的职称和时间。'},
 {record_id:h,url:u.appoint,raw:'Princeton April 2002: M. Zahid Hasan, physics, moving from the research staff at Princeton, in a list of incoming assistant professors.',excerpt:'区别研究岗位与后续教职。'},
 {record_id:c,url:u.cc,raw:'Michael Chabinyc. Intermediates in ionic gas phase reactions: hydrogen bonded complexes and tetrahedral intermediates. Thesis (Ph.D.) Stanford University, 1999. J. I. (John I.) Brauman, primary advisor. Call number 3781 1999 C.',excerpt:'学位书目明列主导师。'},
 {record_id:c,url:u.ucsb,raw:'UCSB Materials Michael Chabinyc, Professor. Ph.D. in Chemistry, Stanford University. Functional thin films, organic and inorganic semiconductors, flexible electronics and energy conversion.',excerpt:'核当前院系和研究方向。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0300_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0300_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0300_Hasan签署页和Chabinyc学位原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
