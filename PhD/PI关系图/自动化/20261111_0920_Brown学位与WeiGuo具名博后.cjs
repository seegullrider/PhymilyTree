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
 orig.audit_id='pi_archive_20261111_0920_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0920_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const g='f4f35401', d='1dbe2a00', w='e19c3e62';
const name='Wei Guo', dname='(Steve) Cuong Dang';
const mck='师承人物 - Daniel N. McKinsey', maris='师承人物 - Humphrey J. Maris', nur='人员 - Brown - Arto V. Nurmikko - 24e523b0';
const cv='https://web1.eng.famu.fsu.edu/~wguo/WGuo-CV-2023.pdf';
const cvs=cv+'#page=5';
const fsu='https://quantum.fsu.edu/people/faculty/highlights/wei-guo';
const brown9='https://physics.brown.edu/sites/default/files/newsletter-archive/2009-newsletter.pdf#page=4';
const brown10='https://physics.brown.edu/sites/default/files/newsletter-archive/2010-newsletter.pdf#page=4';
const ntu='https://www.ntu.edu.sg/coeb/faculty-directory';
const dr='https://dr.ntu.edu.sg/entities/person/Steve-Cuong-Dang';
const cen='https://cen.acs.org/articles/90/i19/Rainbow-Lasers.html';
const wcv='https://live-sas-physics.pantheon.sas.upenn.edu/sites/default/files/2019-09/CV_LiangWu_Upenn_1.pdf';
const gPhd='本人 2023 CV 第 5 页明确 H. J. Maris 为 Brown 博士 adviser，首页列 2008。Brown 2009 系刊的博士名录列同姓名、液氦中电子泡研究论文。分别保留两份原件年份口径。';
const gPost='本人 2023 CV 第 5 页的 Ph.D and Postdoc Supervisors 栏明确列 Yale 的 D. N. McKinsey 为 postdoc advisor。该 CV 首页分列 2008–2010 博士后和 2010–2012 Associate Research Scientist。正式博士后导师可信度高。';
const gl=source('本人 2023 CV，第 5 页',cvs)+' · '+source('本人 CV 任用，第 1 页',cv+'#page=1')+' · '+source('FSU 本人访谈',fsu);
const gd=source('本人 2023 CV，第 5 页',cvs)+' · '+source('Brown 毕业原档',brown9);
const from=who(g,name), to=wiki(mck,'Daniel N. McKinsey');
rewrite(pf(g),x=>x.startsWith('- 博士后课题组负责人：')&&x.includes(mck),()=>'- 博士后导师：'+to+'。'+gPost+' '+gl);
rewrite(mf(mck),x=>x.startsWith('- 博士后课题组成员：')&&x.includes(records.get(g).filename),()=>'- 博士后研究者：'+from+'。'+gPost+' '+gl);
rewrite(index,x=>x.startsWith('- '+from+' → 博士后课题组负责人：')&&x.includes(mck),()=>'- '+from+' → 博士后导师：'+to+'。'+gPost+' '+gl);
personLine(g,'- 博士导师：',' '+gPhd+' '+gd);
line(mf(maris),x=>x.startsWith('- 博士生：')&&x.includes(records.get(g).filename),' '+gd);
line(index,x=>x.startsWith('- '+from+' → 博士导师：'),' '+gd);
rewrite(pf(g),x=>x.startsWith(boundary),()=>boundary+gPhd+' '+gPost+' '+gd+' · '+gl);
school(g,' | Daniel N. McKinsey（2008–2010 Yale 博后课题组负责人）；2010–2012 同组科研岗位另列 | ',' | Daniel N. McKinsey（2008–2010 Yale 博士后导师）；2010–2012 科研任用另列 | ');
schoolSource(g,' · '+gd+' · '+gl);
const ga=audit(g,[
 ['identity','Brown 系刊、FSU 本人访谈、CV 的姓名、Brown 液氦博士研究、Yale 博后和现职吻合。',[brown9,cv,fsu],'confirmed'],
 ['affiliation','FAMU–FSU 机械工程教授、FSU Quantum Initiative 联合主任、National MagLab 低温研究。',[cv,fsu],'confirmed'],
 ['research','量子流体、超流氦、量子湍流与低温光学。',[cv,fsu],'confirmed'],
 ['phd',gPhd,[cvs,brown9,fsu],'confirmed_advisor'],
 ['postdoc',gPost,[cvs,cv,fsu],'confirmed_advisor']
],'博士与博士后导师均有本人具名履历。Brown 名录年度与 CV 学位年度差异仍待学位原卷。');
relation(g,ga,'phd',maris,'advisor',gPhd,[cvs,brown9,fsu],'maris');
relation(g,ga,'postdoc',mck,'advisor',gPost,[cvs,cv,fsu],'mckinsey');
const dPhd='Brown 2010 物理系博士名录将 Cuong H. Dang、胶体半导体量子点论文及 Advisor Arto Nurmikko 明确对应。NTU EEE 院档核相同学位单位、年份与研究。';
const dPost='NTU 本人档案分列 Brown postdoctoral research associate、senior research associate 及实验室管理经历。2012 年 C&EN 以 senior research associate 称 Dang，并列其与 Nurmikko 的当期研究。后者支持同期合作，博士后正式指导继续保留候选。';
const dbLink=source('Brown 2010 学位目录',brown10);
const dPostLink=source('NTU 本人任用档',dr)+' · '+source('C&EN 当期报道',cen);
personLine(d,'- 博士导师：',' '+dPhd+' '+dbLink);
line(mf(nur),x=>x.startsWith('- 博士生：')&&x.includes(records.get(d).filename),' '+dPhd+' '+dbLink);
line(index,x=>x.startsWith('- '+who(d,dname)+' → 博士导师：'),' '+dPhd+' '+dbLink);
personLine(d,boundary,' '+dPost+' '+dPostLink);
schoolSource(d,' · '+source('NTU COEB 师资',ntu)+' · '+source('C&EN 当期报道',cen));
const center='已核实单位 - NTU - 光电子与生物光子学中心';
const cFile=path.join(root,'已核实院系',center+'.md');
const cText='- '+who(d,dname)+' — COEB 主任。 '+source('NTU COEB 师资',ntu);
if(!fs.existsSync(cFile))updates.set(cFile,'# NTU 光电子与生物光子学中心\n\n'+wiki('院校 - NTU','返回学校')+'\n\n'+cText+'\n');
else if(!get(cFile).includes(cText))updates.set(cFile,get(cFile).trimEnd()+'\n'+cText+'\n');
personLine(d,'- 院系／机构：',' '+wiki(center,'光电子与生物光子学中心')+' 主任。 '+source('NTU COEB 师资',ntu));
school(d,' | 电气与电子工程学院；',' | 电气与电子工程学院、光电子与生物光子学中心；');
const da=audit(d,[
 ['identity',dPhd,[brown10,ntu,dr],'confirmed'],
 ['affiliation','NTU EEE 副教授，COEB 主任。',[ntu,dr],'confirmed'],
 ['research','纳米光子学、纳米材料、量子点与光学成像。',[dr,ntu],'confirmed'],
 ['phd',dPhd,[brown10,ntu,dr],'confirmed_advisor'],
 ['postdoc',dPost,[dr,cen],'group_or_candidate']
],'继续找 Brown postdoctoral research associate 的具名导师或任用日期，以区分后续 senior research associate。');
relation(d,da,'phd',nur,'advisor',dPhd,[brown10,ntu,dr],'nurmikko');
const sameName='Brown 2009 系刊的 Liang Wu 研究脑信号。Penn 本人 2019 CV 明列 2009 Nanjing 学士，2015 Johns Hopkins 物理博士，研究凝聚态光谱。两条轨迹不符，排除同名。';
personLine(w,boundary,' '+sameName+' '+source('Brown 同名学位记录',brown9)+' · '+source('Penn 本人 2019 CV',wcv));
audit(w,[['identity',sameName,[brown9,wcv],'confirmed']],'本人博士与博士后指导原关系保留，Brown 2009 名录记录已排除。');
const pages=[
 {record_id:g,url:cvs,raw:'Wei Guo’s 2023 CV identifies H. J. Maris as PhD adviser and D. N. McKinsey at Yale as postdoc advisor.',excerpt:'确证两个阶段导师。'},
 {record_id:g,url:cv+'#page=1',raw:'Guo lists Brown PhD in 2008 and Yale Postdoctoral Associate in 2008–2010, then Associate Research Scientist in 2010–2012.',excerpt:'核时间和岗位，分列学位名录年度。'},
 {record_id:g,url:brown9,raw:'The Brown 2009 physics newsletter lists Wei Guo and his dissertation on electron bubbles in liquid helium.',excerpt:'核同人及博士论文。'},
 {record_id:d,url:brown10,raw:'Brown’s 2010 physics doctoral roster lists Cuong H. Dang and Advisor Arto Nurmikko.',excerpt:'学位原表交叉确证博士指导。'},
 {record_id:d,url:ntu,raw:'NTU COEB faculty directory names (Steve) Cuong Dang as EEE Associate Professor and COEB Director.',excerpt:'核中心与跨院系任职。'},
 {record_id:d,url:cen,raw:'Contemporary C&EN reports that Cuong H. Dang was Senior Research Associate at Brown and worked with Arto Nurmikko in 2012.',excerpt:'核后续任用，博士后正式导师仍待查。'},
 {record_id:w,url:wcv,raw:'Liang Wu’s Penn-hosted CV lists the Nanjing undergraduate degree and Johns Hopkins PhD in 2015, separating him from the 2009 Brown graduate.',excerpt:'排除 Brown 同名；保留 Penn 学者既有指导。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0920_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0920_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0920_Brown学位与WeiGuo具名博后原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
