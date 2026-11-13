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
 a.audit_id='20261110_'+id+'_official_alumni_0922';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_official_alumni_0922_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const islam='f6811f76', wan='45a13a33', wu=local('0cf0b545'), tung='师承人物 - Vincent C. Tung';
const iUcla='https://www.ee.ucla.edu/alumni-in-acedemia-2/', iWu='https://people.eecs.berkeley.edu/~wu/people.htm', iC='https://citris-uc.org/people/person/m-saif-islam/';
const wNews='https://ksc.kaust.edu.sa/docs/default-source/default-document-library/ksc-newsletter_7.pdf', wNus='https://cde.nus.edu.sg/mse/staff/yi-wan/';
const ie='UCLA 电气与计算机工程系学术校友名单明确列 Saif Islam 的 Advisor 为 Ming C Wu、去向为 UC Davis。CITRIS 确认 2001 年 UCLA ECE 博士，Wu 本人组档用 M. Saiful Islam 并列同一毕业年及去向。';
const ip=web('UCLA ECE 官方校友名录',iUcla)+' · '+web('Ming C. Wu 原实验室档',iWu)+' · '+web('CITRIS 学位履历',iC)+'。'+ie;
const il='- [['+local(islam)+'|M. Saif Islam]] → ';
function replaceProof(file,label,target,newLabel,proof){
 editLine(file,l=>l.startsWith(label)&&l.includes('[['+target+'|'),l=>{
  const end=l.indexOf(']]',l.indexOf('[['+target+'|'))+2;
  return l.slice(0,end).replace(label,newLabel)+'。'+proof;
 });
}
replaceProof(fn(local(islam)),'- 博士课题组负责人：',wu,'- 博士导师：',ip);
replaceProof(fn(wu),'- 博士课题组成员：',local(islam),'- 博士生：',ip);
replaceProof(idx,il+'博士课题组负责人：',wu,il+'博士导师：',ip);
editLine(fn(local(islam)),l=>l.startsWith('- 博士关系证据：'),()=>'- 博士关系证据：'+ie);
editLine(fn(local(islam)),l=>l.startsWith('- 核查边界：'),l=>l.replace(/^.*?(?=2008 论文作者简介)/,'- 核查边界：UCLA ECE 校友名录已明确博士导师。'));
changeRow(islam,'Ming C. Wu（UCLA ECE 明列 Advisor）',null,web('UCLA ECE 校友原档',iUcla));
const ia=audit(islam,{phd:['confirmed_advisor',ie,[iUcla,iWu,iC]]},'查 HP Labs 或 JDS 任职原档与完整 CV，区分博士后职位、年份及个人指导。');
relation(islam,'phd',wu,'advisor',ie,[iUcla,iWu,iC],ia,false);

const we='KAUST Solar Center 2022 年春季简报第 14 页，Recent Ph.D Graduates 段逐项列博士答辩。Yi Wan 条目给出论文题名 Toward Controlled Growth of Two-Dimensional Transition Metal Dichalcogenides: Chemical Vapor Deposition Approaches，并明确列 Vincent C. Tung 指导。';
const wp=web('KAUST Solar Center 2022 春季原简报第 14 页',wNews)+'。'+we;
enrich(wan,'phd',tung,'博士生',wp);
editLine(fn(local(wan)),l=>l.startsWith('- 核查边界：'),l=>l.replace(/^.*?(?=其后港大)/,'- 核查边界：KAUST 原毕业生简报已取得正文并核到具名博士导师。论文签署原件继续待查。'));
changeRow(wan,'Vincent C. Tung（KAUST 博士毕业名录明确监督）',null,web('KAUST 博士毕业原档',wNews));
const wa=audit(wan,{phd:['confirmed_advisor',we,[wNews,wNus]]},'追查港大正式人事履历与完整 CV；确认是否另有独立博士后及个人指导。');
relation(wan,'phd',tung,'advisor',we,[wNews,wNus],wa,false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_UCLA和KAUST校友原档';
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
