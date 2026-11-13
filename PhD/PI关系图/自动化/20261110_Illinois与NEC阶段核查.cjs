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
 a.audit_id='20261110_'+id+'_illinois_nec_1100';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_illinois_nec_1100_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const a='598ad105', fish='e180d959', xin='5822368e', den='e37b0ebd', raj='5f75764a';
const wing='师承人物 - Ned S. Wingreen', mark='师承人物 - S. Mark Spearing';
const wingCv='https://molbio.princeton.edu/sites/g/files/toruqf5546/files/documents/wingreen_cv_9_20.pdf';
const aleinerBio='https://www.columbia.edu/cu/physics/fac-bios/Aleiner/faculty.html';
const aip='https://history.aip.org/catalog/icos/47466.html', kitp='https://www.kitp.ucsb.edu/about-us/people/scientists/fisher';
const bu='https://www.bu.edu/eng/2018/10/24/engs-xin-zhang-is-bus-2018-innovator-of-the-year-first-woman-chosen/';
const xinLab='https://sites.bu.edu/xinzhang-lab/laboratory/admission/';
const spearingPaper='https://sites.engineering.ucsb.edu/~sumita/courses/Courses/ME141B/Spearing_DRIE_2002.pdf';
const spearingBio='https://www.southampton.ac.uk/about/governance/mark-spearing.page';
const otherXin='https://people.csail.mit.edu/xzhang/resume.pdf';
const rajBio='https://physics.ucdavis.edu/people/faculty/rajiv-singh';
const denCv=db.prepare("select url from pages where id='d47120232b623a4f0b5427be'").get().url;

const aleinerText='Wingreen 本人 CV 第 21 页将 Igor Aleiner 列在 TRAINEES 的 Postdoctoral Fellows 栏，1997-09–1998-03。第 1 页列 Wingreen 1991–1999 年在 NEC Research Institute 任研究科学家。Columbia 原档的毕业年份及合著书目与履历吻合。按博士后阶段研究师长记录，正式 advisor 职衔待核。';
const aleinerProof=web('Wingreen 本人 CV 第 1、21 页',wingCv)+' · '+web('Columbia 物理系原档',aleinerBio)+'。'+aleinerText+' 关系类型可信度：高。';
addEdge(a,'博士后阶段研究师长',wing,'Ned S. Wingreen',aleinerProof,local('2e3b5830'));
newMentor(wing,'Ned S. Wingreen','Princeton 托管的本人 CV 记录了 NEC 任职和研究训练名单。 '+web('本人 CV',wingCv),a,'博士后阶段研究者',aleinerProof);
editLine(fn(local(a)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：Minnesota 理论物理研究所原档明确 Glazman 为 1996 年博士导师。Wingreen 本人 CV 支持上述 1997–1998 年博士后阶段指导关系；正式职衔待核。');
changeRow(a,null,'Ned S. Wingreen（博士后阶段研究师长，1997-09–1998-03）',web('Wingreen 本人 CV',wingCv));
const aa=audit(a,{postdoc:['group_or_candidate',aleinerText,[wingCv,aleinerBio]]},'查 NEC 博后聘任原档与是否明确使用 advisor、supervisor；分别核查其他早期岗位。');
relation(a,'postdoc',wing,'stage_mentor',aleinerText,[wingCv,aleinerBio],aa);

const fishText='AIP Niels Bohr Library & Archives 口述史馆藏将 IBM 初期明确列为博士后、随后在 IBM 继续任职。UCSB KITP 原档给出 1986–1993 年 IBM Watson 的总体时段，并分别称 Visiting Scientist 和 Research Staff Member。初期聘任的精确起止及个人导师仍待查。AIP 另记其转至 Illinois 之前曾在 MIT 的 Robert Birgeneau 实验室做研究生研究。';
const fishProof=web('AIP 本人口述史馆藏',aip)+' · '+web('UCSB KITP 履历',kitp)+'。'+fishText;
editLine(fn(local(fish)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+fishProof);
changeRow(fish,null,'IBM Watson 初期博士后（KITP 职称写 Visiting Scientist），其后 Research Staff Member；个人导师待核',web('AIP 口述史馆藏',aip)+' · '+web('UCSB KITP',kitp));
const fa=audit(fish,{postdoc:['unresolved',fishText,[aip,kitp]],identity:['confirmed','AIP 与 KITP 对应 UCSB 凝聚态物理学者、Illinois 博士。已核 Yale 心理学与 SMU 管理履历为另一同名者。',[aip,kitp]]},'查 IBM 博后期聘任和本人或同事材料，区分岗位职称、任期与个人指导。');

const xinText='BU 院档明确 HKUST 博士及 MIT 博后，BU 本人课题组页复核机械工程主聘和 ECE、BME、材料兼聘。2001 年提交的原论文分别标注 Zhang 在 MIT MTL／EECS、S. Mark Spearing 在 MIT 航空航天系。Southampton 履历证实 Spearing 当时为 MIT 教员。暂列同期研究低可信候选，发表资料不足以确认合作发生在博士后阶段或个人指导。';
const xinProof=[web('BU 工程学院',bu),web('同期原论文及作者单位',spearingPaper),web('Spearing 原校履历',spearingBio)].join(' · ')+'。'+xinText+' 关系类型可信度：低。';
addEdge(xin,'博士后导师候选',mark,'S. Mark Spearing',xinProof,null,true);
newMentor(mark,'S. Mark Spearing','Southampton 官方履历列其 1994–2004 年在 MIT 从事研究和教学。 '+web('Southampton 履历',spearingBio),xin,'博士后候选研究者',xinProof);
note(xin,'- [[已核实单位 - Boston University - 机械工程系',web('本人 BU 课题组任职列表',xinLab)+'。');
note(xin,'- 核查边界：','MIT CSAIL 的 Xin Zhang 履历属于 Georgia Tech 计算机博士同名者。'+web('另一人的 CSAIL 履历',otherXin)+'。');
changeRow(xin,null,'MIT 博后、后续研究科学家；S. Mark Spearing（同期合作低可信候选）',web('本人组档',xinLab)+' · '+web('同期原论文',spearingPaper));
const xa=audit(xin,{postdoc:['group_or_candidate',xinText,[bu,spearingPaper,spearingBio]],affiliation:['confirmed','本人 BU 实验室原页列机械工程主聘、ECE、BME 和材料兼聘。',[xinLab]],identity:['confirmed','BU 与 HKUST 机械工程、MIT 微纳机电；CSAIL 履历同名者为 Georgia Tech 计算机博士。',[bu,otherXin]]},'查 HKUST 博士论文签署页及 MIT MTL 岗位分段与正式带教；避开 CSAIL 同名者。');
relation(xin,'postdoc',mark,'candidate',xinText,[bu,spearingPaper,spearingBio],xa);

const denText='本人 CV 任职表列 1988 年 USC 电气工程博士、1988–1991 年 Hewlett-Packard Optoelectrics 研发工程师和 1991 年起 UCSB 教职；所阅 CV 未分列独立博士后。';
editLine(fn(local(den)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+denText+web('本人 CV 第 1 页',denCv)+'。');
changeRow(den,null,'1988–1991 HP 研发工程师；所阅履历未分列独立博士后',web('本人 CV 第 1 页',denCv));
audit(den,{postdoc:['no_postdoc_documented',denText,[denCv]]},'如有 HP 或本人同期任命资料，复核毕业后职位性质。');

const rajText='UC Davis 物理系档案分列 1986 年 Stony Brook 博士、1986–1987 年 Cornell Postdoctoral Associate 及 1987–1988 年 Maryland Postdoctoral Associate；未点名个人指导。';
note(raj,'- 核查边界：',web('UC Davis 物理系履历',rajBio)+'。');
changeRow(raj,'1986 Stony Brook 博士；个人导师待核','Cornell 1986–1987、Maryland 1987–1988 博后；个人导师待核',web('UC Davis 物理系履历',rajBio));
audit(raj,{phd:['unresolved',rajText,[rajBio]],postdoc:['unresolved',rajText,[rajBio]]},'查 Stony Brook 学位签署页与 Cornell、Maryland 两段博后指导人。');

const uiSources=new Map(JSON.parse(fs.readFileSync('20261110_1054_UIUC首读原页回执.json','utf8')).map(x=>[x.record_id,x.url]));
const eck='https://mrl.illinois.edu/news/james-eckstein-wins-aps-mcgroddy-prize';
const chiang='https://groups.mrl.illinois.edu/chiang/chiang/vita_chiang.pdf';
const vid='https://www.moore.org/article-detail?newsUrlName=beyond-the-lab-vidya-madhavan-ph.d';
const ui=[
 ['e197f725','Illinois 物理系','原档列 1995 年 Grenoble／CNRS 物理博士及 Delft、Harvard 两地博士后。',null,'Delft、Harvard 博后；Cees Dekker、Michael Tinkham（候选）'],
 ['f6adceef','本人实验室','PI 栏核 Illinois 机械科学与工程任职、2011 年 Cornell 博士。'],
 ['f8570b4c','Illinois Grainger','原档核物理系，计算凝聚态和量子信息。博士年份差异保留。',null,null,null,null,'research'],
 ['f5c8e221','英国皇家化学会','获奖履历直接点名 A. B. Ellis 指导 Wisconsin 博士，明确 1990–1993 年 Caltech 博后。',null,'Jacqueline K. Barton（Caltech 博士后课题组负责人，1990–1993）','phd'],
 ['ebda96c0','Illinois Grainger','原档列 1979 年 Stanford 博士、1979 年 Illinois 博后、1981 年 Illinois 教职。'],
 ['dd9ad266','Illinois 物理系','校方分别记 1978 年 Stanford 博士、Stanford 博后、Varian 研究科学家、1997 年 Illinois 物理系教职。',null,'Stanford 博后；John M. J. Madey（候选）','postdoc',eck],
 ['84fd71de','Illinois MRL','原档确认 Sherbrooke 博后在 Taillefer 实验室，随后在 Berkeley Analytis 组。'],
 ['fbd85013','Illinois IQUIST','原档核 ECE 教授及面向原子与离子量子控制的 III–V 光电子器件。',null,null,null,null,'research'],
 ['ea0aa16d','Illinois 物理系','原档核 Illinois 物理系兼职和 UCLA 博士导师 Seth Putterman；另列 2002–2005 年 IBM Almaden Visiting Scientist。',null,'UCLA 博后 Putterman（候选）；2002–2005 IBM Almaden 为访问科学家','postdoc'],
 ['f4789b16','Illinois MRL','MRL 档与本人 CV 核 MRL Research Professor、物理系荣休、1978 年 Berkeley 博士及 1978–1980 年 IBM Watson 博后。',null,'IBM Watson 博后（1978–1980）；D. E. Eastman（候选）','postdoc',chiang],
 ['e4d6ef17','Illinois 物理系','原档的 2000 年 Boston University 博士与 1999–2002 年 Berkeley 博后日期有重叠，均按原文保留。本人访谈另复核量子材料与 STM 研究方向。',null,null,'postdoc',vid,'research'],
 ['fa3f7eed','Illinois ECE','原档核 2003 年 Yale 电气工程博士、2003–2008 年 IBM Advisory Engineer/Scientist、2008–2014 年 Research Staff Member。所阅履历未分列独立博士后。',null,'IBM 工程及科研岗位；所阅履历未分列独立博士后','no_postdoc_documented'],
 ['afeb9546','本人实验室','履历分列 2006–2011 年 MIT 博士、2011–2014 年 Stanford 化工博士后。',null,'Zhenan Bao（Stanford 博士后课题组负责人，2011–2014）','postdoc'],
 ['a42a2c5b','Illinois 化学系','原档列 1980 年 MIT 有机化学博士、随后 Bell Labs、1991 年 Illinois 教职。所阅履历未分列独立博士后。',null,'Bell Labs 技术研究岗位；所阅履历未分列独立博士后','no_postdoc_documented'],
 ['9816734a','Illinois ECE','Virginia 博士在 2010 年 5 月，Penn 博后在官方履历起于 2010 年 4 月，月度日期有重叠。2012–2013 Carnegie Mellon Research Scientist 另列。',null,null,'postdoc']
];
for(const [id,label,detail,phd,postdoc,stage,additional,extraAspect] of ui){
 const urls=[uiSources.get(id),...(additional?[additional]:[])];
 const refs=urls.map((url,index)=>web(index?'补充原档':label,url)).join(' · ');
 const r=records.get(id);
 if(id==='9816734a')note(id,'- 博士后导师：',refs+'。'+detail);
 else note(id,'- 核查边界：',refs+'。'+detail);
 changeRow(id,phd,postdoc,refs+'。'+detail);
 const old=JSON.parse(latest.get(id).details_json);
 const changes={};
 const field=stage==='no_postdoc_documented'?'postdoc':stage||extraAspect||'affiliation';
 const status=stage==='no_postdoc_documented'?'no_postdoc_documented':old.aspects[field].status;
 changes[field]=[status,old.aspects[field].note+' '+detail,urls];
 if(extraAspect&&extraAspect!==field)changes[extraAspect]=[old.aspects[extraAspect].status,old.aspects[extraAspect].note+' '+detail,urls];
 audit(id,changes,old.next_step);
}
const excluded=[
 {page_id:'5026b9f14ca3d68306782652',record_id:fish,audit_id:fa,url:'https://psychology.yale.edu/people/matthew-fisher',external_subject:'Matthew Fisher，Yale 心理学博士，后任 SMU Cox 教职',evidence:'Yale 心理学档和 SMU 本人履历对应同一人，履历列 2017 Yale 心理学博士。AIP 馆藏所记 UCSB 凝聚态物理学者则在 Illinois 完成博士，随后任 IBM 博后。'},
 {page_id:'99468f87ea790f08051a8343',record_id:fish,audit_id:fa,url:'https://www.smu.edu/-/media/Site/Cox/Faculty/CV/Profile/Fisher-matthew-CV.pdf',external_subject:'Matthew Fisher，Yale 心理学博士，后任 SMU Cox 教职',evidence:'SMU 本人 CV 第 1 页明确是 2017 Yale 心理学博士。AIP 馆藏所记 UCSB 凝聚态物理学者则在 Illinois 完成博士，随后任 IBM 博后。'}
];
for(const x of excluded)x.url=db.prepare('select url from pages where id=? and record_id=?').get(x.page_id,x.record_id).url;


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Illinois与NEC阶段核查';
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

const identityFile=stamp+'_身份排除.json';
fs.writeFileSync(identityFile,JSON.stringify(excluded,null,2)+'\n','utf8');
console.log(execFileSync(process.execPath,['--no-warnings','人物网页身份纠偏.cjs',identityFile],{encoding:'utf8'}).trim());
