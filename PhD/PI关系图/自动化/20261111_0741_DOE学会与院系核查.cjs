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
 orig.audit_id='pi_archive_20261111_0741_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0741_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"doe":"https://science.osti.gov/-/media/_/pdf/about/honors-and-awards/pecase/2009_pecase.pdf#page=10","scv":"https://www1.cuny.edu/sites/energy/wp-content/uploads/sites/43/2024/11/stephen_obrien_cv_nov_2024.pdf#page=9","cuny":"https://www.ccny.cuny.edu/profiles/stephen-obrien","rsc":"https://www.rsc.org/people/elena-shevchenko","chi":"https://physicalsciences.uchicago.edu/news/article/new-faculty-in-the-physical-sciences-division-20/","arg":"https://www.anl.gov/profile/elena-shevchenko","penn":"https://www.seas.upenn.edu/~murray/","cv23":"https://gagliardigroup.uchicago.edu/wp-content/uploads/2023/11/2023_12_01_Gagliardi_cv_2pages.pdf#page=1","cv26":"https://gagliardigroup.uchicago.edu/wp-content/uploads/2021/10/2026_02_23_Gagliardi_2pages.pdf#page=1","gc":"https://chemistry.uchicago.edu/laura-gagliardi","acs":"https://onlinelibrary.wiley.com/doi/full/10.1002/anie.202001537","ka":"https://kapitulnik.stanford.edu/people","duke":"https://mems.duke.edu/people/david-mitzi/","mitzi":"https://searchworks.stanford.edu/view/673854","la":"https://freedmanlab-mit.com/MIT/freedman/alumni/index.html","lac":"https://chemistry.uchicago.edu/faculty/daniel-laorenza","lah":"https://www.chemistry.harvard.edu/people/daniel-laorenza","lab":"https://www.beckman-foundation.org/people/daniel-laorenza/","laf":"https://www.chemistry.harvard.edu/news/two-ccb-postdocs-awarded-2024-beckman-postdoctoral-fellowships","lath":"https://bpb-us-e1.wpmucdn.com/sites/northwestern.edu/dist/6/32/files/2021/06/Freedman-CV-2021-MIT-6-15-21.pdf","laweb":"https://www.laorenzalab.org/people","jac":"https://chemistry.uchicago.edu/faculty/john-anderson","jai":"https://climate.uchicago.edu/people/john-anderson/","jat":"https://thesis.caltech.edu/7959/","nw":"https://chemistry.northwestern.edu/documents/about/bulletin/Sep302013.pdf#page=1","lcv":"https://umdphysics.umd.edu/images/CV/levin_cv.pdf#page=1","hf":"https://socfell.fas.harvard.edu/2000-2009","sag":"https://sachdev.physics.harvard.edu/people-all","lp":"https://physics.uchicago.edu/people/profile/michael-levin/","da":"https://pme.uchicago.edu/directory/david-awschalom","il":"https://ws.engr.illinois.edu/sitemanager/getfile.asp?id=2550","swiss":"https://swissnanoconvention.ch/2013/wp-content/uploads/2011/10/David-D.-Awschalom.pdf","aps":"https://doi.org/10.1103/PhysRevB.25.4185"};
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




const s='65210a94', g='3c53a8f4', m='b4ea6398', l='ba0da93c', j='10b0509d', v='1277e820', d='d5d8b990';
const ob='师承人物 - Stephen O’Brien', mu=records.get('2fc11ca6').filename;
const joint='美国 DOE 的 2009 PECASE 原档第 10 页明确列 2003–2005 年 Columbia／IBM T. J. Watson 联合博士后，并分别具名 Stephen O’Brien 和 Christopher Murray。';
const sob=joint+' O’Brien 本人 CV 第 9 页也将 Shevchenko 列作 Columbia 博士后校友。按博士后阶段研究师长记录，正式 advisor 职衔待核。';
const smu=joint+' RSC 履历独立确认联合博士后及任期。按 IBM 博士后阶段研究师长记录，正式 advisor 职衔待核。';
mentor(ob,'Stephen O’Brien','City College of New York 化学教授。曾在 Columbia 任教，研究纳米晶和纳米复合材料。',src(['CCNY 院系履历','cuny']));
edge(s,'Elena V. Shevchenko',ob,'Stephen O’Brien','博士后阶段研究师长','博士后阶段研究者',sob,src(['DOE PECASE 原档','doe'],['O’Brien 本人 CV','scv'],['CCNY 院系履历','cuny']));
edge(s,'Elena V. Shevchenko',mu,'Christopher B. Murray','博士后阶段研究师长','博士后阶段研究者',smu,src(['DOE PECASE 原档','doe'],['RSC 履历','rsc']));
rewrite(pf(s),x=>x.startsWith(boundary),()=>boundary+'Columbia／IBM 2003–2005 联合博士后有两位具名研究师长。Chicago 历史任用原档列兼职 Chemistry，RSC 履历核 Argonne CNM、纳米晶自组装与纳米材料。Hamburg 博士导师 Weller 的既有记录保留，Argonne 页面本轮 403。 '+src(['DOE 原档','doe'],['Chicago 任用','chi'],['RSC 履历','rsc']));
cell(s,3,'Stephen O’Brien（Columbia 博士后阶段研究师长）；Christopher B. Murray（IBM 博士后阶段研究师长）；2003–2005 联合任用');
schoolWith(s,src(['DOE 原档','doe'],['O’Brien 本人 CV','scv'],['Chicago 任用','chi']));
const sa=audit(s,[a('identity','DOE 履历与 RSC 的 Hamburg 博士、Columbia／IBM 联合博后和 Argonne 去向相符。',['doe','rsc'],'confirmed'),a('affiliation','Chicago 原档列 Chemistry 兼职，RSC 列 Argonne Center for Nanoscale Materials。',['chi','rsc'],'confirmed'),a('research','纳米晶成核、自组装和功能纳米材料。',['chi','rsc'],'confirmed'),a('postdoc',sob+' '+smu,['doe','rsc','scv','cuny'],'group_or_candidate')],'查 Columbia 与 IBM 当期任用或本人完整 CV 的指导职衔，并寻 Hamburg 博士原档补核 Weller。');
relation(s,sa,'postdoc',ob,'stage_mentor',sob,ids('doe','scv','cuny'),'obrien');
relation(s,sa,'postdoc',mu,'stage_mentor',smu,ids('doe','rsc'),'murray');

const be='师承人物 - Gian Luigi Bendazzoli', ha='师承人物 - Nicholas C. Handy';
const gd='本人 2023 年 12 月 CV 第 1 页明列 1997 年 Bologna 博士和 Ph.D. advisor Gian Luigi Bendazzoli，2020 获奖档独立确认。';
const gh='2020 获奖档明确 Cambridge 博士后阶段与 Nicholas Handy 工作；本人 2023 CV 报 1998–1999，2026 CV 列 1998–2000。具名研究师长可信度高，正式称谓待核。';
const gb='本人 2026 CV 第 1 页另列 Bologna 2000–2002 博士后。2023 CV 把 Bologna 写为 Research Associate 2000–2001，两版年份和职衔按原档分列，Bologna 阶段指导者尚待核。';
updateEdge(g,'Laura Gagliardi',be,'Gian Luigi Bendazzoli','博士导师','博士生','博士导师','博士生',gd,src(['本人 2023 CV','cv23'],['ACS 获奖档','acs']));
updateEdge(g,'Laura Gagliardi',ha,'Nicholas C. Handy','博士后研究师长','博士后阶段研究者','博士后阶段研究师长','博士后阶段研究者',gh,src(['ACS 获奖档','acs'],['本人 2023 CV','cv23'],['本人 2026 CV','cv26']));
rewrite(pf(g),x=>x.startsWith(boundary),()=>boundary+gb+' 本人 CV 及 Chicago 系页核 Chemistry、PME、James Franck Institute 与量子化学方法、计算材料电子结构。 '+src(['本人 2023 CV','cv23'],['本人 2026 CV','cv26'],['Chicago 化学系','gc']));
cell(g,2,'Gian Luigi Bendazzoli（Bologna 博士导师，1997）');
cell(g,3,'Nicholas C. Handy（Cambridge 博士后阶段研究师长，任期见两版 CV）；Bologna 2000–2002（2026 CV 列博士后，指导者待核）');
schoolWith(g,src(['本人 2023 CV','cv23'],['本人 2026 CV','cv26']));
const ga=audit(g,[a('identity','两版本人 CV 与 Chicago 院系一致。',['cv23','cv26','gc'],'confirmed'),a('affiliation','Chicago Chemistry、Pritzker School of Molecular Engineering、James Franck Institute。',['cv23','cv26','gc'],'confirmed'),a('research','强关联电子系统量子化学和第一性原理计算材料，应用于催化与材料光谱。',['cv23','gc'],'confirmed'),a('phd',gd,['cv23','acs'],'confirmed_advisor'),a('postdoc',gh+' '+gb,['acs','cv23','cv26'],'group_or_candidate')],'查 Cambridge 任用或 fellowship 的正式指导称谓，以及 Bologna 博士后阶段聘书和指导者。');
relation(g,ga,'phd',be,'advisor',gd,ids('cv23','acs'),'bendazzoli');
relation(g,ga,'postdoc',ha,'stage_mentor',gh,ids('acs','cv23','cv26'),'handy');

const kp=records.get('614fbb10').filename;
const md='2020 ACS 获奖履历明确 Stanford 应用物理博士由 Aharon Kapitulnik 指导，Kapitulnik 本人组页 PhD Students 项下列 1990 年 David B. Mitzi；Duke 原档核该学位。';
const mp='ACS 获奖履历列 1990–2009 IBM Research Staff Member、2009–2014 光伏部门经理，Duke 系页核自 Stanford 博士至 IBM、后至 Duke 的任职顺序。公开履历未发现单列博士后任用。';
updateEdge(m,'David Mitzi',kp,'Aharon Kapitulnik','博士课题组负责人','博士课题组成员','博士导师','博士生',md,src(['ACS 获奖档','acs'],['Stanford 组档','ka'],['Duke 工程系','duke']));
rewrite(pf(m),x=>x.startsWith(boundary),()=>boundary+mp+' Stanford 馆藏论文号 3781 1990 M 和博士导师来源分列。 '+src(['Stanford 馆藏','mitzi'],['ACS 获奖档','acs'],['Duke 工程系','duke']));
cell(m,2,'Aharon Kapitulnik（Stanford 应用物理博士导师，1990）');
cell(m,3,'未发现单列博士后；1990 年起任 IBM Research Staff Member');
schoolWith(m,src(['ACS 获奖档','acs'],['Stanford 组档','ka']));
const ma=audit(m,[a('identity','Duke、Stanford 导师组和获奖档的学位、全名及履历一致。',['duke','ka','acs'],'confirmed'),a('affiliation','Duke 机械工程与材料科学、化学教授。',['duke'],'confirmed'),a('research','钙钛矿半导体和光伏等电子材料，薄膜吸收层。',['duke','acs'],'confirmed'),a('phd',md,['acs','ka','duke'],'confirmed_advisor'),a('postdoc',mp,['acs','duke'],'no_postdoc_documented')],'保留未发现单列博士后标签，如发现 1990 年同期任命原档再核。');
relation(m,ma,'phd',kp,'advisor',md,ids('acs','ka','duke'),'kapitulnik');

const df=records.get('b5c07133').filename, jm=records.get('7b575161').filename;
const ld='Freedman 实验室校友页在博士生下具名 Daniel Laorenza、2023 年博士及 Chicago 现任。Harvard 当期原报道列 2023 MIT 博士及在 Freedman 指导团队开展分子量子位研究，和 Chicago 教师原档一致。正式学位论文导师栏仍待核。';
const lm='Beckman 2024 博士后项目原档在 Faculty Mentor 一栏明确 Jarad Mason；Harvard 本人院系目录标 Post-Doctoral Fellow 和 Mason 组属，Harvard 奖助报道与此前本人 advisor 记载一致。';
updateEdge(l,'Dan Laorenza',df,'Danna Freedman','博士阶段课题组负责人','博士阶段课题组成员','博士阶段课题组负责人','博士阶段课题组成员',ld,src(['Freedman 组档','la'],['Harvard 当期报道','laf'],['Chicago 现任','lac']));
updateEdge(l,'Dan Laorenza',jm,'Jarad Mason','博士后导师','博士后研究者','博士后导师','博士后研究者',lm,src(['Beckman 项目原档','lab'],['Harvard 本人院系目录','lah'],['Harvard 当期报道','laf']));
pl(l,boundary,'Freedman 组的博士校友表也将年份列为 2023。 '+src(['Freedman 原组档','la']));
schoolWith(l,src(['Freedman 原组档','la'],['Harvard 本人院系目录','lah'],['Beckman 原档','lab']));
const la=audit(l,[a('identity','MIT／Harvard 早期履历和现任 Chicago 身份一致，Freedman 组档可直达本人现组。',['la','laf','lac'],'confirmed'),a('affiliation','Chicago 化学系助理教授。',['lac'],'confirmed'),a('research','分子自旋、晶格声子及光学量子态，可编程响应材料。',['lac'],'confirmed'),a('phd',ld,['la','laf','lac'],'group_or_candidate'),a('postdoc',lm,['lab','lah','laf'],'confirmed_advisor')],'追 MIT 学位论文封面和学位目录的 advisor 栏。');
relation(l,la,'phd',df,'group_leader',ld,ids('la','laf','lac'),'freedman');
relation(l,la,'postdoc',jm,'advisor',lm,ids('lab','lah','laf'),'mason');

const hh='师承人物 - T. David Harris';
const jp='Caltech 学位馆藏列 2014 年 John Stuart Anderson 的化学博士论文，Advisor 为 Jonas C. Peters。Chicago 个人履历交叉核实同一人的学位和题名方向。';
const jh='Northwestern 化学系 2013 年 9 月 30 日当期简报记 John Anderson 加入 Harris 组。Chicago 两份原档分别核 Northwestern 博士后及在 Harris 实验室研究 MOFs。按博士后课题组负责人记录，正式指导职衔待核。';
updateEdge(j,'John Anderson',hh,'T. David Harris','博士后课题组','博士后课题组成员','博士后课题组','博士后课题组成员',jh,src(['Northwestern 当期简报','nw'],['Chicago 本人简介','jai'],['Chicago 化学系','jac']));
pl(j,boundary,'Northwestern 当期简报独立核其 2013 年 9 月已到 Harris 组，Caltech 馆藏论文年为 2014，两项分别保留。 '+src(['Northwestern 当期简报','nw']));
cell(j,3,'T. David Harris（Northwestern 博士后课题组；2013 年 9 月简报记到组）');
schoolWith(j,src(['Northwestern 当期简报','nw'],['Chicago 化学系','jac']));
const ja=audit(j,[a('identity','John Stuart Anderson 的 Caltech 原卷、Chicago 本人履历与 Northwestern 当期记录相符。',['jat','jai','nw'],'confirmed'),a('affiliation','Chicago 化学系，Institute for Climate and Sustainable Growth 人物页。',['jac','jai'],'confirmed'),a('research','配位化学、分子及框架材料，连接过渡金属自旋、反应性与材料性质。',['jac','jai'],'confirmed'),a('phd',jp,['jat','jai'],'confirmed_advisor'),a('postdoc',jh,['nw','jai','jac'],'group_or_candidate')],'核实际学位授予日和 Northwestern 博士后指导职衔。');
relation(j,ja,'postdoc',hh,'group_leader',jh,ids('nw','jai','jac'),'harris');

const fi=records.get('e180d959').filename;
const vf='本人 CV 在 UCSB 2008-02 至 2009-02 Postdoctoral Researcher 条目同一行具名 Matthew P. A. Fisher，未列 advisor 或 supervisor。Harvard Society of Fellows 名录列 Junior Fellow 为 2006–08、2009–10，支持分列该段 UCSB 博后。CV 对 Harvard 用 2006-07 至 2010-07 总跨度。Fisher 保留博士后研究关联，指导称谓待查。';
updateEdge(v,'Michael Levin',fi,'Matthew P. A. Fisher','博士后研究关联者','博士后研究关联者','博士后研究关联者','博士后研究关联者',vf,src(['本人 CV','lcv'],['Harvard Society of Fellows 原档','hf']));
rewrite(pf(v),x=>x.startsWith(boundary),()=>boundary+'MIT 博士论文导师文小刚。Harvard 原名录的 Junior Fellow 任期分列 2006–08、2009–10，CV 写 2006-07 至 2010-07，总跨度内另有 2008-02 至 2009-02 UCSB 博后。Sachdev 组原档列入 Postdocs，具体任用、时间及正式指导职衔待查。 '+src(['本人 CV','lcv'],['Harvard 原名录','hf'],['Sachdev 组档','sag']));
cell(v,3,'Matthew P. A. Fisher（UCSB 2008–2009 博士后研究关联）；Harvard Junior Fellow 2006–08、2009–10；Subir Sachdev（组档 Postdocs，具体日期和正式指导职衔待核）');
schoolWith(v,src(['Harvard 原名录','hf'],['Sachdev 组档','sag']));
const va=audit(v,[a('identity','Harvard 原名录列凝聚态物理研究者 Michael Levin，并直接链接 Chicago 物理系，与本人履历相符。',['hf','lcv','lp'],'confirmed'),a('affiliation','Chicago 物理系。',['lp'],'confirmed'),a('research','理论凝聚态物理、强关联与拓扑量子多体相。',['lp'],'confirmed'),a('postdoc',vf+' Sachdev 组档保留具体日期未明的组属。',['lcv','hf','sag'],'group_or_candidate')],'继续找 UCSB 任用或组档中的正式指导称谓，并核 Harvard Fellowship 期间与 Sachdev 组的具体关系。');
relation(v,va,'postdoc',fi,'candidate',vf,ids('lcv','hf'),'fisher');

const dc='Illinois 2005 校友档列 1978 年 Illinois 学士、Cornell 实验物理博士、IBM Watson 研究人员和部门经理，继而 1991 年 UCSB。Chicago 现任原档与早期任用轨迹一致；目前公开履历未给 IBM 研究职务的起始年月或另列博士后。';
pl(d,boundary,dc+' '+src(['Illinois 校友原档','il'],['Chicago PME','da'],['2013 会议履历','swiss']));
schoolWith(d,src(['Illinois 校友原档','il'],['Chicago PME','da']));
audit(d,[a('identity','Illinois 校友和 Chicago 任用原档确认同一人及 Cornell 实验物理博士。',['il','da','swiss'],'confirmed'),a('affiliation','Chicago Pritzker Molecular Engineering 与 Physics，Argonne senior scientist。',['da'],'confirmed'),a('research','凝聚态量子自旋动力学与相干、半导体及量子工程。',['da','il'],'confirmed'),a('postdoc',dc,['il','da','swiss'],'unresolved')],'查 Cornell 学位原卷，Fitchen 与 Gregory 只保留同期合作候选；另查 IBM 第一份任用文件中的日期和职衔。');

const pages=[
 [s,'doe','DOE PECASE biography lists Hamburg PhD, a Columbia and IBM joint postdoctoral fellowship in 2003–2005 with Stephen O’Brien and Christopher Murray, and the LBNL and Argonne positions.','确认两位博士后阶段研究师长。'],
 [s,'scv','O’Brien’s CV lists Elena Shevchenko under his Columbia former postdocs.','佐证博士后阶段及身份。'],
 [s,'cuny','The CCNY profile identifies Stephen O’Brien, his earlier Columbia appointment and nanocrystal work.','确认博后阶段研究师长身份。'],
 [s,'rsc','RSC records the 2003 Hamburg PhD and the 2003–2005 Columbia/IBM joint appointment; Argonne and nanoparticle self-assembly are stated.','核任期和方向。'],
 [s,'chi','Chicago PSD records a part-time Chemistry faculty appointment and the connection to Argonne’s CNM.','核 Chicago 院系。'],
 [g,'cv23','The 2023 CV explicitly names Gian Luigi Bendazzoli as the 1997 Bologna PhD advisor, lists Cambridge as Postdoctoral Research Associate 1998–1999 and Bologna as Research Associate 2000–2001.','确证博士导师并对照旧博士后职衔。'],
 [g,'cv26','The February 2026 CV lists Cambridge postdoc 1998–2000 and Bologna postdoc 2000–2002.','补第二段博士后并保留时间口径差异。'],
 [g,'gc','Chicago Chemistry identifies Laura Gagliardi and the group’s wavefunction methods, density functional theory and materials applications.','核院系与研究。'],
 [g,'acs','The award biography describes doctoral supervision by Bendazzoli and a Cambridge postdoctoral appointment with Nicholas Handy.','核阶段研究师长。'],
 [m,'acs','ACS award biography identifies Kapitulnik as doctoral supervisor and IBM appointments as research staff and manager, respectively.','核正式博士导师及职业时间轴。'],
 [m,'ka','David B. Mitzi is listed under PhD Students in Kapitulnik’s Stanford lab, class of 1990.','独立核其 Stanford 博士及课题组。'],
 [m,'duke','Duke records a 1990 Stanford applied-physics doctorate and IBM Watson employment before Duke in 2014, with appointments in MEMS and Chemistry.','核院系、研究方向及 IBM 职务。'],
 [l,'la','Freedman alumni lists Daniel Laorenza, Graduate Student, Ph.D. 2023, and directs to his current Chicago lab.','核博士组属及年份。'],
 [l,'lac','Chicago Chemistry records 2023 MIT Chemistry PhD, Harvard postdoctoral researcher to 2026 and the current group’s material and spin research.','核院系、方向和任职。'],
 [l,'lah','Harvard CCB lists Daniel Laorenza as Post-Doctoral Fellow with Mason Research Group affiliation.','核 Mason 博后组属。'],
 [l,'lab','Beckman identifies Dr. Jarad Mason as Faculty Mentor for Daniel Laorenza’s 2024 Harvard postdoctoral fellowship.','独立核正式项目指导。'],
 [l,'laf','Harvard CCB records the 2023 MIT PhD, work with Freedman on molecular qubits and the 2024 Beckman award.','核阶段与方向。'],
 [j,'nw','The September 30, 2013 Northwestern Chemistry bulletin records the arrival of John Anderson in the Harris group.','核到组日期。'],
 [j,'jai','Chicago biography gives the Peters graduate work, Caltech degree and Dave Harris lab employment after the thesis.','核身份及两个阶段。'],
 [j,'jat','Caltech catalog names John Stuart Anderson and advisor Jonas C. Peters, with Chemistry dissertation and 2014 as year.','核正式博士导师和论文年。'],
 [v,'hf','Harvard lists Michael Levin’s Junior Fellow service as 2006–08 and 2009–10 and links his Chicago faculty profile.','两段 Junior Fellow 与中间 UCSB 任用分别核实。'],
 [v,'lcv','Levin’s CV names Matthew P. A. Fisher in the UCSB Postdoctoral Researcher entry from February 2008 to February 2009, and gives the overall Harvard fellowship span.','同栏具名确证研究关联，正式导师称谓待核。'],
 [d,'da','Chicago PME identifies experimental physics doctorate at Cornell, IBM Watson appointments and current Chicago/Argonne roles.','核院系及职业阶段。'],
 [d,'il','Illinois Physics alumni report gives Illinois BS in 1978, Cornell experimental physics doctorate and IBM Watson research staff/manager before UCSB in 1991.','核时间轴，IBM 研究任用与博士后分开。'],
 [d,'swiss','The invited speaker biography records the Cornell experimental physics PhD, IBM research staff and manager appointments before UCSB.','补独立履历。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:s,url:u.arg,error:'403 Forbidden; Argonne original profile did not yield text.'});
pages.push({record_id:l,url:u.lath,error:'Original Northwestern CV PDF not accessible through the page reader; no evidence used.'});
pages.push({record_id:l,url:u.laweb,error:'Lab /people path was not accessible; existing university and lab alumni sources used.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0741_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0741_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0741_DOE学会与院系原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
