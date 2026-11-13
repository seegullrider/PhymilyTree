// 从已保存的正文片段和页面摘要提取线索，供人工复核。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'), db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
db.exec('BEGIN');
const rows=db.prepare(`SELECT r.id,r.name,r.unit,r.filename,p.id AS page_id,p.url,p.excerpt,p.retrieved,a.details_json
 FROM pages p JOIN records r ON r.id=p.record_id
 JOIN manual_audit_events a ON a.rowid=(SELECT x.rowid FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 WHERE p.state='done'
 AND NOT EXISTS (SELECT 1 FROM page_identity_mismatches m WHERE m.page_id=p.id)
 ORDER BY r.unit COLLATE NOCASE,r.name COLLATE NOCASE,p.url`).all();
const observations=new Map();
for(const row of db.prepare(`SELECT o.page_id,o.retrieved,o.tool_output FROM page_observations o
 JOIN pages p ON p.id=o.page_id WHERE p.state='done'
 AND NOT EXISTS (SELECT 1 FROM page_identity_mismatches m WHERE m.page_id=p.id)
 ORDER BY o.retrieved DESC,o.rowid DESC`).iterate()){
 let previous=null;
 const lines=Array.from(row.tool_output.matchAll(/^L(\d+)(?:@P\d+(?:-\d+)?)?:[ \t]*([^\r\n]*)/gm),m=>{
  const n=Number(m[1]);
  const gap=previous!==null&&n!==previous+1;
  previous=n;
  return gap?' […] '+m[2]:m[2];
 });
 if(!lines.length)continue;
 const entries=observations.get(row.page_id)||[];
 entries.push({retrieved:row.retrieved,body:lines.join('\n')});
 observations.set(row.page_id,entries);
}
db.exec('COMMIT');db.close();
const patterns={
 phd:/\b(?:(?<!post[ -])doctoral|thesis|dissertation|ph\.?\s?d\.?|graduate)\s+(?:(?:thesis|research)\s+)?(?:advisor|adviser|supervisor)s?\b|\b(?:(?<!post[ -])doctor(?:al|ate)|dissertation|ph\.?\s?d\.?)[^.!?…]{0,110}\bunder\s+(?:the\s+)?(?:supervision|direction|advisement)\b|\b(?:thesis|dissertation)\s+(?:was\s+)?supervised\s+by\b|\bbetreuende[rn]?\s+Hochschullehrer(?:in)?\b/gi,
 postdoc:/\bpost[ -]?doc(?:toral)?\s+(?:research\s+)?(?:advisor|adviser|mentor|supervisor)s?\b|\bpost[ -]?doc(?:toral)?[^.!?…]{0,110}\bunder\s+(?:the\s+)?(?:supervision|direction|advisement)\b/gi
};
const clean=s=>String(s||'')
 .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已省略]')
 .replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').replace(/\|/g,'／').trim();
const words=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
function mentionsPerson(excerpt,name){
 const expected=words(name.split(/—|[（(]/,1)[0]).filter(x=>x!=='jr'&&x!=='sr');
 const actual=words(excerpt);
 if(!expected.length)return false;
 return actual.some((word,i)=>word===expected[0]&&actual.slice(i,i+expected.length+2).includes(expected.at(-1)));
}
function negatesEvidence(fragment,stage){
 const role=stage==='phd'
  ? '(?:doctoral|thesis|dissertation|ph\\.?\\s?d\\.?)'
  : 'post[ -]?doc(?:toral)?';
 const absent=new RegExp('\\b(?:does not (?:name|identify|list|specify|establish)|no)\\b[^.!?…]{0,95}'+role+'[^.!?…]{0,40}\\b(?:advisor|adviser|supervisor|mentor)s?\\b','i');
 return absent.test(fragment)||/\breverse (?:faculty-to-student index only|student relation)\b|\bthis is evidence about a trainee, not about\b/i.test(fragment);
}
const results=[];
for(const r of rows){const audit=JSON.parse(r.details_json);for(const [stage,pattern] of Object.entries(patterns)){
 const a=audit.aspects?.[stage];if(!a||!['unresolved','group_or_candidate'].includes(a.status))continue;
 const saved=observations.get(r.page_id)||[];
 const candidates=saved.map(entry=>({text:clean(entry.body),retrieved:entry.retrieved,origin:'正文片段'}));
 candidates.push({text:clean(r.excerpt),retrieved:r.retrieved,origin:'页面摘要'});
 let best;
 for(const {text,retrieved,origin} of candidates)for(const fragment of text.split(' […] ')){
  if(origin==='页面摘要'&&negatesEvidence(fragment,stage))continue;
  for(const match of fragment.matchAll(pattern)){
   const before=fragment.slice(Math.max(0,match.index-145),match.index);
   const after=fragment.slice(match.index+match[0].length,match.index+320);
   if(/\b(?:outstanding|best)\s*$/i.test(before)||/^\s+award\b/i.test(after))continue;
   const excerpt=(before+match[0]+after).trimEnd();
   const nearby=before+match[0]+after.slice(0,125);
   const caution=origin==='页面摘要'||!mentionsPerson(nearby,r.name)||/\b(?:does not (?:name|identify|establish)|not about|not (?:a |the )?(?:thesis |doctoral |postdoctoral )?(?:advisor|mentor)|advisor to\b|outstanding (?:graduate |doctoral )?advisor)\b/i.test(nearby);
   // Preserve the original text as a lead, but surface a nearby subject over an earlier unrelated match.
   const score=Number(!caution)*2+Number(origin==='正文片段');
   if(!best||score>best.score)best={score,retrieved,origin,excerpt,caution};
  }
 }
 if(best)results.push({id:r.id,name:r.name,unit:r.unit,filename:r.filename,stage,status:a.status,note:a.note,url:r.url,...best});
}}
let out='# 已缓存正文中的师承线索（待复核）\n\n';
const rawCount=results.filter(r=>r.origin==='正文片段').length;
out+=`生成时间：${new Date().toISOString()}。从 ${rows.length} 条已保存网页筛出 ${results.length} 条线索，涉及 ${new Set(results.map(r=>r.id)).size} 条校属记录。其中正文片段 ${rawCount} 条，页面摘要 ${results.length-rawCount} 条。仅筛最新事件中该阶段未明或为组／候选的记录。\n\n`;
out+='> [!warning] 这不是导师名单\n> 缓存中可能含人工摘要；摘录也可能截断、指向同名者、讨论别人的导师或包含否定句，不能据此确认关系。须重新读取原网页或论文全文，核对被指导者身份、具体阶段和来源，再更新事件与图谱。旧已读原文仍应遵守站点退避。\n\n';
let unit='';for(const r of results){if(unit!==r.unit){unit=r.unit;out+=`## ${clean(unit)}\n\n`;}out+=`- [[${r.filename}|${clean(r.name)}]]；${r.stage==='phd'?'博士':'博士后'}台账：${r.status==='unresolved'?'未查明':'组或候选'}；[待复读来源](${r.url})；缓存时间：${r.retrieved||'未知'}。${r.caution?' **需先核对片段指向的人物及关系方向。**':''}\n  - ${r.origin}：${r.excerpt}\n  - 最新待核备注：${clean(r.note)}\n`;}
const target=path.join(root,'已缓存正文中的师承线索（待复核）.md');fs.writeFileSync(target,out,'utf8');
console.log(JSON.stringify({pages:rows.length,pages_with_body:observations.size,leads:results.length,body_leads:rawCount,records:new Set(results.map(r=>r.id)).size,target}));
