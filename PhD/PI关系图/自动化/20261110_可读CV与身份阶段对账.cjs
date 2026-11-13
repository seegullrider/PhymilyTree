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
 a.audit_id='20261110_'+id+'_cv_proof_1423';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_cv_proof_1423_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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
 lat:'https://www.chem.fsu.edu/~latturner/WebCV2014Sept.pdf',
 acs:'https://par.nsf.gov/servlets/purl/10093546',
 latLab:'https://www.chem.fsu.edu/~latturner/index.php/the-group/dr-susan-latturner/',
 char:'https://charbonneaulab.chem.duke.edu/files/2024/10/20241001CV_web.pdf',
 chlab:'https://charbonneaulab.chem.duke.edu/2026/09/',
 ycv:'https://krieger.jhu.edu/physics/wp-content/uploads/sites/11/2021/12/Yahui-Zhang_cv_tagged.pdf',
 ypage:'https://physics-astronomy.jhu.edu/directory/yahui-zhang/',
 wang:'https://www.researchgate.net/publication/327660188_Local_phenomena_at_grain_boundaries_An_alternative_approach_to_grasp_the_role_of_oxygen_vacancies_in_metallization_of_VO2',
 imre:'https://research.a-star.edu.sg/articles/features/driving-science-to-new-horizons/',
 nus:'https://www.physics.nus.edu.sg/staff-news-2025/',
 orca:'https://orca.cardiff.ac.uk/view/allcardiffauthors/A309927R.html',
 dal:'https://citeseerx.ist.psu.edu/document?doi=aa45376918d0924814566b19bdba200238c8f0fc&repid=rep1&type=pdf',
 trento:'https://eventi.unitn.it/it/aperiodic-photonics-physics-device-engineering',
 dalLab:'https://www.bu.edu/nano/people/'
};
const link=(label,url)=>web(label,url)+'。';
const write=(id,msg,ph=null,pd=null)=>{note(id,'- 核查边界：',msg);changeRow(id,ph,pd,msg);};

const la='3e2cec3e', st='师承人物 - Galen D. Stucky', ka='人员 - Northwestern - Mercouri Kanatzidis - a90d4d54';
const laPh='本人 FSU 旧版 CV 第 1 页列 1993–2000 UCSB 博士阶段的 Graduate Advisor 为 Galen Stucky，并列 2000 年 8 月化学博士及论文题名。';
const laPd='同一 CV 第 1 页列 2000–2003 Michigan State Postdoctoral Advisor 为 Mercouri Kanatzidis。';
const lp=laPh+' '+link('本人 CV 原文件缓存',src.lat), ld=laPd+' '+link('本人 CV 原文件缓存',src.lat);
enrich(la,'phd',st,'博士生',lp);
replaceNoteLabel(la,'博士后课题组负责人','博士后导师',ka,' '+ld);
replaceInverseLabel(ka,la,'博士后课题组成员','博士后研究者',' '+ld);
replaceIndexLabel(la,ka,'博士后课题组负责人','博士后导师',' '+ld);
editLine(fn(local(la)),x=>x.startsWith('- 博士关系证据：'),x=>x.replace('旧 CV 原址仍返回 404，正式 Advisor 字段待取可读副本。','旧 CV 直连曾返回 404。')+' '+lp);
editLine(fn(local(la)),x=>x.startsWith('- 博士后关系证据：'),x=>'- 博士后关系证据：'+ld+'本人课题组页另核同一时期组属。'+link('FSU 本人组页',src.latLab));
editLine(fn(local(la)),x=>x.startsWith('- 核查边界：'),x=>'- 核查边界：CV 原文件的带行号缓存已重读，区分 UCSB 博士与 Michigan State 博后。此前直连失败保存在队列。博士论文签署原件待查。');
editLine(fn(local(la)),x=>x.startsWith('- [本人组页]')&&x.includes('旧 CV 的导师角色'),x=>'- '+link('本人组页',src.latLab)+'列 UCSB Stucky 组博士及 Michigan State Kanatzidis 组博后。具名指导另由本人 CV 核实。');
write(la,lp+' '+ld,'Galen D. Stucky（UCSB 博士导师）','Mercouri Kanatzidis（2000–2003 Michigan State 博士后导师）');
const laA=audit(la,{
 phd:['confirmed_advisor',laPh,[src.lat,src.acs]],
 postdoc:['confirmed_advisor',laPd,[src.lat,src.latLab]],
 affiliation:['confirmed','本人组页核 Florida State 化学与生物化学系。',[src.latLab]],
 research:['confirmed','本人履历及 ACS 原文核无机固态化学、无机笼状材料、金属助熔剂生长与电子磁性。',[src.lat,src.acs]]
},'用 CV 所列论文题名追 UCSB 学位签署原件。');
relation(la,'phd',st,'advisor',laPh,[src.lat,src.acs],laA,false);
relation(la,'postdoc',ka,'advisor',laPd,[src.lat,src.latLab],laA,false);

const ch='de03726b', re='人员 - Columbia - David R. Reichman - 38d42d59', fr='师承人物 - Daan Frenkel';
const chPh='本人 Duke CV 第 1 页列 2001–2006 Harvard 化学物理博士 Advisor 为 David R. Reichman。';
const chPd='本人 Duke CV 第 1 页在 2006–2008 AMOLF Postdoctoral Research Scientist 条目列 Daan Frenkel 为 Project Supervisor，确认为这段博士后项目导师。';
const cp=chPh+' '+link('本人 CV 原文件缓存',src.char), cd=chPd+' '+link('本人 CV 原文件缓存',src.char);
enrich(ch,'phd',re,'博士生',cp);
enrich(ch,'postdoc',fr,'博士后研究者',cd);
write(ch,cd+' '+link('本人转校公告',src.chlab),null,'Daan Frenkel（2006–2008 AMOLF 博士后项目导师，CV 称 Project Supervisor）');
const chA=audit(ch,{
 phd:['confirmed_advisor',chPh,[src.char]],
 postdoc:['confirmed_advisor',chPd,[src.char]]
},'追 Harvard 学位签署原档，保留 Duke 与 Montréal 任职公告中各自的时间和职称。');
relation(ch,'postdoc',fr,'advisor',chPd,[src.char],chA,false);

const yPh='本人 JHU 旧版 CV 第 1 页列 2014.8–2019.8 MIT 物理博士 Advisor 为 Senthil Todadri。';
const yPd='本人 JHU 旧版 CV 第 1 页列 2019.9–2021.12 Harvard 博后 Advisors 为 Ashvin Vishwanath 和 Subir Sachdev。新版 CV 所列任期相同。';
const yp=yPh+' '+link('本人旧 CV 原文件缓存',src.ycv), yd=yPd+' '+link('本人旧 CV 原文件缓存',src.ycv);
for(const y of ['d7c55462','6c7133b5']){
 const mentors=['人员 - Harvard - Ashvin Vishwanath - 49dc4464','人员 - Harvard - Subir Sachdev - a4367696'];
 enrich(y,'phd','人员 - MIT - Senthil Todadri - 781c3259','博士生',yp);
 for(const m of mentors)enrich(y,'postdoc',m,'博士后研究者',yd);
 write(y,yd+' 两条跨校记录指同一人。',null,'Ashvin Vishwanath、Subir Sachdev（2019.9–2021.12 Harvard 博士后导师）');
 const aid=audit(y,{phd:['confirmed_advisor',yPh,[src.ycv,src.ypage]],postdoc:['confirmed_advisor',yPd,[src.ycv,src.ypage]]},
 '按 Johns Hopkins 主聘、Maryland 访问记录继续核访问期限和招生资格。');
 for(const m of mentors)relation(y,'postdoc',m,'advisor',yPd,[src.ycv,src.ypage],aid,false);
}

const wa='068377f5';
const waPh='2018 年署名论文作者履历列 Shi-jie Wang 2002 年获得物理博士。该段未写授予学校，邻段 KTH 博士属于 Kaiyang Zeng。Cardiff ORCA 的 2016 水文论文作者 Shi, Jie 属另一身份。';
const waAff='A*STAR 2025 年获奖公告列 Shijie Wang 为 IMRE、SRTT-FEAT Senior Principal Scientist。2018 年作者履历与 A*STAR 简介均列 NUS 物理系历史兼职。NUS 2025 离任名单仅列同名和职称，保留当前兼职及指导资格待核。';
const wp=waPh+' '+link('2018 年署名论文作者履历',src.wang)+' '+link('A*STAR 2025 年原档',src.imre)+' '+link('NUS 人事档',src.nus);
write(wa,wp,'2002 物理博士，授予单位与导师待核','经历及导师待核');
audit(wa,{
 phd:['unresolved',waPh,[src.wang,src.orca]],
 affiliation:['confirmed',waAff,[src.imre,src.wang,src.nus]],
 research:['confirmed','A*STAR 原档和作者履历核功能氧化物、界面物理、先进陶瓷。',[src.imre,src.wang]]
},'按 2002 年物理博士及早期功能薄膜文献追学位论文和任用，核实 NUS 兼职离任和指导资格。');

const da='e0fc6317';
const daEv='本人署名论文作者履历列 2003 年 Trento 博士后赴 MIT 任 Postdoctoral Associate，2006 年 1 月起任 BU ECE 助理教授。Kimerling 继续列为博后指导候选。2004 论文目录年份和本人所列 2003 学位年份继续分列。';
write(da,daEv+' '+link('2007 年论文作者履历',src.dal)+' '+link('Trento 2026 讲座',src.trento),null,'2003–2005 MIT 博后，Lionel C. Kimerling（候选）');
audit(da,{
 postdoc:['group_or_candidate',daEv,[src.dal,src.dalLab]],
 affiliation:['confirmed','BU 课题组及 Trento 2026 讲座核现属 BU，署名论文作者履历核其 ECE 任用起点。',[src.dal,src.dalLab,src.trento]],
 research:['confirmed','Trento 物理系讲座核纳米光子学、超材料及复杂结构中的光波。',[src.trento,src.dalLab]]
},'继续查 Trento 原学位字段和 MIT 博后项目组任用。保留已有博士导师标签及现有类型差异。');


db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_可读CV与身份阶段对账';
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

