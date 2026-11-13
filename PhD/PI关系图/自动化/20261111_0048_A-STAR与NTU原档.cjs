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
 orig.audit_id='pi_archive_20261111_0048_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0048_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"gq":"https://qsc.dso.org.sg/principal-investigators/goh-kuan-eng-johnson","gc":"https://www.cqt.sg/highlight/2025-05-meet-johnson-goh/","gf":"https://www.setcor.org/conferences/graphene-korea-2019/speakers","gu":"https://unsworks.unsw.edu.au/","lp":"https://research.a-star.edu.sg/researcher/james-lourembam/","li":"https://fac.iitg.ac.in/perumal/group.html","le":"https://cordis.europa.eu/project/id/891778","ln":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10097601/","lt":"https://wis.ntu.edu.sg/webexe/owa/FYP_EEE_STUDENT.show_project?p_proj_id=104175","lr":"https://cordis.europa.eu/project/id/891778/reporting","lx":"https://research.manchester.ac.uk/en/projects/magnon-propagation-in-two-dimensional-magnets/","xn":"https://personal.ntu.edu.sg/cxue/me.htm","xo":"https://scholarsbank.uoregon.edu/items/d38b3f38-bffe-4f18-97d7-949094522bff/full","xs":"https://u.osu.edu/mclc/2020/07/23/can-xue-influence/","xy":"https://news.yale.edu/2009/04/06/avant-garde-chinese-author-can-xue-visit-yale"};
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




const [g,l,x]=['796c2c6d','569f0600','601ade82'];
const gLinks=src(['CQT 本人访谈','gc'],['Quantum Sensing Centre 本人档','gq'],['2019 会议履历','gf']);
const gPost='2019 会议履历写 2006 加入 A*STAR、2007 获 UNSW 物理博士；CQT 本人访谈回忆回新加坡后从事纳米电子学。已核资料未发现单列博士后任用，2006 年岗位具体性质待查。';
const gPhd='CQT 本人访谈明确 UNSW 博士研究在 Michelle Simmons 指导下开展，描述为 do a PhD with Michelle Simmons。保留博士阶段研究师长，学位原档导师字段待核。';
rewrite(pf(g),r=>r.startsWith(boundary),()=>boundary+gPhd+' '+gPost+' '+gLinks);
cell(g,3,'2006 加入 A*STAR，2007 获 UNSW 博士；已核资料未见单列博士后任用');
schoolWith(g,gLinks);
const ga=audit(g,[
 a('identity','CQT 访谈、官方 Quantum Sensing Centre 与会议履历核同一人及 2007 UNSW 物理博士。',['gq','gc','gf'],'confirmed'),
 a('affiliation','A*STAR IMRE Senior Principal Scientist，兼任 NUS Physics、NTU SPMS，任 CQT PI。',['gq','gc'],'confirmed'),
 a('research','固态自旋量子比特、二维半导体与谷电子学。',['gq','gc'],'confirmed'),
 a('phd',gPhd,['gc','gq'],'group_or_candidate'),
 a('postdoc',gPost,['gf','gc'],'no_postdoc_documented')
],'从 UNSW 馆藏或 Simmons 档查学位论文导师字段及 A*STAR 2006 年任用职称。');

const le='Nature 原文致谢将 Marie Skłodowska-Curie 891778 对应到 Lourembam，CORDIS 确认 Manchester 主办，作者贡献只确认 Berdyugin、Ponomarenko 和 Geim 监督该研究项目。三人继续作个人博后导师候选。';
const li='IIT Guwahati 的 Perumal Alagarsamy 实验室校友表列同名 James Lourembam 2010 年 10 月至 2011 年 6 月为 JRF。该项先于已知 NTU 博士时期，作为待独立核对的早期研究线索。';
const ll=src(['A*STAR 本人档','lp'],['欧洲项目原档','le'],['Nature 原刊全文','ln'],['NTU 本科项目档','lt'],['IIT Guwahati 课题组名录','li']);
personLine(l,boundary,' '+le+' '+li+' '+ll);
cell(l,1,'A*STAR IMRE；NTU EEE 本科项目研究机构协同指导；量子材料、自旋电子学、磁性材料');
schoolWith(l,ll);
const la=audit(l,[
 a('identity','A*STAR 人员档与 Nature 原文中 Manchester fellow、NTU 研究机构协同导师对应同一自旋电子学研究人员。IITG 较早记录留作独立追查。',['lp','ln','lt','li'],'confirmed'),
 a('affiliation','A*STAR IMRE Senior Scientist、SpEED PI。NTU EEE 项目为研究机构协同导师，未见高校教职。',['lp','lt'],'confirmed'),
 a('research','量子材料、自旋电子学和磁性纳米器件。',['lp','lt'],'confirmed'),
 a('postdoc',le,['lp','le','ln'],'group_or_candidate')
],'追 891778 fellowship 个人指导字段和 NTU 博士论文签署页；另核 IITG JRF 早期同名。');

const xe='Oregon 的学位论文及 Ohio State MCLC 原帖都研究作家残雪的文学作品。Yale 原档确认 Can Xue 是邓小华的笔名。NTU 本人档明确薛灿为材料学者、2007 Northwestern 化学博士及导师 Chad A. Mirkin，并列 2008–2009 NTU 教学与研究岗位。两篇文学网页已标记同名误配。';
const xl=src(['NTU 本人履历','xn'],['Yale 作家原档','xy'],['Oregon 学位目录','xo'],['Ohio State 文学帖','xs']);
insertAfter(pf(x),'## 师承','\n- 同名网页复核：'+xe+' '+xl);
schoolWith(x,src(['NTU 本人履历','xn'],['Yale 作家原档','xy']));
const xa=audit(x,[
 a('identity',xe,['xn','xy','xo','xs'],'confirmed'),
 a('affiliation','NTU School of Materials Science and Engineering Associate Professor。',['xn'],'confirmed'),
 a('research','等离激元纳米结构、半导体异质材料、光催化。',['xn'],'confirmed'),
 a('postdoc','2008-01–06 NTU Teaching Fellow，2008-07–2009-10 Lee Kuan Yew Research Fellow，正式岗位是否属博士后及指导关系尚待任用档。',['xn'],'unresolved')
],'查 NTU Lee Kuan Yew Research Fellow 任用原档确认 2008–2009 岗位性质及指导人。');
const exclusions=[
 {page_id:'9c3f1cff1ef6246e3befcf37',record_id:x,url:u.xo,audit_id:xa,external_subject:'文学作家残雪（邓小华）',evidence:xe},
 {page_id:'4a307ba452ae5aa6455beeae',record_id:x,url:u.xs,audit_id:xa,external_subject:'文学作家残雪（邓小华）',evidence:xe}
];
const pages=[
 [g,'gq','The QSC institutional profile lists Goh’s UNSW PhD in 2007, appointments at IMRE, NUS and NTU, and his solid-state quantum research.','复核学历、跨单位任用与方向。'],
 [g,'gc','Goh’s first-person CQT interview identifies Michelle Simmons in his UNSW PhD and describes his move into nanoelectronics on his return.','阶段指导已核，正式签署页待查。'],
 [g,'gf','The 2019 conference speaker biography records A*STAR arrival in 2006 and the UNSW degree in 2007.','补博士前后任用时间线。'],
 [l,'lp','A*STAR identifies Lourembam’s NTU PhD and Manchester Marie Skłodowska-Curie postdoctoral position.','核对院系、身份和博后阶段。'],
 [l,'le','CORDIS lists Manchester as coordinator for Marie Skłodowska-Curie grant 891778.','项目原档没有个人指导字段。'],
 [l,'ln','Nature acknowledges grant 891778 for J.L., and credits three authors with project supervision.','三人只列个人指导候选。'],
 [l,'lt','NTU EEE names Lourembam as the external institute co-supervisor for a spintronics undergraduate project.','核对研究机构协同指导职能。'],
 [l,'li','IIT Guwahati group roster lists a James Lourembam as a junior research fellow in 2010–2011.','留存较早的研究任用线索，待独立核身份。'],
 [x,'xn','Xue’s NTU CV identifies his Chinese name, institution, doctoral advisor Chad Mirkin, teaching and research fellowship dates.','核对材料学者身份及学位，博士后称谓未列。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:g,url:u.gu,error:'Blocked by robots.txt; university thesis repository unavailable'});
pages.push({record_id:l,url:u.lr,error:'Cache miss on CORDIS report subpage; base project and article read'});
pages.push({record_id:l,url:u.lx,error:'Cache miss on Manchester project record; follow project 891778 documentation'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0048_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const receipt='20261111_0048_A-STAR与NTU原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
const ef='20261111_0048_NTU同名排除.json';persist(ef,exclusions);call('人物网页身份纠偏.cjs',[ef]);
call('检索流程.cjs',['report']);
