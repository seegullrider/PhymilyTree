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
 a.audit_id='20261110_'+id+'_msu_original_1349';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_msu_original_1349_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const p={
 tom:'https://nanoten.com/tomanek/manuscripts/DT013.pdf',tomCV:'https://nanoten.com/tomanek/vita.html',tomMSU:'https://directory.natsci.msu.edu/directory/Profiles/Person/102060',
 jonas:'https://www.quodlab.com/jonas-becker',catalog:'https://publikationen.sulb.uni-saarland.de/handle/20.500.11880/26928?locale=en',dnb:'https://d-nb.info/1152095226',
 kim:'https://www.chemistry.msu.edu/faculty-research/faculty-members/kim-seokhyoung.aspx',chem:'https://chemistry.sciences.ncsu.edu/event/inorganic-chemistry-seminar-series-seokhyoung-kim-michigan-state-universityn/',cahoon:'https://cahoon.chem.unc.edu/images/CV-James-Cahoon.pdf',acs:'https://pubs.acs.org/doi/10.1021/acsmaterialsau.6c00052',acsCopy:'https://www.researchgate.net/publication/401800349_ACS_Materials_Au_Announcing_the_2025_Rising_Stars_in_Materials_Science',
 uw:'https://www.physics.wisc.edu/newsletter/Phys_Nwsltr_Vol_14.pdf',zhang:'https://pa.msu.edu/sites/_pa/assets/File/newsletter/nl10.pdf',ke:'https://directory.natsci.msu.edu/directory/Profiles/Person/102145',kePenn:'https://pure.psu.edu/en/publications/tuning-magnetic-frustration-of-nanomagnets-in-triangular-lattice-/',keCV:'https://phy.princeton.edu/sites/g/files/toruqf6851/files/documents/Peter_Schiffer%20CV%2008-2023%5B2%5D.pdf',
 lee:'https://engineering.msu.edu/directory/faculty/leea',leePub:'https://pubs.acs.org/doi/10.1021/ma00158a022',leeCopy:'https://electronicsandbooks.com/edt/manual/Magazine/M/Macromolecules/1986%20%28Vol%2019%29/No04%28945-1290%29/1063.pdf',wool:'https://www1.udel.edu/udaily/2015/apr/in-memoriam-wool-040615.html'
};
const proof=(name,url)=>web(name,url)+'。';
function setLine(id,prefix,value){
 editLine(fn(local(id)),l=>l.startsWith(prefix),()=>prefix+value);
}
function setRelation(id,target,from,to,oldInverse,newInverse,sources){
 const person=local(id), incoming='[['+person+'|',outgoing='[['+target+'|';
 const replace=(l,start,next,wiki)=>l.slice(0,l.indexOf(start))+next+l.slice(l.indexOf(wiki),l.indexOf(']]',l.indexOf(wiki))+2)+'。'+sources;
 editLine(fn(person),l=>l.startsWith('- '+from+'：')&&l.includes(outgoing),l=>replace(l,'- '+from+'：','- '+to+'：',outgoing));
 editLine(fn(target),l=>l.startsWith('- '+oldInverse+'：')&&l.includes(incoming),l=>replace(l,'- '+oldInverse+'：','- '+newInverse+'：',incoming));
 editLine(idx,l=>l.startsWith('- '+incoming)&&l.includes(' → '+from+'：')&&l.includes(outgoing),l=>replace(l,' → '+from+'：',' → '+to+'：',outgoing));
}

const tom='e0eed2de', benn='师承人物 - Karl Heinz Bennemann';
const tomEvidence='1983 年柏林自由大学物理博士论文署名页列 Bennemann 为第一评阅人，致谢说明他的支持与持续讨论对论文至关重要。博士阶段研究师长，可信度高。';
const tomProof=tomEvidence+proof('本人博士论文署名页与致谢',p.tom)+proof('此前候选线索', 'https://en.wikipedia.org/wiki/David_Tom%C3%A1nek');
setRelation(tom,benn,'博士导师候选','博士阶段研究师长','博士候选','博士阶段研究者',tomProof);
setLine(tom,'- 核查边界：','本人履历列 1983 年 FU Berlin 博士、1985 年 Bell Labs 博后及 1985–1987 年 Berkeley 博后，另列同期 FU Berlin 助理教授休假。Bennemann 的第一评阅人身份和论文研究指导有原证，正式导师称谓待核。第二评阅人 A. M. Bradshaw 在致谢中因持续关注受谢。Schlüter、Louie 分别保留为两段博后候选。 '+proof('本人履历',p.tomCV)+proof('博士论文',p.tom));
editLine(fn(local(tom)),l=>l.startsWith('- 待查博士论文：'),()=>'- 已核博士论文：1983 年《Elektronische Theorie für Rumpfniveauverschiebungen an Festkörperoberflächen und in Adsorbaten》。'+proof('本人论文原件',p.tom));
changeRow(tom,'Karl Heinz Bennemann（博士阶段研究师长、第一评阅人）',null,tomProof+' '+proof('MSU 现任原档',p.tomMSU));
const tomAudit=audit(tom,{phd:['group_or_candidate',tomEvidence,[p.tom]],affiliation:['confirmed','MSU 自然科学学院目录列物理与天文学系荣休教授。',[p.tomMSU]],research:['confirmed','原档列低维体系、表面及纳米结构的计算研究，涵盖结构、电子、输运和光学性质。',[p.tomMSU]]},'续查 FU Berlin 正式导师字段和 Bell Labs、Berkeley 两段博后的指导任命原件。');
relation(tom,'phd',benn,'stage_mentor',tomEvidence,[p.tom],tomAudit,false);

const be='9654aeaf', becher='师承人物 - Christoph Becher';
const beProof=proof('本人课题组履历',p.jonas)+proof('萨尔兰学位目录',p.catalog);
const beText='本人履历明列 2017 年在萨尔兰大学 with Christoph Becher 获物理博士。萨尔兰官方目录缓存全文的 Advisor 栏同样列 Christoph Becher，目录直连超时且论文下载 502，暂保留博士阶段研究师长，等待直接复核。';
note(be,'- 博士阶段研究师长：',beText+' '+beProof);
mentorLine(becher,be,'- 博士阶段研究者：',beText+' '+beProof);
indexLine(be,becher,'博士阶段研究师长',beText+' '+beProof);
setLine(be,'- 核查边界：',beText+' '+beProof+' 本人履历分列 2017 Oxford Postdoctoral Research Assistant、2020 Imperial Research Associate 和 2021 MSU 物理系。Oxford Walmsley 组属保留，两个岗位的个人指导原证待核。');
changeRow(be,'Christoph Becher（博士阶段研究师长，学位目录缓存 Advisor 待直接复核）',null,beText+' '+beProof);
const beAudit=audit(be,{phd:['group_or_candidate',beText,[p.jonas,p.catalog]],affiliation:['confirmed','本人课题组履历列 MSU 助理教授、实验物理 Jerry Cowen Chair，兼 Fraunhofer USA Center Midwest 研究关联。',[p.jonas]],research:['confirmed','本人课题组履历列固态量子光学、金刚石和掺杂晶体缺陷、量子存储与互连。',[p.jonas]]},'按退避继续追学位目录的可读原件，并分别追 Oxford 和 Imperial 的任用指导字段。');
relation(be,'phd',becher,'stage_mentor','本人 CV 明列 2017 年 Saarland 物理博士 with Christoph Becher。官方目录缓存字段供追查，直连仍待核。',[p.jonas,p.catalog],beAudit,false);

const kim='191b6c7f', ca=local('207794ca'), mir=local('d6866c22');
const kimPh='ACS Materials Au 编辑组人物简介的可读原文副本明确写 2019 年 UNC 化学博士由 James Cahoon 指导。Cahoon 本人 CV 列 Kim 为 2019 年 5 月毕业博士生。博士导师，可信度高。';
const kimPd='NC State 化学系讲座履历及 ACS 原文均列 2019–2020 Northwestern IIN 博后与 Chad Mirkin 开展研究，记为博士后阶段研究师长。正式岗位导师职衔待核。';
const caProof=kimPh+' '+proof('ACS 文章',p.acs)+proof('ACS 原文可读副本',p.acsCopy)+proof('Cahoon 本人履历',p.cahoon);
const mirProof=kimPd+' '+proof('NC State 院系讲座档',p.chem)+proof('ACS 原文可读副本',p.acsCopy);
setRelation(kim,ca,'博士阶段课题组负责人','博士导师','博士阶段课题组成员','博士生',caProof);
note(kim,'- 博士后阶段研究师长：',mirProof);
mentorLine(mir,kim,'- 博士后阶段研究者：',mirProof);
indexLine(kim,mir,'博士后阶段研究师长',mirProof);
setLine(kim,'- 核查边界：',caProof+' '+mirProof);
changeRow(kim,'James F. Cahoon（博士导师）','Chad Mirkin（Northwestern IIN 博士后阶段研究师长）',caProof+' '+mirProof);
const kimAudit=audit(kim,{phd:['confirmed_advisor',kimPh,[p.acs,p.acsCopy,p.cahoon,p.chem]],postdoc:['group_or_candidate',kimPd,[p.chem,p.acsCopy,p.kim]],affiliation:['confirmed','MSU 化学系原档列 2021 年起任助理教授，保留已核的工程院系关联。',[p.kim]],research:['confirmed','MSU 化学系原档列半导体纳米材料、非常规掺杂、光子超材料及固态光与物质相互作用。',[p.kim]]},'继续定位 UNC 论文签署页和 Northwestern 博后正式导师原证。');
relation(kim,'phd',ca,'advisor',kimPh,[p.acs,p.acsCopy,p.cahoon],kimAudit,false);
relation(kim,'postdoc',mir,'stage_mentor',kimPd,[p.chem,p.acsCopy,p.kim],kimAudit,false);

const z='2c2eff5d';
const zText='Wisconsin 物理系 2007 年通讯的 August 2006 博士名单列本人论文题名、括注 Lagally 和去向 Penn State 博后。MSU 任职报道分列 2006 Wisconsin 博士、Penn State 博后以及 2009 年加入 MSU 凝聚态物理组。';
const zProof=zText+' '+proof('Wisconsin 物理系通讯',p.uw)+proof('MSU 物理系任职报道',p.zhang);
note(z,'- 核查边界：',zProof);
changeRow(z,null,null,zProof);
audit(z,{phd:['group_or_candidate',zText+' 保留 Max G. Lagally 博士课题组负责人。',[p.uw,p.zhang]],affiliation:['confirmed','MSU 物理与天文学系任职报道确认加入凝聚态物理组。',[p.zhang]],research:['confirmed','院系报道列扫描探针、表面界面工程与电子及光伏纳米材料。',[p.zhang]]},'继续追 Wisconsin 论文签署页，以及 Penn State 任用档对 Weiss 与 Allara 的正式职衔。');

const ke='bf0735f9', sch=local('205fc942');
const keText='Wisconsin 物理系 2006 年毕业原档明确列 Penn State 博后。2008 年 Penn State 论文档案及 Schiffer 本人履历列 Ke 与 Schiffer 合著，结合研究时序将 Peter Schiffer 留作该段低可信导师候选。';
const keProof=keText+' '+proof('Wisconsin 物理系原档',p.uw)+proof('Penn State 论文记录',p.kePenn)+proof('Schiffer 本人 CV',p.keCV);
addEdge(ke,'博士后导师候选',sch,'Peter Schiffer',keProof,null,true);
inverse(ke,sch,'博士后候选研究关系',keProof);
inverse(ke,local('2e063ec3'),'博士后候选研究关系',keProof);
setLine(ke,'- 核查边界：','Wisconsin 物理系原档在 2006 届博士名单列本人论文，Rzchowski 为括注，暂列候选。Penn State 阶段与随后 ORNL Shull fellowship 分开记录。'+keProof+' Nagler 为 ORNL 博后阶段研究师长，两份任职档的结束年份分别为 2011 和 2012。');
changeRow(ke,null,'Peter Schiffer（Penn State 博后导师候选）、Stephen E. Nagler（ORNL 博后阶段研究师长）',keProof);
const keAudit=audit(ke,{postdoc:['group_or_candidate',keText+' ORNL 后续阶段保留 Nagler 的既有指导关系。',[p.uw,p.kePenn,p.keCV]],phd:['group_or_candidate','2006 Wisconsin 物理系毕业名单确有本人论文和 Rzchowski 括注，正式导师待学位档核对。',[p.uw]]},'核对 Wisconsin 论文的导师字段，分别追 Penn State 指导任用与 ORNL fellowship 年份差异。');
relation(ke,'postdoc',sch,'candidate',keText,[p.uw,p.kePenn,p.keCV],keAudit);

const lee='f19b25f7', wool='师承人物 - Richard P. Wool';
const leeText='1986 年论文原件列 André Lee 与 Richard P. Wool 同署 Illinois Urbana Polymer Group，主题为缠结聚合物熔体的 FT-IR 松弛动力学。Delaware 校方纪念档核 Wool 当时在 Illinois。时序与 MSU 原档的 1987 年 Illinois 博士吻合，Wool 仅列低可信博士导师候选。';
const leeProof=leeText+' '+proof('期刊论文',p.leePub)+proof('原文存档副本',p.leeCopy)+proof('Delaware 校方档',p.wool)+proof('MSU 院系原档',p.lee);
newMentor(wool,'Richard P. Wool','伊利诺伊大学 Urbana 校区历史任职，后为 University of Delaware 化学与生物分子工程教授。'+proof('Delaware 校方档',p.wool),lee,'博士候选',leeProof);
addEdge(lee,'博士导师候选',wool,'Richard P. Wool',leeProof,null,true);
note(lee,'- 核查边界：',leeProof);
changeRow(lee,'Richard P. Wool（博士导师候选）；Illinois 论文目录原件待核',null,leeProof);
const leeAudit=audit(lee,{phd:['group_or_candidate',leeText,[p.lee,p.leeCopy,p.wool]],affiliation:['confirmed','Michigan State 工学院目录核 Chemical Engineering and Materials Science 及 1987 Illinois 物理／材料科学博士。',[p.lee]],research:['confirmed','院系原档核聚合物、纳米材料及复合材料研究。',[p.lee]]},'定位 IDEALS 论文持久标识和签署页，另追 NIST Polymers Division 博后导师。');
relation(lee,'phd',wool,'candidate',leeText,[p.lee,p.leeCopy,p.wool],leeAudit);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_MSU博士与博后再核';
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

