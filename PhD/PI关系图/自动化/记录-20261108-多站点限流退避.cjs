const path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const key='backoff_until',old=db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
const target=new Date(Math.max(Date.parse(old)||0,Date.now()+30*60*1000)).toISOString();
db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,target);
console.log(JSON.stringify({key,previous:old,until:target,reason:'multiple source hosts returned HTTP 429'}));
db.close();
