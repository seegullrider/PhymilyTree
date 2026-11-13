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
 a.audit_id='20261110_'+id+'_cached_original_1410';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_cached_original_1410_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const src={
 thesis:'https://fileserver-az.core.ac.uk/download/pdf/4433270.pdf',monroe:'https://umdphysics.umd.edu/images/CV/Monroe_CV_.pdf',duke:'https://physics.duke.edu/news/marko-cetina-building-quantum-machines-understand-physical-processes',
 ppfp:'https://ppfp.ucop.edu/info/fellowship-recipients/fellows-pages/wright-thaiesha-a.html',wcv:'https://sites.google.com/g.ucla.edu/wright-lab/cv',mrsec:'https://mrsec.ucsd.edu/mrsec-students/',ucla:'https://samueli.ucla.edu/people/thaiesha-wright/',
 kong:'https://isn.mit.edu/people/prof-jing-kong',kongBio:'https://physics.mit.edu/news/adventures-exploring-the-world-and-unchartered-physics-territory/',dekker:'https://ceesdekkerlab.nl/people/',
 warner:'https://sites.utexas.edu/warner/bio/',warNTU:'https://www3.ntu.edu.sg/workshop/uksgmat2012/Speakers_CV/Jamie_Warner.pdf',warOxford:'https://external.materials.ox.ac.uk/research/RIP2006.pdf',warBalliol:'https://www.balliol.ox.ac.uk/news/2011/october/new-master-fellows-and-academic-visitors-for-the-year-2011-2012',
 berg:'https://news.mit.edu/2024/2024-macvicar-faculty-fellows-0315',
 wang:'https://en.ustc.edu.cn/info/1065/2696.htm',wangPaper:'https://xlab.hku.hk/pdf/Stacking_order_engineering_of_two-dimensional_materials_and_device_applications.pdf',wangMinn:'https://cse.umn.edu/ece/events/quantum-materials-platform-nonlinear-electronic-and-memory-devices',
 hertz:'https://www.hertzfoundation.org/people/shelley-anna/',anna:'https://web.mit.edu/nnf/people/slanna/slanna.html',
 rum:'https://www.colorado.edu/chemistry/garry-rumbles',nlr:'https://www.nlr.gov/news/detail/program/2025/how-nrel-researcher-garry-rumbles-has-advanced-science-through-mentorship',rsc:'https://pubs.rsc.org/en/content/articlehtml/2020/mh/d0mh90070b',
 esc:'https://www.duffield.cornell.edu/people/fernando-escobedo/',escTalk:'https://luma.com/STMS-06242022-Escobedo-Heiranian',escBook:'https://assets.cambridge.org/97805217/65626/frontmatter/9780521765626_frontmatter.pdf',
 re:'https://reichmangroup.chem.columbia.edu/directory/david-r-reichman',reV:'https://chemistry.uchicago.edu/news/the-enduring-legacy-of-gregory-voth-a-beacon-of-innovation-and-mentorship-in-theoretical',
 tous:'https://vivo.brown.edu/docs/k/ktoussai_cv.pdf?dt=080415214',tousBU:'https://people.bu.edu/alexserg/',tousB:'https://engineering.brown.edu/news/2019-12-16/kimani-toussaint'
};
const link=(label,url)=>web(label,url)+'。';
const write=(id,msg,ph=null,pd=null)=>{note(id,'- 核查边界：',msg);changeRow(id,ph,pd,msg);};
const old=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,ev,urls)=>[old(id,k).status,old(id,k).note+' '+ev,urls];

const ce='afb50d61', vu='师承人物 - Vladan Vuletić';
const cePh='2011 MIT 物理论文 Hybrid Approaches to Quantum Information Using Ions, Atoms and Photons 的签署页及摘要均明确列 Vladan Vuletić 为 Thesis Supervisor。';
const cePd='Monroe 本人 CV 的 Research Scientists 栏列 Cetina 自 2015 年在 Maryland，Duke 组名单记 Research Scientist 2016–2020。Maryland 科研岗与早年 MIT 短期博后分列。';
const ceProof=cePh+' '+link('学位论文签署页',src.thesis);
enrich(ce,'phd',vu,'博士生',ceProof);
write(ce,cePd+' '+link('Monroe 本人 CV',src.monroe)+link('Duke 物理系入职访谈',src.duke));
const ceAid=audit(ce,{phd:['confirmed_advisor',cePh,[src.thesis]],postdoc:keep(ce,'postdoc',cePd,[src.monroe,src.duke]),affiliation:['confirmed','Duke 物理系入职访谈及既有 ECE 学校页核院系。',[src.duke,'https://ece.duke.edu/people/marko-cetina/']],research:['confirmed','Duke 物理系入职访谈核俘获离子、量子模拟及硬件。',[src.duke]]},'保留 Vuletić 早期 MIT 博后组属，继续核该段任用的指导职衔及 IQOQI 岗位边界。');
relation(ce,'phd',vu,'advisor',cePh,[src.thesis],ceAid,false);
relation(ce,'postdoc',vu,'group_leader','同组学生学位论文回忆 Cetina 毕业后短期在 Vuletić 组任博士后。Maryland 在 Monroe CV 中为单列 Research Scientists。',['https://studylib.net/doc/25724568/1031219266-mit--1-',src.monroe],ceAid,false);

const wr='d4ef251f', po='师承人物 - Jon Pokorski';
const wrEv='加州大学 President’s Postdoctoral Fellowship Program 的官方个人档在 Mentor 字段明确列 UC San Diego 的 Jon Pokorski。本人 CV 核该段 2021–2022。记录博士后项目导师，可信度高。';
const wrProof=wrEv+' '+link('UC 博后项目官方个人档',src.ppfp)+link('本人履历',src.wcv);
replaceNoteLabel(wr,'博士后阶段研究师长','博士后导师',po,' '+wrProof);
replaceInverseLabel(po,wr,'博士后阶段研究者','博士后研究者',' '+wrProof);
replaceIndexLabel(wr,po,'博士后阶段研究师长','博士后导师',' '+wrProof);
write(wr,wrProof+' Colorado Boulder 的 Joel Kaar 单列为博士后阶段研究师长。',null,'Joel Kaar（Colorado Boulder 博士后阶段研究师长）、Jon Pokorski（UCSD PPFP 博士后项目导师）');
const wrAid=audit(wr,{postdoc:['confirmed_advisor',wrEv+' Colorado Boulder Chancellor’s fellowship 由 Joel Kaar 提供研究指导，保留阶段研究师长。',[src.ppfp,src.wcv,src.mrsec]],affiliation:['confirmed','UCLA 工程学院原档列化学与生物分子工程系。',[src.ucla]],research:['confirmed','UCLA 原档列响应性软材料、生物材料和纳米凝胶。',[src.ucla]]},'分别核 Colorado Boulder fellowship 的正式导师任用原件。');
relation(wr,'postdoc',po,'advisor',wrEv,[src.ppfp,src.wcv],wrAid,false);

const ko='dbecb6b6',de='师承人物 - Cees Dekker';
const koEv='MIT 原档分列 2002–2003 NASA Ames Research Scientist 与 2003–2004 Delft 博后。Jarillo-Herrero 的第一人称回忆核其 Delft 博后与 Dekker 工作，保留博士后阶段研究师长。';
const koProof=koEv+' '+link('MIT 任职原档',src.kong)+link('Jarillo-Herrero 本人回忆',src.kongBio);
note(ko,'- 博士后阶段研究师长：',koProof);
mentorLine(de,ko,'- 博士后阶段研究者：',koProof);
indexLine(ko,de,'博士后阶段研究师长',koProof);
write(ko,koProof,null,'Cees Dekker（2003–2004 Delft 博后阶段研究师长）；NASA Ames Research Scientist 单列');
const koAid=audit(ko,{postdoc:['group_or_candidate',koEv,[src.kong,src.kongBio]],affiliation:['confirmed','MIT EECS 教授及 RLE PI。',[src.kong]],research:['confirmed','MIT 院档列低维纳米材料合成、电子器件和传感。',[src.kong]]},'继续追 Delft 博后任用和个人正式指导职衔。');
relation(ko,'postdoc',de,'stage_mentor',koEv,[src.kong,src.kongBio],koAid,false);

const wa='26823615',br='师承人物 - G. Andrew D. Briggs';
const waEv='本人原档与 NTU 讲者资料核 2006 年末 Oxford 材料系 Quantum Information Processing Group 博后，2008 年起 Glasstone fellowship 独立建组。Oxford 同期系报告列 Briggs 为 QIP IRC 负责人，并将两人列同一个碳纳米材料项目。Briggs 为 Oxford 博后阶段低可信指导候选。';
const waProof=waEv+' '+link('本人履历',src.warner)+link('NTU 讲者资料',src.warNTU)+link('Oxford 同期材料系报告',src.warOxford)+link('Balliol 任职档',src.warBalliol);
addEdge(wa,'博士后导师候选',br,'G. Andrew D. Briggs',waProof,null,true);
inverse(wa,br,'博士后研究者（指导关系候选）',waProof);
write(wa,waProof,null,'新西兰 Richard D. Tilley（候选）、澳大利亚个人指导待查、Oxford G. Andrew D. Briggs（候选）；2008 起独立 fellowship');
const waAid=audit(wa,{postdoc:['group_or_candidate',waEv+' 新西兰 Tilley 候选保留，澳大利亚阶段导师待查。',[src.warner,src.warNTU,src.warOxford,src.warBalliol]]},'分别追新西兰、澳大利亚与 Oxford 三段任用指导，UQ 博士旧证保留，学位档原址本轮 cache miss。');
relation(wa,'postdoc',br,'candidate',waEv,[src.warner,src.warNTU,src.warOxford],waAid);

const k='dcbda5fb';
const kEv='MIT MacVicar 2024 原档列 Berggren 1996 年进入 Lincoln Laboratory 为 staff member，2003 年成为 MIT 助理教授。已核资料未见独立博士后聘任。';
write(k,kEv+' '+link('MIT 本人任职原档',src.berg),null,'1996–2003 MIT Lincoln Laboratory staff；未见独立博士后聘任，待复核');
audit(k,{postdoc:['no_postdoc_documented',kEv,[src.berg]]},'继续追 Lincoln Laboratory 初期岗位档案，保留如有短期独立博后的核查事项。');

const yi='8d9bee3e',xz='师承人物 - Xiang Zhang（UC Berkeley 光子学）';
const yiEv='2018 年 USTC 讲座本人简介与 Wang 署名论文作者履历独立列 UC Berkeley 2018 年博士，和 Wisconsin 工学院一致。Wisconsin 教师名录的 2017 年记法保留，最终以学位签署或授予记录为准。';
const yiProof=yiEv+' '+link('USTC 讲座原档',src.wang)+link('本人署名论文作者履历',src.wangPaper);
write(yi,yiProof,'Xiang Zhang（UC Berkeley 博士导师，原档支持 2018，旧教师目录另列 2017）');
enrich(yi,'phd',xz,'博士生',yiProof);
const yiAid=audit(yi,{phd:keep(yi,'phd',yiEv,[src.wang,src.wangPaper,src.wangMinn]),affiliation:['confirmed','Minnesota 讲座与本人论文作者档核 Wisconsin–Madison ECE 及 Physics、MSE 关联。',[src.wangMinn,src.wangPaper]],research:['confirmed','院校讲座与署名论文核二维量子材料、电子与光电子器件。',[src.wangMinn,src.wangPaper]]},'按 2018 年及应用物理方向追 Berkeley 学位档，并追博士后任用个人导师字段。');
relation(yi,'phd',xz,'advisor',yiEv,[src.wangMinn,src.wangPaper,src.wang],yiAid,false);

const an='f7ff1244',anEv='MIT 实验室同期个人页直接列 Harvard 工程与应用科学博士论文 Extensional rheology of polymer solutions。Hertz 资助机构履历核 Harvard 博士及 Carnegie Mellon 化学工程任职。McKinley 组属保留。';
write(an,anEv+' '+link('MIT 同期个人页',src.anna)+link('Hertz 原档',src.hertz));
audit(an,{phd:keep(an,'phd',anEv,[src.anna,src.hertz]),affiliation:['confirmed','Hertz 履历列 Carnegie Mellon 化学工程教授。',[src.hertz]],research:['confirmed','机构履历核软材料、流变、微流控与界面流体物理。',[src.hertz]]},'按 MIT 所列题名继续核 Harvard 论文原档中的导师。');

const ru='c46c36ec',ruEv='NREL 2025 公告称 Rumbles 1 月 31 日以 Emeritus Research Fellow 身份离任，更新 NREL 任职标注。Boulder 化学系原档另列 Adjoint Professor 及三个博后时期与具名研究者。';
write(ru,ruEv+' '+link('NREL 官方公告',src.nlr)+link('Boulder 化学系履历',src.rum));
audit(ru,{affiliation:['confirmed','Boulder 化学系兼任教授，NREL 自 2025-01-31 为荣休研究员。',[src.rum,src.nlr]],research:['confirmed','官方档核太阳能光化学、有机光伏、激子与电荷输运。',[src.rum,src.nlr]],phd:keep(ru,'phd','RSC 文章作者介绍与本人 Boulder 访谈支持 David Phillips 博士阶段研究指导。',[src.rsc,src.rum])},'继续定位伦敦大学 1984 学位档和三个博士后岗位的具体导师称谓。');

const es='1e5a80fe',esEv='Cornell 院系原档列 1997 Wisconsin 博士和 1998 年底入职，旧校报记入职 1999。报告原文的博士指导是 Juan de Pablo，同场的 Elimelech 博后指导对应 Heiranian。de Pablo 所著教材序只称 Escobedo 参与试读。';
write(es,esEv+' '+link('Cornell 院系',src.esc)+link('同场报告原文',src.escTalk)+link('作者序',src.escBook));
audit(es,{phd:keep(es,'phd',esEv,[src.esc,src.escTalk,src.escBook]),affiliation:['confirmed','Cornell 化学与生物分子工程院系原档。',[src.esc]],research:['confirmed','Cornell 院系原档列软物质、聚合物、胶体及分子模拟。',[src.esc]]},'继续定位 1997 Wisconsin 论文签署页和博士毕业后至 Cornell 入职间任用。');

const re='38d42d59',reEv='Columbia 本人组页明确 1997–1999 Utah NIH 博后在 Greg Voth 指导下。Chicago 纪念专题仅将 Reichman 列于作者团队，保留博士后阶段研究师长。';
write(re,reEv+' '+link('本人课题组履历',src.re)+link('Chicago 化学系专题',src.reV));
const reAid=audit(re,{postdoc:keep(re,'postdoc',reEv,[src.re,src.reV]),affiliation:['confirmed','本人组页核 Columbia 化学系 Centennial Professor。',[src.re]],research:['confirmed','本人组页核统计力学及复杂凝聚相。',[src.re]]},'定位 Utah 博后正式任用、CV 或获奖档的个人 advisor 字段。');
relation(re,'postdoc','师承人物 - Gregory A. Voth','stage_mentor',reEv,[src.re,src.reV],reAid,false);

const to='6b81c702',toEv='Toussaint 本人 Brown 托管 CV 分列 BU 电气工程 2004 博士、2004–2005 Chicago Postdoctoral Research Associate 与随后 NSF Postdoctoral Fellow。Sergienko 本人 BU 组档确认组属。博士论文导师及两段 Chicago 任用的正式职衔待核。';
write(to,toEv+' '+link('本人 CV',src.tous)+link('Sergienko 原始成员页',src.tousBU));
audit(to,{phd:keep(to,'phd',toEv,[src.tous,src.tousBU]),postdoc:keep(to,'postdoc',toEv,[src.tous]),affiliation:['confirmed','Brown 工程学院官方报道核入职与工程学院任职。',[src.tousB]],research:['confirmed','Brown 官方报道核光学显微与等离激元光子学。',[src.tousB]]},'继续追 Boston University 学位论文导师栏和 Chicago 两段博后资助任用。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_缓存原证阶段再核';
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

