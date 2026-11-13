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
 a.audit_id='20261110_'+id+'_roles_1011';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_roles_1011_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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






function inverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}

const ring='b199c807', cet='afb50d61', king='f999ab1f';
const rc='https://ece.osu.edu/sites/default/files/uploads/steve_ringel_complete_cv_april_13_2020_without_funding.pdf';
const rl='https://ece.osu.edu/emdl', rg='https://ece.gatech.edu/directory/ajeet-rohatgi';
const rd='师承人物 - Ajeet Rohatgi';
const re='Ringel 本人 2020 CV 列 Georgia Tech 1991 博士及同年起 Ohio State 电气工程教职，所阅任职栏未分列独立博后。本人实验室公开书目列 1988、1991 年与 Ajeet Rohatgi 合作光伏研究；Georgia Tech 系档核 Rohatgi 自 1985 年任教并主持光伏研究。暂无个人指导证据。';
const rp=web('本人 CV',rc)+' · '+web('Ohio State 实验室书目',rl)+' · '+web('Georgia Tech 院系档',rg)+'。'+re;
addEdge(ring,'博士导师候选',rd,'Ajeet Rohatgi',rp,null,true);
newMentor(rd,'Ajeet Rohatgi','Georgia Tech 电气与计算机工程、光伏。'+web('院系原档',rg),ring,'博士候选研究者',rp);
note(ring,'- 核查边界：',rp);
changeRow(ring,'Ajeet Rohatgi（低可信博士候选）','1991 起 Ohio State 教职，所阅 CV 未分列独立博后',rp);
const ra=audit(ring,{phd:['group_or_candidate',re,[rc,rl,rg]],postdoc:['no_postdoc_documented',re,[rc]],affiliation:['confirmed','Ohio State 电气与计算机工程。',[rc,rl]],research:['confirmed','本人实验室公开资料与履历列半导体光电与材料。',[rc,rl]]},'向 Georgia Tech 查 1991 年学位档、签署页或光伏中心早期档案。');
relation(ring,'phd',rd,'candidate',re,[rc,rl,rg],ra);

const cc='https://cua.mit.edu/people/marko-cetina', ci='https://iqoqi.at/en/people/former-members/formermembers';
const cm='https://www.umdphysics.umd.edu/images/Monroe_CV.pdf', cl='https://iontrap.duke.edu/people/', cd='https://ece.duke.edu/people/marko-cetina/';
const ce='MIT CUA 原档核 MIT 2011 博士。既有 MIT 短期博后组属由同组学生原论文所载。IQOQI 名录将其列为 Grimm Lab Junior Scientist。Monroe 2017 CV 第 18 页在 Research Scientists 栏列 Maryland 自 2015 起，Duke 同组页列 Research Scientist 2016–2020；起点差异保留。两份名单的原岗位与 MIT 短期博后分开。';
const cp=web('MIT CUA 档案',cc)+' · '+web('IQOQI 旧成员名录',ci)+' · '+web('Monroe 2017 CV 第 18 页',cm)+' · '+web('Duke Monroe 组',cl)+'。'+ce;
note(cet,'- 核查边界：',cp);
changeRow(cet,null,'Vladan Vuletić（MIT 博后课题组）；其后 IQOQI 与 Maryland／Duke 档列研究岗位',cp);
audit(cet,{postdoc:['group_or_candidate',ce,[cc,ci,cm,cl]],affiliation:['confirmed','Duke 院系原档列物理及电气与计算机工程任职。',[cd]],research:['confirmed','Duke 院系与 MIT CUA 原档支持离子阱、量子信息和量子模拟。',[cd,cc]]},'核 MIT 短期博士后聘任与正式指导者；补 IQOQI 与 Maryland 研究任职的分段日期。');

const kc='https://vivo.brown.edu/docs/a/aikingon_cv.pdf?dt=251910191', kd='https://mse.ncsu.edu/research/davis-lecture-series/';
const kb='https://ise.brown.edu/people/angus-i-kingon', km='师承人物 - Robert F. Davis';
const ke='本人 2022 CV 第 1 页列 Penn State 和 NC State 1981–1982 博后，第 31–32 页书目含 1982 年与 Davis 合作的 SiC 报告及 1983 年合著。NC State 系档核 Davis 1972–2004 任教。Davis 仅为 NC State 阶段的低可信候选，Penn State 指导者和两段各自日期待查。';
const kp=web('Brown 本人 CV',kc)+' · '+web('NC State 材料系档案',kd)+'。'+ke;
addEdge(king,'博士后导师候选',km,'Robert F. Davis',kp,null,true);
inverse(king,km,'博士后候选研究者',kp);
note(king,'- 核查边界：',kp);
changeRow(king,null,'Penn State、NC State 博后合计 1981–1982；Robert F. Davis（NC State 低可信候选）',kp);
const ka=audit(king,{postdoc:['group_or_candidate',ke,[kc,kd]],affiliation:['confirmed','Brown 能源项目原页与本人 CV 核 Brown 工程学院任职。',[kb,kc]],research:['confirmed','Brown 能源项目原页列电子薄膜、功能氧化物、压电和铁电材料。',[kb,kc]]},'查 1981–1982 Penn State、NC State 原始任命档及 University of South Africa 1981 博士签署件。');
relation(king,'postdoc',km,'candidate',ke,[kc,kd],ka);


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_RingelCetinaKingon角色复核';
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
