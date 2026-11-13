const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root='..', people=path.join(root,'人物'), idx=path.join(root,'师承关系索引.md');
const records=db.prepare('select id,name,unit,filename from records where id=?');
const latest=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1');
const graph=new Map(), audits=[], typed=[];
const local=id=>records.get(id).filename;
const fn=filename=>path.join(people,filename+'.md');
const web=(label,url)=>'['+label+']('+url+')';
function editLine(file,test,edit){
 const content=graph.get(file)??fs.readFileSync(file,'utf8');
 const end=content.includes('\r\n')?'\r\n':'\n';
 const lines=content.split(/\r?\n/);
 const matches=lines.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected 1 match, got '+matches.length);
 const i=matches[0];lines[i]=edit(lines[i]);
 graph.set(file,lines.join(end));
}
function note(id,prefix,text){editLine(fn(local(id)),line=>line.startsWith(prefix),line=>line+' '+text);}
function mentorLine(mentor,id,prefix,text){
 const f=fn(mentor), r=records.get(id);
 editLine(f,line=>line.startsWith(prefix)&&line.includes('[['+r.filename+'|'),l=>l+' '+text);
}
function indexLine(id,mentor,label,text){
 const r=records.get(id);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
}
function audit(id,changes,next){
 const a=JSON.parse(latest.get(id).details_json);
 a.audit_id='20261110_'+id+'_ppfp_and_career_0754';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0754_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';
  return cells.join(' | ');
 });
}
function replaceNoteLabel(id,label,replacement,target,extra=''){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceInverseLabel(target,id,label,replacement,extra=''){
 editLine(fn(target),l=>l.startsWith('- '+label+'：')&&l.includes('[['+local(id)+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceIndexLabel(id,target,label,replacement,extra=''){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace(' → '+label+'：',' → '+replacement+'：')+extra);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

function addEdge(id,label,target,name,proof,after,candidate=false){
 const r=records.get(id);
 const line='- '+label+'：[['+target+'|'+name+']]。'+proof;
 editLine(fn(r.filename),l=>l.startsWith('- 核查边界：'),l=>line+'\n'+l);
 const file=candidate?path.join(root,'师承候选线索索引.md'):idx;
 editLine(file,l=>candidate?l==='# 师承候选线索索引':l.startsWith('- [['+r.filename+'|')&&l.includes('[['+after+'|'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+line.slice(2));
}
function newMentor(target,name,bio,student,reverse,proof){
 if(fs.existsSync(fn(target))||fs.existsSync(path.join(root,'师承人物',target+'.md')))throw Error('existing mentor '+target);
 const r=records.get(student);
 graph.set(fn(target),'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n\n- '+reverse+'：[['+r.filename+'|'+r.name+']]。'+proof+'\n');
}



const wind='f32a81db', ds='师承人物 - Dieter Strauch', os='师承人物 - Otto F. Sankey', jm='人员 - Arizona State - José Menéndez - 2bf43d5e';
const cv='https://people.engineering.osu.edu/media/document/2026-01-22/windl_cv_2p.pdf', old='https://people.engineering.osu.edu/media/document/2020-12-08/windl_cv_web.pdf';
const osu='https://mse.osu.edu/events/2023/12/mse-colloquium-wolfgang-windl-last-lecture-semiconductors-goniopolar-materials-or', aps='https://journals.aps.org/prb/abstract/10.1103/PhysRevB.57.2431';
const d='本人 CV 第二页 Regensburg 1995 博士条目明确列 Advisor: Prof. Dieter Strauch。';
const p='本人 CV 分列 ASU 1995–1996、Los Alamos T-12 1996–1997 两个博士后岗位及 Motorola 1997–2001 职位。APS 原论文作者单位把 Windl、Sankey、Menéndez 同列 Arizona State，且把 Windl 当时通讯地址注明为 Los Alamos T-12；稿件 1997 年 5 月收到，未明确 ASU 阶段正式指导人。Sankey 和 Menéndez 各列低可信合作候选，Los Alamos 阶段导师待查。';
enrich(wind,'phd',ds,'博士生',d);
note(wind,'- 核查边界：',web('2026 本人 CV',cv)+' · '+web('OSU 原讲座档',osu)+'。'+p);
note(wind,'- 院系／机构：',web('2026 本人 CV',cv)+'明确材料科学与工程系教授、物理系为 courtesy appointment。');
const pShort=web('本人 2026 CV',cv)+' · '+web('同期 APS 原文',aps)+'。'+p;
for(const [person,name] of [[os,'Otto F. Sankey'],[jm,'José Menéndez']]){
 addEdge(wind,'博士后导师候选',person,name,pShort,null,true);
 editLine(fn(person),l=>l==='## 师承',l=>l+'\n\n- 博士后研究者候选（待核）：[['+local(wind)+'|Wolfgang Windl]]。'+pShort);
}
changeRow(wind,'Dieter Strauch（本人 CV 明列博士 Advisor）','ASU 1995–1996：Sankey、Menéndez（低可信候选）；Los Alamos T-12 1996–1997：导师待查',web('本人 CV',cv)+' · '+web('同期 APS 原文',aps));
const id=audit(wind,{phd:['confirmed_advisor',d,[cv]],postdoc:['group_or_candidate',p,[cv,old,osu,aps]],affiliation:['confirmed','本人 2026 CV 核 Ohio State 材料科学与工程教授，物理系为 courtesy appointment。',[cv,osu]],research:['confirmed','OSU 院系原讲座涉及半导体和新型功能材料，研究方法包括第一性原理计算。',[osu,aps]]},'查 ASU 固体科学中心和 LANL T-12 早期任命或组名册，分两段核实正式博后指导者。');
relation(wind,'phd',ds,'advisor',d,[cv],id);
for(const [person] of [[os],[jm]])relation(wind,'postdoc',person,'candidate',p,[cv,aps],id);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Windl两段博后续查';
fs.writeFileSync(stamp+'_人工.json',JSON.stringify(audits,null,2)+'\n','utf8');
fs.writeFileSync(stamp+'_结构化.json',JSON.stringify(typed,null,2)+'\n','utf8');
for(const [file,content] of graph)fs.writeFileSync(file,content,'utf8');
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.review-'));
const temp=path.join(tmp,'audit.json');
try{
 for(const a of audits){
  fs.writeFileSync(temp,JSON.stringify(a),'utf8');
  console.log(execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',temp],{encoding:'utf8'}).trim());
 }
 console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
