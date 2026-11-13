// Search cached excerpts and original supervision lists for cross-person clues.
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {phdLabel,postLabel}=require('./人物页导师标签.cjs');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const people=db.prepare(`SELECT r.id,r.name,r.unit,r.filename,r.relation_json,a.details_json FROM records r JOIN manual_audit_events a ON a.rowid=(SELECT x.rowid FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();
const pages=db.prepare(`SELECT p.record_id,p.url,p.excerpt,p.retrieved FROM pages p
 WHERE p.state='done' AND length(p.excerpt)>30 AND lower(p.excerpt) GLOB '*advisor*'
 AND NOT EXISTS (SELECT 1 FROM page_identity_mismatches m WHERE m.page_id=p.id)`).all();
const originalLists=db.prepare(`SELECT p.record_id,p.url,o.retrieved,o.tool_output FROM page_observations o
 JOIN pages p ON p.id=o.page_id WHERE p.state='done'
 AND NOT EXISTS (SELECT 1 FROM page_identity_mismatches m WHERE m.page_id=p.id) AND
 (lower(o.tool_output) LIKE '%dissertations directed%' OR lower(o.tool_output) LIKE '%dissertation supervision%'
 OR lower(o.tool_output) LIKE '%doctoral students supervised%' OR lower(o.tool_output) LIKE '%ph.d. students mentored%'
 OR lower(o.tool_output) LIKE '%phd students supervised%' OR lower(o.tool_output) LIKE '%doctoral dissertations supervised%'
 OR lower(o.tool_output) LIKE '%post-doctoral students supervised%'
 OR lower(o.tool_output) LIKE '%thesis advisor and postgraduate-scholar sponsor%'
 OR lower(o.tool_output) LIKE '%postdoctoral scholar advisees%' OR lower(o.tool_output) LIKE '%thesis advisees%'
 OR lower(o.tool_output) LIKE '%former ph.d. students%' OR lower(o.tool_output) LIKE '%postdoctoral mentoring%'
 OR lower(o.tool_output) LIKE '%postdoctoral fellows supervised%' OR lower(o.tool_output) LIKE '%completed mentees%'
 OR lower(o.tool_output) LIKE '%post-doctoral researchers advised%'
 OR lower(o.tool_output) LIKE '%postdoctoral researchers advised%'
 OR lower(o.tool_output) LIKE '%doctoral students advised%'
 OR lower(o.tool_output) LIKE '%ph.d. students advised%'
 OR lower(o.tool_output) LIKE '%graduate students advised%'
 OR lower(o.tool_output) LIKE '%postdoctoral fellows advised%'
 OR (p.url LIKE 'https://sachdev.physics.harvard.edu/%/cv.pdf' AND lower(o.tool_output) LIKE '%postdocs%')
 OR lower(o.tool_output) LIKE '%postdoctoral associates and fellows%'
 OR lower(o.tool_output) LIKE '%former graduate students and postdoctoral associates%'
 OR lower(o.tool_output) LIKE '%group alumni and visitors%'
 OR (lower(o.tool_output) LIKE '%# alumni%' AND lower(o.tool_output) LIKE '%### postdocs:%')
 OR lower(o.tool_output) LIKE '%postdoctoral associates supervised%'
 OR lower(o.tool_output) LIKE '%postdoctoral researchers supervised%'
 OR lower(o.tool_output) LIKE '%supervised students and postdocs%'
 OR lower(o.tool_output) LIKE '%students & postdoctoral fellows mentored%'
 OR lower(o.tool_output) LIKE '%shull fellows supervised%'
 OR lower(o.tool_output) LIKE '%former postdocs (including joint)%'
 OR lower(o.tool_output) LIKE '%postdoctoral alumni%'
 OR lower(o.tool_output) LIKE '%postdoctoral/sabbatical scholars advised by%'
 OR lower(o.tool_output) GLOB '*supervised [0-9]*phd students:*'
 OR lower(o.tool_output) LIKE '%postdoctoral supervisor of %'
 OR lower(o.tool_output) LIKE '%thesis advisor of:%'
 OR lower(o.tool_output) LIKE '%graduate students supervised%'
 OR lower(o.tool_output) LIKE '%degree%students%supervised:%'
 OR lower(o.tool_output) LIKE '%doctoral thesis titles for students supervised%'
 OR lower(o.tool_output) LIKE '%postdoctoral associates mentored%'
 OR lower(o.tool_output) LIKE '%past ph.d. students and postdoctoral fellows%'
 OR lower(o.tool_output) LIKE '%former postdoctoral associates%'
 OR (p.url LIKE 'https://bsac.berkeley.edu/%' AND lower(o.tool_output) LIKE '%(advisor)%')
 OR (lower(o.tool_output) LIKE '%academic title%' AND lower(o.tool_output) LIKE '%research group%')
 OR lower(o.tool_output) LIKE '%### past postdocs%')`).all();
const rejectedIdentities=new Set(db.prepare(`
 SELECT record_id,url FROM pages WHERE state='excluded'
 AND error LIKE '已人工核实属于数据库外其他同名者：%'
 UNION
 SELECT p.record_id,p.url FROM pages p JOIN page_identity_mismatches m ON m.page_id=p.id
`).all().map(p=>p.record_id+'\n'+p.url));
const hasListReviews=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cross_list_reviews'").get();
const reviewedLists=new Map((hasListReviews?db.prepare('SELECT record_id,url,stage,reviewed_at FROM cross_list_reviews').all():[]).map(x=>[[x.record_id,x.stage,x.url].join('\n'),x.reviewed_at]));
db.close();
const byid=new Map(people.map(x=>[x.id,x]));
const nameWithoutQualifier = name => name.split('—',1)[0]
 .replace(/\([^)]*\)|（[^）]*）|“[^”]*”/g,' ').replace(/\s+/g,' ').trim();
const targets=people.map(r=>({...r,plain:nameWithoutQualifier(r.name)})).filter(r=>/^([A-Za-z]+ ){1,2}[A-Za-z]+$/.test(r.plain)&&r.plain.length>9);
const safe=s=>String(s||'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已省略]').replace(/(?:\+?\d{1,3}[ .-]?)?(?:\(\d{3}\)|\b\d{3})[ .-]\d{3}[ .-]\d{4}\b/g,'[电话已省略]').replace(/\b(?:was born|born on|date of birth)\b[^.\n]*/gi,'[出生信息已省略]').replace(/[\r\n\t|]+/g,' ').replace(/\s+/g,' ').trim();
const unique=new Map();for(const p of pages){const owner=byid.get(p.record_id);if(!owner)continue;const lower=p.excerpt.toLowerCase();for(const t of targets){if(t.id===p.record_id||rejectedIdentities.has(t.id+'\n'+p.url))continue;const i=lower.indexOf(t.plain.toLowerCase());if(i<0)continue;const a=JSON.parse(t.details_json).aspects;if(a.phd.status==='confirmed_advisor'&&a.postdoc.status==='confirmed_advisor')continue;const vicinity=lower.slice(Math.max(0,i-150),i+250);if(!/advisor|adviser|supervisor|mentor/.test(vicinity)||!/ph\.?d|doctoral|thesis|post.?doc/.test(vicinity))continue;const key=[t.id,p.record_id,p.url].join('\n');if(!unique.has(key))unique.set(key,{owner,target:t,url:p.url,retrieved:p.retrieved,excerpt:safe(p.excerpt.slice(Math.max(0,i-150),i+300)).slice(0,450)});}}
const excerptReviewPath=path.join(__dirname,'跨人物摘要人工复核.json');
const excerptReviews=fs.existsSync(excerptReviewPath)?JSON.parse(fs.readFileSync(excerptReviewPath,'utf8')):[];
// 精确绑定已复核的摘录；同一网址后续出现新正文或摘录时应重新进入待核队列。
const reviewedExcerpts=new Set(excerptReviews.filter(x=>typeof x.excerpt==='string'&&x.excerpt).map(x=>JSON.stringify([x.target_id,x.owner_id,x.url,x.excerpt])));
const rows=[...unique.values()].filter(x=>!reviewedExcerpts.has(JSON.stringify([x.target.id,x.owner.id,x.url,x.excerpt]))).sort((a,b)=>a.owner.unit.localeCompare(b.owner.unit)||a.owner.name.localeCompare(b.owner.name)||a.url.localeCompare(b.url));
const headings={
 phd:/^(?:dissertations directed|dissertation supervision|doctoral dissertations supervised(?: over the last \d+ years)?|doctoral thesis titles for students supervised|(?:doctoral|ph\.?d\.?|graduate) students (?:supervised|advised)|ph\.d\. students mentored|former ph\.d\. students|(?:present |current |former )?thesis advisees|ph\.?d\.? advisor:\s*\(total:\s*\d+\))\s*:?$/i,
 postdoc:/^(?:postdoctoral mentoring|post-?doctoral (?:fellows|associates|researchers) (?:supervised|mentored|advised)|post-doctoral students supervised|postdoctoral researchers:\s*\d+\s+completed mentees(?:\s*\(current position\))?|postdoctoral associates and fellows(?: supervised by [\p{L}. -]+)?|past postdocs|(?:present |current |former )?postdoctoral scholar advisees|postdoctoral advisor:\s*\(total:\s*\d+\)|(?:ORNL )?Shull Fellows Supervised)\s*:?$/iu
};
const alumniRoster=/^(?:alumni|former graduate students and postdoctoral associates|past ph\.d\. students and postdoctoral fellows|group alumni and visitors)\s*:?$/i;
const postdocAlumni=/^(?:former postdocs \(including joint\)|postdoctoral alumni|former postdoctoral associates)\s*:?$/i;
const supervisedRoster=/^(?:supervised students and postdocs|students & postdoctoral fellows mentored|degree students supervised)\s*:?$/i;
const supervisedRoles={
 phd:/^(?:(?:student|students|ph\.?d\.? students|doctoral students)\s*:|ph\.?d\.?\s*\(current employment\))\s*$/i,
 postdoc:/^(?:postdocs|postdoctoral (?:fellows|researchers|associates))\s*:\s*$/i
};
const rosterHeadings={
 phd:/^(?:grad|graduate|ph\.d\.) students\s*:\s*$/i,
 postdoc:/^(?:postdocs|postdoctoral associates|postdoctoral fellows)\s*:\s*$/i
};
const normalize=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const listTargets=people.map(r=>{
 const name=normalize(nameWithoutQualifier(r.name));
 const parts=name.match(/\p{L}+/gu)||[];
 const full=parts.join(' ');
 const initial=parts[0]?.[0],surname=parts.at(-1);
 const relations=JSON.parse(r.relation_json);
 const aspects=JSON.parse(r.details_json).aspects;
 const pending={
  phd:aspects.phd?.status!=='confirmed_advisor'||!relations.some(relation=>phdLabel(relation.type)),
  postdoc:aspects.postdoc?.status!=='confirmed_advisor'||!relations.some(relation=>postLabel(relation.type))
 };
 const familyFirst=[surname,...parts.slice(0,-1)].join(' ');
 return {r,full,familyFirst,short:parts.length===3&&parts[1].length===1?parts[0]+' '+surname:full,initial,surname,pending};
}).filter(t=>t.initial&&t.surname.length>1&&t.full.includes(' '));
const listLeads=new Map(),listMatches=new Set();
for(const observation of originalLists){
 const owner=byid.get(observation.record_id);
 if(!owner)continue;
 const bsacDirectory=/^https:\/\/bsac\.berkeley\.edu\/(?:alumni-list|research\/projects\/[^/?]+\/bsac-researchers-advised-[^/?]+)(?:[/?#]|$)/i.test(observation.url);
 let heading,headingLine,stage,previous,groupTable,roster,degreeHeader;
 let degreeLines=[];
 for(const line of observation.tool_output.matchAll(/^L(\d+)(?:@P\d+(?:-\d+)?)?:[^\S\r\n]*(.*)$/gm)){
  const lineNumber=Number(line[1]);
  const content=safe(line[2].replace(/<[^>]+>/g,' '));
  const headingText=content.replace(/^(?:#{1,6}|[•*])\s+/,'').replace(/^(?:[a-z]\.|\d+[.)])\s+/i,'').replace(/^\*\*(.*?)\*\*$/,'$1');
  if(previous!==undefined&&(lineNumber<=previous||lineNumber-previous>4)){
   stage=undefined;
   groupTable=undefined;
   roster=undefined;
   degreeHeader=undefined;
   degreeLines=[];
  }
  previous=lineNumber;
  const cells=line[2].split('|').map(cell=>cell.trim());
  if(bsacDirectory && cells.length>=2 && /\(Advisor\)/i.test(cells[1])){
   const names=cells[0].replace(/【\d+†([^†】]+)(?:†[^】]+)?】/g,'$1');
   const name=normalize(names).match(/\p{L}+/gu)?.join(' ');
   const stages=[];
   if(/\bPh\.?\s*D\.?(?=\s|,|$)/i.test(cells[1]))stages.push('phd');
   if(/\bpost[ -]?doc(?:toral)?\b/i.test(cells[1]))stages.push('postdoc');
   for(const t of listTargets){
    if(t.full!==name||rejectedIdentities.has(t.r.id+'\n'+observation.url))continue;
    for(const listedStage of stages){
     const key=[t.r.id,listedStage,observation.url].join('\n');
     listMatches.add(key);
     const reviewedAt=reviewedLists.get(key);
     if(reviewedAt&&observation.retrieved<=reviewedAt)continue;
     if(!t.pending[listedStage]||listLeads.has(key))continue;
     listLeads.set(key,{owner,target:t.r,stage:listedStage,heading:'BSAC Advisor 名册',lineNumber,
      content:safe(names+' — '+cells[1]),url:observation.url,full:true});
    }
   }
   continue;
  }
  if(cells[0]==='Name'&&cells.includes('Academic Title')&&cells.includes('Research Group')){
   groupTable={width:cells.length,title:cells.indexOf('Academic Title'),group:cells.indexOf('Research Group')};
   heading='Research Group（组属）';
   headingLine=lineNumber;
   stage=undefined;
   continue;
  }
  let tableStage,tableName,degreeExcerpt;
  if(groupTable){
   if(cells.length!==groupTable.width) groupTable=undefined;
   else {
    if(!cells[groupTable.group])continue;
    const title=cells[groupTable.title];
    if(/\bpost[ -]?doc/i.test(title))tableStage='postdoc';
    else if(/\b(?:ph\.?d\.?|doctoral) student\b/i.test(title))tableStage='phd';
    if(!tableStage)continue;
    const name=cells[0].replace(/【\d+†([^】]+)】/g,'$1');
    const [family,given]=name.split(',').map(part=>part.trim());
    tableName=given?`${given} ${family}`:name;
   }
  }
  const rosterTitle=headingText.replace(/^[IVXLCDM]+\.\s+/i,'');
  // Harvard 托管的 Sachdev CV 有单独的 Postdocs 标题；名单仅证明所列阶段和组属，不能自动推断正式导师。
  if(/^https:\/\/sachdev\.physics\.harvard\.edu\/.*\/cv\.pdf(?:[?#]|$)/i.test(observation.url)&&/^postdocs\s*:?$/i.test(rosterTitle)){
   heading='Sachdev CV Postdocs（组属）';headingLine=lineNumber;stage='postdoc';continue;
  }
  if(/^past and present postdoctoral\/sabbatical scholars advised by\s+\p{L}/iu.test(rosterTitle)){
   roster='mixedAdvising';
   heading=rosterTitle+'（博士后与访问混列，阶段待核）';
   headingLine=lineNumber;
   stage=undefined;
   continue;
  }
  if(roster==='mixedAdvising'&&cells.length>=3&&/^\d+$/.test(cells[0])&&cells[1]){
   tableName=cells[1];
   tableStage='postdoc';
  }
  const inlineDoctoral=content.match(/^Supervised\s+\d+\s+Ph\.?D\.?\s+students\s*:\s*(.+)$/i);
  const inlinePostdoc=content.match(/\bPostdoctoral supervisor of\s+(?:Dr\.\s+)?([\p{L}.'’-]+(?:\s+[\p{L}.'’-]+){1,4})\.(?:\s|$)/iu);
  if(inlineDoctoral||inlinePostdoc){
   roster='inlineAdvising';
   stage=undefined;
   heading=inlineDoctoral?'Supervised PhD students':'Postdoctoral supervisor';
   headingLine=lineNumber;
   tableName=inlineDoctoral?.[1]??inlinePostdoc[1];
   tableStage=inlineDoctoral?'phd':'postdoc';
  }
  const inlineAdvising=content.match(/\bthesis advisor of:\s*(.*)$/i);
  if(inlineAdvising){
   roster='inlinePhd';
   heading='Thesis advisor of';
   headingLine=lineNumber;
   stage='phd';
   tableName=inlineAdvising[1];
  }else if(roster==='inlinePhd'&&/^(?:four|\d+|these)\b[^.;]*\b(?:former|students)\b/i.test(headingText)){
   roster=undefined;
   stage=undefined;
  }
  if(/^graduate students supervised\s*:?$/i.test(rosterTitle)){
   degreeHeader=lineNumber;
   degreeLines=[];
  }else if(degreeHeader!==undefined&&lineNumber-degreeHeader<=150){
   if(/^ph\.?d\.?$/i.test(content)&&/^(?:co\.?|main\.?|sole\.?)$/i.test(degreeLines.at(-1)||'')){
    tableName=degreeLines.at(-3);
    if(tableName) {
     tableStage='phd';
     heading='Graduate students supervised（博士及具名指导角色）';
     degreeExcerpt=[...degreeLines,content].join(' | ');
    }
   }
   if(content)degreeLines=[...degreeLines.slice(-2),content];
  }
  if(supervisedRoster.test(rosterTitle)){
   roster='supervised';
   heading=headingText;
   headingLine=lineNumber;
   stage=undefined;
   continue;
  }
  if(postdocAlumni.test(rosterTitle)){
   roster='postdocAlumni';
   heading=headingText+'（组属）';
   headingLine=lineNumber;
   stage='postdoc';
   continue;
  }
  if(alumniRoster.test(rosterTitle)){
   roster='alumni';
   stage=undefined;
   continue;
  }
  const detected=Object.keys(headings).find(key=>headings[key].test(headingText)||
   (roster==='alumni'&&rosterHeadings[key].test(headingText))||
   (roster==='supervised'&&supervisedRoles[key].test(headingText)));
  if(detected){heading=headingText;headingLine=lineNumber;stage=detected;continue;}
  if(roster&&/^(?:(?:undergrads|undergraduates|visitors)\s*:|(?:m\.?s(?:c)?\.?|masters?)(?:\s+(?:students|\(current employment\)))?\s*:?)\s*$/i.test(headingText)){
   stage=undefined;
   roster=undefined;
   continue;
  }
  if(/^#{1,6}\s/.test(content)||/^(?:[a-z]\.|\d+[.)])\s+[A-Z][a-z]+(?:\s+[A-Za-z -]+){1,6}\s*:?$/.test(content)||/^(?:current|former)\b[^:]+:\s*(?:\(total:\s*\d+\))?$/i.test(headingText)||/^(?:invited (?:lectures|presentations)|publications|teaching|professional experience|research interests)\s*(?::.*)?$/i.test(headingText)){
   stage=undefined;
   roster=undefined;
  }
  if(roster==='supervised'&&!stage&&lineNumber-headingLine<=45){
   const inline=content.match(/^([^,]+),\s*(post-?doc(?:toral (?:researcher|fellow|associate))?|ph\.?d\.? student|doctoral student)\s*,/i);
   if(inline){
    tableName=inline[1].trim();
    tableStage=/^post/i.test(inline[2])?'postdoc':'phd';
   }
  }
  const relationStage=tableStage||stage;
  if(!relationStage||!content||(!tableStage&&lineNumber-headingLine>(roster==='postdocAlumni'?400:45)))continue;
  // 页面页眉可能重复作者姓名，不能把 CV 的作者匹配为自己的博士生或博士后。
  if(/\bcurriculum vitae\b/i.test(content))continue;
  if(roster==='postdocAlumni'&&!/^[\p{L}][\p{L}.'’-]*(?:\s+[\p{L}][\p{L}.'’-]*){1,5}$/u.test(content))continue;
  const names=(tableName??content).replace(/\([^)]*\)/g,' ').replace(/https?:\/\/\S+/gi,' ');
  const tokens=normalize(names).match(/\p{L}+/gu)||[];
  const words=' '+tokens.join(' ')+' ';
  for(const t of listTargets){
   if(rejectedIdentities.has(t.r.id+'\n'+observation.url))continue;
   const full=tableName&&!['inlinePhd','inlineAdvising'].includes(roster)?(words===' '+t.full+' '||Boolean(degreeExcerpt&&words===' '+t.familyFirst+' ')):
    words.includes(' '+t.full+' ')||words.includes(' '+t.short+' ');
   const hasListContext=roster==='inlinePhd'?/\([^)]*\)/.test(content):/\b(?:19|20)\d{2}\b/.test(content);
   const initialed=(!tableName||roster==='inlinePhd')&&!full&&hasListContext&&tokens.some((word,i)=>word===t.surname&&(
    tokens[i-1]===t.initial||(tokens[i-1]?.length===1&&tokens[i-2]===t.initial)));
   if(!full&&!initialed)continue;
   const key=[t.r.id,relationStage,observation.url].join('\n');
   listMatches.add(key);
   // 先前的人工判断只覆盖当时已经保存的原文；后续新观察必须重新核对。
   const reviewedAt=reviewedLists.get(key);
   if(reviewedAt&&observation.retrieved<=reviewedAt)continue;
   if(!t.pending[relationStage])continue;
   const old=listLeads.get(key);
   if(!old||full&&!old.full){
    const normalized=normalize(content),nameStart=Math.max(normalized.indexOf(t.full),normalized.indexOf(t.short));
    const start=Math.max(0,nameStart-50);
    const excerpt=degreeExcerpt??content.slice(start,start+350);
    listLeads.set(key,{owner,target:t.r,stage:relationStage,heading,lineNumber,content:excerpt,url:observation.url,full});
   }
  }
 }
}
let out=`# 已读页面跨人物候选（待核）\n\n[[已读页面中的导师线索（待逐条核实）|同人物页面线索]] · [[师承待查名单（按最新人工事件）|待查名单]]\n\n生成时间：${new Date().toISOString()}。在 ${pages.length} 条含 advisor 的已读页面摘录中，按其他校属记录姓名及阶段词语发现 ${rows.length} 条交叉线索；已对相同人物、页面任务及网址去重。这不是新的网页读取。页面任务挂载的人并不一定是文档作者；提到的另一人也可能是学生、委员会成员或同名者。摘录可能拼接不同段落，必须核对完整原文、作者、阶段与时间，不能自动创建师承关系。仅扫描名字可直接匹配的部分人物和已读摘录，遗漏不代表没有关系。\n\n`;
for(const r of rows)out+=`- 来源任务：[[${r.owner.filename}|${safe(r.owner.name)}]]（${safe(r.owner.unit)}）；文中匹配：[[${r.target.filename}|${safe(r.target.name)}]]（${safe(r.target.unit)}）。[已读页面](${r.url})；保存片段：${r.excerpt}\n`;
out+=`\n## 原文中的指导名单\n\n从 ${originalLists.length} 份原文观察筛出 ${listLeads.size} 条待核线索。每条按学位阶段及网址去重。人名首字母匹配须检查学校、毕业年份和去向。来源任务所挂人物可能只是名单中的某一位，导师姓名须核对原文作者。课题组校友名单仅支持核查组属，具体指导关系须另查具名原档。\n\n`;
for(const r of listLeads.values())out+=`- [[${r.target.filename}|${safe(r.target.name)}]]（${r.stage==='phd'?'博士':'博士后'}，${r.full?'全名匹配':'姓名缩写匹配'}）。来源任务 [[${r.owner.filename}|${safe(r.owner.name)}]]，${r.heading}，原文第 ${r.lineNumber} 行。${r.content} [已读原文](${r.url})\n`;
const target=path.join(root,'已读页面跨人物候选（待核）.md');fs.writeFileSync(target,out,'utf8');console.log(JSON.stringify({target,pages:pages.length,matches:rows.length,source_records:new Set(rows.map(x=>x.owner.id)).size,original_list_observations:originalLists.length,original_list_name_matches:listMatches.size,original_list_pending:listLeads.size}));
