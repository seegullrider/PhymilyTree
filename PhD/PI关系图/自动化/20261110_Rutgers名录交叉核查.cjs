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
 a.audit_id='20261110_'+id+'_rutgers_cmt_1726';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_rutgers_cmt_1726_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const cmt='https://cmt.rutgers.edu/alumni/', cc='https://www.physics.rutgers.edu/~coleman/mycv24.pdf';
const k='人员 - Rutgers - Gabriel Kotliar - 1c24065f', c='人员 - Rutgers - Piers Coleman - 053b0c4a';
const wl=(target,label)=>'[['+target+'|'+label+']]';
const refs=(...pairs)=>pairs.map(([label,url])=>' '+web(label,url)).join('');
const roster=refs(['Rutgers CMT 历届博士后原档',cmt]);
function candidate(id,target,name,evidence,sources,links,anchor,school,next){
 const a=audit(id,{postdoc:['group_or_candidate',evidence,sources]},next);
 const r=records.get(id), person=wl(r.filename,r.name), mentor=wl(target,name);
 const added='- 博士后导师候选：'+mentor+'。'+evidence+links;
 note(id,'- 核查边界：','\n'+added);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(anchor),l=>l+'\n- '+person+' → 博士后导师候选：'+mentor+'。'+evidence+links);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- 博士后候选研究者：'+person+'。'+evidence+links);
 changeRow(id,null,school,web('Rutgers CMT 原档',cmt)+links);
 relation(id,'postdoc',target,'candidate',evidence,sources,a);
}

const q='5c87b7d6', qr='https://profiles.rice.edu/faculty/qimiao-si', qp='https://arxiv.org/pdf/cond-mat/9312021';
candidate(q,k,'Gabriel Kotliar','Rice 个人档分列 Chicago 1991 博士、Rutgers 和 UIUC 博后。Rutgers CMT 历届博士后名单核 Si 及 Rice 去向。1993 年原稿列 Si 和 Kotliar 同署 Rutgers Serin Physics Laboratory。Kotliar 为低可信 Rutgers 博后导师候选。UIUC 个人指导待查。',[qr,cmt,qp],refs(['Rice 原档',qr],['1993 年作者原稿',qp]),' → 博士候选关系：','Rutgers CMT 组属、Gabriel Kotliar（低可信候选）；UIUC 博后指导待核','继续核 Chicago 1991 博士论文和 UIUC、Rutgers 的历史任用与个人指导。Kathryn Levin 的博士候选保留。');

const x='b34b07a7', xx='https://tdli.sjtu.edu.cn/en/people/40702/xi-dai', xa='https://academic.hep.com.cn/EN/column11/item523.shtml', xp='https://digitalcommons.njit.edu/fac_pubs/14120/';
candidate(x,k,'Gabriel Kotliar','李政道研究所机构履历分列 HKUST 1999–2001、Boston College 2001–2002 与 Rutgers 2002–2004 博士后。Rutgers CMT 历届博士后档及同期论文馆藏核 Rutgers 身份。获奖档提到与 G. Kotliar 合作。保留 Kotliar 为低可信 Rutgers 博士后导师候选，三段正式指导仍待核。',[xx,cmt,xa,xp],refs(['机构履历',xx],['获奖原档',xa],['同期论文馆藏',xp]),' → 博士导师：','HKUST 1999–2001、Boston College 2001–2002、Rutgers 2002–2004，Gabriel Kotliar（Rutgers 低可信候选）','继续追三校博后任用、个人指导及当前跨校归属。保留博士导师苏肇冰。');

const f='2f0b9b07', fr='https://rcqm.rice.edu/who-we-are/matthew-foster', fp='https://arxiv.org/pdf/1204.3639v1', fc='https://mf23.web.rice.edu/MSF_CV_11_2025.pdf';
candidate(f,'人员 - Rutgers - Emil Yuzbashyan - 1fbe9553','Emil A. Yuzbashyan','Rice 量子材料中心和 Rutgers CMT 名单核 Foster 的 Rutgers 博后身份。本人 CV 旧存记录另列 2008–2009 在 Yuzbashyan 组访问，2009–2012 为 Rutgers 博后。2012 年 4 月原稿列 Foster 和 Yuzbashyan 同署 Rutgers CMT。访问任用与博士后分列，Yuzbashyan 为低可信博士后导师候选。',[fr,cmt,fp,fc],refs(['Rice 原档',fr],['2012 年首版作者原稿',fp]),' → 博士后课题组负责人：','Igor L. Aleiner（Columbia 博后组负责人）；Emil A. Yuzbashyan（Rutgers 低可信候选）','找本人 CV 可读新地址及 Rutgers 2009–2012 原始任用，核具名指导。');

const n='eb77eba7', nr='https://profiles.rice.edu/faculty/andriy-nevidomskyy', e='8de8d75e';
const existing=[
 [n,'Andriy Nevidomskyy','Rice 原档确认 Sherbrooke 博后后赴 Rutgers CMT 研究重费米子，2010 年入 Rice。Rutgers CMT 历届博士后档核本人和去向。Coleman CV 的 Postdocs 栏独立核组属，正式指导待查。',[nr,cmt,cc]],
 [e,'Onur Erten','Rutgers CMT 历届博士后档和 Coleman CV 的 Postdocs 栏均列 Onur Erten、Arizona State 去向。Coleman 课题组关系已核。Max Planck 博后另待具名原档，ASU 站点退避继续生效。',[cmt,cc]]
];
for(const [id,name,proof,sources] of existing){
 const links=roster+refs(['Coleman CV',cc]);
 editLine(fn(local(id)),l=>l.startsWith('- 博士后课题组负责人：')&&l.includes(wl(c,'Piers Coleman')),l=>l+' '+proof+links);
 indexLine(id,c,'博士后课题组负责人',proof+links);
 editLine(fn(c),l=>l.includes(wl(local(id),name))&&l.startsWith('- 博士后课题组成员：'),l=>l+' '+proof+links);
 if(id===e)changeRow(id,null,null,web('Rutgers CMT 原档',cmt));
 const ai=audit(id,{postdoc:['group_or_candidate',proof,sources]},id===n?'继续核 Cambridge 学位和 Sherbrooke、Rutgers 阶段具体任用与导师。':'继续核 Rutgers、Max Planck 两段任用与具名个人指导。');
 relation(id,'postdoc',c,'group_leader',proof,sources,ai,false);
}
const b='d321ab05', br='https://cse.umn.edu/cems/turan-birol';
const be='Minnesota CEMS 教师档列 2013–2016 Rutgers 凝聚态理论博士后，Rutgers CMT 历届博士后档核姓名及 Minnesota 去向。先前 Haule、Kotliar 低可信候选保留。现职研究包含凝聚态、结构化学与第一性原理材料计算。';
note(b,'- 核查边界：',be+roster+refs(['Minnesota CEMS 原档',br]));
changeRow(b,null,null,web('Minnesota CEMS 原档',br));
audit(b,{postdoc:['group_or_candidate',be,[cmt,br]]},'继续核 Rutgers CMT 个人人事或具名指导档，保留两位候选。');

const v='5f0f1272', vr='https://physics.uconn.edu/person/pavel-volkov/', vc='https://pavolkov.com/cv-publications/', vt='https://neutron.phys.ethz.ch/Methods/theory.html';
const ve='UConn 教师原档及 Rutgers CMT 历届博士后档核 2018–2022 Rutgers CMT，UConn 另列 2022–2023 Harvard 博后。ETH 合作组对 Chandra 组关系的具名说明与 Rutgers 中心档分列，正式个人指导待查。';
const vh='人员 - Rutgers - Premala Chandra - 804d9528', vs=roster+refs(['UConn 原档',vr]);
note(v,'- 博士后阶段课题组负责人：'+wl(vh,'Premala Chandra'),ve+vs);
indexLine(v,vh,'博士后课题组负责人',ve+vs);
mentorLine(vh,v,'- 博士后课题组成员：',ve+vs);
changeRow(v,null,null,web('Rutgers CMT 原档',cmt)+refs(['UConn 原档',vr]));
const ved='Volkov 本人 CV 的 2018 年 Ruhr-Universität Bochum 物理博士条目明确列 Advisor K. B. Efetov，2013 年 MIPT 硕士导师另列 Yu. E. Lozovik。';
const vem='师承人物 - K. B. Efetov';
note(v,'- 博士导师：',ved+refs(['本人 CV',vc]));
mentorLine(vem,v,'- 博士生：',ved+refs(['本人 CV',vc]));
indexLine(v,vem,'博士导师',ved+refs(['本人 CV',vc]));
const vi=audit(v,{phd:['confirmed_advisor',ved,[vc,vr]],postdoc:['group_or_candidate',ve,[vr,cmt,vc,vt]]},'继续核 Rutgers 与 Harvard 各阶段具名正式指导，保留 Chandra、Pixley、Sachdev、Vishwanath 各现有分类。');
relation(v,'postdoc',vh,'group_leader',ve,[vr,cmt,vc,vt],vi);
relation(v,'phd',vem,'advisor',ved,[vc,vr],vi);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Rutgers名录交叉核查';
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

