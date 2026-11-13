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
 a.audit_id='20261110_'+id+'_original_1327';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_original_1327_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const b='d5ffd5f5', c='1c042385', d='0478d35c', j='0423c0ae', f='2e1c4bad', ch='1b58446a';
const s={
 thesis:'https://backend.orbit.dtu.dk/ws/portalfiles/portal/2546725/Alexandra-Boltasseva-PhD-Thesis_2006.pdf',
 dtu:'https://backend.orbit.dtu.dk/ws/files/3895292/Boltasseva2.pdf',
 pCV:'https://engineering.purdue.edu/~aeb/2024-01-CV-Alexandra-Boltasseva-v1.pdf',
 cl:'https://ethw.org/Oral-History%3AJohn_Clarke',
 ric:'https://physics.berkeley.edu/node/2362',
 roc:'https://erg.berkeley.edu/wp-content/uploads/2020/01/ERGCommencementGuide2019PDF.pdf',
 cv:'https://web.ece.ucsb.edu/Faculty/selected_pubs/Blumenthal/Blumenthal_00_Full_CV_18JUN20-1.pdf',
 ucsb:'https://ocaqpi.ece.ucsb.edu/people/principal-investigator/daniel-blumenthal',
 a:'https://science.psu.edu/news/asbury-wins-nsf-career-award',
 aSite:'https://cocoziello.psu.edu/people/john-asbury/',
 aBio:'https://par.nsf.gov/servlets/purl/10432327',
 rana:'https://people.ece.cornell.edu/rana/papers/paper17.pdf',
 ranaLater:'https://people.ece.cornell.edu/rana/papers/paper8.pdf',
 rle:'https://www.rle.mit.edu/media/pr143/9.pdf',
 cornell:'https://www.duffield.cornell.edu/people/farhan-rana/',
 reich:'https://reichmangroup.chem.columbia.edu/directory',
 doi:'https://academiccommons.columbia.edu/doi/10.7916/D8BP010F',
 pq:'https://www.proquest.com/openview/e75b49a92e6f762241e502ae28044d36/',
 doe:'https://science.osti.gov/-/media/wdts/scgf/pdf/2010Profiles/BerkelbachT-2012Profile.pdf',
 sand:'https://curricularconnections.berkeley.edu/wp-content/uploads/2023/09/FSS_Brochure_Spring_2008.pdf'
};
const p=b=>web(b[0],b[1]);
function targeted(id,label,target,reverse,extra){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+extra);
 mentorLine(target,id,'- '+reverse+'：',extra);
 indexLine(id,target,label,extra);
}
const boltEv='DTU 博士论文致谢在三年博士研究段落明称 Jørn M. Hvam 和 Sergey Bozhevolnyi 为 supervisors，分别列 DTU 和 Aalborg University。';
const boltPost='本人 2006 论文作者介绍确认 DTU COM 博后。既有 2024 CV 记 2005–2007 并另列独立项目资助；2025 CV 访问返回 429。个人指导者待核。';
const bA=audit(b,{phd:['confirmed_advisor',boltEv,[s.thesis]],postdoc:['unresolved',boltPost,[s.dtu,s.pCV]]},'在 Purdue Engineering 主机退避到期前避免再次访问；继续查 DTU 博后任用或项目原件。');
for(const t of ['师承人物 - Sergey I. Bozhevolnyi','师承人物 - Jørn M. Hvam']){
 enrich(b,'phd',t,'博士生',web('DTU 论文致谢原文',s.thesis)+' '+boltEv);
 relation(b,'phd',t,'advisor',boltEv,[s.thesis],bA,false);
}
editLine(fn(local(b)),l=>l.startsWith('- 博士论文复查：'),()=>'- 博士论文复查：DTU 后端原件已可读。'+boltEv+' '+web('DTU 论文致谢',s.thesis));
changeRow(b,null,null,web('DTU 论文致谢原文',s.thesis));

const clR='本人 IEEE 访谈确认 1968–1969 Berkeley 博后，经 Paul L. Richards 推荐由另一位助理教授接收。Berkeley 物理系纪念文具名接收者为 Gene Rochlin；未见任用档的正式导师称谓。';
const clP='Berkeley 物理系纪念文原样引用 Clarke 称 Paul L. Richards 是其实际研究 mentor，访谈确认 Richards 引荐 Berkeley 博后职位，之后长期合作。Richards 的指导与 Rochlin 的博后接收分别记录。';
const cA=audit(c,{
 phd:['confirmed_advisor','IEEE 本人口述明确 Cambridge 博士论文导师为 Brian Pippard。',[s.cl]],
 postdoc:['group_or_candidate',clR+' '+clP,[s.cl,s.ric]]
},'继续查 1968–1969 Berkeley 博后任用或正式 supervisor 原档。');
const roc='师承人物 - Gene Rochlin（UC Berkeley）', ric='师承人物 - Paul L. Richards';
const clProof=web('本人 IEEE 口述史',s.cl)+' '+web('Berkeley 物理系纪念文',s.ric);
newMentor(roc,'Gene Rochlin','UC Berkeley 学者。官方纪念册与物理系纪念文核对其身份。'+web('Berkeley 官方纪念册',s.roc),c,'博士后阶段研究者',clR+' '+clProof);
const label='博士后阶段研究师长';
const rocLine=label+'：[['+roc+'|Gene Rochlin]]。'+clR+' '+clProof;
const ricLine=label+'：[['+ric+'|Paul L. Richards]]。'+clP+' '+clProof;
editLine(fn(local(c)),l=>l.startsWith('- 核查边界：'),()=>'- '+rocLine+'\n- '+ricLine+'\n- 核查边界：保留 1968–1969 博后正式 advisor 字段待核。');
editLine(idx,l=>l.startsWith('- [['+local(c)+'|')&&l.includes('→ 博士导师：'),l=>l+'\n- [['+local(c)+'|John Clarke]] → '+rocLine+'\n- [['+local(c)+'|John Clarke]] → '+ricLine);
inverse(c,ric,'博士后阶段研究者',clP+' '+clProof);
changeRow(c,null,'Gene Rochlin（1968–1969 Berkeley 博后接收），Paul L. Richards（研究师长）；正式 advisor 待核',clProof);
relation(c,'postdoc',roc,'stage_mentor',clR,[s.cl,s.ric],cA);
relation(c,'postdoc',ric,'stage_mentor',clP,[s.cl,s.ric],cA);

const dEv='本人 UCSB 托管 CV 的论文条明确 1993 年 Colorado Boulder 博士论文及 Advisor J. Sauer；引用区有 J. R. Sauer 署名，未用合著推定全名。';
const dA=audit(d,{
 affiliation:['confirmed','本人 UCSB 组档列 ECE Distinguished Professor，负责 OCAQπ 和 TOEC。',[s.ucsb]],
 research:['confirmed','集成光子学、低损耗氮化硅、窄线宽激光、光通信与量子光子电路。',[s.ucsb]],
 phd:['confirmed_advisor',dEv,[s.cv]]
},'另一路 USPTO 原件返回 403；继续找学位库确认 J. Sauer 全名和毕业后是否有独立博后。');
enrich(d,'phd','师承人物 - J. Sauer（Colorado 光子学）','博士生',web('UCSB 托管本人 CV',s.cv)+' '+dEv);
relation(d,'phd','师承人物 - J. Sauer（Colorado 光子学）','advisor',dEv,[s.cv],dA,false);
changeRow(d,null,null,web('UCSB 托管本人 CV',s.cv));

const asEv='Penn State 同期院档明确 2001 Emory 博士、2001–2005 Stanford 博后及 2005 加入 Penn State。本人作者简介具名 Lian 和 Fayer 两段阶段指导，保留阶段研究师长类型。';
audit(j,{
 affiliation:['confirmed','Penn State 化学系。Cocoziello 原站列姓名但未显示更多职位。',[s.a,s.aSite]],
 research:['confirmed','院档描述超快二维红外光谱，研究光电材料缺陷与载流子俘获。',[s.a]],
 phd:['group_or_candidate',asEv,[s.a,s.aBio]],
 postdoc:['group_or_candidate',asEv,[s.a,s.aBio]]
},'继续追 Emory 博士论文、本人 CV 或 Stanford 任用档，分别核正式导师。');
note(j,'- 核查边界：',asEv+' '+web('Penn State 院系历史档',s.a));
changeRow(j,'Tianquan Lian（2001 Emory 博士阶段研究师长）','Michael Fayer（2001–2005 Stanford 博后阶段研究师长）',web('Penn State 院系历史档',s.a));

const fP='MIT RLE 当年进展报告将 Rana 列在 Rajeev J. Ram 半导体激光项目的 Graduate Students 栏，补强博士组属；学位论文导师栏待核。';
const fQ='2004 本人作者简介称 2002 完成博士研究后进入 Cornell，2007 本人作者简介列 2003 加入 Cornell，现行院系履历列 2003 MIT 博士。2002 研究完成与授位时间分列；早期 IBM 任职在博士前，未见独立博士后。';
const fA=audit(f,{
 phd:['group_or_candidate',fP,[s.rle,s.cornell]],
 postdoc:['no_postdoc_documented',fQ,[s.rana,s.ranaLater,s.cornell]]
},'保留学位与入职时间原文，待 MIT 机构退避结束后找博士论文导师栏。');
targeted(f,'博士阶段课题组负责人',local('577e5266'),'博士阶段课题组成员',web('MIT RLE 同期报告',s.rle)+' '+fP);
note(f,'- 核查边界：',fQ+' '+web('2004 本人作者简介',s.rana)+' '+web('2007 本人作者简介',s.ranaLater));
changeRow(f,null,'可读履历未列独立博后；博士工作结束与入职年份分列待核',web('MIT RLE 同期报告',s.rle)+' '+web('本人作者简介',s.rana));
relation(f,'phd',local('577e5266'),'group_leader',fP,[s.rle,s.cornell],fA,false);

const be='Reichman 实验室原目录列 2009–2014 博士组属和论文题名 Microscopic theories of excitons and their dynamics；本轮已定位 Columbia 馆藏，馆藏拒绝访问，ProQuest 原件未返回。';
for(const id of ['41c1e5a1','cff12e56']){
 audit(id,{phd:['group_or_candidate',be,[s.reich,s.doi,s.doe]]},'继续追 Columbia 或 ProQuest 可读取的论文签署页和致谢。');
 note(id,'- 核查边界：',be+' '+web('Columbia 学位论文入口',s.doi));
 changeRow(id,null,null,web('Columbia 学位论文入口（未取得正文）',s.doi));
}

const sandEv='Berkeley 2008 学校项目册明确 1990–1995 Sandia Livermore Senior Member of the Technical Staff，1995 加入 Berkeley 材料系。LBNL 简介记 1989 博士毕业后即加入 Sandia。1989–1990 的具体任用与有无独立博士后待核。';
audit(ch,{postdoc:['unresolved',sandEv,[s.sand,'https://materialssciences.lbl.gov/profile/dcchrzan/']]},'追查 Berkeley 学位论文原件和 Sandia 1989–1990 早期任职档案。');
note(ch,'- 核查边界：',sandEv+' '+web('Berkeley 学校项目册',s.sand));
changeRow(ch,null,'1990–1995 Sandia Senior Member of the Technical Staff；1989–1990 任用及博士后待核',web('Berkeley 学校项目册',s.sand));

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Clarke与分阶段原档';
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
