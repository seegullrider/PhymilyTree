const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const batch = '20261111_PNNL与同期任用原档';
const files = new Map();
const events = [];
const relations = [];
const pages = [];
const index = '../师承关系索引.md';
const records = db.prepare('SELECT id,name,unit,filename FROM records WHERE id=?');
const latest = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const sources = {
 pnnl: 'https://www.pnnl.gov/news-media/kelsey-stoerzinger-earns-young-investigator-lectureship',
 term: 'https://www.pnnl.gov/news-media/rational-design-more-active-catalysts-kelsey-stoerzinger',
 award: 'https://www.pnnl.gov/projects/linus-pauling-distinguished-postdoctoral-fellowship/alumni',
 umn: 'https://cse.umn.edu/cems/kelsey-stoerzinger',
 uconn: 'https://chemical-biomolecular.engineering.uconn.edu/people/faculty/xiao-dong-zhou/',
 case: 'https://ctcase.org/bios/xiao-dong-zhou/',
 netl: 'https://netl.doe.gov/sites/default/files/event-proceedings/fuel-cells-archive/Harlan-Anderson-UMR.pdf',
 mst: 'https://news.mst.edu/2004/08/umr_helps_with_nationwide_effo/',
 cmu: 'https://www.cmu.edu/nanotechnology-forum/Forum_4/CV/Zhou.pdf',
 fal: 'https://physics.berkeley.edu/research-faculty/roger-falcone-research-group/publications',
 fcv: 'https://physics.berkeley.edu/research-faculty/roger-falcone-research-group/curriculum-vitae',
 gin: 'https://citeseerx.ist.psu.edu/document?doi=249dc331f272ceb2ea9aed2123d8d4474790e740&repid=rep1&type=pdf',
 harris: 'https://profiles.stanford.edu/stephen-harris',
 searchworks: 'https://searchworks.stanford.edu/?q=Roger%20Falcone',
 lin: 'https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=15400&profileversion=full',
 ltitle: 'https://pure.mpg.de/rest/items/item_3021351_3/component/file_3021352/content',
 epfl: 'https://infoscience.epfl.ch/record/33443/files/EPFL_TH2970.pdf#page=1',
 tenio: 'https://jila.colorado.edu/sites/default/files/2024-09/B-Wang%20Thesis.pdf',
 tfail: 'https://www.academia.edu/figures/38501658/figure-4-experimental-setup-legend-cpa-ii-chirped-pulse',
 vinals: 'https://www-users.cse.umn.edu/~vinals/mss/jv2_jpsj_galley.pdf',
 mcgill: 'https://www.reporter-archive.mcgill.ca/37/07/newprofs/vinals/index.html',
 vfail: 'https://diposit.ub.edu/server/api/core/bitstreams/eb9fbb49-636d-4a05-9bbc-33e854d5ecd2/content',
 chicago: 'https://chemistry.uchicago.edu/faculty/michael-hopkins',
 caltech: 'https://calteches.library.caltech.edu/602/2/Random.pdf',
 liv: 'https://www.liverpool.ac.uk/people/michael-hopkins',
 livProfessional: 'https://www.liverpool.ac.uk/people/michael-hopkins/professional'
};
const fileFor = name => '../人物/' + name + '.md';
const ref = (label,key) => '[' + label + '](' + sources[key] + ')';
const url = keys => keys.map(key => sources[key]);
const wiki = (target,name) => '[[' + target + '|' + name + ']]';
const get = file => files.get(file) ?? fs.readFileSync(file,'utf8');
const heading = '- 核查边界：';
function edit(file, predicate, transform) {
 const text = get(file);
 const nl = text.includes('\r\n') ? '\r\n' : '\n';
 const rows = text.split(/\r?\n/);
 const hits = rows.flatMap((row,i) => predicate(row) ? [i] : []);
 if (hits.length !== 1) throw Error(file + ': expected one matching line, found ' + hits.length);
 const i = hits[0];
 rows[i] = transform(rows[i],nl);
 files.set(file,rows.join(nl));
}
function append(file, entry) {
 const text = get(file);
 const nl = text.includes('\r\n') ? '\r\n' : '\n';
 if (!text.includes(entry)) files.set(file,text.trimEnd() + nl + entry + nl);
}
function person(p,text) {
 edit(fileFor(p.filename),line=>line.startsWith(heading),(line,nl)=>line + nl + '- ' + text);
}
function school(p,cells,refs) {
 edit('../'+p.unit+'逐人复核记录.md',line=>line.startsWith('| [['+p.filename+'|'),line=>{
  const end = line.indexOf(']]');
  const rest = line.slice(end+2).split(' | ');
  if (rest.length!==5 || !rest[4].endsWith(' |')) throw Error('Unexpected table row ' + p.name);
  for (const [i,value] of cells) rest[i] = value;
  rest[4] = rest[4].slice(0,-2) + ' · ' + refs + ' |';
  return line.slice(0,end+2) + rest.join(' | ');
 });
}
function review(p, changes, next) {
 const event = JSON.parse(latest.get(p.id).details_json);
 event.audit_id = 'pi_archive_20261111_pnnl_' + p.id;
 for (const [part,note,keys,status] of changes) {
  const old = event.aspects[part];
  event.aspects[part] = {...old,note,status:status??old.status,sources:[...new Set([...old.sources,...url(keys)])]};
 }
 event.next_step = next;
 event.followup_required = true;
 events.push(event);
 return event;
}
function observed(p,key,raw,excerpt) {
 pages.push({record_id:p.id,url:sources[key],raw,excerpt});
}
function failure(p,key,error) {
 pages.push({record_id:p.id,url:sources[key],error});
}
function mentor(target,name,description) {
 const file = fileFor(target);
 if (!fs.existsSync(file) && !files.has(file)) files.set(file,'# ' + name + '\n\n- 类型：师承扩展人物\n- ' + description + '\n\n## 师承\n');
}
function edge(p,event,stage,kind,target,name,note,keys,refs) {
 const roles = {
  'postdoc.stage_mentor':['博士后阶段研究师长','博士后阶段受指导者'],
  'postdoc.candidate':['博士后导师候选','博士后研究者候选（待核）'],
  'phd.candidate':['博士导师候选','博士阶段研究者候选（待核）']
 };
 const [forward,reverse] = roles[stage+'.'+kind];
 const trainee = wiki(p.filename,p.name);
 const guide = wiki(target,name);
 const detail = note + ' ' + refs;
 edit(fileFor(p.filename),line=>line.startsWith(heading),(line,nl)=>'- '+forward+'：'+guide+'。'+detail+nl+line);
 append(fileFor(target),'- '+reverse+'：'+trainee+'。'+detail);
 append(index,'- '+trainee+' → '+forward+'：'+guide+'。'+detail);
 relations.push({event_id:event.audit_id+'_'+stage,record_id:p.id,stage,kind,mentor_filename:target,source_audit_id:event.audit_id,evidence:note,sources:url(keys)});
}

{
 const p=records.get('fb475ef0');
 const note='PNNL 2018 年同期报道明列 Stoerzinger 为 Pauling 博士后并直接具名 Scott Chambers 指导，2019 PNNL 人物档列 2016–2018 博士后任期与后续科研聘任。具名研究师长，正式任用称谓待核。';
 const refs=ref('PNNL 2018 具名指导','pnnl')+' · '+ref('PNNL 任期','term');
 const e=review(p,[['postdoc',note,['pnnl','term','award'],'group_or_candidate'],['affiliation','Minnesota 化学工程与材料科学系副教授。PNNL 名录的 Oregon State 属较早任用。',['umn','award'],'confirmed'],['research','电催化材料表界面及反应机理。',['umn'],'confirmed']],'保存 Scott Chambers 具名研究指导，续查 Pauling 聘任档中个人导师称谓。');
 edge(p,e,'postdoc','stage_mentor','师承人物 - Scott Chambers','Scott A. Chambers',note,['pnnl','term'],refs);
 edit(fileFor(p.filename),line=>line.startsWith(heading),()=>heading+'PNNL 博士后期间已核具名指导，个人正式任用称谓仍待查。 '+refs+' · '+ref('Minnesota 院系','umn'));
 school(p,[[3,'Scott A. Chambers（2016–2018 PNNL 博士后阶段研究师长）']],refs);
 observed(p,'pnnl','2018 PNNL announcement, L243–245: Pauling Fellow Kelsey Stoerzinger is described as mentored by Scott Chambers.','奖助在岗时的原档具名个人研究指导。');
 observed(p,'award','L322: Kelsey Stoerzinger – 2016 Pauling Fellow.','历届项目原档和学位机构吻合。');
 observed(p,'umn','L15–17: Kelsey Stoerzinger, Associate Professor. Chemical Engineering and Materials Science.','核在职单位和职称。');
}
{
 const p=records.get('87e4ad7e');
 const note='2003 年 NETL 托管的 Missouri–Rolla 同期项目原册列 Anderson 为 EMARC 主任，列 Zhou 为 Postdoctoral Fellow 及 Co-PI。CMU 履历核 2001–2003 博后，2004–2005 助理研究教授另列。项目职务支持候选，个人指导称谓待查。';
 const refs=ref('NETL 同期任用和项目原册','netl')+' · '+ref('本人履历','cmu')+' · '+ref('Missouri S&T 同期校报','mst');
 const e=review(p,[['postdoc',note,['netl','mst','cmu'],'group_or_candidate'],['affiliation','UConn 化工、材料和机械工程教授，清洁能源工程中心主任及 Nicholas E. Madonna Chair。',['uconn','case'],'confirmed'],['research','功能氧化物、固态电化学材料与界面、能源转化。',['uconn','case'],'confirmed']],'按 Missouri–Rolla 2001 Ceramic Engineering 学位追论文原卷，再查 2001–2003 EMARC 任用的个人指导。');
 mentor('师承人物 - Harlan U. Anderson','Harlan U. Anderson','Missouri–Rolla 陶瓷工程荣休教授与 EMARC 主任。 '+ref('同期校报','mst'));
 edge(p,e,'postdoc','candidate','师承人物 - Harlan U. Anderson','Harlan U. Anderson',note,['netl','cmu','mst'],refs);
 edit(fileFor(p.filename),line=>line.startsWith('- UConn 化工、机械与材料工程教授'),line=>line+' 任清洁能源工程中心主任，Connecticut Academy of Science and Engineering 具名 Nicholas E. Madonna Chair。 '+ref('UConn 化工系','uconn')+' · '+ref('CASE 履历','case'));
 school(p,[[1,'Chemical and Biomolecular Engineering、Mechanical Engineering、Materials Science and Engineering；清洁能源工程中心主任；电化学材料、功能氧化物、能源材料'],[3,'Missouri–Rolla 2001–2003 博士后；Harlan U. Anderson（项目关联候选）']],refs+' · '+ref('UConn 化工系','uconn'));
 observed(p,'netl','L22–25: Harlan U. Anderson, Director, Electronic Materials Applied Research Center. L55: Xiao-Dong Zhou (Co-PI) — Postdoctoral Fellow.','NETL 原册列同期角色。');
 observed(p,'uconn','L142–143: Xiao-Dong Zhou, Professor, Director of Center for Clean Energy Engineering.','UConn 化工系核在职及中心任用。');
 observed(p,'case','L31–36: UConn Chemical and Biomolecular Engineering, Materials Science and Engineering, and Mechanical Engineering appointments. Missouri–Rolla, 2001, PhD, Ceramic Engineering.','核交叉任用和学位。');
}
{
 const p=records.get('1fff70c0');
 const refs=ref('Falcone 本人出版档','fal')+' · '+ref('Stanford Ginzton 同期报告','gin')+' · '+ref('Falcone 本人 CV','fcv');
 const phd='Berkeley 本人 CV 列 1979 Stanford EE 博士，学校所载 1976–1979 书目及 Harris 与 Young 的 Ginzton 报告证同期激光碰撞课题协作。按博士阶段候选，正式签署待查。';
 const post='本人 CV 列 Stanford 1980–1983 Marvin Chodorow Fellow。Harris 与 Young 的 1982 Ginzton 报告在本组研究成果中具体列 Falcone 的工作，并与其 1980–1983 书目同期。按 fellowship 阶段候选，个人任用指导待查。';
 const e=review(p,[['phd',phd,['fal','gin','fcv'],'group_or_candidate'],['postdoc',post,['fal','gin','fcv'],'group_or_candidate']],'继续查 Stanford EE 1979 纸本卷册、Harris 本人指导名录及 1980–1983 fellowship 原任用。');
 mentor('师承人物 - Stephen E. Harris','Stephen E. Harris','Stanford 光学及激光物理。 '+ref('Stanford 人员档','harris'));
 edge(p,e,'phd','candidate','师承人物 - Stephen E. Harris','Stephen E. Harris',phd,['fal','gin','fcv'],refs);
 edge(p,e,'postdoc','candidate','师承人物 - Stephen E. Harris','Stephen E. Harris',post,['fal','gin','fcv'],refs);
 school(p,[[2,'Stephen E. Harris（博士导师候选）'],[3,'Stanford Applied Physics 1980–1983 fellowship；Stephen E. Harris（博士后候选）']],refs);
 observed(p,'fal','L391–435: 1976–1979 and 1980–1983 publications include both Falcone and Harris.','为两个阶段记录同一研究线的时间证据。');
 observed(p,'gin','L67–88: S. E. Harris and J. F. Young, Edward L. Ginzton Laboratory, Stanford, November 1982. L173–204: research-group report discusses Falcone’s laser and ONR-supported work.','具名同一项目和工作。');
 failure(p,'searchworks','Stanford SearchWorks 作者查询不可访问，未取得书目正文');
}
{
 const p=records.get('b85b2726');
 const refs=ref('Max Planck 托管原刊参考文献 46','ltitle')+' · '+ref('EPFL 论文参考文献 4','epfl')+' · '+ref('Stanford 教员档','lin');
 const detail='两项学术原档参考文献核 2001 Berkeley 博士论文题名《Ultrafast Lattice Dynamics in Solids Probed by Time-resolved X-ray Diffraction》。Stanford 教员档列材料科学与工程、Photon Science 任用和 2001–2003 Berkeley 博后。博士原卷签署及博士后个人导师继续核查。';
 const prev=JSON.parse(latest.get(p.id).details_json);
 review(p,[['phd',prev.aspects.phd.note+' '+detail,['ltitle','epfl','lin']],['affiliation','Stanford 材料科学与工程和 Photon Science 教授。',['lin'],'confirmed'],['research','飞秒／皮秒尺度的 X 射线和电子散射、量子与纳米材料相变及输运。',['lin'],'confirmed']],'以完整题名查 Berkeley 纸本博士论文，并追 Berkeley 2001–2003 fellowship 个人指导。');
 person(p,'博士论文书目核对。'+detail+' '+refs);
 school(p,[],refs);
 observed(p,'ltitle','L869–871: Lindenberg, A. M. Ultrafast Lattice Dynamics in Solids Probed by Time-resolved X-ray Diffraction. Ph.D. thesis, University of California, Berkeley (2001).','完整题名线索来自引用该论文的原刊参考文献。');
 observed(p,'epfl','L2714–2715: A.M. Lindenberg, PhD thesis (2001), University of California, Berkeley, ultrafast lattice dynamics title.','交叉核学位论文书目。');
 observed(p,'lin','L13–25 and L33: Stanford Materials Science and Engineering and Photon Science appointments, Berkeley PhD 2001 and postdoctoral Faculty Fellow 2001–2003.','核院系和博士后分段。');
}
{
 const p=records.get('945105b9');
 const prev=JSON.parse(latest.get(p.id).details_json);
 const refs=ref('JILA B. Wang 论文参考文献 71','tenio');
 const detail='JILA 托管 B. Wang 博士论文参考文献 71 也列该题名与 2009 年，维持学校简介 2010 年的异文。公开论文转载的图版入口未返回前页。';
 review(p,[['phd',prev.aspects.phd.note+' '+detail,['tenio']]],'待 Colorado 图书馆馆藏或签署页可用时核两位博士导师及学位日期；保留既有 JILA 博后组属。');
 person(p,detail+' '+refs);
 school(p,[],refs);
 observed(p,'tenio','Reference [71]: T. Popmintchev. Tunable Ultrafast Coherent Light in the Soft and Hard X-ray Regions of the Spectrum: Phase Matching of Extreme High-Order Harmonic Generation. PhD thesis, University of Colorado, Boulder, (2009).','补论文书目交叉来源。');
 failure(p,'tfail','Cache miss，未取得论文前页或指导字段');
}
{
 const p=records.get('fbbf8618');
 const detail='本人署名期刊作者简介确认 1983 Barcelona 物理博士和 1989 加入 Florida State 的 Supercomputer Computations Research Institute。McGill 同期校报核其后 McGill 物理任用与材料研究。1983–1989 的任用和导师继续查。';
 const refs=ref('本人论文作者简介','vinals')+' · '+ref('McGill 同期校报','mcgill');
 const prev=JSON.parse(latest.get(p.id).details_json);
 review(p,[['phd',prev.aspects.phd.note+' '+detail,['vinals','mcgill']],['postdoc',detail,['vinals','mcgill']]],'追查 Barcelona 学位书目及 1983–1989 任用。按题材核马氏体相变早期论文作者，保留未经证实的关系线索。');
 person(p,detail+' '+refs);
 school(p,[],refs);
 observed(p,'vinals','L695–700: 1983 Ph.D. in Physics at the University of Barcelona. Joined Florida State University in 1989; since 2004 a Professor of Physics and Canada Research Chair at McGill.','核学位至早期任职的两个确定时间点。');
 failure(p,'vfail','Cache miss，Barcelona 馆藏相关参考文献页未取回');
}
const hopkins=records.get('fab3a8d7');
const distinction='Liverpool 人员档明列历史系 Reader in American Foreign Policy。Chicago 化学系及 Caltech 当期校刊的 Michael David Hopkins 是无机化学博士，洛斯阿拉莫斯任用与其无机材料方向一致。';
const hopkinsAudit=review(hopkins,[['identity',distinction,['liv','chicago','caltech'],'confirmed']], '保留 Caltech Harry B. Gray 博士指导，续查 1986–1987 Los Alamos Director’s Postdoctoral Fellow 的接收和指导原档。');
const hopRefs=ref('Liverpool 人员档','liv')+' · '+ref('Caltech 当期校刊','caltech');
person(hopkins,'同名排除。'+distinction+' '+hopRefs);
school(hopkins,[],hopRefs);
observed(hopkins,'caltech','L17–20: Michael Hopkins received his PhD in inorganic chemistry for work done with Harry Gray and is now at Los Alamos National Laboratory.','Caltech 1987 同期刊物交叉核身份和阶段。');
const misassigned=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(hopkins.id,sources.livProfessional);
if(!misassigned)throw Error('Liverpool page missing from queue');
const exclusions=[{page_id:misassigned.id,url:sources.livProfessional,record_id:hopkins.id,audit_id:hopkinsAudit.audit_id,external_subject:'Michael Hopkins（University of Liverpool 历史系美国外交政策）',evidence:distinction}];
db.close();

const stats={files:files.size,events:events.length,relations:relations.length,read:pages.filter(p=>p.raw).length,failed:pages.filter(p=>p.error).length,excluded:exclusions.length};
console.log(JSON.stringify(stats));
if(process.argv[2]!=='apply')process.exit(0);
function save(name,value) {
 const filename=batch+'_'+name+'.json';
 fs.writeFileSync(filename,JSON.stringify(value,null,2)+'\n','utf8');
 return filename;
}
function call(file,...args) {
 execFileSync(process.execPath,['--no-warnings',file,...args],{stdio:'inherit'});
}
const auditFiles=events.map(event=>save('人工_'+event.record_id,event));
const relationFile=save('关系',relations);
const pageFile=save('原档',pages);
const exclusionFile=save('同名排除',exclusions);
for(const [filename,content] of files)fs.writeFileSync(filename,content,'utf8');
for(const filename of auditFiles)call('人工核查台账.cjs','record',filename);
call('结构化师承关系.cjs','record',relationFile);
call('人物网页身份纠偏.cjs',exclusionFile);
call('检索流程.cjs','ingest-reviewed-pages',pageFile);
call('检索流程.cjs','report');
