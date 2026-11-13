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
 a.audit_id='20261110_'+id+'_minnesota_and_stage_1512';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_minnesota_and_stage_1512_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

const src={"umn":"https://conservancy.umn.edu/bitstreams/637d9ddd-59a8-4d9c-9fab-2333030905e5/download","hku":"https://www.physics.hku.hk/Seminar/Col_20250416.pdf","psu":"https://science.psu.edu/physics/people/yxl15","matse":"https://www.matse.psu.edu/directory/ying-liu","bu2005":"https://www.bu.edu/eng/files/2022/10/eng.alumni.2005-Fall-ENG-Magazine.pdf","bugroup":"https://www.bu.edu/nano/people/","trento":"https://nanolab.physics.unitn.it/people.html","merced":"https://appliedmath.ucmerced.edu/sites/g/files/ufvvjh381/f/page/documents/harishankar_manikantan_-_flyer.pdf","sd":"https://www.mae.ucsd.edu/seminar/2023/tunable-collective-dynamics-inclusions-viscous-biological-membranes","manHome":"https://sites.google.com/site/hmanikantan/home","nas":"https://www.nasonline.org/wp-content/uploads/2024/06/cardona-manuel.pdf","bates":"https://bates.cems.umn.edu/people/alumni","rpi":"https://cbe.rpi.edu/sites/default/files/speaker-files/2021/12.1.21%20You-Yeon%20Won.pdf","mitThesis":"https://studylib.net/doc/10979766/surface-modification-of-polymer-membranes-by-self-organiz..."};
const link=(label,url)=>web(label,url)+'。';
const old=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,ev,urls)=>[old(id,k).status,old(id,k).note+' '+ev,urls];
const write=(id,ph,pd,proof)=>{note(id,'- 核查边界：',proof);changeRow(id,ph,pd,proof);};
const y='10754714', ag='师承人物 - Allen M. Goldman';
const wrong='https://spaa.newark.rutgers.edu/ying-liu';
const yPh='Minnesota 1991 年研究生毕业名录在 Ying Liu 的物理博士条目明确列 Major Adviser Allen M. Goldman。论文题名 Electrical Transport and Quantum Phase Transitions of Ultrathin Films of Metals Prepared by in Situ Low Temperature Deposition。名录的 Peking 1982 本科及 Minnesota 1991 博士与 Penn State、香港大学档案相符。';
const yPd='香港大学讲者履历将 University of Colorado Boulder 三年博士后列在 1991 博士与 1994 加入 Penn State 之间，按 1991–1994 前后记录。个人导师待机构原档。';
const yPhProof=yPh+' '+link('Minnesota 研究生毕业名录',src.umn)+' '+link('Penn State 物理系原档',src.psu);
const yPdProof=yPd+' '+link('香港大学讲者履历',src.hku);
const yAff='Penn State 物理系为主聘，材料档案确认参与跨学院材料研究生项目。研究方向含低维和非常规超导。';
const yAffProof=yAff+' '+link('Penn State 物理系原档',src.psu)+' '+link('材料研究生项目原档',src.matse);
const bad='Rutgers Newark 2026 公共事务与管理博士 Ying Liu 为公共管理及性别研究者，排除为同名。';
const bProof=bad+' '+link('Rutgers 同名者原档',wrong);
replaceNoteLabel(y,'博士阶段研究师长','博士导师',ag,' '+yPhProof);
replaceInverseLabel(ag,y,'博士阶段研究者','博士生',' '+yPhProof);
replaceIndexLabel(y,ag,'博士阶段研究师长','博士导师',' '+yPhProof);
editLine(fn(local(y)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+yPdProof+' '+yAffProof+' '+bProof);
changeRow(y,'Allen M. Goldman（明确博士导师）','Colorado Boulder 三年博后（约 1991–1994）；个人导师待核',yPhProof+' '+yPdProof+' '+yAffProof);
const ay=audit(y,{
 identity:keep(y,'identity',bad,[src.psu,src.umn,wrong]),
 phd:['confirmed_advisor',yPh,[src.umn,src.psu,src.hku]],
 postdoc:['unresolved',yPd,[src.hku]],
 affiliation:keep(y,'affiliation',yAff,[src.psu,src.matse]),
 research:keep(y,'research','本人机构档及香港大学讲者履历复核低维和非常规超导。',[src.psu,src.hku])
},'沿论文准确题名追签署原件，查 1991–1994 Boulder 博后个人导师及聘任资料。');
relation(y,'phd',ag,'advisor',yPh,[src.umn,src.psu,src.hku],ay,false);

const da='e0fc6317',k='师承人物 - Lionel C. Kimerling';
const daPd='BU 2005 年工学院原刊明确 Dal Negro 自 2003 年在 MIT 材料科学与工程系做 Postdoctoral Associate，计划于 2006 年 1 月 1 日加入 BU ECE。校刊和本人组页时间线一致，继续保留 Kimerling 候选。';
const daPh='Trento 前博士生名录核组属，2003 博士与 2004 论文登记原有差异保留。学位目录此次返回 cache miss，未取得正式字段原文。';
const daProof=daPd+' '+link('BU 2005 工学院校刊',src.bu2005)+' '+link('BU 本人组页',src.bugroup);
note(da,'- 博士后导师候选：',daProof);mentorLine(k,da,'- 博士后指导候选：',daProof);indexLine(da,k,'博士后导师候选',daProof);
write(da,null,'MIT 材料系自 2003 年做博后，2006 年 1 月转 BU；Lionel C. Kimerling（候选）',daProof);
audit(da,{phd:keep(da,'phd',daPh,[src.trento,src.bugroup]),postdoc:keep(da,'postdoc',daPd,[src.bu2005,src.bugroup]),research:keep(da,'research','本人组页核纳米光子学、量子光学与复杂介质光输运。',[src.bugroup])},'保留 Trento 原论文库失败，后续查签署页和 MIT 实验室博后具名导师。');

const ma='4b57e796',ts='人员 - UC Santa Barbara - Todd Squires - d92cccbf';
const maPh='UC San Diego MAE 与 UC Merced 机构讲者履历分列 2012 Illinois 硕士及 2015 UC San Diego 应用力学博士，后者写与 David Saintillan 共事。结合同人组属及博士论文主席和致谢，保留已证博士研究指导及旧正式导师标签差异。';
const maPd='UC Merced 2023 讲者履历记在 UC Santa Barbara 博后 3.5 年与 Todd Squires 共事。本人早期页亦直接具名，保留博士后阶段研究师长和组负责人。';
const maProof=maPd+' '+link('UC Merced 讲者原档',src.merced)+' '+link('本人早期页',src.manHome);
note(ma,'- 博士后课题组负责人及阶段研究师长：',maProof);mentorLine(ts,ma,'- 博士后课题组成员：',maProof);indexLine(ma,ts,'博士后课题组负责人及阶段研究师长',maProof);
write(ma,null,'Todd Squires（UCSB 约 3.5 年博后，课题组负责人及阶段研究师长）',maProof+' '+link('UC San Diego MAE 原档',src.sd));
const ama=audit(ma,{phd:keep(ma,'phd',maPh,[src.sd,src.merced]),postdoc:['group_or_candidate',maPd,[src.merced,src.manHome]],research:keep(ma,'research','UCSD MAE 讲者原档核生物流体和界面流变研究。',[src.sd])},'查 UCSD 博士 Advisor 独立字段与 UCSB 博后任用的个人称谓。');
relation(ma,'postdoc',ts,'stage_mentor',maPd,[src.merced,src.manHome],ama,false);

const me='2bf43d5e',mc='师承人物 - Manuel Cardona';
const mePh='美国国家科学院 Cardona 纪念传记明确称 José Menéndez 是其 former student，与 Menéndez 本人署名回忆中的 Stuttgart 研究阶段一致。ASU CV 仍在退避，保留旧 Advisor 标签和结构化阶段研究师长之间的差异。';
const meProof=mePh+' '+link('美国国家科学院纪念传记',src.nas);
note(me,'- 博士关系证据：',meProof);mentorLine(mc,me,'- 博士生：',meProof);indexLine(me,mc,'博士导师',meProof);
write(me,null,null,meProof);
const ame=audit(me,{phd:keep(me,'phd',mePh,[src.nas])},'等 ASU CV 退避到期再查导师字段，继续追 Stuttgart 学位原件和 Bell Labs 博后任用。');
relation(me,'phd',mc,'stage_mentor',mePh,[src.nas,'https://www.fkf.mpg.de/5098831/20_Kondolenzbuch'],ame,false);

const wo='fd419157',may='师承人物 - Anne M. Mayes',fb='人员 - University of Minnesota - Frank Bates - f5d72779';
const woPh='Minnesota Bates 组校友档核 You-Yeon Won 2000 博士及 Purdue 去向，支持博士组属。旧 Bates 与 Davis 的导师记录保留，签署页待查。';
const woPd='Bates 组校友档和 RPI 讲者履历均分列 MIT 2000–2001、Harvard 2001–2003 博后。MIT 同期 Jonathan F. Hester 论文致谢将 Won 列在 Anne M. Mayes 研究团队。补 MIT 课题组原证，正式 Advisor 继续依赖待复读的旧 Purdue 来源。';
const woPhProof=woPh+' '+link('Bates 组校友原档',src.bates);
const woPdProof=woPd+' '+link('RPI 讲者履历',src.rpi)+' '+link('同期论文原文可读副本',src.mitThesis);
editLine(fn(local(wo)),l=>l.startsWith('- 博士导师：')&&l.includes(fb),l=>l+' '+woPhProof);
editLine(fn(local(wo)),l=>l.startsWith('- 博士后导师：')&&l.includes(may),l=>l+' '+woPdProof);
mentorLine(fb,wo,'- 博士生：',woPhProof);indexLine(wo,fb,'博士导师',woPhProof);
mentorLine(may,wo,'- 博士后研究者：',woPdProof);indexLine(wo,may,'博士后导师',woPdProof);
write(wo,null,'Anne M. Mayes（MIT 2000–2001；另有组属原证）、David A. Weitz（Harvard 2001–2003；旧导师记录）',woPhProof+' '+woPdProof);
audit(wo,{phd:keep(wo,'phd',woPh,[src.bates,src.rpi]),postdoc:keep(wo,'postdoc',woPd,[src.bates,src.rpi,src.mitThesis]),affiliation:keep(wo,'affiliation','RPI 讲者档和组校友原档核 Purdue 化工。',[src.rpi,src.bates])},'查 Minnesota 学位原件及 MIT、Harvard 具名指导聘任档，待 Purdue 主机退避后复读。');

const identity=[{page_id:'4fe064dd481fb0f1d9edf913',url:wrong,record_id:y,audit_id:ay,external_subject:'Ying Liu（Rutgers Newark 公共事务与管理学院 2026 博士）',evidence:bad+' Penn State 人物为 Minnesota 1991 物理博士，研究非常规超导。'}];
if(process.argv[2]==='apply')fs.writeFileSync('20261110_Rutgers同名排除回执.json',JSON.stringify(identity,null,2)+'\n','utf8');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Minnesota与博后阶段';
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

