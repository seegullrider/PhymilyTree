// 仅定位人物页已有明确导师标注与先前网页片段中人名、导师词的重合；不自动认定或录入关系。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const recs=db.prepare('SELECT id,name,unit,filename FROM records').all();
const pages=db.prepare("SELECT record_id,url,excerpt,retrieved FROM pages WHERE state='done' AND length(excerpt)>0").all();
const typed=db.prepare(`SELECT t.record_id,t.stage,t.mentor_filename,t.kind FROM typed_relation_events t
 WHERE t.rowid=(SELECT x.rowid FROM typed_relation_events x WHERE x.record_id=t.record_id AND x.stage=t.stage AND x.mentor_filename=t.mentor_filename ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();db.close();
const byRecord=new Map();for(const p of pages){const a=byRecord.get(p.record_id)||[];a.push(p);byRecord.set(p.record_id,a)}
const key=(r,s,m)=>[r,s,m].join('\n'),done=new Set(typed.map(x=>key(x.record_id,x.stage,x.mentor_filename)));
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/（.*?）|\([^)]*\)|\s*[—–]\s*.*/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function words(s){const t=normalize(s).split(' ').filter(x=>x.length>1);return t.length>=2?[t[0],t.at(-1)]:[]}
function has(text,w){return w.length===2&&w.every(x=>new RegExp('(?:^| )'+x+'(?: |$)').test(text))}
function urlKey(s){try{const u=new URL(s);u.hash='';return u.href}catch{return s}}
const items=[];for(const r of recs){const file=path.join(root,'人物',r.filename+'.md');if(!fs.existsSync(file))continue;const note=fs.readFileSync(file,'utf8'),section=note.match(/(?:^|\n)## 师承\s*\r?\n([\s\S]*?)(?=\r?\n## |\r?\n<!-- PI-AUTO-SEARCH:START|$)/)?.[1];if(!section)continue;
 for(const line of section.split(/\r?\n/)){const match=line.match(/^- (博士导师|博士后导师)：\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);if(!match)continue;const stage=match[1]==='博士导师'?'phd':'postdoc',mentor=match[2],display=match[3]||mentor.replace(/^师承人物 - /,'');if(done.has(key(r.id,stage,mentor)))continue;
  const sourceUrls=[...line.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(x=>urlKey(x[1]));if(!sourceUrls.length)continue;
  for(const p of byRecord.get(r.id)||[]){if(!sourceUrls.includes(urlKey(p.url)))continue;const txt=normalize(p.excerpt);if(!has(txt,words(r.name))||!has(txt,words(display)))continue;
   const wordsFound=[...p.excerpt.matchAll(/\b(?:thesis|doctoral|dissertation|post[ -]?doc(?:toral)?|ph\.?d\.?)?\s*(?:advis(?:or|er)|supervisor|mentor)\b/ig)].slice(0,6).map(m=>m[0].trim());if(!wordsFound.length)continue;
   items.push({record_id:r.id,name:r.name,unit:r.unit,filename:r.filename,stage,mentor_filename:mentor,mentor_display:display,source:p.url,retrieved:p.retrieved,source_words:wordsFound,person_line:line,excerpt:p.excerpt});
  }
 }
}
items.sort((a,b)=>a.unit.localeCompare(b.unit)||a.name.localeCompare(b.name)||a.stage.localeCompare(b.stage));const target=path.join(__dirname,'已读来源与人物关系待核.json');
fs.writeFileSync(target,JSON.stringify({generated:new Date().toISOString(),warning:'人名、网址和导师关键词同时出现并不能证明指导或方向；正文可能是别人、否定句、网页提问或同名者。保留候选，必须人工核对完整原始材料和身份；不可自动认定或写入。',records_scanned:recs.length,pages_scanned:pages.length,candidates:items},null,2)+'\n');
console.log(JSON.stringify({target,records_scanned:recs.length,pages_scanned:pages.length,candidates:items.length,persons:new Set(items.map(x=>x.record_id)).size,first:items.slice(0,15).map(({excerpt,person_line,...x})=>({...x,excerpt:excerpt.slice(0,700)}))},null,2));
