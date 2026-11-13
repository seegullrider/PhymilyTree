// 只同步图谱总入口各校记录数；不新增、删除或合并人物，不推断学校收录完整性。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
db.exec('BEGIN');const rows=db.prepare('SELECT unit,count(*) AS n FROM records GROUP BY unit ORDER BY unit').all();db.exec('COMMIT');db.close();
const counts=new Map(rows.map(r=>[r.unit,r.n])),f=path.join(root,'PI关系图总入口.md'),original=fs.readFileSync(f,'utf8');
const start=original.indexOf('## 学校与研究机构'),end=original.indexOf('\n## 院系候选',start);if(start<0||end<0)throw Error('未找到学校列表边界');
const before=original.slice(0,start),section=original.slice(start,end),after=original.slice(end),seen=new Set();let changed=0;
let lines=section.split(/\r?\n/).map(line=>{
 const m=line.match(/^- \[\[院校 - ([^|\]]+)\|[^\]]+\]\]（(.*)）$/);if(!m)return line;
 const unit=m[1];if(!counts.has(unit))throw Error('列表中的学校不在队列：'+unit);if(seen.has(unit))throw Error('学校重复：'+unit);seen.add(unit);
 const n=counts.get(unit),body=m[2],updated=/\d+ 条(?:校属)?记录/.test(body)?body.replace(/\d+ 条(?:校属)?记录/,`${n} 条记录`):`${body}；${n} 条记录`;
 if(updated!==body)changed++;return line.slice(0,line.length-body.length-1)+updated+'）';
});
const missing=rows.filter(r=>!seen.has(r.unit));if(missing.length)throw Error('总入口缺少学校：'+missing.map(x=>x.unit).join('、'));
const marker='<!-- PI-SCHOOL-COUNT:START -->',endMarker='<!-- PI-SCHOOL-COUNT:END -->';let updatedSection=lines.join('\n');
const description=`${marker}\n学校数字按 SQLite 队列统计校属记录；跨校同一人可能重复，不代表独立人数或学校已查全。详见 [[人工核查台账进度|最新逐校进度]]。\n${endMarker}`;
if(updatedSection.includes(marker)){const a=updatedSection.indexOf(marker),b=updatedSection.indexOf(endMarker,a);if(b<0)throw Error('计数说明标记不完整');updatedSection=updatedSection.slice(0,a)+description+updatedSection.slice(b+endMarker.length)}
else updatedSection=updatedSection.replace('## 学校与研究机构','## 学校与研究机构\n\n'+description);
const result=before+updatedSection+after;if(result!==original)fs.writeFileSync(f,result,'utf8');
console.log(JSON.stringify({schools:seen.size,total_records:rows.reduce((a,r)=>a+r.n,0),counts_changed:changed,target:f}));
