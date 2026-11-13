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
 orig.audit_id='pi_archive_20261111_0721_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0721_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"cv":"https://rsl.yale.edu/sites/default/files/2025-11/RJ%20Schoelkopf-CV-revised-11.12.2025.pdf#page=3","qf":"https://qfarm.stanford.edu/new-faculty-david-schuster-and-jon-simon","ya":"https://physics.yale.edu/earlier-alumni","ms":"https://web.mit.edu/cua/www/quanta/people.html","sch":"https://profiles.stanford.edu/david-schuster","yn":"https://news.yale.edu/2009/06/28/scientists-create-first-electronic-quantum-processor","pf":"https://grainger.illinois.edu/about/directory/faculty/wpfaff","ss":"https://physics.berkeley.edu/people/faculty/irfan-siddiqi","sd":"https://adayinthehalflife.buzzsprout.com/1434640/episodes/8627409-quantum-computing","lcv":"https://jila.colorado.edu/sites/default/files/group-files/2021-10/CV_Lehnert2021v4.pdf#page=1","ly":"https://wlab.yale.edu/profile/konrad-lehnert","lc":"https://www.colorado.edu/initiative/cubit/konrad-lehnert-0","fip":"https://fitzpatrick.duke.edu/event/1003","chr":"https://chronicle.uchicago.edu/970925/newfac.shtml","fle":"https://sites.google.com/lbl.gov/fleming-group/group-members/alumni","ch":"https://chemistry.uchicago.edu/faculty/norbert-scherer","ph":"https://thesis.caltech.edu/4693/","opt":"https://www.optica.org/history/biographies/bios/norbert_f_scherer/","tz":"https://pme.uchicago.edu/directory/tian-zhong","tf":"https://www.its.caltech.edu/~aflab/people.html","ti":"https://iqim.caltech.edu/profile/tian-zhong/","sw":"https://pme.uchicago.edu/directory/sihong-wang","sba":"https://baogroup.stanford.edu/people/sihong-wang","sus":"https://viterbi.usc.edu/events/event_details.php?events_id=16568","sucla":"https://www.chemeng.ucla.edu/wp-content/uploads/chemeng/Seminar-Flyer_-Sihong-Wang-1.pdf","zcv":"https://zhang.matse.illinois.edu/files/2018/12/YZhang-CV-Dec-2018.pdf","zi":"https://matse.illinois.edu/directory/faculty/yjz","ba":"https://beckman.illinois.edu/content/uploads/files/annual-reports/annual-report-2014-2015.pdf#page=54","bn":"https://beckman.illinois.edu/news/article/2017/11/21/37b86d2f-0d19-4386-bd1c-9f286cb9fd9c"};
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
const end=(id,note,links)=>rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+note+' '+links);
const scho='人员 - Yale - Robert J. Schoelkopf - f170a4a7';
const mit='人员 - MIT - Isaac Chuang - 8a80431d';
const cv=src(['Schoelkopf 本人 CV 第 3 页','cv']);

for(const [id,history] of [['933e36e2',true],['71dab6c8',false]]){
 const name='David Schuster';
 const phd='Yale 物理系档列 2007 年 5 月 Yale 博士及 Advisor Robert J. Schoelkopf。Schoelkopf 本人 CV 第 2 页单列学位阶段。';
 const pd='Robert J. Schoelkopf 本人 2025 年 11 月 CV 第 3 页在 Past Postdoctoral Advisees 独立列 David Schuster、现 Stanford；Stanford 任用档确认 Yale 和 MIT 两段博士后，Yale 同期新闻核 2009 年仍在 Yale。Yale 博士后导师确证，可信度高。';
 const cand='MIT RLE Quanta 实验室原档在 More alums 列 David Schuster，链接至 Stanford 本人组页，并列 Isaac Chuang 为该组 PI。Stanford 任用档列其 MIT 博士后；校友档未说明组内角色及指导人，保留 MIT 博士后组属候选，可信度中。';
 const pdl=cv+' · '+src(['Stanford 任用原档','qf'],['2009 Yale 同期报道','yn']);
 const can=src(['MIT RLE Quanta 原档','ms'],['Stanford 任用原档','qf']);
 edge(id,name,scho,'Robert J. Schoelkopf','博士后导师','博士后研究者',pd,pdl);
 edge(id,name,mit,'Isaac Chuang','博士后课题组候选','博士后候选研究者',cand,can);
 end(id,phd+' '+pd+' '+cand+(history?' Chicago 为历史任职。':' 现 Stanford 应用物理系。'),pdl+' · '+can);
 cell(id,3,'Robert J. Schoelkopf（Yale 博士后导师）；Isaac Chuang（MIT Quanta 组属候选，正式指导待核）');
 schoolWith(id,pdl+' · '+can);
 const e=audit(id,[a('identity','Yale 2007 博士、Chicago 2010 入职和 Stanford 任用原档与导师名录的同一 David Schuster 对应。',['ya','qf','cv'],'confirmed'),a('affiliation',history?'Chicago 物理系为历史任职，现 Stanford 应用物理系。':'Stanford 应用物理系教授。',['qf','sch'],'confirmed'),a('research','超导量子电路、量子信息、量子硬件与混合系统。',['qf','sch'],'confirmed'),a('phd',phd,['ya','cv'],'confirmed_advisor'),a('postdoc',pd+' '+cand,['cv','qf','yn','ms'],'confirmed_advisor')],'继续找 MIT 博士后聘任月份及具名指导。');
 relation(id,e,'postdoc',scho,'advisor',pd,ids('cv','qf','yn'),'schoelkopf');
 relation(id,e,'postdoc',mit,'candidate',cand,ids('ms','qf'),'chuang');
 page(id,'cv','Schoelkopf’s CV has separate graduate and past postdoctoral advisee lists, both including David Schuster.','核 Yale 两阶段导师。');
 page(id,'qf','Stanford’s appointment bio identifies the 2007 Yale PhD and postdoctoral research at both Yale and MIT before the 2010 Chicago appointment.','核博士、博士后阶段及任职。');
 page(id,'ms','The MIT RLE Quanta group lists David Schuster as an alum and Isaac Chuang as its principal investigator.','MIT 阶段组属候选，未写角色。');
}
{
 const id='9fdbf210',name='Wolfgang Pfaff';
 const pd='Schoelkopf 本人 CV 第 3 页 Past Postdoctoral Advisees 具名 Wolfgang Pfaff、现 Illinois。Illinois 院档核 Yale 应用物理 2014–2017 Postdoctoral Associate、Schoelkopf 实验室。正式博后导师可信度高。';
 const refs=cv+' · '+src(['Illinois 现任及任用履历','pf']);
 updateEdge(id,name,scho,'Robert J. Schoelkopf','博士后课题组负责人','博士后课题组成员','博士后导师','博士后研究者',pd,refs);
 end(id,'Illinois 明确 Delft 2013 博士由 Ronald Hanson 指导。 '+pd,refs);
 cell(id,3,'Robert J. Schoelkopf（Yale 应用物理 2014–2017 博士后导师）');
 schoolWith(id,refs);
 const e=audit(id,[a('identity','Illinois 现任与 Schoelkopf CV 及 Yale 博后年匹配。',['pf','cv'],'confirmed'),a('affiliation','UIUC 物理系，院系履历列 2026 年起副教授。',['pf'],'confirmed'),a('research','超导和混合量子电路、量子网络。',['pf'],'confirmed'),a('postdoc',pd,['cv','pf'],'confirmed_advisor')],'Yale 博士后具名导师已核。');
 audits.at(-1).followup_required=false;
 relation(id,e,'postdoc',scho,'advisor',pd,ids('cv','pf'),'schoelkopf');
 page(id,'cv','Schoelkopf’s former postdoctoral advisee list explicitly names Wolfgang Pfaff.','确证导师职衔。');
 page(id,'pf','Illinois faculty bio lists Yale Applied Physics 2014–2017 postdoctoral associate in the Schoelkopf lab.','核任期、现任和方向。');
}
{
 const id='28c17cbe',name='Irfan Siddiqi';
 const pd='Schoelkopf 本人 CV 第 3 页 Past Postdoctoral Advisees 具名 Irfan Siddiqi、UC Berkeley。Berkeley 物理系明确他 2002 年 Yale 应用物理博士后留校做博后至 2005，原本人访谈列 Michel Devoret 为博后导师。两条具名博士后指导均保存，具体各自任期未分列。';
 const refs=cv+' · '+src(['Berkeley 物理系','ss']);
 edge(id,name,scho,'Robert J. Schoelkopf','博士后导师','博士后研究者',pd,refs);
 end(id,pd+' Daniel E. Prober 为 Yale 2002 博士导师。',refs+' · '+src(['本人访谈','sd']));
 cell(id,3,'Michel Devoret、Robert J. Schoelkopf（Yale 博士后导师）');
 schoolWith(id,refs);
 const e=audit(id,[a('identity','Yale 2002 应用物理博士及 Yale 博后、UC Berkeley 任职与导师 CV 具名身份一致。',['ss','cv'],'confirmed'),a('affiliation','UC Berkeley 物理系和 EECS，Berkeley Lab Faculty Scientist。',['ss'],'confirmed'),a('research','超导量子电路、量子测量和纳米电子学。',['ss'],'confirmed'),a('postdoc',pd,['cv','ss','sd'],'confirmed_advisor')],'如有具名任用，再按日期细分两位导师的指导阶段。');
 relation(id,e,'postdoc',scho,'advisor',pd,ids('cv','ss'),'schoelkopf');
 page(id,'cv','Irfan Siddiqi is a named past postdoctoral advisee in Schoelkopf’s CV.','增列具名博士后导师，保留 Devoret 原记录。');
 page(id,'ss','Berkeley Physics states that he stayed at Yale as a postdoctoral researcher after his 2002 doctorate, until 2005.','核阶段及现任院系。');
}
for(const [id,isYale] of [['91f8f0a1',true],['95f47304',false]]){
 const pd='Lehnert 本人 CV 第 1 页细分 Yale Applied Physics 的 1999 年 8 月至 2001 年 12 月 Post-doctoral Associate 及 2001 年 12 月至 2002 年 12 月 Associate Research Scientist，具名 Advisor Robert J. Schoelkopf。Yale Wright Lab 以 1999–2003 博士后总括同一阶段。Schoelkopf 本人 CV 名单交叉确认博后导师。';
 const links=cv+' · '+src(['Lehnert 本人 CV 第 1 页','lcv'],['Yale Wright Lab','ly']);
 pl(id,boundary,pd+' '+links);
 cell(id,3,'Robert J. Schoelkopf（Yale 1999–2001 博士后导师，后转 Yale Research Scientist）');
 schoolWith(id,links);
 const prior=JSON.parse(last.get(id).details_json);
 const e=audit(id,[a('identity','Yale 与 Colorado 的 Konrad Lehnert 为同一人；本人 CV 与 Yale 院系履历相符。',['ly','lcv','cv'],'confirmed'),a('postdoc',pd,['cv','ly','lcv'],'confirmed_advisor')],isYale?'具名导师与任用分段已核。':(prior.next_step||'核 Colorado 现持续关联。'));
 if(isYale)audits.at(-1).followup_required=false;
 relation(id,e,'postdoc',scho,'advisor',pd,ids('cv','lcv','ly'),'schoelkopf');
 page(id,'lcv','Lehnert distinguishes a Yale postdoc (1999–2001) from Associate Research Scientist (2001–2002) and names Schoelkopf as advisor.','按本人履历细分职位。');
 page(id,'ly','Yale’s biography broadly describes 1999–2003 as a postdoctoral period working with Schoelkopf.','保留与本人 CV 的职位日期口径差异。');
}
{
 const id='d619b9f3',name='Norbert F. Scherer',fle='人员 - UC Berkeley - Graham R. Fleming — 荣休 - 5b832ad4';
 const phd='Caltech 1989 原学位目录 Advisor 栏明确 Ahmed H. Zewail。';
 const pd='Duke FIP 本人讲座档明确在 Chicago 随 Graham Fleming 做 NSF 博士后，Chicago 当期入职档写 1989–1992。Fleming 组档给 1987–1992，保留差异，1989 与 Caltech 学位、院史一致。记博士后阶段研究师长，正式导师职衔待核。';
 const refs=src(['Duke FIP 本人讲座','fip'],['Chicago 1997 入职档','chr'],['Fleming 组档','fle']);
 updateEdge(id,name,fle,'Graham R. Fleming','博士后课题组','博士后课题组成员','博士后阶段研究师长','博士后阶段研究者',pd,refs);
 end(id,phd+' '+pd,refs+' · '+src(['Caltech 学位原档','ph']));
 cell(id,3,'Graham R. Fleming（Chicago NSF 博士后阶段研究师长，1989–1992 据院史）');
 schoolWith(id,refs);
 const e=audit(id,[a('identity','Caltech 原学位全名、Chicago 任用与 Duke、Optica 讲座简介相符。',['ph','chr','fip','opt'],'confirmed'),a('affiliation','Chicago 化学系、James Franck Institute。',['ch','chr'],'confirmed'),a('research','非平衡光学物质、超快光谱与纳米等离激元。',['ch'],'confirmed'),a('phd',phd,['ph'],'confirmed_advisor'),a('postdoc',pd,['fip','chr','fle'],'group_or_candidate')],'查 NSF 具名博士后申请或 1989 Chicago 任用原档的导师字段。');
 relation(id,e,'postdoc',fle,'stage_mentor',pd,ids('fip','chr','fle'),'fleming');
 relation(id,e,'phd','师承人物 - Ahmed Zewail','advisor',phd,ids('ph'),'zewail');
 page(id,'fip','Duke’s invited speaker bio identifies Scherer as an NSF Postdoctoral Fellow with Graham Fleming at the University of Chicago.','核博后具名研究指导。');
 page(id,'chr','Chicago’s 1997 hiring archive lists 1989–1992 as a postdoctoral fellow working with Graham Fleming.','校档日期和角色。');
 page(id,'ph','Caltech Thesis Repository names Ahmed H. Zewail as advisor to Norbert Franz Scherer.','学位原目录。');
}
{
 const id='83530534',name='Tian Zhong',fa='人员 - Caltech - Andrei Faraon - bf44fa1b';
 const pd='Caltech Faraon 课题组原档在 Postdocs 项列 Tian Zhong 2013–2018、后赴 Chicago。IQIM 原档列 Postdoctoral Scholar Alumnus 与 Faraon Group，Chicago PME 核 Caltech 应用物理及材料科学、IQIM 博后。组属可信度高，正式导师待核。';
 const refs=src(['Faraon 组原始名录','tf'],['Caltech IQIM','ti'],['Chicago PME','tz']);
 updateEdge(id,name,fa,'Andrei Faraon','博士后课题组','博士后课题组成员','博士后课题组','博士后课题组成员',pd,refs);
 end(id,pd,refs);
 cell(id,3,'Andrei Faraon（Caltech 2013–2018 博士后课题组）');
 schoolWith(id,refs);
 const e=audit(id,[a('identity','Caltech 组档、IQIM 和 Chicago PME 对应同一现任，MIT 2013 EE 博士。',['tf','ti','tz'],'confirmed'),a('affiliation','Chicago Pritzker School of Molecular Engineering。',['tz'],'confirmed'),a('research','量子光子学、稀土量子材料、量子网络。',['tz'],'confirmed'),a('postdoc',pd,['tf','ti','tz'],'group_or_candidate')],'找 2013–2018 Caltech/IQIM 任用或 fellowship 的正式指导职衔。');
 relation(id,e,'postdoc',fa,'group_leader',pd,ids('tf','ti','tz'),'faraon');
 page(id,'tf','Caltech Faraon Group lists Tian Zhong among former postdocs for 2013–2018, with Chicago as his destination.','确证组属和日期。');
 page(id,'ti','IQIM lists Tian Zhong as a Postdoctoral Scholar Alumnus in the Faraon Group.','核正式任用类型。');
 page(id,'tz','Chicago PME biography lists his MIT 2013 EE doctorate, Caltech postdoc and quantum photonics research.','核身份、现任和方向。');
}
{
 const id='cae0bacb',name='Sihong Wang',bao='人员 - Stanford - Zhenan Bao - d573a8f0';
 const ph='Stanford Bao 组本人资料与 USC 当期候选人讲座均明确 Georgia Tech 博士导师为 Zhong Lin Wang。';
 const pd='Chicago PME 列 Stanford 化工 2015–2018 博士后。USC 和 UCLA 当期讲座明确该阶段与 Zhenan Bao 工作，Stanford 组档核身份和组属。保留正式 advisor 待核，Georgia Tech 的 Zhong Lin Wang 博后组属记录继续保留。';
 const refs=src(['Stanford 组档','sba'],['USC 当期讲座','sus'],['UCLA 当期讲座','sucla'],['Chicago PME','sw']);
 updateEdge(id,name,bao,'Zhenan Bao','博士后课题组','博士后课题组成员','博士后阶段研究师长','博士后阶段研究者',pd,refs);
 end(id,ph+' '+pd,refs);
 cell(id,3,'Zhong Lin Wang（Georgia Tech 博士后课题组）；Zhenan Bao（Stanford 化工 2015–2018 博士后阶段研究师长）');
 schoolWith(id,refs);
 const e=audit(id,[a('identity','Stanford、USC、UCLA 的当期履历与 Chicago 现任匹配。',['sba','sus','sucla','sw'],'confirmed'),a('affiliation','Chicago 分子工程。',['sw'],'confirmed'),a('research','软电子材料、功能高分子电子学与力电物性。',['sw'],'confirmed'),a('phd',ph,['sba','sus'],'confirmed_advisor'),a('postdoc',pd,['sw','sus','sucla','sba'],'group_or_candidate')],'找 Stanford 与 Georgia Tech 的正式博后指导职衔及 Georgia Tech 任用起止。');
 relation(id,e,'postdoc',bao,'stage_mentor',pd,ids('sw','sus','sucla','sba'),'bao');
 relation(id,e,'phd','师承人物 - Zhong Lin Wang','advisor',ph,ids('sba','sus'),'zlw');
 page(id,'sus','The USC 2018 candidate biography identifies PhD supervision by Zhong Lin Wang and a Stanford postdoc working with Zhenan Bao.','当期独立支持两阶段。');
 page(id,'sucla','The UCLA talk flyer identifies Wang as a Stanford Chemical Engineering postdoc working with Zhenan Bao.','核阶段研究关系。');
 page(id,'sw','Chicago PME lists a Stanford Chemical Engineering postdoctoral scholar appointment for 2015–2018.','核任期。');
}
{
 const id='6707f27e';
 const pd='本人 CV 和 Illinois 院系原档均列 2015–2018 Beckman 博士后。Beckman 2014–2015 年报写拟与 Martin Gruebele、Xiuling Li、Joseph W. Lyding 工作，2017 年同时期原报道具体列与 Nadya Mason、Joseph W. Lyding、Matthew Gilbert、Narayana Aluru 合作。Lyding 和 Mason 保留博士后正式导师候选；其余按原文记阶段合作或拟合作。';
 const refs=src(['本人 CV 第 1 页','zcv'],['Beckman 2014–2015 年报','ba'],['Beckman 2017 当期报道','bn'],['Illinois 现任','zi']);
 end(id,'本人 CV 明确 Salmeron 与 Alivisatos 为 Berkeley 2015 博士导师。 '+pd,refs);
 cell(id,3,'Beckman 2015–2018；Joseph W. Lyding、Nadya Mason（具名阶段合作，正式导师待核）');
 schoolWith(id,refs);
 audit(id,[a('identity','本人 CV 与 Illinois 教师、Beckman 历史原档的学位和任用匹配。',['zcv','zi','bn'],'confirmed'),a('affiliation','UIUC 材料科学与工程系副教授。',['zi'],'confirmed'),a('research','二维材料、软材料和固液界面、扫描探针及电子输运。',['zi','bn'],'confirmed'),a('postdoc',pd,['zcv','zi','ba','bn'],'group_or_candidate')],'找 Beckman Fellowship 具名 faculty mentor/host。保存 2015 拟合作与 2017 当期合作的区别。');
 page(id,'ba','2014–2015 Beckman report identifies proposed work with Gruebele, Xiuling Li and Lyding.','该条是拟合作。');
 page(id,'bn','2017 Beckman report identifies active collaborations with Mason, Lyding, Gilbert and Aluru.','保留关系边界。');
 page(id,'zi','Illinois faculty bio identifies the current Materials Science and Engineering appointment and three-year Beckman Postdoctoral Fellowship.','核现任和博士后阶段。');
}
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0721_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0721_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0721_Schoelkopf指导与Chicago任用原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
