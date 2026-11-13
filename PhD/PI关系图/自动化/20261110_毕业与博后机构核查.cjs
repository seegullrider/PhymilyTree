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
 a.audit_id='20261110_'+id+'_degree_and_postdoc_hosts_1550';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_degree_and_postdoc_hosts_1550_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const src={
 hou:'https://houston.chem.cornell.edu/FormerGroup.htm', houDept:'https://chemistry.cornell.edu/paul-lyon-houston', ku:'https://can.ucsd.edu/people.php?selection=kummel',
 kuMat:'https://matsci.ucsd.edu/index.php/faculty/andrew-kummel', stan:'https://web.stanford.edu/group/swain/history/mosher/degrees.html',
 duke:'https://dmi.duke.edu/people/faculty/april-brown', brPaper:'https://link.springer.com/article/10.1007/BF02661228', brPaper2:'https://scholars.duke.edu/publication/685791',
 eas:'https://news.cornell.edu/stories/2013/08/emeritus-professor-lester-eastman-dies-85',
 korCV:'https://mseg.udel.edu/wp-content/uploads/2023/10/LaShandaKorley-CV_October_2023.pdf', korNY:'https://engineering.nyu.edu/faculty/lashanda-korley', wies:'https://wiesner.mse.cornell.edu/pubs.htm',
 y:'https://www.cmu.edu/chemistry/people/faculty/yaron.html', ypub:'https://www.chem.cmu.edu/groups/yaron/pub.html', sil:'https://web.mit.edu/robertsilbey/students/postdocs.html',
 dr:'https://catalog.asu.edu/sites/g/files/litvpz4586/files/2023-03/faculty_list_2015_2016_final.pdf', hans:'https://hansmalab.physics.ucsb.edu/allpaper.html',
 ang:'https://news.xjtu.edu.cn/info/1007/226172.htm'};
const link=(label,url)=>web(label,url);
const pick=(file,start,target,edit)=>editLine(file,l=>l.startsWith(start)&&l.includes('[['+target+'|'),edit);
const onward=(id,target,proof)=>pick(idx,'- [['+local(id)+'|',target,l=>l+' '+proof);
const forward=(id,label,target,proof)=>pick(fn(local(id)),'- '+label+'：',target,l=>l+' '+proof);
const back=(id,label,target,proof)=>pick(fn(target),'- '+label+'：',local(id),l=>l+' '+proof);
const at=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,newProof,urls)=>[at(id,k).status,at(id,k).note+' '+newProof,urls];
function insertBefore(file,prefix,line) { editLine(file,l=>l.startsWith(prefix),l=>line+'\n'+l); }
function schoolAff(id,prev,updated) {
 editLine(path.join(root,records.get(id).unit+'逐人复核记录.md'),l=>l.startsWith('| [['+local(id)+'|'),l=>{if(!l.includes(prev))throw Error('missing school cell '+id);return l.replace(prev,updated);});
}
const ku='7974de53', hou='师承人物 - Paul L. Houston', zr='师承人物 - Richard N. Zare';
const kup='Cornell Houston 组原档的 Former Postdoctoral and Senior Associates 名单列 Andrew Kummel 与 UC San Diego 化学系，UCSD 纳米科学中心教师履历独立确认 Cornell Postdoctoral Associate。记录 Houston 为博士后课题组负责人，具体聘期与正式指导称谓待查。';
const kul=link('Cornell Houston 组原档',src.hou)+' · '+link('UCSD 教师履历',src.ku);
const kp='Stanford 化学学位名录列 Andrew Clyde Kummel 与 Adviser Zare。';
const kpl=link('Stanford 化学学位名录',src.stan);
const area='已核实单位 - UC San Diego - 材料科学与工程项目';
const aff='UCSD 材料项目教师原档列 Kummel 的教师档，原档职称为化学与生物化学教授，材料项目单列为关联。';
const ka=link('UCSD 材料项目原档',src.kuMat);
const hRef='[['+hou+'|Paul L. Houston]]';
insertBefore(fn(local(ku)),'- 核查边界：','- 博士后课题组负责人：'+hRef+'。'+kup+' '+kul);
editLine(fn(local(ku)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+kp+' Zare 组所列 1982–1988 成员时间与授位年份须区分。 '+kpl+' '+kup+' '+kul);
forward(ku,'博士导师',zr,kp+' '+kpl);back(ku,'博士生',zr,kp+' '+kpl);
pick(idx,'- [['+local(ku)+'|',zr,l=>l+' '+kp+' '+kpl+'\n- [['+local(ku)+'|Andrew Kummel]] → 博士后课题组负责人：'+hRef+'。'+kup+' '+kul);
pick(fn(hou),'- 博士后阶段研究者','人员 - UC Irvine - Vartkess Ara Apkarian - 9cb6036d',l=>l+'\n- 博士后课题组成员：[['+local(ku)+'|Andrew Kummel]]。'+kup+' '+kul);
note(ku,'- 院系／机构：','[['+area+'|材料科学与工程项目关联]]。'+ka);
const af=path.join(root,'已核实院系',area+'.md');
editLine(af,l=>l.startsWith('- [[人员 - UC San Diego - Massimiliano Di Ventra '),l=>l+'\n- [['+local(ku)+'|Andrew Kummel]] — '+ka);
changeRow(ku,null,'Cornell 博后，Paul L. Houston（博士后课题组负责人）',kul+' · '+ka);
schoolAff(ku,'化学与生物化学系；','化学与生物化学系、材料科学与工程项目关联；');
const ak=audit(ku,{identity:['confirmed','Stanford 化学授位档、Cornell 组档和 UCSD 教师履历匹配 Andrew Clyde Kummel。',[src.stan,src.hou,src.ku]],affiliation:['confirmed',aff,[src.ku,src.kuMat]],research:['confirmed','UCSD 原档核微电子加工表面化学、原子层沉积及半导体表征。',[src.kuMat]],phd:['confirmed_advisor',kp,[src.stan]],postdoc:['group_or_candidate',kup,[src.hou,src.ku,src.houDept]]},'查 Cornell 组内博士后聘期与具名指导、Stanford 论文馆藏的学位日期。');
relation(ku,'postdoc',hou,'group_leader',kup,[src.hou,src.ku,src.houDept],ak,false);

const br='14983f8f', eas='师承人物 - Lester F. Eastman';
const bp='1985 年 Springer 论文原页把 Brown、Wicks、Eastman 同列 Cornell 电气工程。Duke 原档列 1985 Cornell 博士，Cornell 原档核 Eastman 同期为该系教授。结合谱系检索线索，列 Eastman 为低可信博士导师候选。论文署名只证明合作，论文题名与签署页仍需馆藏核对。';
const bd='Duke 材料档列 1986–1993 Hughes Research Laboratories 任职，另记 1988 年在 Army Research Office 物理部一年。该档未说明 Hughes 岗位为博后，独立博后经历及指导人待查。';
const bl=link('1985 论文原页',src.brPaper)+' · '+link('Cornell 院校原档',src.eas)+' · '+link('Duke 材料档',src.duke);
const el='[['+eas+'|Lester F. Eastman]]';
insertBefore(fn(local(br)),'- 核查边界：','- 博士导师候选：'+el+'。'+bp+' 关系类型可信度：低。 '+bl);
note(br,'- 核查边界：',bd+' '+link('Duke 材料档',src.duke));
note(br,'- 院系／机构：','Duke 材料研究计划的教师档核实 ECE 荣休教授。 '+link('Duke 材料档',src.duke));
if(fs.existsSync(fn(eas)))throw Error('Eastman node exists');
graph.set(fn(eas),'# Lester F. Eastman\n\nCornell 电气与计算机工程荣休教授，研究化合物半导体及高频器件。 '+link('Cornell 原档',src.eas)+'\n\n## 师承\n\n- 博士生候选：[['+local(br)+'|April S. Brown]]。'+bp+' '+bl+'\n');
const brownLink='- [['+local(br)+'|April Brown]] → 博士导师候选：'+el+'。'+bp+' '+bl;
editLine(idx,l=>l.startsWith('- [[人员 - Duke - Adrienne D. Stiff-Roberts ')&&l.includes('→ 博士导师：'),l=>l+'\n'+brownLink);
changeRow(br,'Lester F. Eastman（低可信博士导师候选）','Hughes 1986–1993；1988 Army Research Office；独立博后待核',bl);
schoolAff(br,'电气与计算机工程系；','电气与计算机工程系（荣休）；');
const ab=audit(br,{identity:['confirmed','Duke 材料原档列 April S. Brown、1985 Cornell 博士与 ECE 荣休。',[src.duke]],affiliation:['confirmed','Duke ECE 荣休教授，见材料研究计划教师档。',[src.duke]],research:['confirmed','Duke 教师书目及原论文支持半导体材料、分子束外延与异质结构。',[src.duke,src.brPaper]],phd:['group_or_candidate',bp,[src.brPaper,src.brPaper2,src.eas,src.duke]],postdoc:['unresolved',bd,[src.duke]]},'按索引线索 Factors Influencing the Growth of GaInAs by Molecular Beam Epitaxy 查 Cornell 1985 纸本或学位签署原档，同时查 Hughes 人事任用。');
relation(br,'phd',eas,'candidate',bp,[src.brPaper,src.brPaper2,src.eas,src.duke],ab,false);

const kor='adfc1f7e';
const kr='本人 CV 明确 MIT 化工 2005 Postdoctoral Associate、Cornell 2005–2007 Provost’s Academic Diversity Postdoctoral Fellow，指导人未列。Wiesner 组原书目把 Korley、Joo 与 Wiesner 同列 2010 年纳米纤维合著，发表晚于博后。把两位 Cornell 作者留作检索线索，继续追聘任与组属。';
const kl=link('本人 CV',src.korCV)+' · '+link('Cornell Wiesner 组原档',src.wies)+' · '+link('NYU Tandon 原档',src.korNY);
note(kor,'- 博士后履历补证',kr+' '+kl);
note(kor,'- 院系／机构：','NYU Tandon 原档明确为化学与生物分子工程系主任及教授。 '+link('NYU Tandon 原档',src.korNY));
changeRow(kor,null,'MIT 化工 2005 博后；Cornell 化工 2005–2007 博后；两段导师待核',kl);
schoolAff(kor,'化学与生物分子工程系；','化学与生物分子工程系（系主任）；');
audit(kor,{affiliation:['confirmed','NYU Tandon 原档列化学与生物分子工程系主任及教授。',[src.korNY]],research:['confirmed','NYU 原档核可持续高分子、塑料废弃物增值及仿生材料。',[src.korNY]],phd:keep(kor,'phd','复读本人 CV，教育栏明确将 Hammond 和 McKinley 同列为博士 Advisors。',[src.korCV]),postdoc:['unresolved',kr,[src.korCV,src.wies,src.korNY]]},'追 MIT 2005 Postdoctoral Associate 的任命与 Cornell fellowship 2005–2007 项目或课题组档。');

const y='e027fa17', wil='师承人物 - William Klemperer', sil='师承人物 - Robert Silbey';
const yp='CMU 学校履历列 Harvard 1990 博士，组出版档明确 Yaron 与 Klemperer 在 1988 和 1990 年合著。Klemperer 保留博士导师候选，继续查论文或本人履历具名字段。';
const yd='CMU 院档与 MIT Silbey 组 Postdocs 名单均列 MIT 1990–1992 博后，组出版目录列同期合作。Silbey 保留课题组负责人。';
const yl=link('CMU 教师原档',src.y)+' · '+link('本人组出版档',src.ypub)+' · '+link('MIT 博后名录',src.sil);
forward(y,'博士导师候选',wil,yp+' '+yl);back(y,'博士生候选',wil,yp+' '+yl);onward(y,wil,yp+' '+yl);
forward(y,'博士后课题组负责人',sil,yd+' '+yl);back(y,'博士后课题组成员',sil,yd+' '+yl);onward(y,sil,yd+' '+yl);
changeRow(y,null,'Robert Silbey（1990–1992 MIT 博士后课题组负责人）',yl);
const ay=audit(y,{phd:['group_or_candidate',yp,[src.y,src.ypub]],postdoc:['group_or_candidate',yd,[src.y,src.sil,src.ypub]]},'追 Harvard 1990 年化学论文签署页、MIT 1990–1992 具名博后指导。');
relation(y,'phd',wil,'candidate',yp,[src.y,src.ypub],ay,false);

const d='eb5d441a', ha='师承人物 - Paul K. Hansma';
const dp='ASU 2015–2016 校级历史教师档明确 Drucker 为物理系教师、1986 年 UC Santa Barbara 博士。Hansma 同期组出版物表有合著线索，导师候选保留。';
const dl=link('ASU 历史教师原档',src.dr)+' · '+link('Hansma 组出版档',src.hans);
forward(d,'博士导师候选',ha,dp+' '+dl);back(d,'博士导师候选对应人物',ha,dp+' '+dl);onward(d,ha,dp+' '+dl);
changeRow(d,'UC Santa Barbara 1986 博士；Paul K. Hansma（导师候选）',null,dl);
const ad=audit(d,{identity:['confirmed','ASU 历史教师档匹配物理系 Jeffery Drucker 及 1986 UCSB 博士。',[src.dr]],phd:['group_or_candidate',dp,[src.dr,src.hans]]},'查 UCSB 1986 物理博士论文书目及签署页、ASU MIDAS 具名博后任命。');
relation(d,'phd',ha,'candidate',dp,[src.dr,src.hans],ad,false);

const a='1407bda3';
const ap='西安交大原公告确认 Lay Kee Ang 中文名洪礼祺及西安交大客座教授，另列清华访问教授和 SUTD 本职，分别登记。';
const al=link('西安交大原任用公告',src.ang);
note(a,'- 院系／机构：',ap+' '+al);
changeRow(a,null,null,al);
schoolAff(a,'清华电机系访问教授；','清华电机系访问教授、西安交大客座教授；');
audit(a,{identity:keep(a,'identity',ap,[src.ang]),affiliation:keep(a,'affiliation',ap,[src.ang]),research:keep(a,'research','任用公告的报告题目与正文复核二维材料场发射、热电子发射及光电发射。',[src.ang])},'沿 Los Alamos Director Fellowship 旧档查具名博后指导者。');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_毕业与博后机构核查';
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

