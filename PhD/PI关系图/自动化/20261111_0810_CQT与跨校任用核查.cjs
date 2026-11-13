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
 orig.audit_id='pi_archive_20261111_0810_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0810_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"bnl":"https://www.bnl.gov/bnlweb/pubaf/bulletin/files/2011/20110114.pdf#page=1","sbl":"https://www.stonybrook.edu/bnl/joint-appointments.html","li":"https://www.bnl.gov/staff/liqiang","lcv":"https://stonybrook.edu/commcms/physics/people/_profiles/_cvs/liq.pdf","lmir":"https://www.llrc.stonybrook.edu/commcms/physics/people/_profiles/_cvs/liq.pdf","lf":"https://www.hiroshima-u.ac.jp/system/files/31934/20120307FlyerDrLiSseminar.pdf","lp":"https://www.jstage.jst.go.jp/article/jsas1989/4/1/4_1_18/_article/-char/en","ds":"https://www.cqt.sg/people/dario-poletti/","dv":"https://www.cqt.sg/highlight/2024-05-meet-dario-poletti/","d09":"https://www.cqt.sg/wp-content/uploads/2024/09/annualreport2009.pdf#page=10","d10":"https://www.cqt.sg/wp-content/uploads/2024/09/annualreport2010.pdf#page=8","da":"https://arxiv.org/pdf/1111.0776","dk":"https://www.pi.uni-bonn.de/kollath/en","danu":"https://openresearch-repository.anu.edu.au/server/api/core/bitstreams/a3e4e688-e605-4e9a-bb5a-862b68481fa3/content","dmaj":"https://majulab.cnrs.fr/quantum-matter-physics/","dt":"https://www.sutd.edu.sg/profile/dawn-tan","du":"https://jacobsschool.ucsd.edu/news/release/1025?id=1025","dth":"https://escholarship.org/content/qt9mr317vv/qt9mr317vv.pdf","dc":"https://royalsociety.org/science-events-and-lectures/2026/04/beautiful-twist-on-condensed-matter/","cg":"https://www.physics.uoc.gr/en/faculty/c.panagopoulos","cl":"https://phynelab.org/Staff/christos-panagopoulos/","st":"https://www.hertzfoundation.org/people/nathaniel-stern/","ng":"https://groups.physics.northwestern.edu/stern/pastworks.html","sn":"https://physics.northwestern.edu/people/faculty/core-faculty/nathaniel-stern.html","zz":"https://www.sutd.edu.sg/profile/dong-zhaogang/","za":"https://research.a-star.edu.sg/researcher/zhaogang-dong/","ze":"https://a-star-engagementportal.glueup.com/event/111994/featured-speakers.html","rc":"https://www.bu.edu/physics/files/2021/05/Ruckenstein_CV.pdf#page=1","ro":"https://www.bu.edu/articles/2007/university-names-vice-president-of-research/","rca":"https://www.bu.edu/arrows/profile/andrei-ruckenstein/","fs":"https://eng.famu.fsu.edu/ece/people/arigong","fp":"https://eng.famu.fsu.edu/news/engineering-faculty-promotions-fall-2025","f26":"https://eng.famu.fsu.edu/news/engineering-researchers-use-ai-and-3d-printing-reinvent-microwave-circuit-design"};
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




const q='9e53b901',p='e95bd5b5',d='2a7f289d',c='ecf381c4',n='9f5b86b6',z='f90a12a9',r='9e73395e',f='9f8eb5a2';
const lnote='Brookhaven 2011 年当期原刊明确 Qiang Li 于 1991 年从 Iowa State 物理博士毕业后赴 BNL 任博后，并在 1993 年转 assistant materials scientist。任用与学校既有 CV 记载一致。该原刊未具名博士后指导者。';
const qph='Iowa State Ames 实验室 1991 博士由 Stony Brook 联聘原档核定。既有 Hiroshima 本人讲座材料具名和 Finnemore 共事，1992 原刊补 Ames 同期单位与超导方向；维持博士阶段研究师长，论文正式职衔待原件。';
const ff='师承人物 - Douglas K. Finnemore';
updateEdge(q,'Qiang Li',ff,'Douglas K. Finnemore','博士阶段研究师长','博士阶段研究者','博士阶段研究师长','博士阶段研究者',qph,src(['原讲座档（既有证据）','lf'],['Ames 同期原刊','lp'],['Stony Brook 联聘','sbl']));
rewrite(pf(q),x=>x.startsWith(boundary),()=>boundary+lnote+' Stony Brook 与 BNL 联聘原档核实身份、凝聚态物理与超导／能源材料，已排除华中农业大学和山东大学同名研究者。 '+src(['Brookhaven 当期原刊','bnl'],['Stony Brook 联聘','sbl']));
cell(q,3,'Brookhaven Materials Sciences 1991–1993 博士后，1993 转任助理材料科学家；个人指导待查');
schoolWith(q,src(['Brookhaven 当期原刊','bnl'],['Stony Brook 联聘','sbl']));
const qa=audit(q,[a('identity','Stony Brook 与 Brookhaven 当期原档核 Iowa State 1991 物理博士和 BNL 时间线，两位中国高校同名研究者不同。',['sbl','bnl'],'confirmed'),a('affiliation','Stony Brook 物理与天文学、BNL 联聘；Advanced Energy Materials Group。',['sbl','li'],'confirmed'),a('research','超导及能源材料、热电与输运。',['sbl','li','bnl'],'confirmed'),a('phd',qph,['lf','lp','sbl'],'group_or_candidate'),a('postdoc',lnote,['bnl','sbl'],'unresolved')],'找 Iowa State 博士签署页，以及 BNL 1991–1993 博后具体组属及导师原档。');
relation(q,qa,'phd',ff,'stage_mentor',qph,ids('lf','lp','sbl'),'finnemore');

const kol='师承人物 - Corinna Kollath';
const pk='CQT 本人履历明确 CQT、法国和瑞士的博士后经历。2012 原稿将 Poletti 与 Corinna Kollath 同列 Geneva 理论物理系，Kollath 另署 École Polytechnique，作者贡献记两人共同发展解析模型。保留 Geneva 博士后导师候选，法国阶段接收及个人指导职衔待原档。';
mentor(kol,'Corinna Kollath','University of Bonn 物理学研究组负责人，研究量子多体及超冷原子。',src(['Bonn 本人组档','dk']));
edge(p,'Dario Poletti',kol,'Corinna Kollath','博士后导师候选','博士后候选研究者',pk,src(['CQT 履历','ds'],['2012 研究原稿','da'],['Bonn 本人组档','dk']));
pl(p,boundary,'CQT 2010 年报列本人为 Research Fellow。2009 年报的 Student Supervisor 表另属当时列名博士生，未列 Poletti 的博士导师。 '+src(['CQT 2010 年报','d10'],['CQT 2009 年报','d09']));
cell(p,3,'Berthold-Georg Englert（2009 CQT 博后课题组负责人）；Corinna Kollath（Geneva 博后导师候选）；法国阶段待核');
schoolWith(p,src(['CQT 2010 年报','d10'],['Geneva 同期原稿','da']));
const pa=audit(p,[a('identity','本人 CQT 访谈、历史 CQT 年报及 Geneva 署名原稿相符。',['dv','d10','da'],'confirmed'),a('affiliation','SUTD Science, Mathematics and Technology 及 CQT。',['ds','dv'],'confirmed'),a('research','非平衡量子多体、量子动力学和输运。',['ds','da'],'confirmed'),a('phd','NUS／ANU 2009 联合物理博士，2010 年报获奖报道核博士论文奖；2009 原表未列其博士导师，ANU 候选 PDF 403。',['ds','d09','d10'],'unresolved'),a('postdoc',pk+' 本人访谈确证 2009 Englert CQT 组属。',['ds','dv','d10','da','dk'],'group_or_candidate')],'查联合博士论文签署页、CQT 博后任用及法国、Geneva 的具名指导。');
relation(p,pa,'postdoc',kol,'candidate',pk,ids('ds','da','dk'),'kollath');

const fa=records.get('6577ec4e').filename;
const dd='UC San Diego Jacobs 2010 当期原报道确认 Dawn Tan 为 ECE 博士生，Fainman 以该项目团队教授接受采访。2011 论文馆藏的缓存索引列 Fainman 为委员会主席；学位原件主机退避中。两项共同支持候选，论文正式指导称谓待核。';
updateEdge(d,'Dawn Tan',fa,'Yeshaiahu Fainman','博士候选关系','博士候选研究者','博士候选关系','博士候选研究者',dd,src(['UC San Diego 工学院当期报道','du'],['待重读学位原卷','dth'],['SUTD 本人档','dt']));
pl(d,boundary,'本人现行 SUTD 履历及 UCSD 当期原报道相互核姓名、院系、光子学方向。 '+src(['UC San Diego 当期报道','du'],['SUTD 现任','dt']));
cell(d,2,'Yeshaiahu Fainman（博士导师候选）；UCSD 2011 论文原卷待退避后核');
schoolWith(d,src(['UC San Diego 工学院当期报道','du']));
const da=audit(d,[a('identity','UCSD 当期 ECE 光子学博士生与 SUTD 本人档相符。',['du','dt'],'confirmed'),a('affiliation','SUTD EPD、副教授、Photonics Devices and Systems Group PI。',['dt'],'confirmed'),a('research','纳米光子学、硅光子学、非线性和量子光学。',['dt','du'],'confirmed'),a('phd',dd,['du','dth','dt'],'group_or_candidate'),a('postdoc','SUTD 列 MIT 访问教授和 Luxtera 任用。公开原档目前未列博士后职务，继续追实际任用时间和指导。',['dt'],'unresolved')],'在 eScholarship 主机退避到期后核本人论文签署及致谢页；另查博士后任用。');
relation(d,da,'phd',fa,'candidate',dd,ids('du','dth','dt'),'fainman');

const ct='Crete 物理系原档列 Cambridge 1997 博士、Trinity College Research Fellow 1996–2000、Royal Society University Research Fellow 2000–2008。本人组档和 Royal Society 活动简介确认博士和两项 fellowship。Trinity 记录起始早于授位，各阶段按原档分列，个人导师和任用类别待进一步查。';
pl(c,boundary,ct+' '+src(['Crete 物理系','cg'],['本人组档','cl']));
cell(c,3,'Trinity College Research Fellow 1996–2000；Royal Society University Research Fellow 2000–2008；个人导师及类别待核');
schoolWith(c,src(['Crete 物理系履历','cg'],['本人组档','cl']));
audit(c,[a('identity','Crete 院系、本人组档、Royal Society 当前学术履历一致。',['cg','cl','dc'],'confirmed'),a('affiliation','NTU 物理与应用物理方向现任教授，Crete 早年原档独立分列。',['cl','dc','cg'],'confirmed'),a('research','凝聚态复杂电子相、量子磁性、非常规超导。',['cg','cl'],'confirmed'),a('phd','Cambridge 1997 物理博士，博士导师待论文档。',['cg','cl','dc'],'unresolved'),a('postdoc',ct,['cg','cl','dc'],'unresolved')],'继续追 Cambridge 论文及 Trinity、Royal Society 当期任用和研究指导。');

const aw=records.get('d5d8b990').filename,ki='师承人物 - H. Jeff Kimble';
const nd='Hertz 基金会本人档明确 UCSB 博士在 David Awschalom 实验室，研究半导体自旋动力学；继续标博士阶段课题组负责人，论文正式指导待原卷。';
const nk='Hertz 本人档确证 Caltech Richard C. Tolman Prize Postdoctoral Fellowship。本人 Northwestern 组的过往项目原档列其同期与 H. Jeff Kimble 合作的腔量子电动力学和纳米光子学工作，维持正式导师候选。';
updateEdge(n,'Nathaniel Stern',aw,'David Awschalom','博士阶段课题组负责人','博士阶段课题组成员','博士阶段课题组负责人','博士阶段课题组成员',nd,src(['Hertz 人物原档','st']));
updateEdge(n,'Nathaniel Stern',ki,'H. Jeff Kimble','博士后导师候选','博士后研究者候选','博士后导师候选','博士后研究者候选',nk,src(['Hertz 人物原档','st'],['本人 Northwestern 组旧项目','ng']));
rewrite(pf(n),x=>x.startsWith(boundary),()=>boundary+nd+' '+nk+' UWM 艺术设计同名者的两份材料已从本人检索证据中排除。 '+src(['Hertz 人物原档','st'],['本人 Northwestern 组旧项目','ng']));
cell(n,3,'Caltech Tolman Prize 博士后；H. Jeff Kimble（候选，正式指导待查）');
schoolWith(n,src(['Hertz 原档','st'],['本人 Northwestern 组旧项目','ng']));
const na=audit(n,[a('identity','Hertz 人物原档核 Northwestern 物理学者及 UCSB／Caltech 路径，与 UWM 艺术设计同名者分开。',['st','ng'],'confirmed'),a('affiliation','Northwestern 物理与天文学。',['st','ng'],'confirmed'),a('research','量子光子学、自旋、磁性材料与纳米光学。',['st','ng'],'confirmed'),a('phd',nd,['st'],'group_or_candidate'),a('postdoc',nk,['st','ng'],'group_or_candidate')],'追 UCSB 论文签署页及 Caltech Tolman fellowship 的任用指导。');
relation(n,na,'phd',aw,'group_leader',nd,ids('st'),'awschalom');
relation(n,na,'postdoc',ki,'candidate',nk,ids('st','ng'),'kimble');

const za='SUTD 及 A*STAR 现任原档一致，Dong 是 SUTD Science, Mathematics and Technology 副教授并联聘 A*STAR Q.InC、IMRE。A*STAR 2024 当期会议列 IMRE Group Leader 并记 NUS Materials Science and Engineering 兼职副教授，按 2024 履历记录，延续情况待 NUS 当期人事档。';
const zz='SUTD 校方档列 2012 NTU EEE 博士、2012–2024 A*STAR IMRE scientist，后续科研任命与教职可核。可读材料未见单列博士后，具体早期聘任及指导待查。';
pl(z,boundary,za+' '+zz+' '+src(['SUTD 教师档','zz'],['A*STAR 联聘原档','za'],['A*STAR 2024 会议档','ze']));
cell(z,3,'2012–2024 A*STAR IMRE scientist；早期职务类别与博士后经历待查');
schoolWith(z,src(['A*STAR 2024 会议档','ze'],['A*STAR 联聘原档','za']));
audit(z,[a('identity','SUTD、A*STAR 两代履历及方向一致。',['zz','za','ze'],'confirmed'),a('affiliation',za,['zz','za','ze'],'confirmed'),a('research','亚 10 纳米加工、纳米光子学、超导量子与光电子器件。',['zz','za','ze'],'confirmed'),a('phd','SUTD 明列 2012 NTU EEE 博士；导师仍待原卷。',['zz'],'unresolved'),a('postdoc',zz,['zz','za','ze'],'unresolved')],'继续找 NTU 学位论文和 A*STAR 早期入职原档，复查 NUS 兼职的时间。');

const si='师承人物 - Eric D. Siggia';
const rph='本人 CV 第 1 页将 Cornell 1984 物理学博士论文的 Supervisor 列作 E. D. Siggia，既有 Rockefeller 人物档核全名、院系及同期任职。';
const rpd='本人 CV 分列 Bell Labs Theoretical Physics Group 1983–1984 Postdoctoral Fellow 与后续研究职务；Boston University 2007 当期任用报道亦分列博后及技术人员。博士年份 1984 与 CV 博后起始年 1983 并存，确切月份与个人指导仍待查。';
updateEdge(r,'Andrei Ruckenstein',si,'Eric D. Siggia','博士导师','博士生','博士导师','博士生',rph,src(['本人 CV','rc']));
pl(r,boundary,rpd+' '+src(['本人 CV','rc'],['Boston University 当期任用','ro']));
cell(r,3,'Bell Labs Theoretical Physics Group 1983–1984 博士后；导师及具体起始月待核');
schoolWith(r,src(['本人 CV','rc'],['Boston University 当期任用','ro']));
const ra=audit(r,[a('identity','两份 BU 原始履历核 Cornell 博士、Bell Labs 及 Boston 轨迹。',['rc','ro','rca'],'confirmed'),a('affiliation','Boston University 物理系。',['rca'],'confirmed'),a('research','凝聚态理论和多体物理。',['rc','rca'],'confirmed'),a('phd',rph,['rc'],'confirmed_advisor'),a('postdoc',rpd,['rc','ro'],'unresolved')],'找 Bell Labs 当期聘任和具名导师，核时间月份。');
relation(r,ra,'phd',si,'advisor',rph,ids('rc'),'siggia');

const fz='FAMU–FSU 2025 晋升公告明确授予 ECE 副教授并获终身教职，2026 学院报道具名其担任课题 PI。院系本人页研究含射频、超材料、纳米光子与量子器件。已有 UNT 博士导师三位分列，博士后经历继续查。';
pl(f,boundary,fz+' '+src(['FAMU–FSU 2025 晋升','fp'],['2026 项目报道','f26']));
cell(f,1,'FAMU–FSU 电气与计算机工程系副教授（终身教职）；射频、电磁超材料、纳米光子及量子器件');
schoolWith(f,src(['2025 晋升原档','fp'],['2026 项目报道','f26']));
audit(f,[a('identity','晋升、本人院系、同组研究报道相互匹配。',['fs','fp','f26'],'confirmed'),a('affiliation','FAMU–FSU 电气与计算机工程系，2025 年晋升终身副教授。',['fs','fp','f26'],'confirmed'),a('research','应用电磁学、射频与超材料、量子器件，2026 课题由其主持。',['fp','f26'],'confirmed')],'查 2014–2017 工业任职与之后高校聘任日期，确认是否另有博士后。');

const pages=[
 [q,'bnl','Brookhaven’s January 2011 Bulletin states Qiang Li earned his 1991 Iowa State Physics PhD, joined Brookhaven as a postdoc that year, and became an assistant materials scientist in 1993.','确证博士后起止和转任职务。'],
 [q,'sbl','Stony Brook lists Qiang Li as SUNY Empire Innovation Professor in Physics and Astronomy with a BNL joint appointment and confirms the 1991 Iowa State PhD.','核目标身份和联聘。'],
 [q,'lp','The original 1992 article identifies Qiang Li and Douglas Finnemore with Ames Lab and Iowa State Physics and Astronomy.','补博士时期同期团队证据。'],
 [p,'d09','CQT 2009 report contains a named PhD student and supervisor table. Poletti is separately listed in the staff material.','报告全库比对，未据相邻条目推定导师。'],
 [p,'d10','CQT 2010 lists Dario Poletti in Research Fellows and recognizes his NUS dissertation award.','核 CQT 阶段及博士论文奖。'],
 [p,'da','The 2012 author manuscript lists Poletti at Geneva, Kollath at Geneva and École Polytechnique, and a shared analytical contribution.','同期同单位合作仅作候选依据。'],
 [p,'dk','Bonn’s Corinna Kollath group page identifies the theoretical many-body physics researcher.','核候选身份。'],
 [d,'du','UC San Diego engineering’s 2010 report identifies Dawn Tan as its ECE doctoral researcher and names Fainman as a professor on the same nanophotonics project.','博士阶段关系补原证，仍为候选。'],
 [d,'dt','SUTD identifies her UC San Diego ECE doctorate, MIT visiting professorship and Luxtera work, with current photonics research.','核身份、现任及任用类别。'],
 [c,'cg','Crete Physics lists Panagopoulos’s 1997 Cambridge PhD, Trinity College research fellowship 1996–2000 and Royal Society fellowship 2000–2008.','分列研究任用时间。'],
 [c,'cl','His lab records the Cambridge doctorate and the two subsequent named fellowships.','复核人物、院系和方向。'],
 [n,'st','The Hertz biography places his UCSB doctoral research in Awschalom’s lab and records the Caltech Tolman Prize Postdoctoral Fellowship.','分别核博士组属与正式博士后职务。'],
 [n,'ng','Stern’s Northwestern lab identifies his earlier cavity QED work and lists collaborations with H. Jeff Kimble.','用于追查 Caltech 博士后个人指导。'],
 [z,'za','A*STAR lists his current SUTD appointment and joint principal scientist roles at Q.InC and IMRE.','核当前跨机构任职。'],
 [z,'ze','The A*STAR 2024 event identifies him as IMRE group leader and adjunct associate professor in NUS Materials Science and Engineering.','保留 2024 兼职时点。'],
 [r,'rc','The first page of Ruckenstein’s own CV lists Eric D. Siggia as Cornell doctoral supervisor and names the 1983–1984 Bell Labs postdoctoral appointment.','明确博士导师及博后时间。'],
 [r,'ro','BU’s 2007 appointment announcement separately describes the Bell Labs postdoctoral fellowship and technical staff membership.','核不同岗位。'],
 [f,'fp','The engineering college’s 2025 promotion announcement lists Bayaner Arigong as associate professor with tenure in ECE.','核任职级别和院系。'],
 [f,'f26','The 2026 college report identifies Arigong as principal investigator of an advanced microwave-circuit project.','核 PI 和研究方向。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
for(const [record_id,key,error] of [[q,'lcv','Stony Brook CV cache miss; original Brookhaven Bulletin verified employment.'],[q,'lmir','Stony Brook CV alternate address cache miss.'],[p,'danu','403 Forbidden on candidate ANU bitstream; not used as dissertation evidence.'],[p,'dmaj','502 Bad Gateway on CNRS group page.']])pages.push({record_id,url:u[key],error});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0810_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0810_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0810_CQT与跨校任用原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
