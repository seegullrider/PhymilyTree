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
 original.audit_id='pi_archive_20261110_1901_'+id;
 original.followup_required=true;
 original.next_step=next;
 for(const [key,note,sources] of changes){
  const aspect=original.aspects[key];
  original.aspects[key]={...aspect,note,sources:[...new Set([...sources,...aspect.sources])]};
 }
 audits.push(original);
 return original.audit_id;
}
const b='246b84a2', l='83cf6ed6', s='24363548';
const berkeley='https://www2.eecs.berkeley.edu/Pubs/TechRpts/1999/3739.html';
const iee='https://iee.ucsb.edu/people/faculty/kaustav-banerjee';
const delhi='https://aud.delhi.gov.in/kaustav-banerjee';
const columbia='https://www.apam.columbia.edu/about/news/columbia-engineering-welcomes-new-faculty';
const w='https://columbia.edu/~miw2103/studentsetc.html';
const mrs='https://www.cambridge.org/core/journals/mrs-bulletin/article/meet-our-authors/1DE54A079C8FE51BC6FCEA88A969FDF2';
const cas='https://casimir.researchschool.nl/m/archive-1257.html';
const bphd='Berkeley EECS 1999 原始博士论文条目列 Kaustav Banerjee，题名 Thermal Effects in Deep Sub-Micron VLSI Interconnects and Implications for Reliability and Performance，导师字段为 Chenming Hu。';
const idCheck='Delhi 的 Dr. B. R. Ambedkar University 院系原档另列同名者为全球事务学院经济学者、2008 年 Jawaharlal Nehru University 经济学博士。UCSB 的本记录为 1999 年 UC Berkeley EECS 博士、纳米电子研究者。';
const bpost='UCSB IEE 原档列 1999–2001 Stanford Center for Integrated Systems 的 Research Associate，并列 EE 与 ME Thermosciences 两处；博后任用和个人指导者待独立证据。';
const bAudit=audit(b,[['identity',idCheck,[iee,berkeley,delhi]],['phd',bphd,[berkeley]],['postdoc',bpost,[iee]]],'追 Stanford 同期任用原档与个人指导资料。Berkeley 正式导师字段已核，论文 PDF 正文未取到。');
const addB=' '+bphd+' '+source('Berkeley 单篇论文原档',berkeley);
personLine(b,'- 博士导师：',addB);
personLine(b,'- 核查边界：',' '+idCheck+' '+source('Delhi 原档',delhi)+' '+source('UCSB IEE 任用档',iee));
line(path.join(notes,'师承人物 - Chenming Hu.md'),x=>x.startsWith('- 博士生：')&&x.includes(records.get(b).filename),addB);
line(index,x=>x.startsWith('- [['+records.get(b).filename+'|')&&x.includes(' → 博士导师：'),addB);
schoolSource(b,' · '+source('Berkeley 论文原档',berkeley)+' · '+source('UCSB IEE',iee));
relations.push({event_id:'pi_archive_20261110_1901_'+b+'_phd',record_id:b,stage:'phd',mentor_filename:'师承人物 - Chenming Hu',kind:'advisor',source_audit_id:bAudit,evidence:bphd,sources:[berkeley,'https://www2.eecs.berkeley.edu/Pubs/Dissertations/Years/1999.html']});

const lp='Columbia 招聘原档明列 2025 年 7 月起任应用物理与应用数学系 Chu Assistant Professor，同年 UW 数学博士。Weinstein 本人页将其列为当年秋季起的助理教授，公开履历尚未见独立博士后聘任。';
audit(l,[['affiliation',lp,[columbia]],['research','Columbia 招聘原档列凝聚态和量子材料相关的偏微分方程、Floquet–Bloch 理论、谱与表示理论。',[columbia]],['postdoc',lp,[columbia,w]]],'UW 博士导师已由答辩公告确认；继续追独立博士后任用以及可访问的论文全文。');
personLine(l,'- 核查边界：',' '+lp+' '+source('Columbia 当期招聘',columbia));
schoolSource(l,' · '+source('Columbia 当期招聘',columbia));

const sp='MRS Bulletin 同期作者履历列 Delft 博后约一年后赴 Princeton 任 Marie Curie Fellow。与两所课题组归属证据相符，个人正式博后导师待核。';
const sd='Casimir 档案列 2010 年 12 月 20 日答辩题目 Control of Single Electron Spins in Semiconductor Nanowires。既有 Delft 资料列 Single Spins in Semiconductor Nanowires，两种题名先分列。原答辩详情及具名指导字段此次未取得。';
audit(s,[['phd',sd,[cas]],['postdoc',sp,[mrs]]],'继续找 Delft 学位签署或可读具名答辩详情，并核 Princeton fellowship 指导者与起止。');
personLine(s,'- 核查边界：',' '+sd+' '+source('Casimir 答辩公告列表',cas)+' '+sp+' '+source('MRS 原刊作者档',mrs));
schoolSource(s,' · '+source('同期博后履历',mrs)+' · '+source('答辩公告列表',cas));

const p=db.prepare('SELECT id FROM pages WHERE record_id=? AND url=?').get(b,delhi);
if(!p)throw Error('同名原页未入队列');
const exclusion=[{page_id:p.id,url:delhi,record_id:b,audit_id:bAudit,external_subject:'Delhi 全球事务学院经济学者 Kaustav Banerjee',evidence:idCheck}];
db.close();
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,exclusions:exclusion.length}));
 process.exit(0);
}
function persist(file,data) {
 fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');
}
function call(script,file) { execFileSync(process.execPath,['--no-warnings',script,...(script==='人物网页身份纠偏.cjs' ? [] : ['record']),file],{stdio:'inherit'}); }
for(const event of audits) {
 const file='20261110_1901_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates) fs.writeFileSync(file,contents,'utf8');
persist('20261110_1901_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_1901_结构化回执.json');
persist('20261110_1901_同名排除.json',exclusion);
call('人物网页身份纠偏.cjs','20261110_1901_同名排除.json');
