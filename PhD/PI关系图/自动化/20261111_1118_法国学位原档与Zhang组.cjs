const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
const root = '..';
const batch = '20261111_1118';
const files = new Map();
const audits = new Map();
const relations = [];
const pages = [];
const index = '师承关系索引.md';
const zhang = '师承人物 - Xiang Zhang（原 Berkeley 光子学）';
const u = {
  award: 'https://www.sorbonne.fr/wp-content/uploads/2013/09/prixchancellerie20101.pdf',
  kante: 'https://kante.berkeley.edu/members/',
  kanteEecs: 'https://www2.eecs.berkeley.edu/Faculty/Homepages/bkante.html',
  berger: 'https://physics.gatech.edu/user/claire-berger',
  ipcms: 'https://www.ipcms.fr/uploads/2021/02/Theses_pour-le-web_040918.pdf',
  ipcmsOld: 'https://www.ipcms.fr/wp-content/uploads/2021/02/Theses_pour-le-web_040918.pdf',
  zhangLab: 'https://xlab.hku.hk/alumni.html',
  feng: 'https://www.ece.uw.edu/colloquia/liang-feng/',
  fengCaltech: 'https://www.eas.caltech.edu/news/engineers-solve-longstanding-problem-in-photonic-chip-technology',
  fengPenn: 'https://curf.upenn.edu/profile/liang-feng',
  kedar: 'https://ifim.nus.edu.sg/people/kedarhippalgaonkar/',
  taufour: 'https://physics.ucdavis.edu/people/faculty/valentin-taufour',
  taufourThesis: 'https://citeseerx.ist.psu.edu/document?doi=1f31f384cdc089228fb983eb8673ab188b609ad3&repid=rep1&type=pdf',
  taufourCea: 'https://www.pheliqs.fr/Pages/Imapec/Theses/Valentin-Taufour.aspx',
  canfield: 'https://faculty.sites.iastate.edu/canfield/previous-members',
  sauret: 'https://theses.fr/2013AIXM4703',
  brun: 'https://theses.hal.science/tel-00761399'
};
const record = db.prepare('SELECT id,name,filename,unit FROM records WHERE id=?');
const previous = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const f = filename => path.join('人物',filename+'.md');
const wiki = (filename,label) => '[['+filename+'|'+label+']]';
const read = file => files.get(file) ?? fs.readFileSync(path.join(root,file),'utf8');
const refs = (keys) => keys.map(([name,key]) => '['+name+']('+u[key]+')').join(' · ');

function replaceLine(file, match, replacement) {
  const before = read(file);
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  const rows = before.split(/\r?\n/);
  const indices = rows.flatMap((line,i) => match(line) ? [i] : []);
  if (indices.length !== 1) throw Error(file+' expected one matching row, found '+indices.length);
  const i = indices[0];
  rows[i] = typeof replacement==='function' ? replacement(rows[i], eol) : replacement;
  files.set(file,rows.join(eol));
}

function appendAt(file, heading, line) {
  if (read(file).split(/\r?\n/).includes(line)) return;
  replaceLine(file, x=>x===heading, (x,nl)=>x+nl+line);
}

function personText(id, prefix, text) {
  const p = record.get(id);
  replaceLine(f(p.filename), x=>x.startsWith(prefix), text);
}

function school(id, stage, text, sources) {
  const p = record.get(id);
  const prefix = '| '+wiki(p.filename,p.name);
  replaceLine(p.unit+'逐人复核记录.md', x=>x.startsWith(prefix), (row)=>{
    const cut = row.indexOf(']]')+2;
    const cells = row.slice(cut,-2).split(' | ');
    if (cells.length!==5 || !row.endsWith(' |')) throw Error('unexpected table row '+id);
    if (stage !== null) cells[stage==='phd'?2:3] = text;
    const links = refs(sources);
    if (!cells[4].includes(links)) cells[4] += ' · '+links;
    return row.slice(0,cut)+cells.join(' | ')+' |';
  });
}

function audited(id, changes, next) {
  const auditId = 'pi_archive_'+batch+'_'+id;
  const a = JSON.parse(previous.get(id).details_json);
  if (a.audit_id !== auditId) {
    a.audit_id = auditId;
    a.next_step = next;
    a.followup_required = true;
    for(const [key,status,note,sourceKeys] of changes) {
      a.aspects[key] = { ...a.aspects[key], status, note, sources:[...new Set([...sourceKeys.map(k=>u[k]),...a.aspects[key].sources])] };
    }
  }
  audits.set(id,a);
  return auditId;
}

function edge(id, stage, mentorFile, mentorName, kind, labels, note, sources, oldLabels) {
  const p = record.get(id);
  const from = wiki(p.filename,p.name), to = wiki(mentorFile,mentorName);
  const evidence = '。'+note+' '+refs(sources);
  const rows = [
    [f(p.filename),'## 师承','- ',labels[0],to,evidence],
    [f(mentorFile),'## 师承','- ',labels[1],from,evidence],
    [index,'# 师承关系与候选线索索引','- '+from+' → ',labels[0],to,evidence],
  ];
  for(const [i,[file,heading,prefix,label,target,why]] of rows.entries()){
    const line = prefix+label+'：'+target+why;
    if (oldLabels) {
      const old = oldLabels[i===1?1:0];
      replaceLine(file,x=>[label,old].some(l=>x.startsWith(prefix+l+'：'))&&x.includes(target.split('|')[0]),line);
    } else appendAt(file,heading,line);
  }
  const audit = audits.get(id);
  if(!audit) throw Error('missing audit '+id);
  relations.push({event_id:audit.audit_id+'_'+stage+'_'+relations.length,record_id:id,stage,mentor_filename:mentorFile,kind,
    source_audit_id:audit.audit_id,evidence:note,sources:sources.map(([,key])=>u[key])});
}
function observation(id,key,excerpt) { pages.push({record_id:id,url:u[key],raw:excerpt,excerpt}); }
function failure(id,key,error) { pages.push({record_id:id,url:u[key],error}); }

{
  const id = 'af35619b';
  const ps = [['巴黎大学学区原档第 31 页','award'],['Berkeley EECS 本人档','kanteEecs']];
  const ds = [['巴黎大学学区原档第 31 页','award'],['本人 Berkeley 组页','kante'],['Xiang Zhang 组名录','zhangLab']];
  const phd = '巴黎大学学区 2010 年颁奖原档印刷页 31（PDF 第 32 页）左栏列 Boubacar Kanté、Université Paris 11 与超材料博士论文，左栏底部明确列 André de Lustrac 为 Directeur de thèse。已目视核对分栏。';
  const post = '同页左栏列 Kanté 在 Berkeley 的 Xiang Zhang 团队做博士后。本人组页核任期 2010–2013，Zhang 组校友档在 Postdoctoral Scholars 中列 Kanté 与 Berkeley 去向。确认课题组负责人，个人正式指导称谓待查。';
  audited(id,[['phd','confirmed_advisor',phd,['award','kanteEecs']],['postdoc','group_or_candidate',post,['award','kante','zhangLab']]],
    '博士导师已核。继续查 2010–2013 Berkeley 博后正式指导称谓及 Paris 11 学位馆藏的授位日期。');
  edge(id,'phd','师承人物 - André de Lustrac','André de Lustrac','advisor',['博士导师','博士生'],phd,ps,['博士候选导师','博士候选关联']);
  edge(id,'postdoc',zhang,'Xiang Zhang（原 Berkeley 光子学）','group_leader',['博士后课题组负责人','博士后课题组成员'],post,ds,['博士后所在课题组','博士后研究者']);
  personText(id,'- 核查边界：','- 核查边界：博士论文导师已据原档版面核实。Berkeley 2010–2013 年博后已核 Xiang Zhang 组属，正式个人导师称谓待查。');
  replaceLine(f(record.get(id).filename),x=>x==='## 博士阶段候选线索'||x==='## 博士阶段线索核实','## 博士阶段线索核实');
  replaceLine(f(record.get(id).filename),x=>x.startsWith('- 待核 [[师承人物 - André de Lustrac')||x.startsWith('- 已核实原候选 [[师承人物 - André de Lustrac'),
    '- 已核实原候选 [[师承人物 - André de Lustrac|André de Lustrac]]。见本页师承及 [巴黎大学学区颁奖原档第 31 页]('+u.award+'#page=32)。');
  replaceLine('师承候选线索索引.md',x=>x.includes(id)&&x.includes('André de Lustrac'),
    '- '+wiki(record.get(id).filename,'Boubacar Kanté')+' → 已核实原候选 '+wiki('师承人物 - André de Lustrac','André de Lustrac')+'。见 [博士论文奖原档第 31 页]('+u.award+'#page=32)。');
  school(id,'phd','André de Lustrac（正式论文导师）',ps);
  school(id,'postdoc','Xiang Zhang（Berkeley 2010–2013 课题组负责人）',ds);
  observation(id,'award',phd+' '+post);
  observation(id,'kante','Berkeley 本人组页列 Paris-Sud 物理博士、2010–2013 Berkeley 博后和 2019 回 Berkeley EECS 教职。');
  observation(id,'zhangLab','Zhang 组原表在 Postdoctoral Scholars 列 Boubacar Kante，年份 2013，去向 UC Berkeley。');
  observation(id,'kanteEecs','Berkeley EECS 本人页列讲席教授及波与物质相互作用、纳米光子、超材料和量子光学。');
}
{
  const id = '832f62d9';
  const sources = [['IPCMS 馆藏原表第 6 页','ipcms'],['Georgia Tech 物理系','berger']];
  const phd = 'IPCMS 图书馆原表第 6 页中，Claire Berger、1987 年 Grenoble、AlMn 准晶电子性质论文与 F. Cyrot-Lackmann 明确同处一行，后者位于 Directeur de thèse 列。已直接目视核对原表。Georgia Tech 系档的学位和论文方向一致。';
  const post = 'Georgia Tech 物理系履历明确列 CEA 博后，从事非晶薄膜制备与研究，随后任职于 CNRS LEPES。CEA 博后任期、课题组和具名指导仍待查。';
  audited(id,[['phd','confirmed_advisor',phd,['ipcms','berger']],['postdoc','unresolved',post,['berger']]],
    '追查 CEA 的非晶薄膜项目任用原档，核任期、具名指导与组属。');
  edge(id,'phd','师承人物 - Françoise Cyrot-Lackmann','Françoise Cyrot-Lackmann','advisor',['博士导师','博士生'],phd,sources,
    ['博士导师候选','博士生候选']);
  personText(id,'- 核查边界：','- 核查边界：'+post+' '+refs([['Georgia Tech 物理系','berger']]));
  replaceLine(f(record.get(id).filename),x=>x.startsWith('- GT 页面确认博士及 CEA 博后阶段；')||x.startsWith('- 2026-11-11 已核复 IPCMS'),
    '- 2026-11-11 已核复 IPCMS 馆藏原表的新网址，核实 Claire Berger 的博士导师；旧网址的 HTTP 404 已存入回执。');
  school(id,'phd','Françoise Cyrot-Lackmann（正式论文导师）',sources);
  observation(id,'ipcms',phd);
  observation(id,'berger','Georgia Tech 原档列物理实践教授、CNRS Néel 研究主任、外延石墨烯研究、Grenoble AlMn 准晶博士与 CEA 非晶薄膜博后。');
  failure(id,'ipcmsOld','HTTP 404，IPCMS 图书馆旧公开网址。已在其新公开地址下载并核原表第 6 页。');
}
{
  const id = '780dc26d';
  const sources = [['Washington ECE 当期履历','feng'],['Xiang Zhang 组名录','zhangLab'],['Penn 本人档','fengPenn']];
  const post = 'Washington ECE 2019 年讲座履历明列 Caltech EE 和 UC Berkeley NSF NSEC 两段博士后。Xiang Zhang 组校友档列 Liang Feng 为 Postdoc，年份 2014，去向 Penn，与本人身份、纳米光子方向及任用履历相符。保留 Caltech 的 Axel Scherer 研究师长；Berkeley 的 Xiang Zhang 记课题组负责人。';
  audited(id,[['postdoc','group_or_candidate',post,['feng','zhangLab','fengPenn','fengCaltech']]],
    '继续查 Caltech 和 Berkeley 两段博士后的起止日期及正式个人导师称谓。');
  edge(id,'postdoc',zhang,'Xiang Zhang（原 Berkeley 光子学）','group_leader',['博士后课题组负责人','博士后课题组成员'],post,sources);
  personText(id,'- 核查边界：','- 核查边界：UCSD 博士共同指导沿用原记录；Caltech 及 UC Berkeley 两段博士后分别记载。具名正式导师和分段任期待查。');
  school(id,'postdoc','Caltech Axel Scherer（阶段研究师长）；UC Berkeley Xiang Zhang（课题组负责人）',sources);
  observation(id,'feng',post);
  observation(id,'zhangLab','Zhang 组校友原表 Postdoctoral Scholars 列 Liang Feng，年份 2014、Penn 去向。');
  observation(id,'fengPenn','Penn 本人档确认 Liang Feng 教师任职和 Feng Lab。');
}
{
  const id = '613eb6f7';
  const phd = '本人 Grenoble 学位论文封面写明 Jean-Pascal Brison 指导、Dai Aoki 与 Jacques Flouquet 共同指导，并列 2011 年 9 月 28 日答辩、CEA Grenoble 和 École doctorale de Physique de Grenoble。';
  const post = '学位论文致谢具名 Paul Canfield 接收本人为博士后。Canfield 本人组档分别列 Taufour 为前博后和前研究人员，UC Davis 本人档列 2011–2013 Iowa State 博后、2013–2016 Ames Scientist，保留阶段研究师长。正式个人导师称谓仍待任用原档。';
  const ps = [['Grenoble 本人博士论文','taufourThesis']];
  const ds = [['本人博士论文致谢','taufourThesis'],['Canfield 组档','canfield'],['UC Davis 物理系','taufour']];
  audited(id,[['phd','confirmed_advisor',phd,['taufourThesis']],['postdoc','group_or_candidate',post,['taufourThesis','canfield','taufour']]],
    '追查 Iowa State 2011–2013 博后任用中的具名导师称谓。Ames 2013–2016 Scientist 分段保存。');
  for(const [i,name] of ['Jean-Pascal Brison','Dai Aoki','Jacques Flouquet'].entries()){
    edge(id,'phd','师承人物 - '+name,name,'advisor',[i===0?'博士导师':'博士共同导师','博士生'],phd,ps,['博士导师','博士生']);
  }
  edge(id,'postdoc','师承人物 - Paul C. Canfield','Paul C. Canfield','stage_mentor',['博士后阶段研究师长','博士后阶段研究人员'],post,ds,
    ['博士后阶段研究师长','博士后阶段研究人员']);
  personText(id,'- 核查边界：','- 核查边界：'+post+' '+refs(ds));
  school(id,'phd','Jean-Pascal Brison（论文导师）、Dai Aoki 与 Jacques Flouquet（共同导师）',ps);
  school(id,'postdoc','Paul C. Canfield（Iowa State 2011–2013 阶段研究师长）；2013–2016 Ames Scientist',ds);
  observation(id,'taufourThesis',phd+' '+post);
  observation(id,'canfield','Canfield 本人前成员名录将 Valentin Taufour 分别列在 Post-Docs 和 Visiting and Staff Researchers。');
  observation(id,'taufour','UC Davis 物理系任职、CEA 博士、Iowa State 博士后及 Ames Scientist 阶段。');
  failure(id,'taufourCea','HTTP 502 Bad Gateway，未取得答辩档正文，正式博士指导以已读学位原卷为证。');
}
{
  const id = 'aa02b210';
  const sources = [['Zhang 组名录','zhangLab'],['NUS IFIM 履历','kedar']];
  const note = 'Zhang 组校友原档在 Postdoctoral Scholars 大节中将 Kedar Hippalgaonkar 的 Former 具体列为 Research Associate，年份 2013。NUS 交叉任用履历列 Berkeley 博士 2014，与 2013 年论文封面有日期差异。阶段和任用起止待核，保留具名组属线索。';
  audited(id,[['postdoc','unresolved',note,['zhangLab','kedar']]],
    '查 Berkeley Research Associate 的任期及职类，另核 Berkeley 博士签署与授予时间。');
  appendAt(f(record.get(id).filename),'## 师承','- Berkeley 研究任用线索。'+note+' '+refs(sources));
  school(id,'postdoc','博后待核；Zhang 组档列 Research Associate（2013），任用阶段待查',sources);
  observation(id,'zhangLab',note);
  observation(id,'kedar','NUS IFIM 个人履历列 NTU 材料副教授、A*STAR IMRE 联合任用，Berkeley 机械工程博士 2014。');
}
failure('dc2a553b','sauret','HTTP 400 Timeout fetching，目录未取得正文。保留 Le Dizès 本人名单对共同研究指导的既有结论。');
failure('1720e13b','brun','工具无法读取 HAL 学位入口，现有本人 CV 和 EPFL 论文书目照录。');

console.log(JSON.stringify({ files:files.size, audits:audits.size, relations:relations.length, pages:pages.length }));
db.close();
if (process.argv[2] === 'apply') {
  function persist(suffix,data) {
    const file = batch+'_'+suffix+'.json';
    fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n','utf8');
    return file;
  }
  function run(script,...args) {
    execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});
  }
  for(const [id,a] of audits) run('人工核查台账.cjs','record',persist('人工_'+id,a));
  for(const [file,contents] of files) fs.writeFileSync(path.join(root,file),contents,'utf8');
  run('结构化师承关系.cjs','record',persist('法国学位及组档关系',relations));
  run('检索流程.cjs','ingest-reviewed-pages',persist('法国学位及组档回执',pages));
}
