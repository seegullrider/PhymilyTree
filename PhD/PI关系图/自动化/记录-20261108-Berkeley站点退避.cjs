const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const now=Date.now();
const previous=db.prepare('SELECT * FROM host_limits WHERE host=?').get('escholarship.org');
const until=new Date(Math.max(Date.parse(previous?.until||'')||0,now+60*60*1000)).toISOString();
db.prepare('INSERT INTO host_limits(host,until,streak,last_limit) VALUES(?,?,?,?) ON CONFLICT(host) DO UPDATE SET until=excluded.until,streak=excluded.streak,last_limit=excluded.last_limit').run('escholarship.org',until,(previous?.streak||0)+1,new Date(now).toISOString());
console.log(JSON.stringify({host:'escholarship.org',until,reason:'robot verification'}));
db.close();
