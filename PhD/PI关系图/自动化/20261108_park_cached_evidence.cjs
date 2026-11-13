// 补充已缓存的学校原网页证据；原网页摘录导师姓氏被截断，候选关系不升级。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'), db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const id='73ac1636',person='人员 - Colorado Boulder - Wounjhang Park - 73ac1636',mentor='师承人物 - Christopher J. Summers';
const bio='https://www.colorado.edu/ali/faculty-partners/wounjhang-park', ceremony='https://repository.gatech.edu/server/api/core/bitstreams/bf3b92df-fc7b-4ffb-bbf9-a9f70c3c9d2e/content',profile='https://www.colorado.edu/initiative/cubit/2020/07/29/wounjhang-won-park';
const cached=db.prepare("select excerpt from pages where record_id=? and url=? and state='done'").get(id,bio)?.excerpt;
if(!cached||!cached.includes('Thesis: Optical Properties of Thin Film Phosphors, Advisor: Prof. Christopher J.'))throw Error('学校原网页缓存不含预期证据');
const row=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);
if(row.audit_id!=='20261105_73ac1636_primary')throw Error('最新人工事件已改变，需重新审阅');
const audit=JSON.parse(row.details_json);audit.audit_id='20261108_park_cached_colorado';
audit.aspects.phd={status:'group_or_candidate',note:'Colorado 校方原网页已读缓存将 1997 Georgia Tech 博士论文题目及 Advisor: Prof. Christopher J. 连续列出，但保存摘录未含姓氏；Georgia Tech 毕业典礼 PDF 文本列 C. Summers，原版面多栏尚未读清，不能单独确认两处姓名及姓名对应。继续保留 Christopher J. Summers 为候选。',sources:[bio,ceremony,profile]};
audit.followup_required=true;audit.next_step='通用退避结束后读取 Colorado 网页完整 Advisor 字段或 Georgia Tech 学位论文、毕业典礼可视版；再追查 GTRI 博后指导者。';
const sources=`[Colorado 校方网页的已读缓存](${bio})将博士论文题目与 “Advisor: Prof. Christopher J.” 连续列出，但缓存摘录未保存姓氏；[Georgia Tech 毕业典礼 PDF](${ceremony})文本列 C. Summers，但页面多栏对应尚未视觉核实。两者可能指同一人，姓名及正式关系仍待原始全文确认。`;
const replacements=[
 ['人物/'+person+'.md','- 博士导师候选：',`- 博士导师候选：[[${mentor}|Christopher J. Summers]]。${sources}`],
 ['人物/'+person+'.md','- 核查边界：',`- 核查边界：${sources}本人 CV 列 GTRI 1997–98 博后，导师未核。`],
 ['人物/'+mentor+'.md','- 博士生候选：',`- 博士生候选：[[${person}|Wounjhang Park]]。${sources}`],
 ['师承关系索引.md','Wounjhang Park]] → 博士导师候选：',`- [[${person}|Wounjhang Park]] → 博士导师候选：[[${mentor}|Christopher J. Summers]]。${sources}`],
 ['Colorado Boulder逐人复核记录.md','| [['+person+'|Wounjhang Park]]',`| [[${person}|Wounjhang Park]] | 电气计算机与能源工程系、材料科学与工程项目、生物医学工程项目；纳米光子学、光学材料、纳米结构 | Christopher J. Summers（候选；校方网页缓存姓名截断、多栏版面待核） | GTRI 博后，导师待核 | [Colorado 校方网页](${bio})；[Georgia Tech 毕业典礼](${ceremony})；[本人 CV](https://experts.colorado.edu/vitas/122676.pdf) |`]
];
const edits=new Map();for(const [rel,needle,repl] of replacements){const f=path.join(root,rel);let text=edits.has(f)?edits.get(f):fs.readFileSync(f,'utf8');const lines=text.split('\n'),hits=lines.map((x,i)=>x.includes(needle)?i:-1).filter(i=>i>=0);if(hits.length!==1)throw Error(rel+' match count '+hits.length);lines[hits[0]]=repl;edits.set(f,lines.join('\n'));}
const others=[['0db23413','20261105_0db23413_primary','师承人物 - Ken Dill','本人 Rutgers CV 的博士后条目明列 Research Mentor: Ken Dill；此为阶段研究师长，不自动推断正式 advisor。','https://cbe.rutgers.edu/sites/default/files/2024-02/Dignon_Gregory.pdf'],['1be82b48','20261106_1be82b48_primary_v135','人员 - Cornell - Lena F. Kourkoutis - 2e8e52c9','本人 CV 明列 2014–2017 Cornell Postdoctoral Associate，Mentor: Lena Kourkoutis；此为阶段研究师长，正式 advisor 职衔待核。','https://www.roberthovden.com/CV_Robert_Hovden.pdf']];
const typed=[{event_id:'20261108_park_colorado_c_summers_candidate',record_id:id,stage:'phd',mentor_filename:mentor,kind:'candidate',source_audit_id:audit.audit_id,evidence:'Colorado 校方网页缓存列博士论文和 Advisor Christopher J.，姓名姓氏缺失；Georgia Tech 毕业典礼多栏摘录列 C. Summers 但对应关系未视觉核查，保留候选。',sources:[bio,ceremony]}];
for(const [rid,aid,m,evidence,url] of others){const ev=db.prepare('select audit_id from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(rid);if(ev?.audit_id!==aid)throw Error('师长记录已变化 '+rid);const page=db.prepare("select excerpt from pages where record_id=? and url=? and state='done'").get(rid,url);if(!page||!page.excerpt.includes('Mentor:'))throw Error('本人 CV 缓存缺失 '+rid);typed.push({event_id:'20261108_'+rid+'_cached_postdoc_stage',record_id:rid,stage:'postdoc',mentor_filename:m,kind:'stage_mentor',source_audit_id:aid,evidence,sources:[url]});}
db.close();for(const [f,s] of edits)fs.writeFileSync(f,s,'utf8');
fs.writeFileSync(path.join(__dirname,'人工-20261108-park-cached.json'),JSON.stringify(audit,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'结构化-20261108-cached-park-dignon-hovden.json'),JSON.stringify(typed,null,2)+'\n');
console.log(JSON.stringify({edited:edits.size,audit:audit.audit_id,typed:typed.length}));
