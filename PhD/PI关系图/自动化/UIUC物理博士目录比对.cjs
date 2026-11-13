// 离线比对已直接读取的 Illinois 物理系学位目录；候选须人工核实身份、年份、导师缩写，不写人物页。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=__dirname,parts=['UIUC物理博士目录-原始文本.txt','UIUC物理博士目录-后半原始文本.txt'],lines=new Map();
for(const f of parts)for(const l of fs.readFileSync(path.join(root,f),'utf8').split(/\r?\n/)){const m=l.match(/^L(\d+):\s?(.*)$/);if(!m)continue;const n=+m[1],t=m[2];if(lines.has(n)&&lines.get(n)!==t)throw Error('重叠行内容不同 '+n);lines.set(n,t)}
const missing=[];for(let i=0;i<10805;i++)if(!lines.has(i))missing.push(i);if(missing.length)throw Error('目录不完整，缺失 '+missing.length+' 行，起始 '+missing.slice(0,10));
const db=new DatabaseSync(path.join(root,'检索队列.sqlite'),{readOnly:true});const rows=db.prepare(`select r.id,r.name,r.unit,r.filename,a.details_json from records r left join manual_audit_events a on a.audit_id=(select x.audit_id from manual_audit_events x where x.record_id=r.id order by x.recorded_at desc,x.rowid desc limit 1)`).all();db.close();
const norm=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,' ').trim().replace(/\s+/g,' ');
const clean=s=>s.replace(/[（(].*?[）)]/g,' ').replace(/\s*[—–].*$/,'').replace(/[:：].*$/,'').trim();
// 保留原宽松候选，但说明命中首名、其他全名还是仅其他位置首字母；不能将命中理解为同一人。
function matchBasis(own,given){
 const f=given[0],first=own[0],eq=(a,b)=>a===b||((a.length===1||b.length===1)&&a[0]===b[0]);
 if(first===f)return 'first_name_exact';
 if(first&&eq(first,f))return 'first_initial_only';
 if(own.slice(1).some(x=>x===f))return 'other_given_name_exact';
 if(own.slice(1).some(x=>eq(x,f)))return 'other_initial_only';
 return null;
}
const bySurname=new Map();for(const r of rows){let w=norm(clean(r.name)).split(' ').filter(Boolean);if(w.length<2)continue;let last=w.at(-1);if(!bySurname.has(last))bySurname.set(last,[]);bySurname.get(last).push({...r,tokens:w})}
const matches=[],source='https://research.physics.illinois.edu/Publications/Theses/PhDsThrough2006.htm';
for(let n=0;n<10802;n++){const author=lines.get(n).match(/^([^,]{2,60}),\s+(.{1,100})$/),education=lines.get(n+1),ad=lines.get(n+2)?.match(/^Advisor\s+(.+)$/i);if(!author||!ad||!/UIUC\s+Ph\.D\.\s*\d{4}/i.test(education))continue;
 const last=norm(author[1]).split(' ').at(-1),given=norm(author[2]).split(' ').filter(Boolean),year=education.match(/Ph\.D\.\s*(\d{4})/i)?.[1];if(!last||!given.length)continue;
 for(const r of bySurname.get(last)||[]){const own=r.tokens.slice(0,-1),match_basis=matchBasis(own,given);if(!match_basis)continue;const ev=r.details_json?JSON.parse(r.details_json):null;matches.push({record_id:r.id,name:r.name,unit:r.unit,filename:r.filename,directory_name:author[0],degree_line:education,advisor:ad[1],year,thesis:lines.get(n+4)||'',line:n,match_basis,phd_status:ev?.aspects?.phd?.status||'no_event',phd_note:ev?.aspects?.phd?.note||'',source});}}
const result={generated:new Date().toISOString(),source,total_lines:lines.size,warning:'仅按姓和首名或首字母筛选；match_basis 描述命中依据，other_initial_only 尤易错配。phd_status 是库内人物最新事件状态，不代表目录条目身份已匹配、目录导师已核实或是该人物导师。姓名冲突、跨校重复、导师缩写均须逐人查本人履历及原始目录，不自动认定师承。',matches};
const target=path.join(root,'UIUC物理博士目录匹配候选-20261108.json');fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n','utf8');console.log(JSON.stringify({target,count:matches.length,matches:matches.map(({name,unit,year,advisor,phd_status})=>({name,unit,year,advisor,phd_status}))}));
