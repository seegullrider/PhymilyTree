// 从已保存的检索响应中识别指定高校学位目录的作者字段，用于交叉排队读原文。
// 搜索结果不是核实来源；即便名称与字段匹配，也不得自动确认身份、学位或导师。
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'));
db.exec(`PRAGMA busy_timeout=10000; CREATE TABLE IF NOT EXISTS page_priorities(page_id TEXT PRIMARY KEY,priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 9),reason TEXT NOT NULL,updated TEXT NOT NULL,FOREIGN KEY(page_id) REFERENCES pages(id));`);
// 只把人工发现的身份冲突附在线索上，不能因冲突或搜索片段断言同人／不同人。
const holdsFile=process.env.PI_THESIS_HOLDS_FILE||path.join(__dirname,'博士候选身份冲突.json');
if(!fs.existsSync(holdsFile))throw Error('缺少身份冲突清单，拒绝在无保护状态下筛查');
const holds=JSON.parse(fs.readFileSync(holdsFile,'utf8'));
if(!Array.isArray(holds)||holds.some(x=>!x||typeof x.record_id!=='string'||!/^https:\/\//.test(x.url||'')||typeof x.reason!=='string'||x.reason.length<12))throw Error('身份冲突清单格式不合法');
const holdMap=new Map();for(const h of holds){const k=h.record_id+'\n'+h.url;if(holdMap.has(k))throw Error('身份冲突清单存在重复项');holdMap.set(k,h)}
const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,' ').trim().split(/\s+/).filter(Boolean);
function authorNames(block,url){
 const labeled=block.match(/^(?:#{1,4}[ \t]+)?(?:Author(?:s|\(s\)|[ \t]+Info|[ \t]+\/[ \t]+Creator)?|Creator)[ \t]*(?::[ \t]*\|?[ \t]*|[ \t]*\r?\n(?:[ \t]*\r?\n)*)([^\r\n]+)/im);
 // eScholarship 的学位条目常将作者和 Advisor(s) 连续列成两项，没有 Author 标题。
 const ucDegreeAuthor=url.startsWith('https://escholarship.org/uc/item/')
  ? block.match(/^[ \t]*\*[ \t]+([^\r\n]+)\r?\n[ \t]*\*[ \t]+Advisor\(s\):[ \t]+[^\r\n]+/mi)
  : null;
 const cover=url.startsWith('https://asset.library.wisc.edu/1711.dl/')&&
  /\bDoctor of Philosophy\b/i.test(block.slice(0,1800))&&
  block.slice(0,1400).match(/^By[ \t]*\r?\n[ \t]*([\p{L}\p{M} .'-]+)[ \t]*$/imu);
 const ucfByline=url.startsWith('https://stars.library.ucf.edu/')
  ? block.match(/^\s*["“][^\r\n]+["”] by ([\p{L}\p{M} .'-]+) \(/iu)
  : null;
 const match=ucfByline||cover||labeled||ucDegreeAuthor;
 if(!match)return null;
 if(match===cover||match===ucfByline){
  const names=normalize(match[1]);return names.length>=2?{first:names[0],last:names.at(-1)}:null;
 }
 const parts=match[1].split(',');if(parts.length<2)return null;const last=normalize(parts[0]),first=normalize(parts[1]);
 return last.length===1&&first[0]?.length>=3?{first:first[0],last:last[0]}:null;
}
function catalogUrl(block){
 const match=block.trimStart().match(/^[^\r\n]{0,500}?\((https:\/\/[^)\s]+)\)/i);
 if(!match)return null;
 let url;try{url=new URL(match[1])}catch{return null}
 if(url.username||url.password||url.port||url.hash)return null;
 const stable=[
  /^dspace\.mit\.edu\/entities\/publication\/[0-9a-f-]{36}$/i,
  /^www\.ideals\.illinois\.edu\/items\/\d+$/,
  /^ecommons\.cornell\.edu\/entities\/publication\/[0-9a-f-]{36}$/i,
  /^thesis\.caltech\.edu\/\d+\/?$/,
  /^dataspace\.princeton\.edu\/handle\/88435\/dsp01[a-z0-9]+$/i,
  /^(?:www\.)?research-collection\.ethz\.ch\/entities\/publication\/[0-9a-f-]{36}$/i,
  /^(?:drum\.lib\.umd\.edu\/items|trace\.tennessee\.edu\/entities\/publication)\/[0-9a-f-]{36}$/i,
  /^stars\.library\.ucf\.edu\/(?:etd(?:20\d{2})?|gradstudies_etd_20\d{2})\/\d+\/?$/,
  /^asset\.library\.wisc\.edu\/1711\.dl\/[a-z0-9]+\/R\/file-[a-z0-9]+\.pdf$/i,
  /^searchworks\.stanford\.edu\/view\/[a-z0-9]+$/i,
 ];
 const key=url.hostname+url.pathname;
 if(!url.search&&stable.some(pattern=>pattern.test(key)))return match[1];
 const ohio=/^rave\.ohiolink\.edu\/etdc\/view$/.test(key)||
  /^etd\.ohiolink\.edu\/acprod\/odb_etd\/(?:etd\/)?r\/(?:etd\/search\/|\d+\/)10$/.test(key);
 if(ohio&&[...url.searchParams.keys()].every(k=>['acc_num','p10_accession_num','clear','session'].includes(k))){
  const accession=[...url.searchParams.getAll('acc_num'),...url.searchParams.getAll('p10_accession_num')];
  if(accession.length===1&&/^[a-z]{2,12}\d{8,20}$/i.test(accession[0]))return 'https://rave.ohiolink.edu/etdc/view?acc_num='+accession[0].toLowerCase();
 }
 // 只接受 eScholarship 单篇稳定标识；PDF 路径的两个标识必须相同，不跟随签名链接。
 if(url.hostname!=='escholarship.org'||(url.search&&!/^\?t=[a-z0-9]+$/i.test(url.search)))return null;
 const uc=url.pathname.match(/^\/(?:uc\/item\/([a-z0-9]{8})|content\/qt([a-z0-9]{8})\/qt([a-z0-9]{8})(?:_noSplash_[a-f0-9]+)?\.pdf)$/i);
 if(!uc||(!uc[1]&&uc[2].toLowerCase()!==uc[3].toLowerCase()))return null;
 return 'https://escholarship.org/uc/item/'+(uc[1]||uc[2]).toLowerCase();
}
function degreeField(block,url){
 const labeled=block.match(/^(?:#{1,4}[ \t]+)?(?:Year and Degree|Degree(?: Name)?|Document Type|Type)[ \t]*(?::[ \t]*\|?[ \t]*|\r?\n(?:[ \t]*\r?\n)*)([^\r\n]{1,140})/im);
 if(labeled)return labeled[1].trim();
 if(url.startsWith('https://asset.library.wisc.edu/1711.dl/')&&/\bDoctor of Philosophy\b/i.test(block.slice(0,1800)))return 'Doctor of Philosophy';
 return block.match(/\bThesis\s*(?:\([^\n)]{1,60}\)|:\s*[^\n]{1,100})/i)?.[0]||'未在检索结果中识别';
}
function extract(){
 const people=db.prepare('SELECT id,name,unit,filename FROM records').all(),byName=new Map();
 for(const person of people){
  const names=normalize(person.name.replace(/\s*[—–（(].*$/,''));
  if(names.length<2)continue;
  const key=names[0]+'\n'+names.at(-1),matches=byName.get(key)||[];
  matches.push(person);byName.set(key,matches);
 }
 const rows=db.prepare("SELECT record_id,raw FROM thesis_search_jobs WHERE state='done' AND raw IS NOT NULL").all();
 if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='thesis_query_history'").get()){
  rows.push(...db.prepare("SELECT record_id,json_extract(snapshot_json,'$.raw') raw FROM thesis_query_history WHERE json_type(snapshot_json,'$.raw')='text'").all());
 }
 const existing=db.prepare('SELECT state FROM pages WHERE record_id=? AND url=?');const hits=new Map();
 for(const row of rows)for(const block of row.raw.split(/-{8,}/)){
  // 仅单篇高校馆藏，排除搜索结果列表、代理、临时签名和其他动态 URL。
  const url=catalogUrl(block);if(!url)continue;
  const name=authorNames(block,url);if(!name)continue;
  const degree=degreeField(block,url);
  const level=/\b(?:ph\.?\s*d\.?|sc\.?\s*d\.?|doctor(?:al|ate|\s+of\s+philosophy))\b/i.test(degree)?'博士线索':/\b(?:s\.?\s*m\.?|m\.?\s*s\.?|m\.?\s*f\.?\s*a\.?|m\.?\s*a\.?|m\.?\s*eng\.?|master(?:s|\x27s)?|elec\.?)\b/i.test(degree)?'非博士学位线索':'未明';
  for(const person of byName.get(name.first+'\n'+name.last)||[]){const key=person.id+'\n'+url;if(hits.has(key))continue;
   const existingPage=existing.get(person.id,url);
   hits.set(key,{record_id:person.id,name:person.name,unit:person.unit,filename:person.filename,url,source_record_id:row.record_id,source_scope:person.id===row.record_id?'本人检索式':'交叉检索式',degree_hint:degree,level_hint:level,identity_conflict:holdMap.get(key)||null,already_queued:!!existingPage,page_state:existingPage?.state??null});}
 }
 return {generated:new Date().toISOString(),records:people.length,search_responses:rows.length,warning:'姓名及搜索结果作者字段仅是线索；须读取原始学位页面，核对身份、时间、学位和导师；不得直接建立师承。',candidates:[...hits.values()].sort((a,b)=>a.unit.localeCompare(b.unit)||a.name.localeCompare(b.name))};
}
function enqueue(approval){
 if(!Array.isArray(approval)||!approval.length||approval.length>100)throw Error('需提供 1–100 条人工选取的线索');
 const current=extract(),seen=new Set(),job=db.prepare("SELECT id FROM jobs WHERE record_id=? AND kind='training'"),put=db.prepare('INSERT OR IGNORE INTO pages(id,record_id,job_id,url) VALUES(?,?,?,?)'),prioritize=db.prepare("INSERT OR IGNORE INTO page_priorities(page_id,priority,reason,updated) SELECT id,1,'人工筛选本人学位目录线索；原文待读',? FROM pages WHERE record_id=? AND url=? AND state IN ('pending','retry')");let added=0,prioritized=0;
 db.exec('BEGIN IMMEDIATE');try{for(const a of approval){if(!a||typeof a.record_id!=='string'||typeof a.url!=='string')throw Error('缺少人物或链接');const key=a.record_id+'\n'+a.url;if(seen.has(key))throw Error('重复申请');seen.add(key);
  const candidate=current.candidates.find(c=>c.record_id===a.record_id&&c.url===a.url);if(!candidate)throw Error('线索已不在当前已存响应中 '+a.record_id);
  if(candidate.level_hint==='非博士学位线索')throw Error('该页面标注的学位并非博士，不能进入博士论文优先队列 '+a.record_id);
  if(candidate.page_state==='excluded')throw Error('该页面已被排除，须先复核已有原因 '+a.record_id);
  if(candidate.identity_conflict&&a.identity_conflict_acknowledged!==true)throw Error('存在身份冲突；如需打开原始页面专门核实，请在人工筛选记录中明确标记 identity_conflict_acknowledged '+a.record_id);
  const j=job.get(a.record_id);if(!j)throw Error('无本人训练阶段任务 '+a.record_id);const id=crypto.createHash('sha256').update(key).digest('hex').slice(0,24);added+=Number(put.run(id,a.record_id,j.id,a.url).changes);prioritized+=Number(prioritize.run(new Date().toISOString(),a.record_id,a.url).changes);
 }db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return {selected:approval.length,added,prioritized,note:'只调整待读原文顺序，身份和关系未确认；使用已有全局与主机退避'};
}
try{const [cmd,file]=process.argv.slice(2);if(cmd==='scan'){const out=extract();fs.writeFileSync(process.env.PI_THESIS_CANDIDATES_OUT||path.join(__dirname,'已存检索结果交叉论文候选.json'),JSON.stringify(out,null,2)+'\n','utf8');console.log(JSON.stringify({records:out.records,search_responses:out.search_responses,candidates:out.candidates.length,items:out.candidates}));}else if(cmd==='enqueue')console.log(JSON.stringify(enqueue(JSON.parse(fs.readFileSync(file,'utf8')))));else throw Error('命令：scan | enqueue 经人工选取的 JSON');}catch(e){console.error(String(e));process.exitCode=1}finally{db.close()}
