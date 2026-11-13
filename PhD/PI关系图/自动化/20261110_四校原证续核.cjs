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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0730';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0730_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const fink='f7742f4b', ped='9ac3852d', shai='2adacf0a', ying='8d9bee3e', sar='eb9dc115';
const jo='人员 - MIT - John D. Joannopoulos — 纪念条目 - cbedf46d', th='人员 - Rice - Edwin “Ned” Thomas — 荣休 - 00a45f15', ch='师承人物 - Chiping Chen';
const bz='人员 - MIT - Martin Z. Bazant - a80a6b1d', gb='师承人物 - Guy Bartal', vv='师承人物 - Vladan Vuletić', xz='师承人物 - Xiang Zhang（UC Berkeley 光子学）', md='师承人物 - James D. Meindl';
const tlo='https://tlo.mit.edu/industry-entrepreneurs/researchers/yoel-fink', fibers='https://pbg-rle.mit.edu/yoel-fink/';
const pLab='https://www.desouza-lab.com/people', princ='https://bioengineering.princeton.edu/people/pedro-de-souza';
const scv='https://qsteap-lab.github.io/images/uploads/CV_Shai_Tsesses.pdf', slab='https://qsteap-lab.github.io/team.html';
const minn='https://cse.umn.edu/ece/events/quantum-materials-platform-nonlinear-electronic-and-memory-devices';
const ieee='https://sscs.ieee.org/wp-content/uploads/Meindl-Winter2021.pdf', stan='https://profiles.stanford.edu/krishna-saraswat', mse='https://mse.stanford.edu/people/krishna-saraswat';
function appendBeforeBoundary(id,line){editLine(fn(local(id)),s=>s.startsWith('- 核查边界：'),s=>line+'\n'+s);}
const fProof='MIT 技术许可办公室履历与本人 fibers@mit 页面均明确把博士论文写作 thesis under John Joannopoulos、Edwin Thomas、Chiping Chen。学位签署页各人具体角色仍待核。';
for(const target of [jo,th,ch])enrich(fink,'phd',target,'博士生',web('本人 fibers@mit 履历',fibers)+'在 MIT 博士论文条目同列三位指导者。');
changeRow(fink,'John D. Joannopoulos、Edwin Thomas、Chiping Chen（MIT 履历具名论文指导）','MIT 物理系博士后，个人导师待核',web('MIT 技术许可办公室',tlo)+' · '+web('本人组页',fibers));
const f=audit(fink,{phd:['confirmed_advisor',fProof,[tlo,fibers]],postdoc:['unresolved','MIT 机构履历和本人组页均确认材料博士后曾任 MIT 物理系博后，未具名指导人。',[tlo,fibers]],affiliation:['confirmed','MIT 技术许可办公室履历列材料科学与工程教授。',[tlo,fibers]],research:['confirmed','MIT 本人组页列自组装光子带隙材料、全向反射介质结构及光学纤维。',[tlo,fibers]]},'继续查 MIT 博士论文原始签署页以明确三人的签署角色，并查 MIT 物理系博后指导者。');
for(const target of [jo,th,ch])relation(fink,'phd',target,'advisor',fProof,[tlo,fibers],f,false);
const pProof='本人 UCLA 课题组履历明确 MIT 化工博士 under the supervision of Martin Bazant，研究界面附近的电解质结构和输运。Princeton 原档另列 Stone、Petry 为后续博后 advisers。';
enrich(ped,'phd',bz,'博士生',web('UCLA 本人组原档',pLab)+'明确区分 MIT 博士指导与后续 Princeton 博后。');
changeRow(ped,'Martin Z. Bazant（本人组履历明确博士指导）',null,web('本人组页',pLab)+' · '+web('Princeton 博后档',princ));
const p=audit(ped,{phd:['confirmed_advisor',pProof,[pLab]],postdoc:['confirmed_advisor','Princeton Omenn–Darling Bioengineering Institute 本人项目条目在 Advisers 下分别列 Howard Stone、Sabine Petry。',[princ,pLab]],affiliation:['confirmed','本人 UCLA 课题组履历列化学与生物分子工程系助理教授。',[pLab]],research:['confirmed','本人 UCLA 课题组履历列电解质界面结构、输运模型与软物质方向。',[pLab]]},'继续查 MIT 学位论文签署页，Princeton 两位 advisers 保留。');
relation(ped,'phd',bz,'advisor',pProof,[pLab,princ],p,false);
function refreshShai(stage,mentor,reverse,words){
 const label=stage==='phd'?'博士导师':'博士后导师';
 const update=s=>s.replace('旧 CV 本轮未能读取，正式称谓保留待重读。',words);
 editLine(fn(local(shai)),s=>s.startsWith('- '+label+'：')&&s.includes('[['+mentor+'|'),update);
 editLine(fn(mentor),s=>s.startsWith('- '+reverse+'：')&&s.includes('[['+local(shai)+'|'),update);
 editLine(idx,s=>s.startsWith('- [['+local(shai)+'|')&&s.includes(' → '+label+'：')&&s.includes('[['+mentor+'|'),update);
}
refreshShai('phd',gb,'博士生','由本人组网页链接直接读取 CV，核对 Advisor 原文。');
refreshShai('postdoc',vv,'博士后研究者','由本人组网页链接直接读取 CV，核对 Advisor 原文。');
changeRow(shai,'Guy Bartal（本人 CV 明列 Technion 博士 Advisor）','Vladan Vuletić（本人 CV 明列 2023–2027 MIT 博后 Advisor）',web('本人可读 CV',scv)+'；Wisconsin 2027 年拟入职。');
const sa=audit(shai,{phd:['confirmed_advisor','本人 CV 2016–2023 Technion Doctoral candidate 条目明确列 Advisor: Guy Bartal。',[scv,slab]],postdoc:['confirmed_advisor','本人 CV 2023–2027 MIT Post-Doctoral Fellow 条目明确列 Advisor: Vladan Vuletić。',[scv,slab]],affiliation:['confirmed','本人 CV 列 2027 起 Wisconsin ECE 助理教授，2026-11 应视为拟入职，MIT 博后截至 2027。',[scv]],research:['confirmed','本人组原档核自由电子、原子、光子物理与纳米光子学、量子光学。',[slab,scv]]},'到 2027 年核对 Wisconsin 到岗与招生；可继续获取 Technion 论文签署。');
relation(shai,'phd',gb,'advisor','本人 CV 在 Technion 博士条目直接列 Guy Bartal 为 Advisor。',[scv,slab],sa,false);
relation(shai,'postdoc',vv,'advisor','本人 CV 在 MIT 2023–2027 Post-Doctoral Fellow 条目直接列 Vladan Vuletić 为 Advisor。',[scv,slab],sa,false);
const yProof='Minnesota 电气与计算机工程讲座原档明确 Ying Wang 的 UC Berkeley 博士及博后训练均由 Xiang Zhang 指导；该档另核对 Wisconsin ECE 主任职及物理、材料关联。';
enrich(ying,'phd',xz,'博士生',web('Minnesota ECE 原档',minn)+'具名 Berkeley 博士指导，授位年份仍待论文原档核。');
replaceNoteLabel(ying,'博士后导师','博士后阶段研究师长',xz,' 讲座为明确的博后研究指导，继续查聘任 advisor 字段。');
replaceInverseLabel(xz,ying,'博士后研究者','博士后阶段研究者',' 讲座明确列指导，聘任 advisor 字段待核。');
replaceIndexLabel(ying,xz,'博士后导师','博士后阶段研究师长',' 讲座明确列指导，聘任 advisor 字段待核。');
changeRow(ying,'Xiang Zhang（UC Berkeley 博士研究指导）','Xiang Zhang（UC Berkeley 博士后阶段研究师长）',web('Minnesota ECE 讲座原档',minn));
const y=audit(ying,{phd:['confirmed_advisor',yProof,[minn]],postdoc:['group_or_candidate','Minnesota ECE 原讲座明确 UC Berkeley 博士后研究受 Xiang Zhang 指导，正式聘任的 advisor 字段待原档。',[minn]],affiliation:['confirmed','Minnesota ECE 原讲座列 Wisconsin ECE 助理教授与物理、材料关联。',[minn]]},'查 Berkeley 学位原档及授位年份差异，继续追查 Berkeley 博后正式任命。');
relation(ying,'phd',xz,'advisor',yProof,[minn],y,false);
const sProof='Saraswat 在 IEEE 本人纪念文明确写 1971–1974 Ph.D. degree studies under James Meindl，1975–1982 仍是其研究团队成员，1983 成为教师同事。Stanford 原档核 1974 EE 博士。';
enrich(sar,'phd',md,'博士生',web('IEEE Saraswat 本人回忆',ieee)+'明确博士阶段 1971–1974 under Meindl。');
appendBeforeBoundary(sar,'- 博士毕业后研究经历：'+web('IEEE 本人回忆',ieee)+'写 1975–1982 是 Meindl 研究团队成员，1983 成为教师同事。前段岗位职称及是否包括博后待原任命核。');
note(sar,'- 研究方向：',web('Stanford 现任原档',stan)+'核实电气工程系荣休及半导体薄膜、器件与互连研究。');
changeRow(sar,'James D. Meindl（本人明确博士指导）','1975–1982 Meindl 团队研究成员；具体岗位及博士后性质待核',web('本人 IEEE 回忆',ieee)+' · '+web('Stanford 教师档',stan));
editLine(path.join(root,'Stanford逐人复核记录.md'),l=>l.startsWith('| [['+local(sar)+'|'),l=>l.replace('电气工程系；','电气工程系（荣休）；'));
const s=audit(sar,{phd:['confirmed_advisor',sProof,[ieee,stan]],postdoc:['unresolved','本人明确 1975–1982 Meindl 研究团队成员、1983 任教，未单列博士后岗位，保留为毕业后研究经历。',[ieee]],affiliation:['confirmed','Stanford Profiles 与材料系原教师档确认电气工程荣休教授。',[stan,mse]],research:['confirmed','Stanford 原教师档列硅、锗与 III–V 半导体材料器件、互连与纳米电子技术。',[stan,mse]]},'查 1974–1975 及 1975–1982 原任命资料，区分博士后与其他研究员岗位。');
relation(sar,'phd',md,'advisor',sProof,[ieee,stan],s);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_四校原证续核';
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
