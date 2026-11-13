// NTU 本人档案确认 Brown 博后，2012 报道确认另一岗位的组属；不得推断两个岗位重合。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..');
const p='人员 - NTU - (Steve) Cuong Dang - 1dbe2a00',m='人员 - Brown - Arto V. Nurmikko - 24e523b0';
const uni='https://dr.ntu.edu.sg/entities/person/Steve-Cuong-Dang',lab='https://personal.ntu.edu.sg/hcdang/members.html',brown='https://physics.brown.edu/sites/default/files/newsletter-archive/2010-newsletter.pdf',article='https://www.laserfocusworld.com/test-measurement/research/article/16565611/quantum-dot-vcsels-can-emit-anywhere-in-the-visible-spectrum';
const candidate=`[NTU 本人档案](${uni})明确列 Brown 博士后 research associate，但没有导师姓名或具体任期；[2012 年报道](${article})称其任 Brown Nurmikko 组的 senior research associate 和 nanophotonics laboratory manager。不能证明博士后职位与该组属的时间重合，也不能推定正式导师，故只保留候选。`;
const files=new Map();function edit(rel,fn){let f=path.join(root,rel),s=files.has(f)?files.get(f):fs.readFileSync(f,'utf8');files.set(f,fn(s));}
function addBeforeBoundary(s,line){if(s.includes(line))return s;const key='- 核查边界：';if(s.split(key).length!==2)throw Error('核查边界不唯一');return s.replace(key,line+'\n'+key);}
edit('人物/'+p+'.md',s=>{
 s=addBeforeBoundary(s,`- 博士后经历：Brown University 的 postdoctoral research associate；任期及导师未列。[NTU 本人档案](${uni})。\n- 博士后候选关联：[[${m}|Arto V. Nurmikko]]。${candidate}`);
 return s.replace('Dang 本人的博士后经历和指导者待查。','NTU 本人档案现确认 Dang 在 Brown 有博士后经历；具体任期及正式指导者待查。');
});
edit('人物/'+m+'.md',s=>{const line=`- 博士后候选受指导者：[[${p}|(Steve) Cuong Dang]]。${candidate}`;if(s.includes(line))return s;let k='## 师承\n';if(s.split(k).length!==2)throw Error('师长节点标题不唯一');return s.replace(k,k+'\n'+line+'\n');});
edit('师承关系索引.md',s=>{const line=`- [[${p}|(Steve) Cuong Dang]] → 博士后候选关联：[[${m}|Arto V. Nurmikko]]。${candidate}`;return s.includes(line)?s:s.replace(/\s*$/,'')+'\n'+line+'\n';});
edit('NTU逐人复核记录.md',s=>{
 const lines=s.split('\n'),ids=lines.map((x,i)=>x.startsWith(`| [[${p}|`)?i:-1).filter(i=>i>=0);if(ids.length!==1)throw Error('NTU 人物行不唯一');
 lines[ids[0]]=`| [[${p}|(Steve) Cuong Dang]] | 电气与电子工程学院；纳米光子学、量子点、光学成像 | Arto V. Nurmikko | Brown 博后已证；Nurmikko 为候选（报道中的组属与博后是否重合待核） | [本人档案](${uni})；[2010 Brown 博士名录](${brown})；[2012 报道](${article}) |`;return lines.join('\n');
});
const d=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const row=d.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('1dbe2a00');d.close();let a=JSON.parse(row.details_json);a.audit_id='20261108_cuongdang_brown_postdoc_candidate';
a.aspects.affiliation.note='NTU 电气与电子工程副教授，光电子与生物光子中心主任（学校人物档案）。';a.aspects.affiliation.sources=[...new Set([...a.aspects.affiliation.sources,uni])];
a.aspects.phd.note='本人组页称 Brown 博士在 Arto Nurmikko 指导下完成；2010 Brown 物理毕业生名录明确 Advisor 为 Nurmikko，论文题目相符。';a.aspects.phd.sources=[...new Set([...a.aspects.phd.sources,brown])];
a.aspects.postdoc={status:'group_or_candidate',note:'NTU 本人档案明确 Brown postdoctoral research associate；2012 报道称其在 Nurmikko 组任 senior research associate 和实验室经理。博后任期与该组属是否重合尚无直接证据，Nurmikko 仅是候选，正式导师未确认。',sources:[uni,article]};
a.next_step='查 Brown 人事或本人 CV 确定博士后起止、课题组及正式 advisor；不可将另一位 NTU 组员的首尔大学经历归给本人。';a.followup_required=true;
const relations=[{event_id:'20261108_cuongdang_brown_phd_advisor',record_id:'1dbe2a00',stage:'phd',mentor_filename:m,kind:'advisor',source_audit_id:a.audit_id,evidence:'Brown 物理系 2010 博士毕业名录写 Cuong H. Dang 的 Advisor 为 Arto Nurmikko；NTU 本人组页确认 Brown 博士及身份。',sources:[brown,lab]},{event_id:'20261108_cuongdang_brown_postdoc_candidate',record_id:'1dbe2a00',stage:'postdoc',mentor_filename:m,kind:'candidate',source_audit_id:a.audit_id,evidence:'NTU 档案确认 Brown 博后；2012 报道记其为 Nurmikko 组 senior research associate。两个职位是否重合未证实，不能据此断言博士后导师。',sources:[uni,article]}];
files.set(path.join(__dirname,'人工-20261108-cuongdang-brown博后.json'),JSON.stringify(a,null,2)+'\n');files.set(path.join(__dirname,'结构化-20261108-cuongdang-brown博后.json'),JSON.stringify(relations,null,2)+'\n');
for(const [f,s] of files)fs.writeFileSync(f,s,'utf8');console.log('更新人物页、师长反链、索引、NTU 表并准备两条事件。');
