// Compare a directly read Stanford doctoral directory against local school records.
// Name matches are leads only; identity, year and adviser require human verification.
const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const source='https://web.stanford.edu/group/swain/history/mosher/degrees.html';
const input=process.argv[2]||path.join(__dirname,'Stanford化学博士目录-801-1167-20261107.txt');
const output=process.argv[3]||path.join(__dirname,'Stanford化学博士目录匹配候选-20261107.json');
const raw=fs.readFileSync(input,'utf8').split(/\r?\n/),lines=new Map();
for(const x of raw){const m=x.match(/^L(\d+): ?(.*)$/);if(m)lines.set(+m[1],m[2])}
const missing=[];for(let n=801;n<=1167;n++)if(!lines.has(n))missing.push(n);
if(missing.length)throw Error('博士目录不完整，缺行 '+missing.join(','));
if(!lines.get(803).includes('Adviser'))throw Error('目录列标题不符');
const norm=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const records=db.prepare(`select r.id,r.name,r.unit,r.filename,a.details_json from records r join manual_audit_events a on a.audit_id=(select x.audit_id from manual_audit_events x where x.record_id=r.id order by x.recorded_at desc,x.rowid desc limit 1)`).all().map(x=>({...x,phd_status:JSON.parse(x.details_json).aspects.phd.status}));db.close();
let year=null;const candidates=[];
for(const [number,body] of [...lines].sort((a,b)=>a[0]-b[0])){
 const heading=body.match(/^###\s+(\d{4})/);if(heading){year=+heading[1];continue}if(!year||!body.includes('|'))continue;
 const cells=body.split('|').map(x=>x.trim());for(let i=0;i+1<cells.length;i+=2){const student=cells[i],advisor=cells[i+1];if(!student.includes(',')||!advisor)continue;const [family,given]=student.split(',').map(norm),first=given.split(' ')[0];if(first.length<3||family.length<3)continue;
  for(const r of records){const tokens=norm(r.name.replace(/（.*?）|\(.*?\)|—.*/g,'')).split(' ');if(tokens.length<2||tokens[0]!==first||tokens.at(-1)!==family)continue;const mid=given.split(' ').slice(1),rmid=tokens.slice(1,-1);const mismatch=mid.length&&rmid.length&&mid[0][0]!==rmid[0][0];candidates.push({record_id:r.id,name:r.name,unit:r.unit,filename:r.filename,phd_status:r.phd_status,directory_name:student,directory_adviser:advisor,directory_year:year,source_line:number,middle_initial_conflict:!!mismatch})}
 }
}
fs.writeFileSync(output,JSON.stringify({source,input,line_start:801,line_end:1167,warning:'首末姓名相同仅是线索；须独立核对身份、学位年份、导师全名和其他阶段，不能自动建关系。',candidates},null,2)+'\n');
console.log(JSON.stringify({output,lines:lines.size,candidates:candidates.length,unconfirmed:candidates.filter(x=>x.phd_status!=='confirmed_advisor').length,conflicts:candidates.filter(x=>x.middle_initial_conflict).length}));
