// 按首末姓名匹配 Schlom 组公开目录；结果只能是候选，不能自动建边。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const input=path.join(__dirname,'Schlom组博士后访问校友目录-20261108.txt'),output=path.join(__dirname,'Schlom组博士后访问校友候选-20261108.json');
const norm=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/（[^）]*）|\([^)]*\)|—.*/g,'').toLowerCase().replace(/[^a-z ]+/g,' ').replace(/\s+/g,' ').trim();
const lines=fs.readFileSync(input,'utf8').split(/\r?\n/).map(x=>{let m=x.match(/^L(\d+):\s*(.*)$/);return m?{n:+m[1],t:m[2].trim()}:null}).filter(Boolean);
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),records=db.prepare('SELECT id,name,unit,filename FROM records').all();db.close();
const candidates=[];for(let i=0;i<lines.length;i++){const {n,t}=lines[i];if(n<142||n>=390||/[【@]/.test(t)||!t||!/^[\p{L} .'-]+$/u.test(t))continue;const a=norm(t).split(' ');if(a.length<2||a.length>4)continue;for(const r of records){const b=norm(r.name).split(' ');if(b.length<2||a[0]!==b[0]||a.at(-1)!==b.at(-1))continue;candidates.push({record_id:r.id,name:r.name,unit:r.unit,filename:r.filename,listed_name:t,line:n,context:lines.slice(i+1,i+7).map(x=>x.t).filter(Boolean).join(' ')})}}
fs.writeFileSync(output,JSON.stringify({source:'https://schlom.mse.cornell.edu/all-members/resume',scope:'仅 L142–389 Alumni - Postdocs and Visiting Scholars',warning:'首末姓名匹配只作候选；该栏目混合博士后和访问学者，不证明博士后阶段或正式导师；必须独立核对身份与阶段。',candidates},null,2)+'\n');console.log(JSON.stringify({matches:candidates.length,candidates}));
