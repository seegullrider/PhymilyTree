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
 a.audit_id='20261110_'+id+'_duke_nus_advisors_1451';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_duke_nus_advisors_1451_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const src={"cuhk":"https://www.cuhk.edu.hk/chem/doc/seminar/research_seminar_oct16.pdf","nus":"https://nusgs.nus.edu.sg/thesis-advisors/chmwmw","amat":"https://amat.nus.edu.sg/richard-wong/","clementi":"https://www.iaqms.org/obituary/EnricoClementi.pdf","wiberg":"https://chem.yale.edu/profile/kenneth-wiberg","umn":"https://conservancy.umn.edu/bitstream/11299/154950/1/GraduateSchool_1985_Fall.pdf","umnInterview":"https://cse.umn.edu/cems/news/sustaining-culture-excellence-samson-jenekhe-endows-chair-cems","umnWell":"https://experts.umn.edu/en/publications/synthesis-and-characterization-of-model-urethane-compounds/","wellPaper":"https://electronicsandbooks.com/edt/manual/Magazine/M/Macromolecules/1985%20%28Vol%2018%29/No03%28311-592%29/553.pdf","uw":"https://www.cheme.washington.edu/facultyfinder/samson-a-jenekhe","duke":"https://academiccouncil.duke.edu/sites/default/files/Duke_University_Program_in_MSE_Proposal_REVISED.pdf","fellow":"https://socfell.fas.harvard.edu/1980-1989","aps":"https://journals.aps.org/prb/abstract/10.1103/PhysRevB.39.10519","socolar":"https://dmi.duke.edu/people/faculty/joshua-socolar","srajer":"https://www.aps.anl.gov/APS-News/2017/george-srajer-and-jin-wang-elected-fellows-of-the-american-physical-society","sara":"https://dmi.duke.edu/people/faculty/sara-haravifard","delaire":"https://fitzpatrick.duke.edu/faculty/olivier-delaire","caltech":"https://thesis.caltech.edu/2113/","anna":"https://ptacts.uspto.gov/ptacts/public-informations/petitions/1463862/download-documents?artifactId=n9nLiZgOx8zKxqaS8xexD6YRK-dlIg2q2_i3G8KJq0Pn9YwxO-CDQOw"};
const link=(label,url)=>web(label,url)+'。';
const page=n=>src.duke+'#page='+n;
const old=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,ev,urls)=>[old(id,k).status,old(id,k).note+' '+ev,urls];
const ref=(name,label)=>'[['+name+'|'+label+']]';
const student=id=>ref(local(id),records.get(id).name);
const setBoundary=(id,proof)=>editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+proof);
function addForward(id,lines){
 editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),l=>lines.map(v=>'- '+v).join('\n')+'\n'+l);
}
function appendIndex(id,anchor,lines){
 editLine(idx,l=>l.startsWith('- '+student(id)+' → ')&&l.includes(anchor),l=>l+'\n'+lines.map(v=>'- '+student(id)+' → '+v).join('\n'));
}
function addInverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：'+student(id)+'。'+proof);
}
function ext(id,target,name,bio,label,proof){
 if(fs.existsSync(fn(target)))throw Error('已有导师节点 '+target);
 graph.set(fn(target),'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n\n- '+label+'：'+student(id)+'。'+proof+'\n');
}
function upgrade(id,target,name,from,to,revFrom,revTo,proof){
 const tag=ref(target,name);
 editLine(fn(local(id)),l=>l.startsWith('- '+from+'：')&&l.includes('[['+target+'|'),()=>'- '+to+'：'+tag+'。'+proof);
 editLine(fn(target),l=>l.startsWith('- '+revFrom+'：')&&l.includes('[['+local(id)+'|'),()=>'- '+revTo+'：'+student(id)+'。'+proof);
 editLine(idx,l=>l.startsWith('- '+student(id)+' → '+from+'：')&&l.includes('[['+target+'|'),()=>'- '+student(id)+' → '+to+'：'+tag+'。'+proof);
}
const w='0e293ed5';
const ec='师承人物 - Enrico Clementi', kw='师承人物 - Kenneth B. Wiberg';
const wp1='CUHK 化学系讲者履历在 1989 年 IBM Kingston 博士后条目具名列 Enrico Clementi。NUS 研究生院独立确认同年同机构。按博后阶段研究师长，正式聘任称谓待核。';
const wp2='CUHK 化学系讲者履历在 1990–1991 年 Yale 博士后条目具名列 Kenneth B. Wiberg。NUS 研究生院独立确认同期 Yale 博后。按博后阶段研究师长，正式聘任称谓待核。';
const wSources=link('CUHK 化学系讲者履历',src.cuhk)+' '+link('NUS 研究生院',src.nus);
const w1=wp1+' '+wSources,w2=wp2+' '+wSources;
const wLines=['博士后阶段研究师长：'+ref(ec,'Enrico Clementi')+'。'+w1,'博士后阶段研究师长：'+ref(kw,'Kenneth B. Wiberg')+'。'+w2];
setBoundary(w,'NUS 研究生院和 CUHK 履历均列 ANU 博士由 Leo Radom 指导，年份为 1988，NUS 联合实验室列 1989。保留授位年份差异，继续查 ANU 原档。两段博后指导者已分列。'+wSources+' '+link('NUS 联合实验室',src.amat));
addForward(w,wLines);appendIndex(w,'博士导师：',wLines);
ext(w,ec,'Enrico Clementi','IBM 量子化学与科学计算研究者，1979–1991 年在 IBM 任职，地点包括 Kingston。'+link('IAQMS 纪念原档',src.clementi),'博士后阶段研究者',w1);
ext(w,kw,'Kenneth B. Wiberg','Yale 化学系物理有机化学教授，研究结构、构象与理论计算。'+link('Yale 化学系原档',src.wiberg),'博士后阶段研究者',w2);
changeRow(w,null,'Enrico Clementi（IBM Kingston，1989）；Kenneth B. Wiberg（Yale，1990–1991）。均为博士后阶段研究师长',wSources);
const aw=audit(w,{
 phd:keep(w,'phd','CUHK 原档独立列 Radom，ANU 年份待授位原件。',[src.cuhk,src.nus]),
 postdoc:['group_or_candidate',wp1+' '+wp2,[src.cuhk,src.nus,src.clementi,src.wiberg]],
 affiliation:keep(w,'affiliation','NUS 研究生院核化学系和计算化学。',[src.nus]),
 research:keep(w,'research','CUHK 履历核理论与计算化学及卤键催化研究。',[src.cuhk,src.nus])
},'追 ANU 授位原档和 IBM、Yale 博后聘任或个人简历的正式指导称谓。');
relation(w,'postdoc',ec,'stage_mentor',wp1,[src.cuhk,src.nus,src.clementi],aw,false);
relation(w,'postdoc',kw,'stage_mentor',wp2,[src.cuhk,src.nus,src.wiberg],aw,false);

const j='0e2784e4',tw='师承人物 - S. T. Wellinghoff',mt='人员 - University of Minnesota - Matthew Tirrell - c98a37f7';
const jd='Minnesota 1985 年毕业名录明确列 Samson Ally Jenekhe 的化工博士论文 Studies in Polymers for Microelectronics，以及 M. V. Tirrell 和 S. T. Wellinghoff 两位 Major Advisers。';
const jw='Minnesota 同时期聚合物原论文首页列 Stephen T. Wellinghoff 全名及同一化工与材料系，支持全名对应。授位名录仅写首字母，保留节点及全名核对注记。';
const jp='UW 履历把 1984–1987 记为 Honeywell Principal Research Scientist。Minnesota 本人访谈另分博士期间实习及 1985 博士完成时获全职聘任。保留两份时间口径，独立博士后仍未见记录。';
const jdProof=jd+' '+link('Minnesota 毕业名录',src.umn);
const jwProof=jw+' '+link('Minnesota 书目',src.umnWell)+' '+link('同期论文原件可读副本',src.wellPaper);
const jpProof=jp+' '+link('UW 教师原档',src.uw)+' '+link('Minnesota 本人访谈',src.umnInterview);
editLine(fn(local(j)),l=>l.startsWith('- 博士共同导师：')&&l.includes(tw),l=>l.replace('全名身份待进一步核实。','姓名全称有同校同期证据，学位原件署名待核。')+' '+jdProof+' '+jwProof);
mentorLine(tw,j,'- 博士生：',jdProof+' '+jwProof);
mentorLine(mt,j,'- 博士生：',jdProof);
indexLine(j,tw,'博士共同导师',jdProof+' '+jwProof);
setBoundary(j,jpProof);
changeRow(j,'Matthew V. Tirrell、S. T. Wellinghoff（共同导师）','Honeywell 实习后获全职聘任；独立博士后未见记录',jdProof+' '+jwProof+' '+jpProof);
const aj=audit(j,{
 phd:['confirmed_advisor',jd+' '+jw,[src.umn,src.umnWell,src.wellPaper]],
 postdoc:['no_postdoc_documented',jp,[src.uw,src.umnInterview]],
 affiliation:keep(j,'affiliation','UW 院档核化工与化学教职。',[src.uw]),
 research:keep(j,'research','UW 组介绍核有机半导体、聚合物薄膜、输运及光物理。',[src.uw])
},'按题名追 Minnesota 馆藏签署原件，核 Wellinghoff 全名和是否有独立博士后任用。');
relation(j,'phd',mt,'advisor',jd,[src.umn,src.umnInterview],aj,false);
relation(j,'phd',tw,'advisor',jd+' '+jw,[src.umn,src.umnWell,src.wellPaper],aj,false);

const so='ef5eb10a', ps='人员 - Princeton - Paul J. Steinhardt - c9ac030a', dn='人员 - Harvard - David R. Nelson - 4c312119';
const soPh='Duke 所载 Socolar 本人履历的 Graduate and post-doctoral advisors 栏明确列博士阶段 Paul Steinhardt，另列 1987 UPenn 博士论文 Quasilattices and Quasicrystals。Tom C. Lubensky 保留原博士阶段研究师长记录。';
const soPd='同一份本人履历明确列 Harvard 物理系 David Nelson 为 Post-doctoral Advisor。Harvard Society 原档核 1987–1990 Junior Fellow，1989 原论文核 Harvard 物理系。';
const soPhProof=soPh+' '+link('Duke 本人履历博士条目',page(48))+' '+link('Duke 本人履历导师条目',page(49));
const soPdProof=soPd+' '+link('Duke 本人履历',page(49))+' '+link('Harvard Society 原档',src.fellow)+' '+link('1989 论文原页',src.aps);
upgrade(so,ps,'Paul J. Steinhardt','博士阶段研究师长','博士导师','博士阶段研究者','博士生',soPhProof);
setBoundary(so,soPhProof+' '+soPdProof+' 继续查宾大论文签署页与 Lubensky 的具体角色。');
const soLine='博士后导师：'+ref(dn,'David R. Nelson')+'。'+soPdProof;
addForward(so,[soLine]);appendIndex(so,'博士导师：',[soLine]);addInverse(so,dn,'博士后研究者',soPdProof);
changeRow(so,'Paul J. Steinhardt（明确博士导师）；Tom C. Lubensky（博士阶段研究师长）','David R. Nelson（Harvard Junior Fellow，1987–1990，明确博士后导师）',soPhProof+' '+soPdProof);
const aso=audit(so,{
 phd:['confirmed_advisor',soPh,[page(48),page(49)]],
 postdoc:['confirmed_advisor',soPd,[page(49),src.fellow,src.aps]],
 affiliation:keep(so,'affiliation','Duke 材料院档核物理系教授。',[src.socolar]),
 research:keep(so,'research','Duke 现页与 Harvard 时期论文核准晶与凝聚态理论，Duke 另列力学及颗粒研究。',[src.socolar,src.aps])
},'追宾大博士论文签署原件，并单独查 Lubensky 博士阶段研究指导的正式角色。');
relation(so,'phd',ps,'advisor',soPh,[page(48),page(49)],aso,false);
relation(so,'postdoc',dn,'advisor',soPd,[page(49),src.fellow,src.aps],aso,false);

const sh='6b410502', tr='人员 - Caltech - Tom Rosenbaum - c6ba8979', gs='师承人物 - George Srajer';
const shPh='Haravifard 本人项目履历明确列 Bruce D. Gaulin 为 M.Sc. & Ph.D. Advisor，与 McMaster 原毕业登记一致。';
const shPd='Haravifard 本人履历分列 Thomas Rosenbaum、George Srajer 为 Post-Doc Advisor，并列 2010–2013 University of Chicago 和 Argonne 博后，以及随后 2013–2015 Assistant Physicist 职务。';
const shProof=shPd+' '+link('Duke 本人履历导师栏',page(39))+' '+link('Duke 本人履历任用栏',page(37));
const trProof=shProof+' '+link('Rosenbaum 组校友档','https://cryo.caltech.edu/people/group-alumni');
const gsProof=shProof+' '+link('Argonne APS 机构原档',src.srajer);
upgrade(sh,tr,'Tom Rosenbaum','博士后课题组负责人','博士后导师','博士后课题组成员','博士后研究者',trProof);
const shLine='博士后导师：'+ref(gs,'George Srajer')+'。'+gsProof;
setBoundary(sh,shPh+' '+link('Duke 本人履历导师栏',page(39))+' '+shProof);
addForward(sh,[shLine]);appendIndex(sh,'[['+tr+'|',[shLine]);
ext(sh,gs,'George Srajer','Argonne Advanced Photon Source 研究人员，研究同步辐射探测磁性与强关联材料。'+link('Argonne APS 机构原档',src.srajer),'博士后研究者',gsProof);
changeRow(sh,'Bruce D. Gaulin（博士导师）','Tom Rosenbaum、George Srajer（2010–2013 Chicago 与 Argonne 博后导师）',shProof+' '+link('Argonne APS 机构原档',src.srajer));
const ash=audit(sh,{
 phd:['confirmed_advisor',shPh,[page(39),'https://physics.mcmaster.ca/graduate-studies/recent-graduates/']],
 postdoc:['confirmed_advisor',shPd,[page(37),page(39),src.srajer,'https://cryo.caltech.edu/people/group-alumni']],
 affiliation:keep(sh,'affiliation','Duke 材料院档核物理任职。',[src.sara]),
 research:keep(sh,'research','Duke 材料院档核量子磁性与散射方向。',[src.sara])
},'正式导师姓名与时间均有本人履历，后续核对 Chicago 与 Argonne 并行任用的项目和资助细节。');
relation(sh,'postdoc',tr,'advisor',shPd,[page(37),page(39),'https://cryo.caltech.edu/people/group-alumni'],ash,false);
relation(sh,'postdoc',gs,'advisor',shPd,[page(37),page(39),src.srajer],ash,false);

const d='238f61bf',bf='人员 - Caltech - Brent Fultz - b1838c23';
const dPd='Delaire 本人履历将 2006–2007 Caltech 博后和 2007–2008 Research Staff 分列，并明确列 Brent T. Fultz 为唯一 Postdoctoral Sponsor。登记博士后阶段研究师长并标资助／接收角色，正式 advisor 字段待核。ORNL Shull 阶段 Stephen E. Nagler 的指导保留。';
const dProof=dPd+' '+link('Duke 本人履历任用栏',page(30))+' '+link('Duke 本人履历 Sponsor 栏',page(31));
const dPh='Caltech 学位馆藏明确列 Brent T. Fultz 为 2006 材料博士 Advisor。Duke 履历另把 Arthur T. Motta 列研究生导师，未在该栏区分学位阶段。其 Penn State 硕士经历单列。';
upgrade(d,bf,'Brent Fultz','博士后导师候选','博士后阶段研究师长','博士后候选研究者','博士后阶段研究者',dProof);
setBoundary(d,dPh+' '+link('Caltech 论文馆藏',src.caltech)+' '+dProof);
changeRow(d,null,'Brent Fultz（Caltech 2006–2007 博后 Sponsor）；Stephen E. Nagler（ORNL Shull 博后阶段研究师长）',dProof);
const ad=audit(d,{
 phd:keep(d,'phd',dPh,[src.caltech,page(30),page(31)]),
 postdoc:['group_or_candidate',dPd,[page(30),page(31),'https://www.ornl.gov/sites/default/files/2021-05/SN_profile_CV_May_2021.pdf']],
 affiliation:keep(d,'affiliation','Duke Fitzpatrick 原档复核现任教职。',[src.delaire]),
 research:keep(d,'research','Duke 原档复核中子散射、声子和热输运。',[src.delaire])
},'Caltech 博后 Sponsor 已具名，继续核岗位 advisor 字段以及 ORNL Shull fellowship 的正式指导称谓。');
relation(d,'postdoc',bf,'stage_mentor',dPd,[page(30),page(31)],ad,false);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Duke与NUS导师分阶段';
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

