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
 a.audit_id='20261110_'+id+'_gatech_dissertation_1428';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_gatech_dissertation_1428_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.replace(/ \|\s*$/,'').split(' | ');if(cells.length<5)throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  const source=cells.splice(4).join('。 ');cells.push(source+' '+text+' |');
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

const xu='0a1c7de2', zl='师承人物 - Zhong Lin Wang', cs='师承人物 - Christopher J. Summers';
const thesis='https://repository.gatech.edu/bitstreams/1b8a0d72-04d1-4330-a87b-4837035d3757/download';
const story='https://www.cs.virginia.edu/~robins/Self_Powered_Nanotech.pdf';
const rsc='https://citeseerx.ist.psu.edu/document?doi=d73c490180b8df204a5230897730f3c4fb1e146f&repid=rep1&type=pdf';
const ieee='https://repository.gatech.edu/server/api/core/bitstreams/b3e8a9cd-47a0-4d0b-b914-c19ef1ecb601/content';
const wis='https://engineering.wisc.edu/directory/profile/xudong-wang/';
const title='Large-Scale Patterned Oxide Nanostructures: Fabrication, Characterization and Applications';
const ev='2005 年 Georgia Tech 材料科学与工程博士论文《'+title+'》签署页明确列 Zhong Lin Wang 为 Advisor、Christopher J. Summers 为 Co-Advisor。致谢再次把两人称为导师。';
const pe='2007 年 1 月发表的本人合著作者履历列 Xudong Wang 为 Georgia Tech Postdoctoral Fellow。Zhong Lin Wang 署名文章称其为自己的 postdoctoral assistant，并写明由其指导实验设计。另一期 Georgia Tech 托管的 2007 年论文作者履历称 Research Scientist，保留职称与时点的区别。';
const p=ev+' '+web('学位论文签署页与致谢',thesis)+'。';
const pp=pe+' '+web('Zhong Lin Wang 署名原文',story)+' · '+web('2007 年 1 月作者履历',rsc)+' · '+web('同年另一论文作者履历',ieee)+'。';
function putInverse(id,target,label,proof){
 editLine(fn(target),x=>/^## 师承(?:关系)?$/.test(x),x=>x+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}
function addAfterPrimary(id,primary,label,target,name,proof){
 const line='- '+label+'：[['+target+'|'+name+']]。'+proof;
 editLine(fn(local(id)),x=>x.startsWith('- 核查边界：'),x=>line+'\n'+x);
 editLine(idx,x=>x.startsWith('- [['+local(id)+'|')&&x.includes(' → 博士导师：')&&x.includes('[['+primary+'|'),x=>x+'\n- [['+local(id)+'|'+records.get(id).name+']] → '+line.slice(2));
}
replaceNoteLabel(xu,'博士阶段研究师长','博士导师',zl,' '+p);
replaceInverseLabel(zl,xu,'博士阶段研究者','博士生',' '+p);
replaceIndexLabel(xu,zl,'博士阶段研究师长','博士导师',' '+p);
addAfterPrimary(xu,zl,'博士共同导师',cs,'Christopher J. Summers',p);
putInverse(xu,cs,'博士生',p);
addAfterPrimary(xu,zl,'博士后阶段研究师长',zl,'Zhong Lin Wang',pp);
putInverse(xu,zl,'博士后阶段研究者',pp);
editLine(fn(local(xu)),x=>x.startsWith('- 核查边界：'),x=>x.replace(/^.*?(CUHK 深圳数据科学学院)/,'- 核查边界：博士两位导师见论文签署页。博士后记录为具名研究指导，任用上的正式导师称谓与起止月待核。 $1'));
changeRow(xu,'Zhong Lin Wang（博士导师）、Christopher J. Summers（博士共同导师）','Zhong Lin Wang（Georgia Tech 博士后阶段研究师长）；2007 Research Scientist 任用单列',p+' '+pp);
const xa=audit(xu,{
 phd:['confirmed_advisor',ev,[thesis]],
 postdoc:['group_or_candidate',pe,[story,rsc,ieee]],
 affiliation:['confirmed','Wisconsin 工程学院原档核其 MSE 教职。早期 Georgia Tech 同期论文与博士学位原件指同一材料研究者。',[wis,thesis]],
 research:['confirmed','Wisconsin 原档与学位论文分别核纳米材料、压电纳米器件与功能氧化物。',[wis,thesis]]
},'分别追 Georgia Tech 博后任用、正式 advisor 字段和 Research Scientist 起始时间；已核博士两位指导者。');
relation(xu,'phd',zl,'advisor',ev,[thesis],xa,false);
relation(xu,'phd',cs,'advisor',ev,[thesis],xa,false);
relation(xu,'postdoc',zl,'stage_mentor',pe,[story,rsc,ieee],xa,false);

const fu='48e0d021', sch='人员 - UC San Diego - Ivan K. Schuller - 20dc4163';
const doe='https://www.osti.gov/servlets/purl/5430644', hist='https://www.youtube.com/watch?v=N4dAStCA-uE';
const fEv='DOE 项目报告在 Doctoral Theses 段列 1991 年 9 月 UCSD 论文《Quantitative Structural and Elastic Characterization of Superlattices》。报告未列正式导师。Computer History Museum 本人口述视频已定位，未取得逐字稿。Schuller 维持候选。';
const fp=fEv+' '+web('DOE 项目报告',doe)+'。';
note(fu,'- 核查边界：',fp);changeRow(fu,null,null,fp);
mentorLine(sch,fu,'- 博士候选研究者：',fp);indexLine(fu,sch,'博士候选关系',fp);
const fa=audit(fu,{phd:['group_or_candidate',fEv,[doe,hist]]},'按准确题名寻找 UC San Diego 或纸本签署页；继续定位 CHM 馆藏逐字稿，并查 Argonne 博后阶段个人指导。');
relation(fu,'phd',sch,'candidate',fEv,[doe,'https://ischuller.ucsd.edu/group-mobile/'],fa,false);

const br='人员 - Columbia - David R. Reichman - 38d42d59';
const bNow='https://berkelbach.chem.columbia.edu/index.html', d='https://science.osti.gov/-/media/wdts/scgf/pdf/2010Profiles/BerkelbachT-2012Profile.pdf';
const bEv='本人组页核 Columbia 2019 入职、2022 tenure、2026 升任化学系正教授，并列 Flatiron Senior Research Scientist 和 Initiative for Computational Catalysis Co-Director；2016–2018 Chicago 任职是历史。';
const bPh='本人 DOE 读博履历直接确认在 Reichman 理论化学组研究，保留博士课题组负责人；导师正式职衔待论文原件。';
for(const [id,back,index] of [
 ['41c1e5a1','- 博士阶段课题组成员：','博士阶段课题组负责人'],
 ['cff12e56','- 博士课题组成员：','博士课题组']
]){
 const bp=bEv+' '+web('本人组页',bNow)+'。';
 note(id,'- 核查边界：',bp);changeRow(id,null,null,bp);
 if(id==='cff12e56'){
   note(id,'- 博士阶段课题组负责人：',bPh+' '+web('本人 DOE 在读档',d)+'。');
   mentorLine(br,id,back,bPh+' '+web('本人 DOE 在读档',d)+'。');
   indexLine(id,br,index,bPh+' '+web('本人 DOE 在读档',d)+'。');
 }
 const ba=audit(id,{
   affiliation:['confirmed',bEv,[bNow]],
   research:['confirmed','本人组页明确凝聚态物理与材料科学交叉的理论与计算化学。',[bNow]]
 },'保留博士组属与 Princeton 博后组属，继续追 Columbia 学位论文签署页和 Chan 指导原证。');
 if(id==='cff12e56')relation(id,'phd',br,'group_leader',bPh,[d,'https://reichmangroup.chem.columbia.edu/directory'],ba,false);
}


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Wang学位与阶段原档';
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

