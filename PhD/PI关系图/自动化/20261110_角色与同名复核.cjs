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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0718';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0718_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const qiu='686c90ef', luo='f5b85505', per='f4e438b4', cui='a3f24027', and='eb77eba7', lee='cef8660f';
const lq='人员 - UC Berkeley - Steven Louie（荣休） - 3253eda8', stebe='人员 - UPenn - Kathleen J. Stebe - 4427033a';
const bl='师承人物 - Nicolaas Bloembergen', ali='人员 - University of Chicago - Paul Alivisatos - 9209cf4f', payne='师承人物 - Michael C. Payne';
const qcv='https://qiugroup.yale.edu/sites/default/files/files/DYQ-CV-2026.pdf';
const yaleQ='https://engineering.yale.edu/research-and-faculty/faculty-directory/diana-qiu';
const groupQ='https://physics.berkeley.edu/node/2498';
const yaleL='https://luogroup.research.yale.edu/people/yimin-luo';
const utk='https://calendar.utk.edu/event/cbe_seminar_yimin_luo_university_of_delaware';
const argonne='https://www.aps.anl.gov/files/APS-Uploads/APS-Colloquium/Pershan_June_Surfaces.pdf';
const perHome='https://liquids.seas.harvard.edu/Welcome_frames_Emeritus.html';
const oral='https://faculty.washington.edu/seattle/gis129/575%20copy/nmr-history-pdf/bloembergen.pdf';
const wiley='https://onlinelibrary.wiley.com/doi/full/10.1002/cey2.4';
const stanC='https://energy.stanford.edu/news/stanford-names-cleantech-pioneer-yi-cui-new-director-its-precourt-institute-energy';
const bnl='https://www.bnl.gov/staff/anevidoms', rut='https://cmt.rutgers.edu/alumni/';
const aps='https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.91.105502';
const cam='https://www.phy.cam.ac.uk/profile/prof-michael-payne/';
const ethos='https://ethos.bl.uk/OrderDetails.do?uin=uk.bl.ethos.615061';
const camGroup='https://vallico.net/mike_towler/esdg.html';
const econ='https://econ.columbia.edu/wp-content/uploads/sites/18/2023/09/CV_shl_20230925.pdf';
const phys='https://galileo.phys.virginia.edu/research/groups/nextlab/member/SHL_CV_2016.pdf';
function appendEdgeSource(id,label,target,reverse,proof){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+proof);
 mentorLine(target,id,'- '+reverse+'：',proof);
 indexLine(id,target,label,proof);
}
const qProof='Qiu 本人 2026 CV 在 2017 Berkeley 物理博士论文条目下直接列 Advisor: Steven G. Louie。';
enrich(qiu,'phd',lq,'博士生',web('本人 2026 CV',qcv)+qProof);
appendEdgeSource(qiu,'博士后课题组',lq,'博士后课题组成员',web('本人 2026 CV',qcv)+'将博后单位单列为 2017–2019 Lawrence Berkeley National Laboratory；组名录核对 Louie 组属。');
editLine(fn(local(qiu)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：本人 CV 明确 Berkeley 博士论文导师。2017–2019 LBNL 博后由 Louie 组校友档补实组属，正式博后 advisor 职衔待核。');
note(qiu,'- 研究方向：',web('Yale 工程学院教师档',yaleQ)+'与'+web('本人 2026 CV',qcv)+'核实 Yale 材料科学助理教授，CV 另列 Physics 和 Applied Physics courtesy 任职。');
changeRow(qiu,'Steven G. Louie（本人 CV 明列论文 Advisor）','Steven G. Louie（2017–2019 LBNL 博后组属）',web('本人 2026 CV',qcv));
const q=audit(qiu,{phd:['confirmed_advisor',qProof,[qcv]],postdoc:['group_or_candidate','本人 CV 明列 2017–2019 LBNL 博后，Louie 组档将其列作同期间 Former Postdoctoral Fellow，个人正式任命称谓待核。',[qcv,groupQ]],affiliation:['confirmed','Yale 工程学院名录及本人 CV 列材料科学助理教授，CV 列 Physics、Applied Physics courtesy 任职。',[yaleQ,qcv]]},'进一步核对 LBNL 2017–2019 博后任命与具体导师角色。');
relation(qiu,'phd',lq,'advisor',qProof,[qcv],q,false);
const lProof='Tennessee 化工研讨会原档明确 2018 Penn 博士 under the supervision of Kathleen J. Stebe；Luo 现任 Yale 本人组页独立核实博士阶段与 Stebe 的具体研究。';
enrich(luo,'phd',stebe,'博士生',web('Yale 本人组页',yaleL)+lProof);
changeRow(luo,'Kathleen J. Stebe（Tennessee 原档具名博士指导，Yale 本人组页交叉核对）',null,web('Yale 本人组页',yaleL));
const l=audit(luo,{phd:['confirmed_advisor',lProof,[utk,yaleL]],postdoc:['group_or_candidate','Yale 本人组页分列 Delaware Wagner 与 Furst 组、UCSB Valentine 与 Helgeson 组。Tennessee 同期讲座核实 Delaware 联合博后。',[yaleL,utk]],affiliation:['confirmed','Yale 本人组页列助理教授，系属沿用已核 Yale 院系原档。',[yaleL]],research:['confirmed','本人组页列向列液晶中粒子迁移、可重构组装及胶体流变。',[yaleL,utk]]},'继续查 Penn 论文签署与两段联合博后任命，组属不等同正式 advisor。');
relation(luo,'phd',stebe,'advisor',lProof,[utk,yaleL],l,false);
const perProof='Pershan 本人 Argonne 讲座履历明确 Harvard 1960 博士研究 under the supervision of Bloembergen；本人 Harvard 回忆称其 mentor，Bloembergen AIP 口述史亦将 Pershan 列为自己的学生。';
enrich(per,'phd',bl,'博士生',web('Bloembergen 的 AIP 口述史',oral)+'从指导者侧核对 Pershan 先为其学生，之后留组博士后。');
appendEdgeSource(per,'博士后阶段课题组负责人',bl,'博士后课题组成员',web('Bloembergen 的 AIP 口述史',oral)+'明确记述 Pershan 留组博后后成为助理教授。');
changeRow(per,'Nicolaas Bloembergen（本人讲座明确博士指导）',null,web('Argonne 原讲座',argonne)+' · '+web('Bloembergen AIP 口述史',oral));
const pe=audit(per,{phd:['confirmed_advisor',perProof,[argonne,perHome,oral]],postdoc:['group_or_candidate','Bloembergen AIP 口述史说 Pershan 在博士后继续留组后成为助理教授；此前同期资料核对 1961 组属。',[oral]]},'查 Harvard 博士论文签署及留组博后的正式任命称谓。');
relation(per,'phd',bl,'advisor',perProof,[argonne,perHome,oral],pe,false);
const cProof='Cui 在本人 2019 采访明确把 Lieber 写为 Ph.D advisor，将 Alivisatos 称为 my postdoctoral mentor；Stanford 本人回忆证实 Berkeley Lab 任内为 Alivisatos 工作。按原证列为博士后阶段研究师长。';
replaceNoteLabel(cui,'博士后导师','博士后阶段研究师长',ali,' 原档正式任命头衔继续查。');
replaceInverseLabel(ali,cui,'博士后研究者','博士后阶段研究者',' 原档称 postdoctoral mentor。');
editLine(idx,s=>s.startsWith('- [['+local(cui)+'|')&&s.includes('博士后导师 [['+ali+'|'),s=>s.replace('博士后导师 [['+ali+'|','博士后阶段研究师长 [['+ali+'|')+' Berkeley 任命的正式称谓待查。');
changeRow(cui,null,'A. Paul Alivisatos（本人明确称 postdoctoral mentor，阶段研究师长）',web('Stanford 原机构访谈',stanC));
audit(cui,{postdoc:['group_or_candidate',cProof,[wiley,stanC]]},'追查 Miller 项目任命材料中的正式 advisor 字段；两份原始材料已明确 Alivisatos 的博后指导与阶段。');
const nProof=web('同期 APS 论文原档',aps)+'确认 2003 年 Nevidomskyy 与 Michael C. Payne 同属 Cambridge Cavendish 的 Theory of Condensed Matter Group 并合作研究碳纳米管。'+web('Cambridge 教师档',cam)+'核 Payne 身份。可信度低，待原论文或履历核具体指导。';
addEdge(and,'博士导师候选',payne,'Michael C. Payne',nProof,'',true);
newMentor(payne,'Michael C. Payne','Cambridge Cavendish 实验室理论凝聚态，曾任计算物理讲席。'+web('Cambridge 原教师档',cam),and,'博士候选关联人物',nProof);
editLine(fn(local(and)),s=>s.startsWith('- 核查边界：'),s=>s+' 二级书目列碳与氮化硼纳米管博士论文题目，'+web('EThOS 原目录（本轮不可访问）',ethos)+'待原档确认。');
changeRow(and,'Cambridge Michael C. Payne（同期同组合作候选）',null,web('APS 同期论文',aps)+' · '+web('Rutgers CMT 博后名册',rut));
const n=audit(and,{phd:['group_or_candidate','APS 2003 同期原论文列 Nevidomskyy、Payne 及 Csányi 同属 Cavendish TCM，Cambridge 教师档核 Payne。二级书目列可能的 Cambridge 博士论文题名，EThOS 原目录不可访问；不据合著确认导师。',[aps,cam,camGroup,bnl]],postdoc:['group_or_candidate','BNL 原履历列 Sherbrooke 与 Rutgers 两段；Rutgers CMT 原名册核对其为该中心原博后。Sherbrooke Le Hur 与 Rutgers Coleman 的既有证据保留。',[bnl,rut]]},'继续查 EThOS 615061 或 Cambridge 纸本论文与致谢。Payne 是同期同组低可信候选，非正式导师。');
relation(and,'phd',payne,'candidate','APS 2003 原论文列同单位碳纳米管合作，Cambridge 原档确认 Payne 身份。个人博士指导仍待查。',[aps,cam,bnl],n);
const leeProof='Columbia Economics 的同名 Seung-hun Lee 2023 CV 列 2017 Yonsei 经济本科、Columbia 经济学博士预计 2024。UVA 物理学者本人履历列 1996 Johns Hopkins 物理博士，方向、学位与年代均不符。';
editLine(fn(local(lee)),s=>s.startsWith('- 核查边界：'),s=>s+' 同名排除：'+leeProof+' '+web('同名者经济学 CV',econ));
const leeAudit=audit(lee,{identity:['confirmed',leeProof,[econ,phys]]},'已排除 Columbia 经济学同名 CV；继续核对 UVA 物理学者 NIST 任命及博士后岗位性质。');
const excluded=[{page_id:'e8c894f98bba00b33bdf17aa',record_id:lee,url:econ,audit_id:leeAudit,external_subject:'Seung-hun Lee（Columbia 经济学研究者）',evidence:leeProof}];

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_角色与同名复核';
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
 const excludedFile=stamp+'_同名排除.json';
 fs.writeFileSync(excludedFile,JSON.stringify(excluded,null,2)+'\n','utf8');
 console.log(execFileSync(process.execPath,['--no-warnings','人物网页身份纠偏.cjs',excludedFile],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
