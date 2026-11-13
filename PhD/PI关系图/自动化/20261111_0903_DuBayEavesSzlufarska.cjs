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
 orig.audit_id='pi_archive_20261111_0903_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0903_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}







const e='88adecf9', z='7407a0bf', d='c1be0c3b';
const eName='Joel Eaves', zName='Izabela Szlufarska';
const reich='人员 - Columbia - David R. Reichman - 38d42d59', geiss='师承人物 - Phillip Geissler';
const stan='https://chemistry.stanford.edu/events/professor-joel-eaves-university-colorado-boulder';
const cu='https://www.colorado.edu/chemistry/joel-eaves';
const mit='https://dspace.mit.edu/entities/publication/2fda40fc-4e8a-410a-ade3-ee4e69fdd193';
const group='https://reichmangroup.chem.columbia.edu/directory';
const wis='https://engineering.wisc.edu/directory/profile/izabela-szlufarska/';
const tenn='https://trace.tennessee.edu/server/api/core/bitstreams/d440b17a-9645-4c4b-8933-c341431b496f/content';
const usc='https://stevens-computing-ai.usc.edu/directory/faculty/profile/?fname=Priya&lname=Vashishta';
const uscPaper='https://bpb-us-w1.wpmucdn.com/sites.usc.edu/dist/0/597/files/2020/12/Vashishta-Klein-JPCB06.pdf';
const vCV='https://viterbi.usc.edu/directory/cv/vashishta_priya_cv.pdf#page=34';
const pE='Stanford 化学系讲座履历在 MIT 2005 年物理化学博士项列 Andrei Tokmakoff 和 Phillip Geissler 为 Advisors。既有 MIT 论文书目明确 Tokmakoff 为 thesis advisor，Geissler 据讲座列博士阶段研究师长，正式论文共同导师职衔待原件。研究指导可信度高。';
const qE='Stanford 化学系讲座履历列 Columbia 博士后与 David Reichman 共事（2005–2008）。CU 系页和 Reichman 组档列 2005–2009，原档年份分别保留。博士后阶段工作关系可信度高，正式导师职衔待核。';
const sE=source('Stanford 讲座履历',stan);
const pLink=sE+' · '+source('MIT 论文书目',mit);
const qLink=sE+' · '+source('Colorado 化学系',cu)+' · '+source('Reichman 组档',group);
const ePerson=who(e,eName);
const eNew='博士后阶段研究师长', eBack='博士后阶段研究者';
const eEdge='- '+eNew+'：'+wiki(reich,'David R. Reichman')+'。'+qE+' '+qLink;
rewrite(pf(e),x=>x.startsWith('- 博士后课题组负责人：')&&x.includes(reich),()=>eEdge);
rewrite(mf(reich),x=>x.startsWith('- 博士后课题组成员：')&&x.includes(records.get(e).filename),()=>'- '+eBack+'：'+ePerson+'。'+qE+' '+qLink);
rewrite(index,x=>x.startsWith('- '+ePerson+' → 博士后课题组负责人：')&&x.includes(reich),()=>'- '+ePerson+' → '+eEdge.slice(2));
const ePhd='- 博士阶段研究师长：'+wiki(geiss,'Phillip Geissler')+'。'+pE+' '+pLink;
insertAfter(pf(e),'## 师承',ePhd);
insertAfter(mf(geiss),'## 师承','- 博士阶段受指导者：'+ePerson+'。'+pE+' '+pLink);
rewrite(index,x=>x.startsWith('- '+ePerson+' → 博士导师：'),(x,nl)=>x+nl+'- '+ePerson+' → '+ePhd.slice(2));
rewrite(pf(e),x=>x.startsWith(boundary),()=>boundary+'Geissler 的论文正式职衔及 Columbia 博士后具名任用原件仍待核。Stanford 讲座和 Colorado 系页的 Columbia 结束年份分记。 '+qLink);
school(e,' | Andrei Tokmakoff | David R. Reichman（博士后课题组负责人） | ',' | Andrei Tokmakoff（博士导师）、Phillip Geissler（博士阶段研究师长） | David R. Reichman（博士后阶段研究师长） | ');
schoolSource(e,' · '+sE);
const ae=audit(e,[
 ['identity','Stanford 讲座与 Colorado 化学系的姓名、MIT 博士、Columbia 博士后和 CU 教职一致。',[stan,cu],'confirmed'],
 ['affiliation','CU Boulder 化学教授、Eaves Research Group PI。',[cu],'confirmed'],
 ['research','凝聚相化学、量子信息、纳米材料的理论与计算。',[cu,stan],'confirmed'],
 ['phd',pE,[stan,mit],'confirmed_advisor'],
 ['postdoc',qE,[stan,cu,group],'group_or_candidate']
],'查 Geissler 论文共同导师签署页及 Columbia 博士后任用原件，保留任期差异。');
relation(e,ae,'phd',geiss,'stage_mentor',pE,[stan,mit],'geissler');
relation(e,ae,'postdoc',reich,'stage_mentor',qE,[stan,cu,group],'reichman');
const zProof='Tennessee 物理系访谈中本人确认 USC 博士后并提及未具名的数位博士后导师。USC 院系档把 Vashishta、Kalia 和 Nakano 列为同一计算材料团队；三人共同撰写的 2006 年研究综述在合并致谢中列 Szlufarska，Vashishta 本人 CV 列四人 2004 年的 SiC 纳米压痕原论文。保留为 USC 博士后导师候选，具体指导角色待具名履历或任用原档。';
const zLinks=[source('Tennessee 本人访谈',tenn),source('USC 团队院系档',usc),source('USC 托管原论文',uscPaper),source('Vashishta 本人 CV',vCV)].join(' · ');
const zIndex=path.join(root,'师承候选线索索引.md');
const za=audit(z,[
 ['affiliation','Wisconsin–Madison 材料科学与工程系 Harvey D. Spangler Professor，关联 Nuclear Engineering & Engineering Physics。',[wis],'confirmed'],
 ['research','计算材料科学、纳米力学、半导体及绝缘体辐照缺陷、固液界面。',[wis],'confirmed'],
 ['postdoc',zProof,[tenn,usc,uscPaper,vCV],'group_or_candidate']
],'追 USC 2002 年博士之后的任用记录、本人完整 CV 或课题组同期具名指导档。');
for(const [mid,label,suffix] of [['28542d00','Priya Darshan Vashishta','vashishta'],['8ae99197','Rajiv Kalia','kalia'],['82eab9e4','Aiichiro Nakano','nakano']]){
 const name=records.get(mid).filename;
 const link=wiki(name,label);
 const edge='- 博士后导师候选：'+link+'。'+zProof+' '+zLinks;
 insertAfter(pf(z),'## 师承',edge);
 insertAfter(mf(name),'## 师承','- 博士后阶段研究者候选（待核）：'+who(z,zName)+'。'+zProof+' '+zLinks);
 const row='- '+who(z,zName)+' → '+edge.slice(2);
 if(!get(zIndex).includes(row))updates.set(zIndex,get(zIndex).trimEnd()+'\n'+row+'\n');
 relation(z,za,'postdoc',name,'candidate',zProof,[tenn,usc,uscPaper,vCV],suffix);
}
rewrite(pf(z),x=>x.startsWith(boundary),()=>boundary+'本人确认 USC 博士后并提及多位导师。三位 USC 计算材料团队成员已按候选保存，待具名任用或指导证据。 '+zLinks);
school(z,' | John Quinn | 待核 | ',' | John Quinn | Priya Darshan Vashishta、Rajiv Kalia、Aiichiro Nakano（USC 博士后导师候选） | ');
schoolSource(z,' · '+source('Tennessee 本人访谈',tenn)+' · '+source('USC 计算材料团队原档',usc)+' · '+source('Vashishta 本人 CV',vCV));
const pages=[
 {record_id:e,url:stan,raw:'Stanford Chemistry speaker biography names Andrei Tokmakoff and Phillip Geissler in the MIT PhD advisor field and names David Reichman with the Columbia postdoc.',excerpt:'核博士研究指导与 Columbia 博士后具名研究关系。'},
 {record_id:e,url:cu,raw:'Colorado Chemistry lists Eaves’s Columbia Postdoctoral Scientist appointment as 2005–2009.',excerpt:'核对博后任期、化学系教职和研究方向。'},
 {record_id:z,url:wis,raw:'Wisconsin College of Engineering lists Szlufarska in Materials Science & Engineering with Nuclear Engineering & Engineering Physics affiliation and research in computational materials.',excerpt:'复核现任院系、关联单位及研究方向。'},
 {record_id:z,url:usc,raw:'USC identifies Vashishta, Rajiv Kalia and Aiichiro Nakano as collaborators in a USC computational materials research team.',excerpt:'核 USC 三位研究人员单位及团队，个人指导仍待原件。'},
 {record_id:z,url:uscPaper,raw:'The USC-hosted 2006 article by Vashishta, Kalia and Nakano acknowledges Izabela Szlufarska in a combined list of former and current colleagues and cites the four-person 2004 APL article.',excerpt:'核同期合作追查线索，保留候选。'},
 {record_id:z,url:vCV,raw:'Vashishta’s USC CV lists 2004 and 2005 silicon carbide nanoindentation papers coauthored with I. Szlufarska, R. K. Kalia and A. Nakano.',excerpt:'核论文时序与候选团队。'},
 {record_id:d,url:'https://uva.theopenscholar.com/files/dubay-group/files/20241209_CV_full.pdf#page=1',raw:'DuBay’s December 2024 CV identifies PhD advisor Phillip Geissler and postdoctoral advisors Geissler and Trauner at Berkeley and Reichman and Friesner at Columbia.',excerpt:'本人 CV 确证博士及两段博后共五条具名关系。'},
 {record_id:d,url:'https://chemistry.as.virginia.edu/people/kateri-h-dubay',raw:'UVA Chemistry lists DuBay as Associate Professor and describes soft condensed matter, polymer and nanomaterials research.',excerpt:'核现任与研究方向。'},
 {record_id:d,url:'https://uva.theopenscholar.com/dubay-group/people/dr-kateri-h-dubay',raw:'DuBay’s UVA group biography names Berkeley and Columbia postdoctoral appointments and confirms that she runs the group.',excerpt:'核两段博士后经历与独立课题组。'},
 {record_id:d,url:group,raw:'Reichman group directory lists Kateri DuBay in its former postdoc roster and gives 2010–2014 as its group dates.',excerpt:'核 Columbia 组属，任用年限与本人 CV 分列。'}
];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0903_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0903_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0903_DuBayEavesSzlufarska原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
