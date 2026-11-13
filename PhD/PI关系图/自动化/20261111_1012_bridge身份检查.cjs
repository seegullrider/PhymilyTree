const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('检索队列.sqlite',{readOnly:true});
const records=db.prepare('SELECT p.id,p.url,r.id AS record_id,r.name,r.unit,r.filename FROM pages p JOIN records r ON p.record_id=r.id WHERE p.id=?');
for(const id of process.argv.slice(2)) console.log(JSON.stringify(records.get(id)));
