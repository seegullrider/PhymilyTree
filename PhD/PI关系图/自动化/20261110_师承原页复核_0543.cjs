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
function row(id,text,postdoc=null){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';return cells.join(' | ');
 });
}
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
 a.audit_id='20261110_'+id+'_named_postdoctoral_supervision_0543';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_postdoc_0543_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

function addRelation(id,label,target,display,detail,inverseLabel){
 const r=records.get(id);
 editLine(fn(r.filename),l=>l==='## 师承',l=>l+'\n\n- '+label+'：[['+target+'|'+display+']]。'+detail);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- '+inverseLabel+'：[['+r.filename+'|'+r.name+']]。'+detail);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+label+'：[['+target+'|'+display+']]。'+detail);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}


const lo='a0f9c464', ne=local('a42f19ee'), rz='师承人物 - Ricardo Ruiz';
const ch='https://pme.uchicago.edu/directory/alumni/whitney-loo', wi='https://engineering.wisc.edu/directory/profile/whitney-loo/', nw='https://www.mccormick.northwestern.edu/chemical-biological/news-events/events/?eid=639155';
const lp='芝加哥大学 PME 同期档列 2020 年加入为博士后研究员并明确 Paul Nealey 监督；Wisconsin 与 Northwestern 档案分列 UChicago 的 Nealey 和 LBNL Molecular Foundry 的 Ricardo Ruiz 联合阶段。Ruiz 仍为该阶段研究师长，未具名正式监督。';
const la=audit(lo,{
 postdoc:['confirmed_advisor',lp,[ch,wi,nw]],
 affiliation:['confirmed','Wisconsin 本人教师页列 2023 年 1 月入职化学与生物工程系。',[wi]],
 research:['confirmed','UW 工程及 Northwestern 讲座对应聚合物物理、电池电解质和纳米光刻。',[wi,nw]]
},'查 LBNL 联合博士后任命，确定 Ruiz 是否正式共同指导并复核两个单位的日期。');
enrich(lo,'postdoc',ne,'博士后研究者',web('UChicago PME 同期档',ch)+'明示 Nealey 监督；'+web('UW 教师档',wi)+'将此岗位与 LBNL 联合研究分列。');
const lr=web('UW 工程学院',wi)+'明确联合博后，LBNL Molecular Foundry 阶段与 Ricardo Ruiz 共事。';
note(lo,'- 博士后阶段研究师长：',lr);
mentorLine(rz,lo,'- 博士后阶段研究者：',lr);
indexLine(lo,rz,'博士后阶段研究师长',lr);
changeRow(lo,null,'Paul Nealey（UChicago 博士后导师）；Ricardo Ruiz（LBNL Molecular Foundry 联合博后研究师长）',web('UW 工程学院',wi)+' · '+web('Northwestern 讲座',nw));
relation(lo,'postdoc',ne,'advisor',lp,[ch,wi,nw],la,false);

const z='dd219114', chk=local('7dbc10da'), el='https://www.mep.tum.de/fileadmin/w00bvc/mep/pdf/_2021_Electrochem._Soc._Interface_30_62.pdf', ut='https://ut.econnect.utexas.edu/tmijanuary2024';
const zp='2021 电化学学会获奖原档明确 Jingxu (Kent) Zheng 为 MIT 博士后研究者 under the supervision of Joseph Checkelsky，Texas Materials Institute 本人访谈交叉证实 MIT 物理博后及 Cornell 化工博士分段。';
const za=audit(z,{
 postdoc:['confirmed_advisor',zp,[el,ut]],
 affiliation:['confirmed','Texas Materials Institute 个人访谈列 UT Austin McKetta 化工系与 TMI。',[ut]],
 research:['confirmed','本人访谈区分 Cornell 电池研究与 MIT 外延生长、量子材料，UT Austin 聚焦结晶材料电化学合成。',[ut]]
},'查 MIT 博后完整任期和个人任命原件；继续核 Cornell 学位签署。');
enrich(z,'postdoc',chk,'博士后研究者',web('电化学学会同期获奖原档',el)+'在该博士后岗位的传记中直接指名监督；任命书待查。');
changeRow(z,null,'Joseph Checkelsky（MIT 博士后导师，同期原档指名监督）',web('2021 电化学学会原档',el));
relation(z,'postdoc',chk,'advisor',zp,[el,ut],za,false);

const j='107d0329', al=local('9209cf4f'), jUI='https://chemistry.illinois.edu/news/2024-01-08/prashant-jain-invested-gl-clark-professor-physical-chemistry', jc='https://chemistry.illinois.edu/system/files/inline-files/finaleditionfw2011.pdf';
const jp='Illinois 2011 本人采访明确 Berkeley Miller 博后研究受 Paul Alivisatos 指导，2024 化学系报道独立核实第二阶段；第一段 Harvard Adam Cohen 实验室按课题组负责人分列。';
const ja=audit(j,{
 postdoc:['confirmed_advisor',jp,[jc,jUI]],
 affiliation:['confirmed','Illinois 化学系原档列 G. L. Clark 物理化学教授、Materials Research Lab、物理系与 IQUIST 关联。',[jUI]],
 research:['confirmed','Illinois 化学系列纳米尺度光与物质、等离激元、光化学及固态材料输运。',[jUI]]
},'查 Harvard 博后任命是否明确 Adam Cohen 为个人导师；核 Berkeley Miller 任期原档。');
enrich(j,'postdoc',al,'博士后研究者',web('Illinois 本人采访',jc)+'在 Miller 博后经历中具名指出 Alivisatos 指导，Harvard Cohen 组单独。');
changeRow(j,null,'Adam Cohen（Harvard 博后课题组负责人）；Paul Alivisatos（Berkeley Miller 博后导师）',web('Illinois 2024 校方档',jUI));
relation(j,'postdoc',al,'advisor',jp,[jc,jUI],ja,false);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0543';
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
