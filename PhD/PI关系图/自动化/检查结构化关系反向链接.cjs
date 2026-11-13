// 对已类型化事件检查反向 wikilink；结构检查不证明事实、阶段或关系类型真实。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const { resolveMentor } = require('./解析师承节点.cjs');
const root=process.env.PI_GRAPH_ROOT||path.resolve(__dirname,'..'),db=new DatabaseSync(process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const rows=db.prepare(`SELECT t.*,r.name,r.unit,r.filename FROM typed_relation_events t JOIN records r ON r.id=t.record_id
 WHERE t.rowid=(SELECT x.rowid FROM typed_relation_events x WHERE x.record_id=t.record_id AND x.stage=t.stage AND x.mentor_filename=t.mentor_filename ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 AND t.kind<>'retracted' ORDER BY r.unit,r.name,t.stage`).all();db.close();
const issues=[];let linkFound=0,stageMentioned=0,candidateMarked=0,candidates=0,forwardFound=0;const forwardIssues=[];
// 同时检查受训者人物页中的正向链接；保留路径限定以消歧，不仅用字符串全等。
for(const r of rows){
 const personFile=path.join(root,'人物',r.filename+'.md');
 if(!fs.existsSync(personFile)){forwardIssues.push({name:r.name,unit:r.unit,mentor:r.mentor_filename,reason:'人物页不存在'});continue;}
 const body=fs.readFileSync(personFile,'utf8').replace(/<!-- PI-AUTO-SEARCH:START -->[\s\S]*?<!-- PI-AUTO-SEARCH:END -->/g,'');
 const found=[...body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].some(m=>m[1]===r.mentor_filename||m[1].replaceAll('\\','/').endsWith('/'+r.mentor_filename));
 if(found)forwardFound++;else forwardIssues.push({name:r.name,unit:r.unit,mentor:r.mentor_filename,reason:'未找到师长链接'});
}
for(const r of rows){if(r.kind==='candidate')candidates++;const { file, ambiguous } = resolveMentor(root, r.filename, r.mentor_filename);let problems=[];if(!file)problems.push(ambiguous?'师长节点同名且人物页未指定唯一目标':'师长节点文件缺失');else{
 const note=fs.readFileSync(file,'utf8').replace(/<!-- PI-AUTO-SEARCH:START -->[\s\S]*?<!-- PI-AUTO-SEARCH:END -->/g,'');
 const lines=note.split(/\r?\n/).filter(l=>l.includes('[['+r.filename+'|')||l.includes('[['+r.filename+']]'));
 if(!lines.length)problems.push('师长页未找到人物目标链接');else{linkFound++;const phase=r.stage==='phd'?/博士(?!后)/:/博士后/,phaseLines=lines.filter(l=>phase.test(l));if(phaseLines.length)stageMentioned++;else problems.push('反向链接所在行未提及相应阶段');
 if(r.kind==='candidate'){if(phaseLines.some(l=>/候选|待核|不(?:能|足|等于|确定)|未(?:核|证实|确认|明|写)|不能证明/.test(l)))candidateMarked++;else problems.push('同阶段反向链接行未识别待核措辞');}}
 }if(problems.length)issues.push({...r,problems});}
let out=`# 结构化师承反向链接检查（待核）\n\n[[PI关系图总入口|图谱入口]] · [[结构化师承关系（人工确认）|结构化关系]]\n\n生成时间：${new Date().toISOString()}。检查 ${rows.length} 条最新有效的结构化关系，${linkFound} 条在师长页找到人物目标链接，${stageMentioned} 条在反向链接所在行识别到相应阶段；${candidates} 条候选中 ${candidateMarked} 条在该行识别到候选或待核措辞。多阶段、别名和跨校关系可能造成误报或漏报。\n\n只检查已类型化的子集，未验证来源、身份、关系方向或标签是否正确；相应文字出现也不证明事实成立。自动搜索块被排除，但块之后的人工内容仍检查。以下提示须人工判断，不自动改写。\n\n`;
for(const r of issues)out+=`- [[${r.filename}|${r.name}]]（${r.unit}；${r.stage==='phd'?'博士':'博士后'}；${r.kind}）→ [[${r.mentor_filename}]]：${r.problems.join('；')}。\n`;
if(!issues.length)out+='本次规则未产生提示；仍需核对未结构化关系与全部图谱语义。\n';
out+=`\n正向链接检查：${rows.length} 条关系中 ${forwardFound} 条在人物页找到师长目标；${forwardIssues.length} 条待人工核对。路径限定链接按目标文件名识别，该检查不验证路径是否唯一或关系方向。\n`;
for(const r of forwardIssues)out+=`- ${r.name}（${r.unit}）→ [[${r.mentor}]]：${r.reason}。\n`;
const target=path.join(root,'结构化师承反向链接检查（待核）.md');fs.writeFileSync(target,out,'utf8');console.log(JSON.stringify({relations:rows.length,linkFound,stageMentioned,candidates,candidateMarked,issues:issues.length,forwardFound,forwardIssues:forwardIssues.length,target}));
