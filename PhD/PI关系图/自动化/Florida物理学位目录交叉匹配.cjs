// 从保存的佛罗里达大学物理博士目录摘录产生线索，不修改人物页或台账。
// 相同姓名不是身份确认；作者、学位时间、方向及原网页列标题须人工核对。
const fs = require('fs');
const path = require('path');
const {DatabaseSync} = require('node:sqlite');
const files = [0,1,2,3,4,5].map(i => path.join(__dirname, `Florida物理博士目录-20261108-${i}.txt`));
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), {readOnly:true});
const people = db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.details_json FROM records r
 LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x
 WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();
db.close();
const norm = s => s.normalize('NFKD').replace(/[（(].*?[）)]/g,'').replace(/—.*$/,'')
 .toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const key = s => {const x=norm(s).split(' ').filter(Boolean);return x.length>=2?x[0]+'|'+x.at(-1):'';};
const table = new Map();
for(const p of people){const k=key(p.name);if(k){if(!table.has(k))table.set(k,[]);table.get(k).push(p);}}
const indexedLines=new Map();
for(const file of files)for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
 const m=line.match(/^L(\d+):/);if(m)indexedLines.set(Number(m[1]),line);
}
const rows=[...indexedLines].sort((a,b)=>a[0]-b[0]).map(x=>x[1]), matches=[];
for(const line of rows){const m=line.match(/^L(\d+):\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)\|\s*(.+)$/);if(!m)continue;
 const names=m[2].trim().split(',');if(names.length!==2)continue;
 const directoryName=names[1].trim()+' '+names[0].trim();
 for(const p of table.get(key(directoryName))||[]){let status='no_manual_event';if(p.details_json)status=JSON.parse(p.details_json).aspects.phd.status;
  matches.push({record_id:p.id,name:p.name,unit:p.unit,filename:p.filename,directory_name:directoryName,year:m[3].trim(),column3:m[4].trim(),column4:m[5].trim(),thesis:m[6].trim(),line:Number(m[1]),status});}}
const missing=[];for(let i=30;i<=760;i++)if(!indexedLines.has(i))missing.push(i);
console.log(JSON.stringify({source:'https://phys.ufl.edu/people/alumni/',inputs:files,lines:rows.length,missing_lines_30_to_760:missing,matches,note:'姓名匹配不代表身份或指导关系已确认；目录第三、四列为 Chair、Co-Chair，须核实是否正式导师。'},null,2));
