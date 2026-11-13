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
 a.audit_id='20261110_'+id+'_dissertation_and_rosters_1802';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_dissertation_and_rosters_1802_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const gall='1afe3a16',sha='人员 - MIT - Yang Shao-Horn - 3ef34015';
const gallThesis='https://citeseerx.ist.psu.edu/document?doi=5ca489c9da22621ec2b54a771dd6724ccca060ce&repid=rep1&type=pdf';
const gallEcs='https://www.electrochem.org/press/2022-2023-ecs-toyota-fellowship';
const gallDoc='直接读取 Penn State CiteSeerX 所存的 MIT 2013 年博士论文原件副本。签署页列 Yang Shao-Horn 为 Thesis Supervisor，委员会页列其为主席，致谢也直接称其 advisor。';
const gallProof=gallDoc+' '+web('博士论文原件副本',gallThesis);
note(gall,'- 博士导师：',gallProof);
mentorLine(sha,gall,'- 博士生：',gallProof);
indexLine(gall,sha,'博士导师',gallProof);
editLine(fn(local(gall)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：博士导师和两位共同博士后导师均有具名原档支持。博士论文已取得可读副本，MIT 学位馆藏页待主机退避结束后核读，后续另补博士后起止月份。');
changeRow(gall,null,null,web('博士论文原件副本',gallThesis));
let aid=audit(gall,{phd:['confirmed_advisor',gallDoc,[gallThesis,gallEcs]]},'主机退避后核 MIT DSpace 稳定条目，补 Caltech 受聘起止月份。');
relation(gall,'phd',sha,'advisor',gallDoc,[gallThesis,gallEcs],aid,false);

const moore='b653a727';
const mcv='https://physics.berkeley.edu/sites/default/files/cv_moore_23.pdf';
const lbl='https://newscenter.lbl.gov/2022/05/04/2-berkeley-lab-physicists-elected-into-the-national-academy-of-sciences/';
const mooreDoc='Berkeley 托管本人 2023 CV 列 MIT 物理博士于 2001 年 2 月授位，论文为 Phase transitions and symmetry breaking in quantum Hall edge states。CV 另列 2000 年秋 UCSB Graduate Fellow，2001 年 Bell Labs Theoretical Physics Section 的 Postdoctoral Member of Technical Staff。LBNL 原档确认 Bell Labs 博后，具名指导未见。';
note(moore,'- 博士导师：','Berkeley 本人 2023 CV 补核授位日期和论文题名。该 CV 未另列导师，保留先前本人履历所列 Xiao-Gang Wen。 '+web('Berkeley 本人 CV',mcv));
editLine(fn(local(moore)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+mooreDoc+' '+web('Berkeley 本人 CV',mcv)+' · '+web('LBNL 原档',lbl));
changeRow(moore,null,'Bell Labs 理论物理组，2001 年博后，具名指导待核',web('Berkeley 本人 CV',mcv)+' · '+web('LBNL 原档',lbl));
audit(moore,{postdoc:['unresolved',mooreDoc,[mcv,lbl]]},'等待 MIT DSpace 退避到期后按精确题名查学位论文。查 2001 年 Bell Labs 理论物理组聘任或本人同期研究叙述。');

const simCV='https://www.apam.columbia.edu/files/seas/content/apam_image/cv_michele_simoncelli_2026.pdf';
const nccr='https://www.nccr-marvel.ch/news/awards/2022-11-simoncelli';
const col='https://www.apam.columbia.edu/about/news/columbia-engineering-welcomes-new-faculty';
const marzari='师承人物 - Nicola Marzari';
const simD='本人 2026 CV 记录 2021-05-26 EPFL 材料博士完成，并明确由 Nicola Marzari 指导。本人在 EPFL 博士奖获奖访谈中也明确称 Marzari 为 PhD advisor。';
const simP='本人 2026 CV 分列 2021 年 9 月至 2024 年 12 月 Cambridge Cavendish Research Fellow、2021–2025 Patricia Crone 奖学金与 2021–2023 SNSF Postdoc Mobility Fellowship。研究任用与奖项期各按原档登记，具名指导未见。EPFL THEOS 博后条目仍待可读原页。';
const simProof=web('本人 2026 CV',simCV)+' · '+web('EPFL 博士奖本人访谈',nccr);
for(const id of ['d65082e2','ebe2ac32']){
 note(id,'- 博士导师：',simD+' '+simProof);
 note(id,'- 博士后阶段补证（2026-11-09）：',simP+' '+web('本人 2026 CV',simCV));
 indexLine(id,marzari,'博士导师',simProof);
 changeRow(id,'Nicola Marzari（本人 2026 CV 及本人访谈明确）','Cambridge Cavendish 2021 年 9 月至 2024 年 12 月，独立 fellowship 具名指导待核；EPFL 短期博后待原页',simProof);
 aid=audit(id,{phd:['confirmed_advisor',simD,[simCV,nccr]],postdoc:['unresolved',simP,[simCV,col]]},'遵守 EPFL Infoscience 主机及 THEOS 页面退避。继续查 Cambridge Cavendish 博后主持与 EPFL THEOS 2021 年 6–8 月具体任用。');
 relation(id,'phd',marzari,'advisor',simD,[simCV,nccr],aid,false);
}

const poll='e224bcfd',eis='师承人物 - James P. Eisenstein';
const iqim='https://iqim.caltech.edu/people/alumni/',pcv='https://directory.natsci.msu.edu/media/Directory/Profiles/Pollanen_C20260221163404.pdf',pg='https://www.its.caltech.edu/~jpelab/johannes.html';
const pp='Caltech IQIM 校友表 Research Group 栏列 Eisenstein，Departure date 记 2016 年 1 月。本人 2026 CV 写 2012–2015 Caltech IQIM 博后，本人同期组页自称 working with Jim Eisenstein。保留两种任期口径和博士后阶段研究师长。';
const pProof=pp+' '+web('IQIM 校友表',iqim)+' · '+web('MSU 本人 CV',pcv);
note(poll,'- 博士后阶段研究师长：',pProof);
mentorLine(eis,poll,'- 博士后阶段研究者：',pProof);
indexLine(poll,eis,'博士后阶段研究师长',pProof);
changeRow(poll,null,'James P. Eisenstein（Caltech 博后研究师长，CV 2012–2015，IQIM 记 2016 年 1 月离开）',web('IQIM 校友表',iqim));
aid=audit(poll,{postdoc:['group_or_candidate',pp,[iqim,pcv,pg]]},'补 Caltech 博后原始任用档与具名指导字段，保留结束日期记录口径差异。');
relation(poll,'postdoc',eis,'stage_mentor',pp,[iqim,pcv,pg],aid);

const jay='1fc67093',lap='师承人物 - Leon Lapidus';
const msu='https://engineering.wwwdev.egr.msu.edu/directory/faculty/jayarama';
const aiche='https://aiche.onlinelibrary.wiley.com/toc/15475905/1976/22/2';
const jc='https://ptacts.uspto.gov/ptacts/public-informations/petitions/1459794/download-documents?artifactId=qocw_zhnl71ozXilB1mg-hygUIj64-BcMuqvnlE532qtxDvInUW4Bv8';
const jp='MSU 工学院原档核 Princeton 化学工程 1975 博士及聚合物流变研究。AIChE 1976 年原刊目录核其与 Leon Lapidus 的过程建模合著，支持候选追查。学位论文题页及正式导师待核。';
const jpost='本人旧 CV 列 1975–1976 University of Washington Visiting Assistant Professor。该任用性质与独立博后须分列，已核履历未见独立博后。';
note(jay,'- 博士导师候选：',jp+' '+web('AIChE 原刊目录',aiche));
indexLine(jay,lap,'博士导师候选',web('AIChE 原刊目录',aiche));
note(jay,'- 核查边界：',web('MSU 工学院原档',msu));
changeRow(jay,null,'1975–1976 UW Visiting Assistant Professor；独立博后待核',web('MSU 工学院原档',msu)+' · '+web('AIChE 原刊目录',aiche));
aid=audit(jay,{phd:['group_or_candidate',jp,[msu,aiche]],postdoc:['unresolved',jpost,[jc,msu]]},'查 Princeton 1975 化工博士馆藏及学位签署页，核 Lapidus 关系；继续查 UW 任用原档及博士后履历。');
relation(jay,'phd',lap,'candidate',jp,[msu,aiche],aid);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_学位与课题组档续查';
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

