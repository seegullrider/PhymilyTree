const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const wiki = (target, label) => `[[${target}|${label}]]`;
const source = (label, url) => `[${label}](${url})`;

const files = new Map();

function update(file, change) {
 const content = files.get(file) ?? read(file);
 files.set(file, change(content));
}
function append(file, line, before = null) {
 update(file, content => {
  if (content.includes(line)) return content;
  const sep = content.includes('\r\n') ? '\r\n' : '\n';
  if (!before) return content.trimEnd() + sep + line + sep;
  const at = content.indexOf(before);
  if (at < 0 || content.indexOf(before, at + before.length) !== -1) throw Error('位置不唯一 ' + file);
  return content.slice(0, at).trimEnd() + sep + sep + line + sep + sep + content.slice(at);
 });
}


const manifestFile='graph-manifest.json';
const manifest=JSON.parse(read(manifestFile));
const auditEvents=[], typedEvents=[], added=[];
const newSchoolFiles = new Set();
const phaseLabels={
 'phd.group_leader':['博士课题组负责人','博士课题组成员'],
 'postdoc.group_leader':['博士后课题组负责人','博士后课题组成员'],

 'phd.advisor':['博士导师','博士生'],
 'phd.stage_mentor':['博士阶段研究师长','博士阶段研究者'],
 'postdoc.advisor':['博士后导师','博士后研究者'],
 'postdoc.stage_mentor':['博士后阶段研究师长','博士后阶段研究者'],
 'phd.candidate':['博士导师候选','博士阶段研究者候选（待核）'],
 'postdoc.candidate':['博士后候选关系','博士后研究者候选（待核）']
};
const normalize=value=>value.normalize('NFKD').replace(/\p{Mark}/gu,'').toLowerCase().replace(/[^a-z]+/g,' ').trim();
const input=process.argv[2];
if(!input||path.extname(input)!=='.json'||(process.argv[3]&&process.argv[3]!=='apply'))throw Error('用法：node 写入已核实校属人物.cjs 批次.json [apply]');
const data=JSON.parse(fs.readFileSync(input,'utf8'));
if(!Array.isArray(data)||!data.length)throw Error('批次须为非空数组');
const stamp=path.basename(input,'.json');
function addSchool(unit, school) {
 if(!school || !/^[\p{L}\p{N} ,’–()-]+$/u.test(unit) || !['美国','新加坡'].includes(school.kind) ||
    !Array.isArray(school.sources) || !school.sources.length ||
    school.sources.some(({label,url})=>!label || !/^https:\/\//.test(url))) throw Error('未收录院校或缺少校方目录 '+unit);
 const target='院校 - '+unit;
 const schoolFile='院校与机构/'+target+'.md';
 const table=unit+'逐人复核记录';
 const tableFile=table+'.md';
 for(const f of [schoolFile,tableFile]){
  if(fs.existsSync(path.join(root,f)))throw Error('已有院校文件，须核对后补录 '+f);
  newSchoolFiles.add(f);
 }
 const links=school.sources.map(({label,url})=>source(label,url)).join(' · ');
 files.set(schoolFile,'# '+unit+'\n\n'+wiki('PI关系图总入口','返回图谱入口')+' · '+wiki(table,'逐人复核记录')+
  '\n\n> [!warning] 漏校补录进行中\n> 物理、材料、EE、化学及相关院系仍需逐人核对。\n\n校方目录：'+links+'\n\n## 校属记录\n');
 files.set(tableFile,'# '+unit+' 逐人复核记录\n\n'+wiki(target,'返回学校')+
  '\n\n> [!warning] 院系筛查与人物复核进行中。\n\n| 人物 | 院系及方向 | 博士阶段 | 博士后阶段 | 来源 |\n|---|---|---|---|---|\n');
 append('PI关系图总入口.md','- '+wiki(target,unit)+'（漏校补录中）','## 院系候选');
 return school.kind;
}
for(const spec of data){
 const {unit,name,aliases,dept,topics,faculty,research,anchor,appointment,directions,identity,next,phases}=spec;
 const affiliationSource=spec.historicalAffiliation?'历史院系任用核对':'现任院系原档';
 const schoolRole=spec.historicalAffiliation?'（历史任用）':'';
 const postdocStatus=spec.postdocStatus??'unresolved';
 if(!['unresolved','no_postdoc_documented'].includes(postdocStatus)
     || (postdocStatus==='no_postdoc_documented' && phases.some(x=>x[0]==='postdoc'))){
  throw Error('博士后经历标注与阶段关系冲突 '+name);
 }
 const id=crypto.createHash('sha256').update(unit+'|'+name).digest('hex').slice(0,8);
 const filename='人员 - '+unit+' - '+name+' - '+id;
 const departments=[dept,...(spec.otherDepts??[])].map(label=>({label,target:'已核实单位 - '+unit+' - '+label}));
 const person=wiki(filename,name);
 const noteFile='人物/'+filename+'.md';
 const possible=[name,...aliases].map(normalize);
 const kind=manifest.nodes.find(r=>r.unit===unit)?.kind ?? addSchool(unit,spec.school);
 if(manifest.nodes.some(r=>r.id===id||r.filename===filename)||fs.existsSync(path.join(root,noteFile)))throw Error('已存在人物 '+name);
 const collisions=manifest.nodes.filter(r=>possible.includes(normalize(r.name)));
 const distinct=spec.distinctFrom;
 if(distinct&&(!collisions.some(r=>r.id===distinct.id)||!distinct.evidence||!distinct.sources?.length)){
  throw Error('同名判定缺少匹配记录或来源 '+name);
 }
 if(collisions.some(r=>r.id!==distinct?.id))throw Error('同名记录须先核实 '+name);
 const links=[source(affiliationSource,faculty),source('学术经历核对',anchor)];
 const proof=(text,urls)=>text+' '+urls.map((url,i)=>source(url===faculty?affiliationSource:url===anchor?'学术经历核对':'来源 '+(i+1),url)).join(' · ');
 const auditId='pi_add_'+crypto.createHash('sha256').update(stamp).digest('hex').slice(0,16)+'_'+id;
 const lines=[];
 for(const [stage,mentor,label,kind,evidence,sources] of phases){
  const labels=phaseLabels[stage+'.'+kind];
  if(!labels||!evidence||!Array.isArray(sources)||!sources.length)throw Error('缺少明确阶段、类型或来源 '+name);
  const [role,reverse]=labels;
  const detail=proof(evidence,sources);
  lines.push('- '+role+'：'+wiki(mentor,label)+'。'+detail);
  append('师承关系索引.md','- '+person+' → '+role+'：'+wiki(mentor,label)+'。'+detail);
  const mentorFile='人物/'+mentor+'.md';
  const reverseLink='- '+reverse+'：'+person+'。'+detail;
  if(!files.has(mentorFile)&&!fs.existsSync(path.join(root,mentorFile))){
   if(!mentor.startsWith('师承人物 - '))throw Error('师长记录缺失 '+mentor);
   files.set(mentorFile,'# '+label+'\n\n> [!info] 师承扩展人物\n> 任职及指导关系见下列机构原档。\n\n## 师承\n\n'+reverseLink+'\n');
  } else {
   const marker='<!-- PI-AUTO-SEARCH:START -->';
   append(mentorFile,reverseLink,(files.get(mentorFile)??read(mentorFile)).includes(marker)?marker:null);
  }
  typedEvents.push({event_id:auditId+'_'+typedEvents.length,record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id:auditId});
 }
 const combined=(stage,status)=>({
  status,note:phases.filter(x=>x[0]===stage).map(x=>x[4]).join(' '),
  sources:[...new Set(phases.filter(x=>x[0]===stage).flatMap(x=>x[5]))]
 });
 const exactName=aliases.join('；');
 const other=distinct?collisions.find(r=>r.id===distinct.id):null;
 const distinction=other?'\n- 同名辨析：与 '+wiki(other.filename,other.name+' · '+other.unit)+' 为不同人。'+proof(distinct.evidence,distinct.sources):'';
 const career=[
  spec.phdEvidence && '- 博士经历：'+proof(spec.phdEvidence,spec.phdSources),
  spec.postdocEvidence && '- 博士后经历：'+proof(spec.postdocEvidence,spec.postdocSources)
 ].filter(Boolean);
 let extension='';
 if(spec.extension){
  extension='\n- 同人节点：'+wiki(spec.extension,'原师承扩展节点')+'。';
  append('人物/'+spec.extension+'.md','- 同人校属页：'+person+'。保留既有指导反链。');
 }
 files.set(noteFile,'# '+name+'\n\n## 所在的学校或机构记录\n\n- '+wiki('院校 - '+unit,unit)+' · '+departments.map(d=>wiki(d.target,d.label)).join(' · ')+'\n- 资料中亦见 '+exactName+'。\n\n## 院系与研究方向核验（'+new Date().toISOString().slice(0,10)+'）\n\n- '+appointment+'。'+directions+'。'+source(affiliationSource,faculty)+' · '+source('研究原档',research)+'\n- '+topics.map(t=>wiki('已核实方向 - '+t,t)).join(' · ')+'。\n\n## 师承\n\n'+[...lines,...career].join('\n')+extension+distinction+'\n\n- 核查边界：'+next+'\n');
 const schoolFile='院校与机构/院校 - '+unit+'.md';
 const schoolContent=files.get(schoolFile)??read(schoolFile);
 const afterRoster=['## 院系关键词候选','## 待逐人复核'].find(heading=>schoolContent.includes(heading));
 append(schoolFile,'- '+person+schoolRole,afterRoster);
 for(const {label,target} of departments){
  const f='已核实院系/'+target+'.md';
  if(!files.has(f)&&!fs.existsSync(path.join(root,f)))files.set(f,'# '+unit+'：'+label+'\n\n'+wiki('院校 - '+unit,'返回学校')+'\n\n');
  append(f,'- '+person+' — '+source(affiliationSource,faculty));
 }
 for(const t of topics)append('已核实方向/已核实方向 - '+t+'.md','- '+wiki(filename,name+' · '+unit)+' — '+source('研究原档',research));
 const table=unit+'逐人复核记录.md';
 update(table,content=>{
  const sep=content.includes('\r\n')?'\r\n':'\n';
  const rows=content.split(/\r?\n/);
  const last=rows.findLastIndex(l=>l.startsWith('| [[人员 - ') || (newSchoolFiles.has(table) && l==='|---|---|---|---|---|'));
  if(last<0)throw Error('找不到校表 '+table);
  const phaseText=stage=>phases.filter(x=>x[0]===stage).map(x=>x[2]+'（'+phaseLabels[stage+'.'+x[3]][0]+'）').join('、');
  rows.splice(last+1,0,'| '+[person,departments.map(x=>x.label).join('、')+schoolRole+'；'+directions,phaseText('phd')||spec.phdTable||'待核',phaseText('postdoc')||spec.postdocTable||'待核',links.join(' · ')].join(' | ')+' |');
  return rows.join(sep);
 });
 const audit = {audit_id:auditId,record_id:id,aspects:{
  identity:{status:'confirmed',note:identity,sources:[faculty,anchor]},
  affiliation:{status:'confirmed',note:appointment,sources:[faculty]},
  research:{status:'confirmed',note:directions,sources:[faculty,research]},
  phd:phases.some(x=>x[0]==='phd')?combined('phd',phases.some(x=>x[0]==='phd'&&x[3]==='advisor')?'confirmed_advisor':'group_or_candidate'):{status:'unresolved',note:spec.phdEvidence,sources:spec.phdSources},
  postdoc:phases.some(x=>x[0]==='postdoc')?combined('postdoc',phases.some(x=>x[0]==='postdoc'&&x[3]==='advisor')?'confirmed_advisor':'group_or_candidate'):{status:postdocStatus,note:spec.postdocEvidence,sources:spec.postdocSources}
 },followup_required:true,next_step:next};
 for (const [field, aspect] of Object.entries(audit.aspects)) {
  if (typeof aspect.note !== 'string' || aspect.note.trim().length < 8 ||
      !Array.isArray(aspect.sources) || aspect.sources.some(url => typeof url !== 'string' || !/^https?:\/\//i.test(url)) ||
      (aspect.status !== 'unresolved' && !aspect.sources.length)) {
   throw Error(name + ' 的 ' + field + ' 缺少可录入人工台账的证据或来源');
  }
 }
 if (typeof next !== 'string' || next.trim().length < 8) throw Error(name + ' 缺少后续核查步骤');
 auditEvents.push(audit);
 manifest.nodes.push({id,filename,name,unit,kind});
 added.push({id,name,noteFile});
}

manifest.notes=manifest.nodes.length;
manifest.units=new Set(manifest.nodes.map(r=>r.unit)).size;
files.set(manifestFile,JSON.stringify(manifest,null,2)+'\n');
files.set('自动化/'+stamp+'_人工.json',JSON.stringify(auditEvents,null,2)+'\n');
files.set('自动化/'+stamp+'_结构化.json',JSON.stringify(typedEvents,null,2)+'\n');
if(process.argv[3]==='apply'){
 for(const [file,content] of files)fs.writeFileSync(path.join(root,file),content,{encoding:'utf8',flag:newSchoolFiles.has(file)||added.some(x=>x.noteFile===file)?'wx':'w'});
}
console.log(JSON.stringify({added,files:files.size,records:manifest.notes,units:manifest.units,relations:typedEvents.length}));
