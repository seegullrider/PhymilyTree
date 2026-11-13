// Compare a directly read 2010 school roster with local school-affiliated records.
// A match is only a lead: the named advisor can belong to a different training stage,
// and same names must be resolved with dates, institutions and research.
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const source='https://www.colorado.edu/conference/bss/2010/boulder-school-2010-roster',input=path.join(__dirname,'BoulderSchool2010-原始目录-20261108.txt');
const data=fs.readFileSync(input,'utf8'),total=Number(data.match(/Total lines:\s*(\d+)/)?.[1]),lines=[...data.matchAll(/^L(\d+):[ \t]*(.*)$/gm)],have=new Set(lines.map(x=>+x[1]));
const missing=Array.from({length:total||0},(_,i)=>i).filter(i=>!have.has(i));if(!total||missing.length)throw Error('原始目录不完整：'+missing.slice(0,20));
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const records=db.prepare('select id,name,unit,filename from records').all();db.close();
const norm=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/（[^）]*）|\([^)]*\)/g,' ').replace(/\s*[—–]\s*.*$/,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const matches=[];for(const line of lines){let body=line[2];if(!/Advisor:/i.test(body)||!body.includes('|'))continue;const prefix=body.split('|')[0],before=prefix.split(/Advisor:/i)[0],advisor=prefix.split(/Advisor:/i)[1]?.trim();const tok=norm(before).split(' ');for(const r of records){let parts=norm(r.name).split(' ').filter(x=>x.length>1);if(parts.length<2)continue;const first=parts[0],last=parts[parts.length-1];if(tok[0]!==first||!tok.slice(1,6).includes(last))continue;matches.push({record_id:r.id,name:r.name,unit:r.unit,filename:r.filename,line:+line[1],roster_entry:prefix.trim(),advisor,source})}}
const out={source,total_lines:total,matches,note:'仅姓名初筛；名单 Advisor 的阶段、身份、去向须结合个人履历及学位原文核实，不能自动写为正式导师。'};fs.writeFileSync(path.join(__dirname,'BoulderSchool2010候选-20261108.json'),JSON.stringify(out,null,2)+'\n','utf8');console.log(JSON.stringify({count:matches.length,matches:matches.map(x=>({name:x.name,unit:x.unit,roster:x.roster_entry}))},null,2));
