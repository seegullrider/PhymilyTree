const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root='..', people=path.join(root,'人物'), idx=path.join(root,'师承关系索引.md');
const records=db.prepare('select id,name,unit,filename from records where id=?');
const latest=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1');
const graph=new Map(), audits=[], typed=[];
const local=id=>records.get(id).filename;
const fn=filename=>path.join(people,filename+'.md');
const web=(label,url)=>'['+label+']('+url+')';
function editLine(file,test,edit){
 const content=graph.get(file)??fs.readFileSync(file,'utf8');
 const end=content.includes('\r\n')?'\r\n':'\n';
 const lines=content.split(/\r?\n/);
 const matches=lines.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected 1 match, got '+matches.length);
 const i=matches[0];lines[i]=edit(lines[i]);
 graph.set(file,lines.join(end));
}
function note(id,prefix,text){editLine(fn(local(id)),line=>line.startsWith(prefix),line=>line+' '+text);}
function mentorLine(mentor,id,prefix,text){
 const f=fn(mentor), r=records.get(id);
 editLine(f,line=>line.startsWith(prefix)&&line.includes('[['+r.filename+'|'),l=>l+' '+text);
}
function indexLine(id,mentor,label,text){
 const r=records.get(id);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
}
function audit(id,changes,next){
 const a=JSON.parse(latest.get(id).details_json);
 a.audit_id='20261110_'+id+'_singapore_original_1233';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_singapore_original_1233_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';
  return cells.join(' | ');
 });
}
function replaceNoteLabel(id,label,replacement,target,extra=''){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceInverseLabel(target,id,label,replacement,extra=''){
 editLine(fn(target),l=>l.startsWith('- '+label+'：')&&l.includes('[['+local(id)+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceIndexLabel(id,target,label,replacement,extra=''){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace(' → '+label+'：',' → '+replacement+'：')+extra);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

function addEdge(id,label,target,name,proof,after,candidate=false){
 const r=records.get(id);
 const line='- '+label+'：[['+target+'|'+name+']]。'+proof;
 editLine(fn(r.filename),l=>l.startsWith('- 核查边界：'),l=>line+'\n'+l);
 const file=candidate?path.join(root,'师承候选线索索引.md'):idx;
 editLine(file,l=>candidate?l==='# 师承候选线索索引':l.startsWith('- [['+r.filename+'|')&&l.includes('[['+after+'|'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+line.slice(2));
}
function newMentor(target,name,bio,student,reverse,proof){
 if(fs.existsSync(fn(target))||fs.existsSync(path.join(root,'师承人物',target+'.md')))throw Error('existing mentor '+target);
 const r=records.get(student);
 graph.set(fn(target),'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n\n- '+reverse+'：[['+r.filename+'|'+r.name+']]。'+proof+'\n');
}






function inverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}



const data=[["fba2e894","https://web.spms.ntu.edu.sg/~oson/people/ShortCV_Soci_Oct2020.pdf","Ph.D., University of Pavia; Postdoctoral Researcher III","NTU 物理与数学科学学院；已有电气与电子工程关联。","纳米光子学、有机光电子与光谱。","本人 CV 分列 2005-02 Pavia 博士、UCSB 2000–2001 访问和 2005–2006 博后、UCSD ECE 2006–2009 两个博后职级；同期公司任用另列。保留 Heeger 博士阶段组和 Deli Wang 博后组。","追 Pavia 正式导师、UCSB 博后个人指导及 UCSD 正式 advisor 职称。"],["f161a71a","https://www.ipos.gov.sg/global-ip-hub/ip-dispute-resolution-resources/overview-technical-experts/technical-experts/massimo-pica-ciamarra/","School of Physical & Mathematical Sciences, Nanyang Technological University","NTU 物理与数学科学学院。","软凝聚态、统计物理、玻璃及颗粒材料。","新加坡 IPOS 原档核 Naples 无序体系统计物理博士、博士研究期间 Fulbright 访问 Austin，之后在意大利 CNISM／CNR 任研究员。机构原档未明确博士导师、独立博后聘任及导师。","查 Naples 学位论文和 CNISM／CNR 研究员岗位类型。"],["f13d94d7","https://events.iitj.ac.in/event_admin/assets/BriefBio-Rajdeep%20Rawat.pdf","Rajdeep did his PhD (1994) from University of Delhi","NIE／NTU 物理与自然科学教育。","等离子体物理、材料处理与纳米材料。","IIT Jodhpur 主办学术活动原履历核 Delhi 1994 博士与新加坡 NIE 教职。现有论文题名与具体导师追查分开。","按已定位 Delhi 学位题名查作者原档与后续岗位。"],["d4224ee5","https://personal.ntu.edu.sg/xyling/images/CV.pdf","2009 – 2011 Post-doctoral Researcher: University of California, Berkeley","NTU 化学、化工与生物技术学院。","表面增强 Raman 光谱、等离激元纳米材料与化学传感。","本人 CV 核 Twente 博士研究及 2009–2011 Berkeley 博后，Twente 学位原档明确两名 Supervisor；Peidong Yang 保留既有博后阶段关系。","追 Berkeley 博后 advisor 正式职衔。"],["fd879022","https://www.ntu.edu.sg/mse/about-us/our-people/faculty-staff","Full Professor and former Assistant Chair, School of Materials Science and Engineering","NTU 材料科学与工程。","磁性材料、功能合金与磁纳米材料。","学校原档及 SHARE 研究合作原档核 Carnegie Mellon 博士、先前 Oak Ridge 等机构经历。博士论文导师及独立博士后岗位待查。","查 CMU 学位论文元数据、Oak Ridge 和 Birmingham 当期聘任。"],["ef3bc09c","https://www.ntu.edu.sg/temasek-labs/about-us/our-people","Prof Teo Hang Tong Edwin, Director of TL@NTU, Programme Director of CAM","NTU 电气与电子工程、Temasek Laboratories 和先进材料中心。","碳纳米材料、功能薄膜与电子器件。","NTU Temasek 原档核同一人及 TL 主任、CAM 项目主任。政府所记 Nanyang–DSO 2010 博后 fellowship 继续保留，博士与博后个人导师待查。","追 NTU 学位论文、DSO 2010 fellowship 正式指导档。"],["a288fedf","https://www.ntu.edu.sg/mse/news-events/events/detail/2024/01/08/default-calendar/mse-seminar-dr-prashant-kumar-8jan2024","Under the guidance of Profs. K. Andre Mkhoyan and Michael Tsapatsis; under the mentorship of Prof. Nicholas Kotov","NTU 材料科学与工程，胶体合成与显微。","多孔二维材料、胶体、自组装和缺陷表征。","NTU 本人讲座简介复核 Minnesota 博士两位指导及 Michigan 博后 Kotov 阶段师长。独立博士论文已经明确两位博士导师。","追 Michigan 博后任用中的正式 advisor 职称。"],["fb245f24","https://www.physics.nus.edu.sg/faculty/quek-su-ying/","QUEK Su Ying","NUS 物理系，材料科学研究关联保留。","第一性原理、界面电子结构及二维量子材料。","本人组档和 Berkeley Lab 原始履历核 2006 Harvard 应用物理博士、2006–2010 Berkeley Lab 博后。沿用两名博士导师及两名博士后导师原记录。","按新任职或新原证增量复核。"],["ee82d97d","https://cde.nus.edu.sg/mse/staff/alexey-berdyugin/","doctoral research … under the supervision of Sir. Andre Geim and Prof. Irina Grigorieva","NUS 材料科学与工程，Presidential Young Professor。","二维超晶格、量子电子输运及电子流体。","Manchester 论文原档明确 Main Supervisor Andre Geim、Co Supervisor Irina Grigorieva。NUS 简介只述随后在英国继续研究，任用阶段和正式个人指导待查。","查英国早期研究或博士后任用、奖项和导师原档。"],["ec87df34","https://www.jishanwu.com/profwu","Ph.D. … 2004, with Klaus Müllen; postdoctoral research … 2005–2007, with Sir Fraser Stoddart","NUS 化学 Provost’s Chair Professor。","开壳层分子磁性、有机拓扑碳与分子芳香性。","本人组页将中科院硕士导师、2004 Klaus Müllen 博士及 UCLA 2005–2007 Fraser Stoddart 博后分列。Stoddart 保留阶段师长。","追 Mainz／MPI 学位原档及 UCLA 博后正式导师职衔。"],["fd7b3c38","https://blog.nus.edu.sg/matbwz/","Postdoc., 01/1996 — 03/1997, Department of Mathematics, Imperial College","NUS 数学系。","计算数学、Bose–Einstein 凝聚、量子系统数值方法。","本人 NUS 履历核 1996-01 至 1997-03 Imperial 数学博士后任期，未列个人指导；清华博士导师韩厚德旧原证保留。","追 Imperial 当期导师字段及本人学位原档。"],["fd176657","https://cde.nus.edu.sg/mse/staff/lain-jong-lance-li/","D.Phil of Condensed Matter Physics, Oxford University (UK) / 2006","NUS 材料科学与工程 NRF Professor。","二维半导体生长、器件与先进电子材料。","NUS 院档分列 Oxford 2006 博士、2006-06 开始 NTU 助理教授和早期 TSMC 工程任用。独立博后经历与两阶段导师仍待核。","查 Oxford 学位论文及博士毕业到 NTU 入职之间的岗位。"],["f725cce2","https://ifim.nus.edu.sg/people/daria-v-andreeva/","postdoctoral fellow under the mentorship of Prof. Helmuth Möhwald","NUS 材料科学与工程及功能智能材料研究所。","二维功能膜、界面材料与高分子物理化学。","IFIM 本人原档分列 St Petersburg 高分子博士、MPI 博后与后续 Bayreuth habilitation。Möhwald 保留博后阶段师长。","查 St Petersburg 正式导师及 MPI 职衔；Bayreuth 资格另列。"],["f7b58b58","https://mif.tongji.edu.cn/info/1378/1168.htm","2018年在日本立命馆大学从事博士后研究；2025年7月加入同济大学材料学院","NUS 化学研究为历史项目。2025-07 起同济大学材料学院特聘研究员、博士生导师。","低维碳基量子磁体、表界面及低温扫描隧道显微。","同济院档确认 2017 京都博士、2018 立命馆博后、随后 NUS 研究及转任同济；本人 CV 分列 2018–2020 访问、2021–2023 Research Fellow、2023–2024 Senior Research Fellow，院档概括 2019–2025，时间口径并记。保留旧证的 Sakaguchi 博士导师与 Maeda／Lu 阶段组关系。","追 Kyoto 学位签署和立命馆博后任命，核 NUS 任期与岗位类别边界。"]], extra={"f161a71a":[["https://isomer-user-content.by.gov.sg/61/6a7d8e6d-c7aa-4ff9-ab93-33154478d5fa/massimo-pica-ciamarra.pdf","Massimo Pica Ciamarra","政府 IPOS 原履历 PDF 对照。"]],"d4224ee5":[["https://research.utwente.nl/en/publications/from-supramolecular-chemistry-to-nanotechnology-assembly-of-3d-na-3/","Huskens, Jurriaan, Supervisor; Reinhoudt, David N., Supervisor","Twente 学位原档明确两位博士导师。"],["https://www.ntu.edu.sg/cceb/about-us/faculty-and-staff/faculty","LING Xing Yi","NTU 化学、化工和生物技术学院现任原档。"]],"fd879022":[["https://www.share-huj.edu.sg/staff/raju-v-ramanujan","Master of Engineering and Ph.D. degrees … Carnegie Mellon University","研究合作机构原履历核学位。"]],"ef3bc09c":[["https://www.ntu.edu.sg/eee/about-us/our-people","Edwin Teo Hang Tong","NTU EEE 原始名录。"]],"fb245f24":[["https://phyweb.physics.nus.edu.sg/~phyqsy/members.html","2006-2010: Visiting Postdoctoral Fellow, Molecular Foundry Theory Facility","本人组档补 Berkeley Lab 博后阶段。"],["https://nanotheory.lbl.gov/people/SuYingQuek.html","2006 Ph.D., Applied Physics, Harvard University","Berkeley Lab 当期本人机构原档。"]],"ee82d97d":[["https://research.manchester.ac.uk/en/studentTheses/transport-properties-of-novel-van-der-waals-materials/","Andre Geim (Main Supervisor) & Irina Grigorieva (Co Supervisor)","Manchester 论文目录明确两位博士导师角色。"]],"f7b58b58":[["https://xuweilab.tongji.edu.cn/_upload/article/files/ce/da/718d9ce74ab9abf96c3ac4d506f8/5f950a4d-25cc-4f2b-a9d0-8a5bf917a102.pdf","Ritsumeikan University Postdoc 2018","本人 CV 逐段列 NUS 历任和同济。"]]};
const u=(label,url)=>web(label,url)+'。';
const aid=new Map();
for(const [id,src,raw,aff,topic,ev,next] of data){
 const related=extra[id]??[], refs=[src,...related.map(x=>x[0])];
 const proof=u('原始资料',src)+related.map(x=>u('交叉原证',x[0])).join('')+ev;
 if(id==='fd176657')editLine(fn(local(id)),l=>l==='## 师承',l=>l+'\n\n- 本轮核查原档：'+proof);
 else note(id,'- 核查边界：',proof);
 changeRow(id,null,id==='f7b58b58'?'Hiromitsu Maeda（立命馆博后组）、Jiong Lu（NUS 阶段组关系；后续科研岗位分开）':null,proof);
 if(id==='f7b58b58'){
  const r=records.get(id);
  editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>l.replace('化学系；二维与范德华材料','NUS 化学系（历史）；2025-07 起同济材料学院；二维与范德华材料'));
 }
 const a=JSON.parse(latest.get(id).details_json);
 const n=audit(id,{
  affiliation:['confirmed',aff,refs],research:['confirmed',topic,refs],
  phd:[a.aspects.phd.status,a.aspects.phd.note,refs],postdoc:[a.aspects.postdoc.status,ev,refs]
 },next);
 if(id==='fb245f24')audits.at(-1).followup_required=false;
 aid.set(id,n);
}
const ex='ee82d97d', url=extra[ex][0][0];
for(const [target,label,ev] of [
 ['师承人物 - Andre Geim','博士生','Main Supervisor Andre Geim'],
 ['师承人物 - Irina Grigorieva','博士生','Co Supervisor Irina Grigorieva']
]){
 relation(ex,'phd',target,'advisor','Manchester 学位馆藏明确 '+ev+'。',[url],aid.get(ex),false);
}

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_NTU与NUS院系和指导原档';
fs.writeFileSync(stamp+'_人工.json',JSON.stringify(audits,null,2)+'\n','utf8');
fs.writeFileSync(stamp+'_结构化.json',JSON.stringify(typed,null,2)+'\n','utf8');
for(const [file,content] of graph)fs.writeFileSync(file,content,'utf8');
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.review-'));
const temp=path.join(tmp,'audit.json');
try{
 for(const a of audits){
  fs.writeFileSync(temp,JSON.stringify(a),'utf8');
  console.log(execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',temp],{encoding:'utf8'}).trim());
 }
 console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
