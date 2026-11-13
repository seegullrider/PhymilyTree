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
 a.audit_id='20261110_'+id+'_lab_postdoc_0942';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_lab_postdoc_0942_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const v='8061fc19', k=local('c00c4b7e'), h='师承人物 - Kunlun Hong', pop='9f3e5309', f='师承人物 - Alan B. Fowler', tre='807e2742';
const th='https://thesis.caltech.edu/558/13/Verduzcothesis.pdf', rice='https://profiles.rice.edu/faculty/rafael-verduzco', cv='https://profiles.rice.edu/sites/g/files/bxs3881/files/2022-12/Verduzco%20CV_Full%20Apr2022.pdf', nist='https://www.ncnr.nist.gov/programs/sans/pdf/publications/0733.pdf', hc='https://www.ornl.gov/sites/default/files/Kunlun%20Hong_CV.pdf';
const mgl='https://nationalmaglab.org/staff/?name=DraganaPopovic', fsu='https://physics.fsu.edu/person/dragana-popovic', ibm='https://research.ibm.com/publications/resonant-tunneling-and-hopping-through-a-series-of-localized-states-in-a-two-dimensional-electron-gas', ifo='https://research.ibm.com/publications/semiconductor-science-the-fourth-generation';
const ctre='https://www.chem.columbia.edu/events/thesis-defense-chemistry-presented-sean-michael-treacy', at='https://experts.azregents.edu/en/persons/michael-treacy/';
const ve='本人 Rice CV 列 2007-03–2009-06 Oak Ridge CNMS 博后。NIST 保存的同期作者原文将 Rafael Verduzco 与 Kunlun Hong 同署 Oak Ridge CNMS。Hong 的 ORNL 本人 CV 记其聚合物研发任职。仅列 Kunlun Hong 为低可信博后候选。';
const vp=web('Rice 本人 CV',cv)+' · '+web('NIST 托管同期论文',nist)+' · '+web('ORNL Hong 本人 CV',hc)+'。'+ve;
enrich(v,'phd',k,'博士生',web('Caltech 博士论文原文',th)+'致谢第 iv 页明确称 Julia A. Kornfield 为 academic advisor。');
addEdge(v,'博士后导师候选',h,'Kunlun Hong',vp,null,true);
newMentor(h,'Kunlun Hong','Oak Ridge CNMS 聚合物与材料研究。'+web('ORNL 本人 CV',hc)+'。',v,'博士后候选研究者',vp);
note(v,'- 核查边界：',web('同期原论文',nist)+'支持 Kunlun Hong 为博后阶段同中心合作者，暂列候选。');
changeRow(v,null,'Oak Ridge 2007–2009；Kunlun Hong（低可信候选）',web('Rice 本人现任档',rice)+' · '+web('NIST 同期论文原文',nist));
const va=audit(v,{phd:['confirmed_advisor','Caltech 原论文第 iv 页明确列 Julia A. Kornfield 为 academic advisor。',[th]],postdoc:['group_or_candidate',ve,[cv,nist,hc]],affiliation:['confirmed','Rice 原档列 Chemical and Biomolecular Engineering 讲席教授及副系主任。',[rice]],research:['confirmed','Rice 原档列聚合物、软材料及有机电子材料。',[rice]]},'查 ORNL CNMS 2007–2009 fellowship host、个人指导记录和同期组档。');
relation(v,'postdoc',h,'candidate',ve,[cv,nist,hc],va);

const pe='MagLab 本人页列 1990-04–1993 IBM Watson 博后。IBM 1991 同期原文列 Dragana Popović、A. B. Fowler 和 S. Washburn；IBM 早期研究档记录 Fowler 的半导体研究。Fowler 列低可信博后候选，Washburn 继续作为同期合作线索。';
const pp=web('MagLab 本人履历',mgl)+' · '+web('IBM 1991 同期论文',ibm)+' · '+web('IBM Fowler 原档',ifo)+'。'+pe;
addEdge(pop,'博士后导师候选',f,'Alan B. Fowler',pp,null,true);
newMentor(f,'Alan B. Fowler','IBM 半导体物理研究者。'+web('IBM Fowler 原档',ifo)+'。',pop,'博士后候选研究者',pp);
note(pop,'- 核查边界：',web('IBM 同期原论文',ibm)+'将 Fowler 与 Washburn 具名为合作者，Fowler 暂作低可信博后候选。');
changeRow(pop,null,'Brown、IBM Watson 两段；Alan B. Fowler 为 IBM 阶段低可信候选',web('IBM 同期原论文',ibm));
const pa=audit(pop,{postdoc:['group_or_candidate',pe,[mgl,ibm,ifo]],affiliation:['confirmed','FSU Physics 与 MagLab 原档列凝聚态实验教职及实验室任职。',[fsu,mgl]],research:['confirmed','FSU 及 MagLab 档确认低维电子体系、输运和量子材料。',[fsu,mgl]]},'查 IBM Watson 博后档案及 Brown 博后 appointment，保留学位年份差异。');
relation(pop,'postdoc',f,'candidate',pe,[mgl,ibm,ifo],pa);

const te='Columbia 化学系原博士答辩公告明确作者为 Sean Michael Treacy。Arizona Board of Regents 原目录列本记录 Michael Treacy 为 Arizona State 物理学者、Cambridge 博士，姓名、学位机构及领域区分。';
note(tre,'- 核查边界：',web('Arizona Board of Regents 原档',at)+'核本人；'+web('Columbia 同名答辩',ctre)+'已排除。');
changeRow(tre,null,null,web('Arizona Board of Regents 本人原档',at));
const ta=audit(tre,{identity:['confirmed',te,[ctre,at]],affiliation:['confirmed','Arizona Board of Regents 原研究目录列 ASU Physics。',[at]],research:['confirmed','ASU 学术目录核电子显微、材料结构与凝聚态方向。',[at]]},'继续查 Cambridge 学位原档及 IBM Watson、CNET 历史研究任命；已排除 Columbia 化学博士误配。');
if(process.argv[2]==='apply')fs.writeFileSync('20261110_国家实验室阶段核查_同名排除.json',JSON.stringify([{page_id:'691aa0daa84911f6bc2f02e6',record_id:tre,url:ctre,external_subject:'Sean Michael Treacy，Columbia 化学博士答辩人',audit_id:ta,evidence:te}],null,2)+'\n','utf8');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_国家实验室阶段核查';
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
