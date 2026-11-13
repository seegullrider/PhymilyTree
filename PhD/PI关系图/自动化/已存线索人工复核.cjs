// 以稳定 clue_id 逐条复核；只更新线索队列，不写师承或人物页。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const command=process.argv[2],db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
db.exec('PRAGMA busy_timeout=10000');
try{
 if(command==='next'){
  const n=Math.max(1,Math.min(100,Number(process.argv[3])||20));
  const diverse=process.argv.includes('--diverse');
  const rows=db.prepare(`SELECT clue_id,record_id,name,unit,url,evidence FROM (
   SELECT c.clue_id,c.record_id,r.name,r.unit,c.url,c.evidence,
   ROW_NUMBER() OVER (PARTITION BY c.record_id,c.url ORDER BY c.clue_id) AS source_rank
   FROM saved_observation_clues c JOIN records r ON r.id=c.record_id
   WHERE c.state='pending')
   ORDER BY ${diverse?'source_rank,':''} unit,name,url,clue_id LIMIT ?`).all(n);
  console.log(JSON.stringify({note:'线索不等于已确认导师；身份、阶段和原始上下文须人工核对。'+(diverse?'优先显示不同人物及来源，同页其余线索保留待查。':''),items:rows}));
 }else if(command==='apply'){
  const items=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
  if(!Array.isArray(items)||items.length<1||items.length>100)throw Error('需要 1–100 项复核记录');
  const seen=new Set();let updated=0,reused=0;
  db.exec('BEGIN IMMEDIATE');try{
   for(const x of items){
    if(!/^[a-f0-9]{20}$/.test(x.clue_id||'')||seen.has(x.clue_id))throw Error('无效或重复 clue_id');seen.add(x.clue_id);
    if(typeof x.note!=='string'||x.note.trim().length<20)throw Error('每项需要具体复核理由');
    const old=db.prepare('SELECT state,review_note FROM saved_observation_clues WHERE clue_id=?').get(x.clue_id);
    if(!old)throw Error('未知线索 '+x.clue_id);
    if(old.state==='reviewed'&&old.review_note===x.note.trim()){reused++;continue}
    if(old.state!=='pending')throw Error('线索已有复核结果，拒绝覆盖 '+x.clue_id);
    updated+=Number(db.prepare("UPDATE saved_observation_clues SET state='reviewed',review_note=?,reviewed_at=? WHERE clue_id=? AND state='pending'").run(x.note.trim(),new Date().toISOString(),x.clue_id).changes);
   }
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
  console.log(JSON.stringify({updated,reused}));
 }else throw Error('用法: node 已存线索人工复核.cjs next [数量] [--diverse] | apply 复核JSON');
}catch(e){console.error(String(e));process.exitCode=1}finally{db.close()}
