const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),{execFileSync}=require('node:child_process');
const source='https://in.nau.edu/department-applied-physics-materials-science/colloquium-schedule/previous-colloquia-2025/';
const proof='NAU 2025 讲座汇总页第 25–31 行为 UT Austin Sean T. Roberts 的讲座；第 34–42 行的 2012–2013 年 UT Austin、A. J. Bard 组博士后经历属于另一场讲座的 Thiagarajan Soundappan，不能归给 Roberts。搜索摘要曾把不同讲座串段。';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});let a=JSON.parse(db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('77794233').details_json);db.close();
a.audit_id='pi_20261113_roberts_nau_page_sections';a.aspects.identity.note+=' '+proof;a.aspects.identity.sources=[...new Set([...a.aspects.identity.sources,source])];
const out=path.join(__dirname,a.audit_id+'.json');fs.writeFileSync(out,JSON.stringify(a,null,2));execFileSync(process.execPath,['--no-warnings',path.join(__dirname,'人工核查台账.cjs'),'record',out],{stdio:'inherit'});
const file=path.join(__dirname,'../人物/人员 - UT Austin - Sean T. Roberts - 77794233.md');let s=fs.readFileSync(file,'utf8');const line=`- 检索消歧：${proof} [NAU 讲座原档](${source})\n`;if(!s.includes(line)){s=s.replace('## 师承\n','## 师承\n\n'+line);fs.writeFileSync(file,s)}
