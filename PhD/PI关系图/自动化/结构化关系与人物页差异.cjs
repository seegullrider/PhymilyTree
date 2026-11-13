// 离线比对人工类型化事件与人物页标签，只生成待核队列；绝不自动更改事实或事件。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const { resolveMentor } = require('./解析师承节点.cjs');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
db.exec('BEGIN');
const rows=db.prepare(`SELECT t.*,r.name,r.unit,r.filename FROM typed_relation_events t JOIN records r ON r.id=t.record_id
 WHERE t.rowid=(SELECT x.rowid FROM typed_relation_events x WHERE x.record_id=t.record_id AND x.stage=t.stage AND x.mentor_filename=t.mentor_filename ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 AND t.kind<>'retracted' ORDER BY r.unit COLLATE NOCASE,r.name COLLATE NOCASE,t.stage,t.mentor_filename`).all();
db.exec('COMMIT');db.close();
function classify(label){
 // 人物页常在阶段前写学校、学位年份；只从第一个“博士”开始识别。
 const offset=label.search(/博士/);if(offset<0)return null;label=label.slice(offset);
 if(/^博士毕业后/.test(label))return null;
 const stage=label.startsWith('博士后')?'postdoc':'phd';
 if(/研究者|研究人员|研究成员|研究助理|课题组成员|候选关联人物|博士生/.test(label))return null;
 const kinds=[];
 if(/课题组负责人／论文导师候选/.test(label))kinds.push('group_leader','candidate');
 else if(/研究项目负责人／导师候选/.test(label))kinds.push('group_leader');
 else if(/阶段研究师长、正式论文导师候选/.test(label))kinds.push('stage_mentor');
 else if(/候选|身份待核|资助／研究关联|合作者|合作／|合作及|博士后(?:阶段)?研究关联者/.test(label))kinds.push('candidate');
 else {
  if(/课题组|组负责人/.test(label))kinds.push('group_leader');
  if(/博士辅助导师|阶段研究师长|研究师长|研究指导|研究联合指导|阶段(?:联合|共同)指导|阶段指导者|阶段导师|研究导师|项目导师|项目接收教师|访学接待师长|^博士后(?:主要接收导师|\s+mentor)$/i.test(label))kinds.push('stage_mentor');
 }
 // 这些标签明确表示论文导师或共同导师；身份限定仍保留在目标节点中。
 if(/^(博士(?:论文|共同)?导师|博士后(?:共同|研究)?导师)(?:（[^）]*）)?$/.test(label))kinds.push('advisor');
 return kinds.length?{stage,kind:kinds[0],kinds}:null;
}
const bodyCache=new Map();function body(filename){if(!bodyCache.has(filename)){const file=path.join(root,'人物',filename+'.md');if(!fs.existsSync(file)){bodyCache.set(filename,null);return null}const s=fs.readFileSync(file,'utf8');let b=s.match(/(?:^|\n)## 师承\s*\r?\n([\s\S]*?)(?=\r?\n## |\r?\n<!-- PI-AUTO-SEARCH:START|$)/)?.[1]||'';
 // 在专门的阶段候选段落中，解析“待核 [[人物]]”行；其他自由文字不推断阶段。
 for(const x of s.matchAll(/(?:^|\n)## (博士后|博士)阶段候选线索\s*\r?\n([\s\S]*?)(?=\r?\n## |\r?\n<!-- PI-AUTO-SEARCH:START|$)/g)){
  for(const l of x[2].split(/\r?\n/)){const hit=l.match(/^- (?:待核 )?(\[\[[^\]]+\]\])[：:](.*)$/);if(hit)b+=`\n- ${x[1]}导师候选：${hit[1]}。${hit[2]}`;}
 }
 // 另一种既有布局明确写出“博士候选／博士后候选”，只读取该标题下带阶段标签的行；
 // 无阶段的自由文本和自动检索摘要不纳入，候选也不能提升为正式导师。
 for(const x of s.matchAll(/(?:^|\n)## 师承候选线索\s*\r?\n([\s\S]*?)(?=\r?\n## |\r?\n<!-- PI-AUTO-SEARCH:START|$)/g)){
  for(const l of x[1].split(/\r?\n/))if(/^- 博士(?:后)?[^：:]*候选[^：:]*[：:]/.test(l))b+='\n'+l;
 }
 bodyCache.set(filename,b)}return bodyCache.get(filename)}
const byPerson = new Map();
for (const indexFile of ['师承关系索引.md', '师承候选线索索引.md']) {
 const candidateIndex = indexFile === '师承候选线索索引.md';
 let sectionStage = null;
 for (const line of fs.readFileSync(path.join(root,indexFile),'utf8').split(/\r?\n/)) {
  if (line.startsWith('## ')) sectionStage = candidateIndex && /^## 博士(?:后)?阶段候选\s*$/.test(line)
   ? (line.startsWith('## 博士后') ? 'postdoc' : 'phd') : null;
  const arrow = line.indexOf(' → ');
  if (!line.startsWith('- [[') || arrow < 0) continue;
  // A single index row may list several trainees with the same mentor and stage.
  const trainees = new Set([...line.slice(0, arrow).matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map(match => match[1]));
  for (const trainee of trainees) {
   const lines = byPerson.get(trainee) || [];
   lines.push({ line, sectionStage, candidateIndex });
   byPerson.set(trainee, lines);
  }
 }
}
const issues=[];
for(const r of rows){const text=body(r.filename), { target: mentorTarget } = resolveMentor(root, r.filename, r.mentor_filename);let matches=[];if(text!==null)for(const line of text.split(/\r?\n/)){
 const m=line.match(/^- ([^：:]+)[：:](.*)$/);if(!m)continue;
 const targets=[...m[2].matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map(x=>x[1]);if(!targets.includes(mentorTarget))continue;
 const role=classify(m[1]);if(role?.stage===r.stage)matches.push({label:m[1],kind:role.kind,kinds:role.kinds,line});
 }
 // 同一个师长可能同时出现在博士和博士后阶段；只接受阶段相同的索引行。
 const indexMatch=(byPerson.get(r.filename)||[]).filter(({ line: s, sectionStage, candidateIndex })=>{
  if (candidateIndex && r.kind !== 'candidate') return false;
  // 先截去人物链接：人物名本身也可能包含分号；各段标签允许学校前缀或省略冒号。
  const arrow=s.indexOf(' → ');if(arrow<0)return false;
  for(const part of s.slice(arrow+3).split(/[；;]/)){
   const start=part.indexOf('[[');if(start<0)continue;
   const label=part.slice(0,start),stage=/博士后|博后/.test(label)?'postdoc':/博士/.test(label)?'phd':sectionStage;
   if(stage!==r.stage)continue;
   if(part.includes('[['+mentorTarget+'|')||part.includes('[['+mentorTarget+']]'))return true;
  }
  return false;
 }).map(entry => entry.line);
 const reasons=[];if(text===null)reasons.push('人物文件缺失');else if(!matches.length)reasons.push('未匹配到同阶段同师长的可识别人物页标签');else if(!matches.some(x=>x.kinds.includes(r.kind)))reasons.push('人物页标签与结构化类型不同');
 if(!indexMatch.length)reasons.push('索引未匹配到相同人物、师长和阶段');
 if(reasons.length)issues.push({record_id:r.record_id,name:r.name,unit:r.unit,filename:r.filename,stage:r.stage,mentor_filename:r.mentor_filename,mentor_target:mentorTarget,typed_kind:r.kind,evidence:r.evidence,sources:JSON.parse(r.sources_json),recorded_at:r.recorded_at,reasons,person_matches:matches,index_matches:indexMatch});
}
const data={generated:new Date().toISOString(),warning:'仅启发式文本比对，混合阶段、非标准标签、别名、多目标行和扩展节点可产生误报；须人工核对原文，不得自动同步或覆盖可靠记录。',typed_relations_scanned:rows.length,issues};
fs.writeFileSync(path.join(__dirname,'结构化关系与人物页差异待核.json'),JSON.stringify(data,null,2)+'\n','utf8');
// 保留 Obsidian wikilink 内的别名分隔符，避免生成不存在的目标节点。
const clean=s=>String(s||'').replace(/[\r\n]+/g,' ');
let out=`# 结构化关系与人物页差异（待核）\n\n生成时间：${data.generated}。扫描 ${rows.length} 条最新有效结构化关系，得到 ${issues.length} 条待核，涉及 ${new Set(issues.map(x=>x.record_id)).size} 条校属记录。${data.warning}\n\n`;
let unit='';for(const x of issues){if(unit!==x.unit){unit=x.unit;out+=`## ${clean(unit)}\n\n`}const mentorLink=x.mentor_target===x.mentor_filename?x.mentor_target:`${x.mentor_target}|${x.mentor_filename}`;out+=`- [[${x.filename}|${clean(x.name)}]] → [[${mentorLink}]]；${x.stage==='phd'?'博士':'博士后'}；结构化类型 ${x.typed_kind}；${x.reasons.join('；')}。\n  - 事件证据：${clean(x.evidence)} ${x.sources.map((u,i)=>`[来源${i+1}](${u})`).join(' ')}\n`;for(const m of x.person_matches)out+=`  - 人物页：${clean(m.line)}\n`;}
const target=path.join(root,'结构化关系与人物页差异（待核）.md');fs.writeFileSync(target,out.trimEnd()+'\n','utf8');
console.log(JSON.stringify({typed:rows.length,issues:issues.length,records:new Set(issues.map(x=>x.record_id)).size,target,first:issues.slice(0,8).map(({person_matches,index_matches,...x})=>x)}));
