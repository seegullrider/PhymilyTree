const {DatabaseSync}=require('node:sqlite'),path=require('path');const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const rows=db.prepare('select p.id,p.url,o.tool_output from pages p join page_observations o on o.page_id=p.id where p.record_id=? and p.url like ?').all('08c48dab','%balsaralab%');
for(const r of rows){const lines=r.tool_output.split('\n');console.log(r.id,r.url);for(let i=0;i<lines.length;i++)if(/Amish|Tirrell|Lodge|Nitash/i.test(lines[i]))console.log(lines.slice(Math.max(i-1,0),Math.min(i+2,lines.length)).join('\n'));}db.close();
