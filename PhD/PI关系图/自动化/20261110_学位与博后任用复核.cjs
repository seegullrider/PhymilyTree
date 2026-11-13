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
 a.audit_id='20261110_'+id+'_training_positions_1501';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_training_positions_1501_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const src={"ecs":"https://www.electrochem.org/dl/interface/wtr/wtr06/wtr06_p23-27.pdf","duke":"https://academiccouncil.duke.edu/sites/default/files/Duke_University_Program_in_MSE_Proposal_REVISED.pdf","cho":"https://www.choise-efrc.org/scientists/curricula-vitae","therien":"https://medschool.duke.edu/profile/michael-j-therien","raf":"https://www.stonybrook.edu/matsci-chemeng/faculty/miriam_rafailovich.html","rafGrad":"https://www.stonybrook.edu/bulletin-archives/all/_pdfs/grad_bulletin_spring2020.pdf","zaus":"https://pratt.duke.edu/people/stefan-zauscher/","zausCv":"https://zauscherlab.pratt.duke.edu/sites/zauscherlab.pratt.duke.edu/files/2024/Vitae_SZ_September_2024_w_research.pdf","zausFpl":"https://www.fpl.fs.usda.gov/documnts/pdf1999/scott99b.pdf","klin":"https://klingenberg.che.wisc.edu/group/images/main_body.pdf","liuD":"https://scholars.duke.edu/person/j.liu","liuK":"https://chemistry.kfupm.edu.sa/people/faculty/dr-jie-liu/","liuR":"https://blogs.rsc.org/nr/2012/02/21/interview-with-co-editor-in-chief-of-nanoscale-jie-liu/","rampi":"https://www.mse.gatech.edu/people/rampi-ramprasad","rampiPaper":"https://ramprasad.mse.gatech.edu/wp-content/uploads/2018/03/8.pdf"};
const link=(label,url)=>web(label,url)+'。';
const page=n=>src.duke+'#page='+n;
const old=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,ev,urls)=>[old(id,k).status,old(id,k).note+' '+ev,urls];
const write=(id,ph,pd,proof)=>{note(id,'- 核查边界：',proof);changeRow(id,ph,pd,proof);};
const student=id=>'[['+local(id)+'|'+records.get(id).name+']]';
const st='c4061620', pb='人员 - University of Michigan, Ann Arbor - Pallab Bhattacharya — 荣休 - 8f264b17';
const stEv='Stiff-Roberts 本人合著文章的作者履历明确称其 2004 年 Michigan 博士学位在 Pallab Bhattacharya 指导下取得，表述指向学位本身。Duke 本人履历独立核 2004 应用物理博士和同年 8 月加入 Duke。按明确博士导师记录，论文签署页待补。';
const stProof=stEv+' '+link('本人合著文章作者简介',src.ecs)+' '+link('Duke 项目本人履历',page(50));
replaceNoteLabel(st,'博士阶段研究导师','博士导师',pb,' '+stProof);
replaceInverseLabel(pb,st,'博士阶段研究生','博士生',' '+stProof);
replaceIndexLabel(st,pb,'博士阶段研究导师','博士导师',' '+stProof);
write(st,'Pallab Bhattacharya（明确博士导师，签署页待核）','2004 年 8 月加入 Duke；独立博士后未见记录',stProof);
const ast=audit(st,{phd:['confirmed_advisor',stEv,[src.ecs,page(50)]],postdoc:keep(st,'postdoc','Duke 本人履历明确助理教授起始为 2004 年 8 月。',[page(50),src.cho])},'追 Michigan 学位签署页及博士到 Duke 入职之间的任用原档。Michigan 新闻两个入口本轮均 403。');
relation(st,'phd',pb,'advisor',stEv,[src.ecs,page(50)],ast,false);

const th='fc878b29',tr='师承人物 - William C. Trogler',gr='师承人物 - Harry B. Gray';
const thPh='Duke 所载 Therien 本人履历明确列 UC San Diego 1987 化学博士和 Graduate Advisor William C. Trogler。';
const thPd='同一份本人履历把 Caltech NIH Postdoctoral Fellow 列为 1987–1990，导师栏称 Harry B. Gray 为 Postdoctoral Sponsor。按资助及接收导师记录，保留阶段研究师长类型。';
const thPhProof=thPh+' '+link('Duke 本人履历导师栏',page(53));
const thPdProof=thPd+' '+link('Duke 本人履历任用栏',page(52))+' '+link('Duke 本人履历导师栏',page(53));
note(th,'- 博士导师：',thPhProof);mentorLine(tr,th,'- 博士生：',thPhProof);indexLine(th,tr,'博士导师',thPhProof);
note(th,'- 博士后阶段研究师长：',thPdProof);mentorLine(gr,th,'- 博士后研究者：',thPdProof);indexLine(th,gr,'博士后阶段研究师长',thPdProof);
write(th,'William C. Trogler（明确博士导师）','Harry B. Gray（1987–1990 Caltech NIH 博后 Sponsor、阶段研究师长）',thPhProof+' '+thPdProof);
const ath=audit(th,{phd:['confirmed_advisor',thPh,[page(52),page(53)]],postdoc:['group_or_candidate',thPd,[page(52),page(53)]],affiliation:keep(th,'affiliation','Duke 医学院档复核化学系与 Duke Cancer Institute 关联。',[src.therien])},'追 UC San Diego 学位论文签署页，Caltech 博后独立任用记录的正式 Advisor 称谓待查。');
relation(th,'phd',tr,'advisor',thPh,[page(52),page(53)],ath,false);
relation(th,'postdoc',gr,'stage_mentor',thPd,[page(52),page(53)],ath,false);

const ra='0ec6a2c0',ai='https://ai.stonybrook.edu/people/faculty/miriam-rafailovich';
const raPh='材料科学与化工院档列 SUNY Stony Brook 核物理博士 1981，2020 研究生院年鉴两处均列 1980。保留两种年份，博士导师待学位原档。';
const raPd='院档称 BNL 和 Weizmann 均有博士后阶段，并把岗位分为 1982–1984 BNL Visiting Assistant Physicist、1984–1985 Weizmann Research Associate、1985–1988 Weizmann Senior Scientist。1980–1982 Stony Brook Research Associate 与博士年份相邻或重叠。按档案分记岗位及时间，各段指导人待核。';
const raProof=raPh+' '+raPd+' '+link('Stony Brook 院系履历',src.raf)+' '+link('Stony Brook 研究生院年鉴',src.rafGrad)+' '+link('AI Innovation Institute 原档',ai);
editLine(fn(local(ra)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+raProof);
changeRow(ra,'Stony Brook 核物理博士（1980／1981，导师待核）','1982–1984 Brookhaven、1984–1985 Weizmann；个人导师待核，1985–1988 Senior Scientist 单列',raProof);
audit(ra,{
 phd:['unresolved',raPh,[src.raf,src.rafGrad]],postdoc:['unresolved',raPd,[src.raf,ai]],
 affiliation:keep(ra,'affiliation','两份 Stony Brook 原档核材料科学与化学工程杰出教授。',[src.raf,ai]),
 research:keep(ra,'research','院档核高分子纳米复合、聚合物界面与薄膜。',[src.raf])
},'按 1980 和 1981 两个年份查 Stony Brook 学位论文或授位名单，按岗位时间窗口追 BNL 和 Weizmann 原任用及个人指导。');

const za='f5ba3a09', dk='师承人物 - Daniel J. Klingenberg';
const zaPh='Duke Pratt 档列 Wisconsin 博士 1999，本人 2024 CV 列 2000。同期 USDA 原稿在 Wisconsin 名下列 Zauscher 为 Research Associate、Klingenberg 为 Associate Professor，同组博士论文致谢证曾同组。确切博士阶段组属和正式导师继续待学位原件。';
const zaPd='USDA 1999 会议稿所列 Wisconsin Research Associate 单独记岗位线索。本人 CV 列 Duke 助理教授自 2000-09 起，岗位是否为独立博士后及任期仍待核。';
const zaProof=zaPh+' '+zaPd+' '+link('Duke Pratt 院档',src.zaus)+' '+link('本人 CV',src.zausCv)+' '+link('USDA 同期论文原稿',src.zausFpl);
mentorLine(dk,za,'- 博士阶段课题组成员候选：',zaProof);
indexLine(za,dk,'博士阶段课题组负责人候选',zaProof);
write(za,'Daniel J. Klingenberg（博士阶段课题组负责人候选）；博士年份 1999／2000 待核','Wisconsin Research Associate（1999 会议署名）；独立博后待核',zaProof);
const aza=audit(za,{phd:keep(za,'phd',zaPh,[src.zaus,src.zausCv,src.zausFpl,src.klin]),postdoc:keep(za,'postdoc',zaPd,[src.zausCv,src.zausFpl]),affiliation:keep(za,'affiliation','Duke Pratt 原档复核 MEMS 教职。',[src.zaus])},'按两种年份和已知题名查 Wisconsin 论文签署页，并查 Research Associate 任命文件的阶段及指导字段。');
relation(za,'phd',dk,'candidate',zaPh,[src.zausCv,src.zausFpl,src.klin],aza,false);

const li='d47b1b1b',sm='师承人物 - Richard E. Smalley';
const liEv='Jie Liu 在 RSC 本人访谈中说明由 Richard E. Smalley 接收，在其实验室做了三年博士后。Duke 本人履历列 1996 Harvard 化学博士、1999 Welch 博后 fellowship 与 1999 Duke 助理教授。按课题组负责人记录，个人正式 advisor 称谓继续待核。';
const liAff='Duke Scholars 仍列化学和 MEMS 任职，KFUPM 本人机构页另列 Chemical Engineering Chair Professor。两份现行院档并存，具体联合聘任安排待查。';
const liProof=liEv+' '+link('RSC 本人访谈',src.liuR)+' '+link('Duke 本人履历',page(40));
const liAffProof=liAff+' '+link('Duke Scholars',src.liuD)+' '+link('KFUPM 教师原档',src.liuK);
note(li,'- 博士后课题组负责人：',liProof);
mentorLine(sm,li,'- 博士后研究者：',liProof);indexLine(li,sm,'博士后课题组负责人',liProof);
write(li,null,'Richard E. Smalley（三年博后课题组，正式 Advisor 待核）',liProof+' '+liAffProof);
const ali=audit(li,{
 postdoc:['group_or_candidate',liEv,[src.liuR,page(40)]],
 affiliation:keep(li,'affiliation',liAff,[src.liuD,src.liuK]),
 research:keep(li,'research','KFUPM 原档核等离激元催化、光催化与能源材料。',[src.liuK])
},'追 Harvard 学位原档和 Welch fellowship 项目导师字段，并核两校现行聘任类型。');
relation(li,'postdoc',sm,'group_leader',liEv,[src.liuR,page(40)],ali,false);

const ram1='9b16d068',ram2='0e7bcd7f',ja='师承人物 - James B. Adams';
const siegel='https://public.websites.umich.edu/~djsiege/Energy_Storage_Lab/Publications_files/dissertation_DJ-Siegel.pdf';
const ramEv='本人组保存的同期原论文首页列 Illinois 材料系 R. Ramprasad 和 ASU J. B. Adams，1997 年收稿，研究主题与论文候选题名相符。保留既有 Siegel 论文中的组属线索和 Adams 博士导师候选，正式导师待学位原档。';
const ramProof=ramEv+' '+link('Ramprasad 组存同期论文',src.rampiPaper);
const ramAff='Georgia Tech 材料系原档确认 UConn 教职自 2004 年秋开始，2018 年 2 月转 Georgia Tech，之前在 Motorola 研发。独立博后经历仍待查。';
const ramAffProof=ramAff+' '+link('Georgia Tech 材料系原档',src.rampi);
note(ram1,'- 博士导师候选：',ramProof);mentorLine(ja,ram1,'- 博士生候选：',ramProof);indexLine(ram1,ja,'博士导师候选',ramProof);
const candidate='博士导师候选：[['+ja+'|James B. Adams]]。'+ramProof;
editLine(fn(local(ram2)),l=>l.startsWith('- 核查边界：'),l=>'- '+candidate+'\n'+l);
editLine(fn(ja),l=>l.startsWith('- 博士生候选：')&&l.includes('[['+local(ram1)+'|'),l=>l+'\n- 博士生候选：'+student(ram2)+'。'+ramProof);
editLine(idx,l=>l.startsWith('- '+student(ram1)+' → 博士导师候选：'),l=>l+'\n- '+student(ram2)+' → '+candidate);
for(const id of [ram1,ram2]){
 write(id,'James B. Adams（博士导师候选）','Motorola 研发岗位；独立博士后待核',ramProof+' '+ramAffProof);
 const aram=audit(id,{phd:keep(id,'phd',ramEv,[src.rampiPaper,siegel]),postdoc:keep(id,'postdoc',ramAff,[src.rampi]),affiliation:keep(id,'affiliation',ramAff,[src.rampi])},'继续按全名和题名追 Illinois 学位论文原件，核 Motorola 初期任用及独立博士后情况。');
 relation(id,'phd',ja,'candidate',ramEv,[src.rampiPaper,siegel],aram,false);
}
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_学位与博后任用复核';
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

