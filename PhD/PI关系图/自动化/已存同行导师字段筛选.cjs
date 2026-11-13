// 从缓存原文筛选同一行的人名和 Advisor 字段；结果只能作为人工追查线索。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const people=db.prepare('SELECT id,name,unit,filename FROM records').all().map(r=>{
 const n=r.name.replace(/（.*|\(.*|\s*[—–].*/,'').trim().split(/\s+/);
 return {...r,first:n[0],last:n.at(-1)};
}).filter(r=>r.first?.length>2&&r.last?.length>2&&/^[A-Za-z'-]+$/.test(r.first)&&/^[A-Za-z'-]+$/.test(r.last));
const pages=db.prepare(`SELECT DISTINCT p.url,o.tool_output FROM pages p JOIN page_observations o ON o.page_id=p.id
 WHERE p.state='done' AND o.tool_output LIKE '%Advisor:%' AND length(o.tool_output)<100000`).all();
const leads=new Map();
for(const page of pages)for(const line of page.tool_output.split('\n')){
 const m=line.match(/^L\d+(?:@P\d+)?:\s*(.*?)\s+Advisor:\s*([^|;]+)/i);
 if(!m||m[1].length>160)continue;
 for(const r of people){
  const re=new RegExp('\\b'+r.first+'\\s+(?:[A-Z]\\.?\\s+)?'+r.last+'\\b','i');
  if(!re.test(m[1]))continue;
  const key=[r.id,page.url,line].join('\n');if(leads.has(key))continue;
  leads.set(key,{...r,url:page.url,evidence:line.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已省略]').slice(0,600)});
 }
}
db.close();
const reviewPath=path.join(__dirname,'同行导师字段人工复核.json');
const reviews=fs.existsSync(reviewPath)?JSON.parse(fs.readFileSync(reviewPath,'utf8')):[];
const reviewed=new Map(reviews.map(r=>[JSON.stringify([r.id,r.url,r.evidence]),r]));
const pending=[...leads.values()].filter(x=>!reviewed.has(JSON.stringify([x.id,x.url,x.evidence])));
let out='# 已存同一行 Advisor 字段候选（待核）\n\n[[PI关系图总入口|返回图谱]]\n\n';
out+=`从 ${pages.length} 份已存原文中筛得 ${leads.size} 条姓名与 Advisor 字段同一行的提示，其中 ${pending.length} 条待核。仅根据姓名匹配，导师的指向、学位阶段、身份及来源可靠性均须人工核对；姓名相同不代表同一人。已复核记录保存在自动化目录，不会因重复扫描丢失。\n\n`;
for(const x of pending)out+=`- [[${x.filename}|${x.name}]]（${x.unit}）· [原文](${x.url})：${x.evidence.replaceAll('|','／')}\n`;
const target=path.join(root,'已存同一行导师字段候选（待核）.md');fs.writeFileSync(target,out,'utf8');
console.log(JSON.stringify({pages:pages.length,candidates:leads.size,pending:pending.length,target,...(process.argv.includes('--json')?{items:pending}: {})}));
