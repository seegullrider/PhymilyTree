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
function row(id,text,postdoc=null){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';return cells.join(' | ');
 });
}
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
 a.audit_id='20261110_'+id+'_catalogs_and_degree_evidence_0527';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_degree_0527_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

function addRelation(id,label,target,display,detail,inverseLabel){
 const r=records.get(id);
 editLine(fn(r.filename),l=>l==='## 师承',l=>l+'\n\n- '+label+'：[['+target+'|'+display+']]。'+detail);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- '+inverseLabel+'：[['+r.filename+'|'+r.name+']]。'+detail);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+label+'：[['+target+'|'+display+']]。'+detail);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}
const u='daaa0cb4', gold='师承人物 - Hiroshi Julian Goldsmid';
const uGroup='https://sites.lsa.umich.edu/uher-lab/people/';
const uReg='https://regents.umich.edu/files/meetings/09-25/2025-09-IV-1.pdf';
const uSchool='https://lsa.umich.edu/physics/people/faculty/cuher.html';
const uBook='https://api.pageplace.de/preview/DT0400.9781000513776_A42180710/preview-9781000513776_A42180710.pdf';
const uProof='Uher 本人 Michigan 组档明确 UNSW 物理博士学位在 Julian Goldsmid 指导下取得。本人著作简介与 2025 校董会档都列 1975，系目录列 1979，保留年份冲突。';
const ua=audit(u,{
 phd:['confirmed_advisor',uProof,[uGroup,uReg,uBook,uSchool]],
 postdoc:['group_or_candidate','Michigan 校董会档明确 CSIRO National Measurement Laboratory 博后 fellowship。本人著作简介把 CSIRO 与随后 Michigan State 博后分列，后者与 Pratt、Schroeder 和 Bass 共事；保留阶段研究师长，CSIRO 具名指导者未列。',[uReg,uBook]],
 affiliation:['confirmed','2025 Michigan 校董会重聘文件列物理系 C. Wilbur Peters 职衔，本人 Michigan 组页吻合。',[uReg,uGroup]],
 research:['confirmed','Michigan 组档与院系页列热电材料、超导和低温输运。',[uGroup,uSchool]]
},'核 UNSW 学位记录与签署页，追查 CSIRO 具名指导、Michigan State 博后任期及正式 advisor 字段。');
const uLink=' '+web('本人 Michigan 组档',uGroup)+'明确指名博士学位指导；'+web('2025 校董会档',uReg)+'与著作简介均列 1975，院系页的 1979 仍保留。';
replaceNoteLabel(u,'博士阶段研究师长','博士导师',gold,uLink);
replaceInverseLabel(gold,u,'博士阶段研究成员','博士生',uLink);
replaceIndexLabel(u,gold,'博士阶段研究师长','博士导师',uLink);
editLine(fn(local(u)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+web('本人 Michigan 组档',uGroup)+'明示 Goldsmid 指导 UNSW 博士学位，'+web('2025 校董会档',uReg)+'与'+web('本人著作简介',uBook)+'均列 1975 年，'+web('Michigan 系页',uSchool)+'列 1979 年，待 UNSW 学位原档。校董会档确认 CSIRO National Measurement Laboratory 博后 fellowship；本人著作将该段与其后 Michigan State 博后分列。Pratt、Schroeder、Bass 仅标 Michigan State 博后研究师长，CSIRO 指导者待核。');
changeRow(u,'Hiroshi Julian Goldsmid（UNSW 博士导师，授位年份 1975／1979 待原档）','CSIRO NML 博后（具名指导者待核）；Michigan State 博后研究师长 William P. Pratt Jr.、Peter A. Schroeder、Jack Bass',web('本人组档',uGroup)+' · '+web('校董会重聘档',uReg));
relation(u,'phd',gold,'advisor',uProof,[uGroup,uReg,uBook,uSchool],ua,false);

const p='e894f72f', pAlias='师承人物 - William P. Pratt';
const pArch='https://onthebanks.msu.edu/recordFiles/157-544-90/JULY27-281978.pdf';
const pPhDs='https://pa.msu.edu/news-events/info-for-alumni/doctorates.aspx';
audit(p,{
 identity:['confirmed','Michigan State 校董会 1978 档案写全名 William P. Pratt, Jr. 及物理系副教授；院系博士目录对同一指导者使用 William P. Pratt、William Pratt 等简写。Uher 著作列同单位、同研究方向及 Jack Bass 的共同研究，支持扩展节点为同人。',[pArch,pPhDs,uBook]],
 affiliation:['confirmed','MSU 现有系目录列荣休；1978 校董会档列当时物理副教授及 1978–1979 Lancaster 学术休假。',[pArch]]
},'查校方早期聘任档、原博士学位论文与初期研究职位；1978–1979 Lancaster 属休假，不并入博士后。');
note(p,'- 核查边界：',web('MSU 1978 校董会档',pArch)+'明确该人当时为物理副教授，批准 1978–1979 Lancaster 学术休假。'+web('本校博士目录',pPhDs)+'所列为其指导的博士生，未给其本人博士导师。');
const same='- 同人节点：';
editLine(fn(local(p)),l=>l==='## 师承',l=>l+'\n\n'+same+'[['+pAlias+'|William P. Pratt]]。'+web('MSU 1978 原档',pArch)+'列全名，'+web('MSU 博士目录',pPhDs)+'亦用缩写；'+web('Uher 著作简介',uBook)+'中的同一 Michigan State 超低温输运研究者对应此人。');
editLine(fn(pAlias),l=>l==='## 师承',l=>l+'\n\n'+same+'[['+local(p)+'|William P. Pratt Jr.（Michigan State）]]。保留原始简称和现有师承链接。'+web('MSU 校董会原档',pArch)+' · '+web('MSU 博士目录',pPhDs));
row(p,web('1978 MSU 校董会档',pArch)+' · '+web('MSU 博士目录',pPhDs));

const c='78dd2c68', qsd='https://qsd.magnet.fsu.edu/oldpage/research.html';
const cf='https://quantum.fsu.edu/people/faculty/highlights/dr-irinel-chiorescu';
const cdept='https://www.physics.fsu.edu/person/irinel-chiorescu';
const cCV='https://studyres.com/doc/11529403/curriculum-vitae-irinel-chiorescu';
const cProof='既有核读的本人履历转录明确 Grenoble 博士 Supervisor Dr. B. Barbara，沿用来源缩写。FSU 原档核实 2000 年 Grenoble 博士，本人历史研究页分列博士课题。旧履历转录本本轮缓存缺失。';
const ca=audit(c,{
 phd:['confirmed_advisor',cProof,[cCV,cdept,qsd]],
 postdoc:['confirmed_advisor','FSU 量子计划档分列 Delft 2000–2004 与 Michigan State 2004，本人同期研究页直接指名后段 Jack Bass 与 Bill Pratt；Delft 已读资料未写正式指导者。',[cf,qsd,cdept]]
},'继续找 Grenoble 博士论文签署页或本人与机构所存 CV，追查 Delft 2000–2004 具名指导者及与系页“三年”记载的任期细节。');
const cText=web('FSU 量子计划履历',cf)+'分列 Delft 2000–2004 与 Michigan State 2004；本人研究页直接指名两位 Michigan State 指导者。';
for(const m of [local('7401e013'),local(p)])enrich(c,'postdoc',m,'博士后研究者',cText);
note(c,'- 核查边界：',cText+' FSU 物理系描述 Delft 为三年，日期口径保留待查。');
changeRow(c,'B. Barbara（2000 Grenoble，既有 CV 指名记录）','Delft（2000–2004，具名导师待核）；Jack Bass、William P. Pratt Jr.（2004 Michigan State 博后导师）',web('FSU 量子计划履历',cf)+' · '+web('本人研究页',qsd));
relation(c,'phd','师承人物 - B. Barbara','advisor',cProof,[cCV,cdept,qsd],ca);

const z='e926f20a';
const zCat='https://bpb-us-w2.wpmucdn.com/wordpress.ucsc.edu/dist/e/242/files/2025/08/2008-10catalog.pdf';
const zBU='https://physics.bu.edu/sites/gzimmerman/files/2018/10/1982-83-Ann.-Reps.pdf';
audit(z,{
 identity:['confirmed','UCSC 校方总目录全名及物理职衔与 UCSC 人员档相符；同一目录列 UCSB 学士、Cornell 博士、曾在 IBM Research。',[zCat]],
 phd:['unresolved','UCSC 2008–10 总目录直接确认 Cornell Ph.D.，未列博士年份或导师；1981 仍待原档。',[zCat]],
 postdoc:['unresolved','BU 1982–83 年报称访校候选 Zack Schlesinger 来自 Bell Labs，UCSC 旧目录另列 IBM Research 曾任。两处未注明职位为博士后或列具名导师。',[zBU,zCat]],
 research:['confirmed','UCSC 目录研究栏目对应凝聚态光谱；先前学校科研资助记录列相关系统低能谱。',[zCat]]
},'Cornell 退避到期后查博士原档；查 1980 年代 Bell Labs 和 IBM Research 任命、资助及阶段指导资料。');
note(z,'- 核查边界：',web('UCSC 2008–10 总目录',zCat)+'确证 UCSB 学士、Cornell 博士及曾在 IBM Research，博士年份和导师仍待查。'+web('BU 1982–83 系年报',zBU)+'称其来自 Bell Labs，职位性质和导师未列。');
changeRow(z,'Cornell 博士，年份和导师待学位档','Bell Labs、IBM Research 经历可见，博后职位和导师待核',web('UCSC 旧总目录',zCat)+' · '+web('BU 同期年报',zBU));

const b='94e4a4b0', ther=local('fc878b29');
const bSem='https://fitzpatrick.duke.edu/event/1005', bCom='https://commencement.duke.edu/wp-content/uploads/2018/06/Commencement-Program_FINAL.pdf', bBrown='https://chemistry.brown.edu/people/yusong-bai';
const bProof='Duke 本人在读博士生讲座原页明确在 Michael J. Therien 指导下开展博士研究，授位名录列论文；与既有 2023 CV 的具名 advisor 一致。论文签署页仍待查。';
const ba=audit(b,{phd:['confirmed_advisor',bProof,[bSem,bCom,bBrown]]},'继续查 Duke 学位论文签署及旧版本人 CV；独立核实 Columbia 博后正式 advisor。');
enrich(b,'phd',ther,'博士生',web('Duke 研究生时期原公告',bSem)+'用 under the advisement 明确具名；该段与既有 CV 导师记录相符，签署页仍待核。');
changeRow(b,'Michael J. Therien（Duke 博士导师，原讲座具名指导，历史 CV 与之相符）',null,web('Brown 化学系档',bBrown));
relation(b,'phd',ther,'advisor',bProof,[bSem,bCom,bBrown],ba,false);

const d='d37c6cf8', zh='师承人物 - Shou-Cheng Zhang';
const dHH='https://www.min.uni-hamburg.de/ueber-die-fakultaet/aktuelles/2021/0616-quantenforscher-eugene-demler-erhaelt-hamburger-preis-fuer-theoretische-physik.html';
const dETH='https://www.phys.ethz.ch/de/news-und-veranstaltungen/d-phys-news/2021/11/hamburg-prize-for-theoretical-physics-to-eugene-demler.html';
const dProof='Hamburg 校方奖项原页明确在 Stanford 读博由 Shoucheng Zhang 指导，ETH 原履历确认 Stanford 1998 博士及研究主题。既有人物页具名博士导师，论文签署页待核。';
const da=audit(d,{
 phd:['confirmed_advisor',dProof,[dHH,dETH]],
 affiliation:['confirmed','ETH 物理系原公告列 2021 夏起教授；Harvard 物理教职 2001–2021 为历史任职。',[dETH]],
 research:['confirmed','ETH 物理系原公告列强关联量子系统、量子固体和光晶格冷原子。',[dETH]]
},'查 Stanford 学位签署页和 UCSB 博后个人指导、任期原档；保留 Harvard Junior Fellow 独立经历。');
enrich(d,'phd',zh,'博士生',web('ETH 原履历',dETH)+'核对 Stanford 1998 学位、研究方向及 Harvard 转任 ETH，具名博士导师依据 Hamburg 原公告。');
changeRow(d,'Shou-Cheng Zhang（Stanford 1998 博士导师，Hamburg 指名）',null,web('Hamburg 原公告',dHH)+' · '+web('ETH 原履历',dETH));
relation(d,'phd',zh,'advisor',dProof,[dHH,dETH],da,false);

const h='e42a8426', wu='师承人物 - Chien-Shiung Wu';
const hForum='https://www.cswuforum.org/organizing-committee', hInterview='https://www.nature.com/articles/s41377-023-01192-5', hIAS='https://www.hkias.cityu.edu.hk/our-people/senior-fellows/professor-evelyn-hu';
const hProof='吴健雄论坛原介绍明确称 Evelyn Hu 为吴健雄的博士学生。本人原访谈确认师生关系及吴参与其 Brookhaven 博士实验，CityU HKIAS 履历核对 Columbia 1975 物理博士与 1971 硕士。学位签署页仍待核。';
const ha=audit(h,{phd:['confirmed_advisor',hProof,[hForum,hInterview,hIAS]]},'查 Columbia 博士论文签署页，分辨 Bell Labs 历史岗位是否存在独立博士后阶段。');
enrich(h,'phd',wu,'博士生',web('CityU HKIAS 履历',hIAS)+'明确 1975 Columbia 物理博士与 1971 硕士；'+web('本人访谈',hInterview)+'确认吴参与其 Brookhaven 博士实验。');
changeRow(h,'Chien-Shiung Wu（1975 Columbia 博士导师，论坛及本人访谈）',null,web('CityU HKIAS 履历',hIAS));
relation(h,'phd',wu,'advisor',hProof,[hForum,hInterview,hIAS],ha,false);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0527';
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
