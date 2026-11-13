// LinkedIn 999 是访问限制，保持页面与原错误，停止自动重试而不绕过。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const f=path.join(__dirname,'检索流程.cjs'),old="/content length is too large|仅返回标题/i.test(row.error||'')",next="/content length is too large|仅返回标题|\\(999\\)/i.test(row.error||'')";
let t=fs.readFileSync(f,'utf8');if(!t.includes(next)){if(t.split(old).length!==2)throw Error('队列过滤条件变化');t=t.replace(old,next);fs.writeFileSync(f,t)}
const d=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const id='1dfaf1946fa0410070e52faf',token='787e8033f85d6b8604fcb255dad8c8cf';
d.exec('BEGIN IMMEDIATE');try{let p=d.prepare('SELECT job_id,url,error FROM pages WHERE id=?').get(id),l=d.prepare('SELECT token FROM page_leases WHERE page_id=?').get(id);if(!p||!/\(999\)/.test(p.error)||!l||l.token!==token)throw Error('状态或租约变化');d.prepare('DELETE FROM page_leases WHERE page_id=? AND token=?').run(id,token);d.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(p.job_id,'page_deferred',p.url+' 已返回 999 访问限制；本轮未重试，等待公开替代来源',new Date().toISOString());d.exec('COMMIT')}catch(e){d.exec('ROLLBACK');throw e}finally{d.close()}
console.log('保留原 999 原因，释放未请求租约，禁止自动重试该受限页面。');
