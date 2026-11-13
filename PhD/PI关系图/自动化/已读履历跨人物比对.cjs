// 将已经读取的履历类原文与数据库人物做宽松 URL 姓名匹配；仅生成待核线索。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const people=db.prepare(`select r.id,r.name,r.unit,r.filename,a.details_json from records r left join manual_audit_events a on a.audit_id=(select x.audit_id from manual_audit_events x where x.record_id=r.id order by x.recorded_at desc,x.rowid desc limit 1)`).all();
const pages=db.prepare("select record_id,url,excerpt,retrieved from pages where state='done' and excerpt is not null").all();db.close();
function norm(s){return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,'')}
function clean(s){return s.replace(/（[^）]*）|\([^)]*\)/g,' ').replace(/\s*[—–：:].*$/,' ').trim()}
const byid=new Map(people.map(p=>[p.id,p]));
const targets=people.map(r=>{const w=clean(r.name).split(/\s+/).map(norm).filter(Boolean);return {...r,needle:w.length>=2&&w[0].length>=3&&w.at(-1).length>=3?w[0]+w.at(-1):null}}).filter(r=>r.needle);
const found=[];for(const p of pages){if(!/cv|vitae?|curriculum|bio|thesis|dissertation/i.test(p.url)||!/(advisor|adviser|supervisor|mentor)/i.test(p.excerpt))continue;let url;try{url=decodeURIComponent(p.url)}catch{url=p.url}const u=norm(url);
 for(const r of targets){if(r.id===p.record_id||!u.includes(r.needle))continue;let a;try{a=JSON.parse(r.details_json).aspects}catch{continue}const excerpt=p.excerpt.replace(/\s+/g,' ').trim(),other=byid.get(p.record_id),note=fs.readFileSync(path.join(root,'人物',r.filename+'.md'),'utf8');const known_distinct=!!other&&note.split(/\r?\n/).some(l=>l.includes('[['+other.filename+'|')&&/不同|不是同一|不能合并/.test(l));found.push({record_id:r.id,name:r.name,unit:r.unit,filename:r.filename,source_record_id:p.record_id,source_record_name:other?.name,source_record_unit:other?.unit,known_distinct,url:p.url,retrieved:p.retrieved,phd_status:a.phd?.status,postdoc_status:a.postdoc?.status,excerpt});}}
found.sort((a,b)=>Number(a.phd_status==='confirmed_advisor'&&a.postdoc_status==='confirmed_advisor')-Number(b.phd_status==='confirmed_advisor'&&b.postdoc_status==='confirmed_advisor')||a.unit.localeCompare(b.unit)||a.name.localeCompare(b.name));
const data={generated:new Date().toISOString(),pages_scanned:pages.length,records:people.length,warning:'只按 URL 姓名和已读片段宽松匹配；姓名可能重名、作者或 CV 归属可能不同，片段也可能描述他人、学位前或其他阶段。不得自动创建关系；必须人工核实原文、身份、时间及指导类型。',matches:found};
const file=path.join(__dirname,'已读履历跨人物候选.json');fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n','utf8');
let md=`# 已读履历跨人物候选（待核）\n\n[[PI关系图总入口|返回图谱]] · [[师承待查名单（按最新人工事件）|待查名单]]\n\n生成时间：${data.generated}。扫描 ${pages.length} 个已读页面任务，匹配 ${found.length} 条候选，校属记录可能跨校重复。${data.warning}\n\n`;
for(const r of found)md+=`- [[${r.filename}|${r.name}]]（${r.unit}；博士 ${r.phd_status}；博士后 ${r.postdoc_status}）：[已读页面](${r.url})；来源原附属于 ${r.source_record_name}（${r.source_record_unit}）。${r.known_distinct?'**已有明确同名不同人标记，严禁据此归并或复制关系。**':''}已存摘录：${r.excerpt.replace(/[\r\n]/g,' ').slice(0,500)}\n`;
fs.writeFileSync(path.join(root,'已读履历跨人物候选（待核）.md'),md,'utf8');
console.log(JSON.stringify({file,pages:pages.length,matches:found.length,first:found.slice(0,18)},null,2));
