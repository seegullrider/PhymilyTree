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
 a.audit_id='20261110_'+id+'_thesis_group_postdoc_1444';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_thesis_group_postdoc_1444_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.replace(/ \|\s*$/,'').split(' | ');if(cells.length<5)throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  const source=cells.splice(4).join('。 ');cells.push(source+' '+text+' |');
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

const src={"unt":"https://digital.library.unt.edu/ark%3A/67531/metadc1205254/m2/1/high_res_d/6421936.pdf","tms":"https://www.tms.org/Meetings/Fall2002/Fall2002-techprog.pdf","lab":"https://rameshlab.lbl.gov/about-us","rice":"https://msne.rice.edu/people/faculty","rb":"https://mse.berkeley.edu/people_new/ramesh/","president":"https://president.rice.edu/communications/thank-you-and-best-wishes-ramamoorthy-ramesh","fitz":"https://www.ornl.gov/sites/default/files/2021-05/fitzsimmons_long_cv.pdf","aps":"https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.86.4394","os":"https://www.ornl.gov/news/fitzsimmons-elected-materials-research-society-vice-president","doe":"https://www.energy.gov/sites/prod/files/2014/05/f15/SunShot%20Summit%20Agenda%20FINAL.pdf"};
const link=(label,url)=>web(label,url)+'。';
const old=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,ev,urls)=>[old(id,k).status,old(id,k).note+' '+ev,urls];

const hoff='0b83a6d0';
const fitz='师承人物 - Michael R. Fitzsimmons';
const hoffCV='https://hoffmann.matse.illinois.edu/files/2025/04/Hoffmann-CV.pdf';
const ill='https://matse.illinois.edu/people/profile/axelh';
const hoffEv='Fitzsimmons 本人 CV 的 POSTDOCS MENTORED 栏明确列 Axel Hoffmann 及其 Argonne Group Leader 去向。Hoffmann 本人 CV 核 1999–2001 Los Alamos 博后，2001 年 APS 原文交叉核两人为同期 Los Alamos 同一中子反射研究项目。记录博后阶段研究师长，聘任文件的 advisor 称谓待核。';
const hoffProof=hoffEv+' '+link('Fitzsimmons 本人 CV',src.fitz)+' '+link('Hoffmann 本人 CV',hoffCV)+' '+link('2001 年论文原页',src.aps);
const hoffRow='Michael R. Fitzsimmons（1999–2001 Los Alamos 博士后阶段研究师长，正式任用称谓待核）';
editLine(fn(local(hoff)),l=>l.startsWith('- 核查边界：'),l=>'- 博士后阶段研究师长：[['+fitz+'|Michael R. Fitzsimmons]]。'+hoffProof+'\n- 核查边界：本人 CV 明确博士导师。Los Alamos 博后任用及阶段指导已核，正式任用称谓待查。');
editLine(idx,l=>l.startsWith('- [['+local(hoff)+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+local(hoff)+'|Axel Hoffmann]] → 博士后阶段研究师长：[['+fitz+'|Michael R. Fitzsimmons]]。'+hoffProof);
if(fs.existsSync(fn(fitz)))throw Error('已有 Fitzsimmons 同名节点，须先确认');
graph.set(fn(fitz),'# Michael R. Fitzsimmons\n\n> [!info] 师承扩展人物\n> Los Alamos 技术职员及 ORNL 中子科学研究人员，研究涉及薄膜和纳米结构的中子散射。'+link('ORNL 机构原档',src.os)+' '+link('本人 CV',src.fitz)+'\n\n## 师承\n\n- 博士后阶段研究者：[['+local(hoff)+'|Axel Hoffmann]]。'+hoffProof+'\n');
changeRow(hoff,null,hoffRow,hoffProof);
const ah=audit(hoff,{postdoc:['group_or_candidate',hoffEv,[src.fitz,hoffCV,src.aps]],affiliation:keep(hoff,'affiliation','Illinois 院档复核材料科学与工程系教职。',[ill]),research:keep(hoff,'research','Illinois 院档复核磁性异质结构、磁化动力学及自旋输运。',[ill])},'追 Los Alamos 1999–2001 Director’s Funded Fellowship 原任用或项目档案的正式指导字段。');
relation(hoff,'postdoc',fitz,'stage_mentor',hoffEv,[src.fitz,hoffCV,src.aps],ah,false);

const gareth='师承人物 - Gareth Thomas';
const phdEv='Ramesh 在 TMS 2002 年本人报告中回忆从 Gareth Thomas 组毕业。1987 Berkeley Lab 年报将 Gareth Thomas 列为项目负责人，项目出版物列 Ramesh 博士论文 Microstructure and Magnetization Reversal of Iron-Rare Earth Boron Permanent Magnets（LBL-24552）。核为博士阶段课题组，正式论文导师待签署页。';
const phdProof=phdEv+' '+link('本人 TMS 报告原文',src.tms)+' '+link('Berkeley Lab 年报',src.unt);
const pdEv='TMS 本人报告回忆毕业后在 Bellcore 做高温超导研究，并在 Berkeley NCEM 开展实验。实验室原档把 1989–1995 Bell Communications Research 列为 Member of Technical Staff，DOE 履历亦列 1989 入职。独立博后岗位和指导人继续待核。';
const pdProof=pdEv+' '+link('本人 TMS 报告原文',src.tms)+' '+link('本人组履历',src.lab)+' '+link('DOE 履历',src.doe);
for(const id of ['5f9c9300','35af1b59']){
 const rice=id==='5f9c9300';
 const name=records.get(id).name, target='[['+gareth+'|Gareth Thomas]]', reverse='[['+local(id)+'|'+name+']]';
 editLine(fn(local(id)),l=>l.startsWith('- 博士候选关系：')&&l.includes(target),()=>'- 博士阶段课题组负责人：'+target+'。'+phdProof);
 editLine(fn(gareth),l=>l.startsWith('- 博士候选研究者：')&&l.includes(reverse),()=>'- 博士阶段课题组成员：'+reverse+'。'+phdProof);
 editLine(idx,l=>l.startsWith('- '+reverse+' → 博士候选关系：')&&l.includes(target),()=>'- '+reverse+' → 博士阶段课题组负责人：'+target+'。'+phdProof);
 const aff=rice?'Rice 当前 MSNE 名录列兼职，校长 2025 年 3 月通知其退出校级科研行政职务。':'Berkeley 材料系及 Berkeley Lab 本人组档核材料科学与工程及物理系任职。';
 const affLinks=rice?link('Rice 材料系名录',src.rice)+' '+link('Rice 校长公告',src.president):link('Berkeley 材料系',src.rb)+' '+link('Berkeley Lab 本人组档',src.lab);
 editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：博士组属已核，继续查论文签署页。'+pdProof+' '+aff+' '+affLinks);
 changeRow(id,'Gareth Thomas（Berkeley 博士阶段课题组负责人，正式论文导师待核）','1989–1995 Bellcore 技术职员；独立博后经历待核',phdProof+' '+pdProof+' '+affLinks);
 const ar=audit(id,{
   phd:['group_or_candidate',phdEv,[src.tms,src.unt]],
   postdoc:['unresolved',pdEv,[src.tms,src.lab,src.doe]],
   affiliation:keep(id,'affiliation',aff,rice?[src.rice,src.president]:[src.rb,src.lab]),
   research:keep(id,'research','本人组档复核复杂功能氧化物薄膜，TMS 原报告核功能氧化物异质结构与界面。',[src.lab,src.tms])
 },'用 LBL-24552 追 Berkeley 论文签署原件。分查 1987 年毕业后至 1989 年间的任用及个人指导，保留 Bellcore 技术岗。');
 relation(id,'phd',gareth,'group_leader',phdEv,[src.tms,src.unt],ar,false);
}
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_论文组属与博后指导';
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

