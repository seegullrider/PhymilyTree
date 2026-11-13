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
function audit(id,changes,next) {
 const original=JSON.parse(last.get(id).details_json);
 original.audit_id='pi_archive_20261110_1952_'+id;
 original.followup_required=true;
 original.next_step=next;
 for(const [key,note,sources] of changes){
  const aspect=original.aspects[key];
  original.aspects[key]={...aspect,note,sources:[...new Set([...sources,...aspect.sources])]};
 }
 audits.push(original);
 return original.audit_id;
}

function edit(file,match,replacement){
 const content=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const matches=rows.map((row,i)=>match(row)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected one line, found '+matches.length);
 const i=matches[0];
 rows[i]=replacement(rows[i],newline);
 updates.set(file,rows.join(newline));
}
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mentorFile=name=>path.join(notes,name+'.md');
const who=(id,role)=>row=>row.startsWith('- '+role+'：')&&row.includes('[['+records.get(id).filename+'|');
const indexed=(id,role,mentor)=>row=>row.startsWith('- [['+records.get(id).filename+'|')&&row.includes('→ '+role+'：[['+mentor+'|');
function schoolReplace(id,from,to){
 const record=records.get(id);
 edit(path.join(root,record.unit+'逐人复核记录.md'),row=>row.startsWith('| [['+record.filename+'|'),row=>{
  if(row.includes(to))return row;
  if(!row.includes(from))throw Error(id+' 校表字段已变');
  return row.replace(from,to);
 });
}
function appendAfter(file,match,entry){
 edit(file,match,(row,nl)=>{
  const full=updates.get(file)??fs.readFileSync(file,'utf8');
  return full.includes(entry)?row:row+nl+entry;
 });
}
function addRelation(id,auditId,key,stage,mentor_filename,kind,evidence,sources) {
 relations.push({event_id:'pi_archive_20261110_1952_'+id+'_'+key,record_id:id,stage,mentor_filename,kind,source_audit_id:auditId,evidence,sources});
}

const isHeading=row=>row==='## 师承';
const label=(id,name)=>'[['+records.get(id).filename+'|'+name+']]';
const target=(node,name)=>'[['+node+'|'+name+']]';
function addIndex(file,heading,lineText) {
 const body=updates.get(file)??fs.readFileSync(file,'utf8');
 if(body.includes(lineText))return;
 const nl=body.includes('\r\n')?'\r\n':'\n';
 const marker=nl+'## '+heading+nl;
 if(body.includes(marker)) throw Error('已存在索引标题：'+heading);
 updates.set(file,body.trimEnd()+nl+nl+'## '+heading+nl+nl+lineText.replaceAll('\n',nl)+nl);
}
function putEdge({id,name,mentor,mentorName,role,reverse,details}) {
 const from=label(id,name),to=target(mentor,mentorName);
 appendAfter(pf(id),isHeading,'\n- '+role+'：'+to+'。 '+details);
 appendAfter(mentorFile(mentor),isHeading,'\n- '+reverse+'：'+from+'。 '+details);
 return '- '+from+' → '+role+'：'+to+'。 '+details;
}

const m='2c80d694',s='2c21826b',a='a8116085',b='e2ebf9d2',c='2cf4abb7',e='2d08b192',p='2dab8ba9',y='bc231417';
const mit='https://dspace.mit.edu/entities/publication/b996d424-20ab-49c3-92e0-56bfea179439';
const cv='https://www.mpsd.mpg.de/896853/andrew_millis_cv.pdf';
const cq='https://quantum.columbia.edu/directory/andrew-j-millis';
const prl='https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.58.266';
const lee='人员 - MIT - Patrick Lee - bc7878ac';
const mp='MIT 学位原档核 Andrew John Millis 的 1986 物理博士论文《Theoretical studies of heavy fermion materials》，目录未列指导字段。APS 同题原论文列 Millis 和 Patrick A. Lee 同署 MIT 物理系，支持把 Lee 保留为低可信候选，论文签署页待查。';
const mb='本人 CV 将 1986–1988 Bell Labs Postdoctoral Member of Technical Staff 与 1988–1996 Member of Technical Staff 分列。博后个人导师未列。';
const ma=audit(m,[['affiliation','Columbia 物理系教授并在 Flatiron CCQ 任职。',[cq]],['research','理论凝聚态、强关联电子、超导、磁性与非平衡量子材料。',[cq]],['phd',mp,[mit,prl]],['postdoc',mb,[cv]]],'MIT 下载主机退避到期后查论文签署，另查 1986–1988 Bell Labs 博后任用的个人指导。');
audits.at(-1).aspects.phd.status='group_or_candidate';
addRelation(m,ma,'lee','phd',lee,'candidate',mp,[mit,prl]);
const mi=putEdge({id:m,name:'Andrew J. Millis',mentor:lee,mentorName:'Patrick A. Lee',role:'博士导师候选',reverse:'博士阶段候选关系',details:source('MIT 学位原档',mit)+' · '+source('APS 同期原论文',prl)+'。'+mp});
edit(pf(m),row=>row.startsWith('- 核查边界：'),()=>'- 核查边界：'+mb+' '+source('Max Planck 托管本人 CV',cv)+'。MIT 1986 博士论文已核题名，正式导师仍待签署页。');
schoolReplace(m,'| 待核 | 待核 |','| MIT 1986 博士；Patrick A. Lee（低可信候选） | Bell Labs 1986–1988 博后，个人导师待核 |');
schoolSource(m,' · '+source('MIT 学位原档',mit)+' · '+source('本人 CV',cv));

const fu='师承人物 - Xing Fu';
const fup='https://faculty.dpi.tsinghua.edu.cn/fuxing/zh_CN/zdylm/13708/list/index.htm';
const ustc='https://phys.ustc.edu.cn/2026/0730/c17578a749029/page.htm';
const twil='https://sites.google.com/view/shenlab/people';
const sp='USTC 原始履历确认申艺杰 2019 年获清华精密仪器系光学工程博士。付星本人清华科研目录列两人在 2018 年多项结构光和涡旋激光研究合作。因尚未找到博士论文签署或师生名录，按低可信博士导师候选记录。';
const sa=audit(s,[['affiliation','本人 TWIL 与 USTC 原档核 NTU 物理与数学科学及电气电子工程双聘助理教授。',[twil,ustc]],['research','结构光、纳米光子、光学角动量与拓扑光子学。',[twil,ustc]],['phd',sp,[ustc,fup]]],'查清华精密仪器系 2019 学位原件及任用档，Zheludev 仍列 Southampton 博后课题组负责人。');
audits.at(-1).aspects.phd.status='group_or_candidate';
addRelation(s,sa,'fu','phd',fu,'candidate',sp,[ustc,fup]);
const fuFile=mentorFile(fu);
if(!fs.existsSync(fuFile))updates.set(fuFile,'# Xing Fu（付星）\n\n> [!info] 师承扩展人物\n> 清华教师原档列付星及其结构光和激光研究。 '+source('清华本人科研档',fup)+'\n\n## 师承\n');
const si=putEdge({id:s,name:'Yijie Shen',mentor:fu,mentorName:'Xing Fu（付星）',role:'博士导师候选',reverse:'博士阶段候选关系',details:source('USTC 原始履历',ustc)+' · '+source('清华本人科研档',fup)+'。'+sp});
addIndex(path.join(root,'师承候选线索索引.md'),'MIT 与清华博士候选补证（2026-11-10）',mi+'\n'+si);
schoolReplace(s,'| 待核 | Southampton','| 清华 2019 博士；付星（低可信候选） | Southampton');
schoolSource(s,' · '+source('USTC 原始履历',ustc)+' · '+source('清华本人科研档',fup));

const cor='https://www.duffield.cornell.edu/people/nicholas-l-abbott/';
const ha='https://www.gmwgroup.harvard.edu/resources';
const w='师承人物 - George M. Whitesides';
const ax='Harvard Whitesides 组原档将 Nick Abbott 列为 Postdoctoral Fellow，1991-11-18 至 1993-06-02，去向 Cornell 化学与生物分子工程。Cornell 履历确认 Harvard 博后研究与 Whitesides 共事，按既有博士后阶段研究师长记录，正式个人导师职衔待核。';
const aa=audit(a,[['research','Cornell 原档核液晶、胶体及界面材料。',[cor]],['postdoc',ax,[ha,cor]]],'追 MIT 博士论文签署和 1991／1992 时间口径，以及 Harvard 博后个人指导职衔。');
addRelation(a,aa,'whitesides','postdoc',w,'stage_mentor',ax,[ha,cor]);
const ad=' '+source('Harvard Whitesides 组原档',ha)+'。'+ax;
personLine(a,'- 博士后研究师长：',ad);
line(mentorFile(w),who(a,'博士后阶段研究者'),ad);
line(index,indexed(a,'博士后研究师长',w),ad);
schoolReplace(a,'George M. Whitesides（Harvard 1993 博士后阶段研究师长）','George M. Whitesides（Harvard 1991-11 至 1993-06 博士后阶段研究师长）');
schoolSource(a,' · '+source('Harvard Whitesides 组原档',ha));

const cab='https://science.ai.cam.ac.uk/team/bingqing-cheng';
const bx='Cambridge Accelerate 原页具名 Bingqing Cheng 为 Departmental Early Career Academic Fellow；旧 Cambridge 任命原档另列 Trinity Title A Fellowship。两项职位分列，个人指导待核。EPFL 论文下载为签名 CDN 重定向，本轮未取到原文。';
audit(b,[['postdoc',bx,[cab]]],'查 Cambridge 两个 fellowship 的个人指导原档及 EPFL 博士签署页。');
personLine(b,'- 核查边界：',' '+source('Cambridge Accelerate 原档',cab)+'。'+bx);
schoolSource(b,' · '+source('Cambridge Accelerate 原档',cab));

const ccv='https://www.bu.edu/physics/files/2025/02/Anushya-Chandran-CV.pdf';
const pi='https://perimeterinstitute.ca/news/future-looks-bright-pi-postdocs';
const cx='本人 2026 CV 明列 2013–2016 Perimeter 博后。Perimeter 2016 年离任原档核其后进入 BU 任教，所阅未列博后个人导师。Max Planck 2024–2025 客座及 2025 Gutzwiller Fellowship 为后续经历。';
audit(c,[['affiliation','本人 CV 列 BU 物理副教授及 2026 年起量子科学与工程硕士项目主任。',[ccv]],['postdoc',cx,[ccv,pi]]],'查 Perimeter 2013–2016 具名指导档。');
personLine(c,'- 核查边界：',' '+source('本人 2026 CV',ccv)+' · '+source('Perimeter 同期原档',pi)+'。'+cx);
schoolReplace(c,'| Shivaji L. Sondhi | 待核 |','| Shivaji L. Sondhi | Perimeter 2013–2016 博后，个人指导待核 |');
schoolSource(c,' · '+source('本人 2026 CV',ccv)+' · '+source('Perimeter 同期原档',pi));

const jhu='https://engineering.jhu.edu/materials/faculty/jonah-erlebacher/';
const ex='JHU 现任原档列材料系主聘及化学与生物分子工程兼任，2000 年加入 JHU；Harvard 应用物理博士授位年列 1999。博士论文日期 1998 年 12 月与授位年分开，1999–2000 任用及博后经历待查。';
audit(e,[['affiliation',ex,[jhu]],['research','JHU 原档核纳米多孔金属、材料微结构计算及能源材料。',[jhu]],['postdoc',ex,[jhu]]],'查 1999–2000 职位记录及是否独立博后。Sandia 实验仍属博士阶段。');
personLine(e,'- 核查边界：',' '+source('JHU 任用原档',jhu)+'。'+ex);
schoolSource(e,' · '+source('JHU 任用原档',jhu));

const uc='https://engineering.ucsb.edu/people/pierre-petroff';
const pc='https://sites.engineering.ucsb.edu/~petroff/Petroff_CV.html';
const up='https://www.ece.ucsb.edu/sites/default/files/2021-08/gear-21-22-ee-bs-degree-overview-pgs-36-37.pdf';
const yp='https://www.aps.anl.gov/files/APS-Uploads/APS-Colloquium/petroff2003feb.pdf';
const px='UCSB ECE 原目录与本人 CV 核 Pierre M. Petroff 为 Berkeley 材料博士、Cornell 1969–1971 博后及 UCSB 材料与 ECE 荣休。Argonne 讲座原档为 Yves Petroff，1970 年巴黎博士及同步辐射研究，属于不同人。';
const pa=audit(p,[['identity',px,[uc,pc,up,yp]],['affiliation','UCSB 材料系和电气与计算机工程荣休教授。',[uc]],['research','半导体自组装量子点、分子束外延与光谱。',[uc,pc]]],'待 eScholarship 退避结束追 Berkeley 学位原档，并查 Cornell 博后的个人指导。');
personLine(p,'- 核查边界：',' '+source('UCSB ECE 学位资料',up)+'。'+px+' '+source('同名者讲座原档',yp));
schoolReplace(p,'| 待核 | Cornell 1969–1971','| UC Berkeley 材料博士，导师待核 | Cornell 1969–1971');
schoolSource(p,' · '+source('UCSB ECE 原目录',up));

const st='https://web.stanford.edu/group/fan/people.html';
const sd='https://stanforddaily.com/2010/10/05/researchers-lay-nanoscale-solar-cell-foundation-2/';
const ws='https://engineering.wisc.edu/directory/profile/zongfu-yu/';
const fan='人员 - Stanford - Shanhui Fan - 9ee31a58';
const yx='Stanford Fan 组历史 Alumni 名录核 Zongfu Yu 及 Wisconsin 去向。2010 年校报采访同时具名 Yu 为博后、称纳米光子太阳能项目由 Fan 团队开展。Wisconsin 履历列 2010 Stanford 博后奖。记录 Fan 为该博后项目课题组负责人，个人正式导师及全部任期待核。';
const ya=audit(y,[['affiliation','Wisconsin ECE Grainger Professor。',[ws]],['research','纳米光子学、光波建模与光学感知。',[ws]],['postdoc',yx,[st,sd,ws]]],'查 Stanford 博后任用原档和个人导师字段；当前证据对应 2010 年项目。');
audits.at(-1).aspects.postdoc.status='group_or_candidate';
addRelation(y,ya,'fan','postdoc',fan,'group_leader',yx,[st,sd,ws]);
const yi=putEdge({id:y,name:'Zongfu Yu',mentor:fan,mentorName:'Shanhui Fan',role:'博士后课题组负责人',reverse:'博士后课题组成员',details:source('Stanford Fan 组原档',st)+' · '+source('Stanford 同期采访',sd)+'。'+yx});
addIndex(index,'Stanford 博后项目组属补证（2026-11-10）',yi);
edit(pf(y),row=>row.startsWith('- 核查边界：'),()=>'- 核查边界：已核 Stanford 2010 年博士后项目组属，个人正式导师及任期月份待查。 '+source('Wisconsin 工程学院履历',ws));
schoolReplace(y,'Stanford 博后，2010 获该校 Postdoc Research Award；个人导师待核','Shanhui Fan（Stanford 2010 博后项目课题组负责人）');
schoolSource(y,' · '+source('Stanford 同期采访',sd));

const wrong=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(p,yp);
if(!wrong)throw Error('缺少已保存同名者原页');
const exclusion=[{page_id:wrong.id,url:yp,record_id:p,audit_id:pa,external_subject:'巴黎 ENS 1970 博士和同步辐射科学家 Yves Petroff',evidence:px}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,exclusions:exclusion.length}));
 process.exit(0);
}
function persist(file,data) {
 fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');
}
function call(script,file) { execFileSync(process.execPath,['--no-warnings',script,...(script==='人物网页身份纠偏.cjs' ? [] : ['record']),file],{stdio:'inherit'}); }
for(const event of audits) {
 const file='20261110_1952_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates) fs.writeFileSync(file,contents,'utf8');
persist('20261110_1952_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_1952_结构化回执.json');


persist('20261110_1952_同名排除.json',exclusion);
call('人物网页身份纠偏.cjs','20261110_1952_同名排除.json');

