// 只修正程序原样生成、尚未发送的错误检索式；已执行结果的查询须单独核实。
const {DatabaseSync} = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(process.env.PI_AUTOMATION_DB || path.join(__dirname, '检索队列.sqlite'));
db.exec(`PRAGMA busy_timeout=10000;
CREATE TABLE IF NOT EXISTS thesis_query_revisions (
 record_id TEXT NOT NULL, old_query TEXT NOT NULL, new_query TEXT NOT NULL,
 reason TEXT NOT NULL, recorded_at TEXT NOT NULL,
 PRIMARY KEY(record_id,old_query,new_query)
);`);
const oldClean=s=>s.replace(/[:：].*$/,'').replace(/（[^）]*）|\([^)]*\)/g,'').replace(/\s*[—–]\s*.*$/,'').replace(/["\r\n]/g,'').trim();
const newClean=s=>s.replace(/[:：].*$/,'').replace(/（[^）]*）|\([^)]*\)/g,' ').replace(/\s*[—–]\s*.*$/,'').replace(/["\r\n]/g,'').replace(/\s+/g,' ').trim();
const query=n=>`"${n}" PhD dissertation thesis advisor`;
const rows=db.prepare("SELECT t.record_id,t.query,t.state,r.name FROM thesis_search_jobs t JOIN records r ON r.id=t.record_id WHERE t.state IN ('pending','retry')").all();
const candidates=rows.map(r=>({...r,old_expected:query(oldClean(r.name)),new_query:query(newClean(r.name))}))
 .filter(r=>r.query===r.old_expected && r.new_query!==r.query && /\S[（(][^）)]*[）)]\S/.test(r.name));
if(process.argv[2]!=='apply'){console.log(JSON.stringify({candidates,note:'预览；传入 apply 才写入。'}));db.close();process.exit(0)}
const put=db.prepare('INSERT OR IGNORE INTO thesis_query_revisions VALUES(?,?,?,?,?)');
const update=db.prepare("UPDATE thesis_search_jobs SET query=?,updated=? WHERE record_id=? AND query=? AND state IN ('pending','retry')");
db.exec('BEGIN IMMEDIATE');try{let changed=0;for(const r of candidates){const t=new Date().toISOString(),n=update.run(r.new_query,t,r.record_id,r.query).changes;if(n){put.run(r.record_id,r.query,r.new_query,'姓名内括号昵称去除后补空格，防止名与姓粘连',t);changed+=Number(n)}}db.exec('COMMIT');console.log(JSON.stringify({changed,candidates}));}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}
