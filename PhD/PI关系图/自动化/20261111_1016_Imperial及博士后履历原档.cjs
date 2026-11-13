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
 orig.audit_id='pi_archive_20261111_1016_'+id;
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
 relations.push({event_id:'pi_archive_20261111_1016_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






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




const u={
 imperial:'https://spiral.imperial.ac.uk/entities/publication/29fe516a-a63a-4a75-a90f-68ead8bcefee',
 larThesis:'https://spiral.imperial.ac.uk/bitstreams/73fc79ab-d0b9-4feb-877d-2bec73a95d0f/download',
 larAward:'https://www.imperial.ac.uk/stories/alumni-awards-2024-david/',
 fsu:'https://eng.famu.fsu.edu/news/imperial-college-london-recognizes-engineering-professor-distinguished-alumnus',
 aStan:'https://profiles.stanford.edu/aaron-lindenberg',als:'https://als.lbl.gov/news-events/seminars/past-seminars/',
 ol:'https://opg.optica.org/ol/abstract.cfm?uri=ol-27-10-869',
 dUci:'https://www.faculty.uci.edu/profile/?facultyId=4842',
 aps:'https://journals.aps.org/prl/issues/78/12',
 knob:'https://sites.google.com/chem.ucla.edu/virus-group-at-ucla/lab-members',
 tCv:'https://lsi.princeton.edu/sites/g/files/toruqf4346/files/faculty/Torquato%20CV.pdf',
 stony:'https://me.stonybrook.edu/people/alumni.php',
 stell:'https://www.stonybrook.edu/commcms/chemistry/images/George.pdf#page=1',
 gUcsb:'https://www.chemengr.ucsb.edu/people/michael-gordon',
 gBio:'https://mrlweb.mrl.ucsb.edu/sites/default/files/mrl_docs/workshops/MROP%202014%20Bios%20Revised.pdf',
 gPubs:'https://sites.chemengr.ucsb.edu/~mjgordon/research/pubs.html',
 hal:'https://cv.hal.science/david-peyrade',
 gOther:'https://corescholar.libraries.wright.edu/etd_all/2849/',
 wUsc:'https://viterbi.usc.edu/directory/faculty/Wu/Wei',
 wOther:'https://dbbs.wustl.edu/people/wei-wu-ph-d/'
};
const l='ba9f9070', lName='David Larbalestier', king='师承人物 - Hubert W. King';
const larPhd='Imperial 1970 博士论文题名页具名 David Christopher Larbalestier，冶金系，致谢第 3 页直接称 Dr. H. W. King 为其 supervisor，说明 King 提出最初研究并指导后续拓展。Imperial 校友档核全名 Hubert King。';
const larPost='Imperial 本人校友访谈把瑞士工作与 Rutherford 超导磁体组博士后分开，记 Martin Wilson 提出其任用阶段的 Nb₃Sn 磁体任务。保留组负责人标签，个人正式指导职衔仍待任用档。';
const larSources=src(['Imperial 论文目录','imperial'],['论文原卷致谢第 3 页','larThesis'],['Imperial 本人校友档','larAward']).replace(u.larThesis+')',u.larThesis+'#page=3)');
updateEdge(l,lName,king,'Hubert W. King','博士导师候选','博士生候选','博士导师','博士生',larPhd,larSources);
rewrite(pf(l),x=>x.startsWith(boundary),()=>boundary+larPhd+' '+larPost+' '+larSources);
rewrite(pf(l),x=>x.includes('King 的博士导师身份仍仅为候选'),x=>x.replace('King 的博士导师身份仍仅为候选。','King 的博士导师已由论文致谢具名。'));
school(l,'Hubert W. King（博士导师候选）','Hubert W. King（Imperial 冶金博士导师，1970 原卷致谢具名）');
schoolWith(l,larSources);
const la=audit(l,[
 a('phd',larPhd,['larThesis','imperial','larAward'],'confirmed_advisor'),
 a('postdoc',larPost,['larAward'],'group_or_candidate')
],'追 Rutherford 1972/73–1976 任用档的个人指导职衔并区分研究员任期，瑞士工作保留独立。');
relation(l,la,'phd',king,'advisor',larPhd,[u.larThesis+'#page=3',u.imperial,u.larAward],'king');

const ar='b85b2726', f='师承人物 - Roger W. Falcone';
const arProof='Stanford 本人档核 2001–2003 UC Berkeley 博士后 Faculty Fellow。2001 年 11 月收稿的 Optics Letters 原页列 A. M. Lindenberg 与 R. W. Falcone 同为 Berkeley 物理系，论文讨论相干声子。ALS 将随后 2003–2007 的 SLAC staff scientist 分列。Falcone 仅作为博士后导师候选，可信度低。';
const arSources=src(['Stanford 本人档','aStan'],['ALS 履历','als'],['Optica 署名与单位','ol']);
edge(ar,'Aaron Lindenberg',f,'Roger W. Falcone','博士后导师候选','博士后候选关系',arProof,arSources);
rewrite(pf(ar),x=>x.startsWith(boundary),()=>boundary+'APS 1999 报道具名 Falcone 的研究生关系，正式论文导师仍待学位卷。Berkeley 博后 fellowship 和 SLAC staff scientist 是相继任用。Falcone 在博士后阶段的项目合作见上，个人指导职衔待任用档。 '+arSources);
cell(ar,3,'Berkeley 2001–2003 博士后 Faculty Fellow。Roger W. Falcone（低可信候选）；SLAC 2003–2007 staff scientist');
schoolWith(ar,arSources);
const aa=audit(ar,[a('postdoc',arProof,['aStan','als','ol'],'group_or_candidate')],'追 Berkeley 2001 学位原卷与 2001–2003 Faculty Fellow 资助或聘用记录中的正式指导人。');
relation(ar,aa,'postdoc',f,'candidate',arProof,ids('aStan','als','ol'),'falcone');

const de='b93bce66', k='师承人物 - Charles M. Knobler';
const deProof='UCI 教师档明确 UCSB 1995 年博士、随后 UCLA 博士后及 1997 年起在 UCI 任教。APS 1997 年第 78 卷第 12 期原始目录具名 Michael Dennin 与 Charles M. Knobler 的单层泡沫研究，UCLA 组档核 Knobler 姓名及院系。合作提供低可信博士后导师候选。';
const deSources=src(['UCI 教师档','dUci'],['APS 当期论文目录','aps'],['UCLA 组档','knob']);
edge(de,'Michael Dennin',k,'Charles M. Knobler','博士后导师候选','博士后候选关系',deProof,deSources);
rewrite(pf(de),x=>x.startsWith(boundary),()=>boundary+'UCSB 博士阶段已有本人具名组属，正式导师待论文。UCLA 博士后任用已核，Knobler 的关系见候选条目。 '+deSources);
cell(de,2,'Guenter Ahlers、David Cannell（博士阶段课题组负责人）；正式导师待核');
cell(de,3,'UCLA 博士后。Charles M. Knobler（低可信候选）');
schoolWith(de,deSources);
const da=audit(de,[
 a('identity','UCI 教师档核 UCSB 1995 年物理博士、UCLA 博士后及 1997 年起任教。',['dUci'],'confirmed'),
 a('affiliation','UCI Physics & Astronomy 教授。',['dUci'],'confirmed'),
 a('research','实验凝聚态、复杂流体、泡沫与软物质动力学。',['dUci'],'confirmed'),
 a('postdoc',deProof,['dUci','aps','knob'],'group_or_candidate')
],'追 1995 UCSB electroconvection 博士论文题名页或致谢，及 UCLA 化学与生化 1995–1997 任用与名录。');
relation(de,da,'postdoc',k,'candidate',deProof,ids('dUci','aps','knob'),'knobler');

const tq='b83fb0a9', gs='师承人物 - George Stell';
const tqPhd='Stony Brook 机械系校友原档明示 George Stell 博士指导，Stony Brook 托管的 Stell 同行纪念文独立对应。学位年校友页列 1980，本人 CV 学历栏列 1981，CV 另列博士研究至 1980 年 12 月，按来源分别保留。';
const tqPost='本人 CV 将博士研究助理任期列为 1978 年 7 月至 1980 年 12 月，紧接 1981 年 1 月起的 General Motors Institute 机械系助理教授。早期 Grumman 研究工程师在博士研究前，现有履历未发现单列博士后。';
const tqSources=src(['Stony Brook 机械系校友档','stony'],['Stony Brook 托管的 Stell 纪念文','stell'],['Princeton 托管本人 CV','tCv']);
updateEdge(tq,'Salvatore Torquato',gs,'George Stell','博士导师','博士生','博士导师','博士生',tqPhd,tqSources);
rewrite(pf(tq),x=>x.startsWith(boundary),()=>boundary+tqPost+' '+tqSources);
cell(tq,3,'本人 CV 记博士研究后于 1981 年 1 月入职 General Motors Institute，未发现单列博士后');
schoolWith(tq,tqSources);
const ta=audit(tq,[a('phd',tqPhd,['stony','stell','tCv'],'confirmed_advisor'),a('postdoc',tqPost,['tCv'],'no_postdoc_documented')],'找 Stony Brook 学位正式授予记录确认 1980/1981 年份差异。');
relation(tq,ta,'phd',gs,'advisor',tqPhd,ids('stony','stell','tCv'),'stell');

const g='bac831b7', gn='Michael Gordon', dp='师承人物 - David Peyrade';
const gProof='UCSB 会议履历明确 LTM-CNRS Grenoble 两年博士后，Caltech 2006 为 visiting scientist。Gordon 的实验室论文表与 Peyrade 的 HAL 本人书目均列 2005–2006 年在纳米压印和胶体颗粒方面合著。Peyrade 作为低可信指导候选。';
const gSources=src(['UCSB 会议本人履历','gBio'],['Gordon 实验室论文表','gPubs'],['Peyrade HAL 书目','hal']);
mentor(dp,'David Peyrade','法国 Grenoble 纳米加工与胶体颗粒研究者。',src(['HAL 研究者书目','hal']));
edge(g,gn,dp,'David Peyrade','博士后导师候选','博士后候选关系',gProof,gSources);
rewrite(pf(g),x=>x.startsWith(boundary),x=>x.replace('UCSB 资料确认 Grenoble LTM-CNRS 博士后两年，但未找到导师名。https://pire-ecci.ucsb.edu/renewal/progbook2011.pdf','Grenoble LTM-CNRS 博士后两年及 Caltech 访问任用分别列示。博士后正式导师仍待核。 '+gSources));
cell(g,3,'Grenoble LTM-CNRS 两年。David Peyrade（低可信候选）；Caltech 2006 visiting scientist');
schoolWith(g,gSources+' · '+src(['Wright State 同名排除','gOther']));
const ga=audit(g,[
 a('identity','UCSB 化工本人档核 Caltech 化工博士、UCSB 材料与界面研究。Wright State 2024 论文作者为心理学博士 Michael Gordon Collins，排除误配。',['gUcsb','gOther'],'confirmed'),
 a('postdoc',gProof,['gBio','gPubs','hal'],'group_or_candidate')
],'追 LTM-CNRS 2004–2006 任用档和课题组历届名单；Caltech 2003/2004 学位年份保留待核。');
relation(g,ga,'postdoc',dp,'candidate',gProof,ids('gBio','gPubs','hal'),'peyrade');

const w='b9b5a5fe';
const wProof='USC 系页确认为 Princeton 2003 电气工程博士，现 USC ECE 教授。WashU 的 Wei Wu 是以中央突触胞吞为题的神经科学博士生档，导师 Ling-Gang L. Wu，身份排除。';
schoolWith(w,src(['USC 院系档','wUsc'],['WashU 同名排除','wOther']));
const wa=audit(w,[a('identity',wProof,['wUsc','wOther'],'confirmed')],'追 HP Labs 研究助理阶段原职衔，区分工业任用和可能的独立博后。');
const exclusions=[
 {page_id:'dc8eb1418d2a59bf57072449',url:u.wOther,record_id:w,audit_id:wa,external_subject:'Wei Wu，WashU 中央突触胞吞博士论文作者',evidence:wProof},
 {page_id:'b4a14bd81370b07db7e3931f',url:u.gOther,record_id:g,audit_id:ga,external_subject:'Michael Gordon Collins，Wright State 2024 心理学博士',evidence:'Wright State 学位档具名 Michael Gordon Collins，2024 心理学博士。UCSB 化工系本人档为 Caltech 化工博士，方向纳米材料与界面，系不同人员。'}
];
const pages=[
 [l,'imperial','Magnetisation studies of some cryogenic alloys. David Christopher Larbalestier. Doctor of Philosophy. Date Awarded 1970. Imperial College London.','从公开目录核博士论文和原卷链接。'],
 [l,'larThesis','Page 1: David Christopher Larbalestier, Department of Metallurgy, April 1970. Page 3: Dr. H.W. King who, as my supervisor, suggested the original research.','核定 1970 Imperial 冶金博士论文和具名导师。'],
 [l,'larAward','Imperial names Hubert King as a metallurgist and recounts Larbalestier’s postdoctoral work at Rutherford and the project Martin Wilson gave him.','核 King 名字及 Wilson 博士后组属，个人导师职衔待核。'],
 [ar,'aStan','Faculty Fellow Post-doctoral Fellowship, University of California, Berkeley (2001–2003). Professor, Materials Science and Engineering; Professor, Photon Science Directorate.','确认博士后阶段及现任院系。'],
 [ar,'als','Faculty Fellow at Berkeley from 2001–2003 and then a staff scientist at SLAC from 2003–2007.','区分博士后 fellowship 和后续研究员。'],
 [ar,'ol','A. M. Lindenberg and R. W. Falcone are both listed at the Berkeley Department of Physics. Manuscript submitted November 13, 2001.','时间与机构共同支持候选追查，职衔待核。'],
 [de,'dUci','Ph.D. (1995) from UCSB. Postdoctoral position at UCLA. Professor of Physics and Astronomy at UCI since 1997. Research includes foams and complex fluids.','核任用阶段及方向。'],
 [de,'aps','APS issue 78 (12), page 2485, lists Michael Dennin and Charles M. Knobler on the 1997 monolayer foam paper.','合作原刊为低可信候选线索。'],
 [de,'knob','Professor Charles (Chuck) Knobler, Professor Emeritus, UCLA. The group page does not list Dennin.','核 Knobler 身份，保留组属待核。'],
 [tq,'stony','Mechanical engineering alumni entry says Salvatore Torquato was supervised by George Stell.','核正式博士指导及院系。'],
 [tq,'stell','Stell supervised several Stony Brook doctoral students, including Salvatore Torquato.','独立佐证。'],
 [tq,'tCv','Ph.D. 1981. Doctoral Research, July 1978–December 1980. Assistant Professor, General Motors Institute, January 1981–June 1982.','区分博士研究、正式教职及研究方向，未发现单列博后。'],
 [g,'gBio','Two years as postdoc at LTM-CNRS in Grenoble. Visiting scientist at Caltech in 2006.','确认博士后与访学任用。'],
 [g,'gPubs','Gordon’s bibliography lists the 2006 articles with D. Peyrade on colloidal nanoparticles and nanoimprint surfaces.','核本人组页论文线索。'],
 [g,'hal','Peyrade’s HAL profile lists M. Gordon and D. Peyrade on 2005 nanofabrication and colloidal assembly proceedings.','机构书目核同期合作。'],
 [w,'wUsc','Princeton 2003 PhD in Electrical Engineering, HP Labs research appointments, USC Professor at Ming Hsieh ECE.','核 USC 电子工程 Wei Wu，排除神经科学同名。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:de,url:'https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.78.2485',error:'直接打开单篇论文返回 Cache miss，已核读 APS 当期目录原页。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_1016_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_1016_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_1016_Imperial及博士后履历原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);

const xf='20261111_1016_Wright与WashU同名排除.json';
persist(xf,exclusions);
call('人物网页身份纠偏.cjs',[xf]);
call('检索流程.cjs',['report']);
