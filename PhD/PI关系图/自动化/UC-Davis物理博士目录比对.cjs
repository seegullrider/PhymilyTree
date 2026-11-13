// 学校目录仅用于生成待人工身份核对线索；不自动写入导师关系。
const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const lines=new Map();
for(const n of [200,325,400,600,800]){
 const content=fs.readFileSync(path.join(__dirname,`UC-Davis-物理博士目录-${n}-20261107.txt`),'utf8');
 for(const line of content.split(/\r?\n/)){const m=line.match(/^L(\d+): (.*)$/);if(m)lines.set(Number(m[1]),m[2]);}
}
const gaps=[];for(let n=162;n<=923;n++)if(!lines.has(n))gaps.push(n);
// 空行可能不会出现在网页输出中；只报告缺行，不推定内容已完整覆盖。
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const records=db.prepare('SELECT id,name,unit,filename FROM records').all();db.close();
const norm=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
const out=[];let advisor='';
for(const [number,line] of [...lines.entries()].sort((a,b)=>a[0]-b[0])){
 const h=line.match(/^####\s+(.+)/);if(h){advisor=h[1].trim();continue;}
 const m=line.match(/^\s*\*\s+(.+?)\s+\((?:19|20)\d{2}/);if(!m||!advisor)continue;
 const student=norm(m[1]).split(' ');if(student.length<2)continue;
 for(const r of records){const name=norm(r.name.replace(/（.*?）|\(.*?\)|—.*/g,''));const bits=name.split(' ');if(bits.length<2)continue;
  if(bits[0]===student[0]&&bits[bits.length-1]===student[student.length-1])out.push({record_id:r.id,name:r.name,unit:r.unit,advisor,source_line:number,student_line:line});
 }
}
const target=path.join(__dirname,'UC-Davis物理博士目录匹配候选-20261107.json');fs.writeFileSync(target,JSON.stringify({source:'https://physics.ucdavis.edu/alumni/phd-recipients',warning:'姓名匹配只是线索，需逐人核身份、学位时间及学校；不能自动当作正式关系。',missing_line_numbers:gaps,candidates:out},null,2)+'\n');
console.log(JSON.stringify({target,candidates:out.length,missing_line_numbers:gaps,results:out}));
