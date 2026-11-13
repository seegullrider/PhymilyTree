const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const dir = __dirname, root = path.dirname(dir);
const z = 'https://me.berkeley.edu/wp-content/uploads/2026/10/ZOHDI-CV-2026-OCTOBER.pdf';
const b = 'https://bsac.berkeley.edu/people/anju-toor';
const w = 'https://wppt.pwr.edu.pl/o-wydziale/postepowanie-awansowe/nauki-fizyczne---przewody-doktorskie/zakonczone-phd-f';
const f = 'https://www.mse.gatech.edu/people/antonio-facchetti';
function update(file, transform) { const p = path.join(root,file); const old=fs.readFileSync(p,'utf8'); const next=transform(old); if(next!==old)fs.writeFileSync(p,next); }
update('人物/人员 - Georgia Tech - Anju Toor - 24ea722f.md', s => {
 const heading='## 2026-11-09 原始来源复核';
 if(s.includes(heading))return s;
 return s.replace('<!-- PI-AUTO-SEARCH:START -->', `${heading}\n\n- [Zohdi 本人 Berkeley 履历](${z})在已毕业博士生中列 Anju Toor（2017，co-sup. A. Pisano）；[Berkeley 传感器中心简介](${b})亦将 Pisano 列为博士指导者。\n- 同一 Berkeley 页面将其列为 2022 年博士后，并明确称 Ana Arias 与 Kristofer Pister 为 advisors；LBNL 其他任职和指导关系仍待核。\n\n<!-- PI-AUTO-SEARCH:START -->`);
});
for (const [name,url] of [['Albert P. Pisano',z],['Tarek Zohdi',z],['Ana Claudia Arias',b],['Kristofer S. J. Pister',b]]) {
 update(`人物/师承人物 - ${name}.md`,s=>s.split('\n').map(line=>line.includes('Anju Toor')&&!line.includes(url)?line+` [复核来源](${url})`:line).join('\n'));
}
update('Georgia Tech逐人复核记录.md',s=>s.split('\n').map(line=>line.includes('24ea722f')&&!line.includes(z)?line.replace(' | [来源]',` | [博士复核](${z})；[博后复核](${b})；[来源]`):line).join('\n'));
update('师承关系索引.md',s=>s.split('\n').map(line=>line.includes('24ea722f')&&!line.includes(z)&&!line.includes(b)?line+` [复核来源](${line.includes('博士后导师')?b:z})`:line).join('\n'));
const db=new DatabaseSync(path.join(dir,'检索队列.sqlite')); db.exec('PRAGMA busy_timeout=10000');
const updates=[
 ['2e35c184','20261109_dusanowski_degree',x=>{x.phd.note='Wrocław 学位委员会直接列 Promotor Grzegorz Sęk、Promotor pomocniczy Marcin Syperek；后者是辅助导师，不作为共同主导师。';x.phd.sources=[w];}],
 ['24ea722f','20261109_toor_berkeley',x=>{x.phd.note='Zohdi 的 Berkeley 履历博士生名单列 Toor 2017 博士及 co-sup. A. Pisano；BSAC 页亦列 Pisano。';x.phd.sources=[z,b,...x.phd.sources];x.postdoc.note='BSAC 页面列 PostDoc 2022，明确 Ana Arias 和 Kristofer Pister 为 advisors。';x.postdoc.sources=[b,...x.postdoc.sources];}],
 ['55429493','20261109_facchetti_gatech',x=>{x.phd.note='Georgia Tech 系履历列 Milano 博士 Advisor Giorgio A. Pagani；博士截止时间与 Berkeley 博后时间重叠，待核。';x.phd.sources=[f];x.postdoc.note='系履历明确 Berkeley 博后 Supervisor Andrew Streitwieser，Northwestern 博后 Supervisor Tobin J. Marks；第一阶段与博士时间重叠。';x.postdoc.sources=[f];}]
];
for(const [id,audit,fn] of updates){const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!row)throw Error(id);const x=JSON.parse(row.details_json);x.audit_id=audit;x.followup_required=true;fn(x.aspects);const file=path.join(dir,audit+'.json');if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n');console.log(execFileSync(process.execPath,['--no-warnings',path.join(dir,'人工核查台账.cjs'),'record',file],{encoding:'utf8'}).trim())}
const rows=[];function add(id,stage,mentor,kind,audit,evidence,url){rows.push({event_id:'20261109_gtverify_'+id+'_'+rows.length,record_id:id,stage,mentor_filename:mentor,kind,source_audit_id:audit,evidence,sources:[url]})}
add('2e35c184','phd','师承人物 - Grzegorz Sęk','advisor','20261109_dusanowski_degree','Wrocław 学位委员会直接列 Promotor。',w);
add('2e35c184','phd','师承人物 - Marcin Syperek','stage_mentor','20261109_dusanowski_degree','学位委员会列 Promotor pomocniczy，博士辅助导师；非共同主导师。',w);
for(const n of ['Albert P. Pisano','Tarek Zohdi'])add('24ea722f','phd','师承人物 - '+n,'advisor','20261109_toor_berkeley','Zohdi 本人履历指导博士生清单列 Toor，注明 co-sup. A. Pisano。',z);
for(const n of ['Ana Claudia Arias','Kristofer S. J. Pister'])add('24ea722f','postdoc','师承人物 - '+n,'advisor','20261109_toor_berkeley','BSAC 页面列 PostDoc 2022，并明确二人为 advisors。',b);
for(const [stage,n] of [['phd','师承人物 - Giorgio A. Pagani'],['postdoc','师承人物 - Andrew Streitwieser'],['postdoc','人员 - Northwestern - Tobin J. Marks - 9ff02476']])add('55429493',stage,n,'advisor','20261109_facchetti_gatech','Georgia Tech 教师履历按阶段分别列 Advisor 或 Supervisor；Berkeley 博后和博士日期重叠待核。',f);
const outfile=path.join(dir,'结构化-20261109-GeorgiaTech来源复核.json');if(!fs.existsSync(outfile))fs.writeFileSync(outfile,JSON.stringify(rows,null,2)+'\n');console.log(execFileSync(process.execPath,['--no-warnings',path.join(dir,'结构化师承关系.cjs'),'record',outfile],{encoding:'utf8'}).trim());db.close();
