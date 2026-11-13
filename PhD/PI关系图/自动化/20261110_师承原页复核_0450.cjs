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
 a.audit_id='20261110_'+id+'_doctoral_and_postdoctoral_sources';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_stage_sources_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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
const capa='e762b00c', de='师承人物 - Francesco De Martini';
const capaInterview='https://seas.harvard.edu/news/federico-capasso-terahertz-pioneer';
const capaCV='https://capasso.seas.harvard.edu/sites/g/files/omnuum6306/files/capasso/files/fcbio2021.pdf';
const capaLaw='https://www.dmf.unisalento.it/vecchio_dottorato/Normative/382.html';
const oldDegree='https://miur.mur.gov.it/studiare-in-italia/study/old-degrees.html';
const capaDegree='Harvard SEAS 访谈明确 De Martini 指导其罗马大学学位论文。本人 CV 写 1973 Doctor of Physics；Balzan 讲稿使用 PhD，但 1980 年法令第 68 条才设立 Dottorato di Ricerca。保留具名学位论文指导及不同措辞，待 Sapienza 原件确认意大利文资格名称。';
const capaPost='本人 CV 分列 Fondazione Bordoni 1973–1974 Postdoctoral Fellow、1974–1976 Research Physicist、1976–1977 Bell Labs Visiting Scientist；Bordoni 博后指导者未具名。';
audit(capa,{phd:['unresolved',capaDegree,[capaInterview,capaCV,capaLaw,oldDegree]],postdoc:['unresolved',capaPost,[capaCV,capaInterview]]},'查 Sapienza 1973 授位原件和 Bordoni 1973–1974 年博后个人指导。');
const capaEvidence=' '+web('Harvard SEAS 访谈',capaInterview)+'明确写其在罗马跟随 De Martini 做学位论文。';
replaceNoteLabel(capa,'博士导师','学位论文指导',de,capaEvidence);
replaceInverseLabel(de,capa,'博士生','学位论文受指导者',capaEvidence);
replaceIndexLabel(capa,de,'博士导师','学位论文指导',capaEvidence);
editLine(fn(local(capa)),l=>l.startsWith('- 核查边界：'),()=>'- 学位称谓：'+capaDegree+' '+web('1980 年法令第 68 条',capaLaw)+' · '+web('意大利教育部旧制说明',oldDegree)+'\n- 博士后阶段：'+capaPost+' '+web('本人 CV',capaCV));
changeRow(capa,'Francesco De Martini（1973 年罗马学位论文指导；保留历史学位原称 Doctor of Physics）','Fondazione Bordoni 1973–1974 博后；指导者待核',web('SEAS 访谈',capaInterview)+' · '+web('本人 CV',capaCV));

const kax='186f1527', jo=local('cbedf46d');
const baz='https://web.mit.edu/bazant/www/info/';
const cup='https://assets.cambridge.org/97805211/17111/frontmatter/9780521117111_frontmatter.pdf';
const ibm='https://public.dhe.ibm.com/software/ch/fr/pdf/curriculum-vitae-professeur-efthimios-kaxiras.pdf';
const kaxPhd='Bazant 本人 MIT 主页在 Lineage of PhD Advisors 项下连续列 Joannopoulos（Berkeley 1974）及 Kaxiras（MIT 1987）；Kaxiras 本人在合著教材前言另列 Joannopoulos 为自己的师长。博士导师按具名谱系登记，学位原件仍待查。';
const ka=audit(kax,{phd:['confirmed_advisor',kaxPhd,[baz,cup]],postdoc:['unresolved','IBM 简介与 Harvard CIQM 本人履历一致，证实 1987–1989 IBM T. J. Watson 博后，NRL 顾问后续单列；个人导师未具名。',[ibm]]},'MIT 主机退避到期后查原档并追查 IBM 博后个人指导。');
const kaxText=web('本人教材前言',cup)+'将 Joannopoulos 列为师长，'+web('Bazant 本人 MIT 谱系',baz)+'在博士导师链列两人相邻。MIT 博士学位原件待核。';
note(kax,'- 博士导师：',kaxText);
mentorLine(jo,kax,'- 博士生：',kaxText);
indexLine(kax,jo,'博士导师',kaxText);
row(kax,web('本人教材前言',cup)+' · '+web('IBM 机构履历',ibm));
relation(kax,'phd',jo,'advisor',kaxPhd,[baz,cup],ka,false);

const holm='师承人物 - Richard H. Holm';
const longCV='https://www.chemistry.harvard.edu/sites/g/files/omnuum7776/files/2026-07/Jeffrey%20R.%20Long%20CV%202026.pdf';
const longHarvard='https://www.chemistry.harvard.edu/people/jeffrey-long';
for(const id of ['ef4fbef8','dcbb0150']){
 const lPhd='授位学校 Harvard 化学系明确称其 1995 化学博士学位在 Richard H. Holm 指导下获得，本人 CV 将 Holm 写在博士条目中，并把之后两段博后分列。学位论文签署页待查。';
 const la=audit(id,{phd:['confirmed_advisor',lPhd,[longHarvard,longCV]]},'继续找 Harvard 1995 学位签署及 Holm 和 Alivisatos 两段博后的正式指导职衔；两校同人记录同步。');
 const txt=web('Harvard 化学系履历',longHarvard)+'把 Holm 的指导明确附在 1995 化学博士学位，CV 另列博后。';
 note(id,'- 博士导师：',txt);
 mentorLine(holm,id,'- 博士生：',txt);
 indexLine(id,holm,'博士导师',txt);
 row(id,web('Harvard 化学系履历',longHarvard));
 relation(id,'phd',holm,'advisor',lPhd,[longHarvard,longCV],la,id==='dcbb0150');
}
const aiz='9ea77333', add='师承人物 - Lia Addadi', wein='师承人物 - Steve Weiner', white='师承人物 - George M. Whitesides';
const wiz='https://wis-wander.weizmann.ac.il/content/learning-nature';
const aizLab='https://aizenberglab.seas.harvard.edu/people/joanna-aizenberg';
const aizPhd='Weizmann 机构专题明确称 Aizenberg 是 Addadi 和 Weiner 当时的研究生，描述三人研究；本人 Harvard CV 列 1996 Weizmann 结构生物学博士。两条历史导师记录保留；机构专题未单列论文共同签署。';
audit(aiz,{phd:['confirmed_advisor',aizPhd,[wiz,aizLab]],postdoc:['group_or_candidate','本人组页明确 1996–1998 Harvard 博后与 George Whitesides 共事，之后转 Bell Labs Member of Technical Staff。按博后阶段研究师长，正式职衔待核。',[aizLab]]},'查 Weizmann 共同导师签署字段及 Harvard 博后正式指导职衔。');
const wizLink=web('Weizmann 官方专题',wiz)+'直接称 Aizenberg 是 Addadi 和 Weiner 当时的研究生，论文签署字段待核。';
for(const m of [add,wein]){
 editLine(fn(local(aiz)),l=>l.startsWith('- 博士导师：')&&l.includes('[['+m+'|'),l=>l+' '+wizLink);
 mentorLine(m,aiz,'- 博士生：',wizLink);
 indexLine(aiz,m,'博士导师',wizLink);
}
replaceNoteLabel(aiz,'博士后阶段研究关联者','博士后阶段研究师长',white);
replaceInverseLabel(white,aiz,'博士后阶段研究关联者','博士后阶段研究者');
replaceIndexLabel(aiz,white,'博士后阶段研究关联者','博士后阶段研究师长');
row(aiz,web('Weizmann 官方专题',wiz));

const bai='94e4a4b0', zhu=local('a129f914'), therien=local('fc878b29');
const baiGroup='https://www.yusongbai.org/people';
const zhuAlum='https://xyzhugroup.com/thegroup/';
const therAlum='https://sites.duke.edu/therienlab/people-2/past-graduate-students-and-postdocs/';
const baiPost='Zhu 组校友名册明确列 Yusong Bai 2018–2022 博后；本人 Brown 组页确认 Columbia 博后任期。现版 CV 未写 advisor，保留既有 2023 CV 的历史导师记录。';
const ba=audit(bai,{phd:['confirmed_advisor','Therien 组混合校友表与本人 Brown 组页核实身份和 Duke 2011–2017 博士；Duke 博士生讲座明示指导，既有 2023 CV 的 advisor 记录保留，论文签署待查。',[therAlum,baiGroup]],postdoc:['group_or_candidate',baiPost,[baiGroup,zhuAlum]]},'按毕业名录确切题名继续追查博士签署，查另一个 2023 本人 CV 地址或具名博士后 advisor 原件。');
const baiLabel='- 博士后课题组负责人：[['+zhu+'|Xiaoyang Zhu]]。'+web('Zhu 组博士后名册',zhuAlum)+'明确列 2018–2022；'+web('本人 Brown 组页',baiGroup)+'核对岗位与任期。';
editLine(fn(local(bai)),l=>l.startsWith('- 博士后导师（既有历史记录）：'),l=>l+'\n'+baiLabel);
editLine(idx,l=>l.startsWith('- [['+local(bai)+'|')&&l.includes(' → 博士后导师（历史 CV 记录，职衔待复读）：'),l=>l+'\n- [['+local(bai)+'|Yusong Bai]] → '+baiLabel.slice(2));
mentorLine(zhu,bai,'- 博士后研究者：',web('本人 Brown 组页',baiGroup)+'确认该段任期。');
note(bai,'- 博士导师：',web('Therien 组校友名录',therAlum)+'复核本人身份与 Brown 去向。');
row(bai,web('本人 Brown 组页',baiGroup)+' · '+web('Therien 组校友名录',therAlum));
relation(bai,'postdoc',zhu,'group_leader',baiPost,[baiGroup,zhuAlum],ba);

const joshi='4bb026ae', king=local('339426d9');
const kingAlum='https://kinglab.uchicago.edu/alumni.html';
const joshiFac='https://www.stonybrook.edu/commcms/chemistry/people/faculty_profiles/Prakriti%20Joshi.php';
const joshiCol='https://news.columbia.edu/news/columbia-chemists-find-key-manufacturing-more-efficient-solar-cells';
const zhuHome='https://xyzhugroup.com/';
const jPhd='Columbia 校报明示 Prakriti P. Joshi 为 Xiaoyang Zhu 实验室博士生；Zhu 组公告在 2019-08-01 列其有关卤化物钙钛矿的博士答辩，未列论文导师签署。';
const jPost='Chicago King Lab 校友名册明确将 Prakriti Joshi 列为 2019–2024 Kadanoff Rice Postdoctoral Fellow，去向 Stony Brook，与该校化学系页一致。该名册支持组属，正式导师职衔待核。';
const ja=audit(joshi,{identity:['confirmed','Stony Brook 化学系个人页、King 组校友档与 Columbia 2019 博士答辩对应同一声子及超快显微研究者。',[joshiFac,kingAlum,zhuHome]],affiliation:['confirmed','Stony Brook 化学系列 Prakriti Joshi 为助理教授。',[joshiFac]],research:['confirmed','校方列声子动力学、时间分辨光电子显微、超快透射电子显微与量子材料。',[joshiFac]],phd:['group_or_candidate',jPhd,[joshiCol,zhuHome]],postdoc:['group_or_candidate',jPost,[kingAlum,zhuAlum]]},'按 Zhu 组公告题名查 Columbia 签署，另找 Kadanoff Rice fellowship 个人指导原档。');
const jText=web('King 组校友名册',kingAlum)+'明确列 2019–2024 Kadanoff Rice 博后 fellowship 与 Stony Brook 去向。';
note(joshi,'- 博士后课题组负责人：',jText);
mentorLine(king,joshi,'- 博士后课题组成员：',jText);
indexLine(joshi,king,'博士后课题组负责人',jText);
row(joshi,web('Stony Brook 化学系档案',joshiFac)+' · '+web('King 组校友档',kingAlum),'Sarah King（2019–2024 Chicago Kadanoff Rice 博士后课题组负责人）');
relation(joshi,'phd',zhu,'group_leader',jPhd,[joshiCol,zhuHome],ja);
relation(joshi,'postdoc',king,'group_leader',jPost,[kingAlum,joshiFac],ja);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0450';
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

