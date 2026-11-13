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
 a.audit_id='20261110_'+id+'_ucla_princeton_and_postdoc_1731';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_ucla_princeton_and_postdoc_1731_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const l='bd15cb84', p='c23596c0', h='1efefbf1', m='9e994399', e='78f0647f', t='071d07f9', s1='d65082e2', s2='ebe2ac32';
const wl=(f,n)=>'[['+f+'|'+n+']]';
const ls=(...pairs)=>pairs.map(([label,url])=>' '+web(label,url)).join('');
function personLine(id,label,target,extra){
 editLine(fn(local(id)),x=>x.startsWith('- '+label+'：')&&x.includes('[['+target+'|'),x=>x+' '+extra);
}
function appendRelation(id,stage,mentor,name,label,back,evidence,sources,sourceLinks,anchor,create=false){
 const r=records.get(id), recipient=wl(r.filename,r.name), other=wl(mentor,name);
 const s=evidence+sourceLinks;
 editLine(fn(local(id)),x=>x.startsWith(anchor),x=>x+'\n- '+label+'：'+other+'。'+s);
 const f=fn(mentor);
 if(create){
  if(fs.existsSync(f))throw Error('existing mentor '+f);
  graph.set(f,'# '+name+'\n\n> [!info] 师承扩展人物\n> 本节点记录有来源的阶段关系或候选。\n\n## 师承\n\n- '+back+'：'+recipient+'。'+s+'\n');
 }else editLine(f,x=>x==='## 师承',x=>x+'\n\n- '+back+'：'+recipient+'。'+s);
 const row='- '+recipient+' → '+label+'：'+other+'。'+s;
 const section='## 博士原件与履历补证（2026-11-10）';
 if(!graph.has(idx)||!graph.get(idx).includes(section)){
   const orig=graph.get(idx)??fs.readFileSync(idx,'utf8');const eol=orig.includes('\r\n')?'\r\n':'\n';
   graph.set(idx,orig.trimEnd()+eol+eol+section+eol+eol+row+eol);
 }else{
   const orig=graph.get(idx);const eol=orig.includes('\r\n')?'\r\n':'\n';graph.set(idx,orig.trimEnd()+eol+row+eol);
 }
}

const lc='https://cbe.princeton.edu/sites/g/files/toruqf1386/files/people-cv/loo_cv.pdf', lp='https://www.leelabnyu.com/meet-the-pi', lr='https://blogs.rsc.org/sm/2021/05/25/soft-matter-emerging-investigator-stephanie-lee/';
const ld='Loo 本人 CV 的 Graduate students advised 栏列 2007–2012 Stephanie Lee，并列 MIT 2007 学位和 Stevens 后续任职。Lee 本人实验室履历核对三个识别字段和 2012 Princeton 博士。';
const lpost='Lee 在 RSC 本人访谈明确称 Mike Ward 为 postdoc advisor。本人实验室履历确认 NYU Molecular Design Institute 2012–2014 博士后。';
const lment='人员 - Princeton - Yueh-Lin (Lynn) Loo - b4cab7b0';
replaceNoteLabel(l,'博士阶段研究师长','博士导师',lment,' '+ld+ls(['Loo 本人 CV',lc],['Lee 本人组档',lp]));
replaceInverseLabel(lment,l,'博士阶段研究成员','博士生',' '+ld+ls(['Loo 本人 CV',lc]));
replaceIndexLabel(l,lment,'博士阶段研究师长','博士导师',' '+ld+ls(['Loo 本人 CV',lc]));
editLine(fn(local(l)),x=>x.startsWith('- 核查边界：'),()=>'- 核查边界：'+ld+' '+lpost+ls(['Loo 本人 CV',lc],['Lee 本人访谈',lr]));
changeRow(l,'Yueh-Lin (Lynn) Loo（博士导师）',null,web('Loo 本人 CV',lc));
const li=audit(l,{phd:['confirmed_advisor',ld,[lc,lp]],postdoc:['confirmed_advisor',lpost,[lr,lp]]},'已核两阶段具名导师。继续补 Princeton 博士论文原档和共同指导信息。');
relation(l,'phd',lment,'advisor',ld,[lc,lp],li,false);

const pq="https://escholarship.org/content/qt9v5049t4/qt9v5049t4_noSplash_e4d1f941a4015fcbaf3ca03bc5b6fc63.pdf?t=nvdtg2", pe='https://www.edx.org/bio/pramey-upadhyaya', pw='人员 - UCLA - Kang L. Wang - bfafac51', py='人员 - UCLA - Yaroslav Tserkovnyak - 233102a4';
const pd='UCLA 2015 学位论文签署页列 Kang Lung Wang 为 Committee Chair。论文致谢中本人称 Kang Wang 为 my graduate advisor，并描述其指导博士课题。';
const pt='本人博士论文致谢将理论物理训练和技能归于 Yaroslav Tserkovnyak，签署页也有其姓名。按博士阶段研究师长记录，共同论文导师职衔待核。';
const pp='edX 本人课程履历将 UCLA 博后时期与 Tserkovnyak 的 mentorship 单列。按博士后阶段研究师长记录。';
const psource=ls(['UCLA 博士论文原件',pq]);
replaceNoteLabel(p,'博士阶段课题组负责人','博士导师',pw,' '+pd+psource);
replaceInverseLabel(pw,p,'博士阶段课题组成员','博士生',' '+pd+psource);
replaceIndexLabel(p,pw,'博士阶段课题组负责人','博士导师',' '+pd+psource);
for(const f of [fn(local(p)),fn(pw),idx]) editLine(f,x=>x.includes(f===fn(pw)?'[['+local(p)+'|': '[['+pw+'|')&&x.includes('未明确论文导师')&&x.includes(f===fn(local(p))?'- 博士导师：':f===fn(pw)?'- 博士生：':'[['+local(p)+'|'),x=>x.replace('，未明确论文导师。；关系类型可信度：高。','。'));
editLine(fn(local(p)),x=>x.startsWith('- 核查边界：'),()=>'- 核查边界：'+pd+' '+pp+psource+ls(['edX 原档',pe]));
appendRelation(p,'phd',py,'Yaroslav Tserkovnyak','博士阶段研究师长','博士阶段研究者',pt,[pq],psource,'- 核查边界：');
changeRow(p,'Kang L. Wang（博士导师）、Yaroslav Tserkovnyak（博士阶段研究师长）',null,web('UCLA 博士论文原件',pq));
const pi=audit(p,{phd:['confirmed_advisor',pd+' '+pt,[pq]],postdoc:['group_or_candidate',pp,[pe]]},'核 UCLA 博后阶段的正式聘任指导职衔。两阶段 Tserkovnyak 的证据分列。');
relation(p,'phd',pw,'advisor',pd,[pq],pi,false);
relation(p,'phd',py,'stage_mentor',pt,[pq],pi);

const ha="https://www.researchgate.net/publication/367483562_Discipline-Based_Diversity_Research_in_Chemistry", ht='https://escholarship.org/content/qt8sf5p0wq/qt8sf5p0wq.pdf';
const hp='https://www.weizmann.ac.il/chembiophys/pollak/group-members?qt-view__group_members__group_members_page=1', hvc='https://www.rigobertohernandez.org/?page_id=132';
const hms='https://engineering.jhu.edu/materials/people/matsci-affiliates/associated-faculty/', hce='https://engineering.jhu.edu/chembe/people/secondary-appointments/';
const he='本人共同署名的 ACS 论文镜像作者简介列 1994 Weizmann 博士后与 Eli Pollak 工作。Pollak 本人组档列 R. Hernandez 及 1994。标为阶段研究师长。';
const hv='本人共同署名的 ACS 论文镜像作者简介列 1995–1996 Penn 博士后与 Gregory A. Voth 工作。本人履历另核阶段与单位，标为阶段研究师长。';
const hd='Berkeley 学位论文原件列 1993 化学博士、论文委员会主席 William H. Miller。Georgia Tech 存档本人履历明列 thesis advisor W. H. Miller。ACS 作者简介把博士年份写为 2003，与学位原件和 1994 博后年表冲突，保留差异并按 1993 年学位档。';
const hm='师承人物 - William H. Miller';
note(h,'- 博士导师：',hd+ls(['Berkeley 论文原件',ht],['ACS 作者简介',ha]));
mentorLine(hm,h,'- 博士生：',hd+ls(['Berkeley 论文原件',ht]));
indexLine(h,hm,'博士导师',hd+ls(['Berkeley 论文原件',ht]));
editLine(fn(local(h)),x=>x.startsWith('- 核查边界：'),()=>'- 核查边界：ACS 原刊作者简介补出两段博士后具名共事关系。正式个人 advisor 职衔仍待核。'+ls(['ACS 作者简介',ha]));
appendRelation(h,'postdoc','师承人物 - Eli Pollak','Eli Pollak','博士后阶段研究师长','博士后阶段研究者',he,[ha,hp],ls(['ACS 原文',ha],['Pollak 组档',hp]),'- 核查边界：',true);
appendRelation(h,'postdoc','师承人物 - Gregory A. Voth','Gregory A. Voth','博士后阶段研究师长','博士后阶段研究者',hv,[ha,hvc],ls(['ACS 原文',ha],['本人履历',hvc]),'- 核查边界：');
const hUnits=[['已核实单位 - Johns Hopkins - 材料科学与工程系（关联）','材料科学与工程系（关联）',hms],['已核实单位 - Johns Hopkins - 化学与生物分子工程系（关联）','化学与生物分子工程系（第二任用）',hce]];
editLine(fn(local(h)),x=>x.startsWith('- 院系／机构：'),()=>'- 院系／机构：'+wl('已核实单位 - Johns Hopkins - 化学系','化学系（主聘）')+' · '+hUnits.map(([target,label,url])=>wl(target,label)+ls(['院系原档',url])).join(' · ')+'。');
for(const [target,label,url] of hUnits)editLine(path.join(root,'已核实院系',target+'.md'),x=>x.startsWith('仅收录'),x=>x+'\n- '+wl(local(h),'Rigoberto Hernandez')+' — '+label+'。'+ls(['院系原档',url]));
changeRow(h,null,'Eli Pollak（Weizmann 1994）、Gregory A. Voth（Penn 1995–1996），阶段研究师长',web('ACS 作者简介',ha)+ls(['Berkeley 论文原件',ht],['材料系原档',hms],['化工系原档',hce]));
const hr=records.get(h);
editLine(path.join(root,hr.unit+'逐人复核记录.md'),x=>x.startsWith('| [['+hr.filename+'|'),x=>x.replace('材料与化工任职性质待核','材料科学与工程系关联、化学与生物分子工程系第二任用'));
const hi=audit(h,{affiliation:['confirmed','JHU 化学系主聘。材料系列 Associated Faculty，化工系列 Secondary Appointments。',[hms,hce]],phd:['confirmed_advisor',hd,[ht,ha]],postdoc:['group_or_candidate',he+' '+hv,[ha,hp,hvc]]},'已核两段具名研究师长。继续查正式聘任指导职衔。');
relation(h,'phd',hm,'advisor',hd,[ht,'https://cns.gatech.edu/research/PFCprpsl02/PDF/RH.pdf'],hi,false);
relation(h,'postdoc','师承人物 - Eli Pollak','stage_mentor',he,[ha,hp],hi);
relation(h,'postdoc','师承人物 - Gregory A. Voth','stage_mentor',hv,[ha,hvc],hi);

const mt='https://thesis.caltech.edu/1813/', mc="https://mnp.ucsd.edu/members.html", mj='https://jacobs.ucsd.edu/people/profile/shayan-mookherjea';
const me='Caltech 学位记录列 2003 年博士、Advisor Amnon Yariv；毕业论文原件列 2003 年 6 月。本人实验室履历列同年 7 月入 UCSD 任助理教授，学校履历相符。已核这段未见独立博士后任用。';
note(m,'- 核查边界：',me+ls(['Caltech 学位档',mt],['本人任用履历',mc]));
changeRow(m,null,'2003 年 6 月 Caltech 博士、7 月 UCSD 助理教授；已核履历未见独立博后',web('学位档',mt)+ls(['本人任用履历',mc]));
audit(m,{phd:['confirmed_advisor',me,[mt]],postdoc:['no_postdoc_documented',me,[mt,mc,mj]]},'已核博士、入职月份与已见任用履历。校方如有不同历史档，再核其连续任用。');

const et='https://eng.famu.fsu.edu/mae/people/hellstrom', ep='https://profiles.stanford.edu/robert-huggins?tab=publications', el='https://ceat.okstate.edu/mmme/mse/site-files/docs/2019_oct_hellstrom-superconductingwires.pdf';
const ee='FSU 机械工程系原档核 1978 Stanford 材料博士。Stanford Huggins 本人机构书目列 1976 年与 E. E. Hellstrom 等合著，并列 1979 年二人合著。以同领域、单位和时段合作作为低可信博士导师候选。正式指导待论文。';
const eo='2019 学术报告原档列荷兰博士后和后续 Sandia 任用。荷兰阶段机构、年份和具名导师待核。';
appendRelation(e,'phd','师承人物 - Robert A. Huggins','Robert A. Huggins','博士导师候选','博士候选研究者',ee,[et,ep],ls(['FSU 院系原档',et],['Huggins Stanford 书目',ep]),'- 核查边界：',true);
changeRow(e,'Robert A. Huggins（低可信博士候选）',null,web('FSU 院系原档',et)+ls(['Stanford 原书目',ep]));
const ei=audit(e,{phd:['group_or_candidate',ee,[et,ep]],postdoc:['unresolved',eo,[et,el]]},'按 Stanford 1978 材料博士、早年固态离子学及荷兰报告线索查学位和任用原档。');
relation(e,'phd','师承人物 - Robert A. Huggins','candidate',ee,[et,ep],ei);

const tb='https://chemistry.berkeley.edu/node/2569', tv='https://mii.vt.edu/content/dam/mii_vt_edu/past-technical-seminars/pre-2018-seminars/Ting-Xu-Seminar.pdf';
const te='Berkeley 化学系履历列 Penn 和 NIST CNBT 联合博士后 2004–2007；Virginia Tech 原讲者档也写联合培养，结束年份作 2006。保留时间差异。Penn 明确导师 J. Kent Blasie 保留，NIST 是否有另一位具名指导待核。';
note(t,'- 博士后导师：',te+ls(['Berkeley 原档',tb],['Virginia Tech 原档',tv]));
changeRow(t,null,'J. Kent Blasie（Penn 明确导师）；Penn／NIST CNBT 联合博后，NIST 具名指导待核',web('Berkeley 原档',tb)+ls(['Virginia Tech 原档',tv]));
audit(t,{postdoc:['confirmed_advisor',te,[tb,tv,'https://www.med.upenn.edu/cbit32/assets/user-content/documents/2003-2009-chemical-biophysics-mini-symposia-series-past-symposia.pdf']]},'UMass 论文或具名档待核。Russell 候选保留。NIST 联合阶段具名指导与任期末年继续查。');

const sv="https://www.apam.columbia.edu/files/seas/content/apam_image/cv_michele_simoncelli_2026.pdf", sc='https://www.cai.cam.ac.uk/news/simoncelli-from-caius-to-columbia', sa='https://www.apam.columbia.edu/faculty-staff/directory/michele-simoncelli';
const se='Columbia 存档本人 CV 和 Caius 学院原档核 Cambridge Research Fellow 在 2021 年开始。本人 CV 列 Cavendish Research Fellow 2021 年 9 月至 2024 年 12 月，分别列 Crone 和 SNSF 两项资助，未列 Cambridge 个人导师。EPFL 短期博后名录原页尚未取得，待核。';
for(const id of [s1,s2]){
 note(id,'- 博士后阶段补证',se+ls(['Columbia 存档本人 CV',sv],['Caius 原档',sc]));
 changeRow(id,null,null,web('Columbia 存档本人 CV',sv));
 audit(id,{postdoc:['unresolved',se,[sv,sc,sa]]},'两条 Columbia 记录属同一人。继续查 EPFL 短期博士后名录原页和 Cambridge 具名导师。');
}
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_UCLA论文及跨院系博士后';
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

