// 对已直接读取并保存的 Harvard 物理系博士论文目录做离线姓名比对。
// 仅产生线索：姓名可能重合、目录只给导师姓，须逐人核对身份和导师全名。
const fs = require('fs');
const path = require('path');
const {DatabaseSync} = require('node:sqlite');
const directory=process.argv[2],period=process.argv[3]||'2001';
if(!directory||!['1971','2001'].includes(period)){console.error('用法: node Harvard物理学位目录比对.cjs 已保存网页文本目录 [1971|2001]');process.exit(2)}
const source=period==='1971'?'https://www.physics.harvard.edu/academics/phds1971-2000':'https://www.physics.harvard.edu/academics/phds';
const files=fs.readdirSync(directory).filter(x=>(period==='1971'?/^harvard-physics-1971-2000-\d+-20261107\.txt$/:/^harvard-physics-directory-(?:(?:\d+-)?20261107)\.txt$/).test(x));
if(!files.length)throw Error('没有找到直接读取的网页文本');
const lines=new Map();for(const f of files)for(const line of fs.readFileSync(path.join(directory,f),'utf8').split(/\r?\n/)){const m=line.match(/^L(\d+):\s?(.*)$/);if(m&&!lines.has(+m[1]))lines.set(+m[1],m[2]);}
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const rows=db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.details_json FROM records r LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();db.close();
const norm=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,' ').trim();
const key=(first,last)=>norm(first).split(' ')[0]+'|'+norm(last);
const people=new Map();for(const r of rows){let s=r.name.replace(/[（(].*?[）)]/g,'').replace(/\s*[—–]\s*.*$/,'').trim().split(/\s+/);if(s.length<2)continue;const k=key(s[0],s[s.length-1]);if(!people.has(k))people.set(k,[]);people.get(k).push(r)}
let year=null,matches=[],seen=new Set();const sorted=[...lines.entries()].sort((a,b)=>a[0]-b[0]);
for(const [n,line] of sorted){const yr=line.match(/^(?:##\s+)?((?:19|20)\d\d)\s*$/);if(yr){year=yr[1];continue}if(n<(period==='1971'?73:149))continue;
 const author=line.match(/^([A-Za-z][A-Za-z'’\-]+),\s+([A-Za-z][A-Za-z'’\-]+)\b/);if(!author)continue;
 for(const r of people.get(key(author[2],author[1]))||[]){let ident=r.id+'|'+n;if(seen.has(ident))continue;seen.add(ident);let excerpt=[line];for(let i=1;i<=3;i++){const x=lines.get(n+i);if(x===undefined||/^(?:##\s+)?(?:19|20)\d\d\s*$/.test(x)||/^[A-Z][A-Z'\-]+,\s+[A-Z]/.test(x))break;if(x.trim())excerpt.push(x)}
 let status=r.details_json?JSON.parse(r.details_json).aspects.phd.status:'无人工事件';matches.push({record_id:r.id,name:r.name,unit:r.unit,filename:r.filename,year,line:n,directory_entry:excerpt.join(' '),phd_status:status,source});}}
console.log(JSON.stringify({source,files:files.length,line_min:Math.min(...lines.keys()),line_max:Math.max(...lines.keys()),count:matches.length,matches,note:'仅首尾姓名匹配，不代表同一人；导师姓须与原始资料及时间、单位、方向交叉核实。'},null,2));
