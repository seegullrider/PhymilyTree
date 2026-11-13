const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root = '..';
const notes = path.join(root,'人物');
const index = path.join(root,'师承关系索引.md');
const records = db.prepare('SELECT id,filename,unit FROM records WHERE id=?');
const last = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const updates = new Map(), audits = [], relations = [];
function line(file, match, suffix) {
 const text = updates.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = text.includes('\r\n') ? '\r\n' : '\n';
 const rows = text.split(/\r?\n/);
 const matches = rows.map((row,i) => match(row) ? i : -1).filter(i=>i>=0);
 if (matches.length !== 1) throw Error(file+' expected one line, found '+matches.length);
 const i = matches[0];
 if (!rows[i].includes(suffix)) rows[i] += suffix;
 updates.set(file, rows.join(newline));
}
function source(label,url) { return '['+label+']('+url+')'; }
function personLine(id,prefix,suffix) {
 const record = records.get(id);
 line(path.join(notes,record.filename+'.md'),x=>x.startsWith(prefix),suffix);
}
function schoolSource(id,suffix) {
 const record=records.get(id);
 const file=path.join(root,record.unit+'逐人复核记录.md');
 const contents=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=contents.includes('\r\n')?'\r\n':'\n';
 const rows=contents.split(/\r?\n/);
 const i=rows.findIndex(x=>x.startsWith('| [['+record.filename+'|'));
 if(i<0||!rows[i].endsWith(' |'))throw Error('missing school row '+id);
 if(!rows[i].includes(suffix))rows[i]=rows[i].slice(0,-2)+suffix+' |';
 updates.set(file,rows.join(newline));
}
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mf=name=>path.join(notes,name+'.md');
const sl=id=>path.join(root,records.get(id).unit+'逐人复核记录.md');
const wiki=(name,display)=>'[['+name+'|'+display+']]';
const who=(id,display)=>wiki(records.get(id).filename,display);
const get=file=>updates.get(file)??fs.readFileSync(file,'utf8');
const boundary='- 核查边界：';
function rewrite(file,test,fn) {
 const content=get(file);
 const nl=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const indexes=rows.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(indexes.length!==1)throw Error(file+' expected one matching row, found '+indexes.length);
 const i=indexes[0];
 rows[i]=fn(rows[i],nl);
 updates.set(file,rows.join(nl));
}
function school(id,oldField,newField) {
 const r=records.get(id);
 rewrite(sl(id),x=>x.startsWith('| [['+r.filename+'|'),x=>{
  if(x.includes(newField))return x;
  if(!x.includes(oldField))throw Error('missing school field '+id);
  return x.replace(oldField,newField);
 });
}
function insertAfter(file,prefix,entry){
 if(get(file).includes(entry))return;
 rewrite(file,x=>x===prefix,(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261111_0653_'+id;
 orig.followup_required=true;
 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261111_0653_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"efi":"https://efi.uchicago.edu/fellowships/current-and-previous-fellows/","luc":"https://physics.uchicago.edu/people/profile/luca-delacretaz/","psd":"https://physicalsciences.uchicago.edu/news/article/introducing-new-faculty-in-the-physical-sciences-division-22/","st":"https://physics.stanford.edu/events/physics-phd-dissertation-defense-luca-delacretaz","diss":"https://digital.library.unt.edu/ark:/67531/metadc1092771/m2/1/high_res_d/5511727.pdf#page=4","cle":"https://pme.uchicago.edu/directory/andrew-cleland","cea":"https://iramis.cea.fr/en/spec/gq/membres-gq-en/","rou":"https://instituteq.fi/michael-roukes-selected-as-instituteq-chair-of-excellence-hosted-at-aalto-university/","har":"https://seas.harvard.edu/news/merging-biological-and-electronic","ct":"https://chemistry.uchicago.edu/faculty/bozhi-tian","stt":"https://chemistry.stanford.edu/events/physical-chemistry-seminar-professor-bozhi-tian-university-chicago","eth":"https://mat.ethz.ch/materials-research-prize-for-young-investigators/bozhi-tian.html","tcv":"https://gcim2025.org/index.php?ACT=file_view&GP=pro%2Fspk_keynote&SH=NON&key=248&tag=pdf","cv":"https://engelgroup.uchicago.edu/CVs/Engel-250331.pdf#page=1","ep":"https://pme.uchicago.edu/directory/greg-engel","oist":"https://groups.oist.jp/po/event/presidential-lecture-patterns-nature","jfi":"https://jamesfranckinstitute.uchicago.edu/people/profile/sidney-nagel/","ch":"https://chronicle.uchicago.edu/960523/nagel.shtml","stg":"https://chemistry.stanford.edu/events/student-hosted-colloquia-professor-giulia-galli-university-chicago","gg":"https://galligroup.uchicago.edu/People/galli.php"};
const src=(...xs)=>xs.map(([label,key])=>source(label,u[key])).join(' · ');
const pl=(id,prefix,evidence)=>personLine(id,prefix,' '+evidence);
const schoolWith=(id,evidence)=>schoolSource(id,' · '+evidence);
const a=(key,note,sources,status)=>[key,note,sources.map(k=>u[k]),status];
function cell(id,n,value){
 const prefix='| [['+records.get(id).filename+'|';
 rewrite(sl(id),x=>x.startsWith(prefix),x=>{
  const end=x.indexOf(']]'), cells=x.slice(end+2).split(' | ');
  if(end<0||cells.length<4)throw Error('missing school cells '+id);
  cells[n]=value;
  return x.slice(0,end+2)+cells.join(' | ');
 });
}
function mentor(file,name,desc,links){
 if(fs.existsSync(mf(file)))return;
 updates.set(mf(file),['# '+name,'','- 类型：师承扩展人物','- '+desc+' '+links,'','## 师承',''].join('\n'));
}
function edge(id,name,mFile,mName,fLabel,bLabel,note,links){
 if(!links)throw Error('edge requires sources '+id);
 const from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 insertAfter(pf(id),'## 师承','\n- '+fLabel+'：'+to+after);
 insertAfter(mf(mFile),'## 师承','\n- '+bLabel+'：'+from+after);
 insertAfter(index,'# 师承关系与候选线索索引','\n- '+from+' → '+fLabel+'：'+to+after);
}
function updateEdge(id,name,mFile,mName,oldForward,oldBack,newForward,newBack,note,links){
 const rec=records.get(id),from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 rewrite(pf(id),x=>x.startsWith('- '+oldForward+'：')&&x.includes(mFile),()=>'- '+newForward+'：'+to+after);
 rewrite(mf(mFile),x=>x.startsWith('- '+oldBack+'：')&&x.includes(rec.filename),()=>'- '+newBack+'：'+from+after);
 rewrite(index,x=>x.startsWith('- '+from+' → '+oldForward+'：')&&x.includes(mFile),()=>'- '+from+' → '+newForward+'：'+to+after);
}
function unit(id,name,label,detail,links){
 const schoolName=records.get(id).unit, node='已核实单位 - '+schoolName+' - '+label;
 const file=path.join(root,'已核实院系',node+'.md');
 const line='- '+who(id,name)+' — '+detail+' '+links;
 const header='[[院校 - '+schoolName+'|返回学校]]';
 if(!fs.existsSync(file)&&!updates.has(file))updates.set(file,['# '+schoolName+'：'+label,'',header,'','## 已核实人物','',line,''].join('\n'));
 else if(!get(file).includes(records.get(id).filename)){
  const contents=get(file), nl=contents.includes('\r\n')?'\r\n':'\n';
  updates.set(file,contents.trimEnd()+nl+line+nl);
 }
 rewrite(pf(id),x=>x.startsWith('- 院系／机构：'),x=>x.includes(node)?x:x.replace(/。$/,'')+' · '+wiki(node,label)+'。');
}




const ids=(...keys)=>keys.map(k=>u[k]);



const pages=[];
const page=(record_id,key,raw,excerpt)=>pages.push({record_id,url:u[key],raw,excerpt});
const fix=(id,phase,text)=>rewrite(pf(id),x=>x.startsWith(phase),x=>x+' '+text);
const end=(id,note,links)=>rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+note+' '+links);

{
 const id='5bcc83c6', name='Luca Delacrétaz', son='人员 - University of Chicago - Dam Thanh Son - fc4b8bd4';
 const phd='Stanford 物理系 2019 年 5 月 28 日答辩档将 Sean Hartnoll 列为 Research Advisor，学位论文题为 Hydrodynamics of condensed matter。';
 const postdoc='芝大 Enrico Fermi Institute 的 Robert R. McCormick Fellowship 历届原表，在 2019–2022 Luca Delacrétaz 一行的 Advisor 列写 Dam T. Son。芝大任用公告确认该 fellowship 为博士后。关系类型可信度高。';
 const refs=src(['McCormick 原始名录','efi'],['Chicago 任用原档','psd']);
 updateEdge(id,name,son,'Dam Thanh Son','博士后候选导师','博士后候选研究者','博士后导师','博士后研究者',postdoc,refs);
 end(id,phd+' '+postdoc,src(['Stanford 答辩','st'])+' · '+refs);
 cell(id,3,'Dam Thanh Son（2019–2022 McCormick 博士后导师）');
 rewrite(sl(id),x=>x.startsWith('| [['+records.get(id).filename+'|'),x=>x.replace('列博后，旧博后导师来源不支持原标签','列博后'));
 schoolWith(id,src(['McCormick 历届名录，Advisor 列','efi']));
 const q=audit(id,[a('identity','Stanford 2019 答辩姓名及院校与 Chicago 2019–2022 博士后记录和现任教师一致。',['st','efi','luc'],'confirmed'),a('affiliation','Chicago 物理系助理教授。',['luc','psd'],'confirmed'),a('research','用量子场论研究凝聚态集体现象和涌现。',['luc','st'],'confirmed'),a('phd',phd,['st'],'confirmed_advisor'),a('postdoc',postdoc,['efi','psd'],'confirmed_advisor')],'博士和 McCormick 博士后阶段具名导师已核。');
 audits.at(-1).followup_required=false;
 relation(id,q,'phd','师承人物 - Sean Hartnoll','advisor',phd,ids('st'),'hartnoll');
 relation(id,q,'postdoc',son,'advisor',postdoc,ids('efi','psd'),'son');
 page(id,'efi','The McCormick fellowship table has an Advisor column. Its 2019–2022 Luca Delacrétaz entry identifies Dam T. Son.','首次从正确的分表直接核对博后具名导师，替代基于合著的候选。');
 page(id,'psd','The hiring announcement names Delacrétaz as a former McCormick Postdoctoral Fellow at the Kadanoff Center and EFI.','确认芝大任用及 McCormick 博后阶段。');
 page(id,'luc','Chicago Physics describes his appointment and research on collective and emergent phenomena in condensed matter.','核对现任物理系和研究方向。');
 page(id,'st','The 2019 Stanford Physics defense notice identifies Sean Hartnoll as Research Advisor.','确认博士导师。');
}
{
 const id='d15e58ff', name='Andrew Cleland', martin='人员 - UC Santa Barbara - John Martinis - 0edf740c';
 const evidence='1991 年 Berkeley 博士论文致谢明述 John Martinis 引介作者进入实验物理并教授实验技术。按博士阶段研究师长记录，具体教学关系可信度高，正式论文导师仍待学位原档。';
 const refs=src(['Cleland 博士论文致谢','diss']);
 edge(id,name,martin,'John Martinis','博士阶段研究师长','博士阶段受指导者',evidence,refs);
 pl(id,boundary,'论文致谢另明确 John Martinis 的实验教学角色，已单列博士阶段研究师长。 '+refs);
 cell(id,2,'John Clarke（博士阶段课题组负责人，论文导师待核）；John Martinis（博士阶段研究师长，论文致谢）');
 schoolWith(id,refs);
 const q=audit(id,[a('phd','1991 年 Berkeley 原论文明确 Clarke 组属及 John Martinis 实验教学。Clarke 的正式论文导师职衔仍待学位原档。',['diss'],'group_or_candidate'),a('postdoc','本人 Chicago 学校资料及 CEA 旧组名录支持 Saclay 博后；Roukes 本人确认 Caltech 博后。两阶段正式 advisor 仍待核。',['cea','rou','cle'],'group_or_candidate')],'找 Berkeley 图书馆保存的学位签署页及 Saclay 同期任用文件。');
 relation(id,q,'phd',martin,'stage_mentor',evidence,ids('diss'),'martinis');
 page(id,'diss','Cleland thanks John Clarke for providing his thesis research opportunity and identifies John Martinis as the person who introduced him to experimental physics and taught laboratory skills.','学位原卷分别支持 Clarke 组属和 Martinis 实验教学。');
 page(id,'cea','The CEA Quantronics group lists Andrew Cleland among former postdocs or visitors.','保持 Saclay 阶段组属。');
}
{
 const id='5e7d5e5d', name='Bozhi Tian';
 const phd='Harvard 工程学院同期报道明确 Bozhi Tian 是 Charles M. Lieber 的原博士生，Stanford 和 ETH 讲座履历核 2010 年 Harvard 物理化学博士。';
 const pd='Harvard 2012 报道列 Tian 为 Robert Langer 和 Daniel Kohane 实验室的前博士后。Stanford 讲座及 ETH 获奖履历直接说明该阶段与两人共事。博士后组属可信度高，正式导师职衔待核。';
 const refs=src(['Harvard 2012 报道','har'],['Stanford 讲座','stt'],['ETH 获奖履历','eth']);
 for(const [label,key] of [['Robert Langer','langer'],['Daniel Kohane','kohane']]){
  const f='师承人物 - '+label;
  updateEdge(id,name,f,label,'博士后课题组','博士后课题组成员','博士后课题组','博士后课题组成员',pd,refs);
 }
 end(id,pd,refs);
 schoolWith(id,src(['Stanford 讲座','stt'],['ETH 获奖履历','eth']));
 const q=audit(id,[a('identity','Harvard 博士及博士后履历与 Stanford、ETH 的 Bozhi Tian 介绍匹配。',['har','stt','eth'],'confirmed'),a('affiliation','Chicago 化学系教授，James Franck Institute 有关联。',['ct'],'confirmed'),a('research','材料化学、半导体纳米材料和生物电子界面。',['ct'],'confirmed'),a('phd',phd,['har','stt'],'confirmed_advisor'),a('postdoc',pd,['har','stt','eth'],'group_or_candidate')],'查本人长版 CV 或 MIT 与 Boston Children’s 当期任用的指导栏。');
 relation(id,q,'phd','师承人物 - Charles M. Lieber','advisor',phd,ids('har','stt'),'lieber');
 relation(id,q,'postdoc','师承人物 - Robert Langer','group_leader',pd,ids('har','stt','eth'),'langer');
 relation(id,q,'postdoc','师承人物 - Daniel Kohane','group_leader',pd,ids('har','stt','eth'),'kohane');
 page(id,'stt','The Stanford seminar bio identifies Tian’s 2010 Harvard doctorate and his subsequent postdoctoral work with Robert Langer and Daniel Kohane.','当事人讲座履历对照两段身份。');
 page(id,'eth','The ETH award bio describes the same postdoctoral work with Langer and Kohane.','补一手机构材料，保持组属。');
 page(id,'har','Harvard SEAS separately identifies Lieber doctoral supervision and a fellowship in the Langer and Kohane labs.','核博士导师及两位博士后组负责人。');
 page(id,'ct','Chicago Chemistry lists Tian as Professor, with research in materials chemistry, biophysics and physical chemistry.','核院系、研究方向。');
 pages.push({record_id:id,url:u.tcv,error:'Official event CV download returned a gateway timeout. Stanford, ETH and Harvard originals were read.'});
}
{
 const id='334d75ce', name='Sidney R. Nagel';
 const phd='OIST 本人讲座原档将 Princeton 博士期间的组属写为 Stephen Schnatterly 组，并记学位为 1975。Chicago 旧档记博士 1974，保留年份差异。正式论文导师待原论文或学位登记。';
 const pd='OIST 原讲座将 Brown 两年博士后写作 under the mentorship of Jan Tauc，明确阶段指导。正式导师职衔待任用档。';
 const refs=src(['OIST 讲座原档','oist'],['Chicago 旧档','ch']);
 updateEdge(id,name,'师承人物 - Stephen E. Schnatterly','Stephen E. Schnatterly','博士导师（次级来源待核）','博士生（次级来源待核）','博士阶段课题组负责人','博士阶段课题组成员',phd,refs);
 end(id,phd+' '+pd,refs);
 cell(id,2,'Stephen E. Schnatterly（博士课题组负责人，正式论文导师待核）');
 schoolWith(id,refs);
 const q=audit(id,[a('phd',phd,['oist','ch'],'group_or_candidate'),a('postdoc',pd,['oist'],'group_or_candidate')],'找 Princeton 博士授予及论文签署原件，核对 1974／1975；找 Brown 博后任用原档。');
 relation(id,q,'phd','师承人物 - Stephen E. Schnatterly','group_leader',phd,ids('oist','ch'),'schnatterly');
 relation(id,q,'postdoc','师承人物 - Jan Tauc','stage_mentor',pd,ids('oist'),'tauc');
 page(id,'oist','OIST identifies Nagel as a Princeton PhD who worked in Stephen Schnatterly’s group and a Brown postdoc mentored by Jan Tauc.','两段角色都有明确原档。');
 page(id,'ch','The Chicago Chronicle bio records Princeton doctorate in 1974.','保留与 OIST 1975 的差异。');
}
{
 const id='c138c1f9';
 const phd='本人 2025 CV 第 1 页列 2004 年 6 月 Harvard 化学与化学生物博士及论文题名 Cavity Enhanced Spectroscopic Techniques for in situ Measurement: Pushing the Limits of Sensitivity。Chicago PME 支持 James G. Anderson 的博士阶段研究指导，正式论文导师职衔待学位档。';
 const har='本人 2025 CV 明列 Harvard 2004–2005 工程与应用科学系博士后在 James G. Anderson 组。保留为博士后课题组关系。';
 const ber='本人 2025 CV 明列 2005–2007 Berkeley Miller Research Fellowship，与 Graham R. Fleming 合作。Chicago PME 确认该段与 Fleming 一起工作。保留博士后阶段研究师长，正式 advisor 待核。';
 const refs=src(['Engel 本人 CV 第 1 页','cv'],['Chicago PME','ep']);
 end(id,phd+' '+har+' '+ber,refs);
 cell(id,3,'James G. Anderson（Harvard 博士后课题组）；Graham R. Fleming（Berkeley 博士后阶段研究师长）');
 schoolWith(id,refs);
 const q=audit(id,[a('identity','本人 CV 使用 Gregory S. Engel，教育履历和现任与 Greg Engel 的 Chicago PME 页面一致。',['cv','ep'],'confirmed'),a('affiliation','Chicago 分子工程与化学系教授、James Franck Institute 成员。',['ep'],'confirmed'),a('research','激子动力学、超快光谱和量子动力学。',['ep'],'confirmed'),a('phd',phd,['cv','ep'],'group_or_candidate'),a('postdoc',har+' '+ber,['cv','ep'],'group_or_candidate')],'按准确题名找 Harvard 博士原卷，查 Berkeley Miller 任用的正式主持／指导字段。');
 relation(id,q,'phd','师承人物 - James G. Anderson','stage_mentor',phd,ids('cv','ep'),'anderson_phd');
 relation(id,q,'postdoc','师承人物 - James G. Anderson','group_leader',har,ids('cv'),'anderson_postdoc');
 relation(id,q,'postdoc','人员 - UC Berkeley - Graham R. Fleming — 荣休 - 5b832ad4','stage_mentor',ber,ids('cv','ep'),'fleming');
 page(id,'cv','Engel’s CV names the 2004 Harvard thesis, then separately lists 2004–2005 in the Anderson group and 2005–2007 at Berkeley in collaboration with Graham Fleming.','核论文题名及两个博士后阶段。');
 page(id,'ep','Chicago PME lists his two primary faculty appointments and describes his work on excitonic and quantum dynamics.','核现任与研究。');
}
{
 const id='15cdaae3';
 const msg='Chicago 本人组主页与 Stanford 化学系原讲座均确认物理博士单位为意大利 Trieste 的 SISSA。两份原档未列博士导师。';
 pl(id,boundary,msg+' '+src(['Stanford 原讲座','stg'],['本人组页','gg']));
 cell(id,2,'SISSA Trieste 物理博士（导师待核）');
 schoolWith(id,src(['Stanford 原讲座','stg']));
 audit(id,[a('identity','Stanford 原讲座和 Chicago 本人组页的现任、旧单位和学位相符。',['stg','gg'],'confirmed'),a('affiliation','Chicago 分子工程与化学、Argonne。',['stg','gg'],'confirmed'),a('research','计算材料、电子结构及材料模拟。',['stg','gg'],'confirmed'),a('phd',msg,['stg','gg'])],'查 SISSA 早期物理博士纸本名录或论文，继续找 IBM Zürich 与 UIUC 具名博后原档。');
 page(id,'stg','Stanford Chemistry identifies her physics PhD from SISSA and her faculty and laboratory appointments.','核定博士单位和现任，留博士导师待查。');
 page(id,'gg','Galli’s laboratory biography independently confirms her SISSA physics PhD and Chicago and Argonne appointments.','用于身份、任用和研究方向交叉核对。');
}
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0653_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0653_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0653_Chicago奖助学位与履历原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
