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
 a.audit_id='20261110_'+id+'_monticone_kikkawa_1038';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_monticone_kikkawa_1038_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const mt='d4792644', kk='0052a7c3', alu=local('b1a7ef00');
const mA='https://ece.utexas.edu/news/dr-francesco-monticone-awarded-inaugural-margarida-jacome-dissertation-prize';
const mV='https://bpb-us-w2.wpmucdn.com/sites.coecis.cornell.edu/dist/f/76/files/2016/07/CV_Francesco_Monticone_October_2018-277q67c.pdf';
const mF='https://www.duffield.cornell.edu/people/francesco-monticone/';
const mE='Texas ECE 论文奖原页与本人 CV 第 1 页一致列 Andrea Alù 指导博士论文，博士为 2016 年。本人 CV 第 2 页列 2016 年 12 月结束 UT Austin 研究生助研，2017 年 1 月开始 Cornell ECE 教职。2015 年 AMOLF 项目为博士阶段学生访问，任职表未列独立博士后。';
enrich(mt,'phd',alu,'博士生',web('Texas ECE 论文奖原档',mA)+'。'+mE);
editLine(fn(local(mt)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('本人 CV 第 1–2 页',mV)+'。'+mE);
changeRow(mt,'Andrea Alù（博士导师；论文奖原档与本人 CV）','2016-12 完成博士阶段，2017-01 入 Cornell；所阅履历未列独立博士后',web('Texas ECE 论文奖原档',mA)+' · '+web('本人 CV 第 1–2 页',mV));
const ma=audit(mt,{phd:['confirmed_advisor',mE,[mA,mV]],postdoc:['no_postdoc_documented',mE,[mV,mF]],affiliation:['confirmed','Cornell 现任院系档列 ECE 副教授及研究生项目主任。',[mF]],research:['confirmed','Cornell 院系档核应用电磁、超材料、超表面及理论纳米光子学。',[mF]]},'论文签署页可独立复核；如出现 Cornell 入职前另有独立博士后聘任证据，再补该段。');
relation(mt,'phd',alu,'advisor',mE,[mA,mV],ma,false);

const kT='https://www.sccs.swarthmore.edu/users/05/viva/spinsources/spinsources.pdf';
const kM='https://www.physics.mcgill.ca/events/98/PSC_kikkawa.html';
const kP='https://almanac.upenn.edu/archive/v47pdf/010306/030601.pdf';
const kA='https://repository.upenn.edu/server/api/core/bitstreams/7287e673-f9af-4d71-a20a-21807ebda285/content';
const kE='Penn 校档与 Penn 学位论文首页相互核对 Jay 与 James M. Kikkawa。Swarthmore 托管书目第 9 条将 Aspects of Magnetic Organization in Semiconductor Heterostructures 列为 James M. Kikkawa 于 1997 年 12 月在 UCSB 的论文，是继续调档的题名线索。1999 年 McGill 讲座仍列 UCSB 物理系，自旋输运，未注明聘任或指导者。';
const kProof=[web('书目第 9 条',kT),web('1999 McGill 讲座',kM),web('Penn 校档',kP),web('Penn 学位论文首页',kA)].join(' · ')+'。'+kE;
note(kk,'- 核查边界：',kProof);
changeRow(kk,null,'1999 仍列 UCSB 物理系；聘任类别与个人指导待核',web('1999 McGill 讲座',kM)+' · '+web('论文题名书目',kT)+' · '+web('Penn 校档',kP));
audit(kk,{postdoc:['unresolved',kE,[kM,kT,kA]],affiliation:['confirmed','Penn 校刊档列物理与天文系；McGill 1999 档注明此前 UCSB 物理系。',[kP,kM]],research:['confirmed','Penn 校刊和 McGill 讲座核半导体自旋相干、光学共振与自旋输运。',[kP,kM]]},'用 James M. Kikkawa 和题名定向查 UCSB 馆藏签署页、1998–2000 聘任原档；博士课题组关系保持。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_MonticoneKikkawa论文与任职';
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
