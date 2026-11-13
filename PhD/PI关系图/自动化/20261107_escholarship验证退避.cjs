// A host-level bot challenge is not source content. Pause automated page access.
const path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const host='escholarship.org',now=new Date().toISOString(),old=db.prepare('select * from host_limits where host=?').get(host);
const until=new Date(Math.max(old?Date.parse(old.until):0,Date.now()+4*60*60*1000)).toISOString();
db.prepare('insert into host_limits(host,until,streak,last_limit) values(?,?,?,?) on conflict(host) do update set until=excluded.until,streak=excluded.streak,last_limit=excluded.last_limit').run(host,until,(old?.streak||0)+1,now);
console.log(JSON.stringify({host,until,reason:'eScholarship 返回 JavaScript 人机验证页面，不再自动请求该主机'}));db.close();
