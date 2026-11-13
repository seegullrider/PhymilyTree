// 只生成候选，姓名命中不可替代学校、学位、时间、方向身份核实。
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const raw=fs.readFileSync(path.join(__dirname,'Caltech_IQIM博士名录-20261108.txt'),'utf8');
if(!raw.includes('L11: ## Graduate Alumni')||!raw.includes('L412:'))throw Error('目录不完整，停止比对');
const lines=raw.split(/\r?\n/).map(s=>s.replace(/^L\d+:\s*/,'')),entries=[];
for(let i=0;i<lines.length;i++){const m=lines[i].match(/^(.+?),\s*(.+?)\s*・\s*PhD\s*・\s*(\d{4})\s*$/);if(!m)continue;const adviser=lines.slice(i+1,i+5).find(s=>s.startsWith('Advisor:'));if(!adviser)continue;const heading=lines.slice(Math.max(0,i-4),i).reverse().find(s=>s.startsWith('###'));entries.push({surname:m[1],given:m[2],year:m[3],advisor:adviser.slice(8).trim(),title:(heading||'').replace(/^###\s*/,''),source:'https://feeds.library.caltech.edu/groups/IQIM/alumni.html'});}
const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const {nodes}=JSON.parse(fs.readFileSync(path.join(root,'graph-manifest.json'),'utf8'));const hits=[];
for(const e of entries){const last=normalize(e.surname),first=normalize(e.given).split(' ')[0];if(!first||!last)continue;for(const r of nodes){const nm=normalize(r.name);const tokens=nm.split(' ');if(tokens.includes(first)&&(' '+nm+' ').includes(' '+last+' '))hits.push({...e,recordId:r.id,recordName:r.name,unit:r.unit,filename:r.filename});}}
const result={source:'https://feeds.library.caltech.edu/groups/IQIM/alumni.html',generated:new Date().toISOString(),doctoralEntries:entries.length,candidateCount:hits.length,note:'姓名候选；不同人、别名及跨校重复均可能，必须人工核对人物、博士学校、日期和研究方向后才可写关系。',hits};const output=path.join(__dirname,'Caltech_IQIM博士候选-20261108.json');fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({doctoralEntries:entries.length,candidateCount:hits.length,hits}));
