// 只列可识别师承行在人物页或索引缺失的候选，不自动更改事实。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const people=db.prepare('select id,name,unit,filename from records').all();db.close();
const byName=new Map(people.map(x=>[x.filename,x])),key=(p,s,m)=>JSON.stringify([p,s,m]);
function stage(label){
 // 明确指向学生、博士后或前组员的反向标签不应被识别为“本人的导师”。
 // 方向模糊的候选关系仍保留在待核提示中，避免静默排除真正缺边。
 if(!/博士/.test(label)||/博士毕业后|反向|导师候选对应|博士论文相关人员|博士生|受指导者|前研究生组成员|博士后(?:研究者|研究人员|研究成员|研究助理|课题组(?:候选)?成员)/.test(label))return null;
 if(!/导师|师长|负责人|接收教师|联合指导|研究指导|日常指导|课题组关系|所在课题组|候选.*(?:关系|线索|课题组)/.test(label)&&!/博士(?:后)?(?:课题组(?:候选)?|候选|阶段候选)$/.test(label))return null;
 return /博士后/.test(label)?'博士后':'博士';
}
function add(map,p,s,m,line,n,filename){const k=key(p,s,m);if(!map.has(k))map.set(k,{person:p,stage:s,mentor:m,lines:[]});map.get(k).lines.push(filename?{line,n,filename}:{line,n});}
function targets(text){const out=[];let rest=text.trimStart();while(true){const m=rest.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);if(!m)break;out.push(m[1]);rest=rest.slice(m[0].length);const separator=rest.match(/^\s*(?:（[^）]*）|\([^)]*\))?\s*(?:[、，,]|以及|及|和)\s*(?=\[\[)/);if(!separator)break;rest=rest.slice(separator[0].length)}return out;}
const notes=new Map(),index=new Map(),missingFiles=[];
for(const r of people){const f=path.join(root,'人物',r.filename+'.md');if(!fs.existsSync(f)){missingFiles.push(r.filename);continue}const body=fs.readFileSync(f,'utf8').replace(/<!-- PI-AUTO-SEARCH:START -->[\s\S]*?<!-- PI-AUTO-SEARCH:END -->/g,'');const sections=[...body.matchAll(/(?:^|\n)## (师承|师承候选线索|师承候选|博士阶段候选线索|博士后阶段候选线索)\s*\r?\n([\s\S]*?)(?=\r?\n## |$)/g)];
 for(const section of sections)for(const [i,line] of section[2].split(/\r?\n/).entries()){
  if(!line.startsWith('- '))continue;
  // Custom stage sections use exactly "待核 [[person]]：..."; other lines may describe
  // a trainee in the reverse direction and must not inherit the section heading.
  if(/^博士(?:后)?阶段候选线索$/.test(section[1])){const x=line.match(/^- 待核\s+(\[\[[^\]]+\]\])\s*[：:]/);if(x){const s=section[1].startsWith('博士后')?'博士后':'博士';for(const t of targets(x[1]))add(notes,r.filename,s,t,line,i+1)}continue;}
  let previousStage=null,previousClause='';for(const clause of line.slice(2).split(/[；;]/)){
   const m=clause.trim().match(/^([^：:]{1,120})[：:]\s*(\[\[.*)$/);let s=m?stage(m[1]):null,target=m?.[2];
   if(!m&&previousStage&&/(?:\]\]|[）)]|\d{4}[-–—]\d{4}[^。；]*)\s*$/.test(previousClause)&&/^\s*\[\[/.test(clause)){s=previousStage;target=clause.trimStart();}
   if(s&&target){for(const t of targets(target))add(notes,r.filename,s,t,line,i+1);previousStage=s;}else previousStage=null;previousClause=clause;
  }
 }}
const indexFiles=['师承关系索引.md','师承候选线索索引.md'];
for(const filename of indexFiles)for(const [i,line] of fs.readFileSync(path.join(root,filename),'utf8').split(/\r?\n/).entries()){const m=line.match(/^- (.*?)\s*→\s*(.*)$/);if(!m)continue;const persons=[...m[1].matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map(x=>x[1]).filter(x=>byName.has(x));let previousStage=null,previousClause='';for(const clause of m[2].split(/[；;]/)){const c=clause.match(/^\s*([^：:。.!！?？\[\]]{1,120}?)(?:[：:]\s*|\s+)(\[\[.*)$/);let s=c?stage(c[1]):null,body=c?.[2];
 // A semicolon can separate location-specific mentors under the same stage,
 // e.g. "mentor: [[A]]（MIT）；[[B]]（Argonne）".  Do not carry a stage
 // across prose or a completed sentence, and never interpret non-wikilinks.
 if(!c&&previousStage&&/(?:\]\]|[）)])\s*$/.test(previousClause)&&/^\s*\[\[/.test(clause)){s=previousStage;body=clause.trimStart();}
 if(s&&body){for(const p of persons)for(const t of targets(body))add(index,p,s,t,line,i+1,filename);previousStage=s;}else previousStage=null;previousClause=clause;}}
const difference=(from,to)=>[...from.entries()].filter(([k])=>!to.has(k)).map(([,x])=>({...byName.get(x.person),...x})).sort((a,b)=>a.unit.localeCompare(b.unit)||a.name.localeCompare(b.name));
const missingIndex=difference(notes,index),missingPerson=difference(index,notes),data={generated:new Date().toISOString(),warning:'有限规则比较直接列出的目标；候选段落、别名、反向边和特殊格式可能造成误报或漏报。差异不等于事实错误，需人工核对；索引行号为各索引的文件行，人物行号为师承段内行。',records:people.length,missingFiles,noteKeys:notes.size,indexKeys:index.size,missingIndex,missingPerson};
const target=path.join(__dirname,'人物与索引缺边待核.json');fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n','utf8');
let md=`# 人物与师承索引缺边待核\n\n[[PI关系图总入口|返回图谱]] · [[师承关系索引|师承索引]] · [[师承候选线索索引|候选索引]]\n\n生成时间：${data.generated}。扫描 ${data.records} 条校属记录，缺失人物文件 ${missingFiles.length} 个。${data.warning}\n\n以下是启发式提示，不代表这些关系确实缺失，也不代表关系真实：同一人物别名、同一行多阶段、方向不明或候选关系都需人工核对。不得批量自动补边。\n`;
for(const [title,rows] of [['人物页有但索引未识别',missingIndex],['索引有但人物页未识别',missingPerson]]){md+=`\n## ${title}（${rows.length} 条提示）\n\n`;for(const r of rows)md+=`- [[${r.filename}|${r.name}]]（${r.unit}；${r.stage}）→ [[${r.mentor}]]。${r.lines[0].line.replace(/\r/g,'').replace(/^- /,'')}\n`}
fs.writeFileSync(path.join(root,'人物与师承索引缺边待核.md'),md,'utf8');
console.log(JSON.stringify({target,records:people.length,missingFiles:missingFiles.length,noteKeys:notes.size,indexKeys:index.size,missingIndex:missingIndex.length,missingPerson:missingPerson.length,examples:missingIndex.slice(0,12)},null,2));
