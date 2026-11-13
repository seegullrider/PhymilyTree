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
 a.audit_id='20261110_'+id+'_named_supervision_and_appointments';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_named_supervision_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

function addRelation(id,label,target,display,detail,inverseLabel){
 const r=records.get(id);
 editLine(fn(r.filename),l=>l==='## 师承',l=>l+'\n\n- '+label+'：[['+target+'|'+display+']]。'+detail);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- '+inverseLabel+'：[['+r.filename+'|'+r.name+']]。'+detail);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+label+'：[['+target+'|'+display+']]。'+detail);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);
}
const poz='e79ec8dc', walker=local('172f9aab');
const pcv='https://neutronscattering.org/wp-content/uploads/2014/12/Pozzo_CV.pdf';
const pUw='https://mse.washington.edu/facultyfinder/lilo-pozzo';
const pStan='https://mse.stanford.edu/events/mse-colloquium/autonomous-experiments-and-accessible-automation-soft-matter-research';
const pozPhd='本人 CV 在 2006 年 Carnegie Mellon 化学工程博士及论文题目下明确列 Thesis Advisor: Lynn M. Walker；CMU 本人采访与 Stanford 讲座研究经历相符。';
const pa=audit(poz,{
 phd:['confirmed_advisor',pozPhd,[pcv,pStan]],
 postdoc:['unresolved','本人 CV 单列 2006–2007 NIST Center for Neutron Research 博后，未具名指导者；NCNR 历史年报网页未取得正文。',[pcv]],
 affiliation:['confirmed','UW 教师档列化学工程教授及 Human Centered Design & Engineering 兼职；MolES 教师目录列其名字。',[pUw,'https://staging.moles.washington.edu/faculty/']],
 research:['confirmed','UW 教师档及 Stanford 讲座对应软材料自组装、中子与 X 射线散射、流变和实验自动化。',[pUw,pStan]]
},'查 NIST NCNR 2006–2007 个人任命或项目指导原件。');
enrich(poz,'phd',walker,'博士生',web('本人 CV',pcv)+'明确列 Thesis Advisor，博士题目为 Templating Nanoparticles using Thermo-reversible Soft Crystals。');
row(poz,web('本人 CV',pcv)+' · '+web('UW 教师档',pUw));
relation(poz,'phd',walker,'advisor',pozPhd,[pcv,pStan],pa);

const shao='ee9d30dd', alam=local('753cf50b');
const pS='https://materials.princeton.edu/events/2026/pmiece-special-seminar-yanjie-shao-massachusetts-institute-technology';
const sS='https://shaolab.stanford.edu/people/yanjie-shao';
const shaPhd='本人 Stanford 实验室和 Princeton 2026 讲座明确 2023 MIT 电气工程博士 advised by Jesús del Alamo，Princeton 同列 2021 MIT 硕士。';
const sa=audit(shao,{
 identity:['confirmed','Stanford EE 本人组页与 Princeton 讲座吻合；另一个搜索命中 Yijia Shao 属 Stanford 计算机科学、自然语言处理，已排除。',[sS,pS]],
 affiliation:['confirmed','Stanford 本人组页明确 2026 年 8 月起为 EE 助理教授。',[sS]],
 phd:['confirmed_advisor',shaPhd,[sS,pS]],
 postdoc:['confirmed_advisor','Princeton 与本人组页都证实 MIT MTL 博后与 del Alamo 和 Antoniadis 共事。历史 MIT 摘要集的 del Alamo 具名监督记录保留，本轮摘要集原文不可读，Antoniadis 仍为博后合作。',[pS,sS]]
},'继续查可读 MIT 博后摘要集与 Antoniadis 是否为正式共同导师。');
enrich(shao,'phd',alam,'博士生',web('Princeton 讲座本人履历',pS)+'明确列 2023 MIT 博士及 advisor Jesús del Alamo。');
enrich(shao,'postdoc',alam,'博士后研究者',web('Princeton 讲座履历',pS)+'核实 MIT MTL 博后与两位研究者共事；历史摘要集的监督称谓另保留。');
changeRow(shao,'Jesús del Alamo（2023 MIT 博士导师）','Jesús del Alamo（旧 MIT 摘要集指名监督）、Dimitri A. Antoniadis（博士后合作）',web('Princeton 讲座',pS));
relation(shao,'phd',alam,'advisor',shaPhd,[sS,pS],sa);

const tov='ffaed504', tovCv='https://krieger.jhu.edu/chem/wp-content/uploads/sites/72/2016/03/TovarCV_Aug2025_web-fixed.pdf';
const tovOld='https://sites.krieger.jhu.edu/tovar-group/files/2021/07/TovarCV_July2021_web.pdf';
audit(tov,{postdoc:['group_or_candidate','2025 本人 CV 分列 2002 MIT 博士及 2002–2005 Northwestern 材料系 Baxter 博后，并在博后职位下具名 Stupp 与 Hersam；2021 CV 同样用 with，按阶段研究师长。',[tovCv,tovOld]]},'追查 Northwestern 博后任命或 fellowship 的具名 advisor 字段。');
for(const m of [local('24f262f5'),local('b4a10b34')]){
 const proof=' '+web('本人 CV',tovCv)+'将该人列在 Northwestern 2002–2005 Baxter 博后职位下，关系措辞为 with。';
 replaceNoteLabel(tov,'博士后阶段研究关联者','博士后阶段研究师长',m,proof);
 replaceInverseLabel(m,tov,'博士后阶段研究关联者','博士后阶段研究者',proof);
 replaceIndexLabel(tov,m,'博士后阶段研究关联者','博士后阶段研究师长',proof);
}
editLine(fn(local(tov)),l=>l.startsWith('- 核查边界：'),l=>l.replace('标研究关联者','标阶段研究师长'));
row(tov,web('本人 2021 CV',tovOld),'Samuel I. Stupp、Mark C. Hersam（Northwestern 2002–2005 博后阶段师长，正式职衔待核）');

const ep='af3eeb13', xie='师承人物 - X. Sunney Xie';
const epU='https://scholarconnect.uci.edu/epotma', epW='https://www.chem.uci.edu/~potma/Wang_AOP11.pdf';
const epText='UCI 官方履历明确 Harvard 博后工作 under the supervision of X. S. Xie；本人署名论文履历确认 2001–2005 在 Harvard Xie 组。';
const epa=audit(ep,{postdoc:['confirmed_advisor',epText,[epU,epW]]},'博士和博后均具名；如取得 Harvard 博后任命原件，补记正式文件。');
enrich(ep,'postdoc',xie,'博士后研究者',web('本人论文履历',epW)+'与 UCI 具名监督资料相符。');
row(ep,web('UCI 本人履历',epU));
relation(ep,'postdoc',xie,'advisor',epText,[epU,epW],epa,false);

const sail='78a59ff6', shr='师承人物 - Duward F. Shriver', lew='师承人物 - Nathan S. Lewis';
const sailCv='https://sailorgroup.ucsd.edu/wp-content/uploads/2024/08/Sailor_CV_Full_Aug_2024.pdf';
const sailPhd='本人 CV 将 1983–1988 Northwestern 无机化学博士列在 Duward F. Shriver 指导下，博士论文研究三核钌羰基团簇。';
const sailPost='本人 CV 明确 1988–1990 Stanford 与 Caltech 博后职位 directed by Nathan S. Lewis，研究半导体／聚合物界面；CV 未按两校分别给起止。';
const sla=audit(sail,{phd:['confirmed_advisor',sailPhd,[sailCv]],postdoc:['confirmed_advisor',sailPost,[sailCv]]},'追查 Northwestern 学位原档和 Stanford／Caltech 两段各自日期。');
enrich(sail,'phd',shr,'博士生',web('本人 CV 首页',sailCv)+'将 Shriver 的指导与 Northwestern 1983–1988 博士及论文题目同列。');
enrich(sail,'postdoc',lew,'博士后研究者',web('本人 CV 首页',sailCv)+'明确写 1988–1990 Stanford／Caltech 博后由 Lewis 指导。');
row(sail,web('本人 CV 分段履历',sailCv),'Nathan S. Lewis（Stanford／Caltech 1988–1990，具体分段日期待查）');
relation(sail,'phd',shr,'advisor',sailPhd,[sailCv],sla,false);
relation(sail,'postdoc',lew,'advisor',sailPost,[sailCv],sla,false);


const hel='39e28ce8', doyle=local('4d4631e7');
const helAc='https://www.colloidssurfaces.org/wp-content/uploads/2024/03/2016-CSSS-Harvard-Program-Booklet.pdf';
const helDel='https://www1.udel.edu/udaily/2012/jul/chem-engineering-honors-071311.html';
const helM='https://mrlweb.mrl.ucsb.edu/sites/default/files/mrl_docs/2015-UCSB-MRSEC-AnnualReport-BOOKLET.pdf';
const helText='2016 ACS 会议简介明确 2009–2012 MIT Novartis-MIT Center 博士后项目 under the supervision of Patrick Doyle；Delaware 学校报道确认 MIT 博后。既有 UCSB 年报的具名 supervisor 证据保留，本轮年报未取得正文。';
const ha=audit(hel,{postdoc:['confirmed_advisor',helText,[helAc,helDel,helM]]},'博士后具名证据已对齐；继续查 Delaware 论文原件与博士共同签署角色。');
enrich(hel,'postdoc',doyle,'博士后研究者',web('2016 ACS 简介原页',helAc+'#page=14')+'具体列出 2009–2012 MIT 博士后项目及具名指导。');
row(hel,web('2016 ACS 简介',helAc)+' · '+web('Delaware 论文奖公告',helDel),'Patrick S. Doyle（MIT 2009–2012 博士后项目导师）');
relation(hel,'postdoc',doyle,'advisor',helText,[helAc,helDel,helM],ha,false);

const yan='803e2840', ton='师承人物 - Mehmet Toner', alt='师承人物 - Hatice Altug';
const yLab='https://www.yaniklab.science/the-team';
const yP='https://docs.lib.purdue.edu/dissertations/AAI3291109/';
const yBu='https://www.bu.edu/eng/files/2022/08/ece.annualreport.08.09.pdf';
const yA='https://www.epfl.ch/labs/bios/wp-content/uploads/2018/10/2014_CV_Altug_Short.pdf';
const yT='本人组页将 Harvard Medical School／Massachusetts General Hospital 博后明确列在 Mehmet Toner 指导下；BU／Altug 经历分开，Harvard 博后起止仍待核。';
const ya=audit(yan,{phd:['confirmed_advisor','Purdue 学位馆藏明确 Advisor Datta，论文致谢区分 Datta 与 second mentor Gerhard Klimeck。',[yP]],postdoc:['confirmed_advisor',yT+' BU 年报在 Research Associate 栏正式列 Advisor Altug，Altug 的博后指导名单写 2008–2012、EPFL 组表写 2007–2010，保留两口径和岗位名称。',[yLab,yBu,yA]]},'查 HMS／MGH 与 BU 任命起止以及两份名单的不同日期口径。');
enrich(yan,'postdoc',ton,'博士后受指导者',web('本人实验室简介',yLab)+'分开描述 Toner 指导的 HMS／MGH 博后与 BU 的研究工作。');
const yDoc=web('Purdue 学位档',yP)+'明确列 Advisor Datta；论文致谢另列 Klimeck 为阶段师长。';
note(yan,'- 博士导师：',yDoc);
indexLine(yan,local('5d54f243'),'博士导师',yDoc);
note(yan,'- 博士后阶段研究师长：',web('Altug 指导名单',yA)+'写 2008–2012，与 EPFL 组表 2007–2010 并列。');
row(yan,web('Purdue 学位档',yP)+' · '+web('BU 同期年报',yBu),'Mehmet Toner（HMS／MGH 博士后导师）；Hatice Altug（BU Research Associate Advisor／博后阶段师长；年份待核）');
relation(yan,'postdoc',ton,'advisor',yT,[yLab],ya,false);

const raf='a8855a56', west='师承人物 - Harry Westfahl Jr', schm='师承人物 - Joerg Schmalian';
const mill=local('2c80d694'), bala=local('62a6aa63');
const rf='https://icmt.illinois.edu/people/rafael-fernandes';
const rb='https://www.colorado.edu/conference/bss/2008/boulder-school-2008-roster';
const scv='https://www.tkm.kit.edu/downloads/CV_JOERG_SCHMALIAN_KIT_2024_en.pdf';
const rPh='2008 Boulder School 官方名册 Unicamp 人员栏列 Fernandes 的 Advisor Harry Westfahl Jr.；Illinois 院系明确 Westfahl 指导其 2008 Unicamp 博士。';
const r1='Illinois 院系明确 2008–2011 Ames／Iowa State 博后由 Joerg Schmalian 指导；Schmalian 本人训练名册列同期。';
const r2='Illinois 院系明确 2011–2012 Columbia／Los Alamos 联合博后由 Andrew Millis 和 Alexander Balatsky 指导。';
const rfAudit=audit(raf,{phd:['confirmed_advisor',rPh,[rf,rb]],postdoc:['confirmed_advisor',r1+' '+r2,[rf,scv]]},'博士论文签署待核；保留两段博士后指导和机构差别。');
enrich(raf,'phd',west,'博士生',web('Boulder School 2008 名册',rb)+'同条列其 Unicamp 身份与 Advisor。');
enrich(raf,'postdoc',schm,'博士后研究者',web('Schmalian 本人 CV',scv)+'列同期博后训练。');
for(const m of [mill,bala])enrich(raf,'postdoc',m,'博士后研究者',web('Illinois 院系履历',rf)+'明确两位共同指导 Columbia／Los Alamos 联合聘任。');
row(raf,web('Boulder 2008 名册',rb)+' · '+web('Schmalian 本人 CV',scv),'Joerg Schmalian（Ames／Iowa State 2008–2011）；Andrew Millis、Alexander Balatsky（Columbia／Los Alamos 2011–2012）');
relation(raf,'phd',west,'advisor',rPh,[rb,rf],rfAudit,false);
relation(raf,'postdoc',schm,'advisor',r1,[rf,scv],rfAudit,false);
for(const m of [mill,bala])relation(raf,'postdoc',m,'advisor',r2,[rf],rfAudit,false);

const syz='7df7541a', efe='师承人物 - K. B. Efetov';
const syzCv='https://syzranov.org/docs/CV.pdf', syzHome='https://syzranov.org/';
const szPhd='Syzranov 本人 CV 明确称 2007–2011 Ruhr-Universität Bochum PhD student supervised by K. B. Efetov，学位栏另列理论物理博士。';
const szPost='本人 CV 列 2011-10 至 2013-09 Karlsruhe Institute of Technology Research Associate（Wissenschaftlicher Mitarbeiter）。Schmalian 的训练名册称同一时期为 postdoc，核为组属，正式个人 advisor 字段待查。Colorado Rey 组与 Maryland Gorshkov 联合指导继续分列。';
const sza=audit(syz,{phd:['confirmed_advisor',szPhd,[syzCv]],postdoc:['confirmed_advisor',szPost,[syzCv,scv]],affiliation:['confirmed','本人 CV 和主页对应 UCSC 物理系副教授。',[syzCv,syzHome]]},'查 KIT 正式个人指导、Colorado 阶段日期口径及 Maryland 联合指导的另一人。');
const szText=web('Schmalian 本人训练名册',scv)+'列 2011–2013 博后；'+web('Syzranov 本人 CV',syzCv)+'列同期 KIT Research Associate。关系按博士后组属。';
addRelation(syz,'博士后课题组负责人',schm,'Joerg Schmalian',szText,'博士后课题组成员');
row(syz,web('Schmalian 本人 CV',scv),'Joerg Schmalian（KIT 2011–2013 博后组属）；Ana Maria Rey（Colorado 博后组属）；Alexey Gorshkov（Maryland 博后联合导师，另一人待核）');
relation(syz,'phd',efe,'advisor',szPhd,[syzCv],sza,false);
relation(syz,'postdoc',schm,'group_leader',szPost,[syzCv,scv],sza);

const hA='https://www.aps.anl.gov/sites/www.aps.anl.gov/files/APS-Uploads/APS-Colloquium/18_7_Westfahl.pdf';
const hLink=web('Schmalian 本人训练名册',scv)+'列 1999–2002 博后；'+web('Argonne APS 报告履历',hA)+'确认 Westfahl 曾在 Illinois 和 Ames 做博士后，并列 2001 开始在巴西同步辐射实验室任职。名册的起止与各段聘任的对应待核。';
editLine(fn(west),l=>l==='## 师承',l=>l+'\n\n- 博士后课题组负责人：[['+schm+'|Joerg Schmalian]]。'+hLink);
editLine(fn(schm),l=>l==='## 师承',l=>l+'\n\n- 博士后课题组成员：[['+west+'|Harry Westfahl Jr.]]。'+hLink);
editLine(idx,l=>l.startsWith('- [['+local(raf)+'|')&&l.includes(' → 博士导师：')&&l.includes('[['+west+'|'),l=>l+'\n- [['+west+'|Harry Westfahl Jr.]] → 博士后课题组负责人：[['+schm+'|Joerg Schmalian]]。'+hLink);
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0510';
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

