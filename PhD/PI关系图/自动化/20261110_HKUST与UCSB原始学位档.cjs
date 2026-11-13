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
 a.audit_id='20261110_'+id+'_dissertations_0924';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_dissertations_0924_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const ah='60607f36', xin='5822368e', stem=local('8c19735f');
const ucsb='https://www.materials.ucsb.edu/people/our-alumni/record-dissertations', cv='https://ascnet.osu.edu/storage/request_documents/6126/QuGIP%20Proposal%20-%20Revision%203-3-25.pdf', osu='https://mse.osu.edu/people/ahadi.4', nc='https://mse.ncsu.edu/wp-content/uploads/2023/02/MSE_Newsletter_Fall2020-2.pdf';
const xTh='https://researchportal.hkust.edu.hk/en/studentTheses/residual-stresses-in-mems-thin-films/';
const he='Ohio State 托管的本人 NSF 履历列 2019 年 12 月 UCSB 材料博士及 2020–2023 NC State 助理教授；NC State 2020 年院系简报称其从 UCSB 入职。所阅履历未列独立博士后职位。';
const hp=web('Ohio State 本人 NSF 履历',cv)+' · '+web('NC State 2020 院系简报',nc)+'。'+he;
const de='UCSB 材料系博士毕业名录明确列论文 Cooperative Orders in Complex Oxide Heterostructures 由 Susanne Stemmer 指导。';
enrich(ah,'phd',stem,'博士生',web('UCSB 博士毕业原档',ucsb)+'。'+de);
note(ah,'- 核查边界：',hp);
changeRow(ah,'Susanne Stemmer（UCSB 博士毕业名录明列）','所阅未列独立博后；2020 起任 NC State 助理教授',web('UCSB 博士毕业原档',ucsb)+' · '+web('Ohio State 本人履历',cv)+' · '+web('NC State 2020 简报',nc));
const ha=audit(ah,{phd:['confirmed_advisor',de,[ucsb]],postdoc:['no_postdoc_documented',he,[cv,nc]],affiliation:['confirmed','Ohio State 原档列材料科学与工程、电气与计算机工程双聘。',[osu]],research:['confirmed','Ohio State 原档列量子材料外延、生长表征及电子输运。',[osu]]},'保留短期博士后经历的可能性，若出现 2019–2020 有确切日期的独立任命记录再核。');
relation(ah,'phd',stem,'advisor',de,[ucsb],ha,false);

const xe='HKUST Research Portal 的 1998 博士学位记录作者 Xin Zhang，论文题名 Residual Stresses in MEMS Thin Films，研究与既有本人履历相符。当前可读目录未列导师，学位原文未读，保留两个低可信博士候选。';
note(xin,'- 核查边界：',web('HKUST 博士目录',xTh)+'。'+xe);
changeRow(xin,null,null,web('HKUST 学位原档',xTh));
audit(xin,{identity:['confirmed',xe,[xTh]],phd:['group_or_candidate',xe,[xTh]]},'查 HKUST 题页或可公开的导师记录，并查 MIT Microsystems Technology Laboratories 博后个人指导原档。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_HKUST与UCSB原始学位档';
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
