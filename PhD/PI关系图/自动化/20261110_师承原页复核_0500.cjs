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
 a.audit_id='20261110_'+id+'_primary_dissertation_and_roles';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_thesis_roles_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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
const ram='577e5266', bow=local('c51c1961'), hu=local('e42a8426');
const rTh='https://optoelectronics.ece.ucsb.edu/sites/default/files/2017-02/1996%20-%20Ram%20-%20Microcavity%20Lasers%20-%20Coherent%20Matter%20and%20Light.PDF';
const rCv='https://sclaser.mit.edu/documents/RajeevRamCV.pdf';
const rPhd='本人 UCSB 博士论文《Microcavity Lasers: Coherent Matter and Light》题页列 John E. Bowers 为委员会 Chairperson，致谢称 my advisor；同页另称 Evelyn Hu 为 mentor。论文题页 August 1997、vita January 1997，Bowers 旧 CV 记 December 1996，保留不同日期。';
const rPost='本人 CV 分列 UCSB EE 博士 1997 与 1997 年 1 月起 MIT EECS 助理教授；已阅履历未列单独博士后。';
const ra=audit(ram,{phd:['confirmed_advisor',rPhd,[rTh]],postdoc:['no_postdoc_documented',rPost,[rCv,rTh]]},'保留论文题页和本人 vita 日期差异，查 UCSB 学位登记口径；未来留意单列博士后任命。');
const rTxt=web('UCSB 博士论文题页',rTh+'#page=3')+'列 Bowers 为委员会主席，'+web('致谢',rTh+'#page=7')+'称其为本人导师。';
const rLine=l=>l.replace('；原始学位论文仍待重读。','。')+' '+rTxt;
editLine(fn(local(ram)),l=>l.startsWith('- 博士导师：')&&l.includes('[['+bow+'|'),rLine);
editLine(fn(bow),l=>l.startsWith('- 博士生：')&&l.includes('[['+local(ram)+'|'),rLine);
editLine(idx,l=>l.startsWith('- [['+local(ram)+'|')&&l.includes(' → 博士导师：'),rLine);
editLine(fn(local(ram)),l=>l.startsWith('- 核查边界：'),()=>'- 学位日期：论文封面写 1997 年 8 月，vita 写 1997 年 1 月，Bowers 旧 CV 记 1996 年 12 月。'+web('本人 UCSB 论文',rTh)+'\n- 博士后经历：'+rPost+' '+web('本人 MIT CV',rCv));
const huTxt=web('UCSB 博士论文致谢',rTh+'#page=7')+'明确将 Evelyn Hu 称作博士阶段的 mentor。论文题页委员会及正式导师另列。';
addRelation(ram,'博士阶段研究师长',hu,'Evelyn Hu',huTxt,'博士阶段受指导者');
changeRow(ram,'John E. Bowers（论文导师）；Evelyn Hu（博士阶段师长）','本人 CV 列同年任 MIT 助理教授，未单列博士后',web('UCSB 论文',rTh)+' · '+web('本人 MIT CV',rCv));
relation(ram,'phd',bow,'advisor',rPhd,[rTh],ra,false);
relation(ram,'phd',hu,'stage_mentor','论文致谢称 Evelyn Hu 为博士阶段 mentor；题页及致谢明确 John E. Bowers 为正式导师。',[rTh+'#page=7'],ra);

const lee='5de11ebc', qi=local('c441aeb5');
const lTh='https://arxiv.org/pdf/1609.01857v1';
const lNus='https://www.physics.nus.edu.sg/faculty/lee-ching-hua/';
const lText='作者提交的《Exact Mappings in Condensed Matter Physics》题页明示 Stanford 物理博士、2015 年 8 月；致谢明确称 Xiao-Liang Qi 为 my advisor。arXiv 公开日期 2016 年 9 月与学位日期分列。';
const la=audit(lee,{phd:['confirmed_advisor',lText,[lTh]],research:['confirmed','NUS 物理系现任条目与 Stanford 学位论文对应凝聚态理论、拓扑相及非厄米量子体系。',[lNus,lTh]]},'博士指导由本人论文确认；继续核 2015 毕业后任职及有无独立博后。');
const lProof=web('Stanford 博士论文致谢',lTh+'#page=3')+'明确称肖量祺为本人导师。';
note(lee,'- 博士导师：',lProof);
mentorLine(qi,lee,'- 博士生：',lProof);
indexLine(lee,qi,'博士导师',lProof);
editLine(fn(local(lee)),l=>l.startsWith('- 核查边界：'),()=>'- 学位论文：《Exact Mappings in Condensed Matter Physics》，题页列 2015 年 8 月，arXiv 公开于 2016 年 9 月。Ronny Thomale 在致谢中被感谢引介研究方向、指导写作并邀请 Würzburg 访问，学位导师由论文另列。博士后经历待核。 '+web('本人论文',lTh));
row(lee,web('本人博士论文原文',lTh));
relation(lee,'phd',qi,'advisor',lText,[lTh],la,false);

const wen='6130f1b4', wit='师承人物 - Edward Witten';
const wO='https://old.ocpaweb.org/oyraaward/xiao-gang.wen.html';
const wMit='https://physics.mit.edu/faculty/xiao-gang-wen/';
const wIas='https://www.ias.edu/scholars/xiao-gang-wen';
const wPhd='1994 OYRA 组织方具名履历明确 1987 Princeton 博士的 Ph.D. thesis director 为 Ed Witten；MIT 物理系确认其在 Princeton 受 Witten 指导研究超弦。';
const wPost='MIT 物理系列 1987–1989 UCSB ITP 与 Robert Schrieffer、Frank Wilczek、Anthony Zee 共事。IAS 本人档另列 1990-01 至 1991-08 Natural Sciences Member，获奖方履历写 1989–1991；保留起始年差异，任期性质及正式指导字段待核。';
const wa=audit(wen,{phd:['confirmed_advisor',wPhd,[wO,wMit]],postdoc:['unresolved',wPost,[wMit,wIas,wO]]},'追查 UCSB ITP 的正式聘任与有无具名指导，IAS 会员身份和起始年独立保留。');
const wLink=web('OYRA 获奖原档',wO)+'直接写 Witten 是博士论文指导者。';
note(wen,'- 博士导师：',wLink);
mentorLine(wit,wen,'- 博士生：',wLink);
indexLine(wen,wit,'博士导师',wLink);
editLine(fn(local(wen)),l=>l.startsWith('- 核查边界：'),()=>'- 毕业后阶段：'+wPost+' '+web('MIT 物理系',wMit)+' · '+web('IAS 成员档',wIas));
row(wen,web('IAS 本人档',wIas)+' · '+web('OYRA 获奖原档',wO),'UCSB ITP 1987–1989 研究阶段，个人指导待核；IAS Member 另列');
relation(wen,'phd',wit,'advisor',wPhd,[wO,wMit],wa,false);

const will='8ab4f6c1', dc='师承人物 - David Chandler', pr='师承人物 - Peter J. Rossky';
const wCv='https://bpb-us-e1.wpmucdn.com/sites.mit.edu/dist/d/1114/files/2021/11/Adam_Willard_CV.pdf';
const wM='https://ilpstex.mit.edu/en/content/faculty-profiles/adam-p-willard';
const willPhd='MIT 教师简介明确其在 David Chandler 指导下取得 Berkeley 化学博士；MIT 托管本人履历分列 2004–2009 Berkeley Graduate Student（Chandler）和后续两个博后。';
const willPost='MIT 托管 CV 列 2009–2010 Lawrence Berkeley National Laboratory 博后（David Chandler）及 2010–2013 UT Austin 博后（Peter Rossky）。本人 2012 旧 CV 第一段写 UC Berkeley，自 2008 起；保留机构与起始年差异。两版均在职位括号具名，未直接写 Advisor。';
const wi=audit(will,{phd:['confirmed_advisor',willPhd,[wM,wCv]],postdoc:['group_or_candidate',willPost,[wCv]]},'查 Berkeley 学位签署及 LBNL／UC Berkeley 第一段聘任口径，继续查两位博士后正式指导职衔。');
const willNotes=[
 [dc,'MIT 托管履历列 2009–2010 Lawrence Berkeley National Laboratory；2012 本人旧履历写 UC Berkeley、自 2008 起，保留差异。'],
 [pr,'MIT 托管履历将 UT Austin 的博后职位与 Peter Rossky 列在 2010–2013。']
];
for(const [mentor,part] of willNotes){
 const extra=' '+web('MIT 托管本人 CV',wCv)+'。'+part;
 replaceNoteLabel(will,'博士后阶段研究关联者','博士后阶段研究师长',mentor,extra);
 replaceInverseLabel(mentor,will,'博士后阶段研究关联者','博士后阶段研究者',extra);
 replaceIndexLabel(will,mentor,'博士后阶段研究关联者','博士后阶段研究师长',extra);
}
note(will,'- 博士导师：',web('MIT 托管本人 CV',wCv)+'将 Berkeley 研究生与后续 LBNL 博后分列。');
mentorLine(dc,will,'- 博士生：',web('本人 MIT CV',wCv)+'分列研究生与后续博后。');
indexLine(will,dc,'博士导师',web('本人 MIT CV',wCv)+'分列研究生与后续博后。');
row(will,web('本人 MIT CV',wCv),'David Chandler（LBNL 2009–2010，旧 CV 写 UC Berkeley 2008 起）、Peter J. Rossky（UT Austin 2010–2013），两段为阶段研究师长');
relation(will,'phd',dc,'advisor',willPhd,[wM,wCv],wi,false);

const jo='cbedf46d', cohen=local('67eb1f9c');
const jMit='https://physics.mit.edu/news/professor-john-joannopoulos-photonics-pioneer-and-institute-for-soldier-nanotechnologies-director-dies-at-78/';
const baz='https://web.mit.edu/bazant/www/info/';
const jPhd='Bazant 本人 MIT 页在 Lineage of PhD Advisors 连续列出 Marvin Cohen 与 Berkeley 1974 的 Joannopoulos；MIT 纪念档确认 Berkeley 1974 物理博士。保留既有伯克利口述史来源，学位原件待核。';
const jPost='MIT 纪念档明确 1974 年取得 Berkeley 物理博士并同年加入 MIT 教职，已读履历未单列博士后。';
const ja=audit(jo,{phd:['confirmed_advisor',jPhd,[baz,jMit]],postdoc:['no_postdoc_documented',jPost,[jMit]]},'继续查 Berkeley 学位原件与口述史，保留 MIT 已故历史任职。');
const jLink=web('MIT 纪念档',jMit)+'确认 Berkeley 1974 博士及同年开始 MIT 教职。';
note(jo,'- 博士导师：',jLink);
mentorLine(cohen,jo,'- 博士生：',jLink);
indexLine(jo,cohen,'博士导师',jLink);
editLine(fn(local(jo)),l=>l.startsWith('- 核查边界：'),l=>l.replace('博士后阶段及导师待核。','')+' '+jLink+' 已读履历未单列博士后。');
row(jo,web('MIT 纪念档',jMit),'1974 年取得博士并同年加入 MIT 教职；已阅履历未单列博士后');
relation(jo,'phd',cohen,'advisor',jPhd,[baz,jMit],ja,false);


const jlu='ab67d742', cm=local('d0d635fd');
const jN='https://chemistry.nus.edu.sg/people/lu-jiong/';
const jZ='https://physics.zju.edu.cn/2016/0511/c70851a2735380/page.htm';
const jU='https://en.ustc.edu.cn/info/1060/2895.htm';
const jluPost='NUS 化学系将 NUS 与 UC Berkeley 两段共同列入 2011–2014 博后；浙江大学及 USTC 讲座先列 NUS Graphene Research Centre research fellow，2013 年起另列 UC Berkeley Crommie 组。Crommie 保持组属，NUS 个人指导未明。';
audit(jlu,{postdoc:['group_or_candidate',jluPost,[jN,jZ,jU]],phd:['confirmed_advisor','浙江大学讲座明确 2011-10 NUS 化学博士在 Loh Kian Ping 指导下开展；NUS 化学系核对学位。论文正式 advisor 字段仍待核。',[jN,jZ]]},'查 NUS 论文目录及 2011–2013 GRC 博后个人指导，复核 Berkeley 个人指导职衔。');
const ju=web('NUS 化学系履历',jN)+'列 NUS 与 Berkeley 两段博后；'+web('浙江大学讲座',jZ)+'把 2013 起的 Crommie 组属明确归到 Berkeley。';
note(jlu,'- 博士后课题组负责人：',ju);
mentorLine(cm,jlu,'- 博士后课题组成员：',ju);
indexLine(jlu,cm,'博士后课题组负责人',ju);
row(jlu,web('USTC 履历',jU)+' · '+web('浙江大学讲座',jZ),'NUS Graphene Research Centre research fellow（导师待核）；2013 起 Berkeley Crommie 组博士后');

const das='e784c715';
const dCv='https://umdphysics.umd.edu/images/CV/2024/SDS_CV_2025.pdf';
const dJqi='https://jqi.umd.edu/news/jqi-fellow-sankar-das-sarma-elected-national-academy-sciences';
audit(das,{postdoc:['unresolved','本人 CV 列 Maryland 1980–1982 博士后研究助理、1982 年起 Maryland 物理系助理教授。JQI 的 1980 起任职属概括，个人博后指导者未具名。',[dCv,dJqi]]},'继续查 Maryland 1980–1982 聘任与研究指导原件；博士段 Brown 1979／Quinn 的既有可靠记录保留。');
note(das,'- 核查边界：',web('本人 CV',dCv)+'将 1982 年起助理教授与 1980–1982 博后分列。');
row(das,web('JQI 原始履历',dJqi),'Maryland 1980–1982 博士后研究助理；个人导师待核');

const sinha='e5a1de23';
const sA='https://history.aip.org/history/catalog/icos/47210.html';
const sP='https://print.aps.org/pdf/2002-07.pdf';
const sPost='AIP 口述史目录明确 Iowa State 博士后；APS 具名履历列 1965–1975 Iowa State 任职总区间，未拆出博士后结束日期。AIP 人名索引的 Mackintosh 未在目录说明中被赋予指导角色。';
audit(sinha,{phd:['group_or_candidate','APS 具名履历列 Cambridge 1964 物理博士；AIP 口述史目录明确研究生中子散射研究受 Gordon Squires 指导，论文正式字段待查。',[sA,sP]],postdoc:['unresolved',sPost,[sA,sP]]},'查 Cambridge 1964 学位档、AIP 访谈全文与 Iowa State／Ames 任命资料。');
note(sinha,'- 博士后经历：',web('APS 具名履历',sP)+'列 1965–1975 Iowa State 总任期；博后起止及个人指导待核。');
row(sinha,web('APS 具名履历',sP),'Iowa State 博后；1965–1975 为校方岗位总区间，博后起止及导师待核');

const pol='e7994fd9', nom='师承人物 - Yasunori Nomura';
const pY='https://physics.yale.edu/profile/david-poland';
const pI='https://www.ias.edu/scholars/david-poland';
const pO='https://www.osti.gov/servlets/purl/929310';
const pTree='https://academictree-staging.thetransmitter.org/physics/inst.php?locid=312';
const pPhd='现有二手谱系线索为 Yasunori Nomura；DOE 存档 2006 论文证实两人在 Berkeley/LBNL 同期合作，仅可追查，不足确证导师。';
const pPost='Yale 与 IAS 履历区分 2008–2011 Harvard Postdoctoral Fellow、2011–2012 IAS Member、2015–2016 IAS Junior Visiting Professor。Harvard 博后指导者未具名。';
const pa=audit(pol,{phd:['group_or_candidate',pPhd,[pTree,pO,pY]],postdoc:['unresolved',pPost,[pY,pI]]},'等 Berkeley 学位库退避到期后查 2008 博士论文签署；另查 Harvard 博后任命。');
const pProof=web('DOE 存档的同期论文',pO)+'支持 Berkeley 博士期合作；论文导师仍列候选。';
note(pol,'- 博士导师候选：',pProof);
mentorLine(nom,pol,'- 博士生候选：',pProof);
indexLine(pol,nom,'博士导师候选',pProof);
note(pol,'- 核查边界：',pPost+' '+web('IAS 任职档',pI));
row(pol,web('IAS 任职档',pI)+' · '+web('DOE 同期论文',pO),'Harvard 2008–2011 博后，指导者待核；IAS 两次任职单列');
relation(pol,'phd',nom,'candidate',pPhd,[pTree,pO],pa);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0500';
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

