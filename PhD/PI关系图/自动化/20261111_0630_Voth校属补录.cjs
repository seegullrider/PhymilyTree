
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const unit='University of Chicago';
const name='Gregory A. Voth';
const filename='师承人物 - Gregory A. Voth';
const id=crypto.createHash('sha256').update(unit+'|'+name).digest('hex').slice(0,8);
const links={
 faculty:'https://chemistry.uchicago.edu/faculty/gregory-a-voth',
 jfi:'https://jamesfranckinstitute.uchicago.edu/people/profile/gregory-voth/',
 thesis:'https://thesis.caltech.edu/4686/4/Voth_GA_1987.pdf#page=2',
 catalog:'https://thesis.caltech.edu/4686/',
 tribute:'https://web.mit.edu/jianshucaogroup/pdfdir/2024/cao217.5.pdf#page=1',
};
const wiki=(file,label)=>'[['+file+'|'+label+']]';
const cite=(label,key)=>'['+label+']('+links[key]+')';
const refs=(...keys)=>keys.map(k=>links[k]);
const who=wiki(filename,name);
const faculty=cite('Chicago 化学系','faculty')+' · '+cite('James Franck Institute','jfi');
const doctoral=cite('Caltech 论文第 2 页','thesis')+' · '+cite('Caltech 馆藏','catalog');
const post=cite('Cao 等合署原刊第 1 页','tribute')+' · '+cite('Chicago 化学系','faculty');
const file='人物/'+filename+'.md';
const table=unit+'逐人复核记录.md';
const topics=['分子模拟','统计物理'];
const mentors=[
 {stage:'phd',kind:'advisor',name:'Rudolph A. Marcus',label:'博士导师',reverse:'博士生',keys:['thesis','catalog'],links:doctoral,
  evidence:'Gregory Alan Voth 的 1987 Caltech 论文第 2 页明确具名 R. A. Marcus 为 research advisor，馆藏另列 Rudolph A. Marcus 为 Research Advisor 和委员会主席。可信度高。'},
 {stage:'postdoc',kind:'stage_mentor',name:'David Chandler',label:'博士后阶段研究师长',reverse:'博士后阶段研究者',keys:['tribute','faculty'],links:post,
  evidence:'Chicago 化学系列 1987–1989 UC Berkeley IBM 博士后。Cao 等合署原刊明确 Voth 该段与 David Chandler、William H. Miller 共同工作；按博士后阶段研究师长入图，正式 advisor 称谓待任用档。'},
 {stage:'postdoc',kind:'stage_mentor',name:'William H. Miller',label:'博士后阶段研究师长',reverse:'博士后阶段研究者',keys:['tribute','faculty'],links:post,
  evidence:'Chicago 化学系列 1987–1989 UC Berkeley IBM 博士后。Cao 等合署原刊明确 Voth 该段与 David Chandler、William H. Miller 共同工作；按博士后阶段研究师长入图，正式 advisor 称谓待任用档。'},
];
const staged=new Map();
const read=f=>staged.get(f)??fs.readFileSync(path.join(root,f),'utf8');
const update=(f,edit)=>staged.set(f,edit(read(f)));
function append(f,line){
 update(f,t=>t.includes(line)?t:t.trimEnd()+(t.includes('\r\n')?'\r\n':'\n')+line+'\n');
}
function insertAfter(f,header,contents){
 update(f,t=>{
  if(t.includes(contents))return t;
  const eol=t.includes('\r\n')?'\r\n':'\n';
  const a=t.split(/\r?\n/),at=a.findIndex(row=>row===header);
  if(at<0||a.lastIndexOf(header)!==at)throw Error('无法确定标题 '+f);
  a.splice(at+1,0,'',...contents.split('\n'),'');
  return a.join(eol);
 });
}
const manifest=JSON.parse(read('graph-manifest.json'));
const existing=manifest.nodes.filter(n=>n.id===id||n.filename===filename||(n.unit===unit&&/^gregory (?:a\.? |alan )?voth$/i.test(n.name)));
if(existing.length&&!(existing.length===1&&existing[0].id===id&&existing[0].filename===filename))throw Error('校属记录冲突');
const school=wiki('院校 - '+unit,unit);
const chem='已核实单位 - '+unit+' - 化学系';
const institute='已核实单位 - '+unit+' - James Franck Institute';
if(!fs.existsSync(path.join(root,'已核实院系/'+institute+'.md')))throw Error('需要使用现有 JFI 院系节点');
const intro=[
 '## 所在学校或机构','',
 '- '+school+'，'+wiki(chem,'化学系')+'及 '+wiki(institute,'James Franck Institute')+'。 '+faculty,'',
 '## 院系与研究方向核验（2026-11-11）','',
 '- Chicago 化学系 Haig P. Papazian Distinguished Service Professor，研究液体与材料体系的多尺度'+wiki('已核实方向 - 分子模拟','分子模拟')+'、量子动力学和'+wiki('已核实方向 - 统计物理','统计力学')+'。 '+faculty,
].join('\n');
insertAfter(file,'# '+name,intro);
update(file,t=>t.replace('> 本节点依据可核查的师承关系建立；其他经历及现职需另核。','> 已核 Chicago 化学系及 James Franck Institute 任职，沿用此节点保存既有师承反链。'));
const verified=mentors.map(m=>'- '+m.label+'：'+wiki('师承人物 - '+m.name,m.name)+'。'+m.evidence+' '+m.links).join('\n');
insertAfter(file,'## 师承',verified);
for(const m of mentors){
 const mentor='师承人物 - '+m.name;
 insertAfter('人物/'+mentor+'.md','## 师承','- '+m.reverse+'：'+who+'。'+m.evidence+' '+m.links);
 insertAfter('师承关系索引.md','# 师承关系与候选线索索引','- '+who+' → '+m.label+'：'+wiki(mentor,m.name)+'。'+m.evidence+' '+m.links);
}
append('院校与机构/院校 - '+unit+'.md','- '+who);
for(const label of [chem,institute])append('已核实院系/'+label+'.md','- '+who+' · '+faculty);
for(const topic of topics)append('已核实方向/已核实方向 - '+topic+'.md','- '+wiki(filename,name+' · '+unit)+' · '+faculty);
const row='| '+who+' | 化学系、James Franck Institute；多尺度分子模拟、液体与材料统计力学 | Rudolph A. Marcus（Caltech 1987） | David Chandler、William H. Miller（UC Berkeley 1987–1989 IBM 博后阶段研究师长；正式职衔待核） | '+faculty+' · '+doctoral+' · '+post+' |';
update(table,t=>{
 if(t.includes(row))return t;
 const sep=t.includes('\r\n')?'\r\n':'\n',lines=t.split(/\r?\n/);
 const at=lines.findIndex(l=>/^\|---\|---\|---\|---\|---\|$/.test(l));
 if(at<0)throw Error('学校表边界不明');
 lines.splice(at+1,0,row);
 return lines.join(sep);
});
if(!existing.length){
 manifest.nodes.push({id,filename,name,unit,kind:'美国'});
 manifest.notes=manifest.nodes.length;
 manifest.units=new Set(manifest.nodes.map(n=>n.unit)).size;
 staged.set('graph-manifest.json',JSON.stringify(manifest,null,2)+'\n');
}
const auditId='pi_archive_20261111_0630_'+id;
const audit={
 audit_id:auditId,record_id:id,aspects:{
  identity:{status:'confirmed',note:'Caltech Gregory Alan Voth 1987 原论文、Chicago 校方履历和 Cao 等原刊对应同一研究者。',sources:refs('thesis','faculty','tribute')},
  affiliation:{status:'confirmed',note:'University of Chicago 化学系 Haig P. Papazian Distinguished Service Professor，James Franck Institute。',sources:refs('faculty','jfi')},
  research:{status:'confirmed',note:'液体与材料体系的多尺度理论与模拟、量子动力学及统计力学。',sources:refs('faculty','jfi')},
  phd:{status:'confirmed_advisor',note:mentors[0].evidence,sources:refs('thesis','catalog')},
  postdoc:{status:'group_or_candidate',note:mentors[1].evidence,sources:refs('tribute','faculty')},
 },
 followup_required:true,next_step:'查 UC Berkeley IBM 博士后具名任用和指导职衔；保留 Chandler 与 Miller 博士后阶段指导。'
};
const edges=mentors.map((m,i)=>({event_id:auditId+'_'+i,source_audit_id:auditId,record_id:id,stage:m.stage,kind:m.kind,mentor_filename:'师承人物 - '+m.name,evidence:m.evidence,sources:refs(...m.keys)}));
const pages=Object.entries({
 faculty:'Chicago 化学系履历列 Caltech 1987 博士、UC Berkeley 1987–1989 IBM 博后、Chicago 化学教职及统计和量子力学方向。',
 jfi:'James Franck Institute 教员原档列 Chicago 化学系教授和液体、材料多尺度研究。',
 thesis:mentors[0].evidence,
 catalog:'Caltech 原档列博士论文作者 Gregory Alan Voth 与 Marcus 的 Research Advisor 角色。',
 tribute:mentors[1].evidence
}).map(([key,raw])=>({record_id:id,url:links[key],raw,excerpt:raw}));
console.log(JSON.stringify({id,files:staged.size,alreadyRegistered:Boolean(existing.length)}));
if(process.argv[2]!=='apply')process.exit(0);
for(const [f,t] of staged)fs.writeFileSync(path.join(root,f),t,'utf8');
const save=(suffix,obj)=>{
 const f='20261111_0630_Voth_'+suffix+'.json';
 fs.writeFileSync(f,JSON.stringify(obj,null,2)+'\n','utf8');
 return f;
};
const run=(f,...args)=>execFileSync(process.execPath,['--no-warnings',f,...args],{stdio:'inherit'});
run('检索流程.cjs','sync');
run('人工核查台账.cjs','record',save('人工核查',audit));
run('结构化师承关系.cjs','record',save('结构化关系',edges));
run('检索流程.cjs','ingest-reviewed-pages',save('学位及任职原档回执',pages));
