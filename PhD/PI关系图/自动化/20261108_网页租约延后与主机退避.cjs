// 释放未请求的已知不可用页面租约；将新遇到的机器人验证记为站点退避，不绕过。
const path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const d=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const held=[
 ['a78b00798dbf6c964d0cc19e','b847c1ee03db12dc5f4b51a2d6109708','已有 74.8 MB 过大错误；未再次请求，待找合法较小副本'],
 ['8b2ed59aaa8d6e03baf7a6c9','1e631278336f0c109fe4cef0ba727a81','此前只返回标题、没有名录正文；未再次请求，待找直接资料']
];
const now=new Date().toISOString(),proposed=new Date(Date.now()+30*60000).toISOString();
d.exec('BEGIN IMMEDIATE');try{
 for(const [id,token,reason] of held){
  const page=d.prepare('SELECT job_id,url,error,state FROM pages WHERE id=?').get(id);
  const lease=d.prepare('SELECT token FROM page_leases WHERE page_id=?').get(id);
  if(!page||page.state!=='retry'||!lease||lease.token!==token)throw Error('页面状态或租约已变化：'+id);
  d.prepare('DELETE FROM page_leases WHERE page_id=? AND token=?').run(id,token);
  d.prepare('INSERT INTO events(job_id,level,detail,created) VALUES(?,?,?,?)').run(page.job_id,'page_deferred',page.url+' '+reason,now);
 }
 const old=d.prepare('SELECT until,streak FROM host_limits WHERE host=?').get('escholarship.org');
 const until=old?.until>proposed?old.until:proposed;
 d.prepare('INSERT INTO host_limits(host,until,streak,last_limit) VALUES(?,?,?,?) ON CONFLICT(host) DO UPDATE SET until=excluded.until,streak=excluded.streak,last_limit=excluded.last_limit').run('escholarship.org',until,(old?.streak||0)+1,now);
 d.exec('COMMIT');console.log(JSON.stringify({released:held.map(x=>x[0]),host:'escholarship.org',until}));
}catch(e){d.exec('ROLLBACK');throw e}finally{d.close()}
