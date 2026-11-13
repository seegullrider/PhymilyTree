// 从本地队列生成可追查的失败清单；只读 SQLite，不重试网页或推断导师。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {isPageVerification}=require('./页面人工访问前检查.cjs');
const graph=process.env.PI_GRAPH_ROOT||path.resolve(__dirname,'..');
const db=new DatabaseSync(process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
db.exec('BEGIN');
const rows=db.prepare(`SELECT p.id,p.url,p.state,p.error,p.attempts,p.retrieved,r.name,r.unit,r.filename
 FROM pages p JOIN records r ON r.id=p.record_id WHERE p.state IN ('retry','excluded') ORDER BY r.unit,r.name,p.url`).all();
const hosts=db.prepare('SELECT host,until FROM host_limits').all();
const settings=db.prepare("SELECT key,value FROM settings WHERE key IN ('backoff_until','thesis_search_retry_after')").all();
db.exec('COMMIT');db.close();
const clean=s=>String(s||'').replace(/[\r\n\[\]|]+/g,' ').replace(/\s+/g,' ').trim();
function classify(r){let e=String(r.error||'').toLowerCase();
 if(/其他同名者/.test(e))return '已核实为其他同名者，停止按此人物读取';
 if(/同名及学位阶段未核/.test(e))return '同名与学位阶段待核，暂停重复读取';
 if(isPageVerification(e))return '人机验证，停止自动访问';
 if(/robots\.txt/.test(e))return '站点 robots 规则限制';
 if(/临时签名|access.token|signature/.test(e))return '临时签名链接或凭据';
 if(/第三方代理|转发/.test(e))return '第三方代理地址';
 if(/脚本注入|可执行脚本|事件处理器/.test(e))return '网址查询参数不安全';
 if(/429|too many requests|rate.?limit/.test(e))return '429 或限流';
 if(/\b403\b|forbidden/.test(e))return '403 或禁止访问';
 if(/\b404\b|not found/.test(e))return '404 或页面不存在';
 if(/\b999\b/.test(e))return '999 或访问受限';
 if(/cache miss/.test(e))return '来源未进入工具缓存';
 if(/content length.*large|过大|超过.*(?:大小|限制)|too large/.test(e))return '内容过大';
 if(/校园网|university network|vpn/.test(e))return '来源要求校园网';
 if(/not accessible|无法访问|无法读取|failed to fetch|无法打开/.test(e))return '页面或工具不可访问';
 if(/未获取|无可提取|仅返回标题|空内容|无正文/.test(e))return '未取得可用正文';
 return '其他失败或待人工查看';
}
function safeLink(raw){try{let u=new URL(raw);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return {host:'不安全地址',link:null};
 const unsafe=[...u.searchParams].some(([k,v])=>/(?:access.?token|signature|credential|x-amz|expires|api.?key)/i.test(k)||/(?:javascript\s*:|<script|on(?:error|load|click)\s*=)/i.test(v));
 u.hash='';if(unsafe)u.search='';return {host:u.hostname.toLowerCase(),link:u.href.replace(/[<>]/g,''),redacted:unsafe};
 }catch{return {host:'地址无效',link:null}}}
const limitMap=new Map(hosts.map(x=>[x.host.toLowerCase(),x.until]));const groups=new Map();
for(const r of rows){const category=classify(r),key=r.state+'\n'+category;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...r,...safeLink(r.url)});}
const distinct=new Set(rows.map(r=>r.filename));let out=`# 网页读取受阻与后续追查\n\n[[自动检索运行进度|自动检索进度]] · [[待核师承名单|按人物查看师承待核]] · [[PI关系图总入口|返回图谱]]\n\n生成时间：${new Date().toISOString()}。本表列 SQLite 中 retry 与 excluded 的来源任务，涉及 ${rows.length} 个网页任务、${distinct.size} 条校属记录；一人可能有多个失败来源、跨校重复，也可能已有其他可靠资料。此表不是未查到导师人数，也不表示全部资料均无法获得。\n\n`;
out+='> [!warning] 来源状态而非师承结论\n> 人机验证、robots 或明确拒绝的来源不自动绕过；应查其他原始资料或等待合法访问。普通 retry 也可能因尝试次数、地址错误或站点限制不能自动重试。主机和共享退避持续变化，实际以 SQLite 和队列命令为准。\n\n';
out+=`共享设置：${settings.map(x=>`${clean(x.key)} ${clean(x.value)}`).join('；')||'无'}。\n\n`;
for(const [key,items] of [...groups].sort((a,b)=>a[0].localeCompare(b[0],'zh'))){const [state,category]=key.split('\n');out+=`## ${state==='excluded'?'暂停自动读取':'失败或等待重试'}：${category}（${items.length}）\n\n`;let unit='';for(const r of items){if(unit!==r.unit){unit=r.unit;out+=`### ${clean(unit)}\n\n`}const noLink=/第三方代理|网址查询参数不安全/.test(category);const source=noLink?'原地址不展示，请追查原始来源':r.link?`[${r.redacted?'来源路径（查询已省略）':'来源'}](<${r.link}>)`:'来源地址不可安全展示';const hostUntil=limitMap.get(r.host),hold=hostUntil&&Date.parse(hostUntil)>Date.now()?`；主机退避至 ${clean(hostUntil)}`:'';out+=`- [[${r.filename}|${clean(r.name)}]]：${source}；${clean(r.host)}；尝试 ${r.attempts} 次；最近记录 ${clean(r.retrieved)||'未知'}${hold}。\n`;}}
const target=path.join(graph,'网页读取受阻与后续追查.md'),temp=target+'.tmp-'+process.pid;fs.writeFileSync(temp,out,'utf8');fs.renameSync(temp,target);
console.log(JSON.stringify({pages:rows.length,records:distinct.size,excluded:rows.filter(x=>x.state==='excluded').length,retry:rows.filter(x=>x.state==='retry').length,groups:[...groups].map(([k,v])=>({group:k.replace('\n',' / '),count:v.length})),target}));
