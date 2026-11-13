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
 orig.audit_id='pi_archive_20261111_0250_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0250_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"orise":"https://orise.orau.gov/icpostdoc/profiles/2020/david-barton.html","org":"https://orise.orau.gov/icpostdoc/postdoc-research/applicants.html","nu":"https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/barton-david.html","bgrp":"https://nano-optics.seas.harvard.edu/alumni","sk":"https://kavli.berkeley.edu/sudi-chen","program":"https://kavli.berkeley.edu/node/20","uf":"https://phys.ufl.edu/directory/sudi-chen/","fgrp":"https://physics.berkeley.edu/research-faculty/ultrafast-nano-optics-group/people","so":"https://orise.orau.gov/icpostdoc/profiles/past-cohort/sara-mouradian.html","uw":"https://www.ee.washington.edu/spotlight/sara-mouradian-2023/","smit":"https://www.mtl.mit.edu/news/mtl-2018-fall-doctoral-dissertation-seminar-dds-dr-sara-mouradian","li":"https://kavli.berkeley.edu/shaowei-li","ucsd":"https://matsci.ucsd.edu/faculty/shaowei-li","year":"https://www.philomathia.org/wp-content/uploads/FINAL-Kavli-ENSI-2018-Annual-Report.pdf","cong":"https://kavli.berkeley.edu/cong-su","yale":"https://engineering.yale.edu/research-and-faculty/faculty-directory/cong-su"};
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
function add({id,name,file,mentor,forward,reverse,newForward='博士后导师',newReverse='博士后受指导者',type='advisor',evidence,links,after,school,other=[],next,closed=false,raw}){
 const urls=links.map(([,key])=>key);
 const refs=src(...links);
 const eid=audit(id,[
  ...other,
  a('postdoc',evidence,urls,type==='advisor'?'confirmed_advisor':'group_or_candidate')
 ],next);
 if(closed) audits.at(-1).followup_required=false;
 updateEdge(id,name,file,mentor,forward,reverse,newForward,newReverse,evidence,refs);
 cell(id,3,school);
 schoolWith(id,refs);
 rewrite(pf(id),x=>x.startsWith(boundary),x=>after?after(x,refs):x);
 relation(id,eid,'postdoc',file,type,evidence,ids(...urls),'postdoc');
 for(const [key,body,excerpt] of raw)pages.push({record_id:id,url:u[key],raw:body,excerpt});
}

add({
 id:'7b10cad8',name:'David Barton',file:'人员 - Harvard - Marko Lončar - a4c6b783',mentor:'Marko Lončar',
 forward:'博士后课题组负责人',reverse:'博士后课题组成员',
 evidence:'ORISE 的 IC Postdoctoral Research Fellowship 官方档将 David Barton III 的 Advisor 明列为 Marko Loncar，正文明确同人在 Harvard SEAS Lončar 组进行博士后研究。Northwestern 工学院履历列 IC fellowship 2020–2022，Harvard 组名录列 2020-09 至 2023-12。明确导师证据覆盖 IC fellowship，组档覆盖时段另记。可信度高。',
 links:[['ORISE 博后任用原档','orise'],['Northwestern 院系档','nu'],['Harvard 实验室校友档','bgrp']],
 after:(x,refs)=>boundary+'Stanford 学位目录核 Dionne 为博士主导师、Brongersma 与 Fan 为委员。ORISE 明确列 Harvard IC 博后 fellowship advisor Lončar；2020–2022 fellowship 与 2020-09 至 2023-12 的组属记录分别保留。 '+refs,
 school:'Marko Lončar（Harvard IC 博后 fellowship Advisor，校档 2020–2022；组属 2020-09 至 2023-12）',
 next:'两阶段均有官方具名导师及身份证据，已知时段分别记录。',
 closed:true,
 raw:[['orise','Dr. David Barton III; Advisor: Marko Loncar; postdoctoral fellow in Marko Lončar’s Harvard SEAS group; Stanford materials science PhD in 2020 working with Jennifer Dionne.','核任用、个人导师及 Stanford 同人。']]
});

add({
 id:'95701d41',name:'Sudi Chen',file:'人员 - UC Berkeley - Feng Wang - f6ff5120',mentor:'Feng Wang',
 forward:'博士后项目接收教师',reverse:'博士后项目受指导者',
 evidence:'Berkeley Kavli 的 2021–2023 Heising-Simons Junior Fellow 个人档明确列 Faculty Advisor: Professor Feng Wang，并列同人为 UCB Wang 组 Postdoctoral Fellow。项目说明明确为博士后研究 fellowship，faculty sponsor 参与监督研究进展。具名导师证据的范围为该博后 fellowship，可信度高。',
 links:[['Kavli 个人原档','sk'],['Kavli 项目角色说明','program'],['Wang 实验室人员档','fgrp']],
 after:(x,refs)=>boundary+'Stanford 书目确认 Zhi-Xun Shen 为博士主导师、Steven Kivelson 和 Young-Choon Lee 为委员。Berkeley 博后导师 Feng Wang 的具名证据覆盖 2021–2023 fellowship。后续如发现独立任用阶段，按原档追加。 '+refs,
 school:'Feng Wang（Berkeley 2021–2023 Heising-Simons 博士后 fellowship Faculty Advisor）',
 next:'已核博士论文导师、具名博士后 fellowship 导师及 UF 当前院系与研究。',
 closed:true,
 raw:[['program','Kavli Heising-Simons Junior Fellowship: two-year postdoctoral fellowships; each fellow has a faculty sponsor, who plays a role in overseeing their progress.','校方定义研究指导适用范围。']]
});

add({
 id:'2679b3eb',name:'Shaowei Li',file:'人员 - UC Berkeley - Michael Crommie - d0d635fd',mentor:'Michael Crommie',
 forward:'博士后导师',reverse:'博士后研究者',newReverse:'博士后研究者',
 evidence:'Berkeley Kavli ENSI 个人档将 Shaowei Li 列为 2018–2020 Heising-Simons Junior Fellow，明列 Previous Faculty Advisor: Professor Michael Crommie，现职对应 UC San Diego。UCSD 官方履历分列 Northwestern 博士后与后续 Berkeley fellowship。明确导师的证据覆盖 Berkeley fellowship。可信度高。',
 links:[['Berkeley fellowship 个人档','li'],['UCSD 官方履历','ucsd'],['Kavli 2018 年报原址','year']],
 after:(x,refs)=>boundary+'UCI 既有档列博士导师 Wilson Ho。Berkeley fellowship 的 Michael Crommie 为明示 Faculty Advisor。Northwestern Hersam 组、Berkeley Feng Wang 组按各自课题组归属保留。 '+refs,
 school:'Northwestern Mark C. Hersam（博士后课题组）；Berkeley Michael Crommie（2018–2020 fellowship Faculty Advisor）、Feng Wang（博士后课题组）',
 other:[a('affiliation','UC San Diego Chemistry 与 Materials Science and Engineering 项目。',['ucsd'],'confirmed'),a('research','扫描隧穿显微和光谱、超快激光、低维量子材料。',['ucsd'],'confirmed')],
 next:'继续核 Northwestern 博后及 Berkeley 联合组属是否另有明确个人指导角色。',
 raw:[['li','Shaowei Li, 2018–2020 Heising-Simons Junior Fellow. Previous Faculty Advisor: Professor Michael Crommie. Current Position: Assistant Professor, University of California, San Diego.','逐人确认获奖档及正式角色。'],['ucsd','UCSD Materials Science and Engineering faculty profile. PhD UCI 2017; Northwestern postdoctoral scholar; Berkeley Heising-Simons Junior Fellow; UCSD Chemistry faculty from 2021.','分开两个博士后阶段及现任。']]
});

add({
 id:'1546018f',name:'Cong Su',file:'人员 - UC Berkeley - Alex Zettl（荣休） - 63770bc9',mentor:'Alex Zettl',
 forward:'博士后导师',reverse:'博士后研究者',newReverse:'博士后研究者',
 evidence:'Berkeley Kavli ENSI 个人档列 Cong Su 为 2019–2021 Heising-Simons Junior Fellow，Previous Faculty Advisor: Professor Alex Zettl，现职 Yale Assistant Professor。Yale 工程院履历列 2019 获 fellowship。导师证据覆盖 fellowship，项目年份与 MIT 的博士授予记录分别保留。可信度高。',
 links:[['Berkeley fellowship 个人档','cong'],['Yale 官方履历','yale']],
 after:(x,refs)=>x+' '+refs+' 项目页年份按档记录，实际到岗时间继续查。',
 school:'Alex Zettl（Berkeley Heising-Simons 博士后 fellowship Faculty Advisor；项目档 2019–2021）',
 other:[a('affiliation','Yale Materials Science；应用物理关联按既有学院档。',['yale'],'confirmed'),a('research','二维材料、电子显微及纳米材料。',['yale'],'confirmed')],
 next:'查博士正式授予时间与 Berkeley fellowship 实际任用起始月，保留已核博士导师。',
 raw:[['cong','Cong Su, 2019–2021 Heising-Simons Junior Fellow; Previous Faculty Advisor: Professor Alex Zettl. Current Position: Assistant Professor, Yale University.','复核 fellowship 的具名指导。']]
});

add({
 id:'f377a735',name:'Sara Mouradian',file:'师承人物 - Hartmut Häffner',mentor:'Hartmut Häffner',
 forward:'博士后阶段研究师长',reverse:'博士后阶段研究者',newForward:'博士后阶段研究师长',newReverse:'博士后阶段研究者',
 type:'stage_mentor',
 evidence:'ORISE IC 博后任用原档明确称 Hartmut Haeffner 为 mentor，并描述其指导 Mouradian 构建离子阱量子传感器。UW ECE 校方访谈独立核她于 2018 年获 MIT 博士，后任 Berkeley IC Postdoctoral Fellow，并于 2022 年 3 月入 UW。博士后研究指导可信度高，原档未列 Advisor 字段。',
 links:[['ORISE 博后项目档','so'],['UW ECE 本人访谈','uw']],
 after:(x,refs)=>boundary+'MIT 2018 博士报告核 Dirk Englund 指导。ORISE 原档明示 Berkeley IC 博后研究 mentor Hartmut Häffner，UW 访谈核同一任用与入校日期。具体博士后任用职衔待核。 '+src(['MIT 博士报告','smit'])+' · '+refs,
 school:'Hartmut Häffner（Berkeley IC 博后阶段研究师长，ORISE 原档称 mentor）',
 other:[a('affiliation','UW Electrical and Computer Engineering，2022-03 入职。',['uw'],'confirmed'),a('research','离子阱量子信息与传感、量子光子学。',['uw','so'],'confirmed')],
 next:'继续查 Berkeley 独立任用或 CV 是否另有正式 Advisor 字段，查 MIT 论文签署页是否有其他导师。',
 raw:[['uw','Sara Mouradian joined UW ECE in March 2022; earned MIT doctoral degree in 2018; was Intelligence Community Postdoctoral Fellow at UC Berkeley before UW. Her group develops trapped-ion quantum information systems.','独立核对同人与博士、博士后和教职时间线。']]
});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0250_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0250_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0250_ORISE及BerkeleyKavli博后原档回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
