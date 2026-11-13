// 只读取既有人工事件和类型化关系；不从姓名、旧状态或合著自动认定导师。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {resolveMentor}=require('./解析师承节点.cjs');
const graph=process.env.PI_GRAPH_ROOT||path.resolve(__dirname,'..');
const db=new DatabaseSync(process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
db.exec('PRAGMA busy_timeout=10000');
const people=db.prepare(`SELECT r.id,r.name,r.unit,r.filename,a.audit_id,a.details_json FROM records r
 LEFT JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x
 WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1)
 ORDER BY r.unit COLLATE NOCASE,r.name COLLATE NOCASE,r.id`).all();
const rels=db.prepare(`SELECT t.* FROM typed_relation_events t WHERE t.rowid=(
 SELECT x.rowid FROM typed_relation_events x WHERE x.record_id=t.record_id AND x.stage=t.stage AND x.mentor_filename=t.mentor_filename
 ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1) AND t.kind<>'retracted' ORDER BY t.stage,t.mentor_filename`).all();
db.close();
const types={advisor:'明确导师',stage_mentor:'阶段研究师长',group_leader:'课题组负责人',candidate:'候选关系'};
const stages=['phd','postdoc'],stats=Object.fromEntries(stages.map(k=>[k,{advisor:0,stage_mentor:0,group_leader:0,candidate:0,untyped:0}]));
const grouped=new Map();for(const r of rels){const key=r.record_id+'\0'+r.stage;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r)}
const clean=s=>String(s??'').replace(/[\r\n\t]+/g,' ').replaceAll('|','／').trim();
function urls(raw){let xs=[];try{xs=JSON.parse(raw)}catch{}return [...new Set(xs)].filter(u=>{try{const x=new URL(u);return x.protocol==='http:'||x.protocol==='https:'}catch{return false}})}
function details(r,stage){
 const a=grouped.get(r.id+'\0'+stage)||[];
 if(!a.length){stats[stage].untyped++;return '未类型化；查看人物页及台账';}
 for(const k of Object.keys(types))if(a.some(x=>x.kind===k))stats[stage][k]++;
 return a.map(x=>{const source=urls(x.sources_json).map((u,i)=>`[源${i+1}](<${u.replaceAll('|','%7C').replaceAll('>','%3E')}>)`).join('、');const {target}=resolveMentor(graph,r.filename,x.mentor_filename);return `${types[x.kind]||'未知类型'}：[[${clean(target)}]] ${source}（${clean(x.evidence)}）`}).join('<br>');
}
function auditLabel(a,stage){return ({confirmed_advisor:'已登记指导关系（类型可能混合）',group_or_candidate:'仅有组属或候选',unresolved:'未明',no_postdoc_documented:'未发现博士后经历，待核'})[a?.aspects?.[stage]?.status]||'无最新人工事件'}
let out='# 全库师承分类总表\n\n';
out+=`生成时间：${new Date().toISOString()}。共 ${people.length} 条校属记录；跨校或同校重复记录未自动合并。[[待核师承名单|按最新台账查看待核名单]] · [[结构化师承关系（人工确认）|按学校汇总已分类关系]] · [[PI关系图总入口|图谱入口]]\n\n`;
out+='本表只展示人工录入的最新类型化关系，**未类型化不等于未搜索、没有导师或人物页无可靠关系**；旧台账 confirmed_advisor 可能混合正式导师及阶段师长。已有类型化标签也可能比人物页保留的旧证据更保守，两者不一致时参阅 [[结构化关系与人物页差异（待核）|类型差异待核报告]]，不可直接以其中一方覆盖另一方。每个阶段可有多位师长及多种关系；所附证据和来源是该关系事件中的内容，须结合原文复核。两阶段和各类型人数有重叠，不可相加。\n\n';
let unit=null;for(const r of people){let audit=null;try{audit=r.details_json?JSON.parse(r.details_json):null}catch{}if(unit!==r.unit){unit=r.unit;out+=`\n## ${clean(unit)}\n\n| 人物 | 博士：已类型化关系 | 博士后：已类型化关系 | 最新台账状态与后续 |\n|---|---|---|---|\n`;}const a=details(r,'phd'),b=details(r,'postdoc'),context=`博士：${auditLabel(audit,'phd')}；博士后：${auditLabel(audit,'postdoc')}；${clean(audit?.next_step)||'未记录后续步骤'}`;out+=`| [[${clean(r.filename)}\\|${clean(r.name)}]] | ${a} | ${b} | ${context} |\n`;}
const target=path.join(graph,'全库师承分类总表.md');fs.writeFileSync(target,out,'utf8');
console.log(JSON.stringify({target,records:people.length,typed_relations:rels.length,stages:stats,note:'类型化只覆盖部分记录，各类型可交叉；未类型化不等于未核实。'}));
