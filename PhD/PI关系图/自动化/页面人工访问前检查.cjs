// Read-only guard for manual primary-source reads, including URLs shared across records.
const path=require('node:path'),{DatabaseSync}=require('node:sqlite');
function hostKey(host){const h=host.toLowerCase().replace(/^www\./,'');return h==='linkedin.com'||h.endsWith('.linkedin.com')?'linkedin.com':h}
function isPageVerification(text) {
 return /人机验证|浏览器验证|机器人验证|checking your browser|reCAPTCHA|human verification required|verify that you[^\n]*not a robot|let['’]s confirm you are human|making sure you(?:['’]re| are) not a bot|complete the security check/i.test(text || '');
}
function isNonRetryablePageError(error) {
 return isPageVerification(error) || /\((?:403|404|418|999)\)|\bHTTP\s+(?:403|404|418|999)\b|\b(?:403 Forbidden|404 Not Found|418 I'm a Teapot|999 Request Denied)\b|content length is too large|non-retryable error|工具标为不可重试|仅返回标题|robots\.txt/i.test(error || '');
}
function check(db,url,now=new Date(),recordId){
 let parsed;try{parsed=new URL(url)}catch{return {url,allowed:false,reasons:['URL 无效']}};
 if(!['http:','https:'].includes(parsed.protocol))return {url,allowed:false,reasons:['仅允许 HTTP(S)']};
 const ts=now.toISOString(),reasons=[];
 for(const x of db.prepare("SELECT key,value FROM settings WHERE key IN ('backoff_until','thesis_search_retry_after')").all())if(Date.parse(x.value)>+now)reasons.push('共享退避 '+x.key+' 至 '+x.value);
 for(const x of db.prepare('SELECT host,until FROM host_limits WHERE until>?').all(ts))if(hostKey(x.host)===hostKey(parsed.hostname))reasons.push('主机退避 '+x.host+' 至 '+x.until);
 const pages=db.prepare('SELECT p.record_id,p.state,p.attempts,p.error,p.retrieved,l.expires_at FROM pages p LEFT JOIN page_leases l ON l.page_id=p.id WHERE p.url=?').all(url);
 for(const p of pages){if(p.expires_at&&Date.parse(p.expires_at)>+now)reasons.push('网页有有效租约 '+p.record_id+' 至 '+p.expires_at);
  const error=p.error||'';
  const identityMismatch=/已人工核实属于数据库外其他同名者：|已直接核为另一位同名/.test(error);
  if(identityMismatch&&recordId&&p.record_id!==recordId&&!isNonRetryablePageError(error))continue;
  if(p.state==='excluded'||isNonRetryablePageError(error)||identityMismatch)reasons.push('网页不可自动重试或已排除身份 '+p.record_id+' '+error.slice(0,140));
  else if(p.state==='retry'&&p.attempts>=3)reasons.push('网页已达自动重试上限 '+p.record_id+' '+p.attempts+' 次');
  else if(p.state==='retry'&&p.retrieved&&Date.parse(p.retrieved)+1800000>+now)reasons.push('网页退避 '+p.record_id+' 至 '+new Date(Date.parse(p.retrieved)+1800000).toISOString());
 }
 return {url,allowed:reasons.length===0,reasons,previous_records:pages.map(({record_id,state,attempts,retrieved})=>({record_id,state,attempts,retrieved}))};
}
if(require.main===module){try{const urls=process.argv.slice(2);const recordId=urls[0]==='--record'?(urls.splice(0,2)[1]??''):undefined;if(!urls.length||(recordId!==undefined&&!/^[a-f0-9]{8}$/.test(recordId)))throw Error('用法：node 页面人工访问前检查.cjs [--record 校属ID] URL [URL ...]');const db=new DatabaseSync(process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const result=urls.map(u=>check(db,u,new Date(),recordId));db.close();console.log(JSON.stringify(result,null,2));if(result.some(x=>!x.allowed))process.exitCode=2}catch(e){console.error(String(e));process.exitCode=1}}
module.exports={check,isNonRetryablePageError,isPageVerification};
