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
 orig.audit_id='pi_archive_20261111_0340_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0340_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"roster":"https://millermembers.berkeley.edu/all.php?nav=46","beck":"https://www.chemistry.msu.edu/beck-research-group/index.aspx","beckdept":"https://www.chemistry.msu.edu/faculty-research/faculty-members/beck-warren.aspx","brudvig":"https://brudviglab.yale.edu/graduate-alumni","neucv":"https://neuscammanlab.com/wp-content/uploads/2020/03/eric_neuscamman_cv.pdf","neudept":"https://chemistry.berkeley.edu/people/eric-neuscamman","role":"https://miller.berkeley.edu/nominate-apply/miller-research-fellowship/reference-faculty-host-information","choi":"https://physics.mit.edu/faculty/soonwon-choi/","choiold":"https://miller.berkeley.edu/images/events/allEvents/2018--SYMPOSIUM-PROGRAM.pdf","qcv":"https://ws.engr.illinois.edu/sitemanager/getfile.asp?id=8684","qdept":"https://chbe.illinois.edu/people/profile/qchen20","zcv":"https://xueyue-sherry-zhang.github.io/files/CV_website.pdf","zthesis":"https://thesis.caltech.edu/15117/","zdept":"https://quantum.columbia.edu/directory/xueyue-sherry-zhang","fthesis":"https://cheme.mit.edu/wp-content/uploads/2021/04/Fraggedakis_Abstract_MIT_Thesis.pdf","fecs":"https://www.electrochem.org/ecsnews/ecs-san-francisco-section-young-investigator-lectures","fdept":"https://cbe.princeton.edu/people/dimitrios-fraggedakis","fg":"https://dfraglab.cbe.princeton.edu/","chan":"https://www.chan-lab.caltech.edu/about-garnet","mhg":"https://mhggroupberkeley.com/alumni/","cen":"https://cen.acs.org/articles/87/i8/ACS-Award-Pure-Chemistry.html","xc":"https://xiechen.caltech.edu/infocv","xccv":"https://xiechen.caltech.edu/documents/33775/CV_XC_1125.pdf","valls":"https://cse.umn.edu/physics/oriol-t-valls","aps08":"https://higherlogicdownload.s3.amazonaws.com/APS/a05ec1cf-2e34-4fb3-816e-ea1497930d75/UploadedImages/Newsletter_PDF/october08.pdf"};
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
const b='d8f108a9',bn='Warren F. Beck',gb='师承人物 - Gary W. Brudvig',ks='师承人物 - Kenneth Sauer';
const bp='MSU 本人组页在 1988 Yale Ph.D. 条目具名 with Prof. Gary Brudvig；Yale Brudvig 原博士毕业生名录独立列 Warren F. Beck、1988 年春季博士及 Michigan State 身份。两项互证具体学位指导，原谱系候选改为博士导师。可信度高。';
const bs='MSU 本人组页在 Berkeley 1989–1991 Miller Institute Postdoctoral Fellowship 条目具名 with Prof. Kenneth Sauer。阶段与人名已由本人原文核对，列博士后阶段研究师长，正式 advisor 职衔仍待原任用或 CV；不依合照认定。可信度高。';
mentor(ks,'Kenneth Sauer','MSU Beck 本人履历具名的 Berkeley 博士后阶段研究师长。',src(['Beck 原组页','beck']));
updateEdge(b,bn,gb,'Gary W. Brudvig','博士导师候选','博士候选','博士导师','博士生',bp,src(['MSU 本人组页','beck'],['Yale 博士毕业生原表','brudvig']));
edge(b,bn,ks,'Kenneth Sauer','博士后阶段研究师长','博士后阶段研究者',bs,src(['MSU 本人组页','beck']));
rewrite(pf(b),x=>x.startsWith(boundary),()=>boundary+bp+' '+bs);
cell(b,2,'Gary W. Brudvig（Yale 1988 博士导师）');cell(b,3,'Kenneth Sauer（Berkeley 1989–1991 博士后阶段研究师长）');schoolWith(b,src(['本人组页','beck'],['Brudvig 博士原名单','brudvig']));
const ba=audit(b,[a('identity','MSU 本人组页、Yale 博士毕业名单和 Miller 原历届名录以姓名、1988 Yale 博士及 1989–1991 Berkeley 经历对上。',['beck','brudvig','roster'],'confirmed'),a('affiliation','Michigan State University 化学系教授，原系页现列本人实验室及联系方式。',['beckdept','beck'],'confirmed'),a('research','超快多维电子光谱、光合天线及光受体能量动力学、半导体量子点。',['beck','beckdept'],'confirmed'),a('phd',bp,['beck','brudvig'],'confirmed_advisor'),a('postdoc',bs,['beck'],'group_or_candidate')],'追 1989–1991 Miller 任用原档是否对 Sauer 另有正式 advisor 角色，保留本人明确的阶段关系。');
relation(b,ba,'phd',gb,'advisor',bp,ids('beck','brudvig'),'brudvig');relation(b,ba,'postdoc',ks,'stage_mentor',bs,ids('beck'),'sauer');
const n='83f4aeb0',nn='Eric Neuscamman',hg='师承人物 - Martin Head-Gordon',es='师承人物 - Eric Schwegler',nc='人员 - Caltech - Garnet K.-L. Chan - 9a4a4057';
rewrite(index,x=>x.startsWith('- '+who(n,nn)+' → 博士导师 ')&&x.includes('fellowship Host'),(x,nl)=>[
 '- '+who(n,nn)+' → 博士导师：'+wiki(nc,'Garnet K.-L. Chan')+'。本人 CV 的 2011 Cornell 博士 Advisor。 '+src(['本人 CV','neucv']),
 '- '+who(n,nn)+' → 博士后／研究 fellowship 阶段的接待人，导师候选：'+wiki(hg,'Martin Head-Gordon')+'。2011–2014 Berkeley Miller Host。 '+src(['本人 CV','neucv']),
 '- '+who(n,nn)+' → 博士后／研究 fellowship 阶段的接待人，导师候选：'+wiki(es,'Eric Schwegler')+'。2014–2015 LLNL Lawrence Fellow Host；与 Miller 是两段经历，原接待角色保留。 '+src(['本人 CV','neucv'])
].join(nl));
const nm='本人 CV 首页明确 Berkeley 2011–2014 Miller Research Fellow 的 Host 为 Martin Head-Gordon。Miller 现行官方制度明确 Faculty Host 承担研究指导；补为博士后阶段研究师长，保留原 Host 用语，未据现行制度反推历史 primary supervisor 登记。LLNL 2014–2015 的 Eric Schwegler Host 是另一段，仍按原角色保留候选。';
updateEdge(n,nn,hg,'Martin Head-Gordon','博士后／研究 fellowship 阶段的接待人，导师候选','博士后／研究 fellowship 阶段的接待关系、导师候选','博士后阶段研究师长','博士后阶段研究者',nm,src(['本人 CV','neucv'],['Miller 指导角色','role']));
cell(n,3,'Martin Head-Gordon（2011–2014 Berkeley Miller Host／阶段研究师长）；Eric Schwegler（2014–2015 LLNL Lawrence Fellow Host，正式指导待核）');schoolWith(n,src(['本人 CV','neucv'],['Miller 制度','role']));
const na=audit(n,[a('identity','Cornell 2011 理论化学博士、Berkeley Miller 及 LLNL Lawrence Fellow 经历由本人 CV 与系页对上。',['neucv','neudept','roster'],'confirmed'),a('affiliation','Berkeley 化学系现列副教授，CV 明列 LBNL Faculty Scientist，分别保留来源年代。',['neudept','neucv'],'confirmed'),a('research','强关联电子结构、激发态理论和分子及材料量子化学算法。',['neudept'],'confirmed'),a('postdoc',nm,['neucv','role'],'group_or_candidate')],'继续追 LLNL Lawrence Fellow 的个人指导角色及 Berkeley 原期 primary Host；不得把两段研究 fellowship 合并。');
relation(n,na,'postdoc',hg,'stage_mentor',nm,ids('neucv','role'),'headgordon');
const c='d71af7c3',cn='Soonwon Choi',lee='人员 - UC Berkeley - Dung-Hai Lee - ba527098';
const cm='此前可靠 Miller 2018 项目原名单列 Dung-Hai Lee 为 Choi 的 Faculty Host，旧 PDF 当前不可访问，不覆盖历史核读。MIT 当前原系页确认 Harvard 2018 博士受 Mikhail Lukin 指导，随后 Berkeley Miller 博后、2021 年 7 月入 MIT。结合现行 Miller Host 指导职责，列博士后阶段研究师长；不声称已重新读到 2018 PDF，也不推定历史 primary supervisor 登记。';
updateEdge(c,cn,lee,'Dung-Hai Lee','博士后 faculty host（历史记录待重读）','博士后阶段接待研究者（历史记录待重读）','博士后阶段研究师长','博士后阶段研究者',cm,src(['历史 Miller 名单','choiold'],['现行 Host 制度','role'],['MIT 本人系档','choi']));
rewrite(pf(c),x=>x.startsWith(boundary),()=>boundary+cm);
cell(c,3,'Dung-Hai Lee（Miller Faculty Host／博士后阶段研究师长，历史名单待重新取得）');schoolWith(c,src(['MIT 原系档','choi'],['Miller 指导角色','role']));
const ca=audit(c,[a('identity','MIT 原系档的 Harvard 2018 博士、Berkeley Miller 博后及 2021 入 MIT 与名录对上。',['choi','roster'],'confirmed'),a('affiliation','MIT 物理系现列 Associate Professor，2021 年 7 月入职；研究中心关联见原档。',['choi'],'confirmed'),a('research','非平衡量子多体动力学与量子信息，跨凝聚态理论和原子物理。',['choi'],'confirmed'),a('phd','MIT 本人原系档明确 Harvard 博士 under the supervision of Mikhail Lukin，与既有毕业名录吻合。',['choi'],'confirmed_advisor'),a('postdoc',cm,['choiold','role','choi'],'group_or_candidate')],'从可读 Berkeley 原年度档核 2018–2021 Faculty Host，及主导师登记；不立即重复请求失效旧 PDF。');
relation(c,ca,'postdoc',lee,'stage_mentor',cm,ids('choiold','role','choi'),'lee');
const full=[
 {id:'f388f65c',name:'Qian Chen',phdm:'师承人物 - Steve Granick',phdn:'Steve Granick',pm:'人员 - University of Chicago - Paul Alivisatos - 9209cf4f',pn:'Paul Alivisatos',ps:['qcv'],post:['qcv','qdept'],aff:['qcv','qdept'],res:['qdept','qcv'],pnote:'本人当前托管 CV 首页在 UIUC 2007–2012 材料博士条目明确 Advisor: Steve Granick。',postnote:'本人当前 CV 首页在 Berkeley 2012–2015 Miller Fellow 条目明确 Advisor: A. Paul Alivisatos，Illinois 院系原页另列 Postdoc Advisor。',affnote:'UIUC 材料科学与工程系 2024 起正教授，兼化学与化学及生物分子工程 affiliated faculty。',rnote:'纳米材料、液相／原位电镜、颗粒组装及动力学，材料与能源环境。'},
 {id:'114ae273',name:'Xueyue (Sherry) Zhang',phdm:'人员 - Caltech - Oskar Painter - cd1f2756',phdn:'Oskar Painter',pm:'人员 - UC Berkeley - Alp Sipahigil - 89559a8a',pn:'Alp Sipahigil',ps:['zthesis','zcv'],post:['zcv'],aff:['zdept'],res:['zdept','zcv'],pnote:'Caltech 原学位库 15117 明确 2023 应用物理博士论文 Advisor 为 Oskar J. Painter；本人 CV 的 Caltech Research Assistant 段独立具名 Painter。',postnote:'本人 CV 明确 Berkeley Miller postdoctoral fellow 自 2023 年 3 月起，Advisor: Alp Sipahigil；CV 的博士教育终点 2023 年 6 月与研究岗位终点 3 月分别保留，不把本科指导混入。',affnote:'Columbia 当前量子计划原档列应用物理与应用数学系助理教授。',rnote:'波导量子电动力学、超导量子电路、硅中自旋－光子接口及量子多体与拓扑光子学。'},
 {id:'02570b59',name:'Dimitrios Fraggedakis',phdm:'人员 - MIT - Martin Z. Bazant - a80a6b1d',phdn:'Martin Z. Bazant',pm:'师承人物 - Bryan D. McCloskey',pn:'Bryan D. McCloskey',ps:['fthesis','fecs'],post:['fecs'],aff:['fdept'],res:['fdept','fg'],pnote:'MIT 原博士论文摘要明确 Thesis Advisor: Martin Z. Bazant；2021 ECS 原活动名录独立明列 PhD Advisor。',postnote:'ECS 2021 年原讲座日程同时具名 Berkeley Postdoctoral Advisor: Bryan McCloskey；Princeton 档列 Miller 2021–2024 为奖期，未推定聘任的月日。',affnote:'Princeton 化学与生物工程系助理教授，原院系档与本人实验室相符。',rnote:'非平衡热力学、离子传输与电化学反应，电池、能源储存及环境系统的理论与计算。'}
];
for(const x of full){
 const changes=[a('identity','本人学位、Miller 经历及现任院系在原始 CV／学位档、项目原名单与教师档中对上。',[...new Set([...x.ps,...x.post,...x.aff,'roster'])],'confirmed'),a('phd',x.pnote,x.ps,'confirmed_advisor'),a('postdoc',x.postnote,x.post,'confirmed_advisor'),a('affiliation',x.affnote,x.aff,'confirmed'),a('research',x.rnote,x.res,'confirmed')];
 const aid=audit(x.id,changes,'本轮博士、博士后导师及现任院系和方向已经核实，后续仅在出现新任用、资料变化或具体矛盾时增量更新。');audits.at(-1).followup_required=false;
 for(const [stage,m,note,keys,suf]of[['phd',x.phdm,x.pnote,x.ps,'phd'],['postdoc',x.pm,x.postnote,x.post,'post']]){
  relation(x.id,aid,stage,m,'advisor',note,ids(...keys),suf);
  const pref=stage==='phd'?'- 博士导师：':'- 博士后导师：';
  line(pf(x.id),t=>t.startsWith(pref)&&t.includes(m),' '+note+' '+keys.map(k=>source('原始核对',u[k])).join(' · '));
 }
 schoolWith(x.id,[...new Set([...x.ps,...x.post,...x.aff])].map(k=>source('原档',u[k])).join(' · '));
 rewrite(pf(x.id),t=>t.startsWith(boundary),()=>boundary+x.pnote+' '+x.postnote+' '+x.affnote+' 两阶段的导师、身份及现任方向本轮均有原始记录；保留各原文不同的日期口径，不将一般委员或本科导师混入。');
}
const x='86f39155';
pl(x,boundary,' 本人 2025 年 11 月 CV 明列 2012 年 8 月至 2014 年 6 月 Berkeley Miller、2025 年 8 月起兼 Walter Burke 理论物理所所长；网页现列 Eddleman 理论物理教授。 '+src(['本人 CV','xccv'],['当前本人页','xc']));
schoolWith(x,src(['本人 CV','xccv'],['本人信息','xc']));
audit(x,[a('identity','MIT 2012 理论物理博士与 Berkeley 2012–2014 Miller、Caltech 2014 入职在本人 CV 和名录对上。',['xccv','roster'],'confirmed'),a('affiliation','Caltech Eddleman 理论物理教授，2025 年 8 月起兼 Walter Burke Institute for Theoretical Physics 所长。',['xc','xccv'],'confirmed'),a('research','强关联量子多体的拓扑、对称性与非可逆对称性、fracton、量子动力学、张量网络。',['xc','xccv'],'confirmed')],'保留已核 Vishwanath 博士后研究师长；继续核其项目原任用职衔及 MIT 博士原件共同导师签署。');
const v='cf7e0156',vn='Oriol T. Valls',vntext='APS 2008 年 10 月本人候选简介第 5 页明确 Brown 1976 博士之后，先任 Chicago postdoctoral research associate，再任 Berkeley Miller Fellow，之后入 Minnesota。Miller 历届原名录列 1977–1978，二处个人指导仍未具名；不将访问 NORDITA、Paris、IBM、Argonne 的 visiting 职务改写为博士后。';
pl(v,boundary,' '+vntext+' '+src(['APS 本人原简介第 5 页','aps08'],['Miller 原名录','roster']));
cell(v,3,'Chicago 博士后研究助理、Berkeley Miller（名录 1977–1978）；两段个人指导仍待查');
schoolWith(v,src(['APS 本人原简介','aps08'],['Minnesota 原教师页','valls']));
audit(v,[a('identity','APS 本人简介的 Brown 博士、Minnesota 教职和凝聚态方向与现任系页及 Miller 原名录对上。',['aps08','valls','roster'],'confirmed'),a('affiliation','Minnesota 物理与天文学院教授，关联 Minnesota Supercomputing Institute。',['valls'],'confirmed'),a('research','超导／铁磁异质结构、非常规超导、荷自旋输运、超流体流体力学和量子晶体动力学。',['valls'],'confirmed'),a('postdoc',vntext,['aps08','roster'],'unresolved')],'分别追 Chicago 博后及 Berkeley 1977–1978 Miller 的具名导师与原任用；保留 Brown 1975 经历末年和 1976 学位年份。');
const ch='9a4a4057',chn='Garnet K.-L. Chan',cht='Martin Head-Gordon 组原校友表具名 Garnet Chan 并链接其 Caltech 本人实验室，原名录明确其 Berkeley 2000–2002 Miller。C&EN 2009 获奖报道的搜索索引具名 former postdoctoral adviser，但直接网页及匿名原 HTML 只取得预览、未取得该段原正文；因此先保留博士后导师候选，不把搜索索引升级为正式导师确证。Cambridge 的独立 fellowship 另查。';
edge(ch,chn,hg,'Martin Head-Gordon','博士后导师候选','博士后候选研究者',cht,src(['Head-Gordon 原校友表','mhg'],['Miller 原名录','roster'],['C&EN 待取得完整原文','cen']));
pl(ch,boundary,' '+cht);
cell(ch,3,'Martin Head-Gordon（Berkeley Miller 阶段导师候选）；Cambridge fellowship 指导待核');
schoolWith(ch,src(['Head-Gordon 原校友表','mhg'],['Caltech 本人组页','chan']));
const cha=audit(ch,[a('identity','Head-Gordon 原校友表具名并链接 Caltech Chan 本人组页；后者 Cambridge 2000 博士与 Miller 名录身份对上。',['mhg','chan','roster'],'confirmed'),a('affiliation','Caltech Bren 化学教授，原本人实验室页面具名。',['chan'],'confirmed'),a('research','理论化学、凝聚态及量子信息交叉的量子多体、张量网络与数值方法。',['chan'],'confirmed'),a('postdoc',cht,['mhg','roster','cen'],'group_or_candidate')],'取得 C&EN 2009 对 Head-Gordon 的公开完整原文或导师任用 CV；继续核 Cambridge fellowship 指导，勿仅据搜索索引升级。');
relation(ch,cha,'postdoc',hg,'candidate',cht,ids('mhg','roster','cen'),'mhg');
const success=[
 [b,'beck',bp+' '+bs],[b,'beckdept','MSU 原系页列化学教授、1988 Yale 博士和 1989–1991 Miller 博后。'],[b,'brudvig','Yale Brudvig 博士毕业生原名单列 Warren F. Beck，1988 年春季 PhD，Michigan State 化学教师。'],
 [n,'neucv','CV 首页：2011 Cornell PhD Advisor Garnet Kin-Lic Chan；Berkeley 2011–2014 Miller Host Martin Head-Gordon；LLNL 2014–2015 Lawrence Host Eric Schwegler。'],[n,'neudept','Berkeley 化学系副教授，Cornell 2011 博士、Miller 2011–2014、Lawrence 2014–2015，理论电子结构与激发态。'],[n,'role','现行 Miller 原制度明确 Faculty Host 承担研究指导；primary Host 是校园系统 supervisor，未据此断定历史主次。'],
 [c,'choi','MIT 当前系页列物理副教授，2018 Harvard 博士由 Lukin 指导；之后 Berkeley Miller、2021 年 7 月加入 MIT。'],
 ['f388f65c','qcv','CV 首页明确 2007–2012 UIUC 博士 advisor Steve Granick 和 2012–2015 Berkeley Miller advisor A. Paul Alivisatos；2024 起 UIUC 材料正教授、化学与化工 affiliated。'],['f388f65c','qdept','Illinois 化工原教师页列 affiliate、材料主聘，原档明示 Berkeley Miller Postdoc Advisor Alivisatos。'],
 ['114ae273','zcv','本人 CV 明确 Caltech Painter 博士研究、Berkeley Miller 博后 Advisor Alp Sipahigil；本科各指导阶段单列。'],['114ae273','zthesis','CaltechTHESIS 15117 明列 Xueyue Zhang、2023 PhD、Applied Physics、Advisor Oskar J. Painter，委员会另列。'],['114ae273','zdept','Columbia 原量子计划教师档列 APAM 助理教授及超导、硅自旋光子接口与量子多体方向。'],
 ['02570b59','fthesis','MIT 本人博士论文摘要明确 Thesis Advisor Martin Z. Bazant。'],['02570b59','fecs','ECS 2021 原讲座表将 Fraggedakis 的 Berkeley Postdoctoral Advisor Bryan McCloskey 和 MIT PhD Advisor Martin Z. Bazant 逐项具名。'],['02570b59','fdept','Princeton 当前化学与生物工程系助理教授，MIT 2021 博士，Miller 2021–2024，电化学传输、非平衡理论与计算。'],['02570b59','fg','Princeton 本人组页说明电化学、非平衡材料的理论计算和系归属。'],
 [x,'xc','本人页面及 2025 CV：2012–2014 Miller、Caltech Eddleman 理论物理教授，2025 年 8 月起 Walter Burke 所长。'],[x,'xccv','本人 CV 列 2012.8–2014.6 Berkeley Miller、2012 MIT PhD、Caltech 任用与拓扑量子多体研究。'],
 [v,'valls','Minnesota 原系页核物理教授、超级计算所及超导磁性异质结构等方向。'],[v,'aps08',vntext],
 [ch,'chan','Caltech 本人组页具名 Bren 化学教授、Cambridge 2000 博士，量子多体与凝聚态计算。'],[ch,'mhg','Head-Gordon 原校友表具名 Garnet Chan、Caltech 任职并链接其本人实验室，未单列毕业／博士后阶段。']
];
for(const[record_id,k,raw]of success)pages.push({record_id,url:u[k],raw,excerpt:raw.slice(0,700)});
pages.push({record_id:ch,url:u.cen,error:'直接原页及匿名原始 HTML 仅返回预览，未取得索引所示 Head-Gordon 指导原文；候选保留，不作正式导师确证。'});
pages.push({record_id:ch,url:'https://cce.caltech.edu/people/garnet-k-chan',error:'原名录个人链接 404，已改读其 Caltech 本人实验室与原校友表。'});
pages.push({record_id:v,url:'https://www.physics.umn.edu/directory/otvalls.html',error:'旧名录入口不可访问，已核现 Minnesota 系页与 APS 本人原简介。'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0340_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0340_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0340_Miller本人履历与导师分段回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
