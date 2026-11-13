const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const host='pmc.ncbi.nlm.nih.gov', now=Date.now();
const old=db.prepare('SELECT * FROM host_limits WHERE host=?').get(host);
const until=new Date(Math.max(Date.parse(old?.until||'')||0,now+60*60*1000)).toISOString();
db.prepare('INSERT INTO host_limits(host,until,streak,last_limit) VALUES(?,?,?,?) ON CONFLICT(host) DO UPDATE SET until=excluded.until,streak=excluded.streak,last_limit=excluded.last_limit').run(host,until,(old?.streak||0)+1,new Date(now).toISOString());
console.log(JSON.stringify({host,until,reason:'reCAPTCHA'}));
db.close();
