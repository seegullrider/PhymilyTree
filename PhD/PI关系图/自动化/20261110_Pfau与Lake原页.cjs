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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0740';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0740_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

function addEdge(id,label,target,name,proof,after,candidate=false){
 const r=records.get(id);
 const line='- '+label+'：[['+target+'|'+name+']]。'+proof;
 editLine(fn(r.filename),l=>l.startsWith('- 核查边界：'),l=>line+'\n'+l);
 const file=candidate?path.join(root,'师承候选线索索引.md'):idx;
 editLine(file,l=>candidate?l==='# 师承候选线索索引':l.startsWith('- [['+r.filename+'|')&&l.includes('[['+after+'|'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+line.slice(2));
}
function newMentor(target,name,bio,student,reverse,proof){
 if(fs.existsSync(fn(target))||fs.existsSync(path.join(root,'师承人物',target+'.md')))throw Error('existing mentor '+target);
 const r=records.get(student);
 graph.set(fn(target),'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n\n- '+reverse+'：[['+r.filename+'|'+r.name+']]。'+proof+'\n');
}



const p='ec036f39', lake='10dee2bd';
const ste='师承人物 - Frank Steglich', sh='人员 - Stanford - Zhi-Xun Shen - 177eaec9', bar='师承人物 - Paul Barclay', paint='人员 - Caltech - Oskar Painter - cd1f2756';
const phys='https://science.psu.edu/physics/people/hfp5113', care='https://www.psu.edu/news/eberly-college-science/story/heike-pfau-receives-2026-national-science-foundation-career-award', book='https://link.springer.com/book/10.1007/978-3-319-39543-2', shen='https://arpes.stanford.edu/our-people/previous-members', hers='https://sites.google.com/lbl.gov/bl10hers/people';
const pBio='Penn State 物理系本人资料列 Stanford／SLAC 博后 2015–2018、Berkeley Lab 博后 2019–2020，以及 Stanford／SLAC 研究员 2021；学校新闻将 Stanford／SLAC 博后经历写作 2015–2021。按院系档分列岗位，保留新闻日期口径；Berkeley 指导者未具名。';
const shProof=web('Shen 组原档',shen)+'明确列本人为前博后。 '+web('Penn State 教师档',phys)+'与'+web('校方 2026 年报道',care)+'分列来源，见任职时间。';
const doc='Springer 论文版核实本人博士论文《Thermal Transport in Strongly Correlated Rare-Earth Intermetallic Compounds》；该目录未展示导师字段，旧本人 CV 中的导师记载保留。';
enrich(p,'phd',ste,'博士生',web('出版社学位论文版',book)+'。'+doc);
note(p,'- 核查边界：',pBio+' '+web('原教师档',phys)+' · '+web('2026 校新闻',care));
note(p,'- 研究方向：',web('物理系原档',phys)+'核对强电子关联、非常规超导与 ARPES；2026 CAREER 项目研究压力调控。');
note(p,'- 博士后阶段课题组负责人：',shProof);
mentorLine(sh,p,'- 博士后阶段课题组成员：',shProof);
indexLine(p,sh,'博士后阶段课题组负责人',shProof);
changeRow(p,null,'Zhi-Xun Shen（Stanford／SLAC 博士后课题组负责人）；2019–2020 Berkeley Lab 指导者待查；2021 Stanford／SLAC 教师档列研究员',web('校方奖项',care)+' · '+web('出版社论文',book));
const pAudit=audit(p,{phd:['confirmed_advisor',doc,[book,phys]],postdoc:['group_or_candidate',pBio+' Shen 组原档明确曾任组内博士后，正式导师职衔待核。',[shen,phys,care,hers]],affiliation:['confirmed','Penn State 物理系及 2026 官方报道均列物理学助理教授。',[phys,care]],research:['confirmed','现院系原档列强电子关联、非常规超导和角分辨光电子能谱，CAREER 报道补充压力调控。',[phys,care]]},'追查 Dresden 论文签署或致谢原件，并分别核实 Stanford／SLAC 与 Berkeley Lab 两段正式导师。');
relation(p,'postdoc',sh,'group_leader',shProof,[shen,phys,care,hers],pAudit,false);
const u='https://www.iqst.ca/media/mixed/itm/2016-09-20UToday1/University_of_Calgary_physicists_create_nano_sized_device_with_huge_potential_in_field_of_quantum_computing.html', bu='https://www.bu.edu/eng/2026/01/27/next-level-networking/', thesis='https://iqst.ucalgary.ca/publications/thesispubs.php';
const lProof='Calgary 2016 年同期校报具名 David Lake 为 Paul Barclay 组博士生，所述为金刚石光机械研究；正式论文导师签署待核。';
const lText=web('Calgary 同期报道',u)+'。'+lProof;
note(lake,'- 博士课题组负责人：',lText);
mentorLine(bar,lake,'- 博士阶段课题组成员：',lText);
indexLine(lake,bar,'博士课题组负责人',lText);
note(lake,'- 院系／机构：',web('Boston University 2026 工学院原档',bu)+'核电气与计算机工程助理教授。');
note(lake,'- 研究方向：',web('Boston University 工学院报道',bu)+'核量子互连、硅中铒掺杂量子平台，以及既往金刚石色心光机械与光学／微波光子比特。');
note(lake,'- 核查边界：',web('Boston University 入职报道',bu)+'区分 Caltech 博后与其后的 Staff Scientist 职务，原文未列两岗位分界日期。');
changeRow(lake,null,null,web('Calgary 博士在读报道',u)+' · '+web('BU 工学院入职原档',bu));
const lAudit=audit(lake,{phd:['group_or_candidate',lProof,[u,thesis]],postdoc:['group_or_candidate','Calgary Barclay 组与 Caltech Painter 组为两段已知博士后；BU 原档另列 Caltech Staff Scientist，区分岗位。导师正式称谓待核。',[bu]],affiliation:['confirmed','Boston University 工学院 2026 原档确认 ECE 助理教授。',[bu]],research:['confirmed','Boston University 工学院确认量子互连、硅中铒光子学；Calgary 校报核早期金刚石光机械。',[bu,u]]},'寻找 Calgary 学位论文可读封面和导师字段，继续区分 Calgary、Caltech 两段博后任命与 Caltech Staff Scientist。');
relation(lake,'phd',bar,'group_leader',lProof,[u,thesis,'https://barclaylab.ucalgary.ca/people/'],lAudit,false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Pfau与Lake原页';
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
