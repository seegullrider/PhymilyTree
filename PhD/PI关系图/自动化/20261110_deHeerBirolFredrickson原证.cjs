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
 a.audit_id='20261110_'+id+'_deheer_birol_fredrickson_1030';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_deheer_birol_fredrickson_1030_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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


const de='286310e4', gl='c9c1b12e', bi='d321ab05';
const kn='师承人物 - Walter D. Knight', haule=local('0d65d9e8'), kot=local('1c24065f');
const dC='https://www.cmu.edu/nanotechnology-forum/Forum_12/CV/Walter_de_Heer.pdf';
const dG='https://physics.gatech.edu/user/walter-de-heer';
const dA='https://repository.gatech.edu/bitstreams/6a7aa0a0-2c9f-4882-9432-a50d2391e00b/download';
const dE='CMU 主办会议的原始简介明确写在 Walter D. Knight 指导下取得 Berkeley 物理博士。Georgia Tech 系页简介标 1984，系页书目列博士论文 1985，校档旧刊也指向 1985，CMU 简介标 1986。导师与年份分别判断。';
const dP=web('Georgia Tech 系页及论文书目',dG)+' · '+web('Georgia Tech 校档旧刊',dA)+'。'+dE;
replaceNoteLabel(de,'博士阶段研究师长','博士导师',kn,' '+dP);
replaceInverseLabel(kn,de,'博士阶段研究者','博士生',' '+dP);
replaceIndexLabel(de,kn,'博士阶段研究师长','博士导师',' '+dP);
editLine(fn(local(de)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Berkeley 博士授位年份待学位档独立复核。CMU 简介列 EPFL 1987–1997 任职，未注明聘任类别或导师。');
changeRow(de,'Walter D. Knight（CMU 会议原始简介明确博士指导；授位年待查）','EPFL 1987–1997 任职；聘任类别与导师待核',web('CMU 会议简介',dC)+' · '+web('Georgia Tech 校档旧刊',dA));
const da=audit(de,{phd:['confirmed_advisor',dE,[dC,dG,dA]],postdoc:['unresolved','CMU 简介列 EPFL 1987–1997 任职，未注明聘任类别或导师。',[dC]],affiliation:['confirmed','Georgia Tech 物理系原页核本人 Regents’ Professor of Physics；CMU 原档补 Epitaxial Graphene Laboratory。',[dG,dC]],research:['confirmed','Georgia Tech 原始书目核凝聚态实验、外延石墨烯、纳米电子与碱金属团簇。',[dG,dC]]},'核 Berkeley 纸本或数字馆藏论文签署页与授位年，并查 EPFL 人事档以区分聘任性质。');
relation(de,'phd',kn,'advisor',dE,[dC,dG,dA],da,false);

const gC='https://www.cnsi.ucsb.edu/people/faculty/glenn-fredrickson';
const gP='https://www.chemengr.ucsb.edu/sites/default/files/docs/pnas_glenn_fredrickson.pdf';
const gE='CNSI 校档与 PNAS 本人访谈交叉核对：1984 Stanford 化工博士毕业后加入 AT&T Bell Laboratories 任 Member of Technical Staff，1990 加入 UCSB 化工与材料两系。所阅任职资料未列独立博士后。';
note(gl,'- 核查边界：',web('UCSB CNSI 履历',gC)+' · '+web('PNAS 本人访谈',gP)+'。'+gE);
changeRow(gl,null,'1984–1990 AT&T Bell Labs 技术研究岗位；所阅履历未列独立博士后',web('UCSB CNSI 履历',gC));
audit(gl,{postdoc:['no_postdoc_documented',gE,[gC,gP]],affiliation:['confirmed',gE,[gC,gP]],research:['confirmed','CNSI 核软物质、高分子统计及场论模拟，也列多体量子系统场论计算。',[gC,gP]]},'原始博士签署页供独立复核；如取得 Bell Labs 早期任命档，可核岗位类别。');

const bC='https://birol.cems.umn.edu/sites/birol.cems.umn.edu/files/files/media/birol_cv.pdf';
const bR='https://cmt.rutgers.edu/alumni/';
const bP='https://www.physics.rutgers.edu/~haule/papers/PhysRevB.90.075136.pdf';
const bM='https://cse.umn.edu/cems/turan-birol';
const bE='本人 CV 第 1 页列 Rutgers CMT 2013–2016 博士后，CMT 原始校友档列在 Past Postdocs；2013 年投稿的原论文将 Birol、Kristjan Haule、Gabriel Kotliar 均列 Rutgers 物理与天文系。候选依据为可对齐的机构、年份和同期合作。原证未注明哪一位担任指导者。';
const bProof=[web('本人 CV 第 1 页',bC),web('Rutgers CMT 校友档',bR),web('同期原论文',bP)].join(' · ')+'。'+bE+' 低可信候选。';
for(const [target,name] of [[haule,'Kristjan Haule'],[kot,'Gabriel Kotliar']]){
 addEdge(bi,'博士后导师候选',target,name,bProof,null,true);
 inverse(bi,target,'博士后候选研究者',bProof);
}
note(bi,'- 核查边界：',web('Rutgers CMT 博后校友原页',bR)+'与本人 CV 相符。两位同期合作者仅列为候选。');
changeRow(bi,'Craig J. Fennie（本人 CV 明列博士导师）','Rutgers CMT 2013–2016 博士后；Haule、Kotliar（低可信候选）',web('本人 CV',bC)+' · '+web('CMT 校友档',bR)+' · '+web('同期原论文',bP));
const ba=audit(bi,{postdoc:['group_or_candidate',bE,[bC,bR,bP]],affiliation:['confirmed','Minnesota 院系原页核 Chemical Engineering and Materials Science；Physics 为已有研究生项目记录。',[bM]],research:['confirmed','Minnesota 院系原页列材料物性、第一性原理电子结构、量子材料与功能材料。',[bM]]},'查 2013–2016 Rutgers CMT 招聘任命或导师项目档，区分两位合作者的职责。');
for(const target of [haule,kot])relation(bi,'postdoc',target,'candidate',bE,[bC,bR,bP],ba);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_deHeerBirolFredrickson原证';
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
