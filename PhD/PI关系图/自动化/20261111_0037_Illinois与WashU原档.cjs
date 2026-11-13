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
 orig.audit_id='pi_archive_20261111_0037_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0037_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"har":"https://citeseerx.ist.psu.edu/document?doi=643377d21d2ea74eb65f31e9ad242d6061b4acc2&repid=rep1&type=pdf","dcat":"https://www.ideals.illinois.edu/items/66390","dp":"https://quantum.research.purdue.edu/directory/supriyo-datta/","il":"https://ece.illinois.edu/alumni/awards/distinguished/13-datta","ie":"https://ieee-uffc.org/files/ieeeuffcorg/2023-11/UFFC-S%20Newsletter%20May%201985.pdf","wa":"https://engineering.washu.edu/faculty/Edwin-Carlen.html","ic":"https://icmts.net/files/ICMTS2011_program.pdf","wims":"https://wimserc.org/alumni.php","ts":"https://www.ims.tsukuba.ac.jp/~plasmonics_lab/old_pubs.html","mi":"https://ece.engin.umich.edu/alumni/alumni-in-academia/","na":"https://ptacts.uspto.gov/ptacts/public-informations/petitions/1539142/download-documents?artifactId=3BWl7LFsh8W22hEEUsDQKffgPGj6Vh3on9batFHwYLiaUDb1Hyb9s4k","ka":"https://www.umass.edu/news/article/memoriam-frank-erwin-karasz","wi":"https://events.umich.edu/event/45615"};
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




const d='5d54f243', c='5cf87d48', m='b1e35665';
const dm='师承人物 - Bill J. Hunsinger', cm='师承人物 - Carlos H. Mastrangelo', cw='师承人物 - Ken Wise（身份待核）';
const dn='Supriyo Datta', cn='Edwin Carlen';
const de='Illinois Coordinated Science Laboratory 1978–1979 年报第 77 页列 B. J. Hunsinger 为 Microwave Acoustics 唯一列名教师，并将 S. Datta 列为本组研究生。同一原档列 Datta 1979 年同题报告 R-849，Purdue 与 Illinois ECE 官方履历核学位、单位和方向。课题组关系可信度高，论文正式导师仍待签署页。';
const dl=src(['Illinois 实验室年度原档','har'],['Purdue 量子研究所','dp'],['Illinois ECE 校友档','il']);
updateEdge(d,dn,dm,'Bill J. Hunsinger','博士候选关系','博士候选研究者','博士课题组负责人','博士课题组成员',de,dl);
rewrite(pf(d),x=>x.startsWith(boundary),()=>boundary+'Illinois 年报核 Hunsinger 博士课题组。论文题名 Theory of Guided Acoustic Waves in Piezoelectric Solids，IDEALS 馆藏页 403，正式指导待签署页。IEEE 1985 年通讯记录 1979 毕业后在 Illinois 两年任 Visiting Assistant Professor，1981 年到 Purdue。已核资料未发现单列博士后岗位。 '+dl+' · '+src(['Illinois 学位馆藏入口','dcat'],['IEEE 同期职业履历','ie']));
cell(d,2,'Bill J. Hunsinger（1978–1979 Illinois 博士课题组负责人；正式导师待论文签署页）');
cell(d,3,'已核 1979–1981 Illinois Visiting Assistant Professor、1981 起 Purdue；已核资料未见博士后任用');
schoolWith(d,dl+' · '+src(['IEEE 同期职业履历','ie']));
const da=audit(d,[
 a('identity','Purdue、Illinois 和 IEEE 本人职业历程对上。',['dp','il','ie'],'confirmed'),
 a('affiliation','Purdue Electrical and Computer Engineering 特聘教授。',['dp'],'confirmed'),
 a('research','非平衡格林函数与量子输运、自旋电子学、分子热电、量子器件。',['dp','il'],'confirmed'),
 a('phd',de,['har','dp','il'],'group_or_candidate'),
 a('postdoc','IEEE 1985 通讯核 1979 博士后在 Illinois 先任两年 Visiting Assistant Professor，1981 起在 Purdue。已核资料未发现博士后职衔。',['ie','dp','il'],'no_postdoc_documented')
],'查 Illinois 限阅学位论文签署页或同题 CSL R-849 报告独立全文，核 Hunsinger 的正式指导。');
relation(d,da,'phd',dm,'group_leader',de,ids('har','dp','il'),'hunsinger');

const ce='Michigan ECE 校友原地址和 Najafi CV 原地址均 403。索引文本分别将 Mastrangelo 列于 2001 博士校友的导师栏、答辩委员会清单，但签署页未取得。WIMS 原名录核题名 Electrothermally Actuated Polymer Microvalves 和 2001，筑波大学 Carlen 组论文表核同期研究合作。保留博士导师候选，待原档。';
const cwl='Michigan ECE 校友索引内容对同一 2001 Michigan EE 博士列 Kensall Wise 和 Carlos Mastrangelo，原页面返回 403。Carlen 筑波大学组论文表核 Wise 与 Carlen 当期合作。候选可信度低，原档及签署页待查。';
const cl=src(['Michigan ECE 校友原地址','mi'],['Najafi CV 原地址','na'],['WIMS 原名录','wims'],['Carlen 组论文档','ts']);
updateEdge(c,cn,cm,'Carlos H. Mastrangelo','博士导师候选','博士生候选','博士导师候选','博士生候选',ce,cl);
rewrite(mf(cw),x=>x.startsWith('> 本节点只用于'),()=>'> Michigan ECE 官方活动同时使用 Kensall D. Wise 和 Ken Wise，核对到同一 MEMS 教授。两位研究者的导师关系仍按各自来源标为候选。 '+src(['Michigan ECE 活动原档','wi']));
edge(c,cn,cw,'Kensall D. Wise','博士导师候选','博士生候选',cwl,src(['Michigan ECE 校友原地址','mi'],['Carlen 组论文档','ts']));
rewrite(pf(c),x=>x.startsWith(boundary),()=>boundary+'WashU 院档与 WIMS 名录核 2001 Michigan 电气工程博士及论文题名。Michigan ECE 校友档、Najafi CV 原地址均 403，Mastrangelo 和 Wise 留作候选。ICMTS 个人履历分列 2000–2003 Corning-Intellisense、2003–2005 Draper Laboratory、2006 年起 Twente 3TU Assistant Professor；已核资料未发现博士后任用。 '+src(['WashU 工学院','wa'],['ICMTS 个人履历','ic'],['WIMS 原名录','wims']));
cell(c,2,'Carlos H. Mastrangelo、Kensall D. Wise（Michigan 博士导师候选，原导师档待核）');
cell(c,3,'2000–2005 产业与实验室岗位，2006 起 Twente 助理教授；已核资料未见博士后任用');
schoolWith(c,cl+' · '+src(['ICMTS 个人履历','ic']));
const ca=audit(c,[
 a('identity','WashU 工学院与 ICMTS 会议个人履历核 Michigan 2001 EE 博士和后续任职。',['wa','ic','wims'],'confirmed'),
 a('affiliation','WashU Mechanical Engineering & Materials Science Professor of Practice。',['wa'],'confirmed'),
 a('research','纳米光子学与等离激元、纳米制造、微纳传感、增强 Raman。',['wa'],'confirmed'),
 a('phd',ce+' '+cwl,['wims','ts','mi','na'],'group_or_candidate'),
 a('postdoc','ICMTS 个人履历核 Corning-Intellisense、Draper Laboratory、Twente 任用，已核来源未发现博士后职衔。',['ic','wa'],'no_postdoc_documented')
],'按 WIMS 论文题名找 Michigan 学位签署页，独立核对 Mastrangelo 与 Wise 的角色。');
relation(c,ca,'phd',cm,'candidate',ce,ids('na','mi','wims','ts'),'mastrangelo');
relation(c,ca,'phd',cw,'candidate',cwl,ids('mi','ts'),'wise');
line(mf('师承人物 - Frank E. Karasz'),x=>x.startsWith('- UMass Amherst'),' · '+src(['UMass 高分子系原纪念文','ka']));

const pages=[
 [d,'har','CSL Annual Progress Report lists B. J. Hunsinger as the sole faculty member on its Microwave Acoustics roster, and S. Datta among the graduate students; the same section lists the title and technical report number R-849.','核定博士课题组和报告题名，正式导师待签署页。'],
 [d,'dp','Purdue Quantum Science and Engineering Institute identifies Supriyo Datta’s ECE title, Illinois 1979 PhD and quantum transport research.','核定人物、院系、博士与方向。'],
 [d,'ie','The 1985 IEEE newsletter dates the two years as visiting assistant professor at Illinois before he joined Purdue.','已查岗位职衔，未见另设博士后。'],
 [c,'wa','WashU Engineering lists the current MEMS appointment, research and Michigan EE PhD in 2001.','核定身份、院系、博士及研究方向。'],
 [c,'ic','ICMTS 2011 biography names Corning-Intellisense 2000–2003, Draper 2003–2005 and Twente 3TU Assistant Professor from 2006.','核对毕业后早期岗位，未见博士后任用。'],
 [c,'wims','WIMS alumni roster gives Carlen’s dissertation title and 2001, with no usable advisor name in its center advisor field.','核对学位题名与年份，导师待原档。'],
 [c,'ts','Carlen’s Tsukuba lab publication list records his graduate-era projects with Mastrangelo and Wise.','候选同期合作佐证。'],
 [c,'wi','University of Michigan ECE identifies the MEMS professor Kensall D. Wise by his nickname Ken Wise.','核对导师候选节点的全名与别名。'],
 [m,'ka','The UMass department remembrance identifies Frank Erwin Karasz and his faculty appointment.','核对具名博士后阶段研究师长的身份。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
pages.push({record_id:d,url:u.dcat,error:'403 Forbidden; indexed Illinois-restricted dissertation, signature pages unavailable'});
pages.push({record_id:c,url:u.mi,error:'403 Forbidden; indexed departmental entry gives two advisor names, direct source not yet verified'});
pages.push({record_id:c,url:u.na,error:'403 Forbidden; indexed CV gives Mastrangelo, direct source not yet verified'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0037_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0037_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0037_Illinois与WashU原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
