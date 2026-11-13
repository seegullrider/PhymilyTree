// 人工确认的阶段关系事件；旧事件缺少类型时保持未分类，不自动推断。
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { resolveMentor } = require('./解析师承节点.cjs');
const graph = process.env.PI_GRAPH_ROOT || path.resolve(__dirname, '..');
const db = new DatabaseSync(process.env.PI_AUTOMATION_DB || path.join(__dirname, '检索队列.sqlite'));
db.exec(`PRAGMA busy_timeout=10000;
CREATE TABLE IF NOT EXISTS typed_relation_events (
 event_id TEXT PRIMARY KEY, record_id TEXT NOT NULL, stage TEXT NOT NULL,
 mentor_filename TEXT NOT NULL, kind TEXT NOT NULL, source_audit_id TEXT NOT NULL,
 evidence TEXT NOT NULL, sources_json TEXT NOT NULL, recorded_at TEXT NOT NULL,
 FOREIGN KEY(record_id) REFERENCES records(id),
 FOREIGN KEY(source_audit_id) REFERENCES manual_audit_events(audit_id)
);
CREATE INDEX IF NOT EXISTS idx_typed_relation_key
 ON typed_relation_events(record_id,stage,mentor_filename,recorded_at);`);
const kinds = new Set(['advisor','stage_mentor','group_leader','candidate','retracted']);
const names = {advisor:'明确导师',stage_mentor:'阶段研究师长',group_leader:'课题组负责人',candidate:'候选关系',retracted:'撤回'};
function validate(x) {
 if (!x || !/^[A-Za-z0-9_-]{8,100}$/.test(x.event_id || '')) throw Error('event_id 不合法');
 if (!['phd','postdoc'].includes(x.stage) || !kinds.has(x.kind)) throw Error('阶段或关系类型不合法');
 const person=db.prepare('SELECT id,name,unit,filename FROM records WHERE id=?').get(x.record_id);
 if (!person) throw Error('未知校属记录');
 const audit=db.prepare('SELECT record_id FROM manual_audit_events WHERE audit_id=?').get(x.source_audit_id);
 if (!audit || audit.record_id!==x.record_id) throw Error('须关联同一校属记录的人工核查事件');
 if (typeof x.mentor_filename!=='string' || /[\\/]/.test(x.mentor_filename) || !['人物','师承人物'].some(dir=>fs.existsSync(path.join(graph,dir,x.mentor_filename+'.md')))) throw Error('师长人物页不存在或名称不合法');
 if (x.mentor_filename===person.filename) throw Error('师承关系不能指向本人');
 if (typeof x.evidence!=='string' || x.evidence.trim().length<12) throw Error('须写明简短证据');
 if (!Array.isArray(x.sources) || !x.sources.length || x.sources.some(s=>typeof s!=='string'||!/^https?:\/\//i.test(s))) throw Error('须附原始来源 URL');
 return person;
}
function record(items) {
 if (!Array.isArray(items) || !items.length || items.length>100) throw Error('输入须为 1–100 项数组');
 db.exec('BEGIN IMMEDIATE'); let inserted=0, reused=0;
 try {
  for (const x of items) {
   validate(x);
   const old=db.prepare('SELECT * FROM typed_relation_events WHERE event_id=?').get(x.event_id);
   if (old) {
    if (old.record_id!==x.record_id || old.stage!==x.stage || old.mentor_filename!==x.mentor_filename || old.kind!==x.kind || old.source_audit_id!==x.source_audit_id || old.evidence!==x.evidence || old.sources_json!==JSON.stringify(x.sources)) throw Error('event_id 已存在且内容不同');
    reused++; continue;
   }
   if (x.only_if_new === true) {
    const latestAudit = db.prepare('SELECT audit_id FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(x.record_id);
    const prior = db.prepare('SELECT 1 FROM typed_relation_events WHERE record_id=? AND stage=? AND mentor_filename=?').get(x.record_id,x.stage,x.mentor_filename);
    if (latestAudit?.audit_id !== x.source_audit_id || prior) throw Error('补录候选已过期，须重新核对 '+x.record_id);
   }
   db.prepare('INSERT INTO typed_relation_events VALUES (?,?,?,?,?,?,?,?,?)').run(x.event_id,x.record_id,x.stage,x.mentor_filename,x.kind,x.source_audit_id,x.evidence,JSON.stringify(x.sources),new Date().toISOString()); inserted++;
  }
  db.exec('COMMIT'); return {inserted,reused};
 } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function latest() {
 return db.prepare(`SELECT t.*,r.name,r.unit,r.filename FROM typed_relation_events t JOIN records r ON r.id=t.record_id
 WHERE t.rowid=(SELECT x.rowid FROM typed_relation_events x WHERE x.record_id=t.record_id AND x.stage=t.stage AND x.mentor_filename=t.mentor_filename ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 AND t.kind<>'retracted' ORDER BY r.unit,r.name,t.stage,t.mentor_filename`).all();
}
function status() {
 const rows=latest(),total=db.prepare('SELECT count(*) n FROM records').get().n,stages={};
 for(const stage of ['phd','postdoc']) {
  const rel=rows.filter(x=>x.stage===stage), ids=new Set(rel.map(x=>x.record_id));
  stages[stage]={records_with_typed_relations:ids.size,records_without_typed_relations:total-ids.size,
   records_with_advisor:new Set(rel.filter(x=>x.kind==='advisor').map(x=>x.record_id)).size,
   records_with_stage_mentor:new Set(rel.filter(x=>x.kind==='stage_mentor').map(x=>x.record_id)).size,
   records_with_group_leader:new Set(rel.filter(x=>x.kind==='group_leader').map(x=>x.record_id)).size,
   records_with_candidate:new Set(rel.filter(x=>x.kind==='candidate').map(x=>x.record_id)).size};
 }
 return {total,typed_relations:rows.length,stages,note:'仅统计已手工录入的结构化关系；各类型可能交叉，未结构化不等于未查或没有导师，数字不是全库导师覆盖率。'};
}
function next(stage,limit) {
 if (!['phd','postdoc'].includes(stage)) throw Error('阶段须为 phd 或 postdoc');
 const done=new Set(latest().filter(x=>x.stage===stage).map(x=>x.record_id));
 const people=db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.details_json FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1) ORDER BY r.unit,r.name`).all();
 return people.filter(x=>!done.has(x.id)).map(({details_json,...r})=>({...r,aspect:JSON.parse(details_json).aspects[stage]})).filter(x=>x.aspect.status==='confirmed_advisor').slice(0,limit);
}
function suggest(stage, limit) {
 if (!['phd', 'postdoc'].includes(stage)) throw Error('阶段须为 phd 或 postdoc');
 const stageName = stage === 'phd' ? '博士' : '博士后';
 const labels = new Map([
  [`${stageName}导师`, 'advisor'], [`${stageName}共同导师`, 'advisor'],
  [`${stageName}课题组负责人`, 'group_leader'], [`${stageName}课题组`, 'group_leader'],
  [`${stageName}阶段研究师长`, 'stage_mentor'], [`${stageName}导师候选`, 'candidate'],
 ]);
 if (stage === 'phd') labels.set('博士论文导师', 'advisor');
 const people = db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.audit_id,a.details_json
  FROM records r JOIN manual_audit_events a ON a.rowid=(SELECT x.rowid FROM manual_audit_events x
   WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
  ORDER BY r.unit,r.name`).all();
 // Include retractions in this guard so a suggestion cannot restore a withdrawn relationship.
 const known = new Set(db.prepare('SELECT record_id,mentor_filename FROM typed_relation_events WHERE stage=?').all(stage)
  .map(row => `${row.record_id}|${row.mentor_filename}`));
 const result = [];
 for (const person of people) {
  const { aspects } = JSON.parse(person.details_json);
  const evidence = aspects[stage];
  if (aspects.identity?.status !== 'confirmed' || !evidence?.sources?.length || typeof evidence.note !== 'string' || evidence.note.trim().length < 12) continue;
  const notePath = path.join(graph, '人物', person.filename + '.md');
  if (!fs.existsSync(notePath)) continue;
  const note = fs.readFileSync(notePath, 'utf8');
  const block = note.match(/^## 师承[ \t]*\r?\n([\s\S]*?)(?=^## |^<!-- PI-AUTO-SEARCH:START|(?![\s\S]))/m)?.[1];
  if (!block) continue;
  const sharedSources = new Set(evidence.sources.map(url => url.split('#')[0]));
  for (const line of block.split(/\r?\n/)) {
   const relation = line.match(/^- ([^:：]+)[:：]\s*\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/);
   if (!relation) continue;
   if (/^\s*(?:和|及|与|、|，|,)\s*\[\[/.test(line.slice(relation[0].length))) continue;
   const kind = labels.get(relation[1]);
   if (!kind || evidence.status !== (kind === 'advisor' ? 'confirmed_advisor' : 'group_or_candidate')) continue;
   const mentor = path.posix.basename(relation[2].replaceAll('\\', '/')).replace(/\.md$/i, '');
   const key = `${person.id}|${mentor}`;
   if (mentor === person.filename || known.has(key)) continue;
   const sources = [...line.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(m => m[1])
    .filter(url => sharedSources.has(url.split('#')[0]));
   if (!sources.length) continue;
   const { file } = resolveMentor(graph, person.filename, mentor);
   if (!file) continue;
   const inverse = fs.readFileSync(file, 'utf8').split('<!-- PI-AUTO-SEARCH:START -->')[0].split(/\r?\n/)
    .find(text => (stage === 'phd' ? /博士(?!后)/ : /博士后/).test(text) &&
     (text.includes(`[[${person.filename}|`) || text.includes(`[[${person.filename}]]`)));
   if (!inverse) continue;
   const mentorKey = createHash('sha256').update(mentor).digest('hex').slice(0, 16);
   result.push({ unit: person.unit, name: person.name, line, inverse, audit_note: evidence.note,
    event: { event_id: `existing_${stage}_${person.id}_${mentorKey}`, record_id: person.id, stage,
    mentor_filename: mentor, kind, source_audit_id: person.audit_id, evidence: evidence.note, sources: [...new Set(sources)], only_if_new: true } });
   known.add(key);
   if (result.length >= limit) return result;
  }
 }
 return result;
}
function report() {
 const rows=latest(),st=status(),esc=s=>String(s).replace(/[\r\n|]+/g,'／');
 let out='# 结构化师承关系（人工确认）\n\n[[人工核查台账进度|返回人工核查台账]] · [[PI关系图总入口|图谱入口]]\n\n';
 out+=`生成时间：${new Date().toISOString()}。${st.note}\n\n`;
 const schools=db.prepare('SELECT unit,count(*) n FROM records GROUP BY unit ORDER BY unit').all();
 const count=(unit,stage,kind)=>new Set(rows.filter(x=>x.unit===unit&&x.stage===stage&&(!kind||x.kind===kind)).map(x=>x.record_id)).size;
 out+='## 逐校结构化进度\n\n同一记录可有多个关系类型；下表为已录入的校属记录数，不代表全部导师已查明。\n\n| 学校或机构 | 校属记录 | 博士已分类 | 博士含明确导师 | 博士后已分类 | 博士后含明确导师 |\n|---|---:|---:|---:|---:|---:|\n';
 for(const s of schools)out+=`| ${esc(s.unit)} | ${s.n} | ${count(s.unit,'phd')} | ${count(s.unit,'phd','advisor')} | ${count(s.unit,'postdoc')} | ${count(s.unit,'postdoc','advisor')} |\n`;
 out+='\n';
 for(const stage of ['phd','postdoc']) {
  const a=st.stages[stage];out+=`## ${stage==='phd'?'博士':'博士后'}\n\n已结构化 ${a.records_with_typed_relations} 条校属记录，未结构化 ${a.records_without_typed_relations} 条。明确导师 ${a.records_with_advisor}；阶段研究师长 ${a.records_with_stage_mentor}；课题组负责人 ${a.records_with_group_leader}；候选关系 ${a.records_with_candidate}。各类可交叉。\n\n`;
  for (const r of rows.filter(x => x.stage === stage)) {
   const mentor = resolveMentor(graph, r.filename, r.mentor_filename);
   const link = mentor.target === r.mentor_filename ? mentor.target : `${mentor.target}|${r.mentor_filename}`;
   out+=`- [[${r.filename}|${esc(r.name)}]] → ${names[r.kind]}：[[${link}]]；${esc(r.evidence)} ${JSON.parse(r.sources_json).map((u,i)=>`[来源${i+1}](${u})`).join(' ')}\n`;
  }
  out+='\n';
 }
 fs.writeFileSync(path.join(graph,'结构化师承关系（人工确认）.md'),out,'utf8');return st;
}
try {const [cmd,arg,n]=process.argv.slice(2);if(cmd==='record')console.log(JSON.stringify(record(JSON.parse(fs.readFileSync(arg,'utf8')))));else if(cmd==='status')console.log(JSON.stringify(status()));else if(cmd==='next')console.log(JSON.stringify(next(arg,Math.max(1,Math.min(50,Number(n)||10)))));else if(cmd==='suggest')console.log(JSON.stringify(suggest(arg,Math.max(1,Math.min(100,Number(n)||10)))));else if(cmd==='report')console.log(JSON.stringify(report()));else throw Error('命令：record JSON文件 | next phd|postdoc [数量] | suggest phd|postdoc [数量] | status | report');}
catch(e){console.error(String(e));process.exitCode=1;}finally{db.close();}
