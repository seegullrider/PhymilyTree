// 离线筛选已保存的网页正文片段；只建立复核线索，绝不自动写师承。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const rows=db.prepare(`SELECT p.record_id,p.url,p.excerpt,p.retrieved,r.name,r.unit,r.filename,a.details_json
 FROM pages p JOIN records r ON r.id=p.record_id
 LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 WHERE p.state='done' AND length(p.excerpt)>0`).all();db.close();
const clean=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/（.*?）|\([^)]*\)|\s*[—–]\s*.*/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').toLowerCase().trim();
const pattern=/\b(?:thesis|dissertation|doctoral|ph\.?d\.?|post[ -]?doc(?:toral)?|research)\s+(?:faculty\s+)?(?:advis(?:or|er)|supervisor|mentor)s?\b|\b(?:advis(?:or|er)|supervisor|mentor)s?\s*[:：]/ig;
let candidates=[];for(const r of rows){const name=clean(r.name).split(' ').filter(Boolean);if(name.length<2)continue;
 const doc=clean(r.excerpt),first=name[0],last=name.at(-1);if(!doc.includes(first)||!doc.includes(last))continue;
 const hits=[...r.excerpt.matchAll(pattern)];if(!hits.length)continue;let ev;try{ev=JSON.parse(r.details_json)}catch{continue}
 const aspects=ev?.aspects||{},needs=['phd','postdoc'].some(k=>aspects[k]?.status!=='confirmed_advisor')||ev.followup_required===true;if(!needs)continue;
 const contexts=hits.slice(0,4).map(m=>r.excerpt.slice(Math.max(0,m.index-150),Math.min(r.excerpt.length,m.index+240)).replace(/\s+/g,' ').trim());
 // 人物姓名出现在“advisor: 姓名”之后时，可能在谈其学生；仅标风险，不能自动判断或剔除。
 const reverseLikely=hits.some(m=>{const after=clean(r.excerpt.slice(m.index,m.index+115));const a=after.indexOf(first),b=after.indexOf(last);return a>=0&&b>=a&&b-a<65});
 const negative=hits.some(m=>/does not (?:name|identify|establish|specify)|names no (?:doctoral|postdoctoral|phd|thesis)|no (?:doctoral|postdoctoral|phd|thesis) advisor|not the dissertation advisor/i.test(r.excerpt.slice(Math.max(0,m.index-100),m.index+100)));
 const perspective=negative?'可能是否定表述':reverseLikely?'姓名在导师词后：可能是反向关系':'方向待核';
 candidates.push({record_id:r.record_id,name:r.name,unit:r.unit,filename:r.filename,url:r.url,retrieved:r.retrieved,phd_status:aspects.phd?.status,postdoc_status:aspects.postdoc?.status,perspective,contexts});}
const rank=x=>x.perspective==='方向待核'?0:x.perspective==='姓名在导师词后：可能是反向关系'?1:2;
candidates.sort((a,b)=>rank(a)-rank(b)||Number(a.phd_status==='confirmed_advisor')-Number(b.phd_status==='confirmed_advisor')||Number(a.postdoc_status==='confirmed_advisor')-Number(b.postdoc_status==='confirmed_advisor')||a.unit.localeCompare(b.unit)||a.name.localeCompare(b.name));
const target=path.join(__dirname,'已读网页导师线索候选.json');fs.writeFileSync(target,JSON.stringify({generated:new Date().toISOString(),note:'来自先前保存的网页正文片段，仅按姓名与导师关键词筛选。作者、时间、方向、上下文和原始页面必须人工核对；同名或导师在文中可能指其他人。不能直接认定师承，不会修改人物页或关系。',pages_scanned:rows.length,matched_pages:candidates.length,records:new Set(candidates.map(x=>x.record_id)).size,candidates},null,2)+'\n');
console.log(JSON.stringify({target,pages_scanned:rows.length,matched_pages:candidates.length,records:new Set(candidates.map(x=>x.record_id)).size,by_perspective:Object.fromEntries([...new Set(candidates.map(x=>x.perspective))].map(k=>[k,candidates.filter(x=>x.perspective===k).length])),first:candidates.slice(0,15)},null,2));
