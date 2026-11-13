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
 const i=matches[0];lines[i]=edit(lines[i]).replace(/\r?\n/g,end);
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
 a.audit_id='20261110_'+id+'_named_postdoc_supervision_1751';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_named_postdoc_supervision_1751_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const kev='c580a20d',kevan='师承人物 - Stephen D. Kevan';
const kevanCV='https://pages.uoregon.edu/kevan/cvsdk.pdf',smithCV='https://www.bu.edu/physics/files/2021/05/Smith_CV.pdf';
const ks='Kevan 本人 CV 的 Postdoctoral Associates Supervised 栏具名 Kevin Smith，1988–1991，后任 BU 物理教师。Smith 本人 CV 确认同年段 Oregon Physics Research Associate，随后加入 BU。正式关系按明确的岗位指导记为博士后导师，保留两份原文的称谓。';
const kSources=web('Kevan 本人 CV',kevanCV)+' · '+web('Smith 本人 CV',smithCV);
function rewriteRole(id,target,previous,current,evidence,sources,reversePrefix){
 const t='[['+target+'|';
 editLine(fn(local(id)),l=>l.startsWith('- '+previous+'：')&&l.includes(t),l=>'- '+current+'：'+l.slice(l.indexOf(t),l.indexOf(']]',l.indexOf(t))+2)+'。'+evidence+' '+sources);
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+previous+'：')&&l.includes(t),l=>l.slice(0,l.indexOf(' → '))+' → '+current+'：'+l.slice(l.indexOf(t),l.indexOf(']]',l.indexOf(t))+2)+'。'+evidence+' '+sources);
 editLine(fn(target),l=>l.startsWith(reversePrefix)&&l.includes('[['+local(id)+'|'),l=>{
  const pos=l.indexOf('[['+local(id)+'|');
  return '- 博士后研究者：'+l.slice(pos,l.indexOf(']]',pos)+2)+'。'+evidence+' '+sources;
 });
}
rewriteRole(kev,kevan,'博士后阶段研究师长','博士后导师',ks,kSources,'- 博士后受监督者：');
changeRow(kev,null,'Stephen D. Kevan（Oregon 1988–1991，CV 明列指导）',kSources);
let aid=audit(kev,{postdoc:['confirmed_advisor',ks,[kevanCV,smithCV]]},'保留 Victor Henrich 为博士候选，继续查 Yale 1988 年应用物理博士论文及 1989 年 Becton 学位论文奖档。');
relation(kev,'postdoc',kevan,'advisor',ks,[kevanCV,smithCV],aid,false);

const foster='a1a22492',gaeta='人员 - Columbia - Alexander L. Gaeta - 27209b2d';
const gaetaCV='https://www.engineering.columbia.edu/sites/default/files/2025-07/gaeta_cv_4_25.pdf',jhu='https://engineering.jhu.edu/ece/faculty/mark-foster/';
const fsProof='Gaeta 本人 CV 分列 PhD Students Supervised 和 Postdoctoral Associates Supervised，两栏均具名 Mark Foster（Johns Hopkins）。JHU 电气与计算机工程档独立确认 Cornell 2008 博士、在 Cornell 受聘 Postdoctoral Associate，随后于 2010 年入职 JHU。';
const fsLinks=web('Gaeta 本人 CV',gaetaCV)+' · '+web('JHU ECE 原档',jhu);
rewriteRole(foster,gaeta,'博士后阶段研究师长','博士后导师',fsProof,fsLinks,'- 博士后阶段研究者：');
editLine(fn(local(foster)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Cornell 学位与同校博士后是分开的任用。JHU 院系档列 2008 博士、2010 年加入 JHU，博后确切起止月份仍待本人完整履历。 '+web('JHU ECE 原档',jhu));
changeRow(foster,'Alexander L. Gaeta（CV 明列博士指导）','Alexander L. Gaeta（Cornell，CV 明列博士后指导）',fsLinks);
aid=audit(foster,{postdoc:['confirmed_advisor',fsProof,[gaetaCV,jhu]]},'如取得 Cornell 博士后任命书或本人长版 CV，补确切起止年月。');
relation(foster,'postdoc',gaeta,'advisor',fsProof,[gaetaCV,jhu],aid,false);

const chen='a64a6966',paola='人员 - MIT - Paola Cappellaro - cb14a188',painter='人员 - Caltech - Oskar Painter - cd1f2756';
const paolaCV='https://qeg.scripts.mit.edu/images/Cappellaro_0621CV.pdf',uw='https://mse.washington.edu/facultyfinder/mo-chen',cal='https://painterlab.caltech.edu/alumni/',cua='https://cua.mit.edu/people/mo-chen';
const cp='Cappellaro 本人 CV 的 Postdoctoral Researchers Supervised 栏明确列 Mo Chen 2019–2020。MIT–Harvard CUA 原档把他列为 Cappellaro Group 的 Postdoc，UW 材料系核 MIT 和 Caltech 两段博后。';
const cd='Cappellaro 本人 CV 的 Thesis advisor, Ph.D. 栏具名 Mo Chen 并记 2019，UW 现任院系档列 MIT 机械工程博士 2020。两种日期保留。';
const ca='Painter 实验室校友原档列 Mo Chen 为 Post-Doc 并记 July 2024，UW QuantumX 原档确认 Caltech Painter 组。正式个人指导待任用材料。';
const cx='https://www.quantumx.washington.edu/people/?profile_type=qx-faculty';
const chenLinks=web('MIT 本人 CV 可读原档',paolaCV)+' · '+web('CUA 人员档',cua)+' · '+web('UW 材料系原档',uw);
rewriteRole(chen,paola,'博士后阶段研究师长','博士后导师',cp,chenLinks,'- 博士后阶段研究者：');
note(chen,'- 博士导师：',cd+' '+web('MIT 本人 CV 可读原档',paolaCV));
mentorLine(paola,chen,'- 博士生：',web('MIT 本人 CV 可读原档',paolaCV));
indexLine(chen,paola,'博士导师',web('MIT 本人 CV 可读原档',paolaCV));
note(chen,'- 博士后课题组负责人：',ca+' '+web('Painter 校友原档',cal));
indexLine(chen,painter,'博士后课题组负责人',web('Painter 校友原档',cal));
editLine(fn(local(chen)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：MIT 2019–2020 博后有具名指导。Caltech Painter 阶段为确认的课题组关系。博士学位年份 UW 写 2020、Cappellaro CV 写 2019，待 MIT 学位档确认。');
changeRow(chen,'Paola Cappellaro（CV 明列论文指导，授位年份待核）','Paola Cappellaro（MIT 2019–2020，CV 明列指导）；Oskar Painter（Caltech 课题组负责人）',chenLinks+' · '+web('Painter 校友原档',cal));
aid=audit(chen,{phd:['confirmed_advisor',cd,[paolaCV,uw]],postdoc:['confirmed_advisor',cp+' '+ca,[paolaCV,uw,cal,cua,cx]]},'MIT 学位馆藏恢复后核实际授位日期。继续查 Caltech 博后任用书或本人 CV 的具名指导字段。');
relation(chen,'phd',paola,'advisor',cd,[paolaCV,uw],aid);
relation(chen,'postdoc',paola,'advisor',cp,[paolaCV,uw,cua],aid);
relation(chen,'postdoc',painter,'group_leader',ca,[cal,cx,uw],aid);

const rebecca='1f49720a',wood='师承人物 - Robert J. Wood';
const princeton='https://mae.princeton.edu/people/rebecca-kramer-bottiglio',rcv='https://mae.princeton.edu/document/3376';
const harvard='https://seas.harvard.edu/news/kramer-botiglio-wins-top-nsf-honor',woodGroup='https://www.micro.seas.harvard.edu/people';
const rp='Princeton 院系托管的本人 CV 在任用条目中将 2012 年 6–12 月 Harvard Postdoctoral Researcher 明列在 Harvard Microrobotics Lab。Harvard 工学院原档确认实验室由 Robert J. Wood 领导。具名的个人博后指导仍待查。';
const rProof=rp+' '+web('本人 CV',rcv)+' · '+web('Harvard 工学院原档',harvard)+' · '+web('实验室校友页',woodGroup);
editLine(fn(local(rebecca)),l=>l.startsWith('- 博士后：'),()=>'- 博士后课题组负责人：[['+wood+'|Robert J. Wood]]。'+rProof);
editLine(fn(wood),l=>l.startsWith('- 博士生：')&&l.includes(local(rebecca)),l=>l+'\n- 博士后课题组成员：[['+local(rebecca)+'|Rebecca Kramer-Bottiglio]]。'+rProof);
editLine(idx,l=>l.startsWith('- [['+local(rebecca)+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+local(rebecca)+'|Rebecca Kramer-Bottiglio]] → 博士后课题组负责人：[['+wood+'|Robert J. Wood]]。'+rProof);
note(rebecca,'- Yale 为历史任职',web('Princeton MAE 现任档',princeton)+' · '+web('本人 CV',rcv));
changeRow(rebecca,null,'Robert J. Wood（Harvard Microrobotics Lab 课题组负责人，2012 年 6–12 月）',web('本人 CV',rcv)+' · '+web('Harvard 工学院原档',harvard));
aid=audit(rebecca,{affiliation:['confirmed','Yale 机械工程与材料科学为历史任用。Princeton MAE 现任档及本人 CV 列现任 Princeton 机械与航空航天工程教授。',[princeton,rcv]],postdoc:['group_or_candidate',rp,[rcv,harvard,woodGroup]]},'追查 Harvard 2012 年独立博士后任用文件中的具名指导。');
relation(rebecca,'postdoc',wood,'group_leader',rp,[rcv,harvard,woodGroup],aid);

const yuz='1fbe9553',boris='人员 - Columbia - Boris Altshuler - 8da135b8';
const packard='https://www.rutgers.edu/news/rutgers-physicist-earns-packard-foundation-science-and-engineering-fellowship',yuzPaper='https://arxiv.org/pdf/cond-mat/0305635',borisCV='https://www.nzias.ac.nz/Docs/BorisAltshuler/Altshuler_CV.pdf',yuzCmt='https://cmt.rutgers.edu/people/emil-yuzbashyan/';
const yp='Rutgers 同期院校档列 Princeton 2004 物理博士。2003 年原稿将 Yuzbashyan、Altshuler 同署 Princeton Physics 和 NEC Research Institute，Altshuler 本人 CV 核同期 Princeton 教职。保留为博士导师候选，正式指导待档案。';
const yz='Rutgers 2008 年报道列 2004 年博士毕业后加入 Rutgers，报道发布时为助理教授；未指明 2004 年的初始职位，仍待核是否有博后。';
const yzLink=yp+' '+web('Rutgers 任职档',packard)+' · '+web('2003 年原稿',yuzPaper)+' · '+web('Altshuler 本人 CV',borisCV);
editLine(fn(local(yuz)),l=>l.startsWith('- 核查边界：'),()=>'- 博士导师候选：[['+boris+'|Boris Altshuler]]。'+yzLink+'\n- 核查边界：'+yz+' '+web('Rutgers 任职档',packard));
editLine(fn(boris),l=>l==='## 师承',l=>l+'\n\n- 博士候选研究者：[['+local(yuz)+'|Emil Yuzbashyan]]。'+yzLink);
editLine(idx,l=>l.startsWith('- [[人员 - Rice - Matthew Foster - 2f0b9b07|')&&l.includes('[['+local(yuz)+'|'),l=>l+'\n- [['+local(yuz)+'|Emil Yuzbashyan]] → 博士导师候选：[['+boris+'|Boris Altshuler]]。'+yzLink);
changeRow(yuz,'Boris Altshuler（同单位同期论文候选）','2004 年加入 Rutgers，当年任用类型待核',web('Rutgers 任职档',packard)+' · '+web('2003 年原稿',yuzPaper));
aid=audit(yuz,{phd:['group_or_candidate',yp,[packard,yuzPaper,borisCV]],postdoc:['unresolved',yz,[packard,yuzCmt]]},'继续以 Emil A. Yuzbashyan 和 Princeton 2004 追查学位档案或本人长版 CV。查 Rutgers 2004 录用性质。');
relation(yuz,'phd',boris,'candidate',yp,[packard,yuzPaper,borisCV],aid);

const sherwin='a80d4f46',zettl='人员 - UC Berkeley - Alex Zettl（荣休） - 63770bc9',richards='师承人物 - Paul L. Richards';
const ss='https://www.physics.ucsb.edu/people/mark-sherwin',sPub='https://sherwingroup.itst.ucsb.edu/publications/',mrsec='https://mrlweb.mrl.ucsb.edu/sites/default/files/mrl_docs/2015-UCSB-MRSEC-AnnualReport-BOOKLET.pdf';
const sh='本人 UCSB 组论文档列 Sherwin 在 1986–1988 年与 Zettl 和 Richards 合作的电荷密度波及红外光谱文章，学校原档核同一时段在 Berkeley 物理系读博。此前 UCSB MRSEC 将两位列在混合阶段栏目，保留博士候选，正式导师及具体角色待学位档。';
const shp='UCSB 物理系原档列 1988 年春 Berkeley 博士，同年秋加入 UCSB 物理系任助理教授。已核履历未见独立博士后。';
for(const mentor of [zettl,richards]){
 editLine(fn(local(sherwin)),l=>l.startsWith('- 博士候选关系：')&&l.includes('[['+mentor+'|'),l=>l+' '+sh+' '+web('本人课题组论文档',sPub));
 mentorLine(mentor,sherwin,'- 博士候选研究者：',web('本人课题组论文档',sPub));
 indexLine(sherwin,mentor,'博士候选关系',web('本人课题组论文档',sPub));
}
editLine(fn(local(sherwin)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+shp+' '+web('UCSB 院系原档',ss));
changeRow(sherwin,null,'已核履历未见独立博士后，1988 春授位、秋任 UCSB 助理教授',web('UCSB 院系原档',ss)+' · '+web('本人课题组论文档',sPub));
aid=audit(sherwin,{phd:['group_or_candidate',sh,[mrsec,sPub,ss]],postdoc:['no_postdoc_documented',shp,[ss]]},'查 Berkeley 1988 物理学位书目或实验室博士生登记。eScholarship 队列文档检索索引显示为他人论文，原页无法读取时仅作误配候选。');
for(const target of [zettl,richards])relation(sherwin,'phd',target,'candidate',sh,[mrsec,sPub,ss],aid);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_具名博士后指导与组属复核';
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

