// 仅筛查已保存的网页工具原文，输出人工复核线索；不判定师承、不改写数据库。
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const {createHash}=require('node:crypto');
const sync=process.argv.includes('--sync');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:!sync});
const rows=db.prepare(`SELECT r.id,r.name,r.unit,p.url,o.tool_output,a.details_json
 FROM records r JOIN pages p ON p.record_id=r.id AND p.state='done'
 JOIN page_observations o ON o.page_id=p.id
 LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 WHERE length(o.tool_output)<100000 AND (lower(o.tool_output) LIKE '%advisor%' OR lower(o.tool_output) LIKE '%supervisor%')
 ORDER BY r.id,p.id,o.retrieved,o.rowid`).iterate();
const hits=[],seen=new Set();
for(const r of rows){
 const a=JSON.parse(r.details_json||'{}').aspects||{};
 if(a.phd?.status==='confirmed_advisor'&&a.postdoc?.status==='confirmed_advisor')continue;
 const name=r.name.replace(/（[^）]*）|\([^)]*\)|\s*[—–].*$/g,'').trim().toLowerCase();
 if(name.length<5)continue;
 const lines=r.tool_output.split('\n');
 for(let i=0;i<lines.length;i++){
  if(!/\b(advis(?:or|er)|supervisor)\b/i.test(lines[i]))continue;
  const context=lines.slice(Math.max(0,i-3),Math.min(lines.length,i+4)).join(' ');
  if(context.toLowerCase().includes(name)){
   const key=[r.id,r.url,lines[i]].join('\n');if(seen.has(key))continue;seen.add(key);
   const clue_id=createHash('sha256').update(key).digest('hex').slice(0,20);
   hits.push({clue_id,id:r.id,name:r.name,unit:r.unit,url:r.url,phd:a.phd?.status,postdoc:a.postdoc?.status,evidence:context.slice(0,900)});
  }
 }
}
let inserted=0;
if(sync){
 db.exec(`PRAGMA busy_timeout=10000; CREATE TABLE IF NOT EXISTS saved_observation_clues(
  clue_id TEXT PRIMARY KEY,record_id TEXT NOT NULL,url TEXT NOT NULL,evidence TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,reviewed_at TEXT,review_note TEXT,
  FOREIGN KEY(record_id) REFERENCES records(id));`);
 const put=db.prepare('INSERT OR IGNORE INTO saved_observation_clues(clue_id,record_id,url,evidence,created_at) VALUES(?,?,?,?,?)');
 db.exec('BEGIN IMMEDIATE');try{for(const h of hits)inserted+=Number(put.run(h.clue_id,h.id,h.url,h.evidence,new Date().toISOString()).changes);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
}
db.close();
const offset=Math.max(0,Number(process.argv[2])||0),limit=Math.max(1,Math.min(100,Number(process.argv[3])||30));
console.log(JSON.stringify({note:'线索仅供人工核对；姓名和导师字样可能属于不同人。线索 ID 可用于去重；队列变化时 offset 可能移动。',count:hits.length,inserted,offset,next_offset:Math.min(offset+limit,hits.length),hits:hits.slice(offset,offset+limit)}));
