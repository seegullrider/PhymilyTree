// 从已有人物标签与最新人工事件中生成“待人工审查”队列，不认定或写入师承。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=process.env.PI_GRAPH_ROOT||path.resolve(__dirname,'..');
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function phase(type){return type==='博士导师'?'phd':type==='博士后导师'?'postdoc':null}
function candidate(r,a,rel,typed,mentorContent){
 const stage=phase(rel.type);if(!stage||a.aspects?.identity?.status!=='confirmed'||a.aspects?.[stage]?.status!=='confirmed_advisor')return null;
 const [mentor,alias]=String(rel.target||'').split('|');if(!mentor||typed.has([r.id,stage,mentor].join('\n')))return null;
 const aspect=a.aspects[stage],source=rel.url;if(!Array.isArray(aspect.sources)||!aspect.sources.includes(source))return null;
 const display=(alias||mentor.replace(/^师承人物 - /,'').split(' - ').at(-1)).replace(/（.*?）|\([^)]*\)/g,' ').trim(),words=norm(display).replace(/[^a-z ]/g,' ').split(/\s+/).filter(Boolean),last=words.at(-1);
 const combined=norm(aspect.note+' '+(rel.evidence||'')+' '+(rel.review_boundary||''));if(!last||last.length<2||!new RegExp('(?:^|[^a-z])'+last+'(?:$|[^a-z])').test(combined))return null;
 // 两字母姓仅接受能同时找到非缩写名字的情况，仍需人工处理同名；三字母姓不应因长度自动漏掉。
 if(last.length===2&&!words.some(w=>w!==last&&w.length>=3&&new RegExp('(?:^|[^a-z])'+w+'(?:$|[^a-z])').test(combined))&&!(words.length>=2&&combined.includes(words.join(' '))))return null;
 if(!/advisor|adviser|supervisor|导师/i.test(aspect.note)||!/明确|明列|列.{0,15}为|称.{0,15}为|advisor|adviser/i.test(aspect.note))return null;
 const reverse=String(mentorContent||'').split(/\r?\n/).filter(line=>line.includes(r.id)&&(stage==='phd'?/博士(?!后)/:/博士后/).test(line));if(!reverse.length)return null;
 const warnings=[];if(/待.{0,40}(?:核|确认|查)|进一步.{0,15}(?:核|确认|查)|尚未|未明|候选|不等同|不自动|不能|存疑|误拼/i.test(aspect.note+' '+(rel.evidence||'')+' '+(rel.review_boundary||'')))warnings.push('人工事件或人物页含限制、候选或待核说明，须判断适用阶段');
 if(last.length<=3)warnings.push('短姓或缩写易同名，须核导师完整身份');
 if(!/明确|本人|advisor|adviser|supervisor/i.test(rel.evidence||''))warnings.push('人物页未给可归属的单条直接证据');
 if(stage==='phd'&&/博士后/.test(aspect.note))warnings.push('博士事件同时涉及博士后阶段');
 if(stage==='postdoc'&&/博士(?!后)/.test(aspect.note))warnings.push('博士后事件同时涉及博士阶段');
 return {record_id:r.id,name:r.name,unit:r.unit,filename:r.filename,stage,mentor_filename:mentor,mentor_display:display,audit_id:r.audit_id,audit_note:aspect.note,source,person_evidence:rel.evidence,person_boundary:rel.review_boundary||'',reverse_lines:reverse,warnings};
}
function scan(dbPath){const d=new DatabaseSync(dbPath,{readOnly:true});try{
 const rows=d.prepare(`SELECT r.*,a.audit_id,a.details_json FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();
 const typed=d.prepare(`SELECT t.record_id,t.stage,t.mentor_filename FROM typed_relation_events t WHERE t.rowid=(SELECT x.rowid FROM typed_relation_events x WHERE x.record_id=t.record_id AND x.stage=t.stage AND x.mentor_filename=t.mentor_filename ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)`).all();
 const done=new Set(typed.map(t=>[t.record_id,t.stage,t.mentor_filename].join('\n'))),items=[];
 for(const r of rows){let audit,relations;try{audit=JSON.parse(r.details_json);relations=JSON.parse(r.relation_json)}catch{continue}for(const rel of relations){const mentor=String(rel.target||'').split('|')[0];if(!mentor||/[\\/]/.test(mentor))continue;const file=path.join(root,'人物',mentor+'.md');if(!fs.existsSync(file))continue;const c=candidate(r,audit,rel,done,fs.readFileSync(file,'utf8'));if(c)items.push(c)}}
 items.sort((a,b)=>a.warnings.length-b.warnings.length||a.unit.localeCompare(b.unit)||a.name.localeCompare(b.name)||a.stage.localeCompare(b.stage));return items;
 }finally{d.close()}}
if(require.main===module){try{const db=process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'),items=scan(db),out=process.env.PI_TYPED_CANDIDATES_OUT||path.join(__dirname,'已核事件类型化候选.json');fs.writeFileSync(out,JSON.stringify({generated:new Date().toISOString(),warning:'仅将已有人工事件、人物标签和反链交叉列为候选；旧 confirmed_advisor 可能混合阶段研究师长，且人名可能属于他人或不同阶段。必须逐条审查原文、身份、阶段与限制，不自动写入师承；未列不等于已处理。',count:items.length,items},null,2)+'\n');console.log(JSON.stringify({candidates:items.length,records:new Set(items.map(x=>x.record_id)).size,without_flags:items.filter(x=>!x.warnings.length).length,target:out,first:items.slice(0,20)}));}catch(e){console.error(String(e));process.exitCode=1}}
module.exports={candidate,phase,scan};
