// 只生成候选复核清单。姓名缩写可能同名；混列硕士与博士，禁止据此自动写入关系。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(__dirname,'SSRL1989论文目录文本摘录.json'),'utf8'));
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const persons=db.prepare('select id,name,unit,filename from records order by unit,name').all();db.close();
const normal=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=s=>String(s).replace(/[\r\n|]/g,' ');
const indexed=persons.flatMap(p=>{const name=p.name.replace(/[（(].*?[）)]/g,' ').split(/[—：]/)[0].replace(/\b(jr|sr|iii|ii)\.?\b/ig,' ').trim();const words=normal(name).match(/[a-z]+(?:['-][a-z]+)*/g)||[];return words.length<2?[]:[{...p,first:words[0][0],surname:words.at(-1)}]});
const lines=data.lines, matches=[],seen=new Set();let year='';
for(let i=0;i<lines.length;i++){
 const line=lines[i][1].trim();if(/^(19\d\d|20\d\d)$/.test(line)){year=line;continue}if(!/\badvisors?\s*[-:]/i.test(line))continue;
 const ctx=lines.slice(Math.max(0,i-9),i+1);let author;
 for(let j=ctx.length-2;j>=0;j--){const m=ctx[j][1].trim().match(/^-?\s*((?:[A-Z]\s*\.\s*[-–]?\s*){1,4})\s*([A-Z][a-z]+(?:[-'][A-Za-z]+)*)(?:,?\s+Jr\.?)?(?:\s|—|$)/);if(m){author={initial:m[1].match(/[A-Z]/)?.[0]?.toLowerCase(),surname:normal(m[2]),line:ctx[j][0],raw:ctx[j][1].trim()};break}}
 if(!author)continue;const people=indexed.filter(p=>p.surname===author.surname&&p.first===author.initial);
 for(const p of people){const key=[p.id,author.line].join(':');if(seen.has(key))continue;seen.add(key);matches.push({record_id:p.id,name:p.name,unit:p.unit,filename:p.filename,source_year:year,source_author:author.raw,source_lines:[author.line,lines[i][0]],excerpt:lines.filter(([n])=>n>=author.line&&n<=lines[i][0]).map(x=>x[1]).join(' ').replace(/\s+/g,' ').trim(),source:data.source})}
}
// 人工判别独立保存；重新生成候选不会丢失既有核查或自动创建关系。
const reviewPath=path.join(__dirname,'SSRL1989人工判别.json');
const reviews=fs.existsSync(reviewPath)?JSON.parse(fs.readFileSync(reviewPath,'utf8')):[];
const reviewByKey=new Map();
for(const r of reviews){
 const key=`${r.record_id}:${r.source_line}`;
 if(reviewByKey.has(key)||!['excluded_identity','identity_match','identity_unresolved'].includes(r.decision)||typeof r.evidence!=='string'||r.evidence.length<12||!Array.isArray(r.sources)||!r.sources.length||r.sources.some(s=>!/^https?:\/\//i.test(s))) throw Error(`人工判别无效或重复：${key}`);
 reviewByKey.set(key,r);
}
for(const m of matches){const key=`${m.record_id}:${m.source_lines[0]}`;m.review=reviewByKey.get(key)||null;reviewByKey.delete(key)}
if(reviewByKey.size)throw Error(`人工判别找不到对应候选，拒绝覆盖报告：${[...reviewByKey.keys()].join(', ')}`);
const resolved=matches.filter(m=>m.review&&m.review.decision!=='identity_unresolved');
const unresolved=matches.filter(m=>!m.review||m.review.decision==='identity_unresolved');
const output={generated:new Date().toISOString(),warning:'按姓氏和首字母机械匹配，仅供人工核验；可能同名、错配、硕士论文或现有记录。不得据此自动创建导师关系。',records:persons.length,source:data.source,matched:matches.length,reviewed:resolved.length,unreviewed:unresolved.length,inspected_unresolved:unresolved.filter(m=>m.review).length,matches};
fs.writeFileSync(path.join(__dirname,'SSRL1989名录待核候选.json'),JSON.stringify(output,null,2)+'\n');
let report='# SSRL 论文名录与人物记录：待核候选\n\n> [!warning] 姓氏与首字母匹配只能产生线索。报告混列硕士和博士论文；必须核对原始论文、完整姓名、学校、年份及学位类型，才能记录师承。\n\n';
report+=`生成时间：${output.generated}；校属记录 ${persons.length} 条，机械匹配 ${matches.length} 条，其中待人工判断 ${output.unreviewed} 条、已保存判断 ${output.reviewed} 条。来源：[1989 年 SSRL 活动报告论文目录](${data.source})。人工判断仅针对该条匹配，排除错误匹配不代表此人没有博士导师；人物对应也不自动证实学位类型或导师关系。\n\n`;
for(const [heading,items] of [['尚待人工判断或进一步核实',unresolved],['已保存人工判断',resolved]]){
 report+=`## ${heading}（${items.length} 条）\n\n`;
 for(const m of items){
  report+=`- [[${m.filename}|${esc(m.name)}]]（${esc(m.unit)}）：${esc(m.excerpt)}；来源行 ${m.source_lines.join('–')}，目录年份 ${m.source_year||'待核'}。`;
  if(m.review)report+=` **${{excluded_identity:'排除该人物匹配',identity_match:'人物匹配，学位和关系仍须分别核实',identity_unresolved:'已检查，身份仍未确定'}[m.review.decision]}**：${esc(m.review.evidence)} ${m.review.sources.map((s,i)=>`[核查来源 ${i+1}](${s})`).join('；')}。`;
  report+='\n';
 }
 report+='\n';
}
fs.writeFileSync(path.join(root,'SSRL论文目录交叉匹配待核.md'),report,'utf8');
console.log(JSON.stringify({records:persons.length,candidates:matches.length,reviewed:output.reviewed,unreviewed:output.unreviewed,inspected_unresolved:output.inspected_unresolved,report:path.join(root,'SSRL论文目录交叉匹配待核.md')}));
