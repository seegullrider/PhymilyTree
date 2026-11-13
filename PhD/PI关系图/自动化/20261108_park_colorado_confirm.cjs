// 直接读取 Colorado 院校页完整跨行 advisor 字段后升级原博士候选。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..');
const id='73ac1636',p='人员 - Colorado Boulder - Wounjhang Park - 73ac1636',m='师承人物 - Christopher J. Summers',url='https://www.colorado.edu/ali/faculty-partners/wounjhang-park';
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'原文-20261108-WounjhangPark-Colorado.json'),'utf8'));if(source.record_id!==id||!source.raw.includes('Advisor: Prof. Christopher J.')||!source.raw.includes('L28: Summers'))throw Error('完整原文或姓名不匹配');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),r=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(r?.audit_id!=='20261108_park_cached_colorado')throw Error('最新事件已变化');db.close();
const a=JSON.parse(r.details_json);a.audit_id='20261108_park_colorado_full_advisor';a.aspects.phd={status:'confirmed_advisor',note:'Colorado 学校本人页博士学历和论文题名后直接列 Advisor: Prof. Christopher J. Summers；上一份缓存恰在 J. 后截断，完整网页跨行列出 Summers。',sources:[url,'https://www.colorado.edu/initiative/cubit/2020/07/29/wounjhang-won-park']};a.followup_required=true;a.next_step='博士导师由学校本人资料明确；继续查 Georgia Tech Research Institute 博士后导师、共同指导及具体时间。';
const ev=`[Colorado 学校本人页](${url})将 1997 年 Georgia Tech 物理博士论文 “Optical Properties of Thin Film Phosphors” 的 Advisor 明确列为 Christopher J. Summers；姓氏位于网页下一行。关系类型可信度：高。`;
const changes=new Map();function replace(rel,needle,repl){const f=path.join(root,rel),s=changes.has(f)?changes.get(f):fs.readFileSync(f,'utf8'),lines=s.split('\n'),idx=lines.map((x,i)=>x.includes(needle)?i:-1).filter(i=>i>=0);if(idx.length!==1)throw Error(rel+' matches '+idx.length);lines[idx[0]]=repl;changes.set(f,lines.join('\n'))}
replace('人物/'+p+'.md','- 博士导师候选：',`- 博士导师：[[${m}|Christopher J. Summers]]。${ev}`);
replace('人物/'+p+'.md','- 核查边界：','- 核查边界：Colorado 学校本人页完整跨行文字明确博士论文 advisor；本人 CV 列 GTRI 1997–1998 博后，该阶段导师仍待核。');
replace('人物/'+m+'.md','- 博士生候选：',`- 博士生：[[${p}|Wounjhang Park]]。${ev}`);
replace('师承关系索引.md',`[[${p}|Wounjhang Park]] → 博士导师候选：`,`- [[${p}|Wounjhang Park]] → 博士导师：[[${m}|Christopher J. Summers]]。${ev}`);
replace('Colorado Boulder逐人复核记录.md',`| [[${p}|Wounjhang Park]]`,`| [[${p}|Wounjhang Park]] | 电气计算机与能源工程系、材料科学与工程项目、生物医学工程项目；纳米光子学、光学材料、纳米结构 | Christopher J. Summers（学校页明确论文 advisor） | GTRI 博后，导师待核 | [Colorado 学校本人页](${url})；[本人 CV](https://experts.colorado.edu/vitas/122676.pdf) |`);
for(const [f,s] of changes)fs.writeFileSync(f,s,'utf8');
fs.writeFileSync(path.join(__dirname,'人工-20261108-park-colorado-confirm.json'),JSON.stringify(a,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'结构化-20261108-park-colorado-confirm.json'),JSON.stringify([{event_id:'20261108_park_christopher_summers_advisor',record_id:id,stage:'phd',mentor_filename:m,kind:'advisor',source_audit_id:a.audit_id,evidence:'Colorado 本人学校网页列 1997 Georgia Tech 博士论文题目及 Advisor: Prof. Christopher J. Summers；姓氏在下一行，完整原文已读。',sources:[url]}],null,2)+'\n');console.log(JSON.stringify({files:changes.size,audit:a.audit_id}));
