// 对直接读取的带行号网页文本和本地记录按首末姓名匹配，仅供人工核验。
const fs = require('fs');
const path = require('path');
const {DatabaseSync} = require('node:sqlite');
const [source, output, ...files] = process.argv.slice(2);
if (!/^https?:\/\//.test(source || '') || !output || !files.length) throw Error('用法：node 课题组成员目录比对.cjs 原网页URL 输出JSON 文本文件...');
const lines = new Map();
for (const f of files) {
  const raw = fs.readFileSync(f,'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m=line.match(/^L(\d+): ?(.*)$/); if(m) lines.set(Number(m[1]),m[2]);
  }
}
const keys=[...lines.keys()].sort((a,b)=>a-b), missing=[];
for(let i=keys[0];i<=keys.at(-1);i++) if(!lines.has(i)) missing.push(i);
const norm=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/（.*?）|\(.*?\)|—.*/g,'').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const records=db.prepare('SELECT id,name,unit,filename FROM records').all();db.close();
const candidates=[];
for(const n of keys) {
  const m=lines.get(n).match(/^\s*\*\s*###\s+(.+)$/); if(!m) continue;
  const listed=m[1].replace(/【\d+†([^†】]+)(?:†[^】]+)?】/g,'$1').trim();
  const parts=norm(listed).split(' '); if(parts.length<2) continue;
  const context=keys.filter(k=>k>n && k<=n+6).map(k=>lines.get(k)).filter(Boolean).join(' ');
  for(const r of records) {
    const p=norm(r.name).split(' '); if(p.length<2 || p[0]!==parts[0] || p.at(-1)!==parts.at(-1))continue;
    candidates.push({record_id:r.id,name:r.name,unit:r.unit,listed_name:listed,source_line:n,context});
  }
}
fs.writeFileSync(output,JSON.stringify({source,warning:'首末姓名匹配仅为线索；必须逐人核对身份、阶段、时间和研究方向，不能自动认定导师。',line_start:keys[0],line_end:keys.at(-1),missing,candidates},null,2)+'\n');
console.log(JSON.stringify({output,line_start:keys[0],line_end:keys.at(-1),missing:missing.length,count:candidates.length,candidates}));
