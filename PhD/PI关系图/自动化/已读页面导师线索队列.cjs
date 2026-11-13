// Offline evidence triage only. Never infer or write mentor relations.
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const rows=db.prepare(`SELECT r.id,r.name,r.unit,r.filename,p.url,p.excerpt,p.retrieved,a.details_json
 FROM records r JOIN pages p ON p.record_id=r.id AND p.state='done'
 JOIN manual_audit_events a ON a.rowid=(SELECT x.rowid FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 WHERE NOT EXISTS (SELECT 1 FROM page_identity_mismatches m WHERE m.page_id=p.id)
 ORDER BY r.unit COLLATE NOCASE,r.name COLLATE NOCASE,p.retrieved`).all();db.close();
const names=s=>s.replace(/[（(—].*$/,'').trim().toLowerCase().split(/\s+/).filter(Boolean);
const clean=s=>String(s||'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已省略]').replace(/(?:\+?\d{1,3}[ .-]?)?(?:\(\d{3}\)|\b\d{3})[ .-]\d{3}[ .-]\d{4}\b/g,'[电话已省略]').replace(/\b(?:was born|born on|date of birth)\b[^.\n]*/gi,'[出生信息已省略]').replace(/[\r\n\t|]+/g,' ').replace(/\s+/g,' ').trim();
const hints=[];for(const r of rows){const a=JSON.parse(r.details_json).aspects,n=names(r.name),raw=r.excerpt||'',low=raw.toLowerCase();if(n.length<2||!low.includes(n[0])||!low.includes(n[n.length-1]))continue;if(a.phd.status==='confirmed_advisor'&&a.postdoc.status==='confirmed_advisor')continue;
 const hit=/(?:advisor|supervisor|mentor).{0,100}(?:post.?doc|ph\.?d|doctoral)|(?:post.?doc|ph\.?d|doctoral).{0,150}(?:advisor|supervisor|mentor)/is.exec(raw);if(!hit)continue;
 const excerpt=clean(raw.slice(Math.max(0,hit.index-140),Math.min(raw.length,hit.index+hit[0].length+150))).slice(0,500);hints.push({id:r.id,name:r.name,unit:r.unit,filename:r.filename,url:r.url,retrieved:r.retrieved,phd:a.phd.status,postdoc:a.postdoc.status,excerpt});}
let out=`# 已读页面中的导师线索（待逐条核实）\n\n[[人工核查台账进度|人工台账]] · [[师承未明确名单（按阶段和学校）|分阶段名单]]\n\n生成时间：${new Date().toISOString()}。从已读页面任务的已有摘录筛出 ${hints.length} 条启发式线索；不是新的网页访问。姓名和导师词语同现常常来自别人的履历、导师、学生、委员会成员或页面导航；摘录也可能截断或是已保存的人工摘要。须核查原页面、作者、时间和具体角色，不能据本名单自动创建关系。相同人物可能有多条来源，既有人物页可能已有可靠关系。\n\n`;
let school='';for(const r of hints){if(r.unit!==school){school=r.unit;out+=`## ${school.replace(/[\r\n]/g,' ')}\n\n`;}out+=`- [[${r.filename}|${r.name.replace(/[\[\]|]/g,' ')}]]（博士 ${r.phd}；博士后 ${r.postdoc}）：[已读页面](${r.url})；摘录：${r.excerpt}\n`}
const target=path.join(root,'已读页面中的导师线索（待逐条核实）.md');fs.writeFileSync(target,out,'utf8');console.log(JSON.stringify({target,pages:hints.length,records:new Set(hints.map(x=>x.id)).size}));
