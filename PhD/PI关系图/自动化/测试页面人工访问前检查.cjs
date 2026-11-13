const assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),{check,isPageVerification}=require('./页面人工访问前检查.cjs');
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE settings(key TEXT,value TEXT); CREATE TABLE host_limits(host TEXT,until TEXT); CREATE TABLE pages(id TEXT,record_id TEXT,url TEXT,state TEXT,attempts INTEGER,error TEXT,retrieved TEXT); CREATE TABLE page_leases(page_id TEXT,expires_at TEXT)');
const now=new Date('2026-11-09T02:00:00Z'),u='https://example.org/a',insert=db.prepare('INSERT INTO pages VALUES(?,?,?,?,?,?,?)');
assert.equal(check(db,u,now).allowed,true);insert.run('1','one',u,'retry',1,'(502) Bad Gateway','2026-11-09T01:45:00Z');assert.equal(check(db,u,now).allowed,false);assert.equal(check(db,u,new Date('2026-11-09T02:16:00Z')).allowed,true);
insert.run('2','other',u,'excluded',4,'(403) Forbidden','2026-11-01T00:00:00Z');assert.equal(check(db,u,now).allowed,false);assert.match(check(db,u,now).reasons.join(),/403/);
insert.run('3','other','https://example.org/missing','excluded',1,'(404) Not Found','2026-11-01T00:00:00Z');assert.match(check(db,'https://example.org/missing',now).reasons.join(),/404/);
insert.run('4','other','https://example.org/namesake','excluded',1,'已直接核为另一位同名语言学家','2026-11-01T00:00:00Z');assert.equal(check(db,'https://example.org/namesake',now).allowed,false);
const sharedDirectory='https://example.org/dissertations';
insert.run('shared','other',sharedDirectory,'excluded',1,'已人工核实属于数据库外其他同名者：校属记录不是目录中的人','2026-11-01T00:00:00Z');
assert.equal(check(db,sharedDirectory,now,'new-person').allowed,true);
assert.equal(check(db,sharedDirectory,now,'other').allowed,false);
assert.equal(check(db,u,now,'new-person').allowed,false);
insert.run('5','other','https://example.org/bare','excluded',1,'403 Forbidden','2026-11-01T00:00:00Z');assert.equal(check(db,'https://example.org/bare',now).allowed,false);
insert.run('6','other','https://example.org/excluded','excluded',1,'不可自动重试','2026-11-01T00:00:00Z');assert.equal(check(db,'https://example.org/excluded',now).allowed,false);
insert.run('7','other','https://example.org/teapot','retry',1,"(418) I'm a Teapot",'2026-11-01T00:00:00Z');assert.equal(check(db,'https://example.org/teapot',now).allowed,false);
insert.run('8','other','https://example.org/challenge','retry',1,'Checking your browser - reCAPTCHA','2026-11-01T00:00:00Z');assert.equal(check(db,'https://example.org/challenge',now).allowed,false);
insert.run('9','other','https://example.org/unsupported-redirect','retry',1,'(500) Redirected (non-retryable error)','2026-11-01T00:00:00Z');assert.equal(check(db,'https://example.org/unsupported-redirect',now).allowed,false);
for (const [i,message] of ["Let's confirm you are human",'Making sure you’re not a bot!','需要人机验证，停止自动访问'].entries()) {
 const url='https://example.org/verification-'+i;
 assert.equal(isPageVerification(message),true);
 insert.run('verification-'+i,'other',url,'retry',1,message,'2026-11-01T00:00:00Z');
 assert.equal(check(db,url,now).allowed,false);
}
assert.equal(isPageVerification('PhD thesis, Nicholas Read, 1986'),false);
db.prepare('DELETE FROM pages WHERE id=?').run('2');db.prepare('INSERT INTO page_leases VALUES(?,?)').run('1','2026-11-09T02:10:00Z');assert.match(check(db,u,now).reasons.join(),/租约/);
db.prepare('INSERT INTO host_limits VALUES(?,?)').run('elsewhere.org','2026-11-09T03:00:00Z');assert.equal(check(db,'https://www.elsewhere.org/x',now).allowed,false);
db.prepare('INSERT INTO settings VALUES(?,?)').run('backoff_until','2026-11-09T02:10:00Z');assert.equal(check(db,'https://newhost.example/x',now).allowed,false);assert.equal(check(db,'not-url',now).allowed,false);db.close();console.log('页面人工访问前检查：跨记录 403、502 退避、租约、主机及共享退避均通过');
