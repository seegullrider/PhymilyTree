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
 a.audit_id='20261110_'+id+'_kapitza_and_bell_1646';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_kapitza_and_bell_1646_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const dl='https://kapitza.ras.ru/index.php?cont=k_diss&lang=ru';
const dd='https://kapitza.ras.ru/index.php?cont=d_diss&lang=ru';
const ds='https://kapitza.ras.ru/index.php?cont=old_staff&lang=ru';
const uc='https://senate.universityofcalifornia.edu/in-memoriam/files/igor-dzyaloshinskii.html';
const msu='https://letopis.msu.ru/peoples/4531';
const itp='https://www.itp.ac.ru/ru/persons/dzyaloshinskii-igor-ekhielevich/';
const ufn='https://www.ufn.ru/ufn2021/ufn2021_8/ufn218g.pdf';
const pd='https://physicstoday.aip.org/obituaries/igor-ekhielevich-dzyaloshinskii';
const dy='18b45b4f', zhou='187a89bb', bok='8ed07c3f', bucks='44788e46', ting='77ca81ad';
const lif='师承人物 - Evgeny M. Lifshitz', landau='师承人物 - Lev D. Landau';
const good='研究人物 - John B. Goodenough', rhodes='师承人物 - Charles Kirkham Rhodes';
const suhl='师承人物 - Harry Suhl', mat='师承人物 - Bernd T. Matthias';
const oldBok='师承人物 - Jeffrey Bokor';
const f=(id)=>fn(local(id));
function personRow(id,label,target,replacement){
 editLine(f(id),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),()=>replacement);
}
function indexRow(id,label,target,replacement){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),()=>replacement);
}
const link=(target,label)=>'[['+target+'|'+label+']]';
const sourceList=(entries)=>entries.map(([label,url])=>web(label,url)).join(' · ');
function indexEntry(id,display,relationLine){
 return '- '+link(local(id),display)+' → '+relationLine.slice(2);
}
const lifeEvidence='俄罗斯科学院卡皮察物理问题研究所学位目录第 30 条列 1957 年物理数学科学副博士（Candidate of Sciences）及 E. M. Lifshitz，条目链接论文《反铁磁体弱铁磁性的热力学理论》。';
const lifeCite=sourceList([['卡皮察研究所副博士学位目录',dl],['UC 学术评议会纪念档',uc]]);
const landauExtra='莫斯科大学校史称其为 Landau 的学生，Physics Today 的同事纪念文记 Landau 在 1957 年学位答辩现场发言。'+sourceList([['莫斯科大学校史',msu],['Physics Today 纪念文',pd]]);
const lifeLine='- 博士导师：'+link(lif,'Evgeny M. Lifshitz')+'。'+lifeEvidence+' 关系类型可信度为高。'+lifeCite;
personRow(dy,'博士导师候选',lif,lifeLine);
note(dy,'- 博士阶段研究师长：',landauExtra);
editLine(f(dy),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：1957 年 Candidate of Sciences 对应博士阶段。1962 年另获 Doctor of Sciences（habilitation），论文题为《量子场论方法在统计物理中的应用》。卡皮察研究所旧人员档列 1958–1965 科研人员，Landau 研究所人员档列 1965 年起任职。已核档案未见具名独立博士后任用。'+sourceList([['高等博士学位目录',dd],['卡皮察研究所旧人员档',ds],['Landau 研究所人员档',itp],['UC 纪念档',uc]]));
note(dy,'- UC Irvine 荣休理论物理学家，','Landau 研究所同事在原刊记其自 1991 年起任 UCI 教授。'+web('Physics–Uspekhi 纪念原刊',ufn));
editLine(fn(lif),l=>l.startsWith('- 博士导师候选的研究者：')&&l.includes(local(dy)),()=>'- 博士生：'+link(local(dy),'Igor Dzyaloshinskii')+'。'+lifeEvidence+' '+lifeCite);
mentorLine(landau,dy,'- 博士阶段研究者：',landauExtra);
indexRow(dy,'博士导师候选',lif,indexEntry(dy,'Igor Dzyaloshinskii',lifeLine));
indexLine(dy,landau,'博士阶段研究师长',landauExtra);
changeRow(dy,'Evgeny M. Lifshitz（1957 Candidate of Sciences 正式导师）、Lev D. Landau（博士阶段研究师长）','已核任职未见独立博士后',sourceList([['副博士学位目录',dl],['高等博士学位目录',dd],['卡皮察研究所旧人员档',ds]])+'。1962 Doctor of Sciences 分列。');
const dyA=audit(dy,{affiliation:['confirmed','Physics–Uspekhi 原刊列自 1991 年起任 UCI 教授；UCI 纪念档与院系档确认凝聚态理论及荣休历史身份。',[ufn,uc]],phd:['confirmed_advisor',lifeEvidence+' 1962 Doctor of Sciences 为另一学位。莫斯科大学校史与 Physics Today 答辩记述支持 Landau 阶段研究师长。',[dl,dd,uc,msu,pd]],postdoc:['no_postdoc_documented','1957 Candidate of Sciences 后，卡皮察研究所旧人员档列 1958–1965 科研人员，Landau 研究所档列 1965 年起任职；已读资料中未见具名独立博后。',[ds,itp,dd,uc]]},'待可访问时查 1957 论文扫描签署页和 1957–1958 过渡任用原件。');
relation(dy,'phd',lif,'advisor',lifeEvidence,[dl,uc],dyA);
relation(dy,'phd',landau,'stage_mentor','莫斯科大学校史明确称他是 Landau 的学生。Physics Today 的同事纪念文记 Landau 在其 1957 年答辩发言，正式导师由卡皮察研究所学位档另列。',[msu,pd,dl],dyA);

const walker='https://me.utexas.edu/person/jianshi-zhou/';
const utcat='https://catalog.utexas.edu/archive/2024-25/graduate/gsc-committees/gsc-committees.pdf';
const zinter='https://www.houstonchronicle.com/news/houston-texas/education/article/UT-professor-John-B-Goodenough-awarded-Nobel-14503473.php';
const zaip='https://physicstoday.aip.org/obituaries/john-bannister-goodenough';
const zorig='https://www.sciencedirect.com/science/article/abs/pii/S0022459618305607';
const zEvidence='Houston Chronicle 的 Zhou 采访报道写他在研究生交换期间随 Goodenough 工作。Zhou 在 Physics Today 的共同署名回忆核对其 UT Austin 身份。授予学校和正式签署导师仍待学位原档。';
const zCite=sourceList([['Zhou 采访原文',zinter],['Zhou 共同署名纪念文',zaip],['UT 机械系',walker],['UT 研究生目录',utcat]]);
const zline='- 博士阶段研究师长：'+link(good,'John B. Goodenough')+'。'+zEvidence+' 关系类型可信度为中。'+zCite;
personRow(zhou,'博士阶段研究师长候选',good,zline);
note(zhou,'- 核查边界：','Goodenough 本人回忆的出版社原文仍待读；其检索索引留作追查线索。'+web('本人回忆原页',zorig));
editLine(fn(good),l=>l.startsWith('- 博士阶段受指导者候选：')&&l.includes(local(zhou)),()=>'- 博士阶段研究者：'+link(local(zhou),'Jianshi Zhou')+'。'+zEvidence+' '+zCite);
indexRow(zhou,'博士阶段研究师长候选',good,indexEntry(zhou,'Jianshi Zhou',zline));
changeRow(zhou,'John B. Goodenough（研究生交换阶段研究师长）；正式学位导师及授予学校待核',null,web('Zhou 采访原文',zinter)+'。');
const zA=audit(zhou,{phd:['group_or_candidate',zEvidence,[zinter,zaip,walker,utcat]],affiliation:['confirmed','UT Walker 官方页列研究教授，机械工程与材料研究交叉；Zhou 本人同署 2023 年 Physics Today 纪念文时列 UT Austin。',[walker,zaip]]},'核 1991 学位授予学校、原论文签署和博士后履历；Goodenough 2019 本人全文在出版社原页可访问后复核。');
relation(zhou,'phd',good,'stage_mentor',zEvidence,[zinter,zaip,walker,utcat],zA);

const beecs='https://www2.eecs.berkeley.edu/Faculty/Homepages/bokor.html';
const bokCV='https://ptacts.uspto.gov/ptacts/public-informations/petitions/1556696/download-documents?artifactId=GN0TYx3sVogKML_eGKAS2k9mR9vR7nhdKbSuA43vshUyvklMrvokjoE';
const bCV='https://ptacts.uspto.gov/ptacts/public-informations/petitions/1462366/download-documents?artifactId=hVE3UMuV2487c7EusDkZHXULkbywqqF4zfQ6_CEPM2ibkKPI-JZdZtg';
const bE='Bokor 本人 CV 列 Stanford EE 1980 博士，毕业年份起在 Bell Labs 任 Quantum Electronics Research Department 技术人员，1980–1987 为 Member of Technical Staff。已核履历未列独立博后。';
const bCite=sourceList([['Bokor 本人 CV，第 1–2 页',bokCV],['Berkeley EECS 教师档',beecs]]);
note(bok,'- EECS 荣休教授（2024退休）','本人 CV 另列自 1993 年在 Berkeley 教职期间联合任用 LBNL。'+bCite);
const bPostLine='- 博士后经历：'+bE+' '+bCite;
const bPhdLine='- 博士导师候选：'+link(rhodes,'Charles Kirkham Rhodes')+'。本人 CV 论文表多次列 1979–1980 与 C. K. Rhodes 合著，Physics Tree 另列师承线索。Stanford 学位签署及正式职衔待核，可信度为低。'+web('Bokor 本人 CV，第 33 页',bokCV);
const buE='Bucksbaum 本人 CV 列 1981 年 11 月至 1982 年 11 月在 Bell Labs 博后期间与 Bokor 工作。Bokor 本人 CV 确认当时任 Bell Labs Quantum Electronics Research Department 技术人员。个人正式导师职衔待核。';
const buCite=sourceList([['Bucksbaum 本人 CV，第 1 页',bCV],['Bokor 本人 CV，第 2 页',bokCV],['Berkeley EECS 教师档',beecs]]);
editLine(f(bok),l=>l.startsWith('- 核查边界：'),()=>bPhdLine+'\n'+bPostLine+'\n- 博士后阶段研究者：'+link(local(bucks),'Philip Bucksbaum')+'。'+buE+' '+buCite+'\n- 核查边界：Stanford 博士论文导师待查。');
editLine(f(bok),l=>l.startsWith('- [['+rhodes+'|'),l=>l+' '+web('Bokor 本人 CV 合著清单',bokCV)+'。');
editLine(fn(rhodes),l=>l.startsWith('- [['+local(bok)+'|'),l=>l+' 本人 CV 记录多篇同期合著。'+web('Bokor 本人 CV',bokCV)+'。');
const buLine='- 博士后阶段研究师长：'+link(local(bok),'Jeffrey Bokor')+'。'+buE+' '+buCite;
personRow(bucks,'博士后阶段研究师长',oldBok,buLine);
indexRow(bucks,'博士后阶段研究师长',oldBok,indexEntry(bucks,'Philip Bucksbaum',buLine));
editLine(fn(oldBok),l=>l.startsWith('- 博士后阶段研究者：')&&l.includes(local(bucks)),()=>'- 同一人物的校属记录见 '+link(local(bok),'Jeffrey Bokor（UC Berkeley）')+'。Bell Labs 博后阶段的研究师长关系及来源见校属页。'+buCite);
changeRow(bok,'Charles Kirkham Rhodes（候选）','已核履历未见独立博士后',bCite+'。');
changeRow(bucks,null,null,web('Bokor 本人 CV 复核 Bell Labs 任用',bokCV)+'。');
const bA=audit(bok,{affiliation:['confirmed','Berkeley EECS 原档列 2024 年荣休；本人 CV 列 1993 起 Berkeley 任用及同期 LBNL 联合任用。',[beecs,bokCV]],phd:['group_or_candidate','本人 CV 核 Stanford 1980 EE 博士。CV 书目列多篇与 Charles K. Rhodes 同期论文，第三方学术树为候选线索，未见学位导师签署。',[bokCV,beecs]],postdoc:['no_postdoc_documented',bE,[bokCV,beecs]]},'追 Stanford 学位论文 809633 签署及致谢，并核 Stanford 和 Bell Labs 档案衔接。');
relation(bok,'phd',rhodes,'candidate','Bokor 本人 CV 列多篇 1979–1980 与 C. K. Rhodes 合著。第三方学术树列博士师承候选，需 Stanford 学位签署确认。',[bokCV,beecs],bA);
const buA=audit(bucks,{postdoc:['confirmed_advisor','LBNL Eugene Commins 仍为已核明确博后导师。'+buE,[bCV,bokCV,beecs]]},'继续核 Bell Labs 任用文件和正式监督者称谓；校属与师承扩展两页已按同一人连接。');
relation(bucks,'postdoc',oldBok,'retracted','同一 Jeffrey Bokor 的历史师承节点已链接到 Berkeley 校属节点，原阶段研究师长证据保留并转移至校属目标。',[bCV,bokCV,beecs],buA,false);
relation(bucks,'postdoc',local(bok),'stage_mentor',buE,[bCV,bokCV,beecs],buA);

const th='https://tcsuh.com/pdf/cv/ting_chinsen.pdf';
const tprof='https://www.tcsuh.com/people/prininv/ting_chinsen/';
const ucsd='https://new.physics.ucsd.edu/department-history';
const ta='https://journals.aps.org/prl/issues/27/5';
const tb='https://journals.aps.org/prb/issues/14/10';
const su='https://physicstoday.aip.org/obituaries/harry-suhl';
const ma='https://history.aip.org/history/catalog/icos/268.html';
const bir='https://www.legacy.com/us/obituaries/nytimes/name/joseph-birman-obituary?id=20729337';
const tE='1971 APS 原卷列 Matthias、H. Suhl 与 C. S. Ting 合著，UCSD 系史将前两人列为早期物理系教师。Ting 的 Houston CV 记录 1970 UCSD 物理博士。候选源于学位时间与合作记录，导师角色仍待学位原件。';
const tCite=sourceList([['APS 原卷',ta],['UCSD 物理系史',ucsd],['Houston 履历',th]]);
const tLines=[[suhl,'Harry Suhl',su],[mat,'Bernd T. Matthias',ma]].map(([target,name,url])=>'- 博士导师候选：'+link(target,name)+'。'+tE+' 可信度为低。'+tCite+' · '+web('个人档',url));
editLine(f(ting),l=>l.startsWith('- 博士导师：未查明。'),l=>l+'\n'+tLines.join('\n'));
note(ting,'- 博士后阶段（Brown）：',web('1976 APS 原卷',tb)+'再次列三位合著者，Brown 岗位来自 Houston 履历。');
for(const [target,prefix] of [['师承人物 - John Quinn','- 博士后阶段候选研究者：'],['师承人物 - See-Chen Ying','- 博士后阶段候选研究者：']]){
 const content=fs.readFileSync(fn(target),'utf8');
 const old=content.split(/\r?\n/).filter(l=>l.includes('[['+local(ting)+'|')&&/博士后/.test(l));
 if(old.length!==1)throw Error('Brown inverse count '+target+' '+old.length);
 editLine(fn(target),l=>l===old[0],l=>l+' '+web('1976 APS 原卷',tb)+'。');
 indexLine(ting,target,'博士后阶段候选关系',web('1976 APS 原卷',tb)+'。');
}
const tInverse='- 博士导师候选的研究者：'+link(local(ting),'Chin-Sen Ting')+'。'+tE+' '+tCite;
if(fs.existsSync(fn(suhl)))throw Error('Suhl node already exists');
graph.set(fn(suhl),'# Harry Suhl\n\n> [!warning] 候选师承人物\n> UC San Diego 早期物理系教师，研究磁性与凝聚态理论。'+web('Physics Today 纪念文',su)+'。\n\n## 候选关系\n\n'+tInverse+'\n');
editLine(fn(mat),l=>l.startsWith('- 博士阶段学生：')&&l.includes('Paul Ching-Wu Chu'),l=>l+'\n'+tInverse);
changeRow(ting,'UC San Diego 1970；Harry Suhl、Bernd T. Matthias（低可信候选）',null,tCite+' · '+web('1976 APS 原卷',tb)+'。');
const tA=audit(ting,{phd:['group_or_candidate',tE,[ta,ucsd,th,su,ma]],postdoc:['confirmed_advisor','NYU 的 Joseph L. Birman 本人署名追忆仍确证。Houston 履历记录 Brown 博后；APS 1976 原卷证与 Ying 和 Quinn 同署名，Brown 阶段正式导师待核。',[bir,th,tb]],research:['confirmed','Houston 超导中心个人页列半导体、磁性、超导、强关联、自旋轨道耦合，履历确认物理系。',[tprof,th]]},'追 1970 UCSD 学位论文签署及 Brown 博后具名任用，保留 NYU 的明确导师。');
relation(ting,'phd',suhl,'candidate',tE,[ta,ucsd,th,su],tA);
relation(ting,'phd',mat,'candidate',tE,[ta,ucsd,th,ma],tA);
const chapter='## Kapitza 学位档与博士阶段候选补充（2026-11-10）';
const extra=[indexEntry(bok,'Jeffrey Bokor',bPhdLine),...tLines.map(l=>indexEntry(ting,'Chin-Sen Ting',l))];
const indexBase=graph.get(idx)??fs.readFileSync(idx,'utf8');
const eol=indexBase.includes('\r\n')?'\r\n':'\n';
graph.set(idx,indexBase.trimEnd()+eol+eol+chapter+eol+eol+extra.join(eol)+eol);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_卡皮察学位及跨院系续查';
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

