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
 a.audit_id='20261110_'+id+'_gt_msu_1215';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_gt_msu_1215_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const data=[["ecd83c0d","https://physics.gatech.edu/user/carlos-sa-de-melo","Ph.D., Stanford University, 1991","Georgia Tech 物理学院，理论凝聚态、超冷原子分子、超流及超导。","院档复核 Stanford 1991 博士。保留原有 Doniach 博士导师、Illinois Abrikosov 博后阶段研究师长。","追 Stanford 学位目录、Illinois 博后正式任用和个人指导原档。"],["fcc672a7","https://physics.gatech.edu/user/dragomir-davidovic","Rowland Fellowship, Johns Hopkins University 1990–1993","Georgia Tech 物理学院，纳米金属颗粒谱学、磁性及超导纳米结构。","院档核 Johns Hopkins 博士及不同时段合作，Reich 和 Tinkham 继续作分阶段候选。","查 Johns Hopkins 博士原件与 Harvard 当期任用档。"],["fd00985a","https://www.mse.gatech.edu/people/eric-vogel","1998 PhD Electrical Engineering, North Carolina State University","Georgia Tech 材料科学与工程，电子材料、纳米电子与半导体界面。","院档核 1998 NC State 电气工程博士、随后 NIST 领导 CMOS 和 Novel Devices 组，2006-08 进入 UT Dallas。旧候选 Hauser 保留。","查 NC State 论文和 NIST 初始任用，核独立博士后与个人指导。"],["faccac70","https://sciences.gatech.edu/news/doe-recognizes-georgia-tech-researchers-prestigious-early-career-awards","Itamar Kimchi, in the School of Physics","Georgia Tech 物理学院，理论量子材料、受挫磁体、量子自旋液体。","Georgia Tech 科学学院公告核同一人和研究方向。机会补充记录沿用 Vishwanath 博士导师、Senthil 研究师长和 Colorado 两组关系。","保留同人补充属性。继续核 MIT 和 Colorado 博后个人指导职衔。"],["ff84d03d","https://www.mse.gatech.edu/people/juan-pablo-correa-baena","Ph.D. Environmental Engineering at the University of Connecticut - 2014","Georgia Tech 材料科学与工程，钙钛矿、半导体及光伏材料。","院档核 2014 UConn 博士及 EPFL、DOE 博后奖项。保留 UConn 两位明确导师与 EPFL、MIT 两段博后组关系。","查 EPFL、MIT 当期正式个人导师和任期。"],["f63d69b9","https://www.mse.gatech.edu/people/natalie-stingelin","Professor & Chair","Georgia Tech 材料科学与工程系主任，研究有机功能材料、混合材料和光子学。","本人 2020 CV 明列 ETH 博士论文导师 Paul Smith 及 2001–2003 Cambridge Cavendish 博后。","核 Cambridge 博后任命与正式个人指导。"],["e2e289f4","https://www.mse.gatech.edu/people/scott-danielsen","a postdoctoral associate at Duke University and as a visiting scholar","Georgia Tech 材料科学与工程，聚合物和软物质、可持续材料。","院档核 2018 UCSB 化工博士、Duke 博后兼 UNC Chapel Hill 访问。访问单列，保留 Segalman／Fredrickson 博士导师及 Rubinstein 博后组负责人。","查 Duke 博后项目任期与正式个人指导，核 UNC 访问起止。"],["f2cf867c","https://engineering.jhu.edu/news/younan-xia-joins-hopkins-as-bloomberg-distinguished-professor-of-nanoscience-and-nanotechnology/","Previous role: Georgia Institute of Technology","JHU 2026-01 机构公告明确自 Georgia Tech 转任，现材料与生物医学工程双聘；纳米材料合成、自组装和等离激元。","Harvard 学位和 Whitesides 指导经 JHU 原院档交叉核读，原博后阶段两人关系继续保留。","追 Harvard 博后个人指导职衔；Georgia Tech 后续有无兼任资格待任用原档。"],["f19b25f7","https://engineering.msu.edu/directory/faculty/leea","Ph.D, Physics/Materials Science, University of Illinois, Urbana 1987","Michigan State 化学工程与材料科学，高分子、复合材料及熔体动力学。","学院核 1987 Illinois 博士身份；IDEALS 学位页仍未返回正文。保留 NIST Polymers Division 阶段待查。","继续定位 Illinois 论文原件或馆藏可读字段，以及 NIST 1987–1989 人员原档。"],["f8facf71","https://levinegroup.org/wp-content/uploads/2025/03/cv-2025-03-07-1.pdf","Graduate Adviser: Todd J. Martínez; Supervised by Professor Michael L. Klein","Stony Brook 化学及 2025 本人 CV 所列物理系兼任，Michigan State 原任并列当时 Adjunct Assistant Professor。计算光化学和激发态动力学。","本人 CV 第 1 页在 Illinois 博士条目明确 Todd J. Martínez，且 Penn 与 Temple 两条博后任用各明确由 Michael L. Klein 指导。","随现任或兼职变动复查。博士及两段博后个人指导已有直接原证。"],["e0eed2de","https://nanoten.com/tomanek/vita.html","1985 Post-Doctoral Fellow, AT&T Bell Labs","Michigan State 物理与天文，计算纳米科学和理论凝聚态。","本人 CV 核 1983 FU Berlin 博士、1985 Bell Labs 博后及 1985–1987 Berkeley 博后。同期 FU Berlin Assistant Professor on leave 另列，原有 Bennemann、Schlüter、Louie 继续作候选。","追 FU Berlin 论文或指导原档、Bell 和 Berkeley 博后当期正式指导。"],["faa93385","https://www.chemistry.msu.edu/faculty-research/faculty-members/mcCusker-james.aspx","NIH Post-Doctoral Fellow, 1992-94, Univ. of North Carolina at Chapel Hill","Michigan State 化学，超快光谱、光化学和无机激发态。","院档复核 Illinois 1992 博士、UNC 1992–1994 NIH 博后。保留 Hendrickson 博士导师、Meyer 博后阶段研究师长。","追 UNC 个人博后指导原件或本人履历的正式称谓。"],["fa3e675e","https://apps.math.msu.edu/PageSpace/pb/jeffrey-schenker/ShortCV/SchenkerCV.pdf","Ph.D. in Mathematics (2002)","Michigan State 数学教授，数学物理、随机算子与无序量子系统。","本人 CV Princeton 数学博士条目明确 Michael Aizenman；分列 UCI 2002–2003、ETH 2003–2005 与 IAS 2005–2007。","分地点追三段博士后个人指导及岗位任用原档。"],["e224bcfd","https://directory.natsci.msu.edu/media/Directory/Profiles/Pollanen_C20260221163404.pdf","Advisor: William P. Halperin; IQIM Postdoctoral Scholar of Physics at Caltech, Eisenstein Group","Michigan State 物理与天文，实验凝聚态、低温与量子器件。","2026 本人 CV 第 1 页明确 2012-03 Northwestern 博士导师 William P. Halperin 和论文题名，分列 2012–2015 Caltech Eisenstein Group 博后。","追 Caltech 正式博后指导称谓，保留阶段研究师长。"],["e90143a8","https://www.chemistry.msu.edu/faculty-research/faculty-members/chiu-melanie.aspx","Melanie Chiu","Michigan State 化学，功能聚合物、聚合物合成及软材料。","MSU 院档核化学任职和方向；校刊核 Berkeley 博士。保留已核两位博士导师及 ETH／Stanford 两段不同角色。","追 Diederich、Bao 的博士后正式指导职衔。"],["f6167b1b","https://web.pa.msu.edu/people/ghosh/Ghosh-CV-Jan2012.pdf","Ph.D. Applied & Engineering Physics (1991); Advisor: Robert H. Silsbee","Michigan State 物理与天文，凝聚态实验、光电子与传感。","本人 CV 列 1991 Cornell 应用与工程物理博士题名；Silsbee 在博士期间 Research Assistant 项为 Advisor，另列早期硕士指导。1991–1994 NIST 博后导师待核。","追 Cornell 学位论文正式签署与 NIST 博后指导档。"]];
const more={"f63d69b9":[["https://www.lcpo.fr/uploads/members/cv/stingelinnatalie.pdf","Thesis advisor: Prof. Paul Smith; Postdoctoral Fellow, Cavendish Laboratory","本人 CV 第 2 页分列 ETH 2001 博士论文导师和 2001–2003 Cambridge 博后。"],["https://citeseerx.ist.psu.edu/document?doi=4a61745f6130ba77ed3c1b39bc4c9443a4244402&repid=rep1&type=pdf","Scanning Force Microscopy of Organic Thin Films; Natalie Stutzmann","本人博士论文可读副本及致谢，确认姓名和论文题目。"]],"f2cf867c":[["https://engineering.jhu.edu/materials/faculty/younan-xia/","he conducted research under the mentorship of George M. Whitesides","JHU 材料系现任及 Harvard 博士阶段指导原档。"],["https://chemistry.gatech.edu/people/younan-xia","Ph.D. Harvard University, 1996","Georgia Tech 旧化学院档仍可读，现职用 JHU 转任公告。"]],"f8facf71":[["https://www.stonybrook.edu/commcms/chemistry/people/faculty_profiles/Levine_Benjamin.php","IACS Endowed Professor of Chemistry","Stony Brook 化学系原任职页。"]],"e90143a8":[["https://www.chemistry.msu.edu/news/chiu-spotlight-6-26-23.aspx","earning her Ph.D. at the University of California, Berkeley","MSU 校刊核 Berkeley 学位和当期研究。"]]};
const u=(label,url)=>web(label,url)+'。';
const le='f8facf71', le2='bee88593', na='f63d69b9', po='e224bcfd', xi='f2cf867c', xi2='4a546812';
const docs=new Map(data.map(x=>[x[0],x]));
const entries=[...data,[le2,...docs.get(le).slice(1)],[xi2,...docs.get(xi).slice(1)]];
const auditsById=new Map();
for(const [id,src,raw,aff,ev,next] of entries){
 const base=id===le2?le:id===xi2?xi:id;
 const related=more[base]??[];
 const refs=[src,...related.map(x=>x[0])];
 const proof=u(base===le||base===po||base==='fa3e675e'||base==='e0eed2de'||base==='f6167b1b'?'本人履历':'院系或校方原档',src)+related.map(x=>u('相关原证',x[0])).join('')+ev;
 const a=JSON.parse(latest.get(id).details_json);
 const resolve=[le,le2,na,po].includes(id);
 if(id===na)editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+proof+' ETH 学位论文署名为 Natalie Stutzmann，审查身份和本人履历的论文导师字段并记。');
 else note(id,'- 核查边界：',proof);
 const phd=id===na?'Paul Smith (ETH Zurich)（本人 CV 列博士论文导师）':null;
 const post=id===na?'Cambridge Cavendish 2001–2003 博后，个人导师待核':id===le||id===le2?'Michael L. Klein（Penn、Temple 博后导师）':null;
 changeRow(id,phd,post,proof);
 const idAudit=audit(id,{
 phd:[resolve?'confirmed_advisor':a.aspects.phd.status,resolve?ev:a.aspects.phd.note,refs],
 postdoc:[id===le||id===le2?'confirmed_advisor':a.aspects.postdoc.status,ev,refs],
 affiliation:['confirmed',aff,refs],research:['confirmed',aff,refs]
 },next);
 if(id===le||id===le2)audits.at(-1).followup_required=false;
 auditsById.set(id,idAudit);
}
const paul='师承人物 - Paul Smith (ETH Zurich)', old='博士阶段课题组负责人';
const np=u('本人 2020 CV 第 2 页',more[na][0][0])+'ETH 博士条目明确 Thesis advisor: Prof. Paul Smith。';
replaceNoteLabel(na,old,'博士导师',paul,' '+np);
replaceInverseLabel(paul,na,'博士课题组成员','博士生',' '+np);
replaceIndexLabel(na,paul,old,'博士导师',' '+np);
relation(na,'phd',paul,'advisor',np,[more[na][0][0],more[na][1][0]],auditsById.get(na),false);
const pproof=u('本人 2026 CV 第 1 页',docs.get(po)[1])+'在 Northwestern 物理博士条目明确 Advisor: William P. Halperin。';
enrich(po,'phd',local('205f65de'),'博士生',pproof);
relation(po,'phd',local('205f65de'),'advisor',pproof,[docs.get(po)[1]],auditsById.get(po),false);
for(const id of [le,le2]){
 for(const [s,t,rev,ev] of [
 ['phd','师承人物 - Todd J. Martínez','博士生','Illinois 博士条目明确 Graduate Adviser Todd J. Martínez。'],
 ['postdoc','师承人物 - Michael L. Klein','博士后研究者','Penn 与 Temple 两条博士后任用均明确受 Michael L. Klein 指导。']
 ]){
  const proof=u('本人 CV 第 1 页',docs.get(le)[1])+ev;
  enrich(id,s,t,rev,proof);
  relation(id,s,t,'advisor',ev,[docs.get(le)[1]],auditsById.get(id),false);
 }
}

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_GeorgiaTech与MSU原档';
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
