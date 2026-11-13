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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0723';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0723_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const lee='4e9fe350', pat='57a4cee2', kan='2b126dcf', rav='4f26fb86';
const mark='师承人物 - Markus Schmidt', russ='师承人物 - Philip Russell', or='师承人物 - Rachel O’Reilly', bart='师承人物 - Neil Bartlett', kim='人员 - Harvard - Philip Kim - be1d4c3b';
const h='https://sites.google.com/uci.edu/lee-lab/home/members/dr-howard-lee';
const w='https://oreillygrouplab.com/past-members/';
const lbl='https://foundry.lbl.gov/2023/04/13/joe-patterson-uc-irvine/';
const uci='https://www.faculty.uci.edu/profile/?facultyId=6454';
const kanCv='https://ptacts.uspto.gov/ptacts/public-informations/petitions/1463884/download-documents?artifactId=7er4Ts05DY1MiQkzDod_RKYENKdRolS-deqikv8oDjDZfst58AUXBGw';
const med='https://www.chemistry.ucla.edu/news/2026-glenn-t-seaborg-medalist/';
const usc='https://viterbi.usc.edu/directory/cv/ravichandran_jayakanth_cv.pdf';
const hProof='本人 UCI 课题组第一人称履历明确写 Max Planck 物理博士研究由 Philip Russell 与 Markus Schmidt 共同指导；硕士导师 Kin Seng Chiang 另列。';
enrich(lee,'phd',mark,'博士生',web('本人 UCI 实验室履历',h)+hProof);
enrich(lee,'phd',russ,'博士生',web('本人 UCI 实验室履历',h)+'在博士条目具名共同指导，并另称 Russell 为本人 advisor。');
changeRow(lee,'Philip Russell、Markus Schmidt（本人履历列博士共同指导）',null,web('本人 UCI 实验室履历',h));
const a=audit(lee,{phd:['confirmed_advisor',hProof,[h]]},'查德国授位大学签署的博士学位目录及两位共同指导者职衔，保留已明确本人指认。');
relation(lee,'phd',mark,'advisor',hProof,[h],a,false);
const pProof='LBNL Molecular Foundry 官方讲座简介明确 2013 Warwick 博士 under the supervision of Rachel O’Reilly；O’Reilly 原组过去成员以 Joseph Patterson 列同年毕业。';
enrich(pat,'phd',or,'博士生',web('LBNL Molecular Foundry 原档',lbl)+pProof+' '+web('O’Reilly 原组校友档',w));
note(pat,'- 研究方向：',web('UCI 教师档',uci)+'核软物质形成、电子显微学和功能纳米材料。');
changeRow(pat,'Rachel O’Reilly（Warwick 2013 博士指导）',null,web('LBNL Molecular Foundry 原档',lbl)+' · '+web('O’Reilly 原组校友档',w));
const b=audit(pat,{phd:['confirmed_advisor',pProof,[lbl,w]],affiliation:['confirmed','UCI 本人教师档列 Chemistry；LBNL 官方讲座同证。',[uci,lbl]],research:['confirmed','UCI 教师档核软物质动态、自组装及电子显微学。',[uci,lbl]]},'查 Warwick 论文原件，继续追查 Prather 与 Sommerdijk 的正式博后指导称谓。');
relation(pat,'phd',or,'advisor',pProof,[lbl,w],b,false);
const kProof='USPTO 档案保存的 Kaner 本人 CV 在 Professional Positions 下列 1984–1986 UC Berkeley 化学 Postdoctoral Fellow，明确写 Advisor: Neil Bartlett。UCLA 2026 机构报道核对 Berkeley 博后经历。';
enrich(kan,'postdoc',bart,'博士后研究者',web('USPTO 保存的本人 CV',kanCv)+kProof);
changeRow(kan,null,'Neil Bartlett（本人 CV 明列 1984–1986 Berkeley 博后 Advisor）',web('USPTO 保存的本人 CV',kanCv));
const d=audit(kan,{postdoc:['confirmed_advisor',kProof,[kanCv,med]],affiliation:['confirmed','本人 CV 列 UCLA 化学与材料科学及工程 Distinguished Professor，UCLA 2026 奖项公告核对。',[kanCv,med]]},'追查 Penn 正式博士签署页，保留 MacDiarmid 与 Heeger 博士阶段研究师长。');
relation(kan,'postdoc',bart,'advisor',kProof,[kanCv,med],d,false);
const rProof='本人 USC CV 分列 2012 年 1 月–2014 年 5 月 Columbia 博后、2014 年 6–12 月 Harvard 博后，并在两条均列 Mentor: Philip Kim；博士条目用 Advisors 区分。';
replaceNoteLabel(rav,'博士后导师','博士后阶段研究师长',kim,' 两段的正式聘任 advisor 字段待核。');
replaceInverseLabel(kim,rav,'博士后研究者','博士后阶段研究者',' 两段在本人履历均列 Mentor。');
replaceIndexLabel(rav,kim,'博士后导师','博士后阶段研究师长',' 两段在本人履历均列 Mentor。');
editLine(fn(local(rav)),s=>s.startsWith('- 核查边界：'),()=>'- 核查边界：Columbia 与 Harvard 两段在本人 CV 均列 Kim 为 Mentor，图中使用一条阶段研究师长关系并保留两个时段。');
changeRow(rav,null,'Philip Kim（Columbia 2012–2014、Harvard 2014，CV 明列两段 Mentor）',web('本人 USC CV',usc));
audit(rav,{postdoc:['group_or_candidate',rProof,[usc]]},'追查 Columbia 和 Harvard 两段任命的正式 advisor 字段，已明确保留两个项目师长时段。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_第二批角色复核';
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
