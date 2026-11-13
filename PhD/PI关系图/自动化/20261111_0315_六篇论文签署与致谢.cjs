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
 orig.audit_id='pi_archive_20261111_0315_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0315_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"c910a070":"https://stacks.stanford.edu/file/wn703tc4416/dissertation_Martin_Claassen-augmented.pdf","618aecd2":"https://stacks.stanford.edu/file/fx537ft0867/Thesis_ShuolongYang_08252016-augmented.pdf","52cfd31c":"https://stacks.stanford.edu/file/mb383cq6080/mainthesis-augmented.pdf","987dbd8e":"https://stacks.stanford.edu/file/qx755jp8899/phd_thesis_submitted_acrobat-augmented.pdf","a5840e08":"https://stacks.stanford.edu/file/ts058tr3575/Thesis_submitted-augmented.pdf","03066e1c":"https://stacks.stanford.edu/file/xm355cm5765/MPB%20dissertation%20for%20submission-augmented.pdf","cc":"https://searchworks.stanford.edu/view/12135013","yc":"https://searchworks.stanford.edu/view/11849403","wc":"https://searchworks.stanford.edu/view/12136864","sc":"https://searchworks.stanford.edu/view/11614105","ac":"https://searchworks.stanford.edu/view/9806196","bc":"https://searchworks.stanford.edu/view/11470050"};
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




const dev='人员 - Stanford - Thomas Devereaux - 4eedb35a', shen='人员 - Stanford - Zhi-Xun Shen - 177eaec9', don='师承人物 - Sebastian Doniach', reis='人员 - Stanford - David Reis - 1d6033f2', cai='师承人物 - Wei Cai', byer='师承人物 - Robert L. Byer', moerner='师承人物 - W. E. Moerner';
const pages=[];
function refine({id,name,catalog,advisors,note,cellText,next,mentors=[]}) {
 const refs=src(['Stanford 原论文签署页及致谢',id],['Stanford 图书馆',catalog]);
 for(const [file,display,evidence] of advisors)updateEdge(id,name,file,display,'博士导师','博士生','博士导师','博士生',evidence,refs);
 for(const [file,display,evidence] of mentors) {
  mentor(file,display,'论文致谢具名的博士阶段研究指导者。',src(['原始博士论文',id]));
  edge(id,name,file,display,'博士阶段研究师长','博士阶段受指导者',evidence,src(['原始博士论文',id]));
 }
 rewrite(pf(id),x=>x.startsWith(boundary),()=>boundary+note+' '+refs);
 cell(id,2,cellText);
 schoolWith(id,refs);
 const auditId=audit(id,[a('phd',advisors.map(([,d,t])=>d+' — '+t).join(' ')+' '+note,[id,catalog],'confirmed_advisor')],next);
 for(const [i,[file,display,evidence]] of advisors.entries())relation(id,auditId,'phd',file,'advisor',evidence,ids(id,catalog),'advisor'+i);
 for(const [i,[file,display,evidence]] of mentors.entries())relation(id,auditId,'phd',file,'stage_mentor',evidence,ids(id),'mentor'+i);
 return auditId;
}
const nixFile=mf('师承人物 - William D. Nix');
rewrite(nixFile,x=>x.startsWith('> [!warning]'),()=>'> [!info] 师承扩展人物');
rewrite(nixFile,x=>x==='> 尚未证实导师关系。',()=>'> 已确认指导、阶段研究师长和待核候选分别见各条来源。');
if(!get(nixFile).split(/\r?\n/).includes('## 师承'))updates.set(nixFile,get(nixFile).trimEnd()+'\n\n## 师承\n');
const c='c910a070',y='618aecd2',w='52cfd31c',s='987dbd8e',z='a5840e08',b='03066e1c';
refine({
 id:c,name:'Martin Claassen',catalog:'cc',
 advisors:[
  [dev,'Thomas Devereaux','2017 年 Stanford 博士论文第 iii 页明确列 Thomas Devereaux 为 Primary Adviser。第 v 页致谢亦称其为 advisor。可信度高。'],
  [don,'Sebastian Doniach','博士论文第 iii 页明确列 Sebastian Doniach 为 Co-Adviser。此前学位书目将其也列 primary，现按原论文注明共同导师。可信度高。']
 ],
 note:'原论文明确 Devereaux 主导师、Doniach 共同导师；Xiaoliang Qi 为审阅签署人。Flatiron 2017-09 至 2020-07 Research Fellow 的个人研究指导待任用原档。',
 cellText:'Thomas Devereaux（论文主导师）、Sebastian Doniach（共同导师）；Xiaoliang Qi（审阅签署人）',
 next:'学位角色已依签署页核定。继续查 Flatiron CCQ 2017–2020 任用的个人研究指导。'
});
refine({
 id:y,name:'Shuolong Yang',catalog:'yc',
 advisors:[
  [reis,'David A. Reis','2016 年 Stanford 博士论文第 iii 页明确列 David Reis 为 Primary Adviser，与 Zhi-Xun Shen 并列主导师。可信度高。'],
  [shen,'Zhi-Xun Shen','2016 年 Stanford 博士论文第 iii 页明确列 Zhi-Xun Shen 为 Primary Adviser，与 David Reis 并列主导师。可信度高。']
 ],
 mentors:[
  ['师承人物 - Jonathan Sobota','Jonathan Sobota','博士论文第 vi 页致谢明确称 Jonathan Sobota 与 Patrick Kirchmann 是自己七年来的 mentors 和合作研究者。记博士阶段研究师长。'],
  ['师承人物 - Patrick Kirchmann','Patrick Kirchmann','博士论文第 vi 页致谢明确称 Patrick Kirchmann 与 Jonathan Sobota 是自己七年来的 mentors 和合作研究者。记博士阶段研究师长。']
 ],
 note:'原论文确认两位并列主导师；Thomas Devereaux 为审阅签署人。Kyle Shen 的 Cornell 博后课题组已核，Darrell Schlom 的阶段候选保留。Cornell fellowship 标 2016–2019 与 Chicago 2018 年入职各按原机构档记录。',
 cellText:'David A. Reis、Zhi-Xun Shen（论文均列主导师）；Thomas Devereaux（审阅签署人）；博士阶段研究师长见人物页',
 next:'继续查 Cornell 博后任用中 Kyle Shen 与 Darrell Schlom 的个人指导及具体时段。'
});
refine({
 id:w,name:'Yao Wang',catalog:'wc',
 advisors:[
  [dev,'Thomas Devereaux','2017 年 Stanford 博士论文第 iii 页列 Thomas Devereaux 为 Primary Adviser，第 5 页原式签署栏亦列 Principal Adviser。可信度高。'],
  [shen,'Zhi-Xun Shen','博士论文第 iii 页列 Zhi-Xun Shen 为 Co-Adviser。学位书目原将两人均列 primary，现按论文明确共同导师。可信度高。']
 ],
 mentors:[
  ['师承人物 - Brian Moritz','Brian Moritz','博士论文第 8 页致谢在 my mentors 下列 Dr. Brian Moritz，并说明其对研究和博士学习的帮助。记录博士阶段研究师长。'],
  ['师承人物 - Cheng-Chien Chen','Cheng-Chien Chen','博士论文第 8 页致谢在 my mentors 下列 Prof. Cheng-Chien Chen，说明其对研究和博士学习的帮助。记录博士阶段研究师长。'],
  ['师承人物 - Krzysztof Wohlfeld','Krzysztof Wohlfeld','博士论文第 8 页致谢在 my mentors 下列 Prof. Krzysztof Wohlfeld，说明其对研究和博士学习的帮助。记录博士阶段研究师长。']
 ],
 note:'原论文确认 Devereaux 主导师、Shen 共同导师。Xiaoliang Qi 为审阅签署人。Harvard MPHQ 的 Demler 博后课题组归属照原档保留，个人指导职衔继续查。KCL 无线通信同名博士生及 NYU 视频工程教授为不同人。',
 cellText:'Thomas Devereaux（论文主导师）、Zhi-Xun Shen（共同导师）；Xiaoliang Qi（审阅签署人）；研究师长见人物页',
 next:'学位签署角色已核。继续查 Harvard MPHQ 2017–2020 博后的正式具名指导。'
});
refine({
 id:s,name:'Ryan B. Sills',catalog:'sc',
 advisors:[[cai,'Wei Cai','2016 年 Stanford 博士论文第 iii 页明确列 Wei Cai 为 Primary Adviser，致谢亦明确博士指导。可信度高。']],
 mentors:[
  ['师承人物 - Adrian Lew','Adrian Lew','博士论文第 8 页致谢具体说明 Adrian Lew 对第 2 章研究提供 advice and guidance。签署页亦列其审阅。记博士阶段研究师长兼审阅人。'],
  ['师承人物 - William D. Nix','William D. Nix','博士论文第 8 页致谢具体说明 William Nix 对第 4 章提供关键见解与合作。签署页亦列其审阅。记博士阶段研究师长兼审阅人。'],
  ['师承人物 - Dorian K. Balch','Dorian K. Balch','博士论文第 8 页致谢称 Dorian Balch 为整篇研究提供讨论、支持和引导。签署页亦列其审阅。记博士阶段研究师长兼审阅人。']
 ],
 note:'主导师为 Wei Cai。Adrian Lew、William Nix 和 Dorian Balch 是审阅签署人，论文致谢另具体说明三人的研究指导。Michael Thouless 对应此前 Michigan 硕士论文指导。Sandia 任职的独立博士后阶段继续查。',
 cellText:'Wei Cai（论文主导师）；Adrian Lew、William D. Nix、Dorian K. Balch（研究指导及审阅人）',
 next:'博士论文角色已核。继续查 Sandia 初任岗位是否有独立博士后任用。'
});
refine({
 id:z,name:'Alireza Marandi',catalog:'ac',
 advisors:[[byer,'Robert L. Byer','Stanford 博士论文第 iii 页明确列 Robert Byer 为 Primary Adviser，第 v 页致谢亦称其为 PhD advisor。可信度高。']],
 mentors:[
  ['师承人物 - Konstantin Vodopyanov','Konstantin Vodopyanov','博士论文第 v 页致谢明确说明 Konstantin Vodopyanov 的 mentorship 及其对整篇研究的指导和支持。记录博士阶段研究师长。'],
  ['师承人物 - Brian Lantz','Brian Lantz','博士论文第 v 页致谢明确称 Brian Lantz 为进入 Byer–Fejer 组第一年的 mentor，研究涉及 LIGO。记录博士阶段研究师长。']
 ],
 note:'Byer 为论文主导师。Butrus Khuri-Yakub、Olav Solgaard 是审阅签署人，致谢还列其参加口试。论文 2012 与 Caltech 2013 博士履历分别记录。Stanford 2013–2016 博后与日本 NII 访问的三位共事者仍需按个人与阶段细分。',
 cellText:'Robert L. Byer（论文主导师）；Butrus Khuri-Yakub、Olav Solgaard（审阅人）；博士阶段研究师长见人物页',
 next:'核论文与正式授位日期差异，追查 Stanford 博后及日本 NII 访问的各自个人指导。'
});
refine({
 id:b,name:'Mikael Backlund',catalog:'bc',
 advisors:[[moerner,'W. E. Moerner','Stanford 博士论文第 iii 页明确列 William Moerner 为 Primary Adviser，致谢亦称其为 advisor。可信度高。']],
 mentors:[['师承人物 - Mike Thompson（Stanford Moerner组）','Mike Thompson','博士论文第 8 页致谢将 Dr. Mike Thompson 称为 2010 年末进入 Moerner 组时的 mentor。身份依 Stanford 同组、阶段和论文上下文记录；与 Cornell Michael Thompson 分开。']],
 note:'Fayer 与 Pande 为审阅签署人，第 vii 页致谢明确其为 reading committee。目录 2015 与 Illinois 正式博士履历 2016 各按来源记录。Harvard–Smithsonian 2016–2020 博后由 Ron Walsworth 指导已有原档；博士论文末段的 Berkeley 本科研究导师单列于原文。',
 cellText:'W. E. Moerner（论文主导师）；Michael Fayer、Vijay Pande（审阅委员）；Mike Thompson（早期博士阶段研究师长）',
 next:'两个阶段的个人指导均有直接来源，继续核 Stanford 论文日期与正式授位年份差异。'
});

const hashes={
 [c]:'6e0852080a29fb5b014e4ddc2f1d94f155426223eefbd4e8c799b90a112fc38b',
 [y]:'7dfb5fe1e978970916cd290d34fcac8502bfe6460af16f2940e5c2493fe6c420',
 [w]:'50dd566b32da7ac7b1f1890503eefdfc5ecea5f142a027fc5b64ccebd2648630',
 [s]:'a9841e155cb2c442d973612ad4c20981e7afdea4d5c1b51c3bc2a216db1593a5',
 [z]:'1e583240734f911d7b0595c95797fa660bbf6fb55deb7a53fd0d508b886f05f2',
 [b]:'b3b85b17dd61d5afe5e820a385f49b2029c3095bc5f9ea08e84c5ebfd1364eaa'
};
for(const id of [c,y,w,s,z,b]){
 const a=audits.find(x=>x.record_id===id);
 pages.push({record_id:id,url:u[id],raw:a.aspects.phd.note+' PDF SHA-256 '+hashes[id],excerpt:'已直接提取文本层并视觉核对第 iii 页，指导关系与致谢按阶段和原角色记录。'});
}
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0315_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0315_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0315_六篇论文签署与致谢回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
