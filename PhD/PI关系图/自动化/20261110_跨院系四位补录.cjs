const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
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
const phaseLabels={
 'phd.advisor':['博士导师','博士生'],
 'postdoc.advisor':['博士后导师','博士后研究者'],
 'postdoc.stage_mentor':['博士后阶段研究师长','博士后阶段研究者']
};
const normalize=value=>value.normalize('NFKD').replace(/\p{Mark}/gu,'').toLowerCase().replace(/[^a-z]+/g,' ').trim();
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'20261110_跨院系四位补录.json'),'utf8'));
for(const spec of data){
 const {unit,name,aliases,dept,topics,faculty,research,anchor,appointment,directions,identity,next,phases}=spec;
 const id=crypto.createHash('sha256').update(unit+'|'+name).digest('hex').slice(0,8);
 const filename='人员 - '+unit+' - '+name+' - '+id;
 const departments=[dept,...(spec.otherDepts??[])].map(label=>({label,target:'已核实单位 - '+unit+' - '+label}));
 const person=wiki(filename,name);
 const noteFile='人物/'+filename+'.md';
 const possible=[name,...aliases].map(normalize);
 if(manifest.nodes.some(r=>r.id===id||r.filename===filename||possible.includes(normalize(r.name)))||fs.existsSync(path.join(root,noteFile)))throw Error('已存在人物 '+name);
 const links=[source('现任院系原档',faculty),source('学术经历核对',anchor)];
 const proof=(text,urls)=>text+' '+urls.map((url,i)=>source(url===faculty?'现任院系档':url===anchor?'学术经历核对':'来源 '+(i+1),url)).join(' · ');
 const auditId='20261110_'+id+'_cross_department_add';
 const lines=[];
 for(const [stage,mentor,label,kind,evidence,sources] of phases){
  const [role,reverse]=phaseLabels[stage+'.'+kind];
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
 files.set(noteFile,'# '+name+'\n\n## 所在的学校或机构记录\n\n- '+wiki('院校 - '+unit,unit)+' · '+departments.map(d=>wiki(d.target,d.label)).join(' · ')+'\n- 资料中亦见 '+exactName+'。\n\n## 院系与研究方向核验（2026-11-10）\n\n- '+appointment+'。'+directions+'。'+source('现任院系原档',faculty)+' · '+source('研究原档',research)+'\n- '+topics.map(t=>wiki('已核实方向 - '+t,t)).join(' · ')+'。\n\n## 师承\n\n'+lines.join('\n')+'\n\n- 核查边界：'+next+'\n');
 append('院校与机构/院校 - '+unit+'.md','- '+person,'## 院系关键词候选');
 for(const {label,target} of departments){
  const f='已核实院系/'+target+'.md';
  if(!files.has(f)&&!fs.existsSync(path.join(root,f)))files.set(f,'# '+unit+'：'+label+'\n\n'+wiki('院校 - '+unit,'返回学校')+'\n\n');
  append(f,'- '+person+' — '+source('现任院系档',faculty));
 }
 for(const t of topics)append('已核实方向/已核实方向 - '+t+'.md','- '+wiki(filename,name+' · '+unit)+' — '+source('研究原档',research));
 const table=unit+'逐人复核记录.md';
 update(table,content=>{
  const sep=content.includes('\r\n')?'\r\n':'\n';
  const rows=content.split(/\r?\n/);const last=rows.findLastIndex(l=>l.startsWith('| [[人员 - '));
  if(last<0)throw Error('找不到校表 '+table);
  const phaseText=stage=>phases.filter(x=>x[0]===stage).map(x=>x[2]+'（'+phaseLabels[stage+'.'+x[3]][0]+'）').join('、');
  rows.splice(last+1,0,'| '+[person,departments.map(x=>x.label).join('、')+'；'+directions,phaseText('phd'),phaseText('postdoc'),links.join(' · ')].join(' | ')+' |');
  return rows.join(sep);
 });
 auditEvents.push({audit_id:auditId,record_id:id,aspects:{
  identity:{status:'confirmed',note:identity,sources:[faculty,anchor]},
  affiliation:{status:'confirmed',note:appointment,sources:[faculty]},
  research:{status:'confirmed',note:directions,sources:[faculty,research]},
  phd:combined('phd','confirmed_advisor'),
  postdoc:combined('postdoc',phases.some(x=>x[0]==='postdoc'&&x[3]==='advisor')?'confirmed_advisor':'group_or_candidate')
 },followup_required:true,next_step:next});
 manifest.nodes.push({id,filename,name,unit,kind:'美国'});
 added.push({id,name,noteFile});
}

const oldChueh='师承人物 - William Chueh';
const chueh=manifest.nodes.find(x=>x.unit==='Stanford'&&x.name==='William Chueh');
const oldFile='人物/'+oldChueh+'.md', newFile='人物/'+chueh.filename+'.md';
const oldContent=read(oldFile);
const backLines=oldContent.split(/\r?\n/).filter(l=>/^- 博士/.test(l));
const edges=[
 {id:'0210a4fa',stage:'phd',kind:'advisor'},
 {id:'73a5677d',stage:'phd',kind:'group_leader',url:'https://chuehlab.stanford.edu/people/alumni/phd-students',proof:'Chueh 实验室原组博士校友档列 Yiyang Li 为 Alumni (Ph.D.)；博士论文正式导师字段待核。'},
 {id:'95e43ad9',stage:'postdoc',kind:'group_leader',url:'https://chuehlab.stanford.edu/people/aditya-sood',proof:'Chueh 实验室同期人物档列 Sood 2018 年 9 月加入该组，在 SIMES/SLAC 与 Lindenberg 联合博后。'}
];
if(backLines.length!==edges.length)throw Error('Chueh 旧反链数目变更，需人工复核');
for(const edge of edges){
 const row=db.prepare('select filename,name from records where id=?').get(edge.id);
 if(!row||!backLines.some(l=>l.includes(row.filename)))throw Error('Chueh 缺原始反链 '+edge.id);
 update('人物/'+row.filename+'.md',s=>{
  const count=s.split('[['+oldChueh+'|').length-1;
  if(count!==1)throw Error('Chueh 人物页旧目标出现 '+count+' 次：'+row.name);
  return s.replace('[['+oldChueh+'|','[['+chueh.filename+'|');
 });
 const old=db.prepare('SELECT * FROM typed_relation_events WHERE record_id=? AND stage=? AND mentor_filename=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(edge.id,edge.stage,oldChueh);
 if(old){
  if(old.kind!==edge.kind)throw Error('Chueh 旧类型变化：'+edge.id);
  const sources=JSON.parse(old.sources_json);
  typedEvents.push({event_id:'20261110_'+edge.id+'_chueh_redirect',record_id:edge.id,stage:edge.stage,mentor_filename:oldChueh,kind:'retracted',evidence:'旧扩展人物和新 Stanford 校属节点经官方履历与原组材料核为同一人，师承边移至校属节点。',sources:[...new Set([...sources,'https://profiles.stanford.edu/william-chueh'])],source_audit_id:old.source_audit_id});
  typedEvents.push({event_id:'20261110_'+edge.id+'_chueh_canonical',record_id:edge.id,stage:edge.stage,mentor_filename:chueh.filename,kind:edge.kind,evidence:old.evidence,sources,source_audit_id:old.source_audit_id});
 }else{
  const audit=db.prepare('select audit_id from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(edge.id);
  if(!edge.url||!audit)throw Error('原关系与来源缺失 '+edge.id);
  typedEvents.push({event_id:'20261110_'+edge.id+'_chueh_canonical',record_id:edge.id,stage:edge.stage,mentor_filename:chueh.filename,kind:edge.kind,evidence:edge.proof,sources:[edge.url],source_audit_id:audit.audit_id,only_if_new:true});
 }
}
update('师承关系索引.md',s=>{
 if(s.split('[['+oldChueh+'|').length-1!==edges.length)throw Error('Chueh 旧索引边数变化');
 return s.replaceAll('[['+oldChueh+'|','[['+chueh.filename+'|');
});
update(newFile,s=>s.trimEnd()+'\n\n'+backLines.join('\n')+'\n');
update(oldFile,s=>{
 const sep=s.includes('\r\n')?'\r\n':'\n';
 const kept=s.split(/\r?\n/).filter(l=>!backLines.includes(l)).join(sep);
 return kept.replace('本节点依据可核查的师承关系建立；其他经历及现职需另核。','旧扩展入口。任职及师承已归并到 '+wiki(chueh.filename,'William Chueh（Stanford）')+'。');
});
db.close();
manifest.notes=manifest.nodes.length;
manifest.units=new Set(manifest.nodes.map(r=>r.unit)).size;
files.set(manifestFile,JSON.stringify(manifest,null,2)+'\n');
files.set('自动化/20261110_跨院系四位人工.json',JSON.stringify(auditEvents,null,2)+'\n');
files.set('自动化/20261110_跨院系四位结构化.json',JSON.stringify(typedEvents,null,2)+'\n');
if(process.argv[2]==='apply'){
 for(const [file,content] of files)fs.writeFileSync(path.join(root,file),content,{encoding:'utf8',flag:added.some(x=>x.noteFile===file)?'wx':'w'});
}
console.log(JSON.stringify({added,files:files.size,records:manifest.notes,units:manifest.units,relations:typedEvents.length}));
