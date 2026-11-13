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
 orig.audit_id='pi_archive_20261111_0751_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0751_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"sr":"https://repository.gatech.edu/bitstreams/3d108165-915b-4dc0-84a0-05e55336c379/download#page=2","w":"https://engineering.washu.edu/faculty/Srikanth-Singamaneni.html","ws":"https://siteman.washu.edu/providers/srikanth-singamaneni/","gt":"https://www.mse.gatech.edu/people/vladimir-tsukruk","hum":"https://www.humboldt-foundation.de/en/connect/explore-the-humboldt-network/singleview/1029179/prof-dr-vladimir-v-tsukruk","mar":"https://www.uni-marburg.de/de/fb15/fachbereich/dekanat-verwaltung/chemie.pdf/%40%40download/file/Chronik_neu2.pdf","ua":"https://www.imcnasu.pp.ua/%D0%B3%D0%BE%D0%BB%D0%BE%D0%B2%D0%BD%D0%B0-%D1%81%D1%82%D0%BE%D1%80%D1%96%D0%BD%D0%BA%D0%B0/%D0%B2%D1%87%D0%B5%D0%BD%D1%96-%D1%96%D0%BD%D1%81%D1%82%D0%B8%D1%82%D1%83%D1%82%D1%83/%D1%86%D1%83%D0%BA%D1%80%D1%83%D0%BA-%D0%B2%D0%BE%D0%BB%D0%BE%D0%B4%D0%B8%D0%BC%D0%B8%D1%80-%D0%B2%D0%B0%D1%81%D0%B8%D0%BB%D1%8C%D0%BE%D0%B2%D0%B8%D1%87","ua82":"https://drive.google.com/file/d/1DLEjd_xvK9T6cYV3VU8dJkS7cEZOALwT/view?usp=sharing","ua87":"https://drive.google.com/file/d/1KBtjSnirH_Hg6olmG4KBE8KaQQLftOl7/view?usp=sharing","gc":"https://chemistry.uchicago.edu/giulia-galli","gl":"https://str.llnl.gov/sites/str/files/2024-04/2001.03.pdf","gber":"https://wu.mse.berkeley.edu/ems/pastfliers/2004.pdf","gpap":"https://research.ibm.com/publications/reconstruction-of-the-diamond-1-1-1-surface","pcv":"https://www.usi.ch/sites/default/files/storage/attachments/document/cv_michele_parrinello.pdf#page=1","gital":"https://it.wikipedia.org/wiki/Giulia_Galli","gep":"https://www.epflpress.org/open_access_download/2171/1087","ds":"https://iacs.stonybrook.edu/people/alumni.php","d21":"https://repositorio.uam.es/bitstream/handle/10486/718339/memoria_ciencias_dfmc_2021.pdf?isAllowed=y&sequence=1#page=30","d20":"https://repositorio.uam.es/bitstream/handle/10486/718338/memoria_ciencias_dfmc_2020.pdf?isAllowed=y&sequence=1","sol":"https://www.uam.es/ciencias/en/facultad/departamentos/fisica-materia-condensada/pdi/soler-torroja-jose-maria","dk":"https://mems.duke.edu/people/simon-divilov-ph-d/","dcv":"https://www.eurasc.eu/wp-content/uploads/2025/05/20240712_Curtarolo_CV.pdf","dth":"https://www.stonybrook.edu/commcms/grad-physics-astronomy/_theses/divilov-simon-august-2018.pdf","ac":"https://www.duffield.cornell.edu/people/nicholas-l-abbott/","ad":"https://chemistry.dartmouth.edu/sites/chemistry/files/department_chemistry/wysiwyg/nick_abbott_oct_19.pdf#page=1","am":"https://dspace.mit.edu/entities/publication/a2898f30-950b-4a42-9697-52e62ceddfa1","adb":"https://dbgroup.mit.edu/alumni/nicholas-l-abbott/","aw":"https://www.gmwgroup.harvard.edu/resources"};
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




const s='fc6df0c2',t='73866465',g='15cdaae3',d='89bf70a2',b='a8116085';
const tr=records.get(t).filename;
const sx='本人 Georgia Tech 博士论文《Microstructures and Multifunctional Microsystems Based on Highly Crosslinked Polymers》批准页明确列 Vladimir V. Tsukruk 为 Advisor，2009 年 6 月 23 日批准；封面列 2009 年 8 月博士论文。WashU 工学院核 2009 博士和该组经历。';
const sp='WashU Siteman 履历列 Georgia Tech 材料科学与工程 2009–2010 Postdoctoral Fellow；工学院核 2010 年 1 月入职。两份原件未给出博士后个人指导者，博士论文的 Advisor 仅归于博士阶段。';
updateEdge(s,'Srikanth Singamaneni',tr,'Vladimir V. Tsukruk','博士阶段研究师长','博士阶段研究者','博士导师','博士生',sx,src(['Georgia Tech 博士论文批准页','sr'],['WashU 工学院','w']));
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+sp+' '+src(['Siteman 本人履历','ws'],['WashU 工学院','w']));
cell(s,2,'Vladimir V. Tsukruk（Georgia Tech 博士论文导师，2009）');
schoolWith(s,src(['Georgia Tech 博士论文批准页','sr']));
const sa=audit(s,[a('identity','论文作者全名、学位、材料方向及现任 WashU 履历一致。',['sr','w'],'confirmed'),a('affiliation','WashU 机械工程与材料科学。',['w'],'confirmed'),a('research','纳米光子学、等离激元与表面增强 Raman 材料和传感。',['w'],'confirmed'),a('phd',sx,['sr','w'],'confirmed_advisor'),a('postdoc',sp,['ws','w'],'unresolved')],'查 Georgia Tech 2009 年博士后雇用或组名录，确认博士后阶段指导。');
relation(s,sa,'phd',tr,'advisor',sx,ids('sr','w'),'tsukruk');

const ru='师承人物 - Wilhelm Ruland',we='师承人物 - Joachim H. Wendorff';
const trr='Humboldt 基金会的 Host during sponsorship 列 Wilhelm Ruland（Marburg），该校化学系系史具名 Ruland 与 Wendorff 两位合作接收人及 1990、1996 年。Georgia Tech 将 Marburg 列为博士后研究地。以博士后项目接收教师标注，具体每次任期及正式指导职衔待核。';
const trw='Humboldt 原档列 Joachim H. Wendorff 为 Darmstadt DKI 与 Marburg 的接收教师。乌克兰科学院研究所原档核 1990 Darmstadt Humboldt 任用，Marburg 化学系系史独立核 Wendorff 与 Ruland；正式指导职衔未见。';
const td='乌克兰科学院研究所原档区分 1982 年候选科学学位答辩和 1987 年高级博士答辩，给出两份作者学位摘要。Georgia Tech 既有履历写 1983 年 PhD，年份按来源分别保留。Lipatov 仍为博士导师候选，两份摘要链接未取得正文。';
const tp='Humboldt 基金会列首次资助自 1990 年 9 月 1 日。研究所原档另列 1992–1993 Akron 研究员，Georgia Tech 概括为博士后研究，个人指导者待核。Marburg 系史同时列 1990 与 1996，基金会另列 2009 研究奖及 Bayreuth 的接收教师，不并入早期博士后。';
mentor(ru,'Wilhelm Ruland','Philipps-Universität Marburg 聚合物物理研究者及 Humboldt 项目接收教师。',src(['Marburg 化学系系史','mar'],['Humboldt 原档','hum']));
mentor(we,'Joachim H. Wendorff','Darmstadt DKI 和 Philipps-Universität Marburg 聚合物研究者及 Humboldt 项目接收教师。',src(['Marburg 化学系系史','mar'],['Humboldt 原档','hum']));
edge(t,'Vladimir V. Tsukruk',ru,'Wilhelm Ruland','博士后项目接收教师','博士后阶段研究者',trr,src(['Humboldt 原档','hum'],['Marburg 化学系系史','mar'],['Georgia Tech','gt']));
edge(t,'Vladimir V. Tsukruk',we,'Joachim H. Wendorff','博士后项目接收教师','博士后阶段研究者',trw,src(['Humboldt 原档','hum'],['Marburg 化学系系史','mar'],['乌克兰科学院研究所','ua']));
rewrite(pf(t),x=>x.startsWith(boundary),()=>boundary+td+' '+tp+' '+src(['乌克兰科学院研究所','ua'],['Georgia Tech 材料系','gt'],['Humboldt 原档','hum'],['Marburg 化学系系史','mar']));
cell(t,2,'Yu. Lipatov（博士导师候选）；1982 答辩／1983 PhD 记录分列，1987 高级博士另列');
cell(t,3,'Wilhelm Ruland（Marburg 接收教师）；Joachim H. Wendorff（Darmstadt／Marburg 接收教师）；Akron 1992–1993 指导者待核');
schoolWith(t,src(['Humboldt 原档','hum'],['Marburg 化学系系史','mar'],['乌克兰科学院研究所','ua']));
const ta=audit(t,[a('identity','乌克兰科学院研究所用乌克兰文、俄文姓名及相符教育任职，与 Georgia Tech、Humboldt 原档一致。',['ua','gt','hum'],'confirmed'),a('affiliation','Georgia Tech 材料科学与工程，Humboldt 现联系单位一致。',['gt','hum'],'confirmed'),a('research','软物质、聚合物界面、纳米结构材料。',['gt','hum','ua'],'confirmed'),a('phd',td,['ua','gt'],'group_or_candidate'),a('postdoc',trr+' '+trw+' '+tp,['hum','mar','ua','gt'],'group_or_candidate')],'查 1982 原摘要签署页及 Akron 博后接收或指导文件，核 Marburg／Darmstadt 各期时间。');
relation(t,ta,'postdoc',ru,'stage_mentor',trr,ids('hum','mar','gt'),'ruland');
relation(t,ta,'postdoc',we,'stage_mentor',trw,ids('hum','mar','ua'),'wendorff');

const par='师承人物 - Michele Parrinello';
const gp='Chicago 与 LLNL 原档核 Galli 在 IBM Zürich 的博士后阶段；Parrinello 本人 CV 列 1989–1991 任该处 Research Staff、1991–1994 任经理。IBM 原出版目录列两人的早期合作；意大利语二手传记称其在 Parrinello 指导团队工作。保留低可信正式导师候选，阶段主持及个人指导待一手档。';
const gg='Chicago 化学系列 SISSA 物理博士 1987，Berkeley 2004 当期讲座履历列 1986。两份年份并存。LLNL 2001 原档以 Giulia Galli Gygi 署名，并分列 UIUC 和 IBM Zürich 两段博士后。UIUC 与 Richard M. Martin 的既有关系仍待一手证据。';
edge(g,'Giulia Galli',par,'Michele Parrinello','博士后导师候选','博士后候选研究者',gp,src(['Chicago 化学系','gc'],['Parrinello 本人 CV','pcv'],['IBM 原出版目录','gpap'],['二手线索','gital']));
pl(g,boundary,gg+' '+src(['Chicago 化学系','gc'],['LLNL 2001 原档','gl'],['Berkeley 2004 讲座档','gber']));
cell(g,2,'SISSA Trieste 物理博士（1986／1987 年份待核；导师待核）');
cell(g,3,'Richard M. Martin（UIUC，研究师长待一手核）；Michele Parrinello（IBM Zürich 正式导师候选）');
schoolWith(g,src(['Chicago 化学系','gc'],['LLNL 2001 原档','gl'],['Parrinello 本人 CV','pcv']));
const ga=audit(g,[a('identity','LLNL 当期原档使用 Giulia Galli Gygi，教育、UIUC／IBM 博后与现任 Chicago 系页一致。',['gl','gc','gber'],'confirmed'),a('affiliation','Chicago Chemistry 和 Pritzker Molecular Engineering，Argonne senior scientist。',['gc'],'confirmed'),a('research','电子结构、第一性原理量子模拟及凝聚相材料。',['gc','gl'],'confirmed'),a('phd',gg,['gc','gber','gl'],'unresolved'),a('postdoc',gg+' '+gp,['gc','gl','gpap','pcv','gital'],'group_or_candidate')],'追 SISSA 论文题名及指导登记；用 Giulia Galli Gygi 别名继续追 UIUC 与 IBM 两段原任用。');
relation(g,ga,'postdoc',par,'candidate',gp,ids('gc','gl','gpap','pcv','gital'),'parrinello');

const ds='Stony Brook IACS 校友档在本人行明确列 Universidad Autónoma de Madrid 为 Postdoctoral Researcher 去向。UAM 2020 和 2021 两份凝聚态物理系年报将 Divilov 列为 SIESTA-UAM 项目研究员，José María Soler Torroja 列为项目 IP。保留低可信博士后导师候选，原档支持项目职衔，个人指导待查。';
const sol='师承人物 - José María Soler Torroja';
const dname=records.get(d).filename;
const dlink=src(['Stony Brook IACS 原档','ds'],['UAM 2020 年报','d20'],['UAM 2021 年报','d21'],['UAM 负责人教师档','sol']);
rewrite(pf(d),x=>x.startsWith('- 博士后导师候选：')&&x.includes(sol),x=>x+' '+ds+' '+dlink);
rewrite(mf(sol),x=>x.startsWith('- 博士后候选研究者：')&&x.includes(dname),x=>x+' '+ds+' '+dlink);
const dl=get(index).split(/\r?\n/).find(x=>x.includes(dname)&&x.includes(sol)&&x.includes('博士后导师候选'));
if(dl)rewrite(index,x=>x===dl,x=>x+' '+ds+' '+dlink);
else insertAfter(index,'# 师承关系与候选线索索引','\n- '+who(d,'Simon Divilov')+' → 博士后导师候选：'+wiki(sol,'José María Soler Torroja')+'。'+ds+' '+dlink);
schoolWith(d,dlink);
const da=audit(d,[a('identity','2018 Stony Brook 博士、UAM 博后和 Duke 现任的姓名、领域和阶段相符。',['ds','d20','d21','dk'],'confirmed'),a('affiliation','Duke 机械工程与材料科学 Assistant Research Professor。',['dk'],'confirmed'),a('research','计算材料、高熵材料与合金相变。',['dk'],'confirmed'),a('postdoc',ds+' Duke 阶段的 Curtarolo 组属和历史证据继续分列。',['ds','d20','d21','sol','dk'],'group_or_candidate')],'追 UAM 和 Duke 两段个人指导文件及聘期边界。');
relation(d,da,'postdoc',sol,'candidate',ds,ids('ds','d20','d21','sol'),'soler');

const bw='师承人物 - George M. Whitesides';
const ba='Cornell 原档列 Harvard 化学系 1991–1993 博士后和具名 research with George M. Whitesides；Dartmouth 讲者原件独立核任期，Whitesides 组档列 1991-11-18 至 1993-06-02。阶段研究师长，正式导师称谓待查。';
const bd='Cornell 教育履历和 Dartmouth 讲者原档均将 MIT 博士列 1991；MIT 目录既有记录是 1992 年并列 Daniel Blankschtein、T. Alan Hatton。检索显示同题名和字段，主机退避期间保留原人物页及博士复核状态，待读原目录和签署页。';
updateEdge(b,'Nicholas L. Abbott',bw,'George M. Whitesides','博士后研究师长','博士后阶段研究者','博士后阶段研究师长','博士后阶段研究者',ba,src(['Cornell 工程学院','ac'],['Dartmouth 原讲座','ad'],['Harvard 组档','aw']));
rewrite(pf(b),x=>x.startsWith(boundary),()=>boundary+bd+' '+src(['Cornell 工程学院','ac'],['Dartmouth 原讲座','ad'],['待重核的 MIT 学位目录','am']));
schoolWith(b,src(['Dartmouth 原讲座','ad']));
const bb=audit(b,[a('identity','Dartmouth 原件与 Cornell 教师档的教育、Harvard 博后、Wisconsin 及 Cornell 轨迹相符。',['ad','ac'],'confirmed'),a('affiliation','Cornell 化学与生物分子工程，另列相关研究生项目。',['ac'],'confirmed'),a('research','液晶、软物质和界面材料。',['ac','ad'],'confirmed'),a('phd',bd,['ac','ad','am'],'unresolved'),a('postdoc',ba,['ac','ad','aw'],'group_or_candidate')],'MIT 主机退避到期后核已定位的正式目录字段和学位论文签署页，并查 Harvard 正式指导称谓。');
relation(b,bb,'postdoc',bw,'stage_mentor',ba,ids('ac','ad','aw'),'whitesides');

const pages=[
 [s,'sr','Georgia Tech’s 2009 dissertation cover identifies Srikanth Singamaneni; approval page designates Vladimir V. Tsukruk as Advisor and dates approval June 23, 2009.','博士论文批准页明确正式导师。'],
 [s,'w','WashU Engineering confirms Georgia Tech graduate research with Tsukruk, January 2010 WashU hire and current research in materials, plasmonics, and Raman techniques.','复核学位阶段、院系、研究。'],
 [s,'ws','Siteman lists 2009–2010 Postdoctoral Fellow at Georgia Tech in Materials Science and Engineering.','独立确认博士后阶段，未具名导师。'],
 [t,'hum','The Humboldt Foundation identifies Wilhelm Ruland and Joachim H. Wendorff as hosts, with initial sponsorship starting 1 September 1990; later Bayreuth project hosts are listed separately in the project description.','核早期德国项目接收教师。'],
 [t,'mar','Marburg Chemistry historical chronicle names both Wendorff and Ruland in Tsukruk’s entry and gives 1990 and 1996.','以原系史交叉核姓名与时间。'],
 [t,'ua','Ukrainian Academy institute biography identifies Tsukruk, separates the 1982 and 1987 dissertations, records Humboldt-supported Darmstadt research in 1990 and Akron research in 1992–1993.','核原学位及博后时间线，链接原学位摘要。'],
 [t,'gt','Georgia Tech materials faculty profile lists polymer science and chemistry degrees and postdoctoral research in Marburg, Darmstadt and Akron.','核院系、方向及阶段。'],
 [g,'gc','Chicago Chemistry lists 1987 SISSA PhD, 1989 Illinois postdoctoral fellow and 1990 IBM Research Laboratory Zürich postdoctoral fellow.','核两阶段院校。'],
 [g,'gl','LLNL’s March 2001 magazine names Giulia Galli Gygi and records University of Illinois and IBM Zürich postdoctoral research.','补原使用姓及两段任用。'],
 [g,'gpap','IBM’s publication archive lists Galli and Parrinello among authors of an early diamond-surface paper.','同期合作为追查线索。'],
 [g,'pcv','Parrinello’s CV records IBM Zürich research staff 1989–1991 and manager 1991–1994.','核对候选在岗时间。'],
 [d,'ds','Stony Brook IACS alumni directory identifies Simon Divilov as Physics and Astronomy PhD and lists Postdoctoral Researcher at UAM.','核早期博士后任用。'],
 [d,'d21','UAM Condensed Matter Physics annual report lists Divilov as an investigator on SIESTA-UAM with Soler Torroja listed as IP.','独立补证项目负责人，个人指导待核。'],
 [d,'sol','UAM’s departmental directory identifies José María Soler Torroja.','核项目负责人身份。'],
 [d,'dk','Duke’s department identifies Simon Divilov as assistant research professor with a 2018 Stony Brook PhD.','核身份、任用与方向。'],
 [b,'ad','Dartmouth lecture biography records MIT chemical engineering doctorate and Harvard Chemistry postdoctoral fellowship during 1991–1993.','补博后任期，保留 MIT 年份差异。'],
 [b,'ac','Cornell lists 1991 MIT doctorate and Harvard postdoctoral research with George M. Whitesides, plus Cornell field affiliations and surface/soft-matter research.','补阶段研究师长原证。'],
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
for(const [record_id,key,error] of [[t,'ua82','Cache miss for Academy-linked candidate-science thesis abstract.'],[t,'ua87','Cache miss for Academy-linked higher doctorate abstract.'],[g,'gep','EPFL Press original returned a timeout.'],[d,'dcv','502 Bad Gateway on original 2024 CV; prior verified account retained.'],[b,'adb','502 Bad Gateway on official MIT alumni entry.']])pages.push({record_id,url:u[key],error});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0751_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0751_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0751_GeorgiaTech与Humboldt原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
